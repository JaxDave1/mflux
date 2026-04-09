#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="${ROOT_DIR}/.venv"
PYTHON_VERSION="${PYTHON_VERSION:-3.13}"

require_command() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Missing required command: ${cmd}" >&2
    exit 1
  fi
}

print_cache_targets() {
  local resolved_hf_home="${HF_HOME:-${HOME}/.cache/huggingface}"
  local resolved_mflux_cache="${MFLUX_CACHE_DIR:-${HOME}/Library/Caches/mflux}"

  if [[ "$(uname)" != "Darwin" ]]; then
    resolved_mflux_cache="${MFLUX_CACHE_DIR:-${HOME}/.cache/mflux}"
  fi

  echo "HF_HOME=${resolved_hf_home}"
  echo "MFLUX_CACHE_DIR=${resolved_mflux_cache}"
  echo "MFLUX_LORA_CACHE_DIR=${resolved_mflux_cache}/loras"
}

setup_env() {
  require_command uv
  cd "${ROOT_DIR}"

  if [[ -n "${HF_HOME:-}" ]]; then
    mkdir -p "${HF_HOME}"
  fi

  if [[ -n "${MFLUX_CACHE_DIR:-}" ]]; then
    mkdir -p "${MFLUX_CACHE_DIR}/loras"
  fi

  if [[ ! -d "${VENV_DIR}" ]]; then
    uv venv --python "${PYTHON_VERSION}" "${VENV_DIR}"
  fi

  # shellcheck source=/dev/null
  source "${VENV_DIR}/bin/activate"
  uv pip install -e .
}

run_step() {
  local label="$1"
  shift
  echo
  echo "==> ${label}"
  "$@"
}

main() {
  setup_env

  echo "Using cache targets:"
  print_cache_targets

  run_step \
    "Warm Z-Image Turbo (txt2img/img2img baseline)" \
    mflux-generate-z-image-turbo \
      --prompt "A neon alley in Tokyo at night with reflective rain-soaked pavement" \
      --width 1024 \
      --height 1024 \
      --seed 42 \
      --steps 9 \
      -q 8 \
      --metadata \
      --output outputs/z_image_turbo_test.png

  run_step \
    "Warm SeedVR2 3B (upscaler)" \
    mflux-upscale-seedvr2 \
      --image-path tests/resources/low_res.jpg \
      --model seedvr2-3b \
      --resolution 2x \
      --softness 0.0 \
      -q 8 \
      --output outputs/seedvr2_test.png

  run_step \
    "Warm Depth Pro" \
    mflux-save-depth \
      --image-path tests/resources/unsplash_dog.jpg \
      -q 8

  run_step \
    "Warm FLUX Fill Dev (inpaint)" \
    mflux-generate-fill \
      --model dev-fill \
      --prompt "Repair the masked region with realistic matching detail" \
      --image-path tests/resources/unsplash_person.jpg \
      --masked-image-path tests/resources/mask.png \
      --seed 42 \
      --steps 25 \
      --metadata \
      --output outputs/fill_test.png

  run_step \
    "Warm FLUX Kontext Dev" \
    mflux-generate-kontext \
      --model dev-kontext \
      --prompt "Transform this into a cinematic neon cyberpunk portrait" \
      --image-path tests/resources/unsplash_person.jpg \
      --width 1024 \
      --height 1024 \
      --seed 42 \
      --steps 25 \
      --metadata \
      --output outputs/kontext_test.png

  run_step \
    "Warm FLUX Dev ControlNet Canny" \
    mflux-generate-controlnet \
      --model dev-controlnet-canny \
      --prompt "A futuristic skyline at dusk with strong architectural edges" \
      --controlnet-image-path tests/resources/skyscrapers.jpg \
      --controlnet-strength 0.8 \
      --controlnet-save-canny \
      --seed 42 \
      --steps 25 \
      --metadata \
      --output outputs/controlnet_test.png

  echo
  echo "Warm-up complete."
  echo "Generated files are in ${ROOT_DIR}/outputs"
  echo "If HF_HOME/MFLUX_CACHE_DIR were set, model assets were cached there."
}

main "$@"
