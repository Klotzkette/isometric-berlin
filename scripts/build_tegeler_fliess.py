"""Compile the mapped Tegeler Fließ at Hermsdorfer See and the Eichwerdersteg."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path

import shapely
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

from scripts.build_spree_bridges_v242 import extrusion, raster
from scripts.build_surrounding_outlines import (
  PackedMesh,
  line_parts,
  navigation_polygons,
  polygonal,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/tegeler-fliess-source.json"
PACKET_MANIFEST = ROOT / "src/app/public/mesh/surrounding-berlin-v159/manifest.json"
STUDY_AREA = box(-3550, -11950, -1800, -10400)
TILE_SIZE = 512
GROUND_Y = 3.0
WATER_Y = 2.57
DECK_Y = 3.25
LAND = (112, 135, 91)
MARSH = (118, 139, 86)
TREES = (88, 118, 74)
SCRUB = (101, 125, 80)
MEADOW = (127, 145, 87)
WATER = (98, 143, 151)
BANK = (136, 133, 93)
WOOD = (151, 114, 76)
WOOD_DARK = (115, 86, 55)


def json_bytes(value: object) -> bytes:
  return json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode() + b"\n"


def areas_in_scope(scope, rows):
  """Use only existing polygons intersecting the finite source envelope."""
  return unary_union(
    [
      shapely.make_valid(polygon)
      for row in rows
      if not (polygon := Polygon(row["ring"], row["holes"])).is_empty
      and scope.intersects(box(*polygon.bounds))
    ]
  )


def terrain(source: dict):
  reserve = shape(source["reserve"]["geometry"])
  lake = shape(source["lake"]["geometry"])
  bridge = source["boardwalk"]
  boardwalk_line = shape(bridge["geometry"])
  deck = boardwalk_line.buffer(
    float(bridge["tags"]["width"]) / 2, cap_style=2, join_style=2
  )
  courses = [
    (
      shape(row["geometry"]).intersection(reserve).intersection(STUDY_AREA),
      float(row["tags"]["width"]),
    )
    for row in source["stream"].values()
  ]
  source_scope = unary_union(
    [
      *(line.buffer(27, quad_segs=4).intersection(reserve) for line, _ in courses),
      lake,
      lake.buffer(9, quad_segs=4).intersection(reserve),
      boardwalk_line.buffer(13, quad_segs=4),
    ]
  )
  # Keep old packet ownership disjoint even if surrounding districts later grow.
  previous = json.loads(PACKET_MANIFEST.read_bytes())
  own_footprint = navigation_polygons(source_scope, 0, 0)
  old_ground = areas_in_scope(
    source_scope, (row for row in previous["footprint"] if row not in own_footprint)
  )
  assert source_scope.intersection(old_ground).area < 0.01
  water = unary_union(
    [
      lake,
      *(line.buffer(width / 2, quad_segs=4, cap_style=2) for line, width in courses),
    ]
  ).intersection(source_scope)
  banks = water.buffer(2.2, quad_segs=4).difference(water).intersection(source_scope)
  vegetation_colours = {
    "wood": TREES,
    "forest": TREES,
    "wetland": MARSH,
    "scrub": SCRUB,
    "grassland": MEADOW,
    "meadow": MEADOW,
  }
  layers = [
    (
      shape(row["geometry"]),
      vegetation_colours.get(
        row["tags"].get("natural", row["tags"].get("landuse")), LAND
      ),
    )
    for row in source.get("vegetation", {}).values()
  ]
  return source_scope, water, banks, boardwalk_line, deck, layers


def draw_tile(geometry, bounds: list[int], native: bool) -> dict:
  scope, water, banks, boardwalk, deck, layers = geometry
  tile = box(*bounds)
  ox, oz = bounds[:2]
  scope = scope.intersection(tile)
  water = polygonal(water.intersection(tile))
  banks = banks.intersection(tile)
  deck = deck.intersection(tile)
  if native:
    scope = raster(scope, 1.0, fully_inside=True)
    water = polygonal(raster(water, 0.5).intersection(scope))
    banks = raster(banks, 0.5).intersection(scope).difference(water)
    deck = raster(deck, 0.25).intersection(scope)
  land = scope.difference(water)
  wet_bank = banks.intersection(land)
  upland = land.difference(wet_bank)
  mesh = PackedMesh(ox, oz)
  remaining = upland
  for plan, colour in layers:
    clipped = plan.intersection(remaining)
    if native:
      clipped = raster(clipped, 0.5).intersection(remaining)
    mesh.surface(clipped, GROUND_Y, colour)
    remaining = remaining.difference(clipped)
  mesh.surface(remaining, GROUND_Y, LAND)
  mesh.surface(wet_bank, GROUND_Y, BANK)
  mesh.surface(water, WATER_Y, WATER)
  # Clip the natural channel's visible lip by the exact geometry in this tile.
  # Tile seams receive no vertical walls because the water continues across them.
  water_edges = (
    water.boundary.intersection(tile.buffer(-0.001))
    if not water.is_empty
    else Polygon()
  )
  for edge in line_parts(water_edges):
    for a, b in zip(edge.coords, list(edge.coords)[1:]):
      mesh.triangle(
        [(a[0], WATER_Y, a[1]), (b[0], WATER_Y, b[1]), (b[0], GROUND_Y, b[1])], BANK
      )
      mesh.triangle(
        [(a[0], WATER_Y, a[1]), (b[0], GROUND_Y, b[1]), (a[0], GROUND_Y, a[1])], BANK
      )

  rails = []
  for side in (-0.82, 0.82):
    edge = boardwalk.offset_curve(side, join_style=2)
    railing = edge.buffer(
      0.14 if native else 0.075, cap_style=2, join_style=2
    ).intersection(tile)
    if native:
      railing = raster(railing, 0.25).intersection(deck)
    else:
      railing = railing.intersection(deck)
    if railing.is_empty:
      continue
    extrusion(mesh, railing, DECK_Y + 0.92, DECK_Y + 1.05, WOOD_DARK)
    rails.extend(
      dict(row, low=DECK_Y, high=DECK_Y + 1.05)
      for row in navigation_polygons(railing, ox, oz)
    )
    for section in line_parts(edge):
      count = math.ceil(section.length / 2.65)
      for i in range(count + 1):
        p = section.interpolate(i / count, normalized=True)
        post = (
          box(p.x - 0.09, p.y - 0.09, p.x + 0.09, p.y + 0.09)
          if native
          else Point(p.x, p.y).buffer(0.095, quad_segs=1)
        )
        post = post.intersection(deck)
        extrusion(
          mesh,
          post,
          GROUND_Y if not post.intersects(water) else WATER_Y,
          DECK_Y + 1.07,
          WOOD_DARK,
        )
  extrusion(mesh, deck, DECK_Y - 0.17, DECK_Y, WOOD)
  floors = [dict(row, y=DECK_Y) for row in navigation_polygons(deck, ox, oz)]
  return dict(
    schemaVersion=1,
    origin=[ox, -10, oz],
    meshes=[mesh.payload("tegeler-fliess-terrain-and-boardwalk")],
    nav=dict(
      ground=navigation_polygons(land.union(deck), ox, oz),
      buildings=[],
      water=navigation_polygons(water, ox, oz),
      bridges=navigation_polygons(deck, ox, oz),
      roads=[],
      groundY=GROUND_Y,
      spreeBridgesV242=dict(floors=floors, solids=rails),
    ),
  )


def build(output: Path) -> None:
  geometry = terrain(json.loads(SOURCE.read_bytes()))
  scope = geometry[0]
  x0, z0, x1, z1 = scope.bounds
  chunks = []
  for ix in range(math.floor(x0 / TILE_SIZE), math.ceil(x1 / TILE_SIZE)):
    for iz in range(math.floor(z0 / TILE_SIZE), math.ceil(z1 / TILE_SIZE)):
      bounds = [
        ix * TILE_SIZE,
        iz * TILE_SIZE,
        (ix + 1) * TILE_SIZE,
        (iz + 1) * TILE_SIZE,
      ]
      if scope.intersection(box(*bounds)).area < 0.05:
        continue
      entry = dict(id=f"tegeler-fliess-{ix}_{iz}", bounds=bounds)
      for family in ("drawn", "minecraft"):
        packet = draw_tile(geometry, bounds, family == "minecraft")
        raw = json_bytes(packet)
        compressed = gzip.compress(raw, compresslevel=9, mtime=0)
        filename = f"{entry['id']}.{family}.json.gz"
        (output / filename).write_bytes(compressed)
        entry[family] = dict(
          url=filename,
          bytes=len(compressed),
          encoding="gzip",
          decodedBytes=len(raw),
          sha256=hashlib.sha256(compressed).hexdigest(),
        )
      chunks.append(entry)
  receipt = dict(chunks=chunks, footprint=navigation_polygons(scope, 0, 0))
  (output / "manifest-addition.json").write_bytes(json_bytes(receipt))


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("output", type=Path)
  destination = parser.parse_args().output
  destination.mkdir(parents=True, exist_ok=True)
  build(destination)
