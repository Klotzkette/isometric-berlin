"""Bounded measured Wuhlheide relief, open membrane and retained source rings."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_wuhlheide_v201 import DATA, FIELD, SOURCE, SUPPORT, offset_at  # noqa:E402


def test_official_complete_local_samples_and_drawn_terrain_agree():
  s = json.loads(gzip.decompress(SOURCE.read_bytes()))
  f = json.loads(FIELD.read_bytes())
  assert s["dgm"]["stepM"] == 1
  grid = np.asarray(s["dgm"]["nhn"])
  w, n, e, b = SUPPORT
  assert grid.shape == (b - n + 1, e - w + 1)
  assert grid.min() > 30 and grid.max() < 49
  assert f["profiles"][0]["stepM"] == 4 and f["nativeStepM"] == 4
  for z in range(n + 32, b - 31, 4):
    for x in range(w + 32, e - 31, 4):
      assert abs(offset_at(x, z) - (grid[z - n, x - w] - 33)) < 0.00011
  assert 3.8 < 3 + offset_at(11674, 6568) < 4.1
  assert offset_at(11730, 6560) - offset_at(11674, 6568) > 11
  for x in range(w, e + 1, 4):
    assert offset_at(x, n) == offset_at(x, b) == 0


def test_every_seating_and_roof_source_vertex_remains_available():
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  fs = {f["id"]: f for f in source["osm"]["features"]}
  assert fs["way/20418995"]["tags"]["covered"] == "no"
  assert fs["way/20418995"]["tags"]["seats"] == "12390"
  roof = shape(fs["way/33468397"]["worldGeometry"])
  nav = json.loads((DATA / "wuhlheideV201Navigation.json").read_bytes())
  assert roof.symmetric_difference(Polygon(nav["roof"]["ring"])).area < 0.07
  deck = Polygon(nav["stage"]["ring"])
  assert math.isclose(deck.area, 22.5 * 16, abs_tol=0.05)
  assert len(nav["legs"]) == 8
  assert nav["roof"]["bottomY"] - nav["stage"]["topY"] > 8
  assert len([f for f in fs.values() if f["tags"].get("step_count") == "80"]) == 6


def test_new_canopy_covers_exact_source_footprint_with_open_bottom():
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  roof = shape(
    next(
      f["worldGeometry"] for f in source["osm"]["features"] if f["id"] == "way/33468397"
    )
  )
  data = json.loads((DATA / "wuhlheideV201.json").read_bytes())["sites"][0]
  p = np.asarray(data["positions"]).reshape(-1, 3)
  c = np.asarray(data["colors"])
  idx = np.asarray(data["indices"]).reshape(-1, 3)
  membrane = [Polygon(p[t][:, [0, 2]]) for t in idx if c[t[0]] == 0xE9E9D9]
  union = unary_union(membrane)
  assert union.symmetric_difference(roof).area < 0.05
  assert np.min(p[np.where(c == 0xE9E9D9)[0], 1]) >= 14.7
  assert p[:, 1].max() == 24.5
  assert np.all(np.isfinite(p))


def test_packet_patch_retains_baseline_descriptor_counts_and_budgets():
  r = json.loads(
    (ROOT / "geo_data/regierungsviertel/wuhlheide-v201-packet-audit.json").read_bytes()
  )
  checkpoint = ROOT / "geo_data/regierungsviertel" / r["checkpoint"]["url"]
  assert (
    hashlib.sha256(checkpoint.read_bytes()).hexdigest() == r["checkpoint"]["sha256"]
  )
  assert len(r["descriptors"]) == 6
  assert r["completeReplacementOwners"] == ["OSM-way-20418995", "OSM-way-33468397"]
  assert {d["id"]: d["buildingCount"] for d in r["descriptors"]} == {
    "outer187-22_13": 28,
    "outer187-23_13": 2,
    "east200-22_12": 55,
    "east200-22_13": 32,
    "east200-23_12": 33,
    "east200-23_13": 25,
  }
  for d in r["descriptors"]:
    for mode in ["drawn", "minecraft"]:
      assert d[mode]["bytes"] <= 650000 and d[mode]["decodedBytes"] <= 2600000
