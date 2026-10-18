"""Replay actual prior opening geometry; no visual-schema-only confidence."""

import hashlib
import importlib.util
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "boulevard235", ROOT / "scripts/build_boulevard_architecture_v235.py"
)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


def test_all_fields_bind_exact_existing_openings_and_full_corridor():
  evidence = b.read(b.EVIDENCE)
  runtime = b.read(b.RUNTIME)
  counts = {}
  for packet in evidence["packets"]:
    mode, identity = packet["key"].split(":")
    path = b.OUT / f"{identity}.{mode}.json.gz"
    assert hashlib.sha256(path.read_bytes()).hexdigest() == packet["packetSha256"]
    source = b.read(path)
    plan = runtime["packets"][packet["key"]]
    assert len(plan["fields"]) == len(packet["fields"])
    triangles = set()
    cells = set()
    for guard in plan["guards"]:
      part = source["meshes"][guard["mesh"]]
      assert (
        b.fingerprint([part["positions"], part["colors"], part["indices"]])
        == guard["fingerprint"]
      )
      points, colours, indices = b.decode(part, np.array(source["origin"]))
      for t in indices:
        if all(tuple(colours[i]) == b.GLASS for i in t):
          triangles.add(b.key(points[t]))
          cells.add(
            tuple(
              np.rint(
                np.concatenate([points[t].min(axis=0), points[t].max(axis=0)]) * 100
              ).astype(int)
            )
          )
    for field in packet["fields"]:
      if mode == "drawn":
        points = np.array(field["points"])
        assert b.key(points[[0, 1, 2]]) in triangles
        assert b.key(points[[0, 2, 3]]) in triangles
      else:
        assert tuple(field["cellFace"]) in cells
        assert np.count_nonzero(field["normal"]) == 1
      counts.setdefault(mode, set()).add(field["section"])
  expected = {
    "West-Halensee",
    "Lehniner-Platz",
    "Central-Kudamm",
    "Breitscheidplatz",
    "Tauentzien",
  }
  assert counts["drawn"] == counts["minecraft"] == expected
  assert (
    evidence["sources"]["west-streets-v163"]["completeMeasuredOwnersRetained"] == 360
  )


def test_protected_roof_owners_absent_and_source_evidence_unchanged():
  owners = {
    p["owner"] for p in b.read(b.GEO / "roof-house-v233-source.json.gz")["owners"]
  }
  evidence = b.read(b.EVIDENCE)
  assert not owners & {f["owner"] for p in evidence["packets"] for f in p["fields"]}
  for name, source in evidence["sources"].items():
    assert (
      hashlib.sha256((b.GEO / f"{name}.json").read_bytes()).hexdigest()
      == source["sha256"]
    )
  assert "display estimates" in evidence["policy"]
