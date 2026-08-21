"""Build the street-details payload (task 07: animated traffic lights).

Exports every OSM ``highway=traffic_signals`` node inside the
Regierungsviertel bounds as viewer world coordinates. OSM commonly maps a
signal-control node on a carriageway centreline rather than the physical mast.
Those source nodes remain byte-for-byte inspectable while a separate display
position is projected to the nearest safe carriageway verge. Nodes already
outside the modelled carriageway stay at their mapped position.

Scene mapping (verified against ``scene.json`` ``origin_epsg25833``):
``world_x = easting − 389500``, ``world_z = 5820000 − northing``.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
from shapely.geometry import LineString, Point, Polygon, box
from shapely.geometry.base import BaseGeometry
from shapely.ops import nearest_points, unary_union

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
from isometric_berlin.generation.build_surface_polygons import (
  ROAD_BUFFER_QUAD_SEGS,
  line_parts,
  open_tunnel_ramp_corridors,
  polygon_parts,
  runs_underground,
  smooth_road_line,
)
from isometric_berlin.generation.road_geometry import (
  VEHICULAR_HIGHWAYS,
  road_width_m,
)

DEFAULT_OSM = REPO_ROOT / "geo_data/regierungsviertel/osm.gpkg"
DEFAULT_OUT = MESH_PUBLIC_DIR / "street-details.json"
SCHEMA_VERSION = 7

# OSM traffic-signal nodes are frequently semantic control points on the road
# centreline. The displayed pole centre must clear both the resolved
# carriageway edge and its own 0.14 m square footprint. A 0.70 m source-space
# offset leaves at least 0.50 m after both road-ring and pole decimetre
# quantisation.
TRAFFIC_SIGNAL_VERGE_CLEARANCE_M = 0.70
# Keep generated positions away from the clipped dataset edge so the viewer's
# ground sampler cannot lose a pole after the decimetre round-trip.
TRAFFIC_SIGNAL_BOUNDS_INSET_M = 1.0
# Shapely can classify a point only a few nanometres outside a buffered curve
# after intersect/union operations. Treat one centimetre as numeric boundary
# noise, while leaving genuinely surveyed verge points untouched.
TRAFFIC_SIGNAL_CARRIAGEWAY_EPSILON_M = 0.01
# Tiny sub-decimetre differences are only buffer/curve numerical noise; retain
# the mapped node instead of claiming a meaningful relocation.
TRAFFIC_SIGNAL_MOVE_THRESHOLD_M = 0.075
# A signal node that is directly tagged as an island, or lies on a directly
# tagged island crossing way, is physical evidence for a real refuge. The
# canonical geometry keeps intersecting island ways within centimetres, so a
# 5 cm tolerance catches their quantisation noise without accepting a merely
# nearby median.
TRAFFIC_SIGNAL_ISLAND_SOURCE_TOLERANCE_M = 0.05
# A candidate in an unverified median exits one carriageway and reaches another
# along the same outward ray. Test far enough to cover Berlin's widest divided
# streets and choose a boundary from which the ray stays outside the complete
# global road envelope.
TRAFFIC_SIGNAL_VERGE_ESCAPE_M = 45.0
TRAFFIC_SIGNAL_CANDIDATE_RAY_M = 45.0
TRAFFIC_SIGNAL_CANDIDATE_DIRECTIONS = 32
# The global road union encloses both real city blocks and small median/refuge
# gaps. Only sizeable block perimeters are eligible unsourced sidewalk verges;
# small holes need explicit crossing:island evidence and stay excluded.
TRAFFIC_SIGNAL_MIN_BLOCK_HOLE_AREA_M2 = 500.0

# Roads a filling station can front. Service ways and footpaths run behind
# and beside forecourts, so matching those would rotate the canopy at random.
FUEL_FRONTAGE_HIGHWAYS = {
  "living_street",
  "primary",
  "residential",
  "secondary",
  "tertiary",
  "unclassified",
}
# The forecourt of a German filling station that OSM records as a single
# node. Both numbers are extrapolated and the payload says so.
FUEL_DEFAULT_WIDTH_DM = 170
FUEL_DEFAULT_DEPTH_DM = 140

# OSM `historic` kinds that become drawn monuments in the viewer.
MONUMENT_KINDS = {"cannon", "memorial", "monument", "tank"}
# Landmarks the recognition layer already models completely.
MONUMENT_SKIP_NAMES = {"Brandenburger Tor"}

# Most protected places arrive as ``historic=memorial`` and need no
# name-based interpretation. A few installations are mapped only as public
# art even though they belong to an explicitly protected remembrance
# ensemble. Stable OSM keys keep those exceptions reviewable and independent
# of translated or subsequently corrected names.
SCHWELLENRAUM_PROTECTED_OSM_KEYS = {
  "node/2310445137",  # Klanginstallation Klopfzeichen, Moabit prison park
  "way/195086492",  # Panoptikum, Moabit prison park
  "node/2589577819",  # Contact, former Krolloper site
  "node/9775503531",  # Grosse Knospe III/63, former Krolloper site
  "node/9775536511",  # Todes Mauer Bruch, former Krolloper site
  "node/9775538466",  # Himmelschluessel, former Krolloper site
  "node/5253735916",  # Mutter mit totem Sohn, Neue Wache
}

# A conservative fallback for present and future ``tourism=artwork`` records
# whose names state a direct relation to persecution, victims or violence.
# It intentionally prefers a harmless false positive (ordinary Day styling)
# over visually changing a newly mapped place of remembrance.
SCHWELLENRAUM_PROTECTED_ARTWORK_MARKERS = (
  "deport",
  "ermord",
  "euthanas",
  "gefallen",
  "gedenk",
  "gewalt",
  "holocaust",
  "jüdis",
  "juden",
  "krieg",
  "mahnmal",
  "nationalsozial",
  "nazi",
  "nie wieder",
  "opfer",
  "pogrom",
  "sinti",
  "stalin",
  "terror",
  "todes",
  "totem",
  "verfolg",
  "verwundet",
  "völkermord",
  "widerstand",
  "zwangs",
)

# Beer-garden and bar outlines are traced node by node in OSM; at viewer
# scale the extra vertices only add jitter to the ink outline.
VENUE_SIMPLIFY_M = 0.5

# Berlin's Spree beach bars are tagged as ordinary drinking venues — the
# beach is in the name, never in the tags.
RIVERSIDE_BAR_AMENITIES = {"bar", "biergarten", "pub"}
# Far enough to include a bar set back on the promenade, close enough to
# exclude the pubs on the far side of the parkland.
RIVERSIDE_BAR_MAX_WATER_M = 60.0
# Capital Beach's surveyed bench row runs about 100 m along the quay.
RIVERSIDE_BAR_SEAT_RADIUS_M = 120.0
# The quay is one bench deep; anything further back is park furniture.
RIVERSIDE_BAR_SEAT_SHORE_M = 25.0

# OSM currently carries both the older generic ``Bison`` node 7650006206 and
# the more specific ``Liegender Bison II`` node 1327995113 at the same eastern
# Floraplatz plinth (0.65 m apart). The Berlin restoration documents eight
# animals, not nine; retain the described node and suppress only that known
# duplicate pair.
FLORAPLATZ_DUPLICATE_DISTANCE_DM = 15


def deduplicate_floraplatz_animals(
  monuments: list[dict[str, Any]],
) -> list[dict[str, Any]]:
  """Return the eight Floraplatz animals without the duplicate bison node."""
  specific = [entry for entry in monuments if entry["name"] == "Liegender Bison Ⅱ"]
  if not specific:
    return monuments
  filtered: list[dict[str, Any]] = []
  for entry in monuments:
    is_duplicate = entry["name"] == "Bison" and any(
      math.hypot(entry["x_dm"] - target["x_dm"], entry["z_dm"] - target["z_dm"])
      <= FLORAPLATZ_DUPLICATE_DISTANCE_DM
      for target in specific
    )
    if not is_duplicate:
      filtered.append(entry)
  return filtered


def monument_kind(row: Any) -> str | None:
  """The drawn class of an OSM POI, or ``None`` if it is not a monument.

  Most of the Tiergarten's statuary is not tagged ``historic`` at all but
  ``tourism=artwork`` — the Wagner memorial, the hunting groups, the
  Luiseninsel figures. Leaving those out emptied whole lawns that in
  reality are full of marble, so a named artwork counts too.
  """
  kind = row.get("historic")
  if isinstance(kind, str) and kind in MONUMENT_KINDS:
    return kind
  if row.get("tourism") == "artwork":
    return "artwork"
  return None


def osm_identity(row: Any) -> tuple[str, str, str]:
  """Return the stable OSM element, id and combined key for a source row."""
  element = row.get("element")
  osm_id = row.get("id")
  if not isinstance(element, str) or element not in {"node", "way", "relation"}:
    raise ValueError(f"Source row has no stable OSM element: {element!r}")
  if not isinstance(osm_id, str) or not osm_id:
    raise ValueError(f"Source row has no stable OSM id: {osm_id!r}")
  return element, osm_id, f"{element}/{osm_id}"


def _surface_vehicular_road(row: Any) -> bool:
  """Whether one OSM line contributes to the visible surface carriageway."""
  if row.get("highway") not in VEHICULAR_HIGHWAYS:
    return False
  if runs_underground(row):
    return False
  return row.geometry is not None and not row.geometry.is_empty


def _traffic_signal_road_bands(
  roads: gpd.GeoDataFrame,
  bounds: BaseGeometry,
  ramp_corridors: BaseGeometry | None,
) -> gpd.GeoSeries:
  """Resolve exactly the same visible motor carriageways as the viewer.

  Signal placement must not use a cheaper second approximation. The road
  surface builder clips, removes open tunnel ramps, smooths mapped nodes and
  uses a 16-segment round join before the browser ever sees the polygon; the
  physical-pole placement repeats that contract byte-semantically here.
  """
  bands = []
  for _, row in roads.iterrows():
    if not _surface_vehicular_road(row):
      continue
    width = road_width_m(row)
    if width is None:
      continue
    clipped = row.geometry.intersection(bounds)
    if ramp_corridors is not None:
      clipped = clipped.difference(ramp_corridors)
    for line in line_parts(clipped):
      if line.length < 2.0:
        continue
      band = smooth_road_line(line).buffer(
        width / 2,
        cap_style=2,
        join_style=1,
        quad_segs=ROAD_BUFFER_QUAD_SEGS,
      )
      if ramp_corridors is not None:
        band = band.difference(ramp_corridors)
      if not band.is_empty:
        bands.append(band)
  return gpd.GeoSeries(bands, crs=roads.crs)


def _verified_island_signal_keys(
  signals: gpd.GeoDataFrame, roads: gpd.GeoDataFrame
) -> set[str]:
  """Return signals with direct node/way evidence for a refuge island."""
  keys = {
    osm_identity(row)[2]
    for _, row in signals.iterrows()
    if str(row.get("crossing:island") or "").casefold() == "yes"
  }
  island_lines = roads[
    (roads["crossing:island"] == "yes")
    & (roads.geometry.geom_type.isin(["LineString", "MultiLineString"]))
  ]
  if island_lines.empty:
    return keys
  island_index = island_lines.sindex
  for _, row in signals.iterrows():
    source = row.geometry
    matches = list(
      island_index.query(
        source.buffer(TRAFFIC_SIGNAL_ISLAND_SOURCE_TOLERANCE_M),
        predicate="intersects",
      )
    )
    if any(
      island_lines.geometry.iloc[index].distance(source)
      <= TRAFFIC_SIGNAL_ISLAND_SOURCE_TOLERANCE_M
      for index in matches
    ):
      keys.add(osm_identity(row)[2])
  return keys


def _exterior_boundaries(geometry: BaseGeometry) -> BaseGeometry:
  """Return only true polygon exteriors, never unverified union-hole rims."""
  exteriors = [LineString(part.exterior.coords) for part in polygon_parts(geometry)]
  return unary_union(exteriors)


def _eligible_verge_boundaries(geometry: BaseGeometry) -> BaseGeometry:
  """Return true outside edges plus sizeable city-block sidewalk perimeters."""
  boundaries: list[LineString] = []
  for part in polygon_parts(geometry):
    boundaries.append(LineString(part.exterior.coords))
    for interior in part.interiors:
      if Polygon(interior).area >= TRAFFIC_SIGNAL_MIN_BLOCK_HOLE_AREA_M2:
        boundaries.append(LineString(interior.coords))
  return unary_union(boundaries)


def _small_unverified_road_holes(geometry: BaseGeometry) -> BaseGeometry:
  """Return median/refuge gaps that have no direct island provenance."""
  holes = [
    Polygon(interior)
    for part in polygon_parts(geometry)
    for interior in part.interiors
    if Polygon(interior).area < TRAFFIC_SIGNAL_MIN_BLOCK_HOLE_AREA_M2
  ]
  return unary_union(holes)


def _point_parts(geometry: BaseGeometry) -> list[Point]:
  """Flatten boundary/ray intersections into deterministic point candidates."""
  if isinstance(geometry, Point):
    return [geometry]
  if isinstance(geometry, LineString):
    coordinates = list(geometry.coords)
    return [Point(coordinates[0]), Point(coordinates[-1])] if coordinates else []
  if hasattr(geometry, "geoms"):
    return [point for part in geometry.geoms for point in _point_parts(part)]
  return []


def _safe_exterior_candidate(
  source: Point,
  safe_envelope: BaseGeometry,
  eligible_boundary: BaseGeometry,
  forbidden_holes: BaseGeometry,
) -> Point | None:
  """Choose a true outside verge, rejecting unverified median-facing sides."""
  radius = TRAFFIC_SIGNAL_CANDIDATE_RAY_M
  boundary = eligible_boundary.intersection(
    box(source.x - radius, source.y - radius, source.x + radius, source.y + radius)
  )
  if boundary.is_empty:
    return None
  nearest = nearest_points(source, boundary)[1]
  base_angle = math.atan2(nearest.y - source.y, nearest.x - source.x)
  candidates = [nearest]
  for index in range(TRAFFIC_SIGNAL_CANDIDATE_DIRECTIONS):
    angle = base_angle + index * math.tau / TRAFFIC_SIGNAL_CANDIDATE_DIRECTIONS
    direction_x = math.cos(angle)
    direction_y = math.sin(angle)
    ray = LineString(
      [
        source,
        Point(
          source.x + direction_x * TRAFFIC_SIGNAL_CANDIDATE_RAY_M,
          source.y + direction_y * TRAFFIC_SIGNAL_CANDIDATE_RAY_M,
        ),
      ]
    )
    candidates.extend(_point_parts(ray.intersection(boundary)))

  unique: dict[tuple[int, int], Point] = {}
  for candidate in candidates:
    distance = source.distance(candidate)
    if distance <= TRAFFIC_SIGNAL_MOVE_THRESHOLD_M:
      continue
    unique[(round(candidate.x * 1_000), round(candidate.y * 1_000))] = candidate

  accepted: list[tuple[float, Point]] = []
  for candidate in unique.values():
    if not forbidden_holes.is_empty and forbidden_holes.covers(candidate):
      continue
    distance = source.distance(candidate)
    direction_x = (candidate.x - source.x) / distance
    direction_y = (candidate.y - source.y) / distance
    # Begin clearly beyond the buffered boundary so numeric boundary contact
    # itself does not count as a second road. A median-facing candidate reaches
    # the opposite carriageway envelope and is rejected.
    probe = LineString(
      [
        Point(candidate.x + direction_x * 0.05, candidate.y + direction_y * 0.05),
        Point(
          candidate.x + direction_x * TRAFFIC_SIGNAL_VERGE_ESCAPE_M,
          candidate.y + direction_y * TRAFFIC_SIGNAL_VERGE_ESCAPE_M,
        ),
      ]
    )
    if probe.intersects(safe_envelope):
      continue
    accepted.append((distance, candidate))
  if not accepted:
    return None
  accepted.sort(key=lambda item: (item[0], item[1].x, item[1].y))
  return accepted[0][1]


def _world_dm(point: Any) -> list[int]:
  """Convert one EPSG:25833 point to viewer decimetres."""
  return [
    round((point.x - ORIGIN_EASTING) * 10),
    round((ORIGIN_NORTHING - point.y) * 10),
  ]


def build_traffic_signal_data(
  roads: gpd.GeoDataFrame,
  bounds: Any,
  ramp_corridors: BaseGeometry | None = None,
) -> tuple[list[list[int]], list[dict[str, Any]]]:
  """Return all source nodes plus safe physical display positions.

  OSM's common centreline signal mapping is valid traffic-control semantics,
  but drawing a mast there puts it in a live lane. Nodes covered by the same
  resolved surface-road bands used by the viewer, plus one centimetre of
  boundary-noise tolerance, move to a 0.70 m expanded global exterior verge.
  Small unsourced union holes are forbidden, and an outward ray must remain
  clear of every other carriageway. Already-safe mapped poles and directly
  sourced refuge islands stay exact.
  """
  signals = roads[
    (roads["highway"] == "traffic_signals") & (roads.geometry.geom_type == "Point")
  ]
  raw_positions: list[list[int]] = []
  placements: list[dict[str, Any]] = []
  road_bands = _traffic_signal_road_bands(roads, bounds, ramp_corridors)
  road_union = unary_union(road_bands.tolist())
  safe_road_envelope = road_union.buffer(
    TRAFFIC_SIGNAL_VERGE_CLEARANCE_M,
    join_style=1,
    quad_segs=4,
  )
  verified_islands = _verified_island_signal_keys(signals, roads)
  inset_bounds = bounds.buffer(-TRAFFIC_SIGNAL_BOUNDS_INSET_M)
  if inset_bounds.is_empty:
    inset_bounds = bounds
  eligible_boundary = _eligible_verge_boundaries(safe_road_envelope).intersection(
    inset_bounds
  )
  forbidden_holes = _small_unverified_road_holes(road_union)

  for _, row in signals.iterrows():
    source = row.geometry
    if not bounds.contains(source):
      continue
    source_dm = _world_dm(source)
    raw_positions.append(source_dm)
    _, _, osm_key = osm_identity(row)
    target = source
    source_on_carriageway = road_union.covers(source)
    source_requires_relocation = (
      source_on_carriageway
      or road_union.distance(source) <= TRAFFIC_SIGNAL_CARRIAGEWAY_EPSILON_M
    )
    if source_requires_relocation and osm_key not in verified_islands:
      candidate = _safe_exterior_candidate(
        source, safe_road_envelope, eligible_boundary, forbidden_holes
      )
      if candidate is None:
        raise ValueError(f"No safe exterior verge found for {osm_key}")
      target = candidate

    target_dm = _world_dm(target)
    # Measure after the exact decimetre round-trip shipped to the viewer.
    quantised_target = Point(
      ORIGIN_EASTING + target_dm[0] / 10,
      ORIGIN_NORTHING - target_dm[1] / 10,
    )
    road_clearance_dm = (
      round(quantised_target.distance(road_union) * 10)
      if not road_union.is_empty
      else None
    )
    if osm_key in verified_islands:
      placement = "verified_island"
    elif target_dm != source_dm:
      placement = "relocated_verge"
    else:
      placement = "surveyed_verge"
    placements.append(
      {
        "offset_dm": round(source.distance(quantised_target) * 10),
        "osm_key": osm_key,
        "placement": placement,
        "position_dm": target_dm,
        "road_clearance_dm": road_clearance_dm,
        "source_dm": source_dm,
        "source_on_carriageway": source_on_carriageway,
        "source_requires_relocation": source_requires_relocation,
      }
    )

  raw_positions.sort()
  placements.sort(
    key=lambda entry: (
      entry["source_dm"][0],
      entry["source_dm"][1],
      entry["osm_key"],
    )
  )
  return raw_positions, placements


def schwellenraum_protected(
  kind: str, name: str, memorial_type: str, osm_key: str
) -> bool:
  """Whether the source feature must retain exact Day presentation.

  Every OSM memorial subtype is protected without trying to infer its subject
  from a translated name. Tanks, cannons and historic monuments are protected
  conservatively as well; there are only ten such records in the payload and
  this includes all hardware of the Soviet memorial and the Berlin Wall site.
  Public art stays ordinary unless its stable key or its name makes the
  remembrance/violence context explicit.
  """
  if kind in {"memorial", "monument", "tank", "cannon"} or memorial_type:
    return True
  if osm_key in SCHWELLENRAUM_PROTECTED_OSM_KEYS:
    return True
  normalized = name.casefold()
  return any(
    marker.casefold() in normalized
    for marker in SCHWELLENRAUM_PROTECTED_ARTWORK_MARKERS
  )


def rectangle_axis(polygon: Any) -> tuple[tuple[float, float], float, float]:
  """The long axis and side lengths of a footprint's tightest rectangle.

  Returned in viewer world orientation: northing grows the opposite way to
  ``world_z``, so the northing component of the easting/northing edge flips.
  """
  ring = polygon.minimum_rotated_rectangle.exterior.coords
  edges = [
    (ring[index + 1][0] - ring[index][0], ring[index + 1][1] - ring[index][1])
    for index in range(4)
  ]
  lengths = [math.hypot(dx, dy) for dx, dy in edges]
  long_index = max(range(4), key=lambda index: lengths[index])
  dx, dy = edges[long_index]
  length = lengths[long_index]
  return (dx / length, -dy / length), length, lengths[(long_index + 1) % 4]


def frontage_axis(point: Any, roads: gpd.GeoDataFrame) -> tuple[float, float]:
  """The forecourt axis of a node-only filling station.

  A canopy stands across the street it serves, not along it: the mapped
  Esso roof on Lessingstraße runs exactly perpendicular to the street. So
  take the bearing of the nearest frontage road and turn it a quarter turn.
  """
  distances = roads.distance(point)
  road = roads.loc[distances.idxmin()].geometry
  offset = road.project(point)
  before = road.interpolate(max(0.0, offset - 8.0))
  after = road.interpolate(min(road.length, offset + 8.0))
  dx = after.x - before.x
  dy = -(after.y - before.y)
  length = math.hypot(dx, dy)
  if length == 0:
    return (1.0, 0.0)
  # Quarter turn: (x, z) -> (-z, x).
  return (-dy / length, dx / length)


def build_fuel_stations(
  pois: gpd.GeoDataFrame, roads: gpd.GeoDataFrame, bounds: Any
) -> list[dict[str, Any]]:
  """Filling stations with the axis their canopy and pump islands follow.

  OSM maps the position, the brand and the fuel grades; only one of the
  three sites in the bounds carries a footprint. The canopy, the islands
  and the price totem are therefore drawn to a standard forecourt and
  flagged, so the viewer can mark them as extrapolated.
  """
  frontage = roads[
    roads["highway"].isin(FUEL_FRONTAGE_HIGHWAYS)
    & roads.geometry.geom_type.isin(["LineString", "MultiLineString"])
  ]
  stations: list[dict[str, Any]] = []
  for _, row in pois[pois["amenity"] == "fuel"].iterrows():
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    centroid = geometry.centroid
    if not bounds.contains(centroid):
      continue
    if geometry.geom_type in ("Polygon", "MultiPolygon"):
      axis, along_m, across_m = rectangle_axis(geometry)
      surveyed = True
      width_dm = round(along_m * 10)
      depth_dm = round(across_m * 10)
    else:
      axis = frontage_axis(centroid, frontage)
      surveyed = False
      width_dm = FUEL_DEFAULT_WIDTH_DM
      depth_dm = FUEL_DEFAULT_DEPTH_DM
    name = row.get("name")
    stations.append(
      {
        "axis": [round(axis[0], 4), round(axis[1], 4)],
        "d_dm": depth_dm,
        "name": name if isinstance(name, str) else "",
        "surveyed_outline": surveyed,
        "w_dm": width_dm,
        "x_dm": round((centroid.x - ORIGIN_EASTING) * 10),
        "z_dm": round((ORIGIN_NORTHING - centroid.y) * 10),
      }
    )
  stations.sort(key=lambda entry: (entry["x_dm"], entry["z_dm"]))
  return stations


def build_beer_gardens(pois: gpd.GeoDataFrame, bounds: Any) -> list[dict[str, Any]]:
  """``amenity=biergarten`` areas with the ring the tables stand in.

  A beer garden is one of the few things OSM maps as a true area, so the
  bench rows can be laid out inside the surveyed outline instead of being
  scattered over a guessed rectangle.
  """
  gardens: list[dict[str, Any]] = []
  for _, row in pois[pois["amenity"] == "biergarten"].iterrows():
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    if geometry.geom_type not in ("Polygon", "MultiPolygon"):
      continue
    centroid = geometry.centroid
    if not bounds.contains(centroid):
      continue
    outline = geometry
    if outline.geom_type == "MultiPolygon":
      outline = max(outline.geoms, key=lambda part: part.area)
    outline = outline.simplify(VENUE_SIMPLIFY_M, preserve_topology=True)
    axis, along_m, across_m = rectangle_axis(outline)
    name = row.get("name")
    gardens.append(
      {
        "area_m2": round(outline.area),
        "axis": [round(axis[0], 4), round(axis[1], 4)],
        "d_dm": round(across_m * 10),
        "name": name if isinstance(name, str) else "",
        "ring_dm": [
          [
            round((x - ORIGIN_EASTING) * 10),
            round((ORIGIN_NORTHING - y) * 10),
          ]
          for x, y in outline.exterior.coords
        ],
        "w_dm": round(along_m * 10),
        "x_dm": round((centroid.x - ORIGIN_EASTING) * 10),
        "z_dm": round((ORIGIN_NORTHING - centroid.y) * 10),
      }
    )
  gardens.sort(key=lambda entry: (entry["x_dm"], entry["z_dm"]))
  return gardens


def build_riverside_bars(
  pois: gpd.GeoDataFrame, water: gpd.GeoDataFrame, parks: gpd.GeoDataFrame, bounds: Any
) -> list[dict[str, Any]]:
  """Summer beach bars: a drinks node standing in parkland at the water.

  Berlin's Spree beach bars are mapped as a single ``amenity=pub`` node —
  no outline, no sand, nothing to extrude. What IS surveyed is the row of
  benches along the bank, so each bar carries its own bench lines and the
  viewer seats the deck chairs on them rather than inventing a layout.
  """
  # A venue OSM gave an outline to is already drawn from that outline;
  # only the node-only ones need a layout invented around them.
  drinks = pois[
    pois["amenity"].isin(RIVERSIDE_BAR_AMENITIES) & (pois.geometry.geom_type == "Point")
  ]
  benches = pois[
    (pois["amenity"] == "bench") & pois.geometry.geom_type.isin(["LineString", "Point"])
  ]
  parkland = parks.geometry.union_all()
  # Only mapped water *areas* have a bank to align to; the layer also
  # carries centre lines, and mixing them yields a collection whose
  # boundary shapely reports as ``None``.
  shore = water[
    water.geometry.geom_type.isin(["Polygon", "MultiPolygon"])
  ].geometry.union_all()
  bars: list[dict[str, Any]] = []
  for _, row in drinks.iterrows():
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    centroid = geometry.centroid
    if not bounds.contains(centroid):
      continue
    if not parkland.contains(centroid):
      continue
    if shore.distance(centroid) > RIVERSIDE_BAR_MAX_WATER_M:
      continue
    name = row.get("name")
    seats: list[dict[str, Any]] = []
    for _, bench in benches.iterrows():
      line = bench.geometry
      if line.distance(centroid) > RIVERSIDE_BAR_SEAT_RADIUS_M:
        continue
      # Benches up in the park belong to the park, not to the bar; the
      # ones the visitor sits on face the river from the quay.
      if shore.distance(line) > RIVERSIDE_BAR_SEAT_SHORE_M:
        continue
      if line.geom_type == "Point":
        seats.append(
          {
            "axis": [1.0, 0.0],
            "len_dm": 0,
            "x_dm": round((line.x - ORIGIN_EASTING) * 10),
            "z_dm": round((ORIGIN_NORTHING - line.y) * 10),
          }
        )
        continue
      start, end = line.coords[0], line.coords[-1]
      dx = end[0] - start[0]
      dz = -(end[1] - start[1])
      length = math.hypot(dx, dz)
      if length == 0:
        continue
      middle = line.interpolate(0.5, normalized=True)
      seats.append(
        {
          "axis": [round(dx / length, 4), round(dz / length, 4)],
          "len_dm": round(length * 10),
          "x_dm": round((middle.x - ORIGIN_EASTING) * 10),
          "z_dm": round((ORIGIN_NORTHING - middle.y) * 10),
        }
      )
    seats.sort(key=lambda entry: (entry["x_dm"], entry["z_dm"]))
    # The bar faces the water; the bank tangent gives the row direction.
    nearest = shore.exterior if shore.geom_type == "Polygon" else shore.boundary
    offset = nearest.project(centroid)
    before = nearest.interpolate(max(0.0, offset - 20.0))
    after = nearest.interpolate(min(nearest.length, offset + 20.0))
    dx = after.x - before.x
    dz = -(after.y - before.y)
    length = math.hypot(dx, dz)
    axis = (dx / length, dz / length) if length else (1.0, 0.0)
    bars.append(
      {
        "axis": [round(axis[0], 4), round(axis[1], 4)],
        "name": name if isinstance(name, str) else "",
        "seats": seats,
        "shore_dist_m": round(shore.distance(centroid), 1),
        "surveyed_outline": False,
        "x_dm": round((centroid.x - ORIGIN_EASTING) * 10),
        "z_dm": round((ORIGIN_NORTHING - centroid.y) * 10),
      }
    )
  bars.sort(key=lambda entry: (entry["x_dm"], entry["z_dm"]))
  return bars


def build_payload(
  bounds_path: Path, osm_path: Path, scene_path: Path
) -> dict[str, Any]:
  verify_scene_origin(scene_path)
  bounds = project_geometry(load_bounds_polygon(bounds_path))
  roads = gpd.read_file(osm_path, layer="roads")
  roads = roads.to_crs(epsg=25833)
  positions, signal_placements = build_traffic_signal_data(
    roads, bounds, open_tunnel_ramp_corridors(scene_path)
  )

  # Monuments and memorials ("alle Denkmäler im Tiergarten"): points and
  # polygon footprints from the OSM POI layer. Polygons keep their bbox
  # size so footprint-aware renderers (the Stelenfeld) know their field.
  pois = gpd.read_file(osm_path, layer="pois").to_crs(epsg=25833)
  monuments: list[dict[str, Any]] = []
  for _, row in pois.iterrows():
    kind = monument_kind(row)
    if kind is None:
      continue
    name = row.get("name")
    name = name if isinstance(name, str) else ""
    if name in MONUMENT_SKIP_NAMES:
      continue
    # An unnamed sculpture is a dot on a map with nothing to recognise.
    if kind == "artwork" and not name:
      continue
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    centroid = geometry.centroid
    if not bounds.contains(centroid):
      continue
    osm_element, osm_id, osm_key = osm_identity(row)
    memorial_type = next(
      (
        value
        for value in (row.get("memorial"), row.get("memorial:type"))
        if isinstance(value, str) and value
      ),
      "",
    )
    min_x, min_y, max_x, max_y = geometry.bounds
    monuments.append(
      {
        "kind": kind,
        "memorial_type": memorial_type,
        "name": name,
        "osm_element": osm_element,
        "osm_id": osm_id,
        "osm_key": osm_key,
        "schwellenraum_protected": schwellenraum_protected(
          kind, name, memorial_type, osm_key
        ),
        "w_dm": round((max_x - min_x) * 10),
        "d_dm": round((max_y - min_y) * 10),
        "x_dm": round((centroid.x - ORIGIN_EASTING) * 10),
        "z_dm": round((ORIGIN_NORTHING - centroid.y) * 10),
      }
    )
  monuments = deduplicate_floraplatz_animals(monuments)
  monuments.sort(key=lambda entry: (entry["x_dm"], entry["z_dm"]))

  water = gpd.read_file(osm_path, layer="water").to_crs(epsg=25833)
  parks = gpd.read_file(osm_path, layer="parks").to_crs(epsg=25833)

  return {
    "beer_gardens": build_beer_gardens(pois, bounds),
    "fuel_stations": build_fuel_stations(pois, roads, bounds),
    "monuments": monuments,
    "riverside_bars": build_riverside_bars(pois, water, parks, bounds),
    "schema_version": SCHEMA_VERSION,
    "source": ATTRIBUTION,
    "traffic_signal_placements": signal_placements,
    "traffic_signals_dm": positions,
  }


def main(argv: list[str] | None = None) -> None:
  parser = argparse.ArgumentParser(
    description="Export OSM traffic signals as viewer street details."
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
  print(
    f"Wrote {args.out} with {len(payload['traffic_signals_dm'])} traffic "
    f"signals, {len(payload['monuments'])} monuments, "
    f"{len(payload['beer_gardens'])} beer gardens and "
    f"{len(payload['riverside_bars'])} riverside bars"
  )


if __name__ == "__main__":
  main()
