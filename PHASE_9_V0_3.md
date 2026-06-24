# Phase 9 — V0.3 RELEASE HARDENING & RUNTIME TRUTH

**Work order for Codex.** Builds on v0.2 sign-off (`neural-interface-v0.2`, 2026-06-24).

**Status:** In progress
**Depends on:** Phase 8 complete, v0.2 validation 23/23 PASS

---

## 0. Scope

Three v0.3 work packages from post-v0.2 tracks:

| Package | Features | Priority |
|---|---|---|
| **9A Release hardening** | CHANGELOG cut, phase doc, git tag hygiene | P1 — done in this pass |
| **9B Validation depth** | CivitAI + `model_export` full E2E in `validation_pass.py` | P2 |
| **9C Dashboard runtime truth** | Real `system/status` metrics; Dashboard polling + live job state | P3 |

---

## 9A — Release hardening

### 9A.1 CHANGELOG

- [x] Move v0.2 notes from `[Unreleased]` to `## [neural-interface-v0.2] - 2026-06-24`
- [ ] Cut `neural-interface-v0.3` tag after 9B + 9C sign-off

### 9A.2 Phase documentation

- [x] This work order (`PHASE_9_V0_3.md`)
- [ ] Update `PHASE_8_V0_2.md` status footer with v0.3 pointer when complete

---

## 9B — Validation depth

Extend `scripts/validation_pass.py` beyond accept/cancel smoke:

### 9B.1 CivitAI full E2E

- [x] Gate on vault `civitai` token (`SKIP` if unset)
- [x] Gate on `MFLUX_VALIDATION_CIVITAI_VERSION_ID` env (small LoRA version id; `SKIP` if unset)
- [x] Submit `civitai_download` → wait for `succeeded` → verify output `.safetensors` on disk
- [ ] Optional cleanup: delete downloaded test LoRA after verify

### 9B.2 Model export full E2E

- [x] Pick first cached + exportable builtin from `/api/models`
- [x] Submit `model_export` (q8) → wait for `succeeded` (long timeout, minutes)
- [x] Verify output directory contains `*.safetensors`
- [x] Record job id + output path in validation report
- [x] `MFLUX_SKIP_MODEL_EXPORT_E2E=1` escape hatch for routine CI runs

### 9B.3 System status contract

- [x] Assert `/api/system/status` `loadedModel` matches `/api/config` `generation.defaultModel`
- [x] Assert `mlxCache.used > 0` when HF/mflux cache dirs are non-empty

---

## 9C — Dashboard runtime truth

### 9C.1 Backend `system_info.py`

- [x] `loadedModel` from `config.generation.defaultModel` + `defaultQuantize` (`q8` / `off`)
- [x] `mlxCache.used` from HF hub + mflux cache directory sizes
- [x] `mlxCache.total` from `config.system.cacheLimit`
- [x] `neuralEngine.load` scales with `activeJobs` (set in router)

### 9C.2 Dashboard UI

- [x] Poll `systemStatus` + `models` on interval (5s status, 30s models)
- [x] Use `useJobStore` for live active job count + module/state detail
- [x] Show `diskPath` under Disk Space telemetry
- [x] Show cached builtin count from `/api/models`

---

## Sign-off criteria

1. `scripts/validation_pass.py` — all prior checks PASS; new CivitAI/export E2E PASS or documented SKIP.
2. `scripts/v0_2_signoff.py` — still 14/14 PASS (unchanged).
3. Dashboard shows non-placeholder MLX cache, default model, disk path, and live job state.
4. `npm run build` clean.

### Sign-off run (2026-06-24)

| Suite | Result | Report |
|---|---|---|
| `scripts/validation_pass.py` | **26 PASS / 0 FAIL / 2 SKIP** | `scripts/validation_pass_results.json` |
| `scripts/v0_2_signoff.py` | **14 PASS / 0 FAIL / 0 SKIP** | `scripts/v0_2_signoff_results.json` |
| `scripts/smoke_test_neural_interface.py` | **32 PASS / 0 FAIL / 0 SKIP** | `scripts/smoke_test_results.json` |

SKIP notes: CivitAI E2E needs `MFLUX_VALIDATION_CIVITAI_VERSION_ID`; export E2E skipped via `MFLUX_SKIP_MODEL_EXPORT_E2E=1` for this run.

**Phase owner:** David Hendricks
**Drafted:** 2026-06-24