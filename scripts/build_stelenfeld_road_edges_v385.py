"""Recover sampled gaps in the surveyed asphalt immediately outside the Berlin memorial."""

import argparse
import base64
import gzip
import json
import math
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app"
CORE = APP / "public/mesh/regierungsviertel"
# Locations with ground grass visible in the viewer after all eight local
# asphalt and paving packets have loaded. A witness admits one connected gap.
GREEN_SAMPLES = (
  (446, 638),
  (486, 626),
  (522, 618),
  (546.14, 500.13),
  (553.51, 525.07),
  (392.93, 559.74),
  (388.77, 587.92),
  (385.57, 609.76),
  (564.22, 561.38),
)


def local(geojson):
  return sh.make_valid(
    affine_transform(shape(geojson), [1, 0, 0, -1, -389500, 5820000])
  )


def intersecting_triangles(xz, indices, window):
  faces = xz[indices.reshape((-1, 3))]
  lowx, lowz, highx, highz = window.bounds
  xs, zs = faces[:, :, 0], faces[:, :, 1]
  included = (
    (xs.max(axis=1) > lowx)
    & (xs.min(axis=1) < highx)
    & (zs.max(axis=1) > lowz)
    & (zs.min(axis=1) < highz)
  )
  if included.any():
    return sh.union_all(sh.polygons(faces[included])).intersection(window)
  return Polygon()


def decoded(record, key, dtype):
  return np.frombuffer(base64.b64decode(record[key]), dtype=dtype)


