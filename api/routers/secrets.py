from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from api.schemas.responses import ApiEnvelope, ApiError, SecretStatus, SecretsResponse
from api.services.secrets import SUPPORTED_SECRET_KEYS, secrets_manager

router = APIRouter(prefix="/api/secrets", tags=["secrets"])


class SecretValueRequest(BaseModel):
    value: str


def _error(status_code: int, code: str, message: str, details: str | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=ApiEnvelope[dict](ok=False, error=ApiError(code=code, message=message, details=details)).model_dump(
            mode="json"
        ),
    )


def _validate_key(key: str) -> bool:
    return key in SUPPORTED_SECRET_KEYS


@router.get("")
def list_secrets() -> ApiEnvelope[SecretsResponse]:
    tokens = [SecretStatus(key=key, is_set=secrets_manager.is_set(key)) for key in SUPPORTED_SECRET_KEYS]
    return ApiEnvelope(ok=True, data=SecretsResponse(tokens=tokens))


@router.put("/{key}")
def set_secret(key: str, request: SecretValueRequest):
    if not _validate_key(key):
        return _error(400, "unsupported_secret", "Unsupported secret key", key)
    if not request.value.strip():
        return _error(400, "invalid_secret", "Secret value cannot be empty")
    secrets_manager.set(key, request.value)
    return ApiEnvelope[dict](ok=True, data={})


@router.delete("/{key}")
def clear_secret(key: str):
    if not _validate_key(key):
        return _error(400, "unsupported_secret", "Unsupported secret key", key)
    secrets_manager.clear(key)
    return ApiEnvelope[dict](ok=True, data={})
