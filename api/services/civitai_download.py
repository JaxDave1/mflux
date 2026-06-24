import argparse
import json
import os
import re
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

CIVITAI_API = "https://civitai.com/api/v1"
USER_AGENT = "MFLUX-NeuralInterface/0.2"


def _token() -> str | None:
    for key in ("MFLUX_CIVITAI_TOKEN", "CIVITAI_API_TOKEN"):
        value = os.environ.get(key, "").strip()
        if value:
            return value
    return None


def _parse_version_id(model_version_id: int | None, download_url: str | None) -> int:
    if model_version_id is not None:
        return model_version_id
    if not download_url:
        raise ValueError("model_version_id or download_url is required")

    parsed = urlparse(download_url.strip())
    api_match = re.search(r"/api/download/models/(\d+)", parsed.path)
    if api_match:
        return int(api_match.group(1))

    query = parse_qs(parsed.query)
    if "modelVersionId" in query and query["modelVersionId"]:
        return int(query["modelVersionId"][0])

    page_match = re.search(r"/model-versions/(\d+)", parsed.path)
    if page_match:
        return int(page_match.group(1))

    raise ValueError("Could not parse CivitAI model version id from input")


def _fetch_version(version_id: int, token: str | None) -> dict:
    headers = {"User-Agent": USER_AGENT}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = Request(f"{CIVITAI_API}/model-versions/{version_id}", headers=headers)
    with urlopen(request, timeout=120) as response:
        return json.loads(response.read().decode("utf-8"))


def _pick_file(files: list[dict]) -> dict:
    if not files:
        raise ValueError("CivitAI model version has no downloadable files")
    for candidate in files:
        name = str(candidate.get("name", ""))
        if name.endswith(".safetensors"):
            return candidate
    return files[0]


def _sanitize_filename(name: str) -> str:
    cleaned = re.sub(r"[^\w.\-]+", "_", name.strip())
    return cleaned or "civitai_download.safetensors"


def _download_with_progress(url: str, dest: Path, token: str | None) -> int:
    if token:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}token={token}"

    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=3600) as response:
        total = int(response.headers.get("Content-Length", "0") or 0)
        downloaded = 0
        chunk_size = 1024 * 1024
        dest.parent.mkdir(parents=True, exist_ok=True)
        with dest.open("wb") as handle:
            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                handle.write(chunk)
                downloaded += len(chunk)
                if total > 0:
                    downloaded_mb = downloaded / (1024 * 1024)
                    total_mb = total / (1024 * 1024)
                    print(f"{downloaded_mb:.1f}MB / {total_mb:.1f}MB", flush=True)
        return downloaded


def main() -> None:
    parser = argparse.ArgumentParser(description="Download a CivitAI model version into the MFLUX library.")
    parser.add_argument("--destination-dir", required=True)
    parser.add_argument("--model-version-id", type=int, default=None)
    parser.add_argument("--download-url", default=None)
    args = parser.parse_args()

    token = _token()
    version_id = _parse_version_id(args.model_version_id, args.download_url)
    version = _fetch_version(version_id, token)
    file_info = _pick_file(list(version.get("files") or []))
    download_url = str(file_info.get("downloadUrl") or "")
    if not download_url:
        raise ValueError("CivitAI model version is missing a download URL")

    destination_dir = Path(args.destination_dir).expanduser()
    filename = _sanitize_filename(str(file_info.get("name") or f"civitai-v{version_id}.safetensors"))
    output_path = destination_dir / filename
    size_bytes = _download_with_progress(download_url, output_path, token)

    print(
        json.dumps(
            {
                "output_path": str(output_path),
                "size_bytes": size_bytes,
                "model_version_id": version_id,
                "model_name": version.get("model", {}).get("name") if isinstance(version.get("model"), dict) else None,
                "file_name": filename,
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    try:
        main()
    except (HTTPError, URLError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1) from exc