"""Bounded Step-10 source ownership and topology checks for Potsdamer west."""

import gzip
import hashlib
import json
from pathlib import Path

from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "src/app/src/data/potsdamerWestV266.json").read_text())
EVIDENCE = json.loads(
  gzip.decompress(
    (
      ROOT / "geo_data/regierungsviertel/potsdamer-west-v266-evidence.json.gz"
    ).read_bytes()
  )
)


def test_retained_inputs_and_complete_measured_owners() -> None:
  """All original source/prior model bytes and full source sheets survive."""
  for path, expected in EVIDENCE["inputs"].items():
    if (ROOT / path).exists():
      assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected
    else:
      assert "/raw/" in path and len(expected) == 64
  all_prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  by_id = {p["id"]: p for p in all_prisms}
  assert len(EVIDENCE["preservedPrisms"]) == 11
  for p in EVIDENCE["preservedPrisms"]:
    assert p == by_id[p["id"]]
  assert sum(len(p["parts"]) for p in EVIDENCE["official"]) == 11
  assert (
    sum(len(p["surfaces"]) for f in EVIDENCE["official"] for p in f["parts"]) == 185
  )
  assert EVIDENCE["suppressionIds"] == []
  assert EVIDENCE["existingSourcesRemainRendered"]


def test_separate_shaft_plan_and_primary_height() -> None:
  """The green square lattice belongs to the mapped shaft, not the office roof."""
  shells = EVIDENCE["upperOwners"]
  assert len(shells) == 9
  shaft = next(s for s in shells if s["osmId"] == 591305860)
  assert len(shaft["ring"]) == 4
  assert shaft["role"] == "ventilation-shaft"
  assert shaft["outsideRetainedEnvelopeM2"] < 0.04
  assert DATA["profile"]["maximumY"] - DATA["profile"]["baseY"] == 106
  assert max(s["top"] for s in shells if s["role"] == "office-upper") == 90.1
  assert DATA["profile"]["roles"]["green-cube-square"] == 64
  green = [r for r in DATA["boxes"] if r[8] == "green-cube-square"]
  assert len(green) == 64
  for r in green:
    assert Polygon(shaft["ring"]).boundary.distance(Point(r[0], r[2])) < 0.17
    assert shaft["top"] < r[1] < DATA["profile"]["maximumY"]


def test_upper_completions_do_not_delete_or_enlarge_old_complex() -> None:
  """Supplement starts above the rendered old top; source-plan conflicts stay small."""
  for s in EVIDENCE["upperOwners"]:
    assert s["bottom"] == 60.1
    assert s["top"] > s["bottom"]
    assert s["outsideRetainedEnvelopeM2"] <= 0.0374
    assert s["originalAreaM2"] - s["clippedAreaM2"] < 0.72
  assert min(DATA["positions"][1::3]) == 60.1
  assert len(DATA["positions"]) == len(DATA["colors"]) * 3


def test_fittings_are_finite_positive_and_rogers_rails_retain_wall_ownership() -> None:
  """Positive geometry and exact plane receipts prevent source drift."""
  import math

  for native, rows in [(False, DATA["boxes"]), (True, DATA["nativeRoofBlocks"])]:
    for r in rows:
      assert all(math.isfinite(x) for x in r[:6])
      assert all(x > 0 for x in r[3:6])
      assert 0 <= r[8 if native else 9] < len(DATA["profile"]["owners"])
  assert len(EVIDENCE["rogersRails"]) == 36
  by_id = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  for r in EVIDENCE["rogersRails"]:
    p = by_id[r["owner"]]
    poly = Polygon([(x / 10, z / 10) for x, z in p["ring"]])
    x, y, z = r["position"]
    assert abs(poly.boundary.distance(Point(x, z)) - 0.36) < 0.001
    assert y - r["size"][1] / 2 >= p["y0_dm"] / 10 + 4.19
    assert y + r["size"][1] / 2 < (p["y0_dm"] + p["h_dm"]) / 10
