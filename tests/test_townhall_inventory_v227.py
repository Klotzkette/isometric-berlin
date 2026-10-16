"""Independent identity and whole-building coverage checks for district halls."""

import hashlib
import json
from collections import Counter
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Polygon, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
TO_METRES = Transformer.from_crs(4326, 25833, always_xy=True).transform


def read(path: Path) -> dict:
  return json.loads(path.read_text())


def test_all_former_boroughs_and_present_main_seats_have_source_identity() -> None:
  identities = read(GEO / "townhall-identities-v227.json")["sites"]
  expected = {
    "Mitte",
    "Tiergarten",
    "Wedding",
    "Friedrichshain",
    "Kreuzberg",
    "Pankow",
    "Prenzlauer Berg",
    "Weißensee",
    "Charlottenburg",
    "Wilmersdorf",
    "Spandau",
    "Steglitz",
    "Zehlendorf",
    "Schöneberg",
    "Tempelhof",
    "Neukölln",
    "Treptow",
    "Köpenick",
    "Marzahn",
    "Hellersdorf",
    "Lichtenberg",
    "Hohenschönhausen",
    "Reinickendorf",
  }
  assert len(identities) == 23
  assert {s["formerDistrict"] for s in identities} == expected
  seats = [s for s in identities if s["currentMainOffice"]]
  assert len(seats) == len({s["currentDistrict"] for s in seats}) == 12
  assert all(s["sources"] and s["address"] for s in identities)
  keys = {s["key"] for s in identities}
  for path in [
    GEO / "townhall-osm-v227.json",
    GEO / "townhall-source-v227.json",
    ROOT / "src/app/src/data/townhallV227Profile.json",
  ]:
    assert {s["key"] for s in read(path)["sites"]} == keys


def test_every_selected_townhall_has_a_complete_source_envelope() -> None:
  """A small annex must not make an otherwise missing Rathaus look complete.

  OSM and LoD2 outlines differ, so allow 10% boundary disagreement. The former
  Spandau failure covered just 2.3% and is decisively rejected by this check.
  This tests horizontal completeness, not the certainty of estimated roofs.
  """
  osm_path = GEO / "townhall-osm-v227.json"
  source = read(GEO / "townhall-source-v227.json")
  assert source["osmSourceSha256"] == hashlib.sha256(osm_path.read_bytes()).hexdigest()
  by_key = {s["key"]: s for s in read(osm_path)["sites"]}
  parent_ids = []
  part_ids = []
  for site in source["sites"]:
    mapped = []
    for entry in by_key[site["key"]]["osm"]:
      tags = entry["tags"]
      if tags.get("building") not in (None, "no") or tags.get("building:part") not in (
        None,
        "no",
      ):
        metric = transform(TO_METRES, shape(entry["geometry"]))
        mapped.append(transform(lambda x, y: (x - 389500, 5820000 - y), metric))
    footprint = unary_union(mapped)
    parts = [p for parent in site["parents"] for p in parent["parts"]]
    retained = unary_union([Polygon(p["ring"], p.get("holes", [])) for p in parts])
    fraction = footprint.intersection(retained).area / footprint.area
    assert fraction >= 0.9, (site["key"], round(fraction, 4))
    parent_ids.extend(p["id"] for p in site["parents"])
    part_ids.extend(p["id"] for p in parts)
  assert max(Counter(parent_ids).values()) == 1
  assert max(Counter(part_ids).values()) == 1


def test_packet_receipt_replays_without_claiming_existing_detailed_mitte() -> None:
  """Compare exact independently reconstructed colored rows, never just bounds."""
  from scripts.build_townhall_ownership_v227 import build

  receipt = read(ROOT / "src/app/src/data/townhallV227Ownership.json")
  assert receipt == build()
  blocked = {r["owner"] for r in receipt["blocked"]}
  assert not blocked.intersection(receipt["authorizedOwners"])
  assert receipt["authorizedOwners"]
  for records, field in [
    (receipt["records"], "triangles"),
    (receipt["lineRecords"], "segments"),
  ]:
    claims = [
      (r["tile"], r["mode"], r["fingerprint"], index)
      for r in records
      for index in r[field]
    ]
    assert len(claims) == len(set(claims))
  assert all(
    {r["mode"] for r in receipt["records"] if r["owner"] == owner}
    == {"drawn", "minecraft"}
    for owner in receipt["authorizedOwners"]
  )
