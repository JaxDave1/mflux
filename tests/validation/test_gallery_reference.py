from __future__ import annotations

from urllib.parse import parse_qs, urlparse

GALLERY_MODEL_TO_SLUG = {
    "tongyi-mai/z-image-turbo": "z-image-turbo",
    "black-forest-labs/flux.1-dev": "dev",
    "qwen/qwen-image-edit-2509": "qwen-image-edit",
}


def normalize_gallery_model(raw: str | None) -> str | None:
    if not raw:
        return None
    normalized = raw.strip().lower()
    if normalized in GALLERY_MODEL_TO_SLUG:
        return GALLERY_MODEL_TO_SLUG[normalized]
    tail = normalized.split("/")[-1]
    return GALLERY_MODEL_TO_SLUG.get(tail)


def build_gallery_reference_route(
    route: str,
    *,
    path: str,
    prompt: str | None = None,
    width: int | None = None,
    height: int | None = None,
    model: str | None = None,
) -> str:
    params: list[tuple[str, str]] = [("ref", path)]
    if prompt and prompt.strip():
        key = "sourcePrompt" if route == "/img2img" else "prompt"
        params.append((key, prompt.strip()))
    if width and width > 0:
        params.append(("width", str(width)))
    if height and height > 0:
        params.append(("height", str(height)))
    if model and model != "unknown":
        params.append(("model", model))
    query = "&".join(f"{key}={value.replace(' ', '%20')}" for key, value in params)
    return f"{route}?{query}"


def parse_gallery_reference(query: str) -> dict | None:
    params = parse_qs(query, keep_blank_values=True)
    ref = (params.get("ref") or [""])[0].strip()
    if not ref:
        return None
    prompt = (params.get("prompt") or [""])[0].strip() or None
    source_prompt = (params.get("sourcePrompt") or [""])[0].strip() or None
    model_raw = (params.get("model") or [""])[0].strip() or None
    width_raw = (params.get("width") or [""])[0].strip()
    height_raw = (params.get("height") or [""])[0].strip()
    return {
        "path": ref,
        "prompt": prompt,
        "sourcePrompt": source_prompt,
        "width": int(width_raw) if width_raw.isdigit() else None,
        "height": int(height_raw) if height_raw.isdigit() else None,
        "model": normalize_gallery_model(model_raw),
    }


def test_img2img_route_uses_source_prompt_not_prompt_field():
    route = build_gallery_reference_route(
        "/img2img",
        path="/tmp/output.png",
        prompt="original gallery prompt",
        width=1024,
        height=768,
        model="Tongyi-MAI/Z-Image-Turbo",
    )
    parsed = urlparse(route)
    reference = parse_gallery_reference(parsed.query)
    assert reference is not None
    assert reference["path"] == "/tmp/output.png"
    assert reference["sourcePrompt"] == "original gallery prompt"
    assert reference["prompt"] is None
    assert reference["width"] == 1024
    assert reference["height"] == 768
    assert reference["model"] == "z-image-turbo"
    assert "sourcePrompt=" in route
    assert "prompt=" not in route


def test_txt2img_route_uses_prompt_field():
    route = build_gallery_reference_route(
        "/txt2img",
        path="/tmp/output.png",
        prompt="seed prompt",
        model="black-forest-labs/FLUX.1-dev",
    )
    reference = parse_gallery_reference(urlparse(route).query)
    assert reference is not None
    assert reference["prompt"] == "seed prompt"
    assert reference["sourcePrompt"] is None
    assert reference["model"] == "dev"


def test_model_slug_normalization_from_output_filename():
    model = normalize_gallery_model("mflux_z-image-turbo_20260624_123746")
    assert model is None
    assert normalize_gallery_model("Tongyi-MAI/Z-Image-Turbo") == "z-image-turbo"