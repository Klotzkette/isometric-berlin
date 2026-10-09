"""The ICC substitution must be exact and leave unrelated source owners untouched."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_karl_marx_allee_v161 import mesh_signature  # noqa: E402
from build_ring_city_v182 import hero_ownership  # noqa: E402
from integrate_airports_v194 import signature_sha  # noqa: E402
from integrate_city_refinements_v166 import line_signature  # noqa: E402
from integrate_icc_v199 import (  # noqa: E402
  CHECKPOINT,
  PUBLIC,
  RECEIPT,
  TARGETS,
  verify_replacement,
)


def test_icc_replacement_keeps_every_complete_source_part() -> None:
  source = verify_replacement()
  assert sum(len(owner["parts"]) for owner in source["owners"]) == 49
  owners, _ = hero_ownership()
  assert {
    "DEBE04YY500001II",
    "DEBE04YY500004dG",
    "DEBE04YY500006BE",
  } <= owners


def test_scoped_packets_remove_only_audited_icc_faces_and_nav() -> None:
  receipt = json.loads(RECEIPT.read_bytes())
  checkpoint = {
    (r["id"], r["mode"]): r
    for r in json.loads(gzip.decompress(CHECKPOINT.read_bytes()))
  }
  assert {r["id"] for r in receipt["chunks"]} == {r[0] for r in TARGETS}
  for chunk in receipt["chunks"]:
    for mode, report in chunk["modes"].items():
      old = json.loads(
        gzip.decompress(base64.b64decode(checkpoint[(chunk["id"], mode)]["gzipBase64"]))
      )
      blob = (PUBLIC / report["newDescriptor"]["url"]).read_bytes()
      assert hashlib.sha256(blob).hexdigest() == report["newDescriptor"]["sha256"]
      new = json.loads(gzip.decompress(blob))
      if mode == "drawn":
        descriptor = next(d for d in receipt["descriptors"] if d["id"] == chunk["id"])
        assert descriptor["buildingCount"] == len(
          {b["sourceId"] for b in new["nav"]["buildings"]}
        )
      before, after = mesh_signature(old), mesh_signature(new)
      assert not after - before
      assert sum((before - after).values()) == report["removedTriangles"]
      assert signature_sha(before - after) == report["removedTriangleSha256"]
      assert signature_sha(after) == report["preservedTriangleSha256"]
      assert {k: v for k, v in old["nav"].items() if k != "buildings"} == {
        k: v for k, v in new["nav"].items() if k != "buildings"
      }
      assert new["nav"]["buildings"] == [
        b for b in old["nav"]["buildings"] if b["sourceId"] != chunk["owner"]
      ]
      assert report["removedNav"] == [
        b for b in old["nav"]["buildings"] if b["sourceId"] == chunk["owner"]
      ]
      if mode == "drawn":
        before_lines, after_lines = (
          line_signature(old["lines"]),
          line_signature(new["lines"]),
        )
        assert not after_lines - before_lines
        assert (
          sum((before_lines - after_lines).values()) == report["removedInkSegments"]
        )
