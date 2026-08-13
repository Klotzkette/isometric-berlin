"""Build smooth water and parkland polygons for the drawn isometric city.

The voxel payload rasterises everything onto a 4 m grid, which is right
for the Minecraft world but makes the Spree banks and the Tiergarten
lawns read as staircases in the drawn city ("alles zu zackig, völlig
bescheuerte Ufer"). This module exports the TRUE OSM polygon rings so
the viewer can draw water bodies and parkland as smooth surfaces with a
continuous shoreline.

Water keeps a much tighter tolerance than parkland: at 0.6 m the Spree
loses two thirds of its vertices, and every dropped vertex turns a bend
into a 25 m chord that the viewer then has to draw as a straight facet.
The bank line is the one edge the eye follows, so it is worth the bytes.

Water carries a ``kind`` of ``river``, ``pond``, ``stream`` or ``basin``.
Rivers/canals run at the Spree table, natural park water follows a robust
local level and soft bank, and built basins sit at their architectural rim.
Alongside it travel the sunken walls that climb out of a basin — see
:mod:`isometric_berlin.generation.basin_features`.

Rings are stored as decimetre integers in viewer world coordinates:
``world_x = easting − 389500``, ``world_z = 5820000 − northing``.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
from pandas import isna
from shapely.geometry import (
  LineString,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
  box,
)
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union
from shapely.strtree import STRtree

from isometric_berlin.data.common import load_bounds_polygon, project_geometry
from isometric_berlin.generation.basin_features import (
  SunkenWall,
  WaterFeature,
  derive_sunken_walls,
  load_water_features,
)
from isometric_berlin.generation.build_minecraft_voxels import (
  ATTRIBUTION,
  DEFAULT_BOUNDS,
  DEFAULT_SCENE,
  MESH_PUBLIC_DIR,
  ORIGIN_EASTING,
  ORIGIN_NORTHING,
  REPO_ROOT,
  verify_scene_origin,
)
from isometric_berlin.generation.road_geometry import (
  ROAD_WIDTHS_M,
  road_width_m,
)

DEFAULT_OSM = REPO_ROOT / "geo_data/regierungsviertel/osm.gpkg"
DEFAULT_OUT = MESH_PUBLIC_DIR / "surface-polygons.json"
SCHEMA_VERSION = 10
WATER_SIMPLIFY_M = 0.1
PARK_SIMPLIFY_M = 1.2
MIN_WATER_AREA_M2 = 40.0
MIN_STREAM_AREA_M2 = 2.0
MIN_PARK_AREA_M2 = 250.0
# A formal garden is drawn bed by bed, and the eleven beds of the Rosengarten
# run from 27 to 196 m² — every one of them below the lawn floor, which is why
# the Rosengarten arrived as an undifferentiated green patch. Beds are also
# small enough that the 1.2 m lawn tolerance rounds their corners away.
MIN_GARDEN_AREA_M2 = 20.0
GARDEN_SIMPLIFY_M = 0.4
# Sample mapped ``natural=scrub`` polygons on one global lattice. Twelve
# metres retains the actual thickets while the viewer can render all samples
# as three instanced low-poly families rather than thousands of objects.
SCRUB_SPACING_M = 12.0
MIN_SCRUB_AREA_M2 = 12.0

# --- Carriageways and park paths -------------------------------------
#
# OSM gives streets and paths as CENTRELINES, which is why the drawn city
# had no road surfaces at all outside the 4 m voxel raster: the Straße des
# 17. Juni and the Großer Stern roundabout arrived as pale green park with
# a hairline through it ("die Straße ist … noch nicht grau", "die Wege im
# Tiergarten sind noch nicht alle grau oder gelb eingezeichnet"). Buffering
# each centreline by half its real carriageway width turns them into true
# polygons the viewer can draw exactly like the water and park plates.
#
# Mapped per-way widths and lane counts are resolved by ``road_geometry``;
# class widths remain only the documented fallback where OSM has no measure.
# Fallback material where OSM has no explicit ``surface``. Explicit path
# surfaces always win: an asphalt cycleway does not become sand merely because
# it crosses a park, and a mapped earth desire line does not become paving at
# the park edge.
ROAD_KINDS: dict[str, str] = {
  "trunk": "asphalt",
  "trunk_link": "asphalt",
  "motorway": "asphalt",
  "motorway_link": "asphalt",
  "primary": "asphalt",
  "primary_link": "asphalt",
  "secondary": "asphalt",
  "secondary_link": "asphalt",
  "tertiary": "asphalt",
  "tertiary_link": "asphalt",
  "residential": "asphalt",
  "unclassified": "asphalt",
  "living_street": "asphalt",
  "service": "asphalt",
  "bridleway": "sand",
  "pedestrian": "paving",
  "cycleway": "paving",
  "footway": "paving",
  "path": "sand",
  "track": "sand",
  "steps": "paving",
}
PATH_HIGHWAYS = frozenset(
  {"bridleway", "cycleway", "footway", "path", "pedestrian", "steps", "track"}
)
ASPHALT_PATH_SURFACES = frozenset({"asphalt", "chipseal"})
PAVING_PATH_SURFACES = frozenset(
  {
    "bricks",
    "cobblestone",
    "concrete",
    "concrete:lanes",
    "concrete:plates",
    "paved",
    "paving_stones",
    "pebblestone",
    "sett",
    "stone",
    "stepping_stones",
    "tactile_paving",
    "unhewn_cobblestone",
  }
)
SAND_PATH_SURFACES = frozenset({"compacted", "fine_gravel", "gravel", "sand", "shells"})
EARTH_PATH_SURFACES = frozenset(
  {
    "clay",
    "dirt",
    "earth",
    "grass",
    "grass_paver",
    "ground",
    "mud",
    "unpaved",
    "woodchips",
  }
)
WOOD_PATH_SURFACES = frozenset({"wood"})
METAL_PATH_SURFACES = frozenset({"metal", "metal_grid", "steel"})
# Classes whose centreline earns a painted lane marking.
MARKED_CLASSES = frozenset({"motorway", "trunk", "primary", "secondary", "tertiary"})
# A road edge is a primary visual line. The former 0.75 m tolerance could turn
# a mapped curve into a row of obvious chords at close zoom. Ten centimetres
# stays below the drawn kerb width while keeping payload growth bounded.
ROAD_SIMPLIFY_M = 0.1
# OSM stores carriageways as surveyed polylines. Consecutive moderate turns are
# samples of one road curve, not intended corners: interpolate through the
# original nodes before buffering so surface, kerb and marking share the same
# continuous centreline. Deliberate turns sharper than this remain untouched.
ROAD_CURVE_CORNER_DEG = 72.0
ROAD_CURVE_SEGMENT_M = 1.5
ROAD_CURVE_MAX_STEPS_PER_EDGE = 48
ROAD_BUFFER_QUAD_SEGS = 16
MIN_ROAD_AREA_M2 = 25.0
# The merged pedestrian/cycle network can become one city-scale polygon with
# more than a thousand holes. Earcut then blocks the browser for seconds even
# though the geometry is valid. Split only that non-kerbed presentation family
# on deterministic metric boundaries; the union and its visible outline stay
# identical, while every triangulation remains bounded.
ROAD_BROWSER_TILE_M = 400.0
ROAD_BROWSER_HOLE_THRESHOLD = 128
# The visible Tiergartentunnel approaches carry eight independently mapped
# carriageways across four portal sites. Keep a real shoulder around each
# authored road rather than cutting exactly on its outer face.
OPEN_TUNNEL_RAMP_APPROACH_M = 8.0
# Payload rings are rounded to decimetres. Expand the final exclusion by two
# decimetres so quantisation cannot move a long boundary back over the ramp.
OPEN_TUNNEL_RAMP_QUANTISATION_GUARD_M = 0.2
# A footway or cycleway that runs inside parkland is a park path and reads
# sandy, wherever OSM classified it. This is what makes the Tiergarten look
# like the Tiergarten instead of a grey street grid dropped on a lawn.
PARK_PATH_KIND = "sand"


def optional_osm_text(value: object) -> str | None:
  """Normalize one optional OSM tag without leaking pandas NaN strings."""
  if value is None or bool(isna(value)):
    return None
  text = str(value).strip().lower()
  return text if text and text not in {"nan", "none"} else None


def road_surface_kind(row: Any, highway: str, in_park: bool) -> str:
  """Resolve the drawn material for one OSM road or path.

  Motor roads retain the established carriageway policy. For walking and
  cycling infrastructure the mapped ``surface`` is stronger evidence than
  land-use context; park context is only the fallback for an untagged path.
  """
  fallback = ROAD_KINDS[highway]
  if highway not in PATH_HIGHWAYS:
    return fallback
  surface = optional_osm_text(row.get("surface"))
  if surface in ASPHALT_PATH_SURFACES:
    return "asphalt"
  if surface in PAVING_PATH_SURFACES:
    return "paving"
  if surface in SAND_PATH_SURFACES:
    return "sand"
  if surface in EARTH_PATH_SURFACES:
    return "earth"
  if surface in WOOD_PATH_SURFACES:
    return "wood"
  if surface in METAL_PATH_SURFACES:
    return "metal"
  if surface is None and in_park:
    return PARK_PATH_KIND
  return fallback


def ring_to_dm(coords: Any) -> list[list[int]]:
  return [
    [round((x - ORIGIN_EASTING) * 10), round((ORIGIN_NORTHING - y) * 10)]
    for x, y in coords
  ]


def partition_road_surface(polygon: Polygon, kind: str) -> list[Polygon]:
  """Bound browser triangulation cost without changing the paved union."""
  if kind != "paving" or len(polygon.interiors) < ROAD_BROWSER_HOLE_THRESHOLD:
    return [polygon]
  minx, miny, maxx, maxy = polygon.bounds
  start_x = math.floor(minx / ROAD_BROWSER_TILE_M) * ROAD_BROWSER_TILE_M
  start_y = math.floor(miny / ROAD_BROWSER_TILE_M) * ROAD_BROWSER_TILE_M
  parts: list[Polygon] = []
  x = start_x
  while x < maxx:
    y = start_y
    while y < maxy:
      clipped = polygon.intersection(
        box(x, y, x + ROAD_BROWSER_TILE_M, y + ROAD_BROWSER_TILE_M)
      )
      parts.extend(
        part for part in polygon_parts(clipped) if part.area >= MIN_ROAD_AREA_M2
      )
      y += ROAD_BROWSER_TILE_M
    x += ROAD_BROWSER_TILE_M
  return parts


def polygon_parts(geometry: BaseGeometry) -> list[Polygon]:
  if isinstance(geometry, Polygon):
    return [geometry]
  if isinstance(geometry, MultiPolygon):
    return list(geometry.geoms)
  return []


def collect_parkland(
  osm_path: Path,
  bounds: BaseGeometry,
  ramp_corridors: BaseGeometry | None = None,
) -> list[dict[str, Any]]:
  """Parkland split into open lawn and planted garden.

  A garden is drawn on top of the lawn in its own tone, so the beds of the
  Rosengarten read as beds between their gravel walks instead of vanishing
  into one green plate.
  """
  frame = gpd.read_file(osm_path, layer="parks").to_crs(epsg=25833)
  water_union = unary_union(
    [feature.geometry for feature in load_water_features(osm_path)]
  )
  surfaces: list[dict[str, Any]] = []
  for _, row in frame.iterrows():
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    clipped = geometry.intersection(bounds)
    if clipped.is_empty:
      continue
    garden = row.get("leisure") == "garden"
    min_area = MIN_GARDEN_AREA_M2 if garden else MIN_PARK_AREA_M2
    simplify_m = GARDEN_SIMPLIFY_M if garden else PARK_SIMPLIFY_M
    for part in polygon_parts(clipped):
      # Simplify the broad park perimeter first, then carve exact water. Doing
      # this in the opposite order lets the 1.2 m lawn tolerance close narrow
      # streams again and makes the opaque grass plate cover their water.
      simplified = part.simplify(simplify_m, preserve_topology=True)
      carved = simplified.difference(water_union)
      if ramp_corridors is not None:
        # The open cuts descend through mapped parkland at Kemperplatz and the
        # Spreebogen. Leaving the lawn untouched roofs those ramps with an
        # opaque green plate even though road and water surfaces were removed.
        carved = carved.difference(ramp_corridors)
      for dry_part in polygon_parts(carved):
        if dry_part.is_empty or dry_part.area < min_area:
          continue
        ring = ring_to_dm(dry_part.exterior.coords)
        if len(ring) < 4:
          continue
        holes = [
          ring_to_dm(interior.coords)
          for interior in dry_part.interiors
          if len(interior.coords) >= 4
        ]
        name = row.get("name")
        surfaces.append(
          {
            "area_m2": round(dry_part.area),
            "holes": holes,
            "kind": "garden" if garden else "lawn",
            "name": name if isinstance(name, str) else "",
            "ring": ring,
          }
        )
  surfaces.sort(key=lambda entry: -entry["area_m2"])
  return surfaces


def collect_scrub_points(
  osm_path: Path, bounds: BaseGeometry, roads: list[dict[str, Any]]
) -> tuple[list[list[int]], dict[str, Any]]:
  """Sample mapped OSM shrub polygons into compact deterministic clumps.

  These are source-backed locations, not random park decoration. A global
  lattice makes regeneration stable across runs and neighbouring polygons; a
  representative point preserves a narrow mapped thicket the lattice misses.
  """
  frame = gpd.read_file(osm_path, layer="vegetation").to_crs(epsg=25833)
  frame = frame[frame["natural"] == "scrub"]
  water_union = unary_union(
    [feature.geometry for feature in load_water_features(osm_path)]
  )
  road_polygons: list[Polygon] = []
  for road in roads:
    if len(road["ring"]) < 4:
      continue
    polygon = Polygon(
      [(x / 10, z / 10) for x, z in road["ring"]],
      [[(x / 10, z / 10) for x, z in hole] for hole in road.get("holes", [])],
    )
    if not polygon.is_valid:
      polygon = polygon.buffer(0)
    road_polygons.extend(polygon_parts(polygon))
  road_index = STRtree(road_polygons)
  points: list[list[int]] = []
  mapped_features = 0
  mapped_area_m2 = 0.0
  seen: set[tuple[int, int]] = set()

  def add_point(point: Point, feature_id: int) -> None:
    if not water_union.is_empty and water_union.covers(point):
      return
    x_dm = round((point.x - ORIGIN_EASTING) * 10)
    z_dm = round((ORIGIN_NORTHING - point.y) * 10)
    key = (x_dm, z_dm)
    if key in seen:
      return
    world_point = Point(x_dm / 10, z_dm / 10)
    if len(road_index.query(world_point, predicate="covered_by")) > 0:
      return
    seen.add(key)
    seed = (
      feature_id * 31 + round(point.x * 10) * 17 + round(point.y * 10) * 13
    ) & 0x7FFFFFFF
    radius_dm = 13 + seed % 11
    height_dm = 9 + (seed // 11) % 12
    points.append([x_dm, z_dm, radius_dm, height_dm, seed % 3])

  for _, row in frame.iterrows():
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    clipped = geometry.intersection(bounds)
    feature_id = int(row.get("id") or 0)
    feature_kept = False
    for part in polygon_parts(clipped):
      if part.is_empty or part.area < MIN_SCRUB_AREA_M2:
        continue
      mapped_area_m2 += part.area
      feature_kept = True
      before = len(points)
      min_x, min_y, max_x, max_y = part.bounds
      x = math.ceil(min_x / SCRUB_SPACING_M) * SCRUB_SPACING_M
      while x <= max_x:
        y = math.ceil(min_y / SCRUB_SPACING_M) * SCRUB_SPACING_M
        while y <= max_y:
          candidate = Point(x, y)
          if part.covers(candidate):
            add_point(candidate, feature_id)
          y += SCRUB_SPACING_M
        x += SCRUB_SPACING_M
      if len(points) == before:
        add_point(part.representative_point(), feature_id)
    if feature_kept:
      mapped_features += 1

  points.sort(key=lambda entry: (entry[1], entry[0]))
  return points, {
    "feature_count": mapped_features,
    "mapped_area_m2": round(mapped_area_m2),
    "point_count": len(points),
    "sampling_spacing_m": SCRUB_SPACING_M,
    "scope": "bounded OSM natural=scrub polygons outside mapped roads and water",
  }


def open_tunnel_ramp_corridors(scene_path: Path) -> BaseGeometry | None:
  """Return narrow cut-outs for each mapped daylight carriageway.

  Every approach in ``scene.json`` is surface-to-mouth and already follows a
  distinct OSM way. Buffering those roads by their own varying widths prevents
  the old 29 m-wide generic strip from deleting unrelated parks, buildings and
  water around the portals.
  """
  payload = json.loads(scene_path.read_text(encoding="utf-8"))
  tunnel = payload.get("tiergartentunnel")
  if not isinstance(tunnel, dict):
    return None
  approaches = tunnel.get("portal_approaches")
  if not isinstance(approaches, dict):
    return None

  def extend_surface_end(ramp: LineString) -> LineString:
    coords = list(ramp.coords)
    first, second = coords[0], coords[1]
    dx = first[0] - second[0]
    dy = first[1] - second[1]
    length = math.hypot(dx, dy) or 1.0
    extension = (
      first[0] + dx / length * OPEN_TUNNEL_RAMP_APPROACH_M,
      first[1] + dy / length * OPEN_TUNNEL_RAMP_APPROACH_M,
    )
    return LineString([extension, *coords])

  corridors: list[BaseGeometry] = []
  for approach in approaches.values():
    if not isinstance(approach, dict):
      continue
    carriageways = approach.get("carriageways")
    if not isinstance(carriageways, list):
      continue
    for carriageway in carriageways:
      if not isinstance(carriageway, dict):
        continue
      raw_points = carriageway.get("points")
      raw_widths = carriageway.get("widths_m")
      if not isinstance(raw_points, list) or len(raw_points) < 2:
        continue
      if not isinstance(raw_widths, list) or len(raw_widths) != len(raw_points):
        continue
      line = LineString(
        [
          (
            ORIGIN_EASTING + float(point[0]),
            ORIGIN_NORTHING - float(point[2]),
          )
          for point in raw_points
          if isinstance(point, list) and len(point) >= 3
        ]
      )
      if not 20.0 <= line.length <= 220.0:
        continue
      # Shapely cannot vary a single line-buffer width, so segment buffers use
      # the larger adjacent width. Their union follows tapered OSM lane counts
      # while retaining a 1.15 m wall/safety shoulder on each side.
      line = extend_surface_end(line)
      coords = list(line.coords)
      widths = [float(raw_widths[0]), *map(float, raw_widths)]
      for index in range(len(coords) - 1):
        segment = LineString(coords[index : index + 2])
        half_width = max(widths[index], widths[index + 1]) / 2 + 1.15
        corridors.append(segment.buffer(half_width, cap_style=3, join_style=2))
  return unary_union(corridors) if corridors else None


def collect_water(
  osm_path: Path, bounds: BaseGeometry, ramp_corridors: BaseGeometry | None
) -> list[dict[str, Any]]:
  """Water polygons carrying the renderer's source-backed water class.

  A river sits at the Spree table; ponds/streams and basins use local terrain,
  but only basins get architectural rims. Without the split park water either
  sinks to the Spree table or acquires invented concrete walls.
  """
  surfaces: list[dict[str, Any]] = []
  for feature in load_water_features(osm_path):
    clipped = feature.geometry.intersection(bounds)
    if ramp_corridors is not None:
      clipped = clipped.difference(ramp_corridors)
    if clipped.is_empty:
      continue
    for part in polygon_parts(clipped):
      simplified = part.simplify(WATER_SIMPLIFY_M, preserve_topology=True)
      # Simplification may bridge a narrow cut by a few centimetres. Portal
      # corridors are a hard visibility contract, so subtraction is the last
      # topology-changing operation before integer quantisation.
      if ramp_corridors is not None:
        simplified = simplified.difference(
          ramp_corridors.buffer(OPEN_TUNNEL_RAMP_QUANTISATION_GUARD_M)
        )
      for safe_part in polygon_parts(simplified):
        min_area = MIN_STREAM_AREA_M2 if feature.kind == "stream" else MIN_WATER_AREA_M2
        if safe_part.is_empty or safe_part.area < min_area:
          continue
        ring = ring_to_dm(safe_part.exterior.coords)
        if len(ring) < 4:
          continue
        holes = [
          ring_to_dm(interior.coords)
          for interior in safe_part.interiors
          if len(interior.coords) >= 4 and Polygon(interior).area >= 1.0
        ]
        surfaces.append(
          {
            "area_m2": round(safe_part.area),
            "holes": holes,
            "kind": feature.kind,
            "name": feature.name,
            "ring": ring,
          }
        )
  surfaces.sort(key=lambda entry: -entry["area_m2"])
  return surfaces


def wall_to_payload(wall: SunkenWall, bounds: BaseGeometry) -> dict[str, Any] | None:
  """A sunken wall as a drawable ring plus the axis it rises along."""
  clipped = wall.geometry.intersection(bounds)
  parts = polygon_parts(clipped)
  if not parts:
    return None
  part = max(parts, key=lambda candidate: candidate.area)
  ring = ring_to_dm(part.exterior.coords)
  if len(ring) < 4:
    return None
  return {
    "area_m2": round(part.area),
    "crest": ring_to_dm([wall.crest_end])[0],
    "foot": ring_to_dm([wall.foot_end])[0],
    "name": wall.name,
    "ring": ring,
    "width_m": round(wall.width_m, 2),
  }


def collect_sunken_walls(
  osm_path: Path, bounds: BaseGeometry, water: list[WaterFeature]
) -> list[dict[str, Any]]:
  walls = [
    payload
    for wall in derive_sunken_walls(osm_path, water)
    if (payload := wall_to_payload(wall, bounds)) is not None
  ]
  walls.sort(key=lambda entry: -entry["area_m2"])
  return walls


def line_parts(geometry: BaseGeometry) -> list[LineString]:
  if isinstance(geometry, LineString):
    return [geometry]
  if isinstance(geometry, MultiLineString):
    return list(geometry.geoms)
  return []


def smooth_road_line(line: LineString) -> LineString:
  """Interpolate a road through its mapped nodes without moving any node.

  OSM curve nodes are sparse enough that buffering the raw chords leaves
  visible elbows. A clamped cubic Hermite curve follows the angle bisector at
  moderate turns and retains deliberate built corners. Tangent magnitudes use
  the shorter adjacent edge, preventing a long segment beside a short one
  from overshooting its mapped envelope.
  """
  raw = [(float(x), float(y)) for x, y, *_ in line.coords]
  if len(raw) < 3:
    return line
  closed = math.hypot(raw[0][0] - raw[-1][0], raw[0][1] - raw[-1][1]) <= 1e-6
  if closed:
    raw.pop()
  points: list[tuple[float, float]] = []
  for point in raw:
    if (
      not points
      or math.hypot(point[0] - points[-1][0], point[1] - points[-1][1]) > 1e-6
    ):
      points.append(point)
  count = len(points)
  if count < 2:
    return line
  if count < 3:
    return LineString([*points, points[0]] if closed and points else points)

  edge_count = count if closed else count - 1
  lengths: list[float] = []
  units: list[tuple[float, float]] = []
  for index in range(edge_count):
    ax, ay = points[index]
    bx, by = points[(index + 1) % count]
    run = math.hypot(bx - ax, by - ay)
    if run <= 1e-9:
      return line
    lengths.append(run)
    units.append(((bx - ax) / run, (by - ay) / run))

  corner_cos = math.cos(math.radians(ROAD_CURVE_CORNER_DEG))
  corners = [False] * count
  tangents: list[tuple[float, float]] = [(0.0, 0.0)] * count
  for index in range(count):
    if not closed and index == 0:
      tangents[index] = units[0]
      continue
    if not closed and index == count - 1:
      tangents[index] = units[-1]
      continue
    previous = (index - 1) % edge_count
    following = index % edge_count
    ux0, uy0 = units[previous]
    ux1, uy1 = units[following]
    corners[index] = ux0 * ux1 + uy0 * uy1 < corner_cos
    tx = ux0 + ux1
    ty = uy0 + uy1
    span = math.hypot(tx, ty)
    tangents[index] = units[following] if span <= 1e-9 else (tx / span, ty / span)

  output: list[tuple[float, float]] = []
  for index in range(edge_count):
    next_index = (index + 1) % count
    ax, ay = points[index]
    bx, by = points[next_index]
    ux, uy = units[index]
    output.append((ax, ay))
    start_x, start_y = units[index] if corners[index] else tangents[index]
    end_x, end_y = units[index] if corners[next_index] else tangents[next_index]
    if (
      abs(start_x - ux) < 1e-9
      and abs(start_y - uy) < 1e-9
      and abs(end_x - ux) < 1e-9
      and abs(end_y - uy) < 1e-9
    ):
      continue
    previous_length = (
      lengths[(index - 1) % edge_count] if closed or index > 0 else lengths[index]
    )
    next_length = (
      lengths[(index + 1) % edge_count]
      if closed or index + 1 < edge_count
      else lengths[index]
    )
    start_scale = min(lengths[index], previous_length)
    end_scale = min(lengths[index], next_length)
    steps = min(
      ROAD_CURVE_MAX_STEPS_PER_EDGE,
      max(1, math.ceil(lengths[index] / ROAD_CURVE_SEGMENT_M)),
    )
    for step in range(1, steps):
      t = step / steps
      tt = t * t
      ttt = tt * t
      h00 = 2 * ttt - 3 * tt + 1
      h10 = ttt - 2 * tt + t
      h01 = -2 * ttt + 3 * tt
      h11 = ttt - tt
      output.append(
        (
          h00 * ax + h10 * start_scale * start_x + h01 * bx + h11 * end_scale * end_x,
          h00 * ay + h10 * start_scale * start_y + h01 * by + h11 * end_scale * end_y,
        )
      )
  if not closed:
    output.append(points[-1])
  elif output:
    output.append(output[0])
  smoothed = LineString(output)
  return smoothed if smoothed.is_simple else line


def line_to_dm(coords: Any) -> list[list[int]]:
  return [
    [round((x - ORIGIN_EASTING) * 10), round((ORIGIN_NORTHING - y) * 10)]
    for x, y in coords
  ]


def runs_underground(row: Any) -> bool:
  """True for a way that is roofed over or below grade at this point.

  A buffered centreline knows nothing about the third dimension, so without
  this the Tiergartentunnel is painted straight across the park between the
  Swiss embassy and the Hauptbahnhof. Only the portals stay visible, and
  those carry their own geometry.
  """
  for key in ("tunnel", "covered"):
    value = row.get(key)
    if isinstance(value, str) and value not in {"", "no"}:
      return True
  layer = row.get("layer")
  if isinstance(layer, str) and layer.lstrip("-").isdigit():
    return int(layer) < 0
  return False


def collect_roads(
  osm_path: Path,
  bounds: BaseGeometry,
  parkland: BaseGeometry | None,
  ramp_corridors: BaseGeometry | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], dict[str, Any]]:
  """Buffer OSM highway centrelines into drawn carriageway polygons.

  Returns the surface polygons and, separately, the centrelines of the
  classes that carry a painted lane marking, so the viewer can stroke them
  as dashes instead of inventing markings from the polygon.
  """
  frame = gpd.read_file(osm_path, layer="roads").to_crs(epsg=25833)
  by_kind: dict[str, list[Polygon]] = {}
  markings: list[dict[str, Any]] = []
  path_by_highway: dict[str, int] = {}
  path_by_surface: dict[str, int] = {}
  path_by_material: dict[str, int] = {}
  path_source_features = 0
  path_surface_mapped = 0
  path_width_mapped = 0
  for _, row in frame.iterrows():
    highway = row.get("highway")
    if not isinstance(highway, str):
      continue
    # A tunnelled or covered way runs UNDER the city. Buffering it into a
    # surface plate roofed the Tiergartentunnel troughs over and hid the
    # portal bores behind flat paving — the exact opposite of "man muss
    # tief hineinschauen können". The open ramps are their own drawn
    # geometry (TunnelPortals.ts); the surface keeps only surface roads.
    tunnel = row.get("tunnel")
    covered = row.get("covered")
    if (isinstance(tunnel, str) and tunnel not in ("", "no")) or (
      isinstance(covered, str) and covered not in ("", "no")
    ):
      continue
    width = road_width_m(row)
    if width is None:
      continue
    if runs_underground(row):
      continue
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    clipped = geometry.intersection(bounds)
    if ramp_corridors is not None:
      clipped = clipped.difference(ramp_corridors)
    if clipped.is_empty:
      continue
    for line in line_parts(clipped):
      if line.length < 2.0:
        continue
      curved_line = smooth_road_line(line)
      in_park = (
        parkland is not None
        and parkland.intersects(curved_line)
        and curved_line.intersection(parkland).length > curved_line.length * 0.5
      )
      resolved = road_surface_kind(row, highway, in_park)
      if highway in PATH_HIGHWAYS:
        path_source_features += 1
        path_by_highway[highway] = path_by_highway.get(highway, 0) + 1
        source_surface = optional_osm_text(row.get("surface"))
        if source_surface is not None:
          path_surface_mapped += 1
          path_by_surface[source_surface] = path_by_surface.get(source_surface, 0) + 1
        if (
          optional_osm_text(row.get("width")) is not None
          or optional_osm_text(row.get("est_width")) is not None
        ):
          path_width_mapped += 1
        path_by_material[resolved] = path_by_material.get(resolved, 0) + 1
      # flat caps: a buffered centreline must not bulge into a lollipop at
      # every junction, which is what round caps do on a 4 000-segment net.
      band = curved_line.buffer(
        width / 2,
        cap_style=2,
        join_style=1,
        quad_segs=ROAD_BUFFER_QUAD_SEGS,
      )
      # Subtract again after buffering: a nearby centreline can have its
      # centre outside the corridor while its wide carriageway still reaches
      # across the daylight trough.
      if ramp_corridors is not None:
        band = band.difference(ramp_corridors)
      if band.is_empty:
        continue
      by_kind.setdefault(resolved, []).append(band)
      if highway in MARKED_CLASSES and curved_line.length >= 25.0:
        simplified = curved_line.simplify(ROAD_SIMPLIFY_M, preserve_topology=True)
        points = line_to_dm(simplified.coords)
        if len(points) >= 2:
          markings.append(
            {
              "name": row.get("name") if isinstance(row.get("name"), str) else "",
              "points": points,
              "width_m": round(width, 2),
            }
          )

  surfaces: list[dict[str, Any]] = []
  for kind, bands in by_kind.items():
    merged = unary_union(bands)
    for part in polygon_parts(merged):
      simplified = part.simplify(ROAD_SIMPLIFY_M, preserve_topology=True)
      if ramp_corridors is not None:
        simplified = simplified.difference(
          ramp_corridors.buffer(OPEN_TUNNEL_RAMP_QUANTISATION_GUARD_M)
        )
      for safe_part in polygon_parts(simplified):
        if safe_part.is_empty or safe_part.area < MIN_ROAD_AREA_M2:
          continue
        for browser_part in partition_road_surface(safe_part, kind):
          ring = ring_to_dm(browser_part.exterior.coords)
          if len(ring) < 4:
            continue
          # Sliver holes are what a buffered road network produces wherever
          # two carriageways graze each other, and a hole with no real area
          # makes the viewer's ear-clipping triangulator throw. Keep only
          # holes that enclose at least a square metre.
          holes = [
            ring_to_dm(interior.coords)
            for interior in browser_part.interiors
            if len(interior.coords) >= 4 and Polygon(interior).area >= 1.0
          ]
          surfaces.append(
            {
              "area_m2": round(browser_part.area),
              "holes": holes,
              "kind": kind,
              "name": "",
              "ring": ring,
            }
          )
  surfaces.sort(key=lambda entry: -entry["area_m2"])
  markings.sort(key=lambda entry: -len(entry["points"]))
  path_inventory = {
    "by_highway": dict(sorted(path_by_highway.items())),
    "by_resolved_material": dict(sorted(path_by_material.items())),
    "by_surface": dict(sorted(path_by_surface.items())),
    "line_parts": path_source_features,
    "mapped_surface_line_parts": path_surface_mapped,
    "mapped_width_line_parts": path_width_mapped,
    "scope": "bounded above-ground OSM path geometry",
  }
  return surfaces, markings, path_inventory


def build_payload(
  bounds_path: Path, osm_path: Path, scene_path: Path
) -> dict[str, Any]:
  verify_scene_origin(scene_path)
  bounds = project_geometry(load_bounds_polygon(bounds_path))
  parks = gpd.read_file(osm_path, layer="parks").to_crs(epsg=25833)
  parkland = unary_union(
    [g for g in parks.geometry if g is not None and not g.is_empty]
  )
  ramp_corridors = open_tunnel_ramp_corridors(scene_path)
  roads, markings, path_inventory = collect_roads(
    osm_path, bounds, parkland, ramp_corridors
  )
  scrub_points, scrub_inventory = collect_scrub_points(osm_path, bounds, roads)
  return {
    "lane_markings": markings,
    "path_inventory": path_inventory,
    "park_simplify_m": PARK_SIMPLIFY_M,
    "parks": collect_parkland(osm_path, bounds, ramp_corridors),
    "road_simplify_m": ROAD_SIMPLIFY_M,
    "road_curve_corner_deg": ROAD_CURVE_CORNER_DEG,
    "road_curve_segment_m": ROAD_CURVE_SEGMENT_M,
    "road_buffer_quad_segs": ROAD_BUFFER_QUAD_SEGS,
    "road_width_policy": "width > est_width > mapped lanes > highway-class fallback",
    "road_widths_m": ROAD_WIDTHS_M,
    "road_surface_policy": (
      "explicit OSM path surface > park-context fallback > highway-class fallback"
    ),
    "roads": roads,
    "schema_version": SCHEMA_VERSION,
    "scrub_inventory": scrub_inventory,
    "scrub_points": scrub_points,
    "simplify_m": WATER_SIMPLIFY_M,
    "source": ATTRIBUTION,
    "sunken_walls": collect_sunken_walls(
      osm_path, bounds, load_water_features(osm_path)
    ),
    "water": collect_water(osm_path, bounds, ramp_corridors),
  }


def main(argv: list[str] | None = None) -> None:
  parser = argparse.ArgumentParser(
    description="Export smooth OSM water/parkland polygons for the viewer."
  )
  parser.add_argument("--bounds", type=Path, default=DEFAULT_BOUNDS)
  parser.add_argument("--osm", type=Path, default=DEFAULT_OSM)
  parser.add_argument("--scene", type=Path, default=DEFAULT_SCENE)
  parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
  args = parser.parse_args(argv)

  payload = build_payload(args.bounds, args.osm, args.scene)
  args.out.write_text(
    json.dumps(payload, separators=(",", ":"), sort_keys=True) + "\n",
    encoding="utf-8",
  )
  size = args.out.stat().st_size
  from collections import Counter

  kinds = Counter(entry["kind"] for entry in payload["roads"])
  basins = sum(1 for entry in payload["water"] if entry["kind"] == "basin")
  print(
    f"Wrote {args.out} ({size / 1024:.0f} KiB) with "
    f"{len(payload['water'])} water ({basins} basins), "
    f"{len(payload['parks'])} park, "
    f"{len(payload['scrub_points'])} scrub clumps, "
    f"{len(payload['roads'])} road polygons ({dict(kinds)}), "
    f"{len(payload['sunken_walls'])} sunken walls and "
    f"{len(payload['lane_markings'])} lane markings"
  )


if __name__ == "__main__":
  main()
