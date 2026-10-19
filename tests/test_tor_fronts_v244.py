"""Exact Torstraße opening ownership, physical profiles and immutable old geometry."""

from __future__ import annotations

import base64
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_north_mitte_fronts_v239 as old  # noqa: E402
import build_tor_fronts_v244 as m  # noqa: E402


@pytest.fixture(scope="module")
def source():
  return m.read(m.SOURCE)


def test_tor_selection_is_exact_existing_receipts_and_old_bytes_survive(source):
  earlier = m.read(m.OLD_SOURCE)
  assert source["windows"] == [
    w for w in earlier["windows"] if w["road"] == "Torstraße"
  ]
  assert len(source["windows"]) == 1999
  assert len({w["owner"] for w in source["windows"]}) == 77
  assert Counter(w["role"] for w in source["windows"]) == {
    "window glazing": 1779,
    "shopfront glazing": 220,
  }
  assert not {w["owner"] for w in source["windows"]} & set(source["excludedOwners"])
  assert len(source["unchangedPackets"]) == 32
  for path, digest in {**source["sourceHashes"], **source["unchangedPackets"]}.items():
    assert m.sha(ROOT / path) == digest, path
  zone = unary_union([shape(r["geometry"]) for r in source["roads"]]).buffer(28)
  triangles, _ = old.current_triangles(zone)
  for w in source["windows"]:
    assert all(bytes.fromhex(t) in triangles for t in w["triangles"])
    assert zone.covers(Point(w["center"][0], w["center"][2]))


def test_fills_stay_in_old_openings_and_leave_old_vertical_mullions_clear(source):
  for w in source["windows"]:
    detail = m.Detail()
    m.opening(detail, w, False)
    center, t, n = (np.asarray(w[k]) for k in ("center", "tangent", "normal"))
    clip = m.wall_clip(w)
    glass_area = 0
    for points, _, role in detail.triangles:
      a = np.asarray(points) - center
      xy = np.column_stack((a @ t, a[:, 1]))
      outward = a @ n
      assert clip.buffer(0.00001).covers(m.Polygon(xy))
      if role.startswith("recessed-"):
        assert np.all(outward > 0.01199) and np.all(outward < 0.01201)
        assert np.max(np.abs(xy[:, 0])) <= w["width"] / 2 - 0.02499
        assert np.max(np.abs(xy[:, 1])) <= w["height"] * 0.48001
        assert np.all(xy[:, 0] < -0.05999) or np.all(xy[:, 0] > 0.05999)
        glass_area += m.Polygon(xy).area
      else:
        # Everything remains behind v239's fronts (+9 cm); the lower-glass
        # transom itself stays out of the original central vertical mullion.
        assert np.max(outward) < 0.08999
    assert glass_area / (w["width"] * w["height"]) > 0.82


def test_profiles_have_real_depth_and_shop_lower_panels_only_on_existing_shops(source):
  for shop in (False, True):
    w = next(w for w in source["windows"] if (w["role"] == "shopfront glazing") == shop)
    details = m.models({"windows": [w]})
    for family, detail in details.items():
      roles = {role for _, _, role in detail.triangles}
      assert ("existing-shopfront-base-panel" in roles) == shop
      assert {
        "existing-left-jamb-depth",
        "existing-right-jamb-depth",
        "existing-sill-return-depth",
      } <= roles
      for name in ["existing-left-jamb-depth", "existing-right-jamb-depth"]:
        ps = np.array(
          [p for tri, _, role in detail.triangles if role == name for p in tri]
        )
        assert np.ptp(ps @ np.asarray(w["normal"])) > 0.06
      if family == "minecraft":
        ts = np.asarray([tri for tri, _, _ in detail.triangles])
        normals = np.cross(ts[:, 1] - ts[:, 0], ts[:, 2] - ts[:, 0])
        assert np.all(np.count_nonzero(np.abs(normals) > 1e-8, axis=1) <= 1)


def test_no_guessed_named_reconstructions_or_navigation_and_bounded_packets(source):
  assert all("decision" in r for r in source["namedSitesReviewed"])
  assert source["namedSitesReviewed"][0]["owner"] not in {
    w["owner"] for w in source["windows"]
  }
  addition, evidence = m.read(m.ADDITION), m.read(m.EVIDENCE)
  assert evidence["sourceSha256"] == m.sha(m.SOURCE)
  assert evidence["additionSha256"] == m.sha(m.ADDITION)
  assert len(addition["chunks"]) == 6
  for desc in addition["chunks"]:
    for mode in ("drawn", "minecraft"):
      path = m.OUT / desc[mode]["url"]
      assert m.sha(path) == desc[mode]["sha256"]
      payload = m.read(path)
      assert (
        desc[mode]["decodedBytes"]
        == len(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode())
        + 1
      )
      assert desc[mode]["decodedBytes"] < 4 * 1024 * 1024
      assert desc[mode]["bytes"] < 1024 * 1024
      assert payload["nav"] == dict(groundY=3, ground=[], water=[], buildings=[])
      assert len(payload["meshes"]) == 1
      mesh = payload["meshes"][0]
      assert mesh["kind"] == "tor-fronts-v244"
      ps = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
        .reshape(-1, 3)
        .astype(float)
      )
      assert np.all(ps >= 0)
      assert np.all(ps[:, [0, 2]] <= 51200)
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      assert np.max(indices) < len(ps)
      if mode == "minecraft":
        ts = ps[indices]
        normals = np.cross(ts[:, 1] - ts[:, 0], ts[:, 2] - ts[:, 0])
        assert np.all(np.count_nonzero(normals, axis=1) <= 1)
