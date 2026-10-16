"""Mapped missing bridge, preserved old owners and replayable bounded geometry."""

import importlib.util
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
  "motorway_v226", ROOT / "scripts/build_steglitz_motorway_v226.py"
)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def read(path: Path) -> dict:
  return json.loads(path.read_text())


def test_complete_source_and_immutable_earlier_roads() -> None:
  source = read(builder.SOURCE)
  evidence = read(builder.GEO / "steglitz-motorway-v226-evidence.json")
  assert len(source["features"]) == 25
  assert sum(f["tags"].get("bridge") == "yes" for f in source["features"]) == 16
  assert evidence["sourceSha256"] == builder.digest(builder.SOURCE)
  assert evidence["preserved"] == builder.protected_files()
  assert len(evidence["preserved"]) >= 15  # Actual drawn/native local city packets.
  assert source["priorCandidateIdsPresent"] == ["way/4449224", "way/151021737"]
  plan, records = builder.source_plans(source)
  assert json.loads(json.dumps(records)) == evidence["records"]
  assert plan.equals(shape(evidence["plan"]))
  assert shape(source["priorScopes"]).covers(plan)
  assert (
    evidence["newScopeAreaM2"] == evidence["laneMarkings"] == evidence["piers"] == 0
  )


def test_deck_sheets_cover_source_plan_and_keep_both_underpasses_open() -> None:
  source = read(builder.SOURCE)
  data = read(builder.DATA / "steglitzMotorwayV226.json")
  plan, _ = builder.source_plans(source)
  triangles = np.array(data["positions"]).reshape((-1, 3, 3))
  top = [
    Polygon(t[:, [0, 2]])
    for t in triangles
    if all(abs(p[1] - builder.height(p[2])) < 0.0001 for p in t)
  ]
  # Four-decimal display coordinates: less than 0.1 m² over 18,980 m².
  assert unary_union(top).symmetric_difference(plan).area < 0.1
  assert np.isfinite(triangles).all()
  for crossing in source["crossingRoads"]:
    for p in shape(crossing["intersection"]).geoms:
      assert plan.covers(p)
      assert builder.height(p.y) - builder.THICKNESS >= 9  # Six metres above y=3.
      cell = Point(np.floor(p.x / 2) * 2 + 1, np.floor(p.y / 2) * 2 + 1)
      assert plan.covers(cell)
  assert len(data["nativeRows"]) < 2200


def test_explicit_osm_widths_take_priority_and_only_untagged_ways_use_lanes() -> None:
  source = read(builder.SOURCE)
  _, records = builder.source_plans(source)
  tagged = [r for r in records if r["widthSource"] == "width"]
  estimated = [r for r in records if r["laneDerivedWidthEstimate"]]
  assert len(tagged) == 18
  assert len(estimated) == 7
  by_id = {r["id"]: r for r in records}
  for feature in source["features"]:
    tags, record = feature["tags"], by_id[feature["id"]]
    if "width" in tags:
      assert record["displayWidthM"] == float(tags["width"])
      assert record["widthSourceValue"] == tags["width"]
      assert not record["laneDerivedWidthEstimate"]
    else:
      assert "est_width" not in tags
      assert record["widthSource"] == "lanes"
      assert record["displayWidthM"] == float(tags["lanes"]) * 3.25
  assert by_id["way/138611854"]["displayWidthM"] == 11  # Not 3 × 3.25.
  assert by_id["way/192464201"]["displayWidthM"] == 7.5  # Not 2 × 3.


def test_builder_replays_committed_outputs_without_raw_cache() -> None:
  paths = [
    builder.DATA / "steglitzMotorwayV226.json",
    builder.DATA / "steglitzMotorwayV226Navigation.json",
    builder.GEO / "steglitz-motorway-v226-evidence.json",
  ]
  before = [p.read_bytes() for p in paths]
  builder.build()
  assert [p.read_bytes() for p in paths] == before
