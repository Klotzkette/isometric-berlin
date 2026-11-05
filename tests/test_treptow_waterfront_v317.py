"""Complete measured leaves, exact immutable predecessor faces and local fits."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_breitscheid_towers_v161 import triangles_for  # noqa: E402

GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(path: Path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)


def key(triangle):
  return tuple(
    sorted(
      tuple(row) for row in np.rint(np.round(np.asarray(triangle) * 100, 6)).astype(int)
    )
  )


def test_every_original_lod2_sheet_survives_the_new_measured_models():
  source = read(GEO / "treptow-waterfront-v317-source.json.gz")
  core = read(DATA / "treptowWaterfrontV317Core.json")
  evidence = read(GEO / "treptow-waterfront-v317-evidence.json")
  assert [len(s["parts"]) for s in source["sites"]] == [75, 5]
  assert [sum(len(p["surfaces"]) for p in s["parts"]) for s in source["sites"]] == [
    430,
    51,
  ]
  for site in source["sites"]:
    m = next(
      m for m in core["models"] if not m["native"] and m["key"].startswith(site["key"])
    )
    ps = (
      np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3) / 100
      + m["origin"]
    )
    ix = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    actual = Counter(key(ps[t]) for t in ix)
    offset = next(s["yOffset"] for s in evidence["models"] if s["key"] == site["key"])
    for p in site["parts"]:
      for s in p["surfaces"]:
        for triangle in triangles_for(s["rings"]):
          transformed = np.asarray(triangle) + [0, offset, 0]
          rounded = np.rint(transformed * 100).astype(int)
          if not np.any(np.cross(rounded[1] - rounded[0], rounded[2] - rounded[0])):
            continue
          k = key(transformed)
          assert actual[k] > 0, (site["key"], p["id"], s["kind"], k)
          actual[k] -= 1


def test_only_six_exact_immutable_packets_and_three_named_owners_are_admitted():
  evidence = read(GEO / "treptow-waterfront-v317-evidence.json")
  plans = read(DATA / "treptowWaterfrontV317Packets.json")
  assert set(plans["keys"]) == {
    f"{mode}:{tile}"
    for mode in ["drawn", "minecraft"]
    for tile in ["10_4", "10_5", "ring182-11_5"]
  }
  owners = {"DEBE09YYP0000AJc", "DEBE09YYP0000E8C", "OSM-way-45197923"}
  for r in evidence["transfers"]:
    mode, tile = r["key"].split(":")
    path = ROOT / f"src/app/public/mesh/surrounding-berlin-v159/{tile}.{mode}.json.gz"
    assert hashlib.sha256(path.read_bytes()).hexdigest() == r["packetSha256"]
    p = plans["packets"][r["key"]]
    assert set(p["owners"]) <= owners
    assert len(p["retireNav"]) == r["nav"]
    assert sum(len(m["triangles"]) for m in p["retire"]) == r["triangles"]
    assert len(p["retireLines"]) == r["lines"]
    assert all(t == sorted(set(t)) for t in [m["triangles"] for m in p["retire"]])
    assert (
      p["records"] and p["preparedRecords"] and p["navGuard"] and p["preparedNavGuard"]
    )


def test_native_bodies_and_navigation_have_identical_cardinal_heights():
  core = read(DATA / "treptowWaterfrontV317Core.json")
  nav = read(DATA / "treptowWaterfrontV317Navigation.json")["minecraft"]
  boxes = set()
  for q in core["models"]:
    if not q["native"]:
      continue
    columns = [np.frombuffer(base64.b64decode(c), "<u2") / 100 for c in q["columns"]]
    assert all(len(c) == q["count"] for c in columns)
    for r in zip(*columns, strict=True):
      x, y, z, w, h, d = r
      x, y, z = np.asarray([x, y, z]) + q["origin"]
      boxes.add(
        tuple(
          np.rint(
            np.asarray(
              [x - w / 2, z - d / 2, x + w / 2, z + d / 2, y - h / 2, y + h / 2]
            )
            * 100
          ).astype(int)
        )
      )
  for parent, x, z, x1, z1, low, high in nav:
    target = tuple(np.rint(np.asarray([x, z, x1, z1, low, high]) * 100).astype(int))
    if parent == "badeschiff-pool":
      target = (*target[:4], target[4], target[5] - 4)
    assert target in boxes, (parent, target)
