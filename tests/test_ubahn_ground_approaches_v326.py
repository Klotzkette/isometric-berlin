"""Finite source/height/ownership proof for the actual new U approach packets."""

import base64
import gzip
import hashlib
import json
import unittest

import numpy as np
from shapely import make_valid
from shapely.geometry import shape
from shapely.ops import unary_union

from scripts.build_ubahn_authored_ground_v326 import build as authored_build
from scripts.build_ubahn_ground_approaches_v326 import (
  AUTHORED,
  DATA,
  GEO,
  INDEX,
  PUBLIC,
  ROOT,
  SOURCE,
  closed_body,
  field_sampler,
  footprints,
  read,
)


class UbahnGroundApproachesV326Test(unittest.TestCase):
  @classmethod
  def setUpClass(cls):
    cls.source = read(SOURCE)
    cls.index = read(INDEX)
    cls.drawn = footprints(cls.index["footprint"])
    cls.native = footprints(cls.index["nativeFootprint"])
    cls.height = staticmethod(field_sampler(cls.source["dgmOriginalCheckpoints"]))

  def test_existing_eastern_owners_and_complete_body_water_guards(self):
    actual = authored_build()
    self.assertEqual(actual, read(AUTHORED))
    self.assertEqual(len(actual["ids"]), 9)
    self.assertEqual(sum(e["admission"] == "ready" for e in actual["entries"]), 6)
    self.assertEqual(sum(e["hasSourceStair"] for e in actual["entries"]), 4)
    self.assertTrue(
      all(not e["intersections"] for e in actual["entries"] if e["hasSourceStair"])
    )

  def test_every_original_access_is_accounted_and_source_scopes_stay_exact(self):
    source, index = self.source, self.index
    self.assertEqual(len(source["records"]), 148)
    self.assertEqual(len(index["entries"]), 148)
    self.assertEqual(
      {r["entry"]["id"] for r in source["records"]}, {e["id"] for e in index["entries"]}
    )
    self.assertTrue(all(e["reason"] for e in index["entries"]))
    self.assertGreater(sum(e["drawnPoint"] for e in index["entries"]), 100)
    self.assertTrue(
      all(
        hashlib.sha256((ROOT / p).read_bytes()).hexdigest() == h
        for p, h in source["exclusionPins"].items()
      )
    )
    old = read(GEO / "public-fidelity-v326-published206-manifest.json.gz")
    excluded = unary_union(
      [
        footprints(old["footprint"]),
        footprints(read(DATA / "northEastPublicSitesV326Index.json")["footprint"]),
        footprints(read(DATA / "publicInstitutionsV326Index.json")["footprint"]),
      ]
    )
    self.assertLess(self.drawn.intersection(excluded).area, 1e-7)
    for r in source["contextOriginal"]["records"]:
      t = r["tags"]
      if (
        closed_body(t)
        or t.get("natural") == "water"
        or t.get("landuse") in ["reservoir", "basin"]
        or t.get("waterway")
      ):
        self.assertLess(
          self.drawn.intersection(make_valid(shape(r["geometry"]))).area, 1e-7
        )
    self.assertLess(self.native.difference(self.drawn).area, 1e-7)
    self.assertLess(self.drawn.area, 5000)

  def test_actual_all_packet_words_have_exact_bounds_and_dgm_support(self):
    totals = {"drawn": 0, "minecraft": 0}
    for desc in self.index["chunks"]:
      self.assertTrue(desc["id"].startswith("ubahnApproach326-"))
      for mode in ["drawn", "minecraft"]:
        raw = (PUBLIC / desc[mode]["url"]).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), desc[mode]["sha256"])
        self.assertEqual(len(gzip.decompress(raw)), desc[mode]["decodedBytes"])
        packet = json.loads(gzip.decompress(raw))
        self.assertEqual(packet["nav"]["buildings"], [])
        self.assertEqual(packet["nav"]["water"], [])
        mesh = packet["meshes"][0]
        positions = (
          np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2")
          .reshape(-1, 3)
          .astype(float)
          / 100
          + packet["origin"]
        )
        indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
          -1, 3
        )
        self.assertLess(int(indices.max()), len(positions))
        self.assertGreaterEqual(positions[:, 0].min(), desc["bounds"][0])
        self.assertLessEqual(positions[:, 0].max(), desc["bounds"][2])
        self.assertGreaterEqual(positions[:, 2].min(), desc["bounds"][1])
        self.assertLessEqual(positions[:, 2].max(), desc["bounds"][3])
        for tri in positions[indices]:
          x, y, z = tri.mean(axis=0)
          self.assertLess(abs(y - self.height(x, z, mode == "minecraft")), 0.031)
          if mode == "minecraft":
            self.assertLess(float(np.ptp(tri[:, 1])), 1e-9)
            self.assertTrue(
              np.allclose(tri[:, [0, 2]] * 4, np.round(tri[:, [0, 2]] * 4))
            )
          totals[mode] += 1
    self.assertEqual(totals["drawn"], self.index["counts"]["drawnTriangles"])
    self.assertEqual(totals["minecraft"], self.index["counts"]["nativeCells"] * 2)

  def test_overhead_evidence_does_not_erase_closed_or_unknown_bodies(self):
    self.assertFalse(closed_body({"building": "roof", "layer": "1"}))
    self.assertTrue(closed_body({"building": "roof"}))
    self.assertTrue(closed_body({"building": "bridge"}))
    self.assertTrue(closed_body({"building": "retail", "layer": "1"}))
    self.assertTrue(closed_body({"building": "train_station", "min_height": "0"}))
    self.assertFalse(closed_body({"highway": "footway"}))


if __name__ == "__main__":
  unittest.main()
