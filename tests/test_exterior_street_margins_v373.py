"""Verify the rendered street-margin triangles against the original survey footprints."""

import base64
import gzip
import json
from collections import defaultdict

import numpy as np
import pytest
import shapely

from scripts import build_exterior_street_margins_v373 as streets


def words(encoded, dtype):
  return np.frombuffer(
    gzip.decompress(base64.b64decode(encoded, validate=True)), dtype=dtype
  )


@pytest.fixture(scope="module")
def delivered():
  package = json.loads(streets.OUTPUT.read_bytes())
  areas, styles = [], []
  vertices, indices = 0, 0
  for part in package["chunks"]:
    xz = words(part["xz"], "<u2").reshape(part["vertices"], 2)
    xz = (xz + np.asarray(part["origin"])) / 100
    style = words(part["style"], "u1")
    tri = words(part["index"], "<u2").reshape(-1, 3)
    assert style.size == part["vertices"]
    assert tri.size == part["indices"] and tri.max() < len(xz)
    assert np.all(style[tri] == style[tri[:, :1]])
    positions = xz[tri]
    turns = positions[:, 1] - positions[:, 0]
    ends = positions[:, 2] - positions[:, 0]
    assert np.all(turns[:, 0] * ends[:, 1] - turns[:, 1] * ends[:, 0] < 0)
    areas.extend(shapely.polygons(positions))
    styles.extend(style[tri[:, 0]])
    vertices += len(xz)
    indices += tri.size
  assert (vertices, indices) == (package["vertexCount"], package["indexCount"])
  # Position/color/Uint16-index arrays only, independently of compressed bytes.
  assert vertices * 15 + indices * 2 < 2_200_000
  assert streets.OUTPUT.stat().st_size < 1_000_000
  return package, np.asarray(areas), np.asarray(styles)


def test_each_material_has_original_survey_coverage(delivered):
  package, triangles, styles = delivered
  archive = json.loads(gzip.decompress(streets.SURVEY.read_bytes()))
  originals = defaultdict(list)
  for fid, code, geometry in archive["features"]:
    material = "lawn" if fid.startswith("ce_gruenflaeche.") else streets.LEGEND[code]
    originals[material].append(
      shapely.make_valid(streets.world(shapely.from_wkb(geometry)))
    )
  for i, name in enumerate(package["styles"]):
    # The two independent source systems are in metres, the on-wire vertices in
    # centimetres. The tolerance is smaller than two encoded coordinate units.
    permitted = shapely.union_all(originals[name]).buffer(0.019)
    shapely.prepare(permitted)
    selected = triangles[styles == i]
    assert np.all(shapely.covers(permitted, selected)), name
    assert sum(shapely.area(selected)) == pytest.approx(
      package["materialM2"][name], abs=0.01
    )


def test_fill_is_inside_road_complement_and_outside_protected_owners(delivered):
  package, triangles, _ = delivered
  gap, districts, payload = streets.exterior_cutouts()
  assert (
    set(package["districtM2"])
    == set(districts)
    == {"Kreuzberg", "Charlottenburg", "Wilmersdorf", "Schöneberg"}
  )
  assert 60_000 < sum(package["districtM2"].values()) < gap.area
  tolerance = gap.buffer(0.019)
  shapely.prepare(tolerance)
  assert np.all(shapely.covers(tolerance, triangles))
  protected = streets.protections(payload)
  tree = shapely.STRtree(protected)
  faces, owners = tree.query(triangles, predicate="intersects")
  overlap = shapely.area(
    shapely.intersection(triangles[faces], protected[owners])
  ).sum()
  assert overlap < 0.001
