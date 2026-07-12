# Grok Agent Notes — MFLUX Neural Interface

Living reference for AI agents working on this repo. Updated 2026-07-12 for `neural-interface-v0.7` release.

---

## 1. Project snapshot

| Item | Value |
|---|---|
| **Repo path** | `/Volumes/AI_HQ/Codex_and_Stitch_MFLUX_UI/mflux/` |
| **Branch** | `codex/workspace-cleanup-snapshot` |
| **Latest tag** | `neural-interface-v0.7` |
| **Latest validated phase** | Phase 14 — FIBO Edit + design sign-off + validation hardening |
| **UI** | `http://127.0.0.1:4173/` |
| **API** | `http://127.0.0.1:8189/` |
| **Start** | `./scripts/dev.sh` |

This fork layers a **Neural Interface** (FastAPI + React/Vite) on upstream MFLUX. Phase docs (`PHASE_*.md`) are the authoritative work orders; `CHANGELOG.md` tracks release notes.

---

## 2. Completed work (chronological)

### v0.1 — Foundation
- Gallery previews via `/api/gallery/file` URLs
- API-driven model pickers (`/api/models`, per-module allowlists)
- FLUX.2 Klein distilled guidance omission in CLI

### v0.2 — `neural-interface-v0.2` (Phase 8)
- **Gallery:** favorites, multi-select (modifier keys + SELECT mode), metadata sidecar viewer, pagination
- **Generation:** LoRA stack on img2img/inpaint/kontext/controlnet; live preview on all modules
- **Models:** cache delete, CivitAI download jobs, quantized `mflux-save` export
- **UX:** model-aware schedulers, quantize limited to 8/OFF

### v0.3 — `neural-interface-v0.3` (Phases 9–10)
- Dashboard runtime truth (2s polling, MLX Runtime RSS vs Model Disk Cache)
- Validation depth: system status, CivitAI E2E, model export E2E
- Gallery delete preserves pagination page
- Job cancel race fix (`_pending_cancel`, `killpg`), JobPanel stale-state fix
- Cancel on RunningStatePreview and Models download/export cards
- `NEURAL_INTERFACE_RUNBOOK.md`, gallery img2img handoff cached-model fallback (`3940960`)

### v0.4 — `neural-interface-v0.4` (Phase 11)
- **PNG output:** all generation outputs forced to `.png`; config format selector removed
- **Gallery UX:** always-visible checkboxes, SELECT PAGE, bulk delete toolbar; removed BROWSE/SELECT toggle

### v0.5 — `neural-interface-v0.5` (Phase 12)
- **Gallery API:** `DELETE /api/gallery` accepts `ids[]` with per-item `deleted` / `failed` results.
- **Gallery UI:** batch delete endpoint, **SELECT ALL FILTERED**, hide per-tile delete during multi-select.
- **Navigation state:** `useStickyState` retains generation/Gallery/Models controls across route changes (not full reload).
- **Validation:** `test_gallery_batch_delete.py`, smoke 34 PASS, browser smokes for bulk delete + nav state.

### v0.6 — `neural-interface-v0.6` (Phase 13)
- **Klein Edit:** `flux2_edit` job module + `/flux2-edit` UI (primary + optional secondary reference images).
- **Models:** Klein 4B/9B/base allowlist; PNG output policy; Gallery handoff.
- **Design audit:** `PHASE_6_7_DESIGN_AUDIT.md` Pass 2 summary.

### v0.7 — `neural-interface-v0.7` (Phase 14)
- **FIBO Edit:** `fibo_edit` job module + `/fibo-edit` UI (mask, RMBG matte export).
- **Design sign-off:** `PHASE_6_7_SIGNOFF.md`, `LONG_RUNNING_JOB_UX.md`, `SurfaceLoadingState`, `design_signoff.py`.
- **Validation:** edit-module E2E hooks in `validation_pass.py`; gallery partial-delete error listing; README section.

---

## 3. Key file map

