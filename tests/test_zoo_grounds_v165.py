"""Source and ownership contracts for the bounded Zoo Berlin supplement."""

import json
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def load(name: str) -> dict:
  return json.loads((DATA / f"zooGroundsV165{name}.json").read_text())


def test_all_official_parts_and_boundary_surfaces_are_rendered() -> None:
  source, evidence = load("Source"), load("Evidence")
  assert len(source["parts"]) == 53
  assert len(source["surfaces"]) == 1963
  rendered = [(p["partId"], p["kind"]) for p in source["surfaces"]]
  expected = [
    (part["id"], surface["kind"])
    for parent in evidence["parents"]
    for part in parent["sourceParts"]
    for surface in part["surfaces"]
  ]
  assert rendered == expected
  for parent in evidence["parents"]:
    for raw in parent["sourceParts"]:
      displayed = next(p for p in evidence["displayParts"] if p["id"] == raw["id"])
      assert displayed["ring"] == raw["ring"]
      assert displayed["holes"] == raw["holes"]
      for a, b in zip(raw["surfaces"], displayed["surfaces"], strict=True):
        for r1, r2 in zip(a["rings"], b["rings"], strict=True):
          for v1, v2 in zip(r1, r2, strict=True):
            assert v1[0] == v2[0] and v1[2] == v2[2]
            assert abs(v1[1] + parent["displayOffsetY"] - v2[1]) < 0.0011


def test_exact_replacement_owners_and_small_navigation() -> None:
  source, nav = load("Source"), load("Navigation")
  assert {p["id"] for p in source["legacyPrisms"]} == {
    "2sL00001",
    "K0002NM4",
    "K0003VAC",
    "2sL00006",
    "2sL00007",
    "yvHJ6MDq",
    "5mcLWNSh",
    "K0002OEA",
    "K0002NEV",
    "AaBHh6LD",
    "Nsha0OLq",
    "E7NF4nBG",
    "18330093",
    "16870088",
    "16970136",
    "48376801",
    "gD00006I",
    "gD00006J",
  }
  assert nav["legacyPrisms"] == source["legacyPrisms"]
  assert "nativeRows" not in nav and "parents" not in nav
  assert "features" not in source and "groundPolygons" not in source
  assert all("surfaces" not in p for p in source["parts"])
  assert (DATA / "zooGroundsV165Navigation.json").stat().st_size < 290_000
  assert sum(row[3] for row in source["nativeRows"]) == source["nativeCellCount"]


def test_current_mapped_habitats_and_complete_path_water_inventory() -> None:
  source, evidence = load("Source"), load("Evidence")
  features = {f["id"]: f for f in evidence["features"]}
  assert len(source["habitats"]) == 104
  assert len(source["paths"]) == 221
  assert len(source["waters"]) == 34
  for habitat in source["habitats"]:
    assert habitat["ring"] == features[habitat["id"]]["coordinates"][:-1]
  assert {"32995989", "25036813", "25036814", "49896121"} <= {
    p["id"] for p in source["habitats"]
  }
  assert "2016" in source["polarFoxStatus"]
  assert "Neumuenster" in source["polarFoxStatus"]
  assert not any("fuchs" in p["name"].lower() for p in source["habitats"])


def test_schleusenkrug_tables_respect_mapped_site_buildings_and_paths() -> None:
  source, evidence = load("Source"), load("Evidence")
  beer = Polygon(
    next(f["coordinates"] for f in evidence["features"] if f["id"] == "1046088364")
  )
  buildings = unary_union(
    [Polygon(p["ring"], p["holes"]).buffer(0) for p in source["parts"]]
  )
  paths = unary_union(
    [LineString(p["line"]).buffer(p["width"] / 2) for p in evidence["paths"]]
  )
  assert len(source["schleusenkrugTables"]) == 21
  for x, z in source["schleusenkrugTables"]:
    footprint = Point(x, z).buffer(1.6)
    assert beer.covers(footprint)
    assert not footprint.intersects(buildings)
    assert not footprint.intersects(paths)


def test_imported_runtime_keeps_provenance_without_photo_or_archive_payloads() -> None:
  source = load("Source")
  assert source["licenses"] == ["ODbL-1.0", "dl-de/zero-2-0"]
  assert source["mapSourceUrl"].startswith("https://api.openstreetmap.org/")
  assert all(len(p["sourceSha256"]) == 64 for p in source["parents"])
  code = (ROOT / "src/app/src/ZooGroundsV165.ts").read_text()
  assert "TextureLoader" not in code and "Evidence.json" not in code
  assert "nativeRows" in code and "groundRuns" in code
