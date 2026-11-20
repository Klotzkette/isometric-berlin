"""Surveyed full-width plaza approaches on demonstrably level, existing core ground."""

import argparse
import base64
import gzip
import json
import math
from collections import defaultdict

import numpy as np
import pyogrio
import shapely
from build_mitte_plaza_edges_v367 import APP, CORE, GEO, GROUND, OSM
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union

from isometric_berlin.generation.build_minecraft_voxels import to_world

OUTPUT = APP / "src/data/mitteSquareStreetsV367.json"


def encoded(values, dtype):
  return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode()


def street_group(role, dm, surface, origin=None):
  vertices = []
  indices = []
  lookup = {}
  ox, oz = origin if origin is not None else (0, 0)
  for tri in shapely.constrained_delaunay_triangles(surface).geoms:
    points = list(shapely.orient_polygons(tri, exterior_cw=True).exterior.coords)[:3]
    for x, z in points:
      k = round(x * 100) - ox, round(z * 100) - oz
      if k not in lookup:
        lookup[k] = len(vertices)
        vertices.append(k)
      indices.append(lookup[k])
  assert len(vertices) < 65536
  group = {"role": role, "dm": dm}
  if origin is not None:
    assert all(-32768 <= n < 32768 for p in vertices for n in p)
    group["origin"] = origin
  group["xz"] = encoded(vertices, "<i2" if origin is not None else "<i4")
  group["index"] = encoded(indices, "<u2")
  return group, len(indices) // 3


def leopold_junction():
  # Traced from Berlin TrueDOP 2026, 700x700, ETRS89 / UTM33N
  # bbox 388675,5823025,388815,5823165. Only the street interior is used:
  # the public survey supplies the actual side curbs and median tips.
  def polygon(pixels):
    return Polygon([(-825 + u / 5, -3165 + v / 5) for u, v in pixels])

  crossing = polygon(
    [
      (142, 372),
      (248, 283),
      (269, 304),
      (294, 310),
      (357, 245),
      (397, 208),
      (496, 291),
      (429, 364),
      (420, 387),
      (426, 407),
      (464, 450),
      (397, 537),
      (373, 526),
      (348, 519),
      (287, 585),
      (215, 608),
      (181, 538),
      (160, 505),
      (196, 449),
      (200, 435),
      (163, 401),
    ]
  )
  cycle = unary_union(
    [
      polygon(p)
      for p in [
        [
          (231, 407),
          (275, 361),
          (267, 354),
          (281, 335),
          (306, 337),
          (326, 364),
          (350, 394),
          (383, 422),
          (399, 441),
          (378, 462),
          (365, 450),
          (374, 439),
          (341, 410),
          (298, 369),
          (290, 377),
          (244, 422),
        ],
        [
          (212, 418),
          (229, 403),
          (245, 417),
          (235, 428),
          (261, 455),
          (302, 498),
          (312, 502),
          (363, 449),
          (376, 460),
          (317, 525),
          (302, 535),
          (275, 516),
          (239, 473),
          (213, 449),
          (198, 446),
          (198, 433),
        ],
      ]
    ]
  )
  return crossing, cycle


def fountain_tiles(field):
  # The district documented a walkable fountain. TrueDOP shows a light
  # rectangular jointed pad within the dark market paving. The original OSM
  # outline supplies its dimensions and orientation in the same world grid.
  corners = list(field.exterior.coords)
  start = np.asarray(corners[0])
  short = np.asarray(corners[1]) - start
  long = np.asarray(corners[-2]) - start

  def point(u, v):
    return start + u * long + v * short

  seams = [LineString([point(i / 12, 0), point(i / 12, 1)]) for i in range(1, 12)]
  seams += [LineString([point(0, i / 9), point(1, i / 9)]) for i in range(1, 9)]
  outlets = unary_union(
    [
      Point(point((i + 0.5) / 6, (j + 0.5) / 4)).buffer(0.115, quad_segs=4)
      for i in range(6)
      for j in range(4)
    ]
  )
  joints = unary_union(seams).buffer(0.025).intersection(field).difference(outlets)
  return {
    "nozzle": outlets,
    "joint": joints,
    "fountainStone": field.difference(joints.union(outlets)),
  }


