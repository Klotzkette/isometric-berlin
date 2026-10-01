"""Provenance and complete-surface accounting for the bounded museum correction."""

import json
from pathlib import Path

from isometric_berlin.generation.build_kulturforum_museums import build

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/app/src/kulturforumMuseumsSource.json"


def test_three_museum_bodies_keep_all_polygons_and_exact_old_prisms() -> None:
  data = json.loads(SOURCE.read_text())
  assert data["license"] == "dl-de/zero-2-0"
  assert data["origin_epsg25833_m"] == [389500, 5820000, 30]
  assert [len(b["surfaces"]) for b in data["bodies"]] == [119, 103, 12]
  assert SOURCE.stat().st_size < 90_000
  original = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  for body in data["bodies"]:
    assert body["source_prism"] == next(
      p for p in original if p["id"] == body["prism_id"]
    )
    assert all(len(r) >= 3 for s in body["surfaces"] for r in s["rings"])
  craft = next(b for b in data["bodies"] if b["prism_id"] == "K0002QYw")
  roof = [s for s in craft["surfaces"] if s["kind"] == "RoofSurface"]
  assert len(roof) == 1  # A coarse source, explicitly not a terrace survey.
  assert len(roof[0]["rings"]) == 2  # Do not close the mapped inner courtyard.


def test_exact_archive_reproduction_when_retained_raw_archives_are_present() -> None:
  paths = [
    ROOT / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip"
    for tile in ["388_5818", "389_5818"]
  ]
  if not all(p.exists() for p in paths):
    return  # Raw city downloads remain deliberately uncommitted.
  assert build(ROOT) == json.loads(SOURCE.read_text())
