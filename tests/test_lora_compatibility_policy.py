import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.routers.models import _scan_lora_summaries
from api.services import job_manager as job_manager_module
from api.services.job_manager import LoraIncompatibleError, _validate_lora_paths
from api.services.lora_compat import detect_lora_architecture, lora_compatibility


def write_safetensors_header(path: Path, metadata: dict[str, str] | None = None) -> None:
    header = json.dumps({"__metadata__": metadata or {}}).encode("utf-8")
    path.write_bytes(len(header).to_bytes(8, "little") + header)


@pytest.mark.fast
def test_lora_architecture_compatibility_states(tmp_path: Path):
    flux_lora = tmp_path / "flux_style.safetensors"
    z_image_lora = tmp_path / "portrait.safetensors"
    unknown_lora = tmp_path / "style_pack.safetensors"
    write_safetensors_header(flux_lora)
    write_safetensors_header(z_image_lora, {"ss_base_model": "z-image"})
    write_safetensors_header(unknown_lora)

    assert detect_lora_architecture(flux_lora) == "flux"
    assert detect_lora_architecture(z_image_lora) == "z-image"
    assert detect_lora_architecture(unknown_lora) == "unknown"
    assert lora_compatibility("flux", "dev") == "compatible"
    assert lora_compatibility("unknown", "dev") == "unknown"
    assert lora_compatibility("z-image", "dev") == "incompatible"


@pytest.mark.fast
def test_lora_endpoint_scan_includes_compatible_and_unknown_only(tmp_path: Path):
    write_safetensors_header(tmp_path / "flux_style.safetensors")
    write_safetensors_header(tmp_path / "z-image_style.safetensors")
    write_safetensors_header(tmp_path / "mystery_style.safetensors")

    summaries = _scan_lora_summaries(tmp_path, compatible_with="dev")
    by_name = {summary.name: summary for summary in summaries}

    assert set(by_name) == {"Flux Style", "Mystery Style"}
    assert by_name["Flux Style"].architecture == "flux"
    assert by_name["Flux Style"].compat == "compatible"
    assert by_name["Mystery Style"].architecture == "unknown"
    assert by_name["Mystery Style"].compat == "unknown"


@pytest.mark.fast
def test_submit_validation_accepts_unknown_and_rejects_known_mismatch(tmp_path: Path):
    unknown_lora = tmp_path / "mystery_style.safetensors"
    incompatible_lora = tmp_path / "z-image_style.safetensors"
    write_safetensors_header(unknown_lora)
    write_safetensors_header(incompatible_lora)

    _validate_lora_paths("dev", [str(unknown_lora)])

    with pytest.raises(LoraIncompatibleError) as exc_info:
        _validate_lora_paths("dev", [str(incompatible_lora)])

    assert exc_info.value.path == str(incompatible_lora)
    assert exc_info.value.detected == "z-image"
    assert exc_info.value.expected == "flux"


@pytest.mark.fast
def test_jobs_router_returns_lora_incompatible_error(monkeypatch):
    def raise_incompatible(*args, **kwargs):
        raise LoraIncompatibleError("/tmp/z-image_style.safetensors", "z-image", "flux", "dev")

    monkeypatch.setattr(job_manager_module.job_manager, "create_job", raise_incompatible)
    response = TestClient(app).post("/api/jobs", json={"module": "txt2img", "params": {"prompt": "x", "model": "dev"}})

    assert response.status_code == 400
    payload = response.json()
    assert payload["ok"] is False
    assert payload["error"]["code"] == "lora_incompatible"
    assert "detected z-image, expected flux" in payload["error"]["message"]
    assert payload["error"]["details"] == "/tmp/z-image_style.safetensors"
