"""Step 10: retain the actual supporting sources for the new northern detail."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import struct
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def test_north_context_supports_use_retained_packets_and_mapped_tables() -> None:
  evidence = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/north-context-v312-evidence.json.gz"
      ).read_bytes()
    )
  )
  profile = json.loads((ROOT / "src/app/src/data/northContextV312.json").read_bytes())
  for source, sha in evidence["inputs"].items():
    if "/raw/" not in source:
      assert hashlib.sha256((ROOT / source).read_bytes()).hexdigest() == sha

  station = evidence["station"]
  assert station["suppressedOriginalPrism"]["id"] == "27822655"
  assert station["officialFamily"]["id"] == "DEBE01YYK00007hE"
  assert max(p["topY"] for p in station["officialFamily"]["parts"]) == 18.82

  for native, mode in ((False, "drawn"), (True, "minecraft")):
    tables = next(
      p
      for p in profile
      if p["key"] == "Helmholtzplatz table tennis" and p["native"] is native
    )
    rows = list(
      struct.iter_unpack(
        "<6fI" if native else "<7fI", base64.b64decode(tables["boxes"], validate=True)
      )
    )
    source_tables = evidence[mode]["tables"]
    assert len(rows) == 35 and len(source_tables) == 5
    for box_row, (_, x, z, ground) in zip(rows[::7], source_tables, strict=True):
      assert box_row[:3] == pytest.approx((x, ground + 0.72, z), abs=0.0002)
