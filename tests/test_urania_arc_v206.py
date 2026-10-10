"""Exact retained envelope, narrow proxy correction and catalogue arc contracts."""

import hashlib
import importlib.util
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import Point, shape

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/urania-arc-v206-source.json"
RUNTIME = ROOT / "src/app/src/data/uraniaArcV206.json"
E = json.loads(SOURCE.read_text())
D = json.loads(RUNTIME.read_text())


def test_complete_official_source_receipt_and_reproducibility():
  old = ROOT / E["priorEvidence"]["path"]
  assert hashlib.sha256(old.read_bytes()).hexdigest() == E["priorEvidence"]["sha256"]
  assert E["urania"] == json.loads(old.read_text())["urania"]
  assert len(E["urania"]["surfaces"]) == 21
  assert D["sourceSha256"] == hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  spec = importlib.util.spec_from_file_location(
    "v206", ROOT / "scripts/build_urania_arc_v206.py"
  )
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  assert module.build(E) == D


def test_only_three_source_sheets_have_documented_lower_recess():
  site = D["sites"][0]
  assert E["correction"]["clippedStreetSurfaceIndices"] == [4, 9, 10]
  for i, (raw, converted) in enumerate(
    zip(E["urania"]["surfaces"], site["sourceSurfaces"], strict=True)
  ):
    expected = [
      [round(x - 389500, 3), round(h - 34.676 + 5.2, 3), round(5820000 - z, 3)]
      for x, z, h in raw["ringsEpsg25833Nhn"][0]
    ]
    assert converted == {"type": raw["type"], "ring": expected}
    actual = [
      p for t in site["triangles"] if t.get("sourceIndex") == i for p in t["points"]
    ]
    if i in [4, 9, 10]:
      assert min(p[1] for p in actual) == 8.55
      assert max(p[1] for p in actual) == 19.935
    elif i != 19:
      # Every source corner remains in an unmodified sheet, including both
      # ground surfaces and the complete irregular lower rear wing.
      assert actual, i
      for p in expected:
        assert np.min(np.linalg.norm(np.asarray(actual) - p, axis=1)) < 0.0002, (i, p)
  assert len(site["sourceSurfaces"][19]["ring"]) == 12
  assert D["sourceOwner"] == "11687794"
  assert D["sourceHeightM"] == 14.735


def test_recess_columns_and_glazing_follow_two_actual_source_street_planes():
  site = D["sites"][0]
  glass = [t for t in site["triangles"] if t["kind"] == "mirror-glass"]
  assert len(glass) == (26 + 17) * 8 * 2 + 4
  assert [s["text"] for s in site["signs"]] == ["UraniaBerlin", "Denksporthalle"]
  for face in site["facades"]:
    a, b = np.array(face["a"]), np.array(face["b"])
    tangent = (b - a) / np.linalg.norm(b - a)
    outward = np.array([tangent[1], -tangent[0]])
    inner = [
      p
      for t in glass
      for p in t["points"]
      if p[1] < 8.55 and abs(np.dot(np.array([p[0], p[2]]) - a, outward) + 1.65) < 0.001
    ]
    assert len(inner) >= 6
    assert all(5.2 < p[1] < 8.55 for p in inner)
  columns = [
    p
    for t in site["triangles"]
    if t["kind"] == "pale-round-column"
    for p in t["points"]
  ]
  assert min(p[1] for p in columns) == 5.2 and max(p[1] for p in columns) == 8.55
  assert not any(b[-1] == 0xC8453D for b in site["boxes"])


def test_arc_is_an_open_asymmetric_1245_degree_band_inside_real_median():
  arc = D["sites"][1]
  p = arc["profile"]
  assert p["tallAngleEstimateDegrees"] + p["shortAngleEstimateDegrees"] == 124.5
  assert p["tallAngleEstimateDegrees"] > p["shortAngleEstimateDegrees"]
  points = np.array([v for t in arc["triangles"] for v in t["points"]])
  direction = np.array(p["tallEndDirectionXz"])
  projected = (points[:, [0, 2]] - p["locatorXz"]) @ direction
  assert abs(projected.max() - projected.min() - 40) < 0.0002
  assert abs((projected.max() + projected.min()) / 2) < 0.0002
  assert abs(points[:, 1].max() - 5.2 - 21) < 0.0001
  assert 5.2 <= points[:, 1].min() < 5.21
  assert direction[0] < 0 and direction[1] > 0
  median = shape(E["arc"]["medianGeometry"])
  assert all(median.covers(Point(v[0], v[2])) for v in points)
  centre_y = 5.2 + p["radiusEstimateM"]
  along = (points[:, [0, 2]] - p["supportEstimateXz"]) @ direction
  radii = np.hypot(along, points[:, 1] - centre_y)
  assert radii.min() > p["radiusEstimateM"] - p["sectionEstimateM"][0] - 0.001
  assert radii.max() < p["radiusEstimateM"] + 0.001
  assert sum(t["kind"] == "arc-open-end-section" for t in arc["triangles"]) == 4
  assert len(arc["nativeBlocks"]) == 128
  # No crossbar, base slab or circular closing chord can appear in its opening.
  assert {t["kind"] for t in arc["triangles"]} == {
    "arc-broad-face",
    "arc-edge",
    "arc-open-end-section",
  }


