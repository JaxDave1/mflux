import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from api.schemas.responses import ApiEnvelope, ApiError, CacheRoots, ModelMetadata, ModelsResponse, ModelSummary
from api.services.config_store import ConfigStore
from api.services.mflux_cli import _resolve_path

router = APIRouter(prefix="/api", tags=["models"])
store = ConfigStore()

WEIGHT_SUFFIXES = {".safetensors", ".ckpt", ".pt", ".pth", ".gguf", ".bin"}
BUILTIN_MODELS: list[dict[str, Any]] = [
    {"id": "dev", "name": "FLUX.1 Dev", "type": "checkpoint", "architecture": "FLUX.1", "size": "12B", "repoId": "black-forest-labs/FLUX.1-dev", "notes": "Primary FLUX.1 quality model."},
    {"id": "schnell", "name": "FLUX.1 Schnell", "type": "checkpoint", "architecture": "FLUX.1", "size": "12B", "repoId": "black-forest-labs/FLUX.1-schnell", "notes": "Fast distilled FLUX.1 generation path."},
    {"id": "dev-kontext", "name": "FLUX.1 Kontext Dev", "type": "checkpoint", "architecture": "FLUX.1 Kontext", "size": "12B", "repoId": "black-forest-labs/FLUX.1-Kontext-dev", "notes": "Image-conditioned Kontext generation family."},
    {"id": "dev-fill", "name": "FLUX.1 Fill Dev", "type": "checkpoint", "architecture": "FLUX.1 Fill", "size": "12B", "repoId": "black-forest-labs/FLUX.1-Fill-dev", "notes": "Prompt-driven fill and inpaint family."},
    {"id": "dev-redux", "name": "FLUX.1 Redux Dev", "type": "checkpoint", "architecture": "FLUX.1 Redux", "size": "12B", "repoId": "black-forest-labs/FLUX.1-Redux-dev", "notes": "Redux reference-image generation variant."},
    {"id": "dev-depth", "name": "FLUX.1 Depth Dev", "type": "checkpoint", "architecture": "FLUX.1 Depth", "size": "12B", "repoId": "black-forest-labs/FLUX.1-Depth-dev", "notes": "Depth-conditioned FLUX workflow."},
    {"id": "dev-controlnet-canny", "name": "FLUX.1 Dev ControlNet Canny", "type": "checkpoint", "architecture": "FLUX.1 ControlNet", "size": "12B", "repoId": "black-forest-labs/FLUX.1-dev", "extraRepoIds": ["InstantX/FLUX.1-dev-Controlnet-Canny"], "notes": "Canny-conditioned ControlNet path."},
    {"id": "schnell-controlnet-canny", "name": "FLUX.1 Schnell ControlNet Canny", "type": "checkpoint", "architecture": "FLUX.1 ControlNet", "size": "12B", "repoId": "black-forest-labs/FLUX.1-schnell", "extraRepoIds": ["InstantX/FLUX.1-dev-Controlnet-Canny"], "notes": "Fast canny-conditioned ControlNet path."},
    {"id": "dev-controlnet-upscaler", "name": "FLUX.1 Dev ControlNet Upscaler", "type": "upscaler", "architecture": "FLUX.1 ControlNet", "size": "12B", "repoId": "black-forest-labs/FLUX.1-dev", "extraRepoIds": ["jasperai/Flux.1-dev-Controlnet-Upscaler"], "notes": "ControlNet-based upscaler family."},
    {"id": "dev-fill-catvton", "name": "FLUX.1 Fill CatVTON", "type": "checkpoint", "architecture": "FLUX.1 Fill", "size": "12B", "repoId": "black-forest-labs/FLUX.1-Fill-dev", "extraRepoIds": ["xiaozaa/catvton-flux-beta"], "notes": "CatVTON garment-transfer specialization."},
    {"id": "krea-dev", "name": "Krea Dev", "type": "checkpoint", "architecture": "Krea / FLUX", "size": "12B", "repoId": "black-forest-labs/FLUX.1-Krea-dev", "notes": "Krea-oriented FLUX dev variant."},
    {"id": "flux2-klein-4b", "name": "FLUX.2 Klein 4B", "type": "checkpoint", "architecture": "FLUX.2", "size": "4B", "repoId": "black-forest-labs/FLUX.2-klein-4B", "notes": "Fast FLUX.2 generation and edit family."},
    {"id": "flux2-klein-9b", "name": "FLUX.2 Klein 9B", "type": "checkpoint", "architecture": "FLUX.2", "size": "9B", "repoId": "black-forest-labs/FLUX.2-klein-9B", "notes": "Higher-capacity FLUX.2 generation path."},
    {"id": "flux2-klein-base-4b", "name": "FLUX.2 Klein Base 4B", "type": "checkpoint", "architecture": "FLUX.2", "size": "4B", "repoId": "black-forest-labs/FLUX.2-klein-base-4B", "notes": "Base FLUX.2 family variant."},
    {"id": "flux2-klein-base-9b", "name": "FLUX.2 Klein Base 9B", "type": "checkpoint", "architecture": "FLUX.2", "size": "9B", "repoId": "black-forest-labs/FLUX.2-klein-base-9B", "notes": "Higher-quality base FLUX.2 model."},
    {"id": "qwen-image", "name": "Qwen Image", "type": "checkpoint", "architecture": "Qwen", "size": "20B", "repoId": "Qwen/Qwen-Image", "notes": "Qwen image generation family."},
    {"id": "qwen-image-edit", "name": "Qwen Image Edit", "type": "checkpoint", "architecture": "Qwen", "size": "20B", "repoId": "Qwen/Qwen-Image-Edit-2509", "notes": "Qwen edit and multi-image editing family."},
    {"id": "fibo", "name": "FIBO", "type": "checkpoint", "architecture": "FIBO", "size": "8B", "repoId": "briaai/FIBO", "notes": "High-quality FIBO generation family."},
    {"id": "fibo-lite", "name": "FIBO Lite", "type": "checkpoint", "architecture": "FIBO", "size": "8B", "repoId": "briaai/Fibo-lite", "notes": "Fast distilled FIBO variant."},
    {"id": "fibo-edit", "name": "FIBO Edit", "type": "checkpoint", "architecture": "FIBO", "size": "8B", "repoId": "briaai/Fibo-Edit", "notes": "Image editing variant for FIBO."},
    {"id": "fibo-edit-rmbg", "name": "FIBO Edit RMBG", "type": "checkpoint", "architecture": "FIBO", "size": "8B", "repoId": "briaai/Fibo-Edit-RMBG", "notes": "Background-removal oriented edit model."},
    {"id": "z-image", "name": "Z-Image", "type": "checkpoint", "architecture": "Z-Image", "size": "6B", "repoId": "Tongyi-MAI/Z-Image", "notes": "Z-Image quality generation path."},
    {"id": "z-image-turbo", "name": "Z-Image Turbo", "type": "checkpoint", "architecture": "Z-Image", "size": "6B", "repoId": "Tongyi-MAI/Z-Image-Turbo", "notes": "Fast distilled image model with strong local performance.", "triggerWords": ["realism", "stylized"]},
    {"id": "seedvr2-3b", "name": "SeedVR2 3B", "type": "upscaler", "architecture": "SeedVR2", "size": "3B", "repoId": "numz/SeedVR2_comfyUI", "notes": "Dedicated super-resolution upscaler."},
    {"id": "seedvr2-7b", "name": "SeedVR2 7B", "type": "upscaler", "architecture": "SeedVR2", "size": "7B", "repoId": "numz/SeedVR2_comfyUI", "notes": "Higher-capacity super-resolution upscaler."},
    {"id": "depth-pro", "name": "Depth Pro", "type": "depth", "architecture": "Depth Pro", "size": "Apple", "repoId": None, "cacheFolder": "depth_pro", "notes": "Apple monocular depth estimation."},
]


