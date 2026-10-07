"""The browser route must sample new inhabited scope, not a convenient old tile."""

import gzip
import json
import sys
from pathlib import Path

from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from smoke_ring_city_v182 import ring_view  # noqa: E402


def test_selected_browser_ring_view_is_new_ground_beside_mapped_buildings() -> None:
  name, _, target, identity = ring_view()
  assert name == "ring-urban"
  manifest = json.loads(
    (ROOT / "geo_data/regierungsviertel/ring-city-v182-manifest.json").read_bytes()
  )
  entry = next(chunk for chunk in manifest["chunks"] if chunk["id"] == identity)
  packet = json.loads(
    gzip.decompress(
      (
        ROOT / "src/app/public/mesh/surrounding-berlin-v159" / entry["drawn"]["url"]
      ).read_bytes()
    )
  )
  point = Point(target[0] - packet["origin"][0], target[2] - packet["origin"][2])
  assert any(
    Polygon(p["ring"], p["holes"]).covers(point) for p in packet["nav"]["ground"]
  )
  assert (
    min(
      Polygon(p["ring"], p["holes"]).distance(point) for p in packet["nav"]["buildings"]
    )
    < 100
  )
  old = json.loads((ROOT / "src/app/src/data/surroundingCityScope.json").read_bytes())
  world = Point(target[0], target[2])
  assert not any(
    Polygon(p["ring"], p["holes"]).covers(world)
    for p in [old["core"], *old["footprint"]]
  )
