from fastapi import APIRouter
from fastapi.responses import JSONResponse

from api.schemas.requests import UpscalerRequest
from api.schemas.responses import ApiEnvelope, ApiError, SingleOutputResponse
from api.services.config_store import ConfigStore
from api.services.mflux_cli import run_upscaler

router = APIRouter(prefix="/api/upscaler", tags=["upscaler"])
store = ConfigStore()


@router.post("/generate")
def generate_upscaler(payload: UpscalerRequest):
    try:
        response = run_upscaler(payload, store.load())
        return ApiEnvelope[SingleOutputResponse](ok=True, data=response)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content=ApiEnvelope[SingleOutputResponse](
                ok=False,
                error=ApiError(code="CLI_ERROR", message="MFLUX upscaler failed", details=str(exc)),
            ).model_dump(),
        )
