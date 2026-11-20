"""Fit mapped pedestrian surfaces and planting to actual delivered Drawn ground.

The compact source subset retains OSM IDs, tags and metric rings; --inventory
accepts the result of extract_surveyed_paving_v368.py for a source refresh.
"""

import argparse
import base64
import collections
import gzip
import hashlib
import json
import math
import multiprocessing
from pathlib import Path

import numpy as np
import shapely
from shapely.affinity import translate
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

from scripts.build_house_curbs_v233 import ground_guard
from scripts.build_surrounding_outlines import COLORS, PackedMesh, linear_rgb_bytes
from scripts.ring_paving_scope_v368 import regions, scope, world

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app"
OUT = APP / "src/data"
PACKETS = APP / "public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "surveyed-paving-v368-source.json.gz"
ISLAND_SURVEY = GEO / "schwanenwerder-street-survey-v368.json.gz"
AUDIT = GEO / "surveyed-paving-v368-evidence.json.gz"
# The same surface has one quiet colour across adjoining OSM objects.
MATERIAL = {
  "paving_stones": (181, 180, 171),
  "sett": (157, 154, 146),
  "asphalt": (133, 136, 134),
  "concrete": (179, 181, 175),
  "fine_gravel": (187, 179, 154),
  "ground": (167, 155, 131),
  "grass": (141, 160, 122),
  "flowerbed": (122, 145, 111),
  "sand": (204, 194, 164),
  "wood": (159, 145, 122),
  "mosaic": (171, 169, 158),
}
ALIASES = {
  "paved": "paving_stones",
  "cobblestone": "sett",
  "unhewn_cobblestone": "sett",
  "cobblestone:flattened": "sett",
  "concrete:plates": "concrete",
  "concrete:lanes": "concrete",
  "gravel": "fine_gravel",
  "compacted": "fine_gravel",
  "dirt": "ground",
  "earth": "ground",
}
GROUND = [
  tuple(c)
  for c in linear_rgb_bytes(np.array([COLORS[k] for k in ("ground", "park", "path")]))
]
EMPTY = Polygon()


def read(p):
  return json.loads(
    gzip.decompress(p.read_bytes()) if p.suffix == ".gz" else p.read_bytes()
  )


def write(path, value):
  payload = json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode()
  path.write_bytes(
    gzip.compress(payload, compresslevel=9, mtime=0)
    if path.suffix == ".gz"
    else payload
  )


def as_polygons(g):
  if g.is_empty:
    return []
  if g.geom_type == "Polygon":
    return [g]
  return [p for part in getattr(g, "geoms", []) for p in as_polygons(part)]


def poly_union(items):
  if not len(items):
    return EMPTY
  shapes = np.asarray(items, dtype=object)
  invalid = ~shapely.is_valid(shapes)
  if invalid.any():
    shapes[invalid] = shapely.make_valid(shapes[invalid])
  return shapely.union_all(shapes, grid_size=0.01).buffer(0)


def choose_sources(inventory):
  bins = collections.defaultdict(list)
  special = unary_union(
    [v for k, v in regions().items() if k not in {"ring", "outer500"}]
  )
  for role, oid, tags, wkb in read(inventory):
    tile_material = tags.get("surface", "")
    if role == "green":
      tile_material = "flowerbed" if tags.get("landcover") == "flowerbed" else "grass"
    material = ALIASES.get(tile_material, tile_material)
    if material not in MATERIAL or material == "grass" and role != "green":
      continue
    if tags.get("footway") == "crossing" or tags.get("cycleway") == "crossing":
      continue
    geom = world(shapely.from_wkb(wkb))
    if geom.is_empty or not geom.intersects(scope()):
      continue
    if role == "path":
      if geom.geom_type != "LineString" or geom.is_ring or not geom.intersects(special):
        continue
      try:
        width = float(tags["width"].removesuffix(" m"))
      except (ValueError, KeyError):
        width = 3.0 if tags.get("highway") in ("cycleway", "track") else 2.0
      if not 0.6 <= width <= 12:
        continue
      geom = geom.buffer(width / 2, quad_segs=3, cap_style="flat", join_style="round")
    geom = shapely.set_precision(geom.intersection(scope()), 0.05)
    if not 5 <= geom.area <= (25000 if role == "green" else 110000):
      continue
    centre = geom.representative_point()
    key = (math.floor(centre.x / 512), math.floor(centre.y / 512), role)
    # Preserve public squares and larger mapped margins. On the two islands
    # every documented path material fits the local bank.
    island = role == "path" and any(
      geom.intersects(regions()[k]) for k in ("pfaueninsel", "schwanenwerder")
    )
    bins[key].append(
      (island, bool(tags.get("name")), geom.area, oid, material, tags, geom)
    )
  rows = []
  for key, items in sorted(bins.items()):
    for rank, (island, named, area, oid, material, tags, g) in enumerate(
      sorted(items, key=lambda r: (-r[0], -r[1], -r[2], r[3]))
    ):
      if not island and rank >= {"pave": 7, "green": 4, "path": 12}[key[2]]:
        continue
      rows.append([key[2], oid, material, tags, shapely.to_wkb(g, hex=True)])
  return rows


