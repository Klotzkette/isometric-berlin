"""Checks for the bounded Großer Tiergarten vegetation sidecar."""

from __future__ import annotations

import json
from pathlib import Path

from shapely.geometry import shape

from isometric_berlin.data.extract_tiergarten_vegetation import build_collection

OSM = Path("geo_data/regierungsviertel/osm.gpkg")
PBF = Path("geo_data/regierungsviertel/raw/osm/berlin-latest.osm.pbf")
PAYLOAD = Path("geo_data/regierungsviertel/tiergarten-vegetation.geojson")


def test_committed_tiergarten_vegetation_is_small_and_source_auditable() -> None:
  assert PAYLOAD.stat().st_size < 128 * 1024
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  assert payload["source"]["license"] == "ODbL-1.0"
  assert payload["source"]["park_relation_url"].endswith("/relation/7643526")
  assert "no hedge courses" in payload["source"]["geometry_status"]
  assert payload["metrics"] == {
    "hedge_area_count": 2,
    "hedge_area_m2": 526.8,
    "hedge_line_count": 21,
    "hedge_line_length_m": 1099.2,
    "scrub_area_count": 83,
    "scrub_area_m2": 106628.5,
  }
  assert all(
    feature["properties"]["source_url"]
    == f"https://www.openstreetmap.org/way/{feature['properties']['osm_id']}"
    for feature in payload["features"]
  )
  assert all(shape(feature["geometry"]).is_valid for feature in payload["features"])


def test_local_pbf_rebuild_matches_the_committed_source_inventory() -> None:
  if not PBF.exists():
    return
  rebuilt = build_collection(OSM, PBF)
  committed = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  assert rebuilt["metrics"] == committed["metrics"]
  assert [feature["properties"]["id"] for feature in rebuilt["features"]] == [
    feature["properties"]["id"] for feature in committed["features"]
  ]
