"""Blue material remains within its evidenced area and preserves mapped sand."""

import json
from pathlib import Path

from shapely.geometry import Polygon, shape

ROOT = Path(__file__).resolve().parents[1]


def test_blue_rubber_material_preserves_sand_and_pitches() -> None:
  data = json.loads(
    (ROOT / "src/app/src/data/weinbergPlaygroundV174Source.json").read_text()
  )
  rubber = shape(data["geometry"])
  assert 170 < rubber.area < 200
  for protected in data["preservedAreas"].values():
    assert rubber.intersection(shape(protected)).area < 1e-8
  rendered = sum(
    Polygon([(x, z) for x, _, z in t]).area
    for sheet in data["surfaces"]
    for t in sheet["triangles"]
  )
  assert abs(rendered - rubber.area) < 1e-6
  assert 0 < len(data["nativeRows"]) < 100
  assert all(r[4] == 0.05 and r[5] == 0.25 for r in data["nativeRows"])
