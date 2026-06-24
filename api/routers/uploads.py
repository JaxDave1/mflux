import time
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from api.schemas.responses import ApiEnvelope, TempUploadResponse
from api.services.config_store import ConfigStore
from api.services.mflux_cli import _resolve_path, _root_dir

router = APIRouter(prefix="/api/uploads", tags=["uploads"])
store = ConfigStore()

TEMP_UPLOAD_DIR = Path("/tmp/mflux_uploads")
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}
MAX_UPLOAD_AGE_SECONDS = 24 * 60 * 60


def cleanup_old_uploads() -> None:
    TEMP_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    cutoff = time.time() - MAX_UPLOAD_AGE_SECONDS
    for path in TEMP_UPLOAD_DIR.iterdir():
        if path.is_file() and path.stat().st_mtime < cutoff:
            path.unlink(missing_ok=True)


def _safe_suffix(filename: str | None) -> str:
    suffix = Path(filename or "").suffix.lower()
    if suffix not in IMAGE_SUFFIXES:
        raise HTTPException(status_code=400, detail="Unsupported image type")
    return suffix


def _is_under(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _preview_path(value: str) -> Path:
    path = _resolve_path(value)
    if not path.exists() or not path.is_file() or path.suffix.lower() not in IMAGE_SUFFIXES:
        raise HTTPException(status_code=404, detail="Image not found")

    config = store.load()
    allowed_roots = [
        TEMP_UPLOAD_DIR.resolve(),
        _resolve_path(config.paths.outputDir),
        _root_dir().resolve(),
    ]
    resolved = path.resolve()
    if not any(_is_under(resolved, root.resolve()) for root in allowed_roots):
        raise HTTPException(status_code=403, detail="Image path is outside allowed preview roots")
    return path


@router.post("/temp")
async def upload_temp(file: UploadFile = File(...)):
    cleanup_old_uploads()
    suffix = _safe_suffix(file.filename)
    target = TEMP_UPLOAD_DIR / f"{uuid4().hex}{suffix}"
    target.write_bytes(await file.read())
    return JSONResponse(
        status_code=201,
        content=ApiEnvelope[TempUploadResponse](
            ok=True,
            data=TempUploadResponse(path=str(target)),
        ).model_dump(mode="json"),
    )


@router.get("/file")
def upload_file(path: str = Query(...)) -> FileResponse:
    return FileResponse(_preview_path(path))
