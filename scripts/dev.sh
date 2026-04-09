#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-8188}"
UI_PORT="${UI_PORT:-4173}"

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then kill "$API_PID" >/dev/null 2>&1 || true; fi
  if [[ -n "${UI_PID:-}" ]]; then kill "$UI_PID" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

cd "$ROOT_DIR"
PYTHONPATH="$ROOT_DIR/src" python3 -m uvicorn api.main:app --reload --port "$API_PORT" &
API_PID=$!

cd "$ROOT_DIR/ui"
npm run dev -- --host 127.0.0.1 --port "$UI_PORT" &
UI_PID=$!

sleep 3
if command -v open >/dev/null 2>&1; then
  open "http://127.0.0.1:${UI_PORT}"
fi

wait "$API_PID" "$UI_PID"
