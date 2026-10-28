"""Independent source topology and animal-route placement regressions."""

import gzip
import json
import math
import xml.etree.ElementTree as ET
from copy import deepcopy
from pathlib import Path

import pytest
from pyproj import Transformer
from shapely.geometry import GeometryCollection, LineString, MultiPolygon, Polygon, box
from shapely.ops import unary_union

from scripts import build_zoo_animals_v282 as build


def assert_body_clearance(route: list, radius: float, allowed: Polygon) -> None:
  """Check occupied body polygons along every edge, independently of route search."""
  assert len(route) == 4 and len({tuple(p) for p in route}) == 4
  for start, end in zip(route, route[1:] + route[:1], strict=True):
    assert (start[0] == end[0]) != (start[1] == end[1])
    steps = max(1, math.ceil(math.dist(start, end) * 4))
    for step in range(steps + 1):
      t = step / steps
      x, z = [a + (b - a) * t for a, b in zip(start, end, strict=True)]
      corners = [
        (x + dx * radius, z + dz * radius)
        for dx, dz in ((-1, -1), (1, -1), (1, 1), (-1, 1))
      ]
      assert allowed.covers(Polygon(corners)), (start, end, t)


def test_routes_avoid_source_holes_and_disconnected_components() -> None:
  enclosure = Polygon(
    [(0, 0), (60, 0), (60, 40), (0, 40)],
    [[(17, 5), (43, 5), (43, 35), (17, 35)]],
  )
  source = MultiPolygon([enclosure, box(80, 0, 83, 3)])
  route = build.rectangle_route(source, 1.5)
  assert route is not None
  assert_body_clearance(route, 1.89, source)
  assert build.rectangle_route(source, 1.5) == route
  assert enclosure.covers(LineString(route + route[:1]))
  assert len(build.serial_polygon(enclosure)["holesXZ"]) == 1


@pytest.mark.parametrize(
  "allowed",
  [
    Polygon(),
    box(0, 0, 40, 2),
    MultiPolygon([box(0, 0, 3, 3), box(40, 0, 43, 3)]),
    box(0, 0, 20, 20).difference(box(1.5, 1.5, 18.5, 18.5)),
  ],
)
def test_routes_reject_areas_that_only_fit_a_point_or_bbox(allowed: Polygon) -> None:
  assert build.rectangle_route(allowed, 1.1) is None


def test_validity_repair_preserves_holes_and_components_not_envelope() -> None:
  courtyard = Polygon(box(0, 0, 10, 10).exterior, [box(3, 3, 7, 7).exterior])
  island = box(20, 0, 24, 4)
  source = GeometryCollection([courtyard, island, LineString([(40, 0), (50, 0)])])
  repaired = build.valid_polygon(source)
  assert repaired.equals(unary_union([courtyard, island]))
  assert repaired.area == 100
  assert len(build.polygons(repaired)) == 2
  assert repaired.disjoint(box(4, 4, 6, 6))
  assert repaired.disjoint(box(12, 1, 18, 3))


