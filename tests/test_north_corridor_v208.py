"""Source transfer, aperture placement and full native pane visibility checks."""

import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "src/app/src/data/northCorridorV208.json").read_text())
EVIDENCE = json.loads(
  (ROOT / "src/app/src/data/northCorridorV208Evidence.json").read_text()
)


def test_original_source_owners_and_exact_hungarian_surface_vertices_survive():
  records = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-390_5819-00.json.gz"
      ).read_bytes()
    )
  )["buildings"]
  by_id = {r["id"]: r for r in records}
  for r in EVIDENCE["sourceRecords"]:
    assert r == by_id[r["id"]]
  for path, digest in EVIDENCE["retainedInputs"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  hungary = EVIDENCE["sourceRecords"][0]
  assert len(hungary["parts"]) == 6
  surfaces = {
    s["sourcePolygonId"]: s
    for p in hungary["parts"]
    for s in p["surfaces"]
    if s["kind"] != "GroundSurface"
  }
  triangles = {
    s["sourcePolygonId"]: s["triangles"] for s in DATA["surfaces"] if s["face"] == -1
  }
  assert set(triangles) == set(surfaces)
  for sid, surface in surfaces.items():
    delivered = {tuple(v) for t in triangles[sid] for v in t}
    source = {tuple(v) for r in surface["rings"] for v in r}
    assert delivered == source


def test_attachment_bounds_and_shared_source_datum():
  for r in DATA["boxes"]:
    x, y, z, w, h, depth, _, _, role, owner, fi = r
    if fi < 0:
      assert owner == 0 and role == 8
      continue
    f = EVIDENCE["faces"][fi]
    delta = np.array([x, z]) - f["a"]
    u = float(delta @ f["direction"])
    poly = unary_union([shape(p) for p in f["polygons"]])
    assert f["owner"] == owner
    assert 0 <= y < 60
    if owner in [0, 3, 4] and role not in [7, 9]:
      assert poly.buffer(0.025).covers(
        box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
      ), (owner, role, r)
  assert len(DATA["owners"]) == 5
  assert all(
    o["groundY"] == r["groundY"]
    for o, r in zip(DATA["owners"], EVIDENCE["sourceRecords"], strict=True)
  )


def test_native_entire_pane_extent_clears_original_raster_and_independent_shells():
  occupied = {(x, z): top for x, z, top in EVIDENCE["nativeOccupied"]}
  for r in DATA["blocks"] + DATA["nightBlocks"]:
    x, y, z, w, h, d, _, role, _, _ = r
    w += 0.025
    d += 0.025
    if role not in [1, 7]:
      continue
    for ix in range(math.floor(x - w / 2), math.ceil(x + w / 2)):
      for iz in range(math.floor(z - d / 2), math.ceil(z + d / 2)):
        assert y - h / 2 >= occupied.get((ix, iz), -100), (
          r,
          (ix, iz),
          occupied.get((ix, iz)),
        )
  packets = {
    i: json.loads(
      (ROOT / f"src/app/src/data/altMitteV169Navigation/packet-{i:03}.json").read_text()
    )
    for i in [6, 7]
  }
  for receipt in EVIDENCE["nativeSpans"]:
    assert packets[receipt["packet"]][receipt["index"]] == receipt["span"]


def test_bounded_identity_and_colour_programmes():
  from collections import Counter

  owners = Counter(r[9] for r in DATA["boxes"])
  assert set(owners) == {0, 1, 2, 3, 4}
  assert set(r[8] for r in DATA["blocks"]) == {0, 1, 2, 3, 4}
  # Friedrichstrasse is WEST of Dussmann. The inherited east façade faces a party wall.
  dussmann = [r for r in DATA["boxes"] if r[9] == 2]
  assert len(dussmann) > 100
  assert max(r[0] for r in dussmann) < 1172
  assert len([r for r in DATA["blocks"] if r[8] == 2]) > 100
  assert len(DATA["boxes"]) < 3000 and len(DATA["blocks"]) < 8000
  assert all(all(math.isfinite(v) for v in r) for r in DATA["boxes"] + DATA["blocks"])
  # Dense upper embassy band is separate from its broader lower apertures.
  lower = [r for r in DATA["boxes"] if r[9] == 0 and r[8] == 1 and r[1] < 26]
  upper = [r for r in DATA["boxes"] if r[9] == 0 and r[8] == 1 and r[1] > 27]
  assert len(upper) > 25 and len(lower) > 30
  assert all(r[3] < 1 for r in upper)
  # No backing can close an unrelated courtyard or alter ground/water.
  assert all(r[8] != 0 for r in DATA["boxes"])
