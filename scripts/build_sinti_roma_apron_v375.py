"""Trace the visible outer granite and grass, retaining the existing 237 inner slabs."""

import argparse
import base64
import gzip
import json
import math
from pathlib import Path

import contourpy
import numpy as np
import shapely
from PIL import Image
from scipy import ndimage
from shapely import Point, Polygon, box
from shapely.affinity import scale, translate
from shapely.ops import polygonize
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PHOTO = GEO / "sinti-roma-v375-truedop-2024.png"
GROUND = GEO / "sinti-roma-v375-apron-source.json.gz"
OUTPUT = ROOT / "src/app/src/data/sintiRomaApronV375.json"
X, Z = 307.700225593755, 186.2301389835775
PHOTO_BOUNDS = (389790, 5819798, 389825, 5819833)
WMS = "https://gdi.berlin.de/services/wms/truedop_2024"
GROUND_BOUNDS = (294, 172, 321, 199)


def capture(path):
  import pyogrio

  feature = pyogrio.read_dataframe(
    GEO / "osm.gpkg", layer="roads", where="id='8329726'"
  ).iloc[0]
  if feature.highway != "footway" or feature.surface != "paved":
    raise ValueError("Missing mapped memorial apron")
  mapped = scale(translate(feature.geometry, -389500, -5820000), 1, -1, origin=(0, 0))
  captured = json.loads(path.read_bytes())
  extent = box(*GROUND_BOUNDS)
  planes = []
  for _, name, _, _, flat in captured["tris"]:
    points = np.asarray(flat).reshape(3, 3)
    shape = Polygon(points[:, [0, 2]])
    if extent.intersects(shape) and shape.area > 1e-7:
      planes.append([name, flat])
  for x, z, xx, zz, y, _ in captured["rows"]:
    if extent.intersects(box(x, z, xx, zz)):
      for tr in [[x, y, z, xx, y, z, x, y, zz], [xx, y, z, xx, y, zz, x, y, zz]]:
        planes.append(["Drawn ground slabs", tr])
  source = dict(
    osm="https://www.openstreetmap.org/relation/8329726",
    footprint=mapped.wkt,
    imagery=dict(
      service=WMS,
      layer="truedop_2024",
      bbox=PHOTO_BOUNDS,
      crs="EPSG:25833",
      imageSize=[700, 700],
    ),
    ownerPlanes=planes,
  )
  GROUND.write_bytes(
    gzip.compress(json.dumps(source, separators=(",", ":")).encode(), mtime=0)
  )


def polygons(g):
  if g.geom_type == "Polygon":
    if g.area > 0.00001:
      yield g
  elif hasattr(g, "geoms"):
    for part in g.geoms:
      yield from polygons(part)


def trace(mask, domain):
  # Vectorise the pixel-centre 50% isocontour at the WMS sample spacing.
  gen = contourpy.contour_generator(
    x=290.025 + np.arange(700) * 0.05,
    y=167.025 + np.arange(700) * 0.05,
    z=mask.astype(float),
    fill_type="OuterOffset",
  )
  paths, offsets = gen.filled(0.5, 1.5)
  pieces = []
  for points, ring_offsets in zip(paths, offsets, strict=True):
    rings = [
      points[a:b] for a, b in zip(ring_offsets[:-1], ring_offsets[1:], strict=True)
    ]
    g = shapely.make_valid(Polygon(rings[0], rings[1:])).simplify(
      0.075, preserve_topology=True
    )
    if g.area >= 0.045 and domain.intersects(g):
      pieces.append(g.intersection(domain))
  return shapely.union_all(pieces)


