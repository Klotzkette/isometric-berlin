"""Geometry accounting for the complete, compact official concert-hall export."""

import importlib.util
import json
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/app/src/data/concertHallsSource.json"


def test_concert_surfaces_keep_all_parts_and_nonflat_roof_envelopes() -> None:
  data = json.loads(SOURCE.read_text())
  assert len(data["parts"]) == 27
  assert len(data["surfaceGroups"]) == 288
  assert SOURCE.stat().st_size < 400_000
  assert len(data["nativeBlocks"]) == 7005
  assert {p["shortId"] for p in data["parts"]}.isdisjoint({"K0003VMd"})
  for id_, expected_top in [("XzEkeXsu", 39.765), ("aJ0e8oAr", 30.347)]:
    roof = [
      p
      for s in data["surfaceGroups"]
      if s["partId"] == id_ and s["kind"] == "RoofSurface"
      for t in s["triangles"]
      for p in t
    ]
    assert abs(max(p[1] for p in roof) - expected_top) < 0.001
    assert max(p[1] for p in roof) - min(p[1] for p in roof) > 6
  for s in data["surfaceGroups"]:
    for a, b, c in s["triangles"]:
      assert np.linalg.norm(np.cross(np.subtract(b, a), np.subtract(c, a))) > 1e-6


def test_every_exact_exterior_surface_is_kept_when_source_zip_available() -> None:
  spec = importlib.util.spec_from_file_location(
    "concert_export", ROOT / "scripts/build_concert_halls_v160.py"
  )
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  if not module.ZIP.exists():
    pytest.skip("Raw source ZIP intentionally remains uncommitted")
  data = json.loads(SOURCE.read_text())
  actual = [
    s
    for b in module.source_surfaces()
    for p in b["parts"]
    for s in p["surfaces"]
    if s["kind"] in {"RoofSurface", "WallSurface"}
    and not (p["id"].endswith(("K0003TqC", "K0003U62")) and s["kind"] == "WallSurface")
  ]
  assert len(actual) == len(data["surfaceGroups"])
  for original, exported in zip(actual, data["surfaceGroups"], strict=True):
    assert original["kind"] == exported["kind"]
    vertices = {tuple(p) for ring in original["rings"] for p in ring}
    assert all(tuple(p) in vertices for t in exported["triangles"] for p in t)
    expected = module.triangulate(original["rings"])
    assert exported["triangles"] == expected
