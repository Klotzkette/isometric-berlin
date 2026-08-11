"""Export the mapped railway and underground passenger network for the viewer.

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

Underground plan courses, platforms and entrances come from the same committed
OSM extract. OSM does not provide a surveyed vertical alignment or tunnel
cross-section, so exported depths are deliberately coarse layer-based
approximations. The payload labels that distinction explicitly; it never
pretends the cutaway is engineering survey data and it contains no invented
utility network.

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
SCHEMA_VERSION = 2

# Track classes that carry trains. Trams run in the street surface and are
# drawn by the road pipeline; subway and disused/razed alignments are not
# drawn at all.
TRACK_CLASSES = frozenset({"rail", "light_rail"})
UNDERGROUND_TRACK_CLASSES = frozenset({"rail", "light_rail", "subway"})
UNDERGROUND_PLATFORM_CLASSES = frozenset({"platform", "platform_edge"})
TRAM_TRACK_CLASS = "tram"

# OSM `layer` gives ordering, not an elevation. These values intentionally
# remain broad, legible cutaway levels and are exported with an approximation
# warning. The surface datum matches the drawn ground near the central city.
SURFACE_REFERENCE_Y_M = 5.2
DEPTH_BY_LAYER_M = {-5: 28.0, -4: 23.0, -3: 18.0, -2: 13.0, -1: 8.0}
DEFAULT_UNDERGROUND_DEPTH_M = 8.0

# Route guides are used only to attach a human-readable family to real OSM
# ways. Every rendered point still comes from that OSM way. The guides follow
# the official station sequence and are deliberately generous enough to catch
# parallel running tunnels without snapping or replacing their geometry.
U5_GUIDE_WORLD = (
  (-75.0, -715.0),
  (105.0, -138.0),
  (660.0, 280.0),
  (1_190.0, 242.0),
)
NORTH_SOUTH_SBAHN_GUIDE_WORLD = (
  (1_040.0, -155.0),
  (650.0, 275.0),
  (280.0, 1_110.0),
  (640.0, 1_730.0),
)
ROUTE_GUIDE_BUFFER_M = 42.0
ROUTE_GUIDE_OVERLAP = 0.55

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


def world_guide(points: tuple[tuple[float, float], ...]) -> LineString:
  """A world-x/world-z guide converted back to EPSG:25833."""
  return LineString(
    [
      (ORIGIN_EASTING + world_x, ORIGIN_NORTHING - world_z)
      for world_x, world_z in points
    ]
  )


U5_GUIDE = world_guide(U5_GUIDE_WORLD)
NORTH_SOUTH_SBAHN_GUIDE = world_guide(NORTH_SOUTH_SBAHN_GUIDE_WORLD)


def guide_overlap(line: LineString, guide: LineString) -> float:
  if line.length <= 0:
    return 0.0
  return line.intersection(guide.buffer(ROUTE_GUIDE_BUFFER_M)).length / line.length


def underground_family(line: LineString, railway: str, service: Any) -> str:
  """Classify a real underground OSM line without moving its geometry."""
  if railway == "subway" and guide_overlap(line, U5_GUIDE) >= ROUTE_GUIDE_OVERLAP:
    return "u5"
  if (
    railway == "light_rail"
    and guide_overlap(line, NORTH_SOUTH_SBAHN_GUIDE) >= ROUTE_GUIDE_OVERLAP
  ):
    return (
      "north_south_sbahn_service" if str(service) == "yard" else "north_south_sbahn"
    )
  if railway == "subway":
    return "subway"
  if railway == "light_rail":
    return "s_bahn"
  return "mainline"


def underground_depth_m(layer: Any) -> float:
  """Schematic depth inferred from OSM vertical-order metadata."""
  parsed = as_layer(layer)
  if parsed >= 0:
    return DEFAULT_UNDERGROUND_DEPTH_M
  return DEPTH_BY_LAYER_M.get(parsed, DEFAULT_UNDERGROUND_DEPTH_M + abs(parsed + 1) * 5)


def source_ref(row: Any) -> str:
  return f"{row.get('element', 'way')}/{row.get('id')}"


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


def simplified_path(line: LineString) -> list[list[int]]:
  simplified = line.simplify(RAIL_SIMPLIFY_M, preserve_topology=True)
  return ring_to_dm(simplified.coords)


def collect_underground_network(
  osm_path: Path, bounds: BaseGeometry
) -> tuple[
  list[dict[str, Any]],
  list[dict[str, Any]],
  list[dict[str, Any]],
  list[dict[str, Any]],
]:
  """Real OSM underground tracks/platforms/entrances and surface trams.

  The returned plan geometry is source geometry. Only ``depth_m`` and the
  implied vertical connection from an entrance to its nearest track are
  schematic, which is stated again in every relevant payload section.
  """
  frame = gpd.read_file(osm_path, layer="rail").to_crs(epsg=25833)
  track_records: list[tuple[dict[str, Any], LineString]] = []
  tram_tracks: list[dict[str, Any]] = []

  for _, row in frame.iterrows():
    railway = str(row.get("railway"))
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    clipped = geometry.intersection(bounds)
    if clipped.is_empty:
      continue
    if railway == TRAM_TRACK_CLASS and not runs_underground(row):
      for part_index, line in enumerate(line_parts(clipped)):
        if line.length < 3.0:
          continue
        tram_tracks.append(
          {
            "id": f"{source_ref(row)}:{part_index}",
            "points": simplified_path(line),
          }
        )
      continue
    if railway not in UNDERGROUND_TRACK_CLASSES or not runs_underground(row):
      continue
    depth = underground_depth_m(row.get("layer"))
    for part_index, line in enumerate(line_parts(clipped)):
      if line.length < 2.0:
        continue
      points = simplified_path(line)
      if len(points) < 2:
        continue
      entry = {
        "depth_m": depth,
        "id": f"{source_ref(row)}:{part_index}",
        "layer": as_layer(row.get("layer")),
        "line_family": underground_family(line, railway, row.get("service")),
        "name": str(row.get("name")) if isinstance(row.get("name"), str) else "",
        "points": points,
        "railway": railway,
        "service": str(row.get("service"))
        if isinstance(row.get("service"), str)
        else "",
        "track_y_m": round(SURFACE_REFERENCE_Y_M - depth, 2),
      }
      track_records.append((entry, line))

  platforms: list[dict[str, Any]] = []
  platform_geometries: list[tuple[dict[str, Any], BaseGeometry]] = []
  for _, row in frame.iterrows():
    if row.get("railway") not in UNDERGROUND_PLATFORM_CLASSES:
      continue
    if not runs_underground(row):
      continue
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    clipped = geometry.intersection(bounds)
    if clipped.is_empty:
      continue
    nearest = min(
      track_records,
      key=lambda record: clipped.distance(record[1]),
      default=None,
    )
    if nearest is None or clipped.distance(nearest[1]) > 35.0:
      continue
    nearest_entry = nearest[0]
    area_geometry = (
      clipped.buffer(2.2, cap_style=2)
      if isinstance(clipped, (LineString, MultiLineString))
      else clipped
    )
    for part_index, polygon in enumerate(polygon_parts(area_geometry)):
      if polygon.area < 4.0:
        continue
      centre = polygon.centroid
      entry = {
        "centre": ring_to_dm([(centre.x, centre.y)])[0],
        "id": f"{source_ref(row)}:{part_index}",
        "line_family": nearest_entry["line_family"],
        "name": str(row.get("name")) if isinstance(row.get("name"), str) else "",
        "ring": ring_to_dm(
          polygon.simplify(0.35, preserve_topology=True).exterior.coords
        ),
        "track_y_m": nearest_entry["track_y_m"],
      }
      platforms.append(entry)
      platform_geometries.append((entry, polygon))

  entrances: list[dict[str, Any]] = []
  for _, row in frame.iterrows():
    if row.get("railway") != "subway_entrance":
      continue
    geometry = row.geometry
    if not isinstance(geometry, Point) or geometry.is_empty:
      continue
    if not bounds.covers(geometry):
      continue
    nearest_track = min(
      track_records,
      key=lambda record: geometry.distance(record[1]),
      default=None,
    )
    if nearest_track is None or geometry.distance(nearest_track[1]) > 180.0:
      continue
    nearest_platform = min(
      platform_geometries,
      key=lambda record: geometry.distance(record[1]),
      default=None,
    )
    platform_name = ""
    if nearest_platform and geometry.distance(nearest_platform[1]) <= 180.0:
      platform_name = nearest_platform[0]["name"]
    point = ring_to_dm([(geometry.x, geometry.y)])[0]
    entrances.append(
      {
        "connects_to": platform_name,
        "id": source_ref(row),
        "line_family": nearest_track[0]["line_family"],
        "name": str(row.get("name")) if isinstance(row.get("name"), str) else "",
        "point": point,
        "track_y_m": nearest_track[0]["track_y_m"],
      }
    )

  tracks = [entry for entry, _ in track_records]
  tracks.sort(key=lambda entry: (entry["line_family"], entry["id"]))
  platforms.sort(key=lambda entry: (entry["name"], entry["id"]))
  entrances.sort(key=lambda entry: (entry["connects_to"], entry["id"]))
  tram_tracks.sort(key=lambda entry: entry["id"])
  return tracks, platforms, entrances, tram_tracks


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
  underground, platforms, entrances, tram_tracks = collect_underground_network(
    osm_path, bounds
  )

  deck_top = station_deck_top_m(scene_path) - DECK_CLEARANCE_M
  viaduct = corridor_polygons(carried)
  return {
    "deck_top_y_m": round(deck_top, 3),
    "embankment": corridor_polygons(grade),
    "embankment_tracks": drawn_track_paths(grade),
    "pier_spacing_m": PIER_SPACING_M,
    "piers": pier_points(viaduct),
    "rail_top_over_deck_m": RAIL_TOP_OVER_DECK_M,
    "route_evidence": {
      "north_south_sbahn": {
        "official_sequence": [
          "Friedrichstraße",
          "Brandenburger Tor",
          "Potsdamer Platz",
          "Anhalter Bahnhof",
        ],
        "services": ["S1", "S2", "S25", "S26"],
        "source": "https://sbahn.berlin/fahren/s1/",
      },
      "u5": {
        "official_sequence": [
          "Hauptbahnhof",
          "Bundestag",
          "Brandenburger Tor",
          "Unter den Linden",
        ],
        "services": ["U5"],
        "source": (
          "https://www.bvg.de/dam/"
          "jcr%3A1a9bdb27-dd81-45ab-b552-26ebb6cefaf4/"
          "U5_2025-12-14.pdf"
        ),
      },
    },
    "schema_version": SCHEMA_VERSION,
    "simplify_m": RAIL_SIMPLIFY_M,
    "source": ATTRIBUTION,
    "track_half_width_m": TRACK_HALF_WIDTH_M,
    "tram_catenary": {
      "geometry_status": (
        "OSM tram plan courses; 5.8 m contact-wire height and 35 m mast "
        "spacing are presentation approximations"
      ),
      "tracks": tram_tracks,
    },
    "underground": {
      "entrances": entrances,
      "geometry_status": (
        "Track, platform and entrance plan positions are from committed OSM; "
        "depths, tunnel cross-sections and straight vertical entrance "
        "connections are schematic layer-based approximations, not survey data"
      ),
      "platforms": platforms,
      "surface_reference_y_m": SURFACE_REFERENCE_Y_M,
      "tracks": underground,
      "utility_networks_included": False,
    },
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
    f"{len(payload['piers'])} piers, "
    f"{len(payload['underground']['tracks'])} underground track parts, "
    f"deck top {payload['deck_top_y_m']} m)"
  )


if __name__ == "__main__":
  main()
