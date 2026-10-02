"""Present-day Bernauer memorial source ownership and open-path regression."""

import json
from pathlib import Path

from shapely.geometry import Point, Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads(
  (ROOT / "src/app/src/data/berlinWallMemorialV174Source.json").read_text()
)
NAV = json.loads(
  (ROOT / "src/app/src/data/berlinWallMemorialV174Navigation.json").read_text()
)
EVIDENCE = json.loads(
  (ROOT / "geo_data/regierungsviertel/berlin-wall-memorial-v174.json").read_text()
)


def test_exact_preserved_border_layers_and_contemporary_endpoints() -> None:
  features = EVIDENCE["osmFeatures"]
  assert features["1504490315"]["tags"]["height"] == "3.60"
  assert features["129028211"]["tags"]["height"] == "3"
  assert features["129029469"]["tags"]["ruins"] == "yes"
  assert features["53257439"]["tags"]["height"] == "7"
  assert features["126462918"]["tags"]["height"] == "7"
  assert features["446637042"]["tags"]["access"] == "no"
  # Never confuse the open-air memorial with a restored historical death strip.
  enclosure = shape(features["45664093"]["geometry"]).geoms[0]
  assert Polygon(NAV["inaccessibleEnclosure"]).equals_exact(enclosure, 0.0001)
  sand = [s for s in DATA["surfaces"] if s["role"] == "enclosed-preserved-sand"]
  area = 0.0
  for s in sand:
    for triangle in s["triangles"]:
      p = Polygon([(x, z) for x, _, z in triangle])
      assert enclosure.buffer(0.001).covers(p)
      area += p.area
  assert abs(area - enclosure.area) < 0.02
  assert len(DATA["caps"]) == 4


def test_complete_official_museum_replacement_is_narrow() -> None:
  parts = EVIDENCE["officialParts"]
  assert len(parts) == 18
  assert {p["parentId"] for p in parts} == {
    "DEBE01YYK0003tZM",
    "DEBE01YYK0003tGE",
    "DEBE00YY2hR0005R",
    "DEBE01YYK0003yxD",
  }
  source_ids = {
    s["sourcePolygonId"]
    for p in parts
    for s in p["surfaces"]
    if s["kind"] != "GroundSurface"
  }
  assert source_ids == {
    s["sourcePolygonId"] for s in DATA["surfaces"] if "sourcePolygonId" in s
  }
  assert {p["id"] for p in EVIDENCE["replacedFallbackPrisms"]} == {
    "45664094",
    "53333454",
  }
  assert set(EVIDENCE["preservedExistingParents"]) == {
    "DEBE01YYK0001yOL",
    "DEBE01YYK000003x",
  }
  # Datum remains the existing local ground; tower floors retain source offsets.
  assert abs(min(p["groundY"] for p in parts) - 5.2) < 0.01
  assert max(p["topY"] for p in parts) > 25


def test_public_crossings_remain_free_of_memorial_collision() -> None:
  obstacles = [Polygon(s["ring"]) for s in NAV["solids"]]
  obstacles += [Point(x, z).buffer(half) for x, z, half, _ in NAV["posts"]]
  for x, z in NAV["publicCrossingPoints"]:
    p = Point(x, z)
    assert not Polygon(NAV["inaccessibleEnclosure"]).covers(p)
    assert min(s.distance(p) for s in obstacles) > 1.1


def test_native_is_bounded_separate_and_does_not_raise_sand() -> None:
  assert 0 < len(DATA["nativeRows"]) < 22000
  assert all(len(r) == 7 and min(r[3:6]) > 0 for r in DATA["nativeRows"])
  sand = [r for r in DATA["nativeRows"] if r[-1] == 0xCCC4AA]
  assert sand
  assert all(abs(r[1] + r[4] / 2 - 5.32) < 1e-6 for r in sand)
  assert all(1090 < r[0] < 1535 and -2020 < r[2] < -1490 for r in DATA["nativeRows"])
  assert EVIDENCE["runtimeBytes"]["decoded"] < 1500000
