"""Ensure small garden additions have real source and terrain support."""

import hashlib
import json

from shapely.geometry import Point, shape

from scripts import build_savigny_garden_v341 as build


def test_reproducible_source_containment_and_unchanged_inputs():
  data, evidence = build.build()
  assert data == json.loads(build.OUT.read_bytes())
  assert json.loads(json.dumps(evidence)) == json.loads(build.EVIDENCE.read_bytes())
  assert {p["id"] for p in data["patches"]} == set(build.IDS)
  assert sum(len(p["anchors"]) for p in data["patches"]) == 245
  for path, digest in evidence["originals"].items():
    assert hashlib.sha256((build.ROOT / path).read_bytes()).hexdigest() == digest
  terrains = [
    build.Terrain(build.read(build.CORE / name), bool(i))
    for i, name in enumerate(("ground-context.json", "minecraft-voxels.json"))
  ]
  for patch in data["patches"]:
    record = next(p for p in evidence["patches"] if p["id"] == patch["id"])
    source, allowed = shape(record["sourceGeometry"]), shape(record["allowedCentres"])
    for x, z, drawn_y, native_y, height, tone in patch["anchors"]:
      point = Point(x, z)
      assert allowed.covers(point)
      assert source.covers(point.buffer(0.51))
      assert abs(terrains[0].at(x, z)[1] - drawn_y) < 0.001
      assert abs(terrains[1].at(x, z)[1] - native_y) < 0.001
      assert 0.38 <= height <= 0.6 and tone in (0, 1, 2)
