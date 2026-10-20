"""Independent source ownership and preserved opening checks for v252."""

import base64
import gzip
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, box, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


SOURCE = read(GEO / "kulturbrauerei-v252-source.json.gz")
DATA = read(ROOT / "src/app/src/data/kulturbrauereiV252.json")
EVIDENCE = read(GEO / "kulturbrauerei-v252-evidence.json")


def triangles(packet: dict, kind: str | None = None) -> set:
  result = set()
  for mesh in packet["meshes"]:
    if kind is not None and mesh["kind"] != kind:
      continue
    pos = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    result.update(tuple(sorted(tuple(map(int, p)) for p in pos[t])) for t in ix)
  return result


def matches(points: list, origin: list, tris: set) -> bool:
  q = [
    tuple(int(round((v - o) * 100)) for v, o in zip(p, origin, strict=True))
    for p in points
  ]
  return any(
    all(tuple(sorted(q[i] for i in t)) in tris for t in pair)
    for pair in (((0, 1, 2), (0, 2, 3)), ((0, 1, 3), (1, 2, 3)))
  )


def test_every_input_and_old_packet_is_unchanged() -> None:
  assert (
    hashlib.sha256(
      (GEO / "kulturbrauerei-v252-source.json.gz").read_bytes()
    ).hexdigest()
    == EVIDENCE["sourceSha256"]
  )
  for name, sha in SOURCE["inputReceipts"].items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == sha
  for name, sha in SOURCE["packetReceipts"].items():
    assert hashlib.sha256((OUT / name).read_bytes()).hexdigest() == sha
  assert EVIDENCE["runtimeBytes"] < 170_000
  assert DATA["counts"]["newFaces"] == 70
  assert DATA["counts"]["newOwners"] == 61
  assert {f["streetName"] for f in SOURCE["faces"]} == {
    "Oderberger Straße",
    "Eberswalder Straße",
    "Sredzkistraße",
  }
  assert not {"replacementIds", "navigation", "descriptors"} & DATA.keys()
  protected = {b["id"]: b for b in SOURCE["sourceBuildings"]}
  for identity in ("3900017", "105780950"):
    assert "specific-use" in protected[identity]["protectedReasons"]
    assert not any(identity in f["mappedSourceIds"] for f in SOURCE["faces"])


def test_complete_existing_walls_and_native_spans_anchor_all_new_fronts() -> None:
  grouped = defaultdict(list)
  for f in SOURCE["faces"]:
    assert f["owner"] not in SOURCE["authoredIds"]
    grouped[f["chunk"]].append(f)
  for chunk, faces in grouped.items():
    for native in (False, True):
      packet = read(
        OUT / SOURCE["parents"][chunk]["minecraft" if native else "drawn"]["url"]
      )
      tris = triangles(packet, "city")
      for f in [s for face in faces for s in face["nativeSpans"]] if native else faces:
        assert f["sourceBuilding"] in packet["nav"]["buildings"]
        a, b = f.get("sourceWall", [f["a"], f["b"]])
        lo, hi = f["low"], f["high"]
        points = [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ]
        assert matches(points, packet["origin"], tris)
        assert not matches(
          [[p[0] + 0.2, p[1], p[2]] for p in points], packet["origin"], tris
        )
        if native:
          assert a[0] == b[0] or a[1] == b[1]
          assert LineString([a, b]).buffer(0.001).covers(LineString([f["a"], f["b"]]))


def test_sredzki_highlights_match_both_actual_retained_pane_triangles() -> None:
  packets, tris = {}, {}
  totals = {False: 0, True: 0}
  for f in SOURCE["existingGlazing"]:
    url = f["packet"]
    if url not in packets:
      packets[url] = read(OUT / url)
      tris[url] = triangles(packets[url])
    a, b = np.array(f["a"]), np.array(f["b"])
    d, n = (b - a) / math.dist(a, b), np.array(f["normal"])
    depth = 0.045 if f["native"] else 0.075
    for u, y, w, h in f["windows"]:
      left, right = a + d * (u - w / 2) + n * depth, a + d * (u + w / 2) + n * depth
      points = [
        [left[0], y - h / 2, left[1]],
        [right[0], y - h / 2, right[1]],
        [right[0], y + h / 2, right[1]],
        [left[0], y + h / 2, left[1]],
      ]
      assert matches(points, packets[url]["origin"], tris[url])
      totals[f["native"]] += 1
  assert totals == {False: 560, True: 413}


def test_small_members_stay_within_the_original_wall_and_brewery_apertures() -> None:
  for family in ("drawn", "native"):
    for f in DATA[family]:
      width = math.dist(f["a"], f["b"])
      wall = box(0, f["low"], width, f["high"])
      for u, y, w, h in f["windows"]:
        assert wall.covers(
          box(u - w / 2 - 0.12, y - h / 2 - 0.16, u + w / 2 + 0.12, y + h / 2 + 0.15)
        )
      if family == "native":
        assert f["a"][0] == f["b"][0] or f["a"][1] == f["b"][1]
  for f in SOURCE["breweryFaces"]:
    wall = shape(f["wallGeometry"])
    height = f["wallTop"] - f["wallBottom"]
    levels = min(7, max(1, int((height - 1) / 4.2)))
    dy = (height - 1.5) / levels
    bays = max(1, int(math.dist(f["a"], f["b"]) / 3.8))
    pitch = math.dist(f["a"], f["b"]) / bays
    for level in range(levels):
      y = f["wallBottom"] + 1.85 + level * dy
      if y + 1.15 >= f["wallTop"] - 0.8:
        continue
      w, h = min(1.65, pitch * 0.48), min(2, dy * 0.58)
      for bay in range(bays):
        u = (bay + 0.5) * pitch
        assert wall.covers(box(u - w / 2, y - h / 2, u + w / 2, y))
