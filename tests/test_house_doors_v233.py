"""Public mapped entrance anchors must bind to actual unmodified wall sheets."""

from __future__ import annotations

from collections import defaultdict

import numpy as np
from shapely.geometry import LineString, Point, Polygon, shape

from scripts import build_house_doors_v233 as doors
from scripts.spree_bridge_lineage_v242 import assert_preserved_v242


def test_all_retained_entrances_have_ground_level_source_and_bounded_district() -> None:
  context = doors.base.read_json(doors.CONTEXT)
  evidence = doors.base.read_json(doors.EVIDENCE)
  regions = doors.regions()
  assert evidence["contextSha256"] == doors.base.digest(doors.CONTEXT)
  nodes = {row["id"]: row for row in context["entrances"]}
  assert len(nodes) == len(context["entrances"])
  assert {
    "Charlottenburg",
    "Wilmersdorf",
    "Schöneberg",
    "Mitte",
    "Kreuzberg",
    "Friedrichshain",
  } <= set(evidence["counts"])
  for row in evidence["doors"]:
    node = nodes[row["node"]]
    assert node["tags"]["entrance"] in {"yes", "main", "home", "staircase"}
    assert node["tags"].get("level", "0") in {"0", "0.0"}
    assert regions[row["district"]].buffer(0.5).covers(Point(*row["point"]))
    mapped = shape(context["buildings"][row["mappedBuildingIndex"]]["geometry"])
    assert mapped.boundary.distance(Point(*node["point"])) <= 0.080001
    assert LineString([row["a"], row["b"]]).distance(Point(*row["point"])) < 1e-6
    assert np.linalg.norm(np.array(row["point"]) - row["mappedPoint"]) <= 0.350001
  assert all(
    set(row["tags"]) <= {"entrance", "level", "door", "material", "colour"}
    for row in nodes.values()
  )


def test_replay_all_emitted_doors_against_exact_actual_source_wall_triangles() -> None:
  evidence = doors.base.read_json(doors.EVIDENCE)
  manifest = doors.base.read_json(doors.OUT / "manifest.json")
  descs = {d["id"]: d for d in manifest["chunks"]}
  grouped = defaultdict(list)
  for row in evidence["doors"]:
    grouped[row["chunk"]].append(row)
  for chunk, rows in grouped.items():
    packet = doors.base.read_json(doors.OUT / descs[chunk]["drawn"]["url"])
    sheets = doors.triangles(packet)
    ox, oy, oz = packet["origin"]
    for row in rows:
      assert doors.base.source_wall_exists(
        sheets,
        [row["a"][0] - ox, row["a"][1] - oz],
        [row["b"][0] - ox, row["b"][1] - oz],
        row["low"] - oy,
        row["high"] - oy,
      )
      again = doors.door_face(packet, row["sourceRing"], row["mappedPoint"], sheets)
      assert again is not None and again["point"] == row["point"]
      assert row["sourceRing"]["minHeight"] <= 0.1
      assert Polygon(row["sourceRing"]["ring"], row["sourceRing"]["holes"]).is_valid
  for receipt in evidence["oldAssets"]:
    assert_preserved_v242(doors.OUT / receipt["url"], receipt["sha256"])


def test_source_wall_rejects_unmapped_distance_and_above_ground_part() -> None:
  evidence = doors.base.read_json(doors.EVIDENCE)
  row = evidence["doors"][0]
  manifest = doors.base.read_json(doors.OUT / "manifest.json")
  desc = next(d for d in manifest["chunks"] if d["id"] == row["chunk"])
  packet = doors.base.read_json(doors.OUT / desc["drawn"]["url"])
  sheets = doors.triangles(packet)
  assert doors.door_face(packet, row["sourceRing"], [1e8, 1e8], sheets) is None
  assert (
    doors.door_face(
      packet, {**row["sourceRing"], "minHeight": 1}, row["mappedPoint"], sheets
    )
    is None
  )


def test_steglitz_zehlendorf_extension_retains_every_v133_recipe() -> None:
  context = doors.base.read_json(doors.CONTEXT)
  evidence = doors.base.read_json(doors.EVIDENCE)
  runtime = doors.base.read_json(doors.OUTPUT)["chunks"]
  southwest = {
    "Steglitz",
    "Lichterfelde",
    "Lankwitz",
    "Zehlendorf",
    "Dahlem",
    "Nikolassee",
    "Wannsee",
    "Schlachtensee",
  }
  assert southwest <= set(context["districts"])
  assert len(context["outerBuildingSourceSha256"]) == 64
  assert all(
    evidence["counts"].get(name, 0)
    for name in ("Steglitz", "Dahlem", "Lichterfelde", "Zehlendorf")
  )
  previous = evidence["preservedV133"]["chunks"]
  assert len(previous) == 157
  assert sum(row["drawn"]["count"] for row in previous.values()) == 3150
  assert sum(row["minecraft"]["count"] for row in previous.values()) == 1681
  for chunk, entry in previous.items():
    for family, receipt in entry.items():
      rows = runtime[chunk][family]["doors"][: receipt["count"]]
      assert doors.recipe_digest(rows) == receipt["sha256"]
  roof_owners = {
    row["owner"]
    for row in doors.base.read_json(doors.GEO / "roof-house-v233-source.json.gz")[
      "owners"
    ]
  }
  assert not roof_owners.intersection(row["owner"] for row in evidence["doors"])
