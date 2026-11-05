"""Exact retained source and independent native face admission for v318."""

import base64
import gzip
import hashlib
import json
import struct

import numpy as np
from shapely.geometry import box

from scripts import build_dom_east_housing_v318 as build


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


def rows(part):
  count, size = part["profileCount"], 6 if part["native"] else 7
  packed = base64.b64decode(part["profiles"])
  n = count * size
  assert len(packed) == n * 4
  words, previous = [], 0
  for i in range(n):
    v = sum(packed[byte * n + i] << (8 * byte) for byte in range(4))
    previous = (previous + ((v >> 1) ^ -(v & 1))) & 0xFFFFFFFF
    words.append(previous)
  floats = np.asarray(words, dtype="<u4").view("<f4")
  result = []
  for i in range(count):
    p = [
      float(floats[c * count + i]) if c < size - 2 else words[c * count + i]
      for c in range(size)
    ]
    x, z, w, d, *tail, pattern = p
    for y, h in part["patterns"][pattern]:
      result.append([x, y, z, w, h, d, *tail])
  fmt = "<6fI" if part["native"] else "<7fI"
  assert len(result) == part["count"]
  assert (
    hashlib.sha256(b"".join(sorted(struct.pack(fmt, *r) for r in result))).hexdigest()
    == part["allRowWordsSha256"]
  )
  return result


def test_original_complete_owner_and_delivered_source_are_unmodified():
  evidence = build.read(build.EVIDENCE)
  assert evidence["sourceGeometryRetained"] and not evidence["automaticRetirement"]
  assert evidence["noNavigationChange"]
  assert evidence["sheetCount"] == 99
  for item in evidence["inputs"]:
    p = build.ROOT / item["path"]
    assert build.sha(p) == item["sha256"]
    assert p.stat().st_size == item["bytes"]
  original = next(
    b
    for b in build.read(build.GEO / "alt-mitte-v169/source-391_5820-00.json.gz")[
      "buildings"
    ]
    if b["id"] == build.OWNER
  )
  assert evidence["completeOfficialFamily"] == original
  source = build.source_packets(build.OWNER, "4_-1", False, set())
  for wall in build.walls(original):
    if wall["sheet"] in build.SHEETS:
      assert (
        build.projected_wall(source, wall["frame"])
        .buffer(0.025)
        .covers(box(0.3, 17.1, wall["frame"][3] - 0.3, 46.35))
      )


def test_every_native_fitting_has_its_own_complete_cardinal_source_support():
  evidence = build.read(build.EVIDENCE)
  family = evidence["completeOfficialFamily"]
  source = build.source_packets(build.OWNER, "4_-1", True, set())
  planes = build.native_planes(source, build.footprint(family).bounds, [])
  parts = decode()
  assert [len(rows(p)) for p in parts] == [2773, 8165]
  fits = evidence["nativeFits"]
  assert len(fits) == parts[1]["count"]
  lookup = {(axis, coordinate): polygon for axis, coordinate, polygon in planes}
  actual = sorted(tuple(r[:6]) for r in rows(parts[1]))
  expected = []
  for fit in fits:
    axis, plane = fit["axis"], fit["plane"]
    assert lookup[(axis, plane)].buffer(0.001).covers(box(*fit["rectangle"]))
    assert abs(fit["sourcePosition"][0 if axis == 0 else 1] - plane) <= 4.1
    b = np.asarray(fit["bounds"])
    expected.append(
      tuple(np.asarray([*(b[:3] + b[3:]) / 2, *(b[3:] - b[:3])], dtype="<f4"))
    )
  assert np.max(np.abs(np.asarray(actual) - np.asarray(sorted(expected)))) < 0.00013
  assert build.OUTPUT.stat().st_size < 8500
  assert build.sha(build.OUTPUT) == evidence["runtime"]["sha256"]
