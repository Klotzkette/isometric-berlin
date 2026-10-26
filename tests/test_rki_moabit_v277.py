"""Whole-source, native-union and real clearance checks for Nordufer/Moabit."""

from __future__ import annotations

import base64
import gzip
import json
import math
from collections import Counter, defaultdict

import numpy as np
import pytest
from shapely.geometry import Polygon, box

from scripts import build_rki_moabit_ownership_v277 as ownership
from scripts import build_rki_moabit_v277 as builder


@pytest.fixture(scope="module")
def model():
  return json.loads(builder.OUTPUT.read_bytes())


@pytest.fixture(scope="module")
def evidence():
  return json.loads(gzip.decompress(builder.SOURCE.read_bytes()))


def unpack(model, key):
  return np.frombuffer(base64.b64decode(model[key]), dtype="<f4").reshape(-1, 8)


def test_complete_original_sheets_replay_archive_and_common_vertical_datum(
  evidence, model
):
  assert evidence == builder.extract()
  assert model["sourceSha256"] == builder.digest(evidence)
  original = {
    p["id"]: (parent, p)
    for parent in evidence["parents"]
    if parent["site"] != "decks"
    for p in parent["parts"]
  }
  assert len(original) == 87
  assert {p["id"] for p in model["parts"] if p["site"] != "decks"} == set(original)
  for part in (p for p in model["parts"] if p["site"] != "decks"):
    parent, source = original[part["id"]]
    offset = -0.901 if parent["site"] == "rki" else 0.57
    assert part["ring"] == source["ring"]
    assert part["holes"] == source["holes"]
    assert part["minY"] == pytest.approx(source["ground_y_m"] + offset)
    assert part["maxY"] == pytest.approx(source["top_y_m"] + offset)
    assert part["sourceId"] in builder.OLD_IDS
    assert part["openCanopy"] == (parent["function"] == "51009_1610")
  assert model["counts"]["openCanopies"] == 4
  # The 51 m high industrial block and existing 76 m source stack cannot be
  # reduced to the obsolete 12 m compound prism or confused with a future stack.
  high = {
    p["parentId"][-8:]: p for p in model["parts"] if p["parentId"].endswith("2Lsy")
  }
  assert high["K0002Lsy"]["maxY"] - high["K0002Lsy"]["minY"] == pytest.approx(51.344)
  assert max(
    p["maxY"] for p in model["parts"] if p["site"] == "power"
  ) == pytest.approx(81.793)


def test_compaction_keeps_every_native_cell_interval_and_colour(model):
  expected = Counter()
  for p in model["parts"]:
    for x, z, top in p["nativeCells"]:
      cap = max(p["minY"] + 0.01, top - 0.25)
      if not p["openCanopy"]:
        expected[x, z, round(p["minY"], 4), round(cap, 4), p["wallColor"]] += 1
      expected[x, z, round(cap, 4), round(top, 4), p["roofColor"]] += 1
  actual = Counter()
  for x, y, z, w, h, d, yaw, colour in unpack(model, "nativeBodies").astype(float):
    assert yaw == 0 and min(w, h, d) > 0
    assert x - w / 2 == round(x - w / 2) and z - d / 2 == round(z - d / 2)
    for ix in range(round(x - w / 2), round(x + w / 2)):
      for iz in range(round(z - d / 2), round(z + d / 2)):
        actual[ix, iz, round(y - h / 2, 4), round(y + h / 2, 4), int(colour)] += 1
  assert actual == expected
  assert model["counts"]["nativeBodyBoxes"] < sum(expected.values())


def test_all_actual_float32_fittings_clear_all_body_volumes(model):
  bodies = defaultdict(list)
  for p in model["parts"]:
    for x, z, top in p["nativeCells"]:
      bodies[x, z].append((top - 0.25 if p["openCanopy"] else p["minY"], top))
  rows = unpack(model, "nativeDetails").astype(float)
  used = set()
  for receipt in model["fittingReceipts"]:
    for i in receipt["nativeIndices"]:
      assert i not in used
      used.add(i)
      x, y, z, w, h, d, yaw, _ = rows[i]
      assert yaw == 0
      for ix in range(math.floor(x - w / 2), math.ceil(x + w / 2)):
        for iz in range(math.floor(z - d / 2), math.ceil(z + d / 2)):
          overlap_x = min(x + w / 2, ix + 1) - max(x - w / 2, ix)
          overlap_z = min(z + d / 2, iz + 1) - max(z - d / 2, iz)
          if min(overlap_x, overlap_z) <= 0.0002:
            continue
          assert not any(
            min(y + h / 2, hi) - max(y - h / 2, lo) > 0.0002
            for lo, hi in bodies[ix, iz]
          ), (receipt, rows[i])
  # Only explicit narrow canopy supports may meet their own roof undersides.
  posts = sum(len(p["nativePosts"]) for p in model["parts"])
  assert used == set(range(posts, len(rows)))


