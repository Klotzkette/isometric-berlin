"""No lost official vertices or invented connections in the two hairline layers."""

import gzip
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_berlin_boundaries_v200 import DATA, RUNTIME, source_parts  # noqa: E402


def test_official_wfs_completeness_and_preliminary_wall_semantics():
  evidence = json.loads((DATA / "berlin-boundaries-v200-evidence.json").read_bytes())
  receipt = evidence["sourceReceipt"]
  packed = (DATA / receipt["path"]).read_bytes()
  assert hashlib.sha256(packed).hexdigest() == receipt["sha256"]
  assert len(packed) == receipt["bytes"] < 5 * 1024 * 1024
  source = json.loads(gzip.decompress(packed))
  for key, count in [("state", 1), ("wall", 118)]:
    assert source[key]["numberMatched"] == source[key]["numberReturned"] == count
    assert len(source[key]["features"]) == count
    assert len({f["id"] for f in source[key]["features"]}) == count
  assert evidence["wall"]["typeName"] == "berlinermauer:a_grenzmauer"
  assert {f["properties"]["objekt"] for f in source["wall"]["features"]} == {
    "Vorderlandmauer",
    "Unterwassergrenze",
  }
  assert evidence["wall"]["sourceClasses"] == {
    "Vorderlandmauer": 116,
    "Unterwassergrenze": 2,
  }
  assert "preliminary" in evidence["wallAccuracy"]
  assert "not cadastral" in evidence["wallAccuracy"]
  assert evidence["license"] == "dl-de/zero-2-0"


def test_full_source_vertices_parts_and_lengths_survive_without_gap_joins():
  evidence = json.loads((DATA / "berlin-boundaries-v200-evidence.json").read_bytes())
  source = json.loads(
    gzip.decompress((DATA / evidence["sourceReceipt"]["path"]).read_bytes())
  )
  raw = (RUNTIME / "berlinBoundariesV200.json").read_bytes()
  assert hashlib.sha256(raw).hexdigest() == evidence["runtimeSha256"]
  runtime = json.loads(raw)
  for key in ("state", "wall"):
    vertices = runtime[key + "Xz"]
    positions = list(zip(vertices[::2], vertices[1::2], strict=True))
    indices = runtime[key + "Segments"]
    expected_segments, length, source_count = [], 0.0, 0
    parts = iter(evidence[key]["parts"])
    for feature in source[key]["features"]:
      for ring in source_parts(feature["geometry"]):
        part = next(parts)
        assert part["sourceId"] == feature["id"]
        assert len(part["original"]) == len(ring)
        for index, (easting, northing, *_) in zip(part["original"], ring, strict=True):
          assert positions[index] == (easting - 389500, 5820000 - northing)
        for j in range(part["first"], part["first"] + part["count"] - 1):
          expected_segments.extend([j, j + 1])
          segment_length = math.dist(positions[j], positions[j + 1])
          assert segment_length <= 24.000001
          length += segment_length
        for a, b in zip(part["original"], part["original"][1:]):
          original_length = math.dist(positions[a], positions[b])
          subdivided_length = sum(
            math.dist(positions[j], positions[j + 1]) for j in range(a, b)
          )
          assert abs(subdivided_length - original_length) < 1e-6
        source_count += len(ring)
    assert next(parts, None) is None
    assert indices == expected_segments
    assert source_count == evidence[key]["sourceVertexCount"]
    assert len(positions) == evidence[key]["runtimeVertexCount"]
    assert abs(length - evidence[key]["lengthM"]) < 0.00001
  assert evidence["state"]["sourceVertexCount"] == 9581
  assert evidence["wall"]["sourceVertexCount"] == 1686


def test_scope_is_extent_only_never_new_filled_coverage():
  scope = json.loads((RUNTIME / "berlinBoundariesV200Scope.json").read_bytes())
  assert set(scope) == {"bounds"}
  west, north, east, south = scope["bounds"]
  assert west < -20000 and east > 26000 and north < -17000 and south > 20000
