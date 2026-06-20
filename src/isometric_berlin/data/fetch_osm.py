"""Fetch OSM context for the Regierungsviertel bounds via OSMnx.

Layers written to the output GeoPackage:
roads, water, parks, rail, pois.

License: OSM data is © OpenStreetMap contributors, ODbL 1.0.
The viewer must show the attribution string defined in NOTICE.md.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import geopandas as gpd
import osmnx as ox
from pandas import Series
from shapely.geometry.base import BaseGeometry

from isometric_berlin.data.common import (
  BERLIN_PROJECTED,
  WGS84,
  load_bounds_polygon,
  project_geometry,
)

OSM_TAGS = {
  "highway": True,
  "waterway": True,
  "water": True,
  "natural": ["water", "wood", "scrub", "grassland"],
  "leisure": ["park", "garden", "playground"],
  "landuse": ["grass", "forest", "meadow", "recreation_ground"],
  "railway": True,
  "amenity": True,
  "tourism": True,
  "historic": True,
  "office": ["diplomatic", "government"],
  "diplomatic": True,
  "government": True,
  "bridge": True,
  "tunnel": True,
  "covered": True,
  "layer": True,
  "service": True,
  "usage": True,
}
USER_AGENT = "isometric-berlin/0.1 (Klotzkette)"


def fetch_osm_features(bounds_path: Path, timeout: int = 180) -> gpd.GeoDataFrame:
  ox.settings.requests_timeout = timeout
  ox.settings.overpass_rate_limit = True
  ox.settings.use_cache = True
  ox.settings.cache_folder = "geo_data/regierungsviertel/raw/osmnx_cache"
  ox.settings.http_user_agent = USER_AGENT
  polygon = load_bounds_polygon(bounds_path)
  features = ox.features_from_polygon(polygon, OSM_TAGS)
  if features.empty:
    return gpd.GeoDataFrame(geometry=[], crs=WGS84)
  features = features.reset_index()
  if features.crs is None:
    features = features.set_crs(WGS84)
  return features.to_crs(BERLIN_PROJECTED)


def split_layers(
  features: gpd.GeoDataFrame, bounds_path: Path
) -> dict[str, gpd.GeoDataFrame]:
  clip_polygon = project_geometry(load_bounds_polygon(bounds_path))
  layers = {
    "roads": _filter(features, "highway"),
    "water": features[
      _has_value(features, "waterway")
      | _has_value(features, "water")
      | _isin(features, "natural", ["water"])
    ],
    "parks": features[
      _isin(features, "leisure", ["park", "garden", "playground"])
      | _isin(features, "landuse", ["grass", "forest", "meadow", "recreation_ground"])
      | _isin(features, "natural", ["wood", "scrub", "grassland"])
    ],
    "rail": _filter(features, "railway"),
    "pois": features[
      _has_value(features, "amenity")
      | _has_value(features, "tourism")
      | _has_value(features, "historic")
      | _has_value(features, "office")
      | _has_value(features, "diplomatic")
      | _has_value(features, "government")
    ],
  }
  return {name: _clip(layer, clip_polygon) for name, layer in layers.items()}


def write_layers(layers: dict[str, gpd.GeoDataFrame], out_path: Path) -> None:
  out_path.parent.mkdir(parents=True, exist_ok=True)
  if out_path.exists():
    out_path.unlink()
  for layer_name, gdf in layers.items():
    normalized = normalize_for_file(gdf)
    normalized.to_file(out_path, layer=layer_name, driver="GPKG")


def normalize_for_file(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
  keep = [
    column
    for column in [
      "element",
      "id",
      "osmid",
      "name",
      "highway",
      "waterway",
      "water",
      "natural",
      "leisure",
      "landuse",
      "railway",
      "amenity",
      "tourism",
      "historic",
      "office",
      "diplomatic",
      "government",
      "bridge",
      "tunnel",
      "covered",
      "layer",
      "service",
      "usage",
      "geometry",
    ]
    if column in gdf.columns
  ]
  normalized = gdf[keep].copy()
  for column in normalized.columns:
    if column != "geometry":
      normalized[column] = normalized[column].astype("string")
  return normalized


def _filter(features: gpd.GeoDataFrame, column: str) -> gpd.GeoDataFrame:
  if column not in features:
    return features.iloc[0:0].copy()
  return features[features[column].notna()].copy()


def _has_value(features: gpd.GeoDataFrame, column: str) -> Series:
  if column not in features:
    return features.index.to_series().map(lambda _: False)
  return features[column].notna()


def _isin(features: gpd.GeoDataFrame, column: str, values: list[str]) -> Series:
  if column not in features:
    return features.index.to_series().map(lambda _: False)
  return features[column].isin(values)


def _clip(gdf: gpd.GeoDataFrame, clip_polygon: BaseGeometry) -> gpd.GeoDataFrame:
  if gdf.empty:
    return gpd.GeoDataFrame(geometry=[], crs=BERLIN_PROJECTED)
  clipped = gpd.clip(gdf, clip_polygon)
  return clipped[clipped.geometry.notna() & ~clipped.geometry.is_empty].copy()


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--bounds", type=Path, required=True)
  parser.add_argument("--out", type=Path, required=True)
  parser.add_argument("--timeout", type=int, default=180)
  parser.add_argument(
    "--raw-geojson",
    type=Path,
    default=Path("geo_data/regierungsviertel/raw/osm_overpass.json"),
  )
  args = parser.parse_args()

  features = fetch_osm_features(args.bounds, timeout=args.timeout)
  args.raw_geojson.parent.mkdir(parents=True, exist_ok=True)
  args.raw_geojson.write_text(
    normalize_for_file(features).to_crs(WGS84).to_json(), encoding="utf-8"
  )
  layers = split_layers(features, args.bounds)
  write_layers(layers, args.out)
  counts = ", ".join(f"{name}={len(gdf)}" for name, gdf in layers.items())
  print(f"Wrote OSM layers to {args.out}: {counts}")


if __name__ == "__main__":
  main()
