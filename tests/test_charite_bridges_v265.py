"""Exact source receipts for the narrow Charité bridge reconstruction."""

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from build_charite_bridges_alt_mitte_v265 import source_models  # noqa: E402
from build_charite_bridges_v265 import build  # noqa: E402


def read(relative):
  return json.loads((ROOT / relative).read_text())


def test_reproducible_source_receipt_and_full_native_owner_audit():
  evidence, runtime = build()
  assert evidence == read(
    "geo_data/regierungsviertel/charite-bridges-v265-evidence.json"
  )
  assert runtime == read("src/app/src/data/chariteBridgesV265.json")
  assert len(evidence["exclusive_native_columns"]) == 12
  assert len(evidence["retained_foreign_native_columns"]) == 6
  assert all(not row["foreign"] for row in evidence["exclusive_native_columns"])
  assert all(row["foreign"] for row in evidence["retained_foreign_native_columns"])
  assert evidence["unchanged_east_bridge_control"]["id"] == "L2e097lj"
  for source in evidence["source_parts"]:
    assert source["all_surfaces"]
    assert any(s["kind"] == "GroundSurface" for s in source["all_surfaces"])
  assert "photo-based display estimates" in evidence["estimates"]


def test_immutable_packets_and_unchanged_native_neighbours():
  evidence = read(
    "geo_data/regierungsviertel/charite-bridges-v265-alt-mitte-evidence.json"
  )
  for relative, expected in evidence["inputs"].items():
    assert hashlib.sha256((ROOT / relative).read_bytes()).hexdigest() == expected
  assert evidence["exactMatchMissing"] == 0
  assert evidence["unownedTriangleLoss"] == 0
  assert evidence["sharedInkPreserved"] is True
  retained = read("src/app/src/data/chariteBridgesV265RetainedNative.json")
  assert retained["parts"] == ["DEBE3DEoYsy3csRF", "DEBE3DwIwW6P5hSu"]
  assert len(retained["triangles"]) == evidence["retainedNativeTriangles"]
  assert [p["id"] for p in evidence["retainedNativeSourceParts"]] == retained["parts"]
  for part in evidence["retainedNativeSourceParts"]:
    assert part["surfaces"] and part["footprintPolygons"]
    assert part["groundY"] == 5.2
  assert (
    ROOT / "src/app/src/data/chariteBridgesV265RetainedNative.json"
  ).stat().st_size < 65536


def test_retained_native_neighbours_reproduce_the_complete_original_pipeline():
  _, _, models = source_models()
  retained = read("src/app/src/data/chariteBridgesV265RetainedNative.json")
  evidence = read(
    "geo_data/regierungsviertel/charite-bridges-v265-alt-mitte-evidence.json"
  )
  triangles = [
    [points, list(color)]
    for model in models.values()
    for points, color, _ in model["retainedNative"].triangles
  ]
  assert retained["triangles"] == triangles
  assert evidence["retainedNativeSourceParts"] == [
    p for m in models.values() for p in m["retainedSourceParts"]
  ]
