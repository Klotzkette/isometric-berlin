"""Check the transferred surface areas directly from the live GPU wire data."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MESH = ROOT / "src/app/public/mesh/regierungsviertel"
SOURCE = ROOT / "src/app/src/data/mittePathDepthV375.json"


def unpack(encoded, dtype):
  return np.frombuffer(gzip.decompress(base64.b64decode(encoded)), dtype=dtype)


def triangle_areas(xz):
  delta = xz[:, 1:] - xz[:, :1]
  return np.abs(delta[:, 0, 0] * delta[:, 1, 1] - delta[:, 1, 0] * delta[:, 0, 1]) / 2


def test_precise_grass_complements_and_first_frame_paths_share_one_area():
  data = json.loads(SOURCE.read_bytes())
  for name, field in (
    ("ground-context", "groundSha256"),
    ("surface-polygons", "surfaceSha256"),
  ):
    assert (
      hashlib.sha256((MESH / (name + ".json")).read_bytes()).hexdigest() == data[field]
    )

  records = unpack(data["cells"], "<u4").reshape(-1, 6)
  spans = unpack(data["spans"], "<u4")
  vertices = unpack(data["triangles"], "<f4").reshape(-1, 2).astype(float)
  assert len(records) == len(spans) == len(unpack(data["tops"], "<f4"))
  assert len(records) == 316
  assert sum(spans) == data["count"] == 1009
  retained = 0.0
  for (col, row, first, count, _, _), span in zip(records, spans, strict=True):
    begin = 4 * np.array(
      [int(col) + data["grid"]["min_x_idx"], int(row) + data["grid"]["min_z_idx"]]
    )
    inside = vertices[first : first + count]
    assert np.all(inside >= begin - 0.0003)
    assert np.all(inside <= begin + [4 * span, 4] + 0.0003)
    retained += triangle_areas(inside.reshape(-1, 3, 2)).sum()
  opened = 16 * int(sum(spans)) - retained
  assert abs(opened - 4470.6191) < 0.005

  temporary_area = 0.0
  total_bytes = 0
  assert len(data["previews"]) == 12
  for preview in data["previews"].values():
    points = unpack(preview["xyz"], "<f4").reshape(-1, 3)
    triangles = unpack(preview["indices"], "<u2").reshape(-1, 3)
    assert np.isfinite(points).all()
    assert triangles.max() < len(points)
    temporary_area += triangle_areas(
      points[triangles][:, :, [0, 2]].astype(float)
    ).sum()
    total_bytes += points.nbytes + triangles.nbytes
  assert abs(temporary_area - opened) < 0.001
  assert total_bytes == 129138
