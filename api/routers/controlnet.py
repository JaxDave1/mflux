from pathlib import Path
import tempfile

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

from api.schemas.requests import ControlNetRequest
from api.schemas.responses import ApiEnvelope, ApiError, Txt2ImgResponse
from api.services.config_store import ConfigStore
from api.services.mflux_cli import run_controlnet

router = APIRouter(prefix="/api/controlnet", tags=["controlnet"])
store = ConfigStore()


@router.post("/generate")
async def generate_controlnet(
    prompt: str = Form(...),
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
    controlnetStrength: float = Form(default=0.4),
    controlnetSaveCanny: bool = Form(default=False),
    image: UploadFile = File(...),
):
    temp_path: str | None = None
    try:
        suffix = Path(image.filename or "control.png").suffix or ".png"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
            handle.write(await image.read())
            temp_path = handle.name
        payload = ControlNetRequest(
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
            controlnetImagePath=temp_path,
            controlnetStrength=controlnetStrength,
            controlnetSaveCanny=controlnetSaveCanny,
        )
        response = run_controlnet(payload, store.load())
        return ApiEnvelope[Txt2ImgResponse](ok=True, data=response)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content=ApiEnvelope[Txt2ImgResponse](
                ok=False,
                error=ApiError(code="CLI_ERROR", message="MFLUX controlnet failed", details=str(exc)),
            ).model_dump(),
        )
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
