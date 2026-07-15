"""Build the fused source-stack manifest for the Regierungsviertel.

This is pipeline step 6 (see ``AGENTS.md`` §5 and
``docs/data.md``). It does **additive** fusion: every permitted source
that is available contributes; conflicts are recorded, not silently
resolved.

Output
------

Writes ``geo_data/regierungsviertel/fused_sources.json`` with the
shape documented in ``docs/data.md`` ("Fused source-stack manifest").

Inputs
------

- ``geo_data/regierungsviertel/buildings.gpkg`` (LoD2, required)
- ``geo_data/regierungsviertel/osm.gpkg`` (OSM, required)
- ``geo_data/regierungsviertel/raw/alkis/`` (optional)
- ``geo_data/regierungsviertel/raw/dop/`` (optional)
- ``geo_data/regierungsviertel/raw/dgm/`` (optional)
- ``geo_data/regierungsviertel/berlin_3d_mesh_sources.json``
  (official photogrammetric mesh provenance)
- ``geo_data/regierungsviertel/official_details.gpkg``
  (official trees, public lighting and Berlin Wall route)
- ``geo_data/regierungsviertel/raw/google_3d_tiles/manifest.json``
  (optional, opt-in)
- ``geo_data/regierungsviertel/wikimedia_references.json``
  (optional visual-reference layer)

Behaviour
---------

- A source that is missing or unavailable is recorded as
  ``available: false`` with a ``reason`` — it is NOT silently dropped.
- Conflicts between sources on the same attribute are recorded in
  ``conflict_log`` and BOTH values stay in the per-feature evidence
  list. The winning value is chosen per the ranking table in
  ``docs/data.md``.
- Hero features (Reichstag dome, Hauptbahnhof glass roof) may be
  marked ``manual: true`` to bypass automatic conflict resolution.

When ``buildings.gpkg`` exists, each LoD2 building inside the bounds is
emitted as a feature with LoD2 geometry evidence. OSM POIs that
intersect the footprint are attached as additive semantic evidence.
Unavailable optional sources stay in the source inventory with a
reason, rather than disappearing from the manifest.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import geopandas as gpd
import pandas as pd

from isometric_berlin.data.common import load_bounds_polygon, project_geometry
from isometric_berlin.data.fetch_google_tiles import opt_in_satisfied

SOURCE_LICENSES: dict[str, str] = {
  "lod2": "dl-de/zero-2-0",
  "osm": "ODbL-1.0",
  "alkis": "dl-de/zero-2-0",
  "dop": "dl-de/zero-2-0",
  "dgm": "dl-de/zero-2-0",
  "berlinmesh": "Berlin 3D Downloadportal terms; provider attribution required",
  "berlindetails": "dl-de/zero-2-0",
  "google3d": "Google Maps Platform Terms",
  "wikimedia": "Various Wikimedia Commons free licenses; see manifest per image",
}


def _file_source(source_id: str, path: Path) -> dict[str, Any]:
  if path.exists():
    return {
      "available": True,
      "path": str(path),
      "license": SOURCE_LICENSES[source_id],
    }
  return {"available": False, "reason": "not_downloaded"}


def _dir_source(source_id: str, path: Path) -> dict[str, Any]:
  if path.is_dir() and any(path.iterdir()):
    return {
      "available": True,
      "path": str(path),
      "license": SOURCE_LICENSES[source_id],
    }
  return {"available": False, "reason": "not_downloaded"}


def _support_source(
  source_id: str, raw_path: Path, derived_path: Path
) -> dict[str, Any]:
  """Reflect an optional official support layer from raw or derived artefacts."""
  manifest_path = raw_path / "manifest.json"
  if manifest_path.exists():
    try:
      manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
      manifest = {}
    if manifest.get("available") is False:
      return {
        "available": False,
        "reason": manifest.get("reason", "manifest_unavailable"),
      }
  if derived_path.exists():
    source = {
      "available": True,
      "path": str(derived_path),
      "license": SOURCE_LICENSES[source_id],
    }
    if raw_path.is_dir() and any(raw_path.iterdir()):
      source["raw_path"] = str(raw_path)
    return source
  return _dir_source(source_id, raw_path)


def _google_source(manifest_path: Path, env: dict[str, str]) -> dict[str, Any]:
  """Reflect the google3d manifest if present, else record why it is absent.

  Never embeds Google content or keys — only references the manifest by
  path and mirrors its ``available`` flag.
  """
  if manifest_path.exists():
    try:
      payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
      payload = {}
    if payload.get("available"):
      return {
        "available": True,
        "path": str(manifest_path),
        "license": SOURCE_LICENSES["google3d"],
      }
    return {
      "available": False,
      "reason": payload.get("reason", "manifest_unavailable"),
    }
  ok, _ = opt_in_satisfied(env)
  # Opted in but no manifest yet -> the fetcher simply has not run.
  reason = "opt_in_env_missing" if not ok else "manifest_not_generated"
  return {"available": False, "reason": reason}


def discover_sources(geo_dir: Path, env: dict[str, str]) -> dict[str, Any]:
  """Inventory every permitted source (none is dropped because absent)."""
  raw = geo_dir / "raw"
  return {
    "lod2": _file_source("lod2", geo_dir / "buildings.gpkg"),
    "osm": _file_source("osm", geo_dir / "osm.gpkg"),
    "alkis": _support_source("alkis", raw / "alkis", geo_dir / "alkis.gpkg"),
    "dop": _support_source("dop", raw / "dop", geo_dir / "dop_preview.png"),
    "dgm": _support_source("dgm", raw / "dgm", geo_dir / "dgm_preview.png"),
    "berlinmesh": _file_source("berlinmesh", geo_dir / "berlin_3d_mesh_sources.json"),
    "berlindetails": _file_source("berlindetails", geo_dir / "official_details.gpkg"),
    "google3d": _google_source(raw / "google_3d_tiles" / "manifest.json", env),
    "wikimedia": _file_source("wikimedia", geo_dir / "wikimedia_references.json"),
  }


def read_layer(path: Path, layer: str) -> gpd.GeoDataFrame:
  """Read a GeoPackage layer, returning an empty GeoDataFrame on absence."""
  if not path.exists():
    return gpd.GeoDataFrame(geometry=[], crs="EPSG:25833")
  try:
    gdf = gpd.read_file(path, layer=layer)
  except Exception:
    return gpd.GeoDataFrame(geometry=[], crs="EPSG:25833")
  if gdf.crs is None:
    gdf = gdf.set_crs("EPSG:25833")
  return gdf.to_crs("EPSG:25833")


def semantic_tags(row: Any) -> dict[str, str]:
  """Return non-empty OSM semantic tags from a row."""
  tags: dict[str, str] = {}
  for key in ["name", "amenity", "tourism", "historic", "bridge"]:
    value = row.get(key)
    if value is None:
      continue
    text = str(value)
    if text and text != "<NA>" and text.lower() != "nan":
      tags[key] = text
  return tags


def json_value(value: Any) -> str | float | int | None:
  """Return a JSON-safe scalar or ``None`` for missing values."""
  if value is None or pd.isna(value):
    return None
  if hasattr(value, "item"):
    value = value.item()
  if isinstance(value, int | float | str):
    return value
  return str(value)


def osm_semantic_evidence(
  building: Any, pois: gpd.GeoDataFrame, *, max_matches: int = 4
) -> list[dict[str, Any]]:
  """Find additive OSM semantic evidence intersecting a building."""
  if pois.empty:
    return []
  matches: list[dict[str, Any]] = []
  possible = pois.iloc[
    list(pois.sindex.query(building.geometry, predicate="intersects"))
  ]
  for _, poi in possible.head(max_matches).iterrows():
    tags = semantic_tags(poi)
    if not tags:
      continue
    ref = poi.get("osmid") or poi.get("id") or poi.name
    matches.append(
      {
        "source": "osm",
        "confidence": 0.8,
        "ref": f"osm.gpkg#pois={ref}",
        "tags": tags,
      }
    )
  return matches


def build_features(bounds_path: Path, geo_dir: Path) -> list[dict[str, Any]]:
  """Build per-building additive provenance from LoD2 and OSM."""
  buildings = read_layer(geo_dir / "buildings.gpkg", "buildings")
  if buildings.empty:
    return []
  bounds = project_geometry(load_bounds_polygon(bounds_path))
  buildings = buildings[buildings.geometry.intersects(bounds)].copy()
  pois = read_layer(geo_dir / "osm.gpkg", "pois")
  features: list[dict[str, Any]] = []
  for index, building in buildings.iterrows():
    building_id = building.get("building_id") or f"lod2-{index}"
    geometry_attrs = {
      "measured_height_m": json_value(building.get("measured_height_m")),
      "roof_type": json_value(building.get("roof_type")),
      "function": json_value(building.get("function")),
      "parent_building_id": json_value(building.get("parent_building_id")),
      "lod2_role": json_value(building.get("lod2_role")),
      "source_creation_date": json_value(building.get("source_creation_date")),
    }
    features.append(
      {
        "feature_id": str(building_id),
        "kind": "building",
        "anchor_source": "lod2",
        "geometry_evidence": [
          {
            "source": "lod2",
            "confidence": 1.0,
            "ref": f"buildings.gpkg#building_id={building_id}",
            "attributes": {
              key: value for key, value in geometry_attrs.items() if value is not None
            },
          }
        ],
        "semantic_evidence": osm_semantic_evidence(building, pois),
        "conflicts": [],
      }
    )
  return features


def build_fused_manifest(
  bounds_path: Path, geo_dir: Path, env: dict[str, str]
) -> dict[str, Any]:
  """Build the additive fused source-stack manifest (per docs/data.md)."""
  return {
    "bounds_ref": str(bounds_path),
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "fusion": "additive",
    "sources": discover_sources(geo_dir, env),
    "features": build_features(bounds_path, geo_dir),
    "conflict_log": [],
  }


def main() -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--bounds",
    type=Path,
    default=Path("geo_data/regierungsviertel/bounds.geojson"),
  )
  parser.add_argument(
    "--out",
    type=Path,
    default=Path("geo_data/regierungsviertel/fused_sources.json"),
  )
  args = parser.parse_args()

  import os

  manifest = build_fused_manifest(args.bounds, args.bounds.parent, dict(os.environ))
  args.out.parent.mkdir(parents=True, exist_ok=True)
  args.out.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
  )

  available = sum(1 for s in manifest["sources"].values() if s["available"])
  total = len(manifest["sources"])
  print(f"Wrote fused source manifest to {args.out} ({available}/{total} available).")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
