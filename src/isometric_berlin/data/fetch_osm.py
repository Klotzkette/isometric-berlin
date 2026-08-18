"""Fetch OSM context for the Regierungsviertel bounds via OSMnx.

Layers written to the output GeoPackage:
roads, water, parks, vegetation, playgrounds, rail, pois.

License: OSM data is © OpenStreetMap contributors, ODbL 1.0.
The viewer must show the attribution string defined in NOTICE.md.
"""

from __future__ import annotations

import argparse
import re
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
  "memorial": True,
  "memorial:type": True,
  "office": ["diplomatic", "government"],
  "diplomatic": True,
  "government": True,
  "bridge": True,
  "tunnel": True,
  "covered": True,
  "layer": True,
  "service": True,
  "informal": True,
  "usage": True,
}
USER_AGENT = "OSMnx/2.0 isometric-berlin/0.1 (Klotzkette)"

# Every tag `split_layers` and `normalize_for_file` can read. The Overpass path
# gets these as columns for free; the PBF path has to lift most of them out of
# GDAL's `other_tags` hstore, so the list is named once here.
TAG_COLUMNS = (
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
  "memorial",
  "memorial:type",
  "office",
  "diplomatic",
  "government",
  "bridge",
  "tunnel",
  "covered",
  "layer",
  "service",
  "informal",
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
  "width",
  "est_width",
  "lanes",
  "lanes:forward",
  "lanes:backward",
  "sidewalk",
  "cycleway",
  "bridge:structure",
  "maxheight",
)

# GDAL's OSM driver splits the extract across geometry types. `other_relations`
# is skipped: it holds route/boundary relations that carry no surface geometry
# this project draws.
PBF_LAYERS = ("points", "lines", "multilinestrings", "multipolygons")

_HSTORE_PAIR = re.compile(r'"((?:[^"\\]|\\.)*)"\s*=>\s*"((?:[^"\\]|\\.)*)"')

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

# GeoPackage is an uncompressed SQLite container, so a 500 m expansion of the
# task hull cannot keep every unused OSM node and still satisfy the repository's
# 8 MiB canonical-source ceiling. These columns and rows are exactly the source
# evidence consumed by the generators and landmark QA. Geometry is simplified
# only below the 0.4 m visual/detail threshold already used by the downstream
# park and surface builders.
FILE_SIMPLIFY_M = 0.35
PRECISE_GEOMETRY_LAYERS = frozenset({"water"})
RIVERSIDE_BENCH_MAX_WATER_DISTANCE_M = 50.0
FILE_COLUMNS: dict[str, tuple[str, ...]] = {
  "roads": (
    "element",
    "id",
    "name",
    "highway",
    "bridge",
    "tunnel",
    "covered",
    "layer",
    "service",
    "informal",
    "surface",
    "material",
    "width",
    "est_width",
    "lanes",
    "lanes:forward",
    "lanes:backward",
    "sidewalk",
    "cycleway",
  ),
  "water": (
    "element",
    "id",
    "name",
    "waterway",
    "water",
    "natural",
    "amenity",
    "tunnel",
    "layer",
    "width",
  ),
  "parks": (
    "element",
    "id",
    "name",
    "natural",
    "leisure",
    "playground",
    "landuse",
    "surface",
  ),
  "vegetation": ("element", "id", "natural", "height", "leaf_type"),
  "playgrounds": (
    "element",
    "id",
    "name",
    "leisure",
    "playground",
    "surface",
    "material",
    "height",
    "access",
    "wheelchair",
  ),
  "rail": (
    "element",
    "id",
    "name",
    "railway",
    "bridge",
    "tunnel",
    "covered",
    "layer",
    "service",
    "usage",
  ),
  "pois": (
    "element",
    "id",
    "name",
    "amenity",
    "tourism",
    "historic",
    "memorial",
    "memorial:type",
    "office",
    "diplomatic",
    "government",
  ),
}


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


def parse_hstore(value: object) -> dict[str, str]:
  """GDAL's `other_tags` hstore into a plain dict.

  Values can contain escaped quotes, so the pairs are matched rather than split.
  """
  if not isinstance(value, str) or not value:
    return {}
  return {
    key.replace('\\"', '"').replace("\\\\", "\\"): val.replace('\\"', '"').replace(
      "\\\\", "\\"
    )
    for key, val in _HSTORE_PAIR.findall(value)
  }


