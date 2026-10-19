"""Q207 retirement must identify only the old generic estimated facade."""

from __future__ import annotations

import base64
import hashlib
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import lafayette_v241_receipts as receipt  # noqa: E402
from alt_mitte_v169_packets import pack_detail  # noqa: E402


@pytest.fixture(scope="module")
def replay():
  buildings, occupied, _ = receipt.retained()
  return {b["id"]: receipt.core.model(b, occupied) for b in buildings}


def geometry_signatures(mesh: dict) -> list[bytes]:
  positions = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return [b"".join(sorted(p.tobytes() for p in t)) for t in positions[indices]]


def test_complete_generic_facade_replay_matches_persisted_retirement(replay):
  front = replay[receipt.MAIN][1]
  assert len(front.triangles) == 3672
  assert {r for _, _, r in front.triangles} == {
    "window surround",
    "window glazing",
    "window mullion",
    "stone window sill",
  }
  records, audit, _ = receipt.matches(front, "drawn", False)
  assert receipt.read(receipt.PREVIOUS) == {"schemaVersion": 1, "records": records}
  assert [(r["tile"], r["fingerprint"], len(r["triangles"])) for r in records] == [
    ("2_0", 1773677354, 1114),
    ("2_1", 3924025338, 2678),
  ]
  assert audit == receipt.read(receipt.EVIDENCE)["facadePackets"]
  assert all(r["mode"] == "drawn" for r in records)


def test_no_source_sheet_of_any_thirteen_owner_is_retired(replay):
  records = receipt.read(receipt.PREVIOUS)["records"]
  for record in records:
    packet = receipt.read(receipt.PUB / (record["tile"] + ".drawn.json.gz"))
    mesh = next(m for m in packet["meshes"] if m["kind"] == record["kind"])
    signatures = geometry_signatures(mesh)
    selected = Counter(signatures[i] for i in record["triangles"])
    ox, oy, oz = packet["origin"]
    source = Counter(
      s
      for shell, _, _, _ in replay.values()
      for m in pack_detail(shell, (ox, oz, ox + 512, oz + 512), origin_y=oy)
      for s in geometry_signatures(m)
    )
    assert not selected & source
  assert len(replay) == 13
  assert all(not replay[owner][1].triangles for owner in receipt.INTERIOR)


def test_original_inputs_and_retained_owner_evidence_remain_complete():
  evidence = receipt.read(receipt.EVIDENCE)
  for name, digest in evidence["sourceInputs"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest, name
  owners = evidence["retainedSourceOwners"]
  assert {o["owner"] for o in owners} == receipt.OWNERS
  assert sum(o["emittedSourceTriangles"] for o in owners) == 3174
  assert sum(o["deliveredSourceTriangles"] for o in owners) == 3342
  assert evidence["retainedNativeMain"]["deliveredTriangles"] == 3504
  assert evidence["retainedV186Edges"] == []
  assert all(not ids for ids in evidence["v233PacketMembership"].values())
  for owner in evidence["interiorRoofOcclusion"]:
    assert owner["sourceRoofVertices"] == owner["verticesCoveredByMainRoof"] > 0
    assert owner["minimumMainRoofGapM"] > 1
  fronts = evidence["retainedNativeMain"]["clearance"]["fronts"]
  assert [f["minimumPanelInnerFaceOffsetM"] for f in fronts] == pytest.approx(
    [2.1438993230502286, 2.156932269948352]
  )
