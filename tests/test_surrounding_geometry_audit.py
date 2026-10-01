"""Independent geometry checks for the surrounding-city tile boundaries."""

from __future__ import annotations

import base64
import gzip
import json
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pytest
import shapely
from shapely.geometry import LineString, Point, Polygon, box, mapping
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import build_surrounding_outlines as exporter  # noqa: E402


def triangles(payload: dict) -> np.ndarray:
  """Decode delivered triangles into world metres, independently of the renderer."""
  result = []
  for mesh in payload["meshes"]:
    vertices = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
      -1, 3
    ) / 100 + np.array(payload["origin"])
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
      -1, 3
    )
    result.append(vertices[indices])
  return np.concatenate(result)


def plane_union(mesh: np.ndarray, y: float):
  """Union the actual horizontal triangles on one visible plane."""
  flat = mesh[np.all(np.abs(mesh[:, :, 1] - y) < 1e-7, axis=1)]
  return shapely.union_all(shapely.polygons(flat[:, :, [0, 2]]))


def four_tiles(buildings: list[dict], surfaces: dict) -> np.ndarray:
  result = []
  for x in (0, 512):
    for z in (0, 512):
      tile = box(x, z, x + 512, z + 512)
      result.append(
        triangles(
          exporter.chunk_payload(
            f"{x // 512}_{z // 512}", tile, tile, buildings, surfaces, minecraft=False
          )
        )
      )
  return np.concatenate(result)


def test_oblique_street_is_continuous_across_both_tile_axes() -> None:
  course = LineString([(460, 475), (512, 503), (575, 560)])
  road = course.buffer(5, cap_style="round", join_style="round", quad_segs=3)
  mesh = four_tiles([], {"road": road})
  delivered = plane_union(mesh, exporter.GROUND_Y + 0.09)
  # One-centimetre storage may move an edge by less than a pixel, never turn
  # the course into a tile-aligned zigzag or open a gap at either tile boundary.
  assert delivered.buffer(0.01).covers(course)
  assert delivered.boundary.hausdorff_distance(road.boundary) < 0.011
  assert delivered.symmetric_difference(road).area < road.length * 0.0075


def test_crossing_building_keeps_courtyard_and_no_invented_interior_walls() -> None:
  building = Polygon(
    [(450, 450), (550, 450), (550, 550), (450, 550)],
    holes=[[(480, 480), (520, 480), (520, 520), (480, 520)]],
  )
  height = 20
  mesh = four_tiles(
    [
      {
        "geometry": building,
        "sourceId": "crossing-building",
        "height": height,
        "minHeight": 0,
        "heightSource": "fixture",
      }
    ],
    {},
  )
  roof = plane_union(mesh, exporter.GROUND_Y + height)
  assert roof.symmetric_difference(building).area < 1e-9
  vertical = mesh[np.ptp(mesh[:, :, 1], axis=1) > 1]
  for axis in (0, 2):
    assert not np.all(np.abs(vertical[:, :, axis] - 512) < 1e-7, axis=1).any()
  wall_areas = (
    np.linalg.norm(
      np.cross(vertical[:, 1] - vertical[:, 0], vertical[:, 2] - vertical[:, 0]), axis=1
    )
    / 2
  )
  assert wall_areas.sum() == pytest.approx(building.length * height)


def test_water_datum_island_and_bridge_survive_the_chunk_cut() -> None:
  water = Polygon(
    [(490, 470), (590, 470), (590, 570), (490, 570)],
    holes=[[(535, 520), (550, 520), (550, 535), (535, 535)]],
  )
  bridge = box(475, 490, 610, 500)
  mesh = four_tiles([], {"water": water, "road": bridge, "bridge": bridge})
  assert exporter.WATER_Y == -1.15
  assert plane_union(mesh, -1.15).symmetric_difference(water).area < 1e-9
  ground = plane_union(mesh, exporter.GROUND_Y)
  assert ground.intersection(water).area < 1e-9
  assert ground.covers(Point(540, 525))  # Mapped island stays dry.
  assert plane_union(mesh, exporter.GROUND_Y + 0.09).covers(bridge)
  banks = mesh[np.ptp(mesh[:, :, 1], axis=1) > 1]
  assert not np.all(np.abs(banks[:, :, 0] - 512) < 1e-7, axis=1).any()
  tile = box(512, 0, 1024, 512)
  chunk = exporter.chunk_payload(
    "1_0", tile, tile, [], {"water": water, "bridge": bridge}, minecraft=False
  )
  saved_bridge = unary_union(
    [Polygon(p["ring"], p["holes"]) for p in chunk["nav"]["bridges"]]
  )
  assert saved_bridge.covers(Point(530 - 512, 495))


