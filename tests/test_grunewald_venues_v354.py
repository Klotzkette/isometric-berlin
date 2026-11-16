"""Full measured sources, independent Native cells and unchanged lake geography."""

import base64
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

import numpy as np

from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_grunewald_venues_v354 import fingerprint

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def oriented_key(rows):
  points = tuple(tuple(int(v) for v in p) for p in rows)
  return min(points, points[1:] + points[:1], points[2:] + points[:2])


def test_complete_source_surfaces_and_exact_replacements():
  evidence = read(GEO / "grunewald-venues-v354-source.json.gz")
  index = read(DATA / "grunewaldVenuesV354Index.json")
  parents = {p["id"]: p for p in evidence["originalParents"]}
  assert set(parents) == {"DEBE06YYA000044F", "DEBE06YYA0000LNp", "DEBE06YYA000377J"}
  assert [len(parents[p]["parts"]) for p in sorted(parents)] == [4, 7, 1]
  assert len(index["sources"]) == 2
  assert sum(len(s["keys"]) for s in index["sources"]) == 6
  all_plans = {}
  for row in index["sources"]:
    raw = (DATA / row["file"]).read_bytes()
    assert hashlib.sha256(raw).hexdigest() == row["sha256"]
    assert len(raw) == row["compressedBytes"] < 512 * 1024
    assert len(gzip.decompress(raw)) == row["decodedBytes"] < 2 * 1024 * 1024
    source = read(DATA / row["file"])
    assert source["keys"] == row["keys"]
    all_plans.update(source["packets"])
  for report in evidence["reports"]:
    plan = all_plans[report["key"]]
    for old in report["oldBodyProof"]:
      assert old["roofDifference"] < 0.005
      assert abs(old["wallArea"] - old["expectedWallArea"]) < 0.02
    for site in report["sites"]:
      assert site["foundationLow"] <= site["minimumGroundSample"]
      assert site["groundSupportSamples"] > 0
      assert site["openings"] > 0
    if not report["key"].startswith("drawn:"):
      continue
    mesh = plan["append"]
    ps = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    observed = Counter(oriented_key(t) for t in ps[ix])
    for site in report["sites"]:
      for parent in parents.values():
        for part in parent["parts"]:
          if part["id"] not in site["parts"]:
            continue
          for surface in part["surfaces"]:
            for triangle in triangles_for(surface["rings"]):
              translated = np.array(triangle) + [0, site["sourceTranslationY"], 0]
              q = np.rint((translated - plan["origin"]) * 100).astype(int)
              if len({tuple(v) for v in q}) < 3:
                continue
              key = oriented_key(q)
              assert observed[key] > 0, (site["key"], part["id"])
              observed[key] -= 1
  for key, plan in all_plans.items():
    assert fingerprint(plan["append"]) == plan["appendFingerprint"]
    assert plan["owners"]
    if key.startswith("minecraft:"):
      ps = np.frombuffer(base64.b64decode(plan["append"]["positions"]), "<u2").reshape(
        -1, 3
      )
      ix = np.frombuffer(base64.b64decode(plan["append"]["indices"]), "<u4").reshape(
        -1, 3
      )
      points = ps.astype(float) / 100 + plan["origin"]
      assert np.max(np.abs(points - np.rint(points))) < 1e-6
      assert all(np.any(np.ptp(t, axis=0) == 0) for t in ps[ix])


def test_water_rings_holes_levels_and_fen_distinctions_are_retained():
  audit = read(GEO / "grunewald-geography-v354-audit.json.gz")
  for path, pin in audit["protectedFiles"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == pin
  original = read(GEO / "grunewald-terrain-v190.json")
  rows = original["lakes"] + original["additionalWater"]
  assert len(rows) == len(audit["existingWater"]) == 37
  for before, after in zip(rows, audit["existingWater"], strict=True):
    for key in ["sourceId", "name", "waterY", "geometry"]:
      assert before[key] == after[key]
  statuses = {r["status"] for r in audit["geographicDistinctions"]}
  assert {
    "wetland-not-new-open-lake",
    "buried-connection-not-visible-water",
    "boundary-or-station-not-water",
  } <= statuses
  assert all("geometry" in r for r in audit["geographicDistinctions"])
