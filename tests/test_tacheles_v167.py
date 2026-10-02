"""Preservation and current Tacheles silhouette/passability contracts."""

import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def load(name):
  return json.loads((DATA / f"tachelesV167{name}.json").read_text())


def test_every_source_polygon_and_leaf_is_retained_verbatim():
  import sys

  sys.path.insert(0, str(ROOT / "scripts"))
  from build_tacheles_v167 import extract

  parents, parts, original = extract()
  evidence = load("Evidence")
  assert evidence["sourceParents"] == parents
  assert evidence["sourceParts"] == parts
  assert evidence["originalSurfaces"] == original
  assert len(original) == 88
  assert len({s["sourcePolygonId"] for s in original}) == 88
  assert len(parts) == 4
  source = load("Source")
  by_id = {s.get("sourcePolygonId"): s for s in source["surfaces"]}
  for s in original:
    if s["parentId"].endswith("B92") and s["triangles"]:
      assert by_id[s["sourcePolygonId"]]["triangles"] == s["triangles"]


def test_current_roof_supersedes_only_documented_stale_roof():
  source, evidence = load("Source"), load("Evidence")
  original_roof = {
    s["sourcePolygonId"]
    for s in evidence["originalSurfaces"]
    if s["parentId"].endswith("D41") and s["kind"] == "RoofSurface"
  }
  replaced = {
    a["sourcePolygonId"]
    for a in evidence["displayChanges"]
    if a["action"] == "superseded-current-low-roof"
  }
  assert original_roof == replaced
  assert all(a["originalRetained"] for a in evidence["displayChanges"])
  main_points = [
    p
    for s in source["surfaces"]
    if s.get("parentId", "").endswith("D41")
    for t in s["triangles"]
    for p in t
  ]
  assert max(p[1] for p in main_points) <= 27.4481
  roof = [s for s in source["surfaces"] if s.get("role") == "current-rooftop-prism"]
  assert len(roof) == 4
  footprint = unary_union(
    [
      Polygon(p["ring"], p["holes"])
      for part in source["sourceParts"]
      if part["parentId"].endswith("D41")
      for p in part["polygons"]
    ]
  )
  for s in roof:
    for triangle in s["triangles"]:
      for x, y, z in triangle:
        assert footprint.buffer(0.02).covers(Point(x, z))
        assert y <= 30.7501
  assert evidence["currentRoof"]["supersededSourceMaximumY"] > 41


def test_open_passage_is_geometrically_clear_and_unblocked():
  source = load("Source")
  a = np.array([1177.782, -753.118])
  d = np.array([64.095, 27.867])
  d /= np.linalg.norm(d)
  n = np.array([d[1], -d[0]])
  obstacles = unary_union(
    [Polygon(p["ring"], p["holes"]) for p in source["parts"] if p["groundY"] < 7.4]
  )
  # Full route from pavement through both source wall planes, central 5 m lane.
  for u in [62, 64, 66]:
    for v in np.arange(1, -18, -0.5):
      x, z = a + d * u + n * v
      assert not obstacles.buffer(0.5).covers(Point(x, z))
      for rows in [source["nativeRows"], source["nativeDetailRows"]]:
        assert not any(
          abs(x - r[0]) < r[3] / 2
          and abs(z - r[2]) < r[5] / 2
          and r[1] - r[4] / 2 < 7.4
          and r[1] + r[4] / 2 > 5.4
          for r in rows
        )
  assert {p["id"] for p in source["legacyPrisms"]} == {"40754304", "19283679"}
  assert len(source["parts"]) == 6
  overhead = [p for p in source["parts"] if p["groundY"] > 7.4]
  assert len(overhead) == 1
  assert overhead[0]["groundY"] == 8.8
  assert Polygon(overhead[0]["ring"]).contains(Point(*(a + d * 64 + n * -8)))