| Area | Paths |
|---|---|
| Output paths | `api/services/mflux_cli.py` (`_output_path`, `_generic_output_path`, `_png_output_path`) |
| Job lifecycle | `api/services/job_manager.py` |
| Config schema | `api/schemas/requests.py`, `api/data/config.json`, `api/services/config_store.py` |
| Gallery API | `api/routers/gallery.py` |
| Gallery UI | `ui/src/pages/Gallery.tsx`, `ui/src/components/ImageGrid.tsx` |
| Gallery selection helpers | `ui/src/lib/gallerySelection.ts` |
| Config UI | `ui/src/pages/Config.tsx` |
| Validation | `scripts/validation_pass.py`, `scripts/v0_2_signoff.py`, `scripts/smoke_test_neural_interface.py`, `scripts/design_signoff.py`, `scripts/gallery_bulk_delete_browser_smoke.mjs` |
| Ops | `NEURAL_INTERFACE_RUNBOOK.md` |
| Klein Edit | `ui/src/pages/Flux2Edit.tsx`, `api/services/mflux_cli.py` (`_flux2_edit_command`) |
| FIBO Edit | `ui/src/pages/FiboEdit.tsx`, `api/services/mflux_cli.py` (`_fibo_edit_command`) |
| Phase orders | `PHASE_8_V0_2.md` … `PHASE_14_V0_7.md` |

---

## 4. Validation state (2026-07-12)

| Suite | Result | Artifact |
|---|---|---|
| `design_signoff.py` | 6 PASS | DESIGN_LOCK guards |
| `validation_pass.py` | 32 PASS / 2 SKIP | `scripts/validation_pass_results.json` |
| `v0_2_signoff.py` | 15 PASS | `scripts/v0_2_signoff_results.json` |
| `smoke_test_neural_interface.py` | 38 PASS | `scripts/smoke_test_results.json` |
| `gallery_bulk_delete_browser_smoke.mjs` | PASS | filtered bulk delete E2E |
| `navigation_state_browser_smoke.mjs` | PASS | sticky state across routes |
| `screenshot_regression.mjs` | PASS | Dashboard + Txt2Img ≤1% pixel diff |
| `npm run build` | PASS | 13 nav modules |
| `npm run test:unit` | 6 PASS | gallery selection helpers |

**Edit E2E:** `flux2_edit` / `fibo_edit` jobs run in `validation_pass.py` when models are cached; otherwise SKIP (not a failure).

**Sign-off side effect:** `v0_2_signoff.py` deletes HF cache for `z-image-turbo` and `flux2-klein-4b`. Re-download from Models if cards show NOT CACHED.

---

## 5. Git state (2026-07-12)

**Branch:** `codex/workspace-cleanup-snapshot` · **Tag:** `neural-interface-v0.7`

**Fork (pushed):** [github.com/JaxDave1/mflux](https://github.com/JaxDave1/mflux) — `git remote fork`

**Upstream:** `filipstrand/mflux` (`origin`) — do not push Neural Interface work here unless intended.

---

## 6. Agent conventions

- Read surrounding code before editing; match existing patterns.
- Neural Interface changes live under `api/` and `ui/` — avoid unrelated upstream MFLUX refactors.
- Run `npm run build` after UI changes; run validation scripts before tagging.
- Phase docs use checkboxes — mark complete when done and update `CHANGELOG.md`.
- User rules: execute commands yourself; do not only instruct the user.

---

## 7. Recommendations

### Low priority

2. **`flux2-klein-4b` / `fibo-edit` cache** — Re-download for live edit E2E when validation shows SKIP.
3. **CivitAI token** — Stored in vault (`civitai` key); never log or commit.
4. **`quality` config field** — Legacy PNG-only path; schema retains field for compat, unused in generation.

---

## 8. Quick commands

```bash
cd /Volumes/AI_HQ/Codex_and_Stitch_MFLUX_UI/mflux
./scripts/dev.sh

.venv/bin/python scripts/validation_pass.py
.venv/bin/python scripts/smoke_test_neural_interface.py
.venv/bin/python scripts/v0_2_signoff.py
.venv/bin/python scripts/design_signoff.py
node scripts/gallery_bulk_delete_browser_smoke.mjs
node scripts/navigation_state_browser_smoke.mjs
node scripts/screenshot_regression.mjs
cd ui && npm run build

git push fork codex/workspace-cleanup-snapshot --tags
```

---

## 9. Related docs

- `NEURAL_INTERFACE_RUNBOOK.md` — start, validate, env vars, troubleshooting
- `CHANGELOG.md` — release history
- `CLI_CAPABILITY_MATRIX.md` — API/UI capability status
- `README.md` — Neural Interface quick start
- `PHASE_14_V0_7.md` — latest completed phase spec
- `PHASE_6_7_SIGNOFF.md` — design owner sign-off
- `LONG_RUNNING_JOB_UX.md` — job UX contract

---

**Maintainer:** David Hendricks
**Last updated by:** Grok (2026-07-12)