import json
import os
import re
import shutil
from typing import Any
import signal
import subprocess
import sys
import tempfile
import threading
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from pydantic import BaseModel, ValidationError

from api.schemas.requests import (
    AppConfig,
    CivitaiDownloadRequest,
    ControlNetRequest,
    DepthProRequest,
    FiboEditRequest,
    Flux2EditRequest,
    Img2ImgRequest,
    InpaintRequest,
    KontextRequest,
    ModelDownloadRequest,
    ModelExportRequest,
    Txt2ImgRequest,
    UpscalerRequest,
)
from api.schemas.responses import (
    Job,
    JobBaseline,
    JobBaselinesResponse,
    JobError,
    JobOutput,
    JobProgress,
    ModuleName,
)
from api.services.config_store import ConfigStore
from api.services.lora_compat import detect_lora_architecture, lora_compatibility, model_lora_architecture, safetensors_metadata
from api.services.mflux_cli import (
    _base_env,
    _controlnet_command,
    _depth_pro_command,
    _fibo_edit_command,
    _flux2_edit_command,
    _generic_output_path,
    _img2img_command,
    _inpaint_command,
    _kontext_command,
    _output_path,
    _resolve_path,
    _thumbnail_path,
    _txt2img_command,
    _upscaler_command,
)
from api.services.secrets import secrets_manager


TERMINAL_STATES = {"succeeded", "failed", "cancelled", "timed_out"}
DEFAULT_TIMEOUT_SECONDS = int(os.environ.get("MFLUX_JOB_TIMEOUT_SECONDS", str(30 * 60)))
RETENTION_LIMIT = int(os.environ.get("MFLUX_JOB_RETENTION", "50"))
STEPWISE_ROOT = Path("/tmp/mflux_stepwise")
STEPWISE_MAX_AGE_SECONDS = 24 * 60 * 60
STEPWISE_MODULES = frozenset({"txt2img", "img2img", "inpaint", "kontext", "controlnet"})

MODEL_DOWNLOAD_REPOS: dict[str, list[str]] = {
    "dev": ["black-forest-labs/FLUX.1-dev"],
    "schnell": ["black-forest-labs/FLUX.1-schnell"],
    "dev-kontext": ["black-forest-labs/FLUX.1-Kontext-dev"],
    "dev-fill": ["black-forest-labs/FLUX.1-Fill-dev"],
    "dev-redux": ["black-forest-labs/FLUX.1-Redux-dev"],
    "dev-depth": ["black-forest-labs/FLUX.1-Depth-dev"],
    "dev-controlnet-canny": ["black-forest-labs/FLUX.1-dev", "InstantX/FLUX.1-dev-Controlnet-Canny"],
    "schnell-controlnet-canny": ["black-forest-labs/FLUX.1-schnell", "InstantX/FLUX.1-dev-Controlnet-Canny"],
    "dev-controlnet-upscaler": ["black-forest-labs/FLUX.1-dev", "jasperai/Flux.1-dev-Controlnet-Upscaler"],
    "dev-fill-catvton": ["black-forest-labs/FLUX.1-Fill-dev", "xiaozaa/catvton-flux-beta"],
    "krea-dev": ["black-forest-labs/FLUX.1-Krea-dev"],
    "flux2-klein-4b": ["black-forest-labs/FLUX.2-klein-4B"],
    "flux2-klein-9b": ["black-forest-labs/FLUX.2-klein-9B"],
    "flux2-klein-base-4b": ["black-forest-labs/FLUX.2-klein-base-4B"],
    "flux2-klein-base-9b": ["black-forest-labs/FLUX.2-klein-base-9B"],
    "qwen-image": ["Qwen/Qwen-Image"],
    "qwen-image-edit": ["Qwen/Qwen-Image-Edit-2509"],
    "fibo": ["briaai/FIBO"],
    "fibo-lite": ["briaai/Fibo-lite"],
    "fibo-edit": ["briaai/Fibo-Edit"],
    "fibo-edit-rmbg": ["briaai/Fibo-Edit-RMBG"],
    "z-image": ["Tongyi-MAI/Z-Image"],
    "z-image-turbo": ["Tongyi-MAI/Z-Image-Turbo"],
    "seedvr2-3b": ["numz/SeedVR2_comfyUI"],
    "seedvr2-7b": ["numz/SeedVR2_comfyUI"],
}

BASELINES: dict[ModuleName, JobBaseline] = {
    "txt2img": JobBaseline(median_ms=17_000, p90_ms=30_000, samples=1),
    "img2img": JobBaseline(median_ms=45_000, p90_ms=90_000, samples=1),
    "flux2_edit": JobBaseline(median_ms=45_000, p90_ms=90_000, samples=1),
    "fibo_edit": JobBaseline(median_ms=480_000, p90_ms=720_000, samples=1),
    "upscaler": JobBaseline(median_ms=120_000, p90_ms=180_000, samples=1),
    "depth_pro": JobBaseline(median_ms=20_000, p90_ms=45_000, samples=1),
    "inpaint": JobBaseline(median_ms=480_000, p90_ms=540_000, samples=1),
    "controlnet": JobBaseline(median_ms=540_000, p90_ms=600_000, samples=1),
    "kontext": JobBaseline(median_ms=510_000, p90_ms=570_000, samples=1),
    "model_download": JobBaseline(median_ms=300_000, p90_ms=900_000, samples=1),
    "civitai_download": JobBaseline(median_ms=180_000, p90_ms=600_000, samples=1),
    "model_export": JobBaseline(median_ms=600_000, p90_ms=1_800_000, samples=1),
}

