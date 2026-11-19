"""Bake surveyed surfaces of Nikolaikirchplatz for both viewer projections."""

import argparse
import gzip
import json
import math
from pathlib import Path

import numpy as np
import shapely
from shapely import affinity
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "geo_data/regierungsviertel/nikolaikirchplatz-v367.geojson.gz"
OUT = ROOT / "src/app/src/data/nikolaikirchplatzV367.json"
ORIGIN = (2390, 290)
# Whole survey owners around the church. The adjoining arterial is outside this correction.
ROAD = {25662, 25669, 25689, 25703, 25714, 25920, 25962, 26008, 53263, 53365, 53566}
WALK = {
  390674,
  391019,
  391024,
  391037,
  391046,
  391061,
  391380,
  391501,
  391503,
  391540,
  391702,
  391705,
  391849,
  391856,
  391914,
  391921,
  392049,
  392214,
  392224,
  392556,
  392611,
  392628,
  392760,
  392773,
  392784,
  392934,
  393095,
  666230,
  666338,
  666409,
  666570,
  666642,
  666718,
  666903,
  667060,
  667063,
  667131,
  667149,
  668243,
  669206,
  392417,
  392447,
  392941,
}
GREEN = {23133, 23231, 23235, 42024, 42903}
KERB = {
  217477,
  220467,
  231175,
  237469,
  238963,
  239817,
  247291,
  453845,
  453846,
  458142,
  465955,
  466876,
}
LAYERS = {
  "ci_oeffentlicher_platz": {1207},
  "cm_fahrbahn": ROAD,
  "cl_gehweg": WALK,
  "ce_gruenflaeche": GREEN,
  "bd_bordstein": KERB,
  "by_gehwegueberfahrt": {131223},
  "bv_springbrunnen_zierbrunnen": {77},
  "bj_sitzbank": set(range(5357, 5364)),
}


def read_survey(directory):
  features = []
  for layer, ids in LAYERS.items():
    source = json.loads((directory / (layer + ".json")).read_text())
    picked = [f for f in source["features"] if int(f["id"].split(".")[1]) in ids]
    assert len(picked) == len(ids), layer
    features.extend(picked)
  data = {
    "type": "FeatureCollection",
    "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:EPSG::25833"}},
    "features": features,
  }
  ARCHIVE.write_bytes(
    gzip.compress(json.dumps(data, separators=(",", ":")).encode(), mtime=0)
  )


def flagstones(strip):
  """Alternating slabs on long, straight surveyed natural-stone ribbons only."""
  corners = list(strip.minimum_rotated_rectangle.exterior.coords)
  edges = [(b[0] - a[0], b[1] - a[1]) for a, b in zip(corners, corners[1:])]
  dx, dz = max(edges, key=lambda e: math.hypot(*e))
  length = math.hypot(dx, dz)
  if (
    length < 6
    or strip.area / strip.minimum_rotated_rectangle.area < 0.74
    or strip.area / length > length / 5
  ):
    return []
  ux, uz = dx / length, dz / length
  start = min(x * ux + z * uz for x, z in corners)
  side = min(-x * uz + z * ux for x, z in corners) - 1
  width = max(-x * uz + z * ux for x, z in corners) - side + 1

  def point(t, u):
    return (ux * t - uz * u, uz * t + ux * u)

  pieces = []
  # Slab sizes and the two similar granite tones are visual estimates.
  sizes = [0.90, 1.12, 1.02, 0.84]
  t, index = start, 0
  while t < start + length:
    end = t + sizes[index % len(sizes)]
    if index % 2:
      rect = Polygon(
        [
          point(t, side),
          point(end, side),
          point(end, side + width),
          point(t, side + width),
        ]
      )
      pieces.append(strip.intersection(rect))
    t, index = end, index + 1
  return pieces


def surfaces():
  groups = {}
  benches = []
  for feature in json.loads(gzip.decompress(ARCHIVE.read_bytes()))["features"]:
    layer = feature["id"].split(".")[0]
    g = affinity.affine_transform(
      shape(feature["geometry"]),
      [1, 0, 0, -1, -389500 - ORIGIN[0], 5820000 - ORIGIN[1]],
    )
    if layer == "bv_springbrunnen_zierbrunnen":
      center = [round(g.centroid.x + ORIGIN[0], 2), round(g.centroid.y + ORIGIN[1], 2)]
      # The survey includes the outer stone apron; the existing V353 octagonal
      # steps own their full four-metre diameter at the corrected register pose.
      seat = Point(center[0] - ORIGIN[0], center[1] - ORIGIN[1]).buffer(2, quad_segs=2)
      groups["apron"] = [g.difference(seat)]
    elif layer == "bj_sitzbank":
      line = g.geoms[0]
      benches.append(
        [round(v * 100) for point in (line.coords[0], line.coords[-1]) for v in point]
      )
    else:
      material = feature["properties"].get("material")
      if layer == "bd_bordstein":
        # Full width is an illustration estimate centred on the surveyed stone line.
        material = "kerb"
        g = g.buffer(0.105, cap_style="flat", join_style="round", quad_segs=2)
      elif layer == "ce_gruenflaeche":
        material = "garden"
      elif layer == "ci_oeffentlicher_platz":
        material = "square"
      assert material in {"04", "05", "08", "13", "kerb", "garden", "square"}
      groups.setdefault(material, []).append(shapely.make_valid(g))
      if layer == "cl_gehweg" and material == "08":
        groups.setdefault("slab", []).extend(flagstones(g))
  return {m: unary_union(parts) for m, parts in groups.items()}, center, benches


