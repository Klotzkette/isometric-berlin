"""Extract source-mapped Großer Tiergarten scrub and hedges.

The canonical OSM GeoPackage already carries ``natural=scrub`` polygons, but
its deliberately compact schema does not retain ``barrier=hedge``.  This
bounded sidecar reads those hedge features from the same local Geofabrik PBF,
clips every geometry to OSM relation 7643526 and writes a small, auditable
GeoJSON.  It never invents hedge courses or individual bush positions.
"""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path
from typing import Any, Iterable

import geopandas as gpd
import pyogrio
import shapely
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Polygon
from shapely.geometry.base import BaseGeometry
from shapely.geometry.geo import mapping

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_OSM = REPO_ROOT / "geo_data/regierungsviertel/osm.gpkg"
DEFAULT_PBF = REPO_ROOT / "geo_data/regierungsviertel/raw/osm/berlin-latest.osm.pbf"
DEFAULT_OUT = REPO_ROOT / "geo_data/regierungsviertel/tiergarten-vegetation.geojson"
TIERGARTEN_RELATION_ID = "7643526"
OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright"
# A 4.1 m boundary-touch remnant of way 911876731 lies outside the park except
# for a precision sliver. It is not a Tiergarten hedge run and must not turn
# into a floating four-metre obstacle at the relation edge.
MIN_HEDGE_PART_LENGTH_M = 5.0


def line_parts(geometry: BaseGeometry) -> Iterable[LineString]:
  """Yield non-empty line parts from a clipped geometry."""
  if isinstance(geometry, LineString) and geometry.length > 0:
    yield geometry
  elif isinstance(geometry, MultiLineString):
    yield from (part for part in geometry.geoms if part.length > 0)


def polygon_parts(geometry: BaseGeometry) -> Iterable[Polygon]:
  """Yield non-empty polygon parts from a clipped geometry."""
  if isinstance(geometry, Polygon) and geometry.area > 0:
    yield geometry
  elif isinstance(geometry, MultiPolygon):
    yield from (part for part in geometry.geoms if part.area > 0)


def tiergarten_boundary(osm_path: Path) -> BaseGeometry:
  """Return the exact committed OSM Großer Tiergarten relation geometry."""
  parks = gpd.read_file(osm_path, layer="parks")
  match = parks[
    (parks["element"] == "relation")
    & (parks["id"].astype(str) == TIERGARTEN_RELATION_ID)
  ]
  if len(match) != 1:
    raise ValueError(
      f"Expected one OSM relation {TIERGARTEN_RELATION_ID}, found {len(match)}"
    )
  if match.crs is None or match.crs.to_epsg() != 25833:
    match = match.to_crs(25833)
  return match.geometry.iloc[0]


def parse_other_tags(value: object) -> dict[str, str]:
  """Parse GDAL's OSM ``other_tags`` hstore-like field."""
  if not isinstance(value, str):
    return {}
  return dict(re.findall(r'"([^"\\]+)"=>"([^"\\]*)"', value))


def positive_metres(value: object) -> float | None:
  """Return a finite positive metric tag, accepting decimal commas."""
  if value is None:
    return None
  match = re.search(r"[-+]?\d+(?:[.,]\d+)?", str(value))
  if not match:
    return None
  number = float(match.group().replace(",", "."))
  return number if math.isfinite(number) and number > 0 else None


def source_properties(
  kind: str,
  osm_id: str,
  part_index: int,
  *,
  leaf_type: object = None,
  other_tags: object = None,
) -> dict[str, Any]:
  """Build compact properties while retaining the stable OSM identity."""
  tags = parse_other_tags(other_tags)
  properties: dict[str, Any] = {
    "id": f"way/{osm_id}:{part_index}",
    "kind": kind,
    "osm_element": "way",
    "osm_id": osm_id,
    "source_url": f"https://www.openstreetmap.org/way/{osm_id}",
  }
  if isinstance(leaf_type, str) and leaf_type.strip():
    properties["leaf_type"] = leaf_type.strip()
  height = positive_metres(tags.get("height"))
  width = positive_metres(tags.get("width"))
  if height is not None:
    properties["height_m"] = round(height, 2)
  if width is not None:
    properties["width_m"] = round(width, 2)
  return properties


