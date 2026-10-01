"""Bounded source-preservation and facade clipping for the Huthmacher-Haus."""

import importlib.util
import json
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location(
  "huthmacher", ROOT / "scripts/build_huthmacher_v165.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
PAYLOAD = json.loads((ROOT / "src/app/src/data/huthmacherSource.json").read_text())


def test_windows_respect_irregular_survey_wall() -> None:
  ring = [[0, 5.2, 0], [0, 62, 0], [35, 62, 0], [35, 46, 0], [50, 46, 0], [50, 5.2, 0]]
  polygon = Polygon([(p[0], p[1]) for p in ring])
  rows = MODULE.facade([ring], 57)
  assert rows
  for x, y, _z, w, h, _depth, _yaw, _color, role in rows:
    if role == 1:
      assert polygon.covers(
        Polygon(
          [
            (x - w / 2, y - h / 2),
            (x + w / 2, y - h / 2),
            (x + w / 2, y + h / 2),
            (x - w / 2, y + h / 2),
          ]
        )
      )


def test_export_preserves_all_source_parts_and_explicit_osm_conflict() -> None:
  assert len(PAYLOAD["parts"]) == 10
  assert len(PAYLOAD["surfaces"]) == 64
  assert {p["parentId"] for p in PAYLOAD["parts"]} == {MODULE.PARENT}
  assert {p["id"] for p in PAYLOAD["legacyPrisms"]} == {"64359480"}
  foot = unary_union([Polygon(r) for p in PAYLOAD["parts"] for r in p["rings"]])
  assert foot.area == pytest.approx(
    PAYLOAD["sourceConflict"]["officialFootprintAreaM2"], abs=1e-5
  )
  assert all(np.isfinite(row).all() for row in PAYLOAD["facadeBoxes"])
  assert len({tuple(b[:3]) for b in PAYLOAD["nativeBlocks"]}) == len(
    PAYLOAD["nativeBlocks"]
  )
  assert max(p["heightM"] for p in PAYLOAD["parts"]) == 61.703


def test_every_available_official_surface_is_retained_without_triangulation_loss() -> (
  None
):
  if not MODULE.SOURCE.exists():
    pytest.skip("Raw authoritative archive is intentionally not bundled")
  with zipfile.ZipFile(MODULE.SOURCE) as archive:
    tree = ET.fromstring(archive.read(archive.namelist()[0]))
  parent = tree.find(f'.//b:Building[@g:id="{MODULE.PARENT}"]', MODULE.NS)
  assert parent is not None
  source_ids = {
    p.get(f"{{{MODULE.NS['g']}}}id")
    for p in parent.findall(".//b:BuildingPart", MODULE.NS)
  }
  assert source_ids == {p["id"] for p in PAYLOAD["parts"]}
  areas = {}
  for part in parent.findall(".//b:BuildingPart", MODULE.NS):
    sid = part.get(f"{{{MODULE.NS['g']}}}id")
    for kind in ["WallSurface", "RoofSurface"]:
      total = 0
      for polygon in part.findall(f"b:boundedBy/b:{kind}//g:Polygon", MODULE.NS):
        for i, pos in enumerate(polygon.findall(".//g:posList", MODULE.NS)):
          numbers = [float(v) for v in pos.text.split()]
          points = np.array([numbers[j : j + 3] for j in range(0, len(numbers), 3)])
          area = (
            np.linalg.norm(
              np.sum(np.cross(points[:-1] - points[0], points[1:] - points[0]), axis=0)
            )
            / 2
          )
          total += area if i == 0 else -area
      areas[(sid, kind)] = total
  for key, expected in areas.items():
    actual = sum(
      np.linalg.norm(np.cross(np.subtract(t[1], t[0]), np.subtract(t[2], t[0]))) / 2
      for s in PAYLOAD["surfaces"]
      if (s["partId"], s["kind"]) == key
      for t in s["triangles"]
    )
    assert actual == pytest.approx(expected, abs=0.02), key
