"""Exact source/material joins and non-destructive outer-colour compilation."""

import base64
from collections import defaultdict

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

from scripts import build_outer_materials_v232 as build


def test_material_receipts_replay_only_original_generic_source_vertices():
  evidence = build.base.read_json(build.EVIDENCE)
  output = build.base.read_json(build.OUTPUT)
  expected_counts = defaultdict(int)
  assert 0 < len(evidence["owners"]) <= 100
  assert build.OUTPUT.stat().st_size < 8_000
  assert not set(evidence["owners"]) & set(evidence["protectedOwners"])
  for asset in evidence["assets"]:
    path = build.OUT / asset["url"]
    assert build.appearance.digest(path) == asset["sha256"]
    packet = build.base.read_json(path)
    family = "minecraft" if ".minecraft." in path.name else "drawn"
    tile = path.name.removesuffix(f".{family}.json.gz")
    assert tile.startswith(build.PREFIXES)
    for receipt in output["packets"][family + ":" + tile]:
      part = packet["meshes"][receipt["mesh"]]
      assert part["kind"] == "city"
      assert build.appearance.fingerprint(part) == receipt["fingerprint"]
      expected, _ = build.owned_colours(
        part, packet, evidence["owners"], family == "minecraft"
      )
      actual = {}
      for first, count, colour in np.frombuffer(
        base64.b64decode(receipt["runs"]), "<u4"
      ).reshape(-1, 3):
        packed = output["palette"][colour]
        rgb = packed >> 16, (packed >> 8) & 255, packed & 255
        for vertex in range(int(first), int(first + count)):
          assert vertex not in actual
          actual[vertex] = rgb
      assert actual == expected
      expected_counts[family + "Vertices"] += len(actual)
  assert dict(expected_counts) == evidence["counts"]


def test_source_matches_retain_complete_footprints_and_only_material_tags():
  evidence = build.base.read_json(build.EVIDENCE)
  context = build.base.read_json(build.CONTEXT)
  assert build.appearance.digest(build.CONTEXT) == evidence["contextSha256"]
  # The retained extract is replayable in a fresh clone; its original large
  # GDAL cache is optional and intentionally not distributed with the repo.
  original = build.ROOT / context["source"]
  assert len(context["sha256"]) == 64
  if original.exists():
    assert build.appearance.digest(original) == context["sha256"]
  records = {r["id"]: r for r in context["records"]}
  outlines = defaultdict(list)
  for asset in evidence["assets"]:
    if ".drawn." not in asset["url"]:
      continue
    packet = build.base.read_json(build.OUT / asset["url"])
    ox, _, oz = packet["origin"]
    for row in packet["nav"]["buildings"]:
      if row["sourceId"] in evidence["owners"]:
        outlines[row["sourceId"]].append(
          translate(Polygon(row["ring"], row["holes"]), ox, oz)
        )
  for owner, row in evidence["owners"].items():
    assert set(row["tags"]) <= set(build.KEYS)
    assert row["tags"] == records[row["osm"]]["tags"]
    source, mapped = (
      unary_union(outlines[owner]),
      shape(records[row["osm"]]["geometry"]),
    )
    overlap = source.intersection(mapped).area
    assert min(overlap / source.area, overlap / mapped.area) >= 0.97
    assert min(row["coverage"]) >= 0.97


def test_ambiguous_material_tags_never_fall_back_to_arbitrary_paint():
  assert build.tones(
    {"building:colour": "red;white", "building:material": "brick"}
  ) == (None, None)
  assert build.tones({"building:colour": "white", "facade:colour": "red"}) == (
    None,
    None,
  )
  assert build.tones({"roof:colour": "various", "roof:material": "roof_tiles"}) == (
    None,
    None,
  )
  assert build.tones({"building:material": "brick", "facade:material": "plaster"}) == (
    None,
    None,
  )
  assert (
    build.tones({"building:colour": "white", "building:material": "brick"})[0]
    == build.appearance.NAMED["white"]
  )


def test_overlapping_owner_and_changed_source_wall_fail_closed():
  def encode(values, dtype):
    return base64.b64encode(np.array(values, dtype).tobytes()).decode()

  part = dict(
    kind="city",
    positions=encode(
      [[0, 1300, 0], [1000, 1300, 0], [1000, 3300, 0], [0, 3300, 0]], "<u2"
    ),
    colors=encode([build.WALL] * 4, "u1"),
    indices=encode([0, 1, 2, 0, 2, 3], "<u4"),
  )
  building = dict(
    sourceId="one",
    ring=[[0, 0], [10, 0], [10, 10], [0, 10]],
    holes=[],
    minHeight=0,
    height=20,
  )
  packet = dict(origin=[0, -10, 0], nav=dict(groundY=3, buildings=[building]))
  selected = {"one": dict(wall=(200, 170, 150), roof=None)}
  assert len(build.owned_colours(part, packet, selected)[0]) == 4
  packet["nav"]["buildings"].append(dict(building, sourceId="other"))
  assert not build.owned_colours(part, packet, selected)[0]
  packet["nav"]["buildings"].pop()
  building["height"] = 20.1
  assert not build.owned_colours(part, packet, selected)[0]
