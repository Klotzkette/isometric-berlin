"""Exact source transfer, facade roles and independent orthogonal native proof."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
S = json.loads(
  gzip.decompress(
    (ROOT / "geo_data/regierungsviertel/press-quarter-v272-source.json.gz").read_bytes()
  )
)
R = json.loads((ROOT / "src/app/src/data/pressQuarterV272.json").read_text())


def test_original_prism_bytes_and_selected_full_parts_survive():
  path = ROOT / S["legacyFile"]
  assert hashlib.sha256(path.read_bytes()).hexdigest() == S["legacyFileSha256"]
  current = {r["id"]: r for r in json.loads(path.read_text())["buildings"]}
  assert len(S["legacyPrisms"]) == 7
  for row in S["legacyPrisms"]:
    assert current[row["id"]] == row
  assert len(S["parts"]) == 13
  assert len({r["id"] for r in S["parts"]}) == 13
  assert {p["kind"] for p in S["parents"]} == {"gold", "silver", "taz", "old-taz"}
  assert {p["id"] for p in S["parts"] if p["parentId"] == "DEBE02YY4000042k"} == {
    "DEBE3DZjmMEK2SZD",
    "DEBE3DUspil8YjZO",
  }
  # Same official footprint sits inside the exact prior highrise owner, not the
  # similarly named hospital Springer building several kilometres north.
  tower = next(r for r in S["legacyPrisms"] if r["id"] == "32698103")
  foot = Polygon([(x / 10, z / 10) for x, z in tower["ring"]])
  assert foot.covers(Point(1720, 1295))
  assert not foot.covers(Point(140, -1800))


def test_measured_triangles_are_exact_and_native_is_surface_only():
  positions = np.frombuffer(
    base64.b64decode(R["sourcePositions"]), dtype="<f4"
  ).reshape(-1, 3, 3)
  assert np.array_equal(
    positions, np.array([t for s in S["surfaces"] for t in s["triangles"]], dtype="<f4")
  )
  cells = np.frombuffer(base64.b64decode(R["nativeBoxes"]), dtype="<f4").reshape(-1, 8)
  assert np.all(cells[:, 6] == 0)
  assert np.all(cells[:, 3:6] > 0)
  assert np.isfinite(cells).all()
  count = len(S["nativeBlocks"])
  assert np.array_equal(
    cells[:count], np.asarray([r[:8] for r in S["nativeBlocks"]], dtype="<f4")
  )
  keys = {
    tuple(int(np.floor(v / 2)) for v in (r[0], r[1], r[2])) for r in S["nativeBlocks"]
  }
  for s in S["surfaces"]:
    for tri in s["triangles"]:
      for v in tri:
        assert tuple(int(np.floor(x / 2)) for x in v) in keys


def test_sites_remain_distinct_and_have_their_recognition_features():
  art = S["artwork"]
  assert art["osmKey"] == "node/7599829392" and art["artist"] == "Peter Lenk"
  assert art["anchor"] == [1344.494, 1394.729]
  assert R["roles"]["gold-window"] > 100
  assert R["roles"]["silver-window"] > 100
  assert R["roles"]["taz-glass"] > 100
  assert sum(r[4] == "taz-diamond-steel-screen" for r in S["ribSegments"]) > 100
  assert any(r[4] == "lenk-vertical-satirical-relief" for r in S["ribSegments"])
  assert {label["text"] for label in R["labels"]} == {
    "AXEL SPRINGER",
    "TAZ",
    "FRIEDE SEI MIT DIR",
  }
  assert R["counts"]["streetBuildings"] > 100
  assert R["roles"]["koch-friedrich-shopfront"] > 100
  # All ordinary street details retain exact prior source IDs; no synthetic buildings.
  owners = {p["id"] for p in S["streetPrisms"]}
  assert all(
    r[9] in owners for r in S["facadeBoxes"] if r[8].startswith("koch-friedrich")
  )


def test_retirement_matches_required_factory_and_both_navigation_modes():
  app = ROOT / "src/app/src"
  assert (
    "createPressQuarterV272(native)"
    in (app / "RequiredSiteEnvelopesV209.ts").read_text()
  )
  assert (
    "...PRESS_QUARTER_V272_PRISM_IDS" in (app / "IsometricCityWorld.ts").read_text()
  )
  assert (
    "!pressQuarterV272SourceColumn(" in (app / "MinecraftVoxelWorld.ts").read_text()
  )
  nav = (app / "pedestrianNavigation.ts").read_text()
  assert "PRESS_QUARTER_V272_PRISM_IDS.has(building.id)" in nav
  assert 'pressQuarterV272RoofAt(x,z,visualMode() === "minecraft")' in nav
  assert (
    'entry.osm_key === "node/7599829392"'
    in (app / "TiergartenMonuments.ts").read_text()
  )
