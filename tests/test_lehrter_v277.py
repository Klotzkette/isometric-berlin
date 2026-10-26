"""Measured Lehrter bodies, original footprints and independent native evidence."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
import pytest
from shapely import make_valid
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def read(path: Path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


SOURCE = read(ROOT / "geo_data/regierungsviertel/lehrter-v277-source.json.gz")
EVIDENCE = read(ROOT / "geo_data/regierungsviertel/lehrter-v277-evidence.json.gz")
RUNTIME = read(DATA / "lehrterV277.json")
NAV = read(DATA / "lehrterV277Navigation.json")
OWNER = read(DATA / "lehrterV277Ownership.json")


def packed(key: str, width: int, dtype="<f4"):
  return np.frombuffer(base64.b64decode(RUNTIME[key]), dtype=dtype).reshape(-1, width)


def old_polygon(p):
  return make_valid(
    Polygon(np.array(p["ring"]) / 10, [np.array(r) / 10 for r in p["holes"]])
  )


def test_actual_addresses_and_complete_measured_families():
  assert [(p["id"], len(p["sourceParts"])) for p in SOURCE["parents"]] == [
    ("DEBE01YYK0002RHX", 3),
    ("DEBE01YYK0002Kmg", 5),
  ]
  assert SOURCE["parents"][0]["address"] == "Lehrter Straße 35"
  assert SOURCE["parents"][1]["address"] == "Kruppstraße 2–4"
  assert (
    len([s for p in SOURCE["parents"] for q in p["sourceParts"] for s in q["surfaces"]])
    == 83
  )
  assert RUNTIME["counts"]["sourceSurfaces"] == 83
  path = ROOT / SOURCE["previousFile"]
  assert hashlib.sha256(path.read_bytes()).hexdigest() == SOURCE["previousFileSha256"]
  actual = {p["id"]: p for p in read(path)["buildings"]}
  assert set(p["id"] for p in SOURCE["previousPrisms"]) == {
    "ui4o8MEJ",
    "hlcQTuwD",
    "UEwVyTdb",
    "37687041",
  }
  assert all(p == actual[p["id"]] for p in OWNER["previousPrisms"])
  assert all(
    p["id"] not in read(DATA / "coreHouseColoursV273.json")["owners"]
    for p in OWNER["previousPrisms"]
  )
  assert all(
    p["id"] not in read(DATA / "moabitHousesCoreV269.json")["core"]
    for p in OWNER["previousPrisms"]
  )
  police = [p for p in NAV["parts"] if p["parentId"] == "DEBE01YYK0002Kmg"]
  assert max(p["maxY"] for p in police) == pytest.approx(31.72)
  assert {p["sourceId"] for p in police} == {"37687041"}


def test_independent_official_archive_full_83_walls_roofs_and_footprints():
  path = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_388_5821.zip"
  if not path.exists():
    path = Path.home() / ".cache/codex-berlin-v277/LoD2_388_5821.zip"
  if not path.exists():
    pytest.skip("Optional original survey ZIP is not redistributed")
  assert hashlib.sha256(path.read_bytes()).hexdigest() == SOURCE["archive"]["sha256"]
  ns = {
    "b": "http://www.opengis.net/citygml/building/1.0",
    "g": "http://www.opengis.net/gml",
  }
  with zipfile.ZipFile(path) as archive:
    root = ET.fromstring(
      archive.read(next(n for n in archive.namelist() if n.endswith((".xml", ".gml"))))
    )
  expected = {p["id"]: p for owner in SOURCE["parents"] for p in owner["sourceParts"]}
  seen = set()
  for part in root.findall(".//b:BuildingPart", ns):
    pid = part.get("{" + ns["g"] + "}id")
    if pid not in expected:
      continue
    seen.add(pid)
    surfaces = []
    for kind in ["WallSurface", "RoofSurface"]:
      for poly in part.findall(f".//b:{kind}//g:Polygon", ns):
        rings = []
        for coords in poly.findall(".//g:posList", ns):
          values = list(map(float, coords.text.split()))
          ring = [
            [
              round(values[i] - 389500, 3),
              round(values[i + 2] - 30, 3),
              round(5820000 - values[i + 1], 3),
            ]
            for i in range(0, len(values), 3)
          ]
          if ring[0] == ring[-1]:
            ring.pop()
          rings.append(ring)
        surfaces.append((kind, rings))
    assert surfaces == [(s["kind"], s["rings"]) for s in expected[pid]["surfaces"]]
    ground = part.find(".//b:GroundSurface//g:Polygon", ns)
    values = list(map(float, ground.find("g:exterior//g:posList", ns).text.split()))
    footprint = Polygon(
      [(values[i] - 389500, 5820000 - values[i + 1]) for i in range(0, len(values), 3)]
    )
    assert (
      footprint.symmetric_difference(
        Polygon(expected[pid]["ring"], expected[pid]["holes"])
      ).area
      < 0.0001
    )
  assert seen == set(expected)


def test_every_old_outline_fragment_remains_and_crossing_ring_keeps_both_faces():
  for parent, conflict in zip(SOURCE["parents"], EVIDENCE["conflicts"], strict=True):
    old = unary_union(
      [
        old_polygon(p)
        for p in SOURCE["previousPrisms"]
        if p["id"] in parent["legacyIds"]
      ]
    )
    new = unary_union([Polygon(p["ring"], p["holes"]) for p in parent["sourceParts"]])
    nav = unary_union(
      [
        Polygon(p["ring"], p["holes"])
        for p in NAV["parts"]
        if p["parentId"] == parent["id"]
      ]
    )
    assert nav.symmetric_difference(old.union(new)).area < 1e-7
    assert (
      old.difference(new).symmetric_difference(shape(conflict["oldOnlyGeometry"])).area
      < 1e-7
    )
    assert conflict["oldOnlyAreaM2"] == pytest.approx(old.difference(new).area)
  police = EVIDENCE["conflicts"][1]
  assert police["oldOnlyAreaM2"] == pytest.approx(4.3933684323)
  assert police["overlapM2"] / police["oldArea"] == pytest.approx(0.995895678818)
  repair = EVIDENCE["quantizedRingRepairs"]
  assert len(repair) == 1 and repair[0]["id"] == "ui4o8MEJ"
  assert shape(repair[0]["polygonized"]).geom_type == "MultiPolygon"
  assert len(shape(repair[0]["polygonized"]).geoms) == 2


def test_packed_model_contains_complete_triangle_geometry_and_hollow_native_cells():
  from scripts.build_lehrter_v277 import prepare

  prepared = prepare(SOURCE)
  expected = np.asarray(
    [v for s in prepared["surfaces"] for t in s["triangles"] for v in t], dtype="<f4"
  )
  assert np.array_equal(packed("sourcePositions", 3), expected)
  rows = packed("nativeBoxes", 8)
  assert np.all(rows[:, 6] == 0) and np.all(rows[:, 3:6] > 0)
  shell = rows[: RUNTIME["counts"]["nativeShellBlocks"]]
  cells = {tuple(math.floor(float(v) / 2) for v in r[:3]) for r in shell}
  for s in prepared["surfaces"]:
    for triangle in s["triangles"]:
      for point in triangle:
        assert tuple(math.floor(float(v) / 2) for v in point) in cells
  assert len(cells) == 2976
  assert all(np.all(r[3:6] == 2) for r in shell)
  native = unary_union([Polygon(p["ring"], p["holes"]) for p in NAV["nativePolygons"]])
  from shapely.geometry import Point

  # Real court witnesses remain open in each mode; not rectangular infill.
  for x, z in [(-773.55, -1736.265), (-889.127, -1619.033)]:
    assert not native.covers(Point(x, z))
    assert not unary_union(
      [Polygon(p["ring"], p["holes"]) for p in NAV["parts"]]
    ).covers(Point(x, z))


def test_photo_recognition_native_fitting_clearance_and_retained_road_nodes():
  assert len(RUNTIME["recognitionAnchors"]["threeAxes"]) == 3
  assert len(RUNTIME["recognitionAnchors"]["fiveStoreyHeights"]) == 5
  assert (
    sum(s[-1] == "kultur-three-round-arch-rims" for s in RUNTIME["ribSegments"]) == 60
  )
  assert sum(s[-1] == "kultur-ground-arch-rims" for s in RUNTIME["ribSegments"]) == 40
  assert [p["text"] for p in RUNTIME["labels"]] == [
    "KULTURFABRIK",
    "FILMRAUSCHPALAST",
    "SLAUGHTERHOUSE",
    "POLIZEI",
  ]
  assert RUNTIME["labels"][2]["a"][0] > -780 and RUNTIME["labels"][2]["y"] < 9
  rows = packed("nativeBoxes", 8)
  shell = rows[:2976]
  # Every actual native fitting must clear the source shell, including corners.
  for row in rows[2976:]:
    overlap = np.all(
      np.abs(shell[:, :3] - row[:3]) < (shell[:, 3:6] + row[3:6]) / 2 - 0.003, axis=1
    )
    assert not np.any(overlap)
  assert len(SOURCE["streetRows"]) == EVIDENCE["retainedStreetRows"] > 0
  path = ROOT / SOURCE["streetSource"]["path"]
  assert (
    hashlib.sha256(path.read_bytes()).hexdigest() == SOURCE["streetSource"]["sha256"]
  )
  assert all(p["geometry"]["type"] == "LineString" for p in SOURCE["streetRows"])
