"""Complete retained owners, exact apertures and cemetery clearances for v266."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app/src/data"
DATA = json.loads((APP / "dorotheenstadtV266.json").read_bytes())
OLD = json.loads((APP / "dorotheenstadtV266Previous.json").read_bytes())
EVIDENCE = json.loads(
  gzip.decompress(
    (
      ROOT / "geo_data/regierungsviertel/dorotheenstadt-v266-evidence.json.gz"
    ).read_bytes()
  )
)


def test_complete_original_source_owners_and_packet_bytes_remain():
  for path, expected in EVIDENCE["inputs"].items():
    file = ROOT / path
    if file.exists():
      assert hashlib.sha256(file.read_bytes()).hexdigest() == expected
    else:
      assert "/raw/" in path
  original = {}
  for tile in ["390_5820", "390_5821"]:
    file = ROOT / f"geo_data/regierungsviertel/alt-mitte-v169/source-{tile}-00.json.gz"
    original.update(
      {b["id"]: b for b in json.loads(gzip.decompress(file.read_bytes()))["buildings"]}
    )
  assert len(EVIDENCE["buildings"]) == 5
  for b in EVIDENCE["buildings"]:
    assert b == original[b["id"]]
  assert sum(len(b["parts"]) for b in EVIDENCE["buildings"]) == 16
  assert (
    sum(len(p["surfaces"]) for b in EVIDENCE["buildings"] for p in b["parts"]) == 221
  )


def test_only_four_exact_generic_aperture_fronts_retire():
  assert sum(len(r["triangles"]) for r in OLD["records"]) == 800
  source_ids = {
    r["sourcePolygonId"]
    for r in EVIDENCE["frontFittings"]
    if r["role"] == "source-plane plaster"
  }
  assert len(source_ids) == 4
  for record in OLD["records"]:
    assert record["mode"] == "drawn"
    assert record["kind"] == "alt-mitte-v169"
    assert record["tile"].startswith(("1_-3", "1_-2", "2_-2"))
    assert len(set(record["triangles"])) == len(record["triangles"])
  assert DATA["profile"]["counts"]["drawn"]["roles"]["round arched door"] > 0
  assert DATA["profile"]["counts"]["drawn"]["roles"]["terracotta atelier spandrel"] > 0
  assert (
    DATA["profile"]["counts"]["minecraft"]["roles"]["arched door stepped upper"] > 0
  )


def test_anonymous_grave_envelopes_preserve_all_paths_points_and_buildings():
  c = EVIDENCE["cemetery"]
  area = Polygon(c["ring"]).buffer(-2)
  assert c["osmWay"]["id"] == 24733507
  assert len(c["groups"]) == 90
  obstacles = unary_union(
    [
      *[shape(p["geometry"]).buffer(p["width"] / 2 + 1.15) for p in c["paths"]],
      *[shape(p).buffer(1.2) for p in c["buildingFootprints"]],
      *[Point(p["point"]).buffer(p["radius"]) for p in c["retainedPointClearances"]],
    ]
  )
  for x, z, variant in c["groups"]:
    envelope = box(x - 1.25, z - 1.55, x + 1.25, z + 1.55)
    assert area.covers(envelope)
    assert not obstacles.intersects(envelope)
    assert variant in range(4)
  assert all(set(p) == {"id", "point", "radius"} for p in c["retainedPointClearances"])


def test_native_all_face_normals_are_orthogonal_and_packets_are_bounded():
  assert (APP / "dorotheenstadtV266.json").stat().st_size < 300_000
  for family in ["drawn", "minecraft"]:
    p = DATA[family]
    assert len(p["meshes"]) == 1
    for mesh in p["meshes"]:
      vertices = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
        .reshape(-1, 3)
        .astype(float)
      )
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      assert indices.max() < len(vertices)
      assert np.isfinite(vertices).all()
      assert len(base64.b64decode(mesh["colors"])) == len(vertices) * 3
      if family == "minecraft":
        t = vertices[indices]
        normal = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
        assert np.all(np.sum(abs(normal) > 0.001, axis=1) <= 1)
