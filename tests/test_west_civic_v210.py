"""Bounded Westend/DRV receipt, source retention and navigation regressions."""

import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import LineString, Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(path):
  return json.loads(path.read_text())


def test_complete_source_owners_and_original_civic_data_retained():
  source = read(GEO / "west-civic-v210-source.json")
  assert (
    source["priorV182Sha256"]
    == hashlib.sha256((DATA / "cityRecognitionV182.json").read_bytes()).hexdigest()
  )
  assert [
    (r["key"], len(r["parts"]), sum(len(p["surfaces"]) for p in r["parts"]))
    for r in source["sourceOwners"]
  ] == [("rbb", 1, 194), ("radio", 4, 152), ("drv", 1, 379)]
  assert [r["datumNhn"] for r in source["sourceOwners"]] == [52.859, 52.934, 35.908]
  assert {r["parentId"] for r in source["sourceOwners"]} == {
    "DEBE04YY500004sB",
    "DEBE04YY500004eY",
    "DEBE04YY500039oj",
  }
  assert read(DATA / "westCivicV210Previous.json")["ownerTransfers"] == []


def test_replacement_receipt_identifies_only_the_original_authored_estimates():
  receipt = read(DATA / "westCivicV210Previous.json")
  old = read(DATA / receipt["source"])
  for key, count in [("boxes", 10), ("segments", 100)]:
    assert len(receipt[key]) == count
    assert receipt["sourceRows"][key] == len(old[key])
    assert len({r["index"] for r in receipt[key]}) == count
    for row in receipt[key]:
      assert old[key][row["index"]] == row["row"]


def test_rbb_bodies_are_inside_the_retained_source_and_height_probes_match():
  source = read(GEO / "west-civic-v210-source.json")
  evidence = read(GEO / "west-civic-v210-evidence.json")
  rbb = source["sourceOwners"][0]
  footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in rbb["parts"]])
  samples = {(x, y): h for x, y, h in source["bdom"]["samples"]}
  assert len(evidence["volumes"]) == 4
  for body in evidence["volumes"]:
    assert shape(body["footprint"]).difference(footprint).area < 1e-6
    assert body["lowY"] == 3.389
    assert math.isclose(
      body["topY"], body["roofNhn"] - rbb["datumNhn"] + 3, abs_tol=0.001
    )
    for x, y, h in body["samples"]:
      assert samples[x, y] == h


def test_street_skins_follow_complete_source_walls_without_courtyard_portals():
  source = read(GEO / "west-civic-v210-source.json")
  evidence = read(GEO / "west-civic-v210-evidence.json")
  for key, field in [("radio", "radioFaces"), ("drv", "drvFaces")]:
    record = next(r for r in source["sourceOwners"] if r["key"] == key)
    assert len(evidence[field]) >= (15 if key == "radio" else 4)
    for face in evidence[field]:
      edge = LineString([face["a"], face["b"]])
      walls = [
        Polygon([(p[0], p[2]) for p in s["rings"][0]]).boundary
        for part in record["parts"]
        for s in part["surfaces"]
        if s["kind"] == "WallSurface"
      ]
      assert min(edge.difference(w.buffer(0.001)).length for w in walls) < 0.002
      assert face["highY"] > face["lowY"]
  # DRV's portal lies on the outer southern street, not the interior court.
  drv = read(DATA / "westCivicV210.json")["groups"][3]
  piers = [
    r for r, role in zip(drv["boxes"], drv["roles"]) if role == "Ruhrstraße portal pier"
  ]
  assert len(piers) == 4
  assert all(r[2] > 3080 for r in piers)


def test_seven_glass_tiers_and_required_navigation_are_bounded():
  scene = read(DATA / "westCivicV210.json")
  assert [g["required"] for g in scene["groups"]] == [True, True, False, False, False]
  glass = [
    r
    for r, role in zip(scene["groups"][0]["boxes"], scene["groups"][0]["roles"])
    if role == "blue glass cuboid"
  ]
  assert len(glass) == 7
  assert all(a[3] > b[3] for a, b in zip(glass, glass[1:]))
  assert abs(glass[-1][1] + glass[-1][4] / 2 - 18.16) < 0.002
  nav = read(DATA / "westCivicV210Navigation.json")["volumes"]
  assert (
    len([v for v in nav if v["id"].startswith("blue-obelisk blue glass cuboid")]) == 7
  )
  for volume in nav:
    assert Polygon(volume["ring"], volume["holes"]).is_valid
    assert volume["highY"] > volume["lowY"]
  assert (DATA / "westCivicV210.json").stat().st_size < 1_600_000
  for g in scene["groups"]:
    assert all(
      all(math.isfinite(v) for v in r) and all(v > 0 for v in r[3:6])
      for r in g["native"]
    )


def test_theodor_context_matches_named_square_and_keeps_cut_edges_without_curb_caps():
  source = read(GEO / "west-civic-place-v210-source.json")
  evidence = read(GEO / "west-civic-place-v210-evidence.json")
  scope = shape(source["scope"])
  assert source["square"]["id"] == "way/377196797"
  assert (
    scope.symmetric_difference(
      shape(source["square"]["geometry"]).buffer(8, quad_segs=6)
    ).area
    < 0.001
  )
  assert len(evidence["treeNodes"]) == 55
  assert len(set(evidence["treeNodes"])) == 55
  assert any(f["tags"].get("leisure") == "park" for f in source["features"])
  assert any(
    f["tags"].get("name") == "Theodor-Heuss-Platz"
    and f["tags"].get("highway") == "primary"
    for f in source["features"]
  )
  for patch in evidence["patches"]:
    geom = shape(patch["geometry"])
    assert geom.difference(scope).area < 0.000001
    assert patch["y"] > 3
    if patch["kind"] == "curb":
      assert geom.distance(scope.boundary) >= 0.039
  # Existing published packet remains the old source, not silently regenerated.
  manifest = read(ROOT / "src/app/public/mesh/surrounding-berlin-v159/manifest.json")
  packet = next(c for c in manifest["chunks"] if c["id"] == "ring182--14_1")["drawn"]
  assert (
    packet["sha256"]
    == "79dc31d252f368c2b2c91c24b438cc815cc12e00459f1a2d8a6534d543ab244a"
  )
  assert evidence["nativeQuads"] > 0
