"""Independent source semantics, physical clearance and conservation for v206."""

import hashlib
import importlib.util
import json
import math
from pathlib import Path

import pytest
import shapely
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src/data"
SOURCE = json.loads((GEO / "alt-mitte-transport-v206-source.json").read_text())
AUDIT = json.loads((GEO / "alt-mitte-transport-v206-evidence.json").read_text())
DATA = json.loads((APP / "altMitteTransportV206.json").read_text())
SPEC = importlib.util.spec_from_file_location(
  "transport", ROOT / "scripts/build_alt_mitte_transport_v206.py"
)
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


@pytest.fixture(scope="module")
def road_union():
  roads = [
    f
    for f in SOURCE["features"]
    if f["tags"].get("highway") in BUILDER.VEHICULAR_HIGHWAYS
    and f["geometry"]["type"] == "LineString"
    and BUILDER.at_grade(f["tags"])
  ]
  geometry = unary_union(
    [
      BUILDER.smooth_road_line(shape(f["geometry"])).buffer(
        BUILDER.road_width_m(f["tags"]) / 2, cap_style=2
      )
      for f in roads
    ]
  )
  shapely.prepare(geometry)
  return geometry


def test_no_zebra_is_inferred_from_signal_or_unknown_marking():
  for tags in (
    {"crossing": "traffic_signals"},
    {"crossing:markings": "yes"},
    {"crossing": "uncontrolled"},
    {"crossing:markings": "no", "crossing_ref": "zebra"},
    {"crossing:markings": "surface"},
  ):
    assert BUILDER.crossing_style(tags) is None
  assert BUILDER.crossing_style({"crossing:markings": "dashes"}) == "dashes"
  assert BUILDER.crossing_style({"crossing_ref": "zebra"}) == "zebra"


def test_every_full_paint_ribbon_stays_in_source_carriageway_and_district(road_union):
  # Published centroids/lengths are rounded to 1mm: account for that explicit
  # quantisation only, not a broad allowance for sidewalk paint.
  scope = BUILDER.boundary().buffer(0.002)
  roads = road_union.buffer(0.002)
  shapely.prepare(scope)
  shapely.prepare(roads)
  assert len(AUDIT["paintStrips"]) == 16545
  for x, z, length, width, angle, _colour in AUDIT["paintStrips"]:
    c, s = math.cos(angle), math.sin(angle)
    corners = [
      (x + c * u - s * v, z + s * u + c * v)
      for u, v in (
        (-length / 2, -width / 2),
        (length / 2, -width / 2),
        (length / 2, width / 2),
        (-length / 2, width / 2),
      )
    ]
    ribbon = Polygon(corners)
    assert scope.covers(ribbon)
    assert roads.covers(ribbon)


def test_each_paint_owner_has_positive_style_evidence():
  features = {f["key"]: f for f in SOURCE["features"]}
  assert len(AUDIT["paintOwners"]) == len({o["key"] for o in AUDIT["paintOwners"]})
  assert sum(o["count"] for o in AUDIT["paintOwners"]) == len(AUDIT["paintStrips"])
  for owner in AUDIT["paintOwners"]:
    tags = features[owner["key"]]["tags"]
    kind = owner["kind"]
    if kind in {"zebra", "dashes", "lines"}:
      assert BUILDER.crossing_style(tags) == kind
    elif kind == "lane_dividers":
      assert tags["lane_markings"] == "yes"
      assert BUILDER.mapped_lane_count(tags) == owner["lanes"] >= 2
    else:
      assert kind == "restriction"
      assert tags["road_marking"] == "restriction" and tags["pattern"] == "stripes"
      footprint = Polygon(shape(features[owner["key"]]["geometry"]))
      for row in AUDIT["paintStrips"][owner["first"] : owner["first"] + owner["count"]]:
        assert footprint.buffer(0.002).covers(Point(row[:2]))


def test_native_full_pixels_remain_inside_source_roads_and_district(road_union):
  from shapely.geometry import box

  scope = BUILDER.boundary()
  shapely.prepare(scope)
  assert sum(len(c["nativeRuns"]) for c in DATA["cells"]) == 29562
  for cell in DATA["cells"]:
    for ix, iz, count, _colour in cell["nativeRuns"]:
      rectangle = box(ix / 4, iz / 4, (ix + count) / 4, (iz + 1) / 4)
      assert scope.covers(rectangle)
      assert road_union.covers(rectangle)
      assert ix // 16 == (ix + count - 1) // 16


def test_only_entire_source_negative_legacy_axes_are_superseded():
  corrections = json.loads((APP / "altMitteTransportCorrectionsV206.json").read_text())
  old = json.loads(BUILDER.OLD_STREETS.read_text())["markings_m"]
  features = {f["key"]: f for f in SOURCE["features"]}
  assert len(corrections["corrections"]) == 14
  assert corrections["districtStreetsSha256"] == BUILDER.digest(BUILDER.OLD_STREETS)
  for item in corrections["corrections"]:
    line = LineString(old[item["markingIndex"]]["points"])
    owners = [features[key] for key in item["sourceWayKeys"]]
    assert all(o["tags"]["lane_markings"] == "no" for o in owners)
    assert unary_union([shape(o["geometry"]) for o in owners]).buffer(0.2).covers(line)
    assert BUILDER.boundary().covers(line)


def test_signals_are_clear_and_keep_all_262_original_source_and_physical_anchors(
  road_union,
):
  old = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/street-details.json").read_text()
  )
  existing = {r["osm_key"]: r for r in old["traffic_signal_placements"]}
  assert len(DATA["signals"]) == len({s["osm_key"] for s in DATA["signals"]}) == 430
  assert sum(s["retained_existing_placement"] for s in DATA["signals"]) == 262
  features = {f["key"]: f for f in SOURCE["features"]}
  for signal in DATA["signals"]:
    if signal["osm_key"] in existing:
      original = existing[signal["osm_key"]]
      for key in original:
        assert signal[key] == original[key]
    position = Point([v / 10 for v in signal["position_dm"]])
    assert BUILDER.boundary().covers(position)
    if signal["placement"] != "verified_island":
      assert not road_union.covers(position)
      if (
        not signal["retained_existing_placement"]
        and signal["placement"] == "relocated_verge"
      ):
        assert position.distance(road_union) >= 0.5
    if signal["direction_evidence"] == "mapped_direction_on_connected_way":
      road = LineString(features[signal["road_key"]]["geometry"]["coordinates"])
      node = shape(features[signal["osm_key"]]["geometry"])
      tx, tz = BUILDER.tangent(road, node)
      factor = -1 if signal["source_tag_direction"] == "forward" else 1
      expected = math.atan2(tx * factor, tz * factor)
      assert signal["heading_rad"] == pytest.approx(expected, abs=0.0000001)


def test_original_inputs_retained_and_compact_budgets():
  for name, sha in AUDIT["inputSha256"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == sha
  assert DATA["counts"] == AUDIT["counts"]
  assert len(DATA["cells"]) == 49
  assert sum(len(c["rows"]) for c in DATA["cells"]) == 16545
  assert (APP / "altMitteTransportV206.json").stat().st_size < 1_600_000
  assert (APP / "altMitteTransportGroundV206.json").stat().st_size < 150_000
  assert (GEO / "alt-mitte-transport-v206-source.json").stat().st_size < 3_000_000
