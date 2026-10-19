"""Bounded restored library front: exact ownership, courts and native fidelity."""

import base64
import importlib.util
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "stabi241", ROOT / "scripts/build_staatsbibliothek_v241.py"
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
RUNTIME = m.OUT / "staatsbibliothekV241.json"
PREVIOUS = m.OUT / "staatsbibliothekV241Previous.json"
EVIDENCE = m.GEO / "staatsbibliothek-v241-evidence.json"


def original():
  return next(
    b
    for b in m.read(m.GEO / "alt-mitte-v169/source-390_5819-00.json.gz")["buildings"]
    if b["id"] == m.PARENT
  )


def test_immutable_source_packets_and_all_eighteen_part_footprints_survive():
  for path, digest in m.read(EVIDENCE)["inputs"].items():
    assert m.sha(ROOT / path) == digest
  before = original()
  after = m.corrected(before)
  assert len(after["parts"]) == 18
  for a, b in zip(before["parts"], after["parts"], strict=True):
    assert a["id"] == b["id"]
    assert a["footprintPolygons"] == b["footprintPolygons"]
    assert a["groundY"] == b["groundY"] and a["topY"] == b["topY"]
    if a["id"] not in {m.MAIN, m.CUPOLA}:
      assert a == b
  main = next(p for p in before["parts"] if p["id"] == m.MAIN)
  assert sum(len(p["holes"]) for p in main["footprintPolygons"]) == 8
  for packet in m.read(RUNTIME).values():
    assert not packet["nav"]["buildings"] and not packet["nav"]["ground"]


def test_roof_correction_keeps_footprint_ridges_courts_and_rear_source_sheets():
  before = original()
  after = m.corrected(before)
  for a, b in zip(before["parts"], after["parts"], strict=True):
    if a["id"] == m.MAIN:
      retained = [
        s
        for s in a["surfaces"]
        if all(m.front_distance(p) <= -9 for r in s["rings"] for p in r)
      ]
      assert all(s in b["surfaces"] for s in retained)
      assert len(retained) > 100
      old = Polygon(
        a["footprintPolygons"][0]["ring"], a["footprintPolygons"][0]["holes"]
      )
      roofs = [
        Polygon([(x, z) for x, y, z in r])
        for s in b["surfaces"]
        if s["kind"] == "RoofSurface"
        for r in s["rings"]
      ]
      from shapely.ops import unary_union

      assert old.symmetric_difference(unary_union(roofs)).area < 0.001
    if a["id"] == m.CUPOLA:
      points = [p for s in b["surfaces"] for r in s["rings"] for p in r]
      assert abs(max(p[1] for p in points) - a["topY"]) < 1e-8
      assert min(p[1] for p in points) == a["groundY"]
      roof_heights = {
        round(p[1], 3)
        for s in b["surfaces"]
        if s["kind"] == "RoofSurface"
        for r in s["rings"]
        for p in r
      }
      assert len(roof_heights) == 9 and min(roof_heights) == 32.2


def test_exact_v202_rows_leave_other_library_court_portico_and_readingroom_intact():
  data, previous = m.read(m.OUT / "librariesV202.json"), m.read(PREVIOUS)
  for key, owner_index, role_index in [
    ("boxes", 11, 8),
    ("blocks", 8, 5),
    ("surfaces", None, None),
  ]:
    selected = {r["index"] for r in previous[key]}
    assert len(selected) == len(previous[key])
    for entry in previous[key]:
      r = entry["row"]
      assert data[key][entry["index"]] == r
      owner, role = (
        (r[owner_index], r[role_index]) if owner_index else (r["owner"], r["role"])
      )
      assert data["owners"][owner]["id"] in {m.MAIN, m.CUPOLA}
      assert role not in (4, 8)
    for i, r in enumerate(data[key]):
      owner, role = (
        (r[owner_index], r[role_index]) if owner_index else (r["owner"], r["role"])
      )
      if data["owners"][owner]["parentId"] != m.PARENT or role in (4, 8):
        assert i not in selected


def test_both_required_packets_are_compact_full_detail_and_native_faces_orthogonal():
  evidence = m.read(EVIDENCE)
  for mode, packet in m.read(RUNTIME).items():
    assert len(packet["meshes"]) == 1
    mesh = packet["meshes"][0]
    p = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
      .reshape(-1, 3)
      .astype(float)
    )
    ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    assert len(p) < 65536 and ix.max() < len(p)
    if mode == "minecraft":
      t = p[ix]
      normal = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
      assert np.all(np.count_nonzero(normal, axis=1) <= 1)
    roles = evidence["counts"][mode]["roles"]
    for name in [
      "Linden-portal/giant-column",
      "Linden-portal/arched-glass",
      "corner-risalit/large-corner-window-glass",
      "cupola-crown/crown-louvre",
    ]:
      assert roles[name] > 0
    assert sum(v for k, v in roles.items() if "Linden-pediment" in k) > 0


def test_native_exact_difference_restores_the_complete_corrected_source_shell():
  records, before, occupied = m.retained()
  old_shell, old_front, _, _ = m.core.model(before, occupied)
  new_shell = m.corrected_model(m.corrected(before), occupied)
  both = m.Detail()
  both.triangles = old_shell.triangles + old_front.triangles
  old = m.merge_native_faces(m.native_detail(both))
  new = m.merge_native_faces(m.native_detail(new_shell))
  removed = m.detail_difference(old, new)
  restored = m.detail_difference(new, old)

  def bag(detail):
    return Counter(
      (tuple(sorted(tuple(round(float(v), 7) for v in p) for p in tri)), tuple(color))
      for tri, color, _ in detail.triangles
    )

  assert bag(old) - bag(removed) + bag(restored) == bag(new)
  evidence = m.read(EVIDENCE)
  assert len(removed.triangles) == evidence["previousCounts"]["minecraft"]
  assert len(restored.triangles) == evidence["additionCounts"]["minecraft"]
