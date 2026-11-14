"""Independent emitted-geometry tests for a finite source ownership transaction."""

import base64
import gzip
import json
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def geometry(surface):
  vertices = (
    np.frombuffer(base64.b64decode(surface["positions_cm_b64"]), "<i4").reshape(-1, 2)
    / 100
  )
  indices = np.frombuffer(base64.b64decode(surface["indices_b64"]), "<u4").reshape(
    -1, 3
  )
  return unary_union([Polygon(vertices[ix]) for ix in indices])


def test_mitte_emitted_faces_preserve_complete_outside_complement():
  data = json.loads((DATA / "mitteRoadsV343.json").read_text())
  old = json.loads((DATA / "districtStreets.json").read_text())
  source = json.loads(
    gzip.decompress(
      (ROOT / "geo_data/regierungsviertel/mitte-roads-v343-source.json.gz").read_bytes()
    )
  )
  focus = unary_union([shape(row["geometry"]) for row in source["features"]])
  for patch in data["surfacePatches"]:
    before = next(row for row in old["surfaces"] if row["kind"] == patch["kind"])
    vertices = (
      np.frombuffer(base64.b64decode(before["positions_cm_b64"]), "<i4").reshape(-1, 2)
      / 100
    )
    indices = np.frombuffer(base64.b64decode(before["indices_b64"]), "<u4").reshape(
      -1, 3
    )
    original = unary_union(
      [Polygon(vertices[indices[row[0]]]) for row in patch["faces"]]
    )
    expected = original.difference(focus)
    emitted = geometry(
      next(
        row for row in data["supplement"]["surfaces"] if row["kind"] == patch["kind"]
      )
    )
    # Only the established centimetre payload precision is permitted. Every
    # old outside component remains, including narrow boundary slivers.
    assert emitted.hausdorff_distance(expected) < 0.015
    assert emitted.symmetric_difference(expected).area < 0.8
    assert emitted.area > expected.area * 0.99


def test_only_current_surveyed_regions_and_natural_stone_receive_detail():
  data = json.loads((DATA / "mitteRoadsV343.json").read_text())
  source = json.loads(
    gzip.decompress(
      (ROOT / "geo_data/regierungsviertel/mitte-roads-v343-source.json.gz").read_bytes()
    )
  )
  roads = shape(data["navigation"]["road"])
  walk = shape(data["navigation"]["walk"])
  assert roads.intersection(walk).area < 0.001
  assert {r["id"] for r in source["features"] if r["layer"] == "road"} == {
    "cm_fahrbahn.24972",
    "cm_fahrbahn.25080",
    "cm_fahrbahn.25145",
  }
  assert all(r["id"] != "cm_fahrbahn.24862" for r in source["features"])
  stone = unary_union(
    [
      shape(r["geometry"])
      for r in source["features"]
      if r["layer"] == "walk" and r["material"] == "08"
    ]
  )
  for seam in data["seams"]:
    line = LineString(seam)
    assert stone.buffer(0.01).covers(line)
    assert roads.intersection(line).length < 0.001
  for surface in data["surfaces"]:
    emitted = geometry(surface)
    expected = roads if surface["layer"] == "road" else walk
    assert expected.buffer(0.015).covers(emitted)


def test_grass_verges_remain_while_exact_raised_borders_are_visible():
  data = json.loads((DATA / "mitteRoadsV343.json").read_text())
  source = json.loads(
    gzip.decompress(
      (ROOT / "geo_data/regierungsviertel/mitte-roads-v343-source.json.gz").read_bytes()
    )
  )
  assert {r["id"] for r in source["retainedGrassVergeEvidence"]} == {
    "ce_gruenflaeche.21337",
    "ce_gruenflaeche.41415",
  }
  verges = unary_union(
    [shape(r["geometry"]) for r in source["retainedGrassVergeEvidence"]]
  )
  assert verges.intersection(shape(data["navigation"]["road"])).area < 0.001
  assert verges.intersection(shape(data["navigation"]["walk"])).area < 0.001
  assert {r["id"] for r in source["raisedVergeKerbs"]} == {
    "bd_bordstein.237701",
    "bd_bordstein.468448",
  }
  assert all(r["properties"]["bor"] == 1 for r in source["raisedVergeKerbs"])
  original = unary_union([shape(r["geometry"]) for r in source["raisedVergeKerbs"]])
  emitted = unary_union([LineString(p) for p in data["supplement"]["curbs_m"]])
  # Existing mapped walking approaches intentionally retain their lowered
  # openings. The remainder of both municipal raised borders is present.
  assert original.length > 310
  assert original.difference(emitted.buffer(0.015)).length < 3
