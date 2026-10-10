"""Exact lake aperture in presentation geometry; original water is immutable."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_orankesee_margin_v209 as build  # noqa: E402


def test_source_contour_exact_cut_area_and_deterministic_rebuild() -> None:
  data = json.loads(build.OUTPUT.read_text())
  lake = shape(json.loads(build.SOURCE.read_text())["fullWater"])
  assert data == build.build()
  assert data["sourceVertexCount"] == 82
  assert data["sourceSha256"] == hashlib.sha256(build.SOURCE.read_bytes()).hexdigest()
  assert len(data["drawn"]) == 3
  assert len(data["native"]) == 9
  assert abs(data["cutAreaM2"] - 25883.14239313653) < 1e-7
  for record in data["drawn"]:
    triangle = record["source"]
    if len({p[1] for p in triangle}) != 1:
      continue
    original = Polygon([(x, z) for x, _, z in triangle])
    kept = unary_union(
      [Polygon([(x, z) for x, _, z in t]) for t in record["triangles"]]
    )
    assert kept.intersection(lake).area < 1e-7
    assert kept.symmetric_difference(original.difference(lake)).area < 1e-7
  for record in data["native"]:
    x, _, z = record["center"]
    w, _, d = record["size"]
    original = box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)
    kept = unary_union(
      [
        Polygon([(x, z) for x, _, z in t])
        for t in record["triangles"]
        if len({p[1] for p in t}) == 1 and t[0][1] > 2
      ]
    )
    assert kept.intersection(lake).area < 1e-7
    assert kept.symmetric_difference(original.difference(lake)).area < 1e-7


def test_all_original_water_packets_remain_byte_identical() -> None:
  data = json.loads(build.OUTPUT.read_text())
  assert len(data["unchangedWaterPackets"]) == 6
  for record in data["unchangedWaterPackets"]:
    path = ROOT / "src/app/public/mesh/surrounding-berlin-v159" / record["path"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == record["sha256"]
