import base64
import json
import struct
from itertools import combinations

from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

from scripts import build_invaliden_park_v371 as park


def test_park_contains_one_surface_per_point_and_leaves_basin_open():
  boundary, basin, surfaces = park.garden()
  assert abs(boundary.area - 19632.24) < 0.02
  assert 2300 < basin.area < 2500
  assert abs(unary_union([*surfaces.values(), basin]).area - boundary.area) < 0.001
  assert all(
    a.intersection(b).area < 0.001 for a, b in combinations(surfaces.values(), 2)
  )
  assert all(basin.intersection(s).area < 0.001 for s in surfaces.values())
  # Transect across the central lawn, first narrow band, intervening grass,
  # second band and the basin. Coordinates picked separately on the orthophoto.
  for x, z, material in [
    (332, -1213, "lawn"),
    (326, -1177.7, "granite"),
    (326, -1172, "lawn"),
    (326, -1166.8, "granite"),
    (354.3, -1199, "coping"),
  ]:
    assert surfaces[material].covers(Point(x, z)), (x, z, material)


def test_shipped_triangles_match_the_source_and_face_upward():
  raw = json.loads(park.OUTPUT.read_bytes())
  assert json.loads(json.dumps(park.compile_ground())) == raw
  points = list(struct.iter_unpack("<hh", base64.b64decode(raw["xzCm"])))
  triangles = list(struct.iter_unpack("<HHH", base64.b64decode(raw["indices"])))
  assert raw["groups"][-1]["endIndex"] == len(triangles) * 3
  start = 0
  _, basin, surfaces = park.garden()
  for group in raw["groups"]:
    cut = group["endIndex"] // 3
    polys = []
    for ia, ib, ic in triangles[start:cut]:
      tri = Polygon(
        [
          (park.ORIGIN[0] + points[i][0] / 100, park.ORIGIN[1] + points[i][1] / 100)
          for i in (ia, ib, ic)
        ]
      )
      assert tri.is_valid and not tri.exterior.is_ccw
      polys.append(tri)
    outline = unary_union(polys)
    design = surfaces[group["material"]]
    # Centimetre-quantized boundaries may move up to the diagonal of half a cell.
    assert outline.symmetric_difference(design).area < design.length * 0.0071
    assert outline.intersection(basin).area < 0.4
    start = cut
