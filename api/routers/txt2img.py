from fastapi import APIRouter
from fastapi.responses import JSONResponse

from api.schemas.requests import Txt2ImgRequest
from api.schemas.responses import ApiEnvelope, ApiError, Txt2ImgResponse
from api.services.config_store import ConfigStore
from api.services.mflux_cli import run_txt2img

router = APIRouter(prefix="/api/txt2img", tags=["txt2img"])
store = ConfigStore()


@router.post("/generate")
def generate_txt2img(payload: Txt2ImgRequest):
    try:
        response = run_txt2img(payload, store.load())
        return ApiEnvelope[Txt2ImgResponse](ok=True, data=response)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content=ApiEnvelope[Txt2ImgResponse](
                ok=False,
                error=ApiError(code="CLI_ERROR", message="MFLUX txt2img generation failed", details=str(exc)),
            ).model_dump(),
        )
