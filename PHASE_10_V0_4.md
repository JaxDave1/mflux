# Phase 10 — V0.4 UX POLISH & OPS

**Work order for Codex.** Builds on v0.3 sign-off (`neural-interface-v0.3`).

**Status:** Complete (2026-06-24)
**Depends on:** Phase 9 complete

---

## 0. Scope

| Package | Features | Priority |
|---|---|---|
| **10A UX polish** | Module + Models cancel; gallery page fix (v0.3) | P1 |
| **10B Validation** | CivitAI/export full E2E; sign-off extensions | P2 |
| **10C Ops** | Runbook, tag push | P3 |

---

## 10A — UX polish

- [x] Gallery delete preserves pagination page
- [x] Job queue cancel (backend race + JobPanel stale merge fix)
- [x] Cancel on `RunningStatePreview` (all generation modules)
- [x] Cancel on Models download/export progress cards

---

## 10B — Validation

- [x] CivitAI E2E default version resolver (`62833` small LoRA fallback)
- [x] CivitAI E2E optional cleanup of downloaded test file
- [x] `model_export` full E2E (no skip when env unset)
- [x] `v0_2_signoff.py`: queued cancel contract check

---

## 10C — Ops

- [x] `NEURAL_INTERFACE_RUNBOOK.md` — start, validate, tag, env vars
- [x] `neural-interface-v0.3` git tag
- [x] Fork created: `https://github.com/JaxDave1/mflux`
- [x] Branch + tags pushed (2026-07-12): `codex/workspace-cleanup-snapshot`, `neural-interface-v0.2`–`v0.5` → `fe0065d`

---

## Follow-on — Phase 11 (v0.4 session)

See `PHASE_11_V0_4.md`:
- PNG-only generation outputs
- Gallery always-on checkboxes + SELECT PAGE bulk delete

**Phase owner:** David Hendricks
**Drafted:** 2026-06-24