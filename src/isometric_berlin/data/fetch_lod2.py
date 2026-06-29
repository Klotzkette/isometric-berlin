"""Fetch and clip Berlin LoD2 CityGML to the Regierungsviertel bounds.

Pipeline step 2 (see ``AGENTS.md`` §5). The script downloads only the
1 km LoD2 tiles intersecting ``bounds.geojson``, stores the raw ZIPs
under ``geo_data/regierungsviertel/raw/lod2/`` (gitignored), parses
CityGML ``GroundSurface`` footprints, clips them to the bounds polygon,
and writes ``buildings.gpkg``.

Source data: Geoportal Berlin / FIS-Broker LoD2 ATOM service.
License: dl-de/zero-2-0 (https://www.govdata.de/dl-de/zero-2-0).
No Google APIs are used by this pipeline step.
"""

from __future__ import annotations

import argparse
import json
import math
import zipfile
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, BinaryIO
from xml.etree import ElementTree as ET

import geopandas as gpd
import requests
from pyproj import Transformer
from shapely import make_valid
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon, box, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform, unary_union

ATOM_TILE_BASE = "https://gdi.berlin.de/data/a_lod2/atom"
WGS84 = "EPSG:4326"
BERLIN_PROJECTED = "EPSG:25833"

NS = {
  "bldg": "http://www.opengis.net/citygml/building/1.0",
  "gen": "http://www.opengis.net/citygml/generics/1.0",
  "gml": "http://www.opengis.net/gml",
}
GML_ID = f"{{{NS['gml']}}}id"


@dataclass(frozen=True, order=True)
class Lod2Tile:
  """One Berlin LoD2 1 km tile in EPSG:25833 kilometre indices."""

  x: int
  y: int

  @property
  def tile_id(self) -> str:
    return f"{self.x}_{self.y}"

  @property
  def filename(self) -> str:
    return f"LoD2_{self.tile_id}.zip"

  @property
  def url(self) -> str:
    return f"{ATOM_TILE_BASE}/{self.filename}"

  @property
  def bounds(self) -> Polygon:
    return box(self.x * 1000, self.y * 1000, (self.x + 1) * 1000, (self.y + 1) * 1000)


def load_bounds_polygon(bounds_path: Path) -> Polygon:
  """Load the first polygon feature from a GeoJSON bounds file."""
  payload = json.loads(bounds_path.read_text(encoding="utf-8"))
  if payload.get("type") == "FeatureCollection":
    geometry = payload["features"][0]["geometry"]
  elif payload.get("type") == "Feature":
    geometry = payload["geometry"]
  else:
    geometry = payload
  polygon = shape(geometry)
  if not isinstance(polygon, Polygon):
    raise ValueError(f"Expected a Polygon in {bounds_path}")
  if not polygon.is_valid:
    raise ValueError(f"Bounds polygon is invalid in {bounds_path}")
  return polygon


def project_to_berlin(geometry: BaseGeometry) -> BaseGeometry:
  """Project WGS84 geometry to Berlin's official EPSG:25833 CRS."""
  transformer = Transformer.from_crs(WGS84, BERLIN_PROJECTED, always_xy=True)
  return transform(transformer.transform, geometry)


def tiles_for_bounds(bounds_path: Path) -> list[Lod2Tile]:
  """Return the smallest 1 km LoD2 tile set intersecting the bounds."""
  bounds = project_to_berlin(load_bounds_polygon(bounds_path))
  minx, miny, maxx, maxy = bounds.bounds
  tiles: list[Lod2Tile] = []
  for x in range(math.floor(minx / 1000), math.floor(maxx / 1000) + 1):
    for y in range(math.floor(miny / 1000), math.floor(maxy / 1000) + 1):
      tile = Lod2Tile(x, y)
      if bounds.intersects(tile.bounds):
        tiles.append(tile)
  return sorted(tiles)


def download_tiles(
  tiles: Iterable[Lod2Tile],
  raw_dir: Path,
  *,
  timeout: int = 120,
  session: requests.Session | None = None,
) -> list[Path]:
  """Download LoD2 ZIPs into ``raw_dir`` and return local paths."""
  raw_dir.mkdir(parents=True, exist_ok=True)
  # Close a session we create ourselves; never close an injected one.
  owns_client = session is None
  client = session or requests.Session()
  paths: list[Path] = []
  try:
    for tile in tiles:
      path = raw_dir / tile.filename
      if path.exists() and path.stat().st_size > 0:
        paths.append(path)
        continue
      response = client.get(tile.url, timeout=timeout)
      if response.status_code == 404:
        continue
      response.raise_for_status()
      tmp = path.with_suffix(path.suffix + ".tmp")
      tmp.write_bytes(response.content)
      tmp.replace(path)
      paths.append(path)
  finally:
    if owns_client:
      client.close()
  return paths


