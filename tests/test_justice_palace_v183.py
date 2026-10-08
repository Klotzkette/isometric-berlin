"""Source/estimate separation and bounded courthouse/palace geometry contracts."""

import importlib.util
import json
import math
from collections import defaultdict
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
SOURCE = json.loads((DATA / "justicePalaceV183.json").read_text())
NATIVE = json.loads((DATA / "justicePalaceV183Native.json").read_text())
EVIDENCE = json.loads(
  (ROOT / "geo_data/regierungsviertel/justice-palace-v183-evidence.json").read_text()
)


def test_all_measured_edges_retained_and_no_old_owner_replaced() -> None:
  segments = {tuple(sorted((tuple(s[:3]), tuple(s[3:6])))) for s in SOURCE["segments"]}
  for record in EVIDENCE["records"]:
    for surface in record["surfaces"]:
      for ring in surface["rings"]:
        for a, b in zip(ring, ring[1:] + ring[:1]):
          if a != b:
            assert tuple(sorted((tuple(a), tuple(b)))) in segments
  assert {r["parentId"] for r in SOURCE["features"]} == {
    "DEBE01YYK000017e",
    "DEBE04YY500008YZ",
    "DEBE04YY500000nx",
    "DEBE04YY500002jj",
    "DEBE01YYK0002Nu1",
  }
  assert "replacement" not in SOURCE


def test_distinct_current_tower_hierarchy_and_explicit_source_conflicts() -> None:
  towers = SOURCE["moabitTowerHierarchy"]
  assert len(towers) == 3
  assert sorted(t["topY"] for t in towers) == [51.299, 61.634, 63.064]
  assert sum(t["role"] == "tall flanking tower" for t in towers) == 2
  assert sum(t["role"] == "lower eastern corner dome" for t in towers) == 1
  assert SOURCE["palaceTower"]["publishedHeightM"] == 45
  assert SOURCE["palaceTower"]["topY"] == 48
  litten = next(
    r for r in SOURCE["sourceConflicts"] if r["name"] == "Littenstraße courts"
  )
  assert litten["sourceHeightM"] == 3.081
  assert "demolished 1968/69" in litten["decision"]
  for s in SOURCE["segments"]:
    if min(s[0], s[3]) > 2800 and max(s[0], s[3]) < 3000:
      assert max(s[1], s[4]) <= 31


def test_bounded_payloads_separate_native_and_no_hidden_fill() -> None:
  assert (DATA / "justicePalaceV183.json").stat().st_size < 2_800_000
  assert (DATA / "justicePalaceV183Native.json").stat().st_size < 2_350_000
  assert 24_000 < len(SOURCE["segments"]) < 26_000
  assert 15_000 < len(SOURCE["boxes"]) < 16_000
  assert len(NATIVE["nativeRows"]) == 51_588
  assert "nativeRows" not in SOURCE
  assert all(len(r) == 7 and min(r[3:6]) > 0 for r in NATIVE["nativeRows"])
  assert all(
    min(r[3:6]) <= 0.5 for r in NATIVE["nativeRows"] if r[6] not in {0x625F59, 0x78726B}
  )
  assert all(min(r[3:6]) <= 0.5 for r in SOURCE["boxes"])


def test_upper_wall_skins_only_follow_existing_courtyard_and_outer_wall_planes() -> (
  None
):
  boundary = []
  skins = SOURCE["estimatedWallSkins"]
  assert len(skins) == 194
  for skin in skins:
    record = next(r for r in EVIDENCE["records"] if r["name"] == skin["name"])
    surface = record["surfaces"][skin["sourceSurfaceIndex"]]
    assert surface["kind"] == "WallSurface"
    if skin["name"] == "Kriminalgericht Moabit":
      assert surface["partId"] == "DEBE3DZuPJnvKibt"
    else:
      assert skin["name"] == "Littenstraße courts"
    plane = LineString([(p[0], p[2]) for p in surface["rings"][0]])
    boundary.append(plane)
    x, y, z, w, h, d, yaw, _ = SOURCE["boxes"][skin["boxIndex"]]
    assert d == 0.08
    assert abs(y - h / 2 - skin["sourceTopY"]) < 0.002
    assert abs(y + h / 2 - skin["estimatedEaveY"]) < 0.002
    assert skin["estimatedEaveY"] == record["groundY"] + (
      21 if skin["name"] == "Kriminalgericht Moabit" else 24
    )
    for u in [-w / 2, 0, w / 2]:
      assert plane.distance(Point(x + math.cos(yaw) * u, z - math.sin(yaw) * u)) < 0.012
  walls = unary_union(boundary)
  native_skins = [r for r in NATIVE["nativeRows"] if r[6] in {0xB8AD93, 0xC7BFA9}]
  assert len(native_skins) == 5457
  assert all(walls.distance(Point(r[0], r[2])) < 0.018 for r in native_skins)


