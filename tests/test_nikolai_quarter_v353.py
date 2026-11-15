"""Exact ownership and independent retained-surface checks for the house fronts."""

import base64
import gzip
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def triangles(mesh, origin):
  p = (
    np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(-1, 3) / 100
    + origin
  )
  i = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
  c = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
  return [(p[t], c[t]) for t in i]


def plans():
  return {
    k: p
    for s in read(DATA / "nikolaiQuarterV353Index.json")["sources"]
    for k, p in read(DATA / s["file"])["packets"].items()
  }


def test_photo_profiles_are_bounded_and_exclude_the_church():
  source = read(GEO / "nikolai-quarter-v353-source.json.gz")
  assert len(source["profiles"]) == 14
  owners = {p["owner"] for p in source["profiles"]}
  assert len(owners) == 8 and "DEBE01YYK00001VX" not in owners
  ps = {p["key"]: p for p in source["profiles"]}
  assert ps["knoblauch-square"]["blind"] == [1, 4]
  assert ps["knoblauch-post"]["bays"] == 7
  assert ps["lessing-front"]["bays"] == 3
  assert ps["nussbaum-gable"]["levels"] == 2
  assert ps["ephraim-corner"]["levels"] == 4
  original = read(GEO / "nikolaiviertel-v239-source.json.gz")
  assert source["buildings"] == [b for b in original["buildings"] if b["id"] in owners]


@pytest.mark.parametrize("mode", ["drawn", "minecraft"])
def test_each_retired_original_triangle_is_durably_retained(mode):
  recipes = plans()
  receipts = read(GEO / f"nikolai-quarter-v353-{mode}-retirement.json.gz")
  indexed = {(r["host"], r["mesh"], r["triangle"]): r for r in receipts}
  assert len(indexed) == len(receipts)
  for host in ["4_0", "nikolai239-4_0"] + (
    ["4_0-alt-mitte-v169-1"] if mode == "drawn" else []
  ):
    plan = recipes[f"{mode}:{host}"]
    if host == "4_0":
      assert (
        len(plan["retireNav"]) == 1
        and plan["retireNav"][0]["sourceId"] == "DEBE00YYUf00009S"
      )
      assert len(plan["appendNav"]) >= 10
    else:
      assert plan["retireNav"] == plan["appendNav"] == []
    assert "DEBE01YYK00001VX" not in plan["owners"]
    raw = read(
      ROOT / f"src/app/public/mesh/surrounding-berlin-v159/{host}.{mode}.json.gz"
    )
    for change in plan["retire"]:
      actual = triangles(raw["meshes"][change["mesh"]], np.array(raw["origin"]))
      for ordinal in change["triangles"]:
        receipt = indexed.pop((host, change["mesh"], ordinal))
        xyz, colors = actual[ordinal]
        np.testing.assert_allclose(receipt["positions"], xyz, atol=1e-8)
        np.testing.assert_array_equal(receipt["colors"], colors)
  assert not indexed


def planar_groups(rows):
  groups = defaultdict(list)
  for xyz in rows:
    q = np.rint(np.asarray(xyz) * 100).astype(int)
    constant = [j for j in range(3) if len(set(q[:, j])) == 1]
    if len(constant) != 1:
      # Harmless collinear centimetre-rounded ornament triangles.
      assert np.linalg.norm(np.cross(q[1] - q[0], q[2] - q[0])) == 0
      continue
    axis = constant[0]
    poly = Polygon(q[:, [j for j in range(3) if j != axis]])
    if poly.area:
      groups[(axis, int(q[0, axis]))].append(poly)
  return {k: unary_union(v) for k, v in groups.items()}


def test_native_replacement_retains_complete_independent_cardinal_surface():
  plan = plans()["minecraft:4_0"]
  original = read(GEO / "nikolai-quarter-v353-minecraft-retirement.json.gz")
  old = planar_groups(
    [
      r["positions"]
      for r in original
      if r["host"] == "4_0" and r["owner"] != "DEBE00YYUf00009S"
    ]
  )
  new = planar_groups(
    [p for p, c in triangles(plan["append"], np.array(plan["origin"]))]
  )
  assert old.keys() <= new.keys()
  for k, p in old.items():
    # Cutting a triangle in u/y may round an edge by at most one centimetre;
    # its full outside complement is carried through with the old paint.
    assert p.difference(new[k]).area <= (p.length + new[k].length) * 1.1


def test_all_native_relief_is_cardinal_and_five_hosts_are_bounded():
  assert set(plans()) == {
    "drawn:4_0",
    "drawn:nikolai239-4_0",
    "minecraft:4_0",
    "minecraft:nikolai239-4_0",
    "drawn:4_0-alt-mitte-v169-1",
  }
  for key, plan in plans().items():
    assert plan["append"]["kind"] == "nikolai-quarter-v353"
    assert base64.b64decode(plan["append"]["indices"])
    if key.startswith("minecraft:"):
      planar_groups([p for p, c in triangles(plan["append"], np.array(plan["origin"]))])
  for row in read(DATA / "nikolaiQuarterV353Index.json")["sources"]:
    payload = (DATA / row["file"]).read_bytes()
    assert len(payload) < 512 * 1024
    assert len(gzip.decompress(payload)) == row["decodedBytes"] < 2 * 1024 * 1024


def test_false_solid_palace_balcony_is_replaced_only_with_open_structure():
  source = read(GEO / "nikolai-quarter-v353-source.json.gz")
  original = read(GEO / "alt-mitte-v169/source-391_5819-00.json.gz")
  balcony = next(b for b in original["buildings"] if b["id"] == "DEBE00YYUf00009S")
  assert source["balconySource"] == balcony
  assert balcony["sourceFootprintAreaM2"] == 28.128
  for mode in ["drawn", "minecraft"]:
    plan = plans()[f"{mode}:4_0"]
    assert [b["sourceId"] for b in plan["retireNav"]] == [balcony["id"]]
    assert len(plan["appendNav"]) == 10
    supports = [b for b in plan["appendNav"] if ":column-" in b["sourceId"]]
    slabs = [b for b in plan["appendNav"] if b not in supports]
    assert len(supports) == 6 and len(slabs) == 4
    assert all(b["minHeight"] == 0 and b["height"] < 5 for b in supports)
    assert all(b["height"] - b["minHeight"] <= 0.251 for b in slabs)
  ink = read(GEO / "nikolai-quarter-v353-balcony-ink.json.gz")
  plan = plans()["drawn:4_0-alt-mitte-v169-1"]
  raw = read(
    ROOT
    / "src/app/public/mesh/surrounding-berlin-v159/4_0-alt-mitte-v169-1.drawn.json.gz"
  )
  segments = np.frombuffer(base64.b64decode(raw["lines"]["positions"]), "<u2").reshape(
    -1, 2, 3
  )
  assert plan["retireLines"] == [r["ordinal"] for r in ink["segments"]]
  assert len(plan["retireLines"]) > 0
  for row in ink["segments"]:
    np.testing.assert_array_equal(segments[row["ordinal"]], row["positions"])
