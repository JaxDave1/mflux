import json
from pathlib import Path
from typing import Any, Literal


ARCH_UNKNOWN = "unknown"
LoraCompat = Literal["compatible", "unknown", "incompatible"]


def parse_metadata_value(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value
    return value


def safetensors_metadata(path: Path) -> dict[str, Any]:
    try:
        with path.open("rb") as handle:
            header_size = int.from_bytes(handle.read(8), "little")
            header = json.loads(handle.read(header_size))
        metadata = header.get("__metadata__", {})
        return metadata if isinstance(metadata, dict) else {}
    except (OSError, json.JSONDecodeError, UnicodeDecodeError, ValueError):
        return {}


def extract_trigger_words(metadata: dict[str, Any]) -> list[str] | None:
    triggers: set[str] = set()
    frequency = parse_metadata_value(metadata.get("ss_tag_frequency"))
    if isinstance(frequency, dict):
        for tag_bucket in frequency.values():
            if isinstance(tag_bucket, dict):
                triggers.update(str(tag).strip() for tag in tag_bucket.keys() if str(tag).strip())

    dataset_dirs = parse_metadata_value(metadata.get("ss_dataset_dirs"))
    if isinstance(dataset_dirs, dict):
        for key in dataset_dirs.keys():
            token = str(key).split(":", 1)[0].strip()
            if token:
                triggers.add(token)
    elif isinstance(dataset_dirs, str):
        for chunk in dataset_dirs.split(","):
            token = chunk.split(":", 1)[0].strip()
            if token:
                triggers.add(token)

    if not triggers:
        return None
    return sorted(triggers)[:20]


def model_lora_architecture(model: str) -> str:
    normalized = model.lower().replace("_", "-")
    if "z-image" in normalized or "zimage" in normalized:
        return "z-image"
    if "qwen" in normalized:
        return "qwen"
    if "fibo" in normalized:
        return "fibo"
    if "flux2" in normalized or "flux.2" in normalized or "klein" in normalized:
        return "flux2"
    if normalized in {
        "dev",
        "schnell",
        "dev-kontext",
        "dev-fill",
        "dev-redux",
        "dev-depth",
        "dev-controlnet-canny",
        "schnell-controlnet-canny",
        "dev-controlnet-upscaler",
        "dev-fill-catvton",
        "krea-dev",
    } or "flux.1" in normalized or "flux1" in normalized:
        return "flux"
    return ARCH_UNKNOWN


def detect_lora_architecture(path: Path, metadata: dict[str, Any] | None = None) -> str:
    metadata = metadata if metadata is not None else safetensors_metadata(path)
    values: list[str] = [path.name, path.stem]
    for key in (
        "ss_base_model",
        "ss_base_model_version",
        "base_model",
        "base_model_version",
        "modelspec.architecture",
        "modelspec.title",
        "modelspec.description",
    ):
        value = parse_metadata_value(metadata.get(key))
        if isinstance(value, str):
            values.append(value)

    haystack = " ".join(values).lower().replace("_", "-")
    if "z-image" in haystack or "zimage" in haystack:
        return "z-image"
    if "qwen" in haystack:
        return "qwen"
    if "fibo" in haystack:
        return "fibo"
    if "flux2" in haystack or "flux.2" in haystack or "klein" in haystack:
        return "flux2"
    if "flux" in haystack:
        return "flux"
    if "sdxl" in haystack or "stable-diffusion-xl" in haystack:
        return "sdxl"
    if "sd15" in haystack or "sd1.5" in haystack or "stable-diffusion-v1" in haystack:
        return "sd15"
    return ARCH_UNKNOWN


def is_lora_compatible(lora_architecture: str, model: str) -> bool:
    return lora_compatibility(lora_architecture, model) == "compatible"


def lora_compatibility(lora_architecture: str, model: str) -> LoraCompat:
    model_architecture = model_lora_architecture(model)
    if lora_architecture == ARCH_UNKNOWN or model_architecture == ARCH_UNKNOWN:
        return "unknown"
    if lora_architecture == model_architecture:
        return "compatible"
    return "incompatible"
