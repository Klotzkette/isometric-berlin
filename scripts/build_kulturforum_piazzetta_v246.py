"""Replace only the old Piazzetta placeholder, retaining its complete source ring.

The official DGM1 supplies relief, fused upwards with the retained terrain to
avoid coplanar/interpenetrating paving. No city packets or manifests are edited.
"""

import hashlib
import json
import math
import zipfile
from pathlib import Path

from shapely.geometry import Polygon, box
from shapely.ops import triangulate

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/regierungsviertel"
RAW = ROOT / "geo_data/regierungsviertel/raw/dgm/kulturforum-v246/DGM1_388_5818.zip"
OUT = ROOT / "src/app/src/data/kulturforumPiazzettaV246.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/kulturforum-piazzetta-v246-source.json"
DGM_URL = "https://gdi.berlin.de/data/dgm1/atom/DGM1_388_5818.zip"
DGM_SHA = "c70b223f4602baf5f4283e03e6c4d12948dcb7d4098754abc4d1ac08b1a1273e"


def build():
  original = next(
    b
    for b in json.loads((PUBLIC / "lod2-prisms.json").read_text())["buildings"]
    if b["id"] == "26444282"
  )
  ring = [(x / 10, z / 10) for x, z in original["ring"]]
  poly = Polygon(ring)
  xmin, zmin, xmax, zmax = poly.bounds
  ground = json.loads((PUBLIC / "ground-context.json").read_text())
  height = ground["ground_height"]
  grid = ground["grid"]

  def retained_ground(x, z, native=False):
    xx = (x / ground["cell_m"] - grid["min_x_idx"]) / height["stride_cells"]
    zz = (z / ground["cell_m"] - grid["min_z_idx"]) / height["stride_cells"]

    def val(i, j):
      return height["y_dm"][j * height["cols"] + i] / 10

    if native:
      return val(math.floor(xx), math.floor(zz))
    xx -= 0.5
    zz -= 0.5
    ix, iz = math.floor(xx), math.floor(zz)
    tx, tz = xx - ix, zz - iz
    return (val(ix, iz) * (1 - tx) + val(ix + 1, iz) * tx) * (1 - tz) + (
      val(ix, iz + 1) * (1 - tx) + val(ix + 1, iz + 1) * tx
    ) * tz

  assert hashlib.sha256(RAW.read_bytes()).hexdigest() == DGM_SHA
  samples = {}
  with zipfile.ZipFile(RAW) as archive:
    member = next(n for n in archive.namelist() if n.endswith(".xyz"))
    with archive.open(member) as rows:
      for row in rows:
        e, n, h = map(float, row.split())
        x, z = e - 389500, 5820000 - n
        if xmin - 2 <= x <= xmax + 2 and zmin - 2 <= z <= zmax + 2:
          samples[math.floor(x), math.floor(z)] = h - 30

  used = {}

  def dgm(x, z):
    xx, zz = x - 0.5, z - 0.5
    ix, iz = math.floor(xx), math.floor(zz)
    tx, tz = xx - ix, zz - iz

    def at(i, j):
      value = samples[i, j]
      used[i, j] = round(value, 3)
      return value

    return (at(ix, iz) * (1 - tx) + at(ix + 1, iz) * tx) * (1 - tz) + (
      at(ix, iz + 1) * (1 - tx) + at(ix + 1, iz + 1) * tx
    ) * tz

  def top(x, z):
    # Existing terrain sheets are immutable: a thin 9cm paving layer clears
    # them where their coarser interpolation lies above the newer DGM.
    return round(max(dgm(x, z), retained_ground(x, z)) + 0.09, 3)

  positions, indices, colors = [], [], []
  vertex_ids = {}

  def vertex(x, z):
    key = (round(x, 6), round(z, 6))
    if key not in vertex_ids:
      vertex_ids[key] = len(positions)
      positions.append([key[0], top(*key), key[1]])
    return vertex_ids[key]

  for x in range(math.floor(xmin / 4) * 4, math.ceil(xmax / 4) * 4, 4):
    for z in range(math.floor(zmin / 4) * 4, math.ceil(zmax / 4) * 4, 4):
      clipped = poly.intersection(box(x, z, x + 4, z + 4))
      if clipped.is_empty or clipped.area < 0.00001:
        continue
      for part in getattr(clipped, "geoms", [clipped]):
        if not isinstance(part, Polygon):
          continue
        for tri in triangulate(part):
          if not part.covers(tri.representative_point()):
            continue
          coords = list(tri.exterior.coords)[:3]
          ids = [vertex(*p) for p in coords]
          # upward in world X/Y/Z, which reverses the 2D X/Z orientation
          a, b, c = coords
          if (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0:
            ids.reverse()
          indices.append(ids)
          colors.append((x // 4 + 2 * (z // 4)) % 3)

  # Independent orthogonal 2m native family. Adjacent identical-height cells
  # are losslessly run-merged; no diagonal surface or borrowed drawn normal.
  cells = {}
  for z in range(math.floor(zmin / 2) * 2, math.ceil(zmax / 2) * 2, 2):
    for x in range(math.floor(xmin / 2) * 2, math.ceil(xmax / 2) * 2, 2):
      if not poly.covers(box(x, z, x + 2, z + 2)):
        continue
      y = (
        math.ceil(
          (max(dgm(x + 1, z + 1), retained_ground(x + 1, z + 1, True)) + 0.09) * 4
        )
        / 4
      )
      cells[x, z] = y
  native = []
  while cells:
    x, z = min(cells, key=lambda p: (p[1], p[0]))
    y = cells.pop((x, z))
    width = 2
    while cells.get((x + width, z)) == y:
      cells.pop((x + width, z))
      width += 2
    # A run has one subdued granite tone; no random facade colours.
    native.append([x, z, width, 2, y, (x // 8 + z // 8) % 3])

  voxels_path = PUBLIC / "minecraft-voxels.json"
  voxels = json.loads(voxels_path.read_text())
  previous_columns = []
  cell = voxels["cell_m"]
  for zi, row in enumerate(voxels["building_rows"]):
    z = (zi + voxels["grid"]["min_z_idx"]) * cell
    if z + cell <= zmin or z >= zmax:
      continue
    for xoffset, count, lo, hi, cls in row:
      # Prism class 0 (office/other) maps to native material class concrete;
      # these are deliberately different catalogues, not equal numeric IDs.
      if hi - lo != 40 or cls != voxels["classes"].index("concrete"):
        continue
      for xi in range(xoffset, xoffset + count):
        x = (xi + voxels["grid"]["min_x_idx"]) * cell
        if x + cell <= xmin or x >= xmax:
          continue
        if poly.intersection(box(x, z, x + cell, z + cell)).area > 0.001:
          previous_columns.append([x + cell / 2, z + cell / 2, lo / 10, hi / 10])
  data = {
    "sourceId": original["id"],
    "ring": ring,
    "positions": positions,
    "triangles": indices,
    "colors": colors,
    "native": native,
    "previousNativeColumns": previous_columns,
  }
  OUT.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  evidence = {
    "schema": "kulturforum-piazzetta-v246",
    "replacedPrism": original,
    "replacedPrismSha256": hashlib.sha256(
      json.dumps(original, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest(),
    "dgm": {
      "url": DGM_URL,
      "sha256": DGM_SHA,
      "member": member,
      "crs": "EPSG:25833",
      "worldTransform": "x=E-389500,z=5820000-N,y=NHN-30",
      "usedSamples": [[x + 0.5, z + 0.5, h] for (x, z), h in sorted(used.items())],
    },
    "retainedTerrainSha256": hashlib.sha256(
      (PUBLIC / "ground-context.json").read_bytes()
    ).hexdigest(),
    "retainedVoxelsSha256": hashlib.sha256(voxels_path.read_bytes()).hexdigest(),
    "nativeReplacement": {
      "columns": previous_columns,
      "rule": "Exact retained cell/low/high receipts, 4m quantized height of this sole parking prism, positive source footprint intersection; taller cafe/museum columns remain",
    },
    "geometry": {
      "preservedSourceRingVertices": len(ring),
      "areaM2": poly.area,
      "drawnVertices": len(positions),
      "drawnTriangles": len(indices),
      "nativeRuns": len(native),
      "heightFusion": "max(official DGM1, unchanged prior terrain) + 9cm paving; native quarter-metre steps",
      "pavingPattern": "estimated muted granite panels, not a traced paving survey",
      "retiredPlaceholder": "ExpandedCityDetails 82x38m ramp at y8.08..13.48 only",
    },
    "architectureReferences": [
      {
        "url": "https://www.museum-der-1000-orte.de/bauwerke/bauwerk/piazzetta",
        "evidence": "Rolf Gutbrod / Heinz Mack: terraces and steps over underground parking, varied granite; BBR / Cordia Schlegelmilch 2012 photograph, reference only",
      },
      {
        "url": "https://www.smb.museum/museen-einrichtungen/gemaeldegalerie/ueber-uns/profil/",
        "evidence": "Hilmer & Sattler gallery above rising Piazzetta; restrained facade/classical proportions",
      },
      {
        "url": "https://www.smb.museum/museen-einrichtungen/kulturforum/besuch-planen/lageplan/",
        "image": "https://www.smb.museum/fileadmin/website/Orte/Kulturforum/Ueber_uns/Profil/KF_Aussenansicht_03.jpg",
        "credit": "Staatliche Museen zu Berlin / Maximilian Meisse; visual reference only, no bundled photo",
      },
    ],
  }
  EVIDENCE.write_text(json.dumps(evidence, separators=(",", ":")) + "\n")
  print(json.dumps(evidence["geometry"]))


if __name__ == "__main__":
  build()
