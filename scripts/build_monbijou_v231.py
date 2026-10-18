"""Step 10: two distinct Monbijou bridges and exact existing park bench owners.

Only --extract reads retained OSM; ordinary replay uses the bounded source sheet.
Bridge plan vertices are OSM measurements. Vertical profiles, stone joints and
furniture subdivisions are explicitly display estimates, constrained by the
published structure types and dimensions. No former path/ground source is cut.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import geopandas as gpd
from shapely import affinity
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import triangulate

from scripts.build_surrounding_outlines import tags_for, world

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "monbijou-v231-source.json"
GROUND = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
HERITAGE = DATA / "mitteHeritageV166Source.json"
REFERENCES = [
  "https://www.grassl-ing.de/projekt/noerdliche_monbijoubruecke_ueber_die_spree_584.html",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030060",
  "https://www.berlin.de/sen/uvk/_assets/verkehr/infrastruktur/brueckenbau/masterplan-bruecken-berlin/mpb_anhang_1_brueckenliste_bestand.pdf",
  "https://www.berlin.de/tourismus/parks-und-gaerten/5802991-1740419-monbijoupark.html",
]


def write(path: Path, value: object) -> None:
  path.write_text(json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n")


def digest(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def extract() -> dict:
  """Retain exact original source coordinates and complete authored bench rows."""
  cache = GEO / "raw/outer-v159/candidate.gpkg"
  features = {}
  for layer in ["lines", "multipolygons"]:
    frame = gpd.read_file(cache, layer=layer, bbox=(13.392, 52.521, 13.401, 52.526))
    frame = frame.to_crs(25833)
    for _, row in frame.iterrows():
      tags = tags_for(row)
      ident = str(tags.get("osm_way_id") or tags.get("osm_id"))
      if ident not in {
        "195397553",
        "195397546",
        "23852032",
        "23852038",
        "340138573",
        "30876915",
      }:
        continue
      features[ident] = {
        "id": ident,
        "geometry": mapping(world(row.geometry)),
        "tags": {k: v for k, v in tags.items() if k != "image"},
      }
  park = shape(features["340138573"]["geometry"])
  bath = shape(features["30876915"]["geometry"])
  old = json.loads(HERITAGE.read_text())
  benches = [
    p
    for p in old["props"]
    if p["tags"].get("amenity") == "bench"
    and park.contains(Point(p["x"], p["z"]))
    and not bath.buffer(1).intersects(Point(p["x"], p["z"]))
  ]
  supports = {}
  for p in benches:
    heights = [p["y"]]
    for surface in old["groundSurfaces"]:
      for triangle in surface["triangles"]:
        if Polygon([(v[0], v[2]) for v in triangle]).covers(Point(p["x"], p["z"])):
          heights.append(max(v[1] for v in triangle))
    supports[p["id"]] = max(heights)
  ground = json.loads(GROUND.read_text())
  bc = ground["classes"].index("bridge")
  all_cells = {
    (x, z)
    for z, runs in enumerate(ground["ground_rows"])
    for start, count, c in runs
    if c == bc
    for x in range(start, start + count)
  }
  clusters = []
  while all_cells:
    start = all_cells.pop()
    found, todo = [start], [start]
    while todo:
      x, z = todo.pop()
      for dx in range(-2, 3):
        for dz in range(-2, 3):
          q = (x + dx, z + dz)
          if q in all_cells:
            all_cells.remove(q)
            todo.append(q)
            found.append(q)
    clusters.append(found)
  grid = ground["grid"]
  heights = ground["ground_height"]
  bridges = []
  for key, outline, axis in [
    ("north", "195397553", "23852032"),
    ("south", "195397546", "23852038"),
  ]:
    ring = list(shape(features[outline]["geometry"]).coords)
    poly = Polygon(ring)

    def center(c):
      return Point(
        (grid["min_x_idx"] + c[0] + 0.5) * 4, (grid["min_z_idx"] + c[1] + 0.5) * 4
      )

    match = [cs for cs in clusters if poly.contains(center(cs[0]))]
    assert len(match) == 1
    bridges.append(
      {
        "key": key,
        "outlineId": outline,
        "axisId": axis,
        "ring": ring,
        "axis": list(shape(features[axis]["geometry"]).coords),
        "oldCells": sorted(match[0]),
        "groundY": 5.2,
        "structuralType": "single-span steel box girder"
        if key == "north"
        else "single stone arch",
        "publishedSpanM": 40.5 if key == "north" else 18,
      }
    )
  sample_ids = {
    (z // heights["stride_cells"]) * heights["cols"] + x // heights["stride_cells"]
    for b in bridges
    for x, z in b["oldCells"]
  }
  return {
    "schema": 1,
    "references": REFERENCES,
    "features": features,
    "park": mapping(park),
    "protectedBath": mapping(bath),
    "benches": benches,
    "benchSupportY": supports,
    "bridges": bridges,
    "groundReceipt": {
      "grid": grid,
      "cell_m": ground["cell_m"],
      "bridgeClass": bc,
      "heightGrid": {k: heights[k] for k in ["stride_cells", "cols", "rows"]},
      "heightSamples": [[i, heights["y_dm"][i]] for i in sorted(sample_ids)],
      "sha256": digest(GROUND),
    },
    "heritageSha256": digest(HERITAGE),
    "estimates": "Vertical placement ties into retained 5.2 m ground. Camber, south arch rise, ashlar/baluster subdivisions and bench dimensions are procedural estimates, not a survey. North structural depth is constrained to the published 1.90–2.30 m. Full original bridge ground cells and park paths, trees, bath and furnishings outside the exact bench receipt remain untouched.",
  }


def parts(g: BaseGeometry) -> list[Polygon]:
  if g.is_empty:
    return []
  return (
    [g]
    if g.geom_type == "Polygon"
    else [p for x in getattr(g, "geoms", []) for p in parts(x)]
  )


def frame(bridge: dict) -> tuple:
  a, b = bridge["axis"][0], bridge["axis"][-1]
  length = math.dist(a, b)
  ux, uz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
  cx, cz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2

  def local(x, z):
    return (x - cx) * ux + (z - cz) * uz, -(x - cx) * uz + (z - cz) * ux

  def at(t, v):
    return cx + ux * t - uz * v, cz + uz * t + ux * v

  return length, local, at


def bridge_levels(bridge: dict, t: float, half: float) -> tuple[float, float]:
  s = max(0, math.cos(math.pi / 2 * min(1, abs(t) / half)))
  top = bridge["groundY"] + 0.34 * s
  if bridge["key"] == "north":
    low = top - (2.3 - 0.4 * s)
  else:
    low = 0.25 + 4.1 * math.sqrt(max(0, 1 - (t / 9) ** 2)) if abs(t) < 9 else -1.4
  return low, top


class Mesh:
  def __init__(self) -> None:
    self.vertices, self.indices, self.colors, self.lookup = [], [], [], {}

  def face(self, points: list, color: int) -> None:
    ids = []
    for p in points:
      q = tuple(round(float(v), 5) for v in p)
      k = (*q, color)
      if k not in self.lookup:
        self.lookup[k] = len(self.colors)
        self.vertices.extend(q)
        self.colors.append(color)
      ids.append(self.lookup[k])
    for i in range(1, len(ids) - 1):
      self.indices.extend([ids[0], ids[i], ids[i + 1]])


def native_boxes(rows: list[list], step: float = 0.25) -> list[list]:
  """Independent unrotated surface columns, merged only where colour agrees."""
  result = set()
  for x, y, z, w, h, d, yaw, color in rows:
    poly = affinity.rotate(box(-w / 2, -d / 2, w / 2, d / 2), -yaw, use_radians=True)
    poly = affinity.translate(poly, x, z)
    x0, z0, x1, z1 = poly.bounds
    low, high = (
      math.floor((y - h / 2) / step) * step,
      math.ceil((y + h / 2) / step) * step,
    )
    for ix in range(math.floor(x0 / step), math.ceil(x1 / step)):
      for iz in range(math.floor(z0 / step), math.ceil(z1 / step)):
        cx, cz = (ix + 0.5) * step, (iz + 0.5) * step
        # Narrow posts/rails must remain connected even below one native cell.
        if (
          poly.intersection(
            box(ix * step, iz * step, (ix + 1) * step, (iz + 1) * step)
          ).area
          < 1e-7
        ):
          continue
        result.add((cx, (low + high) / 2, cz, step, high - low, step, color))
  columns = {}
  for x, y, z, w, h, d, color in result:
    columns.setdefault((x, z, w, d, color), []).append((y - h / 2, y + h / 2))
  merged = []
  for (x, z, w, d, color), intervals in sorted(columns.items()):
    low, high = sorted(intervals)[0]
    for a, b in sorted(intervals)[1:]:
      if a <= high:
        high = max(high, b)
      else:
        merged.append([x, (low + high) / 2, z, w, high - low, d, color])
        low, high = a, b
    merged.append([x, (low + high) / 2, z, w, high - low, d, color])
  return merged


def bridge_model(bridge: dict) -> tuple[dict, dict, dict]:
  poly = Polygon(bridge["ring"])
  length, local, at = frame(bridge)
  localpoly = Polygon([local(*p) for p in bridge["ring"]])
  lo, _, hi, _ = localpoly.bounds
  half = max(abs(lo), abs(hi))
  mesh, rows, rails = Mesh(), [], []
  stone = 0xBAAE94 if bridge["key"] == "north" else 0xB7A287
  body = 0x717C80 if bridge["key"] == "north" else 0xA9957D
  n = math.ceil((hi - lo) / 0.5)
  knots = [lo + (hi - lo) * i / n for i in range(n + 1)]

  def y(t, bottom=False):
    return bridge_levels(bridge, t, half)[0 if bottom else 1]

  # Clipped strips preserve every mapped outline corner, unlike a fitted box.
  for a, b in zip(knots, knots[1:]):
    for p in parts(localpoly.intersection(box(a, -50, b, 50))):
      for tr in triangulate(p):
        if not p.covers(tr.representative_point()):
          continue
        coords = list(tr.exterior.coords)[:-1]
        for bottom in [False, True]:
          mesh.face(
            [[at(t, v)[0], y(t, bottom), at(t, v)[1]] for t, v in coords],
            body if bottom else 0xADA79B,
          )
  # Side walls, north sandstone facing, southern stone voussoir joints.
  ring = list(localpoly.exterior.coords)
  for a, b in zip(ring, ring[1:]):
    count = max(1, math.ceil(math.dist(a, b) / 0.5))
    for i in range(count):
      ta, va = [a[k] + (b[k] - a[k]) * i / count for k in (0, 1)]
      tb, vb = [a[k] + (b[k] - a[k]) * (i + 1) / count for k in (0, 1)]
      pa, pb = at(ta, va), at(tb, vb)
      mesh.face(
        [
          [*pa[:1], y(ta, True), pa[1]],
          [pb[0], y(tb, True), pb[1]],
          [pb[0], y(tb), pb[1]],
          [pa[0], y(ta), pa[1]],
        ],
        stone if abs(b[0] - a[0]) > abs(b[1] - a[1]) else body,
      )
    # Long edge rail; end openings deliberately retain open connections.
    if abs(b[0] - a[0]) < abs(b[1] - a[1]):
      continue
    pa, pb = at(*a), at(*b)
    dx, dz = pb[0] - pa[0], pb[1] - pa[1]
    yaw, distance = math.atan2(-dz, dx), math.hypot(dx, dz)
    count = math.ceil(distance / 1.0)
    for i in range(count):
      f = (i + 0.5) / count
      x, z = pa[0] + dx * f, pa[1] + dz * f
      top = y(a[0] + (b[0] - a[0]) * f)
      for dy, h, w in [(0.1, 0.2, 0.55), (1.02, 0.18, 0.64)]:
        r = [x, top + dy, z, distance / count + 0.015, h, w, yaw, stone]
        rows.append(r)
        rails.append(r)
      # A short stepped baluster profile; equal static detail on all devices.
      for dy, h, w in [
        (0.25, 0.12, 0.27),
        (0.38, 0.16, 0.15),
        (0.56, 0.22, 0.22),
        (0.77, 0.2, 0.13),
        (0.91, 0.1, 0.25),
      ]:
        r = [x, top + dy, z, w, h, w, yaw, stone]
        rows.append(r)
        rails.append(r)
      if i % 7 == 0:
        r = [x, top + 0.56, z, 0.6, 0.94, 0.6, yaw, stone]
        rows.append(r)
        rails.append(r)
    # Thin masonry bed joints, entirely on source facade; no extra bridge body.
    for i in range(1, count):
      f = i / count
      t, v = a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
      x, z = at(t, v)
      low, top = bridge_levels(bridge, t, half)
      rows.append([x, (low + top) / 2, z, 0.025, top - low, 0.026, yaw, 0x8F826F])
  # Granite sidewalk strips and sparse transverse sett joints follow the exact
  # bridge clip. These are material subdivisions, not another roadway plate.
  for t in knots[1:-1:2]:
    section = localpoly.intersection(LineString([(t, -40), (t, 40)]))
    if section.geom_type != "LineString":
      continue
    va, vb = section.coords[0][1], section.coords[-1][1]
    x, z = at(t, (va + vb) / 2)
    pa, pb = at(t, va), at(t, vb)
    yaw = math.atan2(-(pb[1] - pa[1]), pb[0] - pa[0])
    rows.append([x, y(t) + 0.012, z, abs(vb - va) - 0.7, 0.018, 0.025, yaw, 0x888779])
  # Four small historic lamp standards: exact bridge envelope, estimated
  # subdivision/position along the two outer ends, not surveyed lamp points.
  for t in [lo + 1.4, hi - 1.4]:
    section = localpoly.intersection(LineString([(t, -40), (t, 40)]))
    if section.geom_type != "LineString":
      continue
    for v in [section.coords[0][1], section.coords[-1][1]]:
      x, z = at(t, v)
      top = y(t)
      for dy, w, h, d, color in [
        (0.15, 0.65, 0.3, 0.65, stone),
        (2.1, 0.14, 4.0, 0.14, 0x444E4C),
        (3.9, 1.1, 0.09, 0.09, 0x444E4C),
      ]:
        r = [x, top + dy, z, w, h, d, 0, color]
        rows.append(r)
        rails.append(r)
      for dx, dy in [(-0.46, 4.1), (0, 4.4), (0.46, 4.1)]:
        for h, w, color in [(0.32, 0.24, 0xD3CDB2), (0.045, 0.31, 0x444E4C)]:
          r = [x + dx, top + dy + (0 if h > 0.1 else 0.19), z, w, h, w, 0, color]
          rows.append(r)
          rails.append(r)
  native = []
  # Native body occupies actual raster footprint with independent stepped levels.
  x0, z0, x1, z1 = poly.bounds
  for ix in range(math.floor(x0 / 0.5), math.ceil(x1 / 0.5)):
    for iz in range(math.floor(z0 / 0.5), math.ceil(z1 / 0.5)):
      x, z = (ix + 0.5) * 0.5, (iz + 0.5) * 0.5
      if not poly.covers(Point(x, z)):
        continue
      low, top = bridge_levels(bridge, local(x, z)[0], half)
      low, top = math.floor(low * 4) / 4, math.ceil(top * 4) / 4
      native.append([x, (low + top) / 2, z, 0.5, top - low, 0.5, body])
  return (
    {
      "key": bridge["key"],
      "vertices": mesh.vertices,
      "indices": mesh.indices,
      "colors": mesh.colors,
      "boxes": rows,
    },
    {"key": bridge["key"], "body": native, "fittings": native_boxes(rails)},
    {
      "key": bridge["key"],
      "ring": bridge["ring"],
      "axis": bridge["axis"],
      "half": half,
      "groundY": bridge["groundY"],
      "bounds": list(poly.bounds),
      "railBoxes": rails,
    },
  )


def benches_model(benches: list[dict], supports: dict) -> list[list]:
  rows = []
  for p in benches:
    x, z, y = p["x"], p["z"], supports[p["id"]]
    tags = p["tags"]
    # OSM direction is the seated viewing bearing. Local -Z faces north.
    yaw = -math.radians(float(tags.get("direction", 0)))
    width = min(2.4, max(1.65, int(tags.get("seats", 3)) * 0.48))

    def b(u, v, h, w, height, d, color):
      rows.append(
        [
          x + math.cos(yaw) * u + math.sin(yaw) * v,
          y + h,
          z - math.sin(yaw) * u + math.cos(yaw) * v,
          w,
          height,
          d,
          yaw,
          color,
        ]
      )

    for v in [-0.22, -0.11, 0, 0.11, 0.22]:
      b(0, v, 0.51, width, 0.075, 0.085, 0x947447)
    for u in [-width * 0.34, width * 0.34]:
      b(u, 0, 0.26, 0.065, 0.5, 0.42, 0x47544C)
      b(u, 0, 0.445, 0.12, 0.055, 0.57, 0x47544C)
    if tags.get("backrest") != "no":
      for u in [-width * 0.34, width * 0.34]:
        b(u, 0.28, 0.76, 0.055, 0.53, 0.06, 0x47544C)
      for h in [0.72, 0.87, 1.02]:
        b(0, 0.29, h, width, 0.1, 0.055, 0x997D51)
    if tags.get("armrest") == "yes":
      for u in [-width / 2, width / 2]:
        b(u, 0.02, 0.72, 0.07, 0.07, 0.5, 0x47544C)
  return rows


def build(source: dict) -> None:
  drawn, native, nav = [], [], []
  for bridge in source["bridges"]:
    d, n, v = bridge_model(bridge)
    drawn.append(d)
    native.append(n)
    nav.append(v)
  benches = benches_model(source["benches"], source["benchSupportY"])
  drawn.append(
    {"key": "park", "vertices": [], "indices": [], "colors": [], "boxes": benches}
  )
  native.append({"key": "park", "body": [], "fittings": native_boxes(benches, 0.125)})
  # Metric source sheets stay unrounded; compact only procedural display rows
  # (10 micrometres and sub-microradian yaw), identically for render and nav.
  for site in drawn:
    site["boxes"] = [
      [round(v, 7 if i == 6 else 5) for i, v in enumerate(row)] for row in site["boxes"]
    ]
  for b in nav:
    b["railBoxes"] = [
      [round(v, 7 if i == 6 else 5) for i, v in enumerate(row)]
      for row in b["railBoxes"]
    ]
  write(DATA / "monbijouV231.json", {"sites": drawn})
  write(DATA / "monbijouV231Native.json", {"sites": native})
  write(DATA / "monbijouV231Navigation.json", {"bridges": nav})
  write(
    DATA / "monbijouV231Receipt.json",
    {
      "ground": source["groundReceipt"],
      "clusters": [
        {"key": b["key"], "cells": b["oldCells"]} for b in source["bridges"]
      ],
      "benches": source["benches"],
      "sourceSha256": digest(SOURCE),
    },
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract:
    write(SOURCE, extract())
  build(json.loads(SOURCE.read_text()))
