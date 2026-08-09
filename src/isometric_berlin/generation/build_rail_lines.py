"""Export the aboveground railway as a drawable viaduct for the viewer.

Until now the drawn city had no railway at all. The only tracks in it
belonged to the Hauptbahnhof recognition model, which carries its own
541 m deck: the 321 m train shed plus 110 m of straight approach at each
end. Everything beyond that simply stopped, so the Stadtbahn ended in
mid-air over the Humboldthafen.

Worse, the straight approach is only true to the west. Measured against
the OSM alignment the model deck sits 2 m off the real tracks 100 m east
of the shed, 46 m off at 200 m and **84 m off** at its eastern tip — the
Stadtbahn curves away towards Friedrichstraße the moment it leaves the
shed, and the model kept going straight. The east stub was therefore not
only unfinished, it pointed at empty air.

This module exports the real thing from OSM: the corridor the tracks run
in, the track centrelines inside it, and the pier positions along its
edges. Two families come out of it, because they are drawn differently:

``viaduct``
    Carried structure — ``bridge=yes``/``viaduct`` or a positive
    ``layer``. Drawn as a deck plate on piers at a constant height.
``embankment``
    Track at grade. Drawn as a ballast strip that follows the terrain.

The deck runs at ONE height across the map. Real track does fall away
from the Hauptbahnhof's upper level towards Friedrichstraße, but OSM
carries no rail elevation and the mapped stretch is short enough that a
level deck is the honest simplification — inventing a gradient would be
inventing survey data. The height itself is not invented: it is read
from the station signature in ``scene.json`` so the exported deck and
the model's own deck are the same table, minus a clearance that lets the
model's opaque deck cover the corridor inside the shed.

Rings and paths are decimetre integers in viewer world coordinates:
``world_x = easting − 389500``, ``world_z = 5820000 − northing``.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
from shapely.geometry import (
  LineString,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
)
from shapely.geometry.base import BaseGeometry
from shapely.ops import linemerge, unary_union

from isometric_berlin.data.common import load_bounds_polygon, project_geometry
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

DEFAULT_OSM = REPO_ROOT / "geo_data/regierungsviertel/osm.gpkg"
DEFAULT_OUT = MESH_PUBLIC_DIR / "rail-lines.json"
SCHEMA_VERSION = 1

# Track classes that carry trains. Trams run in the street surface and are
# drawn by the road pipeline; subway and disused/razed alignments are not
# drawn at all.
TRACK_CLASSES = frozenset({"rail", "light_rail"})

# Half the drawn corridor around a single track centreline. Real standard
# gauge plus its structure gauge is about 4.5 m, and Berlin's parallel
# tracks sit roughly 4.5 m apart, so 3.4 m merges a parallel bundle into
# one deck without inflating a lone siding into a plaza.
TRACK_HALF_WIDTH_M = 3.4
RAIL_SIMPLIFY_M = 1.0
MIN_CORRIDOR_AREA_M2 = 45.0
# Only a chain long enough to read as a line gets drawn rails; the yard
# stubs and crossovers stay as bare deck.
MIN_DRAWN_TRACK_M = 60.0

# The station model's deck box is 1.1 m thick and centred at local y 9.8,
# so its top face is 10.35 m over the model anchor.
STATION_DECK_TOP_LOCAL_M = 10.35
# The exported deck sits this far under the model's deck so that inside
# the train shed the model's own opaque deck covers it instead of
# z-fighting with it. Large enough to also swallow the exported rails.
DECK_CLEARANCE_M = 0.45
RAIL_TOP_OVER_DECK_M = 0.2

# Piers march along the visible edges of the deck. 24 m is the ordinary
# span of the Stadtbahn's brick viaduct arches.
PIER_SPACING_M = 24.0
PIER_INSET_M = 1.5


def ring_to_dm(coords: Any) -> list[list[int]]:
  return [
    [round((x - ORIGIN_EASTING) * 10), round((ORIGIN_NORTHING - y) * 10)]
    for x, y in coords
  ]


def polygon_parts(geometry: BaseGeometry) -> list[Polygon]:
  if isinstance(geometry, Polygon):
    return [geometry]
  if isinstance(geometry, MultiPolygon):
    return list(geometry.geoms)
  return []


def line_parts(geometry: BaseGeometry) -> list[LineString]:
  if isinstance(geometry, LineString):
    return [geometry]
  if isinstance(geometry, MultiLineString):
    return list(geometry.geoms)
  return []


def as_layer(value: Any) -> int:
  """OSM ``layer`` as an integer; anything unparseable counts as grade."""
  text = str(value).strip()
  if text.lstrip("-").isdigit():
    return int(text)
  return 0


def runs_underground(row: Any) -> bool:
  """True for track in a tunnel, under a lid, or below grade."""
  for key in ("tunnel", "covered"):
    value = row.get(key)
    if isinstance(value, str) and value not in {"", "no"}:
      return True
  return as_layer(row.get("layer")) < 0


def is_carried(row: Any) -> bool:
  """True where the track is carried over the ground it crosses."""
  bridge = row.get("bridge")
  if isinstance(bridge, str) and bridge not in {"", "no"}:
    return True
  return as_layer(row.get("layer")) > 0


def station_deck_top_m(scene_path: Path) -> float:
  """The top of the Hauptbahnhof model's own track deck, in world metres."""
  scene = json.loads(scene_path.read_text(encoding="utf-8"))
  for signature in scene.get("architectural_signatures", []):
    if signature.get("kind") == "hauptbahnhof_model":
      return float(signature["anchor_world"][1]) + STATION_DECK_TOP_LOCAL_M
  raise ValueError("scene.json carries no hauptbahnhof_model signature")


