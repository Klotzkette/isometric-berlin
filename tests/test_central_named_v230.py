"""Finite source scope, true roof retention and independent native recognizability."""

import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
sys.path.insert(0, str(ROOT / "scripts"))
from build_breitscheid_towers_v161 import triangles_for  # noqa: E402


def read(p):
  return json.loads(p.read_text())


def test_only_named_sites_and_immutable_sources():
  evidence = read(GEO / "central-named-v230-evidence.json")
  for path, digest in evidence["sourceHashes"].items():
    p = ROOT / path
    if "/raw/" in path and not p.exists():
      continue
    assert hashlib.sha256(p.read_bytes()).hexdigest() == digest
  sites = read(DATA / "centralNamedV230.json")["sites"]
  assert {s["key"] for s in sites} == {
    "wasserturm",
    "kollwitzplatz",
    "choriner-hoefe",
    "weinbergsweg-east",
    "john-lennon-gymnasium",
  }
  assert (
    next(s for s in sites if s["key"] == "john-lennon-gymnasium")["recognition"][
      "terrainOffsetY"
    ]
    == 6.91
  )
  source = read(GEO / "central-named-v230-source.json")
  block = shape(source["blockBoundary"])
  assert len(source["quarter"]) == 20
  for owner in source["quarter"]:
    assert block.covers(shape(owner["footprint"]).representative_point())
  for s in sites:
    if s["key"] in {"choriner-hoefe", "weinbergsweg-east", "john-lennon-gymnasium"}:
      assert s["recognition"]["newWindowGrids"] == 0
  assert (
    sum(
      (DATA / f).stat().st_size
      for f in [
        "centralNamedV230.json",
        "centralNamedV230Envelopes.json",
        "centralNamedV230Native.json",
        "centralNamedV230Navigation.json",
        "centralNamedV230Ownership.json",
      ]
    )
    < 600000
  )


def test_each_shallow_addition_stays_on_actual_wall_and_existing_aperture_axes():
  evidence = read(GEO / "central-named-v230-evidence.json")
  sites = read(DATA / "centralNamedV230.json")["sites"]
  count = 0
  for s in sites:
    for f in evidence["faces"][s["key"]]:
      pts = np.array(f["rings"][0])
      a, b = max(
        ((a, b) for a in pts for b in pts),
        key=lambda p: np.linalg.norm((p[1] - p[0])[[0, 2]]),
      )
      d = np.array([b[0] - a[0], 0, b[2] - a[2]])
      d /= np.linalg.norm(d)
      rings = [[[float((np.array(p) - a) @ d), p[1]] for p in r] for r in f["rings"]]
      wall = Polygon(rings[0], rings[1:]).buffer(0.003)
      for i in f["boxes"]:
        r = s["boxes"][i]
        u = (np.array(r[:3]) - a) @ d
        assert wall.covers(
          box(u - r[3] / 2, r[1] - r[4] / 2, u + r[3] / 2, r[1] + r[4] / 2)
        ), s["key"]
        assert r[5] <= 0.1
        count += 1
  assert count > 700


def test_complete_water_tower_source_sheets_and_real_slopes_survive():
  raw = read(GEO / "central-named-v230-source.json")["water"][0]
  drawn = read(DATA / "centralNamedV230Envelopes.json")["sites"][0]
  assert len(raw["surfaces"]) == len(drawn["surfaces"]) == 125
  shift = 3 - raw["ground_y_m"]
  for old, new in zip(raw["surfaces"], drawn["surfaces"], strict=True):
    translated = [[[p[0], p[1] + shift, p[2]] for p in r] for r in old["rings"]]
    assert new["sourceKind"] == old["kind"]
    assert new["triangles"] == triangles_for(translated)
  roof = [s for s in drawn["surfaces"] if s["sourceKind"] == "RoofSurface"]
  assert len(roof) == 4
  y = [p[1] for s in roof for t in s["triangles"] for p in t]
  assert max(y) - min(y) > 7.5
  nav = read(DATA / "centralNamedV230Navigation.json")["sites"][0]
  assert nav["owners"][0]["ring"] == raw["ring"]
  assert nav["owners"][0]["holes"] == raw["holes"]
  assert nav["owners"][0]["low"] == 3
  assert math.isclose(nav["owners"][0]["high"], 43.842)
  ownership = read(DATA / "centralNamedV230Ownership.json")
  assert (
    ownership["authorizedOwners"] == ["DEBE03YY600002e7"] and not ownership["blocked"]
  )
  assert {r["mode"] for r in ownership["records"]} == {"drawn", "minecraft"}
  assert sum(len(r["triangles"]) for r in ownership["records"]) == 476


def test_kollwitz_real_mapped_benches_and_barrier_scope():
  source = read(GEO / "central-named-v230-source.json")["kollwitz"]
  site = next(
    s
    for s in read(DATA / "centralNamedV230.json")["sites"]
    if s["key"] == "kollwitzplatz"
  )
  benches = [p for p in source["points"] if p["tags"].get("amenity") == "bench"]
  assert site["recognition"]["mappedBenches"] == len(benches) == 8
  for p in benches:
    assert any(
      abs(r[0] - p["p"][0]) < 0.001 and abs(r[2] - p["p"][1]) < 0.001 and r[1] == 3.47
      for r in site["boxes"]
    )
  assert {b["id"] for b in source["barriers"]} == {"321034937", "321034938"}
  assert site["recognition"]["osmSculpture"] == "node/603037654"
