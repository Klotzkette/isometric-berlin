"""Source-bound step-10 public realm from Pariser Platz to Friedrichstraße.

This presentation supplement never changes canonical OSM/ALKIS data. Cadastral
parcels anchor the western public-space envelope; mapped outer sidewalk axes
bound the eastern infill. Neither source is claimed to survey pavement material
or every kerb. The local width conflict and procedural dimensions are exported.
All returned geometries use EPSG:25833, including the complete replacement scope.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

import geopandas as gpd
import shapely
from shapely.affinity import rotate
from shapely.geometry import LineString, Point, Polygon, box
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from isometric_berlin.data.common import load_bounds_polygon, project_geometry
from isometric_berlin.generation.build_surface_polygons import (
  DEFAULT_BOUNDS,
  PAVING_PATH_SURFACES,
  line_parts,
  optional_osm_text,
  polygon_parts,
  runs_underground,
  smooth_road_line,
)
from isometric_berlin.generation.road_geometry import (
  VEHICULAR_HIGHWAYS,
  road_width_m,
  road_width_source,
)

ROOT = Path(__file__).resolve().parents[1]
ALKIS = ROOT / "geo_data/regierungsviertel/alkis.gpkg"
OSM = ROOT / "geo_data/regierungsviertel/osm.gpkg"
ORIGIN = (389500.0, 5820000.0)
PARCEL_IDS = ("DEBE01AL23P00005", "DEBE01AL23V0000H")
NORTH_SIDEWALK_IDS = (
  "1171464774",
  "1343486303",
  "1124934333",
  "1158551332",
)
SOUTH_SIDEWALK_IDS = ("1158536779", "1037138981", "1037130999")
MEDIAN_GRASS_IDS = (
  "915958591",
  "915958592",
  "915958603",
  "915958604",
  "915958613",
  "915958614",
)
MEDIAN_GRAVEL_ID = "915958593"
PLAZA_POLYGON_ID = "24240315"
MEDIAN_PAVED_TIP_ID = "915958607"
# A narrow display corridor ends just beyond both Friedrichstraße crossings.
# It overlaps the retained cadastral envelope by about 27 m at its west end.
CORRIDOR_WEST_X_M = 650.0
CORRIDOR_EAST_X_M = 1195.0
SIDEWALK_OUTER_INFILL_M = 2.0
# Missing width tags were interpreted as 2 or 3 vehicle lanes, creating 6.5/9.75m
# steps along this straight avenue. Its mapped median edges lie roughly 7m
# from the carriageway axes. A continuous 14m display band retains those axes;
# exact mapped grass edges clip its medial side. Explicit western 11m tags win.
AVENUE_DISPLAY_WIDTH_M = 14.0
AUTHORED_GARDENS = (
  ((500.7, 334.1), (74.3, 22.6)),
  ((494.2, 254.9), (75.0, 23.0)),
)


def _polygons(geometry: BaseGeometry) -> BaseGeometry:
  """Discard zero-area intersection residues without modifying polygon edges."""
  if geometry.is_empty:
    return Polygon()
  if geometry.geom_type == "GeometryCollection":
    return unary_union([_polygons(part) for part in geometry.geoms])
  return unary_union(polygon_parts(shapely.make_valid(geometry)))


def _exact_rows(frame: gpd.GeoDataFrame, ids: tuple[str, ...]) -> gpd.GeoDataFrame:
  rows = frame[frame["id"].astype(str).isin(ids)]
  if set(rows["id"].astype(str)) != set(ids) or len(rows) != len(ids):
    raise ValueError(f"Expected exact Brandenburg approach OSM ways: {ids}")
  return rows


def _sidewalk_axis(roads: gpd.GeoDataFrame, ids: tuple[str, ...]) -> LineString:
  """Join the mapped long sidewalk axes across their street-crossing gaps."""
  points = sorted(
    {
      (float(x), float(y))
      for geometry in _exact_rows(roads, ids).geometry
      for line in line_parts(geometry)
      for x, y in line.coords
    }
  )
  axis = LineString(points)
  clip = box(
    ORIGIN[0] + CORRIDOR_WEST_X_M,
    5819000,
    ORIGIN[0] + CORRIDOR_EAST_X_M,
    5820000,
  )
  result = axis.intersection(clip)
  if not isinstance(result, LineString):
    raise ValueError("Expected one continuous outer sidewalk axis")
  return result


def _authored_gardens() -> BaseGeometry:
  gardens = []
  for (x, z), (width, depth) in AUTHORED_GARDENS:
    centre = (ORIGIN[0] + x, ORIGIN[1] - z)
    garden = box(
      centre[0] - width / 2,
      centre[1] - depth / 2,
      centre[0] + width / 2,
      centre[1] + depth / 2,
    )
    # Three.js +Y rotation becomes positive planar rotation after Z->northing.
    gardens.append(rotate(garden, 0.087, origin=centre, use_radians=True))
  return unary_union(gardens)


def _hash(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def build_brandenburg_approach(
  roads: gpd.GeoDataFrame,
  parks: gpd.GeoDataFrame,
  *,
  alkis_path: Path = ALKIS,
  osm_path: Path = OSM,
) -> dict[str, Any]:
  """Return bounded terrain-independent street, paving and planted geometries.

  ``scope`` includes every surface class. ``paving``, ``asphalt``, ``gravel``
  and ``grass`` form its non-overlapping partition. ``curbs`` are open metric
  polylines; ``markings_exclusion`` suppresses the older lane-width inference.
  The caller owns terrain sampling, triangulation, rendering and raster masking.
  """
  if roads.crs is None or roads.crs.to_epsg() != 25833:
    raise ValueError("Roads must be supplied in EPSG:25833")
  if parks.crs is None or parks.crs.to_epsg() != 25833:
    raise ValueError("Parks must be supplied in EPSG:25833")
  _exact_rows(roads, (PLAZA_POLYGON_ID, MEDIAN_PAVED_TIP_ID, MEDIAN_GRAVEL_ID))
  _exact_rows(parks, MEDIAN_GRASS_IDS)
  parcels = gpd.read_file(alkis_path, layer="flurstuecke").to_crs(epsg=25833)
  selected_parcels = parcels[parcels["uuid"].isin(PARCEL_IDS)]
  if set(selected_parcels["uuid"]) != set(PARCEL_IDS):
    raise ValueError("Expected both exact Pariser Platz public-realm parcels")
  west = unary_union(selected_parcels.geometry.tolist())
  north_axis = _sidewalk_axis(roads, NORTH_SIDEWALK_IDS)
  south_axis = _sidewalk_axis(roads, SOUTH_SIDEWALK_IDS)
  north_edge = north_axis.offset_curve(SIDEWALK_OUTER_INFILL_M, join_style=2)
  south_edge = south_axis.offset_curve(-SIDEWALK_OUTER_INFILL_M, join_style=2)
  if not isinstance(north_edge, LineString) or not isinstance(south_edge, LineString):
    raise ValueError("Expected single outer sidewalk infill edges")
  corridor = Polygon([*north_edge.coords, *reversed(south_edge.coords)])
  bounds = project_geometry(load_bounds_polygon(DEFAULT_BOUNDS))
  scope = _polygons(west.union(corridor).intersection(bounds))
  gardens = _authored_gardens().intersection(scope)
  local_parks = parks[parks.geometry.intersects(scope)]
  grass = _polygons(unary_union([*local_parks.geometry, gardens]).intersection(scope))

  local_roads = roads[roads.geometry.intersects(scope.buffer(25))]
  motor_bands: list[BaseGeometry] = []
  crossing_bands: list[BaseGeometry] = []
  gravel_polygons: list[BaseGeometry] = []
  asphalt_polygons: list[BaseGeometry] = []
  mapped_paving_polygons: list[BaseGeometry] = []
  used_roads: list[dict[str, Any]] = []
  used_polygons: list[dict[str, Any]] = []
  graph: dict[tuple[float, float], set[tuple[float, float]]] = {}
  graph_widths: dict[tuple[float, float], float] = {}
  for _, row in local_roads.iterrows():
    highway = row.get("highway")
    if runs_underground(row) or any(
      optional_osm_text(row.get(key)) not in (None, "no")
      for key in ("bridge", "covered", "tunnel")
    ):
      continue
    surface = optional_osm_text(row.get("surface"))
    polygons = polygon_parts(row.geometry)
    if polygons and highway in {"footway", "pedestrian"}:
      clipped = _polygons(row.geometry.intersection(scope))
      if clipped.is_empty:
        continue
      used_polygons.append({"id": str(row["id"]), "surface": surface})
      if surface in {"fine_gravel", "gravel", "compacted", "sand"}:
        gravel_polygons.append(clipped)
      elif surface == "asphalt":
        asphalt_polygons.append(clipped)
      elif surface in PAVING_PATH_SURFACES:
        mapped_paving_polygons.append(clipped)
      continue
    width = road_width_m(row)
    if width is None:
      continue
    is_motor = highway in VEHICULAR_HIGHWAYS
    source_width = width
    evidence = road_width_source(row)
    avenue_inference = (
      is_motor
      and row.get("name") == "Unter den Linden"
      and evidence not in {"width", "est_width"}
    )
    if avenue_inference:
      width = AVENUE_DISPLAY_WIDTH_M
    for line in line_parts(row.geometry):
      if line.length < 0.25:
        continue
      band = smooth_road_line(line).buffer(
        width / 2,
        cap_style=2,
        join_style=1,
        quad_segs=16,
      )
      clipped = band.intersection(scope)
      if clipped.is_empty:
        continue
      if not is_motor:
        # Open every mapped pedestrian approach, including untagged crossings.
        crossing_bands.append(band.buffer(0.35))
        continue
      used_roads.append(
        {
          "id": str(row["id"]),
          "name": row["name"] if isinstance(row.get("name"), str) else "",
          "source_width_m": source_width,
          "source_width_evidence": evidence,
          "display_width_m": width,
          "display_width_inference": avenue_inference,
          "surface": surface,
        }
      )
      if surface in PAVING_PATH_SURFACES:
        # Setts around Pariser Platz remain part of the continuous paving.
        continue
      if surface in {"fine_gravel", "gravel", "compacted", "sand", "earth"}:
        gravel_polygons.append(clipped)
        continue
      motor_bands.append(band)
      coords = [(round(x, 3), round(y, 3)) for x, y in line.coords]
      for a, b in zip(coords, coords[1:]):
        graph.setdefault(a, set()).add(b)
        graph.setdefault(b, set()).add(a)
        graph_widths[a] = max(graph_widths.get(a, 0), width)
        graph_widths[b] = max(graph_widths.get(b, 0), width)

  gravel = _polygons(unary_union(gravel_polygons).intersection(scope).difference(grass))
  mapped_paving = unary_union(mapped_paving_polygons)
  asphalt = _polygons(
    unary_union([*motor_bands, *asphalt_polygons])
    .intersection(scope)
    .difference(unary_union([grass, gravel, mapped_paving]))
  )
  paving = _polygons(scope.difference(unary_union([grass, gravel, asphalt])))
  # Only asphalt owns road kerbs. Setted plaza service axes must not introduce
  # transverse barriers across the central pedestrian circulation or gardens.
  curbs = asphalt.boundary.intersection(scope.buffer(-0.30))
  if crossing_bands:
    curbs = curbs.difference(unary_union(crossing_bands))
  junctions = unary_union(
    [
      Point(point).buffer(max(5.0, graph_widths[point] / 2 + 1.5))
      for point, neighbours in graph.items()
      if len(neighbours) >= 3
    ]
  )
  # A source way-end at a material change is an open connection, not a kerb.
  open_ends = unary_union(
    [
      Point(point).buffer(graph_widths[point] / 2 + 0.40)
      for point, neighbours in graph.items()
      if len(neighbours) == 1
    ]
  )
  curbs = curbs.difference(junctions.union(open_ends))
  ids = sorted({row["id"] for row in used_roads})
  source = {
    "name": "Pariser Platz and western Unter den Linden public realm",
    "crs": "EPSG:25833",
    "osm_sha256": _hash(osm_path),
    "alkis_sha256": _hash(alkis_path),
    "alkis_parcel_uuids": list(PARCEL_IDS),
    "osm_road_ids": ids,
    "osm_polygon_surfaces": sorted(used_polygons, key=lambda entry: entry["id"]),
    "osm_park_ids": sorted(local_parks["id"].astype(str).tolist()),
    "outer_sidewalk_ids": {
      "north": list(NORTH_SIDEWALK_IDS),
      "south": list(SOUTH_SIDEWALK_IDS),
    },
    "median_grass_ids": list(MEDIAN_GRASS_IDS),
    "median_gravel_id": MEDIAN_GRAVEL_ID,
    "plaza_polygon_id": PLAZA_POLYGON_ID,
    "median_paved_tip_id": MEDIAN_PAVED_TIP_ID,
    "road_widths": sorted(used_roads, key=lambda entry: entry["id"]),
    "scope_policy": (
      "Exact western ALKIS cadastral envelope, interpreted using OSM public-space "
      "context; eastern envelope follows mapped outer sidewalk axes through "
      "Friedrichstraße, with 2m outward display infill and straight joins across "
      "crossings. This is not a cadastral extension or paving survey."
    ),
    "surface_policy": (
      "OSM planted and gravel polygons retain exact edges; the remaining public "
      "realm receives inferred continuous paving outside source asphalt. Full "
      "authored Pariser garden rectangles remain excluded from paving."
    ),
    "mapped_surface_overlap_m2": round(
      mapped_paving.intersection(grass.union(gravel)).area,
      6,
    ),
    "mapped_surface_overlap_policy": (
      "Tiny overlaps between independently mapped paved, grass and gravel "
      "polygons retain grass/gravel edges; mapped paving takes priority over "
      "inferred buffered asphalt. Source polygons are preserved in OSM."
    ),
    "width_conflict": (
      "Missing Unter den Linden width tags previously yielded alternating "
      "6.5/9.75m lane-only bands. The retained axes and roughly 7m distance to "
      "mapped median edges support a constant 14m display envelope, clipped "
      "to exact grass boundaries. Explicit western 11m widths remain. The "
      "14m envelope is display inference, not a measured width replacement."
    ),
    "sidewalk_outward_infill_m": SIDEWALK_OUTER_INFILL_M,
    "avenue_inferred_width_m": AVENUE_DISPLAY_WIDTH_M,
    "authored_garden_rotation_radians": 0.087,
    "authored_gardens_world_m": [
      {"centre": list(centre), "size": list(size)} for centre, size in AUTHORED_GARDENS
    ],
    "height_policy": "Retain the committed bilinear DGM grade; no flattening",
    "licenses": {"osm": "ODbL-1.0", "alkis": "dl-de/zero-2-0"},
    "references": [
      "https://www.openstreetmap.org/way/24240315",
      "https://www.openstreetmap.org/way/915958593",
      "https://www.openstreetmap.org/way/915958607",
      "https://gdi.berlin.de/services/wfs/alkis",
    ],
  }
  return {
    "scope": scope,
    "plaza_scope": selected_parcels[
      selected_parcels["uuid"] == PARCEL_IDS[0]
    ].geometry.iloc[0],
    "asphalt": asphalt,
    "paving": paving,
    "gravel": gravel,
    "grass": grass,
    "curbs": curbs,
    "markings_exclusion": scope,
    "source": source,
  }
