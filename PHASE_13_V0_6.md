# Phase 13 — V0.6 FLUX.2 KLEIN EDIT & DESIGN AUDIT

**Work order for Grok/Codex.** Builds on v0.5 sign-off (`neural-interface-v0.5`).

**Status:** Complete (2026-07-12)
**Depends on:** Phase 12 complete
**Tag:** `neural-interface-v0.6`

---

## 0. Scope

| Package | Features | Priority |
|---|---|---|
| **13A Klein Edit module** | `flux2_edit` job + `/flux2-edit` UI | P1 |
| **13B Design audit** | `PHASE_6_7_DESIGN_AUDIT.md` Pass 2 summary | P2 |
| **13C Ops** | Fork push recorded; v0.6 tag | P3 |

---

## 13A — FLUX.2 Klein Edit

- [x] `Flux2EditRequest` schema (`imagePaths` 1–4)
- [x] `flux2_edit` in `ModuleName`, `JobCreateRequest`, job manager baselines/progress
- [x] `_flux2_edit_command` → `mflux.models.flux2.cli.flux2_edit_generate`
- [x] UI page `/flux2-edit` — primary + optional secondary image, Klein models only
- [x] Nav rail, JobPanel, Gallery "USE THIS OUTPUT IN"
- [x] PNG output policy test coverage (`flux2_edit` in `test_png_output_policy.py`)
- [ ] Cached-model E2E in `validation_pass.py` (optional when `flux2-klein-4b` cached)

**Files:** `api/services/mflux_cli.py`, `api/services/job_manager.py`, `api/schemas/requests.py`, `ui/src/pages/Flux2Edit.tsx`, `ui/src/lib/moduleModelOptions.ts`

See also `PHASE_13_FLUX2_EDIT.md` (module checklist).

---

## 13B — Design audit (Phase 6/7)

- [x] `PHASE_6_7_DESIGN_AUDIT.md` — Pass 2 audit summary per `DESIGN_LOCK.md`
- [x] Dashboard PASS; generation modules / Gallery / Models / Config PARTIAL
- [ ] Owner visual sign-off against §1–§11 (non-blocking)

---

## 13C — Ops

- [x] Fork branch + `neural-interface-v0.2`–`v0.5` tags pushed to `JaxDave1/mflux`
- [x] `neural-interface-v0.6` tag on release commit (`0c4e3d8`, pushed 2026-07-12)

---

## Sign-off

| Suite | Result | Report |
|---|---|---|
| `npm run build` | PASS | UI includes `/flux2-edit` |
| `tests/test_png_output_policy.py` | **11 PASS** | Includes `flux2_edit` |
| `validation_pass.py` | 32 PASS (baseline) | No new flux2_edit E2E required for tag |

---

**Phase owner:** David Hendricks
**Drafted:** 2026-07-12