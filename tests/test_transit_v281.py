"""Bounded Step 10 source ownership and reproducibility checks."""

import hashlib
import importlib.util
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
  "transit_v281", ROOT / "scripts/build_transit_v281.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def read(relative):
  return json.loads((ROOT / relative).read_bytes())


def test_exact_reproducible_retained_courses_and_steps():
  rails, stairs = MODULE.build()
  assert rails == read("src/app/src/data/tramRailsV281.json")
  assert stairs == read("src/app/src/data/ubahnEntrancesV281.json")
  assert len(rails["tracks"]) == 107
  assert [s["stepCount"] for s in stairs["stairs"]] == [30, 27, 28]
  assert (
    rails["railSha256"]
    == hashlib.sha256(
      (ROOT / "src/app/public/mesh/regierungsviertel/rail-lines.json").read_bytes()
    ).hexdigest()
  )


def test_no_new_rail_course_no_duplicate_previous_owner_no_inferred_bridge_height():
  rails = read("src/app/src/data/tramRailsV281.json")
  original = read("src/app/public/mesh/regierungsviertel/rail-lines.json")
  original_by_id = {t["id"]: t for t in original["tram_catenary"]["tracks"]}
  previous = read("src/app/src/data/tachelesRailsV270.json")
  previous_ids = {t["id"] for t in previous["tracks"]}
  evidence = {
    r["id"]: r
    for r in read("geo_data/regierungsviertel/transit-v281-source.json")["records"]
  }
  for track in rails["tracks"]:
    assert track == original_by_id[track["id"]]
    assert track["id"] not in previous_ids
    tags = evidence[track["id"].split(":")[0]]["tags"]
    assert tags["railway"] == "tram" and tags["gauge"] == "1435"
    assert tags.get("bridge", "no") == tags.get("tunnel", "no") == "no"
  assert {t["id"] for t in rails["excluded"]} == {
    "way/104669627:0",
    "way/165409970:0",
    "way/291670883:0",
    "way/291670888:0",
  }
  length = sum(
    math.dist(a, b) / 10
    for t in rails["tracks"]
    for a, b in zip(t["points"], t["points"][1:])
  )
  assert 10_400 < length < 10_600


def test_only_positive_source_stair_identities_never_access_elevators():
  data = read("src/app/src/data/ubahnEntrancesV281.json")
  evidence = {
    r["id"]: r
    for r in read("geo_data/regierungsviertel/transit-v281-source.json")["records"]
  }
  for stair in data["stairs"]:
    way, node = evidence[stair["osmWay"]], evidence[stair["osmNode"]]
    assert way["tags"]["highway"] == "steps"
    assert way["tags"]["level"] == "-1;0"
    assert way["tags"]["incline"] == "up"
    assert int(way["tags"]["step_count"]) == stair["stepCount"]
    assert node["tags"]["railway"] == "subway_entrance"
    assert math.dist(node["coordinates"][0], way["coordinates"][-1]) < 1e-12
    assert stair["descent"] == round(stair["stepCount"] * 0.17, 2)
  assert "no inferred accessible ramp" in data["estimates"]
