"""Complete measured source, exact false-facade scope and mapped stack skyline."""

import base64
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_alt_mitte_v169 import triangulate  # noqa: E402
from build_kraftwerk_berlin_v268 import camera_checks  # noqa: E402

DATA = json.loads((ROOT / "src/app/src/data/kraftwerkBerlinV268.json").read_bytes())
EVIDENCE = json.loads(
  gzip.decompress(
    (
      ROOT / "geo_data/regierungsviertel/kraftwerk-berlin-v268-evidence.json.gz"
    ).read_bytes()
  )
)


def arrays(mesh):
  p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  i = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return p, i


def signature(t):
  return tuple(sorted(map(tuple, t)))


def packet(family):
  return json.loads(
    gzip.decompress(
      (
        ROOT / f"src/app/public/mesh/surrounding-berlin-v159/6_1.{family}.json.gz"
      ).read_bytes()
    )
  )


def test_measured_source_survives_exact_false_window_retirement():
  for source in EVIDENCE["inputs"]:
    assert (
      hashlib.sha256((ROOT / source["path"]).read_bytes()).hexdigest()
      == source["sha256"]
    )
  site = EVIDENCE["source"]
  assert site["id"] == "DEBE01YYK00002yj"
  assert len(site["parts"]) == 5
  assert sum(len(p["surfaces"]) for p in site["parts"]) == 43
  source_file = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-392_5818-00.json.gz"
      ).read_bytes()
    )
  )
  assert next(b for b in source_file["buildings"] if b["id"] == site["id"]) == site
  raw = packet("drawn")
  retained = set()
  for mi, m in enumerate(raw["meshes"]):
    points, indices = arrays(m)
    retire = {
      t
      for r in EVIDENCE["receipts"]["drawn"]
      if r["mesh"] == mi
      for t in r["triangles"]
    }
    retained.update(
      signature(points[t]) for i, t in enumerate(indices) if i not in retire
    )
  count = 0
  for p in site["parts"]:
    for s in p["surfaces"]:
      if s["kind"] not in {"WallSurface", "RoofSurface", "ClosureSurface"}:
        continue
      for t in triangulate(s["rings"]):
        rounded = np.rint((np.asarray(t) - raw["origin"]) * 100).astype(int)
        if len(set(map(tuple, rounded))) < 3:
          continue
        assert signature(rounded) in retained
        count += 1
  assert count > 70
  assert EVIDENCE["oldDrawnFacadeTriangles"] == 5216
  assert EVIDENCE["oldNativeTriangles"] == 5152
  assert sum(len(r["triangles"]) for r in EVIDENCE["receipts"]["drawn"]) == 5216
  assert sum(len(r["triangles"]) for r in EVIDENCE["receipts"]["minecraft"]) == 5152


def test_independent_native_complete_source_and_unchanged_ground():
  assert (
    DATA["profile"]["nativeShellTriangles"] == EVIDENCE["nativeSourceTriangles"] == 1412
  )
  for family in ["drawn", "minecraft"]:
    raw = packet(family)
    assert raw["nav"]["groundY"] == EVIDENCE["source"]["groundY"] == 3
    p, i = arrays(DATA["packets"][family + ":6_1"]["replacement"])
    assert i.max() < len(p)
    # Preserve the predecessor's 2m native surface raster. Its lowest source
    # cells extend to y=1 below the delivered y=3 ground, never float above it.
    assert p[:, 1].min() >= (1100 if family == "minecraft" else 1300)
    if family == "minecraft":
      t = p[i].astype(float)
      normals = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
      assert np.all((abs(normals) > 0.01).sum(axis=1) <= 1)
    assert len(raw["meshes"]) + 1 <= 16
    assert (
      sum(len(base64.b64decode(m["positions"])) // 6 for m in raw["meshes"]) + len(p)
      <= 400000
    )
  terrain = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json").read_bytes()
  )
  right = (terrain["grid"]["min_x_idx"] + terrain["grid"]["cols"]) * terrain["cell_m"]
  assert (
    min(x for p in EVIDENCE["source"]["footprintPolygons"] for x, z in p["ring"])
    > right
  )


def test_both_mapped_chimneys_retain_full_100m_height_and_exact_rings():
  context = json.loads(
    (
      ROOT / "geo_data/regierungsviertel/kraftwerk-berlin-v268-context.json"
    ).read_bytes()
  )
  assert {s["id"] for s in context["stacks"]} == {"way/193480704", "way/908097945"}
  plant = [
    Polygon(p["ring"], p["holes"])
    for b in EVIDENCE["adjacentSources"]
    for p in b["footprintPolygons"]
  ]
  for stack in DATA["profile"]["stacks"]:
    old = next(s for s in context["stacks"] if s["id"] == stack["id"])
    assert stack["ring"] == old["ring"]
    assert stack["height"] == 100 and stack["displayTopY"] == 103
    assert any(p.covers(Polygon(stack["ring"]).centroid) for p in plant)
    for family in ["drawn", "minecraft"]:
      r = DATA["packets"][family + ":6_1"]
      nav = next(
        n for n in r["buildings"] if n["sourceId"] == "kraftwerk-v268-" + stack["id"]
      )
      assert nav["height"] == 100 and nav["minHeight"] == 42
      assert len(nav["holes"]) == 1
      p, i = arrays(r["replacement"])
      world = p / 100 + np.asarray(r["origin"])
      c = Polygon(stack["ring"]).centroid
      nav_poly = Polygon(nav["ring"], nav["holes"])
      assert not nav_poly.covers(Point(c.x - r["origin"][0], c.y - r["origin"][2]))
      top = world[
        (world[:, 1] == 103)
        & (abs(world[:, 0] - c.x) < 6)
        & (abs(world[:, 2] - c.y) < 6)
      ]
      assert len(top) >= 8
      assert Point(c.x, c.y).distance(Polygon(stack["ring"])) == 0
      # Compare delivered collision area to the actual centimetre-quantized
      # horizontal rim triangles, rather than repeating the generator recipe.
      t = world[i]
      rim_triangles = t[
        (t[:, :, 1] == 103).all(axis=1)
        & (abs(t[:, :, 0] - c.x) < 6).all(axis=1)
        & (abs(t[:, :, 2] - c.y) < 6).all(axis=1)
      ]
      visible_rim = unary_union(
        [
          Polygon(triangle[:, [0, 2]] - np.asarray(r["origin"])[[0, 2]])
          for triangle in rim_triangles
        ]
      )
      assert nav_poly.symmetric_difference(visible_rim).area < 1e-7


def test_front_and_whole_site_cameras_clear_actual_neighbour_rings():
  actual = camera_checks(DATA["profile"]["stacks"])
  assert actual == EVIDENCE["cameraQA"]
  assert actual["packets"] == ["6_1", "6_2"]
  assert actual["cameras"]["wholeSite"]["checks"][0]["rayCount"] == 3
