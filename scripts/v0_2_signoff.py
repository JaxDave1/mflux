#!/usr/bin/env python3
"""Phase 8 v0.2 sign-off validation against PHASE_8_V0_2.md criteria."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VENV_PYTHON = ROOT / ".venv" / "bin" / "python"
if VENV_PYTHON.exists() and Path(sys.executable).resolve() != VENV_PYTHON.resolve():
    os.execv(VENV_PYTHON, [str(VENV_PYTHON), *sys.argv])

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from api.main import app  # noqa: E402
from api.services.secrets import secrets_manager  # noqa: E402

PASS = 0
FAIL = 0
SKIP = 0
RESULTS: list[tuple[str, str, str]] = []

RESOURCES = ROOT / "tests" / "resources"
CONTROLNET_IMAGE = RESOURCES / "skyscrapers.jpg"
IMG2IMG_IMAGE = RESOURCES / "reference_z_image_turbo.png"


def record(name: str, status: str, detail: str = "") -> None:
    global PASS, FAIL, SKIP
    RESULTS.append((name, status, detail))
    if status == "PASS":
        PASS += 1
    elif status == "FAIL":
        FAIL += 1
    else:
        SKIP += 1
    suffix = f" — {detail}" if detail else ""
    print(f"[{status}] {name}{suffix}")


def wait_for_idle(client: TestClient, timeout_s: int = 300) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        response = client.get("/api/jobs?include_terminal=false")
        if response.status_code != 200:
            time.sleep(1)
            continue
        jobs = response.json().get("data", {}).get("jobs", [])
        if not any(job.get("state") in {"queued", "running"} for job in jobs):
            return True
        time.sleep(2)
    return False


def cancel_active_jobs(client: TestClient) -> None:
    response = client.get("/api/jobs?include_terminal=false")
    if response.status_code != 200:
        return
    for job in response.json().get("data", {}).get("jobs", []):
        if job.get("state") in {"queued", "running"}:
            client.delete(f"/api/jobs/{job['id']}")


def cancel_job(client: TestClient, job_id: str) -> None:
    try:
        client.delete(f"/api/jobs/{job_id}")
    except Exception as exc:  # noqa: BLE001
        record("Job cancel cleanup", "SKIP", f"{job_id}: {str(exc)[:120]}")
    wait_for_idle(client)


def submit_job(client: TestClient, module: str, params: dict) -> dict | None:
    if not wait_for_idle(client):
        return None
    response = client.post("/api/jobs", json={"module": module, "params": params})
    if response.status_code != 201 or not response.json().get("ok"):
        return None
    return response.json()["data"]


def validate_build() -> None:
    build = subprocess.run(["npm", "run", "build"], cwd=ROOT / "ui", capture_output=True, text=True)
    if build.returncode == 0:
        record("npm run build", "PASS")
    else:
        record("npm run build", "FAIL", (build.stderr or build.stdout)[-400:])

    compileall = subprocess.run([sys.executable, "-m", "compileall", "-q", "api"], cwd=ROOT, capture_output=True, text=True)
    if compileall.returncode == 0:
        record("python3 -m compileall -q api", "PASS")
    else:
        record("python3 -m compileall -q api", "FAIL", compileall.stderr[-400:])


def validate_docs() -> None:
    matrix = (ROOT / "CLI_CAPABILITY_MATRIX.md").read_text(encoding="utf-8")
    required = ["v0.2 cache management", "Quantized export", "civitai_download", "DELETE /api/models/cache"]
    missing = [snippet for snippet in required if snippet not in matrix]
    if not missing:
        record("CLI_CAPABILITY_MATRIX v0.2 section", "PASS")
    else:
        record("CLI_CAPABILITY_MATRIX v0.2 section", "FAIL", ", ".join(missing))


def validate_gallery_api(client: TestClient) -> str | None:
    gallery = client.get("/api/gallery")
    if gallery.status_code == 200 and gallery.json().get("ok"):
        record("GET /api/gallery", "PASS")
    else:
        record("GET /api/gallery", "FAIL", gallery.text[:240])
        return None

    config = client.get("/api/config").json().get("data", {})
    output_dir = Path(config.get("paths", {}).get("outputDir", "~/mflux_outputs")).expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)
    item_id = f"v02_signoff_{int(time.time())}"
    png_path = output_dir / f"{item_id}.png"
    meta_path = output_dir / f"{item_id}.metadata.json"
    png_path.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde")
    meta_path.write_text(json.dumps({"prompt": "v0.2 signoff", "model": "z-image-turbo", "seed": 1}))

    sidecar = client.get(f"/api/gallery/{item_id}/sidecar")
    if sidecar.status_code == 200 and sidecar.json().get("ok"):
        content = sidecar.json().get("data", {}).get("content")
        if isinstance(content, dict) and content.get("prompt") == "v0.2 signoff":
            record("GET /api/gallery/{id}/sidecar", "PASS")
        else:
            record("GET /api/gallery/{id}/sidecar", "FAIL", "unexpected sidecar payload")
    else:
        record("GET /api/gallery/{id}/sidecar", "FAIL", sidecar.text[:240])

    delete = client.delete(f"/api/gallery/{item_id}")
    if delete.status_code == 200 and delete.json().get("ok") and not png_path.exists() and not meta_path.exists():
        record("DELETE /api/gallery/{id}", "PASS")
    else:
        record("DELETE /api/gallery/{id}", "FAIL", delete.text[:240])
        png_path.unlink(missing_ok=True)
        meta_path.unlink(missing_ok=True)

    return item_id


def validate_lora_job_acceptance(client: TestClient) -> None:
    loras = client.get("/api/models/loras?compatible_with=z-image-turbo").json().get("data", {}).get("loras", [])
    if not loras:
        record("Img2Img LoRA stack job accepted", "SKIP", "no compatible LoRA on disk")
        record("ControlNet LoRA stack job accepted", "SKIP", "no compatible LoRA on disk")
        return
    lora_path = loras[0]["path"]

    if not IMG2IMG_IMAGE.exists():
        record("Img2Img LoRA stack job accepted", "SKIP", f"missing fixture {IMG2IMG_IMAGE}")
    else:
        job = submit_job(
            client,
            "img2img",
            {
                "prompt": "v0.2 signoff img2img lora",
                "model": "z-image-turbo",
                "imagePath": str(IMG2IMG_IMAGE),
                "width": 256,
                "height": 256,
                "steps": 1,
                "quantize": 8,
                "seed": 8801,
                "guidance": 3.5,
                "imageStrength": 0.6,
                "loraPaths": [lora_path],
                "loraScales": [0.8],
            },
        )
        if job:
            record("Img2Img LoRA stack job accepted", "PASS", job["id"])
            cancel_job(client, job["id"])
        else:
            record("Img2Img LoRA stack job accepted", "FAIL")

    if not CONTROLNET_IMAGE.exists():
        record("ControlNet LoRA stack job accepted", "SKIP", f"missing fixture {CONTROLNET_IMAGE}")
    else:
        job = submit_job(
            client,
            "controlnet",
            {
                "prompt": "v0.2 signoff controlnet lora",
                "model": "dev-controlnet-canny",
                "controlnetImagePath": str(CONTROLNET_IMAGE),
                "width": 256,
                "height": 256,
                "steps": 1,
                "quantize": 8,
                "seed": 8802,
                "guidance": 3.5,
                "controlnetStrength": 0.4,
                "loraPaths": [lora_path],
                "loraScales": [0.8],
            },
        )
        if job:
            record("ControlNet LoRA stack job accepted", "PASS", job["id"])
            cancel_job(client, job["id"])
        else:
            response = client.post(
                "/api/jobs",
                json={
                    "module": "controlnet",
                    "params": {
                        "prompt": "v0.2 signoff controlnet lora",
                        "model": "dev-controlnet-canny",
                        "controlnetImagePath": str(CONTROLNET_IMAGE),
                        "width": 256,
                        "height": 256,
                        "steps": 1,
                        "quantize": 8,
                        "seed": 8802,
                        "guidance": 3.5,
                        "controlnetStrength": 0.4,
                        "loraPaths": [lora_path],
                        "loraScales": [0.8],
                    },
                },
            )
            detail = response.text[:240]
            if response.status_code == 409:
                record("ControlNet LoRA stack job accepted", "SKIP", "concurrent job blocked")
            else:
                record("ControlNet LoRA stack job accepted", "FAIL", detail)


def validate_live_preview_modules(client: TestClient) -> None:
    if not IMG2IMG_IMAGE.exists():
        record("Img2Img live preview stepwise dir", "SKIP", f"missing fixture {IMG2IMG_IMAGE}")
        return
    job = submit_job(
        client,
        "img2img",
        {
            "prompt": "v0.2 signoff img2img live preview",
            "model": "z-image-turbo",
            "imagePath": str(IMG2IMG_IMAGE),
            "width": 256,
            "height": 256,
            "steps": 3,
            "quantize": 8,
            "seed": 8803,
            "guidance": 3.5,
            "imageStrength": 0.6,
            "livePreview": True,
        },
    )
    if not job:
        record("Img2Img live preview stepwise dir", "FAIL", "job rejected")
        return
    job_id = job["id"]
    stepwise_dir = Path(f"/tmp/mflux_stepwise/{job_id}")
    saw_stepwise = False
    deadline = time.time() + 120
    while time.time() < deadline:
        if stepwise_dir.exists() and any(stepwise_dir.glob("*.png")):
            saw_stepwise = True
            break
        time.sleep(2)
    cancel_job(client, job_id)
    if saw_stepwise:
        record("Img2Img live preview stepwise dir", "PASS", str(stepwise_dir))
    else:
        record("Img2Img live preview stepwise dir", "FAIL", "no stepwise pngs before cancel")


def validate_cache_delete(client: TestClient) -> None:
    models = client.get("/api/models").json().get("data", {})
    builtins = models.get("builtin", [])
    cached = [model for model in builtins if model.get("metadata", {}).get("cached")]
    if not cached:
        record("Cache delete updates model card", "SKIP", "no cached builtins to test delete")
        return

    target = next((model for model in cached if model.get("id") == "flux2-klein-4b"), cached[0])
    model_id = target["id"]
    delete = client.delete(f"/api/models/cache/{model_id}")
    if delete.status_code != 200 or not delete.json().get("ok"):
        record("DELETE /api/models/cache/{id}", "FAIL", delete.text[:240])
        return
    deleted_paths = delete.json().get("data", {}).get("deleted_paths", [])
    record("DELETE /api/models/cache/{id}", "PASS", f"{model_id}: {len(deleted_paths)} path(s)")

    refreshed = client.get("/api/models").json().get("data", {}).get("builtin", [])
    updated = next((model for model in refreshed if model.get("id") == model_id), None)
    if updated and not updated.get("metadata", {}).get("cached"):
        record("Cache delete updates model card", "PASS", f"{model_id} cached=false")
    else:
        record("Cache delete updates model card", "FAIL", f"{model_id} still cached")


def validate_civitai_download(client: TestClient) -> None:
    if not secrets_manager.is_set("civitai"):
        record("CivitAI download job accepted", "SKIP", "no civitai token in vault")
        return
    job = submit_job(
        client,
        "civitai_download",
        {"modelVersionId": 1, "destination": "lora"},
    )
    if job:
        record("CivitAI download job accepted", "PASS", job["id"])
        cancel_job(client, job["id"])
        return
    response = client.post(
        "/api/jobs",
        json={"module": "civitai_download", "params": {"modelVersionId": 1, "destination": "lora"}},
    )
    if response.status_code == 409:
        record("CivitAI download job accepted", "SKIP", "concurrent job blocked")
    else:
        record("CivitAI download job accepted", "FAIL", response.text[:240])


def validate_model_export(client: TestClient) -> None:
    models = client.get("/api/models").json().get("data", {}).get("builtin", [])
    exportable = [
        model
        for model in models
        if model.get("metadata", {}).get("cached") and model.get("metadata", {}).get("exportable")
    ]
    if not exportable:
        record("Model export job accepted", "SKIP", "no cached exportable builtin")
        return

    target_id = exportable[0]["id"]
    job = submit_job(client, "model_export", {"model_name": target_id, "quantize": 8})
    if not job:
        record("Model export job accepted", "FAIL", target_id)
        return
    command = " ".join(job.get("command", []))
    if "mflux.models.common.cli.save" in command:
        record("Model export job accepted", "PASS", f"{target_id} -> save CLI")
    else:
        record("Model export job accepted", "FAIL", command[:240])
    cancel_job(client, job["id"])


def validate_exportable_metadata(client: TestClient) -> None:
    models = client.get("/api/models").json().get("data", {}).get("builtin", [])
    checkpoints = [model for model in models if model.get("type") == "checkpoint"]
    if checkpoints and any("exportable" in model.get("metadata", {}) for model in checkpoints):
        record("Builtin exportable metadata present", "PASS")
    else:
        record("Builtin exportable metadata present", "FAIL")


def main() -> int:
    cancel_active_jobs(client := TestClient(app))
    wait_for_idle(client)

    validate_build()
    validate_docs()
    validate_gallery_api(client)
    validate_exportable_metadata(client)
    validate_lora_job_acceptance(client)
    validate_live_preview_modules(client)
    validate_cache_delete(client)
    validate_civitai_download(client)
    validate_model_export(client)

    print("\n=== Phase 8 v0.2 Sign-off Summary ===")
    print(f"PASS={PASS} FAIL={FAIL} SKIP={SKIP}")
    report_path = ROOT / "scripts" / "v0_2_signoff_results.json"
    report_path.write_text(json.dumps({"pass": PASS, "fail": FAIL, "skip": SKIP, "results": RESULTS}, indent=2))
    print(f"Wrote {report_path}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())