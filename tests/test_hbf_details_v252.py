"""Keep Hbf street details tied to existing roads, boundaries and positive tags."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from shapely.geometry import LineString, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "hbf-details-v252-source.json"
DETAIL = ROOT / "src/app/src/data/hbfStreetDetailsV252.json"


def test_retained_source_payload_and_full_metric_courses_are_unchanged() -> None:
  source = json.loads(SOURCE.read_text())
  detail = json.loads(DETAIL.read_text())
  assert detail["sourceSha256"] == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  original = ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json"
  assert (
    source["sourceSurfaceSha256"] == hashlib.sha256(original.read_bytes()).hexdigest()
  )
  assert (
    source["sourceDistrictStreetsSha256"]
    == hashlib.sha256(
      (ROOT / "src/app/src/data/districtStreets.json").read_bytes()
    ).hexdigest()
  )
  assert len(source["features"]) == 12
  assert {f["tags"]["name"] for f in source["features"]} == {
    "Invalidenstraße",
    "Rahel-Hirsch-Straße",
    "Clara-Jaschke-Straße",
  }
  assert all(shape(f["geometry"]).length > 20 for f in source["features"])


def test_paint_has_positive_cycle_lane_or_turn_direction_evidence() -> None:
  source, detail = json.loads(SOURCE.read_text()), json.loads(DETAIL.read_text())
  owners = {f["id"]: f for f in source["features"]}
  arrows = 0
  for line in detail["paint"]:
    owner = owners[line["owner"]]
    tags = owner["tags"]
    if line["role"] == "cycle-lane-boundary":
      assert "lane" in (
        tags.get("cycleway:both"),
        tags.get("cycleway:left"),
        tags.get("cycleway:right"),
      )
    else:
      assert line["role"] == "tagged-turn-arrow"
      assert tags["oneway"] == "yes"
      assert any(
        d in ("left", "right", "through") for d in tags["turn:lanes"].split("|")
      )
      arrows += 1
    course = shape(owner["geometry"])
    assert (
      LineString(line["points"])
      .difference(course.buffer(owner["widthM"] / 2 + 0.1))
      .length
      < 0.001
    )
  assert arrows > 0
  assert not any(line["role"] == "zebra" for line in detail["paint"])


def test_curb_joints_stay_at_existing_kerbstones_and_no_new_road_is_emitted() -> None:
  detail = json.loads(DETAIL.read_text())
  old = json.loads((ROOT / "src/app/src/data/districtStreets.json").read_text())
  from shapely.ops import unary_union

  curb = unary_union([LineString(p) for p in old["curbs_m"]])
  courses = unary_union([LineString(p["points"]) for p in detail["curbCaps"]])
  assert courses.difference(curb.buffer(0.000001)).length < 0.000001
  assert set(detail) == {"sourceSha256", "curbCaps", "paint"}
  assert DETAIL.stat().st_size < 32_000
