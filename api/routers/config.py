from fastapi import APIRouter

from api.schemas.requests import AppConfig
from api.schemas.responses import ApiEnvelope
from api.services.config_store import ConfigStore

router = APIRouter(prefix="/api", tags=["config"])
store = ConfigStore()


@router.get("/config")
def get_config() -> ApiEnvelope[AppConfig]:
    return ApiEnvelope(ok=True, data=store.load())


@router.put("/config")
def update_config(config: AppConfig) -> ApiEnvelope[AppConfig]:
    return ApiEnvelope(ok=True, data=store.save(config))
