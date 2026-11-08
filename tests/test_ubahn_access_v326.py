"""Finite current-name/source-path proof without constructing a city."""

from __future__ import annotations

import copy
import gzip
import json

import pytest

from scripts.build_ubahn_access_v326 import INDEX, OUTPUT, SOURCE, build


def test_exact_reproduction_and_full_source_paths() -> None:
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  profile, index = build(source)
  actual = json.loads(OUTPUT.read_bytes())
  del actual["evidenceSha256"]
  assert profile == actual
  assert index == json.loads(INDEX.read_bytes())
  assert len(profile["stations"]) == 175
  assert len(profile["entries"]) == 622
  assert sum(e["stair"] is not None for e in profile["entries"]) == 317
  ways = {w["id"]: w for w in source["accessWays"]}
  for entry in profile["entries"]:
    if stair := entry["stair"]:
      original = ways[stair["sourceWay"]]
      assert original["tags"]["highway"] == "steps"
      points = original["points"]
      if original["tags"]["incline"] == "up":
        points = list(reversed(points))
      assert stair["points"] == points
      assert original["tags"].get("indoor") != "yes"
      if stair["mappedStepCount"]:
        assert stair["steps"] == int(original["tags"]["step_count"])


def test_station_names_and_protected_or_s_only_entries() -> None:
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  profile, _ = build(source)
  names = {s["name"] for s in profile["stations"]}
  assert "Anton-Wilhelm-Amo-Str." in names
  assert "Mohrenstraße" not in names
  assert "Anhalter Bahnhof" not in names
  assert "Oranienburger Straße" not in names
  assert "Französische Straße" not in names
  ids = {e["id"] for e in profile["entries"]}
  assert not ids.intersection(source["authoredEntrances"])
  assert not ids.intersection(source["unresolvedEntrances"])
  assert len(source["authoredEntrances"]) == 22
  assert sum(s["temporaryU6Closure"] for s in profile["stations"]) == 5


def test_missing_inventory_or_duplicate_entrance_fails_closed() -> None:
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  damaged = copy.deepcopy(source)
  damaged["stations"].pop(next(iter(damaged["stations"])))
  with pytest.raises(ValueError, match="Incomplete"):
    build(damaged)
  damaged = copy.deepcopy(source)
  damaged["entrances"].append(damaged["entrances"][0])
  with pytest.raises(ValueError, match="Duplicate"):
    build(damaged)
