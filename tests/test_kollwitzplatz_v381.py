import gzip
import json
from pathlib import Path

from shapely.geometry import Point, shape

ROOT = Path(__file__).resolve().parents[1]
S = json.loads(
  gzip.decompress(
    (ROOT / "geo_data/regierungsviertel/kollwitzplatz-v381.json.gz").read_bytes()
  )
)


def test_real_park_and_tree_ownership():
  park = shape(S["park"])
  assert S["parkId"] == "w24638848"
  assert 7300 < park.area < 7600
  assert len(S["trees"]) == len({row[5] for row in S["trees"]}) == 82
  assert all(
    park.buffer(0.03).covers(Point(row[:2])) and row[2] > 0 and row[3] > 0
    for row in S["trees"]
  )
  assert len(S["walkEdges"]) == 4
  assert len(S["benches"]) == 8 and len(S["middleBenches"]) == 2
  for row in S["features"]:
    assert shape(row["g"]).difference(park.buffer(0.05)).length < 0.1


def test_equipment_belongs_to_individually_registered_playgrounds():
  pads = {f["id"]: shape(f["g"]) for f in S["features"] if f["kind"] == "play"}
  assert len(pads) == 3
  for p in [*S["play"]["centralRoofs"], S["play"]["kitchen"]]:
    assert pads["w321034939"].covers(Point(p))
  for p in S["play"]["railwayAxis"]:
    assert pads["w321034943"].covers(Point(p))
  for p in [*S["play"]["southernSlackline"], *(pt for _, pt in S["tables"])]:
    assert pads["w321034946"].covers(Point(p))
  assert S["statue"]["id"] == "n603037654" and len(S["statue"]["photographs"]) == 7