# Progress line formats per MFLUX command. Verified against smoke test
# stdout captures on 2026-05-04. If MFLUX changes its output format
# upstream, this registry breaks silently — see JOBS_API_SPEC.md §5.2
# before modifying. Re-verify against real stdout before any change.
PROGRESS_PATTERNS: dict[ModuleName, re.Pattern[str] | None] = {
    "txt2img": re.compile(r"^\s*Step\s+(?P<step>\d+)\s*/\s*(?P<total>\d+)", re.IGNORECASE),
    "img2img": re.compile(r"^\s*Step\s+(?P<step>\d+)\s*/\s*(?P<total>\d+)", re.IGNORECASE),
    "flux2_edit": re.compile(r"^\s*Step\s+(?P<step>\d+)\s*/\s*(?P<total>\d+)", re.IGNORECASE),
    "fibo_edit": re.compile(r"^\s*Step\s+(?P<step>\d+)\s*/\s*(?P<total>\d+)", re.IGNORECASE),
    "inpaint": re.compile(r"^\s*Step\s+(?P<step>\d+)\s*/\s*(?P<total>\d+)", re.IGNORECASE),
    "controlnet": re.compile(r"^\s*Step\s+(?P<step>\d+)\s*/\s*(?P<total>\d+)", re.IGNORECASE),
    "kontext": re.compile(r"^\s*Step\s+(?P<step>\d+)\s*/\s*(?P<total>\d+)", re.IGNORECASE),
    "upscaler": None,
    "depth_pro": None,
    "model_download": re.compile(
        r"(?P<step>\d+(?:\.\d+)?)\s*(?P<step_unit>[MG])B\s*/\s*(?P<total>\d+(?:\.\d+)?)\s*(?P<total_unit>[MG])B",
        re.IGNORECASE,
    ),
    "civitai_download": re.compile(
        r"(?P<step>\d+(?:\.\d+)?)\s*(?P<step_unit>[MG])B\s*/\s*(?P<total>\d+(?:\.\d+)?)\s*(?P<total_unit>[MG])B",
        re.IGNORECASE,
    ),
    "model_export": None,
}


class PreparedJob(BaseModel):
    command: list[str]
    output_path: str
    params: dict
    temp_paths: list[str] = []
    prompt: str
    model: str
    seed: int | list[int] = 0


class LoraNotFoundError(ValueError):
    def __init__(self, path: str) -> None:
        super().__init__(path)
        self.path = path


class LoraIncompatibleError(ValueError):
    def __init__(self, path: str, detected: str, expected: str, model: str) -> None:
        message = f"LoRA is incompatible with model {model}: {path} (detected {detected}, expected {expected})"
        super().__init__(message)
        self.path = path
        self.detected = detected
        self.expected = expected
        self.model = model


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _job_env(config: AppConfig) -> dict[str, str]:
    env = _base_env(config)
    if (hf_token := secrets_manager.get("hf")) is not None:
        env["HF_TOKEN"] = hf_token
        env["HUGGING_FACE_HUB_TOKEN"] = hf_token
    if (civitai_token := secrets_manager.get("civitai")) is not None:
        env["MFLUX_CIVITAI_TOKEN"] = civitai_token
        env["CIVITAI_API_TOKEN"] = civitai_token
    return env


def _stderr_tail(path: str | None) -> str | None:
    if not path:
        return None
    candidate = Path(path)
    if not candidate.exists():
        return None
    data = candidate.read_bytes()[-4096:]
    return data.decode("utf-8", errors="replace").strip() or None


def _error_type(message: str) -> str:
    lowered = message.lower()
    if "gated" in lowered or "access to model" in lowered:
        return "gated_repo"
    if "not found" in lowered and "model" in lowered:
        return "model_not_found"
    if "load" in lowered and "model" in lowered:
        return "model_load_failed"
    return "subprocess_crashed"


def _validate_params(module: ModuleName, params: dict) -> BaseModel:
    model_map = {
        "txt2img": Txt2ImgRequest,
        "img2img": Img2ImgRequest,
        "flux2_edit": Flux2EditRequest,
        "fibo_edit": FiboEditRequest,
        "inpaint": InpaintRequest,
        "controlnet": ControlNetRequest,
        "kontext": KontextRequest,
        "upscaler": UpscalerRequest,
        "depth_pro": DepthProRequest,
        "model_download": ModelDownloadRequest,
        "civitai_download": CivitaiDownloadRequest,
        "model_export": ModelExportRequest,
    }
    return model_map[module](**params)


def _default_mflux_cache_dir() -> Path:
    if os.environ.get("MFLUX_CACHE_DIR"):
        return Path(os.environ["MFLUX_CACHE_DIR"]).expanduser()
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Caches" / "mflux"
    return Path.home() / ".cache" / "mflux"


def _hf_hub_cache(config_hf_home: str) -> Path:
    if os.environ.get("HUGGINGFACE_HUB_CACHE"):
        return Path(os.environ["HUGGINGFACE_HUB_CACHE"]).expanduser()
    if os.environ.get("HF_HOME"):
        return Path(os.environ["HF_HOME"]).expanduser() / "hub"
    resolved = Path(config_hf_home).expanduser()
    if resolved.name == "hub":
        return resolved
    return resolved / "hub"


