"""Actual retained owner and independent native-fit checks for the finite v315 addition."""

import base64
import gzip
import hashlib
import json
import struct

import numpy as np
from shapely.geometry import box

from scripts import build_linden_east_context_v315 as build


def decode():
  transport = json.loads(build.OUTPUT.read_bytes())
  alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#"
  s, words = transport["payload"], bytearray()
  for at in range(1, len(s), 5):
    value = 0
    for char in s[at : at + 5]:
      value = value * 85 + alphabet.index(char)
    words.extend(value.to_bytes(4, "big"))
  raw = gzip.decompress(words[: len(words) - int(s[0])])
  assert len(raw) == transport["decodedBytes"]
  assert hashlib.sha256(raw).hexdigest() == transport["decodedSha256"]
  return json.loads(raw)


def test_complete_original_families_and_actual_delivered_walls_remain_unchanged():
  evidence = build.read(build.EVIDENCE)
  assert evidence["sourceGeometryRetained"] is True
  assert evidence["automaticRetirement"] is False
  assert len(evidence["inputs"]) == 23
  for item in evidence["inputs"]:
    path = build.ROOT / item["path"]
    assert build.sha(path) == item["sha256"]
    assert path.stat().st_size == item["bytes"]
  assert [s["sheetCount"] for s in evidence["sites"]] == [17, 292, 51]
  assert [len(s["fittedSheets"]) for s in evidence["sites"]] == [1, 24, 9]
  for name, (tile, owner, chunk) in build.OWNERS.items():
    original = next(
      b
      for b in build.read(build.GEO / f"alt-mitte-v169/source-{tile}-00.json.gz")[
        "buildings"
      ]
      if b["id"] == owner
    )
    assert evidence["completeOfficialFamilies"][owner] == original
    site = next(s for s in evidence["sites"] if s["key"] == name)
    triangles = build.source_packets(owner, chunk, False, set())
    selected = {s["sheet"] for s in site["fittedSheets"]}
    for wall in build.walls(original):
      if wall["sheet"] not in selected:
        continue
      projection = build.projected_wall(triangles, wall["frame"])
      assert projection.buffer(0.025).covers(
        box(0.025, 6, wall["frame"][3] - 0.025, 27.9)
      )


def test_native_members_are_outside_core_solids_and_on_complete_actual_cardinal_faces():
  evidence, parts = build.read(build.EVIDENCE), decode()
  for site in evidence["sites"]:
    _, owner, chunk = build.OWNERS[site["key"]]
    family = evidence["completeOfficialFamilies"][owner]
    source = build.source_packets(owner, chunk, True, set())
    planes = build.native_planes(
      source, build.footprint(family).bounds, site["nativeSourceColumns"]
    )
    part = next(p for p in parts if p["key"] == site["key"] and p["native"])
    rows = list(struct.iter_unpack("<6fI", base64.b64decode(part["boxes"])))
    assert len(rows) == len(site["nativeFits"]) == part["boxCount"]
    for row, fit in zip(rows, site["nativeFits"], strict=True):
      x, y, z, w, h, d, _ = row
      actual = np.array(
        [x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2]
      )
      assert np.max(np.abs(actual - fit["bounds"])) < 0.00013
      assert any(
        axis == fit["axis"]
        and coordinate == fit["plane"]
        and polygon.buffer(0.001).covers(box(*fit["rectangle"]))
        for axis, coordinate, polygon in planes
      )
      assert all(
        not all(
          min(actual[i + 3], col[i + 3]) - max(actual[i], col[i]) > 0.001
          for i in range(3)
        )
        for col in site["nativeSourceColumns"]
      )
      axis = fit["axis"]
      source_coordinate = fit["sourcePosition"][0 if axis == 0 else 1]
      assert abs(source_coordinate - fit["plane"]) <= 4.1


def test_small_transport_and_no_existing_navigation_or_source_output():
  evidence = build.read(build.EVIDENCE)
  assert build.OUTPUT.stat().st_size < 45000
  assert build.sha(build.OUTPUT) == evidence["runtime"]["sha256"]
  assert set(decode()[0]) == {"key", "native", "boxCount", "boxes"}
  assert len(decode()) == 6
