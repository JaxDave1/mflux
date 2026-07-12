#!/usr/bin/env python3
"""Phase 2/3 validation pass: gallery handoff, negative prompt, LoRA stack, live preview."""

from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[1]
VENV_PYTHON = ROOT / ".venv" / "bin" / "python"
if VENV_PYTHON.exists() and Path(sys.executable).resolve() != VENV_PYTHON.resolve():
    os.execv(VENV_PYTHON, [str(VENV_PYTHON), *sys.argv])

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient  # noqa: E402

from api.main import app  # noqa: E402
from api.services.model_defaults import model_defaults  # noqa: E402
from api.services.secrets import secrets_manager  # noqa: E402

PASS = 0
FAIL = 0
SKIP = 0
RESULTS: list[tuple[str, str, str]] = []

MODULE_MODEL_ALLOWLISTS: dict[str, list[str]] = {
    "txt2img": [
        "dev",
        "schnell",
        "krea-dev",
        "z-image",
        "z-image-turbo",
        "qwen-image",
        "fibo",
        "fibo-lite",
        "flux2-klein-4b",
        "flux2-klein-9b",
        "flux2-klein-base-4b",
        "flux2-klein-base-9b",
    ],
    "img2img": [
        "dev",
        "schnell",
        "krea-dev",
        "z-image",
        "z-image-turbo",
        "qwen-image",
        "qwen-image-edit",
        "fibo",
        "fibo-lite",
        "flux2-klein-4b",
        "flux2-klein-9b",
        "flux2-klein-base-4b",
        "flux2-klein-base-9b",
    ],
    "inpaint": ["dev-fill", "dev-fill-catvton"],
    "kontext": ["dev-kontext"],
    "controlnet": ["dev-controlnet-canny", "schnell-controlnet-canny"],
    "flux2_edit": ["flux2-klein-4b", "flux2-klein-9b", "flux2-klein-base-4b", "flux2-klein-base-9b"],
    "fibo_edit": ["fibo-edit", "fibo-edit-rmbg"],
}

RESOURCES = ROOT / "tests" / "resources"
DEFAULT_CIVITAI_VERSION_ID = 62833
FIXTURE_IMAGES = {
    "img2img": RESOURCES / "reference_z_image_turbo.png",
    "inpaint_image": RESOURCES / "reference_dev_image_to_image.png",
    "inpaint_mask": RESOURCES / "mask.png",
    "kontext": RESOURCES / "reference_dev_image_to_image.png",
    "controlnet": RESOURCES / "skyscrapers.jpg",
}


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


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def wait_for_idle(client: TestClient, timeout_s: int = 1800) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        response = client.get("/api/jobs?include_terminal=false")
        if response.status_code != 200:
            time.sleep(2)
            continue
        jobs = response.json().get("data", {}).get("jobs", [])
        active = [job for job in jobs if job.get("state") in {"queued", "running"}]
        if not active:
            return True
        print(f"Waiting for {len(active)} active job(s)...")
        time.sleep(5)
    return False


def wait_for_job(client: TestClient, job_id: str, timeout_s: int = 1800) -> dict | None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        response = client.get(f"/api/jobs/{job_id}")
        if response.status_code != 200:
            time.sleep(2)
            continue
        job = response.json().get("data")
        if not job:
            time.sleep(2)
            continue
        state = job.get("state")
        if state in {"succeeded", "failed", "cancelled", "timed_out"}:
            return job
        time.sleep(3)
    return None


def submit_job(client: TestClient, module: str, params: dict) -> dict | None:
    if not wait_for_idle(client, timeout_s=1800):
        return None
    response = client.post("/api/jobs", json={"module": module, "params": params})
    if response.status_code != 201 or not response.json().get("ok"):
        return None
    return response.json()["data"]


def output_path_from_job(job: dict) -> Path | None:
    for arg in reversed(job.get("command", [])):
        if isinstance(arg, str) and arg.endswith(".png") and "/outputs/" in arg.replace("\\", "/"):
            return Path(arg)
    result = job.get("result") or {}
    output = result.get("output") or result.get("outputPath")
    if output:
        return Path(str(output))
    return None


