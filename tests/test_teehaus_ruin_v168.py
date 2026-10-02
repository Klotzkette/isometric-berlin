"""The requested ruin retains its survey evidence and has no replacement roof."""

import json
import sys
from pathlib import Path

from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))


def read(path):
  return json.loads((ROOT / path).read_text())


def test_teehaus_keeps_every_original_boundary_and_exact_six_owners():
  from build_teehaus_ruin_v168 import extract

  parts, original = extract()
  evidence = read("geo_data/regierungsviertel/teehaus-ruin-v168-evidence.json")
  assert len(parts) == 6 and len(original) == 90
  assert evidence["originalSurfaces"] == original
  assert len(evidence["actions"]) == len(original)
  assert evidence["parts"] == json.loads(json.dumps(parts))
  nav = read("src/app/src/data/teehausRuinV168Navigation.json")
  assert {p["id"] for p in nav["legacyPrisms"]} == {
    "PQp9knxA",
    "rjGGVdEa",
    "goT2iWfN",
    "aARtHFHh",
    "K0003VSX",
    "K0003VOb",
  }
  all_prisms = read("src/app/public/mesh/regierungsviertel/lod2-prisms.json")[
    "buildings"
  ]
  assert nav["legacyPrisms"] == [
    p for p in all_prisms if p["id"] in {r["id"] for r in nav["legacyPrisms"]}
  ]
  assert "completion unverified" in evidence["state"]


def test_teehaus_has_an_open_interior_both_drawn_and_native():
  source = read("src/app/src/data/teehausRuinV168Source.json")
  point = Point(-1581, 160)
  overhead = []
  for surface in source["surfaces"]:
    for triangle in surface["triangles"]:
      poly = Polygon([(v[0], v[2]) for v in triangle])
      if poly.area > 0.001 and poly.covers(point):
        overhead.append(max(v[1] for v in triangle))
  assert overhead and max(overhead) < 5.4
  for x, y, z, w, h, d, _ in source["nativeRows"]:
    if abs(x - point.x) < w / 2 and abs(z - point.y) < d / 2:
      assert y + h / 2 < 6
  assert sum(s["role"] == "surviving gable" for s in source["surfaces"]) >= 2
  assert sum(row[-1] == "standing chimney" for row in source["boxes"]) == 2
  nav = read("src/app/src/data/teehausRuinV168Navigation.json")
  assert not any(Polygon(w["ring"]).covers(point) for w in nav["walls"])
