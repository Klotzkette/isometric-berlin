"""Recover surveyed sidewalk and verge boundaries on surviving four-metre terrain.

The capture accepts the complete three WFS layer responses for the core
bbox. Only full, original features near a raster paving edge are archived.
Rebuilding the viewer requires only the tracked archive and earlier sources.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.geometry import Polygon, shape

from scripts import build_exterior_street_margins_v373 as margins
from scripts import build_mitte_path_depth_v375 as depth
from scripts import build_path_edges_v373 as edges

DATA, GEO, MESH = margins.DATA, margins.GEO, margins.MESH
ARCHIVE = GEO / "sidewalk-edges-v376-survey.json.gz"
OUTPUT = DATA / "surveyedSidewalkEdgesV376.json"
LAYERS = ("cl_gehweg", "ce_gruenflaeche", "bn_baumscheibe")
PAVED = {"01", "02", "03", "04", "05", "06", "07", "08"}
UNITS = 1000


def terrain():
  ground = margins.read(MESH / "ground-context.json")
  grid = ground["grid"]
  raster = np.full((grid["rows"], grid["cols"]), -1, dtype=np.int8)
  for row, runs in enumerate(ground["ground_rows"]):
    for start, count, kind in runs:
      raster[row, start : start + count] = kind
  grass, plaza = (ground["classes"].index(name) for name in ("grass", "plazaBrick"))
  seams = []
  for direction, a, b in [
    (0, raster[:, :-1], raster[:, 1:]),
    (1, raster[:-1], raster[1:]),
  ]:
    rows, cols = np.nonzero(
      ((a == grass) & (b == plaza)) | ((a == plaza) & (b == grass))
    )
    seams.extend((int(r), int(c), direction) for r, c in zip(rows, cols))
  assert ground["cell_m"] == 4
  return grid, raster, grass, plaza, sorted(seams)


def seam_line(grid, row, col, direction):
  x, z = (col + grid["min_x_idx"]) * 4, (row + grid["min_z_idx"]) * 4
  return sh.LineString(
    [(x, z + 4), (x + 4, z + 4)] if direction else [(x + 4, z), (x + 4, z + 4)]
  )


def capture(folder):
  grid, _, _, _, seams = terrain()
  probes = [seam_line(grid, *edge) for edge in seams]
  probe_tree = sh.STRtree(probes)
  entries, geometry = [], []
  for layer in LAYERS:
    raw = json.loads((folder / (layer + ".json")).read_bytes())
    for f in raw if isinstance(raw, list) else raw["features"]:
      geom = shape(f["geometry"])
      world = sh.make_valid(margins.world(geom))
      material = str(f["properties"].get("material"))
      kind = (
        ("paving" if material in PAVED else "green" if material == "15" else "other")
        if layer == "cl_gehweg"
        else ("green" if layer == "ce_gruenflaeche" else "other")
      )
      entries.append((f["id"], material, kind, sh.to_wkb(geom, hex=True)))
      geometry.append(world)
  geometry = np.asarray(geometry)
  # A complete polygon that actually intersects an old four-metre boundary
  # can explain its floor on either side. No widening or line buffering.
  selected, _ = probe_tree.query(geometry, predicate="intersects")
  selected = sorted({int(i) for i in selected if entries[i][2] != "other"})
  owners = set(selected)
  # Include every opposing survey and every tree pit that intersects one of
  # those full polygons. Those records can veto paint even far from the seam.
  _, hits = sh.STRtree(geometry).query(geometry[selected], predicate="intersects")
  stored = sorted(set(map(int, hits)) | owners, key=lambda i: entries[i][0])
  source = {
    "source": "Geoportal Berlin, Straßenbefahrung 2014/15",
    "service": "https://gdi.berlin.de/services/wfs/strassenbefahrung",
    "bboxEPSG25833": [385602, 5817089, 391912, 5823618],
    "layers": list(LAYERS),
    "features": [[*entries[i], i in owners] for i in stored],
  }
  ARCHIVE.write_bytes(
    gzip.compress(json.dumps(source, separators=(",", ":")).encode(), mtime=0)
  )


def previous_cells():
  cells = set()
  for name in ("mittePlazaEdgesV367", "innerCityPlazaEdgesV368", "pathEdgesV373"):
    data = margins.read(DATA / (name + ".json"))
    raw = base64.b64decode(data["words"])
    w = np.frombuffer(gzip.decompress(raw) if name == "pathEdgesV373" else raw, "<u2")
    at = 0
    while at < len(w):
      row, col, _, n = map(int, w[at : at + 4])
      cells.add((row, col))
      at += 4 + 6 * n
  return cells


def pack(words):
  return margins.pack_words(words, "<u2")


def build():
  grid, raster, grass, plaza, seams = terrain()
  core = margins.read(DATA / "surroundingCityScope.json")["core"]
  scope = Polygon(core["ring"], core["holes"])
  old = previous_cells()
  # Protect all original roads, all parks, water, buildings, railway/station
  # owners, authored street and square meshes and the recent survey precincts.
  surface = margins.read(MESH / "surface-polygons.json")
  protected = list(margins.protections(surface))
  protected.extend(
    margins.dm_polygon(f) for f in surface["roads"] if len(f["ring"]) >= 3
  )
  protected.extend(depth.RESERVED)
  protected.append(sh.box(*margins.read(DATA / "invalidenGroundV371.json")["bounds"]))
  for name in ("districtStreets", "schlossEastStreets", "mitteRoadsV343"):
    doc = margins.read(DATA / (name + ".json"))
    for row in doc["surfaces"] + doc.get("supplement", {}).get("surfaces", []):
      xy = (
        np.frombuffer(base64.b64decode(row["positions_cm_b64"]), "<i4").reshape(-1, 2)
        / 100
      )
      idx = np.frombuffer(base64.b64decode(row["indices_b64"]), "<u4").reshape(-1, 3)
      protected.extend(sh.polygons(xy[idx]))
  protected = np.asarray(sh.make_valid(protected))
  protected_tree = sh.STRtree(protected)

  survey = json.loads(gzip.decompress(ARCHIVE.read_bytes()))["features"]
  source = np.asarray(
    [sh.make_valid(margins.world(sh.from_wkb(row[3]))) for row in survey]
  )
  source_tree = sh.STRtree(source)
  finishes = defaultdict(list)
  for i, (_fid, _material, kind, _wkb, eligible) in enumerate(survey):
    if not eligible:
      continue
    geom = source[i].intersection(scope)
    if geom.area <= 0:
      continue
    protect_hits = protected_tree.query(geom, predicate="intersects")
    opposing = [
      j for j in source_tree.query(geom, predicate="intersects") if survey[j][2] != kind
    ]
    # Clip the original records independently; rounding occurs only after
    # subtraction. A 2 mm guard exceeds millimetre quantisation error.
    masks = [*protected[protect_hits], *source[opposing]]
    if masks:
      x0, z0, x1, z1 = geom.bounds
      extent = sh.box(x0 - 0.01, z0 - 0.01, x1 + 0.01, z1 + 0.01)
      local = sh.intersection(masks, extent)
      geom = geom.difference(sh.union_all(local).buffer(0.002))
    finishes[kind].extend(margins.polygon_parts(geom))

  # A surveyed sidewalk may cross multiple source tiles. Work on exact cells
  # retaining their own original top and only the portion of the correct finish.
  cells, polygons = {}, {}
  area = Counter()
  counts = Counter()
  vertices = triangles = 0
  for kind, regions in sorted(finishes.items()):
    geom = sh.union_all(regions, grid_size=0.001)
    parts = np.asarray(list(margins.polygon_parts(geom)))
    tree = sh.STRtree(parts)
    old_kind = grass if kind == "paving" else plaza
    candidate_cells = set()
    for g in parts:
      x0, z0, x1, z1 = g.bounds
      c0, c1 = (
        max(0, int(np.floor(x0 / 4)) - grid["min_x_idx"]),
        min(grid["cols"], int(np.ceil(x1 / 4)) - grid["min_x_idx"]),
      )
      r0, r1 = (
        max(0, int(np.floor(z0 / 4)) - grid["min_z_idx"]),
        min(grid["rows"], int(np.ceil(z1 / 4)) - grid["min_z_idx"]),
      )
      rows, cols = np.nonzero(raster[r0:r1, c0:c1] == old_kind)
      candidate_cells.update(
        (int(row) + r0, int(col) + c0) for row, col in zip(rows, cols)
      )
    for row, col in sorted(candidate_cells - old):
      x, z = (col + grid["min_x_idx"]) * 4, (row + grid["min_z_idx"]) * 4
      square = sh.box(x, z, x + 4, z + 4)
      hits = tree.query(square, predicate="intersects")
      if not len(hits):
        continue
      g = sh.intersection(square, sh.union_all(parts[hits]), grid_size=0.001)
      if not g.area:
        continue
      coords = []
      for poly in margins.polygon_parts(g):
        for tri in sh.constrained_delaunay_triangles(poly).geoms:
          xy = [
            (round((px - x) * UNITS), round((pz - z) * UNITS))
            for px, pz in list(tri.exterior.coords)[:3]
          ]
          (a, b), (c, d), (e, f) = xy
          cross = (c - a) * (f - b) - (d - b) * (e - a)
          if not cross:
            continue
          if cross > 0:
            xy.reverse()
          coords.extend(v for point in xy for v in point)
          area[kind] += abs(cross) / (2 * UNITS**2)
      if not coords:
        continue
      cells[row, col] = coords
      polygons[row, col] = g
      counts[kind] += 1
      vertices += len(set(zip(coords[::2], coords[1::2])))
      triangles += len(coords) // 6

  retired = set().union(
    *(
      margins.read(DATA / (k + ".json"))["edges"]
      for k in ["mittePavementEdgesV367", "innerCityPavementEdgesV368"]
    )
  )
  # Each retained kerb segment stays on its source line. Only its measured
  # subinterval inside one continuous finish can disappear. Original true
  # transitions remain legible at the exact boundary of the two paints.
  ink, empty = [], sh.GeometryCollection()
  n_edges = 0
  removed_length = 0
  for row, col, direction in seams:
    other = (row + direction, col + 1 - direction)
    key = 2 * (row * grid["cols"] + col) + direction
    if key in retired or (row, col) in old or other in old:
      continue
    if (row, col) not in polygons and other not in polygons:
      continue
    line = seam_line(grid, row, col, direction)
    first = line.intersection(polygons.get((row, col), empty))
    second = line.intersection(polygons.get(other, empty))
    gone = first.symmetric_difference(second)
    if gone.length < 0.001:
      continue
    keep = list(edges.line_segments(line.difference(gone)))
    ink.extend([row, col, direction, len(keep)])
    x, z = (col + grid["min_x_idx"] - 1) * 4, (row + grid["min_z_idx"] - 1) * 4
    for a, b in keep:
      for px, pz in (a, b):
        ink.extend([round((px - x) * UNITS), round((pz - z) * UNITS)])
    n_edges += 1
    removed_length += gone.length
    cells.setdefault((row, col), [])
    cells.setdefault(other, [])
  words = []
  for (row, col), coords in sorted(cells.items()):
    words.extend([row, col, int(raster[row, col]), len(coords) // 6, *coords])
  return {
    "maxVertices": vertices,
    "triangles": triangles,
    "correctedCells": dict(counts),
    "areaM2": {k: round(v, 3) for k, v in area.items()},
    "replacedInkEdges": n_edges,
    "retiredRasterKerbM": round(removed_length, 3),
    "surveySha256": hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
    "words": pack(words),
    "ink": pack(ink),
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--capture", type=Path)
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  if args.capture:
    capture(args.capture)
  result = build()
  txt = json.dumps(result, separators=(",", ":")) + "\n"
  if args.check:
    assert OUTPUT.read_text() == txt
  else:
    OUTPUT.write_text(txt)
  print({k: v for k, v in result.items() if k not in {"words", "ink"}})
