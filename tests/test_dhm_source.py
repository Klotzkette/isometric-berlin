"""Complete bounded source retention for DHM and Pei source refinement."""

import json
import subprocess
from pathlib import Path

import pytest
from shapely.geometry import Point

from isometric_berlin.data.fetch_lod2 import load_bounds_polygon, project_to_berlin

ROOT = Path(__file__).resolve().parents[1]


def test_dhm_source_is_complete_bounded_and_retains_original_prisms() -> None:
  """Every original part, ring and source sheet survives recognition detail."""
  source = json.loads((ROOT / "src/app/src/dhmSource.json").read_text())
  old = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  assert [len(p["parts"]) for p in source["profiles"].values()] == [1, 1, 9]
  for profile in source["profiles"].values():
    for previous in profile["previous_display_prisms"]:
      assert previous == old[previous["id"]]
    for part in profile["parts"]:
      assert {s["kind"] for s in part["surfaces"]} == {
        "RoofSurface",
        "WallSurface",
      }
      for surface in part["surfaces"]:
        for ring in surface["rings"]:
          assert all(bounds.covers(Point(389500 + x, 5820000 - z)) for x, _, z in ring)
  assert len(source["profiles"]["zeughaus"]["parts"][0]["holes"]) == 1
  assert source["profiles"]["pei"]["osm_identity"].endswith("way/330840124")


def test_dhm_source_reextracts_without_changes() -> None:
  """Committed data is exactly reproducible from the retained official ZIP."""
  if not (ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_391_5819.zip").exists():
    pytest.skip("Optional ignored official archive is not present in this checkout")
  target = ROOT / "src/app/src/dhmSource.json"
  before = target.read_bytes()
  subprocess.run(
    ["uv", "run", "python", "scripts/build_dhm_source.py"], cwd=ROOT, check=True
  )
  assert target.read_bytes() == before