def test_osm_relations_keep_all_outer_rings_holes_and_complete_members(
  tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
  document = ET.Element("osm")
  inverse = Transformer.from_crs(25833, 4326, always_xy=True)
  next_node = 1

  def add_way(ident: str, coords: list, tags: dict | None = None) -> None:
    nonlocal next_node
    way = ET.SubElement(document, "way", id=ident)
    refs = []
    for x, z in coords[:-1] if coords[0] == coords[-1] else coords:
      lon, lat = inverse.transform(x + 389500, 5820000 - z)
      ref = str(next_node)
      next_node += 1
      refs.append(ref)
      ET.SubElement(document, "node", id=ref, lat=str(lat), lon=str(lon))
    if coords[0] == coords[-1]:
      refs.append(refs[0])
    for ref in refs:
      ET.SubElement(way, "nd", ref=ref)
    for key, value in (tags or {}).items():
      ET.SubElement(way, "tag", k=key, v=value)

  add_way("1", list(box(0, 0, 30, 30).exterior.coords))
  add_way("2", list(box(8, 8, 22, 22).exterior.coords))
  add_way("3", list(box(50, 0, 70, 20).exterior.coords))
  add_way("4", [(0, -10), (30, -10)], {"highway": "footway", "width": "4"})
  for ident, members in (
    ("100", [("1", "outer"), ("2", "inner"), ("3", "outer")]),
    ("101", [("1", "outer"), ("999", "inner")]),
  ):
    relation = ET.SubElement(document, "relation", id=ident)
    ET.SubElement(relation, "tag", k="type", v="multipolygon")
    for ref, role in members:
      ET.SubElement(relation, "member", type="way", ref=ref, role=role)
  source = tmp_path / "zoo.osm"
  ET.ElementTree(document).write(source)
  monkeypatch.setattr(build, "WEST", source)
  features, paths = build.west_features()
  relation = features["relation/100"][0]
  expected = unary_union(
    [box(0, 0, 30, 30).difference(box(8, 8, 22, 22)), box(50, 0, 70, 20)]
  )
  assert relation.symmetric_difference(expected).area < 0.001
  assert len(build.polygons(relation)) == 2
  assert "relation/101" not in features
  assert paths.bounds == pytest.approx((-2.3, -12.3, 32.3, -7.7), abs=0.0001)


@pytest.fixture
def synthetic_sources(monkeypatch: pytest.MonkeyPatch) -> dict:
  land = Polygon(box(0, 0, 80, 50).exterior, [box(27, 15, 44, 35).exterior])
  water = box(100, 0, 150, 50)
  wire_tags = {
    "building": "yes",
    "building:material": "wire_fence",
    "roof:material": "wire_fence",
  }
  features = {
    "way/land": (land, {"name": "Land enclosure"}),
    "way/pool": (water, {"natural": "water", "name": "Pool"}),
    "way/building": (box(0, 0, 18, 50), {"building": "yes"}),
    "way/pond": (box(45, 0, 80, 18), {"natural": "water"}),
    "way/wire": (box(170, 0, 200, 30), wire_tags),
    "way/solid": (box(220, 0, 250, 30), {"building": "yes"}),
    "way/roofed": (
      box(270, 0, 300, 30),
      {**wire_tags, "roof:material": "concrete"},
    ),
  }
  paths = unary_union([box(18, 0, 22, 50), box(120, 0, 124, 50)])
  monkeypatch.setattr(build, "west_features", lambda: (features, paths))
  monkeypatch.setattr(build, "east_features", lambda: ({}, Polygon()))
  monkeypatch.setattr(build, "retained", lambda *_: [])
  monkeypatch.setattr(
    build,
    "PLANS",
    [
      ("zoo", "way/land", "lion", "african", 2, 1.8, 0.48),
      ("zoo", "way/pool", "seal", "california-sea-lion", 2, 1.9, 0.65),
      ("zoo", "way/wire", "ibis", "ibis", 2, 1.0, 0.28),
      ("zoo", "way/solid", "ibis", "ibis", 2, 1.0, 0.28),
      ("zoo", "way/roofed", "ibis", "ibis", 2, 1.0, 0.28),
    ],
  )
  return {"features": features, "paths": paths, "land": land, "water": water}


def test_generation_respects_body_clearance_surfaces_and_solid_roofs(
  synthetic_sources: dict,
) -> None:
  data = build.build()
  assert data == build.build()
  assert {a["sourceId"] for a in data["animals"]} == {
    "way/land",
    "way/pool",
    "way/wire",
  }
  assert {r["sourceId"] for r in data["unresolved"] if "sourceId" in r} == {
    "way/solid",
    "way/roofed",
  }
  habitats = {h["id"]: h for h in data["habitats"]}
  assert len(habitats["zoo-way-land"]["holesXZ"]) == 1
  assert habitats["zoo-way-wire"]["enclosureType"] == "wire-aviary"
  sources = synthetic_sources
  for animal in data["animals"]:
    original = sources["features"][animal["sourceId"]][0]
    forbidden = sources["paths"]
    if animal["sourceId"] == "way/land":
      forbidden = unary_union(
        [
          forbidden,
          sources["features"]["way/building"][0].buffer(0.15),
          sources["features"]["way/pond"][0],
        ]
      )
    allowed = original.difference(forbidden)
    assert_body_clearance(animal["routeXZ"], animal["bodyRadius"] + 0.39, allowed)
    assert animal["groundY"] == 5.32
    assert 0 <= animal["phase"] < 1
    assert animal["speed"] > 0
  assert len({a["id"] for a in data["animals"]}) == len(data["animals"])


def test_missing_source_fails_instead_of_guessing_placement(
  synthetic_sources: dict,
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  monkeypatch.setattr(
    build, "PLANS", [("zoo", "way/missing", "lion", "african", 2, 1.8, 0.48)]
  )
  with pytest.raises(AssertionError, match="Missing retained source zoo way/missing"):
    build.build()


@pytest.fixture
def verified_route() -> tuple[dict, dict]:
  source = box(0, 0, 40, 40)
  animal = {
    "id": "test-lion",
    "habitatId": "test-habitat",
    "siteId": "zoo",
    "sourceId": "way/1",
    "routeXZ": [[10, 10], [30, 10], [30, 30], [10, 30]],
    "bodyRadius": 1.5,
    "groundY": 5.32,
  }
  habitat = {
    "id": "test-habitat",
    "routeSurface": "land",
    "ringXZ": list(source.exterior.coords),
    "holesXZ": [],
  }
  evidence = {
    "zoo": {
      "features": {"way/1": (source, {})},
      "paths": Polygon(),
      "buildings": Polygon(),
      "waters": Polygon(),
    }
  }
  return {"animals": [animal], "retainedRoutes": [], "habitats": [habitat]}, evidence


@pytest.mark.parametrize("obstacle", ["paths", "buildings", "waters"])
def test_verifier_rejects_body_collisions_even_when_route_center_is_clear(
  verified_route: tuple,
  obstacle: str,
) -> None:
  data, evidence = verified_route
  build.verify(data, evidence)
  # Below the southern edge, clear of the centre path and every corner point.
  evidence["zoo"][obstacle] = box(18, 8.8, 22, 9.4)
  line = LineString(data["animals"][0]["routeXZ"] + [[10, 10]])
  assert line.disjoint(evidence["zoo"][obstacle])
  with pytest.raises(AssertionError):
    build.verify(data, evidence)


@pytest.mark.parametrize(
  "failure", ["source-hole", "serial-hole", "shore", "height", "diagonal"]
)
def test_verifier_rejects_wrong_topology_surface_height_and_heading(
  verified_route: tuple,
  failure: str,
) -> None:
  data, evidence = verified_route
  animal, habitat = data["animals"][0], data["habitats"][0]
  if failure == "source-hole":
    source, tags = evidence["zoo"]["features"]["way/1"]
    evidence["zoo"]["features"]["way/1"] = (
      source.difference(box(18, 8.8, 22, 9.4)),
      tags,
    )
  elif failure == "serial-hole":
    habitat["holesXZ"] = [list(box(18, 8.8, 22, 9.4).exterior.coords)]
  elif failure == "shore":
    habitat["routeSurface"] = "water"
    evidence["zoo"]["waters"] = box(9, 9, 31, 31)
  elif failure == "height":
    animal["groundY"] = 20
  else:
    animal["routeXZ"][1][1] += 1
  with pytest.raises(AssertionError):
    build.verify(data, evidence)


def test_retained_routes_preserve_owner_ids_without_new_duplicate_animals(
  tmp_path: Path,
  monkeypatch: pytest.MonkeyPatch,
) -> None:
  records = [
    {"kind": "animal", "species": species, "sourceId": owner}
    for species, owner, count in (("wood-bison", "way/1", 7), ("flamingo", "way/2", 28))
    for _ in range(count)
  ]
  path = tmp_path / "geo_data/regierungsviertel/tierpark-v276-evidence.json.gz"
  path.parent.mkdir(parents=True)
  path.write_bytes(
    gzip.compress(
      json.dumps(
        {
          "records": [
            {"key": "drawn:outer187-20_4", "records": records},
            {"key": "minecraft:outer187-20_4", "records": deepcopy(records)},
          ]
        }
      ).encode()
    )
  )
  monkeypatch.setattr(build, "ROOT", tmp_path)
  dry, wet, wolf = box(0, 0, 100, 100), box(110, 0, 210, 100), box(250, 0, 350, 100)
  evidence = {
    "tierpark": {
      "features": {"way/1": (dry, {}), "way/2": (wet, {})},
      "paths": Polygon(),
      "buildings": Polygon(),
      "waters": wet,
    },
    "zoo": {
      "features": {"way/48164524": (wolf, {})},
      "paths": Polygon(),
      "buildings": Polygon(),
      "waters": Polygon(),
    },
  }
  habitats, skipped = [], []
  routes = build.retained(evidence, habitats, skipped)
  expected = {
    f"{site}-v276-{species}-{index}"
    for site, species, count in (
      ("tierpark", "wood-bison", 7),
      ("tierpark", "flamingo", 28),
      ("zoo", "wolf", 3),
    )
    for index in range(count)
  }
  assert {r["id"] for r in routes} == expected
  assert len(routes) == len(expected) == 38
  assert not skipped
  build.verify(
    {"animals": [], "retainedRoutes": routes, "habitats": habitats}, evidence
  )
  for route in routes:
    original = evidence[route["siteId"]]["features"][route["sourceId"]][0]
    assert_body_clearance(route["routeXZ"], route["bodyRadius"] + 0.39, original)
    peers = [r for r in routes if r["species"] == route["species"]]
    assert len({r["phase"] for r in peers}) == len(peers)


def test_chicken_has_visible_measured_aviary_and_clears_retained_native_corner() -> (
  None
):
  data = json.loads(build.OUTPUT.read_bytes())
  chicken = [a for a in data["animals"] if a["species"] == "chicken"]
  assert len(chicken) == 1
  animal = chicken[0]
  assert animal["sourceId"] == build.CHICKEN_SOURCE
  assert animal["bodyRadius"] == 0.4
  assert animal["variant"] == "domestic"
  features, paths = build.west_features()
  original, tags = features[build.CHICKEN_SOURCE]
  assert build.is_wire_aviary(tags)
  solid_house = features["way/17957388"][0].buffer(0.15)
  water = unary_union([g for g, t in features.values() if t.get("natural") == "water"])
  allowed = original.difference(
    unary_union(
      [
        paths,
        solid_house,
        water,
        build.additional_obstacles(build.CHICKEN_SOURCE),
      ]
    )
  )
  assert_body_clearance(animal["routeXZ"], 0.8, allowed)
  assert build.rectangle_route(allowed, 0.4) is None
  assert build.rectangle_route(allowed, 0.4, compact=True) == animal["routeXZ"]
  # Negative control: the old unguarded route crossed the retained native cell.
  unguarded = [
    [-2420.498, 1200.716],
    [-2419.098, 1200.716],
    [-2419.098, 1201.716],
    [-2420.498, 1201.716],
  ]
  with pytest.raises(AssertionError):
    assert_body_clearance(unguarded, 0.8, allowed)
  assert not any(u["species"] == "chicken" for u in data["unresolved"])
