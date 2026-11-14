"""Independent checks of exact source-plane clipping and all outside fragments."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def test_complete_original_outside_and_no_new_path_area():
  data = json.loads((ROOT / "src/app/src/data/tiergartenPathsV345.json").read_bytes())
  source = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/tiergarten-paths-v345-source.json.gz"
      ).read_bytes()
    )
  )
  evidence = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/tiergarten-paths-v345-evidence.json.gz"
      ).read_bytes()
    )
  )
  records = np.frombuffer(base64.b64decode(data["cells_u32"]), dtype="<u4").reshape(
    -1, 6
  )
  spans = np.frombuffer(base64.b64decode(data["spans_u32"]), dtype="<u4")
  vertices = np.frombuffer(
    base64.b64decode(data["triangles_f32"]), dtype="<f4"
  ).reshape(-1, 2)
  xyz = np.asarray(source["triangles"], dtype=float)
  faces = shapely.polygons(xyz[:, :, [0, 2]])
  total = 0
  for item in evidence:
    removed = shapely.from_geojson(item["removed"])
    witness_area = unary_union(faces[item["witnesses"]])
    assert removed.difference(witness_area).area < 1e-6
    x0, z0, x1, z1, top, _ = item["host"]
    for index in range(item["firstRecord"], item["firstRecord"] + item["records"]):
      col, row, ts, count, _, _ = records[index]
      x, z = (
        (int(col) + data["grid"]["min_x_idx"]) * 4,
        (int(row) + data["grid"]["min_z_idx"]) * 4,
      )
      host = box(x, z, x + int(spans[index]) * 4, z + 4)
      retained = unary_union(
        shapely.polygons(vertices[ts : ts + count].reshape(-1, 3, 2))
      )
      expected = host.difference(removed)
      # Float32 world-coordinate rounding, bounded to sub-mm along edges.
      assert retained.symmetric_difference(expected).area < 0.025
    assert removed.difference(box(x0, z0, x1, z1)).area < 1e-6
    total += removed.area
  assert abs(total - data["counts"]["areaM2"]) < 1e-5
  assert total > 13000


def test_every_captured_production_input_remains_exact():
  source = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/tiergarten-paths-v345-source.json.gz"
      ).read_bytes()
    )
  )
  assert len(source["inputs"]) == 4
  for path, expected in source["inputs"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected, path
