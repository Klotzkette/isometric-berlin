"""Step 10: exact low Steppengarten shelter, retaining the erroneous source.

Offline reconstruction: source XZ and identity are measured; replacement eave,
ridge, wall/stone dimensions are explicit reference-photograph estimates.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_tiergarten_werkhof_v275 import roof_at

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "geo_data/regierungsviertel/steppengarten-shelter-v283-source.json.gz"
OUTPUT = ROOT / "src/app/src/data/steppengartenShelterV283.json"
BASE = ROOT / "src/app/public/mesh/regierungsviertel"
PARENT = "DEBE00YYT600005H"


def digest(path: Path) -> str:
  """Fingerprint an unchanged retained input."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def old_polygon(part: dict) -> Polygon:
  """Interpret complete original presentation decimetres."""
  return Polygon(
    [(x / 10, z / 10) for x, z in part["ring"]],
    [[(x / 10, z / 10) for x, z in ring] for ring in part.get("holes", [])],
  )


def build() -> dict:
  """Create one bounded complete replacement and its exact old-owner receipt."""
  evidence = json.loads(gzip.decompress(EVIDENCE.read_bytes()))
  source = evidence["original"]
  assert source["id"] == PARENT and len(source["surfaces"]) == 8
  ring = source["ring"]
  area = Polygon(ring)
  ground = source["ground_y_m"]
  eave, ridge = ground + 2.45, ground + 3.25
  roofs = []
  for surface in source["surfaces"]:
    if surface["kind"] != "RoofSurface":
      continue
    rings = [
      [
        [x, round(eave + (y - 16.61) / (24.142 - 16.61) * (ridge - eave), 6), z]
        for x, y, z in r
      ]
      for r in surface["rings"]
    ]
    roofs.extend(triangles_for(rings))

  # One open west gable, limestone long walls and rear wall. All divisions and
  # thicknesses are recognition estimates inside the original roof footprint.
  a, b, c, d = ring
  ux, uz = (b[0] - a[0]), (b[1] - a[1])
  length = math.hypot(ux, uz)
  ux, uz = ux / length, uz / length
  vx, vz = d[0] - a[0], d[1] - a[1]
  width = math.hypot(vx, vz)
  vx, vz = vx / width, vz / width

  def local(u, v):
    return [round(a[0] + ux * u + vx * v, 6), round(a[1] + uz * u + vz * v, 6)]

  def rect(u0, v0, u1, v1):
    return [local(u0, v0), local(u1, v0), local(u1, v1), local(u0, v1)]

  wall_rings = [
    rect(0.5, 0.35, length - 0.55, 0.73),
    rect(0.5, width - 0.73, length - 0.55, width - 0.35),
    rect(0.5, 0.35, 0.88, width - 0.35),
    rect(length - 0.95, 0.35, length - 0.4, 0.95),
    rect(length - 0.95, width - 0.95, length - 0.4, width - 0.35),
  ]
  walls = [dict(ring=r, minY=ground, maxY=ground + 2.3) for r in wall_rings]
  assert all(area.buffer(0.01).covers(Polygon(r)) for r in wall_rings)
  # Mortar courses use the same solids, with restrained per-stone variation.
  stones = []
  for wall_index, wall in enumerate(walls):
    r = wall["ring"]
    p0, p1, _, p3 = r
    w = math.dist(p0, p1)
    depth = math.dist(p0, p3)
    dx, dz = (p1[0] - p0[0]) / w, (p1[1] - p0[1]) / w
    nx, nz = (p3[0] - p0[0]) / depth, (p3[1] - p0[1]) / depth
    for row in range(10):
      count = max(1, math.ceil(w / 0.65))
      for col in range(count):
        step = w / count
        u = (col + 0.5) * step
        stones.append(
          [
            p0[0] + dx * u + nx * depth / 2,
            ground + (row + 0.5) * 0.23,
            p0[1] + dz * u + nz * depth / 2,
            step - 0.012,
            0.218,
            depth - 0.008,
            -math.atan2(dz, dx),
            [0xB8B5A5, 0xC5C1AF, 0xADAFA0][(wall_index + row + col) % 3],
          ]
        )

  native = []
  cell = 0.5
  xmin, zmin, xmax, zmax = area.bounds
  native_roofs = []
  for zi in range(math.floor(zmin / cell), math.ceil(zmax / cell)):
    for xi in range(math.floor(xmin / cell), math.ceil(xmax / cell)):
      x, z = (xi + 0.5) * cell, (zi + 0.5) * cell
      top = roof_at(roofs, x, z)
      if top is None:
        continue
      top = math.ceil(top * 4) / 4
      native_roofs.append([x, z, top])
      native.append([x, top - 0.125, z, cell, 0.25, cell, 0, 0x48493E])
  wall_union = unary_union([Polygon(r) for r in wall_rings])
  native_walls = []
  wall_cell = 0.25
  for zi in range(math.floor(zmin / wall_cell), math.ceil(zmax / wall_cell)):
    for xi in range(math.floor(xmin / wall_cell), math.ceil(xmax / wall_cell)):
      x, z = (xi + 0.5) * wall_cell, (zi + 0.5) * wall_cell
      if not wall_union.covers(Point(x, z)):
        continue
      native_walls.append([x, z])
      native.append([x, ground + 1.15, z, wall_cell, 2.3, wall_cell, 0, 0xBBB8A8])

  prism_path, voxel_path = BASE / "lod2-prisms.json", BASE / "minecraft-voxels.json"
  prisms = json.loads(prism_path.read_bytes())["buildings"]
  previous = [p for p in prisms if p["id"] == PARENT[-8:]]
  assert len(previous) == 1
  old_area = old_polygon(previous[0])
  neighbours = [
    p
    for p in prisms
    if p["id"] != PARENT[-8:] and old_polygon(p).intersects(old_area.envelope.buffer(8))
  ]
  occupied = unary_union([old_polygon(p) for p in neighbours])
  voxel = json.loads(voxel_path.read_bytes())
  grid = voxel["grid"]
  assert voxel["cell_m"] == 4
  columns = []
  for zi, runs in enumerate(voxel["building_rows"]):
    iz = grid["min_z_idx"] + zi
    if not zmin - 4 <= iz * 4 <= zmax:
      continue
    for offset, count, low, high, kind in runs:
      for ix in range(grid["min_x_idx"] + offset, grid["min_x_idx"] + offset + count):
        square = box(ix * 4, iz * 4, (ix + 1) * 4, (iz + 1) * 4)
        if old_area.intersection(square).area > 0.001:
          assert occupied.intersection(square).area < 0.001
          columns.append([ix, iz, low, high, kind])
  assert columns
  return dict(
    schemaVersion=1,
    parentId=PARENT,
    sourceId=PARENT[-8:],
    sourceSha256=digest(EVIDENCE),
    groundY=ground,
    eaveY=eave,
    ridgeY=ridge,
    ring=ring,
    roofs=roofs,
    walls=walls,
    stones=stones,
    nativeBoxes=native,
    nativeRoofs=native_roofs,
    nativeWalls=native_walls,
    cellM=4,
    previousPrisms=previous,
    neighbours=neighbours,
    columns=columns,
    bounds=list(old_area.bounds),
    inputs=[
      dict(path=str(p.relative_to(ROOT)), sha256=digest(p))
      for p in [prism_path, voxel_path]
    ],
    estimates="Photo-based eave2.45m, ridge3.25m, limestone walls2.30m, stone courses and open-gable divisions; original plan and ground retained. bDOM observes trees, not roof height.",
  )


if __name__ == "__main__":
  payload = build()
  OUTPUT.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      dict(
        bytes=OUTPUT.stat().st_size,
        roofs=len(payload["roofs"]),
        nativeBoxes=len(payload["nativeBoxes"]),
        columns=len(payload["columns"]),
      )
    )
  )
