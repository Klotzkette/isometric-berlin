from pathlib import Path

import numpy as np
from PIL import Image

from isometric_berlin.generation.measure_temporal_stability import (
  _parse_sequence,
  main,
  measure_frame_pair,
  measure_sequence,
)


def write_frame(path: Path, pixels: np.ndarray) -> None:
  Image.fromarray(pixels.astype(np.uint8)).save(path)


def test_identical_sequence_is_exactly_stable(tmp_path: Path) -> None:
  pixels = np.full((12, 16, 3), 120, dtype=np.uint8)
  paths = [tmp_path / f"day-{index}.png" for index in range(3)]
  for path in paths:
    write_frame(path, pixels)

  report = measure_sequence("day", paths)

  assert report["passed"] is True
  assert report["exactly_stable"] is True
  assert report["maximum_visible_percent_measured"] == 0


def test_subthreshold_capture_noise_is_not_visible_flicker(tmp_path: Path) -> None:
  left = np.full((10, 10, 3), 80, dtype=np.uint8)
  right = left.copy()
  right[2, 3] += 3
  left_path = tmp_path / "left.png"
  right_path = tmp_path / "right.png"
  write_frame(left_path, left)
  write_frame(right_path, right)

  measurement = measure_frame_pair(left_path, right_path)

  assert measurement.changed_pixels == 1
  assert measurement.visible_pixels == 0
  assert measurement.maximum_delta == 3


def test_default_rejects_even_one_visibly_changed_pixel(tmp_path: Path) -> None:
  left = np.zeros((20, 20, 3), dtype=np.uint8)
  right = left.copy()
  right[7, 11] = 255
  paths = [tmp_path / "day-0.png", tmp_path / "day-1.png"]
  write_frame(paths[0], left)
  write_frame(paths[1], right)

  report = measure_sequence("day", paths)

  assert report["maximum_visible_percent_allowed"] == 0
  assert report["maximum_visible_percent_measured"] == 0.25
  assert report["passed"] is False


def test_visible_change_fails_sequence_and_cli(tmp_path: Path) -> None:
  left = np.zeros((10, 10, 3), dtype=np.uint8)
  right = left.copy()
  right[:2, :2] = 255
  write_frame(tmp_path / "night-0.png", left)
  write_frame(tmp_path / "night-1.png", right)

  report = measure_sequence(
    "night",
    sorted(tmp_path.glob("night-*.png")),
    maximum_visible_percent=0.1,
  )

  assert report["passed"] is False
  assert report["maximum_visible_percent_measured"] == 4
  assert (
    main(
      [
        "--sequence",
        f"night={tmp_path}/night-*.png",
        "--maximum-visible-percent",
        "0.1",
      ]
    )
    == 1
  )


def test_sequence_paths_are_sorted_by_frame_number(tmp_path: Path) -> None:
  for index in (1, 10, 2):
    write_frame(
      tmp_path / f"minecraft-{index}.png",
      np.full((2, 2, 3), index, dtype=np.uint8),
    )

  mode, paths = _parse_sequence(f"minecraft={tmp_path}/minecraft-*.png")

  assert mode == "minecraft"
  assert [path.name for path in paths] == [
    "minecraft-1.png",
    "minecraft-2.png",
    "minecraft-10.png",
  ]
