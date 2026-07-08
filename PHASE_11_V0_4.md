# Phase 11 — V0.4 OUTPUT & GALLERY UX

**Work order for Grok/Codex.** Builds on v0.3 sign-off (`neural-interface-v0.3`).

**Status:** Complete and validated (2026-06-29)
**Depends on:** Phase 10 complete
**Tag:** `neural-interface-v0.4`

---

## 0. Scope

| Package | Features | Priority |
|---|---|---|
| **11A PNG output** | Force all generation outputs to PNG | P1 |
| **11B Gallery multi-delete UX** | Always-on checkboxes, SELECT PAGE, bulk delete discoverability | P1 |

---

## 11A — PNG output enforcement

- [x] `_output_path()` always writes `.png` filenames (ignores `config.generation.outputFormat`)
- [x] `_generic_output_path()` rewrites user paths with non-PNG extensions to `.png`
- [x] `GenerationConfig.outputFormat` schema: `Literal["png"]` with `before` validator coercion
- [x] Config UI: removed OUTPUT FORMAT toggle chip
- [x] `ui/src/lib/types.ts`: `outputFormat` typed as `"png"`

**Files:** `api/services/mflux_cli.py`, `api/schemas/requests.py`, `ui/src/pages/Config.tsx`, `ui/src/lib/types.ts`

**Note:** Gallery and upload endpoints still accept `.jpg`/`.webp` as *inputs*. Only *outputs* are forced to PNG.

**Automated coverage:** `tests/test_png_output_policy.py` verifies config coercion, output path normalization, and prepared command output arguments across txt2img, img2img, inpaint, kontext, controlnet, upscaler, and depth_pro.

---

## 11B — Gallery multi-select UX

Original v0.2 multi-select existed but required BROWSE→SELECT mode or modifier-key clicks. This phase makes bulk delete obvious.

- [x] Checkboxes always visible on `ImageGrid` tiles (top-left)
- [x] Removed BROWSE / SELECT mode toggle from Gallery index
- [x] Normal tile click: detail preview only; preserves bulk `selectedIds`
- [x] Shift-click / cmd-click: range / toggle bulk selection (unchanged)
- [x] **SELECT PAGE** toolbar button
- [x] Bulk toolbar when `selectedIds.size > 0`: DELETE SELECTED, REVEAL FIRST, CLEAR
- [x] Output Details delete button respects multi-selection (`DELETE N SELECTED`)

**Files:** `ui/src/pages/Gallery.tsx`, `ui/src/components/ImageGrid.tsx`

**Automated coverage:** `ui/tests/gallerySelection.test.mjs` verifies page selection, full-gallery selected item counting, range selection, toggle immutability, and first selected reveal ordering.

**Follow-on:** Phase 12 (`PHASE_12_V0_5.md`) — batch gallery delete API, SELECT ALL FILTERED, nav state; tag `neural-interface-v0.5`.

---

## Sign-off

| Suite | Last known | Report |
|---|---|---|
| `scripts/validation_pass.py` | **32 PASS / 0 FAIL / 0 SKIP** (2026-06-29) | `scripts/validation_pass_results.json` |
| `scripts/smoke_test_neural_interface.py` | **34 PASS / 0 FAIL / 0 SKIP** (2026-06-29) | `scripts/smoke_test_results.json` |
| `scripts/v0_2_signoff.py` | **15 PASS / 0 FAIL / 0 SKIP** (2026-06-29) | `scripts/v0_2_signoff_results.json` |
| `.venv/bin/python -m pytest -q -m fast` | **434 PASS / 79 deselected** | Local fast suite |
| `ui && npm run test:unit` | **6 PASS** | Gallery selection helpers |
| `ui && npm run build` | **PASS** (post-v0.4 filtered selection hardening) | — |

**Release note:** `v0_2_signoff.py` cache-delete checks remove the local `z-image-turbo` cache. Re-download from Models if that card shows NOT CACHED after sign-off.

---

**Phase owner:** David Hendricks
**Drafted:** 2026-06-24 (Grok session)
**Validated:** 2026-06-29 (Codex)
