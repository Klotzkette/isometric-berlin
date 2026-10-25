"""Independent v268 retained sources, commercial-front gaps and real bench anchors."""

from __future__ import annotations

import math
from collections import Counter

import numpy as np
import pytest
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box

from scripts import build_koepenicker_streets_v268 as build


@pytest.fixture(scope="module")
def evidence() -> dict:
  return build.base.read_json(build.EVIDENCE)


def test_all_earlier_sources_station_and_existing_packet_bytes_survive(
  evidence: dict,
) -> None:
  for filename, digest in evidence["inputs"].items():
    assert build.base.digest(build.ROOT / filename) == digest
  for filename, digest in evidence["assets"].items():
    assert build.base.digest(build.OUT / filename) == digest
  assert evidence["inputs"]["src/app/src/data/kreuzbergStreetsV267.json"]
  assert evidence["inputs"][
    "geo_data/regierungsviertel/district-facades-v188-evidence.json.gz"
  ]


def test_shop_points_bind_original_ordinary_owner_and_complete_mapped_street_front(
  evidence: dict,
) -> None:
  context = build.base.read_json(build.CONTEXT)
  points = {r["id"]: r for r in context["points"]}
  originals = build.base.read_json(build.base.EVIDENCE)["faces"]
  manifest = {
    d["id"]: d for d in build.base.read_json(build.OUT / "manifest.json")["chunks"]
  }
  packets = {
    k: build.base.read_json(build.OUT / manifest[k]["drawn"]["url"])
    for k in {r["chunk"] for r in evidence["shops"]}
  }
  assert len(evidence["shops"]) == 4
  assert evidence["doors"] == []
  assert len({r["node"] for r in evidence["shops"]}) == len(evidence["shops"])
  counts = Counter(r["face"]["streetName"] for r in evidence["shops"])
  assert counts == {"Köpenicker Straße": 4}
  assert all(r["face"]["owner"] not in build.EXCLUDED_OWNERS for r in evidence["shops"])
  for row in evidence["shops"]:
    face = row["face"]
    poi = points[row["node"]]
    packet = packets[row["chunk"]]
    assert poi["point"] == row["mappedPoint"] and poi["street"] == face["streetName"]
    assert any(
      all(
        old[k] == face[k] for k in ["owner", "chunk", "a", "b", "normal", "low", "high"]
      )
      for old in originals
    )
    ox, _, oz = packet["origin"]
    assert any(
      b["sourceId"] == face["owner"]
      and translate(Polygon(b["ring"], b["holes"]), ox, oz)
      .buffer(0.1)
      .covers(Point(poi["point"]))
      for b in packet["nav"]["buildings"]
    )
    assert LineString([face["a"], face["b"]]).distance(Point(face["point"])) < 1e-7
    assert face["bottom"] - 0.08 > face["low"] + 0.82  # existing plinth top
    assert face["top"] + 0.21 < build.pane_bottom(face)
    assert face["top"] - face["bottom"] >= 1


def test_complete_drawn_and_native_walls_and_no_existing_entrance_overlap(
  evidence: dict,
) -> None:
  manifest = {
    d["id"]: d for d in build.base.read_json(build.OUT / "manifest.json")["chunks"]
  }
  entrances = build.base.read_json(build.GEO / "house-doors-v233-context.json.gz")[
    "entrances"
  ]
  previous = build.base.read_json(build.GEO / "house-doors-v233-evidence.json.gz")[
    "doors"
  ]
  for tile in sorted({s["chunk"] for s in evidence["shops"]}):
    p = {
      m: build.base.read_json(build.OUT / manifest[tile][m]["url"])
      for m in ["drawn", "minecraft"]
    }
    triangles = build.fittings.drawn_triangles(p["drawn"], [])
    planes = build.fittings.native_planes(p["minecraft"], [])
    for row in [s for s in evidence["shops"] if s["chunk"] == tile]:
      f, n = row["face"], row["native"]
      point = np.array(f["point"])
      d = np.array(f["d"])
      normal = np.array(f["n"])
      offsets = triangles[:, :, [0, 2]] - point
      dist, u = offsets @ normal, offsets @ d
      selected = np.where(np.max(np.abs(dist), axis=1) < 0.012)[0]
      from shapely.ops import unary_union

      union = unary_union(
        [Polygon(np.column_stack([u[i], triangles[i, :, 1]])) for i in selected]
      )
      assert union.buffer(0.012).covers(
        box(-1.48, f["bottom"] - 0.08, 1.48, f["top"] + 0.21)
      )
      plane = next(
        v for v in planes if v["axis"] == n["axis"] and v["plane"] == n["plane"]
      )
      a = 1 if n["axis"] == 0 else 0
      assert (
        plane["polygon"]
        .buffer(0.012)
        .covers(
          box(
            n["point"][a] - 0.86,
            n["bottom"] - 0.08,
            n["point"][a] + 0.86,
            n["top"] + 0.21,
          )
        )
      )
      assert n["sourceProjectionDistance"] <= math.hypot(1.65, 1)
      assert all(math.dist(f["point"], e["point"]) >= 3.1 for e in entrances)
      assert all(
        math.dist(f["point"], e["point"]) >= 3.1 for e in previous if e["chunk"] == tile
      )


