"""Source preservation and bounds for the finite West-square display overlay."""

import hashlib
import json
from pathlib import Path

from shapely.geometry import Polygon, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "src/app/src/data/westSquaresV188Detail.json").read_text())
SOURCE_PATH = ROOT / "src/app/src/data/westSquaresV163Source.json"
SOURCE = json.loads(SOURCE_PATH.read_text())
TAU_PATH = ROOT / "geo_data/regierungsviertel/tauentzien-v165.json"
TAU = json.loads(TAU_PATH.read_text())


def polygon_set(rows: list[list[list[list[float]]]]) -> BaseGeometry:
  return unary_union([Polygon(p[0], p[1:]) for p in rows])


def test_prior_sources_are_byte_preserved_and_scope_is_exact() -> None:
  assert DATA["sourceHashes"] == {
    "westSquaresV163": hashlib.sha256(SOURCE_PATH.read_bytes()).hexdigest(),
    "tauentzienV165": hashlib.sha256(TAU_PATH.read_bytes()).hexdigest(),
  }
  assert {p["id"] for p in DATA["paving"]} == {
    "5396406",
    "5748424",
    "26369804",
    "26369805",
  }
  assert len(SOURCE["parts"]) == 9
  assert len(SOURCE["surfaces"]) == 190
  assert (ROOT / "src/app/src/data/westSquaresV188Detail.json").stat().st_size < 160_000


def test_roof_collar_keeps_exact_source_footprint_and_labels_heights() -> None:
  part = next(p for p in SOURCE["parts"] if p["name"] == "KaDeWe")
  footprint = Polygon(part["rings"][0])
  triangles = []
  for row in DATA["roofCollar"]:
    triangle = Polygon([(x, z) for x, _, z in row["points"]])
    assert footprint.buffer(0.003).covers(triangle)
    assert all(35.70 <= p[1] <= 40.30 for p in row["points"])
    triangles.append(triangle)
  expected = footprint.difference(footprint.buffer(-8, join_style="mitre"))
  assert unary_union(triangles).symmetric_difference(expected).area < 0.3
  assert "not a new height survey" in DATA["estimateStatus"]


def test_tauentzien_skin_uses_only_retained_courses_and_widths() -> None:
  roads = [r for r in TAU["roads"] if r["id"] in DATA["roadIds"]]
  assert len(roads) == len(DATA["roadIds"])
  expected = unary_union(
    [
      shape(r["geometry"]).buffer(r["width"] / 2, cap_style="flat", join_style="mitre")
      for r in roads
    ]
  )
  actual = polygon_set(DATA["roads"][0]["polygons"])
  assert actual.symmetric_difference(expected).area < 1
  assert all(r["name"] == "Tauentzienstraße" for r in roads)


def test_native_floors_keep_paving_holes_and_bounded_axis_aligned_cells() -> None:
  areas = [*DATA["paving"], *DATA["roads"]]
  by_color = {
    color: unary_union(
      [polygon_set(p["polygons"]) for p in areas if p["color"] == color]
    )
    for color in {p["color"] for p in areas}
  }
  assert 2000 < len(DATA["nativePaving"]) < 2500
  for x, _, z, width, height, depth, yaw, color in DATA["nativePaving"]:
    assert width == depth == 2.5 and height == 0.12 and yaw == 0
    cell = Polygon(
      [
        (x - width / 2, z - depth / 2),
        (x + width / 2, z - depth / 2),
        (x + width / 2, z + depth / 2),
        (x - width / 2, z + depth / 2),
      ]
    )
    assert by_color[color].buffer(0.003).covers(cell)


def test_cornices_are_thin_source_wall_members_without_new_mass() -> None:
  import math

  part = next(p for p in SOURCE["parts"] if p["name"] == "KaDeWe")
  assert len(DATA["facadeBands"]) == 174
  for band in DATA["facadeBands"]:
    surface = part["sourceSurfaces"][band["sourceWall"]]
    assert surface["kind"] == "WallSurface"
    a, b = surface["rings"][0][:2]
    length = math.hypot(b[0] - a[0], b[2] - a[2])
    x, y, z, width, height, depth, *_ = band["row"]
    assert abs(width - (length - 0.04)) < 0.001
    assert math.hypot(x - (a[0] + b[0]) / 2, z - (a[2] + b[2]) / 2) < 0.326
    assert y - height / 2 > part["groundY"]
    assert y + height / 2 < part["topY"]
    assert depth <= 0.65
