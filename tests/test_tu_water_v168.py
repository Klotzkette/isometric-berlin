"""Complete campus survey, declared industrial correction and true native voids."""

import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_tu_water_v168 import CORRECTED, LEGACY_IDS, extract, xyz  # noqa: E402


def load(kind):
  return json.loads((ROOT / f"src/app/src/data/tuWaterV168{kind}.json").read_text())


def test_all_24_leaves_and_414_source_polygons_are_preserved():
  parents, parts, original = extract()
  evidence, source = load("Evidence"), load("Source")
  assert evidence["sourceParents"] == parents
  assert evidence["sourceParts"] == parts
  assert evidence["originalSurfaces"] == original
  assert len(parents) == 5 and len(parts) == 24 and len(original) == 414
  assert sum(len(s["triangles"]) for s in original) == 878
  shown = {s.get("sourcePolygonId"): s for s in source["surfaces"]}
  for s in original:
    if s["triangles"] and s["partId"] != CORRECTED:
      assert shown[s["sourcePolygonId"]] == s
  corrected = {
    s["sourcePolygonId"]
    for s in original
    if s["triangles"] and s["partId"] == CORRECTED
  }
  assert corrected == {c["sourcePolygonId"] for c in evidence["displayChanges"]}
  assert all(c["originalRetained"] for c in evidence["displayChanges"])
  assert corrected.isdisjoint(shown)


def test_source_courtyard_holes_and_exact_legacy_owners():
  source = load("Source")
  assert {p["id"] for p in source["legacyPrisms"]} == LEGACY_IDS
  assert len(source["legacyPrisms"]) == 10
  historic = next(p for p in source["sourceParts"] if p["id"].endswith("EZDlPNqy"))
  assert sum(len(p["holes"]) for p in historic["polygons"]) == 2
  for part in source["sourceParts"]:
    if part["id"] == CORRECTED:
      continue
    actual = unary_union(
      [
        Polygon(p["ring"], p["holes"])
        for p in source["parts"]
        if p["sourcePartId"] == part["id"]
      ]
    )
    expected = unary_union([Polygon(p["ring"], p["holes"]) for p in part["polygons"]])
    assert actual.symmetric_difference(expected).area < 1e-7
  campus = unary_union(
    [
      Polygon(p["ring"], p["holes"])
      for p in source["parts"]
      if p["parentId"].endswith("6Rw")
    ]
  )
  holes = [
    hole for part in getattr(campus, "geoms", [campus]) for hole in part.interiors
  ]
  assert len(holes) >= 2
  for hole in holes:
    p = Polygon(hole).representative_point()
    assert not campus.covers(p)


def ray_hits_triangle(origin, direction, triangle):
  a, b, c = np.array(triangle)
  e1, e2 = b - a, c - a
  h = np.cross(direction, e2)
  det = np.dot(e1, h)
  if abs(det) < 1e-8:
    return False
  s = origin - a
  u = np.dot(s, h) / det
  if u < -1e-6 or u > 1.000001:
    return False
  q = np.cross(s, e1)
  v = np.dot(direction, q) / det
  if v < -1e-6 or u + v > 1.000001:
    return False
  return 0 < np.dot(e2, q) / det < 12


def test_pipe_air_gap_is_open_in_drawn_and_native():
  source = load("Source")
  tube = [
    s for s in source["surfaces"] if s.get("role") == "ut2-open-pink-circulation-loop"
  ]
  assert len(tube) == 1 and len(tube[0]["triangles"]) == 7104
  direction = np.array(xyz(12, 16.1, 1)) - np.array(xyz(12, 16.1, 0))
  for u in [10.5, 12.0, 14.5]:
    origin = np.array(xyz(u, 16.1, -6))
    assert not any(
      ray_hits_triangle(origin, direction, t)
      for s in source["surfaces"]
      for t in s["triangles"]
      if any(-2620 < p[0] < -2575 for p in t)
    )
    for v in np.arange(-5, 5.1, 0.5):
      x, y, z = xyz(u, 16.1, float(v))
      assert not any(
        abs(x - r[0]) < r[3] / 2
        and abs(y - r[1]) < r[4] / 2
        and abs(z - r[2]) < r[5] / 2
        for rows in [source["nativeRows"], source["nativeDetailRows"]]
        for r in rows
      )
  hall = [
    s for s in source["surfaces"] if s.get("role") == "ut2-raised-blue-laboratory"
  ]
  points = [p for s in hall for t in s["triangles"] for p in t]
  assert min(p[1] for p in points) == 17.8
  assert max(p[1] for p in points) == 39.667
  assert any(s.get("role") == "ut2-steel-support" for s in source["surfaces"])
  # The only old tube footprint was removed, with explicit raised navigation.
  assert not any(p["id"].startswith(CORRECTED + ":nav") for p in source["parts"])
  assert len(source["parts"]) == 23
  nav = load("Navigation")
  assert nav["structureNativeBands"] and nav["structureNativeFineBands"]
  for u in [10.5, 12, 14.5]:
    x, y, z = xyz(u, 16.1, 0)
    assert not any(
      cx == int(np.floor(x)) and cz == int(np.floor(z)) and lo < y < hi
      for cx, cz, lo, hi in nav["structureNativeBands"]
    )


def test_native_is_bounded_surface_skin_and_references_are_free():
  source, evidence = load("Source"), load("Evidence")
  assert len(source["nativeRows"]) < 24000
  assert len(source["nativeDetailRows"]) < 45000
  assert len(source["facadeBoxes"]) < 9000
  for r in source["nativeRows"]:
    assert r[4] == 1 and r[5] == 1
  for r in source["nativeDetailRows"]:
    assert r[4] == 0.5 and r[5] == 0.5
  assert len(evidence["photoReferences"]) == 6
  assert all(
    p["license"] in ["CC BY-SA 3.0", "CC BY-SA 4.0"] and not p["photo_bundled"]
    for p in evidence["photoReferences"]
  )
  assert all("maps.google" not in p["page_url"] for p in evidence["photoReferences"])
