"""Build the street-details payload (task 07: animated traffic lights).

Exports every OSM ``highway=traffic_signals`` node inside the
Regierungsviertel bounds as viewer world coordinates. The viewer snaps
each signal to the surveyed ground grid it already loads and animates
the German phase sequence itself, so the payload stays a tiny list of
positions.

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
DEFAULT_OUT = MESH_PUBLIC_DIR / "street-details.json"
SCHEMA_VERSION = 6

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
    raise ValueError(f"Monument row has no stable OSM element: {element!r}")
  if not isinstance(osm_id, str) or not osm_id:
    raise ValueError(f"Monument row has no stable OSM id: {osm_id!r}")
  return element, osm_id, f"{element}/{osm_id}"


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
  signals = roads[
    (roads["highway"] == "traffic_signals") & (roads.geometry.geom_type == "Point")
  ]
  positions: list[list[int]] = []
  for point in signals.geometry:
    if not bounds.contains(point):
      continue
    # Decimetre integers, matching the other payloads.
    positions.append(
      [
        round((point.x - ORIGIN_EASTING) * 10),
        round((ORIGIN_NORTHING - point.y) * 10),
      ]
    )
  positions.sort()

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