def test_surrounds_are_exact_existing_panes_on_complete_original_walls_with_ground(
  evidence: dict,
) -> None:
  originals = {
    r["owner"]: r for r in build.base.read_json(build.base.EVIDENCE)["faces"]
  }
  manifest = {
    d["id"]: d for d in build.base.read_json(build.OUT / "manifest.json")["chunks"]
  }
  rows = evidence["surrounds"]
  assert Counter(r["mode"] for r in rows) == {"drawn": 287, "minecraft": 36}
  assert len({r["face"]["owner"] for r in rows if r["mode"] == "drawn"}) == 24
  assert len(
    {(r["face"]["owner"], r["mode"], r["span"], r["row"], r["column"]) for r in rows}
  ) == len(rows)
  for tile in {r["chunk"] for r in rows}:
    for mode in ["drawn", "minecraft"]:
      packet = build.base.read_json(build.OUT / manifest[tile][mode]["url"])
      triangles = build.fittings.drawn_triangles(packet, [])
      extra = [
        build.base.read_json(build.OUT / d[mode]["url"])
        for d in manifest.values()
        if d.get("detailCompanionOf") == tile
      ]
      pane_triangles = build.fittings.drawn_triangles(extra[0], extra[1:])
      for row in [r for r in rows if r["chunk"] == tile and r["mode"] == mode]:
        f, p, y, w, h = row["face"], row["point"], row["y"], row["width"], row["height"]
        assert f["owner"] not in build.EXCLUDED_OWNERS
        source = originals[f["owner"]]
        original = next(
          v
          for v in build.retained_panes(source, mode == "minecraft")
          if all(v[k] == row[k] for k in ["row", "column", "span"])
        )
        assert all(
          row[k] == original[k] for k in ["point", "y", "width", "height", "depth"]
        )
        assert (
          build.planar_union(p, f, pane_triangles, row["depth"])
          .buffer(0.013)
          .covers(box(-w / 2, y - h / 2, w / 2, y + h / 2))
        )
        assert (
          build.planar_union(p, f, triangles)
          .buffer(0.013)
          .covers(box(-w / 2 - 0.14, y - h / 2 - 0.14, w / 2 + 0.14, y + h / 2 + 0.12))
        )
        pt, d, n = np.array(p), np.array(f["d"]), np.array(f["n"])
        strip = Polygon(
          [
            pt + d * u + n * v
            for u, v in [
              (-w / 2 - 0.14, 0.29),
              (w / 2 + 0.14, 0.29),
              (w / 2 + 0.14, 0.39),
              (-w / 2 - 0.14, 0.39),
            ]
          ]
        )
        assert build.ground_support(strip, triangles) == row["ground"]
        assert abs(row["ground"] - f["low"]) <= 0.15
        if mode == "minecraft":
          assert (f["d"][0] == 0 or f["d"][1] == 0) and (
            f["n"][0] == 0 or f["n"][1] == 0
          )


def test_four_frame_members_leave_all_old_glazing_uncovered(evidence: dict) -> None:
  runtime = build.base.read_json(build.RUNTIME)
  for pane in evidence["surrounds"]:
    plan = runtime["chunks"][pane["chunk"]][pane["mode"]]
    boxes = plan["boxes"][pane["firstBox"] : pane["firstBox"] + pane["boxCount"]]
    assert len(boxes) == 4
    origin = np.array(plan["origin"])
    point = np.array(pane["point"])
    direction = np.array(pane["face"]["d"])
    glass = box(
      -pane["width"] / 2,
      pane["y"] - pane["height"] / 2,
      pane["width"] / 2,
      pane["y"] + pane["height"] / 2,
    )
    for row in boxes:
      centre = np.array(row[:3]) + origin
      u = (centre[[0, 2]] - point) @ direction
      projected = box(
        u - row[7] / 2, centre[1] - row[8] / 2, u + row[7] / 2, centre[1] + row[8] / 2
      )
      assert projected.distance(glass) >= 0.009


def test_each_shop_has_recorded_delivered_floor_on_both_independent_fronts(
  evidence: dict,
) -> None:
  manifest = {
    d["id"]: d for d in build.base.read_json(build.OUT / "manifest.json")["chunks"]
  }
  for tile in {r["chunk"] for r in evidence["shops"]}:
    for mode in ["drawn", "minecraft"]:
      packet = build.base.read_json(build.OUT / manifest[tile][mode]["url"])
      triangles = build.fittings.drawn_triangles(packet, [])
      for row in [r for r in evidence["shops"] if r["chunk"] == tile]:
        f = row["face"] if mode == "drawn" else row["native"]
        p, d, n = np.array(f["point"]), np.array(f["d"]), np.array(f["n"])
        poly = Polygon(
          [
            p + d * u + n * v
            for u, v in [
              (-f["width"] / 2, 0.24),
              (f["width"] / 2, 0.24),
              (f["width"] / 2, 0.34),
              (-f["width"] / 2, 0.34),
            ]
          ]
        )
        assert build.ground_support(poly, triangles) == row["ground"][mode]
        assert abs(row["ground"][mode] - f["low"]) <= 0.15


def test_recipes_are_small_orthogonal_native_and_bounded() -> None:
  source = build.base.read_json(build.RUNTIME)
  assert build.RUNTIME.stat().st_size < 150_000
  assert (
    source["keys"] == sorted(source["chunks"]) == ["7_2", "7_3", "8_3", "9_3", "9_4"]
  )
  for modes in source["chunks"].values():
    for mode, plan in modes.items():
      assert len(plan["boxes"]) <= build.MAX_BOXES and len(plan["records"]) < 16
      for row in plan["boxes"]:
        assert len(row) == 11 and all(np.isfinite(row))
        assert abs(math.hypot(*row[3:5]) - 1) < 1e-6
        assert abs(math.hypot(*row[5:7]) - 1) < 1e-6
        if mode == "minecraft":
          assert row[3] == 0 or row[4] == 0
