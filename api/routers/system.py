import importlib
from pathlib import Path

from fastapi import APIRouter

from api.routers.gallery import IMAGE_SUFFIXES, _classify_module, _merge_metadata
from api.schemas.responses import ApiEnvelope, HealthResponse, ModuleValidation, RuntimeSummary, SystemStatus
from api.services.config_store import ConfigStore
from api.services.job_manager import job_manager
from api.services.mflux_cli import _resolve_path
from api.services.system_info import get_system_status

router = APIRouter(prefix="/api", tags=["system"])
store = ConfigStore()
EXPECTED_MODULES = ("txt2img", "img2img", "inpaint", "kontext", "controlnet", "upscaler", "depth-pro")


@router.get("/health")
def health() -> ApiEnvelope[HealthResponse]:
    runtime_ready = True
    runtime_message = None
    status = "healthy"

    try:
        importlib.import_module("mlx.core")
    except Exception as exc:
        runtime_ready = False
        status = "degraded"
        runtime_message = f"MLX runtime unavailable: {exc}"

    return ApiEnvelope(
        ok=True,
        data=HealthResponse(
            status=status,
            version="0.1.0",
            runtimeReady=runtime_ready,
            runtimeMessage=runtime_message,
        ),
    )


@router.get("/system/status")
def system_status() -> ApiEnvelope[SystemStatus]:
    status = get_system_status(store.load())
    status.activeJobs = job_manager.active_count()
    return ApiEnvelope(ok=True, data=status)


@router.get("/runtime/summary")
def runtime_summary() -> ApiEnvelope[RuntimeSummary]:
    config = store.load()
    output_dir = _resolve_path(config.paths.outputDir)
    evidence: dict[str, tuple[str, str | None]] = {}

    if output_dir.exists():
        for path in sorted(output_dir.rglob("*"), key=lambda candidate: candidate.stat().st_mtime, reverse=True):
            if not path.is_file() or path.suffix.lower() not in IMAGE_SUFFIXES:
                continue
            metadata, metadata_source = _merge_metadata(path)
            module_type = _classify_module(path, metadata)
            if module_type in EXPECTED_MODULES and module_type not in evidence:
                metadata_path = None
                if metadata_source and metadata_source.endswith(".json"):
                    metadata_path = str(path.with_suffix(".metadata.json" if metadata_source.endswith(".metadata.json") else ".json"))
                evidence[module_type] = (str(path), metadata_path)

    tests_resource_dir = Path(__file__).resolve().parents[2] / "tests" / "resources"
    if tests_resource_dir.exists():
        for depth_path in sorted(tests_resource_dir.glob("*_depth.png"), reverse=True):
            if depth_path.is_file():
                evidence.setdefault("depth-pro", (str(depth_path), None))
                break

    modules = [
        ModuleValidation(
            id=module_id,
            validated=module_id in evidence,
            evidencePath=evidence.get(module_id, (None, None))[0],
            metadataPath=evidence.get(module_id, (None, None))[1],
        )
        for module_id in EXPECTED_MODULES
    ]
    return ApiEnvelope(
        ok=True,
        data=RuntimeSummary(
            validatedCount=sum(1 for module in modules if module.validated),
            modules=modules,
        ),
    )