def array(part, key, dtype, columns):
  return np.frombuffer(base64.b64decode(part[key]), dtype).reshape(-1, columns)


def projected_faces(part, origin):
  vertices = array(part, "positions", "<u2", 3)
  indices = array(part, "indices", "<u4", 3)
  xyz = vertices[indices]
  xz = xyz[:, :, [0, 2]].astype(np.float64) * 0.01 + np.array(origin)[[0, 2]]
  return xyz, xz, indices


def floor_domains(raw, prior, obstacles):
  origin = raw["origin"]
  garden = []
  paths = []
  occupied = []
  for part in [*raw["meshes"], *prior]:
    xyz, xz, indices = projected_faces(part, origin)
    if not len(indices):
      continue
    height = xyz[:, :, 1].astype(np.int32)
    # Other horizontal details immediately above this same ground keep precedence.
    flat = height.max(axis=1) - height.min(axis=1) <= 1
    if part["kind"] != "city":
      take = flat & (height.min(axis=1) >= 1295) & (height.max(axis=1) <= 1330)
      occupied.extend(shapely.polygons(xz[take]))
      continue
    if part.get("colorType", "u8") != "u8":
      continue
    colors = array(part, "colors", "u1", 3)[indices]
    uniform = (colors == colors[:, :1, :]).all(axis=(1, 2))
    for palette, h, target in zip(
      GROUND, (1300, 1301, 1312), (garden, garden, paths), strict=True
    ):
      take = (
        flat
        & uniform
        & (height[:, 0] == h)
        & np.all(colors[:, 0, :] == palette, axis=1)
      )
      target.extend(shapely.polygons(xz[take]))
  forbidden = poly_union([*occupied, *obstacles])
  return poly_union(garden).difference(forbidden), poly_union(paths).difference(
    forbidden
  )


def trim(g):
  # Sub-centimetre fragments cannot survive packet quantisation. Keep all
  # meaningful holes and intentional diagonals, including curving island trails.
  return shapely.set_precision(g.buffer(0), 0.01)


def fingerprint(part):
  return fnv("".join(part[k] for k in ("positions", "colors", "indices")))


def fnv(text):
  h = 2166136261
  for byte in text.encode():
    h = ((h ^ byte) * 16777619) & 0xFFFFFFFF
  return h


def nav_shapes(raw, keys):
  x, _, z = raw["origin"]
  return [
    translate(Polygon(p["ring"], p["holes"]), x, z)
    for k in keys
    for p in raw["nav"].get(k, [])
  ]


def old_layers():
  masks = collections.defaultdict(list)
  for prefix in (
    "publicGreenV329Packets",
    "parkPathsV329Packets",
    "zebraCrossingsV329Packets",
    "schwanenwerderV346Packets",
    "southWestSitesV326Packets",
  ):
    for file in sorted(OUT.glob(prefix + "*.json")):
      for key, p in read(file).get("packets", {}).items():
        if key.startswith("drawn:") and p.get("append"):
          masks[key[6:]].append(p["append"])
  return masks


def encode(mesh):
  # Four local coordinate bytes and a palette/height byte per vertex;
  # independently bounded unsigned 16-bit triangle indices.
  keys = list(mesh.vertices)
  if not keys or len(keys) > 65535:
    raise ValueError("unexpected local pavement size")
  materials = list(MATERIAL.values())
  vertices = bytearray()
  for x, y, z, *c in keys:
    style = materials.index(tuple(c)) + (16 if y == 1314 else 0)
    vertices.extend(x.to_bytes(2, "little") + z.to_bytes(2, "little") + bytes([style]))
  return [
    base64.b64encode(vertices).decode(),
    base64.b64encode(np.array(mesh.indices, "<u2").tobytes()).decode(),
  ]


