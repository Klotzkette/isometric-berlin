"""Bounded hospital source preservation, missing parts, and walking evidence."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from scripts.build_hospitals_v228 import estimated_height, metric

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(path):
  return json.loads(path.read_text())


def test_six_named_sites_and_retained_source_ownership():
  source = read(GEO / "hospitals-source-v228.json")
  assert (
    source["osmSha256"]
    == hashlib.sha256((GEO / "hospitals-osm-v228.json").read_bytes()).hexdigest()
  )
  assert source["removedOwners"] == []
  assert len(source["unavailableArchives"]) == 2
  sites = {s["key"]: s for s in source["sites"]}
  assert set(sites) == {
    "charite-mitte",
    "benjamin-franklin",
    "friedrichshain",
    "drk-mitte",
    "juedisches",
    "prenzlauer-berg",
  }
  assert sites["prenzlauer-berg"]["name"].startswith("Ehemaliges")
  core = read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")
  originals = {p["id"]: p for p in core["buildings"]}
  for retained in sites["charite-mitte"]["retainedOwners"]:
    assert originals[retained["id"]] == retained["original"]
  assert len(sites["charite-mitte"]["retainedOwners"]) == 6
  assert not any(p["required"] for p in sites["charite-mitte"]["parts"])
  protected = set(read(DATA / "chariteBettenhausV207.json")["sourceIds"])
  assert not protected.intersection(p["owner"] for p in sites["charite-mitte"]["parts"])


def test_cbf_upper_parts_are_real_missing_osm_parts_above_preserved_podium():
  site = next(
    s
    for s in read(GEO / "hospitals-source-v228.json")["sites"]
    if s["key"] == "benjamin-franklin"
  )
  osm = next(
    s for s in read(GEO / "hospitals-osm-v228.json")["sites"] if s["key"] == site["key"]
  )
  records = {r["id"]: r for r in osm["buildingParts"]}
  assert site["retainedOwners"][0]["id"] == "OSM-relation-5943188"
  assert site["retainedOwners"][0]["height"] == 6
  required = [p for p in site["parts"] if p["required"]]
  assert len(required) == 29
  assert max(p["top_y_m"] for p in required) == 30
  for p in required:
    record = records[p["owner"]]
    assert p["ground_y_m"] >= 9
    assert p["top_y_m"] == 3 + estimated_height(record["tags"])[0]
    assert p["ground_y_m"] >= 3 + float(record["tags"].get("building:min_level", 0)) * 3
    assert (
      Polygon(p["ring"], p["holes"]).symmetric_difference(metric(record)).area < 0.15
    )
    assert "estimated" in p["provenance"]


def test_missing_campuses_keep_real_outlines_parts_and_open_courtyards():
  source = {s["key"]: s for s in read(GEO / "hospitals-source-v228.json")["sites"]}
  for osm in read(GEO / "hospitals-osm-v228.json")["sites"]:
    if osm["key"] not in {"drk-mitte", "juedisches"}:
      continue
    site = source[osm["key"]]
    assert site["retainedOwners"] == []
    source_shape = unary_union(
      [metric(r) for r in [*osm["buildings"], *osm["buildingParts"]]]
    )
    delivered = unary_union([Polygon(p["ring"], p["holes"]) for p in site["parts"]])
    assert source_shape.intersection(delivered).area / source_shape.area > 0.995
    assert delivered.difference(source_shape.buffer(0.002)).area < 0.1
    assert all(p["required"] and p["provenance"] for p in site["parts"])
    assert any("osm:building:levels" in p["provenance"] for p in site["parts"])


def test_navigation_bounds_and_facade_wall_support():
  source = {s["key"]: s for s in read(GEO / "hospitals-source-v228.json")["sites"]}
  profile = read(DATA / "hospitalV228Profile.json")["sites"]
  for site in profile:
    originals = {p["id"]: p for p in source[site["key"]]["parts"]}
    for part in site["parts"]:
      assert part["ring"] == originals[part["id"]]["ring"]
      for edge in part["wallEdges"]:
        assert part["ground_y_m"] <= edge["base"] < edge["eave"] <= part["top_y_m"]
        assert sum(v * v for v in edge["normal"]) == pytest.approx(1, abs=2e-6)
  navigation = read(DATA / "hospitalV228Navigation.json")["sites"]
  assert {s["key"] for s in navigation} == {
    "benjamin-franklin",
    "drk-mitte",
    "juedisches",
  }
  for site in navigation:
    bounds = box(*site["bounds"]).buffer(0.001)
    for owner in [*site["owners"], *site["pads"]]:
      assert bounds.covers(Polygon(owner["ring"], owner["holes"]))
    assert site["roofTriangles"]
    assert bool(site["pads"]) == (site["key"] != "benjamin-franklin")


def test_tagged_height_precedes_estimates():
  assert estimated_height({"height": "21.5 m", "building:levels": "6"}) == (
    21.5,
    "osm:height",
  )
  assert estimated_height({"building:levels": "9"})[0] == 27
  assert "unsurveyed" in estimated_height({})[1]
