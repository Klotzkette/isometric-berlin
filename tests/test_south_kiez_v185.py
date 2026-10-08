"""Small southern overlay stays tied to delivered owners and open public space."""

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

from shapely.geometry import LineString, Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/south-kiez-v185-source.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/south-kiez-v185-evidence.json"
DRAWN = ROOT / "src/app/src/data/southKiezV185.json"
NATIVE = DRAWN.with_name("southKiezV185Native.json")


def test_south_kiez_reproducible_bounded_addition() -> None:
  sys.path.insert(0, str(ROOT / "scripts"))
  spec = importlib.util.spec_from_file_location(
    "south_kiez_v185", ROOT / "scripts/build_south_kiez_v185.py"
  )
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  source = json.loads(SOURCE.read_text())
  result = module.build(source)
  drawn = json.loads(DRAWN.read_text())
  assert result["boxes"] == drawn["boxes"]
  assert result["nativeRows"] == json.loads(NATIVE.read_text())["nativeRows"]
  # Serialization canonicalizes source coordinate tuples to JSON lists.
  assert (
    json.loads(json.dumps(result["evidence"]))
    == json.loads(EVIDENCE.read_text())["features"]
  )
  assert drawn["sourceSha256"] == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  assert len(drawn["boxes"]) == 2788
  assert len(result["nativeRows"]) == 10018
  assert DRAWN.stat().st_size < 175_000
  assert NATIVE.stat().st_size < 520_000


def test_south_kiez_has_exact_named_roads_and_retained_frontages() -> None:
  source = json.loads(SOURCE.read_text())
  features = json.loads(EVIDENCE.read_text())["features"]
  names = {r["name"] for r in source["roads"]}
  assert {"Richardplatz", "Schudomastraße", "Wiener Straße", "Forster Straße"} <= names
  scope = shape(source["scope"])
  owners = {b["sourceId"]: shape(b["geometry"]) for b in source["buildings"]}
  facades = [f for f in features if f["role"] == "source-frontage-profile"]
  assert len(facades) == len({f["sourceId"] for f in facades}) == 113
  for f in facades:
    line = LineString(f["wall"])
    assert scope.covers(line)
    assert line.difference(owners[f["sourceId"]].boundary.buffer(0.001)).is_empty
    assert f["boxCount"] == 3
    assert f["sourceHeight"] >= 8


def test_south_kiez_kerbs_keep_crossings_and_park_approaches_open() -> None:
  source = json.loads(SOURCE.read_text())
  evidence = json.loads(EVIDENCE.read_text())["features"]
  occupied = unary_union([shape(b["geometry"]) for b in source["buildings"]])
  for item in evidence[:2]:
    contours = shape(item["geometry"])
    assert contours.intersection(occupied).is_empty
  park = shape(source["park"]["geometry"])
  assert source["park"]["osmId"] == "way/15740772"
  assert shape(evidence[1]["geometry"]).difference(park.buffer(0.001)).is_empty
  benches = [f for f in evidence if f["role"] == "mapped-park-bench"]
  assert len(benches) == 39
  for bench in benches:
    assert park.covers(Point(bench["xz"]))
    assert 0 <= bench["direction"] <= 360
    assert bench["osmId"].startswith("node/")


def test_south_kiez_remains_inside_previous_city_coverage() -> None:
  sys.path.insert(0, str(ROOT / "scripts"))
  import build_surrounding_outlines as outlines

  prior = unary_union(
    [
      outlines.world(
        outlines.load_projected_polygon(ROOT / "geo_data/regierungsviertel" / name)
      )
      for name in (
        "bounds.geojson",
        "bounds-ring-v182.geojson",
        "bounds-city-v183.geojson",
      )
    ]
  )
  source = json.loads(SOURCE.read_text())
  assert shape(source["scope"]).difference(prior).area < 0.001
