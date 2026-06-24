# MFLUX Neural Interface — Runbook

Local UI: `http://127.0.0.1:4173/` · API: `http://127.0.0.1:8189/`

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
cd ui && npm run build
```

### Validation env vars

| Variable | Purpose |
|---|---|
| `MFLUX_VALIDATION_CIVITAI_VERSION_ID` | Override CivitAI LoRA version for E2E (default: `62833`) |
| `MFLUX_SKIP_MODEL_EXPORT_E2E=1` | Skip slow export E2E in routine runs |
| `MFLUX_SKIP_CIVITAI_CLEANUP=1` | Keep CivitAI test LoRA after E2E |

Vault keys (Config → API Keys): `hf`, `civitai`

## Release tag

```bash
git tag -a neural-interface-v0.3 -m "MFLUX Neural Interface v0.3"
git push origin codex/workspace-cleanup-snapshot --tags
```

## Troubleshooting

| Symptom | Check |
|---|---|
| Cancel ignored on queue | Restart API after job_manager update; confirm JobPanel dismisses |
| MLX Runtime shows 0 | Normal when idle; rises during active generation |
| Model Disk Cache large | Sum of cached built-in HF repos (FLUX + Z-Image, etc.) |
| Gallery page resets on delete | Fixed v0.3 — stay on page or clamp to last valid page |