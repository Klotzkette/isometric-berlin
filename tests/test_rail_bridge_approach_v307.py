"""Source-exact finite road context and explicit measured/estimated separation."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import LineString, shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_rail_bridge_approach_v307 import pavement_at  # noqa: E402

D = ROOT / "src/app/src/data"
G = ROOT / "geo_data/regierungsviertel"


def read(p):
  b = p.read_bytes()
  return json.loads(gzip.decompress(b) if p.suffix == ".gz" else b)


def arrays(q):
  return np.frombuffer(base64.b64decode(q["positions"]), "<u2").reshape(
    -1, 3
  ), np.frombuffer(base64.b64decode(q["indices"]), "<u4").reshape(-1, 3)


def test_measured_48m_core_and_estimated_gentle_c1_join_are_separate():
  p = read(D / "railBridgeApproachV307Profile.json")
  line = LineString(p["line"])
  domain = shape(p["domain"])
  assert p["measuredLengthM"] == pytest.approx(48.24463678135497)
  assert p["fitEndM"] == pytest.approx(216.2633799443926)
  assert (
    64000 < domain.area < 66000
    and p["pavementFit"]["method"] == "cubic-Hermite-display-datum-fit"
  )
  for station, y in p["pavement"]:
    xy = line.interpolate(station)
    assert pavement_at(p, xy.x, xy.y) == pytest.approx(y, abs=1e-7)
  xs = np.linspace(p["measuredLengthM"], p["fitEndM"], 2001)
  ys = np.array([pavement_at(p, *line.interpolate(s).coords[0]) for s in xs])
  assert np.all(np.diff(ys) <= 1e-7)
  assert max(abs(np.diff(ys) / np.diff(xs))) < 0.15
  assert ys[0] == pytest.approx(17.8) and ys[-1] == pytest.approx(3.09)
  assert (ys[1] - ys[0]) / (xs[1] - xs[0]) == pytest.approx(
    p["pavementFit"]["startSlope"], abs=0.0001
  )


def test_original_frozen_contact_packets_and_lower_floor_are_byte_identical():
  for name, want in {
    "railTerrainContactV307.json": "9a111b6becfe23af91d1e4143f1a6f06522a539f4ea39ef8e55294acd6b6310e",
    "railTerrainContactV307Packets.json": "b6a2c13dcb068e92ede35b7e6887c54b5c4150aff65891bfb246436ff0095ec7",
    "railBridgeUnderdeckV307.json": "9ea6b0b5ba6b547208d8369cca3174186508b9fcc27a994fe3ffe45e2a08d6c4",
  }.items():
    assert hashlib.sha256((D / name).read_bytes()).hexdigest() == want


@pytest.mark.parametrize(
  "name,collection",
  [
    ("railBridgeApproachV307Ground.json", "meshes"),
    ("railBridgeApproachV307Bodies.json", "models"),
    ("railBridgeApproachV307Pavement.json", "models"),
    ("railBridgeUnderdeckApproachV309.json", "models"),
  ],
)
def test_native_faces_are_independent_cardinal_geometry(name, collection):
  data = read(D / name)
  for q in data[collection]:
    p, ix = arrays(q)
    assert len(ix) == q["triangles"] and len(p) == q["vertices"]
    assert int(ix.max()) < len(p)
    if q["native"]:
      assert np.all(np.any(np.ptp(p[ix], axis=1) == 0, axis=1)), q["key"]


def test_whole_source_houses_and_exact_old_nav_are_rigidly_transferred():
  source = read(G / "rail-bridge-approach-v307-source.json.gz")
  plans = read(D / "railBridgeApproachV307Packets.json")["packets"]
  bodies = read(D / "railBridgeApproachV307Bodies.json")
  assert len(source["wholeHouseOwners"]) == 39
  assert len({o for plan in plans.values() for o in plan["owners"]}) == 39
  assert len(bodies["models"]) == 8
  for key, plan in plans.items():
    assert len(plan["retireNav"]) == len(plan["appendNav"])
    for old, new in zip(plan["retireNav"], plan["appendNav"], strict=True):
      assert old["ring"] == new["ring"] and old["holes"] == new["holes"]
      assert old.get("roofTriangles") == new.get("roofTriangles") and old.get(
        "nativeRoofCaps"
      ) == new.get("nativeRoofCaps")
      assert new["groundOffset"] >= old.get("groundOffset", 0)


def test_ground_house_and_bridge_transfers_have_disjoint_source_ordinals():
  sources = [
    read(D / f)["packets"]
    for f in [
      "railTerrainContactApproachV309Packets.json",
      "railBridgeApproachV307Packets.json",
    ]
  ]
  seen = set()
  for catalog in sources:
    for key, plan in catalog.items():
      for part in plan["retire"]:
        for ordinal in part["triangles"]:
          row = (key, part["mesh"], ordinal)
          assert row not in seen, row
          seen.add(row)


def test_every_rendered_bottom_has_actual_retained_support_at_its_boundary():
  from audit_rail_bridge_approach_contacts_v307 import audit_approach_contacts_v307

  for mode in audit_approach_contacts_v307():
    assert mode["samples"] > 5000
    assert mode["missingCount"] == 0, mode
    assert mode["maxGap"] < -0.02, mode


def test_clipped_domain_boundary_roundoff_never_reverts_to_the_legacy_datum():
  from build_rail_bridge_approach_v307 import field, grid

  profile = read(D / "railBridgeApproachV307Profile.json")
  checked = 0
  for lower in [False, True]:
    f = field(profile, lower)
    polygons = [f.domain] if f.domain.geom_type == "Polygon" else f.domain.geoms
    for polygon in polygons:
      for ring in [polygon.exterior, *polygon.interiors]:
        for x, z in ring.coords:
          expected = grid(profile, x, z, "lowerOffsets" if lower else "offsets")
          if abs(expected) < 0.1:
            continue
          assert f.sample_offset(x, z, False) == pytest.approx(expected, abs=1e-8)
          assert f.sample_offset(x + 5e-9, z - 5e-9, False) == pytest.approx(
            expected, abs=1e-6
          )
          checked += 1
    assert f.sample_offset(f.bounds[0] - 1, f.bounds[1] - 1, False) == 0
  assert checked > 100