def collect_tracks(
  osm_path: Path, bounds: BaseGeometry
) -> tuple[list[LineString], list[LineString]]:
  """Aboveground track centrelines, split into carried and at grade."""
  frame = gpd.read_file(osm_path, layer="rail").to_crs(epsg=25833)
  carried: list[LineString] = []
  grade: list[LineString] = []
  for _, row in frame.iterrows():
    if row.get("railway") not in TRACK_CLASSES:
      continue
    if runs_underground(row):
      continue
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    clipped = geometry.intersection(bounds)
    if clipped.is_empty:
      continue
    target = carried if is_carried(row) else grade
    for line in line_parts(clipped):
      if line.length >= 1.0:
        target.append(line)
  return carried, grade


def corridor_polygons(lines: list[LineString]) -> list[dict[str, Any]]:
  """Buffer a bundle of centrelines into the corridor it occupies."""
  if not lines:
    return []
  bands = [line.buffer(TRACK_HALF_WIDTH_M, cap_style=2, join_style=1) for line in lines]
  merged = unary_union(bands)
  surfaces: list[dict[str, Any]] = []
  for part in polygon_parts(merged):
    simplified = part.simplify(RAIL_SIMPLIFY_M, preserve_topology=True)
    if simplified.is_empty or simplified.area < MIN_CORRIDOR_AREA_M2:
      continue
    ring = ring_to_dm(simplified.exterior.coords)
    if len(ring) < 4:
      continue
    holes = [
      ring_to_dm(interior.coords)
      for interior in simplified.interiors
      if len(interior.coords) >= 4 and Polygon(interior).area >= 1.0
    ]
    surfaces.append(
      {
        "area_m2": round(simplified.area),
        "holes": holes,
        "ring": ring,
      }
    )
  surfaces.sort(key=lambda entry: -entry["area_m2"])
  return surfaces


def drawn_track_paths(lines: list[LineString]) -> list[list[list[int]]]:
  """Centrelines long enough to be worth stroking as a pair of rails."""
  if not lines:
    return []
  merged = linemerge(unary_union(lines))
  paths: list[list[list[int]]] = []
  for chain in line_parts(merged):
    if chain.length < MIN_DRAWN_TRACK_M:
      continue
    simplified = chain.simplify(RAIL_SIMPLIFY_M, preserve_topology=True)
    points = ring_to_dm(simplified.coords)
    if len(points) >= 2:
      paths.append(points)
  paths.sort(key=lambda path: -len(path))
  return paths