def materials(domain):
  with Image.open(PHOTO) as photo:
    rgb = np.asarray(photo.convert("RGB"), dtype=float)
  if rgb.shape != (700, 700, 3):
    raise ValueError("Mismatched orthophoto grid")
  red, green, blue = rgb.transpose(2, 0, 1)
  light = rgb.mean(axis=2)
  pale = (light > 128.3) & (green - red < 12) & (green - blue < 28)
  pale = ndimage.median_filter(pale, size=3)
  # The dark local joints between adjacent granite slabs remain open.
  stones = pale & ((light - ndimage.gaussian_filter(light, 5) > -1.3) | (light > 170))
  rock = trace(stones, domain)
  # The grass around the outer stones is partly shaded. In the 2024 capture
  # it remains green-dominant, unlike the pale granite or the grey access path.
  planted = ((green - red > 3) & (green - blue > 14) & (light < 155)) | (
    (green >= red) & (green - blue > 9) & (light < 100)
  )
  grass = trace(ndimage.median_filter(planted, size=5), domain)
  # The joints lie on a continuous surface, including underneath the stone.
  # Keeping that base undivided avoids re-triangulating all 4 cm raised footprints as holes.
  tones = [[], [], []]
  for patch in polygons(rock):
    here = patch.representative_point()
    value = light[round((here.y - 167.025) / 0.05), round((here.x - 290.025) / 0.05)]
    tone = 0 if value < 148 else 1 if value < 169 else 2
    tones[tone].append(patch)
  return [grass, domain.difference(grass), *(shapely.union_all(t) for t in tones)]


def pack(words, dtype):
  data = np.asarray(words, dtype=dtype).tobytes()
  return base64.b64encode(gzip.compress(data, mtime=0)).decode()


def build():
  source = json.loads(gzip.decompress(GROUND.read_bytes()))
  footprint = shapely.from_wkt(source["footprint"])
  # Circumscribed polygon: no part of an old fitted slab, grass joint, basin
  # or poem can intersect even at the linear approximation of the inner edge.
  inner = Point(X, Z).buffer(9.55 / math.cos(math.pi / 192) + 0.002, quad_segs=48)
  domain = footprint.difference(inner)
  kinds = materials(domain)
  ground = []
  planes = []
  for _, flat in source["ownerPlanes"]:
    tri = np.asarray(flat).reshape(3, 3)
    poly = Polygon(tri[:, [0, 2]])
    if poly.area < 1e-7 or not domain.intersects(poly):
      continue
    norm = np.cross(tri[1] - tri[0], tri[2] - tri[0])
    a, b = -norm[0] / norm[1], -norm[2] / norm[1]
    planes.append((a, b, tri[0, 1] - a * tri[0, 0] - b * tri[0, 2]))
    ground.append(poly)
  lookup = STRtree(ground)
  boundaries = [domain.boundary]
  for p in ground:
    boundaries.append(p.boundary.intersection(domain))
  atoms = polygonize(shapely.union_all(boundaries, grid_size=0.00001))
  vertices = []
  indices = []
  by_vertex = {}
  counts = [0] * len(kinds)
  areas = [0.0] * len(kinds)
  for atom in atoms:
    probe = atom.representative_point()
    if not domain.covers(probe) or atom.area < 0.00001:
      continue
    hits = [planes[i] for i in lookup.query(probe, predicate="intersects")]
    if not hits:
      raise ValueError("Missing local ground support")
    for kind, area in enumerate(kinds):
      for part in polygons(shapely.intersection(atom, area, grid_size=0.00001)):
        areas[kind] += part.area
        for triangle in shapely.constrained_delaunay_triangles(part).geoms:
          ring = list(triangle.exterior.coords)[:-1]
          if triangle.exterior.is_ccw:
            ring.reverse()
          corners = []
          for x, z in ring:
            y = max(a * x + b * z + c for a, b, c in hits)
            # Keep the earth and entrance flush against the existing local
            # terrain; the measured stone silhouettes project only 4 cm.
            raised = 0.04 if kind >= 2 else (0.005, 0.009)[kind]
            v = (
              round((x - X) * 1000),
              round((y + raised - 4.48) * 1000),
              round((z - Z) * 1000),
              kind,
            )
            if v not in by_vertex:
              by_vertex[v] = len(vertices)
              vertices.append(v)
            corners.append(by_vertex[v])
          if len(set(corners)) == 3:
            indices.extend(corners)
            counts[kind] += 1
  if abs(sum(areas[:2]) - domain.area) > 0.01:
    raise ValueError(f"Measured classes cover {areas[:2]} m² of {domain.area} m²")
  return dict(
    origin=[X, 4.48, Z],
    areasM2=[round(a, 3) for a in areas],
    triangles=counts,
    vertices=pack(vertices, "<i2"),
    indices=pack(indices, "<u2"),
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--capture",
    type=Path,
    help="world-space ground triangles and original slab rectangles",
  )
  args = parser.parse_args()
  if args.capture:
    capture(args.capture)
  result = build()
  OUTPUT.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(result["areasM2"], result["triangles"], OUTPUT.stat().st_size)