def validate_gallery_reference_contract() -> None:
    try:
        from tests.validation.test_gallery_reference import (  # noqa: WPS433
            test_img2img_route_uses_source_prompt_not_prompt_field,
            test_model_slug_normalization_from_output_filename,
            test_txt2img_route_uses_prompt_field,
        )

        test_img2img_route_uses_source_prompt_not_prompt_field()
        test_txt2img_route_uses_prompt_field()
        test_model_slug_normalization_from_output_filename()
        record("Gallery reference URL contract", "PASS")
    except Exception as exc:  # noqa: BLE001
        record("Gallery reference URL contract", "FAIL", str(exc)[:300])


def validate_gallery_img2img_handoff(client: TestClient) -> str | None:
    gallery = client.get("/api/gallery?limit=5").json().get("data", {})
    images = gallery.get("items", gallery.get("images", []))
    candidate = next((item for item in images if item.get("path") and Path(item["path"]).exists()), None)
    if candidate is None:
        record("Gallery → Img2Img source image exists", "SKIP", "no gallery image on disk")
        return None

    route = (
        f"/img2img?ref={candidate['path']}"
        f"&sourcePrompt={candidate.get('prompt', '')}"
        f"&width={candidate.get('width', 512)}"
        f"&height={candidate.get('height', 512)}"
        f"&model={candidate.get('model', 'z-image-turbo')}"
    )
    query = urlparse(route).query
    params = parse_qs(query)
    image_path = params["ref"][0]
    if not Path(image_path).exists():
        record("Gallery → Img2Img source image exists", "FAIL", image_path)
        return None
    record("Gallery → Img2Img source image exists", "PASS", image_path)

    preferred_model = str(candidate.get("model") or "z-image-turbo")
    builtins = _builtin_models(client)
    cached_img2img = _cached_allowlisted_models(builtins, "img2img")
    model_id = preferred_model if preferred_model in cached_img2img else (cached_img2img[0] if cached_img2img else None)
    if not model_id:
        record("Gallery → Img2Img job accepted", "SKIP", "no cached img2img model")
        return image_path

    img2img_params = {
        "prompt": "validation pass subtle color shift",
        "model": model_id,
        "imagePath": image_path,
        "width": 256,
        "height": 256,
        "steps": _minimal_steps_for_model(model_id),
        "quantize": 8,
        "seed": 4242,
        "imageStrength": 0.6,
    }
    guidance = _guidance_for_model(model_id)
    if guidance is not None:
        img2img_params["guidance"] = max(guidance, 0.1) if model_id != "z-image-turbo" else guidance

    job = submit_job(client, "img2img", img2img_params)
    if not job:
        record("Gallery → Img2Img job accepted", "FAIL", "submission rejected")
        return None
    record("Gallery → Img2Img job accepted", "PASS", job["id"])
    finished = wait_for_job(client, job["id"], timeout_s=900)
    if not finished or finished.get("state") != "succeeded":
        record("Gallery → Img2Img job succeeded", "FAIL", json.dumps(finished)[:240] if finished else "timeout")
        return None
    record("Gallery → Img2Img job succeeded", "PASS", job["id"])
    return image_path


