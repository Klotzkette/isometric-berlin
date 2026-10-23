"""Retained source/clearance contracts for the sparse v264 garden illustrations."""

from __future__ import annotations

import pytest
from shapely.geometry import Point, box, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from scripts import build_allotments_v264 as subject
from scripts import build_district_facades_v188 as base


@pytest.fixture(scope="module")
def evidence() -> tuple[dict, dict, dict]:
  return tuple(
    base.read_json(p) for p in [subject.CONTEXT, subject.EVIDENCE, subject.OUTPUT]
  )


def test_recipe_stays_finite_and_uses_retained_packets(evidence: tuple) -> None:
  context, receipt, recipe = evidence
  assert context["sourceAllotmentCount"] == 1013
  assert receipt["contextSha256"] == base.digest(subject.CONTEXT)
  assert receipt["summary"]["representedAllotments"] > 100
  assert subject.OUTPUT.stat().st_size < 2 * 1024 * 1024
  assert "not measured beds" in recipe["policy"]
  for tile, modes in recipe["chunks"].items():
    for family, plan in modes.items():
      original = receipt["packets"][tile][family]
      path = base.OUT / original["url"]
      assert base.digest(path) == original["sha256"]
      packet = base.read_json(path)
      assert subject.navigation_guard(packet["nav"]) == plan["guard"]
      assert packet["origin"] == plan["origin"]
      assert 1 <= len(plan["groups"]) <= 48
      assert len(plan["groups"]) == len(original["groups"])


def test_every_complete_group_preserves_sites_paths_huts_and_water(
  evidence: tuple,
) -> None:
  context, receipt, recipe = evidence
  sites = [shape(s["geometry"]) for s in context["sites"]]
  paths = [shape(p["geometry"]).buffer(p["width"] / 2 + 1.2) for p in context["paths"]]
  path_tree = STRtree(paths)
  tree_clearances = STRtree(
    [
      Point(x, z).buffer(radius + 0.5)
      for x, z, radius in context["retainedTreeClearances"]
    ]
  )
  checked = 0
  for tile, modes in recipe["chunks"].items():
    for family, plan in modes.items():
      saved = receipt["packets"][tile][family]
      packet = base.read_json(base.OUT / saved["url"])
      ground = subject.packet_polygons(packet, "ground")
      obstacles = unary_union(
        [
          subject.packet_polygons(packet, k).buffer(1.19)
          for k in ["buildings", "water", "roads"]
        ]
      )
      ox, _, oz = packet["origin"]
      for row, provenance in zip(plan["groups"], saved["groups"], strict=True):
        x, _, z, dx, dz, _ = row
        full = subject.footprint(x + ox, z + oz, dx, dz)
        assert full.hausdorff_distance(shape(provenance["envelope"])) < 0.001
        assert sites[provenance["site"]].covers(full)
        assert ground.covers(full)
        assert not obstacles.intersects(full)
        assert len(path_tree.query(full, predicate="intersects")) == 0
        assert len(tree_clearances.query(full, predicate="intersects")) == 0
        if family == "minecraft":
          assert dx == 0 or dz == 0
        checked += 1
  assert checked > 1000


def test_candidate_selection_respects_holes_and_reproducibility() -> None:
  area = box(0, 0, 100, 100).difference(box(30, 30, 70, 70))
  points = subject.candidate_points(area)
  assert points == subject.candidate_points(area)
  assert points and all(area.covers(p) for p in points)
  assert not any(box(31, 31, 69, 69).covers(p) for p in points)


def test_guard_binds_path_water_and_ground_changes() -> None:
  polygon = {"ring": [[0, 0], [20, 0], [20, 20], [0, 20]], "holes": []}
  original = {
    "groundY": 3,
    "ground": [polygon],
    "buildings": [],
    "roads": [],
    "water": [],
    "bridges": [],
  }
  expected = subject.navigation_guard(original)
  for key in ["roads", "water", "bridges"]:
    assert subject.navigation_guard(dict(original, **{key: [polygon]})) != expected
  assert subject.navigation_guard(dict(original, ground=[])) != expected
