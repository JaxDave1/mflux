# Phase 1 — FOUNDATION

**Work order for Codex.** Self-contained. Implement against this spec in one pass.

**Status:** Complete (smoke verified 2026-06-24)
**Depends on:** Nothing (this is the foundation)
**Unblocks:** All subsequent phases

---

## 0. Scope

Two foundational systems that everything downstream depends on:

1. **API Keys / Tokens vault** — secure storage + UI for HF and CivitAI tokens
2. **Per-model defaults registry** — per-model values for steps, guidance, quantize that override global Config defaults when a model is selected

Neither system is user-facing in interesting ways yet. They exist so Phases 2–9 can consume them without inventing storage shapes mid-implementation.

---

## 1. API Keys / Tokens vault

### 1.1 Storage

Tokens persist to a `.env`-style file at `~/Library/Application Support/MFLUX-NeuralInterface/secrets.env`. Format:

```
MFLUX_HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx
MFLUX_CIVITAI_TOKEN=xxxxxxxxxxxxxxxxxx
```

File is created with mode `0600` (owner read/write only). Directory created with mode `0700`. Codex MUST verify these permissions are applied on write — exposed tokens are a real risk.

Tokens loaded into process env at API startup so MFLUX subprocess inherits them. `HF_TOKEN` is the standard env var Hugging Face libraries read; map `MFLUX_HF_TOKEN` → `HF_TOKEN` at subprocess spawn time.

### 1.2 Backend

New service: `api/services/secrets.py`

```python
class SecretsManager:
    def __init__(self): ...
    def get(self, key: str) -> str | None: ...
    def set(self, key: str, value: str) -> None: ...
    def clear(self, key: str) -> None: ...
    def list_keys(self) -> list[str]: ...   # returns key names only, never values
    def is_set(self, key: str) -> bool: ...
```

Singleton pattern, instantiated once at app startup.

New endpoints in `api/routers/config.py` (or new `api/routers/secrets.py` — your call):

- `GET /api/secrets` — returns `{ "ok": true, "data": { "tokens": [{"key": "hf", "is_set": true}, {"key": "civitai", "is_set": false}] } }`. **Never returns token values, only set/unset status.**
- `PUT /api/secrets/{key}` — body `{"value": "..."}`. Sets a token. Returns `{"ok": true}`.
- `DELETE /api/secrets/{key}` — clears a token. Returns `{"ok": true}`.

Supported keys for v0.1: `hf`, `civitai`. Reject other keys with 400.

### 1.3 Frontend

New section in `Config.tsx`: **"API KEYS & TOKENS"**, placed between existing "PATHS" and "GENERATION DEFAULTS" sections.

Section contains two rows:

- **HF TOKEN** (Hugging Face) — masked input (shows `••••••••` when set, empty when unset), with two buttons next to it: `SET TOKEN` (opens an input modal) and `CLEAR` (disabled when unset)
- **CIVITAI TOKEN** — same pattern

Set-token modal: simple text input, "Save" / "Cancel". Submitted value is sent via `PUT /api/secrets/{key}`. On success, modal closes and the masked input shows `••••••••`.

Status sidebar (right column of Config) gains a line in DEPENDENCIES: "HF token required for gated FLUX models. CivitAI token required for CivitAI LoRA downloads."

### 1.4 Subprocess inheritance

In `api/services/job_manager.py`, when spawning a subprocess, inject tokens from the SecretsManager into the subprocess env:

```python
env = os.environ.copy()
if (hf := secrets.get("hf")) is not None:
    env["HF_TOKEN"] = hf
    env["HUGGING_FACE_HUB_TOKEN"] = hf  # both vars seen in the wild
# CivitAI token consumed only by Phase 5 download flow, not generic subprocesses
subprocess.Popen(cmd, env=env, ...)
```

---

## 2. Per-model defaults registry

### 2.1 The values

Sourced from MFLUX README. Registry is a static Python dict in `api/services/model_defaults.py`:

```python
# Per-model generation defaults. Sourced from MFLUX README §"📜 Full list of
# Command-Line Arguments" and per-model sections. If a model's defaults change
# upstream, update this table and bump the schema version.
#
# Schema version: 1
# Sourced: MFLUX README, captured 2026-05-04
MODEL_DEFAULTS: dict[str, dict] = {
    "schnell":         {"steps": 2,  "guidance": None, "quantize": 8},
    "dev":             {"steps": 25, "guidance": 3.5,  "quantize": 8},
    "krea-dev":        {"steps": 25, "guidance": 3.5,  "quantize": 8},
    "z-image-turbo":   {"steps": 9,  "guidance": 0.0,  "quantize": 8},
    "qwen-image":      {"steps": 30, "guidance": 3.5,  "quantize": 8},
    "qwen-image-edit": {"steps": 30, "guidance": 2.5,  "quantize": 8},
    "fibo":            {"steps": 20, "guidance": 4.0,  "quantize": 8},
    "dev-kontext":     {"steps": 20, "guidance": 2.5,  "quantize": 8},
    "fill-dev":        {"steps": 25, "guidance": 30.0, "quantize": 8},  # Inpaint
    "depth-dev":       {"steps": 20, "guidance": 3.5,  "quantize": 8},
    "controlnet-dev":  {"steps": 20, "guidance": 3.5,  "quantize": 8},
}

# Module → default model mapping. When a module loads with no model selected,
# use the model named here.
MODULE_DEFAULT_MODEL: dict[str, str] = {
    "txt2img":    "z-image-turbo",  # current default per live UI
    "img2img":    "z-image-turbo",
    "inpaint":    "fill-dev",
    "controlnet": "controlnet-dev",
    "kontext":    "dev-kontext",
    "upscaler":   "seedvr2-3b",     # not in MODEL_DEFAULTS — special case
    "depth_pro":  "depth-pro",      # not in MODEL_DEFAULTS — special case
}
```

`None` for guidance means the model doesn't use guidance (e.g., Schnell). Frontend hides the Guidance slider when `guidance` is `None`.

### 2.2 Backend

New endpoints in `api/routers/models.py`:

- `GET /api/models/{name}/defaults` — returns `{"ok": true, "data": {"steps": 25, "guidance": 3.5, "quantize": 8}}` or 404 if model unknown
- `GET /api/modules/{module}/defaults` — returns `{"ok": true, "data": {"model": "z-image-turbo", "steps": 9, "guidance": 0.0, "quantize": 8, "width": 1024, "height": 1024}}`

Width/height defaults are constant 1024×1024 across all modules (per MFLUX README and your spec). Codex hardcodes these in the response payload.

### 2.3 Frontend integration (light touch in Phase 1)

In Phase 1, only the API endpoints and registry land. Frontend consumption happens in Phase 3 (Module 1) and Phase 7 (other modules). Phase 1 does NOT modify any module page's form behavior.

EXCEPTION: `Config.tsx`'s "Default Steps" and "Default Quantize" inputs become **module-scoped** if you want, but for v0.1 leave them as global fallbacks. Per-model defaults take precedence; Config defaults apply only when no model is selected (rare).

---

## 3. Implementation checklist

Each item is testable.

- [x] `~/Library/Application Support/MFLUX-NeuralInterface/` directory created at startup with mode 0700 if missing
- [x] `secrets.env` file created with mode 0600 on first write
- [x] `api/services/secrets.py` — SecretsManager class with get/set/clear/list_keys/is_set
- [x] `api/routers/secrets.py` — three endpoints, never returns token values
- [x] `api/services/job_manager.py` — subprocess env injection on spawn
- [x] `Config.tsx` — new "API KEYS & TOKENS" section with HF and CivitAI rows, masked inputs, set/clear actions
- [x] Set-token modal component
- [x] `api/services/model_defaults.py` — registry as defined in §2.1
- [x] `api/routers/models.py` — `GET /api/models/{name}/defaults` and `GET /api/modules/{module}/defaults`
- [x] Both endpoints return 404 for unknown names
- [x] Verification: `curl http://127.0.0.1:8189/api/modules/txt2img/defaults` returns expected payload
- [x] Verification: setting HF token via PUT, then submitting a gated FLUX-dev job, succeeds where it would have failed without the token *(HF token consumed by `model_download` for FLUX-schnell E2E 2026-06-24; gated FLUX-dev generation job not separately re-run)*
- [x] `secrets.env` permissions verified via `ls -l` after first write — must show `-rw-------`

---

## 4. Sign-off

This phase is complete when:

1. All checklist items pass.
2. HF token can be set in Config UI, persists across backend restart, and is consumed by MFLUX subprocesses.
3. `GET /api/modules/txt2img/defaults` returns Z-Image Turbo's defaults.
4. No token value appears in any logged output, network response, or stack trace under any path.

**Phase owner:** David Hendricks
**Drafted:** 2026-05-04
