"""Prepare bounded paved entrances in the Potsdamer and Leipziger Platz ensembles."""

import argparse
import gzip
import json
import math
from pathlib import Path

import numpy as np
import shapely as sh
from build_stelenfeld_road_edges_v385 import delivered_paving, local
from shapely.geometry import Point, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "src/app/public/mesh/regierungsviertel"
FRONTS = [
  ((235.6, 980.2), (252.2, 978.6), (246.13, 979.02)),
  ((385.909, 984.756), (404.669, 962.634), (395.3, 973.7)),
]
GREEN = [(246.33, 981.02), (246.63, 984.02), (398.55, 977.45)]


MALL_GRASS = [(526, 998.7), (525, 1005.5), (527, 1012), (530.35, 1018.4)]
MALL_CONTROLS = [(519, 1004), (511.614, 1010.57), (490, 1000), (508.46, 999.67)]


def mall_entrance():
  source = json.load(
    gzip.open(ROOT / "geo_data/regierungsviertel/mall-westeingang-v385.json.gz")
  )
  layers = source["layers"]
  a, b = np.array([530.479, 992.085]), np.array([532.900, 1022.642])
  nx, nz = (b - a) / np.linalg.norm(b - a)
  outward = 17 * np.array([-nz, nx])
  window = Polygon([a, b, b + outward, a + outward])
  parcel = local(layers["tatsaechlichenutzungflaechen"][0]["geometry"])
  roads = sh.union_all([local(row["geometry"]) for row in layers["cm_fahrbahn"]])
  # The old street survey mapped the opposite sidewalk. On this side the
  # cadastral AX_Platz and road edge bound the paving seen in Berlin TrueDOP.
  # Only the connected face at the surveyed shop entrance is eligible.
  entrance = np.array(source["osmEntrance"]["worldXZ"]) + outward / 17
  face = next(
    p
    for p in sh.get_parts(window.intersection(parcel).difference(roads))
    if p.covers(Point(entrance))
  )
  exclusions = [
    local(row["geometry"])
    for layer in (
      "gebaeudeflaechen",
      "cm_fahrbahn",
      "ce_gruenflaeche",
      "bn_baumscheibe",
      "bm_zugangsbauwerk",
      "bw_aufmerksamkeitsfeld",
    )
    for row in layers[layer]
  ]
  for layer in ("strassenbaeume", "anlagenbaeume"):
    exclusions += [local(row["geometry"]).buffer(1.25) for row in layers[layer]]
  # No material code survives at this 2014-survey gap. Zero identifies the
  # neutral paving approximation separately from the measured 04/07/08 finish.
  return [face], [(0, face)], exclusions