def test_source_ground_roof_planes_and_finite_bounded_native_budget():
  owner = shape(E["urania"]["officialFootprint"])
  for surface in D["sites"][0]["sourceSurfaces"]:
    assert all(owner.buffer(0.002).covers(Point(p[0], p[2])) for p in surface["ring"])
  total = 0
  for site in D["sites"]:
    for b in site["nativeBlocks"]:
      assert len(b) == 7 and all(math.isfinite(v) for v in b)
      assert all(0 < v < 65 for v in b[3:6])
    total += len(site["nativeBlocks"])
  assert total < 8000
  assert RUNTIME.stat().st_size < 850000
  assert len(E["ownerPhotos"]) == 2


def test_native_lettering_clears_the_axis_aligned_plaque_faces():
  site = D["sites"][0]
  a, b = (np.array(site["facades"][0][k]) for k in ["a", "b"])
  tangent = (b - a) / np.linalg.norm(b - a)
  normal = np.array([tangent[1], -tangent[0]])

  def depth(block):
    centre = (np.array([block[0], block[2]]) - a) @ normal
    radius = abs(normal[0]) * block[3] / 2 + abs(normal[1]) * block[5] / 2
    return centre - radius, centre + radius

  for ink, backing in [(0x303438, 0xEBDD16), (0xF0E7DC, 0x8C1D48)]:
    foreground = [depth(b)[0] for b in site["nativeBlocks"] if b[-1] == ink]
    background = [depth(b)[1] for b in site["nativeBlocks"] if b[-1] == backing]
    assert foreground and background
    assert min(foreground) > max(background) + 0.025


def test_exact_coarse_voxel_replacement_retains_adjacent_owner():
  receipt = E["legacyReplacement"]
  voxel_file = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  prism_file = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  assert (
    hashlib.sha256(voxel_file.read_bytes()).hexdigest() == receipt["voxelPayloadSha256"]
  )
  assert (
    hashlib.sha256(prism_file.read_bytes()).hexdigest() == receipt["prismPayloadSha256"]
  )
  prisms = json.loads(prism_file.read_text())["buildings"]
  from shapely.geometry import Polygon

  owner = receipt["prismRecord"]
  assert next(b for b in prisms if b["id"] == "11687794") == owner
  source = Polygon([(x / 10, z / 10) for x, z in owner["ring"]])
  near = [
    (b["id"], Polygon([(x / 10, z / 10) for x, z in b["ring"]]))
    for b in prisms
    if any(-1660 < x / 10 < -1600 and 1870 < z / 10 < 1960 for x, z in b["ring"])
  ]
  cells = receipt["voxelColumns"]
  assert len(cells) == 86
  payload = json.loads(voxel_file.read_text())
  independently_selected = []
  for zi, rows in enumerate(payload["building_rows"]):
    z = payload["grid"]["min_z_idx"] + zi
    if not 1870 < z * 4 < 1960:
      continue
    for xo, count, y0, y1, c in rows:
      for offset in range(count):
        x = payload["grid"]["min_x_idx"] + xo + offset
        if source.covers(Point(x * 4 + 2, z * 4 + 2)):
          independently_selected.append([x, z, y0, y1, c])
  assert independently_selected == cells
  for xi, zi, y0, y1, c in cells:
    point = Point(xi * 4 + 2, zi * 4 + 2)
    assert source.covers(point)
    assert [id_ for id_, p in near if p.covers(point)] == ["11687794"]
    assert [y0, y1, c] == [52, 172, 3]
  assert [-403, 474, 52, 172, 3] not in cells
  nav = json.loads((ROOT / "src/app/src/data/uraniaArcV206Navigation.json").read_text())
  assert nav["legacyVoxelColumns"] == cells
  assert len(nav["parts"]) == 16
  assert nav["sourceOwner"] == "11687794"
