"""Bounded original source retention for the v1.0.47 palais ensemble."""

import json
from pathlib import Path

import pytest
from shapely.geometry import Point

from isometric_berlin.data.fetch_lod2 import load_bounds_polygon, project_to_berlin

ROOT = Path(__file__).resolve().parents[1]


def test_exact_previous_prisms_and_all_source_roofs_are_preserved() -> None:
  """No old metric source is replaced by a procedural detail estimate."""
  source = json.loads((ROOT / "src/app/src/palacesUdlSource.json").read_text())
  old = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  profiles = list(source["profiles"].values())
  assert [len(p["parts"]) for p in profiles] == [11, 5, 1]
  assert {v for p in profiles for v in p["replaced_prism_ids"]} == {
    "-4284350",
    "24247322",
    "17728387",
  }
  for p in profiles:
    for previous in p["previous_display_prisms"]:
      assert previous == old[previous["id"]]
    for part in p["parts"]:
      assert any(s["kind"] == "RoofSurface" for s in part["surfaces"])
      assert any(s["kind"] == "WallSurface" for s in part["surfaces"])
  assert source["monument"]["osm_key"] == "node/262455591"
  assert source["monument"]["world_anchor_m"] == pytest.approx(
    [1440.98647896654, 214.187920913]
  )


def test_source_sheets_remain_inside_bounds_and_match_original_zip() -> None:
  """Re-extraction checks original walls/roof vertices, never a simplified hull."""
  from scripts.build_palaces_udl_source import build_source

  committed = json.loads((ROOT / "src/app/src/palacesUdlSource.json").read_text())
  if not (ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_391_5819.zip").exists():
    pytest.skip("Optional ignored raw source ZIP is absent")
  assert build_source(ROOT) == committed
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  for profile in committed["profiles"].values():
    for p in profile["parts"]:
      for surface in p["surfaces"]:
        for ring in surface["rings"]:
          assert all(bounds.covers(Point(389500 + x, 5820000 - z)) for x, _, z in ring)