class CacheRequest(BaseModel):
    id: str


def _default_mflux_cache_dir() -> Path:
    if os.environ.get("MFLUX_CACHE_DIR"):
        return Path(os.environ["MFLUX_CACHE_DIR"]).expanduser()
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Caches" / "mflux"
    return Path.home() / ".cache" / "mflux"


def _hf_hub_cache(config_hf_home: str) -> Path:
    if os.environ.get("HUGGINGFACE_HUB_CACHE"):
        return Path(os.environ["HUGGINGFACE_HUB_CACHE"]).expanduser()
    if os.environ.get("HF_HOME"):
        return Path(os.environ["HF_HOME"]).expanduser() / "hub"
    resolved = Path(config_hf_home).expanduser()
    if resolved.name == "hub":
        return resolved
    return resolved / "hub"


def _repo_snapshot_dir(repo_id: str, hf_cache_root: Path) -> Path:
    return hf_cache_root / f"models--{repo_id.replace('/', '--')}" / "snapshots"


def _repo_cached(repo_id: str, hf_cache_root: Path) -> bool:
    snapshot_root = _repo_snapshot_dir(repo_id, hf_cache_root)
    if not snapshot_root.exists():
        return False
    for snapshot in snapshot_root.iterdir():
        if snapshot.is_dir() and any(snapshot.rglob("*")):
            return True
    return False


def _depth_pro_cached(mflux_cache_root: Path) -> bool:
    cache_dir = mflux_cache_root / "depth_pro"
    if not cache_dir.exists():
        return False
    return any(path.is_file() for path in cache_dir.rglob("*"))


def _format_size(num_bytes: int) -> str:
    if num_bytes <= 0:
        return "unknown"
    units = ["B", "KB", "MB", "GB", "TB"]
    value = float(num_bytes)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.1f}{unit}" if unit != "B" else f"{int(value)}B"
        value /= 1024
    return "unknown"


def _collect_weight_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    return [path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in WEIGHT_SUFFIXES]


