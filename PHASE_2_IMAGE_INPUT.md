# Phase 2 — IMAGE INPUT + VERIFICATION FIXES

**Work order for Codex.** Self-contained. Implement against this spec in one pass.

**Status:** Complete (smoke verified 2026-06-24)
**Depends on:** Phase 1 complete
**Unblocks:** Phase 3 (Module 1) cleanly; Phase 7 (Modules 2–10) reskins

---

## 0. Scope

Two parallel concerns landing in one PR:

1. **Unified image input component** — replace 6 inconsistent implementations with one shared component
2. **Verification fixes** — confirm/correct hallucinated controls and incorrect defaults found in screenshot audit

---

## 1. Unified image input component

### 1.1 The component

New file: `ui/src/components/ImageInput.tsx`

```typescript
interface ImageInputProps {
  label: string;                    // e.g., "Reference Image", "Mask Image"
  value: string | null;             // current path
  onChange: (path: string | null) => void;
  defaultPath?: string;             // pre-fill on mount (used by Track B's use-as-reference)
  acceptedTypes?: string[];         // default: ['image/png', 'image/jpeg', 'image/webp']
  required?: boolean;
}
```

### 1.2 Behavior

The component supports three input methods:

1. **Drag-and-drop** — drop zone with visual feedback on drag-over
2. **File picker** — "Browse..." button opens native file dialog
3. **Path paste** — text field accepts an absolute or relative path

When any of these sets a value:
- Image preview renders below the input controls
- Clear button (×) appears in the corner of the preview
- `onChange` fires with the new path

When `defaultPath` is provided on mount, the component auto-loads that path as if the user pasted it. Used by Phase 4 Gallery's "use-as-reference" feature, which navigates to a generation page with `?ref=<path>` and the page passes the param into ImageInput as `defaultPath`.

### 1.3 Backend support

New endpoint: `POST /api/uploads/temp` (multipart form data)

- Accepts an uploaded file
- Saves to a temp directory the API owns: `/tmp/mflux_uploads/{uuid}.{ext}`
- Returns `{"ok": true, "data": {"path": "/tmp/mflux_uploads/abc123.png"}}`
- Files older than 24h are cleaned up on a periodic janitor task (or at API startup, simpler)

This replaces any existing per-module upload endpoints. Drag-and-drop and file picker both POST here, then store the returned path in `value`. Pasted paths skip this endpoint.

### 1.4 Replacements

Replace existing image input UI in these six pages with `<ImageInput>`:

- `ui/src/pages/Img2Img.tsx` — currently uses drag-drop
- `ui/src/pages/Inpaint.tsx` — currently uses drag-drop, has TWO inputs (image + mask)
- `ui/src/pages/ControlNet.tsx` — currently uses drag-drop
- `ui/src/pages/Kontext.tsx` — currently uses drag-drop
- `ui/src/pages/Upscaler.tsx` — currently typed text path only — UPGRADE
- `ui/src/pages/DepthPro.tsx` — currently typed text path only — UPGRADE

After this phase, all six modules have identical image input UX.

### 1.5 Use-as-reference contract

Generation pages that accept image input MUST honor the `?ref=<absolute_path>` query parameter on mount:

```typescript
const [searchParams] = useSearchParams();
const refPath = searchParams.get('ref');

<ImageInput
  label="Reference Image"
  value={imagePath}
  onChange={setImagePath}
  defaultPath={refPath ?? undefined}
/>
```

This contract is consumed by Phase 4 Gallery's "use-as-reference" feature. Phase 2 lands the contract; Phase 4 lands the consumer.

---

## 2. Verification fixes

### 2.1 Upscaler "Softness" slider

Live screenshot shows a `SOFTNESS` slider on the Upscaler page. README documents NO `--softness` flag for `mflux-upscale-seedvr2`.

**Action:** Codex verifies whether the slider is wired to anything.

- If wired to nothing: remove the slider from `Upscaler.tsx` and any related submit payload.
- If wired to a custom argument that exists in the wrapper: document it in `CLI_CAPABILITY_MATRIX.md` with a note explaining what it does (`Softness` likely means a post-processing blur — find out, write it down).
- If unclear: remove and treat as hallucination. Better to ship without than ship a fake.

Update `CLI_CAPABILITY_MATRIX.md` with the resolution either way.

### 2.2 Inpaint guidance default

Decision locked: change default from current value to **30.0** per MFLUX README §"Tips for Best Results" for the Fill tool.

- Update default in `Inpaint.tsx` form initialization
- Update per-model defaults registry from Phase 1 (`fill-dev` already shows 30.0 — verify)
- Verify on next inpaint run that submitted guidance is 30.0 unless user override

### 2.3 Kontext guidance default

Per MFLUX README, Kontext default is **2.5**, optimal range 2.0–4.0.

- Update default in `Kontext.tsx` form initialization
- Per-model defaults registry already shows `dev-kontext: guidance 2.5` — verify
- Verify on next kontext run

### 2.4 Negative prompt verification

README §"Current limitations" claims "Negative prompts not supported," but `--negative-prompt` flag is documented. Test whether negative prompts actually influence generation:

1. Generate two images with same prompt + seed, one with empty negative prompt, one with strong negative ("blurry, low quality, ugly")
2. Compare visually
3. If outputs differ → negative prompt works, README §"Current limitations" is stale, document in `CLI_CAPABILITY_MATRIX.md`
4. If outputs are identical → negative prompt is ignored, file MFLUX upstream issue, hide negative prompt field across all modules until upstream fixes it

Result documented in `CLI_CAPABILITY_MATRIX.md` regardless.

---

## 3. Implementation checklist

- [x] `ui/src/components/ImageInput.tsx` created with full feature set per §1.1–§1.2
- [x] `POST /api/uploads/temp` endpoint with file save and path return
- [x] Temp file janitor (startup or periodic)
- [x] `Img2Img.tsx` — converted to ImageInput
- [x] `Inpaint.tsx` — converted to ImageInput (×2 for image + mask)
- [x] `ControlNet.tsx` — converted to ImageInput
- [x] `Kontext.tsx` — converted to ImageInput
- [x] `Upscaler.tsx` — converted to ImageInput (was typed-only)
- [x] `DepthPro.tsx` — converted to ImageInput (was typed-only)
- [x] All six pages honor `?ref=` query param via `defaultPath` prop
- [x] Upscaler Softness slider verified — wired to `--softness` in `mflux_cli.py` (SeedVR2 CLI support)
- [x] Inpaint guidance default = 30.0
- [x] Kontext guidance default = 2.5
- [x] Negative prompt behavior verified in live testing *(2026-06-24: `z-image` same-seed outputs differ with strong negative; `z-image-turbo` keeps field hidden because distilled turbo runs at `guidance=0`; see `CLI_CAPABILITY_MATRIX.md` validation table)*
- [x] `CLI_CAPABILITY_MATRIX.md` updated with all verification results
- [x] `npm run build` passes
- [x] `python3 -m compileall -q api` passes
- [x] Smoke test: `POST /api/uploads/temp` persists image path; UI drag-and-drop uses same endpoint *(full per-module generation E2E not re-run in 2026-06-24 pass)*

---

## 4. Sign-off

This phase is complete when:

1. All checklist items pass.
2. The six modules with image input show identical UX.
3. `?ref=` contract works manually: navigate to e.g. `/img2img?ref=/tmp/test.png`, confirm image pre-loads.
4. No fake controls remain on Upscaler.
5. Inpaint and Kontext guidance defaults match MFLUX recommendations.

**Phase owner:** David Hendricks
**Drafted:** 2026-05-04
