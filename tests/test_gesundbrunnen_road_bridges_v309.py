"""Source preservation and complete contact checks for the two finite decks."""

import base64
import sys
import unittest
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, shape

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import build_gesundbrunnen_road_bridges_v309 as b


class GesundbrunnenRoadBridgesV309Test(unittest.TestCase):
  def test_all_official_samples_remain_and_control_the_profile(self):
    source = b.read(b.GEO / "gesundbrunnen-road-bridges-v309-source.json.gz")
    samples = source["bdom"]
    self.assertEqual(len(samples), 261)
    for site in b.profile_sources():
      for station, world in site["stations"]:
        values = sorted(
          q["nhn"]
          for q in samples
          if q["bridge"] == site["key"] and q["station"] == station
        )
        self.assertEqual(len(values), 9)
        self.assertAlmostEqual(world, values[1] - 30, places=3)
    self.assertEqual(len(source["axes"]), 32)

  def test_source_planes_have_exact_complete_outside_including_vertical_kerbs(self):
    for points, domain in [
      (
        np.array([[0.0, 3.0, 0.0], [4.0, 4.0, 0.0], [4.0, 5.0, 4.0]]),
        Polygon([(1, -1), (3, -1), (3, 5), (1, 5)]),
      ),
      (
        np.array([[0.0, 3.0, 0.0], [4.0, 4.0, 0.0], [4.0, 4.14, 0.0]]),
        Polygon([(1, -1), (3, -1), (3, 1), (1, 1)]),
      ),
    ]:
      inside = b.source_plane_cut(points, domain)
      outside = b.source_plane_cut(points, domain, False)

      def area(p):
        return float(np.linalg.norm(np.cross(p[1] - p[0], p[2] - p[0])) / 2)

      self.assertAlmostEqual(
        sum(area(q @ points) for q in inside + outside), area(points), places=8
      )
      self.assertTrue(inside)
      self.assertTrue(outside)

  def test_tile_retirements_are_only_the_explicit_unowned_59(self):
    packets = b.read(b.DATA / "gesundbrunnenRoadBridgesV309Packets.json")["packets"]
    wanted = b.read(b.GEO / "gesundbrunnen-road-bridges-v309-source.json.gz")[
      "unownedByV307"
    ]["records"]
    actual = {
      (key, *[r["mesh"], i])
      for key, p in packets.items()
      for r in p["retire"]
      for i in r["triangles"]
    }
    expected = {(r["mode"] + ":" + r["tile"], r["mesh"], r["triangle"]) for r in wanted}
    self.assertEqual(actual, expected)
    self.assertEqual(len(actual), 59)
    terrain = b.read(b.DATA / "railTerrainContactApproachV309Packets.json")["packets"]
    owned = {
      (key, r["mesh"], i)
      for key, p in terrain.items()
      for r in p["retire"]
      for i in r["triangles"]
    }
    self.assertFalse(actual & owned)
    for p in packets.values():
      self.assertEqual(p["retireLines"], [])
      self.assertEqual(p["retireNav"], [])
      self.assertEqual(p["appendNav"], [])

  def test_core_old_roads_are_below_the_complete_real_lower_floor(self):
    proof = b.read(b.GEO / "gesundbrunnen-core-road-occlusion-v309.json.gz")
    self.assertEqual(sum(p["faces"] for p in proof["parts"]), 1069)
    self.assertGreater(min(p["minimumBurialMetres"] for p in proof["parts"]), 0.07)
    self.assertEqual(sum(len(p["retiredFreeFaces"]) for p in proof["parts"]), 28)
    self.assertEqual(len(proof["native"]["rows"]), 26)
    self.assertGreater(proof["native"]["minimumBurialMetres"], 2.42)
    evidence = b.read(b.GEO / "gesundbrunnen-road-bridges-v309-evidence.json")
    self.assertEqual(len(evidence["coreUnderdeckFloor"]), 2)
    for row in evidence["coreUnderdeckFloor"]:
      self.assertAlmostEqual(
        row["area"] + row["missingOutsideCore"],
        next(s["domain"].area for s in b.profile_sources() if s["key"] == "badstrasse"),
        places=5,
      )
      self.assertGreater(row["area"], 0)
      self.assertGreaterEqual(row["missingOutsideCore"], 0)

  def test_every_new_native_body_face_is_cardinal(self):
    for q in b.read(b.DATA / "gesundbrunnenRoadBridgesV309.json")["models"]:
      if not (q["native"] and q["key"].endswith("-native-deck")):
        continue
      p = np.frombuffer(base64.b64decode(q["positions"]), "<u2").reshape(-1, 3)
      ix = np.frombuffer(base64.b64decode(q["indices"]), "<u4").reshape(-1, 3)
      self.assertTrue(np.all(np.any(np.ptp(p[ix].astype(int), axis=1) == 0, axis=1)))

  def test_complete_paired_floor_and_exact_source_palette(self):
    models = b.read(b.DATA / "gesundbrunnenRoadBridgesV309.json")["models"]
    external = b.read(b.DATA / "railBridgeUnderdeckApproachV309.json")["models"]
    self.assertEqual(len(external), 8)
    for native in [False, True]:
      family = [q for q in models + external if q["native"] == native]
      self.assertTrue(any(q["key"].startswith("badstrasse") for q in family))
      self.assertTrue(any(q["key"].startswith("swinemuende") for q in family))
      self.assertGreaterEqual(sum("underdeck" in q["key"] for q in family), 3)
    for q in models + external:
      self.assertIn(
        q["field"],
        ["gesundbrunnen", "bridge-approach-v307", "bridge-approach-v307:lower"],
      )
      if "underdeck" in q["key"]:
        colours = np.frombuffer(base64.b64decode(q["colors"]), "<u2").reshape(-1, 3)
        self.assertTrue(np.all(colours == np.array(b.BALLAST)))

  def test_navigation_is_the_delivered_thin_surface_and_source_not_changed(self):
    profile = b.read(b.DATA / "gesundbrunnenRoadBridgesV309Profile.json")
    self.assertTrue(profile["navigation"])
    for row in profile["navigation"]:
      p = np.array(row["triangle"])
      self.assertAlmostEqual(row["high"], p[:, 1].max(), places=5)
      self.assertAlmostEqual(row["low"], p[:, 1].min() - row["thickness"], places=5)
      if row.get("precision") != "f32":
        self.assertTrue(np.allclose(p * 100, np.rint(p * 100), atol=1e-7, rtol=0))
    evidence = b.read(b.GEO / "gesundbrunnen-road-bridges-v309-source.json.gz")
    for row in evidence["tileInsideSource"]:
      capture = b.CAPTURE / f"prepared/{row['tile']}.{row['mode']}.json"
      self.assertEqual(b.sha(capture), row["captureSha256"])
    exclusions = b.read(
      b.GEO / "gesundbrunnen-bridge-contact-exclusions-v309-extension.json.gz"
    )
    self.assertEqual(len(exclusions["records"]), 1163)
    self.assertTrue(all(shape(q["domain"]).is_valid for q in exclusions["records"]))

  def test_actual_lower_floor_revision_and_navigation_are_identical(self):
    profile = b.read(b.DATA / "gesundbrunnenRoadBridgesV309Profile.json")
    models = b.read(b.DATA / "gesundbrunnenRoadBridgesV309.json")["models"]
    self.assertEqual(
      profile["lowerFloorSha256"],
      b.sha(b.DATA / "railBridgeUnderdeckApproachV309.json"),
    )
    self.assertEqual(
      [r for r in profile["navigation"] if r.get("role") == "lower-rail-floor"],
      b.actual_floor_navigation(models),
    )

  def test_a_high_vertex_outside_the_finite_domain_cannot_replace_the_real_lower_floor_proof(
    self,
  ):
    source = b.read(b.GEO / "gesundbrunnen-road-bridges-v309-source.json.gz")
    site = next(s for s in b.profile_sources() if s["key"] == "badstrasse")
    road = next(
      r
      for r in source["coreInsideSource"]
      if r.get("batchId") == "restored-asphalt-2--7" and r["ordinal"] == 1445
    )
    points = np.array(road["xyz"])
    self.assertGreater(points[:, 1].max(), 19)
    clipped = [
      weights @ points for weights in b.source_plane_cut(points, site["domain"])
    ]
    self.assertLess(max(q[:, 1].max() for q in clipped), 16)
    delta = b.read(b.DATA / "gesundbrunnenBridgeCoreV309Delta.json")
    asphalt = next(
      p
      for p in delta["variants"]["drawn-worker"]["parts"]
      if p["batchId"] == "restored-asphalt-2--7"
    )
    # Despite that low interior, this source face still floats above the actual
    # lower rail floor. Its precise retirement and full outside stay mandatory.
    self.assertIn(1445, asphalt["retire"])

  def test_retained_archive_replays_profiles_and_complete_road_words_without_session_paths(
    self,
  ):
    source = b.retained_inputs()
    old = b.RAW, b.CAPTURE, b.OUT
    expected = b.profile_sources()
    try:
      b.RAW = Path("/nonexistent/v309/raw")
      b.CAPTURE = Path("/nonexistent/v309/capture")
      b.OUT = Path("/nonexistent/v309/output")
      actual = b.profile_sources()
      self.assertEqual(
        [(s["line"].wkt, s["domain"].wkt, s["stations"]) for s in actual],
        [(s["line"].wkt, s["domain"].wkt, s["stations"]) for s in expected],
      )
      self.assertEqual(
        b.read(b.CAPTURE / "core-predecessor/drawn-worker.json"),
        source["workerRoadCapture"],
      )
      self.assertEqual(
        b.read(b.OUT / "gesundbrunnen-curb-ink-actual-v309.json"),
        source["curbInkCapture"],
      )
      self.assertEqual(
        b.sha(b.OUT / "gesundbrunnen-curb-ink-actual-v309.json"),
        source["curbInkCaptureSha256"],
      )
    finally:
      b.RAW, b.CAPTURE, b.OUT = old


if __name__ == "__main__":
  unittest.main()
