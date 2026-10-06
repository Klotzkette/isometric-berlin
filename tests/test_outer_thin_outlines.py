"""Outline supplements remain source-bound, additive and deliberately bounded."""

import importlib.util
import json
from collections import Counter
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
  "outer", ROOT / "scripts/build_outer_thin_outlines.py"
)
assert SPEC and SPEC.loader
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)
BASE_SOURCE = json.loads(
  (ROOT / "geo_data/regierungsviertel/outer-thin-outlines-v179.json").read_text()
)
SOURCE = builder.load_current_source()
PAYLOAD = json.loads((ROOT / "src/app/src/data/outerThinOutlines.json").read_text())


def test_baked_overlay_is_reproducible_and_small() -> None:
  payload, scope = builder.build(SOURCE, revision="v1.0.80")
  assert payload == PAYLOAD
  assert len(payload["positions"]) % 6 == 0
  assert len(payload["positions"]) * 4 < 1_000_000
  assert json.loads(
    (ROOT / "geo_data/regierungsviertel/bounds-outline-v180.geojson").read_text()
  ) == json.loads(json.dumps(scope))
  assert (
    json.loads((ROOT / "src/app/src/data/outerThinOutlineScope.json").read_text())[
      "bounds"
    ]
    == payload["bounds"]
  )


def test_requested_places_and_every_source_line_survive() -> None:
  names = {f["name"] for f in PAYLOAD["features"]}
  assert {
    "Stadtautobahn A100",
    "AVUS A115",
    "Schloßstraße",
    "Ringbahn S41",
    "Funkturm",
    "ICC",
    "Tempelhofer Feld",
    "Flughafen Tempelhof",
    "Steglitzer Kreisel",
    "Bahnhof Gesundbrunnen",
    "Bahnhof Südkreuz",
    "Bahnhof Westkreuz",
  } <= names
  for source, output in zip(SOURCE["lines"], PAYLOAD["features"]):
    assert source["osmIds"] == output["osmIds"]
    count = 2 * (len(source["coordinates"]) - 1)
    assert output["vertexCount"] >= count
    expected = []
    for a, b in zip(source["coordinates"], source["coordinates"][1:]):
      for point in (a, b):
        x, z = builder.world(point)
        expected.extend((x, builder.GROUND, z))
    first = output["firstVertex"] * 3
    assert PAYLOAD["positions"][first : first + len(expected)] == expected
  ring = next(f for f in SOURCE["lines"] if f["name"] == "Ringbahn S41")
  assert LineString(ring["coordinates"]).is_ring


def test_approved_outline_scope_contains_all_mapped_footprints() -> None:
  scope = json.loads(
    (ROOT / "geo_data/regierungsviertel/bounds-outline-v180.geojson").read_text()
  )
  area = shape(scope["features"][0]["geometry"])
  assert area.is_valid
  for feature in SOURCE["footprints"]:
    for ring in feature["rings"]:
      for lon, lat in ring:
        assert area.covers(Point(lon, lat)), feature["name"]


def test_previous_outline_segments_remain_byte_identical() -> None:
  baseline, _ = builder.build(BASE_SOURCE)

  def segments(positions: list[float]) -> Counter:
    return Counter(tuple(positions[i : i + 6]) for i in range(0, len(positions), 6))

  assert not (segments(baseline["positions"]) - segments(PAYLOAD["positions"]))


def test_each_ring_station_has_a_mapped_outline() -> None:
  stations = json.loads(
    (ROOT / "geo_data/regierungsviertel/ring-stations-v180.json").read_text()
  )
  assert len(stations["anchors"]) == 27
  station_names = {anchor["name"] for anchor in stations["anchors"]}
  assert len(station_names) == 27
  assert station_names <= {item["name"] for item in PAYLOAD["features"]}


def test_connectors_have_no_disconnected_fragments_or_duplicate_city_buildings() -> (
  None
):
  supplement = json.loads(
    (ROOT / "geo_data/regierungsviertel/outer-connectors-v180.json").read_text()
  )
  detailed = json.loads(
    (ROOT / "geo_data/regierungsviertel/bounds.geojson").read_text()
  )
  detailed_area = unary_union([shape(f["geometry"]) for f in detailed["features"]])
  for item in supplement["footprints"]:
    building = Polygon(item["rings"][0], item["rings"][1:])
    assert building.intersection(detailed_area).area < 1e-12
  for corridor in ("west", "south"):
    lines = [f for f in supplement["lines"] if f.get("corridor") == corridor]
    existing_ids = {
      osm_id
      for osm_id, values in supplement["existingLineOverrides"].items()
      if values.get("corridor") == corridor
    }
    lines.extend(
      f for f in BASE_SOURCE["lines"] if existing_ids.intersection(f["osmIds"])
    )
    graph: dict[tuple[float, ...], set] = {}
    for line in lines:
      points = [tuple(p) for p in line["coordinates"]]
      for a, b in zip(points, points[1:]):
        graph.setdefault(a, set()).add(b)
        graph.setdefault(b, set()).add(a)
    assert graph
    reached, pending = set(), [next(iter(graph))]
    while pending:
      point = pending.pop()
      if point in reached:
        continue
      reached.add(point)
      pending.extend(graph[point] - reached)
    assert len(reached) == len(graph), corridor
    assert any(detailed_area.contains(Point(point)) for point in reached)
