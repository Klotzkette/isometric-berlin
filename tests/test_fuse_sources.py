"""Tests for the additive fused source-stack manifest (pipeline step 6)."""

from __future__ import annotations

import json
from pathlib import Path

from isometric_berlin.data import fuse_sources as fs

ENABLED_ENV = {
  "GOOGLE_MAPS_API_KEY": "k",
  "GOOGLE_MAPS_3D_TILES_ENABLED": "true",
  "GOOGLE_MAPS_TERMS_ACCEPTED": "true",
}


def _write(path: Path, text: str = "x") -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(text, encoding="utf-8")


def test_all_sources_present_in_inventory_even_when_absent(tmp_path: Path) -> None:
  manifest = fs.build_fused_manifest(tmp_path / "bounds.geojson", tmp_path, {})
  assert set(manifest["sources"]) == {"lod2", "osm", "alkis", "dop", "dgm", "google3d"}
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
