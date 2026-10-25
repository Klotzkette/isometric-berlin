"""HAU measured-owner preservation, exact replacement and native source coverage."""

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
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads(
  gzip.decompress(
    (ROOT / "geo_data/regierungsviertel/theatres-v272-source.json.gz").read_bytes()
  )
)
RUNTIME = json.loads((ROOT / "src/app/src/data/theatresV272.json").read_text())
NAV = json.loads((ROOT / "src/app/src/data/theatresV272Navigation.json").read_text())


def test_complete_families_and_exact_old_owners() -> None:
  assert {p["key"]: len(p["sourceParts"]) for p in SOURCE["parents"]} == {
    "hau1": 15,
    "hau2": 3,
    "hau3": 2,
    "hau3entry": 2,
  }
  assert len(SOURCE["parts"]) == 22
  path = ROOT / SOURCE["legacyFile"]
  assert hashlib.sha256(path.read_bytes()).hexdigest() == SOURCE["legacyFileSha256"]
  original = {p["id"]: p for p in json.loads(path.read_text())["buildings"]}
  assert {p["id"] for p in SOURCE["legacyPrisms"]} == {
    "81194038",
    "65780505",
    "59291480",
    "81646698",
    "75846696",
  }
  for old in SOURCE["legacyPrisms"]:
    assert old == original[old["id"]]
  assert all(c["overlapM2"] / c["oldArea"] > 0.96 for c in SOURCE["sourceConflicts"])
  assert (
    next(c for c in SOURCE["sourceConflicts"] if c["legacyId"] == "81194038")[
      "newHeight"
    ]
    > 25
  )
  # Full rear theatre source includes the separately mapped low eastern wing.
  assert (
    next(c for c in SOURCE["sourceConflicts"] if c["legacyId"] == "81646698")[
      "overlapM2"
    ]
    > 233
  )


def test_independent_raw_archive_all_parts_and_wall_roof_rings() -> None:
  archive = SOURCE["sourceArchive"]
  path = ROOT / "geo_data/regierungsviertel/raw/lod2" / archive["url"].split("/")[-1]
  if not path.exists():
    pytest.skip("Optional raw survey cache is not redistributed")
  assert hashlib.sha256(path.read_bytes()).hexdigest() == archive["sha256"]
  ns = {
    "b": "http://www.opengis.net/citygml/building/1.0",
    "g": "http://www.opengis.net/gml",
  }
  with zipfile.ZipFile(path) as z:
    tree = ET.fromstring(
      z.read(next(n for n in z.namelist() if n.endswith((".xml", ".gml"))))
    )
  owners = {p["id"]: p for p in SOURCE["parents"]}
  seen = set()
  for parent in tree.findall(".//b:Building", ns):
    owner = owners.get(parent.get("{" + ns["g"] + "}id"))
    if owner is None:
      continue
    parts = [
      p
      for p in parent.findall(".//b:BuildingPart", ns)
      if not p.findall(".//b:BuildingPart", ns)
    ] or [parent]
    assert {p.get("{" + ns["g"] + "}id") for p in parts} == {
      p["id"] for p in owner["sourceParts"]
    }
    for part in parts:
      pid = part.get("{" + ns["g"] + "}id")
      seen.add(pid)
      expected = []
      for kind in ["WallSurface", "RoofSurface"]:
        for polygon in part.findall(f".//b:{kind}//g:Polygon", ns):
          rings = []
          for e in polygon.findall(".//g:posList", ns):
            v = list(map(float, e.text.split()))
            ring = [
              [
                round(v[i] - 389500, 3),
                round(v[i + 2] - owner["groundNHN"] + 5.2, 3),
                round(5820000 - v[i + 1], 3),
              ]
              for i in range(0, len(v), 3)
            ]
            if ring[0] == ring[-1]:
              ring.pop()
            rings.append(ring)
          expected.append((kind, rings))
      actual = [
        (s["kind"], s["rings"]) for s in SOURCE["surfaces"] if s["partId"] == pid
      ]
      assert expected == actual
      # Every official ground footprint survives in the navigation source.
      grounds = part.findall(".//b:GroundSurface//g:Polygon", ns)
      assert len(grounds) == 1
      v = list(map(float, grounds[0].find("g:exterior//g:posList", ns).text.split()))
      expected_foot = Polygon(
        [(v[i] - 389500, 5820000 - v[i + 1]) for i in range(0, len(v), 3)]
      )
      actual_foot = next(p["polygons"][0] for p in NAV["parts"] if p["id"] == pid)
      assert (
        expected_foot.symmetric_difference(
          Polygon(actual_foot["ring"], actual_foot["holes"])
        ).area
        < 0.0001
      )
  assert seen == {p["id"] for p in SOURCE["parts"]}


def test_packed_drawn_triangles_and_independent_native_coverage() -> None:
  points = np.frombuffer(
    base64.b64decode(RUNTIME["sourcePositions"]), dtype="<f4"
  ).reshape(-1, 3, 3)
  assert np.array_equal(
    points,
    np.array([t for s in SOURCE["surfaces"] for t in s["triangles"]], dtype="<f4"),
  )
  assert len(points) == 582
  rows = np.frombuffer(base64.b64decode(RUNTIME["nativeBoxes"]), dtype="<f4").reshape(
    -1, 8
  )
  assert np.all(rows[:, 6] == 0)
  assert np.all(rows[:, 3:6] > 0)
  cells = {tuple(math.floor(v / 2) for v in r[:3]) for r in SOURCE["nativeBlocks"]}
  for s in SOURCE["surfaces"]:
    for tri in s["triangles"]:
      for v in tri:
        assert tuple(math.floor(c / 2) for c in v) in cells
  assert len(cells) == 3971
  assert len(rows) < 8000
  assert NAV["roofTriangles"] == [
    t for s in SOURCE["surfaces"] if s["kind"] == "RoofSurface" for t in s["triangles"]
  ]


def test_venue_recognition_and_hauthree_access_are_distinct() -> None:
  roles = [r[-1] for r in SOURCE["facadeBoxes"]]
  assert roles.count("hau1-three-door-portals") == 3
  assert roles.count("hau1-convex-tall-foyer-window") == 3
  assert roles.count("hau2-three-gold-light-frames") == 12
  assert roles.count("hau3-mapped-street-passage") == 1
  a = SOURCE["recognitionAnchors"]
  assert a["hau3MappedEntrance"]["venueFloor"] == 3
  assert a["hau3MappedEntrance"]["osmNode"] == "3848188241"
  assert math.dist(a["hau3MappedEntrance"]["xz"], a["hau3Rear"]["a"]) > 70
  assert len(SOURCE["labels"]) == 5
  assert (
    max(
      r[1] + r[4] / 2 for r in SOURCE["facadeBoxes"] if r[-1] == "hau1-curved-pediment"
    )
    < 30.031
  )


def test_grips_prior_full_family_and_detail_implementation_are_unchanged() -> None:
  receipts = {
    "src/app/src/GripsHansaplatz.ts": "49185af51e4337886bedad1d20610174d2958f69638198efb803603b065f0b03",
    "src/app/src/gripsHansaplatzProfile.ts": "1e01a560568ff8f240ea7801758bf739f8a66fe19264702fd99b32d1370222ce",
    "src/app/src/gripsHansaplatzSource.json": "ae09845014168aba328c23e7d428858b1b1f73b7b994d570e1320035415080cf",
  }
  for name, expected in receipts.items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected
