"""Measure unintended pixel changes in still viewer frame sequences."""

from __future__ import annotations

import argparse
import glob
import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Sequence

import numpy as np
from PIL import Image


@dataclass(frozen=True)
class FramePairMeasurement:
  pair: str
  changed_pixels: int
  changed_percent: float
  visible_pixels: int
  visible_percent: float
  mean_absolute_delta: float
  maximum_delta: int
  bounding_box: tuple[int, int, int, int] | None


def _rgb_pixels(path: Path) -> np.ndarray:
  with Image.open(path) as image:
    return np.asarray(image.convert("RGB"), dtype=np.int16)


def measure_frame_pair(
  left_path: Path,
  right_path: Path,
  visible_delta: int = 12,
) -> FramePairMeasurement:
  """Compare two equal-size PNG frames using a perceptible RGB threshold."""
  left = _rgb_pixels(left_path)
  right = _rgb_pixels(right_path)
  if left.shape != right.shape:
    raise ValueError(
      f"Frame dimensions differ: {left_path} {left.shape} != {right_path} {right.shape}"
    )
  delta = np.abs(right - left)
  changed = np.any(delta > 0, axis=2)
  visible = np.any(delta > visible_delta, axis=2)
  y_values, x_values = np.where(changed)
  bounding_box = (
    None
    if x_values.size == 0
    else (
      int(x_values.min()),
      int(y_values.min()),
      int(x_values.max()),
      int(y_values.max()),
    )
  )
  return FramePairMeasurement(
    pair=f"{left_path.name} -> {right_path.name}",
    changed_pixels=int(changed.sum()),
    changed_percent=float(changed.mean() * 100),
    visible_pixels=int(visible.sum()),
    visible_percent=float(visible.mean() * 100),
    mean_absolute_delta=float(delta.mean()),
    maximum_delta=int(delta.max()),
    bounding_box=bounding_box,
  )


def measure_sequence(
  mode: str,
  paths: Sequence[Path],
  visible_delta: int = 12,
  maximum_visible_percent: float = 0.1,
) -> dict[str, object]:
  """Measure consecutive frames and return a release-friendly mode report."""
  if len(paths) < 2:
    raise ValueError(f"{mode} needs at least two frames, got {len(paths)}")
  pairs = [
    measure_frame_pair(left, right, visible_delta)
    for left, right in zip(paths, paths[1:])
  ]
  max_visible = max(pair.visible_percent for pair in pairs)
  return {
    "mode": mode,
    "frame_count": len(paths),
    "visible_delta_threshold": visible_delta,
    "maximum_visible_percent_allowed": maximum_visible_percent,
    "maximum_visible_percent_measured": max_visible,
    "exactly_stable": all(pair.changed_pixels == 0 for pair in pairs),
    "passed": max_visible <= maximum_visible_percent,
    "pairs": [asdict(pair) for pair in pairs],
  }


def _parse_sequence(specification: str) -> tuple[str, list[Path]]:
  if "=" not in specification:
    raise ValueError(f"Invalid --sequence {specification!r}; expected MODE=GLOB")
  mode, pattern = specification.split("=", 1)
  paths = [
    Path(path)
    for path in sorted(
      glob.glob(pattern),
      key=lambda value: [
        int(part) if part.isdigit() else part.lower()
        for part in re.split(r"(\d+)", value)
      ],
    )
  ]
  if not mode or not pattern:
    raise ValueError(f"Invalid --sequence {specification!r}; expected MODE=GLOB")
  return mode, paths


def main(argv: Sequence[str] | None = None) -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--sequence",
    action="append",
    required=True,
    metavar="MODE=GLOB",
    help="Named still-frame sequence; repeat for Day, Night and Minecraft.",
  )
  parser.add_argument("--visible-delta", type=int, default=12)
  parser.add_argument("--maximum-visible-percent", type=float, default=0.1)
  parser.add_argument("--output", type=Path)
  args = parser.parse_args(argv)

  reports = []
  for specification in args.sequence:
    mode, paths = _parse_sequence(specification)
    reports.append(
      measure_sequence(
        mode,
        paths,
        visible_delta=args.visible_delta,
        maximum_visible_percent=args.maximum_visible_percent,
      )
    )
  result = {"passed": all(report["passed"] for report in reports), "modes": reports}
  encoded = json.dumps(result, indent=2) + "\n"
  if args.output:
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(encoded, encoding="utf-8")
  print(encoded, end="")
  return 0 if result["passed"] else 1


if __name__ == "__main__":
  raise SystemExit(main())
