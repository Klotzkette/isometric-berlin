"""Proof of Berlin boundary, source identity merges and exact wall anchors."""

import math
from collections import Counter

from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, shape

from scripts.build_mcdonalds_inventory_v351 import GEO, PROJECTION, ROOT, boundary, read

SOURCE = GEO / "retail-v355-source.json.gz"
PACKETS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def test_retail_inventory_scope_and_sources():
  report = read(SOURCE)
  sites = report["sites"]
  assert report["schemaVersion"] == 1
  assert report["checkedAt"] == "2026-11-16"
  assert Counter(p["kind"] for p in sites) == {"car-dealer": 342, "mall": 86}
  assert len({p["id"] for p in sites}) == len(sites)
  assert len(report["directory"]) == 51
  directory_urls = {p["sourceUrl"] for p in report["directory"]}
  for site in sites:
    assert site["name"].strip()
    assert site["sourceUrl"].startswith("https://")
    if site.get("directory"):
      directory_urls.remove(site["directory"]["sourceUrl"])
    elif site["id"].startswith("berlin-directory/"):
      directory_urls.remove(site["sourceUrl"])
  assert directory_urls == {
    p["sourceUrl"] for p in report["unresolved"] if p.get("sourceUrl") in directory_urls
  }
  berlin = boundary()
  anchors = Counter()
  for site in sites:
    assert berlin.covers(Point(*PROJECTION(site["lon"], site["lat"])))
    if "buildingGeometry" in site:
      assert shape(site["buildingGeometry"]).covers(Point(site["lon"], site["lat"]))
      assert site["osmBuildingId"].startswith(("way/", "relation/"))
      if site["buildingEvidence"] == "exact-venue-element-tagged-building":
        assert site["buildingGeometry"] == site["geometry"]
        assert site["mappedTags"]["building"] not in ("no", "roof", "construction")
      else:
        assert site.get("geometry", {"type": "Point"})["type"] == "Point"
    if "entrance" in site:
      e = site["entrance"]
      anchors[e["sourceUrl"]] += 1
      p = Point(e["lon"], e["lat"])
      assert e in site["mappedEntrances"]
      assert any(
        g["geometry"]["type"] != "Point"
        and shape(g["geometry"]).boundary.distance(p) <= 0.00000025
        for g in site["venueSources"]
      )
  assert len(anchors) == 23 and max(anchors.values()) == 1


def test_photo_anchored_patches_fit_exact_exposed_retained_walls():
  sites = read(SOURCE)["sites"]
  profiles = read(GEO / "retail-v355-appearance.json")
  manifest = {c["id"]: c for c in read(PACKETS / "manifest.json")["chunks"]}
  polygons = {}
  for _, patches in profiles.items():
    for patch in patches:
      host, owner = patch["hostHint"], patch["ownerHint"]
      if host == "core":
        row = next(
          b
          for b in read(
            ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
          )["buildings"]
          if b["id"] == owner
        )
        polygons[host, owner] = (
          Polygon([(x / 10, z / 10) for x, z in row["ring"]]),
          row["h_dm"] / 10,
        )
      elif (host, owner) not in polygons:
        packet = read(PACKETS / manifest[host]["drawn"]["url"])
        row = next(b for b in packet["nav"]["buildings"] if b["sourceId"] == owner)
        p = Polygon(row["ring"], row.get("holes", []))
        x, _, z = packet["origin"]
        polygons[host, owner] = (translate(p, x, z), row["height"])
  for ident, patches in profiles.items():
    site = next(p for p in sites if p["id"] == ident)
    assert patches == site["facadeReference"]
    for patch in patches:
      poly, height = polygons[patch["hostHint"], patch["ownerHint"]]
      e, n = PROJECTION(*patch["point"])
      at = Point(e - 389500, 5820000 - n)
      dx, dz = patch["normal"]
      assert math.isclose(math.hypot(dx, dz), 1, abs_tol=0.001)
      assert 0 < patch["bottom"] < patch["top"] <= height
      assert poly.contains(Point(at.x - dx * 0.05, at.y - dz * 0.05))
      assert not poly.contains(Point(at.x + dx * 0.05, at.y + dz * 0.05))
      half = patch["width"] / 2
      ends = [(at.x + dz * side * half, at.y - dx * side * half) for side in (-1, 1)]
      line = LineString(ends)
      assert poly.boundary.buffer(0.03).covers(line)
