import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.routers import gallery as gallery_router
from api.schemas.requests import AppConfig

PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde"
    b"\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


def app_config(tmp_path: Path) -> AppConfig:
    return AppConfig.model_validate(
        {
            "paths": {
                "hfHome": str(tmp_path / "hf"),
                "modelDir": str(tmp_path / "models"),
                "outputDir": str(tmp_path / "outputs"),
                "loraDir": str(tmp_path / "loras"),
            },
            "generation": {
                "defaultModel": "z-image-turbo",
                "defaultQuantize": 8,
                "defaultSteps": 9,
                "outputFormat": "png",
                "quality": 95,
                "autoSeeds": True,
                "saveMetadataSidecar": True,
            },
            "system": {
                "cacheLimit": 8,
                "lowRamMode": False,
                "livePreview": True,
            },
            "backend": {
                "serverUrl": "127.0.0.1",
                "port": 8189,
                "autoOpenBrowser": False,
            },
        }
    )


@pytest.fixture()
def gallery_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[TestClient, Path]:
    config = app_config(tmp_path)
    output_dir = Path(config.paths.outputDir)
    output_dir.mkdir(parents=True)
    monkeypatch.setattr(gallery_router.store, "load", lambda: config)
    return TestClient(app), output_dir


def write_gallery_output(output_dir: Path, item_id: str) -> tuple[Path, Path]:
    image_path = output_dir / f"{item_id}.png"
    sidecar_path = output_dir / f"{item_id}.metadata.json"
    image_path.write_bytes(PNG_BYTES)
    sidecar_path.write_text(json.dumps({"prompt": item_id, "model": "z-image-turbo"}))
    return image_path, sidecar_path


@pytest.mark.fast
def test_batch_delete_removes_gallery_outputs_and_sidecars(gallery_client: tuple[TestClient, Path]):
    client, output_dir = gallery_client
    first_image, first_sidecar = write_gallery_output(output_dir, "batch_first")
    second_image, second_sidecar = write_gallery_output(output_dir, "batch_second")

    response = client.request("DELETE", "/api/gallery", json={"ids": ["batch_first", "batch_second"]})

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert [item["id"] for item in payload["data"]["deleted"]] == ["batch_first", "batch_second"]
    assert payload["data"]["failed"] == []
    assert not first_image.exists()
    assert not first_sidecar.exists()
    assert not second_image.exists()
    assert not second_sidecar.exists()


@pytest.mark.fast
def test_batch_delete_reports_missing_items_without_blocking_valid_deletes(
    gallery_client: tuple[TestClient, Path],
):
    client, output_dir = gallery_client
    image_path, sidecar_path = write_gallery_output(output_dir, "batch_existing")

    response = client.request("DELETE", "/api/gallery", json={"ids": ["batch_existing", "batch_missing"]})

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert [item["id"] for item in payload["data"]["deleted"]] == ["batch_existing"]
    assert payload["data"]["failed"] == [
        {
            "id": "batch_missing",
            "code": "not_found",
            "message": "Gallery item not found",
            "details": "batch_missing",
        }
    ]
    assert not image_path.exists()
    assert not sidecar_path.exists()
