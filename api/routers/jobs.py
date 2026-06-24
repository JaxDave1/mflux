import asyncio
import json
import tempfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import ValidationError
from starlette.datastructures import UploadFile

from api.schemas.requests import JobCreateRequest
from api.schemas.responses import ApiEnvelope, ApiError, Job, JobBaselinesResponse, JobsListResponse, ModuleName
from api.services.job_manager import LoraIncompatibleError, LoraNotFoundError, job_manager

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


def _envelope_error(status_code: int, code: str, message: str, details: str | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=ApiEnvelope[Job](ok=False, error=ApiError(code=code, message=message, details=details)).model_dump(mode="json"),
    )


async def _save_upload(upload: UploadFile, fallback_name: str) -> str:
    suffix = Path(upload.filename or fallback_name).suffix or ".png"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
        handle.write(await upload.read())
        return handle.name


async def _parse_job_request(request: Request) -> tuple[ModuleName, dict[str, Any], list[str]]:
    content_type = request.headers.get("content-type", "")
    temp_paths: list[str] = []

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        module = str(form.get("module", ""))
        raw_params = str(form.get("params", "{}"))
        params = json.loads(raw_params)

        def upload_field(name: str) -> UploadFile | None:
            value = form.get(name)
            return value if isinstance(value, UploadFile) else None

        if module == "img2img":
            image = upload_field("image")
            if image is None:
                raise ValueError("Missing required file: image")
            image_path = await _save_upload(image, "source.png")
            temp_paths.append(image_path)
            params["imagePath"] = image_path
        elif module == "kontext":
            image = upload_field("image")
            if image is None:
                raise ValueError("Missing required file: image")
            image_path = await _save_upload(image, "reference.png")
            temp_paths.append(image_path)
            params["imagePath"] = image_path
        elif module == "controlnet":
            image = upload_field("image")
            if image is None:
                raise ValueError("Missing required file: image")
            image_path = await _save_upload(image, "control.png")
            temp_paths.append(image_path)
            params["controlnetImagePath"] = image_path
        elif module == "inpaint":
            image = upload_field("image")
            mask = upload_field("mask")
            if image is None or mask is None:
                raise ValueError("Missing required files: image and mask")
            image_path = await _save_upload(image, "source.png")
            mask_path = await _save_upload(mask, "mask.png")
            temp_paths.extend([image_path, mask_path])
            params["imagePath"] = image_path
            params["maskedImagePath"] = mask_path
        return module, params, temp_paths  # type: ignore[return-value]

    payload = JobCreateRequest(**(await request.json()))
    return payload.module, payload.params, temp_paths


@router.post("")
async def create_job(request: Request):
    try:
        module, params, temp_paths = await _parse_job_request(request)
        job = job_manager.create_job(module, params, temp_paths=temp_paths)
        return JSONResponse(status_code=201, content=ApiEnvelope[Job](ok=True, data=job).model_dump(mode="json"))
    except json.JSONDecodeError as exc:
        return _envelope_error(400, "invalid_params", "Invalid params JSON", str(exc))
    except ValidationError as exc:
        return _envelope_error(400, "invalid_params", "Invalid job request", str(exc))
    except LoraNotFoundError as exc:
        return _envelope_error(400, "lora_not_found", "LoRA path no longer exists at submit time.", exc.path)
    except LoraIncompatibleError as exc:
        return _envelope_error(400, "lora_incompatible", str(exc), exc.path)
    except ValueError as exc:
        return _envelope_error(400, "invalid_params", "Invalid job parameters", str(exc))
    except RuntimeError as exc:
        message = str(exc)
        if message.startswith("concurrent_job_blocked:"):
            active_job_id = message.split(":", 1)[1]
            return _envelope_error(
                409,
                "concurrent_job_blocked",
                "Another job is currently running. Cancel it or wait.",
                active_job_id,
            )
        return _envelope_error(500, "internal", "Job creation failed", message)


@router.get("")
def list_jobs(include_terminal: bool = False) -> ApiEnvelope[JobsListResponse]:
    return ApiEnvelope(ok=True, data=JobsListResponse(jobs=job_manager.list_jobs(include_terminal=include_terminal)))


@router.get("/baselines")
def baselines() -> ApiEnvelope[JobBaselinesResponse]:
    return ApiEnvelope(ok=True, data=job_manager.baselines())


@router.get("/{job_id}")
def get_job(job_id: str):
    job = job_manager.get_job(job_id)
    if job is None:
        return _envelope_error(404, "not_found", "Job not found", job_id)
    return ApiEnvelope[Job](ok=True, data=job)


@router.get("/{job_id}/stream")
async def stream_job(job_id: str):
    if job_manager.get_job(job_id) is None:
        return _envelope_error(404, "not_found", "Job not found", job_id)

    async def events():
        index = 0
        while True:
            job = job_manager.get_job(job_id)
            if job is None:
                break
            pending, index = job_manager.events_since(job_id, index)
            for event, data in pending:
                yield f"event: {event}\n"
                yield f"data: {json.dumps(data)}\n\n"
            if job.state in {"succeeded", "failed", "cancelled", "timed_out"}:
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(events(), media_type="text/event-stream")


@router.get("/{job_id}/stepwise/{filename}")
def get_stepwise_image(job_id: str, filename: str):
    try:
        return FileResponse(job_manager.stepwise_image_path(job_id, filename), media_type="image/png")
    except KeyError:
        return _envelope_error(404, "not_found", "Job stepwise preview not found", job_id)
    except (ValueError, FileNotFoundError) as exc:
        return _envelope_error(404, "not_found", "Stepwise image not found", str(exc))


@router.delete("/{job_id}")
def cancel_job(job_id: str):
    try:
        job = job_manager.cancel_job(job_id)
        return ApiEnvelope[Job](ok=True, data=job)
    except KeyError:
        return _envelope_error(404, "not_found", "Job not found", job_id)
    except RuntimeError as exc:
        message = str(exc)
        if message.startswith("already_terminal:"):
            state = message.split(":", 1)[1]
            return _envelope_error(409, "already_terminal", f"Job is already in state '{state}' and cannot be cancelled.", state)
        return _envelope_error(500, "internal", "Job cancellation failed", message)
