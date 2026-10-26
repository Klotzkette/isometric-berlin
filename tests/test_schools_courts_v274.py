"""Seven bounded school/courtyard improvements, with immutable prior geometry."""

from __future__ import annotations

import importlib
import json
import math
import sys
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
M = importlib.import_module("build_schools_courts_v274")


@pytest.fixture(scope="module")
def rebuilt():
  return M.build()


def decode(site, key, palette):
  return [
    [
      *[r[i] / 1000 + site["origin"][i] for i in range(3)],
      *[v / 1000 for v in r[3:6]],
      *([r[6] / 1e6] if key == "boxes" else []),
      palette[r[-1]],
    ]
    for r in site[key]
  ]


def test_rebuild_exact_seven_sites_and_prior_sources_unchanged(rebuilt):
  model, ev, source = rebuilt
  assert model == M.read(M.OUT)
  assert json.loads(json.dumps(ev)) == M.read(M.EVIDENCE)
  assert source == M.read(M.SOURCE)
  assert M.navigation(ev, source) == M.read(M.NAV)
  assert {s["key"] for s in model["sites"]} == {
    "metropolitan",
    "kastanienbaum",
    "lennon",
    "be-smart",
    "tiergarten",
    "choriner",
    "fuerstenberger",
  }
  assert all(
    M.sha(ROOT / path) == digest for path, digest in ev["sourceSha256"].items()
  )
  assert M.OUT.stat().st_size < 350_000
  assert model["counts"]["nativeRows"] < 6000


def test_native_upper_navigation_equals_every_constructed_surface_cell(rebuilt):
  model, ev, src = rebuilt
  nav = M.navigation(ev, src)
  part = nav["nativeUpperPart"]
  actual = M.unary_union([M.Polygon(p["ring"], p["holes"]) for p in part["polygons"]])
  expected = M.unary_union(
    [box(x - 1, z - 1, x + 1, z + 1) for x, z, _ in nav["nativeRoofCells"]]
  )
  assert actual.symmetric_difference(expected).area == 0
  assert not actual.covers(M.Point(1290, -900))
  cells = M.native_shell({"surfaces": ev["bmsUpperSheets"]})
  assert part["groundY"] == min(y - 1 for _, y, *_ in cells) == 22
  assert part["topY"] == max(y + 1 for _, y, *_ in cells) == 32
  assert len(cells) == model["counts"]["bmsNativeSurfaceCells"]


def test_each_added_drawn_member_clips_to_its_source_wall_with_holes(rebuilt):
  model, ev, _ = rebuilt
  for site in ev["sites"]:
    rows = decode(
      next(s for s in model["sites"] if s["key"] == site["key"]),
      "boxes",
      model["palette"],
    )
    used = []
    for f in site["faces"]:
      face = M.Face(M.group("check", f["owner"]), f["rings"], f["normal"])
      for u, y, w, h, out, depth, role, index in f["members"]:
        assert face.wall.buffer(0.002).covers(
          box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
        )
        row = rows[index]
        assert np.max(abs(np.asarray(row[:3]) - face.point(u, y, out))) < 0.0011
        assert math.isclose(row[6], face.yaw, abs_tol=1e-6)
        assert role and depth > 0 and min(w, h) > 0
        used.append(index)
    assert sorted(used) == list(range(len(rows)))


def test_metropolitan_retains_all_five_measured_upper_parts_and_roof_sheets(rebuilt):
  model, ev, src = rebuilt
  parent = next(p for p in src["parents"] if p["id"] == M.BMS)
  original = next(
    p
    for p in M.read(M.GEO / "alt-mitte-v169/source-390_5820-00.json.gz")["buildings"]
    if p["id"] == M.BMS
  )
  assert parent == original
  assert {p["id"] for p in parent["parts"]} == {
    s["partId"] for s in ev["bmsUpperSheets"]
  }
  roof_expected = {
    (p["id"], i)
    for p in parent["parts"]
    for i, s in enumerate(p["surfaces"])
    if s["kind"] == "RoofSurface"
  }
  assert roof_expected == {
    (s["partId"], s["sheet"])
    for s in ev["bmsUpperSheets"]
    if s["kind"] == "RoofSurface"
  }

  def area(ts):
    return sum(
      np.linalg.norm(np.cross(np.array(b) - a, np.array(c) - a)) / 2 for a, b, c in ts
    )

  for s in ev["bmsUpperSheets"]:
    assert all(v[1] >= 23.2 - 1e-8 for t in s["triangles"] for v in t)
    if s["kind"] == "RoofSurface":
      p = next(p for p in parent["parts"] if p["id"] == s["partId"])
      assert math.isclose(
        area(s["triangles"]),
        area(M.triangles_for(p["surfaces"][s["sheet"]]["rings"])),
        rel_tol=1e-10,
      )
  assert model["counts"]["bmsUpperParts"] == 5


