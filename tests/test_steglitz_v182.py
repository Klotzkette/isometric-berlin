"""Source ownership and bounded Steglitz artifact invariants."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_steglitz_v182 import native_blocks, world  # noqa: E402


def test_steglitz_exclusions_only_replace_complete_owned_buildings() -> None:
  exclusion = json.loads(
    (ROOT / "geo_data/regierungsviertel/steglitz-v182-exclusions.geojson").read_text()
  )
  evidence = json.loads(
    (ROOT / "src/app/src/data/steglitzV182Evidence.json").read_text()
  )
  owners = {r["id"] for r in evidence["owners"]}
  assert len(exclusion["features"]) == 9
  for feature in exclusion["features"]:
    assert shape(feature["geometry"]).is_valid
    p = feature["properties"]
    assert p["sourceIds"]
    assert any(source in owners for source in p["sourceIds"])
    assert shape(feature["geometry"]).bounds[0] > 13.31
    assert shape(feature["geometry"]).bounds[2] < 13.34
  assert sum(o.get("parts", 0) for o in evidence["owners"]) == 71
  assert len([o for o in evidence["owners"] if o["id"] == "way/775632534"]) == 1


def test_steglitz_native_batch_retains_the_exact_occupied_cube_union() -> None:
  source = {
    "surfaces": [
      {
        "color": 123,
        "triangles": [
          [[0, 1, 0], [8, 1, 0], [8, 1, 8]],
          [[0, 1, 0], [8, 1, 8], [0, 1, 8]],
        ],
      }
    ],
    "boxes": [],
    "rods": [],
  }
  blocks = native_blocks(source)
  occupied = set()
  for x, y, z, w, h, d, color in blocks:
    assert color == 123
    for ix in range(round(x - w / 2), round(x + w / 2)):
      for iy in range(round(y - h / 2), round(y + h / 2)):
        for iz in range(round(z - d / 2), round(z + d / 2)):
          assert (ix, iy, iz) not in occupied
          occupied.add((ix, iy, iz))
  assert occupied == {(x, 1, z) for x in range(9) for z in range(9)}
  assert len(blocks) == 1


def test_steglitz_local_projection_keeps_scene_frame() -> None:
  x, z = world(13.3203, 52.45585)
  assert -3650 < x < -3610 and 6910 < z < 6960
