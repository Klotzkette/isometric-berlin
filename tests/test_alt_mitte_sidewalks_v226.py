"""Independent scope, positive evidence, full-footprint and preservation checks."""

import hashlib
import json
import math
from pathlib import Path

import numpy as np
import shapely
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = json.loads((GEO / "alt-mitte-sidewalks-v226-source.json").read_text())
AUDIT = json.loads((GEO / "alt-mitte-sidewalks-v226-evidence.json").read_text())
DATA = json.loads((ROOT / "src/app/src/data/altMitteSidewalksV226.json").read_text())


def scope():
  """The frozen old-Mitte boundary, never present-day Bezirk Mitte."""
  return affine_transform(
    shape(
      json.loads((GEO / "alt-mitte-v169-boundary.geojson").read_text())["features"][0][
        "geometry"
      ]
    ),
    [1, 0, 0, -1, -389500, 5820000],
  )


def test_original_inputs_and_exact_new_receipts():
  for name, digest in SOURCE["inputs"].items():
    path = ROOT / name
    if "/raw/" in name and not path.exists():
      continue  # Private raw caches are optional; delivered sources are mandatory.
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest, name
  assert (
    hashlib.sha256(
      (GEO / "alt-mitte-sidewalks-v226-source.json").read_bytes()
    ).hexdigest()
    == DATA["sourceSha256"]
    == AUDIT["sourceSha256"]
  )
  assert (
    hashlib.sha256(
      (ROOT / "src/app/src/data/altMitteSidewalksV226.json").read_bytes()
    ).hexdigest()
    == AUDIT["runtimeSha256"]
  )
  assert DATA["counts"]["auditedSidewalks"] == 2447
  assert DATA["counts"]["explicitWidthWays"] == 257
  assert DATA["counts"]["addedWays"] == 22


def test_every_added_patch_has_positive_width_and_preserves_road_path_water_building_voids():
  owners = {f["key"]: f for f in SOURCE["features"]}
  boundary = scope()
  roads, existing, blocked = (
    shape(SOURCE[name]) for name in ("roads", "existing", "blocked")
  )
  for record in AUDIT["patches"]:
    owner = owners[record["key"]]
    tags = owner["tags"]
    assert tags["footway"] == "sidewalk"
    assert float(tags["width"]) == owner["widthM"]
    assert (
      tags.get("bridge", "no")
      == tags.get("tunnel", "no")
      == tags.get("covered", "no")
      == "no"
    )
    assert tags.get("layer", "0") in ("", "0")
    assert tags.get("access") not in ("private", "no")
    patch = shape(record["geometry"])
    assert (
      patch.difference(
        shape(owner["geometry"]).buffer(owner["widthM"] / 2, cap_style=2)
      ).area
      < 1e-8
    )
    assert patch.difference(boundary).area < 1e-8
    assert patch.intersection(roads.buffer(0.079)).area < 1e-8
    assert patch.intersection(existing.buffer(0.029)).area < 1e-8
    assert patch.intersection(blocked).area < 1e-8


def test_actual_shipped_core_building_footprints_independently_exclude_every_pavement():
  # Do not rely on the builder's exclusion mask: PrismPayload coordinates are
  # decimetres, unlike the metre-based outer GPKGs. This catches unit mistakes.
  buildings = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  footprints = [
    Polygon(
      [(x * 0.1, z * 0.1) for x, z in building["ring"]],
      [[(x * 0.1, z * 0.1) for x, z in hole] for hole in building.get("holes", [])],
    )
    for building in buildings
  ]
  tree = shapely.STRtree(footprints)
  patches = [shape(p["geometry"]) for p in AUDIT["patches"]]
  tested = set()
  for patch in patches:
    for index in tree.query(patch.buffer(0.05)):
      tested.add(buildings[index]["id"])
      assert patch.intersection(footprints[index].buffer(0.049)).area < 1e-8, buildings[
        index
      ]["id"]
  assert tested  # Exercise real source owners, rather than a disjoint mask.


