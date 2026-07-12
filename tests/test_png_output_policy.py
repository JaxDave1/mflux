from pathlib import Path

import pytest

from api.schemas.requests import AppConfig, Txt2ImgRequest
from api.services.job_manager import _prepare_command
from api.services.mflux_cli import _generic_output_path, _output_path


def app_config(tmp_path: Path, output_format: str = "webp") -> AppConfig:
    return AppConfig.model_validate(
        {
            "paths": {
                "hfHome": "~/.cache/huggingface",
                "modelDir": str(tmp_path / "models"),
                "outputDir": str(tmp_path / "outputs"),
                "loraDir": str(tmp_path / "loras"),
            },
            "generation": {
                "defaultModel": "z-image-turbo",
                "defaultQuantize": 8,
                "defaultSteps": 9,
                "outputFormat": output_format,
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


def command_output_arg(command: list[str]) -> Path:
    output_index = command.index("--output")
    return Path(command[output_index + 1])


@pytest.mark.fast
def test_generation_config_coerces_legacy_output_formats_to_png(tmp_path: Path):
    config = app_config(tmp_path, output_format="jpg")

    assert config.generation.outputFormat == "png"


@pytest.mark.fast
def test_txt2img_output_paths_are_always_png(tmp_path: Path):
    config = app_config(tmp_path, output_format="webp")

    default_output = _output_path(config, Txt2ImgRequest(prompt="x", model="dev"))
    explicit_output = _output_path(
        config,
        Txt2ImgRequest(prompt="x", model="dev", output=str(tmp_path / "requested.webp")),
    )

    assert default_output.suffix == ".png"
    assert explicit_output == tmp_path / "requested.png"


@pytest.mark.fast
def test_generic_output_paths_are_always_png(tmp_path: Path):
    config = app_config(tmp_path, output_format="jpeg")

    default_output = _generic_output_path(config, None, "depth_map")
    explicit_output = _generic_output_path(config, str(tmp_path / "upscaled.jpg"), "upscaled")

    assert default_output.suffix == ".png"
    assert explicit_output == tmp_path / "upscaled.png"


@pytest.mark.fast
@pytest.mark.parametrize(
    ("module", "params"),
    [
        ("txt2img", {"prompt": "x", "model": "dev"}),
        ("img2img", {"prompt": "x", "model": "dev", "imagePath": "source.png"}),
        ("flux2_edit", {"prompt": "x", "model": "flux2-klein-4b", "imagePaths": ["source.png"]}),
        ("fibo_edit", {"prompt": "add glasses", "model": "fibo-edit", "imagePath": "source.png"}),
        ("inpaint", {"prompt": "x", "model": "dev-fill", "imagePath": "source.png", "maskedImagePath": "mask.png"}),
        ("kontext", {"prompt": "x", "model": "dev-kontext", "imagePath": "source.png"}),
        ("controlnet", {"prompt": "x", "model": "dev-controlnet-canny", "controlnetImagePath": "control.png"}),
        ("upscaler", {"imagePath": "source.png", "model": "seedvr2-3b"}),
        ("depth_pro", {"imagePath": "source.png"}),
    ],
)
def test_prepared_generation_jobs_rewrite_explicit_output_extensions_to_png(
    tmp_path: Path,
    module: str,
    params: dict[str, object],
):
    config = app_config(tmp_path, output_format="webp")
    output_path = tmp_path / f"{module}.webp"
    prepared = _prepare_command(module, {**params, "output": str(output_path)}, config)

    assert Path(prepared.output_path) == tmp_path / f"{module}.png"
    assert command_output_arg(prepared.command) == tmp_path / f"{module}.png"
