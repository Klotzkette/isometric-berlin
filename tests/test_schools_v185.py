"""Source binding and bounded budget checks for the small school accents."""

import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parents[1]


def test_school_members_stay_on_retained_faces() -> None:
  """Every added rectangle projects entirely onto an identified rendered wall."""
  model = json.loads((ROOT / "src/app/src/data/schoolsV185.json").read_text())
  evidence = json.loads(
    (ROOT / "geo_data/regierungsviertel/schools-v185-evidence.json").read_text()
  )
  assert len(evidence["schools"]) == 6
  offsets = json.loads(
    (ROOT / "src/app/src/data/weinbergBuildingOffsetsV176.json").read_text()
  )["offsets"]
  for school in evidence["schools"]:
    assert school["displayTerrainOffsetY"] == offsets.get(school["owner"], 0.0)
  for school in evidence["schools"]:
    path = ROOT / school["sourceFile"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == school["sourceSha256"]
    assert school["boxCount"] > 0
    for face in school["faces"]:
      pts = np.array(face["rings"][0])
      a, b = max(
        ((a, b) for a in pts for b in pts),
        key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
      )
      d = np.array([b[0] - a[0], 0, b[2] - a[2]])
      d /= np.linalg.norm(d)
      wall = Polygon(
        [(float(np.dot(p - a, d)), p[1]) for p in pts],
        [
          [(float(np.dot(np.array(p) - a, d)), p[1]) for p in ring]
          for ring in face["rings"][1:]
        ],
      ).buffer(0.002)
      for row in model["boxes"][face["firstBox"] : face["firstBox"] + face["boxCount"]]:
        u = float(np.dot(np.array(row[:3]) - a, d))
        assert wall.covers(
          box(u - row[3] / 2, row[1] - row[4] / 2, u + row[3] / 2, row[1] + row[4] / 2)
        )
        assert row[5] <= 0.25
  assert len(model["boxes"]) < 300
  assert len(model["nativeRows"]) < 1200
