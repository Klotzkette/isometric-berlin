"""Checks for the bounded Three.js park-detail payload."""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
from shapely.geometry import LineString, MultiLineString

from isometric_berlin.generation.build_park_details import (
  compact_trees,
  expand_trees,
  light_band_runs,
  path_material_code,
)
from isometric_berlin.generation.road_geometry import road_width_m

PAYLOAD = Path("src/app/public/mesh/regierungsviertel/park-details.json")
OSM = Path("geo_data/regierungsviertel/osm.gpkg")
SCENE = Path("src/app/public/mesh/regierungsviertel/scene.json")


def payload_trees(payload: dict) -> list[dict]:
  return expand_trees(payload["trees"], payload["tree_vocabulary"])


def test_close_path_material_codes_keep_mapped_surface_distinctions() -> None:
  assert path_material_code({"surface": "sett"}, "footway", True) == "c"
  assert path_material_code({"surface": "cobblestone"}, "path", True) == "c"
  assert path_material_code({"surface": "fine_gravel"}, "footway", True) == "f"
  assert path_material_code({"surface": "compacted"}, "footway", True) == "g"
  assert path_material_code({"surface": "sand"}, "footway", True) == "s"
  assert path_material_code({"surface": "dirt"}, "path", True) == "e"
  assert path_material_code({"surface": None, "informal": "yes"}, "path", True) == "e"
  assert path_material_code({"surface": None}, "path", True) == "g"


def test_compact_tree_encoding_round_trips() -> None:
  # The wire form is only allowed to be smaller, never lossy: the task-09
  # bounds triple the official catalogue points, so every byte saved here is
  # what keeps the payload inside its budget.
  trees = [
    {
      "id": "a",
      "source": "berlin_official",
      "catalogue": "strassenbaum",
      "position": [1.0, 2.0, 3.0],
      "height_m": 7.0,
      "height_measured": True,
      "crown_radius_m": 2.0,
      "crown_measured": False,
      "trunk_radius_m": 0.12,
      "leaf_type": None,
      "species": "Spitz-Ahorn",
      "tree_group": "Laubbäume",
      "variant": 2,
      "osm_evidence_ids": ["12077445781"],
    },
    {
      "id": "b",
      "source": "osm",
      "position": [4.0, 5.0, 6.0],
      "height_m": 9.8,
      "crown_radius_m": 3.33,
      "trunk_radius_m": 0.317,
      "leaf_type": "broadleaved",
      "species": None,
      "tree_group": None,
      "variant": 1,
    },
  ]
  compact, vocabulary = compact_trees(trees)
  assert vocabulary["source"] == ["berlin_official", "osm"]
  assert "leaf_type" not in compact[0]
  assert compact[0]["i"] == "a"
  restored = expand_trees(compact, vocabulary)
  assert restored[0]["species"] == "Spitz-Ahorn"
  assert restored[0]["height_measured"] is True
  assert restored[1]["leaf_type"] == "broadleaved"
  for original, back in zip(trees, restored, strict=True):
    kept = {
      key: value
      for key, value in original.items()
      if not (value is None or value is False or value == [])
    }
    assert back == kept


def test_park_detail_payload_is_compact_and_specific() -> None:
  assert PAYLOAD.exists()
  # The additional task-13 ring contributes real paths, trees and lights; the
  # compact schema keeps all of them under a measured 6 MiB browser budget.
  assert PAYLOAD.stat().st_size < 6 * 1024 * 1024
  raw = PAYLOAD.read_text(encoding="utf-8")
  assert "NaN" not in raw
  payload = json.loads(raw)

  assert payload["schema_version"] == 7
  assert payload["source"]["attribution"] == (
    "© OpenStreetMap contributors · Geoportal Berlin (dl-de/zero-2-0)"
  )
  assert len(payload["paths"]) >= 1_500
  assert len(payload["trees"]) >= 20_000
  assert payload["tree_fusion"]["official"] >= 20_000
  assert payload["tree_fusion"]["osm_matched"] >= 1_800
  assert len(payload["street_lights"]) >= 3_500
  assert len(payload["wall_traces"]) >= 2
  assert len(payload["playgrounds"]) >= 5
  assert all(len(path["points"]) >= 2 for path in payload["paths"])
  assert {path["m"] for path in payload["paths"]} == {
    "a",
    "c",
    "e",
    "f",
    "g",
    "m",
    "p",
    "s",
    "w",
  }
  # Schema 7 preserves the resolved full width in centimetres. This includes
  # source values such as 3.75 m without the former half-decimetre rounding.
  assert all(40 <= path["w"] <= 6_000 for path in payload["paths"])
  assert all("name" not in path for path in payload["paths"] if not path.get("name"))
  trees = payload_trees(payload)
  assert all(1.5 <= tree["height_m"] <= 40 for tree in trees)
  assert max(tree["height_m"] for tree in trees) == 35
  assert max(tree["crown_radius_m"] for tree in trees) >= 12.5
  assert max(tree["trunk_radius_m"] for tree in trees) > 0.9
  assert any(tree["crown_radius_m"] == 12.5 for tree in trees)
  assert any(tree["trunk_radius_m"] == 1.426 for tree in trees)
  assert max(tree["position"][1] for tree in trees) < 8
  assert max(light["position"][1] for light in payload["street_lights"]) < 8


