import json
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from api.schemas.responses import ApiEnvelope, GalleryResponse, GenerationOutput
from api.services.config_store import ConfigStore
from api.services.mflux_cli import _resolve_path

router = APIRouter(prefix="/api", tags=["gallery"])
store = ConfigStore()
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}

try:
    import piexif  # type: ignore[import-not-found]
    from PIL import Image  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover - optional runtime enhancement
    piexif = None
    Image = None


def _read_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def _read_sidecar_metadata(path: Path) -> tuple[dict, str | None]:
    candidates = (path.with_suffix(".metadata.json"), path.with_suffix(".json"))
    for candidate in candidates:
        if candidate.exists():
            return _read_json(candidate), candidate.name
    return {}, None


def _read_embedded_metadata(path: Path) -> tuple[dict, str | None]:
    if Image is None:
        return {}, None
    try:
        with Image.open(path) as image:
            width, height = image.size
            metadata: dict = {"width": width, "height": height}
            exif_source = None
            exif_bytes = image.info.get("exif")
            if exif_bytes and piexif is not None:
                exif_dict = piexif.load(exif_bytes)
                user_comment = exif_dict.get("Exif", {}).get(0x9286, b"")
                if user_comment:
                    if user_comment.startswith(b"ASCII\x00\x00\x00"):
                        user_comment = user_comment[8:]
                    try:
                        metadata.update(json.loads(user_comment.decode("utf-8")))
                        exif_source = "embedded-exif"
                    except (UnicodeDecodeError, json.JSONDecodeError):
                        pass
            xmp_data = image.info.get("XML:com.adobe.xmp")
            if xmp_data:
                metadata["xmp"] = xmp_data
                return metadata, exif_source or "embedded-xmp"
            return metadata, exif_source
    except OSError:
        return {}, None


def _merge_metadata(path: Path) -> tuple[dict, str]:
    sidecar_metadata, sidecar_source = _read_sidecar_metadata(path)
    embedded_metadata, embedded_source = _read_embedded_metadata(path)
    metadata = {**embedded_metadata, **sidecar_metadata}
    if not metadata:
        return {}, "none"
    if sidecar_source:
        return metadata, sidecar_source
    if embedded_source:
        return metadata, embedded_source
    return metadata, "none"


def _classify_module(path: Path, metadata: dict) -> str:
    filename = path.stem.lower()
    if "controlnet_canny" in filename or filename.endswith("_canny"):
        return "controlnet-preview"
    if metadata.get("masked_image_path"):
        return "inpaint"
    if metadata.get("controlnet_image_path"):
        return "controlnet"
    if metadata.get("depth_image_path") or "depth" in filename:
        return "depth-pro"
    if metadata.get("image_path"):
        model = str(metadata.get("model", "")).lower()
        if "kontext" in model:
            return "kontext"
        if metadata.get("image_strength") is not None:
            return "img2img"
        return "img2img"
    model = str(metadata.get("model", "")).lower()
    if "seedvr2" in model or "seedvr2" in filename:
        return "upscaler"
    if metadata.get("prompt"):
        return "txt2img"
    return "unknown"


def _coerce_int(value: object, default: int = 0) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


def _coerce_float(value: object) -> float | None:
    try:
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _output_dir() -> Path:
    config = store.load()
    output_dir = _resolve_path(config.paths.outputDir)
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


@router.get("/gallery/file")
def get_gallery_file(path: str = Query(...)) -> FileResponse:
    output_dir = _output_dir().resolve()
    file_path = Path(path).resolve()
    try:
        file_path.relative_to(output_dir)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail="File is outside configured output directory") from exc
    if not file_path.exists() or file_path.suffix.lower() not in IMAGE_SUFFIXES:
        raise HTTPException(status_code=404, detail="Gallery file not found")
    return FileResponse(file_path)


@router.get("/gallery")
def get_gallery() -> ApiEnvelope[GalleryResponse]:
    output_dir = _output_dir()
    items: list[GenerationOutput] = []
    for path in sorted(output_dir.rglob("*"), key=lambda candidate: candidate.stat().st_mtime, reverse=True):
        if not path.is_file() or path.suffix.lower() not in IMAGE_SUFFIXES:
            continue
        metadata, metadata_source = _merge_metadata(path)
        model = str(metadata.get("model", "unknown"))
        items.append(
            GenerationOutput(
                id=path.stem,
                path=str(path),
                thumbnailPath=f"/api/gallery/file?path={quote(str(path))}",
                moduleType=_classify_module(path, metadata),
                prompt=str(metadata.get("prompt") or metadata.get("description") or path.stem),
                negativePrompt="" if metadata.get("negative_prompt") is None else str(metadata.get("negative_prompt", "")),
                model=model,
                seed=_coerce_int(metadata.get("seed"), 0),
                createdAt=datetime.fromtimestamp(path.stat().st_mtime),
                width=_coerce_int(metadata.get("width"), 0) or None,
                height=_coerce_int(metadata.get("height"), 0) or None,
                steps=_coerce_int(metadata.get("steps"), 0) or None,
                guidance=_coerce_float(metadata.get("guidance")),
                scheduler=str(metadata["scheduler"]) if metadata.get("scheduler") else None,
                metadataSource=metadata_source,
                baseModel=None if metadata.get("base_model") in {None, "None", ""} else str(metadata.get("base_model")),
                precision=str(metadata["precision"]) if metadata.get("precision") else None,
                quantize=_coerce_int(metadata.get("quantize"), 0) or None,
                generationTimeSeconds=_coerce_float(metadata.get("generation_time_seconds")),
                mfluxVersion=str(metadata["mflux_version"]) if metadata.get("mflux_version") else None,
            )
        )
    return ApiEnvelope(ok=True, data=GalleryResponse(total=len(items), items=items))
