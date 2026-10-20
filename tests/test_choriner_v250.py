"""Measured-owner binding and preserved roof/court regressions for v250."""

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data/chorinerV250.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/choriner-v250-evidence.json"


def test_members_stay_on_their_measured_wall_and_do_not_bridge_source_holes():
  data, evidence = json.loads(DATA.read_text()), json.loads(EVIDENCE.read_text())
  assert len(data["faces"]) == len(evidence["faces"]) == 104
  for f, audit in zip(data["faces"], evidence["faces"], strict=True):
    assert (f["owner"], f["partId"], f["sheet"]) == (
      audit["owner"],
      audit["partId"],
      audit["sheet"],
    )
    t, a = np.array(f["t"]), np.array(f["a"])
    rings = [
      [(float(np.dot(np.array([x, z]) - a, t)), y) for x, y, z in ring]
      for ring in audit["rings"]
    ]
    wall = Polygon(rings[0], rings[1:]).buffer(0.003)
    for m in f["members"]:
      u, y, w, h = [v / 1000 for v in m[:4]]
      assert wall.covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
    assert len(f["members"]) == len(audit["roles"])
  roles = {r for f in evidence["faces"] for r in f["roles"]}
  assert {
    "continuous-window-ribbon",
    "projecting-white-frame",
    "glass-balcony-reading",
    "source-wall-facing",
  } <= roles


def test_distinct_sites_datum_unchanged_and_data_bounded():
  data, evidence = json.loads(DATA.read_text()), json.loads(EVIDENCE.read_text())
  assert len(data["owners"]) == 6
  seven = next(b for b in evidence["owners"] if b["style"] == "zehdenicker7a")
  assert seven["osm"] == "way/477303813"
  assert seven["owner"] == "DEBE00YY1JO0001g"
  assert seven["offsetApplied"] == 0  # Already NHN-30: do not add 6.04 twice.
  assert 9 < seven["wallBottomY"] < 10
  schiffer = next(b for b in evidence["owners"] if b["style"] == "schiffer")
  assert schiffer["offsetApplied"] == 8.24
  assert schiffer["partsRetained"] == 7
  assert "DEBE01YYK00002ty" not in data["owners"]  # historic Zehdenicker11
  assert "DEBE01YYK0000AdV" not in data["owners"]  # historic Choriner85
  assert DATA.stat().st_size < 250_000
  assert hashlib.sha256(DATA.read_bytes()).hexdigest() == evidence["dataSha256"]
  for path, digest in evidence["sourceHashes"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest


def test_generator_replays_without_network_and_does_not_rewrite_source():
  sys.path.insert(0, str(ROOT / "scripts"))
  spec = importlib.util.spec_from_file_location(
    "choriner_v250", ROOT / "scripts/build_choriner_v250.py"
  )
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  before = DATA.read_bytes(), EVIDENCE.read_bytes()
  module.build()
  assert (DATA.read_bytes(), EVIDENCE.read_bytes()) == before
