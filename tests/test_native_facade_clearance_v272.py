"""Regression: fine native recognition must sit outside the measured block shell."""

from __future__ import annotations

import gzip
import json
from pathlib import Path

import numpy as np

from scripts.native_facade_clearance_v272 import NativeFacadeClearance

ROOT = Path(__file__).resolve().parents[1]


def test_face_normal_projection_is_local_and_orthogonal() -> None:
  cells = [
    [1, 1, 1, 2, 2, 2, 0, 0],
    [3, 1, 1, 2, 2, 2, 0, 0],
    [101, 1, 1, 2, 2, 2, 0, 0],
  ]
  c = NativeFacadeClearance(cells)
  f = {"a": np.array([0.0, 0.0]), "d": np.array([0.0, 1.0]), "n": np.array([-1.0, 0.0])}
  p = c.position(f, 1, 1, 0.12, 0.8, 0.6, 0.10)
  assert np.allclose(p, [-0.16, 1.0])
  # Cells100m away never force a local facade sign to float out in space.
  assert abs(p[0]) < 0.2
  rows = c.segment(f, 0.3, 0.4, 1.7, 1.6, 0.08, 0xFFFFFF, "test")
  assert all(r[6] == 0 for r in rows)
  assert all(r[0] + r[3] / 2 < 0 for r in rows)


def test_real_hauthree_and_taz_native_features_are_not_buried_in_source_blocks() -> (
  None
):
  for filename, roles in [
    (
      "theatres-v272-source.json.gz",
      {
        "hau1-convex-tall-foyer-window",
        "hau1-pediment-rim",
        "hau2-three-gold-light-frames",
        "hau3-arched-portal-frame",
      },
    ),
    (
      "press-quarter-v272-source.json.gz",
      {
        "taz-diamond-steel-screen",
        "lenk-vertical-satirical-relief",
        "lenk-portrait-profile",
      },
    ),
  ]:
    p = json.loads(
      gzip.decompress((ROOT / "geo_data/regierungsviertel" / filename).read_bytes())
    )
    blocks = np.array([r[:6] for r in p["nativeBlocks"]], dtype=float)
    rows = [r for r in p["nativeDetails"] if r[8] in roles]
    assert len(rows) > 50
    for r in rows:
      center = np.array(r[:3])
      half = np.array(r[3:6]) / 2
      overlap = np.all(
        np.abs(blocks[:, :3] - center) < (blocks[:, 3:6] / 2 + half - 0.001), axis=1
      )
      assert not overlap.any(), (filename, r[8], r[:3], blocks[overlap].tolist())
