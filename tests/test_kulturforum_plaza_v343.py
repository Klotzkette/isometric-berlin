"""No blanket: new faces equal the source owned area minus retained features."""

import base64
import gzip
import json
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]


def test_plaza_face_footprint_and_original_owner_exclusions():
  d = json.loads((ROOT / "src/app/src/data/kulturforumPlazaV343.json").read_text())
  e = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/kulturforum-plaza-v343-evidence.json.gz"
      ).read_bytes()
    )
  )
  p = np.frombuffer(base64.b64decode(d["positions"]), "<f4").reshape(-1, 3)
  ii = np.frombuffer(base64.b64decode(d["indices"]), "<u4").reshape(-1, 3)
  union = shapely.union_all(shapely.polygons(p[ii][:, :, [0, 2]].astype(float)))
  footprint, owner, excluded = map(
    shape, [d["footprint"], e["originalOwner"], e["excluded"]]
  )
  assert union.symmetric_difference(footprint).area < 1e-8
  assert union.difference(owner).area < 0.004  # float32 world-coordinate storage only
  assert union.intersection(excluded).area < 0.005
  assert e["originalHoles"] == 3
  assert len(e["treeClearances"]) == 7
  for tree in e["treeClearances"]:
    assert not union.contains(shapely.Point(tree["position"]))
  assert 3500 < union.area < 3700
  assert e["planeJoinVertices"] > 400
  assert e["payloadBytes"] < 70000
  assert np.isfinite(p).all()
  assert p[:, 1].max() - p[:, 1].min() < 3
