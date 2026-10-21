"""Bounded source-plane and exact old-facade preservation contracts."""

import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_leipziger_muenze_v257 import MINT, build  # noqa: E402
from build_north_mitte_fronts_v239 import current_triangles  # noqa: E402
from build_schools_places_v205 import Face, group  # noqa: E402


def read(name: str) -> dict:
  """Read the committed finite derived evidence."""
  path = ROOT / "geo_data/regierungsviertel" / name
  return json.loads(gzip.decompress(path.read_bytes()))


def test_complete_sources_and_exact_correction_receipts() -> None:
  source = read("leipziger-muenze-v257-source.json.gz")
  for path, expected in source["sources"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected
  keys, _ = current_triangles(box(2420, 340, 2570, 470))
  corrections = source["correctedAuthoredEstimates"]
  assert len(corrections) == 6
  assert {r["owner"] for r in corrections} == {MINT}
  assert {r["surfaceIndex"] for r in corrections} == {4, 7, 20, 25, 33, 110}
  for record in corrections:
    assert len(record["triangles"]) >= 96
    assert all(bytes.fromhex(key) in keys for key in record["triangles"])
    assert record["unchangedSourcePlane"]["kind"] == "WallSurface"


def test_fittings_stay_on_the_exact_source_walls() -> None:
  evidence = read("leipziger-muenze-v257-evidence.json.gz")
  assert evidence["sourceFaces"] == 36
  assert len(evidence["ownerIds"]) == 14
  for entry in evidence["groups"]:
    audit = entry["faces"][0]
    f = Face(group("check", entry["owner"]), audit["rings"], audit["normal"])
    assert not entry["rods"]
    for row in entry["boxes"]:
      p = np.array(row[:3])
      u = float(np.dot(p - f.a, f.d))
      assert f.wall.buffer(0.001).covers(
        box(u - row[3] / 2, row[1] - row[4] / 2, u + row[3] / 2, row[1] + row[4] / 2)
      )
      assert abs(row[6] - f.yaw) < 1e-8
    assert all(len(row) == 7 for row in entry["nativeRows"])


def test_rebuild_is_deterministic_and_uses_only_existing_batches() -> None:
  packed, evidence = build(read("leipziger-muenze-v257-source.json.gz"))
  data = ROOT / "src/app/src/data"
  assert packed == json.loads((data / "leipzigerMuenzeV257.json").read_text())
  old = json.loads((data / "altMitteEdgesV186.json").read_text())
  assert set(packed["cells"]) <= {c["cell"] for c in old["cells"]}
  assert (
    hashlib.sha256((data / "altMitteEdgesV186.json").read_bytes()).hexdigest()
    == evidence["oldCellsReceipt"]
  )
  assert len(gzip.compress(json.dumps(packed).encode())) < 110_000
