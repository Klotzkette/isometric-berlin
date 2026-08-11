"""Classify Berlin water and recover the sunken walls that run into basins.

Two builders need the same answer to the same two questions, so the answer
lives here rather than in either of them.

**Which water is where?** Rivers/canals use the Spree table, built basins use
their local rim, and natural park ponds use a robust local low-bank level.
Keeping those three classes separate prevents the Invalidenpark fountain from
disappearing under its lawn and prevents Neuer See or Venusbassin from gaining
invented vertical concrete walls. Narrow mapped Tiergarten streams and ditches
are buffered only inside the OSM Großer-Tiergarten polygon; mapped widths win
and conservative display widths are used only where OSM has none.

**Where is the sunken wall?** Christophe Girot's *Sinkende Mauer* (1997) in
the Invalidenpark is mapped as two overlapping OSM ways: the artwork way is
the full basin rectangle, and the water way is that same rectangle with a
narrow slot cut out of it. The slot IS the wall — the mapper cut the wall's
footprint out of the water because the wall displaces it. So the wall needs
no invented geometry at all: it is ``artwork − water``, and its long axis
runs from the basin rim out to the high point where the wall breaks off
into the water.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import geopandas as gpd
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Point, Polygon
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

# `water=*` values that describe a built basin rather than a water body
# sitting at the groundwater table. `pond` is deliberately NOT here: the
# Neuer See and the Tiergarten ponds are natural water bodies rather than
# constructed architectural basins; their level must follow their own banks.
BASIN_WATER_VALUES = frozenset({"basin", "reflecting_pool", "reservoir"})
POND_WATER_VALUES = frozenset({"lake", "pond"})
TIERGARTEN_LINEAR_WATERWAYS = frozenset({"ditch", "stream"})
LINE_WATERWAY_WIDTH_M = {"ditch": 0.8, "stream": 1.4}
MIN_LINE_WATERWAY_WIDTH_M = 0.4
MAX_LINE_WATERWAY_WIDTH_M = 8.0
# Below this a fountain is a drinking spout or a jet in a paved square, not
# a basin with a readable water surface at this scale.
MIN_FOUNTAIN_AREA_M2 = 40.0
# A wall slot has to be long and thin. A blob of leftover area between two
# sloppily drawn rings is not a wall.
MIN_WALL_AREA_M2 = 8.0
MAX_WALL_WIDTH_M = 6.0
MIN_WALL_SLENDERNESS = 3.0
# The artwork ring has to be essentially the basin, not merely touching it.
MIN_ARTWORK_OVERLAP = 0.5


def tag(row: Any, key: str) -> str:
  """Read an OSM tag as a string, tolerating NaN from the GDAL columns."""
  value = row.get(key)
  return value if isinstance(value, str) else ""


def is_basin(row: Any) -> bool:
  """True for a constructed basin whose water sits at local ground level."""
  return (
    tag(row, "amenity") == "fountain"
    or tag(row, "water") in BASIN_WATER_VALUES
    or tag(row, "man_made") == "water_basin"
  )


def is_pond(row: Any, geometry: BaseGeometry, tiergarten: BaseGeometry) -> bool:
  """True for natural still water, including untyped water in Tiergarten."""
  if tag(row, "water") in POND_WATER_VALUES:
    return True
  if tiergarten.is_empty or tag(row, "waterway") in {"canal", "river"}:
    return False
  return tag(row, "natural") == "water" and tiergarten.contains(
    geometry.representative_point()
  )


def _mapped_width_m(row: Any, waterway: str) -> float:
  """Mapped width, or a conservative display width for a line waterway."""
  match = re.search(r"\d+(?:[.,]\d+)?", tag(row, "width"))
  width = (
    float(match.group(0).replace(",", "."))
    if match
    else LINE_WATERWAY_WIDTH_M[waterway]
  )
  return min(MAX_LINE_WATERWAY_WIDTH_M, max(MIN_LINE_WATERWAY_WIDTH_M, width))


def polygon_parts(geometry: BaseGeometry) -> list[Polygon]:
  if isinstance(geometry, Polygon):
    return [geometry]
  if isinstance(geometry, MultiPolygon):
    return list(geometry.geoms)
  return []


@dataclass(frozen=True)
class WaterFeature:
  """One water polygon plus the classification the renderers need."""

  geometry: BaseGeometry
  kind: str
  name: str


def load_water_features(osm_path: Any) -> list[WaterFeature]:
  """Water surfaces classified as river, pond, stream or built basin.

  Documented fountain basins that OSM mapped only as ``amenity=fountain``
  under a POI — with no ``natural=water`` — are folded in here too, so a
  basin draws as water wherever it is documented as one.
  """
  features: list[WaterFeature] = []
  seen: set[str] = set()
  parks = gpd.read_file(osm_path, layer="parks").to_crs(epsg=25833)
  tiergarten_parts = [
    row.geometry
    for _, row in parks.iterrows()
    if tag(row, "name") == "Großer Tiergarten"
    and row.geometry is not None
    and not row.geometry.is_empty
  ]
  tiergarten = unary_union(tiergarten_parts)
  water = gpd.read_file(osm_path, layer="water").to_crs(epsg=25833)
  polygon_water: list[BaseGeometry] = []
  for _, row in water.iterrows():
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    if not polygon_parts(geometry):
      continue
    polygon_water.append(geometry)
    seen.add(tag(row, "id"))
    kind = (
      "basin"
      if is_basin(row)
      else "pond"
      if is_pond(row, geometry, tiergarten)
      else "river"
    )
    features.append(
      WaterFeature(
        geometry=geometry,
        kind=kind,
        name=tag(row, "name"),
      )
    )

  # OSM's small Tiergarten drainage network is mapped as centrelines. It was
  # previously discarded because only polygons reached the surface payload.
  # Restrict buffering to the park polygon and remove already mapped water so
  # this adds the missing links without widening ponds or the Spree.
  polygon_union = unary_union(polygon_water)
  if not tiergarten.is_empty:
    for _, row in water.iterrows():
      geometry = row.geometry
      waterway = tag(row, "waterway")
      if (
        geometry is None
        or geometry.is_empty
        or not isinstance(geometry, (LineString, MultiLineString))
        or waterway not in TIERGARTEN_LINEAR_WATERWAYS
      ):
        continue
      clipped = geometry.intersection(tiergarten)
      if clipped.is_empty:
        continue
      surface = clipped.buffer(
        _mapped_width_m(row, waterway) / 2,
        cap_style=1,
        join_style=1,
      ).difference(polygon_union)
      for part in polygon_parts(surface):
        if part.area < 2.0:
          continue
        features.append(
          WaterFeature(geometry=part, kind="stream", name=tag(row, "name"))
        )
  pois = gpd.read_file(osm_path, layer="pois").to_crs(epsg=25833)
  for _, row in pois.iterrows():
    if tag(row, "amenity") != "fountain" or tag(row, "id") in seen:
      continue
    geometry = row.geometry
    if geometry is None or geometry.is_empty:
      continue
    if not polygon_parts(geometry) or geometry.area < MIN_FOUNTAIN_AREA_M2:
      continue
    features.append(
      WaterFeature(geometry=geometry, kind="basin", name=tag(row, "name"))
    )
  return features


@dataclass(frozen=True)
class SunkenWall:
  """A wedge-shaped wall slab rising out of the ground into a basin.

  Girot's *Sinkende Mauer* is a wedge, not a slab of even height: it starts
  flush with the paving on the rim, where you step onto the walkway on its
  crown, and climbs steadily to a high point out in the basin, where it
  breaks off in a near-vertical face and drops into the water.

  ``foot_end`` is the end on the rim, at ground level; ``crest_end`` is the
  high tip inside the basin.
  """

  crest_end: tuple[float, float]
  foot_end: tuple[float, float]
  geometry: Polygon
  name: str
  width_m: float


def _axis_and_width(
  part: Polygon,
) -> tuple[tuple[float, float], tuple[float, float], float] | None:
  """Long-axis endpoints and short-side width of a thin slab."""
  rectangle = part.minimum_rotated_rectangle
  if not isinstance(rectangle, Polygon):
    return None
  corners = list(rectangle.exterior.coords)[:4]
  if len(corners) != 4:
    return None
  edges = [
    (
      corners[index],
      corners[(index + 1) % 4],
      _distance(corners[index], corners[(index + 1) % 4]),
    )
    for index in range(4)
  ]
  short = min(edges, key=lambda edge: edge[2])
  width = short[2]
  if width <= 0:
    return None
  # The two short sides are opposite each other; their midpoints define the
  # long axis regardless of which corner the rectangle started at.
  shorts = sorted(edges, key=lambda edge: edge[2])[:2]
  first = _midpoint(shorts[0][0], shorts[0][1])
  second = _midpoint(shorts[1][0], shorts[1][1])
  length = _distance(first, second)
  if length < width * MIN_WALL_SLENDERNESS:
    return None
  return first, second, width


def _midpoint(a: tuple[float, float], b: tuple[float, float]) -> tuple[float, float]:
  return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)


def _distance(a: tuple[float, float], b: tuple[float, float]) -> float:
  return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


def derive_sunken_walls(
  osm_path: Any, water_features: list[WaterFeature]
) -> list[SunkenWall]:
  """Sunken walls, as the part of an artwork ring the basin water excludes.

  The mapper cut the wall's footprint out of the water polygon because the
  wall stands where the water would be, so the difference between the two
  rings recovers the wall exactly. Nothing here is invented geometry.
  """
  basins = [feature.geometry for feature in water_features if feature.kind == "basin"]
  if not basins:
    return []
  basin_union = unary_union(basins)
  pois = gpd.read_file(osm_path, layer="pois").to_crs(epsg=25833)
  walls: list[SunkenWall] = []
  for _, row in pois.iterrows():
    if tag(row, "tourism") != "artwork" and tag(row, "man_made") != "wall":
      continue
    artwork = row.geometry
    if artwork is None or artwork.is_empty or not polygon_parts(artwork):
      continue
    overlap = artwork.intersection(basin_union)
    if overlap.is_empty or overlap.area < artwork.area * MIN_ARTWORK_OVERLAP:
      continue
    remainder = artwork.difference(basin_union)
    for part in polygon_parts(remainder):
      if part.area < MIN_WALL_AREA_M2:
        continue
      axis = _axis_and_width(part)
      if axis is None:
        continue
      first, second, width = axis
      if width > MAX_WALL_WIDTH_M:
        continue
      # The end standing on the rim lies ON the artwork's outer ring; the
      # high tip is out in the middle of the basin, far from it.
      rim = artwork.exterior
      foot, crest = (
        (first, second)
        if rim.distance(Point(first)) <= rim.distance(Point(second))
        else (second, first)
      )
      walls.append(
        SunkenWall(
          crest_end=crest,
          foot_end=foot,
          geometry=part,
          name=tag(row, "name"),
          width_m=width,
        )
      )
  walls.sort(key=lambda wall: -wall.geometry.area)
  return walls
