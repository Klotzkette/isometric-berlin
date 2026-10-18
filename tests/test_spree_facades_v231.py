"""Public-street anchors and exact immutable predecessor ownership."""

from __future__ import annotations

import gzip
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def test_existing_source_and_packet_bytes_are_retained():
  evidence = json.loads(
    (ROOT / "geo_data/regierungsviertel/spree-facades-v231-evidence.json").read_text()
  )
  assert evidence["bodyTrianglesRemoved"] == 0
  assert evidence["drawnTransferredTriangles"] == 1212
  for path, expected in evidence["preserved"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected, path


def test_every_added_front_uses_the_exact_source_wall_and_retained_openings():
  profile = json.loads((DATA / "spreeFacadesV231.json").read_text())
  rows = []
  for filename in [
    "source-390_5820-00.json.gz",
    "source-391_5820-00.json.gz",
    "source-391_5819-00.json.gz",
  ]:
    rows += json.loads(
      gzip.decompress(
        (ROOT / "geo_data/regierungsviertel/alt-mitte-v169" / filename).read_bytes()
      )
    )["buildings"]
  by_id = {row["id"]: row for row in rows}
  assert len(profile["sites"]) == 15
  for site in profile["sites"]:
    row = by_id[site["owner"]]
    assert row["category"] == "core"
    for wall in site["walls"]:
      part = next(p for p in row["parts"] if p["id"] == wall["part"])
      sheet = part["surfaces"][wall["surface"]]
      assert sheet["kind"] == "WallSurface"
      coordinates = [[p[0], p[2]] for p in sheet["rings"][0]]
      assert wall["a"] in coordinates and wall["b"] in coordinates
      assert abs(np.linalg.norm(wall["normal"]) - 1) < 1e-6
      assert wall["base"] >= part["groundY"] - 0.01
      assert wall["eave"] <= part["topY"] + 0.01
      if wall["role"] == "existing-rhythm":
        assert wall["roadId"] and wall["panes"]
        assert all(
          0 < u < wall["length"] and wall["base"] < y < wall["eave"]
          for u, y in wall["panes"]
        )


def test_strict_receipts_replay_without_raw_downloads():
  subprocess.run(
    [sys.executable, str(ROOT / "scripts/build_spree_facades_v231.py"), "--check"],
    cwd=ROOT,
    check=True,
    capture_output=True,
    text=True,
  )
