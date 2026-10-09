"""Only source-owned seating overlap may yield to the measured Waldbühne sheets."""

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

import pytest
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from clip_olympic_seating_v201 import (  # noqa: E402
  SEAT_IDS,
  clip_native_box,
  clip_seating,
  clip_triangle,
  digest,
  projected,
  restore_clipped_payload,
  source_selection,
)


def coverage(triangles: list):
  return unary_union([projected(t) for t in triangles])


def footprint(row: list):
  return box(
    row[0] - row[3] / 2, row[2] - row[5] / 2, row[0] + row[3] / 2, row[2] + row[5] / 2
  )


def plane_y(triangle: list, x: float, z: float) -> float:
  a, b, c = triangle
  d = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])
  u = ((x - a[0]) * (c[2] - a[2]) - (z - a[2]) * (c[0] - a[0])) / d
  v = ((b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0])) / d
  return a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1])


def test_triangle_difference_preserves_holes_winding_and_the_original_sloping_plane():
  triangle = [[0, 4, 0], [12, 10, 0], [0, 16, 12]]
  mask = Polygon([(1, 1), (6, 1), (6, 6), (1, 6)], [[(2, 2), (3, 2), (3, 3), (2, 3)]])
  result = clip_triangle(triangle, mask)
  expected = projected(triangle).difference(mask)
  assert coverage(result).symmetric_difference(expected).area < 1e-10
  assert coverage(result).covers(Point(2.5, 2.5))
  assert not coverage(result).covers(Point(1.5, 1.5))
  assert sum(projected(t).area for t in result) == pytest.approx(
    expected.area, abs=1e-10
  )
  for tri in result:
    cross = (tri[1][0] - tri[0][0]) * (tri[2][2] - tri[0][2]) - (
      tri[1][2] - tri[0][2]
    ) * (tri[2][0] - tri[0][0])
    assert cross > 0
    for x, y, z in tri:
      assert y == pytest.approx(4 + x * 0.5 + z, abs=1e-12)
  assert all(vertex in [p for t in result for p in t] for vertex in triangle)
  assert clip_triangle(triangle, box(20, 20, 21, 21)) == [triangle]
  assert clip_triangle(triangle, projected(triangle)) == []


def test_native_remainders_are_exact_orthogonal_boxes_not_a_smoothed_mask():
  row = [4.25, 13.125, 3.75, 7.5, 0.4, 6.5, 0xB6A990]
  mask = unary_union(
    [box(1, 1, 2, 2), box(2, 1, 3, 2), box(2, 2, 3, 3), box(5, 4, 6, 5)]
  )
  result = clip_native_box(row, mask)
  expected = footprint(row).difference(mask)
  assert (
    unary_union([footprint(p) for p in result]).symmetric_difference(expected).area
    < 1e-12
  )
  assert sum(p[3] * p[5] for p in result) == pytest.approx(expected.area, abs=1e-12)
  for p in result:
    assert (p[1], p[4], p[6]) == (row[1], row[4], row[6])
    assert p[3] > 0 and p[5] > 0
  assert clip_native_box(row, box(50, 50, 51, 51)) == [row]
  assert clip_native_box(row, footprint(row)) == []


def test_actual_eleven_seat_sources_replay_every_unrelated_layer_and_outside_piece():
  data = ROOT / "src/app/src/data"
  geo = ROOT / "geo_data/regierungsviertel"
  original = json.loads((data / "westLandmarksV187.json").read_bytes())
  osm = json.loads((geo / "west-landmarks-v187-osm.json").read_bytes())
  masks = json.loads((geo / "waldbuehne-v201-ground-masks.json").read_bytes())
  published = json.loads((data / "olympicGroundsV201.json").read_bytes())
  audit_path = geo / "olympic-seating-v201-audit.json"
  existing = json.loads(audit_path.read_bytes())
  before = restore_clipped_payload(published, existing)
  after, receipt = clip_seating(before, masks)
  assert restore_clipped_payload(after, receipt) == before
  assert after == published and receipt == existing
  assert receipt["oldSourceSha256"] == digest(original)
  assert receipt["maskSha256"] == digest(masks)
  assert set(receipt["selectedOsmIds"]) == SEAT_IDS
  selected, native_source = source_selection(original, osm)
  assert len(selected) == 11
  drawn = shape(masks["seatingDrawn"])
  native = native_source.intersection(shape(masks["minecraft"]))
  old_groups = {g["name"]: g for g in before["groups"]}
  new_groups = {g["name"]: g for g in after["groups"]}
  affected = {name for name, _ in selected}
  for name, old in old_groups.items():
    new = new_groups[name]
    if name not in affected:
      assert new == old
      continue
    assert {k: v for k, v in new.items() if k not in {"surfaces", "native"}} == {
      k: v for k, v in old.items() if k not in {"surfaces", "native"}
    }
    for index, (s, t) in enumerate(zip(old["surfaces"], new["surfaces"], strict=True)):
      if (name, index) not in selected:
        assert t == s
        continue
      assert {k: v for k, v in t.items() if k != "triangles"} == {
        k: v for k, v in s.items() if k != "triangles"
      }
      report = next(
        r
        for r in receipt["surfaces"]
        if r["group"] == name and r["surfaceIndex"] == index
      )
      changes = {r["index"]: r for r in report["changes"]}
      offset = 0
      for source_index, tri in enumerate(s["triangles"]):
        change = changes.get(source_index)
        count = change["count"] if change else 1
        parts = t["triangles"][offset : offset + count]
        if change:
          assert change["start"] == offset and change["before"] == tri
        else:
          assert parts == [tri]
        offset += count
        expected = projected(tri).difference(drawn)
        assert coverage(parts).symmetric_difference(expected).area < 1e-8
        assert sum(projected(p).area for p in parts) == pytest.approx(
          expected.area, abs=1e-8
        )
        for piece in parts:
          for x, y, z in piece:
            assert y == pytest.approx(plane_y(tri, x, z), abs=1e-8)
        for vertex in tri:
          if not drawn.covers(Point(vertex[0], vertex[2])):
            assert vertex in [p for piece in parts for p in piece]
      assert offset == len(t["triangles"])
    report = next(r for r in receipt["native"] if r["group"] == name)
    changes = {r["index"]: r for r in report["changes"]}
    offset = 0
    for index, row in enumerate(old["native"]):
      change = changes.get(index)
      count = change["count"] if change else 1
      parts = new["native"][offset : offset + count]
      if change:
        assert change["start"] == offset and change["before"] == row
        assert row[4] == 0.4 and row[6] == 0xB6A990
        expected = footprint(row).difference(native)
        assert (
          unary_union([footprint(p) for p in parts]).symmetric_difference(expected).area
          < 1e-8
        )
        assert sum(p[3] * p[5] for p in parts) == pytest.approx(expected.area, abs=1e-8)
        for p in parts:
          assert (p[1], p[4], p[6]) == (row[1], row[4], row[6])
          assert p[3] > 0 and p[5] > 0
      else:
        assert parts == [row]
      offset += count
    assert offset == len(new["native"])
  assert sum(len(r["changes"]) for r in receipt["surfaces"]) > 0
  assert sum(len(r["changes"]) for r in receipt["native"]) > 0
  tampered = copy.deepcopy(after)
  tampered["groups"][0]["anchor"][0] += 1
  with pytest.raises(AssertionError):
    restore_clipped_payload(tampered, receipt)
