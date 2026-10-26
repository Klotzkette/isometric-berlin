"""Independent evidence, full-footprint, clearance and source-retention checks."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from scripts import build_bayer_campus_v277 as builder

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def source():
  return json.loads(gzip.decompress(builder.SOURCE.read_bytes()))


@pytest.fixture(scope="module")
def model():
  return json.loads(builder.DEST.read_bytes())


@pytest.fixture(scope="module")
def audit():
  return json.loads(builder.EVIDENCE.read_bytes())


def decoded(model, key, width=8):
  return np.frombuffer(base64.b64decode(model[key]), dtype="<f4").reshape((-1, width))


def test_complete_previous_sources_and_exact_old_facades_are_unchanged(source):
  for entry in source["inputs"]:
    with (ROOT / entry["path"]).open("rb") as stream:
      assert hashlib.file_digest(stream, "sha256").hexdigest() == entry["sha256"]
  old = source["originalOwner"]
  assert old["id"] == "DEBE01YYK0004qx3"
  retained = json.loads((ROOT / source["inputs"][0]["path"]).read_bytes())

  # Replay the complete owner, rather than a newly invented replacement receipt.
  def records(value):
    if isinstance(value, dict):
      yield value
      for child in value.values():
        yield from records(child)
    elif isinstance(value, list):
      for child in value:
        yield from records(child)

  originals = [r for r in records(retained) if r.get("id") == old["id"]]
  assert old in originals
  assert old["parts"][0]["height_m"] == 23.988
  assert old["parts"][0]["prism"]["h_dm"] == 240
  assert old["parts"][0]["surfaces"]
  legacy = json.loads((ROOT / "src/app/src/data/weddingSitesV210.json").read_bytes())
  for key in ["boxes", "blocks"]:
    entries = source["retiredV210"][key]
    assert len({i for i, _ in entries}) == len(entries)
    for index, row in entries:
      assert legacy[key][index] == row
      assert row[-2] == "bayer"
  assert len(source["retiredV210"]["boxes"]) == 1673
  assert len(source["retiredV210"]["blocks"]) == 4265


def test_all_twenty_four_mapped_parts_and_actual_height_samples_are_bound(
  source, model, audit
):
  original = source["originalOwner"]["parts"][0]
  whole = Polygon(original["ring"], original["holes"])
  assert source["osmParent"]["id"] == "way/420830351"
  assert len(source["osmParts"]) == len(model["parts"]) == 24
  assert len(source["bdom"]["samples"]) == 96
  assert {p["osmId"] for p in model["parts"]} == {p["id"] for p in source["osmParts"]}
  assert len([p for p in source["osmParts"] if p["id"].startswith("relation/")]) == 2
  for part in model["parts"]:
    mapped = next(p for p in source["osmParts"] if p["id"] == part["osmId"])
    poly = Polygon(mapped["ring"], mapped.get("holes", []))
    submitted = Polygon(part["ring"], part["holes"])
    # Four-decimal coordinate serialization alone permits a narrow edge strip.
    assert submitted.symmetric_difference(poly.intersection(whole)).area < 0.02
    receipt = next(r for r in audit["heightReceipts"] if r["osmId"] == part["osmId"])
    sample = next(
      s
      for s in source["bdom"]["samples"]
      if s["id"] == part["osmId"] and s["index"] == receipt["selectedIndex"]
    )
    assert poly.covers(Point(sample["worldXZ"]))
    assert sample["url"].startswith("https://gdi.berlin.de/services/wms/bdom?")
    assert part["maxY"] == pytest.approx(
      sample["NHN"] - 30 + original["displayOffsetY"], abs=0.00051
    )
    assert receipt["selectedNhn"] == sample["NHN"]
    assert receipt["undersideEstimate"] == (
      mapped["tags"].get("building:min_level") == "2"
    )
  union = unary_union([Polygon(p["ring"], p["holes"]) for p in model["parts"]])
  mismatch = audit["contourDiscrepancy"]
  assert mismatch["oldOnlyArea"] == pytest.approx(whole.difference(union).area)
  assert mismatch["newOnlyArea"] == pytest.approx(union.difference(whole).area)
  assert mismatch["oldOnlyRings"] and mismatch["newOnlyRings"]
  assert max(p["maxY"] for p in model["parts"]) > 82
  assert min(p["maxY"] for p in model["parts"]) < 12
  assert audit["policies"]["otherSourceBodiesChanged"] == 0
  assert not audit["policies"]["futureNordhafenBuilding"]


def test_actual_native_body_runs_cover_every_mapped_cell_without_filling_bridge(model):
  rows = decoded(model, "nativeDetails")[: model["counts"]["nativeBodyRuns"]].astype(
    float
  )
  actual = {}
  for x, y, z, w, h, d, yaw, _ in rows:
    assert d == 1 and yaw == 0
    assert x - w / 2 == math.floor(x - w / 2)
    for ix in range(round(x - w / 2), round(x + w / 2)):
      actual.setdefault((ix, round(z - 0.5)), []).append((y - h / 2, y + h / 2))
  expected = {(x, z): (lo, hi) for x, z, lo, hi in model["nativeCells"]}
  assert len(expected) == len(model["nativeCells"])
  assert set(actual) == set(expected)
  for cell, (low, high) in expected.items():
    spans = sorted(actual[cell])
    assert spans[0][0] == pytest.approx(low, abs=0.00001)
    assert spans[-1][1] == pytest.approx(high, abs=0.00001)
    assert len(spans) == 2  # Separate actual wall volume and 24cm roof cap.
    assert spans[0][1] == pytest.approx(spans[1][0], abs=0.00001)
  bridge = next(p for p in model["parts"] if p["osmId"] == "way/219497869")
  point = Polygon(bridge["ring"]).representative_point()
  assert expected[math.floor(point.x), math.floor(point.y)][0] == 13.6
  assert any(lo == 5.2 for lo, _ in expected.values())
  submitted = unary_union(
    [Polygon(p["ring"], p["holes"]) for p in model["nativeFootprints"]]
  )
  assert (
    submitted.symmetric_difference(
      unary_union([box(x, z, x + 1, z + 1) for x, z in expected])
    ).area
    == 0
  )


def test_float32_native_fittings_clear_own_bodies_and_all_retained_foreign_columns(
  model,
):
  own = {(x, z): (lo, hi) for x, z, lo, hi in model["nativeCells"]}
  ownership = json.loads(
    (ROOT / "src/app/src/data/bayerCampusV277Ownership.json").read_bytes()
  )
  retired = {tuple(c) for c in ownership["columns"]}
  voxel = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json").read_bytes()
  )
  foreign = {}
  for zi, rr in enumerate(voxel["building_rows"]):
    iz = voxel["grid"]["min_z_idx"] + zi
    if not ownership["bounds"][1] - 8 <= iz * 4 <= ownership["bounds"][3] + 8:
      continue
    for start, count, lo, hi, kind in rr:
      for ix in range(
        voxel["grid"]["min_x_idx"] + start, voxel["grid"]["min_x_idx"] + start + count
      ):
        if (
          ownership["bounds"][0] - 8 <= ix * 4 <= ownership["bounds"][2] + 8
          and (ix, iz, lo, hi, kind) not in retired
        ):
          foreign[ix, iz] = (lo / 10, hi / 10)
  overlaps = []
  for i, row in enumerate(
    decoded(model, "nativeDetails")[model["counts"]["nativeBodyRuns"] :].astype(float)
  ):
    x, y, z, w, h, d, _, _ = row
    for step, cells in [(1, own), (4, foreign)]:
      for ix in range(
        math.floor((x - w / 2) / step), math.floor((x + w / 2) / step) + 1
      ):
        for iz in range(
          math.floor((z - d / 2) / step), math.floor((z + d / 2) / step) + 1
        ):
          span = cells.get((ix, iz))
          if (
            span
            and min(x + w / 2, (ix + 1) * step) - max(x - w / 2, ix * step) > 0.00021
            and min(z + d / 2, (iz + 1) * step) - max(z - d / 2, iz * step) > 0.00021
            and min(y + h / 2, span[1]) - max(y - h / 2, span[0]) > 0.00021
          ):
            overlaps.append((i, step, ix, iz))
  assert not overlaps, overlaps[:20]


def test_public_entry_lettering_uses_a_coherent_visible_native_plane(model, audit):
  fittings = audit["fittings"]
  assert len([f for f in fittings if f["role"] == "entrance glass"]) == 3
  assert len([f for f in fittings if f["role"] == "entrance frame"]) == 3
  assert len([f for f in fittings if f["role"] == "operator sign ring"]) == 72
  assert len([f for f in fittings if f["role"] == "BAYER cross lettering"]) > 85
  base = audit["publicEntranceNativeBase"]
  assert 0 < base <= 6
  for f in fittings:
    if (
      f["role"].startswith(("operator sign", "entrance"))
      or f["role"] == "BAYER cross lettering"
    ):
      assert f["nativeReach"]
      assert all(r == pytest.approx(base + f["nativeRelief"]) for r in f["nativeReach"])
  # Native diagonal backing cuboids must never bury any foreground glyph.
  native = decoded(model, "nativeDetails").astype(float)
  body = model["counts"]["nativeBodyRuns"]
  back = [f for f in fittings if f["role"] == "operator sign backing"]
  front = [
    f for f in fittings if f["role"] in {"operator sign ring", "BAYER cross lettering"}
  ]
  normal = np.asarray(back[0]["outward"])

  def depth_interval(row):
    centre = normal @ row[[0, 2]]
    radius = abs(normal) @ row[[3, 5]] / 2
    return centre - radius, centre + radius

  back_edge = max(
    depth_interval(native[body + i])[1] for f in back for i in f["native"]
  )
  assert all(
    depth_interval(native[body + i])[0] > back_edge + 0.02
    for f in front
    for i in f["native"]
  )
  assert model["counts"]["retainedOtherCampusOwners"] == 82


def test_replay_packed_geometry_and_legacy_receipts_are_deterministic_and_bounded(
  model, audit
):
  assert builder.build() == (model, audit)
  assert builder.build_legacy() == json.loads(
    (ROOT / "src/app/src/data/bayerCampusV277Legacy.json").read_bytes()
  )
  assert (
    model["sourceSha256"] == hashlib.sha256(builder.SOURCE.read_bytes()).hexdigest()
  )
  for key, width in [("drawnPositions", 9), ("drawnDetails", 8), ("nativeDetails", 8)]:
    values = decoded(model, key, width)
    assert np.isfinite(values).all()
    if width == 8:
      assert (values[:, 3:6] > 0).all()
      if key == "nativeDetails":
        assert (values[:, 6] == 0).all()
  assert builder.DEST.stat().st_size < 1_600_000
  assert model["counts"]["shellTriangles"] < 1500
  assert model["counts"]["nativeBodyRuns"] + model["counts"]["nativeDetails"] < 24_000


def test_new_facade_boxes_do_not_duplicate_any_retained_neighbouring_v210_detail(
  source, model
):
  """Compare positive-volume intersection after the renderer's Float32 matrices."""
  from shapely.strtree import STRtree

  old = json.loads((ROOT / "src/app/src/data/weddingSitesV210.json").read_bytes())

  def bounds(row, native, previous):
    row = np.asarray(
      row[: 7 if native and previous else 11 if previous else 8], dtype=float
    )
    x, y, z, w, h, d = row[:6]
    if native:
      rotation = np.eye(3)
    elif previous:
      q = row[6:10] / np.linalg.norm(row[6:10])
      qx, qy, qz, qw = q
      rotation = np.array(
        [
          [
            1 - 2 * (qy * qy + qz * qz),
            2 * (qx * qy - qz * qw),
            2 * (qx * qz + qy * qw),
          ],
          [
            2 * (qx * qy + qz * qw),
            1 - 2 * (qx * qx + qz * qz),
            2 * (qy * qz - qx * qw),
          ],
          [
            2 * (qx * qz - qy * qw),
            2 * (qy * qz + qx * qw),
            1 - 2 * (qx * qx + qy * qy),
          ],
        ]
      )
    else:
      c, s = math.cos(row[6]), math.sin(row[6])
      rotation = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    matrix = (rotation * [w, h, d]).astype("<f4").astype(float)
    corners = np.array(
      [[a, b, c] for a in [-0.5, 0.5] for b in [-0.5, 0.5] for c in [-0.5, 0.5]]
    )
    points = corners @ matrix.T + np.asarray([x, y, z], dtype="<f4").astype(float)
    poly = Polygon(points[:, [0, 2]]).convex_hull
    return poly, points[:, 1].min(), points[:, 1].max()

  for native, key in [(False, "boxes"), (True, "blocks")]:
    excluded = {i for i, _ in source["retiredV210"][key]}
    retained = [
      bounds(r, native, True)
      for i, r in enumerate(old[key])
      if i not in excluded and -260 < r[0] < -40 and -2510 < r[2] < -2290
    ]
    tree = STRtree([b[0] for b in retained])
    new = decoded(model, "nativeDetails" if native else "drawnDetails")
    if native:
      new = new[model["counts"]["nativeBodyRuns"] :]
    overlaps = []
    for i, row in enumerate(new):
      poly, low, high = bounds(row, native, False)
      for j in tree.query(poly):
        other, bottom, top = retained[j]
        if (
          min(high, top) - max(low, bottom) > 0.00021
          and poly.intersection(other).area > 0.00001
        ):
          overlaps.append((i, int(j)))
    assert not overlaps, (native, overlaps[:20])
