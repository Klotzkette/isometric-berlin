"""Source preservation, bounded bridge coverage and facade/approach clearances."""

from __future__ import annotations

import gzip
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
spec = importlib.util.spec_from_file_location(
  "tegel_spandau", ROOT / "scripts/build_tegel_spandau_v198.py"
)
builder = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(builder)


def load(path: Path) -> dict:
  return json.loads(path.read_text())


def test_prior_source_and_geometry_are_byte_identical() -> None:
  evidence = load(GEO / "tegel-spandau-v198-evidence.json")
  for name, digest in evidence["preservedInputs"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest
  source = load(GEO / "tegel-spandau-v198-source.json")
  assert len(source["features"]) == 11
  assert source["pbfSha256"] == load(GEO / "west-lakes-v194-source.geojson")["sha256"]
  old_tegel = next(
    f
    for f in load(GEO / "west-lakes-v194-source.geojson")["features"]
    if f["properties"].get("id") == "way/24448740"
  )
  assert (
    next(f for f in source["features"] if f["properties"].get("id") == "way/24448740")
    == old_tegel
  )


def test_complete_bridge_deck_retains_every_source_vertex_and_only_that_scope() -> None:
  source = load(GEO / "tegel-spandau-v198-source.json")
  bridge = next(
    f for f in source["features"] if f["properties"].get("osm_way_id") == "943646072"
  )
  poly = list(transform(builder.world, shape(bridge["geometry"])).geoms)[0]
  nav = load(DATA / "tegelSpandauV198Navigation.json")
  assert nav["bridgeRing"] == [list(p) for p in poly.exterior.coords]
  assert nav["bridgeHoles"] == []
  scope = load(GEO / "bounds-tegel-spandau-v198.geojson")
  assert len(scope["features"]) == 1
  assert scope["features"][0]["geometry"] == bridge["geometry"]
  drawn = load(DATA / "tegelSpandauV198.json")["sites"][1]
  points = list(zip(*(iter(drawn["positions"]),) * 3))
  triangles = [
    Polygon([(points[i][0], points[i][2]) for i in drawn["indices"][j : j + 3]])
    for j in range(0, len(drawn["indices"]), 3)
  ]
  assert unary_union(triangles).symmetric_difference(poly).area < 1e-7
  assert all(y == nav["deckY"] for _, y, _ in points)
  # Native is a separate orthogonal inner reading, never a full water rectangle.
  native_deck = unary_union(
    [
      box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)
      for x, _, z, w, _, d in nav["nativeDeck"]
    ]
  )
  assert native_deck.difference(poly.buffer(0.00005)).area < 1e-5
  assert native_deck.area > poly.area * 0.82
  axis = next(
    f for f in source["features"] if f["properties"].get("osm_id") == "316133773"
  )
  path = transform(builder.world, shape(axis["geometry"]))
  for i in range(101):
    assert native_deck.buffer(0.00005).covers(
      path.interpolate(i / 100, normalized=True)
    )


def test_relief_and_portal_fittings_are_bounded_to_source_faces() -> None:
  evidence = load(GEO / "tegel-spandau-v198-evidence.json")
  reliefs = [a for a in evidence["anchors"] if a["kind"] == "wind-relief"]
  assert len(reliefs) == 8
  assert sorted(a["tower"] for a in reliefs) == [0, 0, 1, 1, 2, 2, 3, 3]
  g = list(
    transform(
      builder.world,
      shape(
        next(
          f["geometry"]
          for f in load(GEO / "tegel-spandau-v198-source.json")["features"]
          if f["properties"].get("id") == "way/24448740"
        )
      ),
    ).geoms
  )[0]
  for a in reliefs:
    assert LineString(a["wall"]).difference(g.boundary.buffer(0.002)).length < 0.005
    x, y, z = a["center"]
    assert y == 14.86
    assert Point(x, z).distance(g.boundary) < 0.15
  # New rails never cross the centre of the preserved approach/bridge paths.
  drawn = load(DATA / "tegelSpandauV198.json")
  bridge = evidence["anchors"][8]
  axis = LineString(bridge["axis"])
  for r in drawn["sites"][1]["rods"]:
    if max(r[1], r[4]) < bridge["deckY"] + 2.2:
      assert LineString([(r[0], r[2]), (r[3], r[5])]).distance(axis) > 1.8
  gate = next(a for a in evidence["anchors"] if a["kind"] == "gate-front")
  old = load(GEO / "west-landmarks-v187-source.json")
  part = next(
    p
    for owner in old["profiles"]
    for p in owner["sourceParts"]
    if p["id"] == gate["sourcePart"]
  )
  assert all(p in part["ring"] for p in gate["wall"])


