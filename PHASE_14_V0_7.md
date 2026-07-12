# Phase 14 — V0.7 FIBO EDIT, DESIGN SIGN-OFF & VALIDATION HARDENING

**Work order for Grok/Codex.** Builds on v0.6 sign-off (`neural-interface-v0.6`).

**Status:** Complete (2026-07-12)
**Depends on:** Phase 13 complete
**Tag:** `neural-interface-v0.7`

---

## 0. Scope

| Package | Features | Priority |
|---|---|---|
| **14A FIBO Edit** | `fibo_edit` job + `/fibo-edit` UI | P1 |
| **14B Design sign-off** | Phase 6/7 owner sign-off + `LONG_RUNNING_JOB_UX.md` | P1 |
| **14C Validation** | Edit-module E2E hooks, browser smokes, v0.7 tag | P2 |

---

## 14A — FIBO Edit module

- [x] `FiboEditRequest` + `_fibo_edit_command` → `mflux-generate-fibo-edit`
- [x] `/fibo-edit` UI — mask, RMBG matte toggle, model allowlist
- [x] Nav rail, JobPanel, Gallery handoff

See `PHASE_14_FIBO_EDIT.md`.

---

## 14B — Design sign-off (Phase 6/7)

- [x] `PHASE_6_7_SIGNOFF.md` — owner visual sign-off (2026-07-12)
- [x] `SurfaceLoadingState` — no bare `Loading...` copy
- [x] `scripts/design_signoff.py` — automated DESIGN_LOCK checks
- [x] Nav rail scroll; orphan `ModulePage.tsx` removed

---

## 14C — Validation hardening

- [x] `validation_pass.py` — `flux2_edit` / `fibo_edit` cached-model E2E (SKIP when uncached)
- [x] `smoke_test_neural_interface.py` — module defaults for edit modules
- [x] Gallery bulk-delete partial failure lists all error messages
- [x] `README.md` Neural Interface section
- [x] Browser smokes + `v0_2_signoff.py` re-run at tag time

---

## Sign-off

| Suite | Result | Report |
|---|---|---|
| `design_signoff.py` | PASS | 6/6 |
| `smoke_test_neural_interface.py` | **38 PASS** | includes edit module defaults |
| `validation_pass.py` | **32 PASS / 2 SKIP** | edit E2E SKIP when models uncached |
| `v0_2_signoff.py` | **15 PASS** | re-run at tag |
| Browser smokes | PASS | gallery bulk delete + nav state |
| `npm run build` | PASS | includes `/fibo-edit` |

---

**Phase owner:** David Hendricks
**Drafted:** 2026-07-12