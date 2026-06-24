# Phase 3 — MODULE 1: TXT2IMG FULL FEATURE BUILD

**Work order for Codex.** Self-contained. Implement against this spec in one pass.

**Status:** Complete (smoke verified 2026-06-24)
**Depends on:** Phases 1 and 2 complete
**Unblocks:** Phase 6 (Module 1 Stitch reskin) and Phase 7 (Modules 2–10 inherit patterns from this)

---

## 0. Scope

Bring Txt2Img to full v0.1 feature parity before any visual reskin. Everything in this phase is functional, not visual. Visual treatment lands in Phase 6.

Five concerns landing together:

1. LoRA stack (multi-LoRA with strength)
2. Running-state UX (Option C placeholder + reveal animation, with Option B opt-in stepwise preview)
3. Seed randomizer + auto-randomize
4. Bucket 1 cheap wins (negative prompt verified, low-ram, auto-seeds, metadata)
5. Defaults loading from per-model registry (consumes Phase 1)
6. W/H layout adjustment

---

## 1. LoRA stack

### 1.1 UI

New section in `Txt2Img.tsx` between `MODEL PIPELINE` and `GENERATION CONTROLS`, full width, labeled `LORA STACK`.

Empty state: "No LoRAs active. Add a LoRA to apply." with `+ ADD LORA` button.

Each row:

```
[ LoRA dropdown (sourced from /api/models/loras) ]  [ Strength slider 0.0—2.0, default 1.0 ]  [ × ]
  ↳ trigger words: word1, word2  (small caption below row, only if known)
```

Maximum 6 rows. `+ ADD LORA` button disabled at 6.

### 1.2 Constraints

- A LoRA can only appear once. Selecting an already-selected LoRA in another row is blocked at the UI level.
- Strength is clamped client-side to 0.0–2.0. Backend re-validates.
- Empty stack is valid. No `loras` field is sent in the params.

### 1.3 Backend contract

Extend Txt2Img params accepted by `POST /api/jobs`:

```typescript
loras?: Array<{
  path: string;       // absolute path to .safetensors
  strength: number;   // 0.0—2.0
}>
```

CLI translation in the txt2img wrapper:
- Each LoRA in array → `--lora-paths <path>` arg
- Each strength → `--lora-scales <strength>` arg
- Order in array preserved on CLI invocation
- Empty array → no `--lora-paths` flag at all

### 1.4 LoRA discovery endpoint

New endpoint: `GET /api/models/loras`

```json
{
  "ok": true,
  "data": {
    "loras": [
      {
        "path": "/Volumes/AI_HQ/SM_Project/Data/Models/lora/style1.safetensors",
        "name": "style1",
        "trigger_words": ["word1", "word2"],
        "size_mb": 144.2
      }
    ]
  }
}
```

Source: scan `LORA_DIR` from Config (and `LORA_LIBRARY_PATH` env if set, per MFLUX README). For each `.safetensors` found, extract trigger words from the file's metadata if present (LoRA files typically embed metadata in the safetensors header — check the `ss_tag_frequency` and `ss_dataset_dirs` keys; if neither exists, return `trigger_words: null`).

### 1.5 Validation

Add `lora_not_found` to `JobError.type` taxonomy in `JOBS_API_SPEC.md` §6:

```
lora_not_found | LoRA path no longer exists at submit time | Refresh LoRA list, re-select
```

If a stacked LoRA's path doesn't exist when the job spawns, return 400 before subprocess spawn, with `error.type: "lora_not_found"` and the offending path in the message.

---

## 2. Running-state UX

### 2.1 Option C: placeholder + reveal animation

When a Txt2Img job is `queued` or `running`, the output preview area on the right side of the page shows:

- Carbon-composite substrate (per DESIGN_LOCK §5.4)
- Centered animated placeholder: a pulsing cyan-teal sweep effect, low-amplitude
- Below the sweep: "GENERATING..." in brushed titanium, with elapsed time `mm:ss` ticking up
- Below that: current step `Step N / Total` if step parser is producing data, otherwise blank
- A subtle scanline animation crossing the substrate every ~2s to convey active work

