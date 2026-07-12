# Phase 13 — FLUX.2 Klein Edit Module

**Status:** Complete (2026-06-24)  
**Depends on:** Phase 11+  
**Tag:** pending — ship with next neural-interface release

---

## Scope

Expose upstream `mflux-generate-flux2-edit` (`flux2_edit_generate`) as a first-class Neural Interface job module.

- [x] `Flux2EditRequest` schema (`imagePaths` 1–4)
- [x] `flux2_edit` in `ModuleName`, `JobCreateRequest`, job manager baselines/progress
- [x] `_flux2_edit_command` → `mflux.models.flux2.cli.flux2_edit_generate`
- [x] UI page `/flux2-edit` — primary + optional secondary image, Klein models only
- [x] Nav rail, JobPanel, Gallery "USE THIS OUTPUT IN"
- [x] PNG output policy test coverage
- [ ] Cached-model E2E in `validation_pass.py` (optional when `flux2-klein-4b` cached)

---

**Phase owner:** David Hendricks