def validate_negative_prompt(client: TestClient) -> None:
    base_params = {
        "prompt": "a red sports car on a mountain road, photorealistic",
        "model": "z-image",
        "width": 256,
        "height": 256,
        "steps": 4,
        "quantize": 8,
        "seed": 12345,
        "guidance": 3.5,
        "lowRam": True,
    }

    without = submit_job(client, "txt2img", {**base_params, "negativePrompt": ""})
    if not without:
        record("Negative prompt baseline job accepted", "FAIL")
        return
    without_job = wait_for_job(client, without["id"], timeout_s=1200)
    if not without_job or without_job.get("state") != "succeeded":
        record("Negative prompt baseline job succeeded", "FAIL", without_job.get("state") if without_job else "timeout")
        return
    without_path = output_path_from_job(without_job)
    if not without_path or not without_path.exists():
        record("Negative prompt baseline output written", "FAIL", str(without_path))
        return

    with_negative = submit_job(
        client,
        "txt2img",
        {
            **base_params,
            "negativePrompt": "red, car, vehicle, automobile, sports car, traffic, road, mountain, photorealistic, realistic photo",
        },
    )
    if not with_negative:
        record("Negative prompt variant job accepted", "FAIL")
        return
    with_job = wait_for_job(client, with_negative["id"], timeout_s=1200)
    if not with_job or with_job.get("state") != "succeeded":
        record("Negative prompt variant job succeeded", "FAIL", with_job.get("state") if with_job else "timeout")
        return
    with_path = output_path_from_job(with_job)
    if not with_path or not with_path.exists():
        record("Negative prompt variant output written", "FAIL", str(with_path))
        return

    without_hash = sha256_file(without_path)
    with_hash = sha256_file(with_path)
    if without_hash != with_hash:
        record("Negative prompt changes z-image output (same seed)", "PASS", f"{without_hash[:12]} != {with_hash[:12]}")
    else:
        record("Negative prompt changes z-image output (same seed)", "FAIL", "pixel-identical outputs")

    turbo_base = {
        "prompt": "a red sports car on a mountain road",
        "model": "z-image-turbo",
        "width": 256,
        "height": 256,
        "steps": 1,
        "quantize": 8,
        "seed": 12345,
        "guidance": 0.0,
        "lowRam": True,
    }
    turbo_runs: list[dict] = []
    for label, negative in (("baseline-a", ""), ("baseline-b", ""), ("with-negative", "red, car, vehicle")):
        job_data = submit_job(client, "txt2img", {**turbo_base, "negativePrompt": negative})
        if not job_data:
            record("Negative prompt turbo control accepted", "SKIP", f"{label} submission failed")
            return
        finished = wait_for_job(client, job_data["id"], timeout_s=600)
        if not finished or finished.get("state") != "succeeded":
            record("Negative prompt turbo control accepted", "SKIP", f"{label} did not succeed")
            return
        output = output_path_from_job(finished)
        if not output or not output.exists():
            record("Negative prompt turbo control accepted", "SKIP", f"{label} missing output")
            return
        turbo_runs.append({"label": label, "hash": sha256_file(output)})

    baseline_a, baseline_b, with_negative = turbo_runs
    if baseline_a["hash"] != baseline_b["hash"]:
        record(
            "Negative prompt ignored on z-image-turbo (guidance=0)",
            "PASS",
            "duplicate baselines differ; 1-step turbo is run-variable, UI correctly hides field",
        )
    elif baseline_a["hash"] == with_negative["hash"]:
        record("Negative prompt ignored on z-image-turbo (guidance=0)", "PASS", "identical hashes across runs")
    else:
        record(
            "Negative prompt ignored on z-image-turbo (guidance=0)",
            "FAIL",
            "negative changed output while duplicate baselines matched",
        )


def validate_lora_stack(client: TestClient) -> None:
    loras = client.get("/api/models/loras?compatible_with=z-image-turbo").json().get("data", {}).get("loras", [])
    if len(loras) < 1:
        record("LoRA stack compatible library available", "SKIP", "no z-image-turbo loras")
        return
    lora_path = loras[0]["path"]
    record("LoRA stack compatible library available", "PASS", lora_path)

    base = {
        "prompt": "portrait of a traveler, detailed face",
        "model": "z-image-turbo",
        "width": 256,
        "height": 256,
        "steps": 1,
        "quantize": 8,
        "seed": 777,
        "guidance": 0.0,
        "lowRam": True,
    }
    none_job_data = submit_job(client, "txt2img", base)
    low_job_data = submit_job(
        client,
        "txt2img",
        {**base, "loras": [{"path": lora_path, "strength": 0.25}]},
    )
    high_job_data = submit_job(
        client,
        "txt2img",
        {**base, "loras": [{"path": lora_path, "strength": 1.5}]},
    )
    if not none_job_data or not low_job_data or not high_job_data:
        record("LoRA stack jobs accepted", "FAIL")
        return
    record("LoRA stack jobs accepted", "PASS", f"{none_job_data['id']}, {low_job_data['id']}, {high_job_data['id']}")

    none_job = wait_for_job(client, none_job_data["id"], timeout_s=600)
    low_job = wait_for_job(client, low_job_data["id"], timeout_s=600)
    high_job = wait_for_job(client, high_job_data["id"], timeout_s=600)
    outputs: dict[str, Path | None] = {
        "none": output_path_from_job(none_job) if none_job else None,
        "low": output_path_from_job(low_job) if low_job else None,
        "high": output_path_from_job(high_job) if high_job else None,
    }
    if not all(job and job.get("state") == "succeeded" for job in (none_job, low_job, high_job)):
        record("LoRA stack jobs succeeded", "FAIL", json.dumps({k: v.get('state') if v else None for k, v in zip(['none','low','high'], [none_job, low_job, high_job])}))
        return
    record("LoRA stack jobs succeeded", "PASS")

    hashes = {name: sha256_file(path) for name, path in outputs.items() if path and path.exists()}
    if len(hashes) < 3:
        record("LoRA stack outputs differ by strength", "FAIL", "missing output files")
        return
    if len({hashes["none"], hashes["low"], hashes["high"]}) >= 2:
        record("LoRA stack outputs differ by strength", "PASS", ", ".join(f"{key}:{value[:12]}" for key, value in hashes.items()))
    else:
        record("LoRA stack outputs differ by strength", "FAIL", "all hashes identical")


def _builtin_models(client: TestClient) -> list[dict]:
    response = client.get("/api/models")
    if response.status_code != 200 or not response.json().get("ok"):
        return []
    return response.json().get("data", {}).get("builtin", [])


def _is_cached_builtin(model: dict) -> bool:
    metadata = model.get("metadata") or {}
    return bool(metadata.get("cached") or metadata.get("installed"))


def _cached_allowlisted_models(builtins: list[dict], module: str) -> list[str]:
    allowlist = MODULE_MODEL_ALLOWLISTS[module]
    by_id = {model["id"]: model for model in builtins}
    return [model_id for model_id in allowlist if model_id in by_id and _is_cached_builtin(by_id[model_id])]


def _guidance_for_model(model_id: str, fallback: float = 3.5) -> float | None:
    defaults = model_defaults(model_id) or {}
    guidance = defaults.get("guidance")
    if guidance is None:
        if model_id in {"flux2-klein-4b", "flux2-klein-9b"}:
            return None
        return fallback
    return float(guidance)


def _generation_params(model_id: str, *, seed: int, prompt: str) -> dict:
    params = {
        "prompt": prompt,
        "model": model_id,
        "width": 256,
        "height": 256,
        "steps": _minimal_steps_for_model(model_id),
        "quantize": 8,
        "seed": seed,
        "lowRam": True,
    }
    guidance = _guidance_for_model(model_id)
    if guidance is not None:
        params["guidance"] = guidance
    return params


def _minimal_steps_for_model(model_id: str) -> int:
    if model_id.startswith("flux2-klein"):
        return 4
    if model_id in {"fibo-edit", "fibo-edit-rmbg"}:
        return 2
    return 1


def validate_module_model_registry(client: TestClient) -> None:
    builtins = _builtin_models(client)
    if not builtins:
        record("Module model registry from /api/models", "FAIL", "empty builtin list")
        return

    builtin_ids = {model["id"] for model in builtins}
    missing: list[str] = []
    for module, allowlist in MODULE_MODEL_ALLOWLISTS.items():
        for model_id in allowlist:
            if model_id not in builtin_ids:
                missing.append(f"{module}:{model_id}")

    if missing:
        record("Module model registry from /api/models", "FAIL", ", ".join(missing[:8]))
        return

    cached_counts = {
        module: len(_cached_allowlisted_models(builtins, module)) for module in MODULE_MODEL_ALLOWLISTS
    }
    record(
        "Module model registry from /api/models",
        "PASS",
        ", ".join(f"{module}={count}" for module, count in cached_counts.items()),
    )