def _repo_cache_dir(repo_id: str, hf_cache_root: Path) -> Path:
    return hf_cache_root / f"models--{repo_id.replace('/', '--')}"


def _repo_ids_for_download(request: ModelDownloadRequest) -> list[str]:
    if "/" in request.model_name:
        return [request.model_name]
    if request.base_model and "/" in request.base_model:
        return [request.base_model]
    return MODEL_DOWNLOAD_REPOS.get(request.model_name, [request.model_name])


def _directory_size(path: Path) -> int:
    if not path.exists():
        return 0
    total = 0
    for candidate in path.rglob("*"):
        if candidate.is_symlink():
            continue
        if candidate.is_file():
            try:
                total += candidate.stat().st_size
            except OSError:
                continue
    return total


def _progress_amount(value: str, unit: str | None) -> float:
    amount = float(value)
    if unit and unit.upper() == "G":
        return amount * 1024
    return amount


def _assert_model_export_allowed(model_id: str, config: AppConfig) -> None:
    from api.routers.models import BUILTIN_MODELS, EXPORT_UNSUPPORTED_TYPES, _builtin_models, _default_mflux_cache_dir, _hf_hub_cache

    target = next((item for item in BUILTIN_MODELS if item["id"] == model_id), None)
    if target is None:
        raise ValueError(f"Unknown builtin model: {model_id}")
    if target["type"] in EXPORT_UNSUPPORTED_TYPES or target["id"] == "depth-pro":
        raise ValueError(f"Model {model_id} does not support quantized export")
    hf_cache_root = _hf_hub_cache(config.paths.hfHome)
    mflux_cache_root = _default_mflux_cache_dir()
    summary = next(
        (model for model in _builtin_models(model_id, hf_cache_root, mflux_cache_root, config.generation.defaultQuantize) if model.id == model_id),
        None,
    )
    if summary is None or not summary.metadata.cached:
        raise ValueError(f"Model {model_id} must be cached locally before export")


def _model_export_command(request: ModelExportRequest, config: AppConfig) -> PreparedJob:
    _assert_model_export_allowed(request.model_name, config)
    output_dir = (
        _resolve_path(request.output)
        if request.output
        else _resolve_path(config.paths.modelDir) / f"{request.model_name}_q{request.quantize}"
    )
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    command = [
        sys.executable,
        "-m",
        "mflux.models.common.cli.save",
        "--model",
        request.model_name,
        "--path",
        str(output_dir),
        "--quantize",
        str(request.quantize),
    ]
    return PreparedJob(
        command=command,
        output_path=str(output_dir),
        params=request.model_dump(),
        prompt=f"Export quantized {request.model_name} (q{request.quantize})",
        model=request.model_name,
        seed=0,
    )


def _civitai_download_command(request: CivitaiDownloadRequest, config: AppConfig) -> PreparedJob:
    if request.destination == "lora":
        destination_dir = _resolve_path(config.paths.loraDir) if config.paths.loraDir else _default_mflux_cache_dir() / "loras"
    else:
        destination_dir = _resolve_path(config.paths.modelDir)
    destination_dir.mkdir(parents=True, exist_ok=True)
    command = [
        sys.executable,
        "-m",
        "api.services.civitai_download",
        "--destination-dir",
        str(destination_dir),
    ]
    if request.modelVersionId is not None:
        command += ["--model-version-id", str(request.modelVersionId)]
    if request.downloadUrl:
        command += ["--download-url", request.downloadUrl]
    label = request.downloadUrl or f"version {request.modelVersionId}"
    return PreparedJob(
        command=command,
        output_path=str(destination_dir),
        params=request.model_dump(),
        prompt=f"Download CivitAI asset {label}",
        model="civitai",
        seed=0,
    )


def _model_download_command(request: ModelDownloadRequest, config: AppConfig) -> PreparedJob:
    repo_ids = _repo_ids_for_download(request)
    hf_cache_root = _hf_hub_cache(config.paths.hfHome)
    primary_cache_path = _repo_cache_dir(repo_ids[0], hf_cache_root)
    command = [
        sys.executable,
        "-m",
        "api.services.model_download",
        "--model-name",
        request.model_name,
        "--repo-ids",
        json.dumps(repo_ids),
        "--cache-dir",
        str(hf_cache_root),
    ]
    params = request.model_dump()
    params["repo_ids"] = repo_ids
    return PreparedJob(
        command=command,
        output_path=str(primary_cache_path),
        params=params,
        prompt=f"Download model {request.model_name}",
        model=request.model_name,
        seed=0,
    )