def test_native_fittings_also_clear_every_deliberately_retained_shared_column(model):
  retained = json.loads(ownership.OUTPUT.read_bytes())["retainedSharedColumns"]
  for i, (x, y, z, w, h, d, _, _) in enumerate(
    unpack(model, "nativeDetails").astype(float)
  ):
    for ix, iz, low, high, _ in retained:
      overlap = [
        min(x + w / 2, (ix + 1) * 4) - max(x - w / 2, ix * 4),
        min(z + d / 2, (iz + 1) * 4) - max(z - d / 2, iz * 4),
        min(y + h / 2, high / 10) - max(y - h / 2, low / 10),
      ]
      assert min(overlap) <= 0.0002, (i, (ix, iz, low, high), overlap)


def test_native_roofs_follow_source_facets_and_leave_measured_courtyards(model):
  for p in model["parts"]:
    poly = Polygon(p["ring"], p["holes"])
    for x, z, top in p["nativeCells"]:
      clipped = poly.intersection(box(x, z, x + 1, z + 1))
      assert clipped.area > 0
      if p["site"] != "decks":
        assert clipped.area >= 0.035
      point = clipped.representative_point()
      source = (
        p["flatTop"]
        if p["flatTop"] is not None
        else builder.roof_at(p["roofTriangles"], point.x, point.y)
      )
      assert source is not None
      assert -0.000001 <= top - source <= 0.250001


def test_exact_old_owners_and_shared_neighbour_columns_remain_independent():
  current = json.loads(ownership.OUTPUT.read_bytes())
  assert current == ownership.build()
  assert {p["id"] for p in current["previousPrisms"]} == set(builder.OLD_IDS)
  assert "66743894" in {p["id"] for p in current["neighbours"]}
  exclusive = {tuple(c) for c in current["columns"]}
  shared = {tuple(c) for c in current["retainedSharedColumns"]}
  assert len(exclusive) == 1832 and len(shared) == 12
  assert exclusive.isdisjoint(shared)


def test_complete_deterministic_rebuild_and_finite_cost(evidence, model):
  assert builder.build(evidence) == model
  assert model["counts"]["drawnBytes"] < 1_900_000
  assert model["counts"]["nativeBytes"] < 5_200_000
  assert model["counts"]["roles"]["historic-arch"] > 0
  assert model["counts"]["roles"]["lab-floor-band"] > 0
  assert model["counts"]["roles"]["hall-window"] > 0


def test_all_current_decks_contract_parts_and_old_edges_remain_exact(model, evidence):
  decks = json.loads(gzip.decompress(builder.DECKS_SOURCE.read_bytes()))
  selected = {p["id"]: p for p in model["parts"] if p["site"] == "decks"}
  assert len(selected) == len(decks["parts"]) == 32
  assert len([p for p in evidence["parents"] if p["site"] == "decks"]) == 5
  for p in decks["parts"]:
    actual = selected[p["id"]]
    for a, b in [
      ("ring", "ring"),
      ("holes", "holes"),
      ("sourceId", "sourceId"),
      ("minY", "ground_y_m"),
      ("maxY", "top_y_m"),
    ]:
      assert actual[a] == p[b]
    assert actual["nativeCells"], p["id"]
    assert actual["flatTop"] == p["top_y_m"]
    assert actual["maxY"] == pytest.approx(p["roofNhn"] - 30 + p["verticalOffset"])
    if p["id"].startswith("retained-original-edge"):
      assert actual["maxY"] == 14.2
  # The numerical sliver is preserved in source/profile data, and receives
  # conservative independent native cells even below Float32 visual precision.
  assert min(Polygon(p["ring"], p["holes"]).area for p in selected.values()) < 1e-10
  assert "64895468" not in {p["sourceId"] for p in selected.values()}
  neighbours = json.loads(ownership.OUTPUT.read_bytes())["neighbours"]
  assert "64895468" in {p["id"] for p in neighbours}
