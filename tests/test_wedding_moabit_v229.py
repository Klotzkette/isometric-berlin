"""Verify source identity, unchanged prior payloads and measured face ownership."""

import hashlib
import json
from pathlib import Path

from shapely.geometry import Point, Polygon, shape

from scripts.build_wedding_moabit_v229 import PITCHES, build

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/wedding-moabit-v229-source.json"
DATA = ROOT / "src/app/src/data"


def test_replay_and_immutable_rail_sources():
  source = json.loads(SOURCE.read_text())
  runtime = json.loads((DATA / "weddingMoabitV229.json").read_text())
  assert build(source) == runtime
  assert runtime["sourceSha256"] == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  for name, digest in source["stationCorrection"]["oldDatasetSha256"].items():
    assert hashlib.sha256((DATA / name).read_bytes()).hexdigest() == digest
  assert (
    next(o for o in source["objects"] if o["id"] == "relation/5559039")["tags"]["level"]
    == "1"
  )
  assert runtime["stationCorrection"]["newPlatformY"] == 10.46


def test_all_pitch_rings_and_fountain_remain_source_bound():
  source = json.loads(SOURCE.read_text())
  runtime = build(source)
  objects = {o["id"]: o for o in source["objects"]}
  assert {int(p["id"].split("/")[1]) for p in runtime["pitches"]} == PITCHES
  for p in runtime["pitches"]:
    measured = shape(objects[p["id"]]["geometry"])
    assert measured.hausdorff_distance(Polygon(p["ring"])) < 0.001
    assert measured.buffer(0.001).covers(Point(*p["frame"][:2]))
    assert p["sport"] in ["soccer", "tennis"]
  assert runtime["square"]["id"] == "relation/4717544"
  assert Polygon(
    shape(objects["relation/4717544"]["geometry"]).geoms[0].exterior
  ).contains(Point(*runtime["fountain"]["center"]))
  assert not any(p["id"] == "way/1242653753" for p in runtime["pitches"])


def test_pool_faces_retain_official_coordinates_and_old_part_datum():
  source = json.loads(SOURCE.read_text())
  runtime = build(source)
  parts = {p["id"]: p for owner in source["poolOwners"] for p in owner["parts"]}
  for face in runtime["poolWalls"]:
    p = parts[face["owner"]]
    shifted = [
      [
        [[x, round(y + p["displayOffsetY"], 3), z] for x, y, z in ring]
        for ring in s["rings"]
      ]
      for s in p["surfaces"]
      if s["kind"] == "WallSurface"
    ]
    assert face["rings"] in shifted
    assert p["prismId"]
  assert [runtime["poolWalls"][i]["owner"][-8:] for i in [1, 5, 6]] == [
    "ZNoK13Vu",
    "RvA3GWq5",
    "ycGsdtC6",
  ]
  assert len(runtime["stairs"]) == 9
  upper = next(s for s in runtime["stairs"] if s["id"] == "way/363581647")
  assert upper["tags"]["level"] == "1"
  assert (
    Polygon(runtime["platformRings"][0]).distance(Point(upper["points"][0])) < 0.001
  )
  stair = next(s for s in runtime["stairs"] if s["id"] == "way/437595034")
  assert upper["points"][-1] == stair["points"][-1]
  assert (DATA / "weddingMoabitV229.json").stat().st_size < 20_000