def pier_points(corridors: list[dict[str, Any]]) -> list[list[int]]:
  """Pier feet marching along the visible edges of the deck.

  Piers follow the corridor OUTLINE rather than the track centrelines: a
  four-track bundle needs a row of piers down each side of its deck, not
  four rows hidden under it.
  """
  piers: list[list[int]] = []
  for corridor in corridors:
    # The corridor ring is already decimetres in the world frame, so the
    # pier feet stay in that frame too — no second projection.
    ring = [(x, z) for x, z in corridor["ring"]]
    if len(ring) < 4:
      continue
    outline = LineString(ring)
    if outline.length < PIER_SPACING_M * 10:
      continue
    polygon = Polygon(ring)
    steps = max(1, int(outline.length // (PIER_SPACING_M * 10)))
    for index in range(steps):
      here = (index + 0.5) / steps
      point = outline.interpolate(here, normalized=True)
      ahead = outline.interpolate(min(1.0, here + 0.002), normalized=True)
      dx = ahead.x - point.x
      dz = ahead.y - point.y
      length = math.hypot(dx, dz)
      if length < 1e-6:
        continue
      # Step along the outline normal so the pier stands under the deck
      # rather than beside it; whichever side lands inside is the inside.
      nx = -dz / length * PIER_INSET_M * 10
      nz = dx / length * PIER_INSET_M * 10
      for sign in (1.0, -1.0):
        foot = Point(point.x + nx * sign, point.y + nz * sign)
        if polygon.contains(foot):
          piers.append([round(foot.x), round(foot.y)])
          break
  return piers


def build_payload(
  bounds_path: Path, osm_path: Path, scene_path: Path
) -> dict[str, Any]:
  verify_scene_origin(scene_path)
  bounds = project_geometry(load_bounds_polygon(bounds_path))
  carried, grade = collect_tracks(osm_path, bounds)

  deck_top = station_deck_top_m(scene_path) - DECK_CLEARANCE_M
  viaduct = corridor_polygons(carried)
  return {
    "deck_top_y_m": round(deck_top, 3),
    "embankment": corridor_polygons(grade),
    "embankment_tracks": drawn_track_paths(grade),
    "pier_spacing_m": PIER_SPACING_M,
    "piers": pier_points(viaduct),
    "rail_top_over_deck_m": RAIL_TOP_OVER_DECK_M,
    "schema_version": SCHEMA_VERSION,
    "simplify_m": RAIL_SIMPLIFY_M,
    "source": ATTRIBUTION,
    "track_half_width_m": TRACK_HALF_WIDTH_M,
    "viaduct": viaduct,
    "viaduct_tracks": drawn_track_paths(carried),
  }


def main(argv: list[str] | None = None) -> None:
  parser = argparse.ArgumentParser(
    description="Export the aboveground OSM railway for the drawn viewer."
  )
  parser.add_argument("--bounds", type=Path, default=DEFAULT_BOUNDS)
  parser.add_argument("--osm", type=Path, default=DEFAULT_OSM)
  parser.add_argument("--scene", type=Path, default=DEFAULT_SCENE)
  parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
  args = parser.parse_args(argv)

  payload = build_payload(args.bounds, args.osm, args.scene)
  args.out.parent.mkdir(parents=True, exist_ok=True)
  args.out.write_text(
    json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
    encoding="utf-8",
  )
  print(
    f"wrote {args.out} "
    f"({len(payload['viaduct'])} viaduct, {len(payload['embankment'])} embankment, "
    f"{len(payload['piers'])} piers, deck top {payload['deck_top_y_m']} m)"
  )


if __name__ == "__main__":
  main()
