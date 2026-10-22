"""Replay bounded v263 source evidence and exact colour-only ownership."""

import base64
from collections import defaultdict

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

from scripts import build_outer_materials_v263 as build


def test_receipts_replay_original_generic_surfaces_without_old_owner_overrides():
  evidence = build.base.read_json(build.EVIDENCE)
  output = build.base.read_json(build.OUTPUT)
  protected, sources = build.protected_owners()
  assert sources == evidence["protectionSources"]
  assert not set(evidence["owners"]) & protected
  assert set(evidence["protectedOwners"]) == protected
  assert evidence["selectedTiles"] == list(build.TILES)
  assert len(evidence["owners"]) == 449
  assert build.OUTPUT.stat().st_size < 28_000
  counts = defaultdict(int)
  for asset in evidence["assets"]:
    path = build.OUT / asset["url"]
    assert build.appearance.digest(path) == asset["sha256"]
    packet = build.base.read_json(path)
    family = "minecraft" if ".minecraft." in path.name else "drawn"
    tile = path.name.removesuffix(f".{family}.json.gz")
    assert tile in build.TILES
    for receipt in output["packets"][family + ":" + tile]:
      part = packet["meshes"][receipt["mesh"]]
      assert part["kind"] == "city"
      assert build.appearance.fingerprint(part) == receipt["fingerprint"]
      expected, _ = build.previous.previous.owned_colours(
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
      counts[family + "Vertices"] += len(actual)
  assert dict(counts) == evidence["counts"]


def test_complete_owner_footprints_match_retained_observations_and_source_priority():
  evidence = build.base.read_json(build.EVIDENCE)
  context = build.base.read_json(build.CONTEXT)
  assert build.appearance.digest(build.CONTEXT) == evidence["contextSha256"]
  records = {row["id"]: row for row in context["records"]}
  outlines = defaultdict(list)
  for asset in evidence["sourceAssets"]:
    assert build.appearance.digest(build.OUT / asset["url"]) == asset["sha256"]
    packet = build.base.read_json(build.OUT / asset["url"])
    ox, _, oz = packet["origin"]
    for row in packet["nav"]["buildings"]:
      if row["sourceId"] in evidence["owners"]:
        outlines[row["sourceId"]].append(
          translate(Polygon(row["ring"], row["holes"]), ox, oz)
        )
  for owner, row in evidence["owners"].items():
    record = records[row["osm"]]
    assert set(row["tags"]) <= set(build.previous.previous.KEYS)
    assert row["tags"] == record["tags"]
    source, mapped = unary_union(outlines[owner]), shape(record["geometry"])
    overlap = source.intersection(mapped).area
    assert min(overlap / source.area, overlap / mapped.area) >= 0.97
    assert min(row["coverage"]) >= 0.97
    assert tuple(build.previous.previous.tones(row["tags"])) == tuple(
      tuple(row[key]) if row[key] is not None else None for key in ("wall", "roof")
    )
  tones = build.previous.previous.tones
  assert tones({"building:colour": "yellow", "building:material": "brick"})[0] == (
    build.appearance.colour("yellow")
  )
  assert (
    tones({"building:colour": "white;red", "building:material": "brick"})[0] is None
  )
  assert tones({"building:colour": "white", "facade:colour": "red"})[0] is None


def test_no_new_receipt_can_override_an_earlier_material_packet():
  current = build.base.read_json(build.OUTPUT)["packets"]
  for path in (build.previous.OUTPUT, build.previous.previous.OUTPUT):
    previous = build.base.read_json(path)["packets"]
    assert set(current).isdisjoint(previous)
  assert len(current) == 30
  assert len({key.split(":")[1] for key in current}) == 15
