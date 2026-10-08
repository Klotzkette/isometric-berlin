"""Small display additions must not mutate or detach their source evidence."""

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "public_places_v185", ROOT / "scripts/build_public_places_v185.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_reproduction_and_retained_sources():
  drawn, native, evidence = module.build()
  for name, value in [
    ("publicPlacesV185.json", drawn),
    ("publicPlacesV185Native.json", native),
  ]:
    assert json.loads((ROOT / "src/app/src/data" / name).read_text()) == value
  for path, digest in evidence["sources"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  assert len(evidence["ackerFaces"]) == 3
  assert all(face["parentId"] == "DEBE01YYK00003UA" for face in evidence["ackerFaces"])
  assert all(
    drawn["counts"][key] > 0 for key in ["rosenthaler", "ackerhalle", "ottoWeidt"]
  )
  assert len(drawn["boxes"]) < 180
  assert len(native["boxes"]) < 1500


def test_stone_seats_follow_mapped_lines_and_dont_close_them():
  from shapely.geometry import Point, shape
  from shapely.ops import unary_union

  osm = json.loads(
    (ROOT / "geo_data/regierungsviertel/public-places-v185-osm.json").read_text()
  )
  lines = unary_union(
    [
      shape(f["geometry"])
      for f in osm["features"]
      if f["area"] == "otto" and f["tags"].get("amenity") == "bench"
    ]
  )
  drawn, _, _ = module.build()
  for row in drawn["boxes"][-drawn["counts"]["ottoWeidt"] :]:
    assert Point(row[0], row[2]).distance(lines) < 0.001
    assert row[4] == 0.5 and row[5] == 0.7
    # This source area has a 5.2 m ground datum. The bench underside must rest
    # on it rather than leaving an unsupported floating stone cap.
    assert abs(row[1] - row[4] / 2 - 5.2) < 0.001
  assert lines.length < 110
