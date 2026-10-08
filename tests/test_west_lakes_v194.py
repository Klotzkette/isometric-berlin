"""Bounded source, seam, island-hole and silhouette retention for west lakes."""

import json
from pathlib import Path

import numpy as np
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(path):
  return json.loads(path.read_text())


def world(g):
  return affine_transform(
    transform(Transformer.from_crs(4326, 25833, always_xy=True).transform, g),
    [1, 0, 0, -1, -389500, 5820000],
  )


def sources():
  return {
    f["properties"]["key"]: world(shape(f["geometry"]))
    for f in read(GEO / "west-lakes-v194-source.geojson")["features"]
  }


def polygon_set(rings):
  return unary_union([Polygon(p[0], p[1:]) for p in rings])


def surface(site, y):
  p = np.array(site["positions"]).reshape(-1, 3)
  tris = np.array(site["indices"]).reshape(-1, 3)
  return unary_union(
    [Polygon(p[t][:, [0, 2]]) for t in tris if np.max(np.abs(p[t, 1] - y)) < 1e-5]
  )


def test_source_rings_holes_and_full_wannsee_partition_retained():
  source = sources()
  nav = read(DATA / "westLakesV194Navigation.json")
  e = read(GEO / "west-lakes-v194-evidence.json")
  assert len(source) == 12
  assert e["sourceInventory"]["tegel-water"]["vertices"] == 1313
  assert e["sourceInventory"]["tegel-water"]["rings"] == 8
  teg = polygon_set(nav["drawn"][0]["polygons"])
  assert (
    teg.equals_exact(source["tegel-water"], 1e-8)
    or teg.symmetric_difference(source["tegel-water"]).area < 1e-6
  )
  old = world(
    shape(read(GEO / "bounds-outskirts-v187.geojson")["features"][0]["geometry"])
  )
  for key in ["grosser-wannsee", "havel-wannsee", "havel-pfaueninsel"]:
    assert source[key].difference(old).area < 1e-6
    assert e["wannseePartitionAudit"][key]["missingPriorScopeM2"] < 1e-6
  assert source["havel-wannsee"].area > 7_600_000
  assert source["grosser-wannsee"].distance(source["havel-wannsee"]) < 0.01


def test_new_water_and_island_only_fill_missing_source_area():
  source = sources()
  old = world(
    shape(read(GEO / "bounds-outskirts-v187.geojson")["features"][0]["geometry"])
  )
  runtime = read(DATA / "westLakesV194.json")
  sites = {s["key"]: s for s in runtime["sites"]}
  for key in ["tegel-water", "kleiner-wannsee"]:
    rendered = surface(sites[key], -1.15)
    expected = source[key].difference(old)
    assert rendered.symmetric_difference(expected).area < 1.1
    assert rendered.intersection(old.buffer(-0.001)).area < 0.01
  assert 7643 < surface(sites["kleiner-wannsee"], -1.15).area < 7644
  island = surface(sites["pfaueninsel"], 3.01)
  assert island.symmetric_difference(source["pfaueninsel"].difference(old)).area < 0.2
  assert island.intersection(old.buffer(-0.001)).area < 0.001
  # Each mapped Tegel island stays dry, including the innermost source points.
  water = surface(sites["tegel-water"], -1.15)
  for p in source["tegel-water"].geoms:
    for hole in p.interiors:
      assert not water.covers(Polygon(hole).representative_point())


def test_hero_footprints_are_exact_and_not_prior_generic_building_overlays():
  src = sources()
  nav = read(DATA / "westLakesV194Navigation.json")
  old = world(
    shape(read(GEO / "bounds-outskirts-v187.geojson")["features"][0]["geometry"])
  )
  assert {b["id"] for b in nav["buildings"]} == {
    "way/24448740",
    "way/22529932",
    "way/25014562",
  }
  for b in nav["buildings"]:
    exact = polygon_set(b["polygons"])
    assert exact.symmetric_difference(src[b["key"]]).area < 1e-6
    assert exact.intersection(old).area < 1e-6
    assert b["groundY"] == 3
    assert 14 < b["topY"] < 20
  # Borsig's open rear court must not be replaced by its enclosing rectangle.
  b = src["villa-borsig"]
  assert b.minimum_rotated_rectangle.area - b.area > 250
  e = read(GEO / "west-lakes-v194-evidence.json")
  assert "estimates" in e["heightProvenance"]


def test_native_independent_bounded_skin_and_flat_connected_water_datum():
  drawn = read(DATA / "westLakesV194.json")
  native = read(DATA / "westLakesV194Native.json")
  nav = read(DATA / "westLakesV194Navigation.json")
  assert nav["waterY"] == -1.15
  assert len(drawn["sites"]) == len(native["sites"]) == 8
  for site in native["sites"]:
    if site["key"] in ["schloss-tegel", "villa-borsig", "schloss-pfaueninsel"]:
      assert not site["positions"] and site["boxes"]
      for row in site["boxes"]:
        assert len(row) == 7 and min(row[3:6]) >= 1
    else:
      p = np.array(site["positions"]).reshape(-1, 3)
      for t in np.array(site["indices"]).reshape(-1, 3):
        n = np.cross(p[t[1]] - p[t[0]], p[t[2]] - p[t[0]])
        assert np.count_nonzero(np.abs(n) > 1e-4) <= 1
  for name in ["westLakesV194.json", "westLakesV194Native.json"]:
    assert (DATA / name).stat().st_size < 2 * 1024 * 1024


def test_pfaueninsel_tagged_upper_wall_parts_are_rendered_without_losing_vertices():
  src = sources()
  runtime = read(DATA / "westLakesV194.json")
  palace = next(s for s in runtime["sites"] if s["key"] == "schloss-pfaueninsel")
  points = np.array(palace["positions"]).reshape(-1, 3)
  for identity in ["1540816649", "1543022894", "1543260963"]:
    assert "way/" + identity in palace["owners"]
    for poly in src["pfaueninsel-part-" + identity].geoms:
      for x, z in poly.exterior.coords:
        assert np.min(np.linalg.norm(points[:, [0, 2]] - [x, z], axis=1)) < 0.0001