def remaining_run_top(site, row, xi, zi, grid, run, cell, ys, stride):
  """Match createGroundSlabsSteps after its fully-owned memorial cell cut."""
  x_offset = xi - grid["min_x_idx"]
  left, right = x_offset, x_offset + 1

  def removed(offset):
    x = (offset + grid["min_x_idx"]) * cell
    z = zi * cell
    return site.contains(box(x, z, x + cell, z + cell))

  while left > run[0] and not removed(left - 1):
    left -= 1
  while right < run[0] + run[1] and not removed(right):
    right += 1
  return ys[row // stride, int((left + right) / 2) // stride]


def delivered_paving(window):
  data = APP / "src/data"
  obstacles = []
  for filename in ("districtStreets.json", "schlossEastStreets.json"):
    streets = json.loads((data / filename).read_bytes())
    for part in streets["surfaces"]:
      points = decoded(part, "positions_cm_b64", "<i4").reshape((-1, 2)) / 100
      obstacles.append(
        intersecting_triangles(points, decoded(part, "indices_b64", "<u4"), window)
      )
    for line in streets["curbs_m"] + [m["points"] for m in streets["markings_m"]]:
      if len(line) >= 2:
        boundary = LineString(line)
        if boundary.intersects(window):
          obstacles.append(boundary.buffer(0.25).intersection(window))
  surfaces = json.loads((CORE / "surface-polygons.json").read_bytes())
  for source in surfaces["roads"]:
    polygon = Polygon(
      np.asarray(source["ring"]) / 10, [np.asarray(h) / 10 for h in source["holes"]]
    )
    if polygon.envelope.intersects(window):
      obstacles.append(sh.make_valid(polygon).intersection(window))
  for source in surfaces["lane_markings"]:
    if len(source["points"]) < 2:
      continue
    line = LineString(np.asarray(source["points"]) / 10)
    if line.intersects(window):
      obstacles.append(line.buffer(0.25).intersection(window))
  # Pretriangulated transport has its own ownership clipping, independent
  # of the original source footprint. Mask both representations.
  tiles = {(x, z) for x in (0, 1) for z in (0, 1)}
  selected = {
    f"restored-{kind}-{x}-{z}" for kind in ("asphalt", "paving") for x, z in tiles
  }
  found = set()
  with (data / "restoredRoadSurfaces.ndjson.txt").open() as stream:
    for line in stream:
      if not line.startswith(('{"id":"restored-paving-', '{"id":"restored-asphalt-')):
        continue
      part = json.loads(line)
      if part["id"] in selected:
        found.add(part["id"])
        points = decoded(part, "xz", "<f4").reshape((-1, 2))
        obstacles.append(
          intersecting_triangles(points, decoded(part, "indices", "<u4"), window)
        )
  assert selected == found, "All original road surfaces must be available"
  return sh.union_all(obstacles)


def build():
  survey = json.load(gzip.open(GEO / "stelenfeld-rand-v385.geojson.gz"))["layers"]
  site = Polygon(json.load(gzip.open(GEO / "stelenfeld-v385.json.gz"))["fieldBoundary"])
  window = site.buffer(15).difference(site)
  # Berlin's material register identifies 02 as bituminous asphalt.
  roads = sh.union_all(
    [
      local(r["geometry"])
      for r in survey["cm_fahrbahn"]
      if r["properties"]["material"] == "02"
    ]
  )
  forbidden_layers = (
    "cl_gehweg",
    "bn_baumscheibe",
    "bw_aufmerksamkeitsfeld",
    "by_gehwegueberfahrt",
    "ch_radweg",
    "cf_trennstreifen",
    "ck_parkflaeche",
    "ce_gruenflaeche",
  )
  forbidden = sh.union_all(
    [local(r["geometry"]) for layer in forbidden_layers for r in survey[layer]]
  )
  source = roads.intersection(window).difference(
    sh.union_all([forbidden, delivered_paving(window)]).buffer(0.025)
  )
  ground = json.loads((CORE / "ground-context.json").read_bytes())
  cell = ground["cell_m"]
  grid = ground["grid"]
  heights = ground["ground_height"]
  ys = np.asarray(heights["y_dm"]).reshape((heights["rows"], heights["cols"])) / 10
  xmin, zmin, xmax, zmax = window.bounds
  cells = {}
  for zi in range(math.floor(zmin / cell), math.ceil(zmax / cell)):
    row = zi - grid["min_z_idx"]
    for xi in range(math.floor(xmin / cell), math.ceil(xmax / cell)):
      col = xi - grid["min_x_idx"]
      run = next(
        (
          (start, n, cls)
          for start, n, cls in ground["ground_rows"][row]
          if start <= col < start + n
        ),
        None,
      )
      if run and ground["classes"][run[2]] == "grass":
        # The legacy ground slabs use the midpoint of their original
        # horizontal run for height. A long slab can sit above the DTM.
        coarse = ys[
          row // heights["stride_cells"],
          int((run[0] + run[1] / 2) // heights["stride_cells"]),
        ]
        cells[(xi, zi)] = (
          box(xi * cell, zi * cell, (xi + 1) * cell, (zi + 1) * cell),
          coarse,
        )
  gaps = source.intersection(sh.union_all([p for p, y in cells.values()]))
  sites = [Point(coord) for coord in GREEN_SAMPLES]
  approved = sh.union_all(
    [
      g
      for g in sh.get_parts(gaps)
      if g.geom_type == "Polygon" and any(g.covers(p) for p in sites)
    ]
  )
  assert all(approved.covers(pt) for pt in sites) and 0 < approved.area < 1000
  assert approved.intersection(forbidden).area < 0.00001
  assert not approved.covers(Point(382, 634)), (
    "Retain the original western District kerb"
  )

  def smooth(x, z):
    u = (x / cell - grid["min_x_idx"]) / heights["stride_cells"] - 0.5
    v = (z / cell - grid["min_z_idx"]) / heights["stride_cells"] - 0.5
    i, j = math.floor(u), math.floor(v)
    u -= i
    v -= j
    return (ys[j, i] * (1 - u) + ys[j, i + 1] * u) * (1 - v) + (
      ys[j + 1, i] * (1 - u) + ys[j + 1, i + 1] * u
    ) * v

  vertices = []
  indices = []
  unique = {}
  for (xi, zi), (bounds, coarse) in cells.items():
    if not approved.intersects(bounds):
      continue
    for part in sh.get_parts(approved.intersection(bounds)):
      if part.geom_type != "Polygon" or part.area < 0.00005:
        continue
      native_y = coarse + 0.12
      row, col = zi - grid["min_z_idx"], xi - grid["min_x_idx"]
      run = next(r for r in ground["ground_rows"][row] if r[0] <= col < r[0] + r[1])
      top = remaining_run_top(
        site, row, xi, zi, grid, run, cell, ys, heights["stride_cells"]
      )
      if native_y <= top:
        # Match the visible 2 cm clearance of the adjoining native asphalt.
        native_y = top + 0.02
      for triangle in sh.get_parts(sh.constrained_delaunay_triangles(part)):
        corners = list(sh.orient_polygons(triangle, exterior_cw=True).exterior.coords)[
          :3
        ]
        face = []
        for x, z in corners:
          # 14 cm is the established drawn carriageway lift. Only
          # on an unusually high retained ground slab is it raised.
          y = max(smooth(x, z) + 0.14, coarse + 0.025)
          vertex = (
            round((x - 460) * 1000),
            round((z - 550) * 1000),
            round(y * 1000),
            round(native_y * 1000),
          )
          if vertex not in unique:
            unique[vertex] = len(vertices)
            vertices.append(vertex)
          face.append(unique[vertex])
        if len(set(face)) == 3:
          indices.extend(face)
  values = np.asarray(vertices)

  def encoded(array, kind):
    return base64.b64encode(np.asarray(array, dtype=kind).tobytes()).decode()

  return {
    "xz": encoded(values[:, :2], "<i4"),
    "y": encoded(values[:, 2:], "<i2"),
    "index": encoded(indices, "<u2"),
  }, approved.area


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  data, area = build()
  out = APP / "src/data/stelenfeldV385/roads.json"
  encoded = json.dumps(data, separators=(",", ":")) + "\n"
  if args.check:
    if out.read_text() != encoded:
      raise SystemExit("Stale memorial road patches")
  else:
    out.write_text(encoded)
  print(f"{area:.2f} m² of surveyed asphalt, {len(encoded)} bytes")
