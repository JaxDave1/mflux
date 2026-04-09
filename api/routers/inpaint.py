from pathlib import Path
import tempfile

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

from api.schemas.requests import InpaintRequest
from api.schemas.responses import ApiEnvelope, ApiError, Txt2ImgResponse
from api.services.config_store import ConfigStore
from api.services.mflux_cli import run_inpaint

router = APIRouter(prefix="/api/inpaint", tags=["inpaint"])
store = ConfigStore()


@router.post("/generate")
async def generate_inpaint(
    prompt: str = Form(...),
    model: str = Form(...),
    quantize: int | None = Form(default=None),
    width: int = Form(default=1024),
    height: int = Form(default=1024),
    steps: int = Form(default=25),
    guidance: float = Form(default=30.0),
    scheduler: str = Form(default="linear"),
    seed: int | None = Form(default=None),
    output: str | None = Form(default=None),
    metadata: bool = Form(default=True),
    image: UploadFile = File(...),
    mask: UploadFile = File(...),
):
    image_temp: str | None = None
    mask_temp: str | None = None
    try:
        image_suffix = Path(image.filename or "source.png").suffix or ".png"
        mask_suffix = Path(mask.filename or "mask.png").suffix or ".png"
        with tempfile.NamedTemporaryFile(delete=False, suffix=image_suffix) as handle:
            handle.write(await image.read())
            image_temp = handle.name
        with tempfile.NamedTemporaryFile(delete=False, suffix=mask_suffix) as handle:
            handle.write(await mask.read())
            mask_temp = handle.name
        payload = InpaintRequest(
            prompt=prompt,
            model=model,
            quantize=quantize,
            width=width,
            height=height,
            steps=steps,
            guidance=guidance,
            scheduler=scheduler,
            seed=seed,
            output=output,
            metadata=metadata,
            imagePath=image_temp,
            maskedImagePath=mask_temp,
        )
        response = run_inpaint(payload, store.load())
        return ApiEnvelope[Txt2ImgResponse](ok=True, data=response)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content=ApiEnvelope[Txt2ImgResponse](
                ok=False,
                error=ApiError(code="CLI_ERROR", message="MFLUX inpaint failed", details=str(exc)),
            ).model_dump(),
        )
    finally:
        if image_temp:
            Path(image_temp).unlink(missing_ok=True)
        if mask_temp:
            Path(mask_temp).unlink(missing_ok=True)
