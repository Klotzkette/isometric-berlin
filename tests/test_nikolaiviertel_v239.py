"""Source retention, bounded additive detail and independent native topology."""

from __future__ import annotations

import base64
import gzip
import importlib.util
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Point, shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "nikolai239", ROOT / "scripts/build_nikolaiviertel_v239.py"
)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def vertices(mesh: dict) -> np.ndarray:
  return np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)


def test_exact_existing_source_families_and_no_prior_payload_changes() -> None:
  source = m.read(m.SOURCE)
  original = {b["id"]: b for b in m.read(m.CATALOGUE)["buildings"]}
  assert len(source["buildings"]) == 35
  assert sum(len(b["parts"]) for b in source["buildings"]) == 68
  assert source["sourceCatalogueSha256"] == m.sha(m.CATALOGUE)
  for b in source["buildings"]:
    assert b == original[b["id"]]
    assert b["category"] in {"outer", "core"}
  # This independently covers every original coordinate, source polygon ID,
  # roof, courtyard hole, inherited datum and ownership binding.
  for path, digest in source["preservation"].items():
    assert m.sha(ROOT / path) == digest
  assert {m.CHURCH, m.EPHRAIM, m.KNOBLAUCH, m.NUT, m.COURT} <= {
    b["id"] for b in source["buildings"]
  }


def test_finite_mapped_district_and_explicit_retained_conflicts() -> None:
  source = m.read(m.SOURCE)
  district = shape(source["district"]["geometry"])
  assert source["district"]["id"] == "way/312391532"
  assert 51500 < district.area < 51700
  for b in source["buildings"]:
    g = m.footprint(b)
    assert district.intersection(g).area / g.area >= 0.98
  assert source["retainedUnmodified"]
  assert not {b["id"] for b in source["buildings"]} & {
    b["id"] for b in source["retainedUnmodified"]
  }
  assert m.read(m.ADDITION)["footprint"] == []


def test_two_spires_use_church_height_and_measured_tower_anchor() -> None:
  source = m.read(m.SOURCE)
  evidence = m.read(m.EVIDENCE)
  church = next(b for b in source["buildings"] if b["id"] == m.CHURCH)
  assert source["churchOsm"]["id"] == "way/23813200"
  assert float(source["churchOsm"]["tags"]["height"]) == 84.4
  spires = evidence["audits"]["drawn"]["spires"]
  assert len(spires) == 2
  assert evidence["audits"]["minecraft"]["spires"] == spires
  tower = next(p for p in church["parts"] if p["id"] == spires[0]["towerPart"])
  g = m.footprint(tower)
  assert 9 < np.linalg.norm(np.subtract(spires[0]["center"], spires[1]["center"])) < 12
  for spire in spires:
    assert g.covers(Point(spire["center"]))
    assert spire["topY"] == church["groundY"] + 84.4
    assert abs(spire["baseY"] - tower["topY"]) < 0.2
    assert spire["radiusEstimate"] < 4.2


def test_delivered_packets_have_empty_navigation_valid_hashes_and_bounded_memory() -> (
  None
):
  addition = m.read(m.ADDITION)
  evidence = m.read(m.EVIDENCE)
  assert len(addition["chunks"]) == 1
  desc = addition["chunks"][0]
  assert desc["id"] == "nikolai239-4_0"
  for mode in ["drawn", "minecraft"]:
    path = m.OUT / desc[mode]["url"]
    assert m.sha(path) == desc[mode]["sha256"]
    assert path.stat().st_size == desc[mode]["bytes"]
    assert len(gzip.decompress(path.read_bytes())) == desc[mode]["decodedBytes"]
    assert desc[mode]["decodedBytes"] < 12 * 1024**2
    payload = m.read(path)
    assert payload["nav"] == {"groundY": 3, "ground": [], "water": [], "buildings": []}
    assert len(payload["meshes"]) == 1
    mesh = payload["meshes"][0]
    assert mesh["kind"] == "nikolaiviertel-v239"
    v = vertices(mesh)
    ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    assert len(v) < 400000 and ix.size < 2400000
    assert ix.max() < len(v)
    assert v[:, [0, 2]].max() <= 51200
    budget = 350000 if mode == "drawn" else 4800000
    assert evidence["packets"][mode + ":" + desc["id"]]["gpuBytes"] < budget
    if mode == "minecraft":
      t = v[ix].astype(float)
      normals = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
      assert np.all(np.count_nonzero(np.abs(normals) > 1e-6, axis=1) <= 1)
    else:
      assert abs(v[:, 1].max() / 100 + payload["origin"][1] - 87.4) < 0.011


def test_recognition_does_not_replace_windows_or_invent_doors() -> None:
  source = m.read(m.SOURCE)
  evidence = m.read(m.EVIDENCE)
  audit = evidence["audits"]["drawn"]
  roles = audit["roles"]
  assert roles["twin-copper-spire"] > 0
  assert roles["westwork-string-course"] > 0
  assert roles["rococo-paired-pilaster"] > 0
  assert roles["palais-gilt-rail"] > 0
  assert roles["knoblauch-sill-shadow"] > 0
  assert roles["measured-roof-edge"] > 0
  assert not any("glazing" in role or "shell" in role for role in roles)
  mapped = {e["id"]: e for e in source["entrances"]}
  for door in audit["entrances"]:
    assert door["sourcePosition"] == mapped[door["id"]]["position"]
    assert door["owner"] == mapped[door["id"]]["owner"]
    assert door["wallDistance"] < 1.25
  assert "Independent orthogonal" in evidence["audits"]["minecraft"]["construction"]
