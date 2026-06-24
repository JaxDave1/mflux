#!/usr/bin/env python3
"""End-to-end Hugging Face model download test via Jobs API."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import httpx

API_BASE = "http://127.0.0.1:8189"
POLL_SECONDS = 5
TIMEOUT_SECONDS = 6 * 60 * 60


def request(client: httpx.Client, method: str, path: str, **kwargs) -> dict:
    response = client.request(method, f"{API_BASE}{path}", timeout=120.0, **kwargs)
    payload = response.json()
    if response.status_code >= 400 or not payload.get("ok"):
        raise RuntimeError(f"{method} {path} failed ({response.status_code}): {json.dumps(payload)[:500]}")
    return payload["data"]


def cancel_active_jobs(client: httpx.Client) -> None:
    jobs = request(client, "GET", "/api/jobs?include_terminal=false").get("jobs", [])
    for job in jobs:
        if job.get("state") in {"queued", "running"}:
            client.delete(f"{API_BASE}/api/jobs/{job['id']}", timeout=30.0)


def model_cached(client: httpx.Client, model_id: str) -> bool:
    data = request(client, "GET", "/api/models")
    for model in data.get("builtin", []):
        if model["id"] == model_id:
            return bool(model["metadata"]["cached"])
    raise KeyError(model_id)


def wait_for_job(client: httpx.Client, job_id: str) -> dict:
    started = time.time()
    last_progress = None
    while time.time() - started < TIMEOUT_SECONDS:
        job = request(client, "GET", f"/api/jobs/{job_id}")
        progress = job.get("progress", {})
        label = (
            f"{job['state']} "
            f"step={progress.get('step')}/{progress.get('total_steps')} "
            f"pct={progress.get('percent')}% "
            f"elapsed={progress.get('elapsed_ms')}ms"
        )
        if label != last_progress:
            print(f"  [{time.strftime('%H:%M:%S')}] {label}")
            last_progress = label
        if job["state"] in {"succeeded", "failed", "cancelled", "timed_out"}:
            return job
        time.sleep(POLL_SECONDS)
    raise TimeoutError(f"Job {job_id} did not finish within {TIMEOUT_SECONDS}s")


def run_download(client: httpx.Client, model_name: str) -> dict:
    before = model_cached(client, model_name)
    print(f"\n=== Download test: {model_name} (cached_before={before}) ===")
    job = request(
        client,
        "POST",
        "/api/jobs",
        json={"module": "model_download", "params": {"model_name": model_name}},
    )
    print(f"  job_id={job['id']}")
    finished = wait_for_job(client, job["id"])
    after = model_cached(client, model_name)
    print(f"  final_state={finished['state']} cached_after={after}")
    if finished.get("output"):
        print(f"  output={json.dumps(finished['output'])[:400]}")
    if finished["state"] != "succeeded":
        error = finished.get("error")
        raise RuntimeError(f"Download failed for {model_name}: {error}")
    if not after:
        raise RuntimeError(f"Model {model_name} did not report cached after successful job")
    return {"model": model_name, "cached_before": before, "cached_after": after, "job": finished}


def main() -> int:
    targets = sys.argv[1:] or ["schnell", "flux2-klein-4b"]
    results: list[dict] = []

    with httpx.Client() as client:
        health = client.get(f"{API_BASE}/api/health", timeout=10.0)
        if health.status_code != 200:
            print(f"API not reachable at {API_BASE} (HTTP {health.status_code})")
            return 1

        secrets = request(client, "GET", "/api/secrets")
        hf_set = next((t["is_set"] for t in secrets["tokens"] if t["key"] == "hf"), False)
        if not hf_set:
            print("HF token is not set. Configure it in Config -> API Keys before running this test.")
            return 1

        cancel_active_jobs(client)

        for model_name in targets:
            results.append(run_download(client, model_name))

    report = Path(__file__).resolve().parent / "model_download_test_results.json"
    report.write_text(json.dumps(results, indent=2, default=str))
    print(f"\nAll downloads succeeded. Wrote {report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())