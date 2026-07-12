# MFLUX Neural Interface — LONG_RUNNING_JOB_UX

**Status:** Locked v1.0 (implemented)  
**Companion to:** `JOBS_API_SPEC.md`, `DESIGN_LOCK.md` §10  
**Authority:** Visual and behavioral contract for active generation jobs.

---

## 1. Principles

1. Never show bare `Loading...` copy on module surfaces (`DESIGN_LOCK` §10, §11).
2. Active jobs always expose module identity, elapsed time, ETA when available, progress, and cancel.
3. Idle module preview panes show structured idle state — not a blank spinner with generic text.
4. Job queue visibility lives in `JobPanel` + `StatusBar`; module pages focus on the latest job for that module.

---

## 2. Surfaces

| Surface | Role |
|---|---|
| `RunningStatePreview` | Per-module live output: preview image, status pill, progress bar, elapsed/ETA, cancel |
| `ModuleRunColumn` | Wraps preview + stepwise thumbnails for generation modules |
| `JobPanel` | Global queue list with per-job cancel and navigation links |
| `StatusBar` | Compact running-job indicator in app shell |
| `SurfaceLoadingState` | Short-lived fetches (config, LoRAs, sidecar, dashboard bootstrap) — spinner + uppercase Rajdhani label |

---

## 3. RunningStatePreview states

| Job state | Preview area | Status pill | Controls |
|---|---|---|---|
| `null` / idle | MX monogram + `NO ACTIVE JOB` | `IDLE` | — |
| `queued` / `running` (no image yet) | Spinner + `GENERATING` + contextual caption | `QUEUED` / `RUNNING` | Cancel |
| `running` (stepwise preview) | Latest step image | `RUNNING` | Cancel |
| `succeeded` | Final output image | `COMPLETE` | — |
| `failed` / `timed_out` | Last preview or idle | `FAILED` / `TIMED OUT` | — |

**Progress row:** solid cyan `bar-fill` (no gradient), step `N/M` when parsed else percent.  
**Timing row:** `ELAPSED` and `ETA` in IBM Plex Mono readout style.

---

## 4. Cancel behavior

- Cancel button on `RunningStatePreview` and `JobPanel` calls `DELETE /api/jobs/{id}`.
- Button shows `Cancelling…` while request is in flight; errors surface inline in preview panel.
- Matches `JOBS_API_SPEC` §4.5 (`queued → cancelled`, `running → cancelled`).

---

## 5. ETA and progress modes

Per `JOBS_API_SPEC` §5:

| Mode | UI treatment |
|---|---|
| `stepwise` | Step counter + percent from parser |
| `baseline` | Percent from elapsed vs module baseline median |
| `indeterminate` | Spinner + elapsed only; ETA shows `--:--` |

Module baselines are seeded in `job_manager.py` (`JobBaseline` table).

---

## 6. Non-job loading (allowed)

Config bootstrap, LoRA library fetch, gallery sidecar JSON, and dashboard first paint use `SurfaceLoadingState` with domain-specific uppercase labels (`FETCHING CONFIG`, `FETCHING LORA LIBRARY`, etc.) — never bare `Loading...`.

---

## 7. Implementation map

| File | Responsibility |
|---|---|
| `ui/src/components/RunningStatePreview.tsx` | Module job preview UX |
| `ui/src/components/JobPanel.tsx` | Queue list + cancel |
| `ui/src/components/ModuleRunColumn.tsx` | Preview column layout |
| `ui/src/components/SurfaceLoadingState.tsx` | Fetch/bootstrap loading |
| `ui/src/stores/useJobStore.ts` | SSE attach, cancel, poll fallback |
| `api/services/job_manager.py` | Progress parse, ETA, baselines |

---

## 8. Sign-off criteria (DESIGN_LOCK §10)

- [x] No bare `Loading...` in `ui/src` (enforced by `scripts/design_signoff.py`)
- [x] `RunningStatePreview` shows elapsed, ETA, progress, cancel for active jobs
- [x] `JobPanel` lists active jobs with cancel
- [x] Progress bars use solid cyan fill only

---

**Lock owner:** David Hendricks  
**Drafted:** 2026-07-12  
**Ratified:** 2026-07-12 (Phase 6/7 owner sign-off)