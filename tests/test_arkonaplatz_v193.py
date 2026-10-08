"""Step 10: real source anchors, open paths and bounded illustrative market."""

import json
from pathlib import Path

from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = json.loads((ROOT / "src/app/src/data/arkonaplatzV193.json").read_text())
SOURCE = json.loads((GEO / "arkonaplatz-v193-source.geojson").read_text())["features"]


def test_arkona_tree_nodes_and_bed_rings_are_source_exact() -> None:
  trees = {
    f["properties"]["id"]: f["geometry"]["coordinates"]
    for f in SOURCE
    if f["properties"]["tags"].get("natural") == "tree"
  }
  assert len(trees) == DATA["sourceTreeCount"] == 129
  assert {t["id"]: t["xz"] for t in DATA["trees"]} == trees
  beds = {
    f["properties"]["id"]: shape(f["geometry"])
    for f in SOURCE
    if f["properties"]["tags"].get("landuse") == "flowerbed"
  }
  for bed in DATA["beds"]:
    assert Polygon(bed["ring"]).equals(beds[bed["id"]])
  assert len(beds) == 2
  old = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/park-details.json").read_text()
  )
  area = unary_union([Point(t["xz"]).buffer(1) for t in DATA["trees"]])
  assert not any(
    area.covers(Point(t["position"][0], t["position"][2])) for t in old["trees"]
  )


def test_arkona_market_keeps_source_paths_planting_playground_and_trunks_open() -> None:
  path_union = unary_union(
    [
      shape(f["geometry"])
      for f in SOURCE
      if f["properties"]["tags"].get("highway") in ("footway", "path", "steps")
    ]
  )
  planting = unary_union(
    [
      shape(f["geometry"])
      for f in SOURCE
      if f["properties"]["tags"].get("landuse") in ("grass", "flowerbed")
      or f["properties"]["tags"].get("leisure") == "playground"
    ]
  )
  park = next(
    shape(f["geometry"])
    for f in SOURCE
    if f["properties"]["tags"].get("leisure") == "park"
  )
  assert len(DATA["stalls"]) == 15
  polygons = [Polygon(s["ring"]) for s in DATA["stalls"]]
  for i, polygon in enumerate(polygons):
    assert park.convex_hull.covers(polygon)
    assert polygon.distance(path_union) >= 1.25
    assert not polygon.intersects(planting)
    assert min(polygon.distance(Point(t["xz"])) for t in DATA["trees"]) >= 2
    for other in polygons[i + 1 :]:
      assert polygon.distance(other) >= 0.8
  assert min(p.distance(Point(DATA["marketNode"])) for p in polygons) < 10


def test_arkona_sources_and_illustrative_policy_are_explicit_and_small() -> None:
  evidence = json.loads((GEO / "arkonaplatz-v193-evidence.json").read_text())
  assert "not live occupancy" in evidence["marketPolicy"]
  assert "display estimates" in evidence["treePolicy"]
  assert len(evidence["sources"]) == 2
  assert all(len(h) == 64 for h in evidence["sources"].values())
  credits = json.loads((GEO / "arkonaplatz-v193-credits.json").read_text())
  assert credits[0]["title"] == "File:Berlin Arkonaplatz Flohmarkt.jpg"
  assert credits[0]["license"] == "CC BY 3.0"
  assert "Praefcke" in credits[0]["artist"]
  for path in GEO.glob("arkonaplatz-v193-*"):
    assert path.stat().st_size < 250_000


def test_central_paving_is_exact_park_complement_and_native_tiles_keep_its_holes() -> (
  None
):
  park = next(
    shape(f["geometry"])
    for f in SOURCE
    if f["properties"]["tags"].get("leisure") == "park"
  )
  source_vertices = [
    Point(p) for polygon in park.geoms for p in polygon.exterior.coords
  ]
  for corner in DATA["pavingClip"]:
    assert min(Point(corner).distance(p) for p in source_vertices) == 0
  protected = unary_union(
    [
      shape(f["geometry"])
      for f in SOURCE
      if f["properties"]["tags"].get("landuse") in ("grass", "flowerbed")
      or f["properties"]["tags"].get("leisure") == "playground"
    ]
  )
  apertures = unary_union(
    [Point(t["xz"]).buffer(0.65, quad_segs=4) for t in DATA["trees"]]
  )
  expected = (
    park.convex_hull.difference(park)
    .intersection(Polygon(DATA["pavingClip"]))
    .difference(unary_union([protected, apertures]))
  )
  actual = unary_union([Polygon(r[0], r[1:]) for r in DATA["pavingRings"]])
  assert actual.equals(expected)
  assert actual.intersection(park).area == 0
  assert actual.intersection(protected).area == 0
  assert 1800 < actual.area < 1900
  assert all(actual.covers(Polygon(s["ring"])) for s in DATA["stalls"])
  assert len(DATA["nativePavingCentres"]) == 7111
  for x, z in DATA["nativePavingCentres"]:
    assert actual.covers(box(x - 0.25, z - 0.25, x + 0.25, z + 0.25))
