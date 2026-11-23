"""No surveyed approach face crosses the physical opening or an earlier road margin."""

import gzip
import json

import numpy as np
import shapely as sh

from scripts import build_invaliden_road_shoulders_v376 as portal
from scripts import check_street_surfaces_v376 as verify


def triangles(data):
  for part in data["chunks"]:
    xy = (verify.words(part["xz"]).astype(int).reshape(-1, 2) + part["origin"]) / 100
    idx = verify.words(part["index"]).reshape(-1, 3)
    kinds = verify.words(part["style"], "u1")
    yield from zip(sh.polygons(xy[idx]), (data["styles"][i] for i in kinds[idx[:, 0]]))


def test_all_portal_shoulders_use_original_missing_cells_and_clear_the_entire_excavation():
  archive = json.loads(gzip.decompress(portal.ARCHIVE.read_bytes()))
  model = archive["groundModel"]
  hull = sh.Polygon(model["protectRing"])
  hosts = sh.union_all([sh.box(x, z, x + 4, z + 4) for x, z in model["cells"]])
  sources = {
    fid: portal.margins.world(sh.from_wkb(wkb)) for fid, _, wkb in archive["features"]
  }
  permitted = {
    "asphalt": sh.union_all(
      [sources["cm_fahrbahn.25086"], sources["cm_fahrbahn.53458"]]
    ),
    "mosaic": sources["cl_gehweg.387128"],
  }
  original = portal.margins.read(portal.OUTPUT)
  shapes, styles = zip(*triangles(original))
  complete = sh.union_all(shapes)
  assert len(shapes) == 42 and len(model["cells"]) == 29
  assert hosts.covers(complete)
  # The maximum shift from centimetre encoding is 7.1 mm.
  assert complete.distance(hull) >= portal.BUFFER - 0.0071
  for s, k in zip(shapes, styles):
    assert permitted[k].buffer(0.008).covers(s)
  assert abs(complete.area - 75.83) < 0.01
  assert abs(sum(s.area for s in shapes) - complete.area) < 1e-8
  for x, z, kind in [
    (-225.397, -791.640, "asphalt"),
    (-215.698, -792.987, "asphalt"),
    (-208.188, -754.423, "mosaic"),
  ]:
    assert [k for s, k in zip(shapes, styles) if s.covers(sh.Point(x, z))] == [kind]
  assert hull.covers(sh.Point(-220.823, -779.683))
  for name in ["exteriorStreetMarginsV373", "mitteRoadMarginsV376"]:
    existing = [
      s
      for s, _ in triangles(portal.margins.read(portal.margins.DATA / (name + ".json")))
    ]
    assert np.sum(sh.area(sh.intersection(existing, complete))) == 0
