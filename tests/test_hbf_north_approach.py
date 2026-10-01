"""Keep northern rail openings source-bound without discarding surrounding land."""

from __future__ import annotations

import base64
import json
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def load(name: str) -> dict:
  return json.loads((DATA / name).read_text())


def shape(record: dict, divisor: float = 1) -> Polygon:
  return Polygon(
    [(x / divisor, z / divisor) for x, z in record["ring"]],
    [[(x / divisor, z / divisor) for x, z in h] for h in record.get("holes", [])],
  )


def test_exact_terrain_complement_preserves_every_square_metre_outside_cut() -> None:
  source = load("hbfNorthApproachSources.json")
  boundary = load("hbfNorthRailTerrainBoundary.json")
  cells = np.frombuffer(base64.b64decode(boundary["cells_u32"]), dtype="<u4").reshape(
    -1, 6
  )
  triangles = np.frombuffer(
    base64.b64decode(boundary["triangles_f32"]), dtype="<f4"
  ).reshape(-1, 2)
  area = sum(Polygon(p).area for p in triangles.reshape(-1, 3, 2))
  assert len(cells) == boundary["affected_cells"]
  assert area == pytest.approx(boundary["preserved_land_area_m2"], abs=0.015)
  assert boundary["removed_cut_area_m2"] + boundary[
    "preserved_land_area_m2"
  ] == pytest.approx(len(cells) * 16, abs=0.0001)
  cut = unary_union([shape(p) for p in source["cut"]])
  for tri in triangles.reshape(-1, 3, 2):
    assert Polygon(tri).intersection(cut).area < 0.0002


def test_clipped_park_retains_exact_original_surface_outside_rail_cut() -> None:
  source = load("hbfNorthApproachSources.json")
  original = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json").read_text()
  )
  cut = unary_union([shape(p) for p in source["cut"]])
  assert len(source["park_surface_replacements"]) == 1
  for replacement in source["park_surface_replacements"]:
    old = next(p for p in original["parks"] if p["ring"] == replacement["source_ring"])
    retained = unary_union([shape(p, 10) for p in replacement["polygons"]])
    assert retained.symmetric_difference(shape(old, 10).difference(cut)).area < 0.01
    assert all(p["kind"] == old["kind"] for p in replacement["polygons"])


def test_old_rail_payload_retains_every_path_and_ballast_piece_outside_cut() -> None:
  source = load("hbfNorthApproachSources.json")
  original = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/rail-lines.json").read_text()
  )
  cut = unary_union([shape(p) for p in source["cut"]])
  for index, replacement in source["rail_surface_replacements"].items():
    retained = unary_union([shape(p, 10) for p in replacement])
    expected = shape(original["embankment"][int(index)], 10).difference(cut)
    assert retained.symmetric_difference(expected).area < 0.015
  for index, replacement in source["rail_track_replacements"].items():
    retained = unary_union(
      [LineString([(x / 10, z / 10) for x, z in p]) for p in replacement]
    )
    expected = LineString(
      [(x / 10, z / 10) for x, z in original["embankment_tracks"][int(index)]]
    ).difference(cut)
    assert retained.length == pytest.approx(expected.length, abs=0.001)


def test_osm_west_wall_and_distinct_s21_wall_remain_exact() -> None:
  source = load("hbfNorthApproachSources.json")
  west = LineString(source["retaining_walls"][0]["points"])
  main = shape(source["cuts"][0])
  for i in range(1, 100):
    assert west.interpolate(i / 100, normalized=True).distance(main.boundary) < 0.002
  assert source["park"]["id"] == 185633562
  assert len(source["paths"]) == 8
  assert len({b["id"] for b in source["benches"]}) == 12


def test_portal_roof_seams_cannot_retain_extruded_grass_islands() -> None:
  source = load("hbfNorthApproachSources.json")
  for record, center, outward, width in [
    (
      source["cuts"][0],
      source["profile"]["origin"],
      source["profile"]["outward"],
      25.4,
    ),
    (source["cuts"][1], [-283.156, -1159.452], [-0.596, -0.803], 11.2),
  ]:
    cx, cz = center
    dx, dz = outward
    roof = Polygon(
      [
        (cx + dx * s - dz * u, cz + dz * s + dx * u)
        for s, u in [
          (-11.5, -width / 2),
          (-11.5, width / 2),
          (0.5, width / 2),
          (0.5, -width / 2),
        ]
      ]
    )
    cut = shape(record)
    assert len(cut.interiors) == 0
    # Four-decimal export coordinates introduce only submillimetre edge noise.
    assert roof.difference(cut).area < 0.002


def test_floor_partitions_preserve_the_plan_and_respect_each_grade_break() -> None:
  source = load("hbfNorthApproachSources.json")
  for i, center, outward, length in [
    (0, source["profile"]["origin"], source["profile"]["outward"], 340),
    (1, [-283.156, -1159.452], [-0.596, -0.803], 241),
  ]:
    sections = source["floor_sections"][i]
    whole = unary_union([shape(p) for p in sections])
    assert whole.symmetric_difference(shape(source["cuts"][i])).area < 0.002
    for section in sections:
      chainage = [
        (x - center[0]) * outward[0] + (z - center[1]) * outward[1]
        for x, z in section["ring"]
      ]
      for grade_break in [0, length]:
        assert not (
          min(chainage) < grade_break - 0.0002 and max(chainage) > grade_break + 0.0002
        )


def test_no_existing_park_details_or_native_tree_roots_float_in_cut() -> None:
  source = load("hbfNorthApproachSources.json")
  cut = unary_union([shape(p) for p in source["cut"]])
  from shapely.geometry import Point

  park = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/park-details.json").read_text()
  )
  for family in ["trees", "street_lights"]:
    assert not [
      p for p in park[family] if cut.contains(Point(p["position"][0], p["position"][2]))
    ]
  for patch in park["shrub_patches"]:
    assert not [p for p in patch["clusters"] if cut.contains(Point(p[0], p[2]))]
  for family in ["hedges", "paths"]:
    for feature in park[family]:
      if "points" in feature:
        g = LineString([(p[0], p[2]) for p in feature["points"]])
      else:
        g = Polygon([(p[0], p[2]) for p in feature["rings"][0]])
      assert g.intersection(cut).is_empty
  voxels = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json").read_text()
  )
  grid = voxels["grid"]
  for row, trees in enumerate(voxels["tree_rows"]):
    for x, _, _ in trees:
      point = Point(
        (grid["min_x_idx"] + x + 0.5) * 4, (grid["min_z_idx"] + row + 0.5) * 4
      )
      assert not cut.contains(point)
  drawn = unary_union([shape(p) for p in source["park_render_polygons"]])
  assert drawn.intersection(cut).area < 0.002
  # Independently rounded four-decimal rings differ by less than 30 cm².
  assert drawn.symmetric_difference(shape(source["park"]).difference(cut)).area < 0.003