def test_park_paths_preserve_every_committed_source_vertex_width_and_part() -> None:
  """The close ribbons may style OSM evidence, never simplify or reroute it."""
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  actual = {path["id"]: path for path in payload["paths"]}
  roads = gpd.read_file(OSM, layer="roads").to_crs(25833)
  parks = gpd.read_file(OSM, layer="parks").to_crs(25833)
  origin_easting, origin_northing, _ = json.loads(SCENE.read_text(encoding="utf-8"))[
    "origin_epsg25833"
  ]
  candidates = roads[
    roads["highway"].isin(
      {"bridleway", "cycleway", "footway", "path", "pedestrian", "steps", "track"}
    )
  ]
  spatial_index = parks.sindex
  expected_ids: set[str] = set()
  for _, row in candidates.sort_values(["id", "highway"]).iterrows():
    area_indexes = spatial_index.query(row.geometry, predicate="intersects")
    if len(area_indexes) == 0:
      continue
    clipped = row.geometry.intersection(parks.iloc[area_indexes].geometry.union_all())
    if isinstance(clipped, LineString):
      parts = [clipped]
    elif isinstance(clipped, MultiLineString):
      parts = list(clipped.geoms)
    else:
      parts = []
    for part_index, line in enumerate(parts):
      if line.length < 2.5:
        continue
      identifier = f"{row['id']}:{part_index}"
      expected_ids.add(identifier)
      path = actual[identifier]
      expected_xz = [
        [round(x - origin_easting, 2), round(origin_northing - y, 2)]
        for x, y in line.coords
      ]
      assert [[point[0], point[2]] for point in path["points"]] == expected_xz
      assert path["w"] == round((road_width_m(row) or 1.35) * 100)
      assert path["m"] == path_material_code(row, str(row["highway"]), True)
  assert set(actual) == expected_ids


def test_known_mapped_tiergarten_desire_paths_are_not_dropped() -> None:
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  by_way = {path["id"].split(":")[0]: path for path in payload["paths"]}
  # These committed ways are part of the current OSM informal=yes network and
  # also carry explicit dirt/ground/grass/earth surface evidence. No inferred
  # connector or approximate location is accepted as a substitute.
  mapped_desire_paths = {
    "117863786",
    "121339622",
    "355800319",
    "625921356",
    "671588154",
    "671588155",
    "828020122",
    "899609933",
    "1225011790",
    "1225011791",
    "1280708301",
    "1413319007",
    "1416110227",
    "1429783846",
    "1442579046",
  }
  assert mapped_desire_paths <= set(by_way)
  assert all(by_way[identifier]["m"] == "e" for identifier in mapped_desire_paths)

  # These seven additional Tiergarten paths are explicitly informal in the
  # same committed OSM snapshot but intentionally have no surface tag. The
  # canonical GeoPackage must retain `informal=yes` for the earth fallback to
  # remain reachable after a real pipeline export.
  mapped_unsurfaced_desire_paths = {
    "1417732146",
    "1418066649",
    "1422873758",
    "1422873777",
    "1429526609",
    "1462063188",
    "1462081649",
  }
  assert mapped_unsurfaced_desire_paths <= set(by_way)
  assert all(
    by_way[identifier]["m"] == "e" for identifier in mapped_unsurfaced_desire_paths
  )


