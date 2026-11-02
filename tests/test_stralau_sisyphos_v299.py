"""Exact source-complement, packet and native geometry proofs for Stralau v299."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import shapely
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def polygons(rows: list[dict], x: float = 0, z: float = 0) -> shapely.Geometry:
  return unary_union(
    [
      affine_transform(
        shapely.make_valid(Polygon(p["ring"], p["holes"])), [1, 0, 0, 1, x, z]
      )
      for p in rows
    ]
  )


def test_named_new_scope_is_exactly_separate_from_retained_city() -> None:
  source = read(GEO / "stralau-sisyphos-v299-source.json.gz")
  manifest = read(PUBLIC / "manifest.json")
  new = shape(source["newOnlyScope"])
  old = polygons(manifest["footprint"][: source["retainedFootprintCount"]])
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform
  core_file = read(GEO / "bounds.geojson")
  core = unary_union([shape(f["geometry"]) for f in core_file["features"]])
  core = affine_transform(transform(project, core), [1, 0, 0, -1, -389500, 5820000])
  assert new.intersection(old.union(core)).area < 1e-5
  assert abs(new.area - 533761.1734906461) < 1e-6
  assert (
    shape(source["scope"])
    .symmetric_difference(
      unary_union([shape(source[k]) for k in ["peninsula", "mappedWater", "clubSite"]])
    )
    .area
    < 1e-6
  )
  assert new.difference(shape(source["scope"])).area < 1e-6
  assert (
    hashlib.sha256((GEO / "bounds.geojson").read_bytes()).hexdigest()
    == source["retainedCoreBoundsSha256"]
  )
  # The separate actual Hauptstraße club parcel cannot grow into Rummelsburg.
  club = shape(source["clubSite"])
  assert 8000 < club.area < 13000
  assert club.bounds[0] > 8039 and club.bounds[2] < 8183
  assert not club.intersects(shape(source["peninsula"]))


def test_complete_metric_parents_sheets_courts_and_named_owner_faces_survive() -> None:
  source = read(GEO / "stralau-sisyphos-v299-source.json.gz")
  data = read(ROOT / "src/app/src/data/stralauSisyphosV299.json")
  parents = {b["id"]: b for b in source["parents"]}
  assert len(parents) == 347
  assert sum(len(b["parts"]) for b in parents.values()) == 1065
  assert sum(len(p["holes"]) for b in parents.values() for p in b["parts"]) == 8
  assert len(source["archives"]) == 6
  for archive in source["archives"]:
    assert archive["url"].startswith("https://gdi.berlin.de/data/a_lod2/atom/")
    assert len(archive["sha256"]) == 64
  for identity, count in {
    "DEBE11YYI000086n": 2,
    "DEBE11YYI00005em": 5,
    "DEBE11YYI0002Etj": 1,
    "DEBE11YYI00006zV": 1,
    "DEBE11YYI00007jM": 1,
  }.items():
    assert len(parents[identity]["parts"]) == count
  assert len(data["features"]) == 12
  for feature in data["features"]:
    for wall in feature["walls"]:
      part = next(
        p for p in parents[wall["sourceId"]]["parts"] if p["id"] == wall["partId"]
      )
      assert any(
        surface["kind"] == "WallSurface"
        and all(
          any([v[0], v[2]] == edge for v in surface["rings"][0])
          for edge in [wall["a"], wall["b"]]
        )
        for surface in part["surfaces"]
      )
  assert data["waterY"] == -1.15
  assert (
    "No 24/7 opening or private individual berth occupancy" in data["estimatePolicy"]
  )


def test_nine_complete_finite_packet_pairs_match_receipts_and_source_ownership() -> (
  None
):
  supplement = read(GEO / "stralau-sisyphos-v299-manifest.json")
  source = read(GEO / "stralau-sisyphos-v299-source.json.gz")
  assert (
    hashlib.sha256(
      (GEO / supplement["source"]["sourceEvidence"]).read_bytes()
    ).hexdigest()
    == supplement["source"]["sourceEvidenceSha256"]
  )
  assert len(supplement["chunks"]) == 9
  assert supplement["source"]["buildingCount"] == 1015
  assert (
    sum(c[m]["bytes"] for c in supplement["chunks"] for m in ["drawn", "minecraft"])
    == 1704202
  )
  valid_owners = {b["id"] for b in source["parents"]}
  grounds = []
  for entry in supplement["chunks"]:
    for mode in ["drawn", "minecraft"]:
      asset = entry[mode]
      path = PUBLIC / asset["url"]
      raw = path.read_bytes()
      assert len(raw) == asset["bytes"]
      assert hashlib.sha256(raw).hexdigest() == asset["sha256"]
      decoded = gzip.decompress(raw)
      assert len(decoded) == asset["decodedBytes"]
      packet = json.loads(decoded)
      assert packet["nav"]["groundY"] == 3
      assert all(b["sourceId"] in valid_owners for b in packet["nav"]["buildings"])
      assert all(b["partId"] for b in packet["nav"]["buildings"])
      x, _, z = packet["origin"]
      if mode == "drawn":
        grounds.append(polygons(packet["nav"]["ground"], x, z))
      for mesh in packet["meshes"]:
        positions = np.frombuffer(
          base64.b64decode(mesh["positions"]), dtype="<u2"
        ).reshape(-1, 3)
        indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
          -1, 3
        )
        assert len(positions) <= 400000 and indices.size <= 2400000
        assert indices.max() < len(positions)
        if mode == "minecraft":
          triangles = positions.astype(float)[indices]
          normals = np.cross(
            triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
          )
          assert np.all((np.abs(normals) > 0).sum(axis=1) <= 1)
  # Existing centimetre payload precision is retained at exact diagonal seams.
  new = shape(source["newOnlyScope"])
  assert unary_union(grounds).symmetric_difference(new).area < 30


def test_every_precomputed_recipe_keeps_complete_source_admission_and_bounded_native_rows() -> (
  None
):
  data = read(ROOT / "src/app/src/data/stralauSisyphosV299Packets.json")
  proof = read(GEO / "stralau-sisyphos-v299-integration.json")
  assert len(data["keys"]) == len(data["packets"]) == len(proof["proof"]) == 18
  assert (
    proof["previousManifestSha256"]
    == "db15e3b722bf64d223eed121aac4986dc48e91207e086e8b8d8f9a43dd074115"
  )
  assert len([p for p in proof["proof"] if p["existing"]]) == 8
  for p in proof["proof"]:
    plan = data["packets"][p["key"]]
    assert "_originalNav" not in plan
    assert len(plan["boxes"]) == p["boxes"] <= 20000
    assert plan["guard"] > 0 and plan["records"]
    if p["key"].startswith("minecraft:"):
      assert all(r[3] == 0 or r[4] == 0 for r in plan["boxes"])
    assert len(plan["floors"]) == p["floors"]
    assert len(plan["solids"]) == p["solids"]
