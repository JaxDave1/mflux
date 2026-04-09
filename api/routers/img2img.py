from pathlib import Path
import tempfile

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

from api.schemas.requests import Img2ImgRequest
from api.schemas.responses import ApiEnvelope, ApiError, Txt2ImgResponse
from api.services.config_store import ConfigStore
from api.services.mflux_cli import run_img2img

router = APIRouter(prefix="/api/img2img", tags=["img2img"])
store = ConfigStore()


@router.post("/generate")
async def generate_img2img(
    prompt: str = Form(...),
    negativePrompt: str = Form(default=""),
    model: str = Form(...),
    quantize: int | None = Form(default=None),
    width: int = Form(default=1024),
    height: int = Form(default=1024),
    steps: int = Form(default=25),
    guidance: float = Form(default=3.5),
    scheduler: str = Form(default="linear"),
    seed: int | None = Form(default=None),
    output: str | None = Form(default=None),
    metadata: bool = Form(default=True),
    imageStrength: float = Form(default=0.75),
    image: UploadFile = File(...),
):
    suffix = Path(image.filename or "upload.png").suffix or ".png"
    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
            handle.write(await image.read())
            temp_path = handle.name
        payload = Img2ImgRequest(
            prompt=prompt,
            negativePrompt=negativePrompt,
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
            imagePath=temp_path,
            imageStrength=imageStrength,
        )
        response = run_img2img(payload, store.load())
        return ApiEnvelope[Txt2ImgResponse](ok=True, data=response)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content=ApiEnvelope[Txt2ImgResponse](
                ok=False,
                error=ApiError(code="CLI_ERROR", message="MFLUX img2img failed", details=str(exc)),
            ).model_dump(),
        )
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
