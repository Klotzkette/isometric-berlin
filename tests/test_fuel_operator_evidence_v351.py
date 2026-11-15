"""Finite primary-source identity evidence cannot silently move or invent a forecourt."""

import gzip
import hashlib
import json
import unittest
from pathlib import Path

from shapely.geometry import Point, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"


def read(name):
  return json.loads(gzip.decompress((GEO / name).read_bytes()))


class FuelOperatorEvidenceV351(unittest.TestCase):
  @classmethod
  def setUpClass(cls):
    cls.audit = read("fuel-v351-operator-evidence.json.gz")
    cls.inventory = read("fuel-v351-inventory.json.gz")
    cls.rows = {r["id"]: r for r in cls.inventory["records"]}
    cls.official = {r["id"]: r for r in cls.audit["records"]}

  def test_source_closure_and_exact_boundary(self):
    a = self.audit
    self.assertEqual(
      hashlib.sha256((GEO / "fuel-v351-inventory.json.gz").read_bytes()).hexdigest(),
      a["inventorySha256"],
    )
    self.assertEqual(
      hashlib.sha256((GEO / a["boundary"]["path"]).read_bytes()).hexdigest(),
      a["boundary"]["sha256"],
    )
    boundary = unary_union(
      [shape(f["geometry"]) for f in read(a["boundary"]["path"])["state"]["features"]]
    )
    self.assertEqual(len(self.official), 223)
    self.assertTrue(
      all(
        boundary.covers(Point(r["easting"], r["northing"]))
        for r in self.official.values()
      )
    )
    self.assertEqual(
      a["counts"]["byFamily"],
      {
        "Aral": 50,
        "HEM": 16,
        "JET": 22,
        "SB Tank": 1,
        "Shell": 47,
        "Spreves": 1,
        "Sprint": 19,
        "TotalEnergies": 38,
        "star/ORLEN": 29,
      },
    )
    self.assertEqual(len(a["excludedNonFuelEntries"]), 20)

  def test_one_to_one_and_unconfirmed_partition(self):
    matches = self.audit["identityMatches"]
    self.assertEqual(len(matches), len(self.official))
    self.assertEqual(len({m["mappedId"] for m in matches}), len(matches))
    self.assertEqual({m["officialId"] for m in matches}, set(self.official))
    matched = {m["mappedId"] for m in matches}
    unconfirmed = set(self.audit["unconfirmedMappedActive"])
    self.assertFalse(matched & unconfirmed)
    self.assertEqual(
      matched | unconfirmed,
      {r["id"] for r in self.rows.values() if r["state"] == "mapped-active"},
    )
    self.assertEqual(len(unconfirmed), 69)

  def test_distances_are_measured_against_actual_source_geometry(self):
    warnings = []
    conflicts = []
    for m in self.audit["identityMatches"]:
      r = self.official[m["officialId"]]
      point = Point(r["easting"] - 389500, 5820000 - r["northing"])
      distance = point.distance(shape(self.rows[m["mappedId"]]["geometry"]))
      self.assertAlmostEqual(distance, m["distanceToMappedGeometryM"], delta=0.001)
      self.assertEqual(m["directoryPointOffsetWarning"], distance > 100)
      if m["basis"] == "unique-same-family-site-within100m":
        self.assertLessEqual(distance, 100)
      if m["brandConflict"]:
        self.assertEqual(m["basis"], "exact-address-within50m-brand-differs")
        self.assertLessEqual(distance, 50)
        conflicts.append(m["officialId"])
      if m["directoryPointOffsetWarning"]:
        self.assertIn(
          m["basis"], ["official-ID-in-mapped-website", "exact-normalized-address"]
        )
        warnings.append(m["officialId"])
    self.assertEqual(
      set(conflicts),
      {
        "circlek:80106",
        "circlek:80110",
        "circlek:80100",
        "circlek:80074",
        "circlek:80087",
      },
    )
    self.assertEqual(set(warnings), {"DE-28601500", "circlek:81194"})

  def test_sanitized_fact_schema_and_no_visual_or_operating_assertion(self):
    forbidden = {
      "telephone",
      "phone",
      "email",
      "contact",
      "opening_hours",
      "openingHours",
      "schedule",
      "price",
      "fuel",
      "name_paechter",
      "image",
      "photos",
    }

    def visit(value):
      if isinstance(value, dict):
        self.assertFalse(forbidden & value.keys())
        for child in value.values():
          visit(child)
      elif isinstance(value, list):
        for child in value:
          visit(child)

    visit(self.audit)
    self.assertIn("Not a guarantee of operation", self.audit["scope"])
    self.assertTrue(
      all("facility identity only" in m["scope"] for m in self.audit["identityMatches"])
    )
    self.assertTrue(
      all(
        "not evidence" in r["brandScope"]
        for r in self.official.values()
        if r["id"].startswith("circlek:")
      )
    )


if __name__ == "__main__":
  unittest.main()
