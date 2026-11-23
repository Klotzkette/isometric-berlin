"""The selection must not confuse tile pieces, stacked parts or winding with buildings."""

import hashlib
import json

from shapely.geometry import box

from scripts import build_windowless_buildings_v377 as buildings


def test_fragment_volume_and_hole():
  # A duplicate from a companion tile, two touching halves and a raised floor.
  left, right = box(0, 0, 5, 10), box(5, 0, 10, 10)
  garden = box(6, 1, 8, 3)
  body = right.difference(garden)
  rows = [({}, left, 3, 9), ({}, left, 3, 9), ({}, body, 3, 9), ({}, body, 7, 12)]
  outline, vol, height = buildings.vertical_union(rows)
  assert outline.area == 96
  assert vol == 50 * 6 + 46 * 9
  assert height == 9
  assert not outline.covers(garden.representative_point())


def test_complete_ranking_and_split_native_guards():
  data = json.loads(buildings.OUTPUT.read_bytes())
  targets = data["targets"]
  assert len(targets) == len({r["id"] for r in targets}) == 50
  assert [r["modeledVolumeM3"] for r in targets] == sorted(
    (r["modeledVolumeM3"] for r in targets), reverse=True
  )
  assert data["cutoffM3"] == targets[-1]["modeledVolumeM3"]
  assert all(
    {s["family"] for s in r["segments"]} == {"drawn", "minecraft"} for r in targets
  )
  split = {
    (s["tile"], s["family"], s["tileSha256"])
    for r in targets
    for s in r["segments"]
    if "navTile" in s
  }
  assert split
  for tile, family, digest in split:
    archive = buildings.OUT / buildings.tile_descriptors()[tile][family]["url"]
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == digest
