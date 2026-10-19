"""Measured source, source-plane clipping and independent native Q207 regressions."""

from __future__ import annotations

import base64
import gzip
import sys
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import build_lafayette_v241 as model  # noqa: E402
from alt_mitte_v169_packets import empty_packet, pack_detail  # noqa: E402


def test_complete_thirteen_owner_source_is_exact_and_current_use_is_not_invented():
  retained = model.read(model.CATALOGUE)
  source = model.read(model.SOURCE)
  expected = [
    b for b in retained["buildings"] if b["id"] in model.AUXILIARY | {model.MAIN}
  ]
  assert source["buildings"] == expected
  assert len(expected) == 13
  main = next(b for b in expected if b["id"] == model.MAIN)
  assert main["osmTags"]["osm_way_id"] == "25945410"
  assert len(main["parts"][0]["surfaces"]) == 97
  assert "2027" in source["currentUse"] and "closed in 2024" in source["currentUse"]
  assert source["visualReferences"][0]["author"] == "Jörg Zägel"


@pytest.mark.parametrize("index", [0, 15, 34, 35, 48, 51, 79, 95])
def test_glass_covers_actual_street_and_roof_sheet_without_invented_outline(index):
  source = model.read(model.SOURCE)
  main = next(b for b in source["buildings"] if b["id"] == model.MAIN)
  surface = main["parts"][0]["surfaces"][index]
  detail = model.Detail()
  model.attach(detail, surface, False, [], index)
  origin, normal, _, axes, polygon = model.surface_plane(surface)
  coverage = []
  for triangle, _, role in detail.triangles:
    points = np.array(triangle)
    distance = (points - origin) @ normal
    assert (distance >= -1e-7).all() and (distance <= 0.650001).all()
    projected = points - distance[:, None] * normal
    shape = Polygon(projected[:, axes])
    assert polygon.buffer(1e-7).covers(shape)
    if role in {"continuous curtain glazing", "roof glazing on retained plane"}:
      coverage.append(shape)
  assert coverage
  assert unary_union(coverage).area == pytest.approx(polygon.area, abs=1e-4)


def test_packets_are_reproducible_bounded_and_native_planes_are_orthogonal():
  source, runtime = model.read(model.SOURCE), model.read(model.RUNTIME)
  evidence = model.read(model.EVIDENCE)
  assert evidence["runtimeSha256"] == model.sha(model.RUNTIME)
  assert evidence["sourceSha256"] == model.sha(model.SOURCE)
  assert evidence["runtimeGzipBytes"] < 250_000
  assert (
    len(gzip.compress(model.RUNTIME.read_bytes(), mtime=0))
    == evidence["runtimeGzipBytes"]
  )
  for mode in ["drawn", "minecraft"]:
    detail, audits = model.details(source, mode == "minecraft")
    packet = empty_packet("quartier207-v241-" + mode, model.BOUNDS)
    packet["meshes"] = pack_detail(detail, model.BOUNDS, origin_y=-10)
    for mesh in packet["meshes"]:
      mesh["kind"] = "quartier207-v241"
    assert packet == runtime[mode]
    assert audits == evidence["counts"][mode]["surfaces"]
    assert len(packet["meshes"]) == 1
    assert not packet.get("lines")
    assert not packet["nav"]["buildings"]
    m = packet["meshes"][0]
    p = (
      np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3) / 100
      + packet["origin"]
    )
    idx = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    assert p[:, 0].min() >= 1200 and p[:, 0].max() <= 1282
    assert p[:, 2].min() >= 485 and p[:, 2].max() <= 580
    assert p[:, 1].min() >= 5 and p[:, 1].max() <= 41.1
    if mode == "minecraft":
      triangles = p[idx]
      normals = np.cross(
        triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
      )
      assert (np.count_nonzero(abs(normals) > 1e-7, axis=1) == 1).all()
      # Every native fitting plane derives from retained main-owner faces.
      assert all(a["sourcePolygonId"].startswith("retained-native-") for a in audits)
    else:
      assert {a["surface"] for a in audits if a["kind"] == "RoofSurface"} == {
        35,
        51,
        95,
      }
