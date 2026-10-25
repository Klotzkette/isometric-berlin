"""Complete source-sheet replacement, exact ownership and independent church shapes."""

import base64
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_breitscheid_towers_v161 import triangles_for

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_roof_house_v233 import roof_height  # noqa: E402

DATA = json.loads((ROOT / "src/app/src/data/moabitLandmarksV269.json").read_bytes())
PROFILE = json.loads(
  (ROOT / "src/app/src/data/moabitLandmarksV269Profile.json").read_bytes()
)
EVIDENCE = json.loads(
  gzip.decompress(
    (
      ROOT / "geo_data/regierungsviertel/moabit-landmarks-v269-evidence.json.gz"
    ).read_bytes()
  )
)


def arrays(mesh: dict) -> tuple[np.ndarray, np.ndarray]:
  return np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(
    -1, 3
  ), np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)


def signature(points: np.ndarray) -> tuple:
  return tuple(sorted(map(tuple, points)))


def test_all_original_parts_sheets_and_vertices_survive_without_source_changes() -> (
  None
):
  for path, digest in EVIDENCE["inputs"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  for source, site, profile in zip(
    EVIDENCE["sites"], DATA["sites"], PROFILE["sites"], strict=True
  ):
    parent = extract_parent(
      ROOT / f"geo_data/regierungsviertel/raw/lod2/LoD2_{source['tile']}.zip",
      source["owner"],
    )
    parts = [part_profile(p) for p in leaf_building_parts(parent)]
    assert parts == source["originalParts"]
    assert len(parts) == (6 if source["key"] == "paulus" else 5)
    assert sum(len(p["surfaces"]) for p in parts) == (
      336 if source["key"] == "paulus" else 194
    )
    points, indices = arrays(site["drawn"])
    actual = {signature(t) for t in points[indices]}
    count = 0
    for p in parts:
      for surface in p["surfaces"]:
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


def test_only_exact_exclusive_native_columns_yield_and_neighbours_remain() -> None:
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
  )["buildings"]
  voxel = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json").read_bytes()
  )
  cell = voxel["cell_m"]

  def source_has(column: list[int]) -> bool:
    ix, iz, low, high, kind = column
    zi = iz - voxel["grid"]["min_z_idx"]
    if not 0 <= zi < len(voxel["building_rows"]):
      return False
    return any(
      voxel["grid"]["min_x_idx"] + off <= ix < voxel["grid"]["min_x_idx"] + off + count
      and (low, high, kind) == (a, b, c)
      for off, count, a, b, c in voxel["building_rows"][zi]
    )

  for site, source in zip(PROFILE["sites"], EVIDENCE["sites"], strict=True):
    assert next(p for p in prisms if p["id"] == site["prism"]) == site["previousPrism"]
    assert site["previousPrism"]["h_dm"] == 140 and site["groundY"] == 5.2
    owner = Polygon([[x / 10, z / 10] for x, z in site["previousPrism"]["ring"]])
    for c in site["columns"]:
      assert source_has(c)
      square = box(c[0] * cell, c[1] * cell, (c[0] + 1) * cell, (c[1] + 1) * cell)
      assert owner.intersection(square).area > 0.001
      assert all(
        Polygon(
          [[x / 10, z / 10] for x, z in p["ring"]],
          [[[x / 10, z / 10] for x, z in h] for h in p["holes"]],
        )
        .intersection(square)
        .area
        <= 0.001
        for p in site["neighbours"]
      )
    assert all(
      c["column"] not in site["columns"] for c in source["retainedForeignNativeColumns"]
    )


def test_full_mobile_native_orthogonal_and_published_tops_fit_existing_bounds() -> None:
  for site, profile in zip(DATA["sites"], PROFILE["sites"], strict=True):
    for family in ["drawn", "native"]:
      p, i = arrays(site[family])
      assert i.max() < len(p)
      world = p / 100 + site["origin"]
      assert abs(world[:, 1].min() - 5.2) < 1e-6
      assert abs(world[:, 1].max() - profile["topY"]) < 1e-6
      if family == "native":
        t = p[i].astype(float)
        n = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
        assert np.all((abs(n) > 0.01).sum(axis=1) <= 1)
      assert len(i) < 200000
    assert profile["topY"] - profile["groundY"] == profile["height"]
  assert PROFILE["fullStaticDetailOnTouch"] and PROFILE["independentlyOrthogonalNative"]
  assert (ROOT / "src/app/src/data/moabitLandmarksV269.json").stat().st_size < 2_000_000


def test_roof_navigation_matches_visible_independent_native_surface() -> None:
  for site, profile in zip(DATA["sites"], PROFILE["sites"], strict=True):
    p, indices = arrays(site["native"])
    world = p / 100 + site["origin"]
    tops = {}
    for t in world[indices]:
      if np.ptp(t[:, 1]) < 1e-6 and abs(np.cross(t[1] - t[0], t[2] - t[0])[1]) > 0.01:
        c = t.mean(axis=0)
        # Surface terraces are sampled at native cell centres, including edges.
        x, z = (np.floor(c[[0, 2]] / 0.5) + 0.5) * 0.5
        heights = [
          h for r in profile["roofTriangles"] if (h := roof_height(r, x, z)) is not None
        ]
        if not heights:
          continue
        expected = min(profile["topY"], np.ceil(max(heights) / 0.5) * 0.5)
        tops[(round(c[0], 3), round(c[2], 3))] = abs(c[1] - expected)
    assert len(tops) > 50 and max(tops.values()) < 0.011
