"""Complete source surfaces, exact owners and independent KOSMOS detail."""

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
import build_kosmos_v166 as module  # noqa: E402

PAYLOAD = json.loads((ROOT / "src/app/src/data/kosmosV166Source.json").read_text())


def test_complete_source_roofs_walls_and_holes() -> None:
  """Compare every measured polygon against the raw official archive."""
  original = {}
  for archive in PAYLOAD["sourceArchives"]:
    path = ROOT / "geo_data/regierungsviertel/raw/lod2" / archive["url"].split("/")[-1]
    if not path.exists():
      pytest.skip("Raw official LoD2 archives are intentionally ignored")
    with zipfile.ZipFile(path) as z:
      tree = ET.fromstring(z.read(z.namelist()[0]))
    for parent in tree.findall(".//b:Building", module.NS):
      pid = parent.get("{" + module.NS["g"] + "}id")
      if pid not in module.PARENTS:
        continue
      for part in parent.findall(".//b:BuildingPart", module.NS) or [parent]:
        sid = part.get("{" + module.NS["g"] + "}id")
        for boundary in part.findall("b:boundedBy", module.NS):
          for surface in boundary:
            for poly in surface.findall(".//g:Polygon", module.NS):
              key = (sid, poly.get("{" + module.NS["g"] + "}id"))
              area = 0
              for i, e in enumerate(poly.findall(".//g:posList", module.NS)):
                a = np.array(list(map(float, e.text.split()))).reshape(-1, 3)
                area += (
                  (1 if i == 0 else -1)
                  * np.linalg.norm(
                    np.sum(np.cross(a[:-1] - a[0], a[1:] - a[0]), axis=0)
                  )
                  / 2
                )
              original[key] = (surface.tag.split("}")[-1], area)
  assert len(original) == len(PAYLOAD["surfaces"])
  for s in PAYLOAD["surfaces"]:
    kind, area = original[(s["partId"], s["sourcePolygonId"])]
    assert kind == s["kind"]
    if kind in ["WallSurface", "RoofSurface"]:
      actual = sum(
        np.linalg.norm(np.cross(np.subtract(t[1], t[0]), np.subtract(t[2], t[0]))) / 2
        for t in s["triangles"]
      )
      assert actual == pytest.approx(area, abs=0.012)


def test_exact_kosmos_identity_parts_and_footprint() -> None:
  assert len(PAYLOAD["parents"]) == 3
  assert len(PAYLOAD["parts"]) == 8
  assert len(PAYLOAD["surfaces"]) == 265
  assert {p["parentId"] for p in PAYLOAD["parts"]} == set(module.PARENTS)
  assert PAYLOAD["legacyPrisms"] == []
  assert PAYLOAD["osmEvidence"][0]["id"] == "OSM-way-606479961"
  assert PAYLOAD["osmEvidence"][0]["tags"]["amenity"] == "conference_centre"
  foot = unary_union(
    [
      Polygon(p["ring"], p["holes"])
      for part in PAYLOAD["parts"]
      for p in part["polygons"]
    ]
  )
  assert foot.area == pytest.approx(
    PAYLOAD["sourceConflicts"]["officialFootprintAreaM2"], abs=0.00001
  )
  assert "uncertain match" in PAYLOAD["sourcePolicy"]
  # Elevated connector retains its source underside, never lowered to the ground.
  connector = next(p for p in PAYLOAD["parts"] if p["id"] == "DEBE02YY20001he2")
  assert connector["groundY"] == 6.012
  assert connector["topY"] == 9.012


def test_independent_native_skin_and_finite_facades() -> None:
  assert len(PAYLOAD["nativeBlocks"]) == 2529
  assert len({tuple(r[:3]) for r in PAYLOAD["nativeBlocks"]}) == 2529
  assert all(
    np.isfinite(r).all() for r in PAYLOAD["nativeBlocks"] + PAYLOAD["facadeBoxes"]
  )
  assert len([r for r in PAYLOAD["facadeBoxes"] if r[8] == 1]) == 10
  assert len([r for r in PAYLOAD["facadeBoxes"] if r[8] == 3 and r[4] == 0.66]) == 6
  assert all(r[3] > 0 and r[4] > 0 and r[5] > 0 for r in PAYLOAD["facadeBoxes"])
