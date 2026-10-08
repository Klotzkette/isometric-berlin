"""Finite additive scope, source retention and bounded delivery regression checks."""

import json
import sys
from pathlib import Path

import pytest
from pyproj import Transformer
from shapely.geometry import Point

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_north_city_v190 import DATA, merge_manifest  # noqa: E402
from build_surrounding_outlines import load_projected_polygon  # noqa: E402


def test_requested_north_scope_and_previous_core_do_not_overlap():
  added = load_projected_polygon(DATA / "bounds-north-v190.geojson").difference(
    load_projected_polygon(DATA / "bounds-retained-v189.geojson")
  )
  assert 13e6 < added.area < 14e6
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform
  for lon, lat in [(13.408, 52.571), (13.460, 52.550)]:
    assert added.covers(Point(*project(lon, lat)))
  assert not added.covers(Point(*project(13.502, 52.635)))  # Buch not authorized.


def test_manifest_append_preserves_unrelated_packet_descriptors_and_source_footprints():
  previous = {
    "chunks": [{"id": "old", "drawn": {"sha256": "keep"}}],
    "footprint": [{"ring": [[1, 2], [3, 4]]}],
    "bounds": [0, 0, 10, 10],
  }
  supplement = {
    "chunks": [{"id": "north190-new"}],
    "footprint": [{"ring": [[11, 12], [13, 14]]}],
    "bounds": [5, -4, 15, 8],
    "source": {"policy": "fixture"},
  }
  merged = merge_manifest(previous, supplement)
  assert merged["chunks"][0] == previous["chunks"][0]
  assert merged["footprint"][0] == previous["footprint"][0]
  assert merged["bounds"] == [0, -4, 15, 10]
  assert len(previous["chunks"]) == 1
  with pytest.raises(ValueError):
    merge_manifest(merged, supplement)


def test_new_packets_have_separate_representations_and_full_source_inventory():
  manifest = json.loads((DATA / "north-city-v190-manifest.json").read_text())
  assert len(manifest["chunks"]) == 84
  assert manifest["source"]["buildingCount"] > 9000
  assert manifest["source"]["completeNamedOwnerSubstitutions"]["packets"] == [
    "north190-11_-6"
  ]
  for chunk in manifest["chunks"]:
    assert chunk["id"].startswith("north190-")
    assert chunk["drawn"]["sha256"] != chunk["minecraft"]["sha256"]
    for mode in ["drawn", "minecraft"]:
      assert chunk[mode]["bytes"] < 5 * 1024 * 1024


def test_complete_manifest_fits_existing_browser_fetch_limit():
  # The runtime refuses a manifest larger than2MiB before parsing it. Formatting
  # must not make otherwise valid city geometry disappear behind a caught warning.
  manifest = ROOT / "src/app/public/mesh/surrounding-berlin-v159/manifest.json"
  assert manifest.stat().st_size <= 2 * 1024 * 1024
  data = json.loads(manifest.read_bytes())
  assert len(data["chunks"]) <= 2048
  assert len(data["footprint"]) <= 1000