def _prepare_command(module: ModuleName, params: dict, config: AppConfig) -> PreparedJob:
    request = _validate_params(module, params)
    if hasattr(request, "model") and hasattr(request, "loraPaths"):
        _validate_lora_paths(str(request.model), list(request.loraPaths))

    if isinstance(request, Txt2ImgRequest):
        output = _output_path(config, request)
        spec = _txt2img_command(request, output)
        prompt = request.prompt
        model = request.model
        seed = request.seed or 0
    elif isinstance(request, Img2ImgRequest):
        output = _output_path(config, request)  # type: ignore[arg-type]
        spec = _img2img_command(request, output)
        prompt = request.prompt
        model = request.model
        seed = request.seed or 0
    elif isinstance(request, Flux2EditRequest):
        output = _output_path(config, request)  # type: ignore[arg-type]
        spec = _flux2_edit_command(request, output)
        prompt = request.prompt
        model = request.model
        seed = request.seed or 0
    elif isinstance(request, FiboEditRequest):
        output = _output_path(config, request)  # type: ignore[arg-type]
        spec = _fibo_edit_command(request, output)
        prompt = request.prompt or "background removal"
        model = request.model
        seed = request.seed or 0
    elif isinstance(request, InpaintRequest):
        output = _output_path(config, request)  # type: ignore[arg-type]
        spec = _inpaint_command(request, output)
        prompt = request.prompt
        model = request.model
        seed = request.seed or 0
    elif isinstance(request, KontextRequest):
        output = _output_path(config, request)  # type: ignore[arg-type]
        spec = _kontext_command(request, output)
        prompt = request.prompt
        model = request.model
        seed = request.seed or 0
    elif isinstance(request, ControlNetRequest):
        output = _output_path(config, request)  # type: ignore[arg-type]
        spec = _controlnet_command(request, output)
        prompt = request.prompt
        model = request.model
        seed = request.seed or 0
    elif isinstance(request, UpscalerRequest):
        input_path = _resolve_path(request.imagePath)
        output = _generic_output_path(config, request.output, f"{input_path.stem}_upscaled")
        spec = _upscaler_command(request, output)
        prompt = f"Upscale {input_path.name}"
        model = request.model
        seed = request.seed or 0
    elif isinstance(request, DepthProRequest):
        input_path = _resolve_path(request.imagePath)
        output = _generic_output_path(config, request.output, f"{input_path.stem}_depth")
        spec = _depth_pro_command(request, output)
        prompt = f"Depth map for {input_path.name}"
        model = "depth-pro"
        seed = 0
    elif isinstance(request, ModelDownloadRequest):
        return _model_download_command(request, config)
    elif isinstance(request, CivitaiDownloadRequest):
        return _civitai_download_command(request, config)
    elif isinstance(request, ModelExportRequest):
        return _model_export_command(request, config)
    else:  # pragma: no cover - type exhaustiveness
        raise ValueError(f"Unsupported module: {module}")

    return PreparedJob(
        command=[sys.executable, "-m", spec.module, *spec.args],
        output_path=str(output),
        params=request.model_dump(),
        prompt=prompt,
        model=model,
        seed=seed,
    )


def _validate_lora_paths(model: str, paths: list[str]) -> None:
    expected_architecture = model_lora_architecture(model)
    for path in paths:
        resolved = _resolve_path(path)
        if not resolved.exists():
            raise LoraNotFoundError(path)
        architecture = detect_lora_architecture(resolved, safetensors_metadata(resolved))
        if lora_compatibility(architecture, model) == "incompatible":
            raise LoraIncompatibleError(path, architecture, expected_architecture, model)


def _cleanup_orphaned_stepwise_dirs() -> None:
    STEPWISE_ROOT.mkdir(parents=True, exist_ok=True)
    now = time.time()
    for path in STEPWISE_ROOT.iterdir():
        if not path.is_dir():
            continue
        try:
            if now - path.stat().st_mtime > STEPWISE_MAX_AGE_SECONDS:
                shutil.rmtree(path, ignore_errors=True)
        except OSError:
            continue


