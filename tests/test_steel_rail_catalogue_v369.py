"""Regression tests for railway/road separation and measured deck registration."""

from collections import Counter

import numpy as np
from shapely.geometry import LineString, Point, Polygon, box

from scripts import build_steel_rail_catalogue_v369 as bridges


def rendered():
  audit = bridges.read(bridges.EVIDENCE)["outlineAudit"]
  tiles = bridges.read(bridges.DATA / "steelRailSpansV369.json")["tiles"]
  positions = Counter()
  for row in audit:
    if row["outcome"] != "rendered":
      continue
    host = row["host"]
    index = positions[host]
    positions[host] += 1
    span = tiles[host]["drawn"][index]
    assert span == tiles[host]["minecraft"][index]
    yield row, span


def test_bridge_way_must_carry_the_track_on_the_same_level():
  ring = [[0, 0], [19, 0], [19, 9], [0, 9], [0, 0]]
  candidates = {
    "ways": [
      {"id": 1, "points": ring, "tags": {"man_made": "bridge", "layer": "2"}},
      {
        "id": 2,
        "points": [[-4, 4], [24, 4]],
        "tags": {"railway": "rail", "bridge": "yes", "layer": "1"},
      },
      {
        "id": 3,
        "points": [[-4, 5], [24, 5]],
        "tags": {"railway": "rail", "bridge": "yes", "layer": "2"},
      },
      {
        "id": 4,
        "points": [[-4, 3], [24, 3]],
        "tags": {"railway": "rail", "bridge": "yes", "layer": "2", "tunnel": "yes"},
      },
    ],
    "relations": [],
  }
  [(_, _, tracks)] = list(bridges.outlines_and_matches(candidates))
  assert [r["id"] for r, _ in tracks] == [3]


def test_skewed_ends_follow_surveyed_edges_instead_of_square_cut():
  deck = Polygon([(1, 0), (16, 0), (19, 5), (4, 5)])
  line, (left, right), width = bridges.bridge_sides(deck, np.array([1.0, 0.0]))
  assert list(line.coords) == [(2.5, 2.5), (17.5, 2.5)]
  assert left == [[4.0, 5.0], [19.0, 5.0]]
  assert right == [[1.0, 0.0], [16.0, 0.0]]
  assert width == 5.0


def test_known_steel_examples_and_material_neutral_geometry_have_distinct_evidence():
  pairs = {row["id"]: (row, span) for row, span in rendered()}
  for ident in bridges.STADTBAHN | set(bridges.PHOTO) | {934857213, 1158221686}:
    row, span = pairs[ident]
    assert row["trackWays"]
    if (
      ident != 432421235
    ):  # Kiefholzstraße is proved by the independent site photograph.
      assert row["dbRows"]
    assert row["evidence"] in bridges.REFERENCES
    assert span["trackOffsets"] and span["form"] != "unclassified"
  obsolete, current = pairs[533541339]
  assert obsolete["trackWays"] == [] and not current["deck"] and current["bow"]
  assert 365734778 not in pairs
  for ident in [195397543, 574155311]:
    assert ident not in pairs
  assert pairs[333893460][1]["bow"] and pairs[339298147][1]["through"]
  assert pairs[135703568][1]["riveted"] and pairs[408340895][1]["riveted"]
  neutral = [(r, s) for r, s in pairs.values() if s["form"] == "unclassified"]
  assert neutral
  for row, span in neutral:
    assert row["cadastralDeck"] and row["dbRows"] and row["trackWays"]
    assert span["deck"] and span["trackOffsets"]
    assert set(row["surfaceProbes"]) == {"drawn", "minecraft"}
    assert not ({"through", "trussHeight", "bow", "riveted", "paint"} & span.keys())


def test_extents_surveyed_supports_and_citywide_audit_are_consistent():
  info = bridges.read(bridges.EVIDENCE)
  audit = info["reconciliation"]
  db = bridges.read(bridges.DB)["records"]
  assert [r[0] for r in audit["dbRegister"]] == list(range(len(db)))
  track_ids = {
    w["id"]
    for w in bridges.read(bridges.OSM)["ways"]
    if w["tags"].get("railway") in bridges.RAIL
  }
  assert {r[0] for r in audit["mappedBridgeTrackWays"]} == track_ids
  exterior = {
    r["id"]: box(*r["bounds"]).buffer(0.015)
    for r in bridges.read(bridges.DATA / "steelRailExteriorV369.json")
  }
  host_ids = set(bridges.read(bridges.DATA / "steelRailHostIdsV369.json"))
  tiles = bridges.read(bridges.DATA / "steelRailSpansV369.json")["tiles"]
  assert set(tiles) == set(exterior) | host_ids and not set(exterior) & host_ids
  for tag in host_ids:
    assert set(tiles[tag]["positionSha"]) == {"drawn", "minecraft"}
    assert all(len(value) == 64 for value in tiles[tag]["positionSha"].values())
  seen_supports = set()
  for row, span in rendered():
    assert all(a != b for a, b in zip(span["course"], span["course"][1:]))
    if row["host"] in exterior:
      assert all(
        exterior[row["host"]].covers(Point(pt)) for side in span["edges"] for pt in side
      )
    points = LineString([pt[::2] for pt in span["course"]])
    assert points.length > 4
    if span.get("piers"):
      assert len(span["piers"]) == len(row["piers"])
      for pier, source in zip(span["piers"], row["piers"]):
        assert source["id"] not in seen_supports
        seen_supports.add(source["id"])
        assert pier["high"] > pier["low"]
        assert (
          pier["a"] == source["a"]
          and pier["b"] == source["b"]
          and pier["width"] == source["width"]
        )
  assert seen_supports
