"""Independent geometry checks for complete families and bounded additions."""

import base64
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pytest
import shapely
from shapely.errors import GEOSException
from shapely.geometry import GeometryCollection, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import build_alt_mitte_v169 as generator  # noqa: E402
from alt_mitte_v169_packets import pack_detail  # noqa: E402
from build_alt_mitte_v169 import (  # noqa: E402
  facade,
  footprint,
  materials,
  model,
  native_roofs,
)
from build_karl_marx_allee_v161 import native_detail  # noqa: E402
from build_surrounding_outlines import (  # noqa: E402
  POSITION_ORIGIN_Y,
  load_projected_polygon,
)


def fixture_family() -> dict:
  """A sloping courtyard roof plus a detached second part, without old prisms."""
  exterior = [[0, 0], [18, 0], [18, 18], [0, 18]]
  courtyard = [[6, 6], [6, 12], [12, 12], [12, 6]]

  def plane(ring):
    return [[x, 12 + x / 4, z] for x, z in ring]

  return {
    "id": "official-family-without-legacy-prism",
    "sourceType": "official-lod2",
    "category": "core",
    "legacyPrisms": [],
    "osmTags": {"building:material": "brick", "roof:colour": "#708090"},
    "footprintPolygons": [
      {"ring": exterior, "holes": [courtyard]},
      {"ring": [[24, 0], [28, 0], [28, 4], [24, 4]], "holes": []},
    ],
    "parts": [
      {
        "id": "courtyard-part",
        "groundY": 3,
        "topY": 16.5,
        "footprintPolygons": [{"ring": exterior, "holes": [courtyard]}],
        "surfaces": [
          {"kind": "RoofSurface", "rings": [plane(exterior), plane(courtyard)]}
        ],
      },
      {
        "id": "detached-part",
        "groundY": 5,
        "topY": 9,
        "footprintPolygons": [
          {"ring": [[24, 0], [28, 0], [28, 4], [24, 4]], "holes": []}
        ],
        "surfaces": [
          {
            "kind": "RoofSurface",
            "rings": [[[24, 9, 0], [28, 9, 0], [28, 9, 4], [24, 9, 4]]],
          }
        ],
      },
    ],
  }


def test_complete_family_without_legacy_prism_preserves_roof_hole_and_all_parts():
  record = fixture_family()
  shells, fronts, nav, roofs = model(record, GeometryCollection())
  assert len(shells.triangles) == len(roofs)
  assert fronts.triangles == []
  assert {n["id"] for n in nav} == {"courtyard-part", "detached-part"}
  assert nav[0]["holes"] == record["parts"][0]["footprintPolygons"][0]["holes"]
  assert nav[1]["groundY"] == 5 and nav[1]["topY"] == 9
  rendered = unary_union([Polygon([(x, z) for x, _, z in t]) for t in roofs])
  expected = Polygon(
    record["footprintPolygons"][0]["ring"], record["footprintPolygons"][0]["holes"]
  ).union(box(24, 0, 28, 4))
  assert rendered.symmetric_difference(expected).area < 1e-9
  assert rendered.intersection(box(6, 6, 12, 12)).area == 0
  assert sum(Polygon([(x, z) for x, _, z in t]).area for t in roofs) == pytest.approx(
    expected.area
  )
  assert all(
    y == pytest.approx(12 + x / 4) for t in roofs if t[0][0] < 20 for x, y, _ in t
  )
  assert all(color == (112, 128, 144) for _, color, _ in shells.triangles)


def test_spatial_packet_clipping_preserves_sloping_roof_without_courtyard_fill():
  shells, _, _, _ = model(fixture_family(), GeometryCollection())
  bounds = (8, 0, 16, 18)
  meshes = pack_detail(shells, bounds, max_vertices=12, max_indices=18)
  projected = []
  for mesh in meshes:
    positions = (
      np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(-1, 3)
      / 100
    )
    positions += np.array([bounds[0], POSITION_ORIGIN_Y, bounds[1]])
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
      -1, 3
    )
    for tri in positions[indices]:
      projected.append(Polygon([(x, z) for x, _, z in tri]))
      assert all(abs(y - (12 + x / 4)) <= 0.006 for x, y, _ in tri)
  expected = footprint(fixture_family()).intersection(box(*bounds))
  assert unary_union(projected).symmetric_difference(expected).area < 0.02
  assert unary_union(projected).intersection(box(8, 6, 12, 12)).area == 0


def test_facade_rectangles_fit_real_gable_plane_and_do_not_cover_opening():
  wall = [[0, 3, 0], [18, 3, 0], [18, 10, 0], [9, 16, 0], [0, 10, 0]]
  opening = [[6, 4, 0], [6, 10, 0], [12, 10, 0], [12, 4, 0]]
  detail = facade([wall, opening], 3, 16, GeometryCollection())
  assert len(detail.triangles) > 0
  allowed = Polygon([(p[0], p[1]) for p in wall], [[(p[0], p[1]) for p in opening]])
  for triangle, _, _ in detail.triangles:
    assert allowed.covers(Polygon([(x, y) for x, y, _ in triangle]))
    assert len({round(z, 5) for _, _, z in triangle}) == 1
    assert 0.05 <= abs(triangle[0][2]) <= 0.13
  party_wall = box(-1, 0.1, 19, 4)
  assert facade([wall, opening], 3, 16, party_wall).triangles == []


def test_material_tags_are_preserved_without_inventing_unknown_colours():
  assert materials({"osmTags": {"building:colour": "#abc", "roof:material": "copper"}})[
    :2
  ] == ((170, 187, 204), (113, 154, 139))
  assert (
    materials({"osmTags": {"building:colour": "unverified", "roof:colour": "#ZZZZZZ"}})[
      2
    ]
    == "neutral display estimate"
  )


def test_each_source_part_inherits_its_own_existing_colour_before_generic_defaults(
  monkeypatch,
):
  monkeypatch.setattr(
    generator,
    "APPEARANCE",
    {
      "courtyard-part": {
        "facade": {"srgb8": [180, 111, 91]},
        "roof": {"srgb8": [95, 146, 121]},
      },
      "detached-part": {
        "facade": {"srgb8": [230, 208, 140]},
        "roof": {"srgb8": [174, 162, 155]},
      },
    },
  )
  shells, _, _, _ = model(fixture_family(), GeometryCollection())
  assert {
    tuple(color) for points, color, _ in shells.triangles if points[0][0] < 20
  } == {(95, 146, 121)}
  assert {
    tuple(color) for points, color, _ in shells.triangles if points[0][0] >= 20
  } == {(174, 162, 155)}


def test_osm_fallback_adds_each_courtyard_front_without_replacing_original_body():
  exterior = [[0, 0], [30, 0], [30, 30], [0, 30]]
  hole = [[8, 8], [8, 22], [22, 22], [22, 8]]
  record = {
    "id": "OSM-relation-courtyard",
    "sourceType": "osm-context",
    "parts": [],
    "footprintPolygons": [{"ring": exterior, "holes": [hole]}],
    "legacyPrisms": [
      {
        "id": "courtyard",
        "ring": [[x * 10, z * 10] for x, z in exterior],
        "holes": [[[x * 10, z * 10] for x, z in hole]],
        "y0_dm": 30,
        "h_dm": 150,
      }
    ],
  }
  shell, fronts, nav, roofs = model(record, footprint(record))
  assert shell.triangles == [] and nav == [] and roofs == []
  sides = set()
  for points, _, role in fronts.triangles:
    if role != "window glazing":
      continue
    x, _, z = np.mean(points, axis=0)
    if 8 < x < 22 and 8 < z < 22:
      if x < 8.2:
        sides.add("west")
      if x > 21.8:
        sides.add("east")
      if z < 8.2:
        sides.add("north")
      if z > 21.8:
        sides.add("south")
  assert sides == {"west", "east", "north", "south"}


@pytest.mark.parametrize("vertical", [False, True])
def test_independent_triangulation_fallback_keeps_concavity_holes_and_source_vertices(
  monkeypatch, vertical
):
  outer = [[0, 0], [20, 0], [20, 14], [14, 14], [14, 8], [8, 8], [8, 16], [0, 16]]
  holes = [[[2, 2], [2, 5], [5, 5], [5, 2]], [[15, 2], [15, 6], [18, 6], [18, 2]]]
  expected = Polygon(outer, holes)

  def vertex(u, v):
    return [u, 3 + v, 5 + u / 5] if vertical else [u, 20 + u / 8 + v / 4, v]

  rings = [[vertex(u, v) for u, v in ring] for ring in [outer, *holes]]

  def reject_geos(_):
    raise GEOSException("Unable to find a convex corner")

  monkeypatch.setattr(generator.shapely, "constrained_delaunay_triangles", reject_geos)
  triangles = generator.triangulate(rings)
  supplied = {tuple(p) for ring in rings for p in ring}
  assert triangles and all(tuple(p) in supplied for tri in triangles for p in tri)
  projections = [
    Polygon([(x, y - 3 if vertical else z) for x, y, z in tri]) for tri in triangles
  ]
  assert unary_union(projections).symmetric_difference(expected).area < 1e-9
  # Union alone would conceal overlapping triangles; the sum must match as well.
  assert sum(p.area for p in projections) == pytest.approx(expected.area)
  normal = generator.normal_of(rings[0])
  for a, b, c in np.asarray(triangles):
    assert np.dot(np.cross(b - a, c - a), normal) > 0


