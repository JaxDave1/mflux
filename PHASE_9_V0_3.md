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

- [ ] Gate on vault `civitai` token (`SKIP` if unset)
- [ ] Gate on `MFLUX_VALIDATION_CIVITAI_VERSION_ID` env (small LoRA version id; `SKIP` if unset)
- [ ] Submit `civitai_download` → wait for `succeeded` → verify output `.safetensors` on disk
- [ ] Optional cleanup: delete downloaded test LoRA after verify

### 9B.2 Model export full E2E

- [ ] Pick first cached + exportable builtin from `/api/models`
- [ ] Submit `model_export` (q8) → wait for `succeeded` (long timeout, minutes)
- [ ] Verify output directory contains `*.safetensors`
- [ ] Record job id + output path in validation report

### 9B.3 System status contract

- [ ] Assert `/api/system/status` `loadedModel` matches `/api/config` `generation.defaultModel`
- [ ] Assert `mlxCache.used > 0` when HF/mflux cache dirs are non-empty

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

### Sign-off run

| Suite | Result | Report |
|---|---|---|
| `scripts/validation_pass.py` | _pending_ | `scripts/validation_pass_results.json` |
| `scripts/v0_2_signoff.py` | _pending_ | `scripts/v0_2_signoff_results.json` |
| `scripts/smoke_test_neural_interface.py` | _pending_ | `scripts/smoke_test_results.json` |

**Phase owner:** David Hendricks
**Drafted:** 2026-06-24