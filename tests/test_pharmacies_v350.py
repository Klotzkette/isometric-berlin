"""Identity/current-location guarantees, independent of runtime facade admission."""

from copy import deepcopy

import pytest
from shapely.geometry import Point, shape
from shapely.ops import unary_union

from scripts.build_pharmacies_v350 import (
  EVIDENCE,
  GEO,
  OSM,
  OUT,
  REVIEW,
  SOURCE,
  address_key,
  build,
  contains_house,
  read,
)


def test_spelling_does_not_erase_house_suffix_range_or_postcode():
  assert address_key("Schloßstr. 40", postcode="12165") == address_key(
    "Schloßstraße", "40", "12165"
  )
  assert address_key("Straße des 17. Juni 3", postcode="10557") == address_key(
    "Straße des 17. Juni", "3", "10557"
  )
  assert address_key("Teststraße 1A", postcode="10115") != address_key(
    "Teststraße 1", postcode="10115"
  )
  assert address_key("Teststraße 1-3", postcode="10115") != address_key(
    "Teststraße 13", postcode="10115"
  )
  assert address_key("Teststraße 1", postcode="10115") != address_key(
    "Teststraße 1", postcode="13355"
  )
  assert address_key(None, None, "10115") == ""
  assert contains_house("21-23", "22")
  assert not contains_house("21-23", "22a")
  assert not contains_house("21/23", "22")


def test_complete_current_directory_and_unmatched_old_locations_are_separate():
  source, osm, review = read(SOURCE), read(OSM), read(REVIEW)
  inventory, evidence = build(source, osm, review)
  assert inventory == read(OUT)
  assert len(inventory["records"]) == 666
  assert evidence["officialLocationCount"] == 702
  assert evidence["matchedOfficialLocations"] == 649
  assert evidence["matchedOsmLocations"] == 17
  assert len(evidence["individuallyReviewedAddresses"]) == 16
  assert evidence["unresolvedCurrentDirectory"] == []
  assert len(evidence["officialLocationsWithoutCurrentMatch"]) == 53
  current = {
    (r["name"], r["street"], r["zip"])
    for page in source["chamber"]["pages"]
    for r in page["records"]
    if r["city"].casefold() == "berlin"
  }
  represented = {
    (r["name"], r["evidence"]["currentStreetAddress"], r["postcode"])
    for r in inventory["records"]
  }
  assert represented == current
  assert len({r["id"] for r in inventory["records"]}) == 666
  assert read(EVIDENCE)["matchedCurrentLocations"] == 666


def test_duplicate_official_address_never_selects_an_arbitrary_owner():
  source = deepcopy(read(SOURCE))
  pharmacy = source["chamber"]["pages"][0]["records"][0]
  source["chamber"]["pages"] = [{"records": [pharmacy]}]
  feature = next(
    f
    for f in source["official"]["payload"]["features"]
    if f["properties"]["aponame"] == pharmacy["name"]
  )
  duplicate = deepcopy(feature)
  duplicate["properties"]["gc_id"] = "duplicate-owner"
  source["official"]["payload"]["features"] = [feature, duplicate]
  inventory, evidence = build(source)
  assert inventory["records"] == []
  assert (
    evidence["unresolvedCurrentDirectory"][0]["reason"] == "ambiguous-official-address"
  )


def test_individually_reviewed_source_change_is_rejected():
  source, osm, review = deepcopy(read(SOURCE)), read(OSM), read(REVIEW)
  target = next(
    f
    for f in source["official"]["payload"]["features"]
    if f["properties"]["gc_id"] == "DEBE05YYQ0001AiN"
  )
  target["geometry"]["coordinates"][0][0] += 1
  with pytest.raises(ValueError, match="Changed individually reviewed"):
    build(source, osm, review)


def test_every_location_is_inside_berlin_and_no_facade_or_entrance_is_invented():
  boundary = read(GEO / "raw/berlin-boundaries-v200/landesgrenze.geojson")
  state = unary_union([shape(f["geometry"]) for f in boundary["features"]])
  rows = read(OUT)["records"]
  assert all(state.covers(Point(r["easting"], r["northing"])) for r in rows)
  assert all(r["evidence"]["building"] == "unresolved" for r in rows)
  assert all(r["evidence"]["entrance"] == "unresolved" for r in rows)
  assert all(r["evidence"]["facade"] == "unverified" for r in rows)
  sky = next(r for r in rows if r["name"] == "Sky Apotheke Kreuzberg")
  assert sky["evidence"]["level"] == "1"
  stift = next(r for r in rows if r["name"] == "Apotheke zum Stift")
  assert stift["sourceId"] == "node/12872855271"
  assert stift["street"] == "Mariendorfer Damm"


def test_frozen_sources_exclude_contact_and_emergency_duty_fields():
  forbidden = {
    "phone",
    "phone_number",
    "email",
    "contact",
    "next_notdienste",
    "opening_hours",
  }

  def inspect(value):
    if isinstance(value, dict):
      assert not forbidden.intersection(value)
      for nested in value.values():
        inspect(nested)
    elif isinstance(value, list):
      for nested in value:
        inspect(nested)

  for path in (SOURCE, OSM, REVIEW, OUT):
    inspect(read(path))
