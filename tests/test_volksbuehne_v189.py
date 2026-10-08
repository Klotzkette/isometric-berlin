"""Independent provenance and exact owner preservation contracts for v189."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from shapely.geometry import Point, Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/volksbuehne-v189-source.json"
RUNTIME = ROOT / "src/app/src/data/volksbuehneV189.json"
sys.path.insert(0, str(ROOT / "scripts"))
import build_volksbuehne_v189 as builder  # noqa: E402


def test_original_source_sheets_and_datum_are_preserved_exactly() -> None:
  """The new provenance agrees with the previously shipped authoritative owner."""
  source = json.loads(SOURCE.read_text())
  runtime = json.loads(RUNTIME.read_text())
  prior = json.loads(
    (ROOT / "geo_data/regierungsviertel/scheunenviertel-v168.json").read_text()
  )
  old = next(b for b in prior["retainedDetailedBuildings"] if b["id"] == builder.OWNER)
  assert source["building"]["id"] == old["id"]
  assert old["groundNHN"] == source["building"]["sourceMinNhnM"] == 35.866
  converted = []
  for s in source["building"]["surfaces"]:
    converted.append(
      {
        "kind": s["kind"],
        "rings": [
          [
            [round(x - 389500, 3), round(h - 35.866 + 3, 3), round(5820000 - n, 3)]
            for x, n, h in ring
          ]
          for ring in s["ringsEpsg25833Nhn"]
        ],
      }
    )
  # Prior delivery omits the repeated closing vertex; normalize only closure.
  for sheet in converted:
    for ring in sheet["rings"]:
      if ring[0] == ring[-1]:
        ring.pop()
  old_sheets = old["parts"][0]["surfaces"]
  assert {json.dumps(s, sort_keys=True) for s in converted} == {
    json.dumps(s, sort_keys=True) for s in old_sheets
  }
  assert len(converted) == 75
  assert runtime["building"]["groundY"] == 3
  assert runtime["building"]["topY"] == 23.564
  assert runtime["sourceSha256"] == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  assert builder.build(source) == runtime


def test_exact_footprint_holes_and_separate_steel_artwork() -> None:
  """The two rear holes survive and the artwork remains at the OSM node."""
  source = json.loads(SOURCE.read_text())
  runtime = json.loads(RUNTIME.read_text())
  rings = runtime["building"]["rings"]
  original = shape(source["building"]["officialFootprint"])
  represented = Polygon(rings[0], rings[1:])
  assert len(rings) == 3
  assert original.symmetric_difference(represented).area < 0.0001
  assert source["building"]["osmId"] == "relation/5746884"
  wheel = runtime["wheel"]
  assert wheel["id"] == "node/2856686321"
  assert wheel["xz"] == [2733.036486813391, -775.1956612048671]
  assert wheel["tags"]["material"] == "steel"
  assert original.distance(Point(wheel["xz"])) > 32
  assert wheel["groundY"] == 3
  assert "estimate" in wheel["heightStatus"]


def test_reference_credits_are_individual_free_licenses_without_pixels() -> None:
  records = json.loads(
    (ROOT / "geo_data/regierungsviertel/volksbuehne-v189-credits.json").read_text()
  )
  assert len(records) == 2
  assert {r["artist"] for r in records} == {"Gerd Eichmann", "Lukas Beck"}
  for record in records:
    assert record["license"] in {"CC BY 4.0", "CC BY-SA 4.0"}
    assert record["photo_bundled"] is False
    assert record["page_url"].startswith("https://commons.wikimedia.org/wiki/File:")
