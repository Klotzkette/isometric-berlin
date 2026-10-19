"""IHZ facade-only correction preserves exact source geometry and retained glass."""

from __future__ import annotations

import base64
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_ihz_v241 as model  # noqa: E402


def test_exact_source_owners_and_existing_input_files_are_preserved():
  source = model.read(model.SOURCE)
  evidence = model.read(model.EVIDENCE)
  expected = []
  for path in model.core.SOURCE.glob("source-*.json.gz"):
    expected.extend(b for b in model.read(path)["buildings"] if b["id"] in model.OWNERS)
  assert sorted(source["buildings"], key=lambda b: b["id"]) == sorted(
    expected, key=lambda b: b["id"]
  )
  assert [a["sourceSheets"] for a in evidence["owners"]] == [153, 236, 21, 22]
  assert all(
    model.sha(ROOT / path) == digest
    for path, digest in evidence["sourceInputs"].items()
  )
  assert model.sha(model.RUNTIME) == evidence["runtimeSha256"]
  assert model.sha(model.PREVIOUS) == evidence["previousSha256"]
  assert evidence["retiredTriangles"] == 9080
  doro = next(b for b in expected if b["id"] == model.DORO)
  assert doro["category"] == "retained"
  assert "immutable v168 transparent glass shell" in doro["ownershipReasons"][0]
  assert evidence["owners"][0]["oldFacadeTriangles"] == 0


def test_doro_keeps_transparent_glass_and_all_fittings_stay_on_selected_measured_faces():
  for b in model.read(model.SOURCE)["buildings"]:
    for p in b["parts"]:
      for s in p["surfaces"]:
        if not model.selected(s, b["id"]):
          continue
        detail = model.fitting(s, b["id"], False)
        if b["id"] == model.DORO:
          assert not any(
            role
            in {"source-bound stone grid", "paired office glass", "glass reflection"}
            for _, _, role in detail.triangles
          )
        origin, normal, _, axes, polygon = model.surface_plane(s)
        for triangle, _, _ in detail.triangles:
          points = np.array(triangle)
          distance = (points - origin) @ normal
          assert np.all(distance >= 0.219999) and np.all(distance <= 0.360001)
          projected = points - distance[:, None] * normal
          assert polygon.buffer(1e-7).covers(Polygon(projected[:, axes]))


def test_small_required_profiles_have_no_new_roofs_lines_navigation_or_slanted_native_faces():
  runtime = model.read(model.RUNTIME)
  evidence = model.read(model.EVIDENCE)
  assert evidence["runtimeGzipBytes"] < 600_000
  for mode in ["drawn", "minecraft"]:
    packet = runtime[mode]
    assert len(packet["meshes"]) == 1
    assert not packet.get("lines") and not packet["nav"]["buildings"]
    part = packet["meshes"][0]
    pts = (
      np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3) / 100
      + packet["origin"]
    )
    indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
    assert len(indices) == evidence["counts"][mode]["triangles"]
    assert pts[:, 0].min() >= 1160 and pts[:, 0].max() <= 1285
    assert pts[:, 2].min() >= -85 and pts[:, 2].max() <= 85
    assert pts[:, 1].min() >= 3 and pts[:, 1].max() <= 39
    if mode == "minecraft":
      t = pts[indices]
      normals = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
      assert np.all(np.count_nonzero(abs(normals) > 1e-7, axis=1) == 1)


def test_exact_retirement_replays_only_selected_generic_faces():
  _, occupied, _ = model.retained()
  old = model.Detail()
  for b in model.read(model.SOURCE)["buildings"]:
    if b["category"] == "retained":
      continue
    for p in b["parts"]:
      low = min(
        (
          q[1]
          for s in p["surfaces"]
          if s["kind"] == "GroundSurface"
          for r in s["rings"]
          for q in r
        ),
        default=p["groundY"],
      )
      for s in p["surfaces"]:
        if model.selected(s, b["id"]):
          old.triangles.extend(
            model.core.facade(s["rings"], low, p["topY"], occupied).triangles
          )
  records, _ = model.receipts(old)
  assert model.read(model.PREVIOUS) == {"schemaVersion": 1, "records": records}
  assert len(old.triangles) == 9080
  assert all("source " not in role for _, _, role in old.triangles)