class JobManager:
    def __init__(self) -> None:
        _cleanup_orphaned_stepwise_dirs()
        self._config_store = ConfigStore()
        self._lock = threading.RLock()
        self._condition = threading.Condition(self._lock)
        self._jobs: dict[str, Job] = {}
        self._queue: deque[str] = deque()
        self._terminal_order: deque[str] = deque()
        self._processes: dict[str, subprocess.Popen[str]] = {}
        self._stderr_paths: dict[str, str] = {}
        self._expected_outputs: dict[str, str] = {}
        self._temp_paths: dict[str, list[str]] = {}
        self._stepwise_dirs: dict[str, Path] = {}
        self._download_results: dict[str, dict[str, Any]] = {}
        self._events: dict[str, list[tuple[str, dict]]] = {}
        self._pending_cancel: set[str] = set()
        self._worker = threading.Thread(target=self._worker_loop, name="mflux-job-manager", daemon=True)
        self._worker.start()

    def baselines(self) -> JobBaselinesResponse:
        return JobBaselinesResponse(baselines=BASELINES)

    def active_count(self) -> int:
        with self._lock:
            return sum(1 for job in self._jobs.values() if job.state in {"queued", "running"})

    def inference_memory_gb(self) -> float:
        with self._lock:
            total_kb = 0
            for process in self._processes.values():
                if process.poll() is not None:
                    continue
                try:
                    rss = subprocess.check_output(
                        ["ps", "-o", "rss=", "-p", str(process.pid)],
                        text=True,
                        stderr=subprocess.DEVNULL,
                    ).strip()
                    if rss:
                        total_kb += int(rss)
                except Exception:
                    continue
        return round(total_kb / 1024 / 1024, 1)

    def runtime_metrics(self) -> dict[str, Any]:
        with self._lock:
            active_jobs = [job for job in self._jobs.values() if job.state in {"queued", "running"}]
            neural_load = 0
            running_model: str | None = None
            running_quantize: str | None = None

            for job in active_jobs:
                if job.state == "queued":
                    neural_load = max(neural_load, 3)
                    continue

                progress = job.progress
                if progress.percent is not None:
                    neural_load = max(neural_load, int(progress.percent))
                elif progress.step is not None and progress.total_steps:
                    neural_load = max(
                        neural_load,
                        int(round((progress.step / progress.total_steps) * 100)),
                    )

                model = job.params.get("model") or job.params.get("model_name")
                if model:
                    running_model = str(model)
                quantize = job.params.get("quantize")
                if quantize is not None:
                    running_quantize = "off" if not quantize else f"q{quantize}"

            return {
                "active_jobs": len(active_jobs),
                "neural_load": min(100, neural_load),
                "running_model": running_model,
                "running_quantize": running_quantize,
            }

    def create_job(self, module: ModuleName, params: dict, temp_paths: list[str] | None = None) -> Job:
        with self._lock:
            active = next((job for job in self._jobs.values() if job.state in {"queued", "running"}), None)
            if active is not None:
                raise RuntimeError(f"concurrent_job_blocked:{active.id}")

        job_id = str(uuid4())
        prepared_params = dict(params)
        if module in STEPWISE_MODULES and prepared_params.get("livePreview"):
            stepwise_dir = STEPWISE_ROOT / job_id
            stepwise_dir.mkdir(parents=True, exist_ok=True)
            prepared_params["stepwiseOutputDir"] = str(stepwise_dir)
        else:
            stepwise_dir = None

        try:
            prepared = _prepare_command(module, prepared_params, self._config_store.load())
        except ValidationError as exc:
            if stepwise_dir is not None:
                shutil.rmtree(stepwise_dir, ignore_errors=True)
            raise ValueError(str(exc)) from exc
        except Exception:
            if stepwise_dir is not None:
                shutil.rmtree(stepwise_dir, ignore_errors=True)
            raise

        job = Job(
            id=job_id,
            module=module,
            state="queued",
            command=prepared.command,
            params=prepared.params,
            created_at=_now(),
            progress=JobProgress(source="baseline" if module in BASELINES else "indeterminate"),
        )
        with self._condition:
            self._jobs[job.id] = job
            self._expected_outputs[job.id] = prepared.output_path
            self._temp_paths[job.id] = temp_paths or []
            if stepwise_dir is not None:
                self._stepwise_dirs[job.id] = stepwise_dir
            self._events[job.id] = []
            self._queue.append(job.id)
            self._emit_locked(job.id, "state", {"state": "queued"})
            self._condition.notify_all()
        return job

    def list_jobs(self, include_terminal: bool = False) -> list[Job]:
        with self._lock:
            jobs = [self._current_job_locked(job.id) for job in self._jobs.values()]
            if not include_terminal:
                return [job for job in jobs if job.state not in TERMINAL_STATES]
            return sorted(jobs, key=lambda item: item.created_at, reverse=True)

    def get_job(self, job_id: str) -> Job | None:
        with self._lock:
            if job_id not in self._jobs:
                return None
            return self._current_job_locked(job_id)

    def events_since(self, job_id: str, index: int) -> tuple[list[tuple[str, dict]], int]:
        with self._lock:
            events = self._events.get(job_id, [])
            return events[index:], len(events)

    def _terminate_process(self, process: subprocess.Popen[str]) -> None:
        if process.poll() is not None:
            return
        try:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=2)
        except (ProcessLookupError, PermissionError):
            process.terminate()
            try:
                process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError):
                process.kill()
            process.wait(timeout=5)

    def _is_cancelled_locked(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        return job_id in self._pending_cancel or (job is not None and job.state == "cancelled")

    def cancel_job(self, job_id: str) -> Job:
        process: subprocess.Popen[str] | None = None
        with self._condition:
            job = self._jobs.get(job_id)
            if job is None:
                raise KeyError(job_id)
            if job.state in TERMINAL_STATES:
                raise RuntimeError(f"already_terminal:{job.state}")

            self._pending_cancel.add(job_id)
            if job.state == "queued":
                try:
                    self._queue.remove(job_id)
                except ValueError:
                    pass

            process = self._processes.get(job_id)
            message = "Job cancelled before launch" if job.state == "queued" else "Job cancelled by user"
            updated = job.model_copy(
                update={
                    "state": "cancelled",
                    "finished_at": _now(),
                    "error": JobError(type="cancelled", message=message, exit_code=None),
                }
            )
            self._jobs[job_id] = updated
            self._cleanup_partial_locked(job_id)
            self._emit_locked(job_id, "state", {"state": "cancelled"})
            self._emit_locked(job_id, "complete", {"job": updated.model_dump(mode="json")})
            self._condition.notify_all()

        if process is not None:
            self._terminate_process(process)

        with self._condition:
            self._pending_cancel.discard(job_id)
            current = self._jobs[job_id]
            if current.error and process is not None and process.returncode is not None:
                current = current.model_copy(
                    update={
                        "error": current.error.model_copy(update={"exit_code": process.returncode}),
                    }
                )
                self._jobs[job_id] = current
            return self._jobs[job_id]

    def _worker_loop(self) -> None:
        while True:
            with self._condition:
                while not self._queue:
                    self._condition.wait()
                job_id = self._queue.popleft()
            self._run_job(job_id)

    def _run_job(self, job_id: str) -> None:
        with self._condition:
            if self._is_cancelled_locked(job_id):
                self._pending_cancel.discard(job_id)
                return
            job = self._jobs.get(job_id)
            if job is None or job.state != "queued":
                return
            if self._is_cancelled_locked(job_id):
                self._pending_cancel.discard(job_id)
                return
            started = _now()
            job = job.model_copy(update={"state": "running", "started_at": started})
            self._jobs[job_id] = job
            self._emit_locked(job_id, "state", {"state": "running"})
            self._emit_progress_locked(job_id)
            self._condition.notify_all()

        with self._condition:
            if self._is_cancelled_locked(job_id):
                self._pending_cancel.discard(job_id)
                return

        stderr_handle = tempfile.NamedTemporaryFile(delete=False, prefix=f"mflux_job_{job_id}_", suffix=".stderr.log")
        stderr_handle.close()
        self._stderr_paths[job_id] = stderr_handle.name

        try:
            process = subprocess.Popen(
                job.command,
                cwd=Path(__file__).resolve().parents[2],
                env=_job_env(self._config_store.load()),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                start_new_session=True,
            )
            with self._condition:
                if self._is_cancelled_locked(job_id):
                    self._pending_cancel.discard(job_id)
                    self._terminate_process(process)
                    return
                self._processes[job_id] = process

            stdout_thread = threading.Thread(target=self._read_stdout, args=(job_id, process), daemon=True)
            stderr_thread = threading.Thread(target=self._read_stderr, args=(job_id, process, stderr_handle.name), daemon=True)
            stdout_thread.start()
            stderr_thread.start()
            stepwise_dir = self._stepwise_dirs.get(job_id)
            if stepwise_dir is not None:
                threading.Thread(target=self._watch_stepwise_dir, args=(job_id, stepwise_dir), daemon=True).start()

            timed_out = False
            try:
                return_code = process.wait(timeout=self._timeout_seconds(job.module))
            except subprocess.TimeoutExpired:
                timed_out = True
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=5)
                return_code = process.returncode

            stdout_thread.join(timeout=1)
            stderr_thread.join(timeout=1)
            self._finalize_process(job_id, return_code, timed_out)
        except Exception as exc:  # pragma: no cover - defensive runtime guard
            with self._condition:
                current = self._jobs[job_id]
                updated = current.model_copy(
                    update={
                        "state": "failed",
                        "finished_at": _now(),
                        "error": JobError(type="internal", message=str(exc), stderr_tail=_stderr_tail(self._stderr_paths.get(job_id))),
                    }
                )
                self._jobs[job_id] = updated
                self._emit_locked(job_id, "state", {"state": "failed"})
                self._emit_locked(job_id, "complete", {"job": updated.model_dump(mode="json")})
                self._condition.notify_all()
        finally:
            with self._condition:
                self._processes.pop(job_id, None)
                self._cleanup_temp_locked(job_id)
                self._trim_terminal_locked()

    def _read_stdout(self, job_id: str, process: subprocess.Popen[str]) -> None:
        if process.stdout is None:
            return
        for raw_line in process.stdout:
            line = raw_line.strip()
            if not line:
                continue
            self._handle_process_line(job_id, line)

    def _read_stderr(self, job_id: str, process: subprocess.Popen[str], path: str) -> None:
        if process.stderr is None:
            return
        with open(path, "a", encoding="utf-8") as handle:
            for raw_line in process.stderr:
                handle.write(raw_line)
                handle.flush()
                line = raw_line.strip()
                if line:
                    self._handle_process_line(job_id, line)

    def _handle_process_line(self, job_id: str, line: str) -> None:
        with self._condition:
            job = self._jobs.get(job_id)
            if job is None or job.state in TERMINAL_STATES:
                return
            progress = job.progress.model_copy(update={"last_stdout_line": line})
            pattern = PROGRESS_PATTERNS[job.module]
            if pattern is not None:
                match = pattern.search(line)
                if match:
                    step = _progress_amount(match.group("step"), match.groupdict().get("step_unit"))
                    total = _progress_amount(match.group("total"), match.groupdict().get("total_unit"))
                    percent = max(0, min(100, round((step / total) * 100))) if total > 0 else None
                    progress = progress.model_copy(
                        update={
                            "step": int(round(step)),
                            "total_steps": int(round(total)),
                            "percent": percent,
                            "source": "step_parser",
                        }
                    )
                elif job.module in {"model_download", "civitai_download"}:
                    progress = progress.model_copy(update={"source": "indeterminate"})
            if job.module == "civitai_download" and line.startswith("{"):
                try:
                    payload = json.loads(line)
                except json.JSONDecodeError:
                    payload = None
                if isinstance(payload, dict) and payload.get("output_path"):
                    self._download_results[job_id] = payload
            self._jobs[job_id] = job.model_copy(update={"progress": self._refresh_progress(job.model_copy(update={"progress": progress}))})
            self._emit_locked(job_id, "stdout", {"line": line})
            self._emit_progress_locked(job_id)
            self._condition.notify_all()

    def _watch_stepwise_dir(self, job_id: str, directory: Path) -> None:
        seen: set[str] = set()
        while True:
            with self._lock:
                job = self._jobs.get(job_id)
                if job is None:
                    return
                terminal = job.state in TERMINAL_STATES
            if directory.exists():
                for path in sorted(directory.glob("*.png"), key=lambda item: item.stat().st_mtime):
                    filename = path.name
                    if filename in seen:
                        continue
                    seen.add(filename)
                    with self._condition:
                        if job_id not in self._jobs:
                            return
                        self._emit_locked(
                            job_id,
                            "stepwise_image",
                            {"path": f"/api/jobs/{job_id}/stepwise/{filename}"},
                        )
                        self._condition.notify_all()
            if terminal:
                return
            time.sleep(0.35)

    def stepwise_image_path(self, job_id: str, filename: str) -> Path:
        if Path(filename).name != filename:
            raise ValueError("Invalid stepwise filename")
        if not filename.endswith(".png"):
            raise ValueError("Invalid stepwise filename")
        with self._lock:
            directory = self._stepwise_dirs.get(job_id)
        if directory is None:
            raise KeyError(job_id)
        candidate = (directory / filename).resolve()
        if directory.resolve() not in candidate.parents:
            raise ValueError("Invalid stepwise filename")
        if not candidate.exists():
            raise FileNotFoundError(str(candidate))
        return candidate

    def _finalize_process(self, job_id: str, return_code: int | None, timed_out: bool) -> None:
        with self._condition:
            job = self._jobs[job_id]
            if job.state == "cancelled":
                return

            output_path = Path(self._expected_outputs[job_id])
            final_output = output_path
            if job.module == "depth_pro":
                input_path = _resolve_path(str(job.params.get("imagePath", "")))
                generated_path = input_path.with_stem(f"{input_path.stem}_depth").with_suffix(".png")
                if output_path.exists():
                    final_output = output_path
                elif generated_path.exists() and generated_path.resolve() != output_path.resolve():
                    output_path.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(generated_path), str(output_path))
                    final_output = output_path
                elif generated_path.exists():
                    final_output = generated_path

            if timed_out:
                updated = job.model_copy(
                    update={
                        "state": "timed_out",
                        "finished_at": _now(),
                        "error": JobError(type="timed_out", message="Job exceeded timeout", exit_code=return_code, stderr_tail=_stderr_tail(self._stderr_paths.get(job_id))),
                    }
                )
                self._cleanup_partial_locked(job_id)
            elif return_code != 0:
                stderr_tail = _stderr_tail(self._stderr_paths.get(job_id))
                message = stderr_tail or "MFLUX subprocess failed"
                updated = job.model_copy(
                    update={
                        "state": "failed",
                        "finished_at": _now(),
                        "error": JobError(type=_error_type(message), message=message, exit_code=return_code, stderr_tail=stderr_tail),
                    }
                )
                self._cleanup_partial_locked(job_id)
            elif job.module == "model_download":
                if not final_output.exists():
                    updated = job.model_copy(
                        update={
                            "state": "failed",
                            "finished_at": _now(),
                            "error": JobError(type="output_missing", message=f"Expected model cache was not created: {final_output}", exit_code=return_code, stderr_tail=_stderr_tail(self._stderr_paths.get(job_id))),
                        }
                    )
                else:
                    finished_at = _now()
                    metadata = {
                        "model_name": job.params.get("model_name"),
                        "size_bytes": _directory_size(final_output),
                        "cached_at": finished_at.isoformat(),
                    }
                    updated = job.model_copy(
                        update={
                            "state": "succeeded",
                            "finished_at": finished_at,
                            "progress": job.progress.model_copy(update={"percent": 100, "eta_ms": 0}),
                            "output": JobOutput(output_path=str(final_output), output_url=None, metadata=metadata),
                        }
                    )
                    self._update_baseline_locked(updated)
            elif job.module == "model_export":
                has_weights = final_output.exists() and any(final_output.rglob("*.safetensors"))
                if not has_weights:
                    updated = job.model_copy(
                        update={
                            "state": "failed",
                            "finished_at": _now(),
                            "error": JobError(
                                type="output_missing",
                                message=f"Expected quantized export was not created: {final_output}",
                                exit_code=return_code,
                                stderr_tail=_stderr_tail(self._stderr_paths.get(job_id)),
                            ),
                        }
                    )
                else:
                    finished_at = _now()
                    metadata = {
                        "model_name": job.params.get("model_name"),
                        "quantize": job.params.get("quantize"),
                        "size_bytes": _directory_size(final_output),
                        "exported_at": finished_at.isoformat(),
                    }
                    updated = job.model_copy(
                        update={
                            "state": "succeeded",
                            "finished_at": finished_at,
                            "progress": job.progress.model_copy(update={"percent": 100, "eta_ms": 0}),
                            "output": JobOutput(output_path=str(final_output), output_url=None, metadata=metadata),
                        }
                    )
                    self._update_baseline_locked(updated)
            elif job.module == "civitai_download":
                result = self._download_results.pop(job_id, None)
                downloaded_path = Path(str((result or {}).get("output_path") or ""))
                if not downloaded_path.exists():
                    updated = job.model_copy(
                        update={
                            "state": "failed",
                            "finished_at": _now(),
                            "error": JobError(
                                type="output_missing",
                                message="CivitAI download finished without a saved file.",
                                exit_code=return_code,
                                stderr_tail=_stderr_tail(self._stderr_paths.get(job_id)),
                            ),
                        }
                    )
                else:
                    finished_at = _now()
                    metadata = {
                        "destination": job.params.get("destination"),
                        "model_version_id": (result or {}).get("model_version_id"),
                        "model_name": (result or {}).get("model_name"),
                        "file_name": (result or {}).get("file_name"),
                        "size_bytes": (result or {}).get("size_bytes") or downloaded_path.stat().st_size,
                        "downloaded_at": finished_at.isoformat(),
                    }
                    updated = job.model_copy(
                        update={
                            "state": "succeeded",
                            "finished_at": finished_at,
                            "progress": job.progress.model_copy(update={"percent": 100, "eta_ms": 0}),
                            "output": JobOutput(output_path=str(downloaded_path), output_url=None, metadata=metadata),
                        }
                    )
                    self._update_baseline_locked(updated)
            elif not final_output.exists():
                updated = job.model_copy(
                    update={
                        "state": "failed",
                        "finished_at": _now(),
                        "error": JobError(type="output_missing", message=f"Expected output was not created: {final_output}", exit_code=return_code, stderr_tail=_stderr_tail(self._stderr_paths.get(job_id))),
                    }
                )
            else:
                metadata = {
                    "prompt": job.params.get("prompt"),
                    "model": job.params.get("model", "depth-pro"),
                    "seed": job.params.get("seed") or 0,
                    "module": job.module,
                }
                updated = job.model_copy(
                    update={
                        "state": "succeeded",
                        "finished_at": _now(),
                        "progress": job.progress.model_copy(update={"percent": 100, "eta_ms": 0}),
                        "output": JobOutput(output_path=str(final_output), output_url=_thumbnail_path(final_output), metadata=metadata),
                    }
                )
                self._update_baseline_locked(updated)

            self._jobs[job_id] = updated
            self._emit_progress_locked(job_id)
            self._emit_locked(job_id, "state", {"state": updated.state})
            self._emit_locked(job_id, "complete", {"job": updated.model_dump(mode="json")})
            self._condition.notify_all()

    def _refresh_progress(self, job: Job) -> JobProgress:
        started_at = job.started_at or _now()
        end_at = job.finished_at if job.state in TERMINAL_STATES and job.finished_at is not None else _now()
        elapsed_ms = max(0, int((end_at - started_at).total_seconds() * 1000))
        progress = job.progress.model_copy(update={"elapsed_ms": elapsed_ms})
        if job.state in TERMINAL_STATES:
            return progress.model_copy(update={"eta_ms": 0})
        eta_ms: int | None = None
        if progress.step is not None and progress.step >= 1 and progress.total_steps:
            rate_ms_per_step = elapsed_ms / progress.step
            eta_ms = max(0, int(rate_ms_per_step * (progress.total_steps - progress.step)))
        elif job.module in BASELINES:
            remaining_ms = BASELINES[job.module].median_ms - elapsed_ms
            eta_ms = remaining_ms if remaining_ms > 0 else None
            if progress.source != "step_parser":
                progress = progress.model_copy(update={"source": "baseline"})
        else:
            progress = progress.model_copy(update={"source": "indeterminate"})
        return progress.model_copy(update={"eta_ms": eta_ms})

    def _current_job_locked(self, job_id: str) -> Job:
        job = self._jobs[job_id]
        refreshed = self._refresh_progress(job)
        if refreshed != job.progress:
            job = job.model_copy(update={"progress": refreshed})
            self._jobs[job_id] = job
        return job

    def _emit_progress_locked(self, job_id: str) -> None:
        job = self._current_job_locked(job_id)
        self._emit_locked(job_id, "progress", job.progress.model_dump(mode="json"))

    def _emit_locked(self, job_id: str, event: str, data: dict) -> None:
        self._events.setdefault(job_id, []).append((event, data))

    def _timeout_seconds(self, module: ModuleName) -> int:
        key = f"MFLUX_JOB_TIMEOUT_{module.upper()}_SECONDS"
        return int(os.environ.get(key, str(DEFAULT_TIMEOUT_SECONDS)))

    def _cleanup_partial_locked(self, job_id: str) -> None:
        output = self._expected_outputs.get(job_id)
        if not output:
            return
        candidate = Path(output)
        if candidate.is_file():
            candidate.unlink(missing_ok=True)

    def _cleanup_temp_locked(self, job_id: str) -> None:
        for path in self._temp_paths.pop(job_id, []):
            Path(path).unlink(missing_ok=True)
        stepwise_dir = self._stepwise_dirs.pop(job_id, None)
        if stepwise_dir is not None:
            shutil.rmtree(stepwise_dir, ignore_errors=True)

    def _trim_terminal_locked(self) -> None:
        for job_id, job in list(self._jobs.items()):
            if job.state in TERMINAL_STATES and job_id not in self._terminal_order:
                self._terminal_order.append(job_id)
        while len(self._terminal_order) > RETENTION_LIMIT:
            old_id = self._terminal_order.popleft()
            self._jobs.pop(old_id, None)
            self._events.pop(old_id, None)
            stderr_path = self._stderr_paths.pop(old_id, None)
            if stderr_path:
                Path(stderr_path).unlink(missing_ok=True)

    def _update_baseline_locked(self, job: Job) -> None:
        if not job.started_at or not job.finished_at:
            return
        elapsed_ms = int((job.finished_at - job.started_at).total_seconds() * 1000)
        current = BASELINES.get(job.module)
        if current is None:
            BASELINES[job.module] = JobBaseline(median_ms=elapsed_ms, p90_ms=elapsed_ms, samples=1)
            return
        samples = current.samples + 1
        median_ms = int(((current.median_ms * current.samples) + elapsed_ms) / samples)
        p90_ms = max(current.p90_ms, elapsed_ms)
        BASELINES[job.module] = JobBaseline(median_ms=median_ms, p90_ms=p90_ms, samples=samples)


job_manager = JobManager()
