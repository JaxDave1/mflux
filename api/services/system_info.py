import os
import platform
import subprocess
import sys
from pathlib import Path

from api.schemas.requests import AppConfig
from api.schemas.responses import LoadedModel, MemoryStat, NeuralEngineStatus, SystemStatus


def _read_sysctl(key: str, fallback: str) -> str:
    try:
        return subprocess.check_output(
            ["sysctl", "-n", key],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except Exception:
        return fallback


def _memory_stats() -> MemoryStat:
    total_bytes = int(_read_sysctl("hw.memsize", str(128 * 1024**3)))
    total_gb = round(total_bytes / 1024**3, 1)
    vm_stat = subprocess.check_output(["vm_stat"], text=True)
    page_size = 4096
    free_pages = 0
    speculative_pages = 0
    inactive_pages = 0
    for line in vm_stat.splitlines():
        if "Pages free" in line:
            free_pages = int(line.split(":")[1].strip().strip("."))
        if "Pages speculative" in line:
            speculative_pages = int(line.split(":")[1].strip().strip("."))
        if "Pages inactive" in line:
            inactive_pages = int(line.split(":")[1].strip().strip("."))
    free_gb = ((free_pages + speculative_pages + inactive_pages) * page_size) / 1024**3
    used_gb = max(0.0, round(total_gb - free_gb, 1))
    return MemoryStat(used=used_gb, total=total_gb, unit="GB")


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


def _mlx_cache_stats(config: AppConfig) -> MemoryStat:
    hf_root = _hf_hub_cache(config.paths.hfHome)
    mflux_root = _default_mflux_cache_dir()
    used_bytes = _directory_size(hf_root) + _directory_size(mflux_root)
    used_gb = round(used_bytes / 1024**3, 1)
    total_gb = float(config.system.cacheLimit)
    return MemoryStat(used=used_gb, total=total_gb, unit="GB")


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


def get_system_status(config: AppConfig, *, active_jobs: int = 0) -> SystemStatus:
    memory = _memory_stats()
    disk, disk_path = _disk_stats(config)
    neural_load = min(95, active_jobs * 35) if active_jobs > 0 else 0
    return SystemStatus(
        platform=_read_sysctl("machdep.cpu.brand_string", platform.processor() or "Apple Silicon"),
        memory=memory,
        mlxCache=_mlx_cache_stats(config),
        diskSpace=disk,
        diskPath=disk_path,
        neuralEngine=NeuralEngineStatus(active=True, load=neural_load, status="MPS_ACTIVE"),
        temperature=42,
        activeJobs=active_jobs,
        loadedModel=_loaded_model(config),
    )
