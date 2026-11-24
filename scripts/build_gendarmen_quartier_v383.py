"""Bake the renewed square from registered Berlin paving, planting and OSM geometry."""

import argparse
import gzip
import json
from pathlib import Path

import shapely as sh
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, box, shape

from scripts.build_kreuzberg_plaetze_v380 import Mesh

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/gendarmen-quartier-v383.json.gz"
TARGET = ROOT / "src/app/src/data/gendarmenQuartierV383.json"
GRANITE = (193, 190, 182)


def joined(geometries):
  return sh.union_all(list(geometries), grid_size=0.01)


def square_geometry(source):
  paving = shape(source["square"][1])
  outer = Polygon(paving.exterior)
  inner = outer.buffer(-3.6)
  mesh = Mesh([1410, 0, 620])
  available = paving
  # Four gardens are holes in the mapped pedestrian surface. The street survey also
  # records a distinct small planted bed next to the Französischer Dom.
  lawns = joined(shape(g) for _, g in source["lawns"])
  green = joined([lawns, *(shape(g).intersection(outer) for _, g in source["greens"])])

  def paint(area, tint):
    if area.is_empty:
      return
    # The older church and monument steps stand on the central 5.2 m datum. A ramp
    # in the outer 3.6 m meets the independently fitted surrounding sidewalk at 5.67.
    for part, ring in [
      (area.intersection(inner), False),
      (area.difference(inner), True),
    ]:

      def xyz(x, z):
        y = 5.36
        if ring:
          distance = outer.exterior.distance(sh.Point(x, z))
          y += 0.31 * max(0.0, 1.0 - distance / 3.6)
        return (x, y, z)

      mesh.polygon(part, tint, xyz)

  def take(area, color):
    nonlocal available
    face = available.intersection(area)
    paint(face, color)
    available = available.difference(face)

  paint(green, (127, 145, 98))
  available = available.difference(green)
  for _, g in source["pits"]:
    pit = shape(g)
    take(pit, (137, 126, 106))
  # Surveyed individual slab fields take precedence over the rectified orthophoto grid.
  slab_regions = [shape(g) for _, mat, g in source["cells"] if mat == "08"]
  known = joined(slab_regions)
  take(known, (213, 209, 199))
  # Metric registration against TrueDOP 2026. Side lengths, strip width and the
  # changes in rhythm north/south of the four lamp standards are read in metres.
  transform = [0.99714, 0.07558, -0.07558, 0.99714, 1425.438, 617.052]

  def xz(uv):
    return affine_transform(uv, transform)

  # Measured historic stone bays already cover the central rectangle. Limit the
  # orthophoto continuation to actual paved aprons visible beside the two churches.
  zones = joined(
    [xz(box(-78, -65, 33, 66)), xz(box(21, -134, 33, -65)), xz(box(21, 66, 33, 131))]
  )
  original_fields = joined(shape(g) for _, kind, g in source["cells"] if kind == "04")
  zones = zones.difference(known.buffer(0.46, join_style="mitre"))
  cells = []
  for i in range(-17, 8):
    for j in range(-28, 28):
      u, v = -0.29 + 5.00 * i, 0.32 + 5.00 * j
      rect = xz(box(u - 1.98, v - 2.00, u + 1.98, v + 2.00))
      cells.append(rect)
  take(joined(cells).intersection(zones), (209, 205, 196))
  take(zones, GRANITE)
  take(original_fields, (199, 196, 186))
  take(
    joined(shape(g) for _, kind, g in source["cells"] if kind == "02"), (175, 165, 143)
  )
  paint(available, (204, 200, 190))
  return mesh.finish()


def make():
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  furniture = {
    "benches": [
      [*b["a"], *b["b"], int(b["wood"]), int(b["back"])] for b in source["benches"]
    ],
    "lamps": [p[1:] for p in source["lamps"]],
    "drink": [p[1:] for p in source["drink"]],
  }
  return {"mesh": square_geometry(source), **furniture}


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  content = (
    json.dumps(make(), ensure_ascii=False, separators=(",", ":")) + "\n"
  ).encode()
  if args.check:
    if content != TARGET.read_bytes():
      raise SystemExit("Gendarmenmarkt packet differs from the source bake")
  else:
    TARGET.write_bytes(content)
