"""Photo-bound frontage changes retain complete existing shells and navigation."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import LineString, Point

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
KIND = "rote-insel-corridors-v354"


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def plans():
  return {
    key: plan
    for row in read(DATA / "roteInselCorridorsV354Index.json")["sources"]
    for key, plan in read(DATA / row["file"])["packets"].items()
  }


def triangles(mesh, origin):
  p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  c = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
  i = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return p[i] / 100 + origin, c[i]


def test_exact_photo_profiles_and_public_address_bindings():
  source = read(GEO / f"{KIND}-source.json.gz")
  ps = {r["profile"]["key"]: r["profile"] for r in source["profiles"]}
  assert len(ps) == 15 and len({p["owner"] for p in ps.values()}) == 14
  assert (ps["leber65"]["levels"], ps["leber65"]["bays"]) == (5, 8)
  assert (ps["leber32"]["levels"], ps["leber32"]["bays"]) == (5, 8)
  assert ps["leber32"]["balcony"] == [1, 6]
  assert ps["yorck47"]["levels"] == ps["yorck48"]["levels"] == 6
  assert ps["hohen44"]["levels"] == ps["hohen45"]["levels"] == 4
  for row in source["profiles"]:
    profile = row["profile"]
    raw = read(PUBLIC / f"{profile['host']}.drawn.json.gz")
    assert row["sourceRecord"] in raw["nav"]["buildings"]
    assert row["sourceRecord"]["sourceId"] == profile["owner"]
    for address in row["addressRecords"]:
      assert set(address) == {"id", "geometry", "tags", "bindings"}
      assert set(address["tags"]) <= {
        "addr:street",
        "addr:housenumber",
        "building:levels",
      }
      assert all(b["owner"] == profile["owner"] for b in address["bindings"])


@pytest.mark.parametrize("mode", ["drawn", "minecraft"])
def test_every_retired_generic_triangle_has_exact_archival_position_and_colour(mode):
  receipt = read(GEO / f"{KIND}-retirement.json.gz")
  rows = [r for r in receipt if r["mode"] == mode]
  indexed = {(r["host"], r["mesh"], r["triangle"]): r for r in rows}
  assert len(indexed) == len(rows) > 0
  for key, plan in plans().items():
    if not key.startswith(mode + ":"):
      continue
    host = key.split(":", 1)[1]
    raw = read(PUBLIC / f"{host}.{mode}.json.gz")
    assert plan["retireNav"] == plan["appendNav"] == plan["retireLines"] == []
    for change in plan["retire"]:
      mesh = raw["meshes"][change["mesh"]]
      assert mesh["kind"] == "district-facades-v188"
      p, c = triangles(mesh, np.array(raw["origin"]))
      for ti in change["triangles"]:
        row = indexed.pop((host, change["mesh"], ti))
        assert row["owner"] in plan["owners"]
        np.testing.assert_allclose(row["positions"], p[ti], atol=1e-8)
        np.testing.assert_array_equal(row["colors"], c[ti])
  assert not indexed


def test_native_relief_is_independently_cardinal_and_all_transfers_have_replacements():
  recipes = plans()
  assert len(recipes) == 18
  assert {k.split(":", 1)[1] for k in recipes if k.startswith("drawn:")} == {
    k.split(":", 1)[1] for k in recipes if k.startswith("minecraft:")
  }
  for key, plan in recipes.items():
    assert plan["append"]["kind"] == KIND
    assert len(base64.b64decode(plan["append"]["indices"])) > 0
    if key.startswith("minecraft:"):
      p, _ = triangles(plan["append"], np.array(plan["origin"]))
      q = np.rint(p * 100).astype(np.int64)
      normals = np.cross(q[:, 1] - q[:, 0], q[:, 2] - q[:, 0])
      assert np.all(np.sum(normals != 0, axis=1) <= 1)
      peer = recipes[key.replace("minecraft:", "drawn:", 1)]
      assert plan["append"]["positions"] != peer["append"]["positions"]


def test_bounded_payloads_and_all_thirty_independent_support_receipts():
  validation = read(GEO / f"{KIND}-validation.json.gz")
  assert validation["profiles"] == 15 and validation["owners"] == 14
  assert len(validation["faces"]) == 30
  assert all(r["supportedAreaM2"] > 0 for r in validation["faces"])
  assert len({(r["mode"], r["key"]) for r in validation["faces"]}) == 30
  assert (
    validation["sourceSha256"]
    == hashlib.sha256((GEO / f"{KIND}-source.json.gz").read_bytes()).hexdigest()
  )
  compressed = 0
  for row in read(DATA / "roteInselCorridorsV354Index.json")["sources"]:
    payload = (DATA / row["file"]).read_bytes()
    compressed += len(payload)
    assert len(payload) < 512 * 1024
    assert len(gzip.decompress(payload)) == row["decodedBytes"] < 2 * 1024 * 1024
  assert compressed == validation["compressedBytes"]


def test_retired_generic_fronts_never_include_side_or_courtyard_faces():
  records = read(GEO / f"{KIND}-source.json.gz")["profiles"]
  changed = 0
  for record in records:
    p = record["profile"]
    selected = LineString([p["a"], p["b"]])
    for old in p["generic"]:
      changed += 1
      assert old["owner"] == p["owner"]
      assert selected.distance(Point(old["a"])) < 0.05
      assert selected.distance(Point(old["b"])) < 0.05
  assert changed == 6


def test_broader_inventory_is_public_address_evidence_not_a_completeness_claim():
  inventory = read(GEO / f"{KIND}-addresses.json.gz")
  rows = inventory["rows"]
  assert len({r["id"] for r in rows}) == len(rows)
  assert all(r["id"].startswith("node/") for r in rows)
  for r in rows:
    assert set(r) == {"id", "geometry", "tags", "hosts", "outcome"}
    assert r["geometry"]["type"] == "Point"
    assert set(r["tags"]) <= {"addr:street", "addr:housenumber", "building:levels"}
    assert all(set(h) == {"host", "owner"} for h in r["hosts"])
    assert (r["outcome"] == "retained-family-at-address") == bool(r["hosts"])
  assert inventory["streets"]["Yorckstraße"] == {
    "retained-family-at-address": 95,
    "no-retained-family-at-address": 14,
  }
  assert inventory["streets"]["Hohenzollerndamm"] == {
    "retained-family-at-address": 176,
    "no-retained-family-at-address": 107,
  }
