"""The four complete Bebelplatz/HU envelopes retain metric source evidence."""

import json
import xml.etree.ElementTree as ET
from pathlib import Path

import geopandas as gpd
import pytest
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import load_bounds_polygon, project_to_berlin
from scripts.build_bebelplatz_building_source import ORIGIN, world_ring

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/app/src/bebelplatzBuildingSource.json"


def test_source_ring_preserves_millimetres_and_below_street_base() -> None:
  ring = ET.fromstring(
    "<posList>390994.135 5819863.489 28.755 "
    "391022.051 5819865.913 55.018 "
    "390994.135 5819863.489 28.755</posList>"
  )
  assert world_ring(ring) == [[1494.135, -1.245, 136.511], [1522.051, 25.018, 134.087]]


def test_all_requested_official_parts_and_surfaces_are_bounded() -> None:
  source = json.loads(SOURCE.read_text())
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  assert SOURCE.stat().st_size < 120_000
  assert source["license"] == "dl-de/zero-2-0"
  expected = {"humboldt": 1, "alteBibliothek": 1, "hotelDeRome": 10, "hedwig": 1}
  assert {key: len(p["parts"]) for key, p in source["profiles"].items()} == expected
  for profile in source["profiles"].values():
    assert profile["source_url"].startswith("https://gdi.berlin.de/data/a_lod2/")
    assert len(profile["source_sha256"]) == 64
    for part in profile["parts"]:
      footprint = Polygon(
        [(x + ORIGIN[0], ORIGIN[1] - z) for x, z in part["ring"]],
        [[(x + ORIGIN[0], ORIGIN[1] - z) for x, z in ring] for ring in part["holes"]],
      )
      assert footprint.is_valid
      assert bounds.covers(footprint)
      assert part["top_y_m"] - part["ground_y_m"] == pytest.approx(
        part["height_m"], abs=0.002
      )
      assert {surface["kind"] for surface in part["surfaces"]} == {
        "WallSurface",
        "RoofSurface",
      }
      for surface in part["surfaces"]:
        for ring in surface["rings"]:
          assert len(ring) >= 3
          assert all(
            part["ground_y_m"] - 0.002 <= p[1] <= part["top_y_m"] for p in ring
          )


def test_replaced_prisms_match_complete_official_envelopes_without_neighbours() -> None:
  source = json.loads(SOURCE.read_text())
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  by_id = {prism["id"]: prism for prism in prisms}
  for profile in source["profiles"].values():
    geometry = unary_union(
      [Polygon(part["ring"], part["holes"]) for part in profile["parts"]]
    )
    for prism_id in profile["replaced_osm_prism_ids"]:
      prism = by_id[prism_id]
      footprint = Polygon(
        [(x / 10, z / 10) for x, z in prism["ring"]],
        [[(x / 10, z / 10) for x, z in ring] for ring in prism["holes"]],
      )
      # Hedwig's older 16-sided OSM footprint overlaps 98.046%; the three
      # civic shells exceed 98.9%. This allows source alignment differences.
      assert geometry.intersection(footprint).area / footprint.area > 0.98
  # The smaller HU courtyard canopies are distinct and must not be swallowed.
  assert source["profiles"]["humboldt"]["replaced_osm_prism_ids"] == ["ion-6647"]


def test_bebelplatz_paving_retains_exact_mapped_sett_polygon_and_memorial_anchor() -> (
  None
):
  source = json.loads(SOURCE.read_text())["plaza_source"]
  roads = gpd.read_file(ROOT / "geo_data/regierungsviertel/osm.gpkg", layer="roads")
  original = roads[(roads["element"] == "way") & (roads["id"] == "205728152")].iloc[0]
  geometry = Polygon(
    [(x + ORIGIN[0], ORIGIN[1] - z) for x, z in source["ring"]],
    [[(x + ORIGIN[0], ORIGIN[1] - z) for x, z in ring] for ring in source["holes"]],
  )
  assert source["surface"] == original["surface"] == "sett"
  assert source["license"] == "ODbL-1.0"
  assert source["area_m2"] == pytest.approx(original.geometry.area, abs=0.001)
  assert original.geometry.hausdorff_distance(geometry) < 0.00071
  assert geometry.contains(Point(391018.9904098202, 5819700.051051586))