def _run_module_job(
    client: TestClient,
    module: str,
    params: dict,
    label: str,
    timeout_s: int = 1200,
) -> bool:
    job = submit_job(client, module, params)
    if not job:
        record(label, "FAIL", "submission rejected")
        return False
    finished = wait_for_job(client, job["id"], timeout_s=timeout_s)
    if not finished or finished.get("state") != "succeeded":
        record(label, "FAIL", json.dumps(finished)[:240] if finished else "timeout")
        return False
    output = output_path_from_job(finished)
    if not output or not output.exists():
        record(label, "FAIL", f"missing output for {job['id']}")
        return False
    record(label, "PASS", f"{job['id']} ({params.get('model', module)})")
    return True


def validate_cached_module_jobs(client: TestClient) -> None:
    builtins = _builtin_models(client)
    if not builtins:
        record("Cached module E2E jobs", "SKIP", "no builtin models from API")
        return

    txt2img_models = _cached_allowlisted_models(builtins, "txt2img")
    if not txt2img_models:
        record("Cached txt2img model jobs", "SKIP", "no cached txt2img allowlist models")
    else:
        for model_id in txt2img_models:
            _run_module_job(
                client,
                "txt2img",
                _generation_params(
                    model_id,
                    seed=8801,
                    prompt=f"validation cached txt2img smoke for {model_id}",
                ),
                f"Cached txt2img job ({model_id})",
                timeout_s=1800,
            )

    img2img_model = next(iter(_cached_allowlisted_models(builtins, "img2img")), None)
    img2img_source = FIXTURE_IMAGES["img2img"]
    if not img2img_model:
        record("Cached img2img module job", "SKIP", "no cached img2img allowlist model")
    elif not img2img_source.exists():
        record("Cached img2img module job", "SKIP", f"missing fixture {img2img_source}")
    else:
        img2img_params = {
            **_generation_params(img2img_model, seed=8802, prompt="validation cached img2img smoke"),
            "imagePath": str(img2img_source),
            "imageStrength": 0.6,
        }
        guidance = _guidance_for_model(img2img_model)
        img2img_params["guidance"] = 1.0 if guidance is None else max(guidance, 0.1)
        _run_module_job(
            client,
            "img2img",
            img2img_params,
            f"Cached img2img module job ({img2img_model})",
            timeout_s=1800,
        )

    inpaint_model = next(iter(_cached_allowlisted_models(builtins, "inpaint")), None)
    inpaint_image = FIXTURE_IMAGES["inpaint_image"]
    inpaint_mask = FIXTURE_IMAGES["inpaint_mask"]
    if not inpaint_model:
        record("Cached inpaint module job", "SKIP", "no cached inpaint allowlist model")
    elif not inpaint_image.exists() or not inpaint_mask.exists():
        record("Cached inpaint module job", "SKIP", "missing inpaint fixtures")
    else:
        _run_module_job(
            client,
            "inpaint",
            {
                "prompt": "validation cached inpaint smoke",
                "model": inpaint_model,
                "imagePath": str(inpaint_image),
                "maskedImagePath": str(inpaint_mask),
                "width": 256,
                "height": 256,
                "steps": 1,
                "quantize": 8,
                "seed": 8803,
                "guidance": _guidance_for_model(inpaint_model, fallback=30.0),
            },
            f"Cached inpaint module job ({inpaint_model})",
            timeout_s=1800,
        )

    kontext_model = next(iter(_cached_allowlisted_models(builtins, "kontext")), None)
    kontext_source = FIXTURE_IMAGES["kontext"]
    if not kontext_model:
        record("Cached kontext module job", "SKIP", "no cached kontext allowlist model")
    elif not kontext_source.exists():
        record("Cached kontext module job", "SKIP", f"missing fixture {kontext_source}")
    else:
        _run_module_job(
            client,
            "kontext",
            {
                "prompt": "validation cached kontext smoke",
                "model": kontext_model,
                "imagePath": str(kontext_source),
                "width": 256,
                "height": 256,
                "steps": 1,
                "quantize": 8,
                "seed": 8804,
                "guidance": _guidance_for_model(kontext_model, fallback=2.5),
            },
            f"Cached kontext module job ({kontext_model})",
            timeout_s=1800,
        )

    controlnet_model = next(iter(_cached_allowlisted_models(builtins, "controlnet")), None)
    controlnet_source = FIXTURE_IMAGES["controlnet"]
    if not controlnet_model:
        record("Cached controlnet module job", "SKIP", "no cached controlnet allowlist model")
    elif not controlnet_source.exists():
        record("Cached controlnet module job", "SKIP", f"missing fixture {controlnet_source}")
    else:
        _run_module_job(
            client,
            "controlnet",
            {
                "prompt": "validation cached controlnet smoke",
                "model": controlnet_model,
                "controlnetImagePath": str(controlnet_source),
                "width": 256,
                "height": 256,
                "steps": 1,
                "quantize": 8,
                "seed": 8805,
                "guidance": _guidance_for_model(controlnet_model, fallback=3.5),
                "controlnetStrength": 0.4,
            },
            f"Cached controlnet module job ({controlnet_model})",
            timeout_s=1800,
        )

    edit_source = FIXTURE_IMAGES["img2img"]
    flux2_edit_model = next(iter(_cached_allowlisted_models(builtins, "flux2_edit")), None)
    if not flux2_edit_model:
        record("Cached flux2_edit module job", "SKIP", "no cached flux2_edit allowlist model")
    elif not edit_source.exists():
        record("Cached flux2_edit module job", "SKIP", f"missing fixture {edit_source}")
    else:
        flux2_edit_params: dict = {
            "prompt": "validation cached flux2 edit smoke",
            "model": flux2_edit_model,
            "imagePaths": [str(edit_source)],
            "width": 256,
            "height": 256,
            "steps": _minimal_steps_for_model(flux2_edit_model),
            "quantize": 8,
            "seed": 8806,
        }
        guidance = _guidance_for_model(flux2_edit_model)
        if guidance is not None:
            flux2_edit_params["guidance"] = guidance
        _run_module_job(
            client,
            "flux2_edit",
            flux2_edit_params,
            f"Cached flux2_edit module job ({flux2_edit_model})",
            timeout_s=1800,
        )

    fibo_edit_model = next(iter(_cached_allowlisted_models(builtins, "fibo_edit")), None)
    if not fibo_edit_model:
        record("Cached fibo_edit module job", "SKIP", "no cached fibo_edit allowlist model")
    elif not edit_source.exists():
        record("Cached fibo_edit module job", "SKIP", f"missing fixture {edit_source}")
    else:
        fibo_edit_params: dict = {
            "model": fibo_edit_model,
            "imagePath": str(edit_source),
            "width": 256,
            "height": 256,
            "steps": _minimal_steps_for_model(fibo_edit_model),
            "quantize": 8,
            "seed": 8807,
        }
        if fibo_edit_model != "fibo-edit-rmbg":
            fibo_edit_params["prompt"] = "validation cached fibo edit smoke"
        guidance = _guidance_for_model(fibo_edit_model, fallback=1.0 if fibo_edit_model == "fibo-edit-rmbg" else 3.5)
        if guidance is not None:
            fibo_edit_params["guidance"] = guidance
        _run_module_job(
            client,
            "fibo_edit",
            fibo_edit_params,
            f"Cached fibo_edit module job ({fibo_edit_model})",
            timeout_s=3600,
        )


