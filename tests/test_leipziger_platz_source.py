"""The Mall refinement must preserve complete source envelopes and source identity."""

import json
from pathlib import Path

import geopandas as gpd
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / "src/app/src/leipzigerPlatzSource.json").read_text())


def test_leipziger_source_keeps_every_official_parent_part():
  buildings = gpd.read_file(ROOT / "geo_data/regierungsviertel/buildings.gpkg")
  assert len(SOURCE["profiles"]) == 17
  for profile in SOURCE["profiles"].values():
    parent = buildings[
      (buildings.parent_building_id == profile["parent_id"])
      | (buildings.building_id == profile["parent_id"])
    ]
    assert {p["id"] for p in profile["parts"]} == set(parent.building_id)
    expected = unary_union(parent.geometry)
    actual = unary_union(
      [
        Polygon(
          [(x + 389500, 5820000 - z) for x, z in part["ring"]],
          [[(x + 389500, 5820000 - z) for x, z in hole] for hole in part["holes"]],
        )
        for part in profile["parts"]
      ]
    )
    assert actual.symmetric_difference(expected).area < 0.0001


def test_leipziger_source_archives_original_delivered_prisms():
  payload = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  old = {p["id"]: p for p in payload["buildings"]}
  for profile in SOURCE["profiles"].values():
    assert len(profile["source_sha256"]) == 64
    for prism in profile["previous_display_prisms"]:
      assert prism == old[prism["id"]]
    for part in profile["parts"]:
      assert any(s["kind"] == "RoofSurface" for s in part["surfaces"])
      # Both official entrance canopies are roof-only sheets, open below.
      assert part["id"] in {"DEBE3DP5ii5cXk3Q", "DEBE3DO5h4MjCoj2"} or any(
        s["kind"] == "WallSurface" for s in part["surfaces"]
      )
