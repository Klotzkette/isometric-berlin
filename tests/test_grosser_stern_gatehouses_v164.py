"""The four houses must retain all eight measured plans and incompatible evidence."""

import json
from pathlib import Path

from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/app/src/data/grosserSternGatehousesV164Source.json"


def test_gatehouse_evidence_and_plan_ownership() -> None:
  data = json.loads(SOURCE.read_text())
  assert len(data["houses"]) == 4
  assert len(data["parts"]) == len(data["legacyPrisms"]) == 8
  assert {p["id"] for p in data["legacyPrisms"]} == {
    p["legacyId"] for p in data["parts"]
  }
  for part in data["parts"]:
    assert Polygon(part["footprint"]).is_valid
    kinds = {s["kind"] for s in part["sourceSurfaces"]}
    assert {"WallSurface", "RoofSurface", "GroundSurface"} <= kinds
  for house in data["houses"]:
    assert house["osmTags"]["building:levels"] == "2"
    assert Polygon(house["osmFootprint"]).area > 110
    assert house["ridgeM"] < 8.5
    assert "conflicts" in house["presentationStatus"]
  for archive in data["archives"]:
    assert archive["license"] == "dl-de/zero-2-0"
    assert len(archive["sha256"]) == 64


def test_gatehouse_sources_do_not_erase_eastern_height_conflict() -> None:
  data = json.loads(SOURCE.read_text())
  heights = {}
  for part in data["parts"]:
    yy = [
      p[1] for s in part["sourceSurfaces"] for r in s["ringsWorldXZandNHN"] for p in r
    ]
    heights[part["legacyId"]] = max(yy) - min(yy)
  assert heights["K0002Ovc"] > 19
  assert 7.8 < heights["K0002ODQ"] < 8.1
  assert heights["K0003VYp"] > 17