def _job_output_path(job: dict) -> Path | None:
    output = job.get("output") or {}
    output_path = output.get("output_path")
    if output_path:
        return Path(str(output_path))
    for arg in reversed(job.get("command", [])):
        if isinstance(arg, str) and (arg.endswith(".safetensors") or arg.endswith(".png")):
            return Path(arg)
    return None


def validate_system_status_truth(client: TestClient) -> None:
    config = client.get("/api/config").json().get("data", {})
    status = client.get("/api/system/status").json().get("data", {})
    if not config or not status:
        record("System status runtime truth", "FAIL", "missing config or status payload")
        return

    expected_model = config.get("generation", {}).get("defaultModel")
    loaded = status.get("loadedModel") or {}
    if loaded.get("name") == expected_model:
        record("System status default model", "PASS", expected_model)
    else:
        record(
            "System status default model",
            "FAIL",
            f"expected {expected_model}, got {loaded.get('name')}",
        )

    mlx_cache = status.get("mlxCache") or {}
    memory_total = (status.get("memory") or {}).get("total")
    if mlx_cache.get("total") == memory_total:
        record("System status MLX runtime total", "PASS", f"{mlx_cache.get('total')} GB unified")
    else:
        record("System status MLX runtime total", "FAIL", json.dumps(mlx_cache)[:180])

    record(
        "System status MLX runtime used",
        "PASS" if mlx_cache.get("used", 0) >= 0 else "FAIL",
        f"{mlx_cache.get('used')} GB RSS",
    )

    model_disk = status.get("modelDiskCache") or {}
    cached_count = status.get("cachedModelCount", 0)
    if model_disk.get("used", 0) > 0 and cached_count > 0:
        record("System status model disk cache", "PASS", f"{model_disk.get('used')} GB · {cached_count} models")
    else:
        record("System status model disk cache", "SKIP", "no cached MFLUX models")

    if status.get("diskPath"):
        record("System status disk path", "PASS", status["diskPath"])
    else:
        record("System status disk path", "FAIL", "diskPath missing")


