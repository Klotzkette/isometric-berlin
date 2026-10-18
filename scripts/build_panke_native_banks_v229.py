"""Attach native Panke fittings to the retained four-metre ground raster.

The source land runs remain untouched. Their water-facing cell edges, not the
drawn curved shoreline, locate the additive native wall and masonry courses.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import LineString, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
GROUND = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
SOURCE = GEO / "panke-banks-v229-source.json"
DRAWN = ROOT / "src/app/src/data/pankeBanksV229.json"
DEST = ROOT / "src/app/src/data/pankeNativeBanksV229.json"
EVIDENCE = GEO / "panke-native-banks-v229-evidence.json"
LAND = {"grass", "asphalt", "plazaBrick", "concrete", "glass"}


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def native_footprint(row: list) -> object:
  """Conservative footprint of all emitted boxes, including coping/paint.

  Native quads are independently axis-aligned; a diagonal one-metre step has
  wider AABB corners. Keep those corners out of the protected passages too.
  """
  ax, az, bx, bz, nx, nz = row[:6]
  length = math.hypot(bx - ax, bz - az)
  ux, uz = (bx - ax) / length, (bz - az) / length
  count = math.ceil(length / 12)
  pieces = []
  for part in range(count):
    lo, hi = part * length / count, (part + 1) * length / count
    steps = math.ceil(hi - lo)
    width = (hi - lo) / steps
    for i in range(steps):
      u = lo + (i + 0.5) * width
      # Includes all offsets .06/.075/.08/.09/.12 and their .045 half-width.
      points = [
        (ax + ux * u + nx * offset, az + uz * u + nz * offset)
        for offset in [0.06, 0.12]
      ]
      wx = max(0.09, abs(ux) * width + abs(nx) * 0.09)
      wz = max(0.09, abs(uz) * width + abs(nz) * 0.09)
      pieces.append(
        box(
          min(p[0] for p in points) - wx / 2,
          min(p[1] for p in points) - wz / 2,
          max(p[0] for p in points) + wx / 2,
          max(p[1] for p in points) + wz / 2,
        )
      )
  # Paint strokes can straddle a one-metre split; cover their true AABB as well.
  if row[6] == "brick":
    for part in range(count):
      lo, hi = part * length / count, (part + 1) * length / count
      if hi - lo <= 2.2:
        continue
      for i in range(5):
        a = lo + 0.4 + i * 0.34
        b = a + (0.43 if i < 4 else 0.15)
        u = (a + b) / 2
        x, z = ax + ux * u + nx * 0.12, az + uz * u + nz * 0.12
        wx = max(0.09, abs(ux) * (b - a) + abs(nx) * 0.09)
        wz = max(0.09, abs(uz) * (b - a) + abs(nz) * 0.09)
        pieces.append(box(x - wx / 2, z - wz / 2, x + wx / 2, z + wz / 2))
  return unary_union(pieces)


def build() -> dict:
  ground = json.loads(GROUND.read_text())
  source = json.loads(SOURCE.read_text())
  drawn = json.loads(DRAWN.read_text())
  cell = ground["cell_m"]
  assert cell == 4
  grid = ground["grid"]
  field = ground["ground_height"]
  scope = shape(source["scope"])
  water = unary_union([shape(w["geometry"]) for w in source["waters"]])
  corridor = water.intersection(scope).buffer(cell)
  protected = unary_union(
    [shape(source["tunnels"]), shape(source["mouths"]).buffer(0.2)]
  )
  core_bounds = box(
    grid["min_x_idx"] * cell,
    grid["min_z_idx"] * cell,
    (grid["min_x_idx"] + grid["cols"]) * cell,
    (grid["min_z_idx"] + grid["rows"]) * cell,
  )
  # Keep only bounded nearby cells. Heights follow the *original complete run*
  # midpoint used by createGroundSlabsSteps; splitting a run first changes Y.
  cells = {}
  bridges = []
  left, top, right, bottom = corridor.bounds
  for zo, runs in enumerate(ground["ground_rows"]):
    iz = grid["min_z_idx"] + zo
    if (iz + 1) * cell < top or iz * cell > bottom:
      continue
    for xo, count, class_id in runs:
      name = ground["classes"][class_id]
      col = min(field["cols"] - 1, int((xo + count / 2) // field["stride_cells"]))
      row = min(field["rows"] - 1, zo // field["stride_cells"])
      y = field["y_dm"][row * field["cols"] + col] / 10
      for ix in range(
        max(grid["min_x_idx"] + xo, math.floor(left / cell)),
        min(grid["min_x_idx"] + xo + count, math.ceil(right / cell)),
      ):
        footprint = box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)
        if not footprint.intersects(corridor):
          continue
        cells[ix, iz] = (name, y, xo, count, zo, class_id)
        if name == "bridge":
          bridges.append(footprint)
  bridge_mask = unary_union(bridges)
  protected = protected.union(bridge_mask)
  banks, receipts = [], []
  rejected = dict(protected=0, off_source=0)
  for (ix, iz), value in sorted(cells.items()):
    if value[0] != "water":
      continue
    water_cell = box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)
    if not water_cell.intersects(water):
      continue
    for dx, dz in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
      land = cells.get((ix + dx, iz + dz))
      if land is None or land[0] not in LAND:
        continue
      if dx:
        x = (ix + (dx > 0)) * cell
        a, b = (x, iz * cell), (x, (iz + 1) * cell)
      else:
        z = (iz + (dz > 0)) * cell
        a, b = (ix * cell, z), ((ix + 1) * cell, z)
      edge = LineString([a, b])
      mid = edge.interpolate(0.5, normalized=True)
      if not scope.covers(edge) or water.boundary.distance(mid) > cell:
        rejected["off_source"] += 1
        continue
      material = (
        "brick" if -3520 < mid.y < -2285 else "concrete" if mid.y > -2285 else "earth"
      )
      y = round(land[1] + 0.12, 3)
      bank = [*a, *b, -dx, -dz, material, y, y, -2]
      if native_footprint(bank).intersects(protected):
        rejected["protected"] += 1
        continue
      banks.append(bank)
      receipts.append(
        dict(
          bank=len(banks) - 1,
          waterCell=[ix, iz],
          landCell=[ix + dx, iz + dz],
          landRun=list(land[2:]),
          landTop=land[1],
        )
      )
  # No four-metre core exists north of z=-3620. Preserve the existing source
  # bank axes there (rather than inventing a second raster) after full-box cuts.
  retained = []
  for index, row in enumerate(drawn["banks"]):
    footprint = native_footprint(row)
    if footprint.intersects(core_bounds) or footprint.intersects(protected):
      continue
    retained.append(index)
    banks.append(row)
  model = dict(schemaVersion=1, waterY=ground["water_top_y_m"], banks=banks)
  DEST.write_text(json.dumps(model, separators=(",", ":")) + "\n")
  evidence = dict(
    schemaVersion=1,
    groundSha256=sha(GROUND),
    sourceSha256=sha(SOURCE),
    drawnSha256=sha(DRAWN),
    nativeSha256=sha(DEST),
    cellM=cell,
    nativeRasterBanks=len(receipts),
    retainedOutsideCoreIndices=retained,
    rejected=rejected,
    banks=receipts,
    bridgeCells=sorted([list(k) for k, v in cells.items() if v[0] == "bridge"]),
    policy=(
      "Additive fittings on actual water-facing retained four-metre ground-run "
      "edges; no deleted source blocks, no new river, no change to navigation "
      "or original heights. Entire native box footprints avoid mapped tunnels, "
      "mouth and bridge cells. Outside core bounds previous source-aligned bank "
      "axes remain; bank materials, courses and paint remain display estimates."
    ),
  )
  EVIDENCE.write_text(json.dumps(evidence, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      dict(
        rasterBanks=len(receipts),
        retainedOutsideCore=len(retained),
        rejected=rejected,
        bytes=DEST.stat().st_size,
      )
    )
  )
  return model


if __name__ == "__main__":
  build()
