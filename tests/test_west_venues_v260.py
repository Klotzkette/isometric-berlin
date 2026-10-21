"""Independent preservation and source/recognition checks for the West venues."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = json.loads(
  gzip.decompress((GEO / "west-venues-v260-source.json.gz").read_bytes())
)
RUNTIME = json.loads((ROOT / "src/app/src/data/westVenuesV260.json").read_text())


def test_exact_complete_source_families_and_original_owner_receipts() -> None:
  assert len(SOURCE["parts"]) == 88
  assert len(SOURCE["surfaces"]) == 1647
  counts = {
    p["id"]: sum(q["parentId"] == p["id"] for q in SOURCE["parts"])
    for p in SOURCE["parents"]
  }
  assert counts == {
    "DEBE04YY500007vQ": 9,
    "DEBE04YY500005Uo": 77,
    "DEBE04YY50000AZq": 2,
  }
  original = ROOT / SOURCE["legacyFile"]
  assert hashlib.sha256(original.read_bytes()).hexdigest() == SOURCE["legacyFileSha256"]
  old = {b["id"]: b for b in json.loads(original.read_text())["buildings"]}
  assert {p["id"] for p in SOURCE["legacyPrisms"]} == {
    "16160637",
    "32861687",
    "48793287",
  }
  for prism in SOURCE["legacyPrisms"]:
    assert prism == old[prism["id"]]
  assert all(c["overlapM2"] / c["oldArea"] > 0.95 for c in SOURCE["sourceConflicts"])


def test_runtime_drawn_reproduces_every_measured_triangle_and_color() -> None:
  points = np.frombuffer(
    base64.b64decode(RUNTIME["sourcePositions"]), dtype="<f4"
  ).reshape(-1, 3, 3)
  measured = np.array(
    [t for s in SOURCE["surfaces"] for t in s["triangles"]], dtype="<f4"
  )
  assert np.array_equal(points, measured)
  tones = np.frombuffer(base64.b64decode(RUNTIME["sourceColors"]), dtype="<u4")
  assert list(tones) == [s["color"] for s in SOURCE["surfaces"] for _ in s["triangles"]]
  assert len(points) == 2357


def test_native_has_every_source_sheet_surface_cell_and_no_hidden_solid_fill() -> None:
  rows = np.frombuffer(base64.b64decode(RUNTIME["nativeBoxes"]), dtype="<f4").reshape(
    -1, 8
  )
  assert np.all(rows[:, 6] == 0)
  count = len(SOURCE["nativeBlocks"])
  assert count == 7005
  assert np.array_equal(
    rows[:count], np.array([r[:8] for r in SOURCE["nativeBlocks"]], dtype="<f4")
  )
  cells = {
    (round(r[0] / 2 - 0.5), round(r[1] / 2 - 0.5), round(r[2] / 2 - 0.5))
    for r in SOURCE["nativeBlocks"]
  }
  for s in SOURCE["surfaces"]:
    for t in s["triangles"]:
      for point in t:
        assert tuple(int(np.floor(v / 2)) for v in point) in cells


def test_source_roof_profiles_and_bounded_recognition() -> None:
  assert len(SOURCE["roofRibSections"]) == 15
  assert all(r["segments"] > 0 for r in SOURCE["roofRibSections"])
  centers = SOURCE["recognitionAnchors"]["renaissanceFiveWindowCenters"]
  assert len(centers) == len(set(map(tuple, centers))) == 5
  roles = [r[-1] for r in SOURCE["facadeBoxes"]]
  assert roles.count("delphi-two-columns") == 2
  assert roles.count("renaissance-five-blue-lancets") == 5
  for p in SOURCE["parents"]:
    ss = [s for s in SOURCE["surfaces"] if s["parentId"] == p["id"]]
    area = unary_union(
      [
        Polygon(
          [(v[0], v[2]) for v in s["rings"][0]],
          [[(v[0], v[2]) for v in r] for r in s["rings"][1:]],
        )
        for s in ss
        if s["kind"] == "GroundSurface"
      ]
    )
    assert area.area > 100
  heights = {
    p["kind"]: max(q["topY"] for q in SOURCE["parts"] if q["parentId"] == p["id"])
    for p in SOURCE["parents"]
  }
  assert heights["leh"] > 45
  assert heights["renaissance"] > 32
  assert heights["delphi"] > 22


def test_every_retained_source_ring_matches_cached_official_archive() -> None:
  """Independently compare original CityGML rings, including ground and holes."""
  import xml.etree.ElementTree as ET
  import zipfile

  import pytest

  ns = {
    "b": "http://www.opengis.net/citygml/building/1.0",
    "g": "http://www.opengis.net/gml",
  }
  by_id = {s["sourcePolygonId"]: s for s in SOURCE["surfaces"]}
  owners = {p["id"]: p for p in SOURCE["parents"]}
  seen = set()
  for archive in SOURCE["sourceArchives"]:
    path = GEO / "raw/lod2" / archive["url"].split("/")[-1]
    if not path.exists():
      pytest.skip(
        "Optional raw archive not redistributed; immutable derived source is checked above"
      )
    assert hashlib.sha256(path.read_bytes()).hexdigest() == archive["sha256"]
    with zipfile.ZipFile(path) as z:
      tree = ET.fromstring(z.read(z.namelist()[0]))
    for parent in tree.findall(".//b:Building", ns):
      owner = owners.get(parent.get("{" + ns["g"] + "}id"))
      if owner is None:
        continue
      for part in parent.findall(".//b:BuildingPart", ns) or [parent]:
        for boundary in part.findall("b:boundedBy", ns):
          for surface in boundary:
            for polygon in surface.findall(".//g:Polygon", ns):
              sid = polygon.get("{" + ns["g"] + "}id")
              assert sid in by_id
              expected = []
              for e in polygon.findall(".//g:posList", ns):
                values = list(map(float, e.text.split()))
                ring = [
                  [
                    round(values[i] - 389500, 3),
                    round(values[i + 2] - owner["groundNHN"] + 5.2, 3),
                    round(5820000 - values[i + 1], 3),
                  ]
                  for i in range(0, len(values), 3)
                ]
                if ring[0] == ring[-1]:
                  ring.pop()
                expected.append(ring)
              assert expected == by_id[sid]["rings"]
              seen.add(sid)
  assert seen == set(by_id)
