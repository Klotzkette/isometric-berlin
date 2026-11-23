"""Audit the bounded site joins against both tree inventories and the original voxel rows."""

import gzip
import json
import math
from collections import Counter

from shapely import Point, STRtree, box

from scripts.build_mitte_canopy_v376 import (
  OUTPUT,
  PUBLIC,
  RECEIPT,
  SURVEY,
  build,
  encode,
  polygon,
  read,
)


def test_four_municipal_stands_regenerate_exactly():
  packet = build()
  assert encode(packet) + b"\n" == OUTPUT.read_bytes()
  assert [len(rows) for rows in packet["groups"]] == [19, 96, 181, 53]
  park = read(PUBLIC / "park-details.json")["trees"]
  survey = {r[1]: r for r in json.loads(gzip.decompress(SURVEY.read_bytes()))["rows"]}
  ids = json.loads(gzip.decompress(RECEIPT.read_bytes()))["groups"]
  for site, group in enumerate(packet["groups"]):
    official = STRtree([Point(survey[gid][2], survey[gid][3]) for gid, _ in ids[site]])
    for row in group:
      t = park[row[0]]
      x, _, z = t["position"]
      assert len(official.query(Point(x, z), predicate="dwithin", distance=0.05)) == 1
      if site == 0:
        assert row[1:] == [x, z, t["tr"], t["h"], 2 * t["cr"]]
      else:
        assert row[1:8] == [*t["position"], t["h"], t["cr"], t["tr"], t["v"]]


def test_native_cells_are_unique_and_all_19_square_trunks_have_clear_footprints():
  packet = read(OUTPUT)
  native = packet["native"]
  assert len(native) == len({(x, z) for _, x, z, _, _ in native}) == 234
  points = {r[0]: r for r in packet["groups"][0]}
  assert points.keys() <= {row[0] for row in native}
  surfaces = read(PUBLIC / "surface-polygons.json")
  masks = STRtree(
    [
      polygon(p, 0.1)
      for p in surfaces["roads"]
      + surfaces["water"]
      + read(PUBLIC / "lod2-prisms.json")["buildings"]
    ]
  )
  voxels = read(PUBLIC / "minecraft-voxels.json")
  grid = voxels["grid"]
  trees = read(PUBLIC / "park-details.json")["trees"]
  occupants = Counter(
    (math.floor(t["position"][0] / 4), math.floor(t["position"][2] / 4)) for t in trees
  )
  for index, cx, cz, base, h in native:
    assert occupants[cx, cz] == 1
    offset = cx - grid["min_x_idx"]
    columns = voxels["building_rows"][cz - grid["min_z_idx"]]
    assert not any(
      start <= offset < start + length and low < base + h and high > base
      for start, length, low, high, _ in columns
    )

    if index in points:
      _, x, z, r, _, _ = points[index]
    else:
      x, z, r = cx * 4 + 2, cz * 4 + 2, 0.9
    assert not masks.query(box(x - r, z - r, x + r, z + r), predicate="intersects").size
