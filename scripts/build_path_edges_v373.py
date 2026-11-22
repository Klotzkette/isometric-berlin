"""Reconstruct the edges of at-grade pedestrian polygons on the drawn core outside Mitte.

Use the same projected OSM records as the four-metre terrain classifier. Keep
the actual source rings. Only paint the difference from a surviving grass or
plaza cell. Do not extrapolate from road centre lines or change another owner.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from isometric_berlin.generation.build_minecraft_voxels import (
  ASPHALT_HIGHWAYS,
  aboveground,
  road_surface_bands,
  to_world,
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
GROUND = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
OSM = GEO / "osm.gpkg"
DISTRICTS = GEO / "house-districts-v233.geojson"
CORE = DATA / "surroundingCityScope.json"
ACCESS = DATA / "ubahnAccessV326.json"
SURVEY = DATA / "innerCitySquareStreetsV368.json"
EARLIER = DATA / "innerCityPlazaEdgesV368.json"
EARLIER_INK = [
  DATA / "mittePavementEdgesV367.json",
  DATA / "innerCityPavementEdgesV368.json",
]
OUTPUT = DATA / "pathEdgesV373.json"
PRISMS = GROUND.with_name("lod2-prisms.json")
SURFACES = GROUND.with_name("surface-polygons.json")
ARCHIVE = GEO / "outer-path-edges-v373-street-survey.geojson.gz"
UNITS = 1000
PAVED = {
  "sett",
  "paving_stones",
  "unhewn_cobblestone",
  "cobblestone",
  "paved",
  "asphalt",
  "concrete",
  "concrete:plates",
  "concrete:lanes",
  "sett;paving_stones",
}


def render_polygon(record):
  return shapely.make_valid(
    Polygon(
      np.asarray(record["ring"]) / 10,
      [np.asarray(h) / 10 for h in record.get("holes", [])],
    )
  )


def surveyed_margins(capture, boundary):
  if capture:
    # Store the complete original WFS features that intersect the 12m rim.
    # No clipped fragments or simplified vertices replace the source archive.
    extent = boundary.buffer(12)
    features = []
    for layer in ("ce_gruenflaeche", "cl_gehweg", "bn_baumscheibe"):
      raw = read(capture / (layer + ".json"))
      seen = set()
      for feature in raw if isinstance(raw, list) else raw["features"]:
        assert feature["id"] not in seen
        seen.add(feature["id"])
        if extent.intersects(to_world(shape(feature["geometry"]))):
          features.append(feature)
    archive = {
      "type": "FeatureCollection",
      "source": "Straßenbefahrung Berlin 2014/15",
      "service": "https://gdi.berlin.de/services/wfs/strassenbefahrung",
      "crs": {"type": "name", "properties": {"name": "EPSG:25833"}},
      "selection": "Original features touching the 12 m rim around source pedestrian polygons outside Bezirk Mitte",
      "bboxEPSG25833": [385602, 5817089, 391912, 5823618],
      "features": sorted(features, key=lambda f: f["id"]),
    }
    ARCHIVE.write_bytes(
      gzip.compress(
        json.dumps(archive, separators=(",", ":"), ensure_ascii=False).encode(), mtime=0
      )
    )
  greens, walks, protected = [], [], []
  for f in json.loads(gzip.decompress(ARCHIVE.read_bytes()))["features"]:
    g = shapely.make_valid(to_world(shape(f["geometry"])))
    layer = f["id"].split(".")[0]
    if layer == "ce_gruenflaeche":
      greens.append(g)
    elif layer == "bn_baumscheibe":
      protected.append(g)
    elif layer == "cl_gehweg":
      # '15' is lawn, '13' and '14' are loose gravel. Only these material
      # codes identify solid paving; an unnamed/unclassified surface cannot.
      material = str(f["properties"].get("material", ""))
      if material in {"01", "02", "03", "04", "05", "06", "07", "08"}:
        walks.append(g)
      elif material == "15":
        greens.append(g)
      else:
        protected.append(g)
  return unary_union(greens), unary_union(walks), protected


def read(path):
  return json.loads(path.read_bytes())


def packed(words):
  return base64.b64encode(
    gzip.compress(np.asarray(words, dtype="<u2").tobytes(), compresslevel=9, mtime=0)
  ).decode()


def survey_areas():
  """A finer surveyed plaza owns its complete triangles, independent of height."""
  for group in read(SURVEY)["groups"]:
    ox, oz = group["origin"]
    xy = np.frombuffer(base64.b64decode(group["xz"]), "<i2").reshape(-1, 2)
    coords = (xy.astype(float) + [ox, oz]) / 100
    indices = np.frombuffer(base64.b64decode(group["index"]), "<u2").reshape(-1, 3)
    yield unary_union(shapely.polygons(coords[indices]))


def earlier_cells():
  data = read(EARLIER)
  words = np.frombuffer(base64.b64decode(data["words"]), "<u2")
  result = {}
  pos = 0
  while pos < len(words):
    row, col, _, n = map(int, words[pos : pos + 4])
    stop = pos + 4 + n * 6
    origin = [
      4 * (data["grid"]["min_x_idx"] + col),
      4 * (data["grid"]["min_z_idx"] + row),
    ]
    coords = words[pos + 4 : stop].reshape(-1, 3, 2) / data["subunits"] + origin
    result[row, col] = unary_union(shapely.polygons(coords))
    pos = stop
  return result


def line_segments(geometry):
  if geometry.geom_type == "LineString":
    for start, end in zip(geometry.coords, list(geometry.coords)[1:]):
      if [round(x * UNITS) for x in start] != [round(x * UNITS) for x in end]:
        yield start, end
  elif hasattr(geometry, "geoms"):
    for part in geometry.geoms:
      yield from line_segments(part)


def build(capture=None):
  raster = read(GROUND)
  grid, cell = raster["grid"], raster["cell_m"]
  assert cell == 4
  xmin, zmin = grid["min_x_idx"], grid["min_z_idx"]
  rows, cols = grid["rows"], grid["cols"]
  material = np.full((rows, cols), -1, dtype=np.int8)
  for row, runs in enumerate(raster["ground_rows"]):
    for start, length, kind in runs:
      material[row, start : start + length] = kind
  grass, brick = [raster["classes"].index(kind) for kind in ("grass", "plazaBrick")]

  core = read(CORE)["core"]
  land = Polygon(core["ring"], core["holes"])
  districts = {
    f["properties"]["nam"]: to_world(shape(f["geometry"])).intersection(land)
    for f in read(DISTRICTS)["features"]
    if f["properties"]["sch"][6:8] != "01"
  }
  districts = {name: geom for name, geom in districts.items() if geom.area > 0}
  scope = unary_union(list(districts.values()))
  roads = aboveground(pyogrio.read_dataframe(OSM, layer="roads"))
  areas = roads[roads.geom_type.isin(["Polygon", "MultiPolygon"])]
  excluded, target, ids = [], [], []
  for _, area in areas.iterrows():
    geometry = shapely.make_valid(to_world(area.geometry))
    if not geometry.intersects(scope):
      continue
    if (
      area.highway in {"footway", "pedestrian", "path"}
      and area.surface in PAVED
      and str(area.bridge) in {"None", "nan", "no", "false", "0"}
      and str(area.layer) in {"None", "nan", "0"}
    ):
      target.append(geometry)
      ids.append(str(area.id))
    else:
      excluded.append(geometry)
  pavement = unary_union(target)
  boundary = pavement.boundary.intersection(scope)
  survey_green, survey_walk, other_surfaces = surveyed_margins(capture, boundary)
  excluded.extend(other_surfaces)
  interest = boundary.buffer(12)
  for r in read(PRISMS)["buildings"]:
    if len(r["ring"]) < 3:
      continue
    g = render_polygon(r)
    if interest.intersects(g):
      excluded.append(g.buffer(0.002))
  # Preserve all authored road materials, including sand, earth and wood.
  # The generated bulk road layer also contains paths missing from the OSM
  # centreline-width reconstruction. Retain their exact existing footprints.
  for r in read(SURFACES)["roads"]:
    g = render_polygon(r)
    if interest.intersects(g):
      excluded.append(g.intersection(interest).buffer(0.002))
  # Where another transport surface, water, planted polygon, finer survey
  # or a station opening owns the floor, it retains its existing appearance.
  excluded.extend(road_surface_bands(roads[roads.highway.isin(ASPHALT_HIGHWAYS)]))
  excluded.extend(survey_areas())
  excluded.extend(
    Polygon(r["stair"]["ring"]).buffer(0.005)
    for r in read(ACCESS)["entries"]
    if r["stair"]
  )
  water = pyogrio.read_dataframe(OSM, layer="water")
  excluded.extend(
    to_world(g) for g in water.geometry if g.geom_type in {"Polygon", "MultiPolygon"}
  )
  parks = pyogrio.read_dataframe(OSM, layer="parks")
  planted = parks[
    parks.landuse.isin(["grass", "meadow", "flowerbed"])
    | parks.natural.isin(["grassland", "scrub"])
  ]
  # A mapped planted island can agree with the background; never pave over it.
  planted = unary_union(
    [
      shapely.make_valid(to_world(g))
      for g in planted.geometry
      if g.geom_type in {"Polygon", "MultiPolygon"}
    ]
  )
  # Preserve disagreements between the dated street survey and OSM. Only
  # extend a paved cell as far as the actual at-grade OSM way. The full
  # surveyed sidewalk may continue well beyond the way we are correcting.
  vegetation = shapely.union(survey_green, planted)
  green = vegetation.difference(shapely.union(survey_walk, pavement))
  paved = pavement.difference(vegetation)
  finishes = {grass: paved, brick: green}
  contours = {grass: paved.boundary, brick: green.boundary}
  protected = STRtree(excluded)
  previous = earlier_cells()

  # Enumerate real boundary cells rather than a rectangular feature envelope
  # (a long diagonal would otherwise visit many square kilometres unnecessarily).
  candidates = set()
  for part in shapely.get_parts(boundary):
    if not hasattr(part, "coords"):
      continue
    for (x1, z1), (x2, z2) in zip(part.coords, list(part.coords)[1:]):
      steps = max(1, math.ceil(math.hypot(x2 - x1, z2 - z1) / cell))
      for t in np.linspace(0, 1, steps + 1):
        col = math.floor((x1 + t * (x2 - x1)) / cell) - xmin
        row = math.floor((z1 + t * (z2 - z1)) / cell) - zmin
        for z in range(max(0, row - 1), min(rows, row + 2)):
          for x in range(max(0, col - 1), min(cols, col + 2)):
            candidates.add((z, x))

  words, fragments, cells = [], {}, {}
  eligible, painted, seen = set(), {}, set()
  counts, measures = Counter(), Counter()
  targets = STRtree(target)
  total_vertices = total_triangles = 0
  for row, col in sorted(candidates):
    old = int(material[row, col])
    if old not in finishes:
      continue
    x, z = (xmin + col) * cell, (zmin + row) * cell
    square = box(x, z, x + cell, z + cell)
    centre = Point(x + cell / 2, z + cell / 2)
    if not scope.covers(square) or (old == brick) != pavement.contains(centre):
      continue
    eligible.add((row, col))
    if not boundary.intersects(square):
      continue
    obstacle_ids = protected.query(square, predicate="intersects")
    masks = [excluded[i] for i in obstacle_ids]
    if (row, col) in previous:
      masks.append(previous[row, col])
    obstacles = unary_union(masks)
    corrected = square.intersection(finishes[old]).difference(obstacles)
    tri_words = []
    for triangle in shapely.constrained_delaunay_triangles(corrected).geoms:
      xy = [
        (round((a - x) * UNITS), round((b - z) * UNITS))
        for a, b in list(triangle.exterior.coords)[:3]
      ]
      (ax, az), (bx, bz), (cx, cz) = xy
      area2 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax)
      if area2 == 0:
        continue
      if area2 > 0:
        xy.reverse()
      tri_words.extend(v for point in xy for v in point)
    if not tri_words:
      continue
    assert all(0 <= v <= cell * UNITS for v in tri_words)
    n = len(tri_words) // 6
    cells[row, col] = tri_words
    painted[row, col] = corrected
    # Never trace a clipped building footprint, station opening or the edge
    # of a raster cell. Draw only surviving portions of the mapped contour.
    contour = (
      contours[old]
      .intersection(square)
      .difference(obstacles)
      .difference(square.boundary)
    )
    fragments[row, col] = list(line_segments(contour))
    total_triangles += n
    total_vertices += len(set(zip(tri_words[::2], tri_words[1::2])))
    counts[next(name for name, g in districts.items() if g.covers(centre))] += 1
    seen.update(int(i) for i in targets.query(square, predicate="intersects"))
    measures["paving" if old == grass else "mappedGreen"] += corrected.area

  # A raster line disappears only along the intervals where a single
  # adjacent cell changed finish. If both cells changed, their materials
  # still differ. Retain original lines where neither changed or a higher
  # priority feature prevented the floor correction.
  edges, original_lines = {}, {}
  empty = shapely.GeometryCollection()
  retired = set().union(*(read(source)["edges"] for source in EARLIER_INK))
  for row, col in sorted(eligible):
    for direction, neighbour in enumerate(((row, col + 1), (row + 1, col))):
      if neighbour not in eligible or material[row, col] == material[neighbour]:
        continue
      key = 2 * (row * cols + col) + direction
      if key in retired:
        continue
      x, z = (xmin + col) * cell, (zmin + row) * cell
      line = shapely.LineString(
        [(x, z + cell), (x + cell, z + cell)]
        if direction
        else [(x + cell, z), (x + cell, z + cell)]
      )
      first = line.intersection(painted.get((row, col), empty))
      second = line.intersection(painted.get(neighbour, empty))
      removed = first.symmetric_difference(second)
      if removed.length < 1 / UNITS:
        continue
      edges[key] = list(line_segments(line.difference(removed)))
      original_lines[key] = line

  for (row, col), segments in sorted(fragments.items()):
    local_keys = [
      k
      for k in (
        2 * (row * cols + col),
        2 * (row * cols + col) + 1,
        2 * (row * cols + col - 1),
        2 * ((row - 1) * cols + col) + 1,
      )
      if k in edges
    ]
    if not local_keys:
      continue
    for start, end in segments:
      mid = Point((start[0] + end[0]) / 2, (start[1] + end[1]) / 2)
      key = min(local_keys, key=lambda k: (original_lines[k].distance(mid), k))
      edges[key].append((start, end))
  # Include zero-triangle records for the literal hosts on both sides of
  # each replaced line. The renderer admits a replacement only if both survive.
  for key in edges:
    row, col = divmod(key // 2, cols)
    cells.setdefault((row, col), [])
    cells.setdefault((row + (key & 1), col + (1 - (key & 1))), [])
  for (row, col), coordinates in sorted(cells.items()):
    words.extend(
      [row, col, int(material[row, col]), len(coordinates) // 6, *coordinates]
    )
  ink = []
  for key, segments in sorted(edges.items()):
    row, col = divmod(key // 2, cols)
    x, z = (xmin + col) * cell, (zmin + row) * cell
    ink.extend([row, col, key & 1, len(segments)])
    # Two adjacent cells may contribute. A one-cell bias keeps words unsigned.
    for start, end in segments:
      for a, b in (start, end):
        ink.extend([round((a - x + cell) * UNITS), round((b - z + cell) * UNITS)])
  assert not ink or min(ink) >= 0 and max(ink) <= 65535
  return {
    "sourceSha256": {
      str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in (
        GROUND,
        OSM,
        DISTRICTS,
        CORE,
        ACCESS,
        SURVEY,
        EARLIER,
        *EARLIER_INK,
        ARCHIVE,
        PRISMS,
        SURFACES,
      )
    },
    "sourceIds": sorted(ids[i] for i in seen),
    "districtCells": dict(sorted(counts.items())),
    "areaM2": {k: round(v, 3) for k, v in measures.items()},
    "cellM": cell,
    "subunits": UNITS,
    "grid": grid,
    "maxVertices": total_vertices,
    "triangles": total_triangles,
    "replacedInkEdges": len(edges),
    "words": packed(words),
    "ink": packed(ink),
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--capture", type=Path, help="Directory with original WFS GeoJSON layers"
  )
  result = build(parser.parse_args().capture)
  OUTPUT.write_text(
    json.dumps(result, separators=(",", ":"), ensure_ascii=False) + "\n"
  )
  print(
    {k: result[k] for k in ("districtCells", "areaM2", "triangles", "replacedInkEdges")}
  )
