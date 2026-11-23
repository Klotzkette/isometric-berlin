"""Replace the old drawn palace shell by its matched official LoD2 building."""

import gzip
import json
import math
from pathlib import Path

import numpy as np
from shapely import constrained_delaunay_triangles
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GROUND = 3.0
WALL = 0xE4E0D2
ROOF = 0x656967


def triangulate(rings):
  source = np.asarray(rings[0])
  origin = source[0]
  _, _, basis = np.linalg.svd(source - origin, full_matrices=False)
  uv = basis[:2]
  polygon = Polygon(
    (source - origin) @ uv.T, [(np.asarray(r) - origin) @ uv.T for r in rings[1:]]
  )
  for tri in constrained_delaunay_triangles(polygon).geoms:
    yield np.asarray(list(tri.exterior.coords)[:3]) @ uv + origin


def height(tri, x, z):
  ds = tri[1:] - tri[0]
  den = ds[0, 0] * ds[1, 2] - ds[0, 2] * ds[1, 0]
  if abs(den) < 1e-9:
    return None
  dx, dz = x - tri[0, 0], z - tri[0, 2]
  a, b = (dx * ds[1, 2] - dz * ds[1, 0]) / den, (ds[0, 0] * dz - ds[0, 2] * dx) / den
  if a >= -0.0001 and b >= -0.0001 and a + b <= 1.0001:
    return tri[0, 1] + a * ds[0, 1] + b * ds[1, 1]
  return None


def main():
  record = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/tegel-landscape-source-v378.json.gz"
      ).read_bytes()
    )
  )["castle"]
  base = min(y for kind, rings in record["parts"] for r in rings for _, y, _ in r)
  triangles = []
  roofs = []
  ground = []
  for kind, rings in record["parts"]:
    if kind == "GroundSurface":
      ground.append(Polygon([(x, z) for x, y, z in rings[0]]))
      continue
    for t in triangulate(rings):
      t[:, 1] += GROUND - base
      triangles.append((t, ROOF if kind == "RoofSurface" else WALL))
      if kind == "RoofSurface":
        roofs.append(t)
  official_roofs = roofs.copy()

  def roof_at(x, z):
    return max(
      (h for t in official_roofs if (h := height(t, x, z)) is not None), default=0
    )

  old = next(
    s
    for s in json.loads((DATA / "westLakesV194.json").read_bytes())["sites"]
    if s["key"] == "schloss-tegel"
  )
  v = np.asarray(old["positions"]).reshape(-1, 3)
  # The generalized city model flattens two of the four documented corner
  # towers. Preserve those existing Schinkel recognition features.
  for a, b, c in np.asarray(old["indices"]).reshape(-1, 3):
    t = v[[a, b, c]]
    if t[:, 1].max() < 15.99 or t[:, 1].min() < 10.99:
      continue
    x, _, z = t.mean(axis=0)
    h = roof_at(x, z)
    if 0 < h <= 15.70:
      triangles.append((t, old["colors"][int(a)]))
      if abs(np.cross(t[1] - t[0], t[2] - t[0])[1]) > 0.001:
        roofs.append(t)
  pos = []
  colors = []
  indices = []
  unique = {}
  for t, color in triangles:
    for x, y, z in t:
      key = (round(x, 3), round(y, 3), round(z, 3), color)
      if key not in unique:
        unique[key] = len(colors)
        pos.extend(key[:3])
        colors.append(color)
      indices.append(unique[key])
  old_native = next(
    s
    for s in json.loads((DATA / "westLakesV194Native.json").read_bytes())["sites"]
    if s["key"] == "schloss-tegel"
  )
  prior = {}
  for x, y, z, w, h, d, *_ in old_native["boxes"]:
    for ix in range(math.ceil(x - w / 2 - 0.5), math.floor(x + w / 2 - 0.5) + 1):
      for iz in range(math.ceil(z - d / 2 - 0.5), math.floor(z + d / 2 - 0.5) + 1):
        prior[ix, iz] = max(prior.get((ix, iz), GROUND), y + h / 2)
  native = []
  poly = unary_union(ground)
  xmin, zmin, xmax, zmax = poly.bounds
  for ix in range(math.floor(xmin), math.ceil(xmax)):
    for iz in range(math.floor(zmin), math.ceil(zmax)):
      x, z = ix + 0.5, iz + 0.5
      high = round(roof_at(x, z) * 2) / 2
      low = prior.get((ix, iz), GROUND)
      if not poly.covers(Point(x, z)) or high <= low + 0.05:
        continue
      if high - low > 0.5:
        native.append([x, (high - 0.5 + low) / 2, z, 1, high - 0.5 - low, 1, WALL])
      h = min(0.5, high - low)
      native.append([x, high - h / 2, z, 1, h, 1, ROOF])
  roof_tri = [[round(float(v), 3) for v in t.flatten()] for t in roofs]
  result = dict(
    id=record["id"],
    positions=pos,
    colors=colors,
    indices=indices,
    boxes=native,
    roof=roof_tri,
  )
  (DATA / "tegelLandscapeCastleV378.json").write_text(
    json.dumps(result, separators=(",", ":")) + "\n"
  )
  print(
    record["id"],
    len(official_roofs),
    "CityGML roof triangles and",
    len(roofs) - len(official_roofs),
    "retained historic corner roof triangles,",
    len(native),
    "additional native cap blocks",
  )


if __name__ == "__main__":
  main()
