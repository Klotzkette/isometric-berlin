"""Extract a small, source-bound street presentation for the Tiergarten and central-Berlin viewer.

Step 10 only: canonical OSM, surface and park payloads remain unchanged. This
offline supplement moves bounded union/triangulation work out of first paint.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import struct
from collections import Counter
from pathlib import Path
from typing import Any

import geopandas as gpd
import shapely
from brandenburg_approach import build_brandenburg_approach
from shapely.geometry import LineString, Point, box
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from isometric_berlin.data.common import load_bounds_polygon, project_geometry
from isometric_berlin.generation.build_surface_polygons import (
  DEFAULT_BOUNDS,
  DEFAULT_SCENE,
  PATH_HIGHWAYS,
  PAVING_PATH_SURFACES,
  line_parts,
  open_tunnel_ramp_corridors,
  optional_osm_text,
  polygon_parts,
  road_surface_kind,
  runs_underground,
  smooth_road_line,
)
from isometric_berlin.generation.road_geometry import (
  VEHICULAR_HIGHWAYS,
  mapped_lane_count,
  road_width_m,
  road_width_source,
)

ROOT = Path(__file__).resolve().parents[1]
OSM = ROOT / "geo_data/regierungsviertel/osm.gpkg"
OUT = ROOT / "src/app/src/data/districtStreets.json"
ORIGIN = (389500.0, 5820000.0)
PARK_RELATION = "7643526"
SCOPE_BUFFER_M = 45.0
MAX_TRIANGLE_EDGE_M = 16.0
CDU_SOUTH_NORTHING = 5818640.0
# These are presentation masks, not surveyed district boundaries. Every surface
# inside still comes from retained OSM lines. Neighbouring masks overlap so no
# new break is introduced between the requested districts.
DISTRICT_WINDOWS = {
  "Hauptbahnhof": (388980, 5820340, 389730, 5820990),
  "Kanzleramt und Reichstag": (389000, 5819840, 389910, 5820400),
  "Brandenburger Tor": (389730, 5819570, 390125, 5819970),
  "Potsdamer Platz": (389390, 5818340, 390200, 5819350),
  "Europacity": (388770, 5820890, 389620, 5822160),
  "Charité": (389665, 5820090, 390185, 5821080),
}
MARKED_CLASSES = frozenset({"primary", "secondary", "tertiary"})


def world_point(point: tuple[float, float]) -> list[float]:
  """Convert one metric source coordinate to centimetre viewer X/Z."""
  return [round(point[0] - ORIGIN[0], 2), round(ORIGIN[1] - point[1], 2)]


def world_lines(geometry: BaseGeometry) -> list[list[list[float]]]:
  """Keep line vertices and densify elevation samples without moving an edge."""
  return [
    [world_point(point) for point in shapely.segmentize(line, 8.0).coords]
    for line in line_parts(geometry)
    if line.length >= 0.25
  ]


def triangulated_positions(geometry: BaseGeometry) -> list[float]:
  """Triangulate exact polygon holes, with all edges at most sixteen metres."""
  output: list[float] = []
  stack = [
    list(triangle.exterior.coords)[:3]
    for part in polygon_parts(geometry)
    for triangle in shapely.constrained_delaunay_triangles(part).geoms
  ]
  while stack:
    points = stack.pop()
    lengths = [math.dist(points[i], points[(i + 1) % 3]) for i in range(3)]
    longest = max(range(3), key=lengths.__getitem__)
    if lengths[longest] > MAX_TRIANGLE_EDGE_M:
      a, b, c = (points[(longest + i) % 3] for i in range(3))
      midpoint = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
      stack.extend(([a, midpoint, c], [midpoint, b, c]))
    else:
      # X/Z reverses the projected north axis. Renderer computes its own
      # upward winding and ground elevation from these source-bound triangles.
      output.extend(value for point in points for value in world_point(point))
  return output


def extract_scope(roads: gpd.GeoDataFrame, park: BaseGeometry) -> BaseGeometry:
  """Park plus bordering streets and the owner's explicit CDU connection."""
  cdu = roads[
    (roads["name"] == "Klingelhöferstraße") & roads["highway"].isin(VEHICULAR_HIGHWAYS)
  ]
  continuation = unary_union(cdu.geometry.tolist()).intersection(
    box(388050, CDU_SOUTH_NORTHING, 388230, 5819050)
  )
  scope = unary_union(
    [
      park.buffer(SCOPE_BUFFER_M),
      continuation.buffer(20.0),
      *(box(*bounds) for bounds in DISTRICT_WINDOWS.values()),
    ]
  )
  return scope.intersection(project_geometry(load_bounds_polygon(DEFAULT_BOUNDS)))