# Actual OSM pedestrian plazas at the Osttor and around the north and south
# approaches. Their whole surface sits on V201's triangulated terrain.
OLYMPIC_PLAZAS = {"w22374923", "w124752805", "w543846878", "w25935509", "w28670317"}


def fit_olympic_plazas(raw, candidates, rows, features, obstacles, mesh, used):
  """Barycentric height on each delivered terrain face, including curved edges."""
  origin = raw["origin"]
  forbidden = poly_union(obstacles)
  polygons, planes = [], []
  for part in raw["meshes"]:
    if part["kind"] != "city" or part.get("colorType", "u8") != "u8":
      continue
    xyz, xz, ix = projected_faces(part, origin)
    colors = array(part, "colors", "u1", 3)[ix]
    valid = np.all(colors == colors[:, :1, :], axis=(1, 2))
    valid &= np.any([np.all(colors[:, 0, :] == rgb, axis=1) for rgb in GROUND], axis=0)
    valid &= np.all(xyz[:, :, 1] > 1400, axis=1)
    world_xyz = xyz[valid].astype(float) * 0.01 + np.array(origin)
    for vertices, corner in zip(world_xyz, xz[valid], strict=True):
      delta = vertices[1:] - vertices[0]
      normal = np.cross(delta[0], delta[1])
      if (
        abs(normal[1]) < 0.002
        or max(abs(normal[0]), abs(normal[2])) > abs(normal[1]) * 0.4
      ):
        continue
      polygons.append(Polygon(corner))
      planes.append((vertices[0], -normal[0] / normal[1], -normal[2] / normal[1]))
  lookup = shapely.STRtree(polygons)
  for i in candidates:
    g = features[i].difference(forbidden)
    material = MATERIAL[rows[i][2]]
    area = 0.0
    for n in lookup.query(g, predicate="intersects"):
      intersection = polygons[n].intersection(g)
      p0, dx, dz = planes[n]
      for piece in as_polygons(intersection):
        if piece.area < 0.015:
          continue
        for triangle in shapely.get_parts(
          shapely.constrained_delaunay_triangles(piece)
        ):
          coords = list(triangle.exterior.coords)[:3]
          if shapely.is_ccw(triangle.exterior):
            coords.reverse()
          points = [
            (x, p0[1] + dx * (x - p0[0]) + dz * (z - p0[2]) + 0.035, z)
            for x, z in coords
          ]
          mesh.triangle(points, material)
        area += piece.area
    if area >= 0.03:
      used.append([int(i), round(area, 1)])


