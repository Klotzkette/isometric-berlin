"""Metric preservation, exact owner replacement and compact native surfaces."""

import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "src/app/src/data"
DATA = json.loads((DIRECTORY / "alexanderNorthV166Source.json").read_text())
EVIDENCE = json.loads((DIRECTORY / "alexanderNorthV166Evidence.json").read_text())
NAV = json.loads((DIRECTORY / "alexanderNorthV166Navigation.json").read_text())


def test_all_original_parts_surfaces_and_courts_survive_rigid_translation():
  parts = {p["id"]: p for p in EVIDENCE["parts"]}
  assert len(EVIDENCE["families"]) == 25
  assert len(parts) == 107
  assert len(DATA["surfaces"]) == 1262
  for family in EVIDENCE["families"]:
    for original in family["sourceParts"]:
      p = parts[original["id"]]
      assert p["ring"] == original["ring"]
      assert p["holes"] == original["holes"]
      assert p["height_m"] == original["height_m"]
      assert p["top_y_m"] == round(original["top_y_m"] + family["displayOffsetY"], 3)
      for a, b in zip(original["surfaces"], p["surfaces"], strict=True):
        assert b["rings"] == [
          [[x, round(y + family["displayOffsetY"], 3), z] for x, y, z in ring]
          for ring in a["rings"]
        ]
      rendered = [s for s in DATA["surfaces"] if s["partId"] == p["id"]]
      for sheet, runtime in zip(p["surfaces"], rendered, strict=True):
        normal = sum(
          (
            np.cross(a, b)
            for a, b in zip(
              sheet["rings"][0],
              sheet["rings"][0][1:] + sheet["rings"][0][:1],
              strict=True,
            )
          ),
          np.zeros(3),
        )
        axes = [i for i in range(3) if i != int(np.argmax(np.abs(normal)))]
        rings = [[tuple(p[i] for i in axes) for p in r] for r in sheet["rings"]]
        area = Polygon(rings[0], rings[1:]).area
        actual = sum(
          Polygon([[p[i] for i in axes] for p in t]).area for t in runtime["triangles"]
        )
        assert abs(area - actual) < 0.0001


def test_native_runs_are_lossless_disjoint_orthogonal_skin():
  cells = set()
  for x, y, z, w, h, d, _ in DATA["nativeRuns"]:
    assert all(v > 0 and v % 2 == 0 for v in (w, h, d))
    for a in range(round((x - w / 2) / 2), round((x + w / 2) / 2)):
      for b in range(round((y - 3 - h / 2) / 2), round((y - 3 + h / 2) / 2)):
        for c in range(round((z - d / 2) / 2), round((z + d / 2) / 2)):
          assert (a, b, c) not in cells
          cells.add((a, b, c))
  assert len(cells) == DATA["nativeCellCount"] == 59427
  assert len(DATA["nativeRuns"]) < 8000
  # The Park Inn skin never adds a hidden solid tower interior.
  assert (round(2812 / 2), round(60 / 2), round(-388 / 2)) not in cells


def test_exact_outer_ownership_and_current_identity_conflicts():
  assert not NAV["legacyPrisms"]
  assert len(NAV["outerOwners"]) == 26
  assert {p["id"] for p in NAV["outerOwners"]} == {
    p["id"] for p in EVIDENCE["families"]
  } | {"OSM-way-1335157930"}
  assert EVIDENCE["poi"]["name"] == "Monsieur Vuong"
  assert EVIDENCE["poi"]["id"] == "node/567837367"
  berlinian = next(p for p in EVIDENCE["parts"] if p["id"] == "OSM-way-1335157930")
  assert berlinian["height_m"] == 146
  assert abs(Polygon(berlinian["ring"]).area - 1206.411912) < 0.0001
  former = next(p for p in NAV["outerOwners"] if p["id"] == berlinian["id"])
  former_area = sum(Polygon(p["ring"], p["holes"]).area for p in former["polygons"])
  assert former_area < 180  # Prior clipped ownership must not shrink the model.
  assert any("2027" in s and "opening_date=2026" in s for s in EVIDENCE["conflicts"])
  assert any("January 2024" in s for s in EVIDENCE["conflicts"])
  assert "families" not in DATA and "osmBuildings" not in DATA