def parse_poslist(poslist: ET.Element) -> list[tuple[float, float]]:
  """Parse a GML posList into 2D coordinates, ignoring height values."""
  values = [float(value) for value in (poslist.text or "").split()]
  dimension = int(poslist.attrib.get("srsDimension", "3"))
  if dimension < 2:
    raise ValueError("GML posList must have at least 2 dimensions")
  coords = [
    (values[index], values[index + 1])
    for index in range(0, len(values) - dimension + 1, dimension)
  ]
  if len(coords) >= 3 and coords[0] != coords[-1]:
    coords.append(coords[0])
  return coords


def polygon_from_gml(gml_polygon: ET.Element) -> Polygon | None:
  """Extract a 2D Shapely polygon from a GML Polygon element."""
  exterior = gml_polygon.find("gml:exterior", NS)
  if exterior is None:
    return None
  exterior_poslist = exterior.find(".//gml:posList", NS)
  if exterior_poslist is None:
    return None
  shell = parse_poslist(exterior_poslist)
  if len(shell) < 4:
    return None

  holes: list[list[tuple[float, float]]] = []
  for interior in gml_polygon.findall("gml:interior", NS):
    interior_poslist = interior.find(".//gml:posList", NS)
    if interior_poslist is None:
      continue
    ring = parse_poslist(interior_poslist)
    if len(ring) >= 4:
      holes.append(ring)

  polygon = Polygon(shell, holes)
  if polygon.is_empty:
    return None
  valid = make_valid(polygon) if not polygon.is_valid else polygon
  polygons = list(polygons_from_geometry(valid))
  if not polygons:
    return None
  return max(polygons, key=lambda part: part.area)


def polygons_from_geometry(geometry: BaseGeometry) -> Iterable[Polygon]:
  """Yield polygon parts from a Shapely geometry."""
  if geometry.is_empty:
    return
  if isinstance(geometry, Polygon):
    yield geometry
  elif isinstance(geometry, MultiPolygon):
    yield from geometry.geoms
  elif isinstance(geometry, GeometryCollection):
    for part in geometry.geoms:
      yield from polygons_from_geometry(part)


def building_footprint(building: ET.Element) -> BaseGeometry | None:
  """Return the union of all LoD2 ground-surface polygons for a building."""
  parts: list[Polygon] = []
  for ground in building.findall(".//bldg:GroundSurface", NS):
    for gml_polygon in ground.findall(".//gml:Polygon", NS):
      polygon = polygon_from_gml(gml_polygon)
      if polygon is not None:
        parts.append(polygon)
  if not parts:
    parts.extend(terrain_intersection_footprints(building))
  if not parts:
    return None
  union = unary_union(parts)
  return make_valid(union) if not union.is_valid else union


def terrain_intersection_footprints(building: ET.Element) -> list[Polygon]:
  """Fallback footprints from ``lod2TerrainIntersection`` line strings."""
  parts: list[Polygon] = []
  for poslist in building.findall(".//bldg:lod2TerrainIntersection//gml:posList", NS):
    coords = parse_poslist(poslist)
    if len(coords) < 4:
      continue
    polygon = Polygon(coords)
    if not polygon.is_empty:
      valid = make_valid(polygon) if not polygon.is_valid else polygon
      parts.extend(polygons_from_geometry(valid))
  return parts


def text_at(element: ET.Element, path: str) -> str | None:
  """Return stripped text for a namespaced child path."""
  value = element.findtext(path, namespaces=NS)
  if value is None:
    return None
  value = value.strip()
  return value or None


def float_at(element: ET.Element, path: str) -> float | None:
  """Return a float value for a namespaced child path, if parseable."""
  value = text_at(element, path)
  if value is None:
    return None
  try:
    return float(value)
  except ValueError:
    return None


def generic_attributes(building: ET.Element) -> dict[str, str]:
  """Extract selected CityGML generic string attributes."""
  values: dict[str, str] = {}
  for attribute in building.findall("gen:stringAttribute", NS):
    name = attribute.attrib.get("name")
    value = text_at(attribute, "gen:value")
    if name and value:
      values[name] = value
  return values


