"""Locate raster lawn/pavement ink falling wholly inside existing vector streets."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely
from shapely.affinity import affine_transform
from shapely.geometry import box, shape

ROOT = Path(__file__).resolve().parents[1]
MESH = ROOT / "src/app/public/mesh/regierungsviertel"
DATA = ROOT / "src/app/src/data"
GROUND = MESH / "ground-context.json"
ROADS = DATA / "restoredRoadSurfaces.ndjson.txt"
DISTRICTS = ROOT / "geo_data/regierungsviertel/house-districts-v233.geojson"
OUTPUT = DATA / "mittePavementEdgesV367.json"


def build():
  ground = json.loads(GROUND.read_bytes())
  cell, grid = ground["cell_m"], ground["grid"]
  raster = np.full((grid["rows"], grid["cols"]), -1, dtype=np.int8)
  for row_index, row in enumerate(ground["ground_rows"]):
    for start, length, material in row:
      raster[row_index, start : start + length] = material

  districts = {
    f["properties"]["nam"]: affine_transform(
      shape(f["geometry"]), [1, 0, 0, -1, -389500, 5820000]
    )
    for f in json.loads(DISTRICTS.read_bytes())["features"]
    if f["properties"]["sch"][6:8] == "01"
  }
  district = shapely.union_all(list(districts.values()))
  shapely.prepare(district)
  grass, plaza = (ground["classes"].index(kind) for kind in ("grass", "plazaBrick"))
  codes, envelopes, midpoints = [], [], []
  # Direction 0 is an edge between columns, direction 1 between rows.
  for direction, (a, b) in enumerate(
    ((raster[:, :-1], raster[:, 1:]), (raster[:-1], raster[1:]))
  ):
    indices = np.nonzero(((a == grass) & (b == plaza)) | ((a == plaza) & (b == grass)))
    for row, column in zip(*indices, strict=True):
      x = (grid["min_x_idx"] + column) * cell
      z = (grid["min_z_idx"] + row) * cell
      edge = (
        [(x, z + cell), (x + cell, z + cell)]
        if direction
        else [(x + cell, z), (x + cell, z + cell)]
      )
      line = shapely.LineString(edge)
      if not district.covers(line):
        continue
      codes.append(int(2 * (row * grid["cols"] + column) + direction))
      midpoints.append(line.centroid)
      # Require paved space on both sides AND beyond each end of the line.
      envelopes.append(line.buffer(0.35, cap_style="square"))

  tree = shapely.STRtree(envelopes)
  faces = defaultdict(list)
  with ROADS.open() as stream:
    for line in stream:
      part = json.loads(line)
      if part.get("kind") not in {"paving", "asphalt"}:
        continue
      vertices = np.frombuffer(base64.b64decode(part["xz"]), "<f4").reshape(-1, 2)
      if not len(tree.query(box(*vertices.min(axis=0), *vertices.max(axis=0)))):
        continue
      index = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
      triangles = shapely.polygons(vertices[index].astype(float))
      triangle_indices, edge_indices = tree.query(triangles, predicate="intersects")
      for triangle, edge in zip(triangle_indices, edge_indices, strict=True):
        faces[edge].append(triangles[triangle])

  covered = [
    edge
    for edge, local in faces.items()
    if shapely.union_all(local).covers(envelopes[edge])
  ]
  return {
    "sourceSha256": {
      p.name: hashlib.sha256(p.read_bytes()).hexdigest()
      for p in (GROUND, DISTRICTS, ROADS)
    },
    "sourceGuard": json.loads((DATA / "tiergartenPathsV345.json").read_bytes())[
      "sourceGuard"
    ],
    "byDistrict": {
      name: sum(area.covers(midpoints[e]) for e in covered)
      for name, area in districts.items()
    },
    "edges": sorted(codes[e] for e in covered),
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  result = build()
  content = json.dumps(result, separators=(",", ":"), ensure_ascii=False) + "\n"
  if args.check:
    if content != OUTPUT.read_text():
      raise SystemExit("Vector pavement overlap differs from retained raster edges")
  else:
    OUTPUT.write_text(content)
  print(
    f"{len(result['edges'])} raster edges inside existing streets: {result['byDistrict']}"
  )