def read_pbf_layer(
  pbf_path: Path, layer: str, bbox: tuple[float, float, float, float]
) -> gpd.GeoDataFrame:
  """One GDAL OSM layer, with `other_tags` lifted into real columns.

  The driver promotes only a handful of tags to columns, and which ones differs
  per layer — `railway` is a column on lines but lives in the hstore on
  multipolygons. Reading the hstore for every layer keeps the result uniform.
  """
  frame = gpd.read_file(pbf_path, layer=layer, bbox=bbox, engine="pyogrio")
  if frame.empty:
    return gpd.GeoDataFrame(geometry=[], crs=WGS84)
  tags = [parse_hstore(value) for value in frame.get("other_tags", [])]
  for column in TAG_COLUMNS:
    promoted = [tag.get(column) for tag in tags]
    if column in frame.columns:
      # A real column wins; the hstore only fills the gaps it left.
      frame[column] = frame[column].where(frame[column].notna(), promoted)
    else:
      frame[column] = promoted
  identify_element(frame, layer)
  return frame.drop(columns=["other_tags", "osm_id", "osm_way_id"], errors="ignore")


# GDAL's layer names say which geometry the driver built, not which OSM element
# it came from. Overpass reports node/way/relation, and `verify_landmark_alignment`
# prints that word, so the layers are translated back.
PBF_ELEMENTS = {
  "points": "node",
  "lines": "way",
  "multilinestrings": "relation",
}


def identify_element(frame: gpd.GeoDataFrame, layer: str) -> None:
  """Restore the Overpass `element`/`id` pair on a GDAL OSM layer.

  In `multipolygons` the driver reports a closed way under `osm_way_id` and a
  multipolygon relation under `osm_id`, so exactly one of the two is set per
  row. Reading only `osm_id` left every way in that layer without an id, which
  cost the landmark QA its matches against park and playground outlines.
  """
  way_ids = frame["osm_way_id"] if "osm_way_id" in frame.columns else None
  ids = frame["osm_id"] if "osm_id" in frame.columns else None
  if way_ids is None:
    frame["id"] = ids
    frame["element"] = PBF_ELEMENTS[layer]
    return
  frame["id"] = way_ids if ids is None else ids.where(ids.notna(), way_ids)
  frame["element"] = Series(
    ["way" if isinstance(value, str) else "relation" for value in way_ids],
    index=frame.index,
  )


def load_pbf_features(pbf_path: Path, bounds_path: Path) -> gpd.GeoDataFrame:
  """The Geofabrik extract, restricted to the bounds and reprojected.

  Overpass is the documented first choice, but it answers "server is probably
  too busy" for the whole task-09 hull often enough that the extract is the
  dependable path. Same tags, same schema — only the transport differs.
  """
  polygon = load_bounds_polygon(bounds_path)
  bbox = polygon.bounds
  frames: list[gpd.GeoDataFrame] = []
  for layer in PBF_LAYERS:
    part = read_pbf_layer(pbf_path, layer, bbox)
    print(f"{layer}: {len(part)} features", flush=True)
    if not part.empty:
      frames.append(part)
  if not frames:
    return gpd.GeoDataFrame(geometry=[], crs=WGS84)
  features = gpd.GeoDataFrame(concat(frames, ignore_index=True), crs=WGS84)
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


def write_layers(layers: dict[str, gpd.GeoDataFrame], out_path: Path) -> dict[str, int]:
  """The seven rendered layers as one bounded, sub-8 MiB GeoPackage.

  Three levers are lossless at the viewer's precision: rtree indexes are
  omitted because every consumer loads whole layers, unused columns and point
  classes are omitted, and sub-0.4 m vertex noise is removed with topology
  preservation. Named POIs remain available to landmark QA. The only unnamed
  benches retained are within 50 m of mapped water, which is wider than the
  riverside-bar builder's entire seat search.
  """
  out_path.parent.mkdir(parents=True, exist_ok=True)
  if out_path.exists():
    out_path.unlink()
  rendered = rendered_file_rows(layers)
  for layer_name, gdf in rendered.items():
    normalized = compact_for_file(layer_name, gdf)
    normalized.to_file(out_path, layer=layer_name, driver="GPKG", SPATIAL_INDEX="NO")
  return {name: len(gdf) for name, gdf in rendered.items()}


def rendered_file_rows(
  layers: dict[str, gpd.GeoDataFrame],
) -> dict[str, gpd.GeoDataFrame]:
  """Retain every feature class that a generator or landmark QA can consume."""
  rendered = {name: layer.copy() for name, layer in layers.items()}

  roads = rendered["roads"]
  rendered["roads"] = roads[
    (roads.geometry.geom_type != "Point") | _isin(roads, "highway", ["traffic_signals"])
  ].copy()

  water = rendered["water"]
  rendered["water"] = water[water.geometry.geom_type != "Point"].copy()

  parks = rendered["parks"]
  rendered["parks"] = parks[
    parks.geometry.geom_type.isin(["Polygon", "MultiPolygon"])
  ].copy()

  rail = rendered["rail"]
  rendered["rail"] = rail[
    (rail.geometry.geom_type != "Point") | _isin(rail, "railway", ["subway_entrance"])
  ].copy()

  pois = rendered["pois"]
  water_surfaces = water[water.geometry.geom_type.isin(["Polygon", "MultiPolygon"])]
  benches_near_water = Series(False, index=pois.index)
  if not water_surfaces.empty:
    water_union = water_surfaces.geometry.union_all()
    benches_near_water = _isin(pois, "amenity", ["bench"]) & pois.geometry.distance(
      water_union
    ).le(RIVERSIDE_BENCH_MAX_WATER_DISTANCE_M)
  rendered["pois"] = pois[
    _has_value(pois, "name")
    | _isin(pois, "amenity", ["fuel", "biergarten", "bar", "pub", "fountain"])
    | benches_near_water
    | _isin(pois, "tourism", ["artwork"])
    | _has_value(pois, "historic")
    | _has_value(pois, "memorial")
    | _has_value(pois, "office")
    | _has_value(pois, "diplomatic")
    | _has_value(pois, "government")
  ].copy()
  return rendered


def compact_for_file(layer_name: str, gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
  """Select the per-layer schema and remove visually irrelevant vertex noise."""
  keep = [column for column in FILE_COLUMNS[layer_name] if column in gdf.columns]
  compact = gdf[[*keep, "geometry"]].copy()
  # Water/artwork polygon differences encode real built details such as
  # Invalidenpark's Sinkende Mauer; simplifying those rings independently can
  # turn a narrow slot into a broad perimeter remainder. Keep them exact.
  if layer_name not in PRECISE_GEOMETRY_LAYERS:
    source_geometry = compact.geometry.copy()
    compact.geometry = compact.geometry.simplify(
      FILE_SIMPLIFY_M, preserve_topology=True
    )
    if layer_name == "pois":
      exact = _isin(compact, "tourism", ["artwork"]) | _isin(
        compact, "amenity", ["fountain"]
      )
      compact.loc[exact, "geometry"] = source_geometry.loc[exact]
  return drop_empty_columns(normalize_for_file(compact))


def drop_empty_columns(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
  empty = [
    column
    for column in gdf.columns
    if column != "geometry" and not gdf[column].notna().any()
  ]
  return gdf.drop(columns=empty) if empty else gdf


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
      "memorial",
      "memorial:type",
      "office",
      "diplomatic",
      "government",
      "bridge",
      "tunnel",
      "covered",
      "layer",
      "service",
      "informal",
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
      "width",
      "est_width",
      "lanes",
      "lanes:forward",
      "lanes:backward",
      "sidewalk",
      "cycleway",
      "bridge:structure",
      "maxheight",
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
    "--pbf",
    type=Path,
    default=None,
    help=(
      "Read from a local Geofabrik .osm.pbf instead of Overpass. "
      "The extract stays in the gitignored raw/ tree."
    ),
  )
  parser.add_argument(
    "--raw-geojson",
    type=Path,
    default=Path("geo_data/regierungsviertel/raw/osm_overpass.json"),
  )
  args = parser.parse_args()

  if args.pbf is not None:
    features = load_pbf_features(args.pbf, args.bounds)
  else:
    features = fetch_osm_features(
      args.bounds, timeout=args.timeout, tile_span=args.tile_span
    )
  args.raw_geojson.parent.mkdir(parents=True, exist_ok=True)
  args.raw_geojson.write_text(
    normalize_for_file(features).to_crs(WGS84).to_json(), encoding="utf-8"
  )
  layers = split_layers(features, args.bounds)
  written_counts = write_layers(layers, args.out)
  counts = ", ".join(f"{name}={count}" for name, count in written_counts.items())
  print(f"Wrote OSM layers to {args.out}: {counts}")


if __name__ == "__main__":
  main()
