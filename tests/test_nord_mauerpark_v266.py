"""Independent checks of complete earlier geometry and source-bound v266 members."""

from __future__ import annotations

import math
from collections import Counter

import numpy as np
import pytest
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union

from scripts import build_nord_mauerpark_v266 as build


@pytest.fixture(scope="module")
def evidence() -> dict:
  return build.base.read_json(build.EVIDENCE)


@pytest.fixture(scope="module")
def packets() -> dict:
  return build.load_packets()


def test_exact_inputs_and_all_prior_source_packets_are_unmodified(
  evidence: dict,
) -> None:
  for path, digest in evidence["inputs"].items():
    assert build.base.digest(build.ROOT / path) == digest
  for path, digest in evidence["assets"].items():
    assert build.base.digest(build.ROOT / path) == digest
  assert any("minecraft-voxels.json" in path for path in evidence["assets"])
  assert any("altMitteV169Native" in path for path in evidence["assets"])


def test_distinct_real_venues_and_no_conflicting_source_shell(evidence: dict) -> None:
  context = build.base.read_json(build.CONTEXT)
  assert context["hfs"]["id"] == "DEBE01YYK00004jQ"
  nodes = {n["id"]: n for n in context["nodes"]}
  assert nodes["9282901515"]["tags"]["addr:housenumber"] == "8"
  assert nodes["9282901515"]["tags"]["leisure"] == "trampoline_park"
  counts = Counter(row["role"].split("-")[0] for row in evidence["features"])
  assert all(counts[name] > 5 for name in ["hfs", "bat", "myjump", "db"])
  assert all("DEBE01ALcg" not in f["owner"] for f in evidence["features"])
  assert (
    len(
      {tuple(f["point"]) for f in evidence["features"] if f["role"].startswith("bat")}
    )
    > 4
  )
  for row in [r for r in evidence["features"] if r["role"].startswith("hfs")]:
    part = next(p for p in context["hfs"]["parts"] if p["id"] == row["face"]["part"])
    surface = part["surfaces"][row["face"]["sheet"]]
    assert surface["rings"][0] == row["face"]["ring"]
    assert surface["kind"] == "WallSurface"


def test_every_complete_drawn_rectangle_has_delivered_source_support(
  evidence: dict, packets: dict
) -> None:
  geometry = {
    key: build.fit.drawn_triangles(m["drawn"]["packet"], [])
    for key, m in packets.items()
    if "drawn" in m
  }
  prism = next(
    p
    for p in build.base.read_json(
      build.ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
    )["buildings"]
    if p["id"] == "27830228"
  )
  ring = [(x / 10, z / 10) for x, z in prism["ring"]]
  cache = {}
  for row in evidence["features"]:
    f = row["face"]
    if row["drawnSupport"] == "retained-myjump-root":
      assert f["owner"] == "OSM-way-27830228"
      assert Polygon(ring).boundary.distance(Point(row["point"])) < 1e-6
      assert row["y"] - row["height"] / 2 >= prism["y0_dm"] / 10
      assert row["y"] + row["height"] / 2 <= (prism["y0_dm"] + prism["h_dm"]) / 10
      continue
    key = (row["drawn"], f["owner"], f["part"], f["sheet"])
    if key not in cache:
      triangles = geometry[row["drawn"]]
      delta = triangles[:, :, [0, 2]] - f["a"]
      selected = np.where(np.max(np.abs(delta @ f["n"]), axis=1) < 0.125)[0]
      u = delta @ f["d"]
      cache[key] = unary_union(
        [Polygon(np.column_stack([u[i], triangles[i, :, 1]])) for i in selected]
      )
    assert (
      cache[key]
      .buffer(0.012)
      .covers(
        box(
          row["u"] - row["width"] / 2,
          row["y"] - row["height"] / 2,
          row["u"] + row["width"] / 2,
          row["y"] + row["height"] / 2,
        )
      )
    )


