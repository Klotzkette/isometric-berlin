"""Replay the incremental source evidence without changing existing geometry."""

import base64
from collections import defaultdict

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

from scripts import build_outer_materials_v254 as build


def test_receipts_replay_only_exact_generic_surfaces_and_protect_previous_owners():
  evidence = build.base.read_json(build.EVIDENCE)
  output = build.base.read_json(build.OUTPUT)
  previous = build.base.read_json(build.previous.EVIDENCE)
  assert (
    build.appearance.digest(build.previous.OUTPUT) == evidence["previousReceiptSha256"]
  )
  assert not set(evidence["owners"]) & set(evidence["protectedOwners"])
  assert set(previous["owners"]) <= set(evidence["protectedOwners"])
  assert build.appearance.digest(build.ROOFS) == evidence["roofSourceSha256"]
  assert {row["owner"] for row in build.base.read_json(build.ROOFS)["owners"]} <= set(
    evidence["protectedOwners"]
  )
  assert 100 < len(evidence["owners"]) <= 250
  assert build.OUTPUT.stat().st_size < 26_000
  counts = defaultdict(int)
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
      expected, _ = build.previous.owned_colours(
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


def test_complete_owner_footprints_match_the_unchanged_retained_material_extract():
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
    assert set(row["tags"]) <= set(build.previous.KEYS)
    assert row["tags"] == record["tags"]
    source, mapped = unary_union(outlines[owner]), shape(record["geometry"])
    overlap = source.intersection(mapped).area
    assert min(overlap / source.area, overlap / mapped.area) >= 0.97
    assert min(row["coverage"]) >= 0.97
    assert tuple(build.previous.tones(row["tags"])) == tuple(
      tuple(row[key]) if row[key] is not None else None for key in ("wall", "roof")
    )


def test_no_receipt_can_override_an_earlier_material_vertex():
  current = build.base.read_json(build.OUTPUT)["packets"]
  previous = build.base.read_json(build.previous.OUTPUT)["packets"]
  assert set(current).isdisjoint(previous)
  # Earlier individually authored models and facade/roof source owners are
  # protected even when they carry a previously unused material tag.
  protected = set(build.base.read_json(build.EVIDENCE)["protectedOwners"])
  owners = set(build.base.read_json(build.EVIDENCE)["owners"])
  assert not owners & (protected | build.previous.protected_owners())
