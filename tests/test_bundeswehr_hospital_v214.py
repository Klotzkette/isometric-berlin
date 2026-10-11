"""Independent source clipping/preservation checks for the v214 hospital addition."""

import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, shape

from scripts.build_breitscheid_towers_v161 import normal_of

ROOT = Path(__file__).resolve().parents[1]


def test_facade_rectangles_stay_on_complete_source_walls() -> None:
  data = json.loads(
    (ROOT / "src/app/src/data/bundeswehrHospitalV214.json").read_bytes()
  )
  faces = json.loads(
    (
      ROOT / "geo_data/regierungsviertel/bundeswehr-hospital-v214-facades.json"
    ).read_bytes()
  )
  for r in data["boxes"]:
    if ":" not in r[-1]:
      continue
    face = faces[int(r[-1].split(":")[0])]
    rings = face["rings"]
    normal = normal_of(rings[0])
    direction = np.array([np.cos(r[6]), 0, -np.sin(r[6])])
    base = np.array(rings[0][0])
    projected = [
      [(float(np.dot(np.subtract(p, base), direction)), p[1]) for p in ring]
      for ring in rings
    ]
    poly = Polygon(projected[0], projected[1:])
    c = np.array(r[:3])
    assert abs(float(np.dot(c - base, normal)) - 0.15) < 0.001
    u = float(np.dot(c - base, direction))
    rect = Polygon(
      [
        (u - r[3] / 2, r[1] - r[4] / 2),
        (u + r[3] / 2, r[1] - r[4] / 2),
        (u + r[3] / 2, r[1] + r[4] / 2),
        (u - r[3] / 2, r[1] + r[4] / 2),
      ]
    )
    assert poly.buffer(0.002).covers(rect)


def test_exact_pad_and_source_owners_remain_distinct() -> None:
  source = json.loads(
    (
      ROOT / "geo_data/regierungsviertel/bundeswehr-hospital-v214-source.json"
    ).read_bytes()
  )
  data = json.loads(
    (ROOT / "src/app/src/data/bundeswehrHospitalV214.json").read_bytes()
  )
  pad = shape(source["sites"]["51804908"]["geometry"])
  campus = shape(source["sites"]["24931203"]["geometry"])
  assert pad.distance(campus) > 45
  assert abs(pad.centroid.x - data["helipad"]["centre"][0]) < 0.000001
  assert abs(pad.centroid.y - data["helipad"]["centre"][2]) < 0.000001
  assert (
    abs(
      sum(Polygon([(p[0], p[2]) for p in t]).area for t in data["padTriangles"])
      - pad.area
    )
    < 0.00001
  )
  assert len(source["owners"]) == 40
  assert sum(len(o["parts"]) for o in source["owners"]) == 99
  core = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
    )["buildings"]
  }
  for owner in source["owners"]:
    for part in owner["parts"]:
      assert core[part["id"][-8:]] == part["prism"]
  for r in data["blocks"]:
    if r[-1] == "native mapped pad":
      assert pad.covers(
        Polygon(
          [
            (r[0] - 0.5, r[2] - 0.5),
            (r[0] + 0.5, r[2] - 0.5),
            (r[0] + 0.5, r[2] + 0.5),
            (r[0] - 0.5, r[2] + 0.5),
          ]
        )
      )
