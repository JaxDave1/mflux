#!/usr/bin/env python3
"""Compare PNG screenshots with a pixel-diff tolerance."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageChops


def diff_percent(baseline: Image.Image, current: Image.Image) -> float:
    if baseline.size != current.size:
        raise ValueError(f"size mismatch: {baseline.size} vs {current.size}")

    diff = ImageChops.difference(baseline.convert("RGB"), current.convert("RGB"))
    histogram = diff.histogram()
    # RGB histogram: 256 bins per channel
    total_pixels = baseline.size[0] * baseline.size[1]
    changed = 0
    for channel in range(3):
        channel_hist = histogram[channel * 256 : (channel + 1) * 256]
        for value, count in enumerate(channel_hist):
            if value:
                changed += count
    # Each differing pixel can count up to 3 channel hits; normalize per pixel.
    return (changed / (total_pixels * 3)) * 100.0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("baseline", type=Path)
    parser.add_argument("current", type=Path)
    parser.add_argument("--max-diff-percent", type=float, default=1.0)
    parser.add_argument("--write-diff", type=Path, default=None)
    args = parser.parse_args()

    baseline = Image.open(args.baseline)
    current = Image.open(args.current)
    percent = diff_percent(baseline, current)

    if args.write_diff and percent > 0:
        diff_image = ImageChops.difference(baseline.convert("RGB"), current.convert("RGB"))
        args.write_diff.parent.mkdir(parents=True, exist_ok=True)
        diff_image.save(args.write_diff)

    print(f"{args.baseline.name}: {percent:.3f}% pixel diff (max {args.max_diff_percent:.3f}%)")
    return 0 if percent <= args.max_diff_percent else 1


if __name__ == "__main__":
    sys.exit(main())