def build(capture=None, *, archive=None, output=None):
  output = output or OUTPUT
  archive = archive or GEO / "mitte-plaza-streets-v367.json.gz"
  survey = json.loads(gzip.decompress(archive.read_bytes()))
  g = json.loads(GROUND.read_bytes())
  h = g["ground_height"]
  sample = np.asarray(h["y_dm"]).reshape(h["rows"], h["cols"])
  grid, cell = g["grid"], g["cell_m"]
  mx, mz, stride = grid["min_x_idx"], grid["min_z_idx"], h["stride_cells"]
  classes = g["classes"]
  raw = np.full((grid["rows"], grid["cols"]), -1, dtype=np.int8)
  for row, runs in enumerate(g["ground_rows"]):
    for start, n, kind in runs:
      raw[row, start : start + n] = kind
  existing = None
  if capture:
    existing = np.full(raw.shape, np.nan, dtype=np.float32)
    for m in np.fromfile(capture, dtype="<f4").reshape(-1, 16):
      if (
        m[5] != 3
        or m[10] != cell
        or m[15] != 1
        or any(m[i] != 0 for i in [1, 2, 3, 4, 6, 7, 8, 9, 11])
      ):
        continue
      col = (m[12] - m[0] / 2) / cell - mx
      row = (m[14] - cell / 2) / cell - mz
      n = m[0] / cell
      if not all(float(v).is_integer() for v in (row, col, n)):
        continue
      existing[int(row), int(col) : int(col + n)] = m[13] + m[5] / 2
  permitted_ids = survey.get("placeIds", [])
  roads = pyogrio.read_dataframe(OSM, layer="roads")
  sites = roads[
    roads.id.astype(str).isin(permitted_ids)
    & roads.geom_type.isin(["Polygon", "MultiPolygon"])
  ]
  place_domain = unary_union(
    [
      to_world(row.geometry).buffer(survey.get("radii", {}).get(str(row.id), 32))
      for row in sites.itertuples()
    ]
  )
  windows = survey.get("siteWindows", {})
  if windows:
    place_domain = unary_union(
      [
        to_world(box(x - radius, y - radius, x + radius, y + radius))
        for x, y, radius in windows.values()
      ]
    )
  core = json.loads(CORE.read_bytes())["core"]
  domain = place_domain.intersection(Polygon(core["ring"], core["holes"]))
  originals = json.loads(
    (APP / "public/mesh/regierungsviertel/surface-polygons.json").read_bytes()
  )
  protected = []
  field = None
  leopold = None
  if not windows:
    leopold = to_world(sites[sites.id.astype(str) == "53163725"].iloc[0].geometry)
  for w in originals["water"]:
    p = Polygon(
      np.asarray(w["ring"]) / 10, [np.asarray(h) / 10 for h in w.get("holes", [])]
    )
    if (
      leopold is not None
      and w.get("name") == "Fontänenfeld"
      and leopold.buffer(1).covers(p)
    ):
      field = p
      continue
    if p.intersects(domain):
      protected.append(shapely.make_valid(p))
  if leopold is not None:
    assert field is not None
    fountain_apron = field.buffer(8).intersection(Polygon(leopold.exterior))
    crossing, bike_lane = leopold_junction()
  else:
    field = fountain_apron = crossing = Polygon()
    bike_lane = unary_union(
      [to_world(shape(p)) for p in survey.get("cyclePaint", {}).get("areas", [])]
    ).intersection(domain)
  layers = defaultdict(list)
  for f in survey["features"]:
    p = to_world(shape(f["geom"]))
    t = f["id"].split(".")[0]
    if p.area < 0.001:
      continue
    mat = str(f.get("material") or "")
    if t in [
      "bm_zugangsbauwerk",
      "cc_treppe",
      "bz_gleiskoerper_strab",
      "bv_springbrunnen_zierbrunnen",
    ]:
      protected.append(p.buffer(0.3))
      continue
    if t in ["bn_baumscheibe", "ce_gruenflaeche"] or mat == "15":
      role = "grass"
    elif mat in ["02", "11", "12"] or t == "cm_fahrbahn":
      role = "road"
    elif mat in ["13", "14"]:
      role = "gravel"
    elif mat in ["03", "04", "05"]:
      role = "setts"
    else:
      role = "paving"
    layers[role].append(p)
  # Current mapped grass patches can border the old street survey. They fill
  # the space between divided roads; street survey material takes precedence.
  leaves = pyogrio.read_dataframe(OSM, layer="parks")
  leaves = leaves[
    leaves.landuse.isin(["grass", "meadow", "flowerbed"])
    | leaves.natural.isin(["scrub", "grassland"])
  ]
  osmgreen = []
  for p in leaves.geometry:
    if p.geom_type not in ["Polygon", "MultiPolygon"]:
      continue
    p = shapely.make_valid(to_world(p))
    if p.intersects(domain):
      osmgreen.append(p.intersection(domain))
  # Keep every public stair entrance marked in the source, including point
  # openings that are absent from the older street survey.
  for key in ("ubahnEntrancesV261", "ubahnEntrancesV281"):
    data = json.loads((APP / f"src/data/{key}.json").read_bytes())
    for stair in data["stairs"]:
      a, b = np.array(stair["top"][:2]), np.array(stair["bottom"][:2])
      v = b - a
      normal = np.array([-v[1], v[0]]) * (stair["width"] / (2 * np.linalg.norm(v)))
      protected.append(Polygon([a - normal, b - normal, b + normal, a + normal]))
  access = json.loads((APP / "src/data/ubahnAccessV326.json").read_bytes())
  for entry in access["entries"]:
    if entry["stair"]:
      opening = Polygon(entry["stair"]["ring"])
      if opening.intersects(domain):
        # Leave a centimetre for the local vertex snap along the true opening.
        protected.append(opening.buffer(0.01))
  occupied = unary_union(protected)
  coverage = {}
  for role in ["grass", "setts", "gravel", "paving", "road"]:
    part = shapely.set_precision(
      unary_union(layers[role]).intersection(domain).difference(occupied), 0.01
    )
    coverage[role] = part
    occupied = unary_union([occupied, part])
  coverage["grass"] = coverage["grass"].union(
    unary_union(osmgreen).difference(occupied).intersection(domain)
  )
  occupied = unary_union([occupied, coverage["grass"]])
  # The plaza itself is an explicit current polygon, including all its holes.
  # Keep the planted islands above, and preserve mapped fountains and access.
  coverage["paving"] = coverage["paving"].union(
    unary_union([to_world(p) for p in sites.geometry])
    .intersection(domain)
    .difference(occupied)
  )
  # Use the verified fill only within each measured street interior; at the
  # heads of the medians older survey layers have gaps over bare Drawn asphalt.
  coverage["road"] = coverage["road"].union(
    crossing.difference(unary_union([occupied, *coverage.values()]))
  )
  access_mask = unary_union(protected)
  bike_lane = bike_lane.difference(access_mask)
  for key in coverage:
    coverage[key] = coverage[key].difference(bike_lane).difference(field)
  coverage["cycle"] = bike_lane
  coverage["paving"] = coverage["paving"].union(fountain_apron.difference(field))
  if not field.is_empty:
    coverage.update(fountain_tiles(field))
  total = unary_union(list(coverage.values()))
  polys = [p for p in shapely.get_parts(total) if p.area > 0]
  candidate = set()
  for p in polys:
    x0, z0, x1, z1 = p.bounds
    for z in range(math.floor(z0 / cell), math.ceil(z1 / cell)):
      for x in range(math.floor(x0 / cell), math.ceil(x1 / cell)):
        candidate.add((z - mz, x - mx))
  exclusion = set(survey.get("missingOrRegradedLand", []))
  flat = defaultdict(list)
  shapely.prepare(total)
  for row, col in sorted(candidate):
    if not (0 <= row < grid["rows"] and 0 <= col < grid["cols"]):
      continue
    cls = classes[raw[row, col]] if raw[row, col] >= 0 else ""
    x, z = (col + mx) * cell, (row + mz) * cell
    tile = box(x, z, x + cell, z + cell)
    surveyed_tile = not windows and (
      fountain_apron.intersects(tile) or bike_lane.intersects(tile)
    )
    if cls not in ["asphalt", "grass", "plazaBrick"] and not surveyed_tile:
      continue
    if not total.intersects(tile):
      continue
    # All four bilinear DGM support samples must agree over the entire cell.
    # No survey polygon creates a shelf over a slope, a surveyed bank or hill.
    ix0, iz0 = math.floor(col / stride - 0.5), math.floor(row / stride - 0.5)
    ix1, iz1 = (
      math.floor((col + 1) / stride - 0.5),
      math.floor((row + 1) / stride - 0.5),
    )
    ys = sample[max(0, iz0) : iz1 + 2, max(0, ix0) : ix1 + 2]
    if not ys.size or ys.min() != ys.max():
      continue
    dm = int(ys.flat[0])
    key = row * grid["cols"] + col
    if (
      not surveyed_tile
      and cls != "asphalt"
      and existing is not None
      and not (abs(existing[row, col] - dm / 10) < 0.0001)
    ):
      exclusion.add(key)
    if key in exclusion and not surveyed_tile:
      continue
    flat[dm].append(tile)
  if capture:
    survey["missingOrRegradedLand"] = sorted(exclusion)
    archive.write_bytes(
      gzip.compress(json.dumps(survey, separators=(",", ":")).encode(), mtime=0)
    )
  groups = []
  count = 0
  areas = {}
  panels = [
    (to_world(box(x - r, y - r, x + r, y + r)), to_world(Point(x, y)))
    for x, y, r in windows.values()
  ]
  for dm, tiles in sorted(flat.items()):
    support = shapely.coverage_union_all(tiles)
    parts = {
      role: shapely.set_precision(geometry.intersection(support), 0.01)
      for role, geometry in coverage.items()
    }
    if windows:
      # Node once after centimetre snapping. Independent snapping on an
      # oblique kerb can leave coplanar slivers between neighbouring materials.
      edges = shapely.union_all(
        [
          p.boundary
          for part in parts.values()
          for p in shapely.get_parts(part)
          if p.area
        ],
        grid_size=0.01,
      )
      faces = shapely.get_parts(shapely.polygonize(shapely.get_parts(edges)))
      samples = shapely.point_on_surface(faces)
      for role, part in parts.items():
        inside = shapely.covers(part, samples)
        # Remove strictly collinear vertices left by the 4 m terrain support.
        parts[role] = shapely.simplify(shapely.coverage_union_all(faces[inside]), 0)
        faces, samples = faces[~inside], samples[~inside]
    for role, final in parts.items():
      if final.area < 0.002:
        continue
      if panels:
        # Independent places fit losslessly in signed 16-bit local centimetres.
        # Their projected centres restore the same 32-bit world coordinates.
        chunks = []
        for panel, centre in panels:
          face = final.intersection(panel)
          if face.area >= 0.002:
            chunks.append((face, [round(centre.x * 100), round(centre.y * 100)]))
      else:
        chunks = [(final, None)]
      for face, origin in chunks:
        group, triangles = street_group(role, dm, face, origin)
        groups.append(group)
        count += triangles
      areas[role] = round(areas.get(role, 0) + final.area, 2)
  height_guard = 2166136261
  for dm in h["y_dm"]:
    height_guard = ((height_guard ^ dm) * 16777619) & 0xFFFFFFFF
  output.write_text(
    json.dumps({"groups": groups, "heightGuard": height_guard}, separators=(",", ":"))
    + "\n"
  )
  print(len(groups), count, areas, len(exclusion), output.stat().st_size)


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--capture-ground")
  build(parser.parse_args().capture_ground)
