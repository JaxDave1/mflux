# Grok Agent Notes — MFLUX Neural Interface

Living reference for AI agents working on this repo. Updated 2026-06-30 after post-v0.4 navigation state hardening.

---

## 1. Project snapshot

| Item | Value |
|---|---|
| **Repo path** | `/Volumes/AI_HQ/Codex_and_Stitch_MFLUX_UI/mflux/` |
| **Branch** | `codex/workspace-cleanup-snapshot` |
| **Latest tag** | `neural-interface-v0.4` |
| **Latest validated phase** | Phase 11 — PNG output + gallery multi-delete UX |
| **Latest local hardening** | Gallery batch delete API + filtered bulk selection + bulk-action guardrails + section state retention |
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

### Post-v0.4 local hardening
- **Gallery API:** `DELETE /api/gallery` accepts `ids[]` and returns per-item `deleted` / `failed` results; single-item delete remains compatible.
- **Gallery UI:** bulk delete toolbar now uses one batch API request while preserving existing pagination, selection, favorite, and partial-failure behavior.
- **Gallery selection:** SELECT ALL FILTERED opens a neutral confirmation modal, then selects every output matching the current filter/search across pages.
- **Gallery guardrails:** per-tile delete buttons are hidden while multiple outputs are selected, so bulk-delete state cannot be confused with single-tile delete.
- **Navigation state:** generation controls, LoRA stacks, Gallery filter/search/page, and Models controls stay in memory while moving between sections.
- **Validation:** browser bulk-delete smoke plus API smoke cover batch deletion; API smoke now cancels the generation job before checking SSE so the stream returns from a terminal state.

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
| Validation | `scripts/validation_pass.py`, `scripts/v0_2_signoff.py`, `scripts/smoke_test_neural_interface.py`, `scripts/gallery_bulk_delete_browser_smoke.mjs` |
| Ops | `NEURAL_INTERFACE_RUNBOOK.md` |
| Phase orders | `PHASE_8_V0_2.md` … `PHASE_11_V0_4.md` |

---

## 4. Validation state (2026-06-30)

| Suite | Result | Artifact |
|---|---|---|
| `validation_pass.py` | 32 / 0 / 0 | `scripts/validation_pass_results.json` |
| `v0_2_signoff.py` | 15 / 0 / 0 | `scripts/v0_2_signoff_results.json` |
| `smoke_test_neural_interface.py` | 34 / 0 / 0 | `scripts/smoke_test_results.json` |
| `gallery_bulk_delete_browser_smoke.mjs` | PASS | Browser smoke: filtered 2 synthetic outputs, SELECT ALL FILTERED, hidden tile delete controls, confirmed delete, files removed |
| `navigation_state_browser_smoke.mjs` | PASS | Browser smoke: Txt2Img prompt and Gallery search survived client-side route changes |
| `npm run build` | PASS | post-v0.4 navigation state hardening |
| `.venv/bin/python -m pytest -q -m fast` | 434 PASS / 79 deselected | Includes PNG output policy and Gallery batch delete coverage |
| `npm run test:unit` | 6 PASS | Gallery selection helper coverage, including filtered selection |

**Sign-off side effect:** `v0_2_signoff.py` deletes HF cache for `z-image-turbo` and `flux2-klein-4b`. Re-download from Models if cards show NOT CACHED.

---

## 5. Git state (2026-06-30)

**Committed:** Phase 11 v0.4 checkpoint, release-doc refresh, Gallery bulk-delete browser smoke, Gallery batch-delete API hardening, filtered selection hardening, bulk-action guardrails, and section state retention are local on `codex/workspace-cleanup-snapshot`.

**Push:** `git push origin codex/workspace-cleanup-snapshot --tags` failed previously (no GitHub credentials in agent environment). User must push manually.

---

## 6. Agent conventions

- Read surrounding code before editing; match existing patterns.
- Neural Interface changes live under `api/` and `ui/` — avoid unrelated upstream MFLUX refactors.
- Run `npm run build` after UI changes; run validation scripts before tagging.
- Phase docs use checkboxes — mark complete when done and update `CHANGELOG.md`.
- User rules: execute commands yourself; do not only instruct the user.

---

## 7. Recommendations

### High priority

1. **Push local work** — Push `codex/workspace-cleanup-snapshot` and `neural-interface-v0.4` when GitHub credentials are available.

### Medium priority

2. **README neural interface section** — Upstream `README.md` has no Neural Interface pointer; add short section linking to runbook.

### Low priority / corrections

3. **`flux2-klein-4b` txt2img E2E** — Latest validation registry shows 4 txt2img models (klein may be uncached after sign-off cache delete); document or restore cache before full 5-model run.
4. **CivitAI token** — Stored in vault (`civitai` key); never log or commit.
5. **Bulk delete failure UX** — Partial failures show the first error message only; consider listing all failed paths.

---

## 8. Quick commands

```bash
cd /Volumes/AI_HQ/Codex_and_Stitch_MFLUX_UI/mflux
./scripts/dev.sh

.venv/bin/python scripts/validation_pass.py
.venv/bin/python scripts/smoke_test_neural_interface.py
.venv/bin/python scripts/v0_2_signoff.py
node scripts/gallery_bulk_delete_browser_smoke.mjs
node scripts/navigation_state_browser_smoke.mjs
cd ui && npm run build

git push origin codex/workspace-cleanup-snapshot --tags
```

---

## 9. Related docs

- `NEURAL_INTERFACE_RUNBOOK.md` — start, validate, env vars, troubleshooting
- `CHANGELOG.md` — release history
- `CLI_CAPABILITY_MATRIX.md` — API/UI capability status
- `AGENTS.md` — pointer to Cursor rules + this file
- `PHASE_11_V0_4.md` — latest completed phase spec

---

**Maintainer:** David Hendricks
**Last updated by:** Codex (2026-06-30)
