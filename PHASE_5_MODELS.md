# Phase 5 — MODELS V0.1 FUNCTIONAL GAPS

**Work order for Codex.** Self-contained. Implement against this spec in one pass.

**Status:** Complete (smoke verified 2026-06-24)
**Depends on:** Phase 1 (HF token vault)
**Unblocks:** Phase 6 (Module 1 Stitch reskin reflects complete app), Phase 7 (Modules 2–10 inherit LoRA discovery improvements)

---

## 0. Scope

Three v0.1 Models features. CivitAI integration, delete-from-cache, and `mflux-save` quantized export are deferred to v0.2.

1. HF download button per model card
2. LoRA trigger words display (also consumed by Phase 3 Txt2Img LoRA stack)
3. `model_download` job type added to job system

---

## 1. HF download button per model card

### 1.1 UI

For each model card in `Models.tsx`:

- If the model is `cached` or `offline-ready`: status pill shows current state, no download button
- If the model is `builtin` but not yet cached: new button at the bottom of the card

```
[ DOWNLOAD ]   (anodized button per DESIGN_LOCK §5.5)
```

Clicking the button:
1. Submits a `model_download` job via `POST /api/jobs`
2. Card transitions to a "downloading" state showing a progress bar (consumes JobPanel's job state for this job)
3. On completion, card refreshes to `cached` state with refreshed metadata

### 1.2 Authentication

Gated FLUX models require an HF token. Before submitting the download job:

1. Frontend checks `GET /api/secrets` (from Phase 1) to confirm the `hf` token is set
2. If not set, button is disabled with tooltip: "HF token required. Set in Config → API Keys."
3. If set, button proceeds with download

The `hf` token is injected into the subprocess env at job spawn time per Phase 1's subprocess inheritance. No special handling per-job.

---

## 2. `model_download` job type

This is an extension to `JOBS_API_SPEC.md`. Update the spec doc as part of this phase.

### 2.1 Spec amendments to JOBS_API_SPEC.md

§2.3 ModuleName union gains `"model_download"`:

```typescript
type ModuleName =
  | "txt2img"
  | "img2img"
  | "inpaint"
  | "controlnet"
  | "kontext"
  | "upscaler"
  | "depth_pro"
  | "model_download";   // NEW
```

§5.2 Progress regex registry gains:

```python
"model_download": r"(?P<step>\d+(?:\.\d+)?)\s*(?:M|G)B\s*/\s*(?P<total>\d+(?:\.\d+)?)\s*(?:M|G)B",
# Hugging Face hub download progress format. Captured 2026-05-04.
# Falls back to indeterminate if the format changes.
```

If the regex fails to match for a given line, `progress.source` falls back to `indeterminate` for that update — don't crash.

§4.1 Request body for model_download module:

```json
{
  "module": "model_download",
  "params": {
    "model_name": "dev",        // or full HF repo path
    "base_model": "dev"          // optional, for third-party HF repos
  }
}
```

§2.4 JobOutput for model_download:

```typescript
interface JobOutput {
  output_path: string;        // local cache path where model now lives
  output_url: null;           // models aren't served via API
  metadata: {
    model_name: string;
    size_bytes: number;
    cached_at: string;        // ISO timestamp
  };
}
```

### 2.2 Backend implementation

In `api/services/job_manager.py`, add a new module handler that dispatches to:

```bash
mflux-save --path <cache_dir> --model <model_name> --quantize <default_quantize>
```

Wait — `mflux-save` is for saving quantized copies. The actual download just needs to invoke any `mflux-generate*` command with `--steps 0` or similar minimal-work flag... Actually the cleanest approach: use Hugging Face's `huggingface_hub.snapshot_download` directly:

```python
from huggingface_hub import snapshot_download

snapshot_download(
    repo_id=resolve_model_to_repo(model_name),
    cache_dir=os.environ.get("HF_HOME", DEFAULT_HF_HOME),
    token=secrets.get("hf"),
)
```

This gives Codex direct progress callbacks via `tqdm` output, which the regex in §2.1 captures.

Codex chooses between:
- (a) `huggingface_hub.snapshot_download` directly — cleaner, native progress
- (b) Wrapping a `mflux-*` command with minimal flags — consistent with other job types

Recommend (a). Document the choice in `CLI_CAPABILITY_MATRIX.md`.

### 2.3 Frontend hook

The Models page needs to know when a `model_download` job completes so it can refresh the model card. Two paths:

- (a) Models page subscribes to JobPanel for any active `model_download` jobs and refreshes its model list when one completes
- (b) Polling: Models page polls `/api/models` every 5s while any download is active

Recommend (a). Less wasteful, more responsive.

---

## 3. LoRA trigger words

### 3.1 Endpoint expansion

The endpoint `GET /api/models/loras` is being added in Phase 3 (consumed by Txt2Img's LoRA stack). Phase 5 ratifies it on the Models page side.

The endpoint already returns:

```json
{
  "path": "...",
  "name": "...",
  "trigger_words": ["word1", "word2"],
  "size_mb": 144.2
}
```

### 3.2 UI

In the Models page LoRA filter view:

For each LoRA card, display trigger words as small pills below the LoRA name:

```
LoRA-Name-Here              [v1.0 pill]   [144 MB]
↳ trigger words:  [ word1 ]  [ word2 ]
```

If no trigger words known: "trigger words: not detected" in muted text.

The trigger word pills use the cyan-teal accent color at low opacity (per DESIGN_LOCK component patterns).

### 3.3 Click-to-copy

Clicking a trigger word pill copies it to clipboard with a brief toast: "Copied: word1". This lets the user paste trigger words directly into Txt2Img prompts.

---

## 4. Implementation checklist

- [x] Frontend: model card `DOWNLOAD` button visible for non-cached builtins
- [x] Frontend: download button disabled with tooltip when HF token unset
- [x] Frontend: card transitions to downloading state with progress bar
- [x] Backend: `model_download` module added to ModuleName type
- [x] Backend: `model_download` job uses `huggingface_hub.snapshot_download`
- [x] Backend: HF token injected from secrets vault
- [x] Backend: progress regex for HF download format
- [x] Backend: indeterminate fallback when regex fails
- [x] JOBS_API_SPEC.md updated with §2.3, §2.4, §4.1, §5.2 amendments
- [x] Frontend: Models page subscribes to `model_download` job completion to refresh card
- [x] Frontend: LoRA trigger words displayed as pills on LoRA cards
- [x] Frontend: trigger word pill click-to-copy with toast
- [x] Backend: `GET /api/models/loras` extracts trigger words from safetensors metadata
- [x] CLI_CAPABILITY_MATRIX.md updated with snapshot_download approach choice
- [x] `npm run build` passes
- [x] `python3 -m compileall -q api` passes
- [x] Smoke test: download FLUX-schnell from Models page, confirm cache populates and card status updates *(E2E verified 2026-06-24: job `13947f40-…` succeeded in ~10 min with HF token; `cached_after=true`, ~54 GB cache reported; see `scripts/model_download_test_results.json`)*

---

## 5. Sign-off

This phase is complete when:

1. All checklist items pass.
2. Downloading FLUX-dev from the UI works end-to-end with HF token from vault.
3. Models without HF token configured show clear messaging that token is required.
4. Trigger words appear on at least one LoRA card with embedded metadata.
5. Click-to-copy on a trigger word pill works.

**Phase owner:** David Hendricks
**Drafted:** 2026-05-04