def deltas(values, stride):
  return [v - (values[i - stride] if i >= stride else 0) for i, v in enumerate(values)]


def geometry():
  groups, center, benches = surfaces()
  painted = shapely.GeometryCollection()
  result = []
  # Small overlapping survey tolerances, including kerb widths, get one visible colour.
  for name in ["kerb", "garden", "apron", "square", "slab", "08", "04", "05", "13"]:
    g = shapely.set_precision(groups[name].difference(painted), 0.01)
    painted = painted.union(g)
    points, indices, lookup = [], [], {}
    for tri in shapely.constrained_delaunay_triangles(g).geoms:
      # Viewer Y-up, local metre z grows south.
      coords = list(shapely.orient_polygons(tri, exterior_cw=True).exterior.coords)[:3]
      for x, z in coords:
        key = (round(x * 100), round(z * 100))
        if key not in lookup:
          lookup[key] = len(lookup)
          points.extend(key)
        indices.append(lookup[key])
    # Cardinal 25 cm cells with one material per centre; merge adjoining equal spans.
    ix0, iz0, ix1, iz1 = (
      int(v)
      for v in [
        np.floor(g.bounds[0] * 4),
        np.floor(g.bounds[1] * 4),
        np.ceil(g.bounds[2] * 4),
        np.ceil(g.bounds[3] * 4),
      ]
    )
    xs = np.arange(ix0, ix1)
    runs = []
    prev = {}
    for iz in range(iz0, iz1):
      mask = shapely.contains_xy(g, (xs + 0.5) / 4, (iz + 0.5) / 4)
      endpoints = np.flatnonzero(np.diff(mask, prepend=False, append=False)) + ix0
      current = {}
      for start, end in endpoints.reshape(-1, 2):
        key = (int(start), int(end - start))
        if key in prev:
          prev[key][3] += 1
          current[key] = prev[key]
        else:
          run = [key[0], iz, key[1], 1]
          runs.append(run)
          current[key] = run
      prev = current

    result.append(
      {
        "material": name,
        "points": deltas(points, 2),
        "indices": deltas(indices, 1),
        "runs": deltas([v for run in runs for v in run], 4),
      }
    )
  furniture = []
  for ax, az, bx, bz in benches:
    line = LineString([(ax / 100, az / 100), (bx / 100, bz / 100)])
    shapes = [
      (line.offset_curve(offset).buffer(0.05, cap_style="flat"), "seat")
      for offset in [-0.14, 0, 0.14]
    ]
    for distance in [0.17, line.length - 0.17]:
      crossing = LineString(
        [line.offset_curve(offset).interpolate(distance) for offset in [-0.16, 0.16]]
      )
      shapes.append((crossing.buffer(0.045, cap_style="flat"), "frame"))
    for p, material in shapes:
      points = [[round(x * 100), round(z * 100)] for x, z in p.exterior.coords[:-1]]
      # Fine block runs preserve the narrow iron frames and the open gaps between slats.
      rects = []
      x0, z0, x1, z1 = p.bounds
      xs = np.arange(np.floor(x0 * 20), np.ceil(x1 * 20), dtype=int)
      for iz in range(int(np.floor(z0 * 20)), int(np.ceil(z1 * 20))):
        mask = shapely.contains_xy(p, (xs + 0.5) / 20, (iz + 0.5) / 20)
        ends = np.flatnonzero(np.diff(mask, prepend=False, append=False)) + xs[0]
        rects.extend([[int(i), iz, int(j - i)] for i, j in ends.reshape(-1, 2)])
      furniture.append({"material": material, "points": points, "runs": rects})
  return {
    "origin": ORIGIN,
    "fountain": center,
    "furniture": furniture,
    "surfaces": result,
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--survey",
    type=Path,
    help="Import original WFS GetFeature responses named after their layer",
  )
  args = parser.parse_args()
  if args.survey:
    read_survey(args.survey)
  OUT.write_text(json.dumps(geometry(), separators=(",", ":")) + "\n")
