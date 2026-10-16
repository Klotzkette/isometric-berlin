"""Independent source/mesh completeness and conservative envelope contracts."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(path: Path):
  return json.loads(path.read_text())


def area3(ring):
  points = np.array(ring)
  return np.linalg.norm(np.cross(points, np.roll(points, -1, axis=0)).sum(axis=0)) / 2


def test_source_and_profile_keep_true_envelopes_and_holes():
  source = read(GEO / "townhall-source-v227.json")
  profile = read(DATA / "townhallV227Profile.json")
  assert len(source["sites"]) == len(profile["sites"]) == 23
  assert (
    len(source["unavailableArchives"]) > 0
  )  # Explicitly retained service limitation.
  for site, shown in zip(source["sites"], profile["sites"], strict=True):
    originals = {p["id"]: (p, o) for o in site["parents"] for p in o["parts"]}
    assert shown["key"] == site["key"]
    assert set(originals) == {p["id"] for p in shown["parts"]}
    for part in shown["parts"]:
      original, owner = originals[part["id"]]
      assert part["ring"] == original["ring"] and part["holes"] == original["holes"]
      assert part["ground_y_m"] == pytest.approx(
        original["ground_y_m"] + owner["existingOwnership"]["rigidYOffset"], abs=0.001
      )
      for edge in part["wallEdges"]:
        assert edge["eave"] >= edge["base"]
        assert edge["eave"] <= part["top_y_m"] + 0.001
        assert math.hypot(*edge["normal"]) == pytest.approx(1, abs=0.000002)
      if owner["geometrySource"] != "complete-official-lod2-leaf-sheets":
        assert owner["heightSource"] and owner["limitation"]
        if owner["existingOwnership"]["family"] == "surrounding-city":
          assert (
            part["top_y_m"]
            <= owner["existingOwnership"]["groundY"]
            + owner["existingOwnership"]["height"]
            + 0.001
          )


def test_complete_new_shells_match_all_original_surface_area_and_parts():
  source_path = GEO / "townhall-source-v227.json"
  source = read(source_path)
  receipt = read(DATA / "townhallV227Ownership.json")
  evidence = read(GEO / "townhall-envelopes-v227-evidence.json")
  assert (
    receipt["sourceSha256"]
    == evidence["sourceSha256"]
    == hashlib.sha256(source_path.read_bytes()).hexdigest()
  )
  drawn = {s["key"]: s for s in read(DATA / "townhallV227Envelopes.json")["sites"]}
  native = {s["key"]: s for s in read(DATA / "townhallV227Native.json")["sites"]}
  nav = {s["key"]: s for s in read(DATA / "townhallV227Navigation.json")["sites"]}
  assert set(drawn) == set(native) == set(nav)
  assert not set(drawn) & {
    "mitte",
    "steglitz",
    "koepenick",
    "wilmersdorf",
    "weissensee",
    "zehlendorf",
    "neukoelln",
  }
  assert {
    "tempelhof",
    "treptow",
    "marzahn",
    "hellersdorf",
    "lichtenberg",
    "reinickendorf",
  } <= set(drawn)
  approved = set(receipt["replacementParents"])
  for site in source["sites"]:
    if site["key"] not in drawn:
      continue
    shape_data, walk = drawn[site["key"]], nav[site["key"]]
    parents = [o for o in site["parents"] if o["id"] in shape_data["owners"]]
    assert len(parents) == len(shape_data["owners"])
    assert all(
      o["existingOwnership"]["family"] in {"missing", "core-preserved"}
      or o["id"] in approved
      for o in parents
    )
    assert {p["id"] for o in parents for p in o["parts"]} == {
      p["id"] for p in walk["owners"]
    }
    expected = sum(
      area3(s["rings"][0]) - sum(area3(r) for r in s["rings"][1:])
      for o in parents
      for p in o["parts"]
      for s in p["surfaces"]
    )
    for pad in walk["pads"]:
      polygon = Polygon(pad["ring"], pad["holes"])
      expected += polygon.area + polygon.length * (pad["high"] - pad["low"])
    actual = sum(area3(t) for s in shape_data["surfaces"] for t in s["triangles"])
    assert actual == pytest.approx(expected, abs=0.03), site["key"]
    assert native[site["key"]]["owners"] == shape_data["owners"]
    for row in native[site["key"]]["blocks"]:
      assert len(row) == 7 and all(math.isfinite(v) for v in row)
      assert all(v >= 1 and v == int(v) for v in row[3:6])
      assert all(
        (row[i] - row[i + 3] / 2) == int(row[i] - row[i + 3] / 2) for i in range(3)
      )


def test_new_peripheral_support_is_bounded_to_missing_building_envelopes():
  source = {s["key"]: s for s in read(GEO / "townhall-source-v227.json")["sites"]}
  for site in read(DATA / "townhallV227Navigation.json")["sites"]:
    missing = [
      o
      for o in source[site["key"]]["parents"]
      if o["existingOwnership"]["family"] == "missing"
    ]
    assert bool(site["pads"]) == bool(missing)
    if not missing:
      continue
    envelope = unary_union(
      [Polygon(p["ring"], p["holes"]) for o in missing for p in o["parts"]]
    )
    support = unary_union([Polygon(p["ring"], p["holes"]) for p in site["pads"]])
    assert (
      support.symmetric_difference(envelope.buffer(2, join_style="mitre")).area < 0.25
    )
    for pad in site["pads"]:
      assert pad["high"] == 3 and "not surveyed" in pad["estimate"]
