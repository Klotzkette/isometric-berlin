"""Build a bounded OSM building fallback for the expanded context rings.

Berlin LoD2 remains the authoritative building source.  This step-3 sidecar
exists only because the official LoD2 and ALKIS endpoints were unavailable
during the owner-approved task-12/task-13 bounds expansions. It reads the current
Geofabrik Berlin extract (ODbL 1.0), removes every OSM footprint whose
representative point is already covered by LoD2, and writes only the remaining
context buildings.

OSM height evidence is ranked explicitly:

1. ``height`` in metres;
2. ``building:levels`` at a conservative 3.0 m per storey plus 1.5 m per
   mapped ``roof:levels``;
3. a deliberately conservative display fallback by ``building`` class.

The third case is not a measured height.  Every row records its
``height_source`` so downstream users can distinguish it from source evidence.
Floating ``min_height`` volumes are omitted because the current prism payload
has no base-height field and would otherwise turn bridges or elevated roofs
into solid walls.

Source: https://download.geofabrik.de/europe/germany/berlin.html
License: © OpenStreetMap contributors, ODbL 1.0.
"""

from __future__ import annotations

import argparse
import math
import re
from pathlib import Path
from typing import Any

import geopandas as gpd
from pandas import Series
from shapely.geometry import GeometryCollection, MultiPolygon, Polygon
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from isometric_berlin.data.common import (
  BERLIN_PROJECTED,
  load_bounds_polygon,
  project_geometry,
)
from isometric_berlin.data.fetch_osm import parse_hstore

GEOFABRIK_BERLIN_URL = "https://download.geofabrik.de/europe/germany/berlin.html"
CONTEXT_FILENAME = "osm_context_buildings.gpkg"
LEVEL_HEIGHT_M = 3.0
ROOF_LEVEL_HEIGHT_M = 1.5
MIN_VISIBLE_HEIGHT_M = 1.0
MAX_PLAUSIBLE_HEIGHT_M = 400.0

# These are display defaults, not surveyed values.  Values stay intentionally
# low so uncertain outer-context massing does not dominate measured LoD2.
BUILDING_CLASS_FALLBACK_M: dict[str, float] = {
  "roof": 3.0,
  "shed": 3.0,
  "hut": 3.0,
  "kiosk": 3.2,
  "garage": 3.2,
  "garages": 3.2,
  "greenhouse": 3.5,
  "service": 4.0,
  "farm_auxiliary": 5.0,
  "industrial": 7.0,
  "warehouse": 7.0,
  "retail": 7.0,
  "commercial": 9.0,
  "school": 9.0,
  "kindergarten": 7.0,
  "house": 8.0,
  "detached": 8.0,
  "semidetached_house": 8.0,
  "terrace": 8.0,
  "residential": 10.0,
  "apartments": 10.0,
  "hotel": 11.0,
  "office": 11.0,
  "hospital": 11.0,
  "government": 11.0,
  "train_station": 12.0,
  "church": 14.0,
  "cathedral": 18.0,
  "tower": 18.0,
  "yes": 9.0,
}
DEFAULT_BUILDING_HEIGHT_M = BUILDING_CLASS_FALLBACK_M["yes"]

ROOF_TYPE_BY_OSM_SHAPE = {
  "flat": "1000",
  "skillion": "2100",
  "gabled": "3100",
  "hipped": "3200",
  "half_hipped": "3300",
  "mansard": "3400",
  "pyramidal": "3500",
  "dome": "5200",
  "onion": "5300",
}
UNKNOWN_ROOF_TYPE = "9999"

PROMOTED_TAGS = (
  "height",
  "building:levels",
  "roof:levels",
  "min_height",
  "building:part",
  "roof:shape",
)

_METRIC_LENGTH = re.compile(
  r"^\s*([+]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*(m|metre|metres|meter|meters)?\s*$",
  re.IGNORECASE,
)
_IMPERIAL_LENGTH = re.compile(
  r"^\s*(\d+(?:[.,]\d+)?)\s*(?:ft|feet|foot|')\s*$", re.IGNORECASE
)
_NUMBER = re.compile(r"^\s*([+]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*$")


