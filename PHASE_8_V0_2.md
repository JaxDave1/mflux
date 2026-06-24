# Phase 8 — V0.2 FUNCTIONAL EXPANSION

**Work order for Codex.** Builds on v0.1 sign-off (2026-06-24).

**Status:** Complete (2026-06-24)
**Depends on:** Phases 1–7 complete, v0.1 validation 23/23 PASS

---

## 0. Scope

Four v0.2 work packages deferred from v0.1:

| Package | Features | Priority |
|---|---|---|
| **8A Gallery** | Favorites, multi-select bulk ops, metadata sidecar viewer | P1 — start here |
| **8B Generation parity** | LoRA stack on Img2Img/Inpaint/Kontext/ControlNet; live-preview toggle UI on all generation tabs | P2 |
| **8C Models cache** | Delete builtin from HF/mflux cache; CivitAI model/LoRA download jobs | P3 |
| **8D Export** | `mflux-save` quantized export from Models (optional if timeboxed) | P4 |

---

## 8A — Gallery v0.2

### 8A.1 Favorites

- [x] Persist favorite output IDs in `localStorage` (`mflux.gallery.favorites`)
- [x] `FAVORITES` filter chip on Gallery index
- [x] Toggle on Output Details panel; star badge on favorited tiles
- [x] Prune favorites when outputs are deleted

### 8A.2 Multi-select

- [x] Shift/cmd-click or checkbox mode on `ImageGrid`
- [x] Bulk actions: delete selected, reveal first in Finder
- [x] Selection count in panel header

### 8A.3 Metadata viewer

- [x] Collapsible JSON sidecar panel in Output Details when `.json` sidecar exists
- [x] Pretty-print with copy button

---

## 8B — Generation parity

### 8B.1 LoRA stack rollout

- [x] Reuse `LoRAStack` + compatibility notice from Txt2Img on Img2Img, Inpaint, Kontext, ControlNet
- [x] Wire `loraPaths` / `loraScales` in job params (API already accepts on those modules)
- [x] Shared `useModuleLoraStack` hook + `LoraModelNotice` component

### 8B.2 Live preview UI

- [x] Show live-preview toggle on all generation modules (mirror Txt2Img)
- [x] Shared `useModuleLivePreviewSetting` hook + `LivePreviewField` component
- [x] Backend: extend `job_manager` stepwise wiring to img2img, inpaint, kontext, controlnet
- [x] CLI: `_append_stepwise_args` on all stepwise-capable generation commands

---

## 8C — Models cache management

### 8C.1 Delete from cache

- [x] `DELETE /api/models/cache/{id}` with path safety (HF hub + mflux cache roots only)
- [x] Delete button on cached builtin cards with confirmation modal

### 8C.2 CivitAI download

- [x] `civitai_download` job module; token from vault (`civitai` key)
- [x] Download URL / model version ID input on Models page (custom + LoRA sections)

---

## 8D — Quantized export (optional)

- [x] `model_export` job wrapping `mflux-save` for cached builtins
- [x] Export button on cached exportable built-in cards; quantize setting in Models sidebar

---

## Sign-off criteria

1. All 8A checklist items pass with `npm run build` + gallery smoke tests.
2. LoRA stack submits successfully from at least Img2Img and ControlNet.
3. Cache delete removes HF snapshot dir and Models card shows not-downloaded.
4. CivitAI download E2E with vault token (or documented SKIP if no test asset).
5. `CLI_CAPABILITY_MATRIX.md` v0.2 section updated.

### Sign-off run (2026-06-24)

| Suite | Result | Report |
|---|---|---|
| `scripts/v0_2_signoff.py` | **14 PASS / 0 FAIL / 0 SKIP** | `scripts/v0_2_signoff_results.json` |
| `scripts/smoke_test_neural_interface.py` | **32 PASS / 0 FAIL / 0 SKIP** | `scripts/smoke_test_results.json` |
| `scripts/validation_pass.py` | **22 PASS / 0 FAIL / 0 SKIP** | `scripts/validation_pass_results.json` |

v0.2-specific highlights from `v0_2_signoff.py`:
- Gallery sidecar read + delete
- Img2Img / ControlNet LoRA job acceptance
- Img2Img live-preview stepwise dir
- Cache delete round-trip (`z-image-turbo` → `cached=false`)
- CivitAI download job accepted (vault token present; job cancelled after accept)
- `model_export` dispatches `mflux.models.common.cli.save`

**Note:** Sign-off cache-delete tests remove HF hub dirs for `flux2-klein-4b` and `z-image-turbo`. Re-download from Models if those cards show NOT CACHED.

**Phase owner:** David Hendricks
**Drafted:** 2026-06-24