def test_native_rectangles_fit_actual_independent_cardinal_walls(
  evidence: dict, packets: dict
) -> None:
  planes = {
    key: build.fit.native_planes(m["minecraft"]["packet"], [])
    for key, m in packets.items()
    if "minecraft" in m
  }
  voxel = build.base.read_json(
    build.ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  )
  cell = voxel["cell_m"]
  columns = {}
  for zi, runs in enumerate(voxel["building_rows"]):
    z = voxel["grid"]["min_z_idx"] + zi
    if not -1620 < (z + 0.5) * cell < -1525:
      continue
    for x, length, lo, hi, _ in runs:
      for offset in range(length):
        xx = voxel["grid"]["min_x_idx"] + x + offset
        if 898 < (xx + 0.5) * cell < 982:
          columns[xx, z] = (lo / 10, hi / 10)
  root_planes = []
  for (x, z), (lo, hi) in columns.items():
    for axis, step in [(0, -1), (0, 1), (2, -1), (2, 1)]:
      neighbour = (x + step, z) if axis == 0 else (x, z + step)
      if neighbour in columns:
        continue
      coordinate = ((x if axis == 0 else z) + (step > 0)) * cell
      along = (z if axis == 0 else x) * cell
      root_planes.append(
        dict(axis=axis, plane=coordinate, polygon=box(along, lo, along + cell, hi))
      )
  for row in evidence["features"]:
    f = row["nativeFrame"]
    axis = 0 if f["d"][0] == 0 else 2
    dim, along = (0, 1) if axis == 0 else (1, 0)
    assert f["d"] in [[1, 0], [0, 1]]
    assert abs(f["n"][dim]) == 1 and f["n"][along] == 0
    assert math.dist(f["a"], row["point"]) <= 1.70
    options = planes[row["native"]] + (
      root_planes if row["owner"] == "OSM-way-27830228" else []
    )
    rect = box(
      f["a"][along] - row["nativeWidth"] / 2,
      row["y"] - row["height"] / 2,
      f["a"][along] + row["nativeWidth"] / 2,
      row["y"] + row["height"] / 2,
    )
    assert any(
      p["axis"] == axis
      and abs(p["plane"] - f["a"][dim]) < 1e-6
      and p["polygon"].buffer(0.012).covers(rect)
      for p in options
    )


def test_actual_park_edges_benches_and_existing_ground(
  evidence: dict, packets: dict
) -> None:
  context = build.base.read_json(build.CONTEXT)
  edges = {e["id"]: e for e in context["edges"]}
  park = shape(context["park"]["geometry"])
  assert len(evidence["edges"]) >= 5 and len(evidence["benches"]) == 5
  triangles = {
    (k, m): build.fit.drawn_triangles(p["packet"], [])
    for k, v in packets.items()
    if k in ["3_-6", "4_-6", "3_-7", "4_-7"]
    for m, p in v.items()
  }
  patches = {}
  for edge in evidence["edges"]:
    source = edges[edge["id"]]
    assert source["tags"]["material"] == "stone" and source["tags"]["height"] == "0.5"
    line = LineString([edge["a"], edge["b"]])
    assert shape(source["geometry"]).buffer(0.001).covers(line)
    assert park.buffer(0.1).covers(line)
    for mode, segments in edge["modes"].items():
      for segment in segments:
        frame = segment["frame"]
        point = np.array(frame["a"])
        assert (
          build.ground_height(point, triangles[segment["chunk"], mode])
          == segment["ground"]
        )
        patch_key = (segment["chunk"], mode, segment["ground"])
        if patch_key not in patches:
          tris = triangles[segment["chunk"], mode]
          flat = tris[np.max(abs(tris[:, :, 1] - segment["ground"]), axis=1) < 0.012]
          patches[patch_key] = unary_union([Polygon(t[:, [0, 2]]) for t in flat])
        d = np.array(frame["d"])
        patch = LineString(
          [point - d * segment["length"] / 2, point + d * segment["length"] / 2]
        ).buffer(0.14, cap_style=2)
        assert patches[patch_key].buffer(0.02).covers(patch)
        assert line.distance(Point(point)) < 0.81
        if mode == "minecraft":
          assert frame["d"][0] == 0 or frame["d"][1] == 0
  sources = {b["id"]: b for b in context["benches"]}
  for bench in evidence["benches"]:
    original = sources[bench["id"]]
    assert (
      original["point"] == bench["point"]
      and original["direction"] == bench["direction"]
    )
    assert park.buffer(-1.1).covers(Point(bench["point"]))
    for mode, ground in bench["ground"].items():
      assert (
        build.fh.bench_support(
          bench, mode == "minecraft", triangles[bench["chunk"], mode]
        )
        == ground
      )


def test_no_descriptor_expansion_and_bounded_runtime_rows(
  evidence: dict, packets: dict
) -> None:
  runtime = build.base.read_json(build.RUNTIME)
  assert len(runtime["chunks"]) <= 8
  for key, modes in runtime["chunks"].items():
    for mode, plan in modes.items():
      assert key in packets and mode in packets[key]
      assert plan["origin"] == packets[key][mode]["packet"]["origin"]
      assert 0 < len(plan["boxes"]) <= 900
      for row in plan["boxes"]:
        assert len(row) == 11 and all(math.isfinite(v) for v in row)
        assert all(0 < v < 655.35 for v in row[:3])
        if mode == "minecraft":
          assert row[3] == 0 or row[4] == 0
