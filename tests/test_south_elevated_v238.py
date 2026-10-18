"""Source ownership, open elevated levels, and the real serialized packet limits."""

import base64
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_south_elevated_v238 as south  # noqa: E402
from build_roof_house_v233 import fingerprint, match_owner  # noqa: E402


def load(path):
  data = Path(path).read_bytes()
  return json.loads(gzip.decompress(data) if str(path).endswith(".gz") else data)


def triangles(packet):
  origin = np.array(packet["origin"])
  for part in packet["meshes"]:
    positions = (
      np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3) / 100
      + origin
    )
    indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
    yield part, positions, indices


def test_retained_inputs_and_mapped_level_order():
  source = load(south.SOURCE)
  for path, digest in source["inputs"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  assert len(source["tracks"]) == 24
  for row in source["tracks"]:
    assert shape(row["sourceGeometry"]).buffer(1e-6).covers(shape(row["geometry"]))
    assert row["tags"]["gauge"] == "1435"
    assert row["tags"].get("tunnel", "no") == "no"
    assert row["tags"].get("service") is None
  # Two real parallel routes per family, no invented U1-to-U2 rail junction.
  for family in ["U1", "U2"]:
    g = shapely.line_merge(
      shapely.union_all(
        [shape(r["geometry"]) for r in source["tracks"] if r["family"] == family]
      )
    )
    assert len(list(south.lines(g))) == 2
  stations = load(south.EVIDENCE)["stations"]
  levels = {s["id"]: s["floorY"] for s in stations}
  assert levels["gleis-upper"] - levels["gleis-lower"] == 5
  assert levels["buelow"] == levels["kotti"] == 11.2
  assert "478218281" not in source["features"]  # U8 underground platform
  assert all(min(s["levels"]) >= 0 for s in source["stairs"])


def test_atomic_replacements_match_exact_previous_owners():
  data = load(south.REPLACEMENT)
  assert data["keys"] == list(data["packets"])
  previous = {p["id"]: p for p in load(south.PRISMS)["buildings"]}
  assert data["core"]["prismIds"] == south.CORE_IDS
  assert all(previous[p["id"]] == p for p in data["core"]["previousPrisms"])
  assert len(data["core"]["previousColumns"]) == 195
  for key, row in data["packets"].items():
    mode, tile = key.split(":")
    packet = load(south.OUT / f"{tile}.{mode}.json.gz")
    expected = {}
    for nav in row["navigationRecords"]:
      assert nav["owner"] in south.OUTER_IDS
      assert nav["original"] in packet["nav"]["buildings"]
      for mi, ids in match_owner(packet, nav["owner"]).items():
        expected.setdefault(mi, []).extend(ids)
    assert {r["mesh"]: r["triangles"] for r in row["records"]} == {
      k: sorted(v) for k, v in expected.items()
    }
    for r in row["records"]:
      old = packet["meshes"][r["mesh"]]
      assert (
        fingerprint([old[k] for k in ["positions", "colors", "indices"]])
        == r["fingerprint"]
      )
      # A different owner / changed encoded attribute cannot match receipt.
      assert (
        fingerprint([old["positions"] + "A", old["colors"], old["indices"]])
        != r["fingerprint"]
      )
    assert "OSM-way-382253029" not in {x["owner"] for x in row["navigationRecords"]}


def test_packet_hashes_native_axes_real_bounds_and_budget():
  data = load(south.REPLACEMENT)
  addition = load(south.ADDITION)
  evidence = load(south.EVIDENCE)
  assert len(addition["chunks"]) == 9
  packets = []
  for d in addition["chunks"]:
    assert d["id"].startswith("southrail238-")
    for mode in ["drawn", "minecraft"]:
      raw = (south.OUT / d[mode]["url"]).read_bytes()
      assert len(raw) == d[mode]["bytes"]
      assert hashlib.sha256(raw).hexdigest() == d[mode]["sha256"]
      assert len(gzip.decompress(raw)) == d[mode]["decodedBytes"] < 12 * 1024 * 1024
      packet = json.loads(gzip.decompress(raw))
      assert packet["nav"]["groundY"] == 5.2
      assert packet["nav"]["ground"] == packet["nav"]["water"] == []
      assert packet["nav"]["buildings"]
      assert all(b["height"] > b["minHeight"] >= 0 for b in packet["nav"]["buildings"])
      packets.append((mode, packet, d["bounds"]))
  for mode in ["drawn", "minecraft"]:
    packets.append((mode, data["core"][mode], [0, 1850, 512, 2362]))
    row = data["packets"][mode + ":6_4"]
    packets.append(
      (
        mode,
        dict(origin=row["origin"], meshes=[row["replacement"]]),
        [3072, 2048, 3584, 2560],
      )
    )
  totals = {"drawnGeometryBytes": 0, "minecraftGeometryBytes": 0}
  for mode, packet, bounds in packets:
    for part, p, indices in triangles(packet):
      assert len(p) < 400000 and indices.size < 2400000
      assert p[:, 0].min() >= bounds[0] - 0.01 and p[:, 0].max() <= bounds[2] + 0.01
      assert p[:, 2].min() >= bounds[1] - 0.01 and p[:, 2].max() <= bounds[3] + 0.01
      assert p[:, 1].min() >= 5.19 and p[:, 1].max() < 30
      totals[mode + "GeometryBytes"] += len(p) * 12 + indices.size * (
        2 if len(p) <= 65535 else 4
      )
      if mode == "minecraft":
        tri = p[indices]
        n = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        assert np.all((np.abs(n) > 1e-7).sum(axis=1) <= 1)
  assert totals == evidence["counts"]
  assert totals["drawnGeometryBytes"] < 1024 * 1024
  assert totals["minecraftGeometryBytes"] < 12 * 1024 * 1024


def test_station_roof_ridges_and_open_undercrofts():
  source = load(south.SOURCE)
  models, records = south.models(source)
  assert round(south.stair_level_height("gleis", 1), 6) == 15.2
  assert round(south.stair_level_height("gleis", 2), 6) == 20.2
  assert round(south.stair_level_height("buelow", 1), 6) == 12.12
  assert round(south.stair_level_height("kotti", 1), 6) == 12.12
  for station in south.STATIONS:
    detail = models[station["group"]]["drawn"]
    roofs = [
      np.array(t)
      for t, _, role in detail.triangles
      if role == station["id"] + " pitched roof"
    ]
    assert roofs
    heights = np.concatenate(roofs)[:, 1]
    assert heights.max() - heights.min() >= station["roofRise"] * 0.8
    # Ground-to-hall volume must not regress to a closed station prism.
    low = [
      np.array(t)
      for t, _, role in detail.triangles
      if role.startswith(station["id"]) and min(p[1] for p in t) < 7.5
    ]
    assert low
    assert all(np.ptp(t[:, 0]) < 1.1 and np.ptp(t[:, 2]) < 1.1 for t in low)
  data = load(south.REPLACEMENT)
  for rows in [
    data["core"]["navigationSolids"],
    data["packets"]["drawn:6_4"]["navigationSolids"],
  ]:
    assert rows
    for s in rows:
      assert s["minY"] < s["maxY"]
      # At pavement level only individual slender posts, no old hall slab.
      if s["minY"] < 7.5:
        from shapely.geometry import Polygon

        assert Polygon(s["ring"], s["holes"]).area < 1.3
