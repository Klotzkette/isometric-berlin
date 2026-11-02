"""Independent whole-source and exact fitting-retirement checks for v302."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
from shapely import Point, Polygon
from shapely.geometry import box
from shapely.ops import unary_union
from shapely.strtree import STRtree

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts
from scripts.build_bebelplatz_building_source import part_profile
from scripts.build_breitscheid_towers_v161 import triangles_for

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(path):
  b = path.read_bytes()
  return json.loads(gzip.decompress(b) if path.suffix == ".gz" else b)


def test_all_89_official_parts_are_exact_complete_archive_leaves():
  source = read(GEO / "west-kiez-v302-core-source.json.gz")
  expected = {s["parent"]: s for s in source["sites"]}
  actual = {}
  for a in source["archives"]:
    path = GEO / "raw/lod2" / a["url"].split("/")[-1]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == a["sha256"]
    with zipfile.ZipFile(path) as archive:
      for name in archive.namelist():
        if not name.lower().endswith((".xml", ".gml", ".citygml")):
          continue
        with archive.open(name) as stream:
          for _, element in ET.iterparse(stream, events=["end"]):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            identity = element.get(GML_ID)
            if identity in expected:
              actual[identity] = [
                part_profile(p) for p in list(leaf_building_parts(element)) or [element]
              ]
            element.clear()
  assert set(actual) == set(expected)
  assert sum(map(len, actual.values())) == 89
  for identity, parts in actual.items():
    assert parts == expected[identity]["parts"]
  model = read(DATA / "westKiezV302Core.json")
  for site in model["sites"]:
    complete = expected[site["parent"]]
    triangles = [
      t
      for p in complete["parts"]
      for s in p["surfaces"]
      for t in triangles_for(s["rings"])
    ]
    positions = np.frombuffer(
      base64.b64decode(site["drawn"]["positions"]), "<f4"
    ).reshape(-1, 3)
    indices = np.frombuffer(base64.b64decode(site["drawn"]["indices"]), "<u4")
    required = np.array(
      [
        [round(q[i] - site["origin"][i], 3) for i in range(3)]
        for t in triangles
        for q in t
      ],
      dtype="<f4",
    )
    assert np.array_equal(positions, required)
    assert np.array_equal(indices, np.arange(len(required), dtype="<u4"))


def test_old_prisms_and_native_tuples_are_full_actual_exclusive_source_records():
  owners = read(DATA / "westKiezV302CoreOwners.json")
  core = read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")
  voxel = read(ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json")
  byid = {p["id"]: p for p in core["buildings"]}
  ids = {p["id"] for p in owners["oldPrisms"]}
  assert len(ids) == 18 and all(byid[p["id"]] == p for p in owners["oldPrisms"])
  assert (
    owners["nativeClasses"] == voxel["classes"]
    and owners["nativeGrid"] == voxel["grid"]
  )
  for row in owners["nativeRows"]:
    assert row["row"] == voxel["building_rows"][row["index"]]
  shapes = [
    Polygon(np.array(p["ring"]) / 10, [np.array(h) / 10 for h in p.get("holes", [])])
    for p in core["buildings"]
  ]
  tree = STRtree(shapes)
  assert len(owners["nativeColumns"]) == 552 and not owners["sharedColumns"]
  for x, z, low, high, kind in owners["nativeColumns"]:
    row = voxel["building_rows"][z - voxel["grid"]["min_z_idx"]]
    assert any(
      voxel["grid"]["min_x_idx"] + r[0] <= x < voxel["grid"]["min_x_idx"] + r[0] + r[1]
      and r[2:] == [low, high, kind]
      for r in row
    )
    point = Point((x + 0.5) * 4, (z + 0.5) * 4)
    affected = {
      core["buildings"][int(i)]["id"]
      for i in tree.query(point)
      if shapes[int(i)].covers(point)
    }
    assert affected and affected <= ids


def test_each_packet_retirement_is_complete_exact_fittings_and_native_faces_cardinal():
  from scripts.build_west_kiez_v302_packets import (
    generic_front_triangles,
    original_triangles,
  )

  source = read(DATA / "westKiezV302.json")
  proof = read(GEO / "west-kiez-v302-packets-evidence.json.gz")
  manifest = read(ROOT / "src/app/public/mesh/surrounding-berlin-v159/manifest.json")
  descriptors = {c["id"]: c for c in manifest["chunks"]}
  old = read(GEO / "district-facades-v188-evidence.json.gz")
  legacy = read(GEO / "west-kiez-v302-legacy-field-proof.json.gz")
  assert len(source["keys"]) == 18 and set(source["keys"]) == set(source["packets"])
  for key, plan in source["packets"].items():
    mode, identity = key.split(":")
    raw = read(
      ROOT
      / "src/app/public/mesh/surrounding-berlin-v159"
      / descriptors[identity][mode]["url"]
    )
    assert (
      len(plan["records"]) == len(raw["meshes"]) and plan["origin"] == raw["origin"]
    )
    for r in plan["retire"]:
      assert raw["meshes"][r["mesh"]]["kind"] in {
        "district-facades-v188",
        "city-west-street-fronts-v163",
      }
      assert r["triangles"] == sorted(set(r["triangles"]))
    if key in legacy:
      keys = {
        tuple(sorted(tuple(q) for q in t)) for t in legacy[key]["legacyTriangles"]
      }
      expected = []
      for i, (part, (p, ix, _)) in enumerate(
        zip(raw["meshes"], original_triangles(raw))
      ):
        if part["kind"] != "city-west-street-fronts-v163":
          continue
        hits = [
          n
          for n, t in enumerate(ix)
          if tuple(sorted(tuple(map(int, q)) for q in p[t])) in keys
        ]
        if hits:
          expected.append(dict(mesh=i, triangles=hits))
      assert expected == plan["retire"]
    else:
      faces = [f for f in old["faces"] if f["owner"] in plan["owners"]]
      assert generic_front_triangles(raw, faces, mode == "minecraft") == plan["retire"]
    part = plan["append"]
    p = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
    assert len(p) > 0 and ix.max() < len(p)
    assert (
      sum(len(base64.b64decode(m["positions"])) // 6 for m in raw["meshes"]) + len(p)
      <= 400000
    )
    assert (
      sum(len(base64.b64decode(m["indices"])) // 4 for m in raw["meshes"]) + ix.size
      <= 2400000
    )
    if mode == "minecraft":
      assert all(np.any(np.ptp(p[t], axis=0) == 0) for t in ix)
  assert sum(p["retiredTriangles"] for p in proof["packets"]) > 3000


def test_later_preparer_fields_do_not_restore_retired_generic_fittings():
  data = read(DATA / "westKiezV302.json")
  owners = {o for p in data["packets"].values() for o in p["owners"]} | {
    "48472662",
    "48472661",
    "62057645",
    "07891900",
  }
  receipt = read(GEO / "west-kiez-v302-prepared-fittings.json.gz")
  assert all(r["fields"] == 0 for r in receipt["receipts"])
  for source in receipt["evidenceAudit"]:
    path = GEO / source["file"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == source["sha256"]
    fields = [f for p in read(path)["packets"] for f in p["fields"]]
    assert not any(f["owner"] in owners for f in fields)


def test_native_navigation_is_exact_union_of_actual_compiled_box_caps_per_source_leaf():
  from scripts.build_west_kiez_v302 import native_sheets

  source = read(GEO / "west-kiez-v302-core-source.json.gz")
  model = read(DATA / "westKiezV302Core.json")
  navigation = read(DATA / "westKiezV302NativeNavigation.json")
  actual = {p["id"]: p for p in navigation["parts"]}
  models = {s["parent"]: s for s in model["sites"]}
  assert len(actual) == 89
  for site in source["sites"]:
    rows = models[site["parent"]]["nativeRows"]
    offset = 0
    for part in site["parts"]:
      expected = native_sheets([part], 0xD0C7B2, 0x747A76)
      real = rows[offset : offset + len(expected)]
      offset += len(real)
      assert real == expected
      profile = actual[part["id"]]
      ox, oz = profile["origin"]
      before = {}
      after = {}
      for x, y, z, w, h, d, _ in real:
        x0, z0, x1, z1, top = [
          round(v * navigation["scale"])
          for v in (
            x - w / 2 - ox,
            z - d / 2 - oz,
            x + w / 2 - ox,
            z + d / 2 - oz,
            y + h / 2,
          )
        ]
        before.setdefault(top, []).append(box(x0, z0, x1, z1))
      for x0, z0, x1, z1, top in profile["caps"]:
        after.setdefault(top, []).append(box(x0, z0, x1, z1))
      assert before.keys() == after.keys()
      for top in before:
        assert unary_union(before[top]).equals(unary_union(after[top]))
      assert abs(profile["low"] - min(q[1] - q[4] / 2 for q in real)) < 0.00001
      assert abs(profile["high"] - max(q[1] + q[4] / 2 for q in real)) < 0.00001
    assert offset == len(rows)