def test_minecraft_shores_and_bridge_navigation_match_actual_block_surfaces() -> None:
  tile = box(0, 0, 512, 512)
  water = Polygon([(30.2, 30.1), (90.9, 40.3), (90, 90), (30.2, 90)])
  bridge = LineString([(20, 45), (105, 65)]).buffer(3)
  chunk = exporter.chunk_payload(
    "0_0",
    tile,
    tile,
    [],
    {"water": water, "road": bridge, "bridge": bridge},
    minecraft=True,
  )
  mesh = triangles(chunk)
  saved = {
    kind: unary_union([Polygon(p["ring"], p["holes"]) for p in chunk["nav"][kind]])
    for kind in ("water", "bridges", "roads")
  }
  actual_water = plane_union(mesh, exporter.WATER_Y)
  actual_bridge = plane_union(mesh, exporter.GROUND_Y + 0.09)
  assert saved["water"].symmetric_difference(actual_water).area < 1e-9
  assert saved["bridges"].symmetric_difference(actual_bridge).area < 1e-9
  assert saved["roads"].symmetric_difference(actual_bridge).area < 1e-9
  # The deliberately block-native shore must differ from the smooth source;
  # this makes the test sensitive to accidentally publishing smooth nav data.
  assert actual_water.symmetric_difference(water).area > 1


@pytest.mark.parametrize("minecraft", [False, True])
def test_far_view_land_surfaces_do_not_stack_nearly_coplanar_plates(
  minecraft: bool,
) -> None:
  tile = box(0, 0, 512, 512)
  surfaces = {
    "park": box(20, 20, 200, 200),
    "road": box(80, 0, 100, 220),
    "path": box(0, 80, 220, 90),
    "rail": box(90, 10, 96, 210),
  }
  chunk = exporter.chunk_payload("0_0", tile, tile, [], surfaces, minecraft=minecraft)
  mesh = triangles(chunk)
  planes = [plane_union(mesh, 3 + level) for level in (0, 0.01, 0.09, 0.12, 0.15)]
  assert unary_union(planes).symmetric_difference(tile).area < 1e-9
  for index, plane in enumerate(planes):
    for other in planes[index + 1 :]:
      assert plane.intersection(other).area < 1e-9
  # Removing hidden display overlap must preserve the full source walking
  # route even where a railway/footpath is the top visible land surface.
  navigation = unary_union(
    [Polygon(p["ring"], p["holes"]) for p in chunk["nav"]["roads"]]
  )
  assert (
    navigation.symmetric_difference(surfaces["road"].union(surfaces["path"])).area
    < 1e-9
  )


def test_actual_export_retains_road_under_elevated_building(
  tmp_path, monkeypatch
) -> None:
  bounds = tmp_path / "bounds.json"
  core = tmp_path / "core.json"
  bounds.write_text(json.dumps(mapping(box(389500, 5819900, 389600, 5820000))))
  core.write_text(json.dumps(mapping(box(389500, 5819900, 389510, 5820000))))
  pbf = tmp_path / "fixture.pbf"
  pbf.write_bytes(b"fixture")
  areas = gpd.GeoDataFrame(
    [
      {
        "osm_way_id": "elevated",
        "building": "yes",
        "other_tags": '"min_height"=>"10","height"=>"20"',
        "geometry": box(389530, 5819940, 389550, 5819960),
      }
    ],
    crs=25833,
  )
  lines = gpd.GeoDataFrame(
    [
      {
        "osm_id": "passage",
        "highway": "residential",
        "name": "Mapped passage",
        "other_tags": '"width"=>"6"',
        "geometry": LineString([(389520, 5819950), (389590, 5819950)]),
      }
    ],
    crs=25833,
  )
  monkeypatch.setattr(exporter, "read_source_frames", lambda *_: (lines, areas))
  monkeypatch.setattr(exporter, "official_buildings", lambda *_: ([], []))
  output = tmp_path / "chunks"
  manifest = exporter.build(
    bounds_path=bounds, core_path=core, pbf=pbf, lod2_dir=tmp_path, output=output
  )
  name = manifest["chunks"][0]["drawn"]["url"]
  raw = (output / name).read_bytes()
  chunk = json.loads(gzip.decompress(raw) if name.endswith(".gz") else raw)
  road = plane_union(triangles(chunk), exporter.GROUND_Y + 0.09)
  assert road.covers(Point(40, 50))
  assert chunk["nav"]["buildings"][0]["minHeight"] == 10
