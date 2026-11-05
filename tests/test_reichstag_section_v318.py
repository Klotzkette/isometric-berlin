"""Exact bounded source lawn; no city surface or courtyard is replaced."""

import json
from pathlib import Path

from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def test_lawn_and_complete_road_complement_use_retained_source() -> None:
  data = json.loads((ROOT / "src/app/src/data/reichstagLawnV318.json").read_text())
  source = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json").read_text()
  )
  assert any(p["ring"] == data["ring"] for p in source["parks"])
  bound = box(-315, -425, 1685, 1125)
  lawn = Polygon(data["ring"])
  original = unary_union(
    [
      Polygon(r["ring"], r.get("holes", [])).intersection(bound)
      for r in source["roads"]
      if Polygon(r["ring"]).intersects(lawn)
    ]
  )
  rendered = unary_union([Polygon(r["ring"], r["holes"]) for r in data["roads"]])
  assert original.symmetric_difference(rendered).area < 1e-7
  assert len(data["ring"]) == 5
