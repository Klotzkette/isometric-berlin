"""Remove only actual post-v343 slab faces proved above retained Tiergarten paths.

The capture runs the production path builders. Source courses, heights, Native
cells and navigation are unchanged; every removed run retains its full outside.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import shapely
from build_road_ground_v343 import encode, parts, visible_overlap
from shapely.geometry import Polygon, box
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src"
SOURCE = GEO / "tiergarten-paths-v345-source.json.gz"
INPUTS = [
  "src/app/public/mesh/regierungsviertel/ground-context.json",
  "src/app/public/mesh/regierungsviertel/surface-polygons.json",
  "src/app/src/data/restoredRoadSurfaces.ndjson.txt",
  "src/app/src/data/roadGroundV343.json",
]


def build(ground_capture: Path | None, path_capture: Path | None):
  inputs = {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in INPUTS}
  ground = json.loads((ROOT / INPUTS[0]).read_bytes())
  surfaces = json.loads((ROOT / INPUTS[1]).read_bytes())
  # Named retained park only. No bounding rectangle becomes new coverage.
  region = unary_union(
    [
      shapely.make_valid(
        Polygon(
          np.asarray(s["ring"]) / 10, [np.asarray(h) / 10 for h in s.get("holes", [])]
        )
      )
      for s in surfaces["parks"]
      if s.get("name") == "Großer Tiergarten"
    ]
  )
  if ground_capture and path_capture:
    captured = json.loads(ground_capture.read_bytes())
    triangles, labels = [], []
    for mesh in json.loads(path_capture.read_bytes()):
      points = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<f4").reshape(
        -1, 3
      )
      ids = (
        np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
        if mesh["indices"]
        else np.arange(len(points)).reshape(-1, 3)
      )
      xyz = points[ids]
      polys = shapely.polygons(xyz[:, :, [0, 2]])
      selected = (shapely.area(polys) > 1e-7) & shapely.intersects(polys, region)
      triangles.extend(xyz[selected].tolist())
      labels.extend([mesh["name"]] * int(selected.sum()))
    source = {
      "inputs": inputs,
      "sourceGuard": captured["sourceGuard"],
      "triangles": triangles,
      "labels": labels,
      "records": [
        r for r in captured["records"] if r[5] == 3 and region.intersects(box(*r[:4]))
      ],
      "captureSha256": [
        hashlib.sha256(p.read_bytes()).hexdigest()
        for p in (ground_capture, path_capture)
      ],
    }
  else:
    source = json.loads(gzip.decompress(SOURCE.read_bytes()))
    if source["inputs"] != inputs:
      raise ValueError(
        "Actual production sources changed; recapture before modifying ground"
      )
  xyz = np.asarray(source["triangles"], dtype=float)
  xz = xyz[:, :, [0, 2]]
  faces = shapely.polygons(xz)
  planes = np.linalg.solve(
    np.concatenate((xz, np.ones((*xz.shape[:2], 1))), axis=2), xyz[:, :, 1, None]
  )[:, :, 0]
  tree = STRtree(faces)
  cell, grid = ground["cell_m"], ground["grid"]
  records, spans, tops, triangles, edges, evidence, hosts = [], [], [], [], [], [], []
  for rect in source["records"]:
    x0, z0, x1, z1, top, depth = rect
    col, row = (
      round(x0 / cell) - grid["min_x_idx"],
      round(z0 / cell) - grid["min_z_idx"],
    )
    run = round((x1 - x0) / cell)
    if (
      depth != 3
      or abs(run * cell - (x1 - x0)) > 1e-5
      or abs((col + grid["min_x_idx"]) * cell - x0) > 1e-5
    ):
      continue
    raw = next(
      (v for start, n, v in ground["ground_rows"][row] if start <= col < start + n),
      None,
    )
    if raw is None or ground["classes"][raw] not in {"grass", "concrete", "plazaBrick"}:
      continue
    target = box(x0, z0, x1, z1).intersection(region)
    cuts, witnesses = [], []
    for i in tree.query(target):
      cut = visible_overlap(faces[i], planes[i], top, target)
      if cut.area > 1e-7:
        cuts.append(cut)
        witnesses.append(int(i))
    if not cuts:
      continue
    removed = unary_union(cuts)
    affected = [
      i
      for i in range(run)
      if removed.intersection(box(x0 + i * cell, z0, x0 + (i + 1) * cell, z1)).area
      > 1e-7
    ]
    if not affected:
      continue
    first = last = affected[0]
    ranges = []
    for i in [*affected[1:], affected[-1] + 2]:
      if i != last + 1:
        ranges.append((first, last + 1))
        first = i
      last = i
    initial = len(records)
    for start, end in ranges:
      host = box(x0 + start * cell, z0, x0 + end * cell, z1)
      complement = host.difference(removed)
      ts, es = len(triangles), len(edges)
      for p in parts(shapely.orient_polygons(complement)):
        for t in shapely.constrained_delaunay_triangles(p).geoms:
          points = np.asarray(list(t.exterior.coords)[:3], dtype="<f4").astype(float)
          ab, ac = points[1] - points[0], points[2] - points[0]
          if ab[0] * ac[1] - ab[1] * ac[0] < 0:
            points = points[[0, 2, 1]]
          triangles.extend(points.tolist())
        for ring in [p.exterior, *p.interiors]:
          for a, b in zip(list(ring.coords), list(ring.coords)[1:]):
            edges.extend((a, b))
      records.append([col + start, row, ts, len(triangles) - ts, es, len(edges) - es])
      spans.append(end - start)
      tops.append(top)
    hosts.append(rect)
    evidence.append(
      {
        "host": rect,
        "firstRecord": initial,
        "records": len(records) - initial,
        "witnesses": witnesses,
        "removedAreaM2": removed.area,
        "removed": shapely.to_geojson(removed),
      }
    )
  data = {
    "format": "exact-drawn-water-boundary",
    "version": 1,
    "cell_m": cell,
    "grid": grid,
    "source_sha256": inputs[INPUTS[1]],
    "ground_sha256": inputs[INPUTS[0]],
    "sourceGuard": source["sourceGuard"],
    "counts": {
      "runs": len(hosts),
      "spans": len(records),
      "cells": sum(spans),
      "areaM2": round(sum(e["removedAreaM2"] for e in evidence), 6),
    },
    "cells_u32": encode(records, "<u4"),
    "spans_u32": encode(spans, "<u4"),
    "tops_f32": encode(tops, "<f4"),
    "triangles_f32": encode(triangles, "<f4"),
    "edges_f32": encode(edges, "<f4"),
  }
  (APP / "data/tiergartenPathsV345.json").write_text(
    json.dumps(data, separators=(",", ":")) + "\n"
  )
  source["records"] = hosts
  if ground_capture:
    SOURCE.write_bytes(
      gzip.compress(json.dumps(source, separators=(",", ":")).encode(), mtime=0)
    )
  (GEO / "tiergarten-paths-v345-evidence.json.gz").write_bytes(
    gzip.compress(json.dumps(evidence, separators=(",", ":")).encode(), mtime=0)
  )
  print(json.dumps(data["counts"], indent=2))


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--ground", type=Path)
  parser.add_argument("--paths", type=Path)
  args = parser.parse_args()
  if bool(args.ground) != bool(args.paths):
    parser.error("--ground and --paths must be supplied together")
  build(args.ground, args.paths)
