"""The requested Ringbahn completion is finite, additive and reproducible."""

from __future__ import annotations

import copy
import gzip
import json
import sys
from pathlib import Path

import pytest
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import transform, unary_union

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import build_ring_city_v182 as builder  # noqa: E402


def test_exact_ring_plus_100m_and_explicit_lobes_are_the_whole_new_scope() -> None:
  source = json.loads((builder.DATA / "outer-thin-outlines-v179.json").read_text())
  ring = next(line for line in source["lines"] if line["name"] == "Ringbahn S41")
  polygon = transform(builder.PROJECT, Polygon(ring["coordinates"]))
  assert polygon.is_valid
  assert polygon.area == pytest.approx(87_350_686.311, abs=0.01)
  actual = builder.exporter.load_projected_polygon(
    builder.DATA / "bounds-ring-v182.geojson"
  )
  rebuilt = transform(
    builder.PROJECT, shape(builder.build_bounds()["features"][0]["geometry"])
  )
  assert actual.equals_exact(rebuilt, tolerance=0)
  assert polygon.buffer(99.99).difference(actual).area < 1e-5
  assert 90e6 < actual.area < 97e6
  assert not actual.contains(Point(*builder.PROJECT(13.2, 52.52)))
  assert not actual.contains(Point(*builder.PROJECT(13.53, 52.48)))


def test_new_scope_subtracts_every_existing_detailed_and_outline_city_surface() -> None:
  scope = json.loads(
    (builder.ROOT / "src/app/src/data/ringCityScopeV182.json").read_text()
  )
  actual = unary_union([Polygon(p["ring"], p["holes"]) for p in scope["footprint"]])
  old = builder.exporter.load_projected_polygon(builder.DATA / "bounds.geojson")
  new = builder.exporter.load_projected_polygon(
    builder.DATA / "bounds-ring-v182.geojson"
  )
  expected = builder.exporter.world(new.difference(old))
  # Shared runtime ring storage is centimetre precision; never whole-road gaps.
  assert actual.symmetric_difference(expected).area < expected.length * 0.0075
  assert (
    actual.intersection(builder.exporter.world(old)).area < expected.length * 0.0075
  )
  assert 20e6 < actual.area < 25e6


def test_manifest_append_preserves_existing_asset_bytes_and_is_idempotent() -> None:
  before = {
    "chunks": [{"id": "0_0", "drawn": {"url": "original.json.gz", "sha256": "abc"}}],
    "footprint": [{"ring": [[0, 0], [1, 0], [0, 1], [0, 0]], "holes": []}],
    "source": {"original": "unchanged"},
    "bounds": [0, 0, 1, 1],
  }
  snapshot = copy.deepcopy(before)
  supplement = {
    "chunks": [{"id": "ring182-0_0", "drawn": {"url": "ring182-0_0.json.gz"}}],
    "footprint": [{"ring": [[1, 0], [2, 0], [1, 1], [1, 0]], "holes": []}],
    "source": {"new": "separate"},
    "bounds": [1, 0, 2, 1],
  }
  result = builder.merge_manifest(before, supplement)
  assert before == snapshot
  assert result["chunks"][0] == before["chunks"][0]
  assert result["source"] == before["source"]
  assert result["bounds"] == [0, 0, 2, 1]
  assert result == builder.merge_manifest(result, supplement)


def test_hero_ownership_removes_its_shell_but_never_an_adjacent_house() -> None:
  houses = [
    {"sourceId": "hero", "geometry": box(0, 0, 10, 10)},
    {"sourceId": "neighbour", "geometry": box(9, 0, 20, 10)},
    {"sourceId": "separate", "geometry": box(30, 0, 40, 10)},
  ]
  output = builder.exclude_hero_shells(houses, {"hero"}, box(0, 0, 10, 10))
  assert [house["sourceId"] for house in output] == ["neighbour", "separate"]
  assert output[0]["geometry"].equals(box(10, 0, 20, 10))
  assert output[1]["geometry"].equals(houses[2]["geometry"])
  assert houses[1]["geometry"].area == 110


def test_compound_parent_does_not_give_low_parts_the_tower_height() -> None:
  footprint = box(0, 0, 12, 10)
  source = [{"sourceId": "tower-and-podium", "geometry": footprint, "height": 115}]
  parts = {
    "tower-and-podium": [
      {"partId": "tower", "geometry": box(0, 0, 4, 10), "height": 115},
      {"partId": "podium", "geometry": box(4, 0, 12, 10), "height": 9},
    ]
  }
  refined = builder.refine_part_heights(source, parts)
  assert [part["height"] for part in refined] == [115, 9]
  assert unary_union([part["geometry"] for part in refined]).equals(footprint)
  retained = builder.exclude_hero_shells(refined, set(), box(0, 0, 4, 10))
  assert len(retained) == 1
  assert retained[0]["height"] == 9
  assert retained[0]["geometry"].equals(box(4, 0, 12, 10))


def test_published_kreisel_low_parts_keep_measured_heights_and_all_unowned_area() -> (
  None
):
  parts = builder.measured_parts()
  expected = {part["partId"]: part for rows in parts.values() for part in rows}
  _, heroes = builder.hero_ownership()
  projected = []
  low_parts = set()
  for identity in ("ring182--8_13", "ring182--7_13"):
    packet = json.loads(
      gzip.decompress((builder.PUBLIC / f"{identity}.drawn.json.gz").read_bytes())
    )
    ox, _, oz = packet["origin"]
    for building in packet["nav"]["buildings"]:
      if building["sourceId"] not in parts:
        continue
      part = expected[building["partId"]]
      assert building["height"] == round(part["height"], 2)
      assert (
        building["heightSource"] == "Berlin LoD2 measured leaf-part vertical envelope"
      )
      projected.append(
        Polygon(
          [(x + ox, z + oz) for x, z in building["ring"]],
          [[(x + ox, z + oz) for x, z in ring] for ring in building["holes"]],
        )
      )
      if part["height"] < 100:
        low_parts.add(building["partId"])
        assert building["height"] <= 30.13
  actual = unary_union(projected)
  retained = unary_union([p["geometry"] for p in expected.values()]).difference(heroes)
  assert low_parts, "Measured low podium strips must remain represented"
  assert actual.symmetric_difference(retained).area < retained.length * 0.015
