"""Compare the shipped Simsonweg mesh to Berlin's source footprints and captured ground planes."""

import base64
import gzip
import json
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.affinity import affine_transform

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app"


def words(data, key, dtype="<u2"):
  return np.frombuffer(gzip.decompress(base64.b64decode(data[key])), dtype)


def load():
  source = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/simson-paths-v375-source.json.gz"
      ).read_bytes()
    )
  )
  data = json.loads((APP / "src/data/simsonPathsV375.json").read_bytes())
  verts, index = (
    words(data, "vertices").reshape(-1, 3),
    words(data, "indices").reshape(-1, 3),
  )
  xz = verts[:, :2] / 100
  styles = verts[index[:, 0], 2]
  assert np.all(verts[index, 2] == styles[:, None])
  return source, data, verts, index, xz, sh.polygons(xz[index]), styles


def world(hex_):
  return affine_transform(sh.from_wkb(hex_), [1, 0, 0, -1, -389500, 5820000])


def test_matching_materials_preserve_the_memorial_and_gate():
  source, data, _, _, _, triangles, styles = load()
  shapes = {
    k: sh.union_all(triangles[styles == i]) for i, k in enumerate(data["styles"])
  }
  total = sh.union_all(list(shapes.values()))
  # The 8 m draping cells snap their crossings independently to centimetres.
  # Keep resulting sub-centimetre boundary slivers below 20 parts per million.
  assert abs(sum(s.area for s in shapes.values()) - total.area) < total.area * 0.000020
  assert 10330 < total.area < 10355
  official = {i: world(g) for i, _, g in source["features"]}
  old = json.loads((APP / "src/data/gateForecourtsV374.json").read_bytes())
  ov = words(old, "vertices").reshape(-1, 3)
  oi = words(old, "indices").reshape(-1, 3)
  xy = ov[:, :2] / 100 + [292, 220]
  old_tri = sh.polygons(xy[oi])
  prior = sh.union_all(old_tri[sh.area(old_tri) > 1e-6])
  join = total.intersection(prior.buffer(-0.025))
  assert join.area < 0.035 and join.buffer(-0.009).is_empty
  osm = {i: world(g) for i, _, g in source["osm"]}
  protected = sh.union_all(
    [osm[k] for k in ("8329726", "8329727", "591200197")]
    + [official["bauwerkeflaechen.DEBE01YYK0003bTH"]]
  )
  for fid in ("cl_gehweg.386624", "cl_gehweg.387685", "cl_gehweg.387937"):
    inside = (
      official[fid]
      .buffer(-0.04)
      .difference(prior.buffer(0.04))
      .difference(protected.buffer(0.025))
    )
    assert (
      inside.difference(shapes["gravel"].union(shapes["soil"]).buffer(0.025)).area < 0.1
    )
  for fid in ("cl_gehweg.387003", "cl_gehweg.387683", "cl_gehweg.663450"):
    inside = (
      official[fid]
      .buffer(-0.04)
      .difference(prior.buffer(0.04))
      .difference(protected.buffer(0.025))
    )
    assert (
      inside.difference(shapes["mosaic"].union(shapes["soil"]).buffer(0.025)).area < 0.1
    )
  for landmark in ["8329726", "8329727", "591200197"]:
    assert total.intersection(osm[landmark].buffer(-0.025)).area < 0.001
  branch = official["bauwerkeflaechen.DEBE01YYK0002R3q"]
  assert shapes["sett"].covers(
    branch.intersection(sh.box(165, 297, 178, 303)).representative_point()
  )
  assert shapes["lawn"].area < 65


def test_path_is_above_every_retained_raster_triangle_in_the_capture():
  src, _, verts, idx, xz, footprints, _ = load()
  ground = json.loads(
    (APP / "public/mesh/regierungsviertel/ground-context.json").read_bytes()
  )
  h, grid = ground["ground_height"], ground["grid"]
  samples = np.array(h["y_dm"]).reshape(-1, h["cols"]) / 10
  uv = (xz / ground["cell_m"] - [grid["min_x_idx"], grid["min_z_idx"]]) / h[
    "stride_cells"
  ] - 0.5
  cell = np.floor(uv).astype(int)
  i, j = cell.T
  u, v = (uv - cell).T
  level = (
    (1 - u) * (1 - v) * samples[j, i]
    + u * (1 - v) * samples[j, i + 1]
    + (1 - u) * v * samples[j + 1, i]
    + u * v * samples[j + 1, i + 1]
  )
  level += np.where(verts[:, 2] == 2, 0.29, 0.32)
  left = np.column_stack([xz, np.ones(len(xz))])
  new_planes = np.linalg.solve(left[idx], level[idx, None])[:, :, 0]
  old_shapes = []
  old_planes = []
  for x, z, X, Z, y, _ in src["baseline"]["rows"]:
    if X > x and Z > z:
      old_shapes.append(sh.box(x, z, X, Z))
      old_planes.append([0, 0, y])
  for group, _, _, _, coords in src["baseline"]["tris"]:
    if group != "rasterComplement":
      continue
    xyz = np.array(coords).reshape(3, 3)
    p = xyz[:, [0, 2]]
    old_shapes.append(sh.Polygon(p))
    old_planes.append(np.linalg.solve(np.column_stack([p, np.ones(3)]), xyz[:, 1]))
  new, old = sh.STRtree(old_shapes).query(footprints, predicate="intersects")
  intersections = sh.intersection(footprints[new], np.array(old_shapes)[old])
  mask = sh.area(intersections) > 1e-6
  common, ids = sh.get_coordinates(intersections[mask], return_index=True)
  planes = (new_planes[new] - np.array(old_planes)[old])[mask][ids]
  margin = np.sum(planes[:, :2] * common, axis=1) + planes[:, 2]
  assert len(margin) > 18000
  assert min(margin) > 0.023
