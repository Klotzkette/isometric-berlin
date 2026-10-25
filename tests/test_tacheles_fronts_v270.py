"""Five photographed owners: complete source retention and independent native roofs."""

import base64
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import NS, leaf_building_parts
from scripts.build_bebelplatz_building_source import (
  extract_parent,
  part_profile,
  world_ring,
)
from scripts.build_breitscheid_towers_v161 import triangles_for

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_roof_house_v233 import roof_height  # noqa:E402

DATA = json.loads((ROOT / "src/app/src/data/tachelesFrontsV270.json").read_bytes())
PROFILE = json.loads(
  (ROOT / "src/app/src/data/tachelesFrontsV270Profile.json").read_bytes()
)
SOURCE = json.loads(
  gzip.decompress(
    (
      ROOT / "geo_data/regierungsviertel/tacheles-fronts-v270-source.json.gz"
    ).read_bytes()
  )
)
EVIDENCE = json.loads(
  gzip.decompress(
    (
      ROOT / "geo_data/regierungsviertel/tacheles-fronts-v270-evidence.json.gz"
    ).read_bytes()
  )
)


def arrays(mesh):
  return np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(
    -1, 3
  ), np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)


def signature(t):
  return tuple(sorted(map(tuple, t)))


def test_all_23_parts_267_original_sheets_and_every_source_triangle_survive():
  for path, digest in EVIDENCE["inputs"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  archive = ROOT / SOURCE["archive"]["path"]
  assert hashlib.sha256(archive.read_bytes()).hexdigest() == SOURCE["archive"]["sha256"]
  assert sum(len(s["originalParts"]) for s in SOURCE["sites"]) == 23
  assert sum(len(s["originalSheets"]) for s in SOURCE["sites"]) == 267
  for source, site, profile in zip(
    SOURCE["sites"], DATA["sites"], PROFILE["sites"], strict=True
  ):
    parent = extract_parent(archive, source["owner"])
    leaves = leaf_building_parts(parent) or [parent]
    parts = [part_profile(p) for p in leaves]
    assert parts == source["originalParts"]
    sheets = []
    for part in leaves:
      for bounded in part.findall("bldg:boundedBy", NS):
        for surface in bounded:
          for poly in surface.findall(".//gml:Polygon", NS):
            sheets.append(
              dict(
                part=part.get("{" + NS["gml"] + "}id"),
                id=poly.get("{" + NS["gml"] + "}id"),
                kind=surface.tag.split("}")[-1],
                rings=[world_ring(pos) for pos in poly.findall(".//gml:posList", NS)],
              )
            )
    assert sheets == source["originalSheets"]
    p, ix = arrays(site["drawn"])
    actual = {signature(t) for t in p[ix]}
    count = 0
    for part in parts:
      for surface in part["surfaces"]:
        for t in triangles_for(surface["rings"]):
          q = np.array(t)
          q[:, 1] += source["sourceShiftY"]
          q = np.rint((q - site["origin"]) * 100).astype(int)
          if len(set(map(tuple, q))) < 3:
            continue
          assert signature(q) in actual
          count += 1
    assert count == profile["metrics"]["sourceTriangles"]
    original = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
    delivered = unary_union(
      [Polygon(p["ring"], p["holes"]) for p in profile["drawnFootprints"]]
    )
    assert original.symmetric_difference(delivered).area < 1e-7


def test_native_source_columns_exact_and_shared_neighbours_retained():
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
  )["buildings"]
  voxel = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json").read_bytes()
  )
  cell = voxel["cell_m"]
  for s, e in zip(PROFILE["sites"], EVIDENCE["sites"], strict=True):
    assert next(p for p in prisms if p["id"] == s["prism"]) == s["previousPrism"]
    assert s["groundY"] == 5.2 and s["previousPrism"]["h_dm"] == 150
    for c in s["columns"]:
      ix, iz, lo, hi, kind = c
      runs = voxel["building_rows"][iz - voxel["grid"]["min_z_idx"]]
      assert any(
        voxel["grid"]["min_x_idx"] + off <= ix < voxel["grid"]["min_x_idx"] + off + n
        and (lo, hi, kind) == (a, b, k)
        for off, n, a, b, k in runs
      )
      square = box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)
      for p in s["neighbours"]:
        assert (
          Polygon(np.array(p["ring"]) / 10, [np.array(h) / 10 for h in p["holes"]])
          .intersection(square)
          .area
          <= 0.001
        )
    assert all(
      c["column"] not in s["columns"] for c in e["retainedForeignNativeColumns"]
    )
  assert {"97856098", "98644584"}.isdisjoint(s["prism"] for s in PROFILE["sites"])


