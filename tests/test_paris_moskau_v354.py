"""Independent source, footing and build-recipe checks for the one house."""

import gzip
import hashlib
import json
import subprocess
from pathlib import Path

import numpy as np

from scripts.build_paris_moskau_v354 import BASELINE, SOURCE, build

ROOT = Path(__file__).resolve().parents[1]


def test_retained_source_and_original_authored_function():
  receipt = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/paris-moskau-v354-source.json.gz"
      ).read_bytes()
    )
  )
  assert receipt["sourcePrism"] == SOURCE
  assert (
    hashlib.sha256(receipt["previousFunction"].encode()).hexdigest()
    == receipt["previousFunctionSha256"]
  )
  old = subprocess.check_output(
    ["git", "show", f"{BASELINE}:src/app/src/CityRecognitionRefinements.ts"],
    cwd=ROOT,
    text=True,
  )
  assert receipt["previousFunction"] in old
  for name in ["lod2-prisms.json", "minecraft-voxels.json", "ground-context.json"]:
    path = f"src/app/public/mesh/regierungsviertel/{name}"
    original = subprocess.check_output(
      ["git", "rev-parse", f"{BASELINE}:{path}"], cwd=ROOT, text=True
    ).strip()
    current = subprocess.check_output(
      ["git", "hash-object", path], cwd=ROOT, text=True
    ).strip()
    assert current == original


def test_independent_models_have_no_degenerate_triangles_and_bounded_support():
  import base64

  for native in [False, True]:
    data = build(native)
    m = data["mesh"]
    p = (
      np.frombuffer(base64.b64decode(m["positions"]), "<u2")
      .reshape(-1, 3)
      .astype(float)
      / 100
      + data["origin"]
    )
    i = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    t = p[i]
    assert np.all(
      np.linalg.norm(np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]), axis=1) > 0
    )
    assert p[:, 1].min() == 3.9
    assert p[:, 1].max() < 16
    assert p[:, 0].min() > -475 and p[:, 0].max() < -457
    assert p[:, 2].min() > -427 and p[:, 2].max() < -414
    assert data["features"]["loggia balustrade"] > 0
    assert data["features"]["east awning"] > 0
    if native:
      assert np.all(np.any(np.ptp(t, axis=1) < 1e-8, axis=1))
