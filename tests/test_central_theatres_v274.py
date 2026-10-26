"""The roof correction keeps complete source evidence and bounded static cells."""

import base64
import gzip
import hashlib
import json
import math
import struct

import pytest
from shapely.geometry import Polygon

from scripts.build_central_theatres_v274 import DATA, GEO, ROOT, build, palast


@pytest.fixture(scope="module")
def evidence():
  return json.loads(
    gzip.decompress((GEO / "central-theatres-v274-evidence.json.gz").read_bytes())
  )


@pytest.fixture(scope="module")
def runtime():
  return json.loads((DATA / "centralTheatresV274.json").read_text())


def unpack(text):
  b = base64.b64decode(text)
  nums = struct.unpack(f"<{len(b) // 4}f", b)
  return [nums[i : i + 8] for i in range(0, len(nums), 8)]


def footprint(row):
  x, _, z, w, _, d, yaw, *_ = row
  c, s = math.cos(yaw), -math.sin(yaw)
  return Polygon(
    [
      (x + c * u - s * v, z + s * u + c * v)
      for u, v in [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
    ]
  )


def test_deterministic_replay_and_complete_46_parts(evidence, runtime):
  assert runtime == build(evidence)
  assert {k: len(v["parts"]) for k, v in evidence["parents"].items()} == {
    "deutsches": 15,
    "kammer": 12,
    "ensemble": 4,
    "boell": 2,
    "palast": 13,
  }
  for path, digest in evidence["sourceBindings"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  for parent in evidence["parents"].values():
    for part in parent["parts"]:
      assert part["ring"] and part["surfaces"]


def test_palast_correction_is_bounded_and_high_plateau_is_supported(evidence, runtime):
  s = runtime["stage"]
  assert (s["width"], s["depth"], s["topY"] - 5.2) == (31, 23, 32)
  assert "not surveyed" in evidence["heightPolicy"]
  assert len(evidence["palastBdomSamples"]) == 56
  high = [p for p in evidence["palastBdomSamples"] if p["nhn"] > 65]
  assert len(high) >= 5
  assert all(
    abs(p["u"] - s["u"]) < s["width"] / 2 and abs(p["v"] - s["out"]) < s["depth"] / 2
    for p in high
  )
  assert any(p["v"] == -48 and p["nhn"] < 56 for p in evidence["palastBdomSamples"])
  boundary = Polygon(
    [
      [p[0], p[2]]
      for p in [
        palast(s["u"] + u, 0, s["out"] + v)
        for u, v in [(-15.5, -11.5), (15.5, -11.5), (15.5, 11.5), (-15.5, 11.5)]
      ]
    ]
  )
  for mode in ["drawn", "native"]:
    rows = unpack(runtime[mode]["palast"])
    assert all(boundary.buffer(0.55).covers(footprint(r)) for r in rows)
    assert max(r[1] + r[4] / 2 for r in rows) == pytest.approx(s["capY"], abs=1e-4)


def test_only_old_stage_roles_are_receipted(evidence):
  expected = {
    "stage-tower-body",
    "stage-tower-coping",
    "stage-tower-panel-joint",
    "stage-ventilation",
    "stage-roof-seam",
  }
  assert set(evidence["previousPalastPlans"]) == {
    "full:false",
    "full:true",
    "mobile:false",
    "mobile:true",
  }
  for plan in evidence["previousPalastPlans"].values():
    assert {b["role"] for boxes in plan.values() for b in boxes} == expected
    assert len(plan["sign"]) == 0


def test_additions_fit_existing_owners_and_keep_volksbuehne_tower(evidence, runtime):
  parts = {
    p["id"]: Polygon(p["ring"])
    for v in evidence["parents"].values()
    for p in v["parts"]
  }
  vb = json.loads((DATA / "volksbuehneEnvelopeV209.json").read_text())
  parts[vb["owner"]] = Polygon(vb["rings"][0])
  for row in runtime["sourceBoxes"]["other"]:
    assert parts[runtime["owners"][row[9]]].buffer(0.5).covers(footprint(row))
  assert [v["topY"] for v in vb["volumes"]] == [42.254, 28.889, 33.019]
  roles = [runtime["roles"][r[8]] for r in runtime["sourceBoxes"]["other"]]
  assert roles.count("Volksbuhne stage parapet") == 4
  assert "Boll raised atrium cover rim" in roles
  assert "DT measured stage roof cornice" in roles


def test_native_support_uses_actual_retained_upper_columns(evidence, runtime):
  cols = evidence["nativeRoofColumns"]["columns"]
  assert max(c[3] for c in cols if 750 < c[0] < 770 and -620 < c[1] < -595) == 33.2
  assert max(c[3] for c in cols if 980 < c[0] < 1000 and -335 < c[1] < -320) == 28.1
  for mode, maximum in [("drawn", 200), ("native", 4000)]:
    all_rows = []
    for family in ["palast", "other"]:
      rows = unpack(runtime[mode][family])
      assert len(rows) == runtime["counts"][mode][family]
      assert all(all(math.isfinite(v) for v in r) and min(r[3:6]) > 0 for r in rows)
      all_rows += rows
    assert len(all_rows) < maximum
    if mode == "native":
      assert all(r[6] == 0 for r in all_rows)
  assert (DATA / "centralTheatresV274.json").stat().st_size < 220_000


def test_generator_binds_full_retained_source_not_only_parts(evidence):
  archive = ROOT / evidence["archive"]["path"]
  assert (
    hashlib.sha256(archive.read_bytes()).hexdigest() == evidence["archive"]["sha256"]
  )
  from isometric_berlin.data.fetch_lod2 import leaf_building_parts
  from scripts.build_bebelplatz_building_source import extract_parent, part_profile

  for parent in evidence["parents"].values():
    raw = extract_parent(archive, parent["id"])
    assert [part_profile(p) for p in leaf_building_parts(raw) or [raw]] == parent[
      "parts"
    ]