def build(mall=False):
  windows = []
  for a, b, entrance in FRONTS:
    t = np.subtract(b, a)
    t = t / np.linalg.norm(t)
    normal = np.array([-t[1], t[0]])
    centre = np.array(a) + np.dot(np.subtract(entrance, a), t) * t
    left, right = centre - 4.5 * t, centre + 4.5 * t
    windows.append(Polygon([left, right, right + 8 * normal, left + 8 * normal]))
  if mall:
    windows, surfaces, obstacles = mall_entrance()
  else:
    survey = json.load(
      gzip.open(ROOT / "geo_data/regierungsviertel/potsdamer-eingangswege-v385.json.gz")
    )["layers"]
    obstacles = [
      local(row["geometry"])
      for name, rows in survey.items()
      if name != "cl_gehweg"
      for row in rows
    ]
    surfaces = [
      (int(row["properties"]["material"]), local(row["geometry"]))
      for row in survey["cl_gehweg"]
    ]
  area = sh.union_all(windows)
  original_paving = delivered_paving(area)
  for b in json.loads((CORE / "lod2-prisms.json").read_bytes())["buildings"]:
    # The measured cantilever is ~5.7 m overhead, leaving this pavement open.
    if b["id"] == "K0003V2X" or len(b["ring"]) < 3:
      continue
    x, z = b["ring"][0]
    if not (1700 < x < (6400 if mall else 4750) and 8900 < z < 10600):
      continue
    shell = sh.make_valid(
      Polygon(np.asarray(b["ring"]) / 10, [np.asarray(h) / 10 for h in b["holes"]])
    )
    if shell.intersects(area):
      obstacles.append(shell)
  native_exclusion = sh.union_all(obstacles).buffer(0.015)
  exclusion = sh.union_all([*obstacles, original_paving]).buffer(0.015)
  payload = json.loads((CORE / "ground-context.json").read_bytes())
  cell = payload["cell_m"]
  grid = payload["grid"]
  height = payload["ground_height"]
  gridY = np.asarray(height["y_dm"]).reshape((height["rows"], height["cols"])) / 10
  grass = []
  for w in windows:
    xmin, zmin, xmax, zmax = w.bounds
    for zi in range(math.floor(zmin / cell), math.ceil(zmax / cell)):
      row = zi - grid["min_z_idx"]
      for xi in range(math.floor(xmin / cell), math.ceil(xmax / cell)):
        col = xi - grid["min_x_idx"]
        run = next(
          (
            (start, n, c)
            for start, n, c in payload["ground_rows"][row]
            if start <= col < start + n
          ),
          None,
        )
        if run and payload["classes"][run[2]] == "grass":
          ground = gridY[
            row // height["stride_cells"],
            int((run[0] + run[1] / 2) // height["stride_cells"]),
          ]
          grass.append(
            (box(cell * xi, cell * zi, cell * (xi + 1), cell * (zi + 1)), ground)
          )

  def smooth(x, z):
    i = (x / cell - grid["min_x_idx"]) / height["stride_cells"] - 0.5
    j = (z / cell - grid["min_z_idx"]) / height["stride_cells"] - 0.5
    a, b = math.floor(i), math.floor(j)
    u, v = i - a, j - b
    return (gridY[b, a] * (1 - u) + gridY[b, a + 1] * u) * (1 - v) + (
      gridY[b + 1, a] * (1 - u) + gridY[b + 1, a + 1] * u
    ) * v

  points = []
  seen = {}
  indices = []
  placed = []
  native_cells = {}
  for material, poly in surfaces:
    parcel = poly.intersection(area).difference(exclusion)
    # Smooth progressive road packets are attached exclusively to isoWorld.
    # Native fills its own confirmed green cells up to the same entrance.
    native_parcel = (
      poly.intersection(area).difference(native_exclusion) if mall else parcel
    )
    for cellArea, ground in grass:
      for face in sh.get_parts(native_parcel.intersection(cellArea)):
        if face.geom_type != "Polygon" or face.area < 0.005:
          continue
        # Keep each native quarter-metre paver completely within its mapped
        # material and grass cell. Adjacent pavers at the same height share a row.
        xmin, zmin, xmax, zmax = face.bounds
        for iz in range(math.ceil(zmin * 4), math.floor(zmax * 4)):
          for ix in range(math.ceil(xmin * 4), math.floor(xmax * 4)):
            if face.covers(box(ix / 4, iz / 4, (ix + 1) / 4, (iz + 1) / 4)):
              level = ground + 0.08
              if mall:
                # The neighbouring original paving follows the DTM at +10 cm.
                # A long grass run can sit 80 cm below the real entrance floor.
                level = max(
                  ground + 0.05,
                  round((smooth((ix + 0.5) / 4, (iz + 0.5) / 4) + 0.1) * 20) / 20,
                )
              native_cells[(iz, ix)] = (round(level * 1000), int(material))
      for face in sh.get_parts(parcel.intersection(cellArea)):
        if face.geom_type != "Polygon" or face.area < 0.005:
          continue
        placed.append(face)
        for t in sh.get_parts(sh.constrained_delaunay_triangles(face)):
          corners = []
          for x, z in list(sh.orient_polygons(t, exterior_cw=True).exterior.coords)[:3]:
            key = (
              round((x - 320) * 1000),
              round((z - 980) * 1000),
              round(1000 * max(ground + 0.05, smooth(x, z) + 0.10)),
              round((ground + 0.08) * 1000),
              int(material),
            )
            if key not in seen:
              seen[key] = len(points)
              points.append(key)
            corners.append(seen[key])
          if len(set(corners)) < 3:
            continue
          if mall:
            (ax, az), (bx, bz), (cx, cz) = [points[k][:2] for k in corners]
            # Three sub-millimetre slivers reverse as the coordinates round.
            if (bz - az) * (cx - ax) <= (bx - ax) * (cz - az):
              continue
          indices.extend(corners)
  surface = sh.union_all(placed)
  samples = MALL_GRASS if mall else GREEN
  assert all(surface.covers(Point(x, z)) for x, z in samples)
  controls = MALL_CONTROLS if mall else [(401.15, 980.45)]
  assert not any(surface.covers(Point(p)) for p in controls)
  assert (
    0 < surface.area <= area.area + 0.001
    and surface.intersection(exclusion).area < 0.000001
  )
  runs = []
  for (iz, ix), (level, material) in sorted(native_cells.items()):
    x, z = ix - 1280, iz - 3920
    if (
      runs
      and runs[-1][1] == z
      and runs[-1][0] + runs[-1][2] == x
      and runs[-1][3:] == [level, material]
    ):
      runs[-1][2] += 1
    else:
      runs.append([x, z, 1, level, material])
  assert all((math.floor(z * 4), math.floor(x * 4)) in native_cells for x, z in samples)

  def soil(x, z):
    col, row = (
      math.floor(x / cell) - grid["min_x_idx"],
      math.floor(z / cell) - grid["min_z_idx"],
    )
    for start, n, _ in payload["ground_rows"][row]:
      if start <= col < start + n:
        return round(
          1000
          * gridY[
            row // height["stride_cells"],
            int((start + n / 2) // height["stride_cells"]),
          ]
        )
    raise ValueError("Missing edge substrate")

  def edge_bottom(x, z):
    return (
      min(soil(x + dx, z + dz) for dx in (-0.02, 0.02) for dz in (-0.02, 0.02)) - 20
    )

  # Close the free perimeter down into the actual neighboring ground. Using
  # the projected edge key keeps material boundaries and inner triangles open.
  neighbors = {}
  for a, b, c in zip(indices[::3], indices[1::3], indices[2::3]):
    for i, j in ((a, b), (b, c), (c, a)):
      key = tuple(sorted((points[i][:2], points[j][:2])))
      neighbors.setdefault(key, []).append((i, j))
  drawn_edges = []
  for records in neighbors.values():
    if len(records) != 1:
      continue
    i, j = records[0]
    x = (points[i][0] + points[j][0]) / 2000 + 320
    z = (points[i][1] + points[j][1]) / 2000 + 980
    drawn_edges.append(
      [i, j, min(points[i][3] - 100, points[j][3] - 100, edge_bottom(x, z))]
    )

  # Only outside edges and real height steps of the native paving receive a
  # side. Join collinear unit edges with identical heights and material.
  perimeter = {}
  for (iz, ix), (level, material) in native_cells.items():
    x, z = ix - 1280, iz - 3920
    for dx, dz, ax, az, bx, bz in (
      (-1, 0, x, z, x, z + 1),
      (0, 1, x, z + 1, x + 1, z + 1),
      (1, 0, x + 1, z + 1, x + 1, z),
      (0, -1, x + 1, z, x, z),
    ):
      other = native_cells.get((iz + dz, ix + dx))
      if other and other[0] >= level:
        continue
      foot = (
        other[0]
        if other
        else min(level - 100, edge_bottom(320 + (ax + bx) / 8, 980 + (az + bz) / 8))
      )
      k = (bx - ax, bz - az, ax if ax == bx else az, level, foot, material)
      perimeter.setdefault(k, set()).add(min(az, bz) if ax == bx else min(ax, bx))
  native_edges = []
  for (dx, dz, fixed, level, foot, material), steps in sorted(perimeter.items()):
    while steps:
      start = min(steps)
      end = start
      while end in steps:
        steps.remove(end)
        end += 1
      a, b = (start, end) if dx + dz > 0 else (end, start)
      edge = [a, fixed, b, fixed] if dx else [fixed, a, fixed, b]
      native_edges.append([*edge, level, foot, material])
  return dict(
    vertices=points,
    indices=indices,
    native=runs,
    sides=drawn_edges,
    nativeSides=native_edges,
  ), surface.area


if __name__ == "__main__":
  cli = argparse.ArgumentParser(description=__doc__)
  cli.add_argument("--check", action="store_true")
  args = cli.parse_args()
  for mall, name in (
    (False, "potsdamerForecourtsV385"),
    (True, "mallWestForecourtV385"),
  ):
    data, area = build(mall)
    out = ROOT / f"src/app/src/data/{name}.json"
    text = json.dumps(data, separators=(",", ":")) + "\n"
    if args.check:
      if out.read_text() != text:
        raise SystemExit(f"Stale public forecourt mesh: {name}")
    else:
      out.write_text(text)
    print(
      f"{name}: {area:.2f} m² public pavement, {len(data['indices']) // 3} triangles"
    )
