# MFLUX Neural Interface — JOBS_API_SPEC

**Status:** Locked v1.0
**Companion to:** LONG_RUNNING_JOB_UX.md (UX requirements), DESIGN_LOCK.md (visual contract)
**Authority:** This document is the contract Codex implements against. Endpoint shapes, payload schemas, and lifecycle semantics defined here are canonical. Deviations require an explicit spec revision before implementation.

---

## 0. Spec rules

1. **No endpoint shape is invented during implementation.** If a need surfaces that this spec doesn't cover, the spec is updated first, then the code.
2. **All payload fields are explicit.** Optional fields are marked `?`. Nullable fields are typed `T | null`. No undocumented additions.
3. **Lifecycle states are exhaustive.** A job is always in exactly one of the states defined in §3. No transient or undocumented states.
4. **Backwards compatibility is not a v0.1 concern.** This spec can iterate freely until v0.1 ships. Post-ship, breaking changes require a version bump.

---

## 1. Architecture overview

### 1.1 Components

```
Frontend module page
        │
        │ POST /api/jobs                   (create)
        │ GET  /api/jobs/{id}              (poll fallback)
        │ GET  /api/jobs/{id}/stream       (SSE primary)
        │ DELETE /api/jobs/{id}            (cancel)
        │ GET  /api/jobs                   (list active)
        ▼
   FastAPI router (api/routers/jobs.py)
        │
        ▼
   JobManager (in-process singleton)
        │
        │ — spawns —
        ▼
   subprocess.Popen → MFLUX CLI command
        │
        │ — captures —
        ▼
   stdout/stderr → progress parser → job state
```

### 1.2 State location

**Job state lives in the JobManager singleton, in-process, in-memory.** This is sufficient for v0.1 because:

- The app is local-first, single-user, single-machine
- The FastAPI process is the only consumer of job state
- Frontend re-attaches by ID on page load, no client-side persistence needed

Future state (post-v0.1) may move to SQLite or a job queue. v0.1 does not require that.

### 1.3 Persistence target

A job in flight must survive:
- ✅ Frontend page navigation (router transitions)
- ✅ Frontend page reload (F5)
- ✅ Frontend tab close + reopen (job continues server-side, frontend re-attaches on load via `GET /api/jobs`)
- ❌ Backend process restart — out of scope for v0.1; jobs are lost, subprocess orphans cleaned by OS

---

## 2. Data model

### 2.1 Job

```typescript
interface Job {
  id: string;                    // UUID v4
  module: ModuleName;            // see §2.3
  state: JobState;               // see §3
  command: string[];             // resolved CLI argv, captured for debug
  params: Record<string, any>;   // original request params, captured for replay
  created_at: string;            // ISO 8601 UTC
  started_at: string | null;     // ISO 8601 UTC, set when subprocess spawns
  finished_at: string | null;    // ISO 8601 UTC, set on terminal state
  progress: JobProgress;
  output: JobOutput | null;      // populated only when state = "succeeded"
  error: JobError | null;        // populated only when state ∈ {"failed", "cancelled"}
}
```

### 2.2 JobProgress

```typescript
interface JobProgress {
  step: number | null;           // current step (1-indexed), null if unknown
  total_steps: number | null;    // total steps, null if unknown
  percent: number | null;        // 0–100, computed from step/total when both known
  elapsed_ms: number;            // wall-clock since started_at
  eta_ms: number | null;         // estimated remaining, computed per §5.3
  source: ProgressSource;        // see §5.1
  last_stdout_line: string | null; // last non-empty stdout line, for debugging
}

type ProgressSource = "step_parser" | "baseline" | "indeterminate";
```

### 2.3 ModuleName

```typescript
type ModuleName =
  | "txt2img"
  | "img2img"
  | "inpaint"
  | "controlnet"
  | "kontext"
  | "upscaler"
  | "depth_pro"
  | "model_download"
  | "civitai_download"
  | "model_export";
```

Modules outside this list (gallery, config) do not produce jobs.

### 2.4 JobOutput

```typescript
interface JobOutput {
  output_path: string;           // absolute path on disk
  output_url: string | null;     // API-served URL for images; null for non-served outputs
  metadata: Record<string, any>; // module-specific (seed used, model, etc.)
}
```

For `model_download`, `JobOutput` is:

```typescript
interface JobOutput {
  output_path: string;        // local Hugging Face cache path where model now lives
  output_url: null;           // models are not served via API
  metadata: {
    model_name: string;
    size_bytes: number;
    cached_at: string;        // ISO timestamp
  };
}
```

For `civitai_download`, `JobOutput` is:

```typescript
interface JobOutput {
  output_path: string;        // absolute path to downloaded .safetensors file
  output_url: null;
  metadata: {
    destination: "lora" | "custom";
    model_version_id: number;
    model_name: string | null;
    file_name: string;
    size_bytes: number;
    downloaded_at: string;    // ISO timestamp
  };
}
```

For `model_export`, `JobOutput` is:

```typescript
interface JobOutput {
  output_path: string;        // directory containing quantized safetensors shards
  output_url: null;
  metadata: {
    model_name: string;
    quantize: number;
    size_bytes: number;
    exported_at: string;      // ISO timestamp
  };
}
```

### 2.5 JobError

```typescript
interface JobError {
  type: ErrorType;               // see §6
  message: string;               // human-readable
  exit_code: number | null;      // subprocess exit code, null if not spawned
  stderr_tail: string | null;    // last 4KB of stderr, null if empty
}
```

---

## 3. Lifecycle states

```
        ┌───────────┐
        │  queued   │  ← created, subprocess not spawned yet
        └─────┬─────┘
              │ (manager picks up)
              ▼
        ┌───────────┐
        │  running  │  ← subprocess spawned, stdout being parsed
        └─────┬─────┘
              │
   ┌──────────┼──────────┬──────────────┐
   ▼          ▼          ▼              ▼
┌──────┐  ┌────────┐  ┌──────────┐  ┌──────────┐
│ ok   │  │ failed │  │ cancelled│  │ timed_out│
└──────┘  └────────┘  └──────────┘  └──────────┘
succeeded                                       (all terminal)
```

### 3.1 State definitions

| State | Meaning | Terminal? |
|---|---|---|
| `queued` | Created, awaiting subprocess spawn | No |
| `running` | Subprocess active, generating | No |
| `succeeded` | Subprocess exited 0, output file present | Yes |
| `failed` | Subprocess exited non-zero, or output missing | Yes |
| `cancelled` | Killed by user via DELETE | Yes |
| `timed_out` | Exceeded module timeout (default: 30 min) | Yes |

### 3.2 Transitions

Only these transitions are valid:

- `queued → running` (manager picked up)
- `queued → cancelled` (user cancelled before spawn)
- `running → succeeded`
- `running → failed`
- `running → cancelled`
- `running → timed_out`

Terminal states never transition.

### 3.3 Concurrency

**v0.1 is single-job at a time.** The JobManager queues additional jobs and processes them FIFO. This matches MFLUX's reality — concurrent generations would compete for unified memory and degrade both. The frontend should warn before submitting a new job if one is in flight.

---

## 4. Endpoints

### 4.1 `POST /api/jobs` — create

**Request:**

```json
{
  "module": "txt2img",
  "params": {
    "prompt": "...",
    "model": "...",
    "steps": 30,
    "seed": 42,
    "...": "..."
  }
}
```

`params` shape is module-specific and matches the existing module endpoint contracts (e.g., `POST /api/txt2img/run` payload). The job system does not redefine module params; it wraps them.

For `model_download`, the request body is:

```json
{
  "module": "model_download",
  "params": {
    "model_name": "dev",
    "base_model": "dev"
  }
}
```

