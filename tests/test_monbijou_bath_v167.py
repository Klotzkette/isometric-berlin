"""Exact pool outlines, retained context and independent native representation."""

import json
from pathlib import Path

from shapely.geometry import Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / "src/app/src/data/monbijouBathV167Source.json").read_text())
NAV = json.loads(
  (ROOT / "src/app/src/data/monbijouBathV167Navigation.json").read_text()
)


def test_pool_sources_and_walkable_surrounds() -> None:
  pools = {
    f["id"]: shape(f["geometry"]) for f in SOURCE["features"] if f["id"] != "30876915"
  }
  assert set(pools) == {"30876932", "51167567"}
  assert abs(pools["30876932"].area - 293.934228949) < 1e-5
  assert abs(pools["51167567"].area - 100.499964) < 1e-5
  for p in NAV["pools"]:
    assert Polygon(p["ring"]).equals_exact(pools[p["id"]], 0)
  # Concave large basin is not replaced by a bounding rectangle.
  assert len(pools["30876932"].exterior.coords) == 7
  water = [s for s in SOURCE["surfaces"] if s["role"] == "water"]
  drawn_area = sum(
    Polygon([(x, z) for x, _, z in t]).area for s in water for t in s["triangles"]
  )
  assert abs(drawn_area - sum(p.area for p in pools.values())) < 1e-6


def test_context_and_native_budget() -> None:
  old = json.loads((ROOT / "src/app/src/data/mitteHeritageV166Source.json").read_text())
  assert (
    sum(p["parentId"] in SOURCE["preservedBuildingParents"] for p in old["parts"]) == 6
  )
  assert 0 < len(SOURCE["nativeRows"]) < 1200
  assert all(r[3] > 0 and r[4] > 0 and r[5] == 0.25 for r in SOURCE["nativeRows"])
