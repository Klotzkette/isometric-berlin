"""Independently check the original woodland limits, its DGM drape, and the old raster remainders."""

import base64
import gzip
import json
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.affinity import affine_transform

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def words(obj, field, kind):
  return np.frombuffer(gzip.decompress(base64.b64decode(obj[field])), kind)


def world(wkb):
  return affine_transform(sh.from_wkb(wkb), [1, 0, 0, -1, -389500, 5820000])


def wood():
  data = json.loads((DATA / "simsonWoodsV375.json").read_bytes())
  xy = words(data, "vertices", "<u2").reshape(-1, 3)[:, :2] / 100
  ids = words(data, "indices", "<u2").reshape(-1, 3)
  return xy[ids]


def test_occupied_woodland_and_existing_nonvegetation():
  survey = json.loads(
    gzip.decompress((GEO / "simson-woods-v375-source.json.gz").read_bytes())
  )
  path = json.loads(
    gzip.decompress((GEO / "simson-paths-v375-source.json.gz").read_bytes())
  )
  physical = sh.union_all(sh.polygons(wood()))
  cadastral = next(
    world(w)
    for i, _, w in path["features"]
    if i == "tatsaechlichenutzungflaechen.59429"
  )
  positive = sh.union_all([world(w) for _, w in survey["wood"]]).intersection(cadastral)
  assert physical.difference(positive.buffer(0.02)).area < 0.001
  assert abs(physical.area - 20116.06) < 0.5
  forbidden = sh.union_all(
    [world(w) for _, w in survey["protected"]]
    + [world(w) for i, _, w in path["osm"] if i in ("8329727", "8329726", "591200197")]
  )
  assert physical.intersection(forbidden.buffer(-0.02)).area < 0.002
  tunnels = {
    i: world(w)
    for i, k, designation, w in survey["underground"]
    if k == "1870" and designation == "Tunnel, Unterführung"
  }
  for identifier, point in [
    ("DEBE01YYK0003WJ4", (175.599, 249.508)),
    ("DEBE01YYK0001zkY", (342.109, 228.251)),
  ]:
    location = sh.Point(*point)
    assert tunnels["bauwerkeflaechen." + identifier].covers(
      location
    ) and physical.covers(location)
  # The source is an exact set of existing 4 m hosts. Outside the bounded
  # vegetation the replacement is exactly their original horizontal top.
  cuts = json.loads((DATA / "simsonWoodRasterV375.json").read_bytes())
  hosts = words(cuts, "hosts", "<f4").reshape(-1, 7)
  faces = words(cuts, "fragments", "<i4").reshape(-1, 3, 2) / 100
  assert len(hosts) == 66
  offset = 0
  for x, z, X, Z, _, _, count in hosts:
    count = int(count)
    rest = sh.union_all(sh.polygons(faces[offset : offset + count]))
    original = sh.box(x, z, X, Z)
    expected = original.difference(physical)
    # Each crossing is stored to 1 cm, including where the replacement drape
    # re-cuts this physical boundary at a different grid interval.
    assert expected.difference(rest.buffer(0.022)).area < 0.001
    assert rest.difference(expected.buffer(0.022)).area < 0.001
    offset += count
  assert offset == len(faces)


def test_woodland_triangles_follow_the_real_dgm_support():
  xyz = wood()
  ground = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json").read_bytes()
  )
  h, g = ground["ground_height"], ground["grid"]
  elevations = np.asarray(h["y_dm"]).reshape(-1, h["cols"]) / 10
  size = ground["cell_m"] * h["stride_cells"]
  first = np.array([g["min_x_idx"], g["min_z_idx"]]) * ground["cell_m"] + size / 2
  uv = (xyz - first) / size
  assert np.all(np.ceil(uv.max(axis=1) - 1e-10) - np.floor(uv.min(axis=1) + 1e-10) <= 1)

  def terrain(uv):
    ints = np.floor(uv).astype(int)
    i, j = ints[:, :, 0], ints[:, :, 1]
    u, v = (uv - ints).transpose(2, 0, 1)
    return (
      (1 - u) * (1 - v) * elevations[j, i]
      + u * (1 - v) * elevations[j, i + 1]
      + (1 - u) * v * elevations[j + 1, i]
      + u * v * elevations[j + 1, i + 1]
    )

  y = terrain(uv)
  # Inside one bilinear DGM support cell the error has no interior extrema.
  # On each straight triangle edge its extrema are the vertices and midpoint.
  mid = (uv + np.roll(uv, 1, axis=1)) / 2
  error = np.abs(terrain(mid) - (y + np.roll(y, 1, axis=1)) / 2)
  assert np.max(error) < 0.02
