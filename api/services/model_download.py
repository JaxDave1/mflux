import argparse
import json
import os
from pathlib import Path

from huggingface_hub import snapshot_download


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


def main() -> None:
    parser = argparse.ArgumentParser(description="Download Hugging Face model snapshots for MFLUX.")
    parser.add_argument("--model-name", required=True)
    parser.add_argument("--repo-ids", required=True, help="JSON encoded list of HF repo ids.")
    parser.add_argument("--cache-dir", required=True)
    args = parser.parse_args()

    repo_ids = json.loads(args.repo_ids)
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    downloaded: list[str] = []

    for repo_id in repo_ids:
        path = snapshot_download(repo_id=repo_id, cache_dir=args.cache_dir, token=token)
        downloaded.append(path)

    cache_paths = [Path(path) for path in downloaded]
    size_bytes = sum(_directory_size(path) for path in cache_paths)
    print(json.dumps({"model_name": args.model_name, "paths": downloaded, "size_bytes": size_bytes}))


if __name__ == "__main__":
    main()
