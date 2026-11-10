"""Ground and roof checks on the actual complete V330 Kienberg source."""

import json
from functools import partial
from math import hypot
from pathlib import Path

import pytest
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union

from scripts.kienberg_landmarks_v330 import (
  build_kienberg_landmarks,
  cabin_poses,
  cross,
  ground_shape,
  ropeway_tracks,
  sub,
)
from scripts.marzahn_garden_terrain_v330 import ground_at, load_terrain, terrain_height

GEO = Path(__file__).resolve().parents[1] / "geo_data/regierungsviertel"


@pytest.fixture(scope="module")
def source():
  return json.loads((GEO / "kienberg-landmarks-v330-source.json").read_text())


def test_complete_measured_families_and_current_osm_routes(source):
  assert len(source["stations"]) == 3
  assert (
    sum(
      len(family["parts"])
      for station in source["stations"]
      for family in station["family"]
    )
    == 13
  )
  assert len(set(source["ownedLod2Ids"])) == 11
  families = {station["way"]: station["family"] for station in source["stations"]}
  families["way/718931740"] = source["wolkenhain"]["lod2"]
  for identity, area in source["ownedAreas"].items():
    assert area["lod2Ids"] == [family["id"] for family in families[identity]]
    measured = unary_union(
      [ground_shape(part) for family in families[identity] for part in family["parts"]]
    )
    assert shape(area["geometry"]).equals(measured)
  sections = source["ropeway"]["segments"]
  assert [section["id"] for section in sections] == ["way/654590808", "way/335201546"]
  assert sections[0]["anchors"][-1] == sections[1]["anchors"][0]
  pylon_ids = {
    a["id"] for section in sections for a in section["anchors"] if a["pylon"]
  }
  assert len(pylon_ids) == 9
  tracks = ropeway_tracks(source)
  poses = cabin_poses(tracks, source["ropeway"]["cabinCount"])
  assert len(poses) == len({p for p, _ in poses}) == 64
  assert all(abs(hypot(*h) - 1) < 1e-12 for _, h in poses)
  assert max(len(track) for track in tracks) < 200


@pytest.mark.parametrize("native", [False, True])
def test_actual_terrain_keeps_open_cloud_and_all_mapped_pylons(source, native):
  terrain = load_terrain(GEO / "marzahn-garden-terrain-v330-source.json.gz")
  triangles, solids = build_kienberg_landmarks(
    source, partial(ground_at, terrain, native=native), native
  )
  assert 15_000 < len(triangles) < 80_000
  assert all(
    area.is_valid and area.area > 0 and height > 0 for _, area, _, height in solids
  )
  normals = [cross(sub(t[1], t[0]), sub(t[2], t[0])) for t, _ in triangles]
  assert all(any(abs(value) > 1e-8 for value in normal) for normal in normals)
  if native:
    assert all(sum(abs(value) > 1e-8 for value in normal) == 1 for normal in normals)
  by_id = {identity: (area, low, height) for identity, area, low, height in solids}
  for section in source["ropeway"]["segments"]:
    for a in section["anchors"]:
      if not a["pylon"]:
        continue
      area, low, height = by_id[a["id"]]
      assert area.contains(Point(a["x"], a["z"]))
      supported = ground_at(terrain, a["x"], a["z"], native=native)
      assert low == (a["groundNhn"] - 30 if supported is None else supported)
      assert low + height == pytest.approx(a["ropeY"] - 0.30)
  part = source["wolkenhain"]["lod2"][0]["parts"][0]
  original = ground_shape(part)
  assert len(original.interiors) == 1
  hole = Polygon(original.interiors[0]).representative_point()
  deck, low, thickness = by_id[part["id"] + "-deck"]
  assert deck.area > 300 and not deck.covers(hole)
  assert low > 86 and thickness < 1
  assert part["id"] not in by_id  # No false filled tower from the LoD2 ground shell.
  for (x, y, z), _ in cabin_poses(ropeway_tracks(source), 64):
    assert y - 3.05 > terrain_height(terrain, x, z, native)