def _scan_custom_models(root: Path, active_model: str) -> list[ModelSummary]:
    ignored_fragment = "/src/mflux/models"
    models: list[ModelSummary] = []
    for path in _collect_weight_files(root):
        if ignored_fragment in str(path):
            continue
        stem = path.stem
        models.append(
            ModelSummary(
                id=f"custom-{stem.lower().replace(' ', '-')}",
                name=stem.replace("_", " ").replace("-", " ").title(),
                type="checkpoint",
                architecture="Custom",
                size=_format_size(path.stat().st_size),
                path=str(path),
                active=active_model == stem,
                source="custom",
                repoId=None,
                metadata=ModelMetadata(
                    notes="Detected custom local checkpoint.",
                    installed=True,
                    detectedFiles=1,
                    cached=True,
                ),
            )
        )
    return sorted(models, key=lambda item: item.name.lower())


def _scan_loras(root: Path) -> list[ModelSummary]:
    files = sorted(path for path in root.rglob("*.safetensors")) if root.exists() else []
    return [
        ModelSummary(
            id=f"lora-{path.stem.lower().replace(' ', '-')}",
            name=path.stem.replace("_", " ").replace("-", " ").title(),
            type="lora",
            architecture="LoRA",
            size=_format_size(path.stat().st_size),
            path=str(path),
            active=False,
            source="lora",
            repoId=None,
            metadata=ModelMetadata(
                notes="Detected local LoRA asset.",
                installed=True,
                detectedFiles=1,
                cached=True,
            ),
        )
        for path in files
    ]


def _builtin_models(active_model: str, hf_cache_root: Path, mflux_cache_root: Path, default_quantize: int) -> list[ModelSummary]:
    models: list[ModelSummary] = []
    for item in BUILTIN_MODELS:
        if item["id"] == "depth-pro":
            cached = _depth_pro_cached(mflux_cache_root)
        else:
            repo_ids = [item["repoId"], *(item.get("extraRepoIds") or [])]
            cached = all(_repo_cached(repo_id, hf_cache_root) for repo_id in repo_ids if repo_id)
        models.append(
            ModelSummary(
                id=item["id"],
                name=item["name"],
                type=item["type"],
                architecture=item["architecture"],
                size=item["size"],
                path=item["repoId"] or str(mflux_cache_root / item.get("cacheFolder", item["id"])),
                active=active_model == item["id"],
                source="builtin",
                repoId=item["repoId"],
                metadata=ModelMetadata(
                    notes=item["notes"],
                    installed=cached,
                    detectedFiles=1 if cached else 0,
                    cached=cached,
                    downloadable=True,
                    triggerWords=item.get("triggerWords", []),
                    precision=f"q{default_quantize}" if active_model == item["id"] else None,
                ),
            )
        )
    return sorted(models, key=lambda model: (not model.active, not model.metadata.cached, model.name.lower()))


def _resolve_model_state() -> ModelsResponse:
    config = store.load()
    hf_cache_root = _hf_hub_cache(config.paths.hfHome)
    mflux_cache_root = _default_mflux_cache_dir()
    custom_root = _resolve_path(config.paths.modelDir)
    lora_root = _resolve_path(config.paths.loraDir) if config.paths.loraDir else mflux_cache_root / "loras"

    builtin = _builtin_models(config.generation.defaultModel, hf_cache_root, mflux_cache_root, config.generation.defaultQuantize)
    custom = _scan_custom_models(custom_root, config.generation.defaultModel)
    loras = _scan_loras(lora_root if lora_root.exists() else mflux_cache_root / "loras")
    return ModelsResponse(
        builtin=builtin,
        custom=custom,
        loras=loras,
        total=len(builtin) + len(custom) + len(loras),
        cacheRoots=CacheRoots(
            hfHub=str(hf_cache_root),
            mflux=str(mflux_cache_root),
            loras=str(lora_root if lora_root.exists() else mflux_cache_root / "loras"),
            customModels=str(custom_root),
        ),
    )


@router.get("/models")
def list_models() -> ApiEnvelope[ModelsResponse]:
    return ApiEnvelope(ok=True, data=_resolve_model_state())


@router.post("/models/cache")
def cache_model(request: CacheRequest) -> ApiEnvelope[dict[str, str]]:
    target = next((item for item in BUILTIN_MODELS if item["id"] == request.id), None)
    if target is None:
        return ApiEnvelope(ok=False, error=ApiError(code="UNKNOWN_MODEL", message="Unknown builtin model"))

    repo_ids = [repo_id for repo_id in [target.get("repoId"), *(target.get("extraRepoIds") or [])] if repo_id]
    if not repo_ids:
        return ApiEnvelope(
            ok=False,
            error=ApiError(
                code="CACHE_UNSUPPORTED",
                message="This model family does not support cache warm-up from Hugging Face.",
            ),
        )

    download_script = (
        "from huggingface_hub import snapshot_download\n"
        f"repos = {repo_ids!r}\n"
        "for repo in repos:\n"
        "    snapshot_download(repo_id=repo)\n"
    )

    completed = subprocess.run(
        [sys.executable, "-c", download_script],
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        return ApiEnvelope(
            ok=False,
            error=ApiError(
                code="CACHE_FAILED",
                message="Cache warm-up failed.",
                details=(completed.stderr or completed.stdout or "Cache warm-up failed").strip(),
            ),
        )

    return ApiEnvelope(ok=True, data={"status": "cached", "id": request.id})
