"""Measured central envelopes, clipped facade detail and exact owner replacement."""

from __future__ import annotations

import gzip
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "central_sites", ROOT / "scripts/build_central_sites_v200.py"
)
BUILD = importlib.util.module_from_spec(spec)
spec.loader.exec_module(BUILD)
DATA = json.loads((ROOT / "src/app/src/data/centralSitesV200.json").read_text())
EVIDENCE = json.loads(
  (ROOT / "src/app/src/data/centralSitesV200Evidence.json").read_text()
)
NAV = json.loads(
  (ROOT / "src/app/src/data/centralSitesV200Navigation.json").read_text()
)
REPLACEMENT = json.loads(
  (ROOT / "src/app/src/data/centralSitesV200Replacement.json").read_text()
)


def test_source_files_and_every_source_shell_remain_exact() -> None:
  for filename, digest in EVIDENCE["sourceSha256"].items():
    assert hashlib.sha256((ROOT / filename).read_bytes()).hexdigest() == digest
  records = {r["id"]: r for r in BUILD.load_records()}
  for item in EVIDENCE["sourceShells"]:
    record = records[item["parentId"]]
    assert (
      item["sourceRecordSha256"]
      == hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
    )
    expected = {
      s["sourcePolygonId"]
      for p in record["parts"]
      for s in p["surfaces"]
      if s["kind"] != "GroundSurface"
    }
    assert set(item["sourcePolygons"]) == expected
    oi = next(i for i, o in enumerate(DATA["owners"]) if o["id"] == item["parentId"])
    delivered = [s for s in DATA["surfaces"] if s["owner"] == oi and s["role"] == 0]
    assert {s["sourcePolygonId"] for s in delivered} == expected
    source_points = {
      tuple(v)
      for p in record["parts"]
      for s in p["surfaces"]
      for ring in s["rings"]
      for v in ring
    }
    assert all(
      tuple(v) in source_points for s in delivered for t in s["triangles"] for v in t
    )
  assert len(EVIDENCE["sourceShells"]) == 10


def test_every_drawn_member_projection_stays_on_its_own_measured_wall() -> None:
  checked = 0
  for face in EVIDENCE["selectedFaces"]:
    a, b, n = np.asarray(face["a"]), np.asarray(face["b"]), np.asarray(face["normal"])
    d = (b - a) / face["length"]
    wall = Polygon(
      [[(np.asarray([p[0], p[2]]) - a) @ d, p[1]] for p in face["rings"][0]],
      [
        [[(np.asarray([p[0], p[2]]) - a) @ d, p[1]] for p in h]
        for h in face["rings"][1:]
      ],
    )
    clear = unary_union(
      [
        box(lo + 0.02, face["ground"], hi - 0.02, face["eave"] - 0.12)
        for lo, hi in face["clearIntervals"]
      ]
    )
    allowed = wall.intersection(clear).buffer(0.00051)
    for r in DATA["boxes"][face["firstBox"] : face["firstBox"] + face["boxCount"]]:
      u = float((np.asarray([r[0], r[2]]) - a) @ d)
      assert allowed.covers(
        box(u - r[3] / 2, r[1] - r[4] / 2, u + r[3] / 2, r[1] + r[4] / 2)
      ), (face["parentId"], r)
      assert 0.20 < float((np.asarray([r[0], r[2]]) - a) @ n) < 0.85
      checked += 1
  assert checked == len(DATA["boxes"]) == 12735


def test_old_hu_front_is_not_repainted_and_new_garden_detail_is_bounded() -> None:
  faces = [f for f in EVIDENCE["selectedFaces"] if f["parentId"].endswith("0Cm9")]
  assert len(faces) == 6
  for f in faces:
    assert max(f["a"][1], f["b"][1]) < 115
    assert f["style"] == "palace-court"
  assert not any(s["parentId"].endswith("0Cm9") for s in EVIDENCE["sourceShells"])
  assert {f["style"] for f in EVIDENCE["selectedFaces"]} >= {
    "postwar",
    "clinker",
    "barracks-east",
    "barracks-west",
    "coach",
    "house",
    "august",
    "palace-court",
  }


