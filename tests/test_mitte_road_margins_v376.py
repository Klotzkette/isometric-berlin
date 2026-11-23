"""Every rendered shoulder must lie within the original surveyed finish and missing roadbed."""

import base64
import gzip
import json
from collections import defaultdict

import numpy as np
import pytest
import shapely as sh

from scripts import build_mitte_road_margins_v376 as roads


def words(value, dtype):
  return np.frombuffer(gzip.decompress(base64.b64decode(value, validate=True)), dtype)


def test_all_faces_have_their_surveyed_finish_and_a_real_gap():
  data = json.loads(roads.OUTPUT.read_bytes())
  material = defaultdict(list)
  for chunk in data["chunks"]:
    xy = (
      words(chunk["xz"], "<u2").reshape(-1, 2).astype(float) + chunk["origin"]
    ) / 100
    idx = words(chunk["index"], "<u2").reshape(-1, 3)
    styles = words(chunk["style"], "u1")
    assert np.all(styles[idx] == styles[idx[:, :1]])
    for style in np.unique(styles):
      tri = xy[idx[styles[idx[:, 0]] == style]]
      d, e = tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]
      assert np.all(d[:, 0] * e[:, 1] - d[:, 1] * e[:, 0] < 0)
      material[data["styles"][int(style)]].extend(sh.polygons(tri))
  originals = defaultdict(list)
  for fid, m, wkb in json.loads(gzip.decompress(roads.SURVEY.read_bytes()))["features"]:
    category = (
      "treePit"
      if fid.startswith("bn_baumscheibe.")
      else "lawn"
      if fid.startswith("ce_gruenflaeche.")
      else roads.margins.LEGEND.get(m, "other")
    )
    originals[category].append(sh.make_valid(roads.margins.world(sh.from_wkb(wkb))))
  gap, streets, _ = roads.region()
  allowed = gap.buffer(0.019)
  sh.prepare(allowed)
  all_faces = []
  for style, tri in material.items():
    survey = sh.union_all(originals[style]).buffer(0.019)
    sh.prepare(survey)
    assert np.all(sh.covers(survey, tri))
    assert np.all(sh.covers(allowed, tri))
    assert sh.area(tri).sum() == pytest.approx(data["materialM2"][style], abs=0.01)
    all_faces.extend(tri)
  pits, faces = sh.STRtree(all_faces).query(
    originals["treePit"], predicate="intersects"
  )
  assert len(pits) == 0
  assert (
    {"Chausseestraße", "Invalidenstraße", "Alt-Moabit", "Luxemburger Straße"}
    <= data["districtM2"].keys()
    <= streets.keys()
  )
  assert sum(data["materialM2"].values()) == pytest.approx(
    sum(data["districtM2"].values()), abs=0.1
  )