`model_name` can be a known built-in model id or a full Hugging Face repo id. `base_model` is optional and is used only for third-party repos that need an explicit HF repo path.

For `civitai_download`:

```json
{
  "module": "civitai_download",
  "params": {
    "modelVersionId": 123456,
    "downloadUrl": null,
    "destination": "lora"
  }
}
```

Either `modelVersionId` or `downloadUrl` is required. `destination` is `"lora"` (configured LoRA dir) or `"custom"` (configured model dir). CivitAI token is read from the secrets vault (`civitai` key) and injected into the subprocess environment.

For `model_export`:

```json
{
  "module": "model_export",
  "params": {
    "model_name": "z-image-turbo",
    "quantize": 8,
    "output": null
  }
}
```

`model_name` must be a cached, exportable built-in checkpoint. Default output path is `{modelDir}/{model_name}_q{quantize}/`. Dispatches `mflux.models.common.cli.save` (`mflux-save`).

**Multipart transport variant for browser uploads:**

Modules whose live UI collects browser `File` objects (`img2img`, `inpaint`, `controlnet`, `kontext`) may submit the same endpoint as `multipart/form-data`:

- `module`: `ModuleName`
- `params`: JSON string matching the module params after upload paths are resolved
- file fields:
  - `img2img`: `image`
  - `kontext`: `image`
  - `controlnet`: `image`
  - `inpaint`: `image`, `mask`

The router saves uploads to API-owned temp paths, injects those paths into `params` (`imagePath`, `maskedImagePath`, `controlnetImagePath`), and hands the normalized job to `JobManager`. Generation still goes through `POST /api/jobs`; legacy module generation endpoints are not used by the frontend.

**Response (201 Created):**

```json
{
  "ok": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "module": "txt2img",
    "state": "queued",
    "...": "..."  // full Job object
  }
}
```

**Response (400 Bad Request):**

```json
{
  "ok": false,
  "error": {
    "type": "invalid_params",
    "message": "Missing required field: prompt"
  }
}
```

**Response (409 Conflict):** when single-job concurrency is enforced and a job is already running:

```json
{
  "ok": false,
  "error": {
    "type": "concurrent_job_blocked",
    "message": "Another job is currently running. Cancel it or wait.",
    "active_job_id": "..."
  }
}
```

### 4.2 `GET /api/jobs` — list active

Returns all non-terminal jobs (`queued`, `running`). Used by frontend on page load to re-attach to in-flight jobs.

**Response (200 OK):**

```json
{
  "ok": true,
  "data": {
    "jobs": [/* array of Job objects */]
  }
}
```

**Query params:**

- `?include_terminal=true` — also include the most recent N terminal jobs (default N=10). Useful for showing recent history.

### 4.3 `GET /api/jobs/{id}` — get one

**Response (200 OK):** full Job object.
**Response (404 Not Found):** job ID unknown.

### 4.4 `GET /api/jobs/{id}/stream` — SSE progress stream

Server-Sent Events stream. Primary mechanism for progress UI.

**Event types:**

```
event: progress
data: { "step": 12, "total_steps": 30, "percent": 40, "elapsed_ms": 8400, "eta_ms": 12600 }

event: stdout
data: { "line": "Step 12/30..." }

event: state
data: { "state": "succeeded" }

event: complete
data: { "job": { /* full Job object */ } }
```

**Lifecycle:**
- Stream opens, sends current state as first `progress` event.
- Emits `progress` events as parser advances.
- Emits `stdout` events for non-progress lines (optional, useful for debug panel).
- Emits `state` event on transition.
- Emits `complete` event with final Job object on terminal state, then closes the stream.

**Reconnection:** clients should reconnect on disconnect with the same job ID. The server replays current state on reconnect (no event ID/replay-from-cursor in v0.1).

**Response (404 Not Found):** job ID unknown.

