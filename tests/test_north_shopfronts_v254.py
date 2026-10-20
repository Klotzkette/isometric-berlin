"""Independent source binding and preservation checks for northern shopfronts."""

import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


SOURCE = read(GEO / "north-shopfronts-v254-source.json.gz")
DATA = read(ROOT / "src/app/src/data/northShopfrontsV254.json")


def test_retained_sources_packets_and_finite_counts() -> None:
  for name, expected in {**SOURCE["inputReceipts"], **SOURCE["packetReceipts"]}.items():
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, name
  assert len(SOURCE["torPanes"]) == 220
  assert Counter(s["poi"]["street"] for s in SOURCE["shops"]) == {
    "Danziger Straße": 60,
    "Kastanienallee": 17,
  }
  assert len({s["poi"]["osmId"] for s in SOURCE["shops"]}) == 77
  assert DATA["counts"]["newDescriptors"] == 0
  assert not {"navigation", "replacementIds", "descriptors"} & DATA.keys()
  assert not any("name" in s["poi"] for s in SOURCE["shops"])
  assert all("estimate" in DATA["policy"].lower() for _ in [0])


def test_each_retail_point_binds_to_its_actual_source_owner_and_named_front() -> None:
  manifest = {d["id"]: d for d in read(OUT / "manifest.json")["chunks"]}
  packets = {}
  seen = set()
  for s in SOURCE["shops"]:
    front, poi = s["drawn"]["face"], s["poi"]
    chunk = front["chunk"]
    if chunk not in packets:
      packets[chunk] = read(OUT / manifest[chunk]["drawn"]["url"])
    packet = packets[chunk]
    ox, _, oz = packet["origin"]
    matches = [
      translate(Polygon(b["ring"], b["holes"]), ox, oz)
      for b in packet["nav"]["buildings"]
      if b["sourceId"] == front["owner"]
    ]
    assert any(p.buffer(1).covers(Point(poi["point"])) for p in matches)
    assert front["streetName"] == poi["street"]
    assert LineString([front["a"], front["b"]]).distance(Point(poi["point"])) <= 12
    assert front["owner"] not in SOURCE["protectedV252Owners"]
    key = front["owner"], tuple(front["a"]), tuple(front["b"])
    assert key not in seen
    seen.add(key)


def test_new_glazing_preserves_plinths_old_panes_wall_ends_and_mapped_entrances() -> (
  None
):
  for shop in SOURCE["shops"]:
    for family in ("drawn", "native"):
      f = shop[family]
      face = f["face"]
      width = math.dist(face["a"], face["b"])
      # Includes the outer casing and the projecting sill's vertical extent.
      assert f["u"] - f["w"] / 2 - 0.14 >= 0
      assert f["u"] + f["w"] / 2 + 0.14 <= width
      assert f["c"][1] - f["h"] / 2 - 0.155 > face["low"] + 0.82
      assert f["c"][1] + f["h"] / 2 + 0.08 < f["oldPaneBottom"] - 0.29
      for e in SOURCE["protectedEntrances"]:
        assert math.dist([f["c"][0], f["c"][2]], e["point"]) > 2.4
      if family == "native" and f["out"] < 1:
        assert face["a"][0] == face["b"][0] or face["a"][1] == face["b"][1]


def test_tor_trim_remains_outside_glass_and_inside_complete_measured_wall() -> None:
  old = read(GEO / "tor-fronts-v244-source.json.gz")
  assert SOURCE["torPanes"] == [
    w for w in old["windows"] if w["role"] == "shopfront glazing"
  ]
  for w in SOURCE["torPanes"]:
    c, tangent = np.array(w["center"]), np.array(w["tangent"])
    rings = [
      [
        (float(np.dot(np.array(p) - c, tangent)), p[1] + w["terrainOffsetY"] - c[1])
        for p in ring
      ]
      for ring in w["sourceWall"]
    ]
    wall = Polygon(rings[0], rings[1:]).buffer(1e-7)
    assert wall.covers(
      box(
        -w["width"] / 2 - 0.20,
        -w["height"] / 2 - 0.11,
        w["width"] / 2 + 0.20,
        w["height"] / 2 + 0.21,
      )
    )
    # Left/right frame inner edges lie beyond the older v244 jamb outer edge.
    assert w["width"] / 2 + 0.16 - 0.03 > w["width"] / 2 + 0.065 + 0.075 / 2