def test_native_surface_blocks_keep_wide_courtyard_and_orthogonal_faces():
  shells, _, _, _ = model(fixture_family(), GeometryCollection())
  native = native_detail(shells)
  assert native.triangles
  for points, _, _ in native.triangles:
    a, b, c = np.asarray(points)
    normal = np.cross(b - a, c - a)
    assert np.count_nonzero(np.abs(normal) > 1e-7) == 1
  cells = native_roofs(native)
  assert cells
  # Two-metre blocks can touch the courtyard edge, but cannot fill its centre.
  assert (9, 9) not in cells and (10, 10) not in cells
  assert any(x < 5 for x, _ in cells)
  assert any(x >= 24 for x, _ in cells)


def test_invalid_source_ring_keeps_both_lobes_and_interpolates_on_original_plane():
  ring = [[x, 11 + x / 5 + z / 3, z] for x, z in [[0, 0], [6, 6], [0, 6], [4, 0]]]
  original = Polygon([(x, z) for x, _, z in ring])
  assert not original.is_valid
  triangles = generator.triangulate([ring])
  expected = shapely.make_valid(original)
  projected = [Polygon([(x, z) for x, _, z in t]) for t in triangles]
  assert unary_union(projected).symmetric_difference(expected).area < 1e-9
  assert sum(p.area for p in projected) == pytest.approx(expected.area)
  assert all(y == pytest.approx(11 + x / 5 + z / 3) for t in triangles for x, y, z in t)
  new = {tuple(p) for t in triangles for p in t} - {tuple(p) for p in ring}
  assert len(new) == 1
  assert next(iter(new)) == pytest.approx((2.4, 12.28, 2.4))


def test_frozen_boundary_is_explicit_conservative_scope_inside_existing_bounds():
  path = ROOT / "geo_data/regierungsviertel/alt-mitte-v169-boundary.geojson"
  data = json.loads(path.read_bytes())
  audit = json.loads((path.parent / "alt-mitte-v169-boundary-audit.json").read_bytes())
  geom = shape(data["features"][0]["geometry"])
  assert geom.is_valid and geom.geom_type == "MultiPolygon"
  assert data["crs"]["properties"]["name"].endswith("25833")
  assert data["source"]["status"] == "frozen_conservative_pre2001_building_selection"
  delta = data["source"]["historical_scope"]["post2001_changes"][0]
  assert delta["direction"] == "added_to_mitte" and delta["area_m2"] == 310
  assert delta["effective_date"] == "2008-09-28"
  assert delta["source_pages"] == [3, 7]
  assert (
    audit["boundary"]["fileSha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
  )
  assert (
    audit["boundary"]["geometryWkbSha256"]
    == hashlib.sha256(unary_union([geom]).wkb).hexdigest()
  )
  release = load_projected_polygon(path.parent / "bounds.geojson")
  assert geom.difference(release).area == 0
  assert geom.area == pytest.approx(audit["boundary"]["areaM2"], abs=0.001)


def test_real_ground_surface_controls_navigation_and_windows_above_deep_closure():
  """A source closure skirt must neither move the ground nor erase its evidence."""
  source_path = (
    ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-390_5819-00.json.gz"
  )
  buildings = json.loads(gzip.decompress(source_path.read_bytes()))["buildings"]
  family = next(b for b in buildings if b["id"] == "DEBE01YYK00002R5")
  part = next(p for p in family["parts"] if p["id"] == "DEBE3Dy2xBqvh1Ba")
  original = json.dumps(part, sort_keys=True)
  ground_y = {
    p[1]
    for surface in part["surfaces"]
    if surface["kind"] == "GroundSurface"
    for ring in surface["rings"]
    for p in ring
  }
  closure_min = min(
    p[1]
    for surface in part["surfaces"]
    if surface["kind"] == "ClosureSurface"
    for ring in surface["rings"]
    for p in ring
  )
  assert ground_y == {5.2}
  assert part["groundY"] == closure_min == -52.228

  shells, fronts, nav, _ = model({**family, "parts": [part]}, GeometryCollection())
  assert len(nav) == 1 and nav[0]["groundY"] == 5.2
  assert nav[0]["topY"] == part["topY"]
  assert min(p[1] for triangle, _, _ in shells.triangles for p in triangle) == -52.228
  assert any(
    role == "source ClosureSurface" and min(p[1] for p in points) < 0
    for points, _, role in shells.triangles
  )
  glazing = [
    p[1]
    for points, _, role in fronts.triangles
    if role == "window glazing"
    for p in points
  ]
  assert glazing
  # First glazing row is centered 2.25m above the actual ground. Using the
  # closure minimum instead changes the floor phase to the wall's lower inset.
  assert min(glazing) == pytest.approx(5.2 + 2.25 - 1.79 / 2)
  assert json.dumps(part, sort_keys=True) == original
