"""Independently bound the exact old facade-estimate exception."""

import hashlib
import json
from pathlib import Path

from scripts.build_townhall_previous_v227 import build

ROOT = Path(__file__).resolve().parents[1]


def test_previous_receipt_reproduces_and_keeps_all_measured_edges() -> None:
  receipt = json.loads(
    (ROOT / "src/app/src/data/townhallV227Previous.json").read_text()
  )
  assert receipt == build()
  raw = (ROOT / receipt["source"]).read_bytes()
  assert hashlib.sha256(raw).hexdigest() == receipt["sourceSha256"]
  source = json.loads(raw)
  excluded = {row["index"] for row in receipt["segments"]}
  assert excluded
  assert all(source["segments"][i][-1] != 0x62696A for i in excluded)
  previous = json.loads(
    (ROOT / "src/app/src/data/westCivicV210Previous.json").read_text()
  )
  for kind in ["boxes", "segments"]:
    assert not {row["index"] for row in receipt[kind]} & {
      row["index"] for row in previous[kind]
    }
