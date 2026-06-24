# Per-model generation defaults. Sourced from MFLUX README §"Full list of
# Command-Line Arguments" and per-model sections. If a model's defaults change
# upstream, update this table and bump the schema version.
#
# Schema version: 1
# Sourced: MFLUX README, captured 2026-05-04
MODEL_DEFAULTS: dict[str, dict[str, int | float | bool | str | None]] = {
    "schnell": {"steps": 2, "guidance": None, "quantize": 8, "scheduler": "linear", "supports_negative_prompt": False},
    "dev": {"steps": 25, "guidance": 3.5, "quantize": 8, "scheduler": "linear", "supports_negative_prompt": False},
    "krea-dev": {"steps": 25, "guidance": 3.5, "quantize": 8, "scheduler": "linear", "supports_negative_prompt": False},
    "z-image": {"steps": 30, "guidance": 3.5, "quantize": 8, "scheduler": "flow_match_euler_discrete", "supports_negative_prompt": True},
    "z-image-turbo": {"steps": 9, "guidance": 0.0, "quantize": 8, "scheduler": "linear", "supports_negative_prompt": False},
    "qwen-image": {"steps": 30, "guidance": 3.5, "quantize": 8, "scheduler": "linear", "supports_negative_prompt": True},
    "qwen-image-edit": {"steps": 30, "guidance": 2.5, "quantize": 8, "scheduler": "linear", "supports_negative_prompt": True},
    "fibo": {"steps": 20, "guidance": 4.0, "quantize": 8, "scheduler": "flow_match_euler_discrete", "supports_negative_prompt": False},
    "dev-kontext": {"steps": 20, "guidance": 2.5, "quantize": 8, "scheduler": "linear", "supports_negative_prompt": False},
    "fill-dev": {"steps": 25, "guidance": 30.0, "quantize": 8, "scheduler": "linear", "supports_negative_prompt": False},
    "depth-dev": {"steps": 20, "guidance": 3.5, "quantize": 8, "scheduler": "linear", "supports_negative_prompt": False},
    "controlnet-dev": {"steps": 20, "guidance": 3.5, "quantize": 8, "scheduler": "linear", "supports_negative_prompt": False},
    "flux2-klein-4b": {"steps": 4, "guidance": None, "quantize": 8, "scheduler": "flow_match_euler_discrete", "supports_negative_prompt": False},
    "flux2-klein-9b": {"steps": 4, "guidance": None, "quantize": 8, "scheduler": "flow_match_euler_discrete", "supports_negative_prompt": False},
    "flux2-klein-base-4b": {"steps": 50, "guidance": 1.0, "quantize": 8, "scheduler": "flow_match_euler_discrete", "supports_negative_prompt": False},
    "flux2-klein-base-9b": {"steps": 50, "guidance": 1.0, "quantize": 8, "scheduler": "flow_match_euler_discrete", "supports_negative_prompt": False},
}

MODEL_ALIASES = {
    "dev-fill": "fill-dev",
    "dev-depth": "depth-dev",
    "dev-controlnet-canny": "controlnet-dev",
    "schnell-controlnet-canny": "controlnet-dev",
}

MODULE_DEFAULT_MODEL: dict[str, str] = {
    "txt2img": "z-image-turbo",
    "img2img": "z-image-turbo",
    "inpaint": "fill-dev",
    "controlnet": "controlnet-dev",
    "kontext": "dev-kontext",
    "upscaler": "seedvr2-3b",
    "depth_pro": "depth-pro",
}

SPECIAL_MODULE_DEFAULTS: dict[str, dict[str, int | float | bool | str | None]] = {
    "upscaler": {"steps": None, "guidance": None, "quantize": 8, "scheduler": "seedvr2_euler", "supports_negative_prompt": False},
    "depth_pro": {"steps": None, "guidance": None, "quantize": 8, "scheduler": "linear", "supports_negative_prompt": False},
}


def canonical_model_name(name: str) -> str:
    return MODEL_ALIASES.get(name, name)


def model_defaults(name: str) -> dict[str, int | float | bool | str | None] | None:
    return MODEL_DEFAULTS.get(canonical_model_name(name))


def module_defaults(module: str) -> dict[str, int | float | bool | str | None] | None:
    model = MODULE_DEFAULT_MODEL.get(module)
    if model is None:
        return None
    defaults = model_defaults(model) or SPECIAL_MODULE_DEFAULTS.get(module)
    if defaults is None:
        return None
    return {"model": model, **defaults, "width": 1024, "height": 1024}