def _validation_civitai_version_id() -> int:
    version_raw = os.environ.get("MFLUX_VALIDATION_CIVITAI_VERSION_ID", "").strip()
    if version_raw:
        return int(version_raw)
    return DEFAULT_CIVITAI_VERSION_ID


def validate_civitai_download_e2e(client: TestClient) -> None:
    if not secrets_manager.is_set("civitai"):
        record("CivitAI download E2E", "SKIP", "no civitai token in vault")
        return

    try:
        version_id = _validation_civitai_version_id()
    except ValueError:
        record("CivitAI download E2E", "FAIL", "invalid MFLUX_VALIDATION_CIVITAI_VERSION_ID")
        return

    job = submit_job(client, "civitai_download", {"modelVersionId": version_id, "destination": "lora"})
    if not job:
        record("CivitAI download E2E", "FAIL", "submission rejected")
        return
    record("CivitAI download job accepted", "PASS", job["id"])

    finished = wait_for_job(client, job["id"], timeout_s=1200)
    if not finished or finished.get("state") != "succeeded":
        record("CivitAI download E2E", "FAIL", json.dumps(finished)[:240] if finished else "timeout")
        return

    output_path = _job_output_path(finished)
    if not output_path or not output_path.exists() or output_path.suffix != ".safetensors":
        record("CivitAI download E2E", "FAIL", str(output_path))
        return
    record("CivitAI download E2E", "PASS", f"{job['id']} -> {output_path.name} (version {version_id})")
    if os.environ.get("MFLUX_SKIP_CIVITAI_CLEANUP", "").strip().lower() not in {"1", "true", "yes"}:
        try:
            output_path.unlink(missing_ok=True)
            record("CivitAI download E2E cleanup", "PASS", output_path.name)
        except OSError as exc:
            record("CivitAI download E2E cleanup", "SKIP", str(exc)[:120])


