# Phase 15 — V0.8 SCREENSHOT REGRESSION & FORK MAIN

**Work order for Grok/Codex.** Builds on v0.7 sign-off (`neural-interface-v0.7`).

**Status:** Complete (2026-07-12)
**Depends on:** Phase 14 complete
**Tag:** `neural-interface-v0.8`

---

## 0. Scope

| Package | Features | Priority |
|---|---|---|
| **15A Screenshot regression** | Dashboard + Txt2Img pixel-diff baselines | P2 |
| **15B Fork housekeeping** | Fast-forward `main` to Neural Interface line | P1 |

---

## 15A — Screenshot regression

- [x] `scripts/screenshot_regression.mjs` — headless Chrome CDP @ 1440×1000
- [x] `compare_screenshots.py` — Pillow diff, default ≤1% tolerance
- [x] Baselines committed under `scripts/screenshot_regression/baselines/`
- [x] Volatile Dashboard telemetry and Txt2Img prompt stabilized before capture
- [x] Runbook + `PHASE_6_7_SIGNOFF.md` updated

---

## 15B — Fork default branch

- [x] `main` fast-forwarded to `codex/workspace-cleanup-snapshot`
- [x] Tag `neural-interface-v0.8` on fork

---

## Sign-off

| Suite | Result | Notes |
|---|---|---|
| `screenshot_regression.mjs` | PASS | dashboard ~0.016%, txt2img ~0.015% diff |
| `design_signoff.py` | PASS | 6/6 (unchanged) |
| `smoke_test_neural_interface.py` | PASS | 38 checks |
| `npm run build` | PASS | 13 nav modules |

---

**Phase owner:** David Hendricks
**Drafted:** 2026-07-12