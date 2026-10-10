"""The additional profiles preserve every existing source and rigid datum."""

import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
  "schools_places_v205", ROOT / "scripts/build_schools_places_v205.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_reproducible_source_members_and_preserved_original_arrays():
  """No old static member is removed and the independent addition reproduces."""
  model = json.loads((ROOT / "src/app/src/data/schoolsPlacesV205.json").read_text())
  assert model == module.build()
  for path, digest in model["sourceSha256"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  assert len(model["schools"]) == 6 and len(model["places"]) == 3
  for group in model["schools"] + model["places"]:
    assert group["boxes"] or group["rods"]
    assert len(group["nativeRows"]) < 1800
    for face in group["faces"]:
      pts = np.array(face["rings"][0])
      a, b = max(
        ((a, b) for a in pts for b in pts),
        key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
      )
      d = np.array([b[0] - a[0], 0, b[2] - a[2]])
      d /= np.linalg.norm(d)
      rings = [
        [(float(np.dot(np.array(p) - a, d)), p[1]) for p in r] for r in face["rings"]
      ]
      wall = Polygon(rings[0], rings[1:]).buffer(0.002)
      for index in face["boxes"]:
        row = group["boxes"][index]
        u = float(np.dot(np.array(row[:3]) - a, d))
        assert wall.covers(
          box(u - row[3] / 2, row[1] - row[4] / 2, u + row[3] / 2, row[1] + row[4] / 2)
        )
        assert row[5] <= 0.13
      for index in face["rods"]:
        row = group["rods"][index]
        p = [
          (float(np.dot(np.array(row[k : k + 3]) - a, d)), row[k + 1]) for k in [0, 3]
        ]
        assert wall.covers(LineString(p).buffer(row[6] / 2, cap_style=2))
  # Existing V185 files are untouched by this build; these are their pre-v205
  # published counts, not combined counts that could conceal removed members.
  old = json.loads((ROOT / "src/app/src/data/schoolsV185.json").read_text())
  assert len(old["boxes"]) == 120 and len(old["nativeRows"]) == 578
  old = json.loads((ROOT / "src/app/src/data/publicPlacesV185.json").read_text())
  assert len(old["boxes"]) == 113 and len(old["rods"]) == 53


def test_parent_terrain_and_academy_identity_are_source_bound():
  """A named academy cannot silently move or lose its existing parent offset."""
  model = module.build()
  offsets = module.OFFSETS
  for group in model["schools"] + model["places"]:
    if "terrainOffsetY" in group:
      assert group["terrainOffsetY"] == offsets.get(group["owner"], 0)
  academy = next(g for g in model["places"] if g["owner"] == "DEBE01YYK0000BOt")
  assert academy["address"] == "Torstraße 134" and academy["osmNode"] == 1389419281
  assert academy["labels"][0]["text"] == "ALTE SEIFENFABRIK"
  assert (
    next(g for g in model["schools"] if g["name"] == "John-Lennon-Gymnasium")[
      "terrainOffsetY"
    ]
    == 6.91
  )
