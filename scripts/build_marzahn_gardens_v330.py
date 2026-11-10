"""Compile the bounded Gärten der Welt and Kienberg site into ordinary city tiles."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from functools import partial
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import LineString, Polygon, box, shape
from shapely.ops import unary_union

from isometric_berlin.generation.road_geometry import road_width_m
from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_surrounding_outlines import (
  PackedMesh,
  encode,
  line_parts,
  native_polygon,
  navigation_polygons,
  polygonal,
  polygons_from_geometry,
)
from scripts.marzahn_garden_context_geometry_v330 import (
  BRIDGES,
  bridge_fittings,
  draw_trees,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
BASELINE = GEO / "marzahn-v330-published210-manifest.json.gz"
CONTEXT = GEO / "marzahn-gardens-v330-context.json.gz"
SOURCE_CAPS = (650_000, 2_600_000)
TILE = 512
STEP = 4
GROUND = (142, 161, 112)
COLORS = {
  "wood": (111, 139, 88),
  "shrub": (124, 152, 99),
  "lawn": (150, 173, 113),
  "gravel": (182, 171, 143),
  "paving": (177, 176, 164),
  "earth": (160, 142, 113),
  "asphalt": (130, 138, 134),
  "water": (105, 153, 158),
}
PATH_MATERIALS = {
  "asphalt": "asphalt",
  "concrete": "paving",
  "paving_stones": "paving",
  "sett": "paving",
  "cobblestone": "paving",
  "pebblestone": "gravel",
  "compacted": "gravel",
  "gravel": "gravel",
  "fine_gravel": "gravel",
  "ground": "earth",
  "dirt": "earth",
  "wood": "earth",
  "sand": "gravel",
}


def read(path: Path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def encode_json(value) -> bytes:
  return (
    json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n"
  ).encode()


def write(path: Path, value):
  raw = encode_json(value)
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(
    gzip.compress(raw, compresslevel=9, mtime=0) if path.suffix == ".gz" else raw
  )
  return raw


def nav_shape(records):
  return unary_union(
    [shapely.make_valid(Polygon(p["ring"], p["holes"])) for p in records]
  )


def own_id(identity):
  return identity.replace("OSM-way-", "way/").replace("OSM-relation-", "relation/")


def surface_sources(records, scope):
  layers = {kind: [] for kind in COLORS}
  roads, trees = [], []
  for record in records:
    tags = record["tags"]
    geometry = shapely.make_valid(shape(record["geometry"]))
    layer = record["layer"]
    if layer == "points":
      if scope.covers(geometry):
        trees.append((record["id"], geometry, tags))
      continue
    if layer == "lines":
      if tags.get("highway") in (
        "footway",
        "path",
        "steps",
        "cycleway",
        "pedestrian",
        "service",
        "residential",
        "unclassified",
        "living_street",
        "track",
      ):
        width = road_width_m(tags) or 1.5
        if tags.get("bridge") not in (None, "", "no"):
          continue
        default = (
          "asphalt"
          if tags["highway"]
          in ("residential", "service", "unclassified", "living_street")
          else "gravel"
        )
        kind = PATH_MATERIALS.get(tags.get("surface"), default)
        area = geometry.buffer(width / 2, cap_style="flat", join_style="round")
        roads.append(area)
        layers[kind].append(area)
      elif tags.get("waterway") in ("river", "stream", "canal", "drain", "ditch"):
        width = 2.2 if tags["waterway"] in ("river", "canal") else 0.9
        layers["water"].append(geometry.buffer(width / 2, cap_style="flat"))
      continue
    if (
      tags.get("natural") == "water"
      or tags.get("water")
      or tags.get("landuse") == "reservoir"
    ):
      layers["water"].append(geometry)
    elif tags.get("highway") in ("footway", "pedestrian", "service", "cycleway"):
      kind = PATH_MATERIALS.get(tags.get("surface"), "paving")
      layers[kind].append(geometry)
      roads.append(geometry)
    elif tags.get("natural") == "wood" or tags.get("landuse") == "forest":
      layers["wood"].append(geometry)
    elif (
      tags.get("natural") in ("scrub", "heath") or tags.get("landuse") == "flowerbed"
    ):
      layers["shrub"].append(geometry)
    elif (
      tags.get("landuse") in ("grass", "meadow", "village_green")
      or tags.get("natural") == "grassland"
    ):
      layers["lawn"].append(geometry)
  return (
    {k: polygonal(unary_union(v).intersection(scope)) for k, v in layers.items()},
    polygonal(unary_union(roads).intersection(scope)),
    trees,
  )


def disjoint_materials(layers, scope, native):
  remaining = scope
  result = []
  for kind in (
    "water",
    "paving",
    "asphalt",
    "gravel",
    "earth",
    "shrub",
    "wood",
    "lawn",
  ):
    layer = native_polygon(layers[kind]) if native and kind != "water" else layers[kind]
    selected = polygonal(layer.intersection(remaining))
    if not selected.is_empty:
      result.append((selected, COLORS[kind]))
      remaining = polygonal(remaining.difference(selected))
  if not remaining.is_empty:
    result.append((remaining, GROUND))
  return result


def draw_surface(mesh, polygon, level, color):
  for piece in polygons_from_geometry(polygon):
    if piece.area < 0.0001:
      continue
    triangulation = shapely.constrained_delaunay_triangles(piece)
    for face in triangulation.geoms:
      points = [(x, level(x, z), z) for x, z in list(face.exterior.coords)[:3]]
      mesh.triangle(points, color)


def terrain_geometry(mesh, tile, local, scope, materials, grid, native, terrain_height):
  ox, oz = tile.bounds[:2]

  def level(row, col):
    return grid[row, col] / 100

  parts = [
    (part, color)
    for geometry, color in materials
    for part in polygons_from_geometry(geometry)
  ]
  shapes, colors = zip(*parts, strict=True)
  shapely.prepare(shapes)
  tree = shapely.STRtree(shapes)
  # The full grid is retained for walking. Only intersecting cells emit geometry.
  west, north, east, south = local.bounds
  for row in range(
    max(0, math.floor((north - oz) / STEP)), min(128, math.ceil((south - oz) / STEP))
  ):
    z = oz + row * STEP
    for col in range(
      max(0, math.floor((west - ox) / STEP)), min(128, math.ceil((east - ox) / STEP))
    ):
      x = ox + col * STEP
      cell = box(x, z, x + STEP, z + STEP)
      hits = tree.query(cell, predicate="intersects")
      if not len(hits):
        continue
      a = level(row, col)
      if native:

        def top(_x, _z):
          return a

        for i in hits:
          if shapes[i].covers(cell):
            mesh.triangle(
              [(x, a, z), (x, a, z + STEP), (x + STEP, a, z + STEP)], colors[i]
            )
            mesh.triangle(
              [(x, a, z), (x + STEP, a, z + STEP), (x + STEP, a, z)], colors[i]
            )
          else:
            draw_surface(mesh, shapes[i].intersection(cell), top, colors[i])
        # Only the higher of each pair owns the connecting face.
        for dr, dc, edge in (
          (0, -1, [(x, z), (x, z + STEP)]),
          (0, 1, [(x + STEP, z), (x + STEP, z + STEP)]),
          (-1, 0, [(x, z), (x + STEP, z)]),
          (1, 0, [(x, z + STEP), (x + STEP, z + STEP)]),
        ):
          nr, nc = row + dr, col + dc
          if 0 <= nr < 128 and 0 <= nc < 128:
            other = level(nr, nc)
          else:
            other = terrain_height(x + (dc + 0.5) * STEP, z + (dr + 0.5) * STEP)
          if other is None or other >= a:
            continue
          for line in line_parts(LineString(edge).intersection(scope)):
            (px, pz), (qx, qz) = line.coords[0], line.coords[-1]
            mesh.triangle([(px, other, pz), (qx, other, qz), (qx, a, qz)], GROUND)
            mesh.triangle([(px, other, pz), (qx, a, qz), (px, a, pz)], GROUND)
      else:
        d = level(row + 1, col + 1)
        for outline, edge in (
          ([(x, z), (x + STEP, z), (x + STEP, z + STEP)], level(row, col + 1)),
          ([(x, z), (x + STEP, z + STEP), (x, z + STEP)], level(row + 1, col)),
        ):
          half = Polygon(outline)

          def top(px, pz):
            u, v = (px - x) / STEP, (pz - z) / STEP
            return a * (1 - max(u, v)) + edge * abs(u - v) + d * min(u, v)

          for i in hits:
            if shapes[i].covers(half):
              mesh.triangle(
                [(px, top(px, pz), pz) for px, pz in reversed(outline)], colors[i]
              )
            else:
              draw_surface(mesh, shapes[i].intersection(half), top, colors[i])


def clip_triangle(points, bounds):
  polygon = points
  for axis, limit, sign in (
    (0, bounds[0], 1),
    (2, bounds[1], 1),
    (0, bounds[2], -1),
    (2, bounds[3], -1),
  ):
    if not polygon:
      return
    next_polygon = []
    for start, end in zip([polygon[-1], *polygon[:-1]], polygon, strict=True):
      ds, de = (start[axis] - limit) * sign, (end[axis] - limit) * sign
      if (ds < 0) != (de < 0):
        t = ds / (ds - de)
        next_polygon.append(
          tuple(
            limit if j == axis else start[j] + t * (end[j] - start[j]) for j in range(3)
          )
        )
      if de >= 0:
        next_polygon.append(end)
    polygon = next_polygon
  for i in range(1, len(polygon) - 1):
    yield [polygon[0], polygon[i], polygon[i + 1]]


def geometry_tiles(records):
  tiles = {}
  for points, color in records:
    low_x, high_x = min(p[0] for p in points), max(p[0] for p in points)
    low_z, high_z = min(p[2] for p in points), max(p[2] for p in points)
    for x in range(math.floor(low_x / TILE), math.floor(high_x / TILE) + 1):
      for z in range(math.floor(low_z / TILE), math.floor(high_z / TILE) + 1):
        bounds = (x * TILE, z * TILE, (x + 1) * TILE, (z + 1) * TILE)
        for clipped in clip_triangle(list(points), bounds):
          tiles.setdefault((x, z), []).append((clipped, color))
  return tiles


def metric(value):
  try:
    number = float(str(value).removesuffix(" m"))
    return number if math.isfinite(number) and number > 0 else None
  except (TypeError, ValueError):
    return None


def ordinary_buildings(context, scope, owned, prior, ground, native):
  output, triangles = [], []
  exact = [shape(g.get("geometry", g)) for g in owned.values()]
  authored = unary_union(exact)
  existing = unary_union(prior)
  accepted = []
  candidates = []
  for record in context["lod2"]["buildings"]:
    height = record["top_y_m"] - record["ground_y_m"]
    candidates.append(
      (record["id"], Polygon(record["ring"], record["holes"]), height, record)
    )
  for row in context["osm"]["records"]:
    tags = row["tags"]
    if row["layer"] != "multipolygons" or tags.get("building") in (None, "", "no"):
      continue
    height = (
      metric(tags.get("height")) or (metric(tags.get("building:levels")) or 1) * 3.2
    )
    candidates.append((own_id(row["id"]), shape(row["geometry"]), height, None))
  for identity, raw, height, record in candidates:
    footprint = polygonal(shapely.make_valid(raw).intersection(scope))
    if (
      identity in owned
      or (record and record["parentId"] in owned)
      or footprint.area < 0.5
    ):
      continue
    if (
      authored.intersection(footprint).area > footprint.area * 0.45
      or existing.intersection(footprint).area > footprint.area * 0.45
    ):
      continue
    if record is None and any(
      g.intersection(footprint).area > footprint.area * 0.5 for g in accepted
    ):
      continue
    accepted.append(footprint)
    if native:
      footprint = native_polygon(footprint).intersection(scope)
    point = footprint.representative_point()
    if point.is_empty:
      continue
    y = ground(point.x, point.y)
    if y is None:
      continue
    exact_shell = (
      not native and record is not None and raw.difference(scope).area < 0.02
    )
    if exact_shell:
      y_shift = y - record["ground_y_m"]
      for surface in record["surfaces"]:
        color = (114, 117, 108) if surface["kind"] == "RoofSurface" else (193, 180, 155)
        for triangle in triangles_for(surface["rings"]):
          triangles.append(([(x, h + y_shift, z) for x, h, z in triangle], color))
    output.append(
      (
        identity,
        footprint,
        y,
        round(height * 2) / 2 if native else height,
        not exact_shell,
      )
    )
  return output, triangles


def source_grid(terrain, ix, iz, native):
  data = terrain["grid"]
  source_cols, source_rows = data["cols"], data["rows"]
  source_origin = data["origin"]
  side = 128 if native else 129
  word = "nativeHeightsCm" if native else "heightsCm"
  rows = np.asarray(data[word], dtype="<i2").reshape(
    source_rows - int(native), source_cols - int(native)
  )
  column = round((ix * TILE - source_origin[0]) / STEP)
  row = round((iz * TILE - source_origin[1]) / STEP)
  # A tile may only partly overlap the measured source raster. Outside cells
  # carry no ground polygons and are inaccessible to the renderer and sampler.
  ixes = np.clip(np.arange(column, column + side), 0, rows.shape[1] - 1)
  izes = np.clip(np.arange(row, row + side), 0, rows.shape[0] - 1)
  return rows[np.ix_(izes, ixes)]


def packet(
  terrain,
  display_scope,
  navigation_scope,
  materials,
  navigation_water,
  roads,
  triangles,
  solids,
  buildings,
  bridge_floors,
  bridge_barriers,
  height_at,
  index,
  native,
):
  ix, iz = index
  x, z = ix * TILE, iz * TILE
  tile = box(x, z, x + TILE, z + TILE)
  local = polygonal(display_scope.intersection(tile))
  mesh = PackedMesh(x, z)
  details = PackedMesh(x, z)
  grid = source_grid(terrain, ix, iz, native)
  terrain_geometry(mesh, tile, local, display_scope, materials, grid, native, height_at)
  for points, color in triangles:
    details.triangle(points, color)
  nav_buildings = []
  for identity, footprint, y, height, extrude in [
    *buildings,
    *((*solid, False) for solid in solids),
  ]:
    selected = polygonal(footprint.intersection(tile))
    if selected.is_empty:
      continue
    if extrude:
      # No visible wall on an artificial tile seam.
      details.building(selected, y, y + height, footprint.boundary.intersection(tile))
    nav_buildings.extend(
      {
        **ring,
        "sourceId": identity,
        "minHeight": 0,
        "height": height,
        "groundOffset": y - 3,
      }
      for ring in navigation_polygons(selected, x, z)
    )
  navigation_local = (
    local
    if navigation_scope is display_scope
    else polygonal(navigation_scope.intersection(tile))
  )
  wet = polygonal(navigation_water.intersection(navigation_local))
  land = polygonal(navigation_local.difference(wet))
  decks = [
    (polygonal(g.intersection(tile)), h) for g, h in bridge_floors if g.intersects(tile)
  ]
  bridge_area = polygonal(unary_union([g for g, _ in decks]))
  floors = [{**r, "y": y} for g, y in decks for r in navigation_polygons(g, x, z)]
  barriers = [
    {**r, "low": a, "high": b}
    for g, a, b in bridge_barriers
    if g.intersects(tile)
    for r in navigation_polygons(polygonal(g.intersection(tile)), x, z)
  ]
  land = polygonal(land.union(bridge_area))
  return (
    {
      "schemaVersion": 1,
      "origin": [x, -10, z],
      "gardenTerrainV330": encode(grid),
      "nav": {
        "ground": navigation_polygons(land, x, z),
        "water": navigation_polygons(wet, x, z),
        "roads": navigation_polygons(roads.intersection(land), x, z),
        "bridges": navigation_polygons(bridge_area, x, z),
        "spreeBridgesV242": {"floors": floors, "solids": barriers},
        "buildings": nav_buildings,
        "groundY": 3,
      },
    },
    mesh,
    details,
  )


def packed_item(metadata, meshes):
  packet = {
    **metadata,
    "meshes": [payload for mesh, kind in meshes if (payload := mesh.payload(kind))],
  }
  raw = encode_json(packet)
  compressed = gzip.compress(raw, compresslevel=9, mtime=0)
  return raw, compressed


def within_budget(pair):
  raw, compressed = pair
  return len(compressed) <= SOURCE_CAPS[0] and len(raw) <= SOURCE_CAPS[1]


def split_mesh(mesh, start, end):
  result = PackedMesh(mesh.origin_x, mesh.origin_z)
  keys = list(mesh.vertices)
  for old_index in mesh.indices[start:end]:
    key = keys[old_index]
    result.indices.append(result.vertices.setdefault(key, len(result.vertices)))
  return result


def packets_for(metadata, ground, details):
  ground_kind = "gardens-ground-v330"
  detail_kind = "gardens-landmarks-v330"
  full = packed_item(metadata, [(ground, ground_kind), (details, detail_kind)])
  if within_budget(full):
    return [full]
  empty = {
    "schemaVersion": 1,
    "origin": metadata["origin"],
    "nav": {"ground": [], "water": [], "buildings": [], "groundY": 3},
  }

  def slices(mesh, start, end, kind, header):
    result = packed_item(header, [(split_mesh(mesh, start, end), kind)])
    if within_budget(result):
      return [result]
    middle = start + (end - start) // 6 * 3
    if middle == start:
      raise ValueError("Kienberg tile metadata exceeds the fixed packet limit")
    return [
      *slices(mesh, start, middle, kind, header),
      *slices(mesh, middle, end, kind, empty),
    ]

  primary = slices(ground, 0, len(ground.indices), ground_kind, metadata)
  decorations = (
    slices(details, 0, len(details.indices), detail_kind, empty)
    if details.indices
    else []
  )
  return [*primary, *decorations]


def build(terrain_path, garden_path, kienberg_path, output):
  from scripts.kienberg_landmarks_v330 import build_kienberg_landmarks
  from scripts.marzahn_garden_landmarks_v330 import build_garden_landmarks
  from scripts.marzahn_garden_terrain_v330 import (
    ground_at,
    load_terrain,
    native_domain,
    terrain_height,
  )

  terrain = load_terrain(terrain_path)
  garden, kienberg, context = read(garden_path), read(kienberg_path), read(CONTEXT)
  baseline = read(BASELINE)
  scope = shape(terrain["scope"])
  if scope.is_empty or scope.intersection(nav_shape(baseline["footprint"])).area > 0.01:
    raise ValueError("The named terrain must be a positive exact complement")
  own = {**garden.get("ownedAreas", {}), **kienberg.get("ownedAreas", {})}
  for area in kienberg.get("ownedAreas", {}).values():
    own.update({identity: area["geometry"] for identity in area["lod2Ids"]})
  layers, roads, trees = surface_sources(context["osm"]["records"], scope)
  layers["water"] = polygonal(layers["water"].union(shape(terrain["water"])))
  for source in (garden, kienberg):
    for item in source.get("waterAreas", {}).values():
      layers["water"] = polygonal(
        layers["water"].union(shape(item).intersection(scope))
      )
  tiles = {}
  for native in (False, True):
    ground = partial(ground_at, terrain, native=native)
    height_at = partial(terrain_height, terrain, native=native)
    garden_triangles, garden_solids = build_garden_landmarks(garden, height_at, native)
    kienberg_triangles, kienberg_solids = build_kienberg_landmarks(
      kienberg, height_at, native
    )
    navigation_scope = (
      unary_union([shape(terrain["nativeLand"]), shape(terrain["nativeWater"])])
      if native
      else scope
    )
    # Render complete cells across internal shorelines without admitting them to navigation.
    display_scope = native_domain(scope) if native else scope
    water = (
      native_polygon(layers["water"]).union(shape(terrain["nativeWater"]))
      if native
      else layers["water"]
    )
    navigation_water = (
      polygonal(water.intersection(navigation_scope)) if native else water
    )
    materials = disjoint_materials({**layers, "water": water}, display_scope, native)
    buildings, official_triangles = ordinary_buildings(
      context, navigation_scope, own, [], ground, native
    )
    no_trees = unary_union(
      [g for _, g, *_ in [*buildings, *garden_solids, *kienberg_solids]]
    ).buffer(0.35)
    tree_triangles, tree_solids = draw_trees(trees, ground, native, no_trees)
    bridge_triangles, bridge_floors, bridge_barriers = bridge_fittings(
      terrain["elevatedPaths"], height_at, native
    )
    by_tile = geometry_tiles(
      [
        *garden_triangles,
        *kienberg_triangles,
        *official_triangles,
        *tree_triangles,
        *bridge_triangles,
      ]
    )
    west, north, east, south = display_scope.bounds
    family = "minecraft" if native else "drawn"
    for ix in range(math.floor(west / TILE), math.ceil(east / TILE)):
      for iz in range(math.floor(north / TILE), math.ceil(south / TILE)):
        bounds = [ix * TILE, iz * TILE, (ix + 1) * TILE, (iz + 1) * TILE]
        if display_scope.intersection(box(*bounds)).area < 0.01:
          if by_tile.get((ix, iz)):
            raise ValueError(
              f"An authored landmark escaped the named scope in {(ix, iz)}"
            )
          continue
        item = packet(
          terrain,
          display_scope,
          navigation_scope,
          materials,
          navigation_water,
          roads,
          by_tile.get((ix, iz), []),
          [*garden_solids, *kienberg_solids, *tree_solids],
          buildings,
          bridge_floors,
          bridge_barriers,
          height_at,
          (ix, iz),
          native,
        )
        name = f"gardens330-{ix}_{iz}"
        descriptor = tiles.setdefault(
          (ix, iz), {"id": name, "bounds": bounds, "origin": item[0]["origin"]}
        )
        descriptor[family] = packets_for(*item)
  emitted = []
  for tile in tiles.values():
    name = tile["id"]
    total = max(len(tile.get(f, ())) for f in ("drawn", "minecraft"))
    for index in range(total):
      identity = name if index == 0 else f"{name}-p{index}"
      descriptor = {"id": identity, "bounds": tile["bounds"]}
      if index:
        descriptor["detailCompanionOf"] = name
      for family in ("drawn", "minecraft"):
        parts = tile.get(family, ())
        if index < len(parts):
          raw, packed = parts[index]
        else:
          raw, packed = packed_item(
            {
              "schemaVersion": 1,
              "origin": tile["origin"],
              "nav": {"ground": [], "water": [], "buildings": [], "groundY": 3},
            },
            [],
          )
        filename = f"{identity}.{family}.json.gz"
        output.mkdir(parents=True, exist_ok=True)
        (output / filename).write_bytes(packed)
        descriptor[family] = {
          "url": filename,
          "bytes": len(packed),
          "encoding": "gzip",
          "decodedBytes": len(raw),
          "sha256": hashlib.sha256(packed).hexdigest(),
        }
      emitted.append(descriptor)
  footprint = navigation_polygons(scope, 0, 0)
  manifest = {
    **baseline,
    "chunks": [*baseline["chunks"], *emitted],
    "footprint": [*baseline["footprint"], *footprint],
    "gardenFootprintStartV330": len(baseline["footprint"]),
  }
  write(output / "manifest.json", manifest)
  return {
    "tiles": emitted,
    "footprint": footprint,
    "scopeM2": scope.area,
    "mappedBridgeRecords": sum(
      row["id"] in BRIDGES for row in terrain["elevatedPaths"]
    ),
    "mappedTreeRecords": len(trees),
  }


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--terrain", type=Path, required=True)
  parser.add_argument("--garden", type=Path, required=True)
  parser.add_argument("--kienberg", type=Path, required=True)
  parser.add_argument("--out", type=Path, required=True)
  args = parser.parse_args()
  print(
    json.dumps(
      build(args.terrain, args.garden, args.kienberg, args.out), ensure_ascii=False
    )
  )


if __name__ == "__main__":
  main()