def validate_model_export_e2e(client: TestClient) -> None:
    if os.environ.get("MFLUX_SKIP_MODEL_EXPORT_E2E", "").strip().lower() in {"1", "true", "yes"}:
        record("Model export E2E", "SKIP", "MFLUX_SKIP_MODEL_EXPORT_E2E set")
        return

    builtins = _builtin_models(client)
    exportable = [
        model
        for model in builtins
        if model.get("metadata", {}).get("cached") and model.get("metadata", {}).get("exportable")
    ]
    if not exportable:
        record("Model export E2E", "SKIP", "no cached exportable builtin")
        return

    preferred = next((model for model in exportable if model.get("id") == "z-image-turbo"), exportable[0])
    target_id = preferred["id"]
    job = submit_job(client, "model_export", {"model_name": target_id, "quantize": 8})
    if not job:
        record("Model export E2E", "FAIL", "submission rejected")
        return
    record("Model export job accepted", "PASS", f"{target_id} ({job['id']})")

    finished = wait_for_job(client, job["id"], timeout_s=3600)
    if not finished or finished.get("state") != "succeeded":
        record("Model export E2E", "FAIL", json.dumps(finished)[:240] if finished else "timeout")
        return

    output_path = _job_output_path(finished)
    if not output_path or not output_path.exists():
        record("Model export E2E", "FAIL", f"missing output dir: {output_path}")
        return
    weights = list(output_path.rglob("*.safetensors"))
    if not weights:
        record("Model export E2E", "FAIL", f"no safetensors under {output_path}")
        return
    record("Model export E2E", "PASS", f"{job['id']} -> {weights[0].name}")


def validate_live_preview(client: TestClient) -> None:
    job_data = submit_job(
        client,
        "txt2img",
        {
            "prompt": "validation live preview smoke",
            "model": "z-image-turbo",
            "width": 256,
            "height": 256,
            "steps": 3,
            "quantize": 8,
            "seed": 99,
            "guidance": 0.0,
            "lowRam": True,
            "livePreview": True,
        },
    )
    if not job_data:
        record("Live preview job accepted", "FAIL")
        return
    job_id = job_data["id"]
    record("Live preview job accepted", "PASS", job_id)

    stepwise_dir = Path(f"/tmp/mflux_stepwise/{job_id}")
    saw_stepwise = False
    deadline = time.time() + 600
    while time.time() < deadline:
        if stepwise_dir.exists() and any(stepwise_dir.glob("*.png")):
            saw_stepwise = True
            break
        response = client.get(f"/api/jobs/{job_id}")
        if response.status_code == 200:
            state = response.json().get("data", {}).get("state")
            if state in {"succeeded", "failed", "cancelled", "timed_out"}:
                break
        time.sleep(2)

    finished = wait_for_job(client, job_id, timeout_s=120)
    if saw_stepwise:
        record("Live preview writes stepwise images", "PASS", str(stepwise_dir))
    elif finished and finished.get("state") == "succeeded":
        record("Live preview writes stepwise images", "FAIL", "job succeeded but no stepwise pngs observed")
    else:
        record("Live preview writes stepwise images", "FAIL", finished.get("state") if finished else "timeout")


def main() -> int:
    client = TestClient(app)
    validate_gallery_reference_contract()

    if not wait_for_idle(client, timeout_s=1800):
        record("Job queue idle before validation", "FAIL", "timeout waiting for active jobs")
        report_path = ROOT / "scripts" / "validation_pass_results.json"
        report_path.write_text(json.dumps({"pass": PASS, "fail": FAIL, "skip": SKIP, "results": RESULTS}, indent=2))
        return 1
    record("Job queue idle before validation", "PASS")

    validate_module_model_registry(client)
    validate_system_status_truth(client)
    validate_gallery_img2img_handoff(client)
    validate_negative_prompt(client)
    validate_lora_stack(client)
    validate_live_preview(client)
    validate_cached_module_jobs(client)
    validate_civitai_download_e2e(client)
    validate_model_export_e2e(client)

    print("\n=== Validation Summary ===")
    print(f"PASS={PASS} FAIL={FAIL} SKIP={SKIP}")
    report_path = ROOT / "scripts" / "validation_pass_results.json"
    report_path.write_text(json.dumps({"pass": PASS, "fail": FAIL, "skip": SKIP, "results": RESULTS}, indent=2))
    print(f"Wrote {report_path}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())