def test_estimated_roof_skins_cover_exact_source_roofs_and_preserve_courtyard_voids() -> (
  None
):
  assert len(SOURCE["roofTriangles"]) == 4559
  for profile in SOURCE["estimatedRoofSkins"]:
    name = profile["name"]
    record = next(r for r in EVIDENCE["records"] if r["name"] == name)
    original = unary_union(
      [
        Polygon(
          [(p[0], p[2]) for p in s["rings"][0]],
          [[(p[0], p[2]) for p in ring] for ring in s["rings"][1:]],
        )
        for s in record["surfaces"]
        if s["kind"] == "RoofSurface"
        and (name != "Kriminalgericht Moabit" or s.get("partId") == "DEBE3DZuPJnvKibt")
      ]
    )
    start = profile["firstTriangle"]
    triangles = SOURCE["roofTriangles"][start : start + profile["triangleCount"]]
    shown = unary_union(
      [Polygon([(r[i], r[i + 2]) for i in [0, 3, 6]]) for r in triangles]
    )
    assert original.symmetric_difference(shown).area < 0.003
    max_y = 39.2 if name == "Kriminalgericht Moabit" else 31
    assert all(profile["eaveY"] <= r[i] <= max_y for r in triangles for i in [1, 4, 7])
    color = 0x625F59 if name == "Kriminalgericht Moabit" else 0x78726B
    native = [r for r in NATIVE["nativeRows"] if r[6] == color]
    assert native
    assert all(
      profile["eaveY"] - 0.1 <= r[1] - r[4] / 2 and r[1] + r[4] / 2 <= max_y + 0.1
      for r in native
    )
    assert all(original.buffer(0.008).covers(Point(r[0], r[2])) for r in native)


def test_native_roof_bands_join_neighbouring_steps_without_ground_fill() -> None:
  checked = 0
  for color in [0x625F59, 0x78726B]:
    courses = defaultdict(list)
    for row in NATIVE["nativeRows"]:
      if row[6] == color:
        courses[row[2]].append(row)
    for rows in courses.values():
      rows.sort(key=lambda r: r[0])

    def overlap(a: list[float], b: list[float]) -> float:
      return min(a[1] + a[4] / 2, b[1] + b[4] / 2) - max(
        a[1] - a[4] / 2, b[1] - b[4] / 2
      )

    for rows in courses.values():
      for a, b in zip(rows, rows[1:]):
        if abs(a[0] + a[3] / 2 - b[0] + b[3] / 2) < 0.015:
          assert overlap(a, b) >= 0.1
          checked += 1
    ordered = sorted(courses)
    for az, bz in zip(ordered, ordered[1:]):
      if abs(bz - az - 0.8) > 0.01:
        continue
      previous, following = courses[az], courses[bz]
      start = 0
      for a in previous:
        while (
          start < len(following)
          and following[start][0] + following[start][3] / 2 < a[0] - a[3] / 2
        ):
          start += 1
        for b in following[start:]:
          if b[0] - b[3] / 2 > a[0] + a[3] / 2:
            break
          if (
            min(a[0] + a[3] / 2, b[0] + b[3] / 2)
            - max(a[0] - a[3] / 2, b[0] - b[3] / 2)
            > 0.02
          ):
            assert overlap(a, b) >= 0.1
            checked += 1
  assert checked > 60_000


def test_reproducible_from_committed_bounded_evidence() -> None:
  spec = importlib.util.spec_from_file_location(
    "justice183", ROOT / "scripts/build_justice_palace_v183.py"
  )
  assert spec is not None and spec.loader is not None
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  rebuilt = module.build(EVIDENCE["records"])
  native = rebuilt.pop("nativeRows")
  assert json.loads(json.dumps(rebuilt)) == SOURCE
  assert native == NATIVE["nativeRows"]
