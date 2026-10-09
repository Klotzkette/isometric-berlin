"""Five finite source-backed districts; complete outlines and unchanged budgets."""

import gzip
import hashlib
import json
import sys
from collections import defaultdict
from pathlib import Path

import geopandas as gpd
import pytest
from packet_receipts_v201 import predecessor_v201
from shapely import from_wkb, make_valid
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_east_city_v200 import DATA, DISTRICTS, PUBLIC, merge_manifest  # noqa: E402
from build_surrounding_outlines import load_projected_polygon, world  # noqa: E402


@pytest.fixture(scope="module")
def manifest():
  return json.loads((DATA / "east-city-v200-manifest.json").read_bytes())


@pytest.fixture(scope="module")
def source(manifest):
  result = {}
  for descriptor in manifest["source"]["completeRingsReceipt"]["parts"]:
    packed = (DATA / descriptor["path"]).read_bytes()
    assert hashlib.sha256(packed).hexdigest() == descriptor["sha256"]
    assert len(packed) == descriptor["bytes"] < 5 * 1024 * 1024
    raw = gzip.decompress(packed)
    assert len(raw) == descriptor["decodedBytes"]
    result.update(json.loads(raw))
  return result


@pytest.fixture(scope="module")
def drawn(manifest):
  return [
    json.loads(gzip.decompress(predecessor_v201(PUBLIC / c["drawn"]["url"])))
    for c in manifest["chunks"]
  ]


def polygons(rows, x=0, z=0):
  return [
    make_valid(
      Polygon(
        [(x + a, z + b) for a, b in r["ring"]],
        [[(x + a, z + b) for a, b in h] for h in r.get("holes", [])],
      )
    )
    for r in rows
  ]


def test_exact_five_ortsteil_relations_and_no_prior_coverage_overlap():
  frame = gpd.read_file(DATA / "east-city-v200-districts.geojson").to_crs(25833)
  assert dict(zip(frame.osm_id, frame.name, strict=True)) == DISTRICTS
  assert set(frame.admin_level) == {"10"}
  expected = unary_union(frame.geometry)
  extent = load_projected_polygon(DATA / "bounds-east-city-v200.geojson")
  retained = load_projected_polygon(DATA / "bounds-east-city-v200-retained.geojson")
  assert expected.symmetric_difference(extent).area < 0.01
  added = extent.difference(retained)
  assert 33.09e6 < added.area < 33.11e6
  assert added.intersection(retained).area < 0.001
  assert added.difference(expected).area < 0.001
  runtime = json.loads((ROOT / "src/app/src/data/eastCityScopeV200.json").read_bytes())
  assert runtime["groundY"] == 3
  assert set(runtime) == {"bounds", "footprint", "groundY"}
  actual = unary_union(polygons(runtime["footprint"]))
  # Existing navigation serializes at centimetre precision, preserving holes.
  assert actual.symmetric_difference(world(added)).area < added.length * 0.008
  assert len(runtime["footprint"]) == 83


def test_manifest_merge_is_append_only_and_cannot_double_publish():
  before = {
    "chunks": [{"id": "old", "drawn": {"sha256": "retained"}}],
    "footprint": [{"ring": [[0, 0], [0, 1], [1, 1], [0, 0]], "holes": []}],
    "bounds": [0, 0, 10, 10],
  }
  new = {
    "chunks": [{"id": "east200-new"}],
    "footprint": [{"ring": [[12, 12], [13, 12], [12, 13], [12, 12]], "holes": []}],
    "bounds": [-3, 12, 20, 18],
    "source": {},
  }
  saved = json.dumps(before, sort_keys=True)
  after = merge_manifest(before, new)
  assert json.dumps(before, sort_keys=True) == saved
  assert after["chunks"][:-1] == before["chunks"]
  assert after["footprint"][:-1] == before["footprint"]
  assert after["bounds"] == [-3, 0, 20, 18]
  with pytest.raises(ValueError):
    merge_manifest(after, new)


