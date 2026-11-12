"""Compile the named Jungfernheide climbing park using the existing packet format."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import random
from pathlib import Path

import geopandas as gpd
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

from scripts.build_spree_bridges_v242 import extrusion, raster
from scripts.build_surrounding_outlines import (
  PackedMesh,
  navigation_polygons,
  tags_for,
  world,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/jungfernheide-climbing-source.json"
CACHE = ROOT / "geo_data/regierungsviertel/raw/outskirts-v187/candidate.gpkg"
BOUNDS = [-5632, -3072, -5120, -2560]
ORIGIN_X, ORIGIN_Z = BOUNDS[:2]
TILE = "jungfernheide-climbing"
GROUND = 3
WOOD = (140, 103, 67)
PATH = (151, 133, 104)
TRUNK = (110, 89, 65)
FOREST = (106, 123, 80)
CROWNS = [(73, 103, 63), (87, 116, 63), (94, 125, 74)]
CABLE = (127, 132, 114)

# Display estimates from the operator's schematic, on their correct sides of
# the main through-path. Tree attachment points and verticals are illustrative.
SECTORS = [
  [(-5398, -2799, 3), (-5381, -2782, 4), (-5360, -2788, 5), (-5364, -2771, 4)],
  [(-5454, -2797, 6), (-5472, -2782, 7), (-5449, -2769, 8), (-5434, -2778, 6)],
  [(-5514, -2752, 8), (-5498, -2731, 10), (-5477, -2742, 11), (-5468, -2723, 9)],
  [(-5492, -2700, 10), (-5469, -2698, 13), (-5453, -2680, 14), (-5440, -2696, 12)],
  [(-5429, -2722, 13), (-5447, -2740, 17), (-5467, -2751, 15)],
]


def compact(value) -> bytes:
  return (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


def extract() -> dict:
  """Freeze complete source outline, kiosk polygon and path linework."""
  shapes = gpd.read_file(
    CACHE, layer="multipolygons", where="osm_way_id IN ('69547558','431222877')"
  ).to_crs(25833)
  routes = gpd.read_file(
    CACHE, layer="lines", where="osm_id IN ('25738376','125744018','125744020')"
  ).to_crs(25833)
  areas = {
    tags_for(row)["osm_way_id"]: mapping(world(row.geometry))
    for _, row in shapes.iterrows()
  }
  assert set(areas) == {"69547558", "431222877"}
  paths = {
    tags_for(row)["osm_id"]: {
      "geometry": mapping(world(row.geometry)),
      "width": float(tags_for(row).get("width", 1.5)),
      "widthEstimate": "width" not in tags_for(row),
    }
    for _, row in routes.iterrows()
  }
  assert set(paths) == {"25738376", "125744018", "125744020"}
  with CACHE.open("rb") as source:
    return dict(
      schemaVersion=1,
      osmSourceSha256=hashlib.file_digest(source, "sha256").hexdigest(),
      areas=areas,
      paths=paths,
      climbingSectors=SECTORS,
    )


def profile(source: dict, native: bool) -> tuple[dict, list[dict]]:
  scope = shape(source["areas"]["69547558"])
  ground = raster(scope, 1, fully_inside=True) if native else scope
  kiosk = shape(source["areas"]["431222877"])
  paths = unary_union(
    [
      shape(row["geometry"]).buffer(row["width"] / 2, cap_style=2)
      for row in source["paths"].values()
    ]
  ).intersection(scope)
  if native:
    paths = raster(paths, 0.5).intersection(ground)
    kiosk = raster(kiosk, 0.5, fully_inside=True)
  mesh = PackedMesh(ORIGIN_X, ORIGIN_Z)
  mesh.surface(ground.difference(paths), GROUND, FOREST)
  mesh.surface(paths, GROUND + 0.09, PATH)
  extrusion(mesh, kiosk, GROUND, GROUND + 3.5, WOOD)
  mesh.surface(kiosk, GROUND + 3.51, (104, 112, 101))

  # The plan shows the low children's and larger routes, but is not a tree
  # survey. Keep every estimated attachment wholly in the measured site.
  supports = [tuple(node) for sector in source["climbingSectors"] for node in sector]
  assert all(ground.buffer(-3).covers(Point(x, z)) for x, z, _ in supports)
  randomizer = random.Random(69547558)
  forest = ground.buffer(-6).difference(paths.buffer(4)).difference(kiosk.buffer(6))
  tree_points = [(x, z, height + 7) for x, z, height in supports]
  for x in range(-5541, -5305, 13):
    for z in range(-2826, -2615, 13):
      x1, z1 = x + randomizer.uniform(-2, 2), z + randomizer.uniform(-2, 2)
      if (
        forest.covers(Point(x1, z1))
        and min(math.hypot(x1 - p[0], z1 - p[1]) for p in tree_points) >= 9
      ):
        tree_points.append((x1, z1, randomizer.randrange(15, 30)))

  def crown(x, z, width, height, color):
    trunk = (
      box(x - 0.28, z - 0.28, x + 0.28, z + 0.28)
      if native
      else Point(x, z).buffer(0.28, quad_segs=2)
    )
    extrusion(mesh, trunk, GROUND, GROUND + height, TRUNK)
    if native:
      for level, factor in enumerate((0.72, 1, 0.63)):
        radius = width * factor
        extrusion(
          mesh,
          box(x - radius, z - radius, x + radius, z + radius),
          GROUND + height - 4.5 + level * 2.2,
          GROUND + height - 2.3 + level * 2.2,
          color,
        )
    else:
      base, top = GROUND + height - 4.7, GROUND + height + 2
      ring = list(Point(x, z).buffer(width, quad_segs=2).exterior.coords)
      for a, b in zip(ring, ring[1:]):
        mesh.triangle([(a[0], base, a[1]), (b[0], base, b[1]), (x, top, z)], color)
        mesh.triangle(
          [(b[0], base, b[1]), (a[0], base, a[1]), (x, base - 2.2, z)], color
        )

  for index, (x, z, height) in enumerate(tree_points):
    crown(x, z, 2.9 + (index % 4) * 0.47, height, CROWNS[index % len(CROWNS)])

  def deck(x, z, y, radius, depth, color):
    polygon = (
      box(x - radius, z - radius, x + radius, z + radius)
      if native
      else Point(x, z).buffer(radius, quad_segs=2)
    )
    extrusion(mesh, polygon, y - depth, y, color)

  for sector in source["climbingSectors"]:
    for x, z, height in sector:
      deck(x, z, GROUND + height, 1.2, 0.25, WOOD)
    for index, (a, b) in enumerate(zip(sector, sector[1:])):
      assert ground.buffer(-1.2).covers(LineString([a[:2], b[:2]]))
      span = math.hypot(b[0] - a[0], b[1] - a[1])
      direction = ((b[0] - a[0]) / span, (b[1] - a[1]) / span)
      count = math.ceil(span / (0.45 if native else 0.75))
      suspended_bridge = index % 2 == 0

      def point(t, side=0):
        return (
          a[0] + (b[0] - a[0]) * t + side * direction[1],
          GROUND + a[2] + (b[2] - a[2]) * t - 2.4 * t * (1 - t),
          a[1] + (b[1] - a[1]) * t - side * direction[0],
        )

      if suspended_bridge:
        for i in range(1, count):
          x, y, z = point(i / count)
          if native:
            deck(x, z, y, 0.33, 0.14, WOOD)
          else:
            dx, dz = direction
            plank = Polygon(
              [
                (x + dx * u + dz * v, z + dz * u - dx * v)
                for u, v in [(-0.19, -0.54), (0.19, -0.54), (0.19, 0.54), (-0.19, 0.54)]
              ]
            )
            extrusion(mesh, plank, y - 0.14, y, WOOD)

      for side in (-0.49, 0.49) if suspended_bridge else (0,):
        for i in range(count):
          x, y, z = point(i / count, side)
          next_x, next_y, next_z = point((i + 1) / count, side)
          if native:
            if not suspended_bridge:
              y += 0.50
              next_y += 0.50
            y += 1.12
            next_y += 1.12
            cable_plan = box(
              min(x, next_x) - 0.035,
              min(z, next_z) - 0.035,
              max(x, next_x) + 0.035,
              max(z, next_z) + 0.035,
            )
            extrusion(
              mesh, cable_plan, min(y, next_y) - 0.045, max(y, next_y) + 0.045, CABLE
            )
          else:
            elevation = 1.12 if suspended_bridge else 1.62
            p = [
              (x, y + elevation - 0.045, z),
              (next_x, next_y + elevation - 0.045, next_z),
              (next_x, next_y + elevation + 0.045, next_z),
              (x, y + elevation + 0.045, z),
            ]
            mesh.triangle([p[0], p[1], p[2]], CABLE)
            mesh.triangle([p[0], p[2], p[3]], CABLE)

  def local(value):
    return navigation_polygons(value, ORIGIN_X, ORIGIN_Z)

  payload = dict(
    schemaVersion=1,
    origin=[ORIGIN_X, -10, ORIGIN_Z],
    meshes=[mesh.payload(TILE)],
    nav=dict(
      ground=local(ground),
      buildings=[
        dict(row, sourceId="way/431222877", height=3.51, minHeight=0)
        for row in local(kiosk)
      ],
      water=[],
      bridges=[],
      roads=local(paths),
      groundY=GROUND,
    ),
  )
  return payload, navigation_polygons(scope, 0, 0)


def build(source: dict, output: Path) -> None:
  """Stage assets and manifest additions for the release integrator."""
  output.mkdir(parents=True, exist_ok=True)
  descriptor = dict(id=TILE, bounds=BOUNDS)
  footprint = []
  for mode in ("drawn", "minecraft"):
    payload, footprint = profile(source, mode == "minecraft")
    raw = compact(payload)
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    filename = f"{TILE}.{mode}.json.gz"
    (output / filename).write_bytes(packed)
    descriptor[mode] = dict(
      url=filename,
      bytes=len(packed),
      decodedBytes=len(raw),
      sha256=hashlib.sha256(packed).hexdigest(),
      encoding="gzip",
    )
  (output / "manifest-addition.json").write_bytes(
    compact(dict(chunk=descriptor, footprint=footprint))
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("output", type=Path)
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract:
    SOURCE.write_bytes(compact(extract()))
  build(json.loads(SOURCE.read_bytes()), args.output)
