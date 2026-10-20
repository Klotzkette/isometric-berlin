"""Step 10: exact named owners, preserved openings and bounded static details."""

from __future__ import annotations

import gzip
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Point, Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_gips_koppen_v252 as builder  # noqa: E402


def load() -> tuple[dict, dict, dict]:
  """Read the compact delivered details and independently frozen source."""
  return tuple(
    json.loads((ROOT / path).read_text())
    for path in [
      "src/app/src/data/gipsKoppenV252.json",
      "geo_data/regierungsviertel/gips-koppen-v252-evidence.json",
      "geo_data/regierungsviertel/gips-koppen-v252-source.json",
    ]
  )


def test_complete_old_buildings_and_authored_sources_are_unchanged() -> None:
  data, ev, source = load()
  for path, digest in source["sourceHashes"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  original = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-391_5820-00.json.gz"
      ).read_bytes()
    )
  )["buildings"]
  for owner, count in source["parentPartCounts"].items():
    building = next(b for b in original if b["id"] == owner)
    assert len(building["parts"]) == count
    for face in [f for f in source["faces"] if f["owner"] == owner]:
      part = next(p for p in building["parts"] if p["id"] == face["partId"])
      assert part["surfaces"][face["surfaceIndex"]]["rings"] == face["rings"]
  old = next(
    e
    for e in json.loads((ROOT / "src/app/src/data/schoolsPlacesV205.json").read_text())[
      "schools"
    ]
    if e["owner"] == data["owner"]
  )
  assert data["previous"] == {k: builder.fingerprint(old[k]) for k in data["previous"]}
  assert ev["replacedAuthoredOwner"] == "DEBE01YYK00001Eq"
  assert len(ev["mainSchoolLevels"]) == 4
  assert len(source["openingReceipts"]) == 56
  assert data["koppenReplacement"] == {
    "oldVerifiedPanes": 56,
    "occupiedLevels": 3,
    "newPanes": 76,
  }
  assert {p["level"] for p in ev["koppenOpenings"]} == {0, 1, 2}
  assert sum(p["height"] == 4.45 for p in ev["koppenOpenings"]) == 12
  for path, digest in ev["koppenOldPacketReceipts"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  assert data["labels"][0]["text"] == "MILCHHALLE"
  front = next(a for a in ev["faceAudit"] if a["rings"][0][0] == [2086.0, 14.2, -814.1])
  low_members = [
    data["boxes"][i] for i in front["boxes"] if data["boxes"][i][1] / 1000 < 8
  ]
  # The photographed street-left closed door is west of the court passage;
  # the passage at the eastern end receives no new panels/infill.
  assert len(low_members) == 4
  assert all(r[0] / 1000 + data["origin"][0] < 2077 for r in low_members)
  cafe = next(
    f for f in source["features"] if f["properties"].get("osm_id") == "3902472802"
  )
  assert cafe["properties"]["name"] == "Symple Coffee Mitte"


def test_facade_members_stay_inside_their_measured_wall_and_holes() -> None:
  data, ev, _ = load()
  origin = np.array(data["origin"])
  for audit in ev["faceAudit"]:
    pts = np.array(audit["rings"][0])
    a, b = max(
      ((a, b) for a in pts for b in pts),
      key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
    )
    d = np.array([b[0] - a[0], 0, b[2] - a[2]])
    d /= np.linalg.norm(d)
    projected = [
      [(float(np.dot(np.array(p) - a, d)), p[1]) for p in r] for r in audit["rings"]
    ]
    wall = Polygon(projected[0], projected[1:]).buffer(0.002)
    for index in audit["boxes"]:
      r = data["boxes"][index]
      p = np.array(r[:3]) / 1000 + origin
      u = float(np.dot(p - a, d))
      assert wall.covers(
        box(u - r[3] / 2000, p[1] - r[4] / 2000, u + r[3] / 2000, p[1] + r[4] / 2000)
      )
    for index in audit["rods"]:
      r = data["rods"][index]
      p, q = np.array(r[:3]) / 1000 + origin, np.array(r[3:6]) / 1000 + origin
      segment = LineString(
        [(float(np.dot(p - a, d)), p[1]), (float(np.dot(q - a, d)), q[1])]
      )
      assert wall.covers(segment.buffer(r[6] / 2000, cap_style=2))


def test_edges_keep_exact_actual_rings_and_never_fill_the_park() -> None:
  _, ev, source = load()
  for edge in ev["edgeAudit"]:
    feature = next(
      f
      for f in source["features"]
      if f["properties"].get("osm_way_id") == edge["owner"]
    )
    polygon = shape(feature["geometry"])
    assert polygon.boundary.distance(Point(edge["a"])) < 1e-9
    assert polygon.boundary.distance(Point(edge["b"])) < 1e-9
    assert polygon.boundary.buffer(1e-8).covers(LineString([edge["a"], edge["b"]]))
  assert ev["groundSamples"] == [5.2]
  assert len(ev["edgeAudit"]) == 28
  tower = Point(ev["clockTowerCenter"][0], ev["clockTowerCenter"][2])
  school = next(
    f for f in source["features"] if f["properties"].get("osm_way_id") == "321046049"
  )
  assert shape(school["geometry"]).contains(tower)


def test_koppen_replacement_covers_only_receipted_faces_with_three_levels() -> None:
  data, ev, source = load()
  faces = [f for f in source["faces"] if f["owner"] == "DEBE01YYK0000AxW"]
  expected = {
    ("DEBE3DjD2eO7FgdL", 1): [7, 7, 7],
    ("DEBE3DG94v6wivJl", 0): [5, 5, 5],
    ("DEBE3DG94v6wivJl", 1): [0, 2, 2],
    ("DEBE3DG94v6wivJl", 10): [5, 5, 5],
    ("DEBE3DQ03Y0beSFq", 0): [5, 5, 5],
    ("DEBE3DQ03Y0beSFq", 3): [2, 2, 2],
  }
  assert {(f["partId"], f["surfaceIndex"]) for f in faces} == set(expected)
  counts = Counter(
    (p["partId"], p["surfaceIndex"], p["level"]) for p in ev["koppenOpenings"]
  )
  for key, levels in expected.items():
    assert [counts[(*key, level)] for level in range(3)] == levels
  origin = np.array(data["origin"])
  covered = 0
  for face in faces:
    audit = next(a for a in ev["faceAudit"] if a["rings"] == face["rings"])
    facing = data["boxes"][audit["boxes"][0]]
    assert data["palette"][facing[-1]] == 0xD0CBB9
    center = np.array(facing[:3]) / 1000 + origin
    normal = np.array(audit["normal"])
    tangent = np.array([normal[2], 0, -normal[0]])
    panel = box(
      -facing[3] / 2000,
      center[1] - facing[4] / 2000,
      facing[3] / 2000,
      center[1] + facing[4] / 2000,
    ).buffer(0.001)
    receipts = [
      p for p in source["openingReceipts"] if p["sourceWall"] == face["rings"]
    ]
    assert receipts
    for pane in receipts:
      # The measured facing covers each exact old pane and lies outside it.
      for point in pane["quad"]:
        assert panel.covers(Point(np.dot(np.array(point) - center, tangent), point[1]))
      assert np.dot(center - np.array(pane["center"]), normal) > facing[5] / 2000
    covered += len(receipts)
  assert covered == 56
  glass = [r for r in data["boxes"] if data["palette"][r[-1]] == builder.GLASS]
  for opening in ev["koppenOpenings"]:
    assert (
      sum(
        np.max(np.abs(np.array(r[:3]) / 1000 + origin - opening["center"])) < 0.00051
        and r[4] / 1000 == opening["height"]
        for r in glass
      )
      == 1
    )


def test_native_clock_clears_actual_roof_without_changing_drawn_or_other_rows() -> None:
  data, ev, _ = load()
  audit = ev["nativeClockClearance"]
  assert audit["offsetY"] == 1.25
  assert audit["roofTopY"] == max(r[4] for r in audit["roofSpans"]) == 31
  for path, digest in audit["roofPacketReceipts"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  first, count = audit["nativeFirst"], audit["nativeCount"]
  assert count == 547
  clock_rows = data["nativeRows"][audit["clockNativeFirst"] : first + count]
  assert min((r[1] - r[4] / 2) / 1000 for r in clock_rows) >= (
    audit["roofTopY"] + audit["clearanceM"]
  )
  restored = [r.copy() for r in data["nativeRows"]]
  for r in restored[first : first + count]:
    r[1] -= round(audit["offsetY"] * 1000)
  # Exact pre-correction receipts: the sole change is this native Y translation.
  values = {
    "boxes": "eb3410e34f7d4c8a9e6820018d06b0767e63b273d047c396e6908aeb3fc2fba4",
    "rods": "87a7dcc780e3bd0251dc72e12a203ed187a450406cc304fcf269cf61cda16790",
    "labels": "d9009bda39b5069a202eeeac8fbdf14a9739c268ce932b950d01f5303ec8f985",
    "nativeRows": "5e50196569886c53870e236354152f8031663c1a0314e8451c1d2f1c20868499",
  }
  for key, digest in values.items():
    rows = restored if key == "nativeRows" else data[key]
    assert (
      hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()
      == digest
    )


def test_generation_replays_exactly_with_fixed_surface_only_budgets() -> None:
  data, evidence, _ = load()
  rebuilt, audit = builder.build()
  assert rebuilt == data
  assert audit == evidence
  assert data["counts"] == {"boxes": 1150, "rods": 163, "nativeRows": 3293}
  assert (len(data["boxes"]) + len(data["rods"])) * 76 < 104_000
  assert len(data["nativeRows"]) * 76 < 260_000
  assert all(len(r) == 7 and min(r[3:6]) > 0 for r in data["nativeRows"])
  assert (ROOT / "src/app/src/data/gipsKoppenV252.json").stat().st_size < 180_000
