"""Bounded additive recognition and explicit source-conflict contracts."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / "src/app/src/data/cityRecognitionV182.json"


def test_landmark_identities_and_no_duplicate_shells() -> None:
  data = json.loads(RUNTIME.read_text())
  names = {p["name"] for p in data["features"]}
  assert names == {
    "Rathaus Tiergarten",
    "Rathaus Mitte",
    "Altes Stadthaus",
    "Schillertheater",
    "Deutsche Oper Berlin",
    "rbb Fernsehzentrum",
    "Haus des Rundfunks",
    "Estrel Hotel",
    "Staatsoper Unter den Linden",
  }
  assert all("way/32664053" not in p["osmIds"] for p in data["features"])
  assert all("way/1532296165" not in p["osmIds"] for p in data["features"])
  assert "new solid shell" in data["policy"]
  assert "surfaces" not in data
  assert len({p["parentId"] for p in data["features"]}) == len(data["features"])


def test_small_finite_static_render_budget_and_source_conflicts() -> None:
  data = json.loads(RUNTIME.read_text())
  segments, boxes = np.array(data["segments"]), np.array(data["boxes"])
  assert segments.shape[1] == 7 and boxes.shape[1] == 8
  assert np.isfinite(segments).all() and np.isfinite(boxes).all()
  assert len(segments) < 23_000 and len(boxes) < 8_000
  assert RUNTIME.stat().st_size < 1_800_000
  assert np.all(boxes[:, 3:6] > 0)
  assert np.min(segments[:, [0, 2, 3, 5]]) > -7000
  assert np.max(segments[:, [0, 2, 3, 5]]) < 6500
  assert data["blueObelisk"]["osmId"] == "node/558903414"
  assert data["blueObelisk"]["heightM"] == 15
  assert data["sourceConflicts"][0]["publishedTowerHeightM"] == 80
  assert len(data["sourceConflicts"]) == 2


def test_windows_stay_inside_source_plane_and_blind_opera_front() -> None:
  spec = importlib.util.spec_from_file_location(
    "city_recognition_v182", ROOT / "scripts/build_city_recognition_v182.py"
  )
  assert spec and spec.loader
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  # A tall wall is intentionally clipped above/below, rather than a generic
  # maximum-height facade grid that spills into its triangular roof margin.
  record = {
    "name": "Deutsche Oper Berlin",
    "groundY": 3,
    "surfaces": [
      {
        "kind": "WallSurface",
        "rings": [[[0, 3, 700], [20, 3, 700], [20, 23, 700], [0, 23, 700]]],
      }
    ],
  }
  data = module.build([record])
  assert data["features"][0]["boxCount"] == 0
  record["name"] = "Rathaus Mitte"
  data = module.build([record])
  feature = data["features"][0]
  assert feature["boxCount"] > 0
  for x, y, z, w, h, _, _, _ in data["boxes"][: feature["boxCount"]]:
    assert 0 < x - w / 2 < x + w / 2 < 20
    assert 3 < y - h / 2 < y + h / 2 < 23
    assert abs(z - 700) < 0.2