def compile_owner(c):
  (
    rows,
    features,
    lookup,
    masks,
    subway,
    subway_index,
    allotments,
    allotment_index,
    island_axes,
    olympic_structures,
  ) = SHARED_INPUTS
  key = c["id"]
  bounds = box(*c["bounds"])
  nearby = lookup.query(bounds, predicate="intersects")
  if not len(nearby) or key in {"3_-3", "4_-3", "ring182-2_9"}:
    return None
  raw = read(PACKETS / c["drawn"]["url"])
  if (
    raw["origin"][1] != -10
    or raw["nav"]["groundY"] != 3
    or raw.get("gardenTerrainV330")
  ):
    return None
  if not any(part["kind"] == "city" for part in raw["meshes"]):
    return None
  obstacles = nav_shapes(raw, ("water", "bridges", "buildings"))
  obstacles.extend(subway[i] for i in subway_index.query(bounds))
  obstacles.extend(
    allotments[i].intersection(bounds) for i in allotment_index.query(bounds)
  )
  land, path = floor_domains(raw, masks.get(key, []), obstacles)
  # V326 already has a closed, complete island path network. Tint only its
  # source triangles, including the portion of the island owned by V194.
  island = key.startswith("outer187-") and bounds.intersects(regions()["pfaueninsel"])
  island_paths = (
    island_axes.intersection(bounds).difference(poly_union(obstacles))
    if island
    else EMPTY
  )
  olympic_candidates = (
    [i for i in nearby if rows[i][1] in OLYMPIC_PLAZAS]
    if key.startswith("outer187-")
    else []
  )
  if (
    land.is_empty and path.is_empty and island_paths.is_empty and not olympic_candidates
  ):
    return None
  mesh = PackedMesh(raw["origin"][0], raw["origin"][2])
  used = []
  claimed = EMPTY
  # Authoritative areas go first, followed by line widths and then lawns.
  for i in sorted(
    nearby,
    key=lambda ix: ({"pave": 0, "path": 1, "green": 2}[rows[ix][0]], rows[ix][1]),
  ):
    role, oid, material, tags, _ = rows[i]
    candidate = features[i].intersection(bounds)
    if not claimed.is_empty:
      candidate = candidate.difference(claimed)
    if candidate.is_empty:
      continue
    if island and role == "path":
      floor = land.union(island_paths).intersection(regions()["pfaueninsel"])
    else:
      floor = land
    pieces = [(3.05, candidate.intersection(floor))]
    if role != "green":
      pieces.append((3.14, candidate.intersection(path)))
    emitted = []
    for h, g in pieces:
      g = trim(g)
      for polygon in as_polygons(g):
        if polygon.area < 0.8:
          continue
        mesh.surface(polygon, h, MATERIAL[material])
        emitted.append(polygon)
    if emitted:
      coverage = poly_union(emitted)
      claimed = claimed.union(coverage)
      used.append([int(i), round(coverage.area, 1)])
  if olympic_candidates:
    fit_olympic_plazas(
      raw,
      olympic_candidates,
      rows,
      features,
      [*obstacles, olympic_structures],
      mesh,
      used,
    )
  if not used or not mesh.indices:
    return None
  # Spatial groups fit one bank around neighboring tiles; the overview stores
  # just the finite owner-to-bank lookup and no citywide vertex geometry.
  bank = f"{math.floor(raw['origin'][0] / 2048)}_{math.floor(raw['origin'][2] / 2048)}"
  records = [
    [n, fingerprint(p)] for n, p in enumerate(raw["meshes"]) if p["kind"] == "city"
  ]
  plan = [
    raw["origin"][0],
    raw["origin"][2],
    records,
    *encode(mesh),
    ground_guard(raw["nav"]["ground"]),
    island,
  ]
  if olympic_candidates:
    plan.append(
      base64.b64encode(
        np.array([key[1] for key in mesh.vertices], "<u2").tobytes()
      ).decode()
    )
  return key, bank, used, plan


def compile_data(rows):
  features = [shapely.from_wkb(row[4]) for row in rows]
  lookup = shapely.STRtree(features)
  masks = old_layers()
  subway = [
    Polygon(r["stair"]["ring"]).buffer(0.12)
    for r in read(OUT / "ubahnAccessV326.json")["entries"]
    if r.get("stair")
  ]
  subway_index = shapely.STRtree(subway)
  allotments = [
    shape(site["geometry"]).buffer(0)
    for site in read(GEO / "allotments-v360/inventory-osm.json.gz")["sites"]
  ]
  allotment_index = shapely.STRtree(allotments)
  west = next(
    s
    for s in read(OUT / "southWestSitesV326.json")["sites"]
    if s["key"] == "pfaueninsel-paths"
  )
  island_axes = poly_union(
    shapely.polygons(np.array(west["surfaces"][0]["triangles"])[:, :, [0, 2]])
  )
  olympic = read(OUT / "olympicGroundsV201.json")["groups"]
  gateways = [
    g
    for g in read(OUT / "westLandmarksV187.json")["groups"]
    if g["name"] == "Olympic gateway pylons"
  ]
  olympic_structures = poly_union(
    [
      triangle
      for g in [*olympic, *gateways]
      for surf in g["surfaces"]
      for triangle in shapely.polygons(np.array(surf["triangles"])[:, :, [0, 2]])
    ]
  ).buffer(0.04)
  manifest = read(PACKETS / "manifest.json")
  owners = {}
  counts = collections.Counter()
  banks = collections.defaultdict(dict)
  traces = {}
  global SHARED_INPUTS
  SHARED_INPUTS = (
    rows,
    features,
    lookup,
    masks,
    subway,
    subway_index,
    allotments,
    allotment_index,
    island_axes,
    olympic_structures,
  )
  # Read the source PBF and earlier ownership only once. Each tile is independent.
  with multiprocessing.get_context("fork").Pool(4) as pool:
    results = list(pool.imap(compile_owner, manifest["chunks"], chunksize=3))
  for result in results:
    if result is None:
      continue
    key, bank, used, plan = result
    bounds = box(plan[0], plan[1], plan[0] + 512, plan[1] + 512)
    banks[bank][key] = plan
    owners[key] = bank
    traces[key] = used
    for region, g in regions().items():
      if any(features[i].intersects(g) and bounds.intersects(g) for i, _ in used):
        counts[region] += 1
  for name, values in banks.items():
    write(OUT / f"surveyedPavingV368_{name}.json", values)
  imports = [
    'import type { SurveyedPavingBank } from "./surveyedPavingV368";',
    'import owners from "./data/surveyedPavingOwnersV368.json";',
  ]
  names = []
  for n, bank in enumerate(sorted(banks)):
    imports.append(f'import bank{n} from "./data/surveyedPavingV368_{bank}.json";')
    names.append(f'  "{bank}": bank{n}')
  code = imports + [
    "",
    "const banks = {",
    ",\n".join(names),
    "} as unknown as Readonly<Record<string, SurveyedPavingBank>>;",
    "const locations: Readonly<Record<string, string>> = owners;",
    "",
    "export function synchronousSurveyedPavingV368(id: string) {",
    "  return banks[locations[id]]?.[id];",
    "}",
    "",
  ]
  (OUT.parent / "synchronousSurveyedPavingV368.ts").write_text("\n".join(code))
  write(OUT / "surveyedPavingOwnersV368.json", owners)
  write(
    OUT / "surveyedIslandOwnersV368.json",
    sorted(key for key, bank in owners.items() if banks[bank][key][6]),
  )
  write(
    OUT / "surveyedPavingPaletteV368.json",
    linear_rgb_bytes(np.array(list(MATERIAL.values()))).tolist(),
  )
  write(
    AUDIT,
    {
      "mode": "drawn",
      "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
      "islandSurveySha256": hashlib.sha256(ISLAND_SURVEY.read_bytes()).hexdigest(),
      "regions": dict(counts),
      "areasBySourceRowAndPacket": traces,
      "palette": MATERIAL,
    },
  )
  print(
    "surveyed paving",
    len(owners),
    "owners",
    len(banks),
    "banks",
    len({i for v in traces.values() for i, _ in v}),
    "features",
    dict(counts),
    flush=True,
  )


