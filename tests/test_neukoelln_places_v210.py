"""Bounded source preservation, transfer receipts and real runtime budgets."""

import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(p):
  return json.loads(p.read_bytes())


def test_every_original_sheet_is_present_with_one_uniform_parent_datum():
  source = read(GEO / "neukoelln-places-v210-source.json")
  runtime = read(DATA / "neukoellnPlacesV210.json")
  owners = {o["id"]: i for i, o in enumerate(runtime["owners"])}
  measured = [s for s in runtime["surfaces"] if not s.get("estimate")]
  assert len(measured) == sum(
    len(p["surfaces"]) for b in source["buildings"] for p in b["parts"]
  )
  for b in source["buildings"]:
    oi = owners[b["id"]]
    low = runtime["owners"][oi]["sourceGroundY"]
    for p in b["parts"]:
      assert len(p["ring"]) >= 3 and p["surfaces"]
      for si, s in enumerate(p["surfaces"]):
        output = next(
          t
          for t in measured
          if t["owner"] == oi and t["part"] == p["id"] and t["surface"] == si
        )
        original = {
          tuple([v[0], round(v[1] - low + 3, 3), v[2]])
          for ring in s["rings"]
          for v in ring
        }
        actual = {tuple(v) for t in output["triangles"] for v in t}
        assert actual <= original

        def area(ring):
          return (
            np.linalg.norm(
              sum(
                (np.cross(a, b) for a, b in zip(ring, ring[1:] + ring[:1])), np.zeros(3)
              )
            )
            / 2
          )

        expected = area(s["rings"][0]) - sum(area(r) for r in s["rings"][1:])
        found = sum(area(t) for t in output["triangles"])
        assert abs(expected - found) < 0.03, (p["id"], si, expected, found)


def test_exact_seven_owner_transfer_does_not_mutate_old_assets():
  source = read(GEO / "neukoelln-places-v210-source.json")
  receipt = read(DATA / "neukoellnPlacesV210Ownership.json")
  expected = {o["id"] for b in source["buildings"] for o in b["osmOwners"]}
  assert len(expected) == 7
  assert {r["owner"] for r in receipt["records"]} == expected
  for r in receipt["records"] + receipt["lineRecords"]:
    path = (
      ROOT
      / "src/app/public/mesh/surrounding-berlin-v159"
      / f"{r['tile']}.{r['mode']}.json.gz"
    )
    assert hashlib.sha256(path.read_bytes()).hexdigest() == r["sha256"]
  assert {r["mode"] for r in receipt["records"]} == {"drawn", "minecraft"}
  assert {r["owner"] for r in receipt["navigationRecords"]} == expected
  assert (
    receipt["sourceSha256"]
    == hashlib.sha256(
      (GEO / "neukoelln-places-v210-source.json").read_bytes()
    ).hexdigest()
  )


def test_mapped_furniture_current_store_and_independent_budget():
  source = read(GEO / "neukoelln-places-v210-source.json")
  runtime = read(DATA / "neukoellnPlacesV210.json")
  places = {p["key"]: shape(p["geometry"]) for p in source["places"]}
  for p in source["furniture"]:
    assert places[p["site"]].buffer(1).covers(Point(p["position"]))
  assert sum(int(p["tags"]["capacity"]) // 2 for p in source["bicycleParking"]) == 19
  assert all(
    shape(p["geometry"]).intersects(places["hermannplatz"])
    for p in source["bicycleParking"]
  )
  assert (
    len(runtime["shellBlocks"]) < 2500
    and len(runtime["boxes"]) < 2000
    and len(runtime["blocks"]) < 6500
  )
  assert (DATA / "neukoellnPlacesV210.json").stat().st_size < 1000000
  for r in runtime["shellBlocks"] + runtime["blocks"]:
    assert all(np.isfinite(v) for v in r[:7])
    assert min(r[3:6]) > 0
  assert any(r[8] == "store-central-glass" for r in runtime["boxes"])
  assert any(r[8] == "historic-vertical-pier" for r in runtime["boxes"])
  assert {s["part"] for s in runtime["surfaces"] if s.get("estimate")} == {
    "estimated-west-belfry"
  }
  assert source["churchBelfryEstimate"]["wallTopY"] == 19.8


def test_legacy_receipt_retains_all_rows_and_moves_only_obsolete_cornice():
  receipt = read(DATA / "neukoellnPlacesV210Ownership.json")
  for r in receipt["legacyDetailRecords"]:
    old = read(DATA / r["file"])
    rows = old["boxes" if r["mode"] == "drawn" else "nativeRows"]
    assert rows[r["first"] : r["first"] + len(r["original"])] == r["original"]
    assert (
      hashlib.sha256((DATA / r["file"]).read_bytes()).hexdigest() == r["sourceSha256"]
    )
    changes = [
      i for i, (a, b) in enumerate(zip(r["original"], r["replacement"])) if a != b
    ]
    assert changes == ([2] if r["mode"] == "drawn" else list(range(12, 18)))
    for i in changes:
      a, b = r["original"][i], r["replacement"][i]
      assert a[:1] + a[2:] == b[:1] + b[2:]
      assert b[1] == (11.02 if r["mode"] == "drawn" else 11.5)
