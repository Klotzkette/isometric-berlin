"""Finite source-derived urban coverage keeps every earlier source packet exact."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from shapely.geometry import Point, Polygon
from shapely.ops import unary_union
from station_receipts_v183 import verified_station_replacements

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_city_coverage_v183 as builder  # noqa: E402


def test_finite_south_and_landmark_lobes_subtract_exact_previous_ownership() -> None:
  bounds, retained = builder.build_bounds()
  assert json.loads(json.dumps(bounds)) == json.loads(
    (builder.DATA / "bounds-city-v183.geojson").read_bytes()
  )
  assert json.loads(json.dumps(retained)) == json.loads(
    (builder.DATA / "bounds-retained-v182.geojson").read_bytes()
  )
  new = builder.exporter.load_projected_polygon(
    builder.DATA / "bounds-city-v183.geojson"
  )
  old = builder.exporter.load_projected_polygon(
    builder.DATA / "bounds-retained-v182.geojson"
  )
  expected = builder.exporter.world(new.difference(old))
  scope = json.loads(
    (ROOT / "src/app/src/data/cityCoverageScopeV183.json").read_bytes()
  )
  actual = unary_union([Polygon(p["ring"], p["holes"]) for p in scope["footprint"]])
  assert actual.symmetric_difference(expected).area < expected.length * 0.0075
  assert 10e6 < actual.area < 10.1e6
  for lon, lat in [(13.325, 52.476), (13.357, 52.477), (13.37, 52.476)]:
    assert new.contains(Point(*builder.PROJECT(lon, lat)))
  assert not new.contains(Point(*builder.PROJECT(13.2, 52.46)))
  assert not new.contains(Point(*builder.PROJECT(13.4, 52.44)))


def test_v182_packets_survive_except_replayed_exact_station_owner_replacements() -> (
  None
):
  path = builder.PUBLIC / "manifest.json"
  old = json.loads(
    subprocess.check_output(
      ["git", "show", f"v1.0.82:{path.relative_to(ROOT)}"], cwd=ROOT
    )
  )
  current = json.loads(path.read_bytes())
  station_rows, _ = verified_station_replacements()
  for previous, actual in zip(
    old["chunks"], current["chunks"][: len(old["chunks"])], strict=True
  ):
    expected = copy.deepcopy(previous)
    for mode in station_rows.get(previous["id"], {}).get("modes", {}):
      expected[mode] = actual[mode]
    assert actual == expected
  assert current["footprint"][: len(old["footprint"])] == old["footprint"]
  for chunk in old["chunks"]:
    for mode in ("drawn", "minecraft"):
      asset = chunk[mode]
      receipt = station_rows.get(chunk["id"], {}).get("modes", {}).get(mode)
      assert hashlib.sha256(
        (builder.PUBLIC / asset["url"]).read_bytes()
      ).hexdigest() == (receipt["newSha256"] if receipt else asset["sha256"])
  for filename in ("bounds.geojson", "bounds-ring-v182.geojson"):
    path = builder.DATA / filename
    assert path.read_bytes() == subprocess.check_output(
      ["git", "show", f"v1.0.82:{path.relative_to(ROOT)}"], cwd=ROOT
    )


def test_merge_repetition_is_idempotent_and_preserves_input() -> None:
  supplement = json.loads(
    (builder.DATA / "city-coverage-v183-manifest.json").read_bytes()
  )
  current = json.loads((builder.PUBLIC / "manifest.json").read_bytes())
  snapshot = copy.deepcopy(current)
  assert builder.merge_manifest(current, supplement) == current
  assert current == snapshot


def test_all_new_packets_keep_bounded_native_drawn_and_source_inventory() -> None:
  manifest = json.loads(
    (builder.DATA / "city-coverage-v183-manifest.json").read_bytes()
  )
  assert len(manifest["chunks"]) == 67
  sources = set()
  courts = 0
  for chunk in manifest["chunks"]:
    for mode in ("drawn", "minecraft"):
      asset = chunk[mode]
      raw = (builder.PUBLIC / asset["url"]).read_bytes()
      assert len(raw) == asset["bytes"] < 500_000
      assert hashlib.sha256(raw).hexdigest() == asset["sha256"]
      unpacked = gzip.decompress(raw)
      assert len(unpacked) == asset["decodedBytes"] < 2_000_000
      packet = json.loads(unpacked)
      assert packet["id"] == chunk["id"]
      assert packet["nav"]["ground"]
      if mode == "minecraft":
        assert "lines" not in packet
      else:
        for b in packet["nav"]["buildings"]:
          sources.add(b["sourceId"])
          courts += len(b["holes"])
  assert len(sources) == 4517
  assert courts == 86
  source = manifest["source"]["inventory"]
  packed = (builder.PUBLIC / source["url"]).read_bytes()
  assert hashlib.sha256(packed).hexdigest() == source["sha256"]
  inventory = json.loads(gzip.decompress(packed))
  assert len(inventory["roadSources"]) == 7231
