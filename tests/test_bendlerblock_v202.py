"""Check complete Bendlerblock ownership, roof preservation and native volume."""

import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "src/app/src/data"
DATA = json.loads((DIR / "bendlerblockV202.json").read_text())
NAV = json.loads((DIR / "bendlerblockV202Navigation.json").read_text())
EVIDENCE = json.loads((DIR / "bendlerblockV202Evidence.json").read_text())
SOURCE_PATH = ROOT / "geo_data/regierungsviertel/bendlerblock-v202-source.json.gz"
SOURCE = json.loads(gzip.decompress(SOURCE_PATH.read_bytes()))


def source_roof_area() -> float:
  return sum(
    Polygon(
      [(x, z) for x, _, z in surface["rings"][0]],
      [[(x, z) for x, _, z in ring] for ring in surface["rings"][1:]],
    ).area
    for family in SOURCE["families"]
    for part in family["parts"]
    for surface in part["surfaces"]
    if surface["kind"] == "RoofSurface"
  )


def test_ten_complete_source_parts_and_only_nine_exact_previous_owners():
  assert (
    hashlib.sha256(SOURCE_PATH.read_bytes()).hexdigest() == EVIDENCE["sourceSha256"]
  )
  parts = [p for f in SOURCE["families"] for p in f["parts"]]
  assert len(parts) == len(NAV["parts"]) == 10
  assert len(NAV["prismIds"]) == 9
  assert set(NAV["prismIds"]) == {p["id"] for p in EVIDENCE["previousOwners"]}
  assert "-7903504" in NAV["prismIds"]
  by_id = {p["id"]: p for p in NAV["parts"]}
  for family in SOURCE["families"]:
    for part in family["parts"]:
      nav = by_id[part["id"]]
      assert nav["ring"] == part["ring"] and nav["holes"] == part["holes"]
      assert math.isclose(nav["topY"], part["top_y_m"] + family["shiftY"])


def test_complete_roof_coverage_preserves_measured_planes_and_voids():
  actual = sum(
    Polygon([(x, z) for x, _, z in triangle]).area
    for surface in DATA["surfaces"]
    if surface["kind"] == "RoofSurface"
    for triangle in surface["triangles"]
  )
  assert abs(actual - source_roof_area()) < 0.0001
  source_vertices = {
    part["id"]: {
      (x, round(y + family["shiftY"], 3), z)
      for surface in part["surfaces"]
      if surface["kind"] == "RoofSurface"
      for ring in surface["rings"]
      for x, y, z in ring
    }
    for family in SOURCE["families"]
    for part in family["parts"]
  }
  for surface in DATA["surfaces"]:
    if surface["kind"] == "RoofSurface":
      assert all(
        tuple(p) in source_vertices[surface["partId"]]
        for t in surface["triangles"]
        for p in t
      )


def test_court_paving_uses_all_interiors_without_covering_source_buildings():
  occupied = unary_union(
    [
      Polygon(p["ring"], p["holes"])
      for family in SOURCE["families"]
      for p in family["parts"]
    ]
  )
  court = unary_union([Polygon(p["ring"], p["holes"]) for p in NAV["court"]])
  drawn = unary_union(
    [
      Polygon([(x, z) for x, _, z in t])
      for s in DATA["surfaces"]
      if s["kind"] == "CourtPaving"
      for t in s["triangles"]
    ]
  )
  assert court.symmetric_difference(drawn).area < 0.00001
  assert court.intersection(occupied).area < 0.00001


def test_three_passages_keep_walkable_centrelines_in_native_shell():
  assert len(NAV["passages"]) == 3
  low_cells = [
    box(r[0] - r[4] / 2, r[2] - r[7] / 2, r[0] + r[4] / 2, r[2] + r[7] / 2)
    for r in DATA["blocks"]
    if r[5] == 0 and r[1] - r[6] / 2 < 7.0
  ]
  occupied = unary_union(low_cells)
  for passage in NAV["passages"]:
    route = LineString([passage["a"], passage["b"]])
    for t in [0.1, 0.25, 0.5, 0.75, 0.9]:
      assert not occupied.covers(route.interpolate(t, normalized=True))


def test_existing_nine_osm_court_trees_remain_without_duplicate_additions():
  receipt = EVIDENCE["courtTrees"]
  source_path = ROOT / receipt["sourcePath"]
  assert hashlib.sha256(source_path.read_bytes()).hexdigest() == receipt["sourceSha256"]
  park = json.loads(source_path.read_text())
  court = unary_union([Polygon(p["ring"], p["holes"]) for p in NAV["court"]])
  trees = [
    t for t in park["trees"] if court.covers(Point(t["position"][0], t["position"][2]))
  ]
  assert len(trees) == receipt["retainedOsmTrees"] == 9
  assert all(park["tree_vocabulary"]["source"][t["s"]] == "osm" for t in trees)
  assert receipt["owner"] == "ParkDetails" and receipt["addedTrees"] == 0
  assert all(r[8] != 12 for r in DATA["boxes"])
  assert all(r[5] != 12 for r in DATA["blocks"])


def test_native_ground_plate_and_transverse_works_retain_depth():
  plate = next(r for r in DATA["boxes"] if r[8] == 10 and abs(r[3] - 1.85) < 0.001)
  for part in [plate, *[r for r in DATA["boxes"] if r[8] == 11]]:
    x, _, z, w, _, depth, yaw, _, role, *_ = part
    along = np.array([math.cos(yaw), -math.sin(yaw)])
    across = np.array([math.sin(yaw), math.cos(yaw)])
    nearby = [
      r
      for r in DATA["blocks"]
      if r[5] == role
      and Point(r[0], r[2]).distance(Point(x, z)) < math.hypot(w, depth) / 2 + 1
    ]
    assert nearby
    width_extent = [float((np.array([r[0], r[2]]) - [x, z]) @ along) for r in nearby]
    depth_extent = [float((np.array([r[0], r[2]]) - [x, z]) @ across) for r in nearby]
    assert max(width_extent) - min(width_extent) > w - 0.3
    assert max(depth_extent) - min(depth_extent) > depth - 0.5
