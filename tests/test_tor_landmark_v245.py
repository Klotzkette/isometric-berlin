"""Independent source, whole-wall, native and byte-preservation checks for Tor138."""

import json
import sys
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_tor_landmark_v245 as m  # noqa: E402


@pytest.fixture(scope="module")
def source():
  return m.read(m.SOURCE)


def test_exact_named_parent_complete_parts_and_earlier_packets_preserved(source):
  assert source["owner"] == "DEBE01YYK00007I6"
  assert source["osmWay"] == "386915734" and source["lda"] == "09080095"
  original = next(
    b
    for b in m.read(m.GEO / "mitte-streets-v166.json")["buildings"]
    if b["id"] == m.OWNER
  )
  assert source["retainedParent"] == original
  assert len(original["parts"]) == 3
  assert (
    sum(s["kind"] == "RoofSurface" for p in original["parts"] for s in p["surfaces"])
    == 6
  )
  assert source["terrainOffsetY"] == 1.66
  for path, digest in {**source["sourceHashes"], **source["unchangedPackets"]}.items():
    assert m.sha(ROOT / path) == digest, path
  old = m.read(m.GEO / "north-mitte-fronts-v239-source.json.gz")
  owner_panes = [w for w in old["windows"] if w["owner"] == m.OWNER]
  assert len(owner_panes) == 16 and all(
    w["road"] == "Linienstraße" for w in owner_panes
  )
  assert all(w["center"][2] > -1080 for w in owner_panes)


def test_source_wall_receipts_match_complete_delivered_drawn_and_native_faces(source):
  for mode, key in [("drawn", "drawnWallTriangles"), ("minecraft", "nativeFront")]:
    recorded = source[key] if mode == "drawn" else source[key]["triangles"]
    current = m.decode(m.OUT / f"3_-3.{mode}.json.gz")

    def keys(tris):
      return {
        tuple(sorted(tuple(int(round(v * 100)) for v in p) for p in tri))
        for tri in tris
      }

    assert keys(recorded) <= keys(current)
  assert len(source["drawnWallTriangles"]) == 2
  support = unary_union(
    [Polygon([(p[0], p[1]) for p in t]) for t in source["nativeFront"]["triangles"]]
  )
  assert support.buffer(1e-6).covers(box(1916.36, 4.66, 1931.17, 24.2))


def test_every_fitting_within_real_street_wall_and_native_faces_are_independent(source):
  a = np.array(source["frame"]["origin"])
  t = np.array(source["frame"]["tangent"])
  n = np.array(source["frame"]["normal"])
  rings = source["streetWall"]["rings"]
  planar = Polygon(
    [[(np.array(p) - a) @ t, p[1] + source["terrainOffsetY"] - a[1]] for p in rings[0]]
  )
  drawn = m.model(source, False)
  for tri, _, role in drawn.triangles:
    ps = np.array(tri)
    xy = np.column_stack(((ps - a) @ t, ps[:, 1] - a[1]))
    assert planar.buffer(0.00001).covers(Polygon(xy)), role
    assert np.min((ps - a) @ n) >= 0.015 - 1e-6, role
    assert np.max((ps - a) @ n) <= 1.201, role
  native = m.model(source, True)
  tris = np.array([tri for tri, _, _ in native.triangles])
  normal = np.cross(tris[:, 1] - tris[:, 0], tris[:, 2] - tris[:, 0])
  assert np.all(np.count_nonzero(np.abs(normal) > 1e-8, axis=1) == 1)
  assert tris[:, :, 0].min() >= source["nativeFront"]["xMin"] - 1e-6
  assert tris[:, :, 0].max() <= source["nativeFront"]["xMax"] + 1e-6
  assert tris[:, :, 2].max() < source["nativeFront"]["z"]
  assert not np.array_equal(np.array([t for t, _, _ in drawn.triangles]), tris)
  assert not any("roof" in role or "gable" in role for _, _, role in native.triangles)


def test_erker_has_real_side_depth_balconies_open_and_do_not_block_walking(source):
  for native in (False, True):
    d = m.model(source, native)
    f = m.Front(source, native)
    groups = {
      role: np.array([p for tri, _, r in d.triangles if r == role for p in tri])
      for role in {r for _, _, r in d.triangles}
    }
    erker = groups["three-storey-erker"]
    assert np.ptp((erker - f.origin) @ f.n) > 0.8
    assert np.ptp(erker[:, 1]) == pytest.approx(11.86)
    assert erker[:, 1].min() > f.ground + 3.9
    slabs = groups["open-balcony-slab"]
    assert (
      len(np.unique(np.round(slabs[:, 1], 3))) == 6
    )  # three real upper+lower slab faces
    assert slabs[:, 1].min() > f.ground + 7.7
    # No filled balcony-room mass; only slab, railing and side edges.
    for tri, _, role in d.triangles:
      center = np.mean(np.array(tri), axis=0)
      u = float((center - f.origin) @ f.t)
      out = float((center - f.origin) @ f.n)
      y = center[1] - f.ground
      if 8 < u < 10.6 and 0.35 < out < 0.9:
        assert role == "open-balcony-slab", (role, u, y, out)
    assert "erker-window-mullion" in groups and "paired-side-window-transom" in groups


def test_one_small_packet_pair_with_no_roof_body_nav_or_runtime_growth(source):
  addition = m.read(m.ADDITION)
  evidence = m.read(m.EVIDENCE)
  assert len(addition["chunks"]) == 1
  assert evidence["sourceSha256"] == m.sha(m.SOURCE)
  assert evidence["additionSha256"] == m.sha(m.ADDITION)
  descriptor = addition["chunks"][0]
  assert descriptor["id"] == "torlandmark245-3_-3"
  assert descriptor["detailCompanionOf"] == "3_-3"
  for mode in ("drawn", "minecraft"):
    path = m.OUT / descriptor[mode]["url"]
    payload = m.read(path)
    assert m.sha(path) == descriptor[mode]["sha256"]
    assert path.stat().st_size < 40_000
    assert payload["nav"] == dict(groundY=3, ground=[], water=[], buildings=[])
    assert (
      len(payload["meshes"]) == 1
      and payload["meshes"][0]["kind"] == "tor-landmark-v245"
    )
    assert evidence["packetCounts"][mode]["gpuBytes"] < 80_000
    assert (
      descriptor[mode]["decodedBytes"]
      == len(json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode())
      + 1
    )


def test_window_layers_remain_separated_after_centimetre_storage(source):
  """The actual encoded layer planes must not collapse onto their backing faces."""
  import base64

  for native in (False, True):
    f = m.Front(source, native)
    f.window(5.55, 9.79, 2.55, 2.36, 0.915, 3)
    encoded = {}
    for role in {r for _, _, r in f.detail.triangles}:
      isolated = m.Detail()
      isolated.triangles = [entry for entry in f.detail.triangles if entry[2] == role]
      mesh = m.packed_detail(isolated, box(1536, -1536, 2048, -1024))
      points = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
        -1, 3
      ) / 100 + [1536, -10, -1536]
      encoded[role] = (points - f.origin) @ f.n
    backing = encoded["grouped-window-surround"]
    glass = encoded["grouped-window-glazing"]
    reflection = encoded["grouped-window-upper-reflection"]
    assert glass.min() - backing.max() > 0.015
    assert reflection.min() - glass.max() > 0.012
    for role in ("grouped-window-mullion", "grouped-window-transom"):
      assert encoded[role].min() - reflection.max() > 0.008
