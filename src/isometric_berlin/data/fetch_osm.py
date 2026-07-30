"""Fetch OSM context for the Regierungsviertel bounds via OSMnx.

Layers written to the output GeoPackage:
roads, water, parks, vegetation, playgrounds, rail, pois.

License: OSM data is © OpenStreetMap contributors, ODbL 1.0.
The viewer must show the attribution string defined in NOTICE.md.
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path
from typing import Any

import geopandas as gpd
import osmnx as ox
import requests
from osmnx import _http, _overpass
from osmnx._errors import InsufficientResponseError
from pandas import Series, concat
from shapely.geometry import box
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
  "natural": ["water", "wood", "scrub", "grassland", "tree", "tree_row"],
  "leisure": ["park", "garden", "playground"],
  "playground": True,
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
USER_AGENT = "OSMnx/2.0 isometric-berlin/0.1 (Klotzkette)"

# Overpass resets the connection when the whole task-09 polygon is asked for
# every tag at once (the response runs to hundreds of megabytes). Fetching in
# roughly kilometre-wide tiles keeps each response small, and OSMnx caches per
# tile so a failure only costs the tile that failed.
OSM_TILE_SPAN_DEG = 0.012

# Overpass answers 504 "server is probably too busy" under load, and the
# connection is occasionally reset mid-handshake. Both are transient, so each
# tile is retried with a widening backoff before the run is abandoned.
TILE_ATTEMPTS = 6
TILE_BACKOFF_S = 20

# Roughly half of the individual HTTP calls to overpass-api.de are reset
# mid-flight from this network, so each one is retried before the tile is
# considered failed.
REQUEST_ATTEMPTS = 8
REQUEST_BACKOFF_S = 5.0


def tile_polygon(polygon: BaseGeometry, span: float) -> list[BaseGeometry]:
  min_lon, min_lat, max_lon, max_lat = polygon.bounds
  tiles: list[BaseGeometry] = []
  lat = min_lat
  while lat < max_lat:
    lon = min_lon
    while lon < max_lon:
      cell = box(lon, lat, min(lon + span, max_lon), min(lat + span, max_lat))
      piece = polygon.intersection(cell)
      if not piece.is_empty and piece.area > 0:
        tiles.append(piece)
      lon += span
    lat += span
  return tiles


def use_gzip_only_encoding() -> None:
  """Ask Overpass for gzip but never deflate.

  OSMnx inherits requests' default ``Accept-Encoding: gzip, deflate``. The
  network path between this project and overpass-api.de resets the connection
  whenever ``deflate`` is offered, which surfaces as an unexplained
  ``ConnectionResetError``. ``gzip`` alone answers normally, so the header is
  narrowed rather than dropped.
  """
  original = _http._get_http_headers

  def gzip_only(*args: object, **kwargs: object) -> dict[str, str]:
    headers = original(*args, **kwargs)
    headers["Accept-Encoding"] = "gzip"
    return headers

  _http._get_http_headers = gzip_only


RETRY_STATUS = frozenset({429, 500, 502, 503, 504})


class RetryingRequests:
  """Retry the flaky Overpass hop, transparently to OSMnx.

  Roughly half of the connections from this project to overpass-api.de are
  reset mid-flight, and the surviving ones are frequently answered 429 or 504
  under load. OSMnx calls ``requests.get``/``requests.post`` at module level
  with no session, so there is nowhere to mount an adapter; standing in front
  of the module is the only injection point. Every other attribute is
  delegated untouched.
  """

  def __init__(self, attempts: int, backoff: float) -> None:
    self._attempts = attempts
    self._backoff = backoff

  def __getattr__(self, name: str) -> Any:
    return getattr(requests, name)

  def get(self, *args: Any, **kwargs: Any) -> requests.Response:
    return self._send(requests.get, *args, **kwargs)

  def post(self, *args: Any, **kwargs: Any) -> requests.Response:
    return self._send(requests.post, *args, **kwargs)

  def _send(self, call: Any, *args: Any, **kwargs: Any) -> requests.Response:
    last: Exception | None = None
    for attempt in range(1, self._attempts + 1):
      try:
        response = call(*args, **kwargs)
        if response.status_code not in RETRY_STATUS:
          return response
        last = None
      except requests.exceptions.RequestException as error:
        last = error
      if attempt == self._attempts:
        if last is not None:
          raise last
        return response
      time.sleep(self._backoff * attempt)
    raise RuntimeError("unreachable")


def use_retrying_transport(
  attempts: int = REQUEST_ATTEMPTS, backoff: float = REQUEST_BACKOFF_S
) -> None:
  _overpass.requests = RetryingRequests(attempts, backoff)
  _http.requests = RetryingRequests(attempts, backoff)


def fetch_tile(tile: BaseGeometry, index: int, total: int) -> gpd.GeoDataFrame:
  for attempt in range(1, TILE_ATTEMPTS + 1):
    try:
      return ox.features_from_polygon(tile, OSM_TAGS)
    except InsufficientResponseError:
      return gpd.GeoDataFrame(geometry=[], crs=WGS84)
    except Exception as error:  # noqa: BLE001 - Overpass load is transient
      if attempt == TILE_ATTEMPTS:
        raise
      wait = TILE_BACKOFF_S * attempt
      print(
        f"tile {index}/{total} attempt {attempt} failed "
        f"({type(error).__name__}); retrying in {wait}s",
        flush=True,
      )
      time.sleep(wait)
  raise RuntimeError("unreachable")


def fetch_osm_features(
  bounds_path: Path, timeout: int = 180, tile_span: float = OSM_TILE_SPAN_DEG
) -> gpd.GeoDataFrame:
  ox.settings.requests_timeout = timeout
  ox.settings.overpass_rate_limit = True
  ox.settings.use_cache = True
  ox.settings.cache_folder = "geo_data/regierungsviertel/raw/osmnx_cache"
  ox.settings.http_user_agent = USER_AGENT
  use_gzip_only_encoding()
  use_retrying_transport()
  polygon = load_bounds_polygon(bounds_path)
  tiles = tile_polygon(polygon, tile_span) if tile_span > 0 else [polygon]
  frames: list[gpd.GeoDataFrame] = []
  for index, tile in enumerate(tiles, start=1):
    tile_features = fetch_tile(tile, index, len(tiles))
    print(f"tile {index}/{len(tiles)}: {len(tile_features)} features", flush=True)
    if not tile_features.empty:
      frames.append(tile_features.reset_index())
  if not frames:
    return gpd.GeoDataFrame(geometry=[], crs=WGS84)
  features = gpd.GeoDataFrame(concat(frames, ignore_index=True), crs=frames[0].crs)
  if "element" in features and "id" in features:
    features = features.drop_duplicates(subset=["element", "id"], ignore_index=True)
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
    "vegetation": features[
      _isin(features, "natural", ["tree", "tree_row", "wood", "scrub"])
    ],
    "playgrounds": features[
      _isin(features, "leisure", ["playground"]) | _has_value(features, "playground")
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
      "playground",
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
      "surface",
      "material",
      "height",
      "circumference",
      "leaf_type",
      "leaf_cycle",
      "species",
      "genus",
      "access",
      "wheelchair",
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
  parser.add_argument("--tile-span", type=float, default=OSM_TILE_SPAN_DEG)
  parser.add_argument(
    "--raw-geojson",
    type=Path,
    default=Path("geo_data/regierungsviertel/raw/osm_overpass.json"),
  )
  args = parser.parse_args()

  features = fetch_osm_features(
    args.bounds, timeout=args.timeout, tile_span=args.tile_span
  )
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
