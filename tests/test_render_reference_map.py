"""Tests for the top-down placement reference map."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from isometric_berlin.generation.render_reference_map import MapTransform

ROOT = Path(__file__).resolve().parents[1]
REFERENCE_MAP = ROOT / "src/app/public/dzi/regierungsviertel/reference_map.png"


def test_map_transform_keeps_north_up() -> None:
  transform = MapTransform(
    minx=0,
    miny=0,
    maxx=100,
    maxy=100,
    width=300,
    height=220,
    legend_width=80,
    pad=10,
  )

  east = transform.point(90, 50)
  west = transform.point(10, 50)
  north = transform.point(50, 90)
  south = transform.point(50, 10)

  assert east[0] > west[0]
  assert north[1] < south[1]


def test_committed_reference_map_is_packaged_asset() -> None:
  assert REFERENCE_MAP.exists()
  assert REFERENCE_MAP.stat().st_size > 100_000
  with Image.open(REFERENCE_MAP) as image:
    assert image.size == (1900, 1300)
    assert image.mode == "RGB"
