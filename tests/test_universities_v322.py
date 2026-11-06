"""Independent completeness, geographic-scope and exact-input controls."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)


def test_complete_selected_official_families_and_preserved_authored_neighbours():
  source = read(GEO / "universities-v322-source.json.gz")
  profile = read(DATA / "universitiesArchitectureV322.json")
  assert len(profile["sites"]) == 18
  parts = {
    p["id"]
    for site in source["sites"].values()
    for family in site["families"]
    for p in family["parts"]
  }
  displayed = [identity for site in profile["sites"] for identity in site["partIds"]]
  assert len(displayed) == len(set(displayed)) == 485
  assert len([p for p in displayed if p in parts]) == 483
  for site in profile["sites"]:
    if site["key"] == "ash-extension":
      assert len(site["partIds"]) == 2
      continue
    expected = {
      p["id"]
      for family in source["sites"][site["key"]]["families"]
      if family["id"] in site["parents"]
      for p in family["parts"]
    }
    assert set(site["partIds"]) == expected
  parents = {p for s in profile["sites"] for p in s["parents"]}
  assert not parents & {
    "DEBE01YYK00007Xu",
    "DEBE04YY500006Rw",
    "DEBE06YYB00009Fd",
    "DEBE01YYK0003uL0",
  }
  bht = source["sites"]["bht-wedding"]["families"]
  atze = next(f for f in bht if f["id"] == "DEBE01YYK0003uL0")
  atze_shape = unary_union([Polygon(p["ring"], p["holes"]) for p in atze["parts"]])
  for family in bht:
    if family["id"] in parents:
      assert (
        unary_union([Polygon(p["ring"], p["holes"]) for p in family["parts"]])
        .intersection(atze_shape)
        .area
        == 0
      )


def test_official_archives_stay_exact_and_new_metric_surfaces_keep_f32_normals():
  source = read(GEO / "universities-v322-source.json.gz")
  for archive in source["archives"]:
    assert (
      hashlib.sha256((ROOT / archive["path"]).read_bytes()).hexdigest()
      == archive["sha256"]
    )
  profile = read(DATA / "universitiesArchitectureV322.json")
  for model in profile["models"]:
    if model["native"]:
      assert len(model["columns"]) == 6
      assert all(
        len(base64.b64decode(c)) == model["count"] * 2 for c in model["columns"]
      )
      continue
    assert model["positionType"] == "f32"
    positions = np.frombuffer(base64.b64decode(model["positions"]), "<f4").reshape(
      -1, 3
    )
    normals = np.frombuffer(base64.b64decode(model["normals"]), "<f4").reshape(-1, 3)
    assert positions.shape == normals.shape
    assert np.isfinite(positions).all() and np.isfinite(normals).all()
    assert np.allclose(np.linalg.norm(normals, axis=1), 1, rtol=0, atol=1e-6)


def test_new_ground_is_only_exact_named_campus_complement_and_keeps_holes():
  source = read(GEO / "universities-v322-source.json.gz")
  evidence = read(GEO / "universities-v322-scope-complement.json.gz")
  assert len(evidence["sites"]) == 5
  for row in evidence["sites"]:
    campus = unary_union(
      [shape(m["geometry"]) for m in source["sites"][row["site"]]["mapped"]]
    )
    added = shape(row["geometry"])
    assert added.difference(campus).area < 1e-7
    assert abs(campus.area - row["oldScopeOverlapM2"] - added.area) < 1e-6
    assert abs(added.area - row["newOnlyAreaM2"]) < 1e-7
  profile = read(DATA / "universitiesArchitectureV322.json")
  assert any(p["holes"] for p in profile["navigation"] if "new-ground" not in p["id"])
  current_ash = [
    p
    for p in profile["navigation"]
    if p["site"] == "ash-extension" and "new-ground" not in p["id"]
  ]
  assert max(p["topY"] - p["groundY"] for p in current_ash) == 39
  ash_mapped = source["sites"]["ash-extension"]["mapped"]
  assert [row["id"] for row in ash_mapped] == [
    "way/1227439417",
    "way/982919760",
  ]
  ash_body = unary_union([Polygon(p["ring"], p["holes"]) for p in current_ash])
  assert ash_body.symmetric_difference(shape(ash_mapped[0]["geometry"])).area == 0
  ash_floor = unary_union(
    [
      Polygon(p["ring"], p["holes"])
      for p in profile["navigation"]
      if p["site"] == "ash-extension" and "new-ground" in p["id"]
    ]
  )
  court = shape(ash_mapped[1]["geometry"]).difference(ash_body)
  assert court.area > 1000 and court.difference(ash_floor).area < 1e-7


def test_every_streamed_retirement_has_full_original_recipe_and_foreign_complement():
  packets = read(DATA / "universitiesV322Packets.json")
  evidence = read(GEO / "universities-v322-packet-evidence.json.gz")
  assert packets["keys"] == list(packets["packets"])
  assert len(packets["keys"]) == 33
  assert len(evidence["targets"]) == 62
  assert sum(p["retiredTriangles"] for p in evidence["packets"]) == 24463
  assert sum(p["retiredLines"] for p in evidence["packets"]) == 1669
  for plan in packets["packets"].values():
    assert (
      plan["records"]
      and plan["preparedRecords"]
      and plan["navGuard"]
      and plan["preparedNavGuard"]
    )
    assert plan["owners"] and plan["retire"] and plan["retireNav"]
    assert plan["appendNav"] == []
    for record in plan["retire"]:
      assert sorted(set(record["triangles"])) == record["triangles"]
  plans = read(DATA / "universitiesPreviousV322.json")["plans"]
  assert all(len(p["owners"]) == 21 for p in plans.values())
  assert all(o["retireBody"] for p in plans.values() for o in p["owners"])
