# Grok Agent Notes — MFLUX Neural Interface

Living reference for AI agents working on this repo. Updated 2026-06-24 after Phase 11 (PNG output + gallery multi-delete UX).

---

## 1. Project snapshot

| Item | Value |
|---|---|
| **Repo path** | `/Volumes/AI_HQ/Codex_and_Stitch_MFLUX_UI/mflux/` |
| **Branch** | `codex/workspace-cleanup-snapshot` |
| **Latest tag** | `neural-interface-v0.3` (on `3940960`) |
| **Pending tag** | `neural-interface-v0.4` (Phase 11 — uncommitted) |
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

### v0.4 session — Phase 11 (uncommitted)
- **PNG output:** all generation outputs forced to `.png`; config format selector removed
- **Gallery UX:** always-visible checkboxes, SELECT PAGE, bulk delete toolbar; removed BROWSE/SELECT toggle

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
| Validation | `scripts/validation_pass.py`, `scripts/v0_2_signoff.py`, `scripts/smoke_test_neural_interface.py` |
| Ops | `NEURAL_INTERFACE_RUNBOOK.md` |
| Phase orders | `PHASE_8_V0_2.md` … `PHASE_11_V0_4.md` |

---

## 4. Validation state (last full run)

| Suite | Result | Artifact |
|---|---|---|
| `validation_pass.py` | 32 / 0 / 0 | `scripts/validation_pass_results.json` |
| `v0_2_signoff.py` | 15 / 0 / 0 | `scripts/v0_2_signoff_results.json` |
| `smoke_test_neural_interface.py` | 32 / 0 / 0 | `scripts/smoke_test_results.json` |
| `npm run build` | PASS | post–Phase 11 |
| `.venv/bin/python -m pytest -q -m fast` | 432 PASS / 79 deselected | Includes PNG output policy coverage |
| `npm run test:unit` | 5 PASS | Gallery selection helper coverage |

**Caveat:** Live API/UI validation scripts still need a final re-run before the v0.4 tag.

**Sign-off side effect:** `v0_2_signoff.py` deletes HF cache for `z-image-turbo` and `flux2-klein-4b`. Re-download from Models if cards show NOT CACHED.

---

## 5. Git state (2026-06-24)

**Committed:** through `3940960` (`fix(validation): gallery img2img handoff uses cached model fallback`)

**Uncommitted (Phase 11):**
- `api/schemas/requests.py` — PNG-only `outputFormat`
- `api/services/mflux_cli.py` — PNG path normalization
- `ui/src/pages/Config.tsx` — removed format selector
- `ui/src/pages/Gallery.tsx` — gallery multi-select UX
- `ui/src/components/ImageGrid.tsx` — always-on checkboxes
- `ui/src/lib/types.ts` — `outputFormat: "png"`

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

1. **Commit + tag v0.4** — Stage Phase 11, re-run validation, tag `neural-interface-v0.4`, push branch and tags.
2. **Live validation refresh** — Re-run `validation_pass.py`, `v0_2_signoff.py`, and `smoke_test_neural_interface.py` with API + UI servers up.
3. **Gallery bulk-delete E2E** — Smoke test: select 2+ synthetic gallery items, bulk delete, confirm files removed.
4. **Batch delete API** — `DELETE /api/gallery` with `ids[]` body would be faster and atomic vs sequential single deletes from the UI loop.

### Medium priority

5. **SELECT ALL (filtered)** — Extend SELECT PAGE to “select all matching current filter” across pages (with confirmation).
6. **Per-tile hover delete vs bulk** — Hover delete still deletes one item; consider hiding it when `selectedIds.size > 1` to avoid confusion.
7. **README neural interface section** — Upstream `README.md` has no Neural Interface pointer; add short section linking to runbook.

### Low priority / corrections

8. **`flux2-klein-4b` txt2img E2E** — Latest validation registry shows 4 txt2img models (klein may be uncached after sign-off cache delete); document or restore cache before full 5-model run.
9. **CivitAI token** — Stored in vault (`civitai` key); never log or commit.
10. **Bulk delete failure UX** — Partial failures show first error ID only; consider listing all failed paths.

---

## 8. Quick commands

```bash
cd /Volumes/AI_HQ/Codex_and_Stitch_MFLUX_UI/mflux
./scripts/dev.sh

.venv/bin/python scripts/smoke_test_neural_interface.py
.venv/bin/python scripts/v0_2_signoff.py
.venv/bin/python scripts/validation_pass.py
cd ui && npm run build

git add -A && git commit -m "feat(neural-interface): PNG output + gallery multi-delete UX (v0.4)"
git tag -a neural-interface-v0.4 -m "MFLUX Neural Interface v0.4"
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
**Last updated by:** Grok (2026-06-24)
