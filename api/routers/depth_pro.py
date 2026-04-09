from fastapi import APIRouter
from fastapi.responses import JSONResponse

from api.schemas.requests import DepthProRequest
from api.schemas.responses import ApiEnvelope, ApiError, SingleOutputResponse
from api.services.config_store import ConfigStore
from api.services.mflux_cli import run_depth_pro

router = APIRouter(prefix="/api/depth-pro", tags=["depth-pro"])
store = ConfigStore()


@router.post("/run")
def run_depth(payload: DepthProRequest):
    try:
        response = run_depth_pro(payload, store.load())
        return ApiEnvelope[SingleOutputResponse](ok=True, data=response)
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content=ApiEnvelope[SingleOutputResponse](
                ok=False,
                error=ApiError(code="CLI_ERROR", message="Depth Pro failed", details=str(exc)),
            ).model_dump(),
        )
