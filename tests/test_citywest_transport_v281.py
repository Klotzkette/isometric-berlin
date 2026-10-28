"""Source ownership, surface support and independent CityWest native geometry."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / "src/app/src/data/citywestTransportV281.json").read_bytes())
SOURCE = json.loads(
  (ROOT / "geo_data/regierungsviertel/citywest-transport-v281-source.json").read_bytes()
)
EVIDENCE = json.loads(
  (
    ROOT / "geo_data/regierungsviertel/citywest-transport-v281-evidence.json"
  ).read_bytes()
)
OWNERS = {"OSM-way-693733275", "OSM-way-671765756"}


def arrays(mesh):
  p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  i = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return p, i


def test_exact_retirement_and_unmodified_assets():
  retired = []
  for evidence in EVIDENCE["packets"]:
    path = ROOT / evidence["asset"]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == evidence["sha256"]
    raw = json.loads(gzip.decompress(path.read_bytes()))
    record = DATA["packets"][evidence["key"]]
    assert raw["origin"] == record["origin"]
    if evidence["retirement"]:
      receipt = evidence["retirement"]
      assert receipt["removedTriangles"] == receipt["expectedTriangles"] > 0
      assert {r["sourceId"] for r in receipt["oldOwnedNavigation"]} == OWNERS
      assert set(record["retiredOwners"]) == OWNERS
      assert record["records"] == receipt["runtimeRecords"]
      assert all(b["sourceId"] in OWNERS for b in record["buildings"])
      retired.append(evidence["key"])
    else:
      assert not record["records"] and not record["retiredOwners"]
    assert len(raw["meshes"]) + 1 <= 16
    meshes = [*raw["meshes"], record["replacement"]]
    assert sum(len(base64.b64decode(m["positions"])) // 6 for m in meshes) <= 400_000
    assert sum(len(base64.b64decode(m["indices"])) // 4 for m in meshes) <= 2_400_000
  assert set(retired) == {f"{f}:outer187--13_2" for f in ["drawn", "minecraft"]}


def test_canopy_plan_is_complete_and_space_below_is_open():
  record = DATA["packets"]["drawn:outer187--13_2"]
  ox, _, oz = record["origin"]
  for owner in SOURCE["owners"]:
    if owner["id"] not in OWNERS:
      continue
    original = shapely.from_wkb(bytes.fromhex(owner["oldOwner"]["wkb"]))
    rows = [b for b in record["buildings"] if b["sourceId"] == owner["id"]]
    roof = unary_union(
      [
        Polygon([[x + ox, z + oz] for x, z in b["ring"]])
        for b in rows
        if b["partId"] == "open-roof"
      ]
    )
    assert original.hausdorff_distance(roof) < 0.015
    assert all(b["minHeight"] == 4.8 for b in rows if b["partId"] == "open-roof")
    posts = unary_union(
      [Polygon(b["ring"]) for b in rows if b["partId"] != "open-roof"]
    )
    assert 1 < posts.area < original.area * 0.02
    assert all(
      b["heightSource"].startswith("display_fallback")
      for b in next(
        p["retirement"]["oldOwnedNavigation"]
        for p in EVIDENCE["packets"]
        if p["key"] == "drawn:outer187--13_2"
      )
    )


def test_native_faces_are_cardinal_and_road_paint_stays_on_actual_roads():
  for key, record in DATA["packets"].items():
    p, i = arrays(record["replacement"])
    assert i.max() < len(p)
    if key.startswith("minecraft:"):
      triangles = p[i].astype(float)
      normals = np.cross(
        triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
      )
      assert np.all((abs(normals) > 0.001).sum(axis=1) <= 1), key
  for p in EVIDENCE["packets"]:
    assert all(s["supportOutsideM2"] < 1e-8 for s in p["paint"])
  assert any(r["status"] == "paint candidate" for r in EVIDENCE["roads"])
  assert any("construction" in r.get("reason", "") for r in EVIDENCE["roads"])
  assert all(
    r["key"] in {f["key"] for f in SOURCE["features"]} for r in EVIDENCE["roads"]
  )
  assert EVIDENCE["runtimeBytes"] < 1_200_000


def test_reception_glazing_stays_below_each_retained_roof():
  # Native source fallbacks use an independent 2m height register. Reusing the
  # drawn register would leave a 0.5m glass fence above the native roof.
  for family, top in [("drawn", 12), ("minecraft", 11)]:
    r = DATA["packets"][f"{family}:outer187--13_2"]
    p, _ = arrays(r["replacement"])
    world_y = p[:, 1] / 100 + r["origin"][1]
    assert top - 0.51 <= world_y.max() <= top - 0.49
