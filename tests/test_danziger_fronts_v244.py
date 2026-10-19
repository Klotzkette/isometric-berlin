"""Independent finite-wall, immutable-source and native-family v244 checks."""

import base64
import gzip
import hashlib
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import pyogrio
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


SOURCE = read(GEO / "danziger-fronts-v244-source.json.gz")
EVIDENCE = read(GEO / "danziger-fronts-v244-evidence.json")
ADDITION = read(GEO / "danziger-fronts-v244-manifest-addition.json")


def test_complete_retained_street_course_and_protected_source_owners() -> None:
  roads = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/candidate.gpkg",
    layer="lines",
    where="name='Danziger Straße' AND highway='primary'",
    read_geometry=False,
  )
  assert {r["id"] for r in SOURCE["roads"]} == set(roads.osm_id.astype(str))
  assert len(SOURCE["roads"]) == 118
  assert {f["streetName"] for f in SOURCE["faces"]} == {"Danziger Straße"}
  assert {f["streetId"] for f in SOURCE["faces"]} <= {r["id"] for r in SOURCE["roads"]}
  authored = set(SOURCE["authoredIds"])
  protected = STRtree(
    [shape(b["geometry"]) for b in SOURCE["sourceBuildings"] if b["protectedReasons"]]
  )
  keys = []
  for face in SOURCE["faces"]:
    assert face["owner"] not in authored
    packet = SOURCE["parents"][face["chunk"]]
    # The source building record is complete, including courtyard rings.
    b = face["sourceBuilding"]
    ox, oz = packet["bounds"][:2]
    poly = translate(Polygon(b["ring"], b["holes"]), ox, oz)
    assert not len(protected.query(poly, predicate="intersects"))
    assert all(not poly.covers(Point(s["point"])) for s in SOURCE["primarySites"])
    keys.append((face["owner"], tuple(sorted((tuple(face["a"]), tuple(face["b"]))))))
  assert len(keys) == len(set(keys))
  assert len({f["owner"] for f in SOURCE["faces"]}) == EVIDENCE["counts"]["owners"]
  assert any(f["a"][0] < 3000 for f in SOURCE["faces"])
  assert any(f["a"][0] > 5100 for f in SOURCE["faces"])
  # Explicit primary-source protection for the historic corner and modern Paragon.
  by_id = {b["id"]: b for b in SOURCE["sourceBuildings"]}
  assert "primary-heritage-locator" in by_id["41724936"]["protectedReasons"]
  assert "named-public-building" in by_id["17959154"]["protectedReasons"]
  assert "DEBE03YY60000CKO" not in {f["owner"] for f in SOURCE["faces"]}


def exact_triangles(packet: dict) -> set:
  result = set()
  for part in packet["meshes"]:
    if part["kind"] != "city":
      continue
    p = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
    c = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
    for tri in ix[np.all(np.all(c == [166, 161, 139], axis=1)[ix], axis=1)]:
      result.add(tuple(sorted(tuple(map(int, v)) for v in p[tri])))
  return result


def matches_two_triangles(
  triangles: set, a: list, b: list, lo: float, hi: float, origin: list
) -> bool:
  q = [
    tuple(round((v - o) * 100) for v, o in zip(p, origin, strict=True))
    for p in [[a[0], lo, a[1]], [b[0], lo, b[1]], [b[0], hi, b[1]], [a[0], hi, a[1]]]
  ]
  return any(
    all(tuple(sorted(q[i] for i in tri)) in triangles for tri in pair)
    for pair in [((0, 1, 2), (0, 2, 3)), ((0, 1, 3), (1, 2, 3))]
  )


def test_every_drawn_and_native_front_matches_its_complete_actual_old_wall() -> None:
  grouped = defaultdict(list)
  for f in SOURCE["faces"]:
    grouped[f["chunk"]].append(f)
  for chunk, faces in grouped.items():
    desc = SOURCE["parents"][chunk]
    for family in ("drawn", "minecraft"):
      packet = read(OUT / desc[family]["url"])
      triangles = exact_triangles(packet)
      selected = (
        faces if family == "drawn" else [s for f in faces for s in f["nativeSpans"]]
      )
      for f in selected:
        assert f["sourceBuilding"] in packet["nav"]["buildings"]
        a, b = f.get("sourceWall", [f["a"], f["b"]])
        assert matches_two_triangles(
          triangles, a, b, f["low"], f["high"], packet["origin"]
        )
        # A fake navigation seam and a shifted exterior wall must both be rejected.
        mid = [(a[i] + b[i]) / 2 for i in range(2)]
        assert not matches_two_triangles(
          triangles, a, mid, f["low"], f["high"], packet["origin"]
        )
        assert not matches_two_triangles(
          triangles,
          [a[0] + 0.2, a[1]],
          [b[0] + 0.2, b[1]],
          f["low"],
          f["high"],
          packet["origin"],
        )
        if family == "minecraft":
          assert a[0] == b[0] or a[1] == b[1]
          assert LineString([a, b]).buffer(0.001).covers(LineString([f["a"], f["b"]]))


