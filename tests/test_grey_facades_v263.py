"""Bounded exact source-wall and previous-owner contracts for outer fittings."""

import numpy as np
from shapely.geometry import LineString

from scripts import build_district_facades_v188 as base
from scripts import build_grey_facades_v263 as build


def test_only_32_sampled_tiles_and_neighbours_are_read_and_packets_remain_exact():
  evidence = base.read_json(build.EVIDENCE)
  runtime = base.read_json(build.OUTPUT)
  assert len(evidence["sampled"]) == 32
  assert 20 <= len(runtime["packets"]) // 2 <= 32
  assert not set(evidence["sampled"]) & build.ROOF_TILES
  assert evidence["runtimeBytes"] < 128 * 1024
  assert base.digest(build.OUTPUT) == evidence["runtimeSha256"]
  for url, expected in evidence["inputs"].items():
    assert base.digest(build.OUT / url) == expected
  for key, plan in runtime["packets"].items():
    assert key.split(":")[1] in evidence["sampled"]
    assert len(plan["windows"]) <= (64 if key.startswith("minecraft:") else 96)
    assert plan["records"]


def test_exact_existing_street_walls_and_all_previous_fitting_owners_are_protected():
  evidence = base.read_json(build.EVIDENCE)
  excluded = build.protected_owners({"authoredIds": []})
  assert not {face["owner"] for face in evidence["faces"]} & excluded
  assert len({face["owner"] for face in evidence["faces"]}) == len(evidence["faces"])
  packets = {}
  for face in evidence["faces"]:
    if face["chunk"] not in packets:
      p = base.read_json(build.OUT / f"{face['chunk']}.drawn.json.gz")
      packets[face["chunk"]] = p, base.mesh_wall_triangles(p)
    p, triangles = packets[face["chunk"]]
    ox, oy, oz = p["origin"]
    assert base.source_wall_exists(
      triangles,
      np.array(face["a"]) - [ox, oz],
      np.array(face["b"]) - [ox, oz],
      face["low"] - oy,
      face["high"] - oy,
    )
    assert face["streetId"] and face["streetName"]
    assert face["windowCount"] > 0 and face["nativeWindowCount"] > 0
    for span in face["nativeSpans"]:
      a, b = span["a"], span["b"]
      assert a[0] == b[0] or a[1] == b[1]
      assert (
        LineString([a, b])
        .difference(LineString([face["a"], face["b"]]).buffer(1.601, cap_style=2))
        .length
        < 0.001
      )


def test_world_sample_is_spatially_distributed_and_per_tile_owner_budget_is_small():
  evidence = base.read_json(build.EVIDENCE)
  tiles = {f["chunk"] for f in evidence["faces"]}
  assert "-11_6" in tiles
  assert "ring182-9_6" in tiles
  assert any(tile.startswith("north190-") for tile in tiles)
  assert any(tile.startswith("east200-") for tile in tiles)
  for tile in tiles:
    assert sum(f["chunk"] == tile for f in evidence["faces"]) <= 8
  xs = [f["a"][0] for f in evidence["faces"]]
  zs = [f["a"][1] for f in evidence["faces"]]
  assert max(xs) - min(xs) > 23_000
  assert max(zs) - min(zs) > 14_000


def test_v262_tiles_owners_and_all_original_manifests_remain_separate():
  evidence = base.read_json(build.EVIDENCE)
  old = base.read_json(build.v262.EVIDENCE)
  old_runtime = base.read_json(build.v262.OUTPUT)
  new_runtime = base.read_json(build.OUTPUT)
  assert not set(new_runtime["packets"]) & set(old_runtime["packets"])
  assert not {f["owner"] for f in evidence["faces"]} & {
    f["owner"] for f in old["faces"]
  }
  for sector in build.SECTORS:
    assert sum(x == sector for x in evidence["sectors"].values()) == 4
  # All source hashes in both old and new evidence remain byte-exact.
  for url, expected in old["inputs"].items():
    assert base.digest(build.OUT / url) == expected
