"""Immutable source preservation, exact transfer and independent native geometry."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_breitscheid_towers_v161 import triangles_for

ROOT = Path(__file__).resolve().parents[1]

DATA = json.loads((ROOT / "src/app/src/data/feuerwacheKreuzbergV267.json").read_bytes())
EVIDENCE = json.loads(
  gzip.decompress(
    (
      ROOT / "geo_data/regierungsviertel/feuerwache-kreuzberg-v267-evidence.json.gz"
    ).read_bytes()
  )
)
PROFILES = json.loads(
  (ROOT / "src/app/src/data/feuerwacheKreuzbergV267PreviousProfiles.json").read_bytes()
)


def arrays(mesh):
  points = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return points, indices


def signature(points):
  return tuple(sorted(tuple(p) for p in points))


def test_every_original_part_and_sheet_is_retained_and_drawn():
  for name, expected in EVIDENCE["inputs"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected
  parent = extract_parent(
    ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_393_5817.zip", EVIDENCE["owner"]
  )
  original = [part_profile(p) for p in leaf_building_parts(parent)]
  assert original == EVIDENCE["originalParts"]
  assert len(original) == 6
  assert sum(len(p["surfaces"]) for p in original) == 148
  points, indices = arrays(DATA["packets"]["drawn:7_4"]["replacement"])
  actual = {signature(t) for t in points[indices]}
  origin = np.array([3584.0, -10.0, 2048.0])
  count = 0
  for p in original:
    for s in p["surfaces"]:
      for t in triangles_for(s["rings"]):
        q = np.array(t)
        q[:, 1] += EVIDENCE["sourceShiftY"]
        rounded = np.rint((q - origin) * 100).astype(int)
        if len(set(map(tuple, rounded))) < 3:
          continue
        assert signature(rounded) in actual
        count += 1
  assert count == DATA["profile"]["shellDrawnTriangles"]
  footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in original])
  assert (
    footprint.symmetric_difference(shape(EVIDENCE["previousOwner"]["geometry"])).area
    < 1e-5
  )


def test_exact_old_proxy_complements_and_all_prior_profiles_are_preserved():
  assert {
    family: r["removedTriangles"] for family, r in EVIDENCE["receipts"].items()
  } == {"drawn": 337, "minecraft": 376}
  for family, receipt in EVIDENCE["receipts"].items():
    assert receipt["removedTriangles"] == receipt["expectedTriangles"]
    assert all(
      n["sourceId"] == EVIDENCE["owner"] for n in receipt["oldOwnedNavigation"]
    )
    assert DATA["packets"][family + ":7_4"]["records"] == receipt["runtimeRecords"]
  assert len(PROFILES["records"]) == 9
  for r in PROFILES["records"]:
    assert r["owner"] == EVIDENCE["owner"]
    assert r["before"][1] > 17 and 15 < r["after"][1] < 16
    assert [v for i, v in enumerate(r["before"]) if i != 1] == [
      v for i, v in enumerate(r["after"]) if i != 1
    ]


def test_actual_streamed_ground_and_all_native_triangles():
  assert EVIDENCE["displayGroundY"] == 3
  assert EVIDENCE["sourceGroundY"] == 5.433
  terrain = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json").read_bytes()
  )
  assert (
    min(x for p in EVIDENCE["originalParts"] for x, z in p["ring"])
    > (terrain["grid"]["min_x_idx"] + terrain["grid"]["cols"]) * terrain["cell_m"]
  )
  for family in ["drawn", "minecraft"]:
    raw = json.loads(
      gzip.decompress(
        (
          ROOT / f"src/app/public/mesh/surrounding-berlin-v159/7_4.{family}.json.gz"
        ).read_bytes()
      )
    )
    assert raw["nav"]["groundY"] == 3
    points, indices = arrays(DATA["packets"][family + ":7_4"]["replacement"])
    assert points[:, 1].min() == 1300  # packet origin -10, ground +3
    assert indices.max() < len(points)
    if family == "minecraft":
      tri = points[indices].astype(float)
      normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
      assert np.all((abs(normals) > 0.001).sum(axis=1) <= 1)
  assert DATA["profile"]["nativeCells"] == 5664
  assert (
    ROOT / "src/app/src/data/feuerwacheKreuzbergV267.json"
  ).stat().st_size < 700_000
