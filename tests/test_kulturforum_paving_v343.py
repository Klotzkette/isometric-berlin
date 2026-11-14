"""Inlaid detail must not turn buildings or the two memorials into paving."""
import base64
import gzip
import json
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]


def test_v343_joint_footprints_stay_on_existing_source_paving():
  data = json.loads((ROOT / "src/app/src/data/kulturforumPavingV343.json").read_text())
  evidence = json.loads(gzip.decompress((ROOT / "geo_data/regierungsviertel/kulturforum-paving-v343-evidence.json.gz").read_bytes()))
  paving = shape(evidence["paving"])
  excluded = shape(evidence["exclusions"])
  supports = np.frombuffer(base64.b64decode(data["supports"]), "<f4").reshape(-1,3,2)
  parts = []
  for name, stride in [("segments",5),("native",5)]:
    seams = np.frombuffer(base64.b64decode(data[name]), "<i2").reshape(-1,stride)
    for row in seams:
      points = row[:4].reshape(2,2).astype(float) / 100 + np.asarray(data["origin"])
      line = LineString(points)
      assert line.length > .02
      poly = line.buffer(data["jointWidthM"]/2,cap_style=2)
      assert poly.difference(paving).area < 1e-8
      assert poly.intersection(excluded).area < 1e-8
      if name == "segments":
        assert poly.difference(Polygon(supports[row[4]])).area < 1e-6
      else:
        assert min(abs(points[0] - points[1])) < 1e-8
        assert poly.difference(box(*data["nativeSupports"][row[4]])).area < 1e-8
      parts.append(poly)
  assert paving.area > 800
  assert len(supports) == data["counts"]["supports"]
  assert evidence["payloadBytes"] < 400_000
