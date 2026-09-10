"""Validate the committed ministry supplement without network or raw-cache access."""

import json
import math
from pathlib import Path
from typing import Any

import pytest
from pyproj import Transformer
from shapely.geometry import MultiPoint, Polygon, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "src/app/src/economicMinistrySource.json"
PRISM_PATH = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"


@pytest.fixture(scope="module")
def ministry_source() -> dict[str, Any]:
  return json.loads(SOURCE_PATH.read_text(encoding="utf-8"))


def _footprint(prism: dict[str, Any]) -> Polygon:
  return Polygon(
    [(x / 10, z / 10) for x, z in prism["ring"]],
    [[(x / 10, z / 10) for x, z in ring] for ring in prism.get("holes", [])],
  )


def test_six_original_ministry_records_remain_unchanged(
  ministry_source: dict[str, Any],
) -> None:
  original = json.loads(PRISM_PATH.read_text(encoding="utf-8"))
  by_id = {prism["id"]: prism for prism in original["buildings"]}
  expected = {"K00008CN", "yAAWS2KQ", "-3202585", "K0000EU2", "K0000B4S", "K0000A7g"}
  assert {prism["id"] for prism in ministry_source["prisms"]} == expected
  assert len(ministry_source["prisms"]) == len(expected)
  for prism in ministry_source["prisms"]:
    assert prism == by_id[prism["id"]]


def test_main_roof_covers_the_source_wings_and_preserves_all_eleven_courts(
  ministry_source: dict[str, Any],
) -> None:
  main = next(p for p in ministry_source["prisms"] if p["id"] == "K00008CN")
  footprint = _footprint(main)
  assert footprint.is_valid
  assert len(footprint.interiors) == 11
  triangles = []
  for vertices in ministry_source["mainRoof"]["triangles"]:
    assert len(vertices) == 9
    assert all(math.isfinite(value) for value in vertices)
    triangle = Polygon([(vertices[i], vertices[i + 2]) for i in (0, 3, 6)])
    assert triangle.is_valid
    assert triangle.area > 0
    triangles.append(triangle)
  roof = unary_union(triangles)
  # Compare occupied areas independently of the builder's offset-band method.
  assert footprint.difference(roof).area < 1e-6
  assert roof.difference(footprint).area < 1e-6
  assert abs(sum(triangle.area for triangle in triangles) - roof.area) < 1e-6
  for court in footprint.interiors:
    assert roof.intersection(Polygon(court)).area < 1e-8


def test_roof_and_source_heights_preserve_the_existing_vertical_envelopes(
  ministry_source: dict[str, Any],
) -> None:
  by_id = {prism["id"]: prism for prism in ministry_source["prisms"]}
  main = by_id["K00008CN"]
  roof_heights = [
    triangle[index]
    for triangle in ministry_source["mainRoof"]["triangles"]
    for index in (1, 4, 7)
  ]
  assert min(roof_heights) >= main["y0_dm"] / 10
  assert max(roof_heights) <= (main["y0_dm"] + main["h_dm"]) / 10
  assert min(roof_heights) < max(roof_heights)
  for part in ministry_source["parts"]:
    prism = by_id[part["id"]]
    bottom = prism["y0_dm"] / 10
    top = (prism["y0_dm"] + prism["h_dm"]) / 10
    assert part["sourceGroundM"] + part["viewerYOffsetM"] == pytest.approx(bottom)
    vertices = [v for surface in part["surfaces"] for r in surface["rings"] for v in r]
    assert vertices
    for vertex in vertices:
      assert len(vertex) == 3
      assert all(math.isfinite(value) for value in vertex)
      # Millimetre official surfaces retain precision beyond the decimetre
      # prism heights; allow only the source's half-decimetre rounding range.
      assert bottom - 0.05 <= vertex[1] <= top + 0.05


def test_every_source_surface_and_roof_vertex_stays_inside_release_bounds(
  ministry_source: dict[str, Any],
) -> None:
  bounds = json.loads(
    (ROOT / "geo_data/regierungsviertel/bounds.geojson").read_text(encoding="utf-8")
  )
  project = Transformer.from_crs("EPSG:4326", "EPSG:25833", always_xy=True)
  polygon = transform(project.transform, shape(bounds["features"][0]["geometry"]))
  world_vertices = [
    vertex
    for part in ministry_source["parts"]
    for surface in part["surfaces"]
    for ring in surface["rings"]
    for vertex in ring
  ]
  world_vertices.extend(
    triangle[index : index + 3]
    for triangle in ministry_source["mainRoof"]["triangles"]
    for index in (0, 3, 6)
  )
  official_points = MultiPoint(
    [(389500 + x, 5820000 - z) for x, _y, z in world_vertices]
  )
  assert polygon.covers(official_points)
