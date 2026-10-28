"""Bounded upper-hall source audit: complete geometry and unchanged lower owner."""

import gzip
import hashlib
import json
from urllib.parse import parse_qs, urlparse

import numpy as np
import pytest
from scipy.interpolate import LinearNDInterpolator
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from scripts.build_brehm_tropical_hall_v282 import (
  OLD,
  RECEIPT,
  ROOT,
  RUNTIME,
  SAMPLES,
  build,
  digest,
  encode,
)


@pytest.fixture(scope="module")
def replay():
  return build()


def test_exact_offline_replay_and_all_previous_inputs_preserved(replay):
  data, receipt = replay
  assert RUNTIME.read_bytes() == encode(data)
  assert RECEIPT.read_bytes() == encode(receipt)
  assert receipt["retiredOwners"] == []
  for path, sha in receipt["preservedInputs"].items():
    assert digest(ROOT / path) == sha
  old = json.loads(OLD.read_bytes())
  body = next(p for p in old["sourceProfiles"] if p["id"] == data["parentId"])["parts"][
    0
  ]
  assert len(body["surfaces"]) == 125
  assert hashlib.sha256(encode(body)).hexdigest() == receipt["originalBodySha256"]
  assert Polygon(body["ring"], body["holes"]).contains(Polygon(data["ring"]))
  assert len(data["ring"]) == 16


def test_every_height_query_keeps_its_original_response_and_metric_coordinates(replay):
  data, receipt = replay
  samples = json.loads(gzip.decompress(SAMPLES.read_bytes()))["samples"]
  assert len(samples) == 199
  assert sum(s["service"] == "dgm1" for s in samples) == 19
  assert sum(s["service"] == "bdom" for s in samples) == 180
  assert len({(s["service"], s["x"], s["y"]) for s in samples}) == 199
  for sample in samples:
    query = parse_qs(urlparse(sample["url"]).query)
    assert query["CRS"] == ["EPSG:25833"]
    assert query["REQUEST"] == ["GetFeatureInfo"]
    bbox = [float(v) for v in query["BBOX"][0].split(",")]
    assert bbox == [
      sample["x"] - 0.5,
      sample["y"] - 0.5,
      sample["x"] + 0.5,
      sample["y"] + 0.5,
    ]
    props = sample["response"]["features"][0]["properties"]
    assert len(props) == 1
    assert float(next(iter(props.values()))) == sample["heightNHN"]
    assert sample["response"]["timeStamp"].startswith("2026-10-28")
  assert receipt["terrainMedianNHN"] == 38.31
  assert receipt["estimatedEaveNHN"] == 50.125
  assert receipt["peakNHN"] == 54.22
  assert data["maxY"] == 18.91
  assert data["maxY"] - 3 == pytest.approx(15.91)
  # Reusing the older basement shift would put the peak more than 3m too high.
  assert data["maxY"] < 54.22 - 30 - 2.059 - 3


def test_complete_concave_roof_coverage_and_boundary_contact(replay):
  data, receipt = replay
  polygon = Polygon(data["ring"])
  vertices = np.array(data["roofVertices"])
  faces = [vertices[ids] for ids in data["roofIndices"]]
  projected = [Polygon([(p[0], p[2]) for p in face]) for face in faces]
  union = unary_union(projected)
  assert union.symmetric_difference(polygon).area < 1e-6
  assert sum(p.area for p in projected) == pytest.approx(polygon.area, abs=1e-6)
  assert all(polygon.buffer(1e-7).covers(p) for p in projected)
  assert all(np.cross(face[1] - face[0], face[2] - face[0])[1] > 0 for face in faces)
  for x, z in data["ring"]:
    assert [x, data["eaveY"], z] in data["roofVertices"]
  assert len(vertices) == 134
  assert len(faces) == 250
  assert all(p[1] >= data["bottomY"] for p in vertices)
  # Every accepted official interior sample survives as its own exact vertex.
  for x, z, nhn in receipt["safePoints"]:
    assert [round(x, 3), round(nhn - 38.31 + 3, 3), round(z, 3)] in data["roofVertices"]


def test_native_is_a_complete_independent_cardinal_volume(replay):
  data, receipt = replay
  ring = Polygon(data["ring"])
  source_ring = [[x - 389500, 5820000 - y] for x, y in receipt["sourceRing25833"]]
  points = np.array(source_ring + [[x, z] for x, z, _ in receipt["safePoints"]])
  heights = np.array(
    [data["eaveY"]] * 16 + [nhn - 38.31 + 3 for _, _, nhn in receipt["safePoints"]]
  )
  source = LinearNDInterpolator(points, heights)
  occupied = {}
  for x, z, width, top in data["nativeRuns"]:
    assert all(float(v).is_integer() for v in [x, z, width, top * 2])
    assert width >= 1 and top > data["nativeBottomY"]
    for ix in range(x, x + width):
      assert (ix, z) not in occupied
      occupied[ix, z] = top
      assert ring.contains(Point(ix + 0.5, z + 0.5))
      actual = float(source([[ix + 0.5, z + 0.5]])[0])
      assert -0.002 < top - actual < 0.502
  xmin, zmin, xmax, zmax = data["nativeBounds"]
  expected = {
    (x, z)
    for x in range(xmin, xmax)
    for z in range(zmin, zmax)
    if ring.contains(Point(x + 0.5, z + 0.5))
  }
  assert set(occupied) == expected
  assert len(occupied) == receipt["nativeColumns"] == 1275
  assert max(occupied.values()) == data["nativeMaxY"] == 19
  old = json.loads(OLD.read_bytes())
  body = next(p for p in old["sourceProfiles"] if p["id"] == data["parentId"])["parts"][
    0
  ]
  envelope = Polygon(body["ring"])
  assert all(envelope.covers(box(x, z, x + 1, z + 1)) for x, z in occupied)
  assert len(encode(data)) < 25000