### 4.5 `DELETE /api/jobs/{id}` — cancel

Cancels a `queued` or `running` job.

**Cancel semantics:**
- `queued` → state set to `cancelled`, never spawned.
- `running` → `SIGTERM` to subprocess, 2s grace period, then `SIGKILL`. Partial output files at the expected output path are deleted (not gallery-indexed).

**Response (200 OK):** updated Job object with state `cancelled`.
**Response (404 Not Found):** job ID unknown.
**Response (409 Conflict):** job is already terminal:

```json
{
  "ok": false,
  "error": {
    "type": "already_terminal",
    "message": "Job is already in state 'succeeded' and cannot be cancelled.",
    "current_state": "succeeded"
  }
}
```

### 4.6 `GET /api/jobs/baselines` — latency baselines

Returns expected runtime per module, captured from smoke testing. Frontend uses these to display ETA before step parsing kicks in (per §5.3).

**Response (200 OK):**

```json
{
  "ok": true,
  "data": {
    "baselines": {
      "txt2img":    { "median_ms": <smoke_value>, "p90_ms": <smoke_value>, "samples": <n> },
      "img2img":    { "median_ms": <smoke_value>, "p90_ms": <smoke_value>, "samples": <n> },
      "upscaler":   { "median_ms": <smoke_value>, "p90_ms": <smoke_value>, "samples": <n> },
      "depth_pro":  { "median_ms": <smoke_value>, "p90_ms": <smoke_value>, "samples": <n> },
      "inpaint":    { "median_ms": <smoke_value>, "p90_ms": <smoke_value>, "samples": <n> },
      "controlnet": { "median_ms": <smoke_value>, "p90_ms": <smoke_value>, "samples": <n> },
      "kontext":    { "median_ms": <smoke_value>, "p90_ms": <smoke_value>, "samples": <n> }
    }
  }
}
```

**Implementation requirement:** baseline values are NOT shipped as placeholders. Codex pulls real measured values from the smoke test runs (txt2img ~17s, upscaler ~2 min, FLUX trio ~8–9 min each, etc.) and seeds them at deploy. Once shipped, the running median replaces the seeded values organically as more jobs complete. If smoke test data is unavailable for a module at deploy time, that module's entry is omitted from the response and the frontend falls back to indeterminate progress display.

### 4.7 `DELETE /api/models/cache/{id}` — remove built-in cache (v0.2)

Removes Hugging Face hub `models--*` directories (and `extraRepoIds`) for a built-in model id, or the MFLUX `depth_pro` cache folder. Paths are validated to stay within configured HF hub and MFLUX cache roots.

**Response (200 OK):**

```json
{
  "ok": true,
  "data": {
    "id": "z-image-turbo",
    "deleted_paths": ["/path/to/hf/hub/models--Tongyi-MAI--Z-Image-Turbo"]
  }
}
```

**Response (404):** unknown built-in id. **Response (400):** model family has no removable cache entry.

---

## 5. Progress parsing

### 5.1 Source taxonomy

Each running job has a `progress.source` field indicating where its progress numbers come from:

| Source | Meaning |
|---|---|
| `step_parser` | Regex matched a step line in stdout. Most reliable. |
| `baseline` | No step lines yet, ETA from latency baseline + elapsed time. |
| `indeterminate` | Module emits no parseable progress. Show spinner + elapsed only. |

### 5.2 Per-module regex registry

**Critical:** progress line formats differ per MFLUX command. Codex must verify each regex against real stdout from each module before declaring it correct. The smoke test outputs should be sufficient reference.

**Implementation requirement:** the regex registry in code MUST carry an inline comment pointing back to this section, e.g.:

