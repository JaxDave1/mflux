#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_PORT="${API_PORT:-8189}"
UI_PORT="${UI_PORT:-4173}"
PYTHON_BIN="${ROOT_DIR}/.venv/bin/python"

if [[ ! -x "${PYTHON_BIN}" ]]; then
  PYTHON_BIN="python3"
fi

ensure_api_runtime() {
  if "$PYTHON_BIN" -c "import uvicorn, fastapi, multipart" >/dev/null 2>&1; then
    return
  fi

  cat >&2 <<EOF
Backend runtime dependencies are missing for ${PYTHON_BIN}.

Bootstrap the repo environment with:
  cd "${ROOT_DIR}"
  uv pip install --python "${ROOT_DIR}/.venv/bin/python" -e . -r api/requirements.txt

Then rerun:
  ./scripts/dev.sh
EOF
  exit 1
}

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then kill "$API_PID" >/dev/null 2>&1 || true; fi
  if [[ -n "${UI_PID:-}" ]]; then kill "$UI_PID" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

cd "$ROOT_DIR"
ensure_api_runtime
PYTHONPATH="$ROOT_DIR/src" "$PYTHON_BIN" -m uvicorn api.main:app --reload --port "$API_PORT" &
API_PID=$!

cd "$ROOT_DIR/ui"
npm run dev -- --host 127.0.0.1 --port "$UI_PORT" &
UI_PID=$!

sleep 3
if command -v open >/dev/null 2>&1; then
  open "http://127.0.0.1:${UI_PORT}"
fi

wait "$API_PID" "$UI_PID"
