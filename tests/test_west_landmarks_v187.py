"""Source ownership, open stadium and compact native west landmark contracts."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from pyproj import Transformer
from shapely.geometry import Point, Polygon, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src/data"


def read(path: Path) -> dict:
  """Load the committed, bounded deterministic payload."""
  return json.loads(path.read_text())


def test_west_exact_new_owner_exclusions_and_retained_profiles() -> None:
  osm = read(GEO / "west-landmarks-v187-osm.json")
  features = {f["properties"]["id"]: f for f in osm["features"]}
  exclusions = read(GEO / "west-landmarks-v187-exclusions.geojson")["features"]
  profiles = read(GEO / "west-landmarks-v187-source.json")["profiles"]
  assert len(profiles) == 12
  assert all(p["sourceParts"] and len(p["sourceSha256"]) == 64 for p in profiles)
  assert len(exclusions) == 23
  for f in exclusions:
    if f["properties"].get("kind") == "official-complete-footprint":
      assert f["properties"]["sourceParentId"] in {p["parentId"] for p in profiles}
      record = next(
        p for p in profiles if p["parentId"] == f["properties"]["sourceParentId"]
      )
      expected = unary_union(
        [Polygon(p["ring"], p["holes"]) for p in record["sourceParts"]]
      )
      project = Transformer.from_crs(4326, 25833, always_xy=True).transform
      geographic = transform(project, shape(f["geometry"]))
      local = transform(lambda x, y, z=None: (x - 389500, 5820000 - y), geographic)
      assert expected.hausdorff_distance(local) < 0.002
      assert abs(expected.area - local.area) < 0.01
    else:
      assert f["geometry"] == features[f["properties"]["osmId"]]["geometry"]
  assert {r["parentId"] for r in profiles} == {
    p for f in exclusions for p in f["properties"]["parentIds"]
  }
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform
  mask = unary_union([transform(project, shape(f["geometry"])) for f in exclusions])
  assert mask.covers(Point(389500 - 8963, 5820000 - 262))
  assert mask.covers(Point(389500 - 6367.441, 5820000 - 1395.843))
  nav = read(APP / "westLandmarksV187Navigation.json")
  assert not {"DEBE04YY500006Zr", "DEBE04YY50002bpq"}.intersection(
    b["owner"] for b in nav["buildings"]
  )
  evidence = read(GEO / "west-landmarks-v187-evidence.json")
  conflicts = {c["name"] for c in evidence["conflicts"]}
  assert conflicts == {
    "Glockenturm",
    "Olympiastadion enclosing ground owner",
    "Funkturm generic opaque shafts",
  }


def test_stadium_cutout_matches_owner_and_sunken_pitch_is_visible() -> None:
  nav = read(APP / "westernStadiumV187Navigation.json")
  cut = read(GEO / "west-landmarks-v187-stadium-cutout.geojson")["features"][0]
  assert cut["properties"]["sourceParentId"] == "DEBE04AL5LX00004"
  assert shape(nav["cutout"]).covers(Point(-8963, 262))
  assert abs(shape(nav["cutout"]).area - 56125.991) < 0.01
  assert nav["pitchY"] < -12 and nav["rimY"] == 3.55
  assert nav["seating"]["rows"] == 36
  g = next(
    g
    for g in read(APP / "westLandmarksV187.json")["groups"]
    if g["name"] == "Olympiastadion"
  )
  centre = Point(-8963.0, 262.0)
  # The newly imported coarse closed 56,126m² plate must never cap the pitch.
  for surface in g["surfaces"]:
    for tri in surface["triangles"]:
      polygon = shape(
        {"type": "Polygon", "coordinates": [[[p[0], p[2]] for p in [*tri, tri[0]]]]}
      )
      if polygon.area > 0.001 and polygon.covers(centre):
        assert max(p[1] for p in tri) <= nav["pitchY"] + 0.01
  assert nav["cutout"]["type"] == "MultiPolygon"
  assert (APP / "westernStadiumV187Navigation.json").stat().st_size < 12000


def test_west_geometry_is_bounded_finite_and_native_has_no_hidden_fill() -> None:
  payload = read(APP / "westLandmarksV187.json")
  evidence = read(GEO / "west-landmarks-v187-evidence.json")
  assert 10 <= len(payload["groups"]) <= 16
  assert evidence["budgets"]["nativeBlocks"] < 45000
  assert evidence["budgets"]["triangles"] < 50000
  for g in payload["groups"]:
    for row in g["native"]:
      assert len(row) == 7 and np.isfinite(row).all()
      assert min(row[3:6]) > 0
    for row in g["boxes"]:
      assert len(row) == 8 and np.isfinite(row).all()
    for s in g["surfaces"]:
      for tri in s["triangles"]:
        assert np.isfinite(tri).all()
        assert all(-11200 < p[0] < -5700 and -3200 < p[2] < 3000 for p in tri)
  assert (APP / "westLandmarksV187.json").stat().st_size < 7 * 1024 * 1024
