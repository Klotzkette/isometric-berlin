"""Fit the two exterior elevations of the Bundesschlange to both shipped city models."""

import json
import math
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
MESH = ROOT / "src/app/public/mesh/regierungsviertel"
OUTPUT = ROOT / "src/app/src/data/bundesschlangeV390.json"
# The identified north and south faces follow the meander, including its
# hairpins. Reclassifying faces by compass bearing would swap sides there.
SITES = {
  "xKyiyJUA": (8, range(9, 19)),
  "Slqck15f": (7, range(7, 17)),
  "hoWtvywS": (7, range(15, 32)),
  "LkrNbm5U": (6, range(17, 32)),
  "PTHcoWgK": (5, range(16, 36)),
  "wdoVKJBG": (8, None),
  "bNl9Js1j": (8, None),
  "YvUzcaBI": (8, None),
  "fN819yUG": (8, None),
}
DIRECTIONS = ((1, 0), (0, 1), (-1, 0), (0, -1))


def main():
  prisms = json.loads((MESH / "lod2-prisms.json").read_bytes())["buildings"]
  voxel = json.loads((MESH / "minecraft-voxels.json").read_bytes())
  records = {p["id"]: p for p in prisms if p["id"] in SITES}
  assert records.keys() == SITES.keys()
  polygons = {
    k: Polygon([(x / 10, z / 10) for x, z in p["ring"]]) for k, p in records.items()
  }
  grid = voxel["grid"]
  rows = voxel["building_rows"]

  def columns(x, z):
    i = x - grid["min_x_idx"]
    return [r[2:] for r in rows[z - grid["min_z_idx"]] if r[0] <= i < r[0] + r[1]]

  result = []
  for key, (floors, north) in SITES.items():
    polygon = polygons[key]
    assert polygon.exterior.is_ccw and not polygon.interiors
    neighbors = unary_union([v for k, v in polygons.items() if k != key])
    coords = list(polygon.exterior.coords)
    faces = []
    # All of these nine rings have positive signed area in the scene X/Z plane.
    for i, (a, b) in enumerate(zip(coords, coords[1:], strict=False)):
      edge = LineString([a, b])
      dx, dz = (b[0] - a[0]) / edge.length, (b[1] - a[1]) / edge.length
      # Probe a hair outside the wall. Exclude shared walls and the embedded
      # sections of the western head where LoD2 divides the roof into parts.
      exterior = LineString([(x + dz * 0.04, z - dx * 0.04) for x, z in (a, b)])
      exposed = exterior.difference(neighbors)
      for line in getattr(exposed, "geoms", [exposed]):
        if line.is_empty or line.length < 0.65:
          continue
        begin, end = [
          round(exterior.project(Point(line.coords[j])) * 100) for j in (0, -1)
        ]
        style = "head" if north is None else "street" if i in north else "garden"
        faces.append([i, begin, end, style])

    def wall(face):
      i, start, end, _ = face
      edge = LineString(coords[i : i + 2])
      return LineString([edge.interpolate(start / 100), edge.interpolate(end / 100)])

    edges = [wall(face) for face in faces]
    native = []
    x0, z0, x1, z1 = [math.floor(v / 4) for v in polygon.bounds]
    for z in range(z0, z1 + 1):
      for x in range(x0, x1 + 1):
        centre = Point(x * 4 + 2, z * 4 + 2)
        if not polygon.covers(centre):
          continue
        for low, high, kind in columns(x, z):
          if kind != 3 or high - low < 100:
            continue
          for direction, (dx, dz) in enumerate(DIRECTIONS):
            if any(lo < high and hi > low for lo, hi, _ in columns(x + dx, z + dz)):
              continue
            middle = Point(centre.x + dx * 2, centre.y + dz * 2)
            candidates = []
            for j, edge in enumerate(edges):
              a, b = edge.coords
              dot = ((b[1] - a[1]) * dx - (b[0] - a[0]) * dz) / edge.length
              distance = edge.distance(middle)
              if dot > 0.08 and distance < 4:
                candidates.append((distance + 0.35 * (1 - dot), j))
            if candidates:
              native.append([x, z, direction, low, high, kind, min(candidates)[1]])
    result.append(dict(prism=records[key], floors=floors, faces=faces, native=native))
  OUTPUT.write_text(
    json.dumps(
      dict(grid=grid, classes=voxel["classes"], sites=result), separators=(",", ":")
    )
    + "\n"
  )


if __name__ == "__main__":
  main()
