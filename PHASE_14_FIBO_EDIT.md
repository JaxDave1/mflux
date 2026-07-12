# Phase 14 — FIBO Edit Module

**Status:** Complete (2026-07-12)  
**Depends on:** Phase 13 (Klein Edit)  
**Tag:** `neural-interface-v0.7` — see `PHASE_14_V0_7.md`

---

## Scope

Expose upstream `mflux-generate-fibo-edit` as a first-class Neural Interface job module.

- [x] `FiboEditRequest` schema (`imagePath`, optional `maskPath`, `saveMatte` for RMBG)
- [x] `fibo_edit` in `ModuleName`, `JobCreateRequest`, job manager baselines/progress
- [x] `_fibo_edit_command` → `mflux.models.fibo.cli.fibo_edit`
- [x] UI page `/fibo-edit` — source + optional mask, `fibo-edit` / `fibo-edit-rmbg` models
- [x] Nav rail, JobPanel, Gallery "USE THIS OUTPUT IN"
- [x] PNG output policy test coverage
- [x] Cached-model E2E in `validation_pass.py` (SKIP when `fibo-edit` uncached)

---

**Phase owner:** David Hendricks