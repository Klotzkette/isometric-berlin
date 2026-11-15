"""Finite census, source containment and independent Native geometry checks."""

import base64
import gzip
import json
from pathlib import Path

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"


def read(p):
  return (
    json.loads(gzip.decompress(p.read_bytes()))
    if p.suffix == ".gz"
    else json.loads(p.read_text())
  )


def test_operator_census_and_public_ice_completeness():
  source = read(GEO / "sports-leisure-v352-source.json.gz")
  inv = read(GEO / "sports-leisure-v352-inventory.json.gz")
  assert source["completeMapEntries"] and source["directoryResultCount"] == 67
  rows = [r for r in inv["records"] if r["category"] == "bbb"]
  assert {r["id"] for r in rows} == {r["id"] for r in source["records"]} and len(
    rows
  ) == 67
  ice = [r for r in inv["records"] if r["category"] == "official-ice-site"]
  assert (
    len(ice) == 7
    and sum(r["outdoorFacilities"] + r["coveredFacilities"] for r in ice) == 16
  )
  assert all(r["sourceObject"] and r["status"] for r in ice)
  assert next(r for r in inv["records"] if r["id"] == "mauerpark-jump-house")[
    "status"
  ].startswith("no-official-branch")


def test_every_outdoor_pool_belongs_to_its_operator_site_not_a_private_neighbour():
  inv = read(GEO / "sports-leisure-v352-inventory.json.gz")
  rows = {r["id"]: r for r in inv["records"]}
  for f in inv["features"]:
    if f["category"] != "outdoor-pool":
      continue
    for facility in f["facilities"]:
      from shapely.geometry import Polygon

      site = shape(rows[facility]["geometry"])
      extent = unary_union(
        [Polygon(p.exterior) for p in getattr(site, "geoms", [site])]
      )
      assert extent.buffer(0.01).covers(shape(f["geometry"]))


def test_added_features_have_paired_support_and_no_new_unmapped_ground():
  inv = read(GEO / "sports-leisure-v352-inventory.json.gz")
  features = {r["id"]: r for r in inv["features"]}
  good = [
    r
    for r in inv["featureOutcomes"]
    if r["status"] == "added-supported-detail-both-modes"
  ]
  assert len(good) == inv["counts"]["improvedFeatures"] == 26
  for row in good:
    assert set(row["proofs"]) == {"drawn", "minecraft"}
    for mode, proof in row["proofs"].items():
      if row["category"] == "climbing-wall":
        assert proof["fullyDecodedWallSupport"] and proof["holdCount"] > 0
      else:
        assert 0 < proof["supportedArea"] <= proof["sourceArea"] + 0.02
    if row["category"] == "soccer-pitch":
      assert (
        row["proofs"]["drawn"]["goalEnds"] == row["proofs"]["minecraft"]["goalEnds"]
      )
  for item in read(ROOT / "src/app/src/data/sportsLeisureV352Index.json")["sources"]:
    archive = read(ROOT / "src/app/src/data" / item["file"])
    for key, plan in archive["packets"].items():
      _, host = key.split(":")
      assert not plan["retire"]
      owner_shapes = [
        shape(features[r["id"]]["geometry"]) for r in good if r["host"] == host
      ]
      if key.startswith("minecraft:") and any(
        r["host"] == host and r["category"] == "climbing-wall" for r in good
      ):
        # The preserved Native wall is independently cardinalized; verify against
        # its actual owner footprint instead of allowing a wider arbitrary buffer.
        public = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
        descriptor = next(
          c for c in read(public / "manifest.json")["chunks"] if c["id"] == host
        )
        raw = read(public / descriptor["minecraft"]["url"])
        ids = {
          "OSM-" + r["id"].replace("/", "-")
          for r in good
          if r["host"] == host and r["category"] == "climbing-wall"
        }
        owner_shapes.extend(
          translate(Polygon(b["ring"]), raw["origin"][0], raw["origin"][2])
          for b in raw["nav"]["buildings"]
          if b["sourceId"] in ids
        )
      allowed = unary_union(owner_shapes).buffer(0.22)
      mesh = plan["append"]
      p = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
        -1, 3
      ) / 100 + np.asarray(plan["origin"])
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4")
      assert all(allowed.covers(Point(v[0], v[2])) for v in p)
      if key.startswith("minecraft:"):
        for tri in p[indices].reshape(-1, 3, 3):
          assert np.min(np.ptp(tri, axis=0)) < 0.001
