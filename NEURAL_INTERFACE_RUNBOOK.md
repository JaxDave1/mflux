# MFLUX Neural Interface — Runbook

Local UI: `http://127.0.0.1:4173/` · API: `http://127.0.0.1:8189/`

**Agent reference:** `GROK_AGENT_NOTES.md` · **Latest phase:** `PHASE_11_V0_4.md` (v0.4)

## Start

```bash
cd /Volumes/AI_HQ/Codex_and_Stitch_MFLUX_UI/mflux
./scripts/dev.sh
```

Or separately:

```bash
.venv/bin/uvicorn api.main:app --host 127.0.0.1 --port 8189
cd ui && npm run dev
```

## Validate

```bash
cd /Volumes/AI_HQ/Codex_and_Stitch_MFLUX_UI/mflux
.venv/bin/python scripts/smoke_test_neural_interface.py
.venv/bin/python scripts/v0_2_signoff.py
.venv/bin/python scripts/validation_pass.py
node scripts/gallery_bulk_delete_browser_smoke.mjs
node scripts/navigation_state_browser_smoke.mjs
cd ui && npm run build
```

Browser smokes require the UI dev server to be running and launch headless Chrome/Chromium. `gallery_bulk_delete_browser_smoke.mjs` also requires the API server. Set `CHROME_BIN` if Chrome is not installed in a standard location.

### Validation env vars

| Variable | Purpose |
|---|---|
| `MFLUX_VALIDATION_CIVITAI_VERSION_ID` | Override CivitAI LoRA version for E2E (default: `62833`) |
| `MFLUX_SKIP_MODEL_EXPORT_E2E=1` | Skip slow export E2E in routine runs |
| `MFLUX_SKIP_CIVITAI_CLEANUP=1` | Keep CivitAI test LoRA after E2E |

Vault keys (Config → API Keys): `hf`, `civitai`

## Release tags

| Tag | Notes |
|---|---|
| `neural-interface-v0.3` | Shipped on `3940960` |
| `neural-interface-v0.4` | Phase 11 — PNG output + gallery multi-delete UX |

```bash
git tag -a neural-interface-v0.4 -m "MFLUX Neural Interface v0.4"
git push origin codex/workspace-cleanup-snapshot --tags
```

## Gallery bulk delete (v0.4 + post-v0.4 hardening)

1. Check boxes on tiles (top-left), or use **SELECT PAGE** for visible outputs (v0.4).
2. Use **SELECT ALL FILTERED** to select every output matching the current filter/search across pages; confirm the selection first (post-v0.4 hardening).
3. When multiple outputs are selected, per-tile delete buttons are hidden; use **DELETE SELECTED (N)** and confirm the delete.
4. Shift-click / cmd-click tiles to extend selection without checkboxes.

## Section state (post-v0.4 hardening)

Generation controls, LoRA stacks, Gallery filter/search/page, and Models controls stay in memory while navigating between sections. A full browser reload starts from current backend defaults again.

## Output format (v0.4)

All generation jobs write **PNG** files. The Config output-format control was removed. Legacy `outputFormat` values in `config.json` are coerced to `png` on load.

## Troubleshooting

| Symptom | Check |
|---|---|
| Cancel ignored on queue | Restart API after job_manager update; confirm JobPanel dismisses |
| MLX Runtime shows 0 | Normal when idle; rises during active generation |
| Model Disk Cache large | Sum of cached built-in HF repos (FLUX + Z-Image, etc.) |
| Gallery page resets on delete | Fixed v0.3 — stay on page or clamp to last valid page |
| Cannot multi-delete | v0.4 + hardening — use checkboxes, SELECT PAGE, or SELECT ALL FILTERED; BROWSE/SELECT toggle removed |
| Output saved as JPG/WebP | v0.4 — paths normalized to `.png` in `mflux_cli.py` |