def test_tiergarten_scrub_and_hedges_remain_source_bounded() -> None:
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  source = payload["sources"]["tiergarten_vegetation"]
  assert source["available"] is True
  assert source["license"] == "ODbL-1.0"
  assert source["park_relation_url"].endswith("/relation/7643526")
  assert source["metrics"] == {
    "hedge_area_count": 2,
    "hedge_area_m2": 526.8,
    "hedge_line_count": 21,
    "hedge_line_length_m": 1099.2,
    "scrub_area_count": 83,
    "scrub_area_m2": 106628.5,
  }
  assert len(payload["shrub_patches"]) == 83
  assert sum(len(patch["clusters"]) for patch in payload["shrub_patches"]) == 3535
  assert len(payload["hedges"]) == 23
  lines = [hedge for hedge in payload["hedges"] if hedge["kind"] == "line"]
  areas = [hedge for hedge in payload["hedges"] if hedge["kind"] == "area"]
  assert len(lines) == 21
  assert len(areas) == 2
  assert round(sum(hedge["length_m"] for hedge in lines), 1) == 1099.2
  assert round(sum(hedge["area_m2"] for hedge in areas), 1) == 526.8
  assert {hedge["source_url"].rsplit("/", 1)[-1] for hedge in areas} == {
    "120583843",
    "121797064",
  }
  assert all("openstreetmap.org/way/" in hedge["source_url"] for hedge in lines)
  assert all(
    "Display dimensions" in hedge["dimensions_status"] for hedge in payload["hedges"]
  )


def test_paths_cover_spreebogen_futurium_and_nordhafen_parks() -> None:
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  assert "all bounded OSM park areas" in payload["source"]["geometry_status"]
  assert any(path.get("name") == "Ludwig-Erhard-Ufer" for path in payload["paths"])

  def reaches(x_min: float, x_max: float, z_min: float, z_max: float) -> bool:
    return any(
      x_min <= point[0] <= x_max and z_min <= point[2] <= z_max
      for path in payload["paths"]
      for point in path["points"]
    )

  assert reaches(-90, 30, -500, -370), "Spreebogen / Gustav-Heinemann approach"
  assert reaches(150, 270, -650, -500), "Futurium public realm"
  assert reaches(-650, -350, -2_000, -1_650), "Nordhafenpark"


def test_light_band_runs_separate_balustrades_from_masts() -> None:
  # A run only counts as continuous lighting when the points are dense and
  # connected; a pair of masts on a crossing must stay a pair of masts.
  balustrade = [[0.0, 0.0, float(index) * 1.6] for index in range(12)]
  mast_pair = [[40.0, 0.0, 0.0], [40.0, 0.0, 3.0]]
  loner = [[80.0, 0.0, 0.0]]
  runs = light_band_runs(balustrade + mast_pair + loner)
  assert runs == [list(range(12))]


def test_bridge_balustrade_lighting_is_not_drawn_as_masts() -> None:
  # The Geoportal records the Gustav-Heinemann-Brücke handrails as 99 points
  # at 1.6 m spacing. Drawn as 6.8 m masts they became a picket fence beside
  # the deck, so the exporter demotes connected runs to handrail luminaires.
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  bands = [
    light
    for light in payload["street_lights"]
    if light.get("installation") == "light_band"
  ]
  assert len(bands) >= 150
  assert all(light["height_m"] < 1.5 for light in bands)
  heinemann = [
    light
    for light in bands
    if -500 < light["position"][2] < -390 and light["position"][0] < 0
  ]
  assert len(heinemann) >= 90
  # A balustrade is level, so the whole run sits at one height.
  levels = {round(light["position"][1], 2) for light in heinemann}
  assert max(levels) - min(levels) < 0.5


def test_luiseninsel_playground_retains_mapped_equipment() -> None:
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  playground = next(
    item for item in payload["playgrounds"] if item["id"].startswith("24911694:")
  )
  assert playground["name"] == "Spielplatz an der Luiseninsel"
  assert playground["surface"] == "sand"
  kinds = {item["kind"] for item in playground["equipment"]}
  assert {
    "basketswing",
    "climbingframe",
    "excavator",
    "sandpit",
    "slide",
    "structure",
    "swing",
    "water",
  } <= kinds
  ground_heights = [point[1] for point in playground["outline"]]
  ground_heights.extend(item["position"][1] for item in playground["equipment"])
  assert max(ground_heights) - min(ground_heights) < 1
