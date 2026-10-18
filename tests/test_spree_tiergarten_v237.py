"""Source preservation and actual emitted geometry, including native attachment."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def read(p):
  b = p.read_bytes()
  return json.loads(gzip.decompress(b) if p.suffix == ".gz" else b)


def test_retained_exact_source_and_mapped_entrances():
  source = read(GEO / "spree-tiergarten-v237-source.json.gz")
  evidence = read(GEO / "spree-tiergarten-v237-evidence.json")
  assert (
    hashlib.sha256(
      (GEO / "spree-tiergarten-v237-source.json.gz").read_bytes()
    ).hexdigest()
    == evidence["sourceSha256"]
  )
  for path, sha in source["inputs"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == sha
  original = {
    p["id"]: p
    for p in read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")[
      "buildings"
    ]
  }
  selected = {b["prism"]["id"]: b for b in source["buildings"]}
  for b in source["buildings"]:
    assert original[b["prism"]["id"]] == b["prism"]
    assert b["osm"]["osm"] != "25999445"  # Existing CDU hero remains authoritative.
    polygon = Polygon(np.array(b["prism"]["ring"]) / 10)
    for entrance in b["entrances"]:
      assert polygon.boundary.distance(Point(*entrance["point"])) <= 0.2500001
  screen_count = 0
  ribbons = 0
  for record in evidence["records"]:
    p = selected[record["owner"]]["prism"]
    polygon = Polygon(np.array(p["ring"]) / 10)
    assert record["sourceHigh"] == (p["y0_dm"] + p["h_dm"]) / 10
    for wall in record["walls"]:
      a, z = np.array(wall["a"]), np.array(wall["b"])
      n = np.array(wall["normal"])
      assert polygon.boundary.distance(Point(*a)) < 1e-7
      assert polygon.boundary.distance(Point(*z)) < 1e-7
      assert not polygon.covers(Point(*((a + z) / 2 + n * 0.1)))
      assert wall["drawnTriangles"] > 0
      if wall.get("screen"):
        assert record["osm"] == "24046078"
        screen_count += 1
      ribbons += bool(wall.get("continuousUpperGlass"))
  assert screen_count >= 8 and ribbons >= 2
  assert "display estimates" in source["policy"]


def test_both_families_actual_buffers_are_bounded_and_native_orthogonal():
  addition = read(GEO / "spree-v237-manifest-addition.json")
  evidence = read(GEO / "spree-tiergarten-v237-evidence.json")
  assert 1 <= len(addition["chunks"]) <= 8
  totals = {"drawn": 0, "minecraft": 0}
  for tile in addition["chunks"]:
    for mode in totals:
      descriptor = tile[mode]
      raw = (PUBLIC / descriptor["url"]).read_bytes()
      assert len(raw) == descriptor["bytes"]
      assert hashlib.sha256(raw).hexdigest() == descriptor["sha256"]
      data = gzip.decompress(raw)
      assert len(data) == descriptor["decodedBytes"] < 12 * 1024 * 1024
      packet = json.loads(data)
      assert packet["nav"] == dict(groundY=5.2, ground=[], water=[], buildings=[])
      assert packet["schemaVersion"] == 1
      assert packet["id"] == tile["id"]
      assert len(packet["meshes"]) == 1
      verts = 0
      inds = 0
      for mesh in packet["meshes"]:
        xyz = (
          np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
          .reshape(-1, 3)
          .astype(float)
          / 100
          + packet["origin"]
        )
        index = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
        assert np.isfinite(xyz).all() and index.max() < len(xyz)
        b = tile["bounds"]
        assert xyz[:, 0].min() >= b[0] - 0.01 and xyz[:, 0].max() <= b[2] + 0.01
        assert xyz[:, 2].min() >= b[1] - 0.01 and xyz[:, 2].max() <= b[3] + 0.01
        if mode == "minecraft":
          t = xyz[index]
          norm = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
          nonzero = (np.abs(norm) > 1e-7).sum(axis=1)
          assert (nonzero <= 1).all()
        verts += len(xyz)
        inds += index.size
      assert verts < 400000 and inds < 2400000
      gpu = 12 * verts + inds * (2 if verts <= 65535 else 4)
      receipt = evidence["packets"][f"{mode}:{tile['id']}"]
      assert receipt == dict(vertices=verts, indices=inds, geometryBytes=gpu)
      totals[mode] += gpu
  assert totals["drawn"] < 1024 * 1024 and totals["minecraft"] < 3 * 1024 * 1024
  assert all(totals[m] == evidence["counts"][m + "GeometryBytes"] for m in totals)
