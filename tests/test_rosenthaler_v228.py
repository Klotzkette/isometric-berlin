"""Independent source attachment and retained source preservation contracts."""

import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "rosenthaler_v228", ROOT / "scripts/build_rosenthaler_v228.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_reproduces_and_preserves_every_previous_named_source():
  model, audit = module.build()
  assert model == json.loads(
    (ROOT / "src/app/src/data/rosenthalerV228.json").read_text()
  )
  assert audit == json.loads(
    (ROOT / "geo_data/regierungsviertel/rosenthaler-v228-evidence.json").read_text()
  )
  for path, digest in audit["sourceSha256"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  assert (ROOT / "src/app/src/data/rosenthalerV228.json").stat().st_size < 45000


def test_pharmacy_and_oberholz_match_independent_mapped_source_owners():
  model, audit = module.build()
  source = json.loads(
    (ROOT / "geo_data/regierungsviertel/rosenthaler-platz-v163.json").read_text()
  )
  osm = json.loads(
    (ROOT / "geo_data/regierungsviertel/rosenthaler-osm-v228.json").read_text()
  )
  assert {g["owner"] for g in model["facades"]} == {
    "DEBE01YYK0000E7j",
    "DEBE01YYK0000Die",
  }
  for g, evidence in zip(model["facades"], audit["faces"]):
    b = next(b for b in source["buildings"] if b["id"] == g["owner"])
    node = next(n for n in osm["points"] if int(n["tags"]["osm_id"]) == g["osmNode"])
    assert (
      min(
        Polygon(p["ring"], p["holes"]).distance(Point(node["point"]))
        for p in b["parts"]
      )
      < 0.05
    )
    for face in evidence["faces"]:
      part = next(p for p in b["parts"] if p["id"] == face["partId"])
      original = part["surfaces"][face["surfaceIndex"]]["rings"]
      assert [[q[::2] for q in r] for r in original] == [
        [q[::2] for q in r] for r in face["rings"]
      ]
      pts = np.array(face["rings"][0])
      a, c = max(
        ((a, c) for a in pts for c in pts),
        key=lambda ac: np.linalg.norm((ac[1] - ac[0])[[0, 2]]),
      )
      d = np.array([c[0] - a[0], 0, c[2] - a[2]])
      d /= np.linalg.norm(d)
      rings = [
        [(float(np.dot(np.array(p) - a, d)), p[1]) for p in r] for r in face["rings"]
      ]
      wall = Polygon(rings[0], rings[1:]).buffer(0.002)
      for i in face["boxes"]:
        row = g["boxes"][i]
        u = float(np.dot(np.array(row[:3]) - a, d))
        assert wall.covers(
          box(u - row[3] / 2, row[1] - row[4] / 2, u + row[3] / 2, row[1] + row[4] / 2)
        )
        assert row[5] <= 0.12
        if g["osmNode"] == 3310052861:
          # No new pharmacy detail is allowed across the upper Circus facade.
          assert row[1] < 11.5


def test_all_four_stair_axes_counts_and_upper_entrances_are_independent_osm_matches():
  model, _ = module.build()
  osm = json.loads(
    (ROOT / "geo_data/regierungsviertel/rosenthaler-osm-v228.json").read_text()
  )
  assert {r["osmWay"]: r["stepCount"] for r in model["stairs"]} == {
    380361912: 16,
    380361914: 22,
    380361915: 16,
    380361919: 23,
  }
  for r in model["stairs"]:
    original = next(s for s in osm["stairs"] if int(s["tags"]["osm_id"]) == r["osmWay"])
    upper = next(
      n for n in osm["points"] if int(n["tags"]["osm_id"]) == r["entranceNode"]
    )
    assert original["tags"]["incline"] == "up"
    assert math.dist(r["top"], original["points"][-1]) < 0.00001
    assert math.dist(r["bottom"], original["points"][0]) < 0.00001
    assert math.dist(r["top"], upper["point"]) < 0.00001
    assert r["surfaceY"] == round(module.ground_at(*upper["point"]) + 0.08, 4)
    assert r["landing"] < math.dist(r["top"], r["bottom"]) / 4


def test_ground_receipts_reproduce_exact_retained_packets_and_exclude_buildings():
  import build_rosenthaler_ground_v228

  rebuilt = build_rosenthaler_ground_v228.build()
  assert rebuilt == json.loads(
    (ROOT / "src/app/src/data/rosenthalerV228Ground.json").read_text()
  )
  assert set(rebuilt) == {
    "3_-3.drawn",
    "3_-3.minecraft",
    "4_-3.drawn",
    "4_-3.minecraft",
  }
  assert all(
    set(p["counts"]) == {"city", "scheunenviertel-v168"} for p in rebuilt.values()
  )
