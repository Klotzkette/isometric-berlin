"""Source geometry and finite scope contracts for the two v188 additions."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from shapely.geometry import Point, Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/urania-luetzow-v188-source.json"
RUNTIME = ROOT / "src/app/src/data/uraniaLuetzowV188.json"


def test_complete_official_urania_evidence_and_exact_high_roof() -> None:
  """Source surfaces are retained; the higher roof stays inside its owner."""
  source = json.loads(SOURCE.read_text())
  runtime = json.loads(RUNTIME.read_text())
  owner = source["urania"]
  assert len(owner["surfaces"]) == 21
  assert owner["sourceMaxNhnM"] - owner["sourceMinNhnM"] == 14.735
  assert runtime["sourceSha256"] == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  roof = runtime["urania"]["highRoof"]
  assert len(roof) == 12
  assert all(p[1] == 19.935 for p in roof)
  roof_plan = Polygon([(p[0], p[2]) for p in roof])
  assert shape(owner["officialFootprint"]).buffer(0.002).covers(roof_plan)
  assert runtime["urania"]["additionFloorY"] == 14.2
  assert abs(roof_plan.area - 978.692505) < 0.000001


def test_luetzow_features_follow_actual_garden_and_keep_separate_basins() -> None:
  """No filler gardens, fountain relocation or path extension beyond the park."""
  source = json.loads(SOURCE.read_text())
  park = shape(source["park"]["geometry"])
  assert source["park"]["id"] == "way/11405245"
  assert len(source["beds"]) == 13
  for bed in source["beds"]:
    geometry = shape(bed["geometry"])
    assert park.covers(geometry)
    assert geometry.area < 60
  assert len(source["paths"]) == 8
  for path in source["paths"]:
    geometry = shape(path["clippedGeometry"])
    assert park.buffer(0.001).covers(geometry.buffer(0.999))
    assert shape(path["geometry"]).buffer(0.001).covers(geometry)
  fountains = source["fountains"]
  assert [f["id"] for f in fountains] == [
    "node/4360435502",
    "node/4360435503",
    "node/4360435504",
  ]
  for fountain in fountains:
    assert park.covers(Point(fountain["xz"]).buffer(3))
  for a, b in zip(fountains, fountains[1:]):
    assert 7.5 < Point(a["xz"]).distance(Point(b["xz"])) < 8.5
