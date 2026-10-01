"""Source-bound northern rail mouths and Döberitzer Grünzug, step 10."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import split, unary_union

from scripts.build_drawn_water_boundary import clip_cell, encoded, polygon_parts

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "geo_data/regierungsviertel/raw/north-rail-v160/osm-map.json"
DATA = ROOT / "src/app/src/data"
ORIGIN = (-331.3, -1149.4)
OUTWARD = (-0.522, -0.853)
LENGTH = 340.0
# Mainline source ramp, plus the distinct adjacent S21 trough.
MAIN = [
  38000822,
  116540153,
  142142494,
  142142502,
  157671449,
  191589510,
  191701865,
  191702339,
  245849246,
  299339989,
  421230278,
  421230281,
  421230283,
  421230284,
  421230286,
  625014979,
  625014980,
  1035209473,
  1035209474,
  1321668873,
  1321668874,
]
S21 = [1363339848, 1363339849]


def world_points(
  element: dict[str, Any], nodes: dict[int, Any], tx: Transformer
) -> list[list[float]]:
  """Project complete OSM node chains without line simplification."""
  return [
    [round(x - 389500, 3), round(5820000 - y, 3)]
    for x, y in [
      tx.transform(nodes[i]["lon"], nodes[i]["lat"]) for i in element["nodes"]
    ]
  ]


def lines(geometry: Any) -> list[LineString]:
  """Retain every positive-length line component."""
  if isinstance(geometry, LineString):
    return [geometry] if geometry.length > 0.001 else []
  return [p for g in getattr(geometry, "geoms", []) for p in lines(g)]


def polygon_record(p: Polygon, scale: float = 1) -> dict[str, Any]:
  """Keep exact exterior and interior coordinates in the chosen unit."""

  def conv(r):
    return [[round(x * scale, 4), round(z * scale, 4)] for x, z in r.coords]

  return {
    "ring": conv(p.exterior),
    "holes": [conv(h) for h in p.interiors],
    "area_m2": p.area,
  }


def build_source(raw: dict[str, Any], rails: dict[str, Any]) -> dict[str, Any]:
  """Bind the two approach systems and park details to OSM identities."""
  nodes = {p["id"]: p for p in raw["elements"] if p["type"] == "node"}
  ways = {p["id"]: p for p in raw["elements"] if p["type"] == "way"}
  tx = Transformer.from_crs(4326, 25833, always_xy=True)

  def path(i):
    return world_points(ways[i], nodes, tx)

  ox, oz = ORIGIN
  dx, dz = OUTWARD
  length = math.hypot(dx, dz)
  dx, dz = dx / length, dz / length
  nx, nz = -dz, dx
  crop = Polygon(
    [
      (ox + dx * s + nx * u, oz + dz * s + nz * u)
      for s, u in [(-0.1, -20), (-0.1, 24), (LENGTH, 24), (LENGTH, -20)]
    ]
  )
  tracks = []
  for family, ids in [("mainline", MAIN), ("s21", S21)]:
    for i in ids:
      g = LineString(path(i))
      if family == "mainline":
        g = g.intersection(crop)
      for p in lines(g):
        tracks.append(
          {"id": i, "family": family, "points": list(p.coords), "tags": ways[i]["tags"]}
        )
  main = unary_union(
    [
      LineString(t["points"]).buffer(3.25, cap_style="flat", join_style="mitre")
      for t in tracks
      if t["family"] == "mainline"
    ]
  ).intersection(crop)
  # The source west wall and the east outer track define the visible open-cut.
  # A convex envelope across the parallel rails closes only ballast gaps.
  main = main.convex_hull
  west = path(460595887)
  a, b = west[0], west[1]
  vx, vz = a[0] - b[0], a[1] - b[1]
  norm = math.hypot(vx, vz)
  start = (a[0] + vx / norm * 25, a[1] + vz / norm * 25)
  a, b = west[-2], west[-1]
  vx, vz = b[0] - a[0], b[1] - a[1]
  norm = math.hypot(vx, vz)
  end = (b[0] + vx / norm * 100, b[1] + vz / norm * 100)
  extended = [start, *west, end]
  east_side = Polygon(
    extended + [(x + nx * 100, z + nz * 100) for x, z in reversed(extended)]
  )
  main = (
    main.union(LineString(extended).buffer(4, cap_style="flat"))
    .intersection(east_side)
    .intersection(crop)
  )
  s21_west, s21_east = path(1127456787), path(1127456788)
  s21 = Polygon(s21_west + s21_east).buffer(0)

  def mouth_roof(
    center: tuple[float, float], outward: tuple[float, float], width: float
  ) -> Polygon:
    ax, az = outward
    cx, cz = center
    return Polygon(
      [
        (cx + ax * s - az * u, cz + az * s + ax * u)
        for s, u in [
          (-12, -width / 2),
          (-12, width / 2),
          # The rendered 12 m roof centred at -5.5 reaches +0.5 m.
          # Own that complete footprint: ending at zero left a triangular
          # grass island between the independently mapped rail approaches.
          (0.5, width / 2),
          (0.5, -width / 2),
        ]
      ]
    )

  main = main.union(mouth_roof(ORIGIN, (dx, dz), 25.4))
  s21 = s21.union(mouth_roof((-283.156, -1159.452), (-0.596, -0.803), 11.2))
  cuts = [main, s21]
  cut = unary_union(cuts)
  # A triangulated surface must not interpolate across a clamped-grade break.
  # Partition only the floor, leaving the exact plan/ownership ring untouched.
  floor_sections = []
  for footprint, center, outward, run in [
    (main, ORIGIN, (dx, dz), LENGTH),
    (s21, (-283.156, -1159.452), (-0.596, -0.803), 241.0),
  ]:
    ax, az = outward
    cx, cz = center
    length_squared = ax * ax + az * az
    parts = [footprint]
    for grade_break in [0.0, run]:
      px, pz = (
        cx + ax * grade_break / length_squared,
        cz + az * grade_break / length_squared,
      )
      line = LineString(
        [(px - az * 10000, pz + ax * 10000), (px + az * 10000, pz - ax * 10000)]
      )
      parts = [piece for part in parts for piece in polygon_parts(split(part, line))]
    floor_sections.append([polygon_record(p) for p in parts])
  park = Polygon(path(185633562))
  paths = []
  for i, w in ways.items():
    tags = w.get("tags", {})
    if tags.get("highway") not in {"footway", "path", "cycleway", "steps"}:
      continue
    try:
      p = path(i)
    except KeyError:
      continue
    if LineString(p).intersection(park).length <= 5:
      continue
    width = (
      float(tags["width"])
      if tags.get("width", "").replace(".", "").isdigit()
      else (4.5 if i == 1342721989 else 3.5)
    )
    paths.append(
      {
        "id": i,
        "points": p,
        "width_m": width,
        "width_status": "OSM width"
        if "width" in tags
        else "display estimate; official southern connection 4.5 m",
        "tags": tags,
      }
    )
  benches = []
  for i, n in nodes.items():
    if n.get("tags", {}).get("amenity") != "bench":
      continue
    x, y = tx.transform(n["lon"], n["lat"])
    p = [round(x - 389500, 3), round(5820000 - y, 3)]
    if park.buffer(2).contains(Point(p)):
      benches.append({"id": i, "point": p, "tags": n["tags"]})
  replacement_surfaces, replacement_tracks = {}, {}
  park_replacements = []
  surfaces = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json").read_bytes()
  )
  for r in surfaces["parks"]:
    g = Polygon(
      [(x / 10, z / 10) for x, z in r["ring"]],
      [[(x / 10, z / 10) for x, z in h] for h in r["holes"]],
    )
    if g.intersection(cut).area > 0.0001:
      park_replacements.append(
        {
          "source_ring": r["ring"],
          "polygons": [
            {**r, **polygon_record(p, 10)} for p in polygon_parts(g.difference(cut))
          ],
        }
      )
  for i, r in enumerate(rails["embankment"]):
    g = Polygon(
      [(x / 10, z / 10) for x, z in r["ring"]],
      [[(x / 10, z / 10) for x, z in h] for h in r["holes"]],
    )
    if g.intersection(cut).area > 0.0001:
      replacement_surfaces[str(i)] = [
        polygon_record(p, 10) for p in polygon_parts(g.difference(cut))
      ]
  for i, r in enumerate(rails["embankment_tracks"]):
    g = LineString([(x / 10, z / 10) for x, z in r])
    if g.intersection(cut).length > 0.0001:
      replacement_tracks[str(i)] = [
        [[x * 10, z * 10] for x, z in p.coords] for p in lines(g.difference(cut))
      ]
  return {
    "schema_version": 1,
    "source_url": "https://api.openstreetmap.org/api/0.6/map.json?bbox=13.360,52.526,13.374,52.540",
    "retrieved": "2026-10-01",
    "license": "ODbL-1.0",
    "source_sha256": hashlib.sha256(RAW.read_bytes()).hexdigest(),
    "geometry_status": "Exact OSM plan chains; missing east mainline wall follows source outer rail + 3.25 m envelope; vertical profiles, portal head, member dimensions and untagged path widths are display estimates, not an engineering survey.",
    "profile": {
      "origin": ORIGIN,
      "outward": [dx, dz],
      "length_m": LENGTH,
      "floor_y_m": -3.3,
      "mouth_roof_underside_y_m": 2.8,
      "mainline_portal_track_way_ids": [
        47385149,
        191589508,
        191591509,
        357555809,
        1387494146,
        240526032,
      ],
    },
    "cuts": [polygon_record(p) for p in cuts],
    "floor_sections": floor_sections,
    "cut": [polygon_record(p) for p in polygon_parts(cut)],
    "tracks": tracks,
    "retaining_walls": [
      {"id": i, "points": path(i)} for i in [460595887, 1127456787, 1127456788]
    ],
    "park": {"id": 185633562, **polygon_record(park)},
    "park_render_polygons": [
      polygon_record(p) for p in polygon_parts(park.difference(cut))
    ],
    "paths": paths,
    "benches": benches,
    "park_surface_replacements": park_replacements,
    "rail_surface_replacements": replacement_surfaces,
    "rail_track_replacements": replacement_tracks,
  }


def terrain_complement(
  ground: dict[str, Any], source: dict[str, Any], ground_sha: str, source_sha: str
) -> dict[str, Any]:
  """Only remove ground inside the two source-anchored open cuts."""
  footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in source["cut"]])
  cell, grid = ground["cell_m"], ground["grid"]
  cells, triangles, edges = [], [], []
  removed = preserved = 0.0
  lo_x, lo_z, hi_x, hi_z = footprint.bounds
  for row, runs in enumerate(ground["ground_rows"]):
    z = (grid["min_z_idx"] + row) * cell
    if z + cell <= lo_z or z >= hi_z:
      continue
    for start, span, kind in runs:
      if ground["classes"][kind] in {"water", "pond", "basin", "bridge"}:
        continue
      for col in range(
        max(start, math.floor(lo_x / cell) - grid["min_x_idx"]),
        min(start + span, math.ceil(hi_x / cell) - grid["min_x_idx"]),
      ):
        x = (grid["min_x_idx"] + col) * cell
        square = box(x, z, x + cell, z + cell)
        if square.intersection(footprint).area <= 0:
          continue
        tri, edge, area = clip_cell(square, footprint)
        cells.extend(
          [
            col,
            row,
            len(triangles) // 2,
            len(tri) // 2,
            len(edges) // 2,
            len(edge) // 2,
          ]
        )
        triangles.extend(tri)
        edges.extend(edge)
        removed += area
        preserved += square.area - area
  return {
    "format": "exact-drawn-water-boundary",
    "version": 1,
    "purpose": "hbf-north-open-rail-cut",
    "source_sha256": source_sha,
    "ground_sha256": ground_sha,
    "cell_m": cell,
    "grid": grid,
    "affected_cells": len(cells) // 6,
    "removed_cut_area_m2": removed,
    "preserved_land_area_m2": preserved,
    "cells_u32": encoded(cells, "<u4"),
    "triangles_f32": encoded(triangles, "<f4"),
    "edges_f32": encoded(edges, "<f4"),
  }


def main() -> None:
  """Regenerate compact runtime source and exact terrain complements."""
  raw = json.loads(RAW.read_bytes())
  rails = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/rail-lines.json").read_bytes()
  )
  source = build_source(raw, rails)
  content = (json.dumps(source, separators=(",", ":")) + "\n").encode()
  (DATA / "hbfNorthApproachSources.json").write_bytes(content)
  ground_bytes = (
    ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  ).read_bytes()
  boundary = terrain_complement(
    json.loads(ground_bytes),
    source,
    hashlib.sha256(ground_bytes).hexdigest(),
    hashlib.sha256(content).hexdigest(),
  )
  (DATA / "hbfNorthRailTerrainBoundary.json").write_text(
    json.dumps(boundary, separators=(",", ":")) + "\n"
  )
  print(
    {
      "source_bytes": len(content),
      "tracks": len(source["tracks"]),
      "paths": len(source["paths"]),
      "benches": len(source["benches"]),
      "cut_area": sum(p["area_m2"] for p in source["cuts"]),
      "terrain_cells": boundary["affected_cells"],
    }
  )


if __name__ == "__main__":
  main()
