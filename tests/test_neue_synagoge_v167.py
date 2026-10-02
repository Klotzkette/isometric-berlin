"""Source preservation and separately labelled present-day synagogue detail."""

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
import build_neue_synagoge_v167 as module  # noqa: E402

P = json.loads((ROOT / "src/app/src/data/neueSynagogeV167Source.json").read_text())


def test_every_original_boundary_and_rendered_wall_roof_area() -> None:
  archive = ROOT / f"geo_data/regierungsviertel/raw/lod2/LoD2_{module.TILE}.zip"
  if not archive.exists():
    pytest.skip("Official raw archives are intentionally ignored")
  with zipfile.ZipFile(archive) as z:
    tree = ET.fromstring(z.read(z.namelist()[0]))
  parent = next(
    p
    for p in tree.findall(".//b:Building", module.NS)
    if p.get("{" + module.NS["g"] + "}id") == module.PARENT
  )
  original = {}
  for part in parent.findall(".//b:BuildingPart", module.NS):
    sid = part.get("{" + module.NS["g"] + "}id")
    for boundary in part.findall("b:boundedBy", module.NS):
      for surface in boundary:
        for poly in surface.findall(".//g:Polygon", module.NS):
          key = (sid, poly.get("{" + module.NS["g"] + "}id"))
          area = 0
          rings = []
          for i, e in enumerate(poly.findall(".//g:posList", module.NS)):
            a = np.array(list(map(float, e.text.split()))).reshape(-1, 3)
            area += (
              (1 if i == 0 else -1)
              * np.linalg.norm(np.sum(np.cross(a[:-1] - a[0], a[1:] - a[0]), axis=0))
              / 2
            )
            ring = np.column_stack(
              [
                a[:, 0] - 389500,
                a[:, 2] - module.DATUM + module.GROUND,
                5820000 - a[:, 1],
              ]
            )
            if np.array_equal(ring[0], ring[-1]):
              ring = ring[:-1]
            rings.append(np.round(ring, 3).tolist())
          original[key] = (surface.tag.split("}")[-1], area, rings)
  assert len(original) == len(P["surfaces"]) == 127
  for s in P["surfaces"]:
    kind, area, rings = original[(s["partId"], s["sourcePolygonId"])]
    assert kind == s["kind"]
    assert rings == s["rings"]
    if kind in ["WallSurface", "RoofSurface"]:
      actual = sum(
        np.linalg.norm(np.cross(np.subtract(t[1], t[0]), np.subtract(t[2], t[0]))) / 2
        for t in s["triangles"]
      )
      assert actual == pytest.approx(area, abs=0.014)


def test_current_footprint_and_exact_single_previous_owner() -> None:
  assert [p["id"] for p in P["parents"]] == [module.PARENT]
  assert len(P["parts"]) == 4
  assert [p["id"] for p in P["legacyPrisms"]] == ["24054915"]
  assert P["legacyPrisms"][0]["y0_dm"] == 52
  assert P["legacyPrisms"][0]["h_dm"] == 213
  assert P["osmEvidence"][0]["tags"]["building"] == "synagogue"
  foot = unary_union(
    [Polygon(p["ring"], p["holes"]) for part in P["parts"] for p in part["polygons"]]
  )
  assert foot.area == pytest.approx(1054.8513025, abs=0.002)
  assert all(p["groundY"] == 5.2 for p in P["parts"])
  assert (
    "demolished rear prayer hall is not reconstructed"
    in P["sourceConflicts"]["resolution"]
  )
  # The low original right tower remains intact; its additive upper octagon is separate.
  right = next(p for p in P["parts"] if p["id"] == module.RIGHT)
  assert right["topY"] == 8.343
  assert len([s for s in P["authoredSurfaces"] if s["role"] == 7]) == 8


def test_additive_crowns_enclose_measured_upper_surfaces() -> None:
  for sid, dome in [(module.MAIN, P["domes"][0]), (module.LEFT, P["domes"][1])]:
    for s in P["surfaces"]:
      if s["partId"] != sid:
        continue
      for ring in s["rings"]:
        for x, y, z in ring:
          if y < dome["profile"][0][0]:
            continue
          radius = np.interp(
            y, [v[0] for v in dome["profile"]], [v[1] for v in dome["profile"]]
          )
          assert (
            np.hypot(x - dome["center"][0], z - dome["center"][1]) <= radius + 0.002
          )
  assert len(P["domes"]) == 3
  assert P["domes"][0]["finialTopY"] == 55.2
  assert P["domes"][0]["ribs"] == 24
  assert all(d["estimated"] for d in P["domes"])
  assert {r[8] for r in P["detailRods"]} >= {1, 2, 3, 8, 10, 11, 12, 13}


def test_native_source_skin_and_finite_bounded_detail() -> None:
  cells = P["nativeBlocks"]
  assert 10000 < len(cells) < 22000
  assert len({(r[4], *r[:3]) for r in cells}) == len(cells)
  assert {r[4] for r in cells} == {0.5, 1}
  assert all(np.isfinite(r).all() for r in cells + P["facadeBoxes"] + P["detailRods"])
  assert all(r[3] > 0 and r[4] > 0 and r[5] > 0 for r in P["facadeBoxes"])
  assert min(r[0] - r[4] / 2 for r in cells) > 1538
  assert max(r[0] + r[4] / 2 for r in cells) < 1595
  assert min(r[2] - r[4] / 2 for r in cells) > -670
  assert max(r[2] + r[4] / 2 for r in cells) < -615
