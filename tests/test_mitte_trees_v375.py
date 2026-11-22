"""Senate point survey, release geometry and preservation checks for the new stands."""

import gzip
import json
import math

from shapely import Point, STRtree

from scripts.build_mitte_trees_v375 import (
  CONTACTS,
  OUTPUT,
  PUBLIC,
  SURVEY,
  build,
  encode,
  protected_geometry,
  read,
)


def test_pack_rebuilds_from_the_two_frozen_sources():
  assert encode(build()) + b"\n" == OUTPUT.read_bytes()
  contacts = json.loads(gzip.decompress(CONTACTS.read_bytes()))["rows"]
  assert len(contacts) == 513
  assert all(owner and abs(ground - old) <= 1 for _, _, old, ground, owner in contacts)


def test_every_new_stem_has_distinct_municipal_measurements_and_clear_ground():
  survey = json.loads(gzip.decompress(SURVEY.read_bytes()))["rows"]
  rows = {r[1]: r for r in survey}
  assert len(rows) == len(survey) == 7618
  packet = read(OUTPUT)
  park = read(PUBLIC / "park-details.json")
  earlier = STRtree([Point(t["position"][0], t["position"][2]) for t in park["trees"]])
  protected = protected_geometry(park)
  for tree in packet["additions"]:
    _, _, sx, sz, height, diameter, circumference, species, _ = rows[tree["i"]]
    x, _, z = tree["position"]
    stem = Point(x, z)
    assert math.hypot(x - sx, z - sz) < 0.008
    assert not earlier.query(stem, predicate="dwithin", distance=3).size
    assert not protected.query(stem, predicate="dwithin", distance=tree["tr"]).size
    assert tree["h"] == height and tree["cr"] == diameter / 2
    assert tree["tr"] == round(circumference / (200 * math.pi), 3)
    assert packet["vocabulary"]["species"][tree["sp"]] == species
