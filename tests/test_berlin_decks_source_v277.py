"""Offline replay, full-precision footprints and retained Berlin Decks evidence."""

from __future__ import annotations

import copy
import hashlib
import json
import math

import pytest
from shapely.geometry import Polygon
from shapely.ops import unary_union

from scripts import build_berlin_decks_source_v277 as builder


@pytest.fixture(scope="module")
def source():
  return builder.load()


def test_offline_replay_rebuilds_identical_parts_without_reading_old_parts(source):
  before = copy.deepcopy(source)
  inputs = copy.deepcopy(source)
  inputs["parts"] = [{"unusableOldOutput": True}]
  replay = builder.rebuild(inputs)
  assert len(replay["parts"]) == 32
  assert replay == before
  assert source == before
  assert inputs["parts"] == [{"unusableOldOutput": True}]
  assert {k: v for k, v in replay.items() if k != "parts"} == {
    k: v for k, v in inputs.items() if k != "parts"
  }


def test_every_original_and_mapped_footprint_piece_survives_at_full_precision(source):
  replay = builder.rebuild(source)
  parts = replay["parts"]
  assert len({p["id"] for p in parts}) == len(parts)
  assert all(Polygon(p["ring"], p["holes"]).is_valid for p in parts)
  for original in source["originalPrisms"]:
    owner = original["id"]
    old = builder.original_polygon(original)
    mapped = Polygon(source["osm"][builder.OWNER_OSM[owner]]["ring"])
    own_parts = [p for p in parts if p["sourceId"] == owner]
    rendered = unary_union([Polygon(p["ring"], p["holes"]) for p in own_parts])
    assert rendered.symmetric_difference(old.union(mapped)).area < 1e-8
    old_only = [p for p in own_parts if p["id"].startswith("retained-original-edge-")]
    assert old_only
    remnants = unary_union([Polygon(p["ring"], p["holes"]) for p in old_only])
    assert remnants.symmetric_difference(old.difference(mapped)).area < 1e-8
    assert {p["top_y_m"] for p in old_only} == {
      (original["y0_dm"] + original["h_dm"]) / 10
    }
  # A real regression receipt: a millimetre round-trip destroys these three
  # rings. Preserve even the tiny components, not only visually large roofs.
  lossy_invalid = {
    p["id"]
    for p in parts
    if not Polygon(
      [(round(x, 3), round(z, 3)) for x, z in p["ring"]],
      [[(round(x, 3), round(z, 3)) for x, z in ring] for ring in p["holes"]],
    ).is_valid
  }
  assert lossy_invalid == {f"building1-main-{index}" for index in range(3)}
  assert len([p for p in parts if p["id"].startswith("building1-main-")]) == 4
  assert min(Polygon(p["ring"], p["holes"]).area for p in parts) < 1e-8


def test_exact_owner_scope_preserves_excluded_bridge_and_construction_evidence(source):
  assert [p["id"] for p in source["originalPrisms"]] == list(builder.OWNER_OSM)
  assert {p["sourceId"] for p in source["parts"]} == set(builder.OWNER_OSM)
  assert source["unchangedConstructionPrism"] == "64895468"
  bridges = {
    key
    for key, record in source["osm"].items()
    if record["tags"].get("building") == "bridge"
  }
  assert bridges == {"1564406051", "1564406052"}
  assert not {key[-8:] for key in bridges}.intersection(builder.OWNER_OSM)
  assert len(source["osm"]) == 32
  assert len(source["references"]) == 6
  assert source["limits"].startswith("OSM footprint + summer 2025 1m bDOM roof planes")
  assert "not measured LoD2 faces" in source["limits"]
  assert (
    "Internal roof-step boundaries and facade openings are estimates"
    in source["limits"]
  )
  # Pin the retained evidence independently of derived parts and gzip headers.
  evidence = {k: v for k, v in source.items() if k != "parts"}
  assert hashlib.sha256(
    json.dumps(evidence, separators=(",", ":")).encode()
  ).hexdigest() == ("603fa3577c1eae5fcd7f70621231011eebd9a487890b294f6c24a6d688d28bc7")


