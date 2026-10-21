"""Evidence-bound replacement of one authored paving estimate, with no source edit."""

import hashlib
import json
from pathlib import Path

from shapely import Polygon, union_all

from scripts.build_sinti_roma_paving_v256 import build_paving

ROOT = Path(__file__).resolve().parents[1]


def test_paving_is_reproducible_fitted_and_bounded() -> None:
  payload = json.loads((ROOT / "src/app/src/data/sintiRomaPavingV256.json").read_text())
  assert payload == build_paving()
  polygons = [Polygon(shard["ring"]) for shard in payload["shards"]]
  assert len(polygons) == 237
  assert sum(shard["named"] for shard in payload["shards"]) == 69
  assert all(polygon.is_valid and polygon.area > 0.15 for polygon in polygons)
  merged = union_all(polygons)
  assert abs(merged.area - sum(polygon.area for polygon in polygons)) < 1e-6
  assert not merged.intersects(Polygon([[-4, -4], [4, -4], [4, 4], [-4, 4]]))
  # A fitted stone field remains visibly distinct from the former sparse pebbles.
  assert merged.area > 125


def test_original_geometry_bytes_are_preserved() -> None:
  receipt = json.loads(
    (ROOT / "geo_data/regierungsviertel/sinti-roma-v256-preservation.json").read_text()
  )
  assert receipt["geometrySourcesChanged"] == []
  for path, digest in receipt["retainedFiles"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