```python
# Progress line formats per MFLUX command. Verified against smoke test
# stdout captures on 2026-05-04. If MFLUX changes its output format
# upstream, this registry breaks silently — see JOBS_API_SPEC.md §5.2
# before modifying. Re-verify against real stdout before any change.
PROGRESS_PATTERNS = {
    "txt2img":    r"^\s*Step\s+(?P<step>\d+)\s*/\s*(?P<total>\d+)",
    "img2img":    r"^\s*Step\s+(?P<step>\d+)\s*/\s*(?P<total>\d+)",
    "inpaint":    r"^\s*Step\s+(?P<step>\d+)\s*/\s*(?P<total>\d+)",
    "controlnet": r"^\s*Step\s+(?P<step>\d+)\s*/\s*(?P<total>\d+)",
    "kontext":    r"^\s*Step\s+(?P<step>\d+)\s*/\s*(?P<total>\d+)",
    "upscaler":   None,   # SeedVR2 emits no step counter — indeterminate
    "depth_pro":  None,   # Apple Depth Pro is single-pass — indeterminate
    "model_download": r"(?P<step>\d+(?:\.\d+)?)\s*(?:M|G)B\s*/\s*(?P<total>\d+(?:\.\d+)?)\s*(?:M|G)B",
    # Hugging Face hub download progress format. Captured 2026-05-04.
    # Falls back to indeterminate if the format changes.
    "civitai_download": r"(?P<step>\d+(?:\.\d+)?)\s*(?:M|G)B\s*/\s*(?P<total>\d+(?:\.\d+)?)\s*(?:M|G)B",
    # CivitAI stream download prints MB progress lines from api.services.civitai_download.
    "model_export": None,   # mflux-save is long-running with no step counter — indeterminate
}
```

If a module's regex is `None`, its `progress.source` is `indeterminate` for the entire run, and `step` / `total_steps` / `percent` are `null`.

If `model_download` or `civitai_download` receives a line that does not match the download progress format, that update falls back to `indeterminate`; the job must not crash.

**Cancel cleanup (v0.2):** `_cleanup_partial_locked` deletes only file outputs, not directories. Download/export jobs use directory `output_path` values and must not `unlink()` the parent LoRA or model root on cancel.

### 5.3 ETA calculation

```python
def compute_eta(job: Job) -> int | None:
    elapsed = job.progress.elapsed_ms

    # Path 1: step parser is producing data
    if job.progress.step is not None and job.progress.step >= 1:
        if job.progress.total_steps is None or job.progress.total_steps == 0:
            return None
        rate_ms_per_step = elapsed / job.progress.step
        remaining_steps = job.progress.total_steps - job.progress.step
        return int(rate_ms_per_step * remaining_steps)

    # Path 2: no step data yet, fall back to baseline
    baseline = BASELINES.get(job.module)
    if baseline is not None:
        remaining = baseline.median_ms - elapsed
        return max(0, remaining)

    # Path 3: indeterminate
    return None
```

**Hybrid behavior:**
- For the first ~10% of progress, baseline is more accurate (linear extrapolation from step 1 of 30 is wildly noisy).
- After ~10%, step-parser extrapolation dominates.
- The function above already prefers step data when available; the "first 10%" heuristic can be refined post-v0.1 if needed.

---

## 6. Error taxonomy

`JobError.type` values:

| Type | Cause | Recovery |
|---|---|---|
| `invalid_params` | Request validation failed | Fix params, retry |
| `concurrent_job_blocked` | Another job running | Wait or cancel other |
| `lora_not_found` | LoRA path no longer exists at submit time | Refresh LoRA list, re-select |
| `model_not_found` | Model not in cache, not downloadable | Pull model in Models page |
| `model_load_failed` | Model file corrupt or incompatible | Re-download model |
| `gated_repo` | HF gated repo, no token or no access | Configure HF token |
| `subprocess_crashed` | Non-zero exit, no specific signal | Read stderr_tail |
| `output_missing` | Subprocess exited 0 but output file absent | MFLUX bug, file issue |
| `timed_out` | Exceeded module timeout | Increase timeout, simplify input |
| `cancelled` | User cancelled | N/A |
| `internal` | Bug in JobManager, unhandled case | Read stderr_tail, file issue |

