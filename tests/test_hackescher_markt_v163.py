"""Retained survey and mapped court access regression checks."""

import json
from pathlib import Path

from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/app/src/data/hackescherMarktV163Source.json"


def test_measured_courts_are_not_replaced_by_solid_blocks():
  p = json.loads(SOURCE.read_text())
  raw_parts = {
    q["id"]: (q, parent["displayOffsetY"])
    for parent in p["parents"]
    for q in parent["sourceParts"]
  }
  assert len(raw_parts) == len(p["parts"]) == 50
  for q in p["parts"]:
    raw, offset = raw_parts[q["id"]]
    assert q["ring"] == raw["ring"] and q["holes"] == raw["holes"]
    assert abs(q["top_y_m"] - raw["top_y_m"] - offset) < 0.002
    assert len(q["surfaces"]) == len(raw["surfaces"])
  original = unary_union(
    [Polygon(q["ring"], q["holes"]) for q, _ in raw_parts.values()]
  )
  displayed = unary_union([Polygon(q["ring"], q["holes"]) for q in p["parts"]])
  assert original.symmetric_difference(displayed).area < 1e-6
  assert len(p["passages"]) == 10
  assert {a["osmId"] for a in p["passages"]} >= {"59286191", "48435239", "48435514"}


def test_exact_replaced_legacy_records_and_source_surface_ownership():
  p = json.loads(SOURCE.read_text())
  original = {
    b["id"]: b
    for b in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  assert len(p["legacyPrisms"]) == 10
  for b in p["legacyPrisms"]:
    assert b == original[b["id"]]
  assert {s["partId"] for s in p["surfaces"]} == {q["id"] for q in p["parts"]}
  # Only the two small wall faces on a mapped passage are opened completely.
  assert {(s["partId"], s["kind"]) for s in p["surfaces"] if not s["triangles"]} == {
    ("DEBE01YYK0001yCy", "WallSurface")
  }
  assert all(s["triangles"] for s in p["surfaces"] if s["kind"] == "RoofSurface")
  assert len(p["nativeBlocks"]) < 18000
