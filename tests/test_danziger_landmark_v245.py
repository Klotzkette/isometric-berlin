"""Independent source-plane, preservation and family checks for Danziger57."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


SOURCE = read(GEO / "danziger-landmark-v245-source.json.gz")
EVIDENCE = read(GEO / "danziger-landmark-v245-evidence.json")
ADDITION = read(GEO / "danziger-landmark-v245-manifest-addition.json")


def test_exact_named_owner_and_all_previous_packets_are_preserved() -> None:
  assert SOURCE["owner"] == "DEBE03YY60000CKO"
  assert SOURCE["mappedSource"]["id"] == "41724936"
  assert "primary-heritage-locator" in SOURCE["mappedSource"]["protectedReasons"]
  assert shape(SOURCE["mappedSource"]["geometry"]).covers(
    Point(3450.8792206231738, -2258.574167402461)
  )
  assert (
    hashlib.sha256(
      (GEO / "danziger-landmark-v245-source.json.gz").read_bytes()
    ).hexdigest()
    == EVIDENCE["sourceSha256"]
  )
  assert (
    hashlib.sha256(
      (GEO / "danziger-fronts-v244-source.json.gz").read_bytes()
    ).hexdigest()
    == SOURCE["previousSourceSha256"]
  )
  previous = read(GEO / "danziger-fronts-v244-manifest-addition.json")
  assert len(SOURCE["packetReceipts"]) == 20
  for desc in previous["chunks"]:
    for mode in ("drawn", "minecraft"):
      assert SOURCE["packetReceipts"][desc[mode]["url"]] == desc[mode]["sha256"]
  for url, sha in SOURCE["packetReceipts"].items():
    assert hashlib.sha256((OUT / url).read_bytes()).hexdigest() == sha
  assert ADDITION["chunks"] == EVIDENCE["companions"]
  assert len(ADDITION["chunks"]) == 1


def test_finish_does_not_cover_previous_authored_facade_details() -> None:
  old = read(GEO / "danziger-fronts-v244-source.json.gz")
  assert not any(f["owner"] == SOURCE["owner"] for f in old["faces"])
  for mode, family in SOURCE["families"].items():
    parent = read(OUT / SOURCE["parent"][mode]["url"])
    assert {m["kind"] for m in parent["meshes"]} == {"city"}
    # The only older companion covering this owner is kiez209. Check its actual
    # triangles against all finite street faces, not only a semantic owner list.
    name = f"kiez209-6_-5.{mode}.json.gz"
    assert name in SOURCE["packetReceipts"]
    packet = read(OUT / name)
    for mesh in packet["meshes"]:
      points = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
        + packet["origin"]
      )
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      tri = points[indices]
      for face in family["faces"]:
        a = np.array(face["a"])
        d = np.array(face["b"]) - a
        width = np.linalg.norm(d)
        d /= width
        u = (tri[:, :, [0, 2]] - a) @ d
        depth = (tri[:, :, [0, 2]] - a) @ np.array(face["normal"])
        y = tri[:, :, 1]
        overlaps = (
          (u.max(1) > 0.03)
          & (u.min(1) < width - 0.03)
          & (depth.min(1) > -0.02)
          & (depth.max(1) < 0.30)
          & (y.max(1) > face["low"] + 0.02)
          & (y.min(1) < face["high"] - 0.02)
        )
        assert not overlaps.any()


def original_triangles(packet: dict) -> set:
  found = set()
  for mesh in packet["meshes"]:
    if mesh["kind"] != "city":
      continue
    p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
    c = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    for tri in ix[np.all(np.all(c == [166, 161, 139], axis=1)[ix], axis=1)]:
      found.add(tuple(sorted(tuple(map(int, v)) for v in p[tri])))
  return found


def test_all_complete_source_wall_triangles_not_only_nav_or_partial_seams() -> None:
  for mode, family in SOURCE["families"].items():
    packet = read(OUT / SOURCE["parent"][mode]["url"])
    building = family["sourceBuilding"]
    assert building in packet["nav"]["buildings"]
    triangles = original_triangles(packet)
    ox, oy, oz = packet["origin"]
    poly = translate(Polygon(building["ring"], building["holes"]), ox, oz)
    for face in family["faces"]:
      assert face["owner"] == building["sourceId"]
      a, b = face["a"], face["b"]
      q = [
        tuple(round((v - o) * 100) for v, o in zip(p, packet["origin"], strict=True))
        for p in [
          [a[0], face["low"], a[1]],
          [b[0], face["low"], b[1]],
          [b[0], face["high"], b[1]],
          [a[0], face["high"], a[1]],
        ]
      ]
      assert any(
        all(tuple(sorted(q[i] for i in tri)) in triangles for tri in pair)
        for pair in [((0, 1, 2), (0, 2, 3)), ((0, 1, 3), (1, 2, 3))]
      )
      edge = face["sourceEdge"]
      np.testing.assert_allclose(a, np.array(building["ring"][edge]) + [ox, oz])
      np.testing.assert_allclose(b, np.array(building["ring"][edge + 1]) + [ox, oz])
      mid = (np.array(a) + b) / 2 + np.array(face["normal"]) * 0.22
      assert not poly.covers(Point(mid))
      if mode == "minecraft":
        assert a[0] == b[0] or a[1] == b[1]
    assert {f["group"] for f in family["faces"]} >= {"danziger", "senefelder"}
  assert {f["sourceEdge"] for f in SOURCE["families"]["drawn"]["faces"]} == {
    0,
    1,
    2,
    3,
    13,
  }


def test_every_new_fitting_stays_on_one_real_wall_with_no_roof_or_collision_replacement() -> (
  None
):
  desc = ADDITION["chunks"][0]
  for mode, family in SOURCE["families"].items():
    asset = desc[mode]
    raw = (OUT / asset["url"]).read_bytes()
    assert len(raw) == asset["bytes"] < 40000
    assert hashlib.sha256(raw).hexdigest() == asset["sha256"]
    decoded = gzip.decompress(raw)
    assert len(decoded) == asset["decodedBytes"] < 200000
    packet = json.loads(decoded)
    assert packet["nav"] == {"groundY": 3, "ground": [], "water": [], "buildings": []}
    assert packet["origin"] == family["origin"]
    assert len(packet["meshes"]) == 1
    mesh = packet["meshes"][0]
    assert mesh["kind"] == "danziger-landmark-v245"
    p = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
      + packet["origin"]
    )
    ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4")
    assert len(p) == EVIDENCE["counts"][mode]["vertices"]
    assert len(p) * 12 + len(ix) * 2 == EVIDENCE["counts"][mode]["geometryBytes"]
    quads = p.reshape(-1, 4, 3)
    covered = np.zeros(len(quads), dtype=bool)
    assert np.isfinite(p).all()
    for f in family["faces"]:
      a, b = np.array(f["a"]), np.array(f["b"])
      d = b - a
      w = np.linalg.norm(d)
      d /= w
      delta = quads[:, :, [0, 2]] - a
      u = delta @ d
      depth = delta @ np.array(f["normal"])
      covered |= (
        (u.min(axis=1) >= 0.01)
        & (u.max(axis=1) <= w - 0.01)
        & (depth.min(axis=1) >= 0.01)
        & (depth.max(axis=1) <= 0.255)
        & (quads[:, :, 1].min(axis=1) >= f["low"] + 0.009)
        & (quads[:, :, 1].max(axis=1) <= f["high"] - 0.009)
      )
    assert covered.all()
    if mode == "minecraft":
      assert (
        (np.ptp(quads[:, :, 0], axis=1) < 0.001)
        | (np.ptp(quads[:, :, 2], axis=1) < 0.001)
      ).all()
    # Every face remains within its original bounded primary tile.
    assert (p[:, 0] >= desc["bounds"][0]).all() and (p[:, 0] <= desc["bounds"][2]).all()
    assert (p[:, 2] >= desc["bounds"][1]).all() and (p[:, 2] <= desc["bounds"][3]).all()


def test_reference_credit_and_distinct_architecture_are_preserved() -> None:
  refs = EVIDENCE["references"]
  assert "09075102" in refs[0]["url"]
  assert refs[1]["author"] == "Bodo Kubrak" and refs[1]["license"] == "CC BY-SA 4.0"
  for mode in ("drawn", "minecraft"):
    q = read(OUT / ADDITION["chunks"][0][mode]["url"])
    c = np.frombuffer(base64.b64decode(q["meshes"][0]["colors"]), "u1").reshape(-1, 3)
    # Separate red brick and warm light stone, not another generic grey pane set.
    assert ((c[:, 0] > c[:, 1] * 2) & (c[:, 1] > c[:, 2])).any()
    assert ((c[:, 0] > 150) & (c[:, 1] > 130) & (c[:, 2] > 100)).any()
    assert EVIDENCE["counts"][mode]["pediments"] >= 10
    assert EVIDENCE["counts"][mode]["windows"] >= 70


def test_quantized_cladding_has_no_overlapping_finish_and_clear_joint_separation() -> (
  None
):
  for mode, family in SOURCE["families"].items():
    packet = read(OUT / ADDITION["chunks"][0][mode]["url"])
    mesh = packet["meshes"][0]
    quads = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 4, 3) / 100
      + packet["origin"]
    )
    for face in family["faces"]:
      a, b = np.array(face["a"]), np.array(face["b"])
      d = b - a
      width = np.linalg.norm(d)
      d /= width
      delta = quads[:, :, [0, 2]] - a
      u = delta @ d
      depth = delta @ np.array(face["normal"])
      on_face = (
        (u.min(1) >= 0.01)
        & (u.max(1) <= width - 0.01)
        & (depth.min(1) > 0.015)
        & (depth.max(1) < 0.26)
      )
      full_width = (np.ptp(u, axis=1) > width - 0.1) & on_face
      heights = np.ptp(quads[:, :, 1], axis=1)
      skins = full_width & (heights > 4)
      selected = quads[skins]
      assert len(selected) == (1 if face["group"] == "corner" else 2)
      # Finished base and upper brick now only meet at an edge after encoding.
      intervals = sorted((q[:, 1].min(), q[:, 1].max()) for q in selected)
      for previous, following in zip(intervals, intervals[1:]):
        assert previous[1] <= following[0]
      joints = full_width & (heights >= 0.03) & (heights <= 0.06)
      assert joints.any()
      assert depth[joints].min() - depth[skins].max() >= 0.015
