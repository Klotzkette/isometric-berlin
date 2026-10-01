"""Café source preservation, native glazing and safe source-bound garden detail."""

import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location(
  "cafe_neuer_see", ROOT / "scripts/build_cafe_neuer_see_v164.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
DATA = json.loads((ROOT / "src/app/src/data/cafeNeuerSeeV164Source.json").read_text())


def test_all_current_cafe_source_planes_survive_rigid_translation() -> None:
  display = {part["id"]: part for part in DATA["parts"]}
  assert len(display) == 5
  for parent in DATA["parents"]:
    if "displayOffsetY" not in parent:
      continue
    offset = parent["displayOffsetY"]
    for original in parent["sourceParts"]:
      actual = display[original["id"]]
      assert actual["ring"] == original["ring"]
      assert actual["holes"] == original["holes"]
      assert actual["top_y_m"] == round(original["top_y_m"] + offset, 3)
      assert len(actual["surfaces"]) == len(original["surfaces"])
      for before, after in zip(original["surfaces"], actual["surfaces"], strict=True):
        assert before["kind"] == after["kind"]
        assert after["rings"] == [
          [[x, round(y + offset, 3), z] for x, y, z in ring] for ring in before["rings"]
        ]
  for part in DATA["parts"]:
    rendered = [s for s in DATA["surfaces"] if s["partId"] == part["id"]]
    assert len(rendered) == len(part["surfaces"])
    for source, render in zip(part["surfaces"], rendered, strict=True):
      normal = MODULE.normal_of(source["rings"][0])
      axes = [i for i in range(3) if i != int(np.argmax(np.abs(normal)))]
      rings = [[tuple(p[i] for i in axes) for p in r] for r in source["rings"]]
      expected = Polygon(rings[0], rings[1:])
      triangles = [
        Polygon([tuple(p[i] for i in axes) for p in t]) for t in render["triangles"]
      ]
      assert expected.symmetric_difference(unary_union(triangles)).area < 0.00001


def test_toilet_height_exception_keeps_raw_evidence_and_exact_ownership() -> None:
  corrected = [p for p in DATA["parents"] if "displayCorrection" in p]
  assert {p["id"] for p in corrected} == {
    "DEBE01YYK0002Klw",
    "DEBE01YYK0002KWV",
  }
  assert sorted(p["sourceParts"][0]["height_m"] for p in corrected) == [29.4, 29.768]
  assert all(p["sourceParts"][0]["surfaces"] for p in corrected)
  assert all("inference" in p["displayCorrection"] for p in corrected)
  toilet = next(p for p in DATA["parts"] if p["id"] == "osm-way-118603618")
  osm = next(f for f in DATA["features"] if f["id"] == "118603618")
  assert toilet["displayEstimate"] is True
  assert osm["tags"]["building:levels"] == "1"
  assert toilet["height_m"] == 3.2
  assert toilet["ring"] == osm["world_xz_m"][:-1]
  assert {p["id"] for p in DATA["legacyPrisms"]} == set(MODULE.LEGACY)
  assert not {"K0002NgP", "yIGjF11M", "DC13dOb2"} & set(MODULE.LEGACY)


def test_native_palette_does_not_create_move_or_remove_source_cells() -> None:
  # Frozen before adding glazing: the independent surface discretisation must
  # remain exactly the same shape, even where its palette becomes more specific.
  positions = [r[:3] for r in DATA["nativeBlocks"]]
  digest = hashlib.sha256(
    json.dumps(positions, separators=(",", ":")).encode()
  ).hexdigest()
  assert digest == "ab9fb743a8a035672afe88a7862fe631711d04fa640caf5228d9b0e81fe6bc1f"
  assert len(positions) == 3851
  panes = [r for r in DATA["facadeBoxes"] if r[8] == "glass"]
  glass_cells = [r for r in DATA["nativeBlocks"] if r[3] == 0x526C69]
  assert len(glass_cells) > 800
  for cx, cy, cz, _ in glass_cells:
    assert any(
      abs((cx - x) * math.cos(yaw) - (cz - z) * math.sin(yaw)) < w / 2
      and abs(cy - y) < h / 2
      and abs((cx - x) * math.sin(yaw) + (cz - z) * math.cos(yaw)) < 0.8
      for x, y, z, w, h, _, yaw, _, _ in panes
    )
  # A point sampled by a pane may share a cube with a window edge or roof.
  # Those cubes must keep the wall/roof palette unless the centre qualifies.
  blocks = {
    (0, 1, 0): [0.5, 6.7, 0.5, 0xAD9B7C],
    (1, 1, 0): [1.5, 6.7, 0.5, 0xAD9B7C],
    (0, 2, 0): [0.5, 7.7, 0.5, 0x737C75],
  }
  before = [r[:3] for r in blocks.values()]
  MODULE.paint_native_glazing(
    blocks, [[0.7, 6.9, 0.45, 1.4, 2.3, 0.08, 0, 0x526C69, "glass"]]
  )
  assert blocks[(0, 1, 0)][3] == 0x526C69
  assert blocks[(1, 1, 0)][3] == 0xAD9B7C
  assert blocks[(0, 2, 0)][3] == 0x737C75
  assert [r[:3] for r in blocks.values()] == before


def test_garden_furniture_leaves_mapped_paths_and_water_open() -> None:
  by_id = {f["id"]: f for f in DATA["features"]}
  ground = Polygon(by_id["118616321"]["world_xz_m"]).union(
    Polygon(by_id["1069887158"]["world_xz_m"])
  )
  buildings = unary_union([Polygon(p["ring"], p["holes"]) for p in DATA["parts"]])
  paths = DATA["protectedPaths"]
  assert {p["osmWay"] for p in paths} == {"22792477", "118513486", "118686814"}
  assert [len(p["line"]) for p in paths] == [26, 6, 14]
  corridors = unary_union(
    [
      LineString(p["line"]).buffer(p["widthM"] / 2 + p["furnitureClearanceM"])
      for p in paths
    ]
  )
  assert len(DATA["tables"]) == 42
  assert len(DATA["chairTables"]) == 8
  assert len(DATA["canopies"]) == 2
  for x, z in DATA["tables"] + DATA["chairTables"]:
    footprint = Point(x, z).buffer(2.5)
    assert ground.covers(footprint)
    assert footprint.disjoint(buildings.buffer(2.4))
    assert footprint.disjoint(corridors)
  for x, z in DATA["canopies"]:
    footprint = box(x - 3.5, z - 3, x + 3.5, z + 3)
    assert ground.covers(footprint)
    assert footprint.disjoint(buildings.buffer(2.4))
    assert footprint.disjoint(corridors)
  assert DATA["sandpits"] == [
    by_id["8968204444"]["world_xz_m"],
    by_id["8968204465"]["world_xz_m"],
  ]


def test_boat_hulls_and_outstretched_oars_stay_inside_actual_lake() -> None:
  water = DATA["water"]
  pond = Polygon(
    [(x / 10, z / 10) for x, z in water["ring"]],
    [[(x / 10, z / 10) for x, z in h] for h in water["holes"]],
  )
  assert len(DATA["boats"]) == 6
  for x, z, yaw in DATA["boats"]:
    # A conservative convex envelope covers the 4.1m hull and both paddles.
    local = [(-2.05, -0.8), (2.05, -0.8), (-2.05, 0.8), (2.05, 0.8)]
    local.extend([(-0.95, -2.4), (-0.3, -2.4), (-0.95, 2.4), (-0.3, 2.4)])
    ring = [
      (
        x + math.cos(yaw) * u + math.sin(yaw) * v,
        z - math.sin(yaw) * u + math.cos(yaw) * v,
      )
      for u, v in local
    ]
    assert pond.covers(Polygon(ring).convex_hull)
  for x, z in DATA["tables"] + DATA["chairTables"]:
    assert Point(x, z).buffer(2.5).disjoint(pond.buffer(0.4))


def test_garden_floor_preserves_source_boundaries_and_compact_native_sampling() -> None:
  by_id = {f["id"]: f for f in DATA["features"]}
  garden = Polygon(by_id["118616321"]["world_xz_m"])
  seating = Polygon(by_id["1069887158"]["world_xz_m"])
  buildings = unary_union([Polygon(p["ring"], p["holes"]) for p in DATA["parts"]])
  water = DATA["water"]
  pond = Polygon(
    [(x / 10, z / 10) for x, z in water["ring"]],
    [[(x / 10, z / 10) for x, z in h] for h in water["holes"]],
  )
  paths = unary_union(
    [LineString(p["line"]).buffer(p["widthM"] / 2) for p in DATA["protectedPaths"]]
  )
  expected_timber = seating.difference(unary_union([buildings, pond, paths]))
  expected_ground = garden.union(seating).difference(
    unary_union([buildings, pond, paths])
  )
  expected = {
    "timber": expected_timber,
    "gravel": expected_ground.difference(expected_timber),
  }
  assert abs(expected_timber.area - 454.641136) < 0.001
  assert DATA["deckY"] > 5.36  # The mapped timber deck clears the drawn water.
  for kind, area in expected.items():
    surfaces = [s for s in DATA["gardenSurfaces"] if s["kind"] == kind]
    triangles = [t for s in surfaces for t in s["triangles"]]
    rendered = unary_union([Polygon([(x, z) for x, _, z in t]) for t in triangles])
    assert rendered.symmetric_difference(area).area < 0.00001
    expected_y = DATA["deckY"] if kind == "timber" else 5.32
    assert all(y == expected_y for t in triangles for _, y, _ in t)
    polygons = unary_union(
      [
        Polygon(p["ring"], p["holes"])
        for p in DATA["gardenFloorPolygons"]
        if p["kind"] == kind
      ]
    )
    assert polygons.symmetric_difference(area).area < 0.00001
    # Expanding compact runs must equal independent centre sampling, including
    # all holes. This catches accidental path, building or water infill.
    color = 0xA18A67 if kind == "timber" else 0xB7AD92
    cells = []
    for x, y, z, width, height, depth, palette in DATA["gardenNativeRuns"]:
      if palette != color:
        continue
      assert width >= 1 and width == int(width)
      assert height == 0.12 and depth == 1
      assert abs(y + height / 2 - expected_y) < 0.000001
      cells.extend((x - width / 2 + i + 0.5, z) for i in range(int(width)))
    x0, z0, x1, z1 = area.bounds
    sampled = {
      (x + 0.5, z + 0.5)
      for x in range(math.floor(x0), math.ceil(x1))
      for z in range(math.floor(z0), math.ceil(z1))
      if area.covers(Point(x + 0.5, z + 0.5))
    }
    assert len(cells) == len(set(cells))
    assert set(cells) == sampled
  assert sum(len(s["triangles"]) for s in DATA["gardenSurfaces"]) < 300
  assert len(DATA["gardenNativeRuns"]) < 500
  assert DATA["deckPlankLines"] and DATA["shorelineDeckRails"]
  for line in DATA["deckPlankLines"]:
    assert expected_timber.buffer(0.00001).covers(LineString(line))
  pier = LineString(by_id["118603619"]["world_xz_m"])
  for line in DATA["shorelineDeckRails"]:
    segment = LineString(line)
    assert expected_timber.boundary.buffer(0.00001).covers(segment)
    assert pond.buffer(2.00001).covers(segment)
    assert segment.disjoint(pier.buffer(1))