When the job transitions to `succeeded`:
- Sweep stops, fade out over 200ms
- Generated image fades in from black over 400ms
- Brief cyan glow rim around the image (200ms peak, 400ms fade) on first reveal

Use the JobPanel's existing SSE subscription — don't open a second stream.

### 2.2 Option B: opt-in stepwise preview

New control on Txt2Img form, near the seed input: **`LIVE PREVIEW`** toggle, default OFF.

When ON, submit includes:
```
--stepwise-image-output-dir <api_owned_temp_dir>
```

The API owns the temp dir per job: `/tmp/mflux_stepwise/{job_id}/`.

Backend filesystem watcher per running job: when `LIVE PREVIEW` is on, watch the per-job directory for new `.png` files. When a new file lands, send an SSE event `event: stepwise_image` with `data: {"path": "/api/jobs/{job_id}/stepwise/{filename}"}`.

New endpoint: `GET /api/jobs/{job_id}/stepwise/{filename}` — serves the stepwise image file.

Frontend, when receiving `stepwise_image` event: replace the placeholder content with the latest stepwise image, fading the previous out (150ms cross-fade). The reveal animation in §2.1 still plays on final completion.

User-facing copy near the toggle: "Show generation progress (slower, ~10–30% longer per generation)"

### 2.3 Cleanup

When a job reaches a terminal state (any of `succeeded`, `failed`, `cancelled`, `timed_out`), delete `/tmp/mflux_stepwise/{job_id}/`. Periodic janitor at startup also cleans orphaned dirs older than 24h.

---

## 3. Seed randomizer

### 3.1 UI

Modify the SEED row in `Txt2Img.tsx`:

```
SEED
[ 42 ] [ 🎲 ]   (number input + dice icon button)

[x] Auto-randomize on each generation   (checkbox below)
```

- 🎲 button: fills the input with `Math.floor(Math.random() * 2147483647)`
- Auto-randomize checkbox: when checked, before each submit, the form re-rolls the seed. The displayed seed updates to the new value so the user can see what was used.

Auto-randomize state persists across page navigation within the session (React state in app shell or Zustand store, not localStorage).

---

## 4. Bucket 1 cheap wins

Add these controls to Txt2Img:

### 4.1 `--low-ram` toggle

New checkbox in `GENERATION CONTROLS`: **`LOW RAM MODE`**, default OFF, labeled with subtitle "Reduces memory pressure on 16/32GB systems."

When checked, submit includes `--low-ram` flag.

### 4.2 `--auto-seeds N`

When the user wants multiple seeds in one submit, they can already enter multiple seeds in the seed field (comma-separated). Add this support:

- Seed input now accepts: single integer (`42`), or comma-separated list (`42, 123, 456`), or `auto:N` (e.g., `auto:5`)
- `auto:N` translates to `--auto-seeds N` on submit
- Comma-separated translates to repeated `--seed` flags
- Single integer stays as one `--seed` flag

If the seed field has multiple seeds and `LIVE PREVIEW` is on, only the first seed's stepwise images are streamed (limitation, not a bug — document as known limitation).

### 4.3 `--metadata` flag

Sourced from Phase 1 Config: there should be a "Save metadata sidecar" toggle in Config that defaults ON. If that flag isn't there yet, add it as part of this phase. When ON, all generation submits include `--metadata`.

(Even without the flag, README says metadata is embedded in the image. The sidecar `.json` is the explicit version.)

---

## 5. Defaults loading from per-model registry

### 5.1 Behavior

When the Model dropdown changes:

1. Frontend calls `GET /api/models/{name}/defaults`
2. Form fields `steps`, `guidance`, `quantize` update to the returned defaults
3. If the user has manually edited any of these fields, **don't overwrite the manual edit** — track per-field "dirty" state, only update fields that haven't been touched

