import base64
import gzip
import hashlib
import json
import math

import numpy as np
import shapely
from shapely import Point, Polygon

from scripts.build_sinti_roma_apron_v375 import GROUND, OUTPUT, PHOTO, ROOT, X, Z, build


def test_orthophoto_and_world_ground_rebuild_the_shipped_geometry():
  original = json.loads(gzip.decompress(GROUND.read_bytes()))
  assert original["osm"].endswith("/relation/8329726")
  assert original["imagery"]["layer"] == "truedop_2024"
  assert (
    hashlib.sha256(PHOTO.read_bytes()).hexdigest()
    == "1cfe55b9a16583c8a213b3557ae7e4da6eb10759271b9d3224420effc668d337"
  )
  assert build() == json.loads(OUTPUT.read_bytes())


def test_new_triangles_preserve_every_inner_stone_and_all_tree_contacts():
  packet = json.loads(OUTPUT.read_bytes())
  vertices = np.frombuffer(
    gzip.decompress(base64.b64decode(packet["vertices"])), "<i2"
  ).reshape(-1, 4)
  indices = np.frombuffer(
    gzip.decompress(base64.b64decode(packet["indices"])), "<u2"
  ).reshape(-1, 3)
  xz = vertices[:, [0, 2]] / 1000 + [X, Z]
  current = shapely.union_all([Polygon(p) for p in xz[indices]])
  fixed = json.loads((ROOT / "src/app/src/data/sintiRomaPavingV256.json").read_text())
  old = shapely.union_all(
    [Polygon(np.array(s["ring"]) + [X, Z]) for s in fixed["shards"]]
  )
  assert len(fixed["shards"]) == 237
  assert current.intersection(old).area == 0
  assert current.distance(Point(X, Z)) >= 9.55
  assert math.isclose(sum(packet["areasM2"][:2]), 176.957, abs_tol=0.002)
  assert math.isclose(sum(packet["areasM2"][2:]), 63.389, abs_tol=0.002)
  contacts = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/mitte-tree-contacts-v375.json.gz"
      ).read_bytes()
    )
  )["rows"]
  assert all(not current.covers(Point(x, z)) for x, z, *_ in contacts)