def test_packet_receipts_and_companion_limits_preserve_source() -> None:
  assert (
    hashlib.sha256(
      (GEO / "danziger-fronts-v244-source.json.gz").read_bytes()
    ).hexdigest()
    == EVIDENCE["sourceSha256"]
  )
  for url, sha in SOURCE["packetReceipts"].items():
    assert hashlib.sha256((OUT / url).read_bytes()).hexdigest() == sha
  assert ADDITION["chunks"] == EVIDENCE["companions"]
  assert len(ADDITION["chunks"]) == 8
  for family in ("drawn", "minecraft"):
    total_bytes, vertices, mesh_bytes = 0, 0, 0
    for desc in ADDITION["chunks"]:
      assert desc["id"] == "danzigerfront244-" + desc["detailCompanionOf"]
      asset = desc[family]
      raw = (OUT / asset["url"]).read_bytes()
      decoded = gzip.decompress(raw)
      assert len(raw) == asset["bytes"]
      assert len(decoded) == asset["decodedBytes"] < 4 * 1024 * 1024
      assert hashlib.sha256(raw).hexdigest() == asset["sha256"]
      packet = json.loads(decoded)
      assert packet["nav"] == {"groundY": 3, "ground": [], "water": [], "buildings": []}
      assert len(packet["meshes"]) == 1
      mesh = packet["meshes"][0]
      assert mesh["kind"] == "danziger-fronts-v244"
      n = len(base64.b64decode(mesh["positions"])) // 6
      ni = len(base64.b64decode(mesh["indices"])) // 4
      assert n < 400000 and ni < 2400000
      vertices += n
      mesh_bytes += n * 12 + ni * (2 if n <= 65535 else 4)
      total_bytes += len(raw)
    assert vertices == EVIDENCE["counts"][family + "Vertices"]
    assert mesh_bytes == EVIDENCE["counts"][family + "GeometryBytes"]
    assert total_bytes == EVIDENCE["counts"][family + "TransferBytes"]


def test_each_emitted_rectangle_is_against_a_finite_source_wall_and_native_is_orthogonal() -> (
  None
):
  for desc in ADDITION["chunks"]:
    faces = [f for f in SOURCE["faces"] if f["chunk"] == desc["detailCompanionOf"]]
    for family in ("drawn", "minecraft"):
      selected = (
        faces if family == "drawn" else [s for f in faces for s in f["nativeSpans"]]
      )
      packet = read(OUT / desc[family]["url"])
      mesh = packet["meshes"][0]
      p = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
        + packet["origin"]
      )
      assert np.isfinite(p).all()
      assert (p[:, 0] >= desc["bounds"][0]).all() and (
        p[:, 0] <= desc["bounds"][2]
      ).all()
      assert (p[:, 2] >= desc["bounds"][1]).all() and (
        p[:, 2] <= desc["bounds"][3]
      ).all()
      quads = p.reshape(-1, 4, 3)
      covered = np.zeros(len(quads), dtype=bool)
      for f in selected:
        a, b = np.array(f["a"]), np.array(f["b"])
        d = b - a
        width = np.linalg.norm(d)
        d /= width
        delta = quads[:, :, [0, 2]] - a
        u, depth = delta @ d, delta @ np.array(f["normal"])
        covered |= (
          (u.min(axis=1) >= -0.02)
          & (u.max(axis=1) <= width + 0.02)
          & (depth.min(axis=1) >= 0.06)
          & (depth.max(axis=1) <= 0.14)
          & (quads[:, :, 1].min(axis=1) >= f["low"])
          & (quads[:, :, 1].max(axis=1) <= f["high"])
        )
      assert covered.all(), (desc["id"], family, p[np.repeat(~covered, 4)][:8])
      assert len({tuple(q.flatten()) for q in quads}) == len(quads)
      if family == "minecraft":
        assert (
          (np.ptp(quads[:, :, 0], axis=1) < 0.001)
          | (np.ptp(quads[:, :, 2], axis=1) < 0.001)
        ).all()


def test_actual_native_glazing_never_enters_an_original_neighbour_building() -> None:
  # Inspect emitted glass, not the generator's omission metadata or helper.
  occupied = []
  for url in SOURCE["packetReceipts"]:
    if ".minecraft." not in url:
      continue
    packet = read(OUT / url)
    ox, _, oz = packet["origin"]
    for b in packet["nav"]["buildings"]:
      poly = translate(Polygon(b["ring"], b["holes"]), ox, oz)
      if poly.is_valid and not poly.is_empty:
        occupied.append(poly)
  tree = STRtree(occupied)
  checked = 0
  for desc in ADDITION["chunks"]:
    packet = read(OUT / desc["minecraft"]["url"])
    mesh = packet["meshes"][0]
    p = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
      + packet["origin"]
    )
    c = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 4, 3)
    for q in p.reshape(-1, 4, 3)[np.all(c[:, 0] == [27, 47, 56], axis=1)]:
      line = LineString([q[0, [0, 2]], q[1, [0, 2]]])
      assert not len(tree.query(line, predicate="intersects")), (desc["id"], q)
      checked += 1
  assert checked == EVIDENCE["counts"]["minecraftWindows"]