def test_every_drawn_triangle_reconstructs_the_exact_missing_complement_without_duplicate_fill():
  expected = unary_union([shape(p["geometry"]) for p in AUDIT["patches"]])
  triangles = []
  for cell in DATA["cells"]:
    vertices = np.array(cell["positions"]).reshape(-1, 2)
    for ids in np.array(cell["indices"]).reshape(-1, 3):
      a, b, c = vertices[ids]
      assert (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0
      triangle = Polygon([a, b, c])
      assert triangle.difference(expected).area < 1e-8
      triangles.append(triangle)
  assert len(triangles) == DATA["counts"]["triangles"] == 1618
  actual = unary_union(triangles)
  assert actual.symmetric_difference(expected).area < 1e-7
  assert abs(sum(t.area for t in triangles) - actual.area) < 1e-7
  assert abs(actual.area - DATA["counts"]["addedAreaM2"]) < 1e-7


def test_native_full_pixel_containment_and_lossless_runs_do_not_close_intersections():
  allowed = unary_union([shape(p["geometry"]) for p in AUDIT["patches"]])
  shapely.prepare(allowed)
  pixels = set()
  for cell in DATA["cells"]:
    cx, cz = cell["cell"]
    for ix, iz, length in cell["nativeRuns"]:
      assert math.floor(ix / 2048) == math.floor((ix + length - 1) / 2048) == cx
      assert math.floor(iz / 2048) == cz
      assert math.floor(ix / 16) == math.floor((ix + length - 1) / 16)
      for x in range(ix, ix + length):
        assert (x, iz) not in pixels
        pixels.add((x, iz))
        assert allowed.covers(box(x / 4, iz / 4, (x + 1) / 4, (iz + 1) / 4))
  assert len(pixels) == DATA["counts"]["nativePixels"] == 9844
  assert sum(len(c["nativeRuns"]) for c in DATA["cells"]) == 1665


def test_new_pavement_planes_are_not_hidden_under_original_coarse_grass_runs():
  ground = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json").read_text()
  )
  h = ground["ground_height"]
  step = ground["cell_m"]
  gx, gz = ground["grid"]["min_x_idx"], ground["grid"]["min_z_idx"]

  def terrain(x, z):
    fx, fz = (
      (x / step - gx) / h["stride_cells"] - 0.5,
      (z / step - gz) / h["stride_cells"] - 0.5,
    )
    ix, iz = math.floor(fx), math.floor(fz)
    a, b = fx - ix, fz - iz

    def sample(x, z):
      return (
        h["y_dm"][
          max(0, min(h["rows"] - 1, z)) * h["cols"] + max(0, min(h["cols"] - 1, x))
        ]
        / 10
      )

    return (sample(ix, iz) * (1 - a) + sample(ix + 1, iz) * a) * (1 - b) + (
      sample(ix, iz + 1) * (1 - a) + sample(ix + 1, iz + 1) * a
    ) * b

  triangles, planes = [], []
  for cell in DATA["cells"]:
    vertices = np.array(cell["positions"]).reshape(-1, 2)
    for ids in np.array(cell["indices"]).reshape(-1, 3):
      points = vertices[ids]
      if Polygon(points).area < 1e-7:
        continue
      triangles.append(Polygon(points))
      planes.append(
        np.linalg.solve(
          np.column_stack((points, np.ones(3))),
          [terrain(x, z) + 0.1 for x, z in points],
        )
      )
  tree = shapely.STRtree(triangles)
  for iz, row in enumerate(ground["ground_rows"]):
    for start, count, kind in row:
      if ground["classes"][kind] != "grass":
        continue
      rect = box(
        (gx + start) * step,
        (gz + iz) * step,
        (gx + start + count) * step,
        (gz + iz + 1) * step,
      )
      top = (
        h["y_dm"][
          math.floor(iz / h["stride_cells"]) * h["cols"]
          + math.floor((start + count / 2) / h["stride_cells"])
        ]
        / 10
      )
      for index in tree.query(rect):
        overlap = triangles[index].intersection(rect)
        if overlap.area < 1e-7:
          continue
        a, b, c = planes[index]
        for x, z in overlap.exterior.coords:
          assert a * x + b * z + c >= top - 1e-6
