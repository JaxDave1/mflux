import os
import platform
import subprocess
from pathlib import Path

from api.schemas.requests import AppConfig
from api.schemas.responses import LoadedModel, MemoryStat, NeuralEngineStatus, SystemStatus
from api.services.model_cache import mflux_cached_disk_usage


def _read_sysctl(key: str, fallback: str) -> str:
    try:
        return subprocess.check_output(
            ["sysctl", "-n", key],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return fallback


def _parse_vm_pages(vm_stat: str, label: str) -> int:
    for line in vm_stat.splitlines():
        if label in line:
            return int(line.split(":")[1].strip().strip("."))
    return 0


def _memory_stats() -> MemoryStat:
    total_bytes = int(_read_sysctl("hw.memsize", str(128 * 1024**3)))
    total_gb = round(total_bytes / 1024**3, 1)
    vm_stat = subprocess.check_output(["vm_stat"], text=True)
    page_size = int(_read_sysctl("hw.pagesize", "4096"))
    wired_pages = _parse_vm_pages(vm_stat, "Pages wired down")
    active_pages = _parse_vm_pages(vm_stat, "Pages active")
    compressor_pages = _parse_vm_pages(vm_stat, "Pages occupied by compressor")
    used_gb = round(((wired_pages + active_pages + compressor_pages) * page_size) / 1024**3, 1)
    if used_gb <= 0:
        free_pages = _parse_vm_pages(vm_stat, "Pages free")
        speculative_pages = _parse_vm_pages(vm_stat, "Pages speculative")
        inactive_pages = _parse_vm_pages(vm_stat, "Pages inactive")
        free_gb = ((free_pages + speculative_pages + inactive_pages) * page_size) / 1024**3
        used_gb = max(0.0, round(total_gb - free_gb, 1))
    return MemoryStat(used=min(used_gb, total_gb), total=total_gb, unit="GB")


def _resolve_path(value: str) -> Path:
    path = Path(value).expanduser()
    if path.is_absolute():
        return path
    return (Path(__file__).resolve().parents[2] / path).resolve()


def _storage_candidates(config: AppConfig) -> list[Path]:
    candidates: list[Path] = []

    output_path = _resolve_path(config.paths.outputDir)
    candidates.append(output_path if output_path.suffix == "" else output_path.parent)

    hf_home = Path(os.environ.get("HF_HOME", config.paths.hfHome)).expanduser()
    candidates.append(hf_home)

    mflux_cache = Path(os.environ.get("MFLUX_CACHE_DIR", str(_resolve_path(config.paths.modelDir)))).expanduser()
    candidates.append(mflux_cache)

    lora_path = _resolve_path(config.paths.loraDir)
    candidates.append(lora_path if lora_path.suffix == "" else lora_path.parent)

    unique: list[Path] = []
    seen: set[str] = set()
    for candidate in candidates:
        resolved = candidate.resolve(strict=False)
        key = str(resolved)
        if key not in seen:
            seen.add(key)
            unique.append(resolved)
    return unique


def _nearest_existing_path(path: Path) -> Path:
    current = path
    while not current.exists() and current != current.parent:
        current = current.parent
    return current


def _mlx_runtime_stats(memory_total_gb: float, inference_gb: float) -> MemoryStat:
    return MemoryStat(used=inference_gb, total=memory_total_gb, unit="GB")


def _model_disk_cache_stats(config: AppConfig) -> tuple[MemoryStat, int]:
    used_gb, cached_count = mflux_cached_disk_usage(config)
    return MemoryStat(used=used_gb, total=used_gb, unit="GB"), cached_count


def _loaded_model(config: AppConfig) -> LoadedModel:
    quantize = config.generation.defaultQuantize
    quantize_label = "off" if not quantize else f"q{quantize}"
    return LoadedModel(name=config.generation.defaultModel, quantize=quantize_label)


def _disk_stats(config: AppConfig) -> tuple[MemoryStat, str]:
    candidates = _storage_candidates(config)
    best_path = _nearest_existing_path(candidates[0]) if candidates else Path.home()
    best_usage = os.statvfs(str(best_path))
    best_total = best_usage.f_blocks * best_usage.f_frsize
    best_free = best_usage.f_bavail * best_usage.f_frsize

    for candidate in candidates[1:]:
        candidate = _nearest_existing_path(candidate)
        usage = os.statvfs(str(candidate))
        total = usage.f_blocks * usage.f_frsize
        free = usage.f_bavail * usage.f_frsize
        if free > best_free:
            best_path = candidate
            best_usage = usage
            best_total = total
            best_free = free

    total_gb = round(best_total / 1024**3, 1)
    free_gb = round(best_free / 1024**3, 1)
    used_gb = max(0.0, round(total_gb - free_gb, 1))
    return MemoryStat(used=used_gb, total=total_gb, unit="GB"), str(best_path)


def get_system_status(
    config: AppConfig,
    *,
    active_jobs: int = 0,
    neural_load: int = 0,
    running_model: str | None = None,
    running_quantize: str | None = None,
    inference_memory_gb: float = 0.0,
) -> SystemStatus:
    memory = _memory_stats()
    disk, disk_path = _disk_stats(config)
    model_disk_cache, cached_model_count = _model_disk_cache_stats(config)
    if running_model:
        loaded_model = LoadedModel(
            name=running_model,
            quantize=running_quantize or _loaded_model(config).quantize,
        )
    else:
        loaded_model = _loaded_model(config)

    engine_status = "MPS_ACTIVE" if active_jobs > 0 else "MPS_IDLE"
    return SystemStatus(
        platform=_read_sysctl("machdep.cpu.brand_string", platform.processor() or "Apple Silicon"),
        memory=memory,
        mlxCache=_mlx_runtime_stats(memory.total, inference_memory_gb),
        modelDiskCache=model_disk_cache,
        cachedModelCount=cached_model_count,
        diskSpace=disk,
        diskPath=disk_path,
        neuralEngine=NeuralEngineStatus(active=True, load=neural_load, status=engine_status),
        temperature=42,
        activeJobs=active_jobs,
        loadedModel=loaded_model,
    )