def retain_island_survey(folder):
  area = regions()["schwanenwerder"]

  def features(layer):
    for row in read(folder / (layer + ".json")):
      g = world(shapely.make_valid(shape(row["geometry"]))).intersection(area)
      if g.area > 0.02:
        yield row, g

  exclusions = (
    "cm_fahrbahn",
    "ck_parkflaeche",
    "bn_baumscheibe",
    "ch_radweg",
    "cc_treppe",
    "cf_trennstreifen",
  )
  blocked = poly_union([g for layer in exclusions for row, g in features(layer)])
  materials = {"02": "asphalt", "03": "mosaic", "04": "sett"}
  rows = []
  for layer in ("cl_gehweg", "ce_gruenflaeche"):
    for row, geom in features(layer):
      attributes = row["properties"]
      green = layer == "ce_gruenflaeche"
      material = "grass" if green else materials.get(attributes.get("material"))
      if not material:
        continue
      g = trim(geom.difference(blocked))
      if g.area < 1:
        continue
      rows.append(
        [
          "green" if green else "pave",
          row["id"],
          material,
          attributes,
          shapely.to_wkb(g, hex=True),
        ]
      )
  write(
    ISLAND_SURVEY,
    {
      "source": "Geoportal Berlin / Straßenbefahrung 2014",
      "url": "https://gdi.berlin.de/services/wfs/strassenbefahrung",
      "retrieved": "2026-11-20",
      "inputCRS": "EPSG:25833",
      "extent": [375380, 5812020, 376004, 5812798],
      "omittedLayers": list(exclusions),
      "rows": sorted(rows, key=lambda row: row[1]),
    },
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--inventory", type=Path)
  parser.add_argument(
    "--island-survey",
    type=Path,
    help="Directory with WFS feature arrays, one per declared layer",
  )
  args = parser.parse_args()
  if args.island_survey:
    retain_island_survey(args.island_survey)
  if args.inventory:
    rows = choose_sources(args.inventory)
    write(
      SOURCE,
      {
        "crs": "viewer X/Z metres from EPSG:25833",
        "snapshot": "2026-11-15T21:22:28Z",
        "downloaded": "2026-11-16",
        "pbfSha256": "aaa9292be3770db6dcf24165698c2dc821bba4b6f4911c81fe88936ec2375325",
        "url": "https://download.geofabrik.de/europe/germany/berlin.html",
        "rows": rows,
      },
    )
  else:
    rows = read(SOURCE)["rows"]
  compile_data(rows + read(ISLAND_SURVEY)["rows"])
