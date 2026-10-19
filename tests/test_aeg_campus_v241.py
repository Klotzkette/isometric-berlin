"""Source completeness, owner preservation, and independent native campus skin."""

import base64
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_aeg_campus_v241 as m  # noqa: E402


def read(path):
  return json.loads(path.read_bytes())


def test_every_source_part_and_courtyard_reaches_navigation_unchanged():
  source = json.loads(gzip.decompress(m.SOURCE.read_bytes()))
  nav = read(m.DATA / "aegCampusV241Navigation.json")
  evidence = read(m.GEO / "aeg-campus-v241-evidence.json")
  assert evidence["sourceSha256"] == hashlib.sha256(m.SOURCE.read_bytes()).hexdigest()
  assert sum(len(p["parts"]) for s in source["sites"] for p in s["parents"]) == 47
  for site, n, e in zip(source["sites"], nav["sites"], evidence["sites"], strict=True):
    found = {p["id"]: p for p in n["owners"]}
    total = 0
    for parent in site["parents"]:
      dy = e["sourceGroundTranslations"][parent["id"]]
      for p in parent["parts"]:
        assert found[p["id"]]["ring"] == p["ring"]
        assert found[p["id"]]["holes"] == p["holes"]
        assert abs(found[p["id"]]["high"] - p["top_y_m"] - dy) < 1e-6
        total += sum(len(m.triangles_for(s["rings"])) for s in p["surfaces"])
    assert total == e["sourceTriangles"]
  dw = nav["sites"][2]
  assert max(p["high"] - p["low"] for p in dw["owners"]) > 40
  assert min(p["high"] - p["low"] for p in dw["owners"]) < 10


def test_six_exact_old_owners_and_full_native_rows_are_recoverable():
  receipt = read(m.DATA / "aegCampusV241CorePrevious.json")
  raw = (ROOT / receipt["prismSource"]).read_bytes()
  assert hashlib.sha256(raw).hexdigest() == receipt["prismSha256"]
  assert (
    hashlib.sha256((ROOT / receipt["voxelSource"]).read_bytes()).hexdigest()
    == receipt["voxelSha256"]
  )
  before = json.loads(raw)["buildings"]
  assert set(o["prism"]["id"] for o in receipt["owners"]) == set(m.OWNERS)
  for owner in receipt["owners"]:
    assert owner["prism"] == next(p for p in before if p["id"] == owner["prism"]["id"])
    assert owner["columns"]


def test_bounded_meshes_native_orthogonality_and_source_render_vertices():
  runtime = read(m.DATA / "aegCampusV241.json")
  for mode, packets in runtime.items():
    assert len(packets) == 3
    for packet in packets:
      assert len(packet["meshes"]) == 1
      mesh = packet["meshes"][0]
      p = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
        .reshape(-1, 3)
        .astype(float)
      )
      ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      assert ix.max() < len(p)
      assert len(p) < 150_000
      if mode == "minecraft":
        tris = p[ix]
        normals = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
        assert np.all(np.count_nonzero(normals, axis=1) <= 1)
      assert not packet["nav"]["buildings"]


def test_native_surface_merge_preserves_exposed_area_and_both_cell_colours():
  # Two differently coloured adjacent cubes have ten externally visible faces.
  skin = m.native_skin(
    [[0.5, 0.5, 0.5, 1, 1, 1, 0xAA3344], [1.5, 0.5, 0.5, 1, 1, 1, 0x112233]]
  )
  area = sum(
    np.linalg.norm(np.cross(np.array(t[1]) - t[0], np.array(t[2]) - t[0])) / 2
    for t, _, _ in skin.triangles
  )
  assert area == 10
  assert {c for _, c, _ in skin.triangles} == {m.rgb(0xAA3344), m.rgb(0x112233)}
  assert all(not all(p[0] == 1 for p in t) for t, _, _ in skin.triangles)
