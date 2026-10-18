"""Bounded source-height refinement; old v183/v198 packets remain immutable."""

from __future__ import annotations

import hashlib
import json
import math
import zipfile
from pathlib import Path

import numpy as np
from build_north_parks_v198 import height
from shapely import constrained_delaunay_triangles
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
BOUNDS = [704, -6784, 928, -6560]
STEP = 8
FIELD = json.loads((DATA / "northParksV198Terrain.json").read_text())
SOURCE = json.loads((GEO / "north-parks-v198-source.json").read_text())
GROUND = {
  0x71956D,
  0x52734B,
  0x7C9965,
  0x85976B,
  0xB6B3A4,
  0xA49B80,
  0x737876,
  0x698761,
}
LIFTS = [0, 0.015, 0.035, 0.05, 0.07]


def write(p, v):
  p.write_text(json.dumps(v, ensure_ascii=False, separators=(",", ":")) + "\n")


def sha(p):
  return hashlib.sha256(p.read_bytes()).hexdigest()


def sample(p, x, z, native=False):
  if native:
    x = math.floor(x / 16) * 16 + 8
    z = math.floor(z / 16) * 16 + 8
  w, n, e, s = p["bounds"]
  if x <= w or x >= e or z <= n or z >= s:
    return 0.0
  u = (x - w) / STEP
  v = (z - n) / STEP
  i = int(u)
  j = int(v)
  a = u - i
  b = v - j
  r = p["offsets"]
  nw, ne, sw, se = r[j][i], r[j][i + 1], r[j + 1][i], r[j + 1][i + 1]
  return (
    nw * (1 - a) + ne * (a - b) + se * b
    if a >= b
    else nw * (1 - b) + sw * (b - a) + se * a
  )


def field():
  heide = shape(next(s["geometry"] for s in SOURCE["sites"] if s["key"] == "heide"))
  buildings = unary_union([shape(s["geometry"]) for s in SOURCE["buildings"]])
  # Select the retained authoritative sheet containing this bounded hill.
  archive = (
    GEO / "raw/north-parks-v198/DGM1_390_5826.zip"
    if BOUNDS[0] + 389500 >= 390000
    else GEO / "raw/north-parks-v198/DGM1_388_5826.zip"
  )
  east = int(archive.stem.split("_")[1]) * 1000
  with zipfile.ZipFile(archive) as z:
    with z.open(z.namelist()[0]) as f:
      raw = np.loadtxt(f, usecols=2, dtype=np.float32).reshape(2000, 2000)
  offsets = []
  samples = []
  domain = box(*BOUNDS)
  for z in range(BOUNDS[1], BOUNDS[3] + 1, STEP):
    row = []
    for x in range(BOUNDS[0], BOUNDS[2] + 1, STEP):
      pt = Point(x, z)
      d = (
        min(
          domain.boundary.distance(pt),
          heide.boundary.distance(pt),
          max(0, buildings.distance(pt) - 16),
        )
        if heide.covers(pt)
        else 0
      )
      t = min(1, d / 16)
      weight = t * t * (3 - 2 * t)
      measured = round(
        float(raw[int(5820000 - z - 5826000), int(x + 389500 - east)]) - 30, 2
      )
      delta = round((measured - height(FIELD, x, z)) * weight, 5)
      row.append(delta)
      if weight:
        samples.append(
          [x, z, measured, round(height(FIELD, x, z), 5), round(weight, 6)]
        )
    offsets.append(row)
  return {"bounds": BOUNDS, "step": STEP, "offsets": offsets, "nativeStep": 16}, {
    "archive": str(archive.relative_to(GEO)),
    "sha256": sha(archive),
    "samples": samples,
    "sourceSite": "relation/946980",
    "verticalDatum": "NHN minus30m",
    "policy": "8m DGM source heights; 16m smooth local boundary feather; original park outline and16m foundation exclusion preserved.",
  }


def faces(g):
  return (
    [g]
    if g.geom_type == "Polygon"
    else [p for q in getattr(g, "geoms", []) for p in faces(q)]
  )


def make_patch(cell, p, native):
  pos = cell["positions"]
  col = cell["colors"]
  idx = cell["indices"]
  oldbounds = box(*BOUNDS)
  patch = {
    "id": cell["id"],
    "native": native,
    "sourceCounts": [len(pos), len(idx), len(cell["boxes"])],
    "remove": [],
    "positions": [],
    "colors": [],
    "indices": [],
    "vertexY": [],
    "boxY": [],
  }
  lookup = {}

  def emit(triangle, color):
    for v in triangle:
      v = [round(q, 5) for q in v]
      key = tuple(v + color)
      if key not in lookup:
        lookup[key] = len(patch["positions"]) // 3
        patch["positions"].extend(v)
        patch["colors"].extend(color)
      patch["indices"].append(lookup[key])

  def rgb(i):
    return (col[i * 3] << 16) + (col[i * 3 + 1] << 8) + col[i * 3 + 2]

  trunks = [
    r for r in cell["boxes"] if abs(r[3] - 0.33) < 1e-5 and abs(r[5] - 0.33) < 1e-5
  ]
  for i, r in enumerate(cell["boxes"]):
    d = sample(p, r[0], r[2], native)
    if abs(d) > 1e-6:
      patch["boxY"].append([i, r[1], round(r[1] + d, 5)])
  # Canopies move as complete objects at their exact trunk anchor.
  tree_colors = {0x456C42, 0x527B45, 0x557D45, 0x587F45}
  if not native:
    for i in range(len(pos) // 3):
      if rgb(i) not in tree_colors:
        continue
      x, y, z = pos[i * 3 : i * 3 + 3]
      for r in trunks:
        if abs(x - r[0]) <= 3.21 and abs(z - r[2]) <= 3.21 and abs(y - r[1]) < 12:
          d = sample(p, r[0], r[2])
          if abs(d) > 1e-6:
            patch["vertexY"].append([i, y, round(y + d, 5)])
          break
  for off in range(0, len(idx), 3):
    ids = idx[off : off + 3]
    vs = [pos[i * 3 : i * 3 + 3] for i in ids]
    color = col[ids[0] * 3 : ids[0] * 3 + 3]
    if rgb(ids[0]) not in GROUND or any(rgb(i) != rgb(ids[0]) for i in ids):
      continue
    xs = [v[0] for v in vs]
    zs = [v[2] for v in vs]
    if (
      max(xs) < BOUNDS[0]
      or min(xs) > BOUNDS[2]
      or max(zs) < BOUNDS[1]
      or min(zs) > BOUNDS[3]
    ):
      continue
    area = (xs[1] - xs[0]) * (zs[2] - zs[0]) - (xs[2] - xs[0]) * (zs[1] - zs[0])
    if native:
      if abs(area) > 1e-7:
        x = sum(xs) / 3
        z = sum(zs) / 3
        lift = min(
          LIFTS, key=lambda lift: abs(vs[0][1] - height(FIELD, x, z, True) - lift)
        )
        if any(abs(v[1] - height(FIELD, x, z, True) - lift) > 0.003 for v in vs):
          continue
        d = sample(p, x, z, True)
        if abs(d) < 1e-6:
          continue
        new = [[v[0], v[1] + d, v[2]] for v in vs]
      else:
        new = []
        # Existing orthogonal terrace skirts/kerbs share the neighboring cell tops.
        # Resolve each endpoint against both actual neighboring old DGM heights.
        for x, y, z in vs:
          options = []
          for qx in [x - 0.002, x + 0.002]:
            for qz in [z - 0.002, z + 0.002]:
              for lift in [0, 0.015, 0.035, 0.05, 0.07]:
                options.append(
                  (abs(y - height(FIELD, qx, qz, True) - lift), sample(p, qx, qz, True))
                )
          err, d = min(options)
          if err > 0.004:
            new = []
            break
          new.append([x, y + d, z])
        if not new or all(abs(a[1] - b[1]) < 1e-6 for a, b in zip(vs, new)):
          continue
      patch["remove"].append(off)
      emit(new, color)
      continue
    lift = min(
      LIFTS,
      key=lambda lift: sum(abs(v[1] - height(FIELD, v[0], v[2]) - lift) for v in vs),
    )
    if any(abs(v[1] - height(FIELD, v[0], v[2]) - lift) > 0.004 for v in vs):
      continue
    if abs(area) < 1e-7:
      new = [[x, y + sample(p, x, z), z] for x, y, z in vs]
      if any(abs(a[1] - b[1]) > 1e-6 for a, b in zip(vs, new)):
        patch["remove"].append(off)
        emit(new, color)
      continue
    poly = Polygon([(v[0], v[2]) for v in vs])
    if not poly.intersects(oldbounds):
      continue
    patch["remove"].append(off)
    for iz in range(math.floor(min(zs) / STEP), math.ceil(max(zs) / STEP)):
      for ix in range(math.floor(min(xs) / STEP), math.ceil(max(xs) / STEP)):
        x, z = ix * STEP, iz * STEP
        for tri in [
          Polygon([(x, z), (x + STEP, z), (x + STEP, z + STEP)]),
          Polygon([(x, z), (x + STEP, z + STEP), (x, z + STEP)]),
        ]:
          for part in faces(poly.intersection(tri)):
            if part.area < 1e-8:
              continue
            for t in constrained_delaunay_triangles(part).geoms:
              q = list(t.exterior.coords)[:3]
              if (
                (q[1][0] - q[0][0]) * (q[2][1] - q[0][1])
                - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1])
              ) * area < 0:
                q.reverse()
              emit(
                [[x, height(FIELD, x, z) + lift + sample(p, x, z), z] for x, z in q],
                color,
              )
  return patch


def main():
  p, ev = field()
  write(DATA / "parkTerrainV229Profile.json", p)
  cells = []
  receipts = []
  for native in [False, True]:
    for suffix in [0, 1]:
      path = DATA / f"northParksV198{'Native' if native else 'Drawn'}{suffix}.json"
      payload = json.loads(path.read_text())
      receipts.append({"path": path.name, "sha256": sha(path)})
      for cell in payload["cells"]:
        patch = make_patch(cell, p, native)
        if patch["remove"] or patch["vertexY"] or patch["boxY"]:
          cells.append(patch)
  write(DATA / "parkTerrainV229Changes.json", {"cells": cells})
  ev["packets"] = receipts
  ev["profileSha256"] = sha(DATA / "parkTerrainV229Profile.json")
  ev["counts"] = [
    {
      "id": c["id"],
      "native": c["native"],
      "trianglesReplaced": len(c["remove"]),
      "trianglesAdded": len(c["indices"]) // 3,
      "treeVertices": len(c["vertexY"]),
      "rigidBoxes": len(c["boxY"]),
    }
    for c in cells
  ]
  write(GEO / "park-terrain-v229-evidence.json", ev)
  print(ev["counts"])
  print(
    "runtime bytes",
    sum(
      (DATA / n).stat().st_size
      for n in ["parkTerrainV229Profile.json", "parkTerrainV229Changes.json"]
    ),
  )


if __name__ == "__main__":
  main()
