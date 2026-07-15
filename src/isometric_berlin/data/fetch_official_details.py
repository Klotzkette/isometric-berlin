"""Fetch bounded Berlin tree, public-lighting and Wall-route detail layers.

The three WFS services are official Berlin open data under dl-de/zero-2-0.
Raw responses stay below ``geo_data/**/raw``; the clipped GeoPackage is the
small, reproducible input for the public Three.js detail payload.
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import geopandas as gpd
import requests
from shapely.geometry import Point

from isometric_berlin.data.common import BERLIN_PROJECTED

LICENSE = "dl-de/zero-2-0"
PROVIDER = "Geoportal Berlin"


@dataclass(frozen=True)
class WfsLayer:
  service_url: str
  type_name: str


TREE_LAYERS = (
  WfsLayer(
    "https://gdi.berlin.de/services/wfs/baumbestand",
    "baumbestand:anlagenbaeume",
  ),
  WfsLayer(
    "https://gdi.berlin.de/services/wfs/baumbestand",
    "baumbestand:strassenbaeume",
  ),
)
LIGHT_LAYER = WfsLayer(
  "https://gdi.berlin.de/services/wfs/beleuchtung",
  "beleuchtung:beleuchtung",
)
WALL_LAYER = WfsLayer(
  "https://gdi.berlin.de/services/wfs/berlinermauer",
  "berlinermauer:a_grenzmauer",
)


def wfs_params(layer: WfsLayer, bounds: tuple[float, ...]) -> dict[str, str]:
  """Return a bounded WFS 2.0 request in Berlin's metric CRS."""
  bbox = ",".join(f"{value:.3f}" for value in bounds)
  return {
    "SERVICE": "WFS",
    "VERSION": "2.0.0",
    "REQUEST": "GetFeature",
    "TYPENAMES": layer.type_name,
    "SRSNAME": BERLIN_PROJECTED,
    "BBOX": f"{bbox},{BERLIN_PROJECTED}",
    "OUTPUTFORMAT": "application/json",
  }


def fetch_feature_collection(
  layer: WfsLayer,
  bounds: tuple[float, ...],
  *,
  timeout: int = 120,
) -> dict[str, Any]:
  """Download and validate one GeoJSON feature collection."""
  response = requests.get(
    layer.service_url,
    params=wfs_params(layer, bounds),
    headers={"User-Agent": "isometric-berlin/0.3 (+open-data-detail-fetcher)"},
    timeout=timeout,
  )
  response.raise_for_status()
  payload = response.json()
  if payload.get("type") != "FeatureCollection" or not isinstance(
    payload.get("features"), list
  ):
    raise ValueError(f"Invalid WFS response for {layer.type_name}")
  return payload


def feature_frame(payload: dict[str, Any]) -> gpd.GeoDataFrame:
  """Convert a WFS GeoJSON response to EPSG:25833."""
  frame = gpd.GeoDataFrame.from_features(payload["features"], crs=BERLIN_PROJECTED)
  if frame.crs is None:
    frame = frame.set_crs(BERLIN_PROJECTED)
  return frame.to_crs(BERLIN_PROJECTED)


def clipped_frame(payload: dict[str, Any], clip_geometry: Any) -> gpd.GeoDataFrame:
  """Clip a response to the exact project polygon, not merely its WFS bbox."""
  frame = feature_frame(payload)
  if frame.empty:
    return frame
  return gpd.clip(frame, clip_geometry).loc[lambda value: ~value.geometry.is_empty]


def normalized_trees(frames: list[gpd.GeoDataFrame]) -> gpd.GeoDataFrame:
  """Normalize both official tree catalogues to one compact layer."""
  records: list[dict[str, Any]] = []
  for catalogue, frame in zip(("anlagenbaum", "strassenbaum"), frames, strict=True):
    for _, row in frame.iterrows():
      if not isinstance(row.geometry, Point):
        continue
      records.append(
        {
          "tree_id": str(row.get("gisid")),
          "catalogue": catalogue,
          "species_de": row.get("art_dtsch"),
          "species_botanical": row.get("art_bot"),
          "tree_group": row.get("art_gruppe"),
          "height_m": row.get("baumhoehe"),
          "crown_diameter_m": row.get("kronedurch"),
          "trunk_circumference_cm": row.get("stammumfg"),
          "planting_year": row.get("pflanzjahr"),
          "owner": row.get("eigentuemer"),
          "geometry": row.geometry,
        }
      )
  return gpd.GeoDataFrame(records, geometry="geometry", crs=BERLIN_PROJECTED)


def normalized_lights(frame: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
  """Explode official MultiPoints and retain operational display attributes."""
  if frame.empty:
    return gpd.GeoDataFrame(geometry=[], crs=BERLIN_PROJECTED)
  exploded = frame.explode(index_parts=False, ignore_index=True)
  records: list[dict[str, Any]] = []
  for _, row in exploded.iterrows():
    if not isinstance(row.geometry, Point):
      continue
    records.append(
      {
        "light_id": str(row.get("id")),
        "station": row.get("leuchtstelle"),
        "operating_mode": row.get("betriebsart"),
        "status": row.get("status"),
        "street": row.get("strasse"),
        "rotation_degrees": row.get("rotation"),
        "light_type": row.get("leuchtentyp"),
        "symbol_number": row.get("symbolnr"),
        "geometry": row.geometry,
      }
    )
  return gpd.GeoDataFrame(records, geometry="geometry", crs=BERLIN_PROJECTED)


def normalized_wall(frame: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
  """Keep the official Vorderlandmauer line used by Berlin's double-row cue."""
  if frame.empty:
    return gpd.GeoDataFrame(geometry=[], crs=BERLIN_PROJECTED)
  result = frame[
    [column for column in ("gisid", "objekt", "geometry") if column in frame]
  ].copy()
  result = result.rename(columns={"gisid": "wall_id", "objekt": "wall_type"})
  result["wall_id"] = result["wall_id"].astype("string")
  return result


def write_layers(
  trees: gpd.GeoDataFrame,
  lights: gpd.GeoDataFrame,
  wall: gpd.GeoDataFrame,
  output_path: Path,
) -> None:
  """Write deterministic, clipped official detail layers."""
  output_path.parent.mkdir(parents=True, exist_ok=True)
  output_path.unlink(missing_ok=True)
  for name, frame in (
    ("trees", trees),
    ("street_lights", lights),
    ("berlin_wall", wall),
  ):
    normalized = frame.copy()
    for column in normalized.columns:
      if column != "geometry" and normalized[column].dtype == object:
        normalized[column] = normalized[column].astype("string")
    normalized.to_file(output_path, layer=name, driver="GPKG")


def fetch_official_details(
  bounds_path: Path,
  output_path: Path,
  raw_dir: Path,
  *,
  timeout: int = 120,
) -> dict[str, int]:
  """Fetch all official detail sources and return clipped feature counts."""
  bounds_frame = gpd.read_file(bounds_path).to_crs(BERLIN_PROJECTED)
  clip_geometry = bounds_frame.geometry.union_all()
  bounds = tuple(float(value) for value in bounds_frame.total_bounds)
  raw_dir.mkdir(parents=True, exist_ok=True)

  payloads: dict[str, dict[str, Any]] = {}
  for index, layer in enumerate(TREE_LAYERS):
    payloads[f"trees-{index + 1}"] = fetch_feature_collection(
      layer, bounds, timeout=timeout
    )
  payloads["street-lights"] = fetch_feature_collection(
    LIGHT_LAYER, bounds, timeout=timeout
  )
  payloads["berlin-wall"] = fetch_feature_collection(
    WALL_LAYER, bounds, timeout=timeout
  )
  for name, payload in payloads.items():
    (raw_dir / f"{name}.geojson").write_text(
      json.dumps(payload, ensure_ascii=False), encoding="utf-8"
    )

  tree_frames = [
    clipped_frame(payloads[f"trees-{index + 1}"], clip_geometry)
    for index in range(len(TREE_LAYERS))
  ]
  trees = normalized_trees(tree_frames)
  lights = normalized_lights(clipped_frame(payloads["street-lights"], clip_geometry))
  wall = normalized_wall(clipped_frame(payloads["berlin-wall"], clip_geometry))
  write_layers(trees, lights, wall, output_path)
  return {"trees": len(trees), "street_lights": len(lights), "berlin_wall": len(wall)}


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--bounds",
    type=Path,
    default=Path("geo_data/regierungsviertel/bounds.geojson"),
  )
  parser.add_argument(
    "--out",
    type=Path,
    default=Path("geo_data/regierungsviertel/official_details.gpkg"),
  )
  parser.add_argument(
    "--raw-dir",
    type=Path,
    default=Path("geo_data/regierungsviertel/raw/official_details"),
  )
  parser.add_argument("--timeout", type=int, default=120)
  args = parser.parse_args()
  counts = fetch_official_details(
    args.bounds, args.out, args.raw_dir, timeout=args.timeout
  )
  summary = ", ".join(f"{name}={count}" for name, count in counts.items())
  print(f"Wrote official detail layers to {args.out}: {summary}")


if __name__ == "__main__":
  main()
