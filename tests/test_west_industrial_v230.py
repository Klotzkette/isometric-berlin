"""Whole named source coverage, independent transfer replay and native geometry."""

import hashlib
import json
import math
from collections import Counter
from pathlib import Path

from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(p):
  return json.loads(p.read_text())


def test_whole_island_and_named_warehouse_sources_retained():
  source = read(GEO / "west-industrial-source-v230.json")
  assert (
    source["osmSourceSha256"]
    == hashlib.sha256((GEO / "west-industrial-osm-v230.json").read_bytes()).hexdigest()
  )
  assert {s["key"] for s in source["sites"]} == {
    "eiswerder",
    "reuter-west",
    "westhafen",
  }
  for s in source["sites"]:
    parts = [p for parent in s["parents"] for p in parent["parts"]]
    footprint = shape(s["worldFootprint"])
    covered = unary_union([Polygon(p["ring"], p["holes"]).buffer(0) for p in parts])
    assert footprint.intersection(covered).area / footprint.area > 0.99
    assert all(p["surfaces"] for p in parts)
    if s["key"] == "eiswerder":
      assert len(s["osm"]) == 76
      assert len(s["parents"]) == 171
      assert s["island"]["id"] == "way/23403130"
      assert s["newOnlyAreaM2"] == 0
    if s["key"] == "westhafen":
      assert len(s["osm"]) == 15
      assert "way/26929029" not in {r["id"] for r in s["osm"]}, (
        "Existing Zollspeicher is protected"
      )
  source_ids = [
    p["id"] for s in source["sites"] for parent in s["parents"] for p in parent["parts"]
  ]
  assert len(source_ids) == len(set(source_ids))
  rendered = [
    p["id"]
    for s in read(DATA / "westIndustrialV230Navigation.json")["sites"]
    for p in s["owners"]
  ]
  assert Counter(source_ids) == Counter(rendered), (
    "Every original sheet owner remains present"
  )


def test_all_prior_owners_have_independent_exact_replay():
  from scripts.build_west_industrial_ownership_v230 import build

  receipt = read(DATA / "westIndustrialV230Ownership.json")
  assert receipt == build()
  assert not receipt["blocked"]
  assert len(receipt["authorizedOwners"]) == 91
  for owner in receipt["authorizedOwners"]:
    assert {r["mode"] for r in receipt["records"] if r["owner"] == owner} == {
      "drawn",
      "minecraft",
    }
  for field, indices in [("records", "triangles"), ("lineRecords", "segments")]:
    claims = [
      (r["tile"], r["mode"], r["fingerprint"], i)
      for r in receipt[field]
      for i in r[indices]
    ]
    assert len(claims) == len(set(claims))


def test_native_skins_are_actual_axis_aligned_unit_grid_and_culling_bounds_cover_source():
  native = read(DATA / "westIndustrialV230Native.json")["sites"]
  nav = {s["key"]: s for s in read(DATA / "westIndustrialV230Navigation.json")["sites"]}
  assert len(native) == 10, "Bounded local groups, no island-wide or Berlin-wide batch"
  for s in native:
    for x, y, z, w, h, d, color in s["blocks"][: s["skinCount"]]:
      assert all(math.isfinite(v) for v in (x, y, z, w, h, d))
      assert min(w, h, d) >= 1
      assert all(
        abs(v - round(v)) < 1e-7
        for v in (x - w / 2, x + w / 2, y - h / 2, y + h / 2, z - d / 2, z + d / 2)
      )
    n = nav[s["key"]]
    b = n["bounds"]
    for p in n["owners"]:
      for x, z in p["ring"]:
        assert b[0] <= x <= b[2] and b[1] <= z <= b[3]
  tower = next(s["tower"] for s in nav.values() if s["tower"])
  assert tower["ground"] == 3 and tower["height"] == 100
  assert tower["profile"][-1][0] == 103
  assert tower["profileEstimated"]
  assert 50 < tower["profile"][0][1] < 53
  assert tower["profile"][4][1] < tower["profile"][0][1]