def test_all_packets_fit_unchanged_serial_limits_and_have_both_readings(manifest):
  assert len(manifest["chunks"]) == 199
  assert manifest["source"]["officialBuildingCount"] == 22979
  assert len(manifest["source"]["lod2"]["tiles"]) == 69
  for tile in manifest["source"]["lod2"]["tiles"]:
    assert tile["url"].startswith("https://gdi.berlin.de/data/a_lod2/atom/LoD2_")
    assert len(tile["sha256"]) == 64
  for descriptor in manifest["chunks"]:
    assert descriptor["id"].startswith("east200-")
    assert descriptor["drawn"]["sha256"] != descriptor["minecraft"]["sha256"]
    for mode in ("drawn", "minecraft"):
      asset = descriptor[mode]
      packed = predecessor_v201(PUBLIC / asset["url"])
      assert len(packed) == asset["bytes"] < 650_000
      assert hashlib.sha256(packed).hexdigest() == asset["sha256"]
      raw = gzip.decompress(packed)
      assert len(raw) == asset["decodedBytes"] < 2_600_000
      packet = json.loads(raw)
      assert packet["id"] == descriptor["id"]
      assert packet["nav"]["groundY"] == 3
      if mode == "minecraft":
        assert "lines" not in packet


def test_source_inventory_retains_named_streets_and_explicit_height_estimates(manifest):
  descriptor = manifest["source"]["inventory"]
  packed = (PUBLIC / descriptor["url"]).read_bytes()
  assert hashlib.sha256(packed).hexdigest() == descriptor["sha256"]
  assert len(packed) == descriptor["bytes"]
  raw = gzip.decompress(packed)
  assert len(raw) == descriptor["decodedBytes"]
  inventory = json.loads(raw)
  for name in [
    "Dietzgenstraße",
    "Konrad-Wolf-Straße",
    "Falkenberger Chaussee",
    "Edisonstraße",
    "Dörpfeldstraße",
  ]:
    assert inventory["namedStreets"][name]
  assert len(inventory["roadSources"]) > 10_000
  assert (
    sum(inventory["heightEvidence"].values()) == manifest["source"]["osmBuildingCount"]
  )
  assert inventory["heightEvidence"]["osm:height"] > 0
  assert inventory["heightEvidence"]["display_fallback:building=shed"] > 0
  assert all(
    r["sourceId"].startswith("OSM-way-") and r["widthSource"]
    for r in inventory["roadSources"]
  )


def test_every_resolved_source_owner_and_height_survives_tile_delivery(
  source, drawn, manifest
):
  actual = defaultdict(list)
  heights = defaultdict(set)
  for packet in drawn:
    x, _, z = packet["origin"]
    for row in packet["nav"]["buildings"]:
      actual[row["sourceId"]].extend(polygons([row], x, z))
      heights[row["sourceId"]].add(
        (row["height"], row["minHeight"], row["heightSource"])
      )
  expected = defaultdict(list)
  source_heights = defaultdict(set)
  for owner in source["owners"]:
    expected[owner["sourceId"]].append(from_wkb(owner["wkb"]))
    source_heights[owner["sourceId"]].add(
      (
        round(max(owner["height"], owner["minHeight"] + 1), 2),
        owner["minHeight"],
        owner["heightSource"],
      )
    )
  assert len(source["owners"]) == manifest["source"]["buildingCount"]
  assert set(actual) == set(expected)
  assert heights == source_heights
  for identity, rings in expected.items():
    full = unary_union(rings)
    delivered = unary_union(actual[identity])
    assert full.symmetric_difference(delivered).area <= full.length * 0.012 + 0.02, (
      identity
    )


def test_source_water_roads_bridges_and_total_ground_remain_complete(source, drawn):
  delivered = defaultdict(list)
  for packet in drawn:
    x, _, z = packet["origin"]
    for kind in ("water", "roads", "bridges", "ground"):
      delivered[kind].extend(polygons(packet["nav"][kind], x, z))
  expected = {row["kind"]: from_wkb(row["wkb"]) for row in source["surfaces"]}
  expected["roads"] = unary_union([expected["road"], expected["path"]])
  expected["bridges"] = expected["bridge"]
  expected["ground"] = world(
    load_projected_polygon(DATA / "bounds-east-city-v200.geojson").difference(
      load_projected_polygon(DATA / "bounds-east-city-v200-retained.geojson")
    )
  )
  for kind, rows in delivered.items():
    shape = expected[kind]
    actual = unary_union(rows)
    assert actual.symmetric_difference(shape).area < shape.length * 0.015 + 0.05, kind


def test_five_camera_targets_are_on_delivered_new_roads(drawn):
  cameras = json.loads((DATA / "east-city-v200-cameras.json").read_bytes())
  assert {c["name"] for c in cameras} == set(DISTRICTS.values())
  roads = []
  for packet in drawn:
    x, _, z = packet["origin"]
    roads.extend(polygons(packet["nav"]["roads"], x, z))
  for camera in cameras:
    x, y, z = camera["target"]
    assert y == 3
    assert any(p.covers(Point(x, z)) for p in roads), camera["name"]
