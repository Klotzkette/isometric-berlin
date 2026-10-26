"""Bounded exact source-wall and previous-owner contracts for outer fittings."""

import json

import numpy as np
import pytest
from shapely.geometry import LineString

from scripts import build_district_facades_v188 as base
from scripts import build_grey_facades_v263 as grey
from scripts import build_outer_facades_v262 as build
from scripts import build_outer_materials_v232 as materials


@pytest.mark.parametrize("module", [build, grey, materials])
def test_colour_only_receipts_do_not_claim_fittings_but_authored_models_still_do(
  tmp_path, monkeypatch, module
):
  expected = {
    "src/app/src/data/coreHouseColoursV273.json",
    "src/app/src/data/legacyHouseMaterialsV273.json",
    "src/app/src/data/remainingAltMitteColoursV273.json",
    *(f"src/app/src/data/primaryColoursV273_{i:02d}.json" for i in range(32)),
  }
  assert build.COLOUR_ONLY_V273_FILES == expected
  colour_ids = set()
  for index, name in enumerate(sorted(expected)):
    path = tmp_path / name
    path.parent.mkdir(parents=True, exist_ok=True)
    owner = f"DEBEColourOnly{index}"
    colour_ids.add(owner)
    path.write_text(json.dumps({"owners": [owner]}))
  authored = {
    "src/app/src/data/steglitzWindowsV273.json": "DEBESchoolWindows",
    "src/app/src/data/namedBuildingV273.json": "DEBENamedModel",
    # A later bank or similarly named future file has no audited exemption.
    "src/app/src/data/primaryColoursV273_32.json": "DEBEUnauditedBank",
    "src/app/src/data/legacyHouseMaterialsV274.json": "DEBEFutureModel",
    "src/app/src/NamedDetails.ts": "DEBEAuthoredDetail",
    "src/app/src/NamedSource.json": "DEBESourceGeometry",
  }
  for name, owner in authored.items():
    path = tmp_path / name
    path.write_text(json.dumps({"owner": owner}))
  independently_authored = min(colour_ids)
  preserved = {
    "authoredIds": [independently_authored],
    "faces": [{"owner": "DEBEPreviousWindow"}],
    "owners": [{"owner": "DEBEPreviousRoof"}],
    "doors": [{"owner": "DEBEPreviousDoor"}],
  }
  monkeypatch.setattr(module, "ROOT", tmp_path)
  monkeypatch.setattr(base, "read_json", lambda _: preserved)
  # An independent authored identity still protects the same owner even when
  # it also appears in a colour receipt; skipping paint cannot erase ownership.
  protected = (
    module.protected_owners()
    if module is materials
    else module.protected_owners({"authoredIds": [independently_authored]})
  )
  assert protected == {
    *authored.values(),
    independently_authored,
    "DEBEPreviousWindow",
    *({"DEBEPreviousRoof", "DEBEPreviousDoor"} if module is not materials else set()),
  }
  assert not (colour_ids - {independently_authored}) & protected


def test_only_24_sampled_tiles_and_neighbours_are_read_and_packets_remain_exact():
  evidence = base.read_json(build.EVIDENCE)
  runtime = base.read_json(build.OUTPUT)
  assert len(evidence["sampled"]) == 24
  assert 12 <= len(runtime["packets"]) // 2 <= 24
  assert not set(evidence["sampled"]) & build.ROOF_TILES
  assert evidence["runtimeBytes"] < 64 * 1024
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
  assert "outer187-27_6" in tiles
  assert any(tile.startswith("north190-") for tile in tiles)
  assert any(tile.startswith("east200-") for tile in tiles)
  for tile in tiles:
    assert sum(f["chunk"] == tile for f in evidence["faces"]) <= 8
  xs = [f["a"][0] for f in evidence["faces"]]
  zs = [f["a"][1] for f in evidence["faces"]]
  assert max(xs) - min(xs) > 25_000
  assert max(zs) - min(zs) > 15_000