def test_official_height_grid_is_complete_but_not_claimed_as_measured_roof_steps(
  source,
):
  grid = source["bdomGrid"]
  assert grid["archiveSha256"] == (
    "6dafc3a4e3eb8b417362a9909f717e6a94eab8e147f0a28377ebe14e95fe8fd4"
  )
  assert grid["archiveBytes"] == 20101842
  assert grid["sourceUrl"] == "https://gdi.berlin.de/data/bdom/atom/388_5822.zip"
  assert grid["acquisition"] == "summer 2025"
  assert grid["license"] == "dl-de/zero-2-0"
  assert grid["bounds"] == [388145, 5822085, 388355, 5822250]
  rows = grid["rows"]
  assert len(rows) == 210 * 165
  assert all(len(row) == 3 and all(math.isfinite(v) for v in row) for row in rows)
  points = {(x, z): nhn for x, z, nhn in rows}
  expected = {
    (easting + 0.5 - 389500, 5820000 - (northing + 0.5))
    for easting in range(388145, 388355)
    for northing in range(5822085, 5822250)
  }
  assert len(points) == len(rows)
  assert set(points) == expected
  for x, z, height in source["datum"]["groundSamples"]:
    assert points[x, z] == height
  assert source["datum"]["sourceGroundNhn"] == 36.0
  assert source["datum"]["displayGround"] == 5.2
  samples = source["bdomSamples"]
  assert samples["source"] == "https://gdi.berlin.de/services/wms/bdom"
  assert samples["layer"] == "b_bdom"
  assert samples["license"] == grid["license"]
  assert len(samples["samples"]) == 67
  for sample in samples["samples"]:
    assert sample["id"] in source["osm"]
    assert sample["url"].startswith(samples["source"] + "?")
    assert math.isfinite(sample["NHN"])
  for part in source["parts"]:
    assert part["top_y_m"] == pytest.approx(
      part["roofNhn"] - source["datum"]["sourceGroundNhn"] + 5.2, abs=1e-9
    )
  assert "internal step boundary estimated" in source["parts"][0]["method"]
  assert "representative display planes" in builder.__doc__


def test_two_low_roof_corrections_use_their_own_measured_grid_and_keep_other_parts(
  source,
):
  original = copy.deepcopy(source)
  expected = {
    "building2-complement-2-0": (31, 11, 45.38, 45.4, 14.6),
    "building2-complement-3-0": (74, 43, 45.26, 45.3, 14.5),
  }
  for part in original["parts"]:
    if part["id"] not in expected:
      continue
    count, mode_count, mode_median, height, display_top = expected[part["id"]]
    evidence = builder.low_roof_evidence(
      Polygon(part["ring"], part["holes"]), source["bdomGrid"]["rows"]
    )
    assert evidence["interiorSamples"] == count
    assert evidence["modeSamples"] == mode_count
    assert evidence["modeMedianNhn"] == mode_median
    assert evidence["roofNhn"] == part["roofNhn"] == height
    assert part["top_y_m"] == display_top
    assert part["facadeStoreys"] == 2
    assert "using raster points 1m inside the footprint" in part["method"]
    part.update(
      roofNhn=53.8,
      top_y_m=23.0,
      facadeStoreys=4,
      method="Mapped building footprint complement with bDOM-supported roof plane; "
      "unmeasured roof plant excluded.",
    )
  # Revert only the four approved fields in the two wrong high roof planes:
  # every XZ coordinate, other part and all retained evidence must stay exact.
  assert hashlib.sha256(
    json.dumps(original, separators=(",", ":")).encode()
  ).hexdigest() == ("136413c99acb390e2d1f772285aad315be0ac2a197b195ef42e8a517c3d2f110")


def test_changed_scope_datum_or_invalid_sources_fail_closed_without_geometry_repair(
  source,
):
  changed = copy.deepcopy(source)
  changed["originalPrisms"].append({"id": "64895468"})
  with pytest.raises(ValueError, match="five exact owners"):
    builder.rebuild(changed)
  changed = copy.deepcopy(source)
  changed["datum"]["displayGround"] += 0.1
  with pytest.raises(ValueError, match="vertical datum"):
    builder.rebuild(changed)
  changed = copy.deepcopy(source)
  changed["osm"]["1201745260"]["ring"] = [[0, 0], [2, 2], [0, 2], [2, 0]]
  with pytest.raises(ValueError, match="Invalid mapped source"):
    builder.rebuild(changed)
  changed = copy.deepcopy(source)
  changed["originalPrisms"][0]["ring"] = [[0, 0], [20, 20], [0, 20], [20, 0]]
  with pytest.raises(ValueError, match="Invalid original source"):
    builder.rebuild(changed)
