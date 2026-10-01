"""Complete source surfaces, exact owners and independent City West detail."""

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
import build_citywest_cinemas_v166 as module  # noqa: E402

PAYLOAD = json.loads(
  (ROOT / "src/app/src/data/cityWestCinemasV166Source.json").read_text()
)


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


def test_exact_cinema_and_frontage_ownership() -> None:
  assert len(PAYLOAD["parents"]) == 21
  assert len(PAYLOAD["parts"]) == 95
  assert {p["parentId"] for p in PAYLOAD["parts"]} == set(module.PARENTS)
  assert len({p["id"] for p in PAYLOAD["legacyPrisms"]}) == 25
  assert not any(p["id"] == "64359480" for p in PAYLOAD["legacyPrisms"])
  for c in PAYLOAD["sourceConflicts"]:
    foot = unary_union(
      [
        Polygon(p["ring"], p["holes"])
        for part in PAYLOAD["parts"]
        if part["parentId"] == c["parentId"]
        for p in part["polygons"]
      ]
    )
    assert foot.area == pytest.approx(c["officialFootprintAreaM2"], abs=0.00001)
  assert {r["id"] for r in PAYLOAD["publicRealm"]} >= {
    "OSM-way-492760729",
    "OSM-relation-5462504",
  }


def test_independent_native_skin_and_finite_facade_detail() -> None:
  assert len(PAYLOAD["nativeBlocks"]) < 30000
  assert len({tuple(row[:3]) for row in PAYLOAD["nativeBlocks"]}) == len(
    PAYLOAD["nativeBlocks"]
  )
  assert all(
    np.isfinite(row).all() for row in PAYLOAD["nativeBlocks"] + PAYLOAD["facadeBoxes"]
  )
  pilasters = [r for r in PAYLOAD["facadeBoxes"] if r[8] == 6 and r[4] == 15]
  assert len(pilasters) == 5
  assert "Current 2026 construction differs" in PAYLOAD["sourcePolicy"]
