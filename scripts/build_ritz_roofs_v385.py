"""Fit the retained hotel's two non-flat main roof parts to the delivered city datums."""

import argparse
import gzip
import json
from collections import Counter
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.geometry import Point, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "src/app/public/mesh/regierungsviertel"
OUT = ROOT / "src/app/src/data/ritzRoofsV385.json"


def build():
  evidence = json.loads(
    gzip.decompress(
      (ROOT / "geo_data/regierungsviertel/ritz-roofs-v385.json.gz").read_bytes()
    )
  )
  source = json.loads((GEO / "lod2-prisms.json").read_text())["buildings"]
  native = json.loads((GEO / "minecraft-voxels.json").read_text())
  vicinity = box(195, 910, 275, 982)
  neighbours = []
  for prism in source:
    raw = np.asarray(prism["ring"]) / 10
    if (
      raw[:, 0].max() < 195
      or raw[:, 0].min() > 275
      or raw[:, 1].max() < 910
      or raw[:, 1].min() > 982
    ):
      continue
    shape = sh.make_valid(Polygon(raw, [np.asarray(h) / 10 for h in prism["holes"]]))
    if shape.intersects(vicinity):
      neighbours.append((prism, shape))
  out = {}
  for row in evidence["parts"]:
    prism = row["source"]
    assert prism == next(p for p in source if p["id"] == prism["id"])
    y_offset = 100 * prism["y0_dm"] - row["groundNhNmm"]
    points, index, faces, sheets = [], {}, [], []
    for rings in row["roofRings"]:
      vertices = [v for ring in rings for v in ring]
      geom = Polygon([v[:2] for v in rings[0]], [[v[:2] for v in r] for r in rings[1:]])
      if geom.area < 1:
        continue
      positions = {(x, z): (x, h + y_offset, z) for x, z, h in vertices}
      xyz = np.asarray(vertices, dtype=np.float64)
      plane = np.linalg.lstsq(
        np.column_stack((xyz[:, :2], np.ones(len(xyz)))),
        xyz[:, 2] + y_offset,
        rcond=None,
      )[0]
      sheets.append((geom, plane))
      for triangle in sh.get_parts(sh.constrained_delaunay_triangles(geom)):
        corners = list(triangle.exterior.coords)[:3]
        if triangle.exterior.is_ccw:
          corners.reverse()
        for corner in corners:
          v = positions[corner]
          if v not in index:
            index[v] = len(points)
            points.append(v)
          faces.append(index[v])
    # The prism walls reach the lowest eave. Close each exposed gable edge
    # up to the recorded local roof height, including the inner courtyard.
    boundary = Counter()
    for a, b, c in zip(faces[0::3], faces[1::3], faces[2::3]):
      for edge in ((a, b), (b, c), (c, a)):
        boundary[tuple(sorted(edge))] += 1
    eave = min(v[1] for v in points)
    roof_corners = len(faces)
    for (a, b), uses in boundary.items():
      if uses != 1 or max(points[a][1], points[b][1]) <= eave + 1:
        continue
      lower = []
      for old in (a, b):
        x, _, z = points[old]
        v = (x, eave, z)
        if v not in index:
          index[v] = len(points)
          points.append(v)
        lower.append(index[v])
      if a != lower[0]:
        faces.extend((a, lower[0], b))
      if b != lower[1]:
        faces.extend((lower[0], lower[1], b))
    columns = []
    for j in range(227, 247):
      for i in range(49, 68):
        x, z = 4 * i + 2, 4 * j + 2
        owners = [s["id"] for s, geometry in neighbours if geometry.covers(Point(x, z))]
        if owners != [prism["id"]]:
          continue
        height = [
          np.dot(plane, [1000 * x, 1000 * z, 1])
          for g, plane in sheets
          if g.covers(Point(1000 * x, 1000 * z))
        ]
        xi = i - native["grid"]["min_x_idx"]
        blocks = [
          q
          for q in native["building_rows"][j - native["grid"]["min_z_idx"]]
          if q[0] <= xi < q[0] + q[1]
        ]
        if len(blocks) == 1 and height and blocks[0][4] == 3:
          _, _, lo, hi, _ = blocks[0]
          top = min(hi, round(max(height) / 100))
          if top != hi:
            columns.append([i, j, lo, hi, top])
    out[prism["id"]] = {
      "source": prism,
      "p": points,
      "i": faces,
      "n": columns,
      "eave": eave,
      "roofCorners": roof_corners,
    }
  return json.dumps(out, separators=(",", ":")) + "\n"


if __name__ == "__main__":
  args = argparse.ArgumentParser()
  args.add_argument("--check", action="store_true")
  if args.parse_args().check:
    assert OUT.read_text() == build(), "Ritz roof packet is stale"
  else:
    OUT.write_text(build())
