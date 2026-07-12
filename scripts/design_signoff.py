#!/usr/bin/env python3
"""Phase 6/7 design sign-off checks against DESIGN_LOCK.md."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UI_SRC = ROOT / "ui" / "src"

BARE_LOADING = re.compile(
    r'["\'](?:Loading\.\.\.|Loading[^"\']*\.\.\.)',
    re.IGNORECASE,
)

MODULE_ROUTES = [
    "Txt2Img.tsx",
    "Img2Img.tsx",
    "Flux2Edit.tsx",
    "FiboEdit.tsx",
    "Inpaint.tsx",
    "ControlNet.tsx",
    "Kontext.tsx",
    "Upscaler.tsx",
    "DepthPro.tsx",
    "Gallery.tsx",
    "Models.tsx",
    "Config.tsx",
]

REQUIRED_CSS_TOKENS = [
    "--color-bg-deep",
    "--color-accent-cyan",
    "--font-display",
    "--space-4",
    "--radius-md",
    ".titanium-text",
    ".titanium-rail",
    ".module-reskin-page",
]

CHECKS: list[tuple[str, bool, str]] = []


def record(name: str, passed: bool, detail: str = "") -> None:
    CHECKS.append((name, passed, detail))


def check_bare_loading() -> None:
    hits: list[str] = []
    for path in UI_SRC.rglob("*.tsx"):
        text = path.read_text(encoding="utf-8")
        for match in BARE_LOADING.finditer(text):
            hits.append(f"{path.relative_to(ROOT)}: {match.group(0)!r}")
    record(
        "no_bare_loading_text",
        not hits,
        "; ".join(hits) if hits else "ui/src has no bare Loading... copy",
    )


def check_module_shells() -> None:
    missing: list[str] = []
    for name in MODULE_ROUTES:
        path = UI_SRC / "pages" / name
        text = path.read_text(encoding="utf-8")
        if "module-reskin-page" not in text and name != "Dashboard.tsx":
            missing.append(name)
    record(
        "module_reskin_shell",
        not missing,
        f"missing module-reskin-page: {', '.join(missing)}" if missing else "all module pages use reskin shell",
    )


def check_orphan_module_page() -> None:
    orphan = UI_SRC / "pages" / "ModulePage.tsx"
    record("no_orphan_module_page", not orphan.exists(), "ModulePage.tsx removed")


def check_long_running_job_ux_doc() -> None:
    doc = ROOT / "LONG_RUNNING_JOB_UX.md"
    record("long_running_job_ux_doc", doc.exists(), str(doc.relative_to(ROOT)))


def check_design_lock_tokens() -> None:
    css = (UI_SRC / "index.css").read_text(encoding="utf-8")
    missing = [token for token in REQUIRED_CSS_TOKENS if token not in css]
    record(
        "design_lock_css_tokens",
        not missing,
        f"missing: {', '.join(missing)}" if missing else "index.css includes locked tokens",
    )


def check_running_state_preview() -> None:
    path = UI_SRC / "components" / "RunningStatePreview.tsx"
    text = path.read_text(encoding="utf-8")
    required = ["ELAPSED", "ETA", "Cancel", "bar-fill"]
    missing = [item for item in required if item not in text]
    record(
        "running_state_preview_contract",
        not missing,
        f"missing: {', '.join(missing)}" if missing else "RunningStatePreview implements §10 fields",
    )


def main() -> int:
    check_bare_loading()
    check_module_shells()
    check_orphan_module_page()
    check_long_running_job_ux_doc()
    check_design_lock_tokens()
    check_running_state_preview()

    passed = sum(1 for _, ok, _ in CHECKS if ok)
    failed = sum(1 for _, ok, _ in CHECKS if not ok)

    for name, ok, detail in CHECKS:
        status = "PASS" if ok else "FAIL"
        suffix = f" — {detail}" if detail else ""
        print(f"[{status}] {name}{suffix}")

    print(f"\n{passed} PASS / {failed} FAIL")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())