def text_value(value: object, default: str = "") -> str:
  """Return a stripped OSM tag value without leaking pandas missing values."""
  if value is None:
    return default
  try:
    if bool(value != value):  # NaN / pandas.NA
      return default
  except (TypeError, ValueError):
    return default
  result = str(value).strip()
  return result if result and result.lower() not in {"nan", "none", "<na>"} else default


def parse_length_m(value: object) -> float | None:
  """Parse one unambiguous OSM metric or imperial length."""
  text = text_value(value)
  if not text:
    return None
  match = _METRIC_LENGTH.fullmatch(text)
  factor = 1.0
  if match is None:
    match = _IMPERIAL_LENGTH.fullmatch(text)
    factor = 0.3048
  if match is None:
    return None
  parsed = float(match.group(1).replace(",", ".")) * factor
  if not math.isfinite(parsed) or parsed < 0:
    return None
  return parsed


def parse_levels(value: object) -> float | None:
  """Parse a single non-negative OSM level count."""
  text = text_value(value)
  match = _NUMBER.fullmatch(text)
  if match is None:
    return None
  parsed = float(match.group(1).replace(",", "."))
  if not math.isfinite(parsed) or parsed < 0 or parsed > 100:
    return None
  return parsed


def resolve_height(
  *,
  height: object,
  building_levels: object,
  roof_levels: object,
  building_class: object,
) -> tuple[float, str]:
  """Choose the best available OSM height and record its provenance."""
  explicit = parse_length_m(height)
  if (
    explicit is not None and MIN_VISIBLE_HEIGHT_M <= explicit <= MAX_PLAUSIBLE_HEIGHT_M
  ):
    return round(explicit, 3), "osm:height"

  levels = parse_levels(building_levels)
  if levels is not None and levels > 0:
    roof = parse_levels(roof_levels) or 0.0
    derived = levels * LEVEL_HEIGHT_M + roof * ROOF_LEVEL_HEIGHT_M
    return round(min(derived, MAX_PLAUSIBLE_HEIGHT_M), 3), (
      "osm:building:levels+roof:levels" if roof else "osm:building:levels"
    )

  kind = text_value(building_class, "yes").lower()
  fallback = BUILDING_CLASS_FALLBACK_M.get(kind, DEFAULT_BUILDING_HEIGHT_M)
  return fallback, f"display_fallback:building={kind}"


def promote_building_tags(frame: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
  """Lift the six relevant GDAL ``other_tags`` values into columns."""
  promoted = frame.copy()
  if "other_tags" in promoted:
    parsed = promoted["other_tags"].map(parse_hstore)
  else:
    parsed = Series([{} for _ in range(len(promoted))], index=promoted.index)
  for column in ("building", *PROMOTED_TAGS):
    values = parsed.map(lambda tags, key=column: tags.get(key))
    if column in promoted:
      promoted[column] = promoted[column].where(promoted[column].notna(), values)
    else:
      promoted[column] = values
  return promoted


def polygonal_geometry(geometry: BaseGeometry) -> Polygon | MultiPolygon | None:
  """Keep only valid polygonal pieces after an exact bounds clip."""
  if geometry is None or geometry.is_empty:
    return None
  valid = geometry if geometry.is_valid else geometry.buffer(0)
  if isinstance(valid, Polygon | MultiPolygon):
    return valid if valid.area > 0 else None
  if isinstance(valid, GeometryCollection):
    pieces = [part for part in valid.geoms if isinstance(part, Polygon | MultiPolygon)]
    if not pieces:
      return None
    merged = unary_union(pieces)
    return merged if isinstance(merged, Polygon | MultiPolygon) else None
  return None


def prefer_building_parts(frame: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
  """Drop coarse parent outlines where grounded building parts describe them.

  A parent is redundant when its representative point is covered by the part
  union or mapped parts cover at least half of its area.  The area fallback
  handles courtyard blocks whose representative point lies in the courtyard.
  """
  if frame.empty:
    return frame.copy()
  part_tags = frame["building:part"].map(text_value).str.lower()
  is_part = ~part_tags.isin({"", "no", "0", "false"})
  parts = frame[is_part]
  parents = frame[~is_part]
  if parts.empty or parents.empty:
    return frame.copy()
  part_union = parts.geometry.union_all()
  representative_covered = parents.geometry.representative_point().covered_by(
    part_union
  )
  overlap_area = parents.geometry.intersection(part_union).area
  coverage = overlap_area / parents.geometry.area
  drop_parent = representative_covered | coverage.ge(0.5)
  return frame.drop(index=parents.index[drop_parent]).copy()


def omit_lod2_covered(
  frame: gpd.GeoDataFrame, official_buildings: gpd.GeoDataFrame
) -> gpd.GeoDataFrame:
  """Give official LoD2 footprint coverage absolute source precedence."""
  if frame.empty or official_buildings.empty:
    return frame.copy()
  official = official_buildings
  if official.crs is None:
    official = official.set_crs(BERLIN_PROJECTED)
  if frame.crs != official.crs:
    official = official.to_crs(frame.crs)
  official_union = official.geometry.union_all()
  covered = frame.geometry.representative_point().covered_by(official_union)
  return frame[~covered].copy()


def build_context_frame(
  raw_buildings: gpd.GeoDataFrame,
  *,
  clip_polygon: BaseGeometry,
  official_buildings: gpd.GeoDataFrame,
) -> gpd.GeoDataFrame:
  """Clip, rank and normalize raw PBF multipolygon building features."""
  if raw_buildings.crs is None:
    raise ValueError("OSM building features need a declared CRS")
  projected = raw_buildings.to_crs(BERLIN_PROJECTED)
  projected = promote_building_tags(projected)

  has_building = (
    projected["building"]
    .map(text_value)
    .str.lower()
    .map(lambda value: value not in {"", "no", "0", "false"})
  )
  has_part = (
    projected["building:part"]
    .map(text_value)
    .str.lower()
    .map(lambda value: value not in {"", "no", "0", "false"})
  )
  selected = projected[has_building | has_part].copy()
  if selected.empty:
    return empty_context_frame()

  selected = gpd.clip(selected, clip_polygon)
  selected.geometry = selected.geometry.map(polygonal_geometry)
  selected = selected[selected.geometry.notna() & ~selected.geometry.is_empty].copy()

  min_height_text = selected["min_height"].map(text_value)
  min_heights = selected["min_height"].map(parse_length_m)
  # An unparseable non-empty min_height is still evidence that the volume is
  # elevated.  Omitting it is safer than extruding it from street level.
  floating = min_height_text.ne("") & (min_heights.isna() | min_heights.gt(0.0))
  selected = selected[~floating].copy()
  selected = prefer_building_parts(selected)
  selected = omit_lod2_covered(selected, official_buildings)
  if selected.empty:
    return empty_context_frame()

  way_ids = selected.get("osm_way_id", Series(index=selected.index, dtype="string"))
  relation_ids = selected.get("osm_id", Series(index=selected.index, dtype="string"))
  elements = Series("relation", index=selected.index, dtype="string")
  elements.loc[way_ids.notna()] = "way"
  osm_ids = relation_ids.where(way_ids.isna(), way_ids).map(text_value)
  selected["element"] = elements
  selected["osm_id_normalized"] = osm_ids
  selected = selected[selected["osm_id_normalized"] != ""].copy()
  selected = selected.drop_duplicates(
    subset=["element", "osm_id_normalized"], keep="first"
  )

  records: list[dict[str, Any]] = []
  for _, source in selected.iterrows():
    kind = text_value(source.get("building"), "yes").lower()
    height_m, height_source = resolve_height(
      height=source.get("height"),
      building_levels=source.get("building:levels"),
      roof_levels=source.get("roof:levels"),
      building_class=kind,
    )
    element = text_value(source.get("element"))
    osm_id = text_value(source.get("osm_id_normalized"))
    roof_shape = text_value(source.get("roof:shape")).lower()
    records.append(
      {
        "building_id": f"OSM-{element}-{osm_id}",
        "parent_building_id": None,
        "building_name": text_value(source.get("name")) or None,
        "function": f"osm_context:{kind}",
        "roof_type": ROOF_TYPE_BY_OSM_SHAPE.get(roof_shape, UNKNOWN_ROOF_TYPE),
        "measured_height_m": height_m,
        "height_source": height_source,
        "provenance": "OpenStreetMap via Geofabrik Berlin extract (ODbL-1.0)",
        "source_url": (f"https://www.openstreetmap.org/{element}/{osm_id}"),
        "geometry": source.geometry,
      }
    )

  result = gpd.GeoDataFrame(records, geometry="geometry", crs=BERLIN_PROJECTED)
  return result.reset_index(drop=True)


def empty_context_frame() -> gpd.GeoDataFrame:
  """Return the stable sidecar schema even when no fallback is needed."""
  return gpd.GeoDataFrame(
    {
      "building_id": Series(dtype="string"),
      "parent_building_id": Series(dtype="string"),
      "building_name": Series(dtype="string"),
      "function": Series(dtype="string"),
      "roof_type": Series(dtype="string"),
      "measured_height_m": Series(dtype="float64"),
      "height_source": Series(dtype="string"),
      "provenance": Series(dtype="string"),
      "source_url": Series(dtype="string"),
      "geometry": gpd.GeoSeries([], crs=BERLIN_PROJECTED),
    },
    geometry="geometry",
    crs=BERLIN_PROJECTED,
  )


def read_pbf_multipolygons(pbf_path: Path, bounds_path: Path) -> gpd.GeoDataFrame:
  """Read only the bounded GDAL multipolygon layer from a Geofabrik PBF."""
  bounds = load_bounds_polygon(bounds_path)
  return gpd.read_file(
    pbf_path,
    layer="multipolygons",
    bbox=bounds.bounds,
    engine="pyogrio",
  )


def write_context_buildings(frame: gpd.GeoDataFrame, out_path: Path) -> None:
  """Write the compact context layer without an unused spatial index."""
  out_path.parent.mkdir(parents=True, exist_ok=True)
  if out_path.exists():
    out_path.unlink()
  frame.to_file(out_path, layer="buildings", driver="GPKG", SPATIAL_INDEX="NO")


def generate_context_buildings(
  *,
  pbf_path: Path,
  bounds_path: Path,
  official_buildings_path: Path,
  out_path: Path,
) -> gpd.GeoDataFrame:
  """Generate the owner-approved bounded OSM context sidecar."""
  raw = read_pbf_multipolygons(pbf_path, bounds_path)
  official = gpd.read_file(official_buildings_path, layer="buildings")
  clip_polygon = project_geometry(load_bounds_polygon(bounds_path))
  context = build_context_frame(
    raw,
    clip_polygon=clip_polygon,
    official_buildings=official,
  )
  write_context_buildings(context, out_path)
  return context


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--pbf", type=Path, required=True)
  parser.add_argument("--bounds", type=Path, required=True)
  parser.add_argument("--official-buildings", type=Path, required=True)
  parser.add_argument("--out", type=Path, required=True)
  args = parser.parse_args()

  context = generate_context_buildings(
    pbf_path=args.pbf,
    bounds_path=args.bounds,
    official_buildings_path=args.official_buildings,
    out_path=args.out,
  )
  size = args.out.stat().st_size
  sources = context["height_source"].value_counts().sort_index().to_dict()
  print(
    f"Wrote {len(context):,} OSM context buildings to {args.out} "
    f"({size:,} bytes); height sources={sources}"
  )


if __name__ == "__main__":
  main()