def test_source_navigation_preserves_every_original_courtyard_hole_and_roof() -> None:
  records = {r["id"]: r for r in BUILD.load_records()}
  assert len(NAV["buildings"]) == 10
  assert not NAV["newCourtWalls"] and not NAV["newPassageClosures"]
  for b in NAV["buildings"]:
    record = records[b["id"]]
    assert b["polygons"] == record["footprintPolygons"]
    assert b["roofTriangles"]
    points = {
      tuple(v)
      for p in record["parts"]
      for s in p["surfaces"]
      if s["kind"] == "RoofSurface"
      for ring in s["rings"]
      for v in ring
    }
    assert all(tuple(v) in points for t in b["roofTriangles"] for v in t)


def test_bebel_paving_preserves_memorial_and_exact_plaza_boundary() -> None:
  hu = json.loads(BUILD.HU_SOURCE.read_text())
  plaza = Polygon(hu["plaza_source"]["ring"]).buffer(-0.6)
  excluded = box(*EVIDENCE["plazaExclusion"])
  drawn = [s for s in DATA["surfaces"] if s["role"] == 6]
  assert len(drawn) >= 10
  for s in drawn:
    for t in s["triangles"]:
      p = Polygon([(v[0], v[2]) for v in t])
      assert plaza.buffer(1e-6).covers(p)
      assert excluded.intersection(p).area < 1e-8
      assert all(v[1] == 5.305 for v in t)
  assert sum(len(s["triangles"]) for s in drawn) < 100


def test_five_heckmann_replacements_are_complete_and_native_columns_are_unique() -> (
  None
):
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  by_id = {p["id"]: p for p in prisms}
  assert {r["prismId"] for r in REPLACEMENT["replacements"]} == {
    "-5759915",
    "80339718",
    "86993630",
    "86993613",
    "86993634",
  }
  all_cells = []
  for r in REPLACEMENT["replacements"]:
    assert by_id[r["prismId"]] == r["legacyPrism"]
    assert r["oldUncoveredAreaM2"] < 1e-8
    assert r["exactSourceUncoveredAreaM2"] < 3
    assert not r["conflicts"]
    assert any(s["parentId"] == r["sourceOwner"] for s in EVIDENCE["sourceShells"])
    old = r["legacyPrism"]
    fp = Polygon(
      [(x / 10, z / 10) for x, z in old["ring"]],
      [[(x / 10, z / 10) for x, z in h] for h in old["holes"]],
    )
    for x, z, bottom, top in r["columns"]:
      assert fp.covers(Point(x, z))
      assert bottom == old["y0_dm"] / 10
      assert top == bottom + math.ceil(old["h_dm"] / 40) * 4
      all_cells.append((x, z))
  assert len(all_cells) == len(set(all_cells)) == 99


def test_payload_budget_and_native_family_are_bounded() -> None:
  assert EVIDENCE["counts"] == dict(
    owners=15,
    newSourceShells=10,
    faces=110,
    drawnTriangles=1317,
    drawnBoxes=12735,
    nativeRuns=25156,
  )
  assert (
    len(gzip.compress((ROOT / "src/app/src/data/centralSitesV200.json").read_bytes()))
    < 300_000
  )
  assert len(DATA["blocks"]) * 76 < 2_000_000
  assert all(len(r) == 9 and min(r[4], r[6], r[7]) > 0 for r in DATA["blocks"])
  assert all(0 <= r[8] < len(DATA["owners"]) for r in DATA["blocks"])


def test_generator_reproduces_frozen_payloads() -> None:
  data, evidence, nav = BUILD.make_payloads()
  assert data == DATA
  assert evidence == EVIDENCE
  assert nav == NAV
