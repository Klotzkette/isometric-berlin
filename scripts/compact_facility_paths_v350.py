"""Lossless footprint encoding for newly generated facility path sheets only."""

from __future__ import annotations

import base64
import gzip
import json
from collections import defaultdict

import numpy as np
import shapely
from shapely.geometry import Polygon, box
from shapely.ops import unary_union


def wire(value):
  return json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()


def delta_ring(coords):
  previous = (0, 0)
  out = []
  for x, z in list(coords)[:-1]:
    if abs(x - round(x)) > 1e-7 or abs(z - round(z)) > 1e-7:
      raise ValueError(
        "Fractional overlay union intersection: retain original triangles"
      )
    point = (round(x), round(z))
    out.extend((point[0] - previous[0], point[1] - previous[1]))
    previous = point
  return out


def grid_boxes(area):
  zvalues = sorted(
    {
      round(z)
      for p in shapely.get_parts(area)
      for ring in [p.exterior, *p.interiors]
      for _, z in ring.coords
    }
  )
  if not zvalues or any(z % 50 for z in zvalues):
    return None
  x0, _, x1, _ = area.bounds
  rectangles = []
  active = {}
  bands = shapely.intersection(
    area,
    shapely.box(
      np.full(len(zvalues) - 1, x0),
      zvalues[:-1],
      np.full(len(zvalues) - 1, x1),
      zvalues[1:],
    ),
  )
  for z0, z1, band in zip(zvalues[:-1], zvalues[1:], bands, strict=True):
    now = {}
    for p in shapely.get_parts(band):
      if p.area < 1e-8:
        continue
      a, b, c, d = p.bounds
      if abs(p.area - (c - a) * (d - b)) > 1e-6:
        return None
      key = (round(a), round(c))
      if key in active and active[key][3] == z0:
        value = active.pop(key)
        value[3] = z1
      else:
        value = [round(a), z0, round(c), z1]
      now[key] = value
    rectangles.extend(active.values())
    active = now
  rectangles.extend(active.values())
  if unary_union([box(*r) for r in rectangles]).symmetric_difference(area).area > 1e-6:
    raise ValueError("Native run encoding changed exact footprint")
  output = []
  previous = (0, 0)
  for x, z, right, bottom in sorted(rectangles):
    output.extend((x - previous[0], z - previous[1], right - x, bottom - z))
    previous = (x, z)
  return output


def components(faces):
  """A quantized touch/overlap must not merge unrelated source polygons."""
  parents = list(range(len(faces)))
  edges = {}

  def find(i):
    while parents[i] != i:
      parents[i] = parents[parents[i]]
      i = parents[i]
    return i

  for i, face in enumerate(faces):
    for a, b in ((face[0], face[1]), (face[1], face[2]), (face[2], face[0])):
      edge = tuple(sorted((int(a), int(b))))
      if edge in edges:
        parents[find(i)] = find(edges[edge])
      else:
        edges[edge] = i
  output = defaultdict(list)
  for i, face in enumerate(faces):
    output[find(i)].append(face)
  return output.values()


def compact_mesh(mesh, native=False):
  positions = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  colors = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  groups = defaultdict(list)
  for tri in indices:
    p, c = positions[tri], colors[tri]
    if not np.all(p[:, 1] == p[0, 1]) or not np.all(c == c[0]):
      raise ValueError("Only uniform horizontal new surface sheets can compact")
    groups[(int(p[0, 1]), *[int(v) for v in c[0]])].append(tri)
  rows = []
  for key, faces in sorted(groups.items()):
    polygons, exact_triangles = [], []
    for group in [faces] if native else components(faces):
      triangles = [Polygon(positions[t][:, [0, 2]]) for t in group]
      area = unary_union(triangles)
      try:
        rings = [
          [delta_ring(p.exterior.coords), *[delta_ring(h.coords) for h in p.interiors]]
          for p in shapely.get_parts(area)
          if p.area > 1e-8
        ]
      except ValueError:
        # Sub-centimetre intersections introduced by source quantization are
        # retained as their original triangles, never rounded or simplified.
        exact_triangles.extend(
          [int(v) for t in group for v in positions[t][:, [0, 2]].flatten()]
        )
        continue
      if native:
        choice = ["r", *key, rings]
        boxes = grid_boxes(area)
        if boxes is not None:
          candidate = ["b", *key, boxes]
          if len(gzip.compress(wire(candidate), mtime=0)) < len(
            gzip.compress(wire(choice), mtime=0)
          ):
            choice = candidate
        rows.append(choice)
      else:
        polygons.extend(rings)
    if polygons:
      rows.append(["r", *key, polygons])
    if exact_triangles:
      rows.append(["t", *key, exact_triangles])
  return {"sheets": rows}


def compact_plan(plan, native=False):
  compact = {k: v for k, v in plan.items() if k not in {"append", "appendFingerprint"}}
  compact.update(compact_mesh(plan["append"], native))
  return compact


def main():
  import argparse
  from pathlib import Path

  root = Path(__file__).resolve().parents[1]
  data = root / "src/app/src/data"
  raw = root / "geo_data/regierungsviertel/raw/facility-paths-v350"
  index = json.loads((data / "facilityPathsV350Index.json").read_text())
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--write", action="store_true")
  args = parser.parse_args()
  original = {}
  if any(source["file"].endswith(".gz") for source in index["sources"]):
    original = json.loads(gzip.decompress((raw / "full-plans.json.gz").read_bytes()))
  pending, next_index = [], {"sources": []}
  stats = {
    "modules": len(index["sources"]),
    "plans": 0,
    "rawBytes": 0,
    "wireBytes": 0,
    "decodedCompactBytes": 0,
    "kinds": defaultdict(int),
  }
  for source in index["sources"]:
    if source["file"].endswith(".gz"):
      old = {
        "schemaVersion": 1,
        "keys": source["keys"],
        "packets": {key: original[key] for key in source["keys"]},
      }
    else:
      old = json.loads((data / source["file"]).read_text())
      original.update(old["packets"])
    compact = {
      k: compact_plan(p, k.startswith("minecraft:")) for k, p in old["packets"].items()
    }
    decoded = wire({"packets": compact})
    assert len(decoded) < 2 * 1024 * 1024
    encoded = gzip.compress(decoded, mtime=0)
    filename = (
      source["file"] if source["file"].endswith(".gz") else source["file"] + ".gz"
    )
    pending.append((filename, encoded))
    next_index["sources"].append(
      dict(file=filename, keys=old["keys"], decodedBytes=len(decoded))
    )
    stats["plans"] += len(compact)
    stats["rawBytes"] += len(wire(old))
    stats["wireBytes"] += len(encoded)
    stats["decodedCompactBytes"] += len(decoded)
    for plan in compact.values():
      for row in plan["sheets"]:
        stats["kinds"][row[0]] += 1
  raw.mkdir(parents=True, exist_ok=True)
  (raw / "full-plans.json.gz").write_bytes(gzip.compress(wire(original), mtime=0))
  target = data if args.write else raw / "compact-preview"
  target.mkdir(exist_ok=True)
  for filename, value in pending:
    (target / filename).write_bytes(value)
  (target / "facilityPathsV350Index.json").write_bytes(wire(next_index))
  if args.write:
    for source in index["sources"]:
      if not source["file"].endswith(".gz"):
        (data / source["file"]).unlink()
  stats["kinds"] = dict(stats["kinds"])
  (raw / "compact-stats.json").write_bytes(wire(stats))
  print(json.dumps(stats), flush=True)


if __name__ == "__main__":
  main()
