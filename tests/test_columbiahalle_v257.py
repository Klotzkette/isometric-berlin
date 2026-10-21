"""Exactly bounded facade correction: all measured/prior non-target faces survive."""

import base64
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_columbiahalle_v257 import corrected, details, triangle_key  # noqa: E402
from build_venues_hermann_v238 import architecture  # noqa: E402


def read(path):
  raw = (ROOT / path).read_bytes()
  return json.loads(gzip.decompress(raw) if path.endswith(".gz") else raw)


def test_exact_authored_receipts_preserve_all_measured_source_faces():
  source_path = "geo_data/regierungsviertel/venues-hermann-v238-source.json.gz"
  source = read(source_path)
  evidence = read("geo_data/regierungsviertel/columbiahalle-v257-evidence.json.gz")
  assert (
    hashlib.sha256((ROOT / source_path).read_bytes()).hexdigest()
    == evidence["sourceSha256"]
  )
  replacement_path = "src/app/src/data/venuesV238Replacement.json"
  assert (
    hashlib.sha256((ROOT / replacement_path).read_bytes()).hexdigest()
    == evidence["originalReplacementSha256"]
  )
  b = source["buildings"][1]
  models, _ = architecture(b)
  for family in ["drawn", "minecraft"]:
    removed = [r for r in models[family].triangles if corrected(r)]
    assert [triangle_key(r) for r in removed] == evidence["modes"][family][
      "retiredTriangleHashes"
    ]
    assert all(
      r[2] in {"venue-name-board", "geometric-venue-lettering", "mapped-entrance-door"}
      for r in removed
    )
    assert not any(
      r[2].startswith(b["parent"]) or r[2] == "independent-measured-native-skin"
      for r in removed
    )
    assert len(b["parts"]) == 4


def test_native_fittings_are_independently_orthogonal_and_front_scope_is_bounded():
  b = read("geo_data/regierungsviertel/venues-hermann-v238-source.json.gz")[
    "buildings"
  ][1]
  native = details(b, True)
  for tri, _, _ in native.triangles:
    p = np.array(tri)
    n = np.cross(p[1] - p[0], p[2] - p[0])
    assert np.count_nonzero(np.abs(n) > 1e-8) <= 1
  points = np.array([p for tri, _, _ in native.triangles for p in tri])
  assert points[:, 0].min() > 1333 and points[:, 0].max() < 1354
  assert points[:, 2].min() > 3853 and points[:, 2].max() < 3862
  assert points[:, 1].min() >= 3 and points[:, 1].max() < 9.6
  data = read("src/app/src/data/columbiahalleV257.json")
  for mode in ["drawn", "minecraft"]:
    m = data[mode]["replacement"]
    assert (
      sum(len(base64.b64decode(m[k])) for k in ["positions", "colors", "indices"])
      < 300_000
    )