def test_independent_cardinal_native_complete_heights_and_bounded_payload():
  for s, p in zip(DATA["sites"], PROFILE["sites"], strict=True):
    for mode in ["drawn", "native"]:
      vertices, indices = arrays(s[mode])
      world = vertices / 100 + s["origin"]
      assert indices.max() < len(vertices) and len(indices) < 20000
      assert abs(world[:, 1].min() - p["groundY"]) < 0.011
      assert abs(world[:, 1].max() - p["topY"]) < 0.011
      if mode == "native":
        t = vertices[indices].astype(float)
        normal = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
        assert np.all((abs(normal) > 0.01).sum(axis=1) <= 1)
  assert (ROOT / "src/app/src/data/tachelesFrontsV270.json").stat().st_size < 1_200_000


def test_roof_navigation_matches_visible_native_shell():
  for s, p in zip(DATA["sites"], PROFILE["sites"], strict=True):
    vertices, indices = arrays(s["native"])
    world = vertices / 100 + s["origin"]
    matches = 0
    # The initial nativeCells raster emits horizontal roof faces before fittings.
    for t in world[indices[: p["metrics"]["nativeShellTriangles"]]]:
      if np.ptp(t[:, 1]) > 1e-6 or abs(np.cross(t[1] - t[0], t[2] - t[0])[1]) < 0.02:
        continue
      c = t.mean(axis=0)
      x, z = (np.floor(c[[0, 2]] / 0.5) + 0.5) * 0.5
      ys = [
        h for roof in p["roofTriangles"] if (h := roof_height(roof, x, z)) is not None
      ]
      if not ys:
        continue
      expected = min(p["shellTopY"], np.ceil(max(ys) / 0.5) * 0.5)
      # Sills and rails are vertical surfaces. Only top-level shell horizontal faces exist.
      assert abs(c[1] - expected) < 0.011
      matches += 1
    assert matches > 15


def test_photo_projections_are_elevated_and_chimneys_seat_on_retained_roofs():
  details = [d for s in PROFILE["sites"] for d in s["detailSolids"]]
  assert len(details) == 11
  assert sum(d["role"] == "two-storey photo bay" for d in details) == 2
  assert sum(d["role"] == "photo roof chimney" for d in details) == 5
  assert sum(d["role"] == "photo low rooflight" for d in details) == 2
  for s in PROFILE["sites"]:
    for d in s["detailSolids"]:
      assert d["minY"] >= 13.25 and d["maxY"] > d["minY"]
      assert d["drawnFootprints"] and d["nativeFootprints"]
      if d["role"] not in ("photo roof chimney", "photo low rooflight"):
        continue
      heights = []
      for x, z in d["drawnFootprints"][0]["ring"]:
        heights.append(
          max(v for t in s["roofTriangles"] if (v := roof_height(t, x, z)) is not None)
        )
      assert abs(d["minY"] - (max(heights) - 0.025)) < 1e-5
      assert max(heights) - min(heights) <= 0.35
  brick = next(s for s in PROFILE["sites"] if s["key"] == "brick46")["metrics"]["roles"]
  assert brick["irregular exposed brick/remaining plaster"] > 150
  assert brick["restricted photo lintel arch"] == 24
  assert "arched weathered head" not in brick


def test_red_corner_native_artwork_lands_outside_real_stair_faces_on_both_axes():
  site = next(s for s in DATA["sites"] if s["key"] == "redCorner")
  evidence = next(s for s in EVIDENCE["sites"] if s["key"] == "redCorner")
  points, indices = arrays(site["native"])
  world = points / 100 + site["origin"]
  colours = np.frombuffer(base64.b64decode(site["native"]["colors"]), "u1").reshape(
    -1, 3
  )
  areas = {0: 0.0, 1: 0.0}
  window_axes = set()
  glass_axes = set()
  assert len(evidence["nativeFaceArtwork"]) == 2224
  for r in evidence["nativeFaceArtwork"]:
    ix = indices[r["firstTriangle"] : r["firstTriangle"] + r["triangleCount"]]
    triangles = world[ix]
    expected = r["boundary"] + r["sign"] * r["offset"]
    assert np.all(abs(triangles[:, :, r["axis"]] - expected) < 0.011)
    assert np.all((triangles[:, :, r["axis"]] - r["boundary"]) * r["sign"] > 0.015)
    assert triangles[:, :, 1].min() >= r["low"] - 0.011
    assert triangles[:, :, 1].max() <= r["high"] + 0.011
    if r["role"] not in ("penthouse glazing", "photo window"):
      continue
    srgb = np.array(r["colour"]) / 255
    linear = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
    expected_colour = np.rint(linear * 255).astype("u1")
    assert np.all(colours[ix] == expected_colour)
    if r["role"] == "photo window":
      window_axes.add(r["axis"])
      continue
    glass_axes.add(r["axis"])
    for t in triangles:
      areas[int(t[:, 1].mean() > 27.5)] += (
        np.linalg.norm(np.cross(t[1] - t[0], t[2] - t[0])) / 2
      )
  assert glass_axes == window_axes == {0, 2}
  assert min(areas.values()) > 20
