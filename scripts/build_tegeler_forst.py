"""Stage measured forest terrain, the Großer Malchsee and Dicke Marie in two families."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import random
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import unary_union

from scripts import marzahn_garden_terrain_v330 as measured
from scripts.build_marzahn_gardens_v330 import (
  PATH_MATERIALS,
  source_grid,
  terrain_geometry,
)
from scripts.build_spree_bridges_v242 import extrusion, raster
from scripts.build_surrounding_outlines import (
  PackedMesh,
  line_parts,
  load_projected_polygon,
  navigation_polygons,
  polygonal,
  world,
)
from scripts.build_tegeler_fliess import areas_in_scope, json_bytes

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "tegeler-forst-source.json.gz"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
STUDY = box(-7550, -8730, -6680, -7870)
SIZE = 512
WATER_Y = -1.15
WATER = (105, 148, 157)
BANK = (172, 174, 150)
FOREST = (116, 142, 90)
COLOURS = {
  "paving": (176, 173, 161),
  "asphalt": (129, 134, 129),
  "gravel": (175, 156, 121),
  "earth": (151, 131, 101),
}
TRUNK = (100, 77, 55)
CROWNS = ((75, 108, 61), (84, 119, 66), (97, 131, 73), (109, 140, 81))


def sha(path: Path) -> str:
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def capture(osm_selection: Path, dgm_dir: Path) -> None:
  """Retain the exact source polygons and a bounded DGM1 sample grid."""
  source = json.loads(osm_selection.read_bytes())
  tree = source["points"]["205066401"]
  lake = source["multipolygons"]["8878372"]
  forest = source["multipolygons"]["2824406"]
  old_outlines = [
    world(load_projected_polygon(GEO / filename))
    for filename in (
      "bounds-west-lakes-v194.geojson",
      "bounds-tegel-spandau-v198.geojson",
    )
  ]
  manifest_path = PUBLIC / "manifest.json"
  manifest = json.loads(manifest_path.read_bytes())
  area = unary_union(
    [shape(forest["geometry"]).intersection(STUDY), shape(lake["geometry"]).buffer(20)]
  )
  old_packets = areas_in_scope(area, manifest["footprint"])
  old_land = polygonal(
    unary_union([*old_outlines, old_packets]).intersection(area.buffer(38))
  )
  scope = polygonal(area.simplify(0.02, preserve_topology=True).difference(old_land))
  paths = {}
  for key, row in source["lines"].items():
    tags = row["tags"]
    if tags.get("highway") not in {
      "footway",
      "path",
      "track",
      "cycleway",
      "bridleway",
      "service",
    }:
      continue
    if tags.get("access") in {"no", "private"} or tags.get("bridge") not in (
      None,
      "no",
    ):
      continue
    geometry = shape(row["geometry"])
    if not geometry.intersects(scope):
      continue
    paths[key] = row
  obstacles = {
    key: row
    for key, row in source["multipolygons"].items()
    if row["tags"].get("building") not in (None, "no")
    and shape(row["geometry"]).intersects(scope)
  }
  measured.RAW = dgm_dir
  grid, pins = measured.sample_grid(scope.buffer(8, quad_segs=1))
  raw_heights = (list(grid["heightsCm"]), list(grid["nativeHeightsCm"]))
  # Blend only the local margin into the older flat shore. All forest interior
  # samples preserve the DGM1 interpolation and independent Native rounding.
  for native, name in ((False, "heightsCm"), (True, "nativeHeightsCm")):
    cols = grid["cols"] - int(native)
    rows = grid["rows"] - int(native)
    xs = grid["origin"][0] + np.arange(cols) * 4 + 2 * int(native)
    zs = grid["origin"][1] + np.arange(rows) * 4 + 2 * int(native)
    x, z = np.meshgrid(xs, zs)
    distance = shapely.distance(shapely.points(x, z), old_land)
    scale = np.clip(distance / 30, 0, 1).ravel()
    scale = scale * scale * (3 - 2 * scale)
    grid[name] = (
      np.rint(301 + (np.asarray(raw_heights[int(native)]) - 301) * scale)
      .astype(int)
      .tolist()
    )
  frozen = {
    "schemaVersion": 1,
    "osmSource": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    "osmSourceSha256": sha(GEO / "raw/outer-v159/berlin-260929.osm.pbf"),
    "predecessorManifestSha256": sha(manifest_path),
    "elevationSources": pins,
    "referenceTree": "https://www.berlin.de/sen/uvk/presse/pressemitteilungen/2025/pressemitteilung.1576243.php",
    "tree": tree,
    "lake": lake,
    "forest": forest,
    "paths": paths,
    "obstacles": obstacles,
    "scope": mapping(scope),
    "previous": mapping(old_land),
    "grid": grid,
    "unblendedHeightsCm": raw_heights,
  }
  SOURCE.write_bytes(gzip.compress(json_bytes(frozen), compresslevel=9, mtime=0))


def path_width(tags: dict) -> float:
  explicit = tags.get("width")
  if explicit:
    try:
      width = float(explicit)
      if 0.4 <= width <= 14:
        return width
    except ValueError:
      pass
  return 3.0 if tags["highway"] in {"track", "service"} else 1.6


def path_layers(source: dict, land, native: bool):
  layers = {name: [] for name in COLOURS}
  for row in source["paths"].values():
    tags = row["tags"]
    material = PATH_MATERIALS.get(tags.get("surface"), "earth")
    area = shape(row["geometry"]).buffer(path_width(tags) / 2, cap_style=2, quad_segs=3)
    layers[material].append(area)
  ground = land
  chosen = []
  for material, parts in layers.items():
    area = polygonal(unary_union(parts).intersection(ground))
    if native:
      area = polygonal(raster(area, 0.5).intersection(ground))
    if not area.is_empty:
      chosen.append((area, COLOURS[material]))
      ground = polygonal(ground.difference(area))
  if not ground.is_empty:
    chosen.append((ground, FOREST))
  return chosen, polygonal(land.difference(ground))


def branches(mesh, start, end, low_radius, high_radius, colour):
  """Connect two rings around the actual stem path."""
  a, b = np.array(start, dtype=float), np.array(end, dtype=float)
  direction = (b - a) / np.linalg.norm(b - a)
  side = np.cross(direction, [0, 0, 1])
  side /= np.linalg.norm(side)
  perpendicular = np.cross(direction, side)
  rings = [
    [
      tuple(center + radius * (math.cos(t) * side + math.sin(t) * perpendicular))
      for t in np.arange(8) * math.tau / 8
    ]
    for center, radius in ((a, low_radius), (b, high_radius))
  ]
  for i in range(8):
    j = (i + 1) % 8
    mesh.triangle([rings[0][i], rings[0][j], rings[1][j]], colour)
    mesh.triangle([rings[0][i], rings[1][j], rings[1][i]], colour)


def crown(mesh, x, z, height, radius, native, colour):
  if native:
    for rise, scale, thickness in (
      (-1.7, 0.70, 1.5),
      (-0.4, 1.0, 1.6),
      (1.0, 0.58, 1.3),
    ):
      r = radius * scale
      extrusion(
        mesh,
        box(x - r, z - r, x + r, z + r),
        height + rise,
        height + rise + thickness,
        colour,
      )
  else:
    ring = list(Point(x, z).buffer(radius, quad_segs=2).exterior.coords)
    for a, b in zip(ring, ring[1:]):
      mesh.triangle(
        [(a[0], height, a[1]), (b[0], height, b[1]), (x, height + radius * 0.62, z)],
        colour,
      )
      mesh.triangle(
        [(b[0], height, b[1]), (a[0], height, a[1]), (x, height - radius * 0.46, z)],
        colour,
      )


def trees(mesh, x, z, ground, height, radius, native, colour, heritage=False):
  """Ordinary canopy is illustrative; the national heritage tree is named and located."""
  width = 6.5 / math.tau if heritage else 0.22
  if native:
    extrusion(
      mesh,
      box(x - width, z - width, x + width, z + width),
      ground,
      ground + height * 0.8,
      TRUNK,
    )
  else:
    branches(
      mesh,
      (x, ground, z),
      (x + 0.14, ground + height * 0.87, z - 0.15),
      width,
      width * 0.52,
      TRUNK,
    )
  if not heritage:
    crown(mesh, x, z, ground + height - radius * 0.62, radius, native, colour)
    return
  # Display-estimated asymmetric limb locations. The full envelope uses the
  # latest published height and the lower trunk uses the published circumference.
  for i, (dx, dz, rise, r) in enumerate(
    (
      (-2.7, -1.6, 11.8, 3.4),
      (2.8, -0.75, 12.5, 3.2),
      (0.6, 2.5, 11.6, 3.3),
      (-0.85, -0.5, 13.3, 2.74),
    )
  ):
    if native:
      for part in range(1, 8):
        t = part / 8
        px, pz = x + t * dx, z + t * dz
        extrusion(
          mesh,
          box(px - 0.28, pz - 0.28, px + 0.28, pz + 0.28),
          ground + 7 + t * (rise - 7) - 0.4,
          ground + 7 + t * (rise - 7) + 0.7,
          TRUNK,
        )
    else:
      branches(
        mesh, (x, ground + 7, z), (x + dx, ground + rise, z + dz), 0.36, 0.13, TRUNK
      )
    center = ground + rise
    if native:
      center = min(center, ground + 12.7)
    crown(mesh, x + dx, z + dz, center, r, native, CROWNS[i])


def build(output: Path) -> None:
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  scope = shape(source["scope"])
  water = polygonal(shape(source["lake"]["geometry"]).intersection(scope))
  land = polygonal(scope.difference(water))
  previous = shape(source["previous"])
  assert previous.intersection(scope).area < 0.001
  marker = shape(source["tree"]["geometry"])
  assert land.buffer(-4).covers(marker)
  forest = shape(source["forest"]["geometry"])
  buildings = unary_union(
    [shape(row["geometry"]) for row in source["obstacles"].values()]
  )
  raw_paths = unary_union([shape(row["geometry"]) for row in source["paths"].values()])
  stands = polygonal(
    forest.intersection(land)
    .buffer(-4)
    .difference(raw_paths.buffer(4.4))
    .difference(buildings.buffer(7))
    .difference(marker.buffer(12))
  )
  rng = random.Random(205066401)
  placements = []
  for x in range(-7546, -6679, 15):
    for z in range(-8726, -7888, 15):
      p = Point(x + rng.uniform(-3, 3), z + rng.uniform(-3, 3))
      if stands.covers(p):
        placements.append(
          (p.x, p.y, rng.uniform(9, 18.5), rng.uniform(2.45, 3.5), rng.choice(CROWNS))
        )
  areas = {}
  for native in (False, True):
    wet = polygonal(raster(water, 1).intersection(scope)) if native else water
    ground = polygonal(scope.difference(wet)) if native else land
    layers, roads = path_layers(source, ground, native)
    areas[native] = ground, wet, layers, roads

  def height(x, z, native=False):
    return measured.terrain_height(source, x, z, native)

  xs, zs, xe, ze = scope.bounds
  chunks = []
  for ix in range(math.floor(xs / SIZE), math.ceil(xe / SIZE)):
    for iz in range(math.floor(zs / SIZE), math.ceil(ze / SIZE)):
      x, z = ix * SIZE, iz * SIZE
      bounds = [x, z, x + SIZE, z + SIZE]
      tile = box(*bounds)
      if scope.intersection(tile).area <= 0.05:
        continue
      key = f"tegeler-forst-{ix}_{iz}"
      descriptor = dict(id=key, bounds=bounds)
      for family in ("drawn", "minecraft"):
        native = family == "minecraft"
        ground, wet, layers, roads = areas[native]
        local = polygonal(ground.intersection(tile))
        local_water = polygonal(wet.intersection(tile))
        grid = source_grid(source, ix, iz, native)
        mesh = PackedMesh(x, z)
        if not local.is_empty:
          local_layers = [
            (polygonal(g.intersection(tile)), c)
            for g, c in layers
            if g.intersects(tile)
          ]
          terrain_geometry(
            mesh,
            tile,
            local,
            ground,
            local_layers,
            grid,
            native,
            lambda px, pz: height(px, pz, native),
          )
        mesh.surface(local_water, WATER_Y, WATER)
        coast = wet.boundary.intersection(ground.buffer(0.02)).intersection(
          tile.buffer(-0.001)
        )
        for part in line_parts(coast):
          for a, b in zip(part.coords, list(part.coords)[1:]):
            lower_a = (a[0], WATER_Y, a[1])
            lower_b = (b[0], WATER_Y, b[1])
            upper_a = (a[0], max(WATER_Y, height(*a, native)), a[1])
            upper_b = (b[0], max(WATER_Y, height(*b, native)), b[1])
            mesh.triangle([lower_a, lower_b, upper_b], BANK)
            mesh.triangle([lower_a, upper_b, upper_a], BANK)
        tree_mesh = PackedMesh(x, z)
        # Whole crowns belong to one tile, so do not duplicate clipped trees.
        for tx, tz, h, r, c in placements:
          if x + 4 < tx < x + SIZE - 4 and z + 4 < tz < z + SIZE - 4:
            trees(tree_mesh, tx, tz, height(tx, tz, native), h, r, native, c)
        if tile.contains(marker):
          trees(
            tree_mesh,
            marker.x,
            marker.y,
            height(marker.x, marker.y, native),
            15,
            4,
            native,
            CROWNS[0],
            True,
          )
        meshes = [
          p
          for p in (
            mesh.payload("tegeler-forst-terrain"),
            tree_mesh.payload("tegeler-forst-trees"),
          )
          if p
        ]
        assert meshes
        nav = {
          "ground": navigation_polygons(local, x, z),
          "water": navigation_polygons(local_water, x, z),
          "buildings": [],
          "roads": navigation_polygons(roads.intersection(tile), x, z),
          "groundY": 3,
        }
        packet = {
          "schemaVersion": 1,
          "origin": [x, -10, z],
          "meshes": meshes,
          "nav": nav,
          "gardenTerrainV330": base64.b64encode(grid.tobytes()).decode("ascii"),
        }
        raw = json_bytes(packet)
        compressed = gzip.compress(raw, compresslevel=9, mtime=0)
        assert len(compressed) <= 1100000 and len(raw) <= 4400000, (
          key,
          family,
          len(compressed),
          len(raw),
        )
        name = f"{key}.{family}.json.gz"
        (output / name).write_bytes(compressed)
        descriptor[family] = {
          "url": name,
          "bytes": len(compressed),
          "encoding": "gzip",
          "decodedBytes": len(raw),
          "sha256": hashlib.sha256(compressed).hexdigest(),
        }
      chunks.append(descriptor)
  (output / "manifest-addition.json").write_bytes(
    json_bytes({"chunks": chunks, "footprint": navigation_polygons(scope, 0, 0)})
  )
  (output / "evidence.json").write_bytes(
    json_bytes(
      {
        "sourceSha256": sha(SOURCE),
        "footprintM2": round(scope.area, 2),
        "addedLakeM2": round(water.area, 2),
        "retainedShoreOverlapM2": round(
          shape(source["lake"]["geometry"]).intersection(previous).area, 2
        ),
        "mappedPathCount": len(source["paths"]),
        "illustrativeTreeCount": len(placements),
        "nationalHeritageTreeHeightM": 15,
        "nationalHeritageTreeCircumferenceM": 6.5,
        "terrainRangeCm": [
          min(source["grid"]["heightsCm"]),
          max(source["grid"]["heightsCm"]),
        ],
      }
    )
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("output", type=Path)
  parser.add_argument("--osm-selection", type=Path)
  parser.add_argument("--dgm-dir", type=Path)
  args = parser.parse_args()
  if args.osm_selection is not None:
    if args.dgm_dir is None:
      parser.error("--dgm-dir is required with --osm-selection")
    capture(args.osm_selection, args.dgm_dir)
  args.output.mkdir(parents=True, exist_ok=True)
  build(args.output)