@pytest.mark.parametrize("native", [False, True])
def test_offline_generation_is_exact_and_bounded(native: bool) -> None:
  result, _ = builder.make(native)
  path = DATA / ("tegelSpandauV198Native.json" if native else "tegelSpandauV198.json")
  assert result == load(path)
  assert path.stat().st_size < 1024 * 1024
  assert len(result["sites"]) == 4
  for s in result["sites"]:
    for row in [*s["boxes"], *s["rods"]]:
      assert all(math.isfinite(v) for v in row)
    if native:
      assert s["rods"] == []
      if "source water" not in s["key"]:
        assert s["indices"] == []
      assert all(len(r) == 7 and min(r[3:6]) > 0 for r in s["boxes"])


@pytest.mark.parametrize("mode", ["drawn", "native"])
def test_shore_repair_retains_every_true_surface_and_corrects_only_source_water(
  mode: str,
) -> None:
  receipt = load(GEO / "tegel-spandau-v198-shore-repair.json")["modes"][mode]
  archived_bytes = (GEO / receipt["archive"]).read_bytes()
  assert hashlib.sha256(archived_bytes).hexdigest() == receipt["archiveSha256"]
  original = json.loads(gzip.decompress(archived_bytes))
  path = DATA / receipt["repairedFile"]
  assert hashlib.sha256(path.read_bytes()).hexdigest() == receipt["repairedSha256"]
  current = load(path)
  site = current["sites"][0]
  assert site["positions"][: len(original["positions"])] == original["positions"]
  assert site["colors"][: len(original["colors"])] == original["colors"]
  for s, digest in zip(
    current["sites"][1:], receipt["unchangedOtherSitesHashes"], strict=True
  ):
    assert (
      hashlib.sha256(json.dumps(s, separators=(",", ":")).encode()).hexdigest()
      == digest
    )
  old_points = np.array(original["positions"]).reshape(-1, 3)
  old_faces = np.array(original["indices"]).reshape(-1, 3)
  new_faces = set(map(tuple, np.array(site["indices"]).reshape(-1, 3)))
  changed = set(receipt["modifiedTriangleIndices"])
  assert len(changed) == (139 if mode == "native" else 39)
  assert len(old_faces) - len(changed) == receipt["untouchedTriangles"]
  for i, face in enumerate(old_faces):
    if i not in changed:
      assert tuple(face) in new_faces
    if old_points[face, 1].max() < -1.14:
      assert i not in changed  # All previous lake water remains exact.
  mask = shape(receipt["mask"])
  points = np.array(site["positions"]).reshape(-1, 3)
  for face in new_faces:
    triangle = points[list(face)]
    if np.ptp(triangle[:, 1]) < 1e-6 and triangle[0, 1] > 0:
      assert Polygon(triangle[:, [0, 2]]).intersection(mask).area < 0.001
  addition = load(
    DATA
    / ("tegelSpandauV198Native.json" if mode == "native" else "tegelSpandauV198.json")
  )["sites"][3]
  water_points = np.array(addition["positions"]).reshape(-1, 3)
  assert np.all(water_points[:, 1] == -1.15)
  water = unary_union(
    [
      Polygon(water_points[face][:, [0, 2]])
      for face in np.array(addition["indices"]).reshape(-1, 3)
    ]
  )
  assert water.symmetric_difference(mask).area < 0.002
  nav = load(DATA / "tegelSpandauV198Navigation.json")
  rings = nav["nativeWaterPolygons" if mode == "native" else "waterPolygons"]
  navigation = unary_union([Polygon(p[0], p[1:]) for p in rings])
  assert navigation.symmetric_difference(mask).area < 1e-8
