"""Measured scope, source preservation and independently orthogonal additions."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely import make_valid
from shapely.affinity import affine_transform
from shapely.geometry import Polygon
from shapely.ops import unary_union

from scripts import build_surrounding_outlines as out

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def test_mapped_clusters_add_only_outside_retained_source_scope():
  m = json.loads((GEO / "marzahn-v230-manifest.json").read_bytes())
  scope = out.load_projected_polygon(GEO / "bounds-marzahn-v230.geojson")
  retained = out.load_projected_polygon(GEO / "bounds-marzahn-v230-retained.geojson")
  actual = unary_union(
    [
      affine_transform(
        make_valid(Polygon(p["ring"], p["holes"])), [1, 0, 0, -1, 389500, 5820000]
      )
      for p in m["footprint"]
    ]
  )
  # The existing packet format rounds x/z to centimetres. No interior overlap.
  assert actual.intersection(retained.buffer(-0.015)).area < 0.1
  assert actual.difference(scope.buffer(0.02)).area < 0.1
  assert abs(actual.area - m["source"]["addedAreaM2"]) < actual.length * 0.015
  assert m["source"]["officialBuildingCount"] == 334
  assert m["source"]["buildingCount"] == 379
  assert len(m["chunks"]) == 17
  live = json.loads((PUBLIC / "manifest.json").read_bytes())
  assert len(live["chunks"]) <= 2144
  assert {c["id"] for c in m["chunks"]} <= {c["id"] for c in live["chunks"]}


def test_all_source_assets_and_window_planes_are_finite_and_native_orthogonal():
  m = json.loads((GEO / "marzahn-v230-manifest.json").read_bytes())
  for c in m["chunks"]:
    for family in ("drawn", "minecraft"):
      a = c[family]
      packed = (PUBLIC / a["url"]).read_bytes()
      assert hashlib.sha256(packed).hexdigest() == a["sha256"]
      raw = gzip.decompress(packed)
      assert len(raw) == a["decodedBytes"]
      packet = json.loads(raw)
      assert packet["id"] == c["id"]
      for mesh in packet["meshes"]:
        p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
        ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
        assert len(p) and ix.max() < len(p)
        if family == "minecraft" and mesh["kind"] == "outer-facades-v230":
          # Every plane is on one native grid axis, never a smooth oblique facade.
          span = np.ptp(p[ix].astype(int), axis=1)
          assert np.all((span[:, 0] == 0) | (span[:, 2] == 0))
