"""Read retained native geometry for two bounded display-only fittings."""

import hashlib
import json
from pathlib import Path

from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
NATIVE_PATH = "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
SURFACE_PATH = "src/app/public/mesh/regierungsviertel/surface-polygons.json"


def build(write=False):
  payload = json.loads((ROOT / NATIVE_PATH).read_text())
  source = json.loads((DATA / "unityVisitorV256.json").read_text())
  footprint = Polygon(source["ring"])
  cell = payload["cell_m"]
  grid = payload["grid"]
  columns = []
  for row, runs in enumerate(payload["building_rows"]):
    z = row + grid["min_z_idx"]
    if not footprint.bounds[1] < (z + 0.5) * cell < footprint.bounds[3]:
      continue
    for start, count, y0, y1, class_id in runs:
      for x in range(start + grid["min_x_idx"], start + grid["min_x_idx"] + count):
        if not footprint.bounds[0] < (x + 0.5) * cell < footprint.bounds[2]:
          continue
        if footprint.contains(Point((x + 0.5) * cell, (z + 0.5) * cell)):
          assert class_id == payload["classes"].index("concrete")
          assert y1 - y0 == 40
          columns.append([x, z, y0, y1, class_id])
  occupied = {(x, z) for x, z, *_ in columns}
  edges = []
  for x, z, y0, y1, _ in columns:
    for dx, dz in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
      if (x + dx, z + dz) not in occupied:
        edges.append(
          [
            (x + 0.5 + dx / 2) * cell,
            (z + 0.5 + dz / 2) * cell,
            y0 / 10,
            y1 / 10,
            0 if dx else 1,
          ]
        )
  sha = hashlib.sha256((ROOT / NATIVE_PATH).read_bytes()).hexdigest()
  native = {
    "owner": source["owner"],
    "sourceFile": NATIVE_PATH,
    "sourceSha256": sha,
    "cellM": cell,
    "columns": columns,
    "exposedEdges": edges,
    "selection": "Exact retained source-owner footprint centre test, matching building_cells; unchanged native columns and 4 m height quantisation.",
  }
  surfaces = json.loads((ROOT / SURFACE_PATH).read_text())
  pools = [
    entry
    for entry in surfaces["water"]
    if entry["kind"] == "basin"
    and 90 < entry["area_m2"] < 130
    and Polygon([(x / 10, z / 10) for x, z in entry["ring"]]).centroid.distance(
      Point(307.7, 186.23)
    )
    < 8
  ]
  assert len(pools) == 1
  pool = Polygon([(x / 10, z / 10) for x, z in pools[0]["ring"]])
  runs = []
  for row, entries in enumerate(payload["ground_rows"]):
    z = (row + grid["min_z_idx"] + 0.5) * cell
    if not pool.bounds[1] < z < pool.bounds[3]:
      continue
    for start, count, class_id in entries:
      if payload["classes"][class_id] != "basin":
        continue
      centers = [
        ((i + grid["min_x_idx"] + 0.5) * cell, z) for i in range(start, start + count)
      ]
      if any(pool.contains(Point(x, z)) for x, z in centers):
        assert all(pool.contains(Point(x, z)) for x, z in centers)
        runs.append(
          [(start + grid["min_x_idx"] + count / 2) * cell, z, count * cell, cell]
        )
  water = {
    "sourceFile": NATIVE_PATH,
    "sourceSha256": sha,
    "surfaceFile": SURFACE_PATH,
    "surfaceSha256": hashlib.sha256((ROOT / SURFACE_PATH).read_bytes()).hexdigest(),
    "sourcePool": pools[0],
    "runs": runs,
    "displayColor": 0x070D0D,
    "geometryChanged": False,
    "selection": "Only complete retained basin runs whose cell centres belong to the dedicated 113 square metre memorial pool; tint only, no matrices, source geometry or water/navigation data changed.",
  }
  if write:
    for name, payload in [
      ("unityVisitorNativeV256.json", native),
      ("sintiRomaNativeWaterV256.json", water),
    ]:
      (DATA / name).write_text(json.dumps(payload, separators=(",", ":")) + "\n")
  return native, water


if __name__ == "__main__":
  native, water = build(write=True)
  print(
    f"{len(native['columns'])} retained visitor columns, {len(native['exposedEdges'])} exposed faces; {len(water['runs'])} pool runs"
  )
