# Phase 12 — V0.5 GALLERY HARDENING & NAV STATE

**Work order for Grok/Codex.** Builds on v0.4 sign-off (`neural-interface-v0.4`).

**Status:** Complete (2026-06-24)
**Depends on:** Phase 11 complete
**Tag:** `neural-interface-v0.5`

---

## 0. Scope

| Package | Features | Priority |
|---|---|---|
| **12A Gallery batch API** | `DELETE /api/gallery` with `ids[]` | P1 |
| **12B Gallery UX** | SELECT ALL FILTERED, bulk-delete guardrails | P1 |
| **12C Navigation state** | `useStickyState` across modules | P2 |
| **12D Validation** | pytest, API smoke, browser smokes | P2 |

---

## 12A — Gallery batch delete API

- [x] `DELETE /api/gallery` accepts JSON body `{ "ids": string[] }`
- [x] Per-item `deleted` / `failed` results; single-item `DELETE /api/gallery/{id}` unchanged
- [x] Path safety and sidecar cleanup match single-delete behavior
- [x] `tests/test_gallery_batch_delete.py` — success + partial failure cases

**Files:** `api/routers/gallery.py`, `ui/src/lib/api.ts`, `tests/test_gallery_batch_delete.py`

---

## 12B — Gallery UX hardening

- [x] Bulk delete UI uses one batch API request (not per-item loop)
- [x] **SELECT ALL FILTERED** with confirmation modal (cross-page selection)
- [x] Per-tile delete hidden when `selectedIds.size > 1`
- [x] `gallery_bulk_delete_browser_smoke.mjs` — filtered selection + batch delete E2E

**Files:** `ui/src/pages/Gallery.tsx`, `ui/src/components/ImageGrid.tsx`, `ui/src/lib/gallerySelection.ts`

---

## 12C — Section state retention

- [x] `useStickyState` hook — in-memory Map survives client-side route changes
- [x] Generation prompts/controls, LoRA stacks, Gallery filter/search/page, Models controls
- [x] `navigation_state_browser_smoke.mjs` — Txt2Img prompt + Gallery search survive navigation

**Files:** `ui/src/hooks/useStickyState.ts`, module pages, `Gallery.tsx`, `Models.tsx`

**Note:** State does not survive full browser reload (by design).

---

## 12D — Validation extensions

- [x] `smoke_test_neural_interface.py` — batch delete + SSE ordering fix (34 PASS)
- [x] Browser smokes documented in `NEURAL_INTERFACE_RUNBOOK.md`

---

## Sign-off

| Suite | Result | Report |
|---|---|---|
| `scripts/smoke_test_neural_interface.py` | **34 PASS / 0 FAIL / 0 SKIP** | `scripts/smoke_test_results.json` |
| `gallery_bulk_delete_browser_smoke.mjs` | PASS | — |
| `navigation_state_browser_smoke.mjs` | PASS | — |
| `tests/test_gallery_batch_delete.py` | PASS | pytest fast suite |

---

**Follow-on:** Phase 13 (`PHASE_13_V0_6.md`) — FLUX.2 Klein Edit module, design audit; tag `neural-interface-v0.6`.

---

**Phase owner:** David Hendricks
**Drafted:** 2026-06-24