def test_nursery_identity_exact_proxy_receipts_and_retained_two_datums(rebuilt):
  model, ev, src = rebuilt
  assert ev["kitaIdentity"]["osmWay"] == "28417249"
  parents = [p for p in src["parents"] if p["id"] in M.KITA]
  assert len(parents) == 2
  assert all(
    p["osmTags"]["addr:street"] == "Fürstenberger Straße"
    and p["osmTags"]["addr:housenumber"] == "4/5"
    for p in parents
  )
  keys, _ = M.current_triangles(box(2290, -1990, 2350, -1910))
  receipts = ev["nurseryUpperProxyReceipts"]
  assert {r["sheet"] for r in receipts} == {4, 10, 16, 19}
  assert all(r["oldUpperTriangles"] for r in receipts)
  assert all(
    bytes.fromhex(t["triangleKey"]) in keys
    for r in receipts
    for t in r["oldUpperTriangles"]
  )
  assert all(
    t["role"]
    in {"window surround", "window glazing", "window mullion", "stone window sill"}
    for r in receipts
    for t in r["oldUpperTriangles"]
  )
  site = next(s for s in ev["sites"] if s["key"] == "fuerstenberger")
  for f in site["faces"]:
    expected = 13.31 if f["owner"] == M.KITA[0] else 9.31
    assert math.isclose(min(v[1] for r in f["rings"] for v in r), expected)
    for _, y, _, h, _, _, role, _ in f["members"]:
      if "nursery-upper" in role:
        assert y - h / 2 >= expected + 3.6 - 1e-6


def test_existing_openings_gain_only_missing_heads_and_balcony_supports(rebuilt):
  model, ev, _ = rebuilt
  for key in ["lennon", "kastanienbaum"]:
    site = next(s for s in model["sites"] if s["key"] == key)
    assert set(site["roles"]) <= {
      "existing-window-segmental-glass",
      "brick-reveal-edge",
    }
    assert site["roles"]["existing-window-segmental-glass"] % 3 == 0
    rows = decode(site, "boxes", model["palette"])
    assert all(r[4] < 0.1 for r in rows if r[-1] in [0x71898B, 0x59747B])
  choriner = next(s for s in model["sites"] if s["key"] == "choriner")
  assert set(choriner["roles"]) == {
    "existing-balcony-rail-end-support",
    "existing-balcony-lower-edge",
  }
  tier = next(s for s in ev["sites"] if s["key"] == "tiergarten")
  assert all(
    not f["partId"].endswith(("ruAxvlwz", "neNfHjtD", "lnB9I8b8"))
    for f in tier["faces"]
  )
  assert sum(len(f["nativeMembers"]) for f in tier["faces"]) != sum(
    len(f["members"]) for f in tier["faces"]
  )


def test_native_rows_are_finite_separate_and_surface_only(rebuilt):
  model, _, _ = rebuilt
  assert (
    sum(len(s["nativeRows"]) for s in model["sites"]) == model["counts"]["nativeRows"]
  )
  for s in model["sites"]:
    rows = decode(s, "nativeRows", model["palette"])
    assert all(len(r) == 7 and all(np.isfinite(r)) and min(r[3:6]) > 0 for r in rows)
    assert len(rows) != len(s["boxes"])
  bms = next(s for s in model["sites"] if s["key"] == "metropolitan")
  cells = decode(bms, "nativeRows", model["palette"])[
    : model["counts"]["bmsNativeSurfaceCells"]
  ]
  assert all(r[3:6] == [2, 2, 2] for r in cells)
  assert all(r[1] >= 23 for r in cells)