def parse_buildings_from_xml(
  source: BinaryIO,
  *,
  tile: Lod2Tile,
  source_zip: Path,
  clip_polygon: BaseGeometry,
) -> list[dict[str, Any]]:
  """Parse one CityGML XML stream into clipped building records."""
  records: list[dict[str, Any]] = []
  for _, element in ET.iterparse(source, events=("end",)):
    if element.tag != f"{{{NS['bldg']}}}Building":
      continue
    footprint = building_footprint(element)
    if footprint is None:
      element.clear()
      continue
    clipped = footprint.intersection(clip_polygon)
    if clipped.is_empty:
      element.clear()
      continue

    attrs = generic_attributes(element)
    records.append(
      {
        "building_id": element.attrib.get(GML_ID),
        "tile_id": tile.tile_id,
        "function": text_at(element, "bldg:function"),
        "roof_type": text_at(element, "bldg:roofType"),
        "measured_height_m": float_at(element, "bldg:measuredHeight"),
        "ground_plan_date": attrs.get("Grundrissaktualitaet"),
        "roof_height_source": attrs.get("DatenquelleDachhoehe"),
        "position_source": attrs.get("DatenquelleLage"),
        "source_zip": str(source_zip),
        "source_url": tile.url,
        "geometry": clipped,
      }
    )
    element.clear()
  return records


def parse_zip(
  zip_path: Path, tile: Lod2Tile, clip_polygon: BaseGeometry
) -> list[dict[str, Any]]:
  """Parse all XML/GML files in one LoD2 ZIP."""
  records: list[dict[str, Any]] = []
  with zipfile.ZipFile(zip_path) as archive:
    for member in archive.namelist():
      if not member.lower().endswith((".xml", ".gml", ".citygml")):
        continue
      with archive.open(member) as source:
        records.extend(
          parse_buildings_from_xml(
            source,
            tile=tile,
            source_zip=zip_path,
            clip_polygon=clip_polygon,
          )
        )
  return records


def build_building_geodataframe(records: list[dict[str, Any]]) -> gpd.GeoDataFrame:
  """Build a projected GeoDataFrame for clipped LoD2 records."""
  if not records:
    raise ValueError("No LoD2 buildings intersect the supplied bounds")
  gdf = gpd.GeoDataFrame(records, geometry="geometry", crs=BERLIN_PROJECTED)
  gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
  if gdf.empty:
    raise ValueError("No non-empty LoD2 building geometries after clipping")
  return gdf


def write_buildings(gdf: gpd.GeoDataFrame, out_path: Path) -> None:
  """Write clipped LoD2 buildings to a GeoPackage."""
  out_path.parent.mkdir(parents=True, exist_ok=True)
  if out_path.exists():
    out_path.unlink()
  gdf.to_file(out_path, layer="buildings", driver="GPKG")


def fetch_lod2(
  bounds_path: Path, out_path: Path, raw_dir: Path | None = None
) -> gpd.GeoDataFrame:
  """Download, parse, clip, and write Berlin LoD2 buildings."""
  raw = raw_dir or bounds_path.parent / "raw" / "lod2"
  projected_bounds = project_to_berlin(load_bounds_polygon(bounds_path))
  tiles = tiles_for_bounds(bounds_path)
  if not tiles:
    raise ValueError(f"No LoD2 tiles intersect {bounds_path}")

  zip_paths = download_tiles(tiles, raw)
  tile_by_name = {tile.filename: tile for tile in tiles}
  records: list[dict[str, Any]] = []
  for zip_path in zip_paths:
    tile = tile_by_name[zip_path.name]
    records.extend(parse_zip(zip_path, tile, projected_bounds))

  gdf = build_building_geodataframe(records)
  write_buildings(gdf, out_path)
  return gdf


def main() -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--bounds", type=Path, required=True)
  parser.add_argument("--out", type=Path, required=True)
  parser.add_argument(
    "--raw-dir",
    type=Path,
    help="Raw LoD2 ZIP destination; defaults to <bounds-dir>/raw/lod2.",
  )
  args = parser.parse_args()

  gdf = fetch_lod2(args.bounds, args.out, args.raw_dir)
  print(f"Wrote {len(gdf)} LoD2 building footprints to {args.out}")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
