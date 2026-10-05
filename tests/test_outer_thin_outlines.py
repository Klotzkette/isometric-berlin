"""Thin v179 geometry remains source-bound, complete, and deliberately bounded."""

import importlib.util
import json
from pathlib import Path

from shapely.geometry import LineString, Point, shape

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
  "outer", ROOT / "scripts/build_outer_thin_outlines.py"
)
assert SPEC and SPEC.loader
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)
SOURCE = json.loads(
  (ROOT / "geo_data/regierungsviertel/outer-thin-outlines-v179.json").read_text()
)
PAYLOAD = json.loads((ROOT / "src/app/src/data/outerThinOutlines.json").read_text())


def test_baked_overlay_is_reproducible_and_small() -> None:
  payload, scope = builder.build(SOURCE)
  assert payload == PAYLOAD
  assert len(payload["positions"]) % 6 == 0
  assert len(payload["positions"]) * 4 < 200_000
  assert json.loads(
    (ROOT / "geo_data/regierungsviertel/bounds-outline-v179.geojson").read_text()
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
    assert output["vertexCount"] == 2 * (len(source["coordinates"]) - 1)
  ring = next(f for f in SOURCE["lines"] if f["name"] == "Ringbahn S41")
  assert LineString(ring["coordinates"]).is_ring


def test_approved_outline_scope_contains_all_mapped_footprints() -> None:
  scope = json.loads(
    (ROOT / "geo_data/regierungsviertel/bounds-outline-v179.geojson").read_text()
  )
  area = shape(scope["features"][0]["geometry"])
  assert area.is_valid
  for feature in SOURCE["footprints"]:
    for ring in feature["rings"]:
      for lon, lat in ring:
        assert area.covers(Point(lon, lat)), feature["name"]
