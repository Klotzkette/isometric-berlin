"""Complete source sheets and exact immutable Heeresbaeckerei transfer."""

import base64
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_breitscheid_towers_v161 import triangles_for

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_euref_v262 import remove_old  # noqa: E402
from build_roof_house_v233 import roof_height  # noqa: E402

DATA = json.loads(
  (ROOT / "src/app/src/data/koepenickerLandmarksV268.json").read_bytes()
)
EVIDENCE = json.loads(
  gzip.decompress(
    (
      ROOT / "geo_data/regierungsviertel/koepenicker-landmarks-v268-evidence.json.gz"
    ).read_bytes()
  )
)


def arrays(mesh: dict) -> tuple[np.ndarray, np.ndarray]:
  return (
    np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3),
    np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3),
  )


def signature(points: np.ndarray) -> tuple:
  return tuple(sorted(tuple(p) for p in points))


def test_every_original_sheet_survives_complete_same_packet_replacement() -> None:
  parent = extract_parent(
    ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_393_5818.zip", EVIDENCE["owner"]
  )
  original = [part_profile(p) for p in leaf_building_parts(parent)]
  assert original == EVIDENCE["originalParts"]
  assert len(original) == 11 and sum(len(p["surfaces"]) for p in original) == 97
  points, indices = arrays(DATA["packets"]["drawn:8_3"]["replacement"])
  actual = {signature(t) for t in points[indices]}
  origin = np.array(DATA["packets"]["drawn:8_3"]["origin"])
  count = 0
  for part in original:
    for surface in part["surfaces"]:
      for triangle in triangles_for(surface["rings"]):
        q = np.array(triangle)
        q[:, 1] += EVIDENCE["sourceShiftY"]
        rounded = np.rint((q - origin) * 100).astype(int)
        if len(set(map(tuple, rounded))) < 3:
          continue
        assert signature(rounded) in actual
        count += 1
  assert count == DATA["profile"]["shellDrawnTriangles"] == 271
  footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in original])
  assert (
    footprint.symmetric_difference(shape(EVIDENCE["previousOwner"]["geometry"])).area
    < 1e-5
  )


def test_exact_receipts_reconstruct_and_all_original_inputs_remain_immutable() -> None:
  for name, digest in EVIDENCE["inputs"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest
  owner = EVIDENCE["previousOwner"]
  poly = shape(owner["geometry"])
  for family, expected in [("drawn", 184), ("minecraft", 514)]:
    packet = json.loads(
      gzip.decompress(
        (
          ROOT / f"src/app/public/mesh/surrounding-berlin-v159/8_3.{family}.json.gz"
        ).read_bytes()
      )
    )
    receipt = remove_old(
      packet,
      [
        dict(
          id=EVIDENCE["owner"],
          oldOwner=dict(
            wkb=poly.wkb_hex, height=owner["height"], minHeight=owner["minHeight"]
          ),
        )
      ],
      family,
      [4096.0, 1536.0, 4608.0, 2048.0],
    )
    assert receipt == EVIDENCE["receipts"][family]
    assert receipt["removedTriangles"] == receipt["expectedTriangles"] == expected
    assert all(
      r["sourceId"] == EVIDENCE["owner"] for r in receipt["oldOwnedNavigation"]
    )


def test_native_is_independent_cardinal_and_keeps_ground_and_courts() -> None:
  assert EVIDENCE["sourceGroundY"] == 4.193 and EVIDENCE["displayGroundY"] == 3
  assert EVIDENCE["sourceShiftY"] == 3 - 4.193
  points, indices = arrays(DATA["packets"]["minecraft:8_3"]["replacement"])
  triangles = points[indices].astype(float)
  normals = np.cross(
    triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
  )
  assert np.all((abs(normals) > 0.001).sum(axis=1) <= 1)
  assert points[:, 1].min() == 1300 and indices.max() < len(points)
  assert DATA["profile"]["nativeCells"] == 9395
  assert (
    DATA["profile"]["fullMobileIdentical"]
    and DATA["profile"]["independentlyOrthogonalNative"]
  )
  assert (
    ROOT / "src/app/src/data/koepenickerLandmarksV268.json"
  ).stat().st_size < 1_500_000


def test_roof_navigation_follows_every_measured_height_and_complete_footprint() -> None:
  roofs = [
    [[x, y + EVIDENCE["sourceShiftY"], z] for x, y, z in t]
    for part in EVIDENCE["originalParts"]
    for surface in part["surfaces"]
    if surface["kind"] == "RoofSurface"
    for t in triangles_for(surface["rings"])
  ]
  footprint = shape(EVIDENCE["previousOwner"]["geometry"])
  checked = {}
  for family, step, offset in [("drawn", 1.31, 0.217), ("minecraft", 0.5, 0.25)]:
    r = DATA["packets"][family + ":8_3"]
    ox, _, oz = r["origin"]
    nav = [
      (translate(Polygon(b["ring"], b["holes"]), ox, oz), b["height"] + 3)
      for b in r["buildings"]
    ]
    union = unary_union([p for p, _ in nav])
    if family == "drawn":
      # Packet XZ coordinates are rounded to centimetres, as is visible geometry.
      assert footprint.difference(union.buffer(0.011)).area < 0.001
      assert union.difference(footprint.buffer(0.011)).area < 0.001
    count = 0
    x0, z0, x1, z1 = footprint.bounds
    for x in np.arange(np.floor(x0 / step) * step + offset, x1, step):
      for z in np.arange(np.floor(z0 / step) * step + offset, z1, step):
        point = Point(x, z)
        if not footprint.contains(point) or footprint.boundary.distance(point) < 0.015:
          continue
        heights = [h for t in roofs if (h := roof_height(t, x, z)) is not None]
        assert heights
        support = [top for p, top in nav if p.covers(point)]
        # Ignore only centimetre-rounded internal strip boundaries, never an area.
        if not support and family == "drawn" and union.distance(point) < 0.008:
          continue
        assert support
        actual, represented = max(heights), max(support)
        if family == "drawn":
          assert -0.003 <= represented - actual <= 0.103
        else:
          assert abs(represented - np.ceil(actual / 0.5) * 0.5) < 1e-8
        count += 1
    checked[family] = count
  assert checked["drawn"] > 1000 and checked["minecraft"] > 9000
