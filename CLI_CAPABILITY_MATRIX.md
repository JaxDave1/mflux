# MFLUX CLI Capability Matrix

## Phase 5 model downloads

Model download jobs use `huggingface_hub.snapshot_download` directly through the `model_download` JobManager module.

Reasoning:
- Downloading is not a generation task, so wrapping `mflux-generate*` would create fake generation work.
- `snapshot_download` uses the Hugging Face cache layout that the Models page already inspects.
- HF token injection remains centralized in JobManager subprocess environment handling.
- Progress is parsed from Hugging Face download output when available, with indeterminate fallback.

## v0.2 cache management (2026-06-24)

- Built-in cache delete: `DELETE /api/models/cache/{id}` removes HF hub `models--*` dirs and MFLUX `depth_pro` cache with root containment checks.
- CivitAI downloads: `civitai_download` job module fetches `model-versions/{id}` and streams the primary `.safetensors` file into the configured LoRA or custom model directory. Token injected from vault (`civitai` key).
- Quantized export: `model_export` job module wraps `mflux-save` (`mflux.models.common.cli.save`) for cached built-in checkpoints. Writes `{modelDir}/{model}_q{quantize}/` with safetensors shards.

## Smoke verification (2026-06-29)

Automated pass: `scripts/smoke_test_neural_interface.py` (34 PASS / 0 FAIL / 0 SKIP).

Results written to `scripts/smoke_test_results.json`. Phase checklists updated in `PHASE_1_FOUNDATION.md` through `PHASE_5_MODELS.md`.

Model download E2E (2026-06-24): FLUX-schnell `model_download` job succeeded (~10 min) with vault HF token; cache status `cached_after=true`. Results in `scripts/model_download_test_results.json`. Follow-on `flux2-klein-4b` download cancelled after sign-off.

## Validation pass (2026-06-24)

Automated script: `scripts/validation_pass.py`  
Unit tests: `tests/validation/test_gallery_reference.py`  
Results: `scripts/validation_pass_results.json`

| Check | Result | Notes |
|---|---|---|
| Gallery reference URL contract | PASS | Img2Img uses `sourcePrompt`; Txt2Img uses `prompt`; model slugs normalize correctly |
| Gallery → Img2Img backend handoff | PASS | Img2Img job accepted and succeeded using a real gallery output path |
| Negative prompt on `z-image` | PASS | Same seed/steps produced different output with a strong negative prompt |
| Negative prompt on `z-image-turbo` | PASS | Distilled turbo forces `guidance=0`; UI hides the field via `supports_negative_prompt=false` |
| Negative prompt on FLUX.1 `dev` / `schnell` | N/A (registry) | CLI accepts `--negative-prompt`, but FLUX txt2img loop does not apply it; keep `supports_negative_prompt=false` |
| Negative prompt on `qwen-image` | EXPECTED | Registry marks `supports_negative_prompt=true`; live A/B not run (model not cached locally) |
| LoRA stack strength variance | PASS | No LoRA vs strength 0.25 vs 1.5 produced three distinct outputs on `z-image-turbo` |
| Live preview stepwise output | PASS | `livePreview=true` wrote PNGs under `/tmp/mflux_stepwise/{job_id}` |

Registry change from validation: `z-image` now exposes `supports_negative_prompt=true` because CFG-guided negatives are effective at default `guidance=3.5`.

## v0.1 sign-off (2026-06-24)

Hardening items completed for Neural Interface v0.1:

| Area | Result | Notes |
|---|---|---|
| API-driven model dropdowns | PASS | `useModuleModelOptions` + `lib/moduleModelOptions.ts` on Txt2Img, Img2Img, Inpaint, Kontext, ControlNet, and Config; options sourced from `/api/models` with per-module allowlists and downloaded-first ordering |
| Module model registry | PASS | `validation_pass.py` verifies allowlisted builtin IDs exist in `/api/models` |
| Cached module E2E jobs | PASS | 32/32 checks in `scripts/validation_pass_results.json` (2026-06-29): txt2img/img2img/inpaint/kontext/controlnet smokes + CivitAI/export E2E |
| FLUX.2 Klein distilled guidance | PASS | `flux2-klein-4b` / `flux2-klein-9b` omit `--guidance` in CLI build; registry `guidance=null` |
| UI build | PASS | `npm run build` in `ui/` |

Completed in v0.2: CivitAI download, cache delete, quantized export, gallery favorites/multi-select, LoRA stack and live-preview toggle on all generation modules.

**v0.3:** Dashboard runtime truth, job cancel fixes, gallery pagination on delete, CivitAI/export validation E2E.

**v0.4 (Phase 11):** PNG-only generation outputs; gallery always-on checkboxes + SELECT PAGE bulk delete. Post-v0.4 local hardening adds the batch Gallery delete API, SELECT ALL FILTERED, and browser smoke. See `PHASE_11_V0_4.md` and `GROK_AGENT_NOTES.md`.
