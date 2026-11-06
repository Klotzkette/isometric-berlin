"""Complete source surfaces and independently cardinal theatre replacements."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_berlin_senate_v321 import old_mitte

triangulate = old_mitte.triangulate

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def words(model, field, stride):
  raw = base64.b64decode(model[field])
  planes = np.frombuffer(raw, dtype=np.uint8).reshape(4, -1)
  count = planes.shape[1]
  result = np.empty(count, dtype="<u4")
  previous = [0] * stride
  rows = count // stride
  for i in range(count):
    axis = i % stride
    column = axis * rows + i // stride
    zig = sum(int(planes[j, column]) << (j * 8) for j in range(4))
    delta = (zig >> 1) ^ -(zig & 1)
    previous[axis] = (previous[axis] + delta) & 0xFFFFFFFF
    result[i] = previous[axis]
  return result


def model_triangles(model):
  positions = words(model, "positions", 3).view("<f4").reshape(-1, 3)
  indices = words(model, "indices", 1).reshape(-1, 3)
  return positions[indices]


def triple_key(triangle):
  return tuple(
    sorted(
      np.asarray(triangle, dtype="<f4").view("<u4").reshape(3, 3).tolist(), key=tuple
    )
  )


def hashable(triangle):
  return tuple(tuple(p) for p in triple_key(triangle))


def test_complete_all_original_theatre_leaves_and_open_instrument_roofs():
  evidence = read(GEO / "youth-theatres-v322-source.json.gz")
  runtime = read(DATA / "youthTheatresV322.json")
  assert {k: v["leaves"] for k, v in evidence["statistics"].items()} == {
    "archenhold": 11,
    "atze": 1,
    "parkaue": 24,
    "strahl": 4,
  }
  for key, source in evidence["sources"].items():
    archive = ROOT / source["archive"]
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == source["archiveSha256"]
    parents = (
      source["parent"] if isinstance(source["parent"], list) else [source["parent"]]
    )
    original = []
    for parent in parents:
      element = extract_parent(archive, parent)
      original.extend(
        part_profile(p) for p in leaf_building_parts(element) or [element]
      )
    assert original == source["originalParts"]
    model = next(m for m in runtime["models"] if m["key"] == key + "-measured")
    actual = Counter(hashable(t) for t in model_triangles(model))
    count = 0
    for part in original:
      for face in part["surfaces"]:
        if (
          part["id"] in evidence["openInstrumentLeaves"]
          and face["kind"] != "RoofSurface"
        ):
          continue
        rings = [
          [[x, round(y + source["displayOffset"], 6), z] for x, y, z in ring]
          for ring in face["rings"]
        ]
        for triangle in triangulate(rings):
          assert actual[hashable(triangle)] >= 1, (key, part["id"], face["kind"])
          count += 1
    assert count > 0
  assert len(evidence["openInstrumentLeaves"]) == 2
  assert runtime["oldArchenholdBuildings"] == evidence["previousArchenholdBuildings"]


def test_native_is_independent_cardinal_geometry_and_preserves_court_air():
  data = read(DATA / "youthTheatresV322.json")
  for model in data["models"]:
    if not model["native"]:
      continue
    triangles = model_triangles(model)
    assert all(np.any(np.ptp(t, axis=0) < 1e-6) for t in triangles), model["key"]
    assert model["triangles"] == len(triangles)
  for key in ["archenhold", "atze", "parkaue", "strahl"]:
    source = read(GEO / "youth-theatres-v322-source.json.gz")["sources"][key]
    retained = unary_union(
      [
        Polygon(p["ring"], p["holes"])
        for p in source["originalParts"]
        if p["id"]
        not in read(GEO / "youth-theatres-v322-source.json.gz")["openInstrumentLeaves"]
      ]
    )
    for row in data["navigation"][key]["native"]:
      p = Polygon(row["ring"], row["holes"])
      if key == "archenhold" and row["top"] - row["bottom"] <= 0.17:
        continue
      assert retained.buffer(0.00001).covers(p), key


def test_atze_is_disjoint_from_all_complete_neighbor_campus_families():
  source = read(GEO / "youth-theatres-v322-source.json.gz")["sources"]["atze"]
  own = unary_union([Polygon(p["ring"], p["holes"]) for p in source["originalParts"]])
  assert (
    round(
      min(p["ground_y_m"] for p in source["originalParts"]) + source["displayOffset"], 6
    )
    == 5.2
  )
  for parent in [
    "DEBE01YYK0003tI7",
    "DEBE01YYK000448O",
    "DEBE01YYK0003tqP",
    "DEBE01YYK0003xxH",
  ]:
    element = extract_parent(ROOT / source["archive"], parent)
    other = unary_union(
      [
        Polygon(p["ring"], p["holes"])
        for p in map(part_profile, leaf_building_parts(element) or [element])
      ]
    )
    assert own.intersection(other).area < 1e-8
  assert all(
    "92578126" not in m["key"] for m in read(DATA / "youthTheatresV322.json")["models"]
  )


def test_exact_joint_source_family_and_finite_theatre_packet_scope():
  joint = read(DATA / "eastParksJointPreviousV322.json")
  old = read(DATA / "archenholdPreviousV322.json")
  assert joint["sourceBuildings"] == old["sourceBuildings"]
  assert len(joint["oldNavigation"]) == 3
  assert {p["id"] for p in joint["sourceBuildings"]} == {
    "relation/2309788",
    "way/142701798",
    "way/1234312660",
  }
  assert len(joint["sourceCenotaphs"]) == 16
  for name, original in old["recipes"]["variants"].items():
    for part in original["parts"]:
      combined = next(
        p
        for p in joint["recipes"]["variants"][name]["parts"]
        if p["name"] == part["name"]
      )
      assert all(combined[k] == v for k, v in part.items() if k != "retire")
      assert set(part["retire"]) <= set(combined["retire"])
      assert len(combined["retire"]) == len(set(combined["retire"]))
  packet = read(DATA / "youthTheatreFrontsV322Packets.json")
  assert packet["keys"] == ["drawn:-3_5", "minecraft:-3_5"]
  assert packet["keys"] == read(DATA / "youthTheatreFrontsV322PacketIndex.json")["keys"]
  assert all(
    p["owners"] == ["DEBE07YY900009Vl"] and p["retire"] == []
    for p in packet["packets"].values()
  )
