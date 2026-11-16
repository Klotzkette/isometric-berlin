"""Independent geometry and source-scope checks for the finite railway parks."""

import base64
import gzip
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def test_all_mapped_trees_and_both_landmarks_have_both_independent_modes():
  evidence = read(
    ROOT / "geo_data/regierungsviertel/railway-parks-v354-validation.json.gz"
  )
  for mode in ["drawn", "minecraft"]:
    records = [r for r in evidence["reports"] if r["mode"] == mode]
    assert len([r for r in records if r["kind"] == "tree"]) == 76
    assert len([r for r in records if r["kind"] == "water-tower"]) == 1
    assert len([r for r in records if r["kind"] == "turntable"]) == 1
    assert len([r for r in records if r["kind"] == "boardwalk"]) == 2


def test_finite_geometry_native_faces_and_no_old_retirement():
  index = read(DATA / "railwayParksV354Index.json")
  assert len(index["sources"]) == 22
  for row in index["sources"]:
    raw = gzip.decompress((DATA / row["file"]).read_bytes())
    assert len(raw) == row["decodedBytes"] < 2 * 1024 * 1024
    source = json.loads(raw)
    for key, plan in source["packets"].items():
      assert plan["retire"] == plan["retireNav"] == plan["retireLines"] == []
      mesh = plan["append"]
      xyz = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
        .reshape(-1, 3)
        .astype(float)
      )
      ids = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      assert ids.max() < len(xyz) < 400000
      triangles = xyz[ids]
      normals = np.cross(
        triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
      )
      assert np.all(np.linalg.norm(normals, axis=1) > 0)
      if key.startswith("minecraft:"):
        assert np.all(np.count_nonzero(normals, axis=1) == 1)
      assert len(plan["preparedRecords"]) + 1 <= 16
