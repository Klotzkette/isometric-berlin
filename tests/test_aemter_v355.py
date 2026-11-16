"""Protect the public-office inventory from lost aliases or unsupported entrances."""

import math
from collections import Counter

from shapely.geometry import Point, shape

from scripts.build_aemter_v355 import OUTPUT, extract, key
from scripts.build_pharmacies_v350 import read


def test_every_portal_entry_is_accounted_for_once() -> None:
  data = read(OUTPUT)
  sites = data["sites"]
  assert len({site["id"] for site in sites}) == len(sites) == 68
  assert len({(site["kind"], site["addressKey"]) for site in sites}) == len(sites)
  seen = Counter()
  for site in sites:
    assert key(site["address"]) == site["addressKey"]
    for row in [site, *site["services"]]:
      if "portalId" in row:
        seen[(site["kind"], row["portalId"])] += 1
  for row in data["unresolved"]:
    seen[(row["kind"], row["portalId"])] += 1
  assert all(count == 1 for count in seen.values())
  assert Counter(kind for kind, _ in seen) == {"tax-office": 29, "citizen-office": 114}
  assert (
    len({site["authority"] for site in sites if site["kind"] == "citizen-office"}) == 12
  )
  by_id = {site["id"]: site for site in sites}
  branch = by_id["berlin-senfin-mehringdamm-110-112"]
  assert branch["publicAccess"] is False
  assert [point["houseNumber"] for point in branch["alternateOfficialPoints"]] == [
    "110",
    "112",
  ]


def test_geometry_location_and_entrance_provenance() -> None:
  data = read(OUTPUT)
  photo_references = 0
  entrances = 0
  for site in data["sites"]:
    shell = shape(site["buildingGeometry"])
    assert shell.is_valid and not shell.is_empty
    evidence = site["osmBuilding"]
    if evidence["containsPrimaryPoint"]:
      assert shell.covers(Point(site["lon"], site["lat"]))
    if evidence["containsAlternatePoint"]:
      assert any(
        shell.covers(Point(p["lon"], p["lat"])) for p in site["alternateOfficialPoints"]
      )
    assert evidence["sourceUrl"].endswith(evidence["osmId"])
    if entrance := site.get("entrance"):
      entrances += 1
      assert site["mappedBuildingEntrances"] == [entrance]
      assert entrance["tag"] == "entrance=main" and "/node/" in entrance["sourceUrl"]
      assert (
        shell.boundary.distance(Point(entrance["lon"], entrance["lat"])) <= 0.000006
      )
    if reference := site.get("facadeDocumentation", site.get("facadeReference")):
      photo_references += 1
      assert reference["osmBuildingId"] == evidence["osmId"]
      assert reference["mainEntranceSourceUrl"] == site["entrance"]["sourceUrl"]
      assert reference["photo"]["photoBundled"] is False
      assert len(reference["photo"]["sha256"]) == 64
      assert math.isclose(math.hypot(*reference["outward"]), 1, abs_tol=0.002)
  charlottenburg = next(s for s in data["sites"] if s.get("portalId") == 122937)
  courses = charlottenburg["facadeReference"]
  assert len(courses) == 3 and all(r["native"]["normal"] == [0, 1] for r in courses)
  assert len({tuple(r["native"]["point"]) for r in courses}) == 3
  assert entrances == 17
  assert photo_references == 3


def test_known_swapped_mobile_entry_retains_its_raw_pair() -> None:
  row = extract(
    {
      "id": 327761,
      "properties": {
        "name": "Mobiles Bürgeramt",
        "description": '<div>Bezirksamt Lichtenberg</div><p>Große-Leege-Straße 103, 13055 Berlin<br/><a href="https://service.berlin.de/standort/327761/">Link</a></p>',
      },
      "geometry": {"type": "Point", "coordinates": [52.54512, 13.49999]},
    }
  )
  assert [row["lon"], row["lat"]] == [13.49999, 52.54512]
  assert row["portalCoordinateOrder"] == [52.54512, 13.49999]
