"""Real packet preservation, delivered stair apertures and grounded Mierendorff detail."""

import base64
import gzip
import json
import sys
from pathlib import Path

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "src/app/src/data/mierendorffV269.json").read_text())
EVIDENCE = json.loads(
  gzip.decompress(
    (ROOT / "geo_data/regierungsviertel/mierendorff-v269-evidence.json.gz").read_bytes()
  )
)


def arrays(mesh, origin):
  p = (
    np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
    + origin
  )
  i = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  c = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
  return p, i, c


def packet(key):
  mode, tile = key.split(":")
  return json.loads(
    gzip.decompress(
      (
        ROOT / f"src/app/public/mesh/surrounding-berlin-v159/{tile}.{mode}.json.gz"
      ).read_bytes()
    )
  )


def test_exact_input_receipts_and_all_previous_owner_sheets_survive():
  import hashlib

  for record in EVIDENCE["sourceInputs"]:
    assert (
      hashlib.sha256((ROOT / record["path"]).read_bytes()).hexdigest()
      == record["sha256"]
    )
  assert len(EVIDENCE["faces"]) == 37
  assert {f["owner"] for f in EVIDENCE["faces"]} == set(DATA["profile"]["owners"])
  assert EVIDENCE["overlappingGroundPackets"] == ["-9_-2", "district188--9_-2"]
  for key, plan in DATA["packets"].items():
    raw = packet(key)
    for rec in plan["transfers"]:
      p, i, _ = arrays(raw["meshes"][rec["mesh"]], raw["origin"])
      chosen = p[i[rec["triangles"]]]
      assert np.all(np.ptp(chosen[:, :, 1], axis=1) < 0.001)
      assert chosen[:, :, 1].min() >= 2.99 and chosen[:, :, 1].max() <= 3.4
    assert all(
      f["low"] == raw["nav"]["groundY"] == 3
      for f in EVIDENCE["faces"]
      if f["chunk"] == key.split(":")[1]
    )


def test_every_original_ground_complement_retains_height_colour_and_exact_area():
  for mode in ["drawn", "minecraft"]:
    plan = DATA["packets"][mode + ":-9_-2"]
    p, i, c = arrays(plan["structure"], plan["origin"])
    triangles = p[i]
    cuts = unary_union([Polygon(r["ring"], r["holes"]) for r in plan["openings"]])
    ox, _, oz = plan["origin"]
    cuts = translate(cuts, ox, oz)
    records = [r for r in EVIDENCE["groundReceipts"] if r["mode"] == mode]
    for level in sorted({r["points"][0][1] for r in records}):
      for rgb in {
        tuple(r["colours"][0]) for r in records if r["points"][0][1] == level
      }:
        previous = unary_union(
          [
            Polygon(np.array(r["points"])[:, [0, 2]])
            for r in records
            if r["points"][0][1] == level and tuple(r["colours"][0]) == rgb
          ]
        )
        mask = (np.abs(triangles[:, :, 1] - level) < 0.001).all(axis=1) & (
          c[i] == rgb
        ).all(axis=(1, 2))
        actual = unary_union([Polygon(t[:, [0, 2]]) for t in triangles[mask]])
        expected = previous.difference(cuts)
        # Intersections acquire centimetre display rounding only; no broad surface loss.
        assert expected.symmetric_difference(actual).area < 0.8
        assert actual.intersection(cuts.buffer(-0.016)).area < 0.01


def test_stair_floors_partition_openings_and_match_actual_rendered_treads():
  for mode in ["drawn", "minecraft"]:
    plan = DATA["packets"][mode + ":-9_-2"]
    p, i, _ = arrays(plan["structure"], plan["origin"])
    t = p[i]
    ox, _, oz = plan["origin"]
    openings = unary_union([Polygon(o["ring"], o["holes"]) for o in plan["openings"]])
    floors = unary_union([Polygon(f["ring"], f["holes"]) for f in plan["floors"]])
    assert openings.symmetric_difference(floors).area < 0.1
    for f in plan["floors"]:
      poly = translate(Polygon(f["ring"], f["holes"]), ox, oz)
      selected = t[(abs(t[:, :, 1] - f["y"]) < 0.0051).all(axis=1)]
      actual = unary_union([Polygon(a[:, [0, 2]]) for a in selected])
      assert poly.difference(actual.buffer(0.001)).area < 0.001
    for run in DATA["profile"]["runs"]:
      related = [f for f in plan["floors"] if f["sourceId"] == run["id"]]
      assert min(f["y"] for f in related) == round(3.12 - run["descent"], 5)
      assert max(f["y"] for f in related) == 3.12
      mid = Point(np.array(run["top"]) + np.array(run["d"]) * (run["length"] - 0.5))
      assert floors.covers(Point(mid.x - ox, mid.y - oz))


def test_full_mobile_budgets_and_independent_native_normals():
  for key, plan in DATA["packets"].items():
    raw = packet(key)
    vertices = len(plan["boxes"]) * 24
    indices = len(plan["boxes"]) * 36
    assert all(len(r) == 11 for r in plan["boxes"])
    if plan["structure"]:
      p, i, _ = arrays(plan["structure"], plan["origin"])
      vertices += len(p)
      indices += i.size
      if key.startswith("minecraft"):
        t = p[i]
        normals = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
        assert np.all((abs(normals) > 0.001).sum(axis=1) <= 1)
    if key.startswith("minecraft"):
      assert all(r[3] == 0 or r[4] == 0 for r in plan["boxes"])
    assert (
      sum(len(base64.b64decode(m["positions"])) // 6 for m in raw["meshes"]) + vertices
      <= 400000
    )
    assert (
      sum(len(base64.b64decode(m["indices"])) // 4 for m in raw["meshes"]) + indices
      <= 2400000
    )
    assert len(raw["meshes"]) + (2 if plan["structure"] else 1) <= 16
  assert DATA["profile"]["fullMobileIdentical"] and DATA["profile"]["nativeIndependent"]


def test_qa_cameras_clear_actual_neighbour_buildings_in_both_modes():
  sys.path.insert(0, str(ROOT))
  from scripts.build_mierendorff_v269 import camera_checks

  assert camera_checks() == EVIDENCE["cameraQA"]