The frontend uses `type` for branching messages and `message` + `stderr_tail` for the detail panel.

---

## 7. Frontend contract

The frontend is not in this spec's scope, but two contract points must be honored:

### 7.1 Re-attach pattern

On any module page mount:
1. `GET /api/jobs?include_terminal=false` to list active jobs.
2. If any job's module matches the current page, re-attach: open SSE stream, restore UI to "running" state, populate progress.
3. If user navigates away, SSE stream is closed but the job continues server-side.
4. On return, repeat step 1.

### 7.2 Single-job UI guard

When the user submits a new job and `409 concurrent_job_blocked` returns, the frontend shows the active job's status and offers cancel + retry. The frontend does not silently retry.

---

## 8. Implementation checklist

Codex implements against this list. Each item is testable.

- [x] `api/routers/jobs.py` created, mounted at `/api/jobs`
- [x] `JobManager` singleton with in-memory job dict
- [x] `POST /api/jobs` accepts module + params, returns Job, queues subprocess
- [x] `GET /api/jobs` returns active jobs; `?include_terminal=true` adds terminal
- [x] `GET /api/jobs/{id}` returns one job or 404
- [x] `GET /api/jobs/{id}/stream` SSE with `progress`, `stdout`, `state`, `complete` events
- [x] `DELETE /api/jobs/{id}` cancels with SIGTERM → 2s grace → SIGKILL, deletes partial output
- [x] `GET /api/jobs/baselines` returns seeded baselines
- [x] Progress parser regex registry per §5.2, verified against real stdout per module
- [x] ETA calculation per §5.3
- [x] Error type classification per §6
- [x] Single-job concurrency guard with 409 response
- [x] Module timeout default 30 min, configurable per module via env
- [x] Existing per-module endpoints (`/api/txt2img/run` etc.) wrapped or replaced — decide and document
- [x] Frontend hooks: `useJob(id)` returns SSE-connected state; `useActiveJobs()` lists
- [x] Frontend per-module submit calls `POST /api/jobs` instead of legacy endpoint
- [x] Frontend job panel component (elapsed, ETA, progress bar, cancel button)
- [x] Job panel persists across module navigation (lives in app shell, not page)
- [x] All 7 modules switched over
- [x] Tab close + reopen test: job continues, frontend re-attaches

---

## 9. Locked decisions

These were resolved before implementation to prevent silent choices in code:

1. **Replace, do not wrap.** Legacy per-module endpoints (`POST /api/txt2img/run`, `POST /api/img2img/run`, etc.) are removed. All module generation work goes through `POST /api/jobs`. This is a breaking change with no external consumers (pre-v0.1, single-machine local app). The legacy endpoints are technical debt and do not survive into v0.1.

2. **Job retention.** Last 50 terminal jobs held in a ring buffer per the JobManager singleton, oldest dropped first. Retention size configurable via env (`MFLUX_JOB_RETENTION=50` default).

3. **Stderr handling.** Capture full stderr to a temp file per job during execution; expose only the last 4KB via `JobError.stderr_tail`. Full stderr file is retained until the job is dropped from the ring buffer. This balances diagnostic utility with memory pressure.

4. **SSE reconnect storms.** Not v0.1 critical. Single-user local app makes rapid reconnects unlikely in practice. If observed during testing, add a 250ms debounce on reconnect server-side. Defer until measured.

---

## 10. Sign-off

This spec is ratified when:

1. Codex implements §8 against the live backend.
2. All 7 modules submit through `POST /api/jobs` and stream progress via SSE.
3. Cancel works and cleans up partial outputs.
4. Tab close + reopen test passes.
5. The frontend job panel is visible across module navigation.

**Spec owner:** David Hendricks
**Drafted:** 2026-05-04
**Ratified:** 2026-05-04
