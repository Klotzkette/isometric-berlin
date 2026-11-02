"""Complete source families, old outside fragments and actual native roof union."""

import base64
import copy
import gzip
import hashlib
import json
import math
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_breitscheid_towers_v161 import triangles_for  # noqa: E402
from neukoelln_roof_materials_v305 import MATERIALS  # noqa: E402


def read(path: Path) -> Any:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


SOURCE = read(
  ROOT / "geo_data/regierungsviertel/neukoelln-landmarks-v305-source.json.gz"
)
MODEL = read(ROOT / "src/app/src/data/neukoellnLandmarksV305Core.json")
PROFILE = read(ROOT / "src/app/src/data/neukoellnLandmarksV305Profile.json")


def triangle_key(points: Any) -> tuple:
  return tuple(sorted(tuple(map(float, np.asarray(p, dtype="<f4"))) for p in points))


def test_every_official_parent_leaf_sheet_and_hole_is_retained_in_drawn_model() -> None:
  positions = np.frombuffer(
    base64.b64decode(MODEL["drawn"]["positions"]), "<f4"
  ).reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(MODEL["drawn"]["indices"]), "<u4").reshape(
    -1, 3
  )
  actual = Counter(triangle_key(positions[t]) for t in indices)
  expected = Counter()
  surfaces = parts = 0
  for site in SOURCE["sites"]:
    for parent in site["parentsSource"]:
      for p in parent["parts"]:
        parts += 1
        for s in p["surfaces"]:
          surfaces += 1
          rings = copy.deepcopy(s["rings"])
          for ring in rings:
            for q in ring:
              q[1] = round(q[1] + site["yOffset"], 6)
          for t in triangles_for(rings):
            k = triangle_key(t)
            if len(set(k)) == 3:
              expected[k] += 1
  assert parts == 80
  assert surfaces == 1104
  assert not (expected - actual)
  assert sum(actual.values()) == MODEL["counts"]["sourceTriangles"]


def test_exact_old_outside_complements_preserve_whole_site_and_open_courts() -> None:
  for site in SOURCE["sites"]:
    official = unary_union(
      [
        Polygon(p["ring"], p["holes"])
        for parent in site["parentsSource"]
        for p in parent["parts"]
      ]
    )
    old = shape(site["predecessor"]["geometry"])
    complement = shape(site["outsideComplement"])
    assert old.difference(official.union(complement)).area < 1e-6
    assert complement.symmetric_difference(old.difference(official)).area < 1e-6
    assert complement.area > 0
    assert site["officialCoveredFraction"] > 0.99
    polygons = [old] if old.geom_type == "Polygon" else list(old.geoms)
    for courtyard in [h for p in polygons for h in p.interiors]:
      point = Polygon(courtyard).representative_point()
      assert not official.covers(point)
      assert not complement.covers(point)


def test_native_navigation_footprints_are_exact_compiled_cardinal_roof_union() -> None:
  for site in SOURCE["sites"]:
    caps = []
    roof_tones = {
      site["roof"],
      *[m["after"] for m in MATERIALS.values() if m["site"] == site["key"]],
    }
    for row in MODEL["nativeBoxes"]:
      x, y, z, w, h, d, yaw, tone = row
      assert yaw == 0
      if abs(h - 0.05) < 1e-8 and tone in roof_tones:
        caps.append(box(x - w / 2, z - d / 2, x + w / 2, z + d / 2))
    actual = unary_union(caps)
    nav = unary_union(
      [
        Polygon(p["ring"], p["holes"])
        for p in PROFILE["nativeRegions"]
        if p["site"] == site["key"]
      ]
    )
    assert actual.symmetric_difference(nav).area < 1e-6
    for p in PROFILE["nativeRegions"]:
      if p["site"] != site["key"]:
        continue
      for ring in [p["ring"], *p["holes"]]:
        for a, b in zip(ring, [*ring[1:], ring[0]]):
          assert a[0] == b[0] or a[1] == b[1]


def test_reference_tower_is_separate_from_measured_building_family() -> None:
  tower = PROFILE["tower"]
  assert tower["estimated"] is True
  assert tower["documentedHeightConflict"] == [67, 68]
  assert tower["fortunaHeightM"] == 2.2
  assert tower["high"] - tower["low"] == 67
  assert Point(tower["anchor"]).distance(Point(4226.045, 4269.417)) == 0
  rathaus = next(s for s in SOURCE["sites"] if s["key"] == "rathaus")
  assert (
    max(p["top_y_m"] for parent in rathaus["parentsSource"] for p in parent["parts"])
    < 33
  )
  assert not any(p["id"] == tower["id"] for p in PROFILE["navigation"])


def test_only_two_verified_leaf_roofs_change_rgb_with_winning_native_caps() -> None:
  proof = read(
    ROOT / "geo_data/regierungsviertel/neukoelln-landmarks-v305-material-audit.json"
  )
  assert (
    proof["beforeModelSha256"]
    == "e18298356b756bbbe9b0360d65547b694bf5fc4763ad7d6f7eb0c1a2f677a995"
  )
  assert [t["part"] for t in proof["targets"]] == [
    "DEBE3DMi3WPKjJTh",
    "DEBE3DSzE6HSwLls",
  ]
  assert [len(t["nativeCaps"]) for t in proof["targets"]] == [82, 177]
  assert [len(t["drawnTriangles"]) for t in proof["targets"]] == [5, 74]
  colors = np.frombuffer(
    base64.b64decode(MODEL["drawn"]["colors"]), dtype="u1"
  ).reshape(-1, 3)
  positions = base64.b64decode(MODEL["drawn"]["positions"])
  indices = base64.b64decode(MODEL["drawn"]["indices"])
  owned = {i for t in proof["targets"] for i in t["drawnVertices"]}
  outside = bytes(int(v) for i, row in enumerate(colors) if i not in owned for v in row)
  assert (
    hashlib.sha256(outside).hexdigest()
    == "dda24c356adb28f2fe42447516d3a867ebd2c11a885b2564efd569ac7078c1b1"
  )
  assert (
    hashlib.sha256(positions).hexdigest()
    == "2bb4c725c28fa5f64d5f703661d78c79d3a013807c705846b20d9865bfc934cf"
  )
  assert (
    hashlib.sha256(indices).hexdigest()
    == "608f40615d8e51a09b0fb327b16cb68c12020ea364456a7e0147470bff3a931a"
  )
  assert (
    hashlib.sha256(
      json.dumps([r[:7] for r in MODEL["nativeBoxes"]], separators=(",", ":")).encode()
    ).hexdigest()
    == "054d73c3181869cd20c5a5aa00e9855aa28e794e152a18f5f01b3438acd3f97a"
  )
  expected = {"DEBE3DMi3WPKjJTh": [65, 72, 71], "DEBE3DSzE6HSwLls": [66, 57, 36]}
  from build_moabit_mitte_v300 import roof_at

  for target in proof["targets"]:
    part = next(p for p in PROFILE["navigation"] if p["id"] == target["part"])
    footprint = Polygon(part["ring"], part["holes"])
    for vertex in target["drawnVertices"]:
      assert colors[vertex].tolist() == expected[target["part"]]
    for i in target["nativeCaps"]:
      row = MODEL["nativeBoxes"][i]
      assert row[7] == target["after"]
      assert footprint.covers(Point(row[0], row[2]))
      top = roof_at(part["roofTriangles"], row[0], row[2])
      assert (
        top is not None and abs(math.ceil(top / 0.5) * 0.5 - (row[1] - 0.025)) < 1e-6
      )
