"""Independent source/location preservation for the v265 Scheunen fittings."""

from collections import Counter

import numpy as np
import pytest
from shapely.geometry import LineString, Point, Polygon, box, shape

from scripts import build_scheunen_v265 as build


@pytest.fixture(scope="module")
def evidence() -> dict:
  return build.base.read_json(build.EVIDENCE)


def test_source_assets_and_complete_owner_sheets_remain_unchanged(
  evidence: dict,
) -> None:
  assert evidence["sourceSha256"] == build.base.digest(build.SOURCE)
  assert evidence["contextSha256"] == build.base.digest(build.CONTEXT)
  assert evidence["terrainSha256"] == build.base.digest(
    build.ROOT / "src/app/src/data/weinbergBuildingOffsetsV176.json"
  )
  for filename, digest in evidence["assets"].items():
    assert build.base.digest(build.OUT / filename) == digest
  assert evidence["oldDoorSha256"] == build.base.digest(
    build.GEO / "house-doors-v233-evidence.json.gz"
  )


def test_doors_are_unique_previously_unrendered_mapped_nodes_on_exact_walls(
  evidence: dict,
) -> None:
  source = build.base.read_json(build.SOURCE)
  context = build.base.read_json(build.CONTEXT)
  nodes = {r["id"]: r for r in context["entrances"]}
  owners = {
    r["id"]: r for r in source["buildings"] + source["retainedDetailedBuildings"]
  }
  old = {
    r["node"]
    for r in build.base.read_json(build.GEO / "house-doors-v233-evidence.json.gz")[
      "doors"
    ]
  }
  assert len(evidence["doors"]) >= 15
  assert len({r["node"] for r in evidence["doors"]}) == len(evidence["doors"])
  protected = build.protected()
  for door in evidence["doors"]:
    assert door["node"] not in old
    assert door["mappedPoint"] == nodes[door["node"]]["point"]
    assert door["owner"] not in protected
    assert door["distance"] <= 0.35
    assert shape(source["scope"]).covers(Point(*door["mappedPoint"]))
    part = next(p for p in owners[door["owner"]]["parts"] if p["id"] == door["part"])
    original = part["surfaces"][door["sheet"]]
    assert original["kind"] == "WallSurface" and original["rings"] == door["rings"]
    direction, normal, anchor = (
      np.array(door["d"]),
      np.array(door["n"]),
      np.array(door["a"]),
    )
    assert abs(np.dot(np.array(door["point"]) - anchor, normal)) < 1e-7
    u = float(np.dot(np.array(door["point"]) - anchor, direction))
    planar = Polygon(
      [
        (np.dot(np.array(p)[[0, 2]] - anchor, direction), p[1] + door["dy"])
        for p in original["rings"][0]
      ],
      [
        [
          (np.dot(np.array(p)[[0, 2]] - anchor, direction), p[1] + door["dy"])
          for p in ring
        ]
        for ring in original["rings"][1:]
      ],
    )
    assert planar.covers(
      box(u - 0.76, door["low"] + 0.01, u + 0.76, door["low"] + 2.65)
    )


def test_drawn_and_native_openings_have_complete_current_rendered_walls(
  evidence: dict,
) -> None:
  manifest = build.base.read_json(build.OUT / "manifest.json")
  descs = {d["id"]: d for d in manifest["chunks"]}
  for tile in sorted({r["chunk"] for r in evidence["doors"]}):
    packets = {
      f: build.base.read_json(build.OUT / descs[tile][f]["url"])
      for f in ["drawn", "minecraft"]
    }
    extras = {
      f: [
        build.base.read_json(build.OUT / d[f]["url"])
        for d in manifest["chunks"]
        if d.get("detailCompanionOf") == tile
      ]
      for f in packets
    }
    triangles = build.drawn_triangles(packets["drawn"], extras["drawn"])
    planes = build.native_planes(packets["minecraft"], extras["minecraft"])
    for row in [d for d in evidence["doors"] if d["chunk"] == tile]:
      assert build.drawn_door_exists(row, row["point"], triangles)
      native = row["native"]
      assert native["d"][0] == 0 or native["d"][1] == 0
      assert native["distance"] <= 1.65
      plane = next(
        p
        for p in planes
        if p["axis"] == native["axis"] and p["plane"] == native["plane"]
      )
      u = native["point"][1 if native["axis"] == 0 else 0]
      assert (
        plane["polygon"]
        .buffer(0.02)
        .covers(box(u - 0.72, native["low"] + 0.05, u + 0.72, native["low"] + 2.60))
      )


def test_eaves_are_real_measured_roof_joins_with_independent_native_steps(
  evidence: dict,
) -> None:
  source = build.base.read_json(build.SOURCE)
  owners = {
    r["id"]: r for r in source["buildings"] + source["retainedDetailedBuildings"]
  }
  assert len(evidence["eaves"]) >= 4
  for row in evidence["eaves"]:
    part = next(p for p in owners[row["owner"]]["parts"] if p["id"] == row["part"])
    p, q = row["edge"]
    edge = LineString([[p[0], p[2]], [q[0], q[2]]])
    assert edge.length >= 5 and abs(p[1] - q[1]) < 0.015
    assert row["nativeSegments"] > 0
    assert any(
      LineString([[a[0], a[2]], [b[0], b[2]]]).hausdorff_distance(edge) < 0.025
      and abs(a[1] + row["dy"] - p[1]) < 0.025
      and abs(b[1] + row["dy"] - p[1]) < 0.025
      for sheet in part["surfaces"]
      if sheet["kind"] == "RoofSurface"
      for ring in sheet["rings"]
      for a, b in zip(ring, ring[1:] + ring[:1])
    )
  counts = Counter(row["chunk"] for row in evidence["eaves"])
  assert max(counts.values()) <= build.MAX_EAVES


def test_small_recipe_and_each_existing_packet_limit() -> None:
  data = build.base.read_json(build.RUNTIME)
  assert build.RUNTIME.stat().st_size < 64_000
  assert data["keys"] == sorted(data["chunks"])
  assert len(data["chunks"]) == 2
  for modes in data["chunks"].values():
    for family, plan in modes.items():
      assert len(plan["boxes"]) <= build.MAX_BOXES
      for row in plan["boxes"]:
        assert len(row) == 11 and all(np.isfinite(row))
        if family == "minecraft":
          assert row[3] == 0 or row[4] == 0
      assert len(plan["records"]) < 16
