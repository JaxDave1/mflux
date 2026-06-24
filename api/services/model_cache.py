import os
import sys
import time
from pathlib import Path

from api.routers.models import (
    BUILTIN_MODELS,
    _default_mflux_cache_dir,
    _depth_pro_cached,
    _hf_hub_cache,
    _repo_cache_dir,
    _repo_cached,
)
from api.schemas.requests import AppConfig

_DIR_SIZE_CACHE: dict[str, tuple[float, int]] = {}
_DIR_SIZE_TTL_S = 30.0


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


def _directory_size_cached(path: Path) -> int:
    key = str(path.resolve(strict=False))
    now = time.monotonic()
    cached = _DIR_SIZE_CACHE.get(key)
    if cached and now - cached[0] < _DIR_SIZE_TTL_S:
        return cached[1]
    size = _directory_size(path)
    _DIR_SIZE_CACHE[key] = (now, size)
    return size


def mflux_cached_disk_usage(config: AppConfig) -> tuple[float, int]:
    hf_cache_root = _hf_hub_cache(config.paths.hfHome)
    mflux_cache_root = _default_mflux_cache_dir()
    seen_dirs: set[str] = set()
    total_bytes = 0
    cached_models = 0

    for item in BUILTIN_MODELS:
        if item["id"] == "depth-pro":
            if not _depth_pro_cached(mflux_cache_root):
                continue
            cache_dir = mflux_cache_root / "depth_pro"
            key = str(cache_dir)
            if key not in seen_dirs:
                seen_dirs.add(key)
                total_bytes += _directory_size_cached(cache_dir)
            cached_models += 1
            continue

        repo_ids = [repo_id for repo_id in [item.get("repoId"), *(item.get("extraRepoIds") or [])] if repo_id]
        if not repo_ids or not all(_repo_cached(repo_id, hf_cache_root) for repo_id in repo_ids):
            continue

        cached_models += 1
        for repo_id in repo_ids:
            repo_dir = _repo_cache_dir(repo_id, hf_cache_root)
            key = str(repo_dir)
            if key in seen_dirs:
                continue
            seen_dirs.add(key)
            total_bytes += _directory_size_cached(repo_dir)

    used_gb = round(total_bytes / 1024**3, 1)
    return used_gb, cached_models