"""Tests for the additive fused source-stack manifest (pipeline step 6)."""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
from shapely.geometry import Point

from isometric_berlin.data import fuse_sources as fs

ENABLED_ENV = {
  "GOOGLE_MAPS_API_KEY": "k",
  "GOOGLE_MAPS_3D_TILES_ENABLED": "true",
  "GOOGLE_MAPS_TERMS_ACCEPTED": "true",
}


def _write(path: Path, text: str = "x") -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(text, encoding="utf-8")


def _write_bounds(path: Path) -> None:
  _write(
    path,
    json.dumps(
      {
        "type": "FeatureCollection",
        "features": [
          {
            "type": "Feature",
            "properties": {},
            "geometry": {
              "type": "Polygon",
              "coordinates": [
                [
                  [13.0, 52.0],
                  [13.01, 52.0],
                  [13.01, 52.01],
                  [13.0, 52.01],
                  [13.0, 52.0],
                ]
              ],
            },
          }
        ],
      }
    ),
  )


def test_all_sources_present_in_inventory_even_when_absent(tmp_path: Path) -> None:
  manifest = fs.build_fused_manifest(tmp_path / "bounds.geojson", tmp_path, {})
  assert set(manifest["sources"]) == {
    "lod2",
    "osm",
    "alkis",
    "dop",
    "dgm",
    "berlinmesh",
    "google3d",
    "wikimedia",
  }
  assert manifest["fusion"] == "additive"
  assert manifest["features"] == []
  assert manifest["conflict_log"] == []
  # Absent sources are recorded, not dropped.
  assert all(not s["available"] for s in manifest["sources"].values())
  assert manifest["sources"]["lod2"]["reason"] == "not_downloaded"


def test_present_required_sources_detected(tmp_path: Path) -> None:
  _write(tmp_path / "buildings.gpkg")
  _write(tmp_path / "osm.gpkg")
  manifest = fs.build_fused_manifest(tmp_path / "bounds.geojson", tmp_path, {})
  assert manifest["sources"]["lod2"]["available"] is True
  assert manifest["sources"]["osm"]["available"] is True
  assert manifest["sources"]["lod2"]["license"] == "dl-de/zero-2-0"


def test_wikimedia_reference_source_detected(tmp_path: Path) -> None:
  _write(tmp_path / "wikimedia_references.json", json.dumps({"records": []}))

  manifest = fs.build_fused_manifest(tmp_path / "bounds.geojson", tmp_path, {})

  assert manifest["sources"]["wikimedia"]["available"] is True
  assert manifest["sources"]["wikimedia"]["path"].endswith("wikimedia_references.json")
  assert "Wikimedia Commons" in manifest["sources"]["wikimedia"]["license"]


def test_official_berlin_mesh_source_detected(tmp_path: Path) -> None:
  _write(tmp_path / "berlin_3d_mesh_sources.json", json.dumps({"tiles": []}))

  manifest = fs.build_fused_manifest(tmp_path / "bounds.geojson", tmp_path, {})

  source = manifest["sources"]["berlinmesh"]
  assert source["available"] is True
  assert source["path"].endswith("berlin_3d_mesh_sources.json")
  assert "Berlin 3D" in source["license"]


def test_official_support_sources_detect_derived_artifacts(tmp_path: Path) -> None:
  _write(tmp_path / "alkis.gpkg")
  _write(tmp_path / "dop_preview.png")
  _write(tmp_path / "dgm_preview.png")

  manifest = fs.build_fused_manifest(tmp_path / "bounds.geojson", tmp_path, {})

  assert manifest["sources"]["alkis"]["available"] is True
  assert manifest["sources"]["alkis"]["path"].endswith("alkis.gpkg")
  assert manifest["sources"]["dop"]["available"] is True
  assert manifest["sources"]["dgm"]["available"] is True


def test_features_include_lod2_anchor_and_osm_semantics(tmp_path: Path) -> None:
  bounds_path = tmp_path / "bounds.geojson"
  _write_bounds(bounds_path)
  inside = gpd.GeoSeries([Point(13.005, 52.005)], crs="EPSG:4326").to_crs("EPSG:25833")[
    0
  ]
  outside = gpd.GeoSeries([Point(13.05, 52.05)], crs="EPSG:4326").to_crs("EPSG:25833")[
    0
  ]
  buildings = gpd.GeoDataFrame(
    [
      {
        "building_id": "DEBE_A",
        "measured_height_m": 12.5,
        "roof_type": "1000",
        "function": "31001",
        "geometry": inside.buffer(10).envelope,
      },
      {
        "building_id": "DEBE_B",
        "measured_height_m": 6.0,
        "roof_type": "9999",
        "function": "51009",
        "geometry": inside.buffer(20).envelope,
      },
      {
        "building_id": "DEBE_OUTSIDE",
        "measured_height_m": 9.0,
        "roof_type": "9999",
        "function": "51009",
        "geometry": outside.buffer(10).envelope,
      },
    ],
    crs="EPSG:25833",
  )
  buildings.to_file(tmp_path / "buildings.gpkg", layer="buildings", driver="GPKG")
  pois = gpd.GeoDataFrame(
    [
      {
        "osmid": 1,
        "name": "Reichstagsgebäude",
        "amenity": "parliament",
        "geometry": inside,
      }
    ],
    crs="EPSG:25833",
  )
  pois.to_file(tmp_path / "osm.gpkg", layer="pois", driver="GPKG")

  manifest = fs.build_fused_manifest(bounds_path, tmp_path, {})

  assert len(manifest["features"]) == 2
  first = manifest["features"][0]
  assert first["anchor_source"] == "lod2"
  assert first["geometry_evidence"][0]["source"] == "lod2"
  assert first["geometry_evidence"][0]["attributes"]["measured_height_m"] == 12.5
  assert first["semantic_evidence"][0]["source"] == "osm"
  assert first["semantic_evidence"][0]["tags"]["name"] == "Reichstagsgebäude"


def test_google_reason_opt_in_missing_when_no_manifest(tmp_path: Path) -> None:
  manifest = fs.build_fused_manifest(tmp_path / "bounds.geojson", tmp_path, {})
  assert manifest["sources"]["google3d"] == {
    "available": False,
    "reason": "opt_in_env_missing",
  }


def test_google_reflects_available_manifest(tmp_path: Path) -> None:
  google = tmp_path / "raw" / "google_3d_tiles" / "manifest.json"
  _write(google, json.dumps({"source": "google3d", "available": True, "tiles": []}))
  manifest = fs.build_fused_manifest(tmp_path / "bounds.geojson", tmp_path, ENABLED_ENV)
  assert manifest["sources"]["google3d"]["available"] is True


def test_google_reflects_unavailable_manifest_reason(tmp_path: Path) -> None:
  google = tmp_path / "raw" / "google_3d_tiles" / "manifest.json"
  _write(
    google,
    json.dumps({"source": "google3d", "available": False, "reason": "quota"}),
  )
  manifest = fs.build_fused_manifest(tmp_path / "bounds.geojson", tmp_path, {})
  assert manifest["sources"]["google3d"] == {"available": False, "reason": "quota"}
