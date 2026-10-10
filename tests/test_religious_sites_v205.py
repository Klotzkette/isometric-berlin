"""Bounded source ownership, source planes, anchors and native surface fidelity."""

import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = json.loads((ROOT / "src/app/src/data/religiousSitesV205.json").read_text())
SOURCE = json.loads(
  (ROOT / "geo_data/regierungsviertel/religious-sites-v205-source.json").read_text()
)
EVIDENCE = json.loads(
  (
    ROOT / "geo_data/regierungsviertel/religious-sites-v205-recognition-evidence.json"
  ).read_text()
)


def test_six_sites_and_all_eighteen_parts_retained():
  assert [s["id"] for s in RUNTIME["sites"]] == [
    "gethsemane",
    "samariter",
    "passion",
    "wilmersdorf",
    "sehitlik",
    "rykestrasse",
  ]
  assert sum(len(s["navigation"]) for s in RUNTIME["sites"]) == 18
  assert sum(len(s["triangles"]) for s in RUNTIME["sites"]) == 2136
  for site, raw in zip(RUNTIME["sites"], SOURCE["sites"], strict=True):
    assert site["parents"] == raw["parents"]
    assert {t["partId"] for t in site["triangles"]} == {p["id"] for p in raw["parts"]}
    for part, nav in zip(raw["parts"], site["navigation"], strict=True):
      assert nav["ring"] == part["ring"] and nav["holes"] == part["holes"]
      assert abs(nav["topY"] - part["top_y_m"] - part["viewerOffsetY"]) < 1e-8
      # Every authoritative sheet vertex survives the triangulated renderer.
      rendered = np.array(
        [p for t in site["triangles"] if t["partId"] == part["id"] for p in t["points"]]
      )
      for surface in part["surfaces"]:
        for ring in surface["rings"]:
          for p in ring:
            expected = np.array(p) + [0, part["viewerOffsetY"], 0]
            assert np.min(np.linalg.norm(rendered - expected, axis=1)) < 0.003


def test_complete_window_rectangles_stay_on_their_source_faces():
  assert sum(len(s["windowEvidence"]) for s in RUNTIME["sites"]) > 200
  for site in RUNTIME["sites"]:
    for window in site["windowEvidence"]:
      wall = site["walls"][window["wallIndex"]]
      u, y, w, h = (window[k] for k in ["u", "bottomY", "width", "height"])
      assert (
        Polygon(wall["polygon"])
        .buffer(-0.1)
        .covers(box(u - w / 2, y, u + w / 2, y + h))
      )


def test_church_towers_stay_in_their_real_western_footprints():
  for site in RUNTIME["sites"][:2]:
    feature = site["recognition"][0]
    assert (
      Polygon(site["navigation"][0]["ring"])
      .buffer(0.02)
      .covers(Polygon(feature["footprint"]))
    )
    assert "estimate" in feature["status"]
    assert feature["topY"] > max(n["topY"] for n in site["navigation"])


def test_sehitlik_dome_and_minarets_match_actual_osm_circles():
  polygons = shape(EVIDENCE["sehitlikPart"][0]["geometry"])
  holes = [Polygon(r) for p in polygons.geoms for r in p.interiors]
  actual = sorted(holes, key=lambda p: p.area)
  anchors = [(2491.816, 4227.828), (2508.745, 4212.136), (2504.082, 4224.089)]
  for anchor in anchors:
    assert min(Point(anchor).distance(h.centroid) for h in actual) < 0.03
  assert len(actual) == 3 and actual[-1].area > 130


def test_native_blocks_are_unique_surface_cells_and_retain_exact_vertices():
  total = 0
  for site in RUNTIME["sites"]:
    blocks = site["nativeBlocks"]
    total += len(blocks)
    cells = {tuple(round(v / 0.9) for v in b[:3]) for b in blocks}
    assert len(cells) == len(blocks)
    assert all(b[3:6] == [0.9, 0.9, 0.9] for b in blocks)
    displayed = [
      t
      for i, t in enumerate(site["triangles"])
      if i not in site["suppressedSourceTriangleIndices"]
    ] + site["clippedSourceTriangles"]
    for tri in displayed + site["estimatedTriangles"]:
      for p in tri["points"]:
        assert tuple(round(v / 0.9) for v in p) in cells
  assert 35000 < total < 45000


def test_permitted_visual_reference_inventory():
  refs = EVIDENCE["visualReferences"]
  assert len(refs) == 7
  assert all(
    r["license"] in ["CC BY-SA 4.0", "CC BY-SA 3.0", "CC BY-SA 2.0 de", "Public domain"]
    for r in refs
  )


def test_wilmersdorf_false_flat_crowns_are_retained_but_not_drawn_inside_domes():
  site = next(s for s in RUNTIME["sites"] if s["id"] == "wilmersdorf")
  assert len(site["crownCorrections"]) == 3
  suppressed = set(site["suppressedSourceTriangleIndices"])
  assert suppressed and len(suppressed) < len(site["triangles"])
  for receipt in site["crownCorrections"]:
    retained = [
      t
      for i, t in enumerate(site["triangles"])
      if i not in suppressed and t["partId"] == receipt["partId"]
    ]
    retained += [
      t for t in site["clippedSourceTriangles"] if t["partId"] == receipt["partId"]
    ]
    assert retained
    assert max(p[1] for t in retained for p in t["points"]) <= receipt["cutY"] + 1e-6
  assert all(
    not s["suppressedSourceTriangleIndices"]
    for s in RUNTIME["sites"]
    if s["id"] != "wilmersdorf"
  )


def test_sehitlik_dome_shades_reveal_faces_without_changing_positions():
  import hashlib

  site = next(s for s in RUNTIME["sites"] if s["id"] == "sehitlik")
  faces = [
    t
    for t in site["estimatedTriangles"]
    if t["feature"] == "estimated main dome on exact OSM circular hole"
  ]
  assert len(faces) == 384
  assert {t["color"] for t in faces} == {0x62767B, 0x78878B, 0x92A0A2}
  positions = json.dumps([t["points"] for t in faces], separators=(",", ":")).encode()
  assert (
    hashlib.sha256(positions).hexdigest()
    == "7433b56fa348835cd7c0586a78dad213fb8e6fd2bdc25064285c315ff6fddc63"
  )
  assert all(
    t["color"] == 0x78878B for t in site["triangles"] if t["kind"] == "RoofSurface"
  )
