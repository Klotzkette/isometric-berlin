"""Independent Werkhof source, height, complete-body and open-yard regressions."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import sqlite3
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts
from scripts import build_tiergarten_werkhof_v275 as builder
from scripts.build_bebelplatz_building_source import part_profile

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
  "K0002Q8X",
  "K0002KS2",
  "K0003V9x",
  "K0003U3m",
  "K0002RLM",
  "K0002QXE",
  "K0003VKP",
  "K0003VMG",
  "K0002OAo",
  "K0002L8a",
  "K0002LWR",
  "K0002MKq",
  "K0003Txs",
  "K0003V3I",
  "K0002PgY",
  "K0003U1j",
  "K0003V4T",
  "K0003U3h",
  "K0003UrX",
  "K0003Uow",
}
CANOPIES = {
  "K0003V9x",
  "K0003U3m",
  "K0003VKP",
  "K0003VMG",
  "K0003Txs",
  "K0003V3I",
  "K0003U1j",
  "K0003V4T",
  "K0003U3h",
  "K0003UrX",
  "K0003Uow",
}


@pytest.fixture(scope="module")
def evidence():
  return json.loads(gzip.decompress(builder.SOURCE.read_bytes()))


@pytest.fixture(scope="module")
def model():
  return json.loads(builder.OUTPUT.read_bytes())


def test_all_twenty_original_parents_and_full_surfaces_replay_official_archive(
  evidence,
):
  """The correction must never rewrite its inconvenient 21/24 m source evidence."""
  retained = {p["id"]: p for p in evidence["parents"]}
  assert len(retained) == 20
  assert {identifier[-8:] for identifier in retained} == EXPECTED
  assert evidence["osmSite"]["id"] == 118034165
  assert evidence["osmSite"]["tags"]["addr:housenumber"] == "31"
  assert evidence["datum"]["origin"] == [389500, 5820000, 30]
  found = set()
  for tile in {p["tile"] for p in retained.values()}:
    archive = ROOT / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip"
    assert {p["archiveSha256"] for p in retained.values() if p["tile"] == tile} == {
      hashlib.sha256(archive.read_bytes()).hexdigest()
    }
    with zipfile.ZipFile(archive) as zipped:
      for name in zipped.namelist():
        if not name.lower().endswith((".gml", ".xml", ".citygml")):
          continue
        with zipped.open(name) as stream:
          for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            identifier = element.get(GML_ID)
            if identifier in retained:
              assert retained[identifier]["parts"] == [
                part_profile(p) for p in leaf_building_parts(element) or [element]
              ], identifier
              found.add(identifier)
            element.clear()
  assert found == set(retained)


def test_height_repairs_keep_measured_evidence_and_occluded_estimate_separate(
  evidence, model
):
  originals = {p["id"][-8:]: p["parts"][0] for p in evidence["parents"]}
  current = {p["sourceId"]: p for p in model["parts"]}
  assert set(current) == EXPECTED
  assert {key for key, p in current.items() if p["correction"]} == {
    "K0002L8a",
    "K0003Txs",
    "K0003VMG",
  }
  assert originals["K0002L8a"]["height_m"] == 21.06
  assert originals["K0003Txs"]["height_m"] == 24.015
  assert originals["K0003VMG"]["height_m"] == 16.998
  samples = evidence["bdom"]["samples"]
  assert len(samples) == 108
  # The canopy measurements under foliage are explicitly retained, not
  # misrepresented as low roof readings. Only the two clear roofs support repair.
  low_roofs = {
    "K0002L8a": (35.85, 35.92, 4),
    "K0003Txs": (35.20, 35.33, 10),
  }
  for identifier, (low, high, minimum) in low_roofs.items():
    readings = [
      s for s in samples if s["id"].endswith(identifier) and low <= s["NHN"] <= high
    ]
    assert len(readings) >= minimum
    assert all(
      s["url"].startswith("https://gdi.berlin.de/services/wms/bdom?") for s in readings
    )
    assert current[identifier]["correction"]["status"] == "bDOM-supported-low-roof"
    assert low - 0.15 <= current[identifier]["maxY"] + 30 <= high + 0.15
  occluded = current["K0003VMG"]
  assert occluded["correction"]["status"] == "occluded-height-estimate"
  assert occluded["maxY"] - occluded["minY"] == pytest.approx(3)
  assert min(s["NHN"] for s in samples if s["id"].endswith("K0003VMG")) > 38
  for identifier, current_part in current.items():
    original = originals[identifier]
    assert current_part["ring"] == original["ring"]
    assert current_part["holes"] == original["holes"]
    assert current_part["minY"] == original["ground_y_m"]
    if not current_part["correction"]:
      assert current_part["maxY"] == original["top_y_m"]
  # The real taller houses keep their own roofs; this is not a flat site cap.
  assert current["K0002KS2"]["maxY"] == 14.842
  assert current["K0002RLM"]["maxY"] == 14.146


def test_official_canopy_functions_keep_open_shelters_and_all_retained_roofs(
  evidence, model
):
  database = ROOT / evidence["alkis"]["file"]
  assert (
    hashlib.sha256(database.read_bytes()).hexdigest() == evidence["alkis"]["sha256"]
  )
  with sqlite3.connect(f"file:{database}?mode=ro", uri=True) as connection:
    for row in evidence["alkis"]["rows"]:
      actual = connection.execute(
        "select function,roof_type,measured_height_m from buildings where building_id=?",
        (row["id"],),
      ).fetchall()
      assert actual == [(row["function"], row["roofType"], row["measuredHeightM"])]
  assert {p["sourceId"] for p in model["parts"] if p["openCanopy"]} == CANOPIES
  originals = {p["id"]: p["parts"][0] for p in evidence["parents"]}
  submitted = np.frombuffer(
    base64.b64decode(model["drawnPositions"]), dtype="<f4"
  ).reshape((-1, 9))
  submitted_triangles = {triangle.tobytes() for triangle in submitted}
  for part in model["parts"]:
    polygon = Polygon(part["ring"], part["holes"])
    roof = unary_union(
      [Polygon([(v[0], v[2]) for v in triangle]) for triangle in part["roofTriangles"]]
    )
    source_roof = unary_union(
      [
        Polygon(
          [(v[0], v[2]) for v in surface["rings"][0]],
          [[(v[0], v[2]) for v in ring] for ring in surface["rings"][1:]],
        )
        for surface in originals[part["parentId"]]["surfaces"]
        if surface["kind"] == "RoofSurface"
      ]
    )
    # Retain the surveyed roof outline, including its millimetre-rounded
    # discrepancies from the separately derived ground-plan outline.
    assert roof.symmetric_difference(source_roof).area < 1e-7
    assert (
      roof.symmetric_difference(polygon).area
      <= source_roof.symmetric_difference(polygon).area + 1e-7
    )
    for triangle in part["roofTriangles"]:
      assert (
        np.asarray(triangle, dtype="<f4").reshape(9).tobytes() in submitted_triangles
      )
    if not part["correction"]:
      source_heights = [
        v[1]
        for s in originals[part["parentId"]]["surfaces"]
        if s["kind"] == "RoofSurface"
        for ring in s["rings"]
        for v in ring
      ]
      rendered_heights = [v[1] for t in part["roofTriangles"] for v in t]
      assert min(rendered_heights) == min(source_heights)
      assert max(rendered_heights) == max(source_heights)
    occupied = unary_union([box(x, z, x + 1, z + 1) for x, z, _ in part["nativeCells"]])
    assert polygon.difference(occupied).area < 0.01 * polygon.area
    assert polygon.buffer(1.415).covers(occupied)
    assert all(
      part["minY"] < y <= part["maxY"] + 0.25 for _, _, y in part["nativeCells"]
    )
    if part["openCanopy"]:
      assert part["posts"]
      assert all(max(post[3], post[5]) <= 0.25 for post in part["posts"])
    else:
      assert part["posts"] == []


def test_boundary_planting_cannot_cover_work_yard_roads_water_or_buildings(
  evidence, model
):
  compound = Polygon(evidence["osmSite"]["ringWorld"])
  footprints = unary_union([Polygon(p["ring"], p["holes"]) for p in model["parts"]])
  exclusions = unary_union(
    [
      shape(f["geometry"]).buffer(f["widthEstimate"] / 2 + 1)
      for f in evidence["exclusionFeatures"]
    ]
  )
  assert model["compoundRing"] == evidence["osmSite"]["ringWorld"]
  assert model["shrubs"]
  for shrub in model["shrubs"]:
    half = shrub["width"] / 2
    rectangle = box(
      shrub["x"] - half, shrub["z"] - half, shrub["x"] + half, shrub["z"] + half
    )
    assert compound.covers(rectangle)
    assert not exclusions.intersects(rectangle)
    assert not footprints.buffer(1.99).intersects(rectangle)
    assert compound.boundary.distance(rectangle.centroid) <= 2.11
    assert shrub["height"] <= 1.6


def test_native_surface_fittings_clear_every_compound_body_and_canopy(model):
  """An eave clear of its own house must not be buried in its neighbour."""
  cells = {}
  declared_posts = set()
  for part in model["parts"]:
    for x, z, top in part["nativeCells"]:
      bottom = top - 0.25 if part["openCanopy"] else part["minY"]
      cells.setdefault((x, z), []).append((part["sourceId"], bottom, top))
    for post in part["nativePosts"]:
      declared_posts.add(np.asarray(post + [0, 0x5D6255], dtype="<f4").tobytes())
  details = np.frombuffer(base64.b64decode(model["nativeDetails"]), dtype="<f4")
  overlaps = []
  for index, row in enumerate(details.reshape((-1, 8))):
    # Only the explicitly represented structural supports may meet roof bodies.
    # Windows, doors, gutters and shrubs are checked against every owner, not
    # filtered by their colour or their association with a particular facade.
    if row.tobytes() in declared_posts:
      continue
    x, y, z, width, height, depth, _, _ = map(float, row)
    xmin, xmax = x - width / 2, x + width / 2
    zmin, zmax = z - depth / 2, z + depth / 2
    ymin, ymax = y - height / 2, y + height / 2
    for ix in range(math.floor(xmin), math.floor(xmax) + 1):
      for iz in range(math.floor(zmin), math.floor(zmax) + 1):
        # Allow only float32 boundary-contact error, not positive-volume burial.
        if min(xmax, ix + 1) - max(xmin, ix) <= 0.0001:
          continue
        if min(zmax, iz + 1) - max(zmin, iz) <= 0.0001:
          continue
        for owner, bottom, top in cells.get((ix, iz), []):
          if min(ymax, top) - max(ymin, bottom) > 0.0001:
            overlaps.append((index, owner, ix, iz))
  assert not overlaps, f"Native fittings intersect compound bodies: {overlaps}"


def test_generated_data_is_reproducible_finite_and_bounded(model):
  assert builder.build() == model
  assert (
    model["sourceSha256"] == hashlib.sha256(builder.SOURCE.read_bytes()).hexdigest()
  )
  for name, width in [("drawnPositions", 9), ("drawnDetails", 8), ("nativeDetails", 8)]:
    values = np.frombuffer(base64.b64decode(model[name]), dtype="<f4")
    assert values.size % width == 0
    assert np.isfinite(values).all()
    if width == 8:
      rows = values.reshape((-1, 8))
      assert (rows[:, 3:6] > 0).all()
      if name == "nativeDetails":
        assert (rows[:, 6] == 0).all()
  assert model["counts"]["parents"] == 20
  assert model["counts"]["correctedParents"] == 3
  assert len(base64.b64decode(model["drawnPositions"])) < 100_000
  assert model["counts"]["nativeBodyCells"] < 4000
  assert builder.OUTPUT.stat().st_size < 500_000
