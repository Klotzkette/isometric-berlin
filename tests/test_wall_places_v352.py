"""Current memorial construction stays distinct from the historical border map."""

import hashlib
import json
import subprocess

from scripts.build_wall_markers_v352 import DATA, GEO, ROOT, audit, build, read


def test_marker_rebuild_retains_prior_graves_and_only_admits_supported_site():
  data, evidence = build()
  assert data == read(DATA / "wallMarkersV352.json")
  assert evidence == read(GEO / "wall-markers-v352-evidence.json")
  assert [site["id"] for site in data["sites"]] == ["node/3624148007"]
  assert evidence["maxSimultaneousModels"] == 1
  old = subprocess.check_output(
    ["git", "show", "69810478:src/app/src/data/namedGravesV347.json"], cwd=ROOT
  )
  assert (DATA / "namedGravesV347.json").read_bytes() == old
  assert evidence["retainedGravesSha256"] == hashlib.sha256(old).hexdigest()


def test_complete_directory_keeps_conflicts_and_unplaced_outer_memorials():
  current = audit()
  assert current == read(GEO / "wall-places-v352-audit.json.gz")
  records = current["records"]
  assert len(records) == len({row["id"] for row in records}) == 196
  added = [row for row in records if row["status"].startswith("mapped-marker-added")]
  assert [row["id"] for row in added] == ["foundation:1804"]
  unresolved = {row["id"]: row for row in records}
  for identity in ("foundation:1852", "foundation:1883", "foundation:1821"):
    assert unresolved[identity]["status"] == "directory-only-physical-form-unverified"


def test_no_historical_border_coordinates_or_remote_textures_enter_runtime_marker():
  data = read(DATA / "wallMarkersV352.json")
  text = json.dumps(data)
  assert "http" not in text and "1989" not in text
  for site in data["sites"]:
    assert set(site["models"]) == {"drawn", "minecraft"}
    for model in site["models"].values():
      assert max(solid["high"] for solid in model["solids"]) == 2.6
      assert all(solid["low"] == 0 for solid in model["solids"])
