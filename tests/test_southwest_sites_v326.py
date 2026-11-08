"""Finite source/clearance proof; no city construction and no archive rewrites."""

import gzip
import hashlib
import json
from pathlib import Path

import pytest
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


SOURCE = read(GEO / "southwest-sites-v326-source.json.gz")
MODEL = read(DATA / "southWestSitesV326.json")
PACKETS = read(DATA / "southWestSitesV326Packets.json")
EVIDENCE = read(GEO / "southwest-sites-v326-evidence.json")


def test_complete_original_owners_and_all_source_sheets_remain_available():
  assert {q["sourceId"] for q in SOURCE["oldKunsthaus"] + SOURCE["oldIsland"]} == {
    "OSM-way-32212224",
    "OSM-way-112235457",
    "OSM-way-73427143",
    "OSM-way-25015199",
    "OSM-way-1545433869",
  }
  families = SOURCE["kunsthaus"] + [
    f for k, f in SOURCE["islandFamilies"].items() if k != "schloss-source-only"
  ]
  assert len(families) == 7
  assert sum(len(f["parts"]) for f in families) == 19
  for f in families:
    for p in f["parts"]:
      assert p["surfaces"] and p["ring"] and p["top_y_m"] > p["ground_y_m"]
      assert any(s["kind"] == "RoofSurface" for s in p["surfaces"])
      assert all(
        s["rings"] and all(len(r) >= 3 for r in s["rings"]) for s in p["surfaces"]
      )
  for path, digest in SOURCE["preservedInputs"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  assert len(SOURCE["archives"]) == 5
  for archive in SOURCE["archives"]:
    code = archive["url"].split("/")[-1]
    folder = "grunewald-v190" if code == "LoD2_382_5814.zip" else "southwest-v326"
    assert (
      hashlib.sha256((GEO / "raw" / folder / code).read_bytes()).hexdigest()
      == archive["sha256"]
    )
  assert (
    hashlib.sha256(
      (GEO / "southwest-sites-v326-source.json.gz").read_bytes()
    ).hexdigest()
    == MODEL["sourceSha256"]
  )


def test_whole_island_network_routes_have_full_path_and_land_clearance():
  island = shape(SOURCE["island"])
  assert island.is_valid and island.area > 600000
  assert sum(len(p.exterior.coords) for p in island.geoms) > 700
  assert len(SOURCE["paths"]) == 69
  assert all(p["id"].startswith("OSM-way-") for p in SOURCE["paths"])
  paths = next(s for s in MODEL["sites"] if s["key"] == "pfaueninsel-paths")
  represented = unary_union(
    [
      Polygon([(p[0], p[2]) for p in t])
      for s in paths["surfaces"]
      for t in s["triangles"]
    ]
  )
  water = unary_union(
    [
      shape(p["geometry"])
      for p in SOURCE["polygons"]
      if p["tags"].get("natural") == "water" or p["tags"].get("water")
    ]
  )
  buildings = unary_union(
    [
      shape(p["geometry"])
      for p in SOURCE["polygons"]
      if p["tags"].get("building") or p["tags"].get("building:part")
    ]
  )
  assert represented.difference(island).area < 1e-6
  assert represented.intersection(water).area < 1e-6
  assert represented.intersection(buildings).area < 1e-6
  assert represented.area == pytest.approx(EVIDENCE["pathArea"], abs=1e-6)
  for q in MODEL["peacocks"]:
    route = LineString(q["routeXZ"])
    assert q["sourcePath"] in {p["id"] for p in SOURCE["paths"]}
    assert route.length >= 4
    assert (
      len({p[0] for p in q["routeXZ"]}) == 1 or len({p[1] for p in q["routeXZ"]}) == 1
    )
    assert represented.buffer(0.001).covers(route.buffer(0.9))
    assert island.difference(water).difference(buildings).covers(route.buffer(2.5))
    assert q["groundY"] == 3.025
  assert sum(q["white"] for q in MODEL["peacocks"]) == 2


def test_complete_measured_roofs_preserve_every_rigid_source_triangle_and_independent_shell():
  for site in MODEL["sites"]:
    if not site.get("parts"):
      continue
    assert site["nativeBoxes"] and site["nativeColumns"]
    for part in site["parts"]:
      expected = []
      for surface in part["surfaces"]:
        if surface["kind"] != "RoofSurface":
          continue
        # Each original sheet remains in the evidence. Compare its rigidly moved
        # complete triangle words against the delivered roof; no re-flattening.
        pts = surface["rings"][0]
        if len(pts) == 3:
          expected.append(
            [[p[0], round(p[1] + site["datumOffset"], 3), p[2]] for p in pts]
          )
      delivered = [
        t
        for s in site["surfaces"]
        if s.get("part") == part["id"] and s.get("kind") == "RoofSurface"
        for t in s["triangles"]
      ]
      assert delivered
      source_top = round(part["top_y_m"] + site["datumOffset"], 3)
      assert max(p[1] for t in delivered for p in t) == pytest.approx(
        source_top, abs=0.002
      )
      for t in expected:
        assert any(sorted(t) == sorted(q) for q in delivered)
    for row in site["nativeBoxes"]:
      assert len(row) == 8 and row[6] == 0 and min(row[3:6]) > 0
  kunsthaus = next(s for s in MODEL["sites"] if s["key"] == "kunsthaus-dahlem")
  assert max(p["topY"] for p in kunsthaus["parts"]) == pytest.approx(31.356)
  assert len(kunsthaus["parts"]) == 6


def test_new_tree_whole_crowns_stay_on_retained_mapped_woodland_and_clear_paths():
  gardens = next(s for s in MODEL["sites"] if s["key"] == "pfaueninsel-gardens")
  woods = unary_union(
    [
      shape(p["geometry"])
      for p in SOURCE["polygons"]
      if p["tags"].get("natural") == "wood" or p["tags"].get("landuse") == "forest"
    ]
  )
  paths = unary_union([shape(p["geometry"]).buffer(5) for p in SOURCE["paths"]])
  trees = [
    r
    for r, role in zip(gardens["boxes"], gardens["roles"])
    if role == "illustrative-interior-tree-trunk"
  ]
  assert len(trees) == gardens["illustrativeTreeCount"] and len(trees) > 100
  for x, _, z, *_ in trees:
    crown = Point(x, z).buffer(3.5)
    assert woods.covers(crown) and crown.intersection(paths).area == 0


def test_luisentempel_is_open_four_column_portico_with_exact_roof_navigation():
  temple = next(s for s in MODEL["sites"] if s["key"] == "luisentempel")
  assert temple["roles"].count("open-Doric-portico-column") == 4
  assert not any("window" in r for r in temple["roles"])
  assert temple["roles"].count("portico-rear-wall-thickness") == 1
  centre = Polygon(temple["parts"][0]["ring"]).representative_point()
  for key, plan in PACKETS["packets"].items():
    if key.startswith("minecraft:"):
      continue
    for nav in plan["appendNav"]:
      local = Point(centre.x - plan["origin"][0], centre.y - plan["origin"][2])
      if Polygon(nav["ring"], nav["holes"]).covers(local):
        assert nav["minHeight"] > 6  # open underneath the actual source roof


def test_closed_recipes_account_all_old_owners_without_source_append_or_changed_outside():
  assert len(PACKETS["keys"]) == 9
  assert len(set(PACKETS["keys"])) == 9
  proof = {p["key"]: p for p in EVIDENCE["packets"]}
  manifest = read(ROOT / "src/app/public/mesh/surrounding-berlin-v159/manifest.json")
  for key, p in PACKETS["packets"].items():
    assert p.get("append") is None
    assert p["owners"] and p["records"] and p["preparedRecords"]
    assert all(len(p[k]) == 3 for k in ["origin"])
    assert len(p["appendNav"]) <= 20000
    mode, id = key.split(":", 1)
    desc = next(q for q in manifest["chunks"] if q["id"] == id)
    path = ROOT / "src/app/public/mesh/surrounding-berlin-v159" / desc[mode]["url"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == proof[key]["sourceSha256"]
  assert sum(p["retiredTriangles"] for p in proof.values()) == 569
  assert len(MODEL["references"]) == 18
  assert all(
    p["author"] and p["license"] and p["licenseUrl"]
    for p in MODEL["references"]
    if p["kind"] == "external-photo-reference"
  )
