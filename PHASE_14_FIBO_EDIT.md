# Phase 14 — FIBO Edit Module

**Status:** Complete (2026-07-12)  
**Depends on:** Phase 13 (Klein Edit)  
**Tag:** pending — ship with next neural-interface release

---

## Scope

Expose upstream `mflux-generate-fibo-edit` as a first-class Neural Interface job module.

- [x] `FiboEditRequest` schema (`imagePath`, optional `maskPath`, `saveMatte` for RMBG)
- [x] `fibo_edit` in `ModuleName`, `JobCreateRequest`, job manager baselines/progress
- [x] `_fibo_edit_command` → `mflux.models.fibo.cli.fibo_edit`
- [x] UI page `/fibo-edit` — source + optional mask, `fibo-edit` / `fibo-edit-rmbg` models
- [x] Nav rail, JobPanel, Gallery "USE THIS OUTPUT IN"
- [x] PNG output policy test coverage
- [ ] Cached-model E2E in `validation_pass.py` (optional when `fibo-edit` cached)

---

**Phase owner:** David Hendricks