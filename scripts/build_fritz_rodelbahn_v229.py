"""Exact retained OSM sled slope, draped on the actually delivered Fritz ground."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

from shapely import constrained_delaunay_triangles
from shapely.geometry import Point, box, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "fritz-rodelbahn-v229-source.json"


def write(p, v):
  p.write_text(json.dumps(v, ensure_ascii=False, separators=(",", ":")) + "\n")


def sha(p):
  return hashlib.sha256(p.read_bytes()).hexdigest()


def polygons(g):
  return (
    [g]
    if g.geom_type == "Polygon"
    else [p for q in getattr(g, "geoms", []) for p in polygons(q)]
  )


def sample(g, x, z, native=False):
  w, n = g["origin"]
  step = g["step"]
  r = g["heights"]
  u = (x - w) / step
  v = (z - n) / step
  if native:
    return r[math.floor(v)][math.floor(u)] / 10
  u -= 0.5
  v -= 0.5
  i = math.floor(u)
  j = math.floor(v)
  a = u - i
  b = v - j
  return (
    (r[j][i] * (1 - a) + r[j][i + 1] * a) * (1 - b)
    + (r[j + 1][i] * (1 - a) + r[j + 1][i + 1] * a) * b
  ) / 10


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--osm", type=Path)
  args = parser.parse_args()
  if args.osm:
    row = next(
      r
      for r in json.loads(args.osm.read_text())["fritz"]["multipolygons"]
      if r["tags"].get("osm_way_id") == "121068797"
    )
    write(
      SOURCE,
      {
        "id": "way/121068797",
        "tags": row["tags"],
        "geometry": row["geometry"],
        "provenance": "Retained Geofabrik Berlin PBF; EPSG25833 minus389500,5820000-northing; ODbL1.0",
      },
    )
  source = json.loads(SOURCE.read_text())
  poly = shape(source["geometry"])
  w, n, e, s = poly.bounds
  path = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  payload = json.loads(path.read_text())
  grid = payload["grid"]
  f = payload["ground_height"]
  step = payload["cell_m"] * f["stride_cells"]
  origin = [
    grid["min_x_idx"] * payload["cell_m"],
    grid["min_z_idx"] * payload["cell_m"],
  ]
  i0 = math.floor((w - origin[0]) / step) - 2
  j0 = math.floor((n - origin[1]) / step) - 2
  i1 = math.ceil((e - origin[0]) / step) + 2
  j1 = math.ceil((s - origin[1]) / step) + 2
  ground = {
    "origin": [origin[0] + i0 * step, origin[1] + j0 * step],
    "step": step,
    "heights": [
      f["y_dm"][j * f["cols"] + i0 : j * f["cols"] + i1 + 1] for j in range(j0, j1 + 1)
    ],
  }
  footprint = [
    {
      "ring": [list(q) for q in p.exterior.coords],
      "holes": [[list(q) for q in r.coords] for r in p.interiors],
    }
    for p in polygons(poly)
  ]
  drawn = {"positions": [], "indices": []}
  lookup = {}
  native = []

  def emit(t):
    q = list(t.exterior.coords)[:3]
    if (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (
      q[1][1] - q[0][1]
    ) > 0:
      q.reverse()
    for x, z in q:
      key = (round(x, 5), round(z, 5))
      if key not in lookup:
        lookup[key] = len(drawn["positions"]) // 3
        drawn["positions"] += [key[0], round(sample(ground, x, z) + 0.15, 5), key[1]]
      drawn["indices"].append(lookup[key])

  for z in range(math.floor(n / 4) * 4, math.ceil(s / 4) * 4, 4):
    for x in range(math.floor(w / 4) * 4, math.ceil(e / 4) * 4, 4):
      intersection = poly.intersection(box(x, z, x + 4, z + 4))
      for p in polygons(intersection):
        if p.area > 1e-7:
          for t in constrained_delaunay_triangles(p).geoms:
            emit(t)
      if poly.covers(Point(x + 2, z + 2)):
        native.append(
          [
            x + 2,
            round(sample(ground, x + 2, z + 2, True) + 0.045, 5),
            z + 2,
            4,
            0.09,
            4,
            0x8D9D6B,
          ]
        )
  write(DATA / "fritzRodelbahnV229.json", {"models": [drawn, {"boxes": native}]})
  write(
    DATA / "fritzRodelbahnV229Navigation.json",
    {
      "bounds": list(poly.bounds),
      "footprint": footprint,
      "ground": ground,
      "lift": 0.15,
      "nativeLift": 0.09,
    },
  )
  write(
    GEO / "fritz-rodelbahn-v229-evidence.json",
    {
      "sourceSha256": sha(SOURCE),
      "groundContextSha256": sha(path),
      "sourceAreaM2": poly.area,
      "drawnTriangles": len(drawn["indices"]) // 3,
      "nativeCells": len(native),
      "heightRange": [min(drawn["positions"][1::3]), max(drawn["positions"][1::3])],
      "policy": "Original mapped grass piste, no fabricated walls/rails. Drawn exact outline over existing16m ground interpolation. Native independent4m horizontal cells over exact retained nearest16m ground. Grass color and thin surface lift are display choices, not extra source detail.",
    },
  )
  print("drawntriangles/nativecells", len(drawn["indices"]) // 3, len(native))
  print(
    "bytes",
    sum(
      (DATA / name).stat().st_size
      for name in ["fritzRodelbahnV229.json", "fritzRodelbahnV229Navigation.json"]
    ),
  )


if __name__ == "__main__":
  main()
