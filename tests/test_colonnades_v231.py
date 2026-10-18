"""Open museum galleries retain exact original roofs and finite ownership proof."""

import hashlib
import json
import sys
from pathlib import Path

from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_breitscheid_towers_v161 import triangles_for  # noqa: E402
from build_colonnades_core_previous_v231 import build as build_receipt  # noqa: E402
from build_colonnades_v231 import build, rounded  # noqa: E402

DATA = ROOT / "src/app/src/data"
SOURCE = ROOT / "geo_data/regierungsviertel/colonnades-v231-source.json"


def read(path):
  return json.loads(path.read_text())


def test_deterministic_bounded_sources_and_exact_receipts():
  draw, nav = build()
  assert draw == read(DATA / "colonnadesV231.json")
  assert nav == read(DATA / "colonnadesV231Navigation.json")
  assert build_receipt() == read(DATA / "colonnadesCorePreviousV231.json")
  assert (
    draw["evidence"]["sourceSha256"] == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  )
  assert draw["evidence"]["originalSourceSurfaceCount"] == 113
  assert draw["evidence"]["exactRetiredCoreOwners"] == ["33885752", "33887411"]
  assert draw["evidence"]["unaffectedAdjacentCoreOwner"] == "42698898"
  assert (
    sum(
      (DATA / f).stat().st_size
      for f in [
        "colonnadesV231.json",
        "colonnadesV231Navigation.json",
        "colonnadesCorePreviousV231.json",
      ]
    )
    < 650000
  )


def test_complete_measured_roofs_and_mapped_complement_preserved():
  source = read(SOURCE)
  drawn = read(DATA / "colonnadesV231.json")
  site = drawn["sites"][0]
  shift = drawn["evidence"]["sourceToDisplayYOffset"]
  for parent in source["parents"]:
    original = next(s for s in parent["surfaces"] if s["kind"] == "RoofSurface")
    rings = [[[x, y + shift, z] for x, y, z in r] for r in original["rings"]]
    roof = next(
      s
      for s in site["roofs"]
      if s["sourceOwner"] == parent["id"] and s["role"] == "complete-source-roof"
    )
    assert roof["triangles"] == rounded(triangles_for(rings))
  retained = unary_union(
    [
      Polygon([[p[0], p[2]] for p in t])
      for s in site["roofs"]
      if "roof" in s["role"]
      for t in s["triangles"]
    ]
  )
  measured = unary_union([Polygon(p["ring"], p["holes"]) for p in source["parents"]])
  mapped = unary_union([Polygon(p["ring"]) for p in source["osm"]["ways"]])
  assert retained.symmetric_difference(unary_union([measured, mapped])).area < 0.001
  for s in site["roofs"]:
    if s["role"] == "retained-upper-source-wall":
      assert min(p[1] for t in s["triangles"] for p in t) > 12.6


def test_finite_open_post_layout_and_no_lower_infill():
  source = read(SOURCE)
  site = read(DATA / "colonnadesV231.json")["sites"][0]
  shape = unary_union(
    [Polygon(p["ring"], p["holes"]) for p in source["parents"]]
    + [Polygon(w["ring"]) for w in source["osm"]["ways"]]
  )
  assert 220 < len(site["columns"]) < 300
  for x, z, low, high, yaw, tone in site["columns"]:
    assert shape.buffer(0.0001).covers(Point(x, z))
    assert low == 5.22 and high > 12.2
  for x, y, z, w, h, d, yaw, tone in site["boxes"]:
    if 5.5 < y < 11.9:
      assert w <= 1.1 and d <= 1.1
  assert len(site["domes"]) == 3
  assert max(len(r) for r in site["nativeRows"]) == 7
  assert len(site["nativeRows"]) < 6000
