# Phase 4 — GALLERY V0.1 FUNCTIONAL GAPS

**Work order for Codex.** Self-contained. Implement against this spec in one pass.

**Status:** Complete (smoke verified 2026-06-24)
**Depends on:** Phase 2 (use-as-reference contract relies on `?ref=` query param)
**Unblocks:** Phase 6 (Module 1 Stitch reskin reflects complete feature set)

---

## 0. Scope

Three v0.1 Gallery features. Multi-select, favorites, and metadata viewer are deferred to v0.2 per scope decision.

1. Delete image (single, with confirmation)
2. Open in Finder
3. Use as reference (route to generation module with image pre-loaded)

---

## 1. Delete image

### 1.1 UI

In the Output Details panel (right side, current screenshot), add a button below the metadata strip:

```
[ DELETE OUTPUT ]   (anodized button per DESIGN_LOCK §5.5, with status-error #FF4D6B accent)
```

On click, show a confirmation modal:

```
DELETE OUTPUT?

This permanently deletes the image and its metadata sidecar.
This cannot be undone.

[ CANCEL ]   [ DELETE ]
```

DELETE button uses the error-state color treatment. Modal blocks interaction with the rest of the UI until dismissed.

### 1.2 Backend

New endpoint: `DELETE /api/gallery/{id}`

- `id` is the gallery item identifier used elsewhere in `/api/gallery` endpoints
- Deletes the image file at the resolved absolute path
- Also deletes the `.json` metadata sidecar if present (same basename, `.json` extension)
- Returns `{"ok": true, "data": {"deleted_path": "...", "metadata_deleted": true}}` or 404 if id unknown

Safety: backend MUST verify the resolved path is within `OUTPUT_DIR` from Config before deleting. Reject any path that resolves outside `OUTPUT_DIR` with 400. This prevents path traversal attacks via crafted IDs.

### 1.3 Frontend behavior on success

- Item removed from the output feed grid
- If the deleted item was the one shown in Output Details, switch to the next item or empty state
- Total Outputs count decrements
- "WITH METADATA" count decrements if applicable

---

## 2. Open in Finder

### 2.1 UI

In the Output Details panel, next to (or below) the DELETE button:

```
[ REVEAL IN FINDER ]   (regular button per DESIGN_LOCK §7.3)
```

### 2.2 Backend

New endpoint: `POST /api/gallery/{id}/reveal`

- Resolves the absolute path of the gallery item
- Verifies path is within `OUTPUT_DIR` (same safety as delete)
- Executes `subprocess.run(['open', '-R', resolved_path])` (macOS-specific)
- Returns `{"ok": true}` on subprocess success, error envelope on failure

Note: `open -R` is the macOS shell command that selects a file in Finder. This is a local-first app on macOS only — no cross-platform requirement.

---

## 3. Use as reference

### 3.1 UI

In the Output Details panel, a new section labeled `USE THIS OUTPUT IN`:

```
USE THIS OUTPUT IN

[ IMG2IMG ]   [ INPAINT ]   [ CONTROLNET ]   [ KONTEXT ]   [ UPSCALER ]   [ DEPTH PRO ]
```

Six buttons, each navigates to the corresponding module page with the image pre-loaded via the `?ref=` query parameter contract from Phase 2.

### 3.2 Frontend behavior

On button click:
1. Resolve the gallery item's absolute path
2. `navigate(\`/${module}?ref=${encodeURIComponent(absolutePath)}\`)`
3. Target page's `ImageInput` component honors `defaultPath` from `?ref=` and pre-loads the image

For Inpaint (which has TWO image inputs — image + mask), the `?ref=` loads into the image input only. User must still provide a mask.

### 3.3 Backend support

No new endpoints. The Phase 2 contract already supports this: `?ref=<absolute_path>` → `ImageInput defaultPath` → image loads.

If the path doesn't exist when the target page loads (e.g., user deleted the file between selecting and navigating), the ImageInput component shows an error state: "Reference image not found at <path>" with a clear button to dismiss.

---

## 4. Implementation checklist

- [x] `DELETE /api/gallery/{id}` endpoint with path safety check
- [x] Confirmation modal component for destructive actions
- [x] Delete button + modal in Output Details panel
- [x] Frontend: item removal from feed on successful delete
- [x] Frontend: gallery counts update on delete
- [x] `POST /api/gallery/{id}/reveal` endpoint
- [x] Reveal in Finder button in Output Details panel
- [x] `USE THIS OUTPUT IN` section with 6 module buttons
- [x] Buttons navigate with correctly-encoded `?ref=` query param
- [x] ImageInput's missing-file error state handled gracefully
- [x] Path traversal protection on both delete and reveal endpoints
- [x] `npm run build` passes
- [x] `python3 -m compileall -q api` passes
- [x] Smoke test: delete synthetic gallery item removes PNG + metadata sidecar from disk
- [x] Smoke test: `POST /api/gallery/{id}/reveal` succeeds on macOS (Finder `open -R`)
- [x] Smoke test: generate an image, click USE IN IMG2IMG, verify Img2Img loads with image pre-filled *(2026-06-24 v0.1 sign-off: `tests/validation/test_gallery_reference.py` covers URL contract; `scripts/validation_pass.py` completes Img2Img from a gallery output path; UI uses `useGalleryReference` + `ImageInput defaultPath` for `?ref=` preload)*

---

## 5. Sign-off

- [x] Gallery → Img2Img backend handoff validated *(2026-06-24: `scripts/validation_pass.py` accepted and completed an Img2Img job from a gallery output path; URL contract covered by `tests/validation/test_gallery_reference.py`)*

This phase is complete when:

1. All checklist items pass.
2. Deleting an image from gallery UI also deletes the file and metadata sidecar from disk.
3. Path traversal attempts (e.g., crafted IDs that resolve outside OUTPUT_DIR) are rejected with 400.
4. Use-as-reference flow: gallery → Img2Img with pre-filled image, generation succeeds end-to-end.

**Phase owner:** David Hendricks
**Drafted:** 2026-05-04