def build_payload(osm_path: Path = OSM) -> dict[str, Any]:
  """Extract bounded roads, mapped paving, open kerbs and marking axes."""
  roads = gpd.read_file(osm_path, layer="roads").to_crs(epsg=25833)
  parks = gpd.read_file(osm_path, layer="parks").to_crs(epsg=25833)
  rows = parks[(parks["element"] == "relation") & (parks["id"] == PARK_RELATION)]
  if len(rows) != 1:
    raise ValueError("Expected one exact Großer Tiergarten OSM relation")
  park = rows.geometry.iloc[0]
  scope = extract_scope(roads, park)
  ramps = open_tunnel_ramp_corridors(DEFAULT_SCENE)
  if ramps is not None:
    scope = scope.difference(ramps.buffer(0.2))
  nearby = roads[roads.geometry.intersects(scope.buffer(40.0))]
  by_kind: dict[str, list[BaseGeometry]] = {"asphalt": [], "paving": []}
  vehicular_bands: list[BaseGeometry] = []
  crossing_bands: list[BaseGeometry] = []
  source_roads: list[dict[str, Any]] = []
  elevated_path_ids: set[str] = set()
  markings: list[dict[str, Any]] = []
  junction_neighbors: dict[tuple[float, float], set[tuple[float, float]]] = {}
  junction_widths: dict[tuple[float, float], float] = {}
  for _, row in nearby.iterrows():
    highway = row.get("highway")
    width = road_width_m(row)
    bridge = optional_osm_text(row.get("bridge"))
    covered = optional_osm_text(row.get("covered"))
    tunnel = optional_osm_text(row.get("tunnel"))
    if (
      width is None
      or runs_underground(row)
      or bridge not in (None, "no")
      or covered not in (None, "no")
      or tunnel not in (None, "no")
    ):
      elevated_path_ids.add(str(row["id"]))
      continue
    is_motor = highway in VEHICULAR_HIGHWAYS
    if not is_motor and highway not in PATH_HIGHWAYS:
      continue
    for line in line_parts(row.geometry):
      if line.length < 0.25:
        continue
      if is_motor:
        coords = [(round(x, 2), round(y, 2)) for x, y in line.coords]
        for a, b in zip(coords, coords[1:]):
          junction_neighbors.setdefault(a, set()).add(b)
          junction_neighbors.setdefault(b, set()).add(a)
          junction_widths[a] = max(junction_widths.get(a, 0.0), width)
          junction_widths[b] = max(junction_widths.get(b, 0.0), width)
      # Smooth before clipping: the boundary cannot change the source curve.
      curved = smooth_road_line(line)
      in_park = curved.intersection(park).length > curved.length * 0.5
      kind = road_surface_kind(row, highway, in_park)
      explicit_surface = optional_osm_text(row.get("surface"))
      # Shared broad payload keeps all motor roads asphalt. This bounded
      # recognition layer also honours explicitly mapped cobbled access lanes.
      if is_motor and explicit_surface in PAVING_PATH_SURFACES:
        kind = "paving"
      if is_motor and explicit_surface in {
        "fine_gravel",
        "gravel",
        "compacted",
        "sand",
        "dirt",
        "earth",
        "grass_paver",
      }:
        continue
      band = curved.buffer(width / 2, cap_style=2, join_style=1, quad_segs=16)
      clipped = band.intersection(scope)
      if clipped.is_empty:
        continue
      if kind in by_kind:
        by_kind[kind].append(clipped)
      if is_motor:
        vehicular_bands.append(band)
      else:
        # Every source foot/cycle approach lowers the kerb. This also removes
        # kerbs across mapped unsignalled crossings, not just tagged crossings.
        crossing_bands.append(band.buffer(0.35))
      clipped_axis = curved.intersection(scope)
      if is_motor and not clipped_axis.is_empty:
        name = row.get("name")
        source_roads.append(
          {
            "id": str(row["id"]),
            "name": name if isinstance(name, str) else "",
            "highway": highway,
            "surface": explicit_surface,
            "width_m": round(width, 2),
            "width_source": road_width_source(row),
            "length_m": round(clipped_axis.length, 2),
          }
        )
        if highway in MARKED_CLASSES:
          for axis in line_parts(clipped_axis):
            if axis.length >= 8:
              markings.append(
                {
                  "id": str(row["id"]),
                  "name": name if isinstance(name, str) else "",
                  "width_m": round(width, 2),
                  "lanes": mapped_lane_count(row),
                  "points": [world_point(point) for point in axis.coords],
                }
              )
  junctions = unary_union(
    [
      Point(point).buffer(max(5.0, junction_widths[point] / 2 + 1.5))
      for point, neighbours in junction_neighbors.items()
      if len(neighbours) >= 3
    ]
  )
  # Lane separators stop before crossing traffic, never forming a white grid
  # through a junction. Source way-split nodes with degree two remain continuous.
  safe_markings: list[dict[str, Any]] = []
  for marking in markings:
    line = LineString([(ORIGIN[0] + x, ORIGIN[1] - z) for x, z in marking["points"]])
    for part in line_parts(line.difference(junctions)):
      if part.length > 1.0:
        safe_markings.append(
          {**marking, "points": [world_point(p) for p in part.coords]}
        )
  markings = safe_markings
  # Asphalt wins at road/walkway intersections. A pale footway must never
  # paint an unmarked zebra crossing across a real street.
  asphalt = unary_union(by_kind["asphalt"])
  motor_union = unary_union(vehicular_bands)
  # The full park-path inventory is already resident in ParkDetails. Only
  # roadside paving is repeated here, to join the source street surface.
  paving = (
    unary_union(by_kind["paving"])
    .difference(asphalt)
    .intersection(motor_union.buffer(8.0))
  )
  curb_edges = motor_union.boundary.intersection(scope.buffer(-0.3))
  if crossing_bands:
    curb_edges = curb_edges.difference(unary_union(crossing_bands))
  # Replace only the owner's bounded Gate / western avenue approach. Its
  # cadastral and OSM public-space geometry supplies a complete foundation,
  # including the otherwise missing plaza areas and roadside pavement infill.
  approach = build_brandenburg_approach(roads, parks, osm_path=osm_path)
  local_scope = approach["scope"]
  asphalt = asphalt.difference(local_scope).union(approach["asphalt"])
  paving = paving.difference(local_scope).union(
    approach["paving"].intersection(approach["plaza_scope"])
  )
  sidewalks = approach["paving"].difference(approach["plaza_scope"])
  curb_edges = curb_edges.difference(local_scope).union(approach["curbs"])
  scope = scope.union(local_scope)
  retained_markings: list[dict[str, Any]] = []
  for marking in markings:
    line = LineString([(ORIGIN[0] + x, ORIGIN[1] - z) for x, z in marking["points"]])
    for part in line_parts(line.difference(approach["markings_exclusion"])):
      if part.length > 1.0:
        retained_markings.append(
          {**marking, "points": [world_point(p) for p in part.coords]}
        )
  markings = retained_markings
  curbs = world_lines(curb_edges)
  surfaces = [
    {
      "kind": kind,
      "area_m2": round(geometry.area, 2),
      "source_perimeter_m": round(geometry.length, 2),
      "positions_m": triangulated_positions(geometry),
    }
    for kind, geometry in (
      ("asphalt", asphalt),
      ("paving", paving),
      ("sidewalk", sidewalks),
      ("gravel", approach["gravel"]),
      ("grass", approach["grass"]),
    )
  ]
  for surface in surfaces:
    raw = surface["positions_m"]
    unique: dict[tuple[float, float], int] = {}
    positions: list[float] = []
    indices: list[int] = []
    for index in range(0, len(raw), 2):
      point = (raw[index], raw[index + 1])
      if point not in unique:
        unique[point] = len(unique)
        positions.extend(point)
      indices.append(unique[point])
    surface["positions_m"] = positions
    surface["indices"] = indices
  source_roads.sort(key=lambda item: (item["name"], item["id"]))
  markings.sort(key=lambda item: (item["name"], item["id"]))
  return {
    "schema_version": 2,
    "source": {
      "osm_sha256": hashlib.sha256(osm_path.read_bytes()).hexdigest(),
      "park_relation": int(PARK_RELATION),
      "origin": list(ORIGIN),
      "coordinate_units": "viewer X/Z metres; indexed surface vertices encoded as little-endian int32 centimetres, uint32 indices, base64",
      "license": "ODbL-1.0",
      "scope_buffer_m": SCOPE_BUFFER_M,
      "cdu_connection_south_northing": CDU_SOUTH_NORTHING,
      "district_windows_epsg25833": DISTRICT_WINDOWS,
      "scope_policy": "Display masks for user-requested areas, not administrative boundaries",
      "marking_policy": "Lane-divider dashes inferred from mapped lane count; 4m on / 6m off display convention, not a traffic-paint survey",
      "width_policy": "OSM width, est_width, lane-derived, shared class fallback",
      "height_policy": "runtime committed DGM samples; 0.14m kerb is display detail",
      "max_triangle_edge_m": MAX_TRIANGLE_EDGE_M,
      "references": [
        "https://www.openstreetmap.org/relation/7643526",
        "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
        "https://www.berlin.de/rbmskzl/aktuelles/media/einweihung-der-helmut-kohl-allee-1669992.php",
      ],
      "brandenburg_approach": approach["source"],
    },
    "brandenburg_approach_scope_m": [
      {
        "ring": [world_point(point) for point in part.exterior.coords],
        "holes": [
          [world_point(point) for point in hole.coords] for hole in part.interiors
        ],
      }
      for part in polygon_parts(local_scope)
    ],
    "scope_rings_m": [
      [world_point(point) for point in part.exterior.coords]
      for part in polygon_parts(scope)
    ],
    "surfaces": surfaces,
    "curbs_m": curbs,
    "elevated_path_ids": sorted(elevated_path_ids),
    "markings_m": markings,
    "roads": source_roads,
    "inventory": {
      "source_road_count": len(source_roads),
      "by_width_source": dict(
        sorted(Counter(row["width_source"] for row in source_roads).items())
      ),
      "triangle_count": sum(len(item["indices"]) // 3 for item in surfaces),
      "curb_length_m": round(curb_edges.length, 2),
      "curb_line_count": len(curbs),
      "scope_area_m2": round(scope.area, 2),
    },
  }


def main() -> None:
  """Write the deterministic bounded viewer source supplement."""
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out", type=Path, default=OUT)
  args = parser.parse_args()
  payload = build_payload()
  for surface in payload["surfaces"]:
    positions = [round(value * 100) for value in surface.pop("positions_m")]
    indices = surface.pop("indices")
    surface["positions_cm_b64"] = base64.b64encode(
      struct.pack(f"<{len(positions)}i", *positions)
    ).decode("ascii")
    surface["indices_b64"] = base64.b64encode(
      struct.pack(f"<{len(indices)}I", *indices)
    ).decode("ascii")
  args.out.parent.mkdir(parents=True, exist_ok=True)
  args.out.write_text(
    json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  scope_output = ROOT / "src/app/src/districtStreetScopeData.ts"
  scope_output.write_text(
    "// Generated by scripts/build_district_streets.py; display scope only.\n"
    "export const DISTRICT_STREET_SCOPE_RINGS_M: readonly (readonly (readonly [number, number])[])[] = "
    + json.dumps(payload["scope_rings_m"], separators=(",", ":"))
    + ";\n"
  )
  (ROOT / "src/app/src/brandenburgApproachScopeData.ts").write_text(
    "// Generated by scripts/build_district_streets.py; ALKIS/OSM presentation footprint.\n"
    "export const BRANDENBURG_APPROACH_SCOPE: readonly {ring: readonly (readonly [number, number])[]; holes: readonly (readonly (readonly [number, number])[])[]}[] = "
    + json.dumps(payload["brandenburg_approach_scope_m"], separators=(",", ":"))
    + ";\n"
  )
  print(
    json.dumps(
      {
        "output": str(args.out),
        "bytes": args.out.stat().st_size,
        **payload["inventory"],
      },
      indent=2,
    )
  )


if __name__ == "__main__":
  main()
