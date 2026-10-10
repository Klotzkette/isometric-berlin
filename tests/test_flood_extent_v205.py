"""Full geographic coverage and fixed allocation receipts for the flood extension."""

import gzip
import hashlib
import importlib.util
import json
import struct
from pathlib import Path

import numpy as np
import shapely

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
  "flood_extent", ROOT / "scripts/build_flood_extent_v205.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_complete_source_area_and_bounded_exact_mesh() -> None:
  receipt = json.loads((ROOT / "src/app/src/data/floodExtensionV205.json").read_text())
  packed = (
    ROOT / "src/app/public/mesh/regierungsviertel" / receipt["file"]
  ).read_bytes()
  raw = gzip.decompress(packed)
  assert len(raw) == receipt["rawBytes"] < 3_000_000
  assert len(packed) == receipt["compressedBytes"] < 1_000_000
  assert hashlib.sha256(raw).hexdigest() == receipt["sha256"]
  assert raw[:8] == b"ISOFLO05"
  cells, vertices, indices = struct.unpack_from("<III", raw, 8)
  offsets = np.frombuffer(raw, dtype="<f4", count=cells * 2, offset=20).reshape(-1, 2)
  positions = np.frombuffer(
    raw, dtype="<f4", count=vertices * 3, offset=20 + cells * 8
  ).reshape(-1, 3)
  index = np.frombuffer(
    raw, dtype="<u4", offset=20 + cells * 8 + vertices * 12
  ).reshape(-1, 3)
  assert index.size == indices and index.max() < vertices
  assert np.isfinite(positions).all() and np.isfinite(offsets).all()
  triangles = positions[index][:, :, [0, 2]].astype(float)
  a, b = triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
  area = cells * 64**2 + np.abs(a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0]).sum() / 2
  complete, original, extension = MODULE.extent()
  assert abs(complete.area - receipt["areaM2"]) < 0.01
  assert complete.area > 920_000_000 and original.area > 81_000_000
  assert abs(area - extension.area) < 150  # Float32 world-coordinate rounding.
  for edge in (a, b, b - a):
    assert np.linalg.norm(edge, axis=1).max() < 96.01
  shapely.prepare(extension)
  assert shapely.covers(extension.buffer(0.004), shapely.points(offsets + 32)).all()
  assert shapely.covers(
    extension.buffer(0.004), shapely.points(triangles.mean(axis=1))
  ).all()
  assert sum(c["count"] for c in receipt["chunks"]) == cells
  for chunk in receipt["chunks"]:
    points = offsets[chunk["start"] : chunk["start"] + chunk["count"]]
    assert (np.floor(points / 2048) == chunk["key"]).all()
    assert chunk["count"] <= 1024


def test_kudamm_trees_are_catalogued_and_not_existing_duplicates() -> None:
  data = json.loads((ROOT / "src/app/src/data/kudammTreesV205.json").read_text())
  source = json.loads(
    (ROOT / "geo_data/regierungsviertel/kudamm-trees-v205-source.geojson").read_text()
  )
  old = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/park-details.json").read_text()
  )["trees"]
  existing = np.array([[t["position"][0], t["position"][2]] for t in old])
  assert len(data["trees"]) == len(source["features"]) == 396
  assert len(set(data["sourceIds"])) == 396
  for tree, feature in zip(data["trees"], source["features"], strict=True):
    e, n = feature["geometry"]["coordinates"]
    assert abs(tree[0] - (e - 389500)) < 0.0001
    assert abs(tree[1] - (5820000 - n)) < 0.0001
    assert feature["properties"]["strname"] == "Kurfürstendamm"
    assert np.min(np.sum((existing - tree[:2]) ** 2, axis=1)) >= 9
