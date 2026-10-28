"""Source ownership, exact replacement and native alignment for v281."""

from __future__ import annotations

import base64
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_mitte_ensemble_v281 as m  # noqa: E402


def test_complete_source_owners_and_roofs_are_preserved():
  source = m.read(m.SOURCE)
  evidence = m.read(m.EVIDENCE)
  expected = []
  for tile in ["390_5820", "390_5819"]:
    expected.extend(
      b
      for b in m.read(m.core.SOURCE / f"source-{tile}-00.json.gz")["buildings"]
      if b["id"] in m.OWNERS
    )
  assert source["buildings"] == expected
  assert m.sha(m.SOURCE) == evidence["sourceSha256"]
  assert m.sha(m.RUNTIME) == evidence["runtimeSha256"]
  assert m.sha(m.PREVIOUS) == evidence["previousSha256"]
  assert all(
    m.sha(ROOT / path) == digest for path, digest in evidence["sourceInputs"].items()
  )
  assert {b["id"] for b in expected} == m.OWNERS
  assert all(
    any(s["kind"] == "RoofSurface" for p in b["parts"] for s in p["surfaces"])
    for b in expected
  )


def test_every_drawn_fitting_is_clipped_to_the_selected_measured_wall():
  for b in m.read(m.SOURCE)["buildings"]:
    for p in b["parts"]:
      for si, s in enumerate(p["surfaces"]):
        key = m.target_key(b["id"], p["id"], si)
        if not key:
          continue
        o, n, _, axes, poly = m.surface_plane(s)
        for t, _, role in m.fittings(s, key).triangles:
          if b["id"] == m.HYPO:
            assert not any(
              term in role for term in ["glazing", "plaster field", "wall", "backing"]
            )
          pts = np.array(t)
          distance = (pts - o) @ n
          assert np.all(distance >= 0.219999) and np.all(distance <= 0.620001), role
          projection = pts - distance[:, None] * n
          assert poly.buffer(1e-6).covers(Polygon(projection[:, axes])), role


def test_native_follows_orthogonal_existing_faces_without_new_building_bodies():
  evidence = m.read(m.EVIDENCE)
  assert evidence["runtimeGzipBytes"] < 350_000
  for mode, packet in m.read(m.RUNTIME).items():
    assert not packet["nav"]["buildings"] and not packet.get("lines")
    for mesh in packet["meshes"]:
      assert mesh["kind"] == "mitte-ensemble-v281"
      pts = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
        + packet["origin"]
      )
      assert pts[:, 1].min() > 2 and pts[:, 1].max() < 26
      idx = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      if mode == "minecraft":
        t = pts[idx]
        normals = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
        assert np.all(np.count_nonzero(abs(normals) > 1e-7, axis=1) == 1)
  assert evidence["counts"]["drawn"]["roles"]["red-court: plain red rehearsal wall"] > 0
  assert evidence["counts"]["drawn"]["roles"]["splendid: central curved pediment"] > 0
  for counts in evidence["counts"].values():
    # The packet bounds must include every intended fitting, including the
    # eastern bank pilasters added after the original four-owner scope.
    assert counts["triangles"] == sum(counts["roles"].values())


def test_exact_generic_window_receipts_do_not_include_measured_shells():
  _, occupied, _ = m.retained()
  old = m.Detail()
  for b in m.read(m.SOURCE)["buildings"]:
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
      for si, s in enumerate(p["surfaces"]):
        if m.target_key(b["id"], p["id"], si):
          old.triangles.extend(
            m.core.facade(s["rings"], low, p["topY"], occupied).triangles
          )
  records, _ = m.receipts(old)
  assert records == m.read(m.PREVIOUS)["records"]
  assert sum(len(r["triangles"]) for r in records) == len(old.triangles) > 0
  assert {r["mode"] for r in records} == {"drawn"}