def extract_features(osm_path: Path, pbf_path: Path) -> list[dict[str, Any]]:
  """Return all mapped scrub/hedge parts clipped to Großer Tiergarten."""
  park = tiergarten_boundary(osm_path)
  park_wgs84 = gpd.GeoSeries([park], crs=25833).to_crs(4326).iloc[0]
  bbox = tuple(float(value) for value in park_wgs84.bounds)

  vegetation = gpd.read_file(osm_path, layer="vegetation")
  if vegetation.crs is None or vegetation.crs.to_epsg() != 25833:
    vegetation = vegetation.to_crs(25833)
  scrub = vegetation[
    (vegetation["natural"] == "scrub") & vegetation.geometry.intersects(park)
  ]

  hedge_lines = pyogrio.read_dataframe(
    pbf_path,
    layer="lines",
    where="barrier = 'hedge'",
    bbox=bbox,
  ).to_crs(25833)
  hedge_areas = pyogrio.read_dataframe(
    pbf_path,
    layer="multipolygons",
    where="barrier = 'hedge'",
    bbox=bbox,
  ).to_crs(25833)

  features: list[dict[str, Any]] = []
  for _, row in scrub.sort_values("id").iterrows():
    clipped = row.geometry.intersection(park)
    for part_index, part in enumerate(polygon_parts(clipped)):
      osm_id = str(row["id"])
      features.append(
        {
          "type": "Feature",
          "properties": source_properties(
            "scrub_area",
            osm_id,
            part_index,
            leaf_type=row.get("leaf_type"),
          ),
          "geometry": mapping(shapely.set_precision(part, 0.01)),
        }
      )

  for _, row in hedge_lines.sort_values("osm_id").iterrows():
    clipped = row.geometry.intersection(park)
    retained_parts = [
      part for part in line_parts(clipped) if part.length >= MIN_HEDGE_PART_LENGTH_M
    ]
    for part_index, part in enumerate(retained_parts):
      osm_id = str(row["osm_id"])
      features.append(
        {
          "type": "Feature",
          "properties": source_properties(
            "hedge_line",
            osm_id,
            part_index,
            other_tags=row.get("other_tags"),
          ),
          "geometry": mapping(shapely.set_precision(part, 0.01)),
        }
      )

  for _, row in hedge_areas.sort_values("osm_way_id").iterrows():
    clipped = row.geometry.intersection(park)
    for part_index, part in enumerate(polygon_parts(clipped)):
      osm_id = str(row["osm_way_id"])
      features.append(
        {
          "type": "Feature",
          "properties": source_properties(
            "hedge_area",
            osm_id,
            part_index,
            other_tags=row.get("other_tags"),
          ),
          "geometry": mapping(shapely.set_precision(part, 0.01)),
        }
      )

  return sorted(
    features,
    key=lambda feature: (
      str(feature["properties"]["kind"]),
      str(feature["properties"]["osm_id"]),
      str(feature["properties"]["id"]),
    ),
  )


def build_collection(osm_path: Path, pbf_path: Path) -> dict[str, Any]:
  """Build the bounded, source-auditable GeoJSON collection."""
  features = extract_features(osm_path, pbf_path)
  hedge_lines = [
    feature for feature in features if feature["properties"]["kind"] == "hedge_line"
  ]
  hedge_areas = [
    feature for feature in features if feature["properties"]["kind"] == "hedge_area"
  ]
  scrub_areas = [
    feature for feature in features if feature["properties"]["kind"] == "scrub_area"
  ]
  hedge_length_m = sum(
    shapely.geometry.shape(feature["geometry"]).length for feature in hedge_lines
  )
  hedge_area_m2 = sum(
    shapely.geometry.shape(feature["geometry"]).area for feature in hedge_areas
  )
  scrub_area_m2 = sum(
    shapely.geometry.shape(feature["geometry"]).area for feature in scrub_areas
  )
  return {
    "type": "FeatureCollection",
    "name": "Großer Tiergarten source-mapped vegetation",
    "crs": {
      "type": "name",
      "properties": {"name": "urn:ogc:def:crs:EPSG::25833"},
    },
    "source": {
      "name": "OpenStreetMap via local Geofabrik Berlin extract",
      "attribution": "© OpenStreetMap contributors",
      "license": "ODbL-1.0",
      "copyright_url": OSM_COPYRIGHT_URL,
      "park_relation_url": (
        f"https://www.openstreetmap.org/relation/{TIERGARTEN_RELATION_ID}"
      ),
      "geometry_status": (
        "Mapped OSM scrub polygons and barrier=hedge lines/areas clipped exactly "
        "to relation 7643526; no hedge courses or individual bush positions invented"
      ),
    },
    "metrics": {
      "hedge_area_count": len(hedge_areas),
      "hedge_area_m2": round(hedge_area_m2, 1),
      "hedge_line_count": len(hedge_lines),
      "hedge_line_length_m": round(hedge_length_m, 1),
      "scrub_area_count": len(scrub_areas),
      "scrub_area_m2": round(scrub_area_m2, 1),
    },
    "features": features,
  }


def main(argv: list[str] | None = None) -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--osm", type=Path, default=DEFAULT_OSM)
  parser.add_argument("--pbf", type=Path, default=DEFAULT_PBF)
  parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
  args = parser.parse_args(argv)
  if not args.pbf.exists():
    raise FileNotFoundError(
      f"Missing local OSM extract: {args.pbf}. Raw PBF files remain gitignored."
    )
  payload = build_collection(args.osm, args.pbf)
  args.out.parent.mkdir(parents=True, exist_ok=True)
  args.out.write_text(
    json.dumps(payload, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
    + "\n",
    encoding="utf-8",
  )
  metrics = payload["metrics"]
  print(
    f"Wrote {args.out}: scrub={metrics['scrub_area_count']}, "
    f"hedge_lines={metrics['hedge_line_count']}, "
    f"hedge_areas={metrics['hedge_area_count']}"
  )


if __name__ == "__main__":
  main()
