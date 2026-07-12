#!/usr/bin/env python3
"""Smoke tests for MFLUX Neural Interface API and phase feature contracts."""

from __future__ import annotations

import io
import json
import os
import stat
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from api.main import app  # noqa: E402
from api.services.secrets import secrets_manager  # noqa: E402

PASS = 0
FAIL = 0
SKIP = 0
RESULTS: list[tuple[str, str, str]] = []


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


def expect_ok(response, name: str) -> dict | None:
    if response.status_code >= 400:
        record(name, "FAIL", f"HTTP {response.status_code}: {response.text[:240]}")
        return None
    payload = response.json()
    if not payload.get("ok"):
        record(name, "FAIL", json.dumps(payload.get("error", payload))[:240])
        return None
    record(name, "PASS")
    return payload.get("data")


def main() -> int:
    client = TestClient(app)

    # Cancel any active jobs so submissions are not blocked.
    jobs_payload = expect_ok(client.get("/api/jobs?include_terminal=false"), "GET /api/jobs")
    if jobs_payload:
        for job in jobs_payload.get("jobs", []):
            if job.get("state") in {"queued", "running"}:
                client.delete(f"/api/jobs/{job['id']}")

    expect_ok(client.get("/api/health"), "GET /api/health")
    expect_ok(client.get("/api/system/status"), "GET /api/system/status")
    expect_ok(client.get("/api/config"), "GET /api/config")
    expect_ok(client.get("/api/models"), "GET /api/models")
    expect_ok(client.get("/api/gallery"), "GET /api/gallery")
    expect_ok(client.get("/api/secrets"), "GET /api/secrets")

    secrets_payload = client.get("/api/secrets").json()
    if secrets_payload.get("ok"):
        body = json.dumps(secrets_payload)
        if "hf_" in body.lower() or "token" in body.lower() and "is_set" not in body:
            record("Secrets never return values", "FAIL", "Response may include token material")
        else:
            record("Secrets never return values", "PASS")

    dir_mode = stat.S_IMODE(secrets_manager.directory.stat().st_mode)
    if dir_mode == 0o700:
        record("Secrets directory mode 0700", "PASS")
    else:
        record("Secrets directory mode 0700", "FAIL", oct(dir_mode))

    original_hf = secrets_manager.get("hf")
    try:
        expect_ok(
            client.put("/api/secrets/hf", json={"value": "hf_smoke_test_token"}),
            "PUT /api/secrets/hf",
        )
        if secrets_manager.path.exists():
            file_mode = stat.S_IMODE(secrets_manager.path.stat().st_mode)
            if file_mode == 0o600:
                record("secrets.env mode 0600", "PASS")
            else:
                record("secrets.env mode 0600", "FAIL", oct(file_mode))
        else:
            record("secrets.env mode 0600", "FAIL", "file missing after write")

        unsupported = client.put("/api/secrets/unknown", json={"value": "x"})
        if unsupported.status_code == 400:
            record("PUT /api/secrets rejects unknown key", "PASS")
        else:
            record("PUT /api/secrets rejects unknown key", "FAIL", f"HTTP {unsupported.status_code}")

        expect_ok(client.delete("/api/secrets/hf"), "DELETE /api/secrets/hf")
    finally:
        if original_hf:
            secrets_manager.set("hf", original_hf)
        else:
            secrets_manager.clear("hf")

    defaults = expect_ok(client.get("/api/modules/txt2img/defaults"), "GET /api/modules/txt2img/defaults")
    if defaults:
        model = defaults.get("model")
        if model in {"z-image-turbo", "z_image_turbo"}:
            record("Txt2Img defaults model", "PASS", model)
        else:
            record("Txt2Img defaults model", "FAIL", f"unexpected model: {model}")

    for module, expected_model in (("flux2_edit", "flux2-klein-4b"), ("fibo_edit", "fibo-edit")):
        module_defaults = expect_ok(
            client.get(f"/api/modules/{module}/defaults"),
            f"GET /api/modules/{module}/defaults",
        )
        if module_defaults and module_defaults.get("model") == expected_model:
            record(f"{module} defaults model", "PASS", expected_model)
        elif module_defaults:
            record(f"{module} defaults model", "FAIL", f"unexpected model: {module_defaults.get('model')}")

    unknown_module = client.get("/api/modules/unknown-module/defaults")
    if unknown_module.status_code == 404:
        record("Unknown module defaults 404", "PASS")
    else:
        record("Unknown module defaults 404", "FAIL", f"HTTP {unknown_module.status_code}")

    unknown_model = client.get("/api/models/not-a-real-model/defaults")
    if unknown_model.status_code == 404:
        record("Unknown model defaults 404", "PASS")
    else:
        record("Unknown model defaults 404", "FAIL", f"HTTP {unknown_model.status_code}")

    expect_ok(client.get("/api/models/loras"), "GET /api/models/loras")

    png_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
        b"\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    upload = client.post(
        "/api/uploads/temp",
        files={"file": ("smoke.png", io.BytesIO(png_bytes), "image/png")},
    )
    upload_data = expect_ok(upload, "POST /api/uploads/temp")
    uploaded_path = upload_data.get("path") if upload_data else None
    if uploaded_path and Path(uploaded_path).exists():
        record("Upload temp file persisted", "PASS", uploaded_path)
    else:
        record("Upload temp file persisted", "FAIL", str(uploaded_path))

    traversal = client.delete("/api/gallery/../../etc/passwd")
    if traversal.status_code in {400, 404}:
        record("Gallery delete path traversal blocked", "PASS", f"HTTP {traversal.status_code}")
    else:
        record("Gallery delete path traversal blocked", "FAIL", f"HTTP {traversal.status_code}")

    config = client.get("/api/config").json().get("data", {})
    output_dir = Path(config.get("paths", {}).get("outputDir", "~/mflux_outputs")).expanduser()
    output_dir.mkdir(parents=True, exist_ok=True)
    smoke_id = f"smoke_{int(time.time())}"
    smoke_png = output_dir / f"{smoke_id}.png"
    smoke_meta = output_dir / f"{smoke_id}.metadata.json"
    smoke_png.write_bytes(png_bytes)
    smoke_meta.write_text(json.dumps({"prompt": "smoke test", "model": "z-image-turbo"}))

    delete_data = expect_ok(client.delete(f"/api/gallery/{smoke_id}"), "DELETE /api/gallery/{id}")
    if delete_data and not smoke_png.exists() and not smoke_meta.exists():
        record("Gallery delete removes image and sidecar", "PASS")
    else:
        record("Gallery delete removes image and sidecar", "FAIL", f"png={smoke_png.exists()} meta={smoke_meta.exists()}")

    batch_ids = [f"{smoke_id}_batch_a", f"{smoke_id}_batch_b"]
    batch_paths = []
    for batch_id in batch_ids:
        batch_png = output_dir / f"{batch_id}.png"
        batch_meta = output_dir / f"{batch_id}.metadata.json"
        batch_png.write_bytes(png_bytes)
        batch_meta.write_text(json.dumps({"prompt": "batch smoke test", "model": "z-image-turbo"}))
        batch_paths.append((batch_png, batch_meta))
    batch_delete_data = expect_ok(
        client.request("DELETE", "/api/gallery", json={"ids": batch_ids}),
        "DELETE /api/gallery batch",
    )
    if batch_delete_data and all(not png.exists() and not meta.exists() for png, meta in batch_paths):
        record("Gallery batch delete removes images and sidecars", "PASS")
    else:
        detail = ", ".join(f"{png.name}=({png.exists()},{meta.exists()})" for png, meta in batch_paths)
        record("Gallery batch delete removes images and sidecars", "FAIL", detail)

    reveal_png = output_dir / f"{smoke_id}_reveal.png"
    reveal_png.write_bytes(png_bytes)
    if sys.platform == "darwin":
        reveal = client.post(f"/api/gallery/{smoke_id}_reveal/reveal", json={})
        if reveal.status_code == 200 and reveal.json().get("ok"):
            record("POST /api/gallery/{id}/reveal", "PASS")
        else:
            record("POST /api/gallery/{id}/reveal", "FAIL", reveal.text[:240])
    else:
        record("POST /api/gallery/{id}/reveal", "SKIP", "macOS only")
    reveal_png.unlink(missing_ok=True)

    txt2img_job = client.post(
        "/api/jobs",
        json={
            "module": "txt2img",
            "params": {
                "prompt": "smoke test puffin",
                "model": "z-image-turbo",
                "width": 256,
                "height": 256,
                "steps": 1,
                "quantize": 8,
                "seed": 42,
                "livePreview": True,
                "lowRam": True,
                "loras": [],
            },
        },
    )
    txt2img_data = None
    if txt2img_job.status_code == 201 and txt2img_job.json().get("ok"):
        txt2img_data = txt2img_job.json()["data"]
        record("POST /api/jobs txt2img accepted", "PASS", txt2img_data.get("id", ""))
    else:
        record("POST /api/jobs txt2img accepted", "FAIL", txt2img_job.text[:240])

    if txt2img_data:
        job_id = txt2img_data["id"]
        time.sleep(0.5)
        cancel = client.delete(f"/api/jobs/{job_id}")
        if cancel.status_code == 200:
            record("DELETE /api/jobs/{id} cancel", "PASS")
        elif cancel.status_code == 409:
            payload = cancel.json()
            details = payload.get("error", {}).get("details", "")
            if details == "succeeded":
                record("DELETE /api/jobs/{id} cancel", "PASS", "job already succeeded")
            else:
                record("DELETE /api/jobs/{id} cancel", "FAIL", cancel.text[:240])
        else:
            record("DELETE /api/jobs/{id} cancel", "FAIL", cancel.text[:240])
        stream = client.get(f"/api/jobs/{job_id}/stream")
        if stream.status_code == 200 and "text/event-stream" in stream.headers.get("content-type", ""):
            record("GET /api/jobs/{id}/stream SSE", "PASS")
        else:
            record("GET /api/jobs/{id}/stream SSE", "FAIL", f"HTTP {stream.status_code}")

    missing_lora = client.post(
        "/api/jobs",
        json={
            "module": "txt2img",
            "params": {
                "prompt": "smoke",
                "model": "z-image-turbo",
                "width": 256,
                "height": 256,
                "steps": 1,
                "quantize": 8,
                "seed": 1,
                "loras": [{"path": "/tmp/does-not-exist-lora.safetensors", "strength": 1.0}],
            },
        },
    )
    if missing_lora.status_code == 400 and missing_lora.json().get("error", {}).get("code") == "lora_not_found":
        record("lora_not_found error mapping", "PASS")
    else:
        record("lora_not_found error mapping", "FAIL", missing_lora.text[:240])

    download_job = client.post(
        "/api/jobs",
        json={"module": "model_download", "params": {"model_name": "schnell"}},
    )
    if download_job.status_code == 201 and download_job.json().get("ok"):
        download_id = download_job.json()["data"]["id"]
        record("POST /api/jobs model_download accepted", "PASS", download_id)
        client.delete(f"/api/jobs/{download_id}")
    elif download_job.status_code == 409:
        record("POST /api/jobs model_download accepted", "SKIP", "blocked by concurrent job")
    else:
        record("POST /api/jobs model_download accepted", "FAIL", download_job.text[:240])

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

    pytest = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/test_lora_compatibility_policy.py", "-q"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if pytest.returncode == 0:
        record("pytest lora compatibility policy", "PASS")
    else:
        record("pytest lora compatibility policy", "FAIL", (pytest.stdout + pytest.stderr)[-400:])

    print("\n=== Summary ===")
    print(f"PASS={PASS} FAIL={FAIL} SKIP={SKIP}")
    report_path = ROOT / "scripts" / "smoke_test_results.json"
    report_path.write_text(json.dumps({"pass": PASS, "fail": FAIL, "skip": SKIP, "results": RESULTS}, indent=2))
    print(f"Wrote {report_path}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
