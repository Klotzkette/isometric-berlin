"""Step 10 source preservation and finite park placement for the west Zoo."""

import hashlib
import json
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def test_v255_retains_every_existing_zoo_source_byte() -> None:
  receipt = json.loads(
    (ROOT / "geo_data/regierungsviertel/zoo-recognition-v255-evidence.json").read_text()
  )
  for path, expected in receipt["preservedInputs"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected
  assert receipt["replacementOwners"] == []
  assert receipt["newDrawCalls"] == receipt["newStreamingDescriptors"] == 0


def test_v255_uses_exact_mapped_rings_and_path_clear_placements() -> None:
  data = json.loads(
    (ROOT / "src/app/src/data/zooRecognitionV255Source.json").read_text()
  )
  old = json.loads((ROOT / "src/app/src/data/zooGroundsV165Evidence.json").read_text())
  features = {f["id"]: f for f in old["features"]}
  for key in ["tower", "playground"]:
    assert data[key]["ring"] == features[data[key]["osm"]]["coordinates"]
  assert data["tower"]["height"] == 25
  assert data["tower"]["levels"] == 18
  paths = unary_union(
    [LineString(p["line"]).buffer(p["width"] / 2) for p in old["paths"]]
  )
  play = Polygon(data["playground"]["ring"])
  for t in data["playground"]["towers"]:
    x, z = t["position"]
    footprint = box(x - 3.3, z - 2.2, x + 3.1, z + 8.6)
    assert play.covers(footprint)
    assert not paths.intersects(footprint)
  habitat = Polygon(features[data["reedHabitat"]]["coordinates"])
  water = unary_union([Polygon(w["ring"]) for w in old["waters"]])
  assert 10 <= len(data["reeds"]) <= 20
  for x, z in data["reeds"]:
    p = Point(x, z).buffer(0.49)
    assert habitat.covers(p)
    assert not water.intersects(p)
    assert paths.distance(p) > 0.9
