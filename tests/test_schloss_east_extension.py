"""The narrow east preview is additive, bounded and backed by source geometry."""

import base64
import json
from pathlib import Path

import numpy as np
import pytest
import shapely
from shapely.affinity import affine_transform
from shapely.geometry import Polygon
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import load_bounds_polygon, project_to_berlin

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src"


def test_bounds_preserve_previous_city_and_include_all_eight_source_parts():
  old = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds-task13.geojson")
  )
  new = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  assert new.is_valid and new.geom_type == "Polygon" and not new.interiors
  assert old.difference(new.buffer(0.0001)).area == 0
  assert 300_000 < new.area - old.area < 310_000
  source = json.loads((DATA / "schlossEastSource.json").read_text())
  parts = [p for profile in source["profiles"].values() for p in profile["parts"]]
  assert len(parts) == 8
  for part in parts:
    footprint = Polygon(part["ring"], part["holes"])
    metric = affine_transform(footprint, [1, 0, 0, -1, 389500, 5820000])
    assert new.covers(metric)
    assert part["surfaces"] and part["top_y_m"] > part["ground_y_m"]
  assert any(len(p["holes"]) == 3 for p in source["profiles"]["rathaus"]["parts"])
  assert source["fernsehturm_total_height_m"] == 368
  assert (
    len(
      json.loads((ROOT / "geo_data/regierungsviertel/landmarks.geojson").read_text())[
        "features"
      ]
    )
    == 93
  )


def surface_union(source):
  """Read the actual committed triangles rather than a whole display window."""
  pieces = []
  for surface in source["surfaces"]:
    p = (
      np.frombuffer(base64.b64decode(surface["positions_cm_b64"]), dtype="<i4").reshape(
        -1, 2
      )
      / 100
    )
    i = np.frombuffer(base64.b64decode(surface["indices_b64"]), dtype="<u4").reshape(
      -1, 3
    )
    pieces.append(unary_union(shapely.polygons(p[i])))
  return unary_union(pieces)


def test_new_streets_account_for_area_and_do_not_replace_existing_detail():
  east = json.loads((DATA / "data/schlossEastStreets.json").read_text())
  old = json.loads((DATA / "data/districtStreets.json").read_text())
  added, previous = surface_union(east), surface_union(old)
  expected = east["source"]["asphalt_area_m2"] + east["source"]["paving_area_m2"]
  assert added.area == pytest.approx(
    expected, abs=25
  )  # cm storage at many kerb corners
  assert added.intersection(previous.buffer(-0.02)).area < 0.1
  names = {r["name"] for r in east["source"]["records"]}
  assert {
    "Schloßplatz",
    "Karl-Liebknecht-Straße",
    "Spandauer Straße",
    "Rathausstraße",
  } <= names
  bounds = project_to_berlin(
    load_bounds_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  assert (
    affine_transform(added, [1, 0, 0, -1, 389500, 5820000])
    .difference(bounds.buffer(0.02))
    .area
    < 0.01
  )


def test_native_street_top_runs_are_disjoint_and_accounted():
  native = json.loads((DATA / "data/schlossEastBlockStreets.json").read_text())
  assert sum(run[2] for run in native["runs"]) == native["cell_count"]
  rows = {}
  for x, z, length, kind in native["runs"]:
    assert length > 0 and kind in {0, 1, 2, 3}
    assert x >= rows.get(z, -1e10)
    rows[z] = x + length