When the page first loads:

1. Frontend calls `GET /api/modules/txt2img/defaults`
2. Returns: model + steps + guidance + quantize + width + height
3. Form initialized with these values
4. Width/Height defaults: 1024 × 1024 always

If the model has `guidance: null` (e.g., Schnell), hide the Guidance slider entirely on this page. When the user switches to a model with guidance, the slider reappears.

---

## 6. W/H layout adjustment

`GENERATION CONTROLS` panel current layout:
```
[Steps slider]      [Guidance slider]
[Width slider]      [Height slider]
```

Change to full-width stacked rows:
```
[Steps slider — full width]
[Guidance slider — full width]
[Width slider — full width]
[Height slider — full width]
```

This makes Width and Height visually paired (directly above/below) per your spec.

---

## 7. Implementation checklist

- [x] `LoRAStack.tsx` component with up to 6 rows
- [x] LoRA dropdown sources from `GET /api/models/loras`
- [x] LoRA strength slider 0.0–2.0
- [x] LoRA constraint: no duplicate paths in stack
- [x] Trigger words display when present
- [x] `loras` array in Txt2Img job submit params
- [x] CLI translation: `--lora-paths` and `--lora-scales` repeated args
- [x] `GET /api/models/loras` endpoint with safetensors metadata extraction
- [x] `lora_not_found` error type added to JOBS_API_SPEC.md §6 and JobError taxonomy
- [x] `RunningStatePreview.tsx` component with placeholder + reveal animation
- [x] Reveal animation: 200ms sweep stop, 400ms image fade-in, 400ms cyan rim glow *(step preview 150ms fade; final output 400ms fade + 400ms cyan rim in `RunningStatePreview.tsx`)*
- [x] LIVE PREVIEW toggle on form
- [x] `--stepwise-image-output-dir` injected when LIVE PREVIEW on
- [x] Stepwise file watcher per running job
- [x] `GET /api/jobs/{id}/stepwise/{filename}` serves stepwise images
- [x] SSE `stepwise_image` event type
- [x] Stepwise dir cleanup on terminal state
- [x] Stepwise dir startup janitor for orphans >24h
- [x] Seed randomizer 🎲 button
- [x] Auto-randomize-on-submit checkbox, persists in session
- [x] LOW RAM MODE checkbox, injects `--low-ram`
- [x] Multi-seed input parsing: single, comma-separated, `auto:N`
- [x] Metadata sidecar toggle in Config (default ON)
- [x] Model change → defaults load from `/api/models/{name}/defaults`
- [x] Page mount → defaults from `/api/modules/txt2img/defaults`
- [x] Manual field edits not overwritten by defaults reload
- [x] Guidance slider hidden when model `guidance: null`
- [x] W/H layout converted to full-width stacked rows
- [x] `npm run build` passes
- [x] `python3 -m compileall -q api` passes
- [x] Smoke test: Txt2Img job accepted and succeeded at 256×256 / 1 step with `livePreview` + `lowRam`
- [x] Validation: LoRA stack strengths produce distinct outputs on `z-image-turbo` *(2026-06-24 `scripts/validation_pass.py`)*
- [x] Validation: LIVE PREVIEW writes stepwise PNGs during denoise *(2026-06-24 `scripts/validation_pass.py`)*

---

## 8. Sign-off

This phase is complete when:

1. All checklist items pass.
2. A live Txt2Img run with LIVE PREVIEW on shows stepwise images appearing in the preview area as MFLUX denoises.
3. Two LoRAs at different strengths produce visibly different output than no LoRAs.
4. Switching model from Z-Image-Turbo → FLUX-dev auto-updates steps from 9 → 25 in the form (unless user has dirtied the field).
5. Auto-randomize re-rolls the seed on each submit and the new seed value is visible in the form.
6. All BUCKET 1 cheap wins exposed and tested.

**Phase owner:** David Hendricks
**Drafted:** 2026-05-04
