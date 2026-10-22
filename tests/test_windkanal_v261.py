"""The estimated tube contour cannot escape its one measured source part."""

import gzip
import hashlib
import json
from pathlib import Path

from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def test_windkanal_skin_is_only_on_the_named_measured_part():
  raw = (
    ROOT / "geo_data/regierungsviertel/adlershof-kuehn-v261-source.json.gz"
  ).read_bytes()
  data = json.loads((ROOT / "src/app/src/data/windkanalV261.json").read_text())
  assert data["sourceSha256"] == hashlib.sha256(raw).hexdigest()
  source = json.loads(gzip.decompress(raw))
  owner = next(b for b in source["buildings"] if b["id"] == data["owner"])
  part = next(p for p in owner["parts"] if p["id"] == data["part"])
  footprint = unary_union([shape(p) for p in part["footprints"]])
  assert data["sourceFootprint"] == part["footprints"]
  assert data["roofFacets"] == 4
  for _, *points in data["triangles"]:
    projected = Polygon([(p[0], p[2]) for p in points])
    assert footprint.buffer(0.002).covers(projected)
    assert max(p[1] for p in points) <= part["maxY"] + 1.2
  for x, y, z, dx, dy, dz, _ in data["blocks"]:
    assert (dx, dy, dz) == (1, 1, 1)
    assert footprint.distance(Point(x, z)) < 0.72
    assert y + dy / 2 <= 16


def test_windkanal_payload_and_profile_stay_small_and_bound():
  path = ROOT / "src/app/src/data/windkanalV261.json"
  raw = path.read_bytes()
  profile = json.loads(
    (ROOT / "geo_data/regierungsviertel/windkanal-v261-profile.json").read_text()
  )
  assert profile["dataSha256"] == hashlib.sha256(raw).hexdigest()
  assert len(raw) < 200_000
  assert profile["drawnTriangles"] < 1800 and profile["nativeBlocks"] < 1200
  assert profile["skinRiseM"] == 0.95 and profile["nativeCellM"] == 1
