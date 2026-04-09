from pathlib import Path
import tempfile

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse

from api.schemas.requests import KontextRequest
from api.schemas.responses import ApiEnvelope, ApiError, Txt2ImgResponse
from api.services.config_store import ConfigStore
from api.services.mflux_cli import run_kontext

router = APIRouter(prefix="/api/kontext", tags=["kontext"])
store = ConfigStore()


@router.post("/generate")
async def generate_kontext(
    prompt: str = Form(...),
    model: str = Form(...),
    quantize: int | None = Form(default=None),
    width: int = Form(default=1024),
    height: int = Form(default=1024),
    steps: int = Form(default=25),
    guidance: float = Form(default=2.5),
    scheduler: str = Form(default="linear"),
    seed: int | None = Form(default=None),
    output: str | None = Form(default=None),
    metadata: bool = Form(default=True),
    image: UploadFile = File(...),
):
    temp_path: str | None = None
    try:
      suffix = Path(image.filename or "reference.png").suffix or ".png"
      with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
          handle.write(await image.read())
          temp_path = handle.name
      payload = KontextRequest(
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
          imagePath=temp_path,
      )
      response = run_kontext(payload, store.load())
      return ApiEnvelope[Txt2ImgResponse](ok=True, data=response)
    except Exception as exc:
      return JSONResponse(
          status_code=500,
          content=ApiEnvelope[Txt2ImgResponse](
              ok=False,
              error=ApiError(code="CLI_ERROR", message="MFLUX kontext failed", details=str(exc)),
          ).model_dump(),
      )
    finally:
      if temp_path:
          Path(temp_path).unlink(missing_ok=True)
