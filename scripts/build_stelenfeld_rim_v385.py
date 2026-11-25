"""Register the public sidewalks around the memorial to the two existing terrain owners."""

import argparse
import base64
import gzip
import json
import math
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.affinity import affine_transform, rotate, translate
from shapely.geometry import Point, Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
CORE = ROOT / "src/app/public/mesh/regierungsviertel"


def build():
  source = json.load(gzip.open(GEO / "stelenfeld-v385.json.gz"))
  survey = json.load(gzip.open(GEO / "stelenfeld-rand-v385.geojson.gz"))["layers"]
  site = Polygon(source["fieldBoundary"])
  band = site.buffer(13, join_style="mitre").difference(site)
  layers = {
    k: [
      (r, affine_transform(shape(r["geometry"]), [1, 0, 0, -1, -389500, 5820000]))
      for r in features
    ]
    for k, features in survey.items()
  }
  flats = [
    translate(
      rotate(box(-1.19, -0.475, 1.19, 0.475), yaw / 1000, use_radians=True),
      460 + x / 100,
      550 + z / 100,
    )
    for x, z, h, yaw, *_ in source["stelePoses"]
    if not h
  ]
  outside = [f for f in flats if not site.covers(f.centroid)]
  street = sh.union_all(
    [
      p
      for r, p in layers["tatsaechlichenutzungflaechen"]
      if r["properties"]["bezeich"] == "AX_Strassenverkehr"
    ]
  )
  assert len(outside) == 81 and all(street.covers(f.centroid) for f in outside)
  walks = [
    (r, p) for r, p in layers["cl_gehweg"] if any(p.intersects(f) for f in outside)
  ]
  assert len(walks) == 12
  forbidden = [
    p
    for k in [
      "cm_fahrbahn",
      "bn_baumscheibe",
      "ch_radweg",
      "ck_parkflaeche",
      "ce_gruenflaeche",
      "cf_trennstreifen",
      "by_gehwegueberfahrt",
      "bw_aufmerksamkeitsfeld",
    ]
    for _, p in layers[k]
  ]
  legacy = {p["id"] for p in source["legacyPrisms"]}
  for p in json.load(open(CORE / "lod2-prisms.json"))["buildings"]:
    if p["id"] in legacy or not p["ring"]:
      continue
    x, z = p["ring"][0]
    if 3550 < x < 6050 and 4500 < z < 6800:
      real = Polygon(
        np.asarray(p["ring"]) / 10, [np.asarray(h) / 10 for h in p.get("holes", [])]
      )
      if real.is_valid:
        forbidden.append(real)
  ground = json.load(open(CORE / "ground-context.json"))
  gh = ground["ground_height"]
  samples = np.array(gh["y_dm"]).reshape(gh["rows"], gh["cols"]) / 10

  def smooth(x, z):
    i = (x / 4 - ground["grid"]["min_x_idx"]) / gh["stride_cells"] - 0.5
    j = (z / 4 - ground["grid"]["min_z_idx"]) / gh["stride_cells"] - 0.5
    a, b = math.floor(i), math.floor(j)
    u, v = i - a, j - b
    return (samples[b, a] * (1 - u) + samples[b, a + 1] * u) * (1 - v) + (
      samples[b + 1, a] * (1 - u) + samples[b + 1, a + 1] * u
    ) * v

  og = np.array(source["floorHeights"]).reshape(44, 47) / 100

  def field(x, z):
    i = max(0, min(45.9999, (x - 388) / 4))
    j = max(0, min(42.9999, (z - 480) / 4))
    a, b = math.floor(i), math.floor(j)
    u, v = i - a, j - b
    y0, y1, y2, y3 = og[b, a], og[b, a + 1], og[b + 1, a + 1], og[b + 1, a]
    return (
      y0 + (y1 - y0) * u + (y2 - y1) * v
      if u >= v
      else y0 + (y3 - y0) * v + (y2 - y3) * u
    )

  # Keep the actual restored asphalt and kerb footprint. For already-paved rows
  # an exact copy 12 mm below their streamed top is usable during early loading.
  original = {"paving": [], "asphalt": []}
  planes = []
  with open(DATA / "restoredRoadSurfaces.ndjson.txt") as stream:
    for line in stream:
      if not line.startswith(('{"id":"restored-asphalt-', '{"id":"restored-paving-')):
        continue
      rec = json.loads(line)
      if rec["id"].split("-")[-2:] not in (
        ["0", "0"],
        ["1", "0"],
        ["0", "1"],
        ["1", "1"],
      ):
        continue
      xy = np.frombuffer(base64.b64decode(rec["xz"]), dtype="<f4").reshape(-1, 2)
      tri = xy[
        np.frombuffer(base64.b64decode(rec["indices"]), dtype="<u4").reshape(-1, 3)
      ]
      keep = (
        (tri[:, :, 0].max(axis=1) > 378)
        & (tri[:, :, 0].min(axis=1) < 582)
        & (tri[:, :, 1].max(axis=1) > 470)
        & (tri[:, :, 1].min(axis=1) < 662)
      )
      for pts in tri[keep]:
        p = Polygon(pts)
        if p.area < 0.0001 or not p.intersects(band):
          continue
        original[rec["kind"]].append(p)
        if rec["kind"] == "paving":
          mat = np.c_[pts, np.ones(3)]
          planes.append(np.linalg.solve(mat, [smooth(x, z) + 0.1 for x, z in pts]))
  forbidden.extend(original["asphalt"])
  excluded = sh.union_all(forbidden)
  paving = sh.union_all(original["paving"])
  tree = sh.STRtree(original["paving"])

  def existing(x, z):
    q = Point(x, z)
    ids = tree.query(q, predicate="intersects")
    if len(ids):
      a, b, c = planes[ids[0]]
      return a * x + b * z + c
    return smooth(x, z) + 0.1

  by_mat = {
    m: sh.union_all([p for r, p in walks if r["properties"]["material"] == m])
    .intersection(band)
    .intersection(street)
    .difference(excluded)
    for m in ["04", "07"]
  }
  footprint = sh.union_all(list(by_mat.values()))

  def levels(x, z, part):
    native = field(x, z)
    if part == "inside":
      return native, native
    if part == "covered":
      return existing(x, z) - 0.012, native
    d = min(1, paving.distance(Point(x, z)) / 1.7)
    return (1 - d) * existing(x, z) + d * native, native

  verts = []
  indices = []
  unique = {}
  top_count = 0

  def vert(x, z, part, material, offset):
    # Millimetre height resolution keeps a flush insert visible in a steep seam.
    day, native = levels(x, z, part)
    v = (
      round((x - 460) * 100),
      round((z - 550) * 100),
      round((day + offset) * 1000),
      round((native + offset) * 1000),
      material,
    )
    if v not in unique:
      unique[v] = len(verts)
      verts.append(v)
    return unique[v]

  def surface(poly, part, mat, offset=0, step=4):
    if poly.is_empty:
      return
    x0, z0, x1, z1 = poly.bounds
    for x in range(math.floor(x0 / step) * step, math.ceil(x1 / step) * step, step):
      for z in range(math.floor(z0 / step) * step, math.ceil(z1 / step) * step, step):
        for tpl in [
          [(x, z), (x + step, z + step), (x + step, z)],
          [(x, z), (x, z + step), (x + step, z + step)],
        ]:
          patch = poly.intersection(Polygon(tpl))
          for region in sh.get_parts(patch):
            if region.geom_type != "Polygon" or region.area < 0.000004:
              continue
            for t in sh.get_parts(sh.constrained_delaunay_triangles(region)):
              xyz = list(sh.orient_polygons(t, exterior_cw=True).exterior.coords)[:3]
              ix = [vert(xx, zz, part, mat, offset) for xx, zz in xyz]
              if len(set(ix)) == 3:
                indices.extend(ix)

  for m, poly in by_mat.items():
    c = 1 if m == "04" else 2
    for part, p in [
      ("gap", poly.difference(paving)),
      ("covered", poly.intersection(paving)),
    ]:
      # Original road triangles have their own grade. Split the covered part
      # at each original triangle so both surfaces have exactly the same slope.
      if part == "covered":
        for t in original["paving"]:
          if p.intersects(t):
            surface(p.intersection(t), part, c + 4, step=8)
      else:
        surface(p, part, c)
  top_count = len(indices)
  for poly in sh.get_parts(footprint):
    if poly.geom_type != "Polygon":
      continue
    poly = sh.orient_polygons(poly, exterior_cw=True)
    for ring in [poly.exterior, *poly.interiors]:
      pts = list(sh.segmentize(ring, 2.5).coords)
      for (x, z), (u, v) in zip(pts, pts[1:]):
        part = "covered" if paving.covers(Point((x + u) / 2, (z + v) / 2)) else "gap"
        a, b = vert(x, z, part, 3, 0), vert(u, v, part, 3, 0)
        d, c = vert(x, z, part, 3, -0.50), vert(u, v, part, 3, -0.50)
        if a != b:
          indices.extend([a, c, b, a, d, c])
  first = len(indices)
  # Project every insert on the actual, already rounded triangle that supports
  # it. Different triangulations of an interpolated shoreline can differ by
  # centimetres even if they sample the same grid at their own vertices.
  paving_triangles = []
  top_planes = []
  for i in range(0, top_count, 3):
    row = np.asarray([verts[j] for j in indices[i : i + 3]])
    xy = row[:, :2] / 100 + [460, 550]
    triangle = Polygon(xy)
    if triangle.area < 0.000004:
      continue
    heights = row[:, 2:4] / 1000
    if row[0, 4] in [5, 6]:
      heights[:, 0] += 0.012
    top_planes.append(np.linalg.solve(np.c_[xy, np.ones(3)], heights))
    paving_triangles.append(triangle)
  tri_index = sh.STRtree(paving_triangles)
  retained = []
  for f in flats:
    inner = f.intersection(site)
    surface(inner, "inside", 4, 0.003)
    pieces = []
    for j in sorted(tri_index.query(f, predicate="intersects")):
      region = f.intersection(paving_triangles[j])
      for poly in sh.get_parts(region):
        if poly.geom_type != "Polygon" or poly.area < 0.000004:
          continue
        pieces.append(poly)
        for tri in sh.get_parts(sh.constrained_delaunay_triangles(poly)):
          ids = []
          for x, z in list(sh.orient_polygons(tri, exterior_cw=True).exterior.coords)[
            :3
          ]:
            cx, cz = round((x - 460) * 100), round((z - 550) * 100)
            day, native = np.array([460 + cx / 100, 550 + cz / 100, 1]) @ top_planes[j]
            v = (cx, cz, round((day + 0.003) * 1000), round((native + 0.003) * 1000), 4)
            if v not in unique:
              unique[v] = len(verts)
              verts.append(v)
            ids.append(unique[v])
          if len(set(ids)) == 3:
            indices.extend(ids)
    retained.append(inner.area + sh.union_all(pieces).area)
  assert len(retained) == 112 and min(retained) > 0.02
  a = np.array(verts, dtype=np.int32)

  def delta_bytes(array):
    # Store signed differences per coordinate channel, then variable-length
    # integers; the original millimetre heights and triangle indices survive.
    data = np.asarray(array, dtype=np.int32)
    previous = np.zeros_like(data)
    previous[1:] = data[:-1]
    out = bytearray()
    for change in (data - previous).ravel():
      value = (int(change) << 1) ^ (int(change) >> 31)
      while value >= 128:
        out.append((value & 127) | 128)
        value >>= 7
      out.append(value)
    return base64.b64encode(out).decode()

  print(
    "Surveyed sidewalk",
    round(footprint.area, 2),
    "m², original paving",
    round(footprint.intersection(paving).area, 2),
    "m², pillars",
    len(outside),
    "outside, retained inserts",
    len(retained),
    "minimum area",
    round(min(retained), 3),
    "triangles",
    len(indices) // 3,
    "vertices",
    len(verts),
  )
  return dict(
    vertices=len(verts),
    indices=len(indices),
    xz=delta_bytes(a[:, :2]),
    y=delta_bytes(a[:, 2:4]),
    material=base64.b64encode(np.asarray(a[:, 4], dtype="u1").tobytes()).decode(),
    index=delta_bytes(indices),
    endSurface=top_count,
    firstInsert=first,
    features=[r["properties"]["gis_id"] for r, p in walks],
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  out = DATA / "stelenfeldV385/rim.json"
  content = json.dumps(build(), separators=(",", ":")) + "\n"
  if args.check:
    if out.read_text() != content:
      raise SystemExit("Stale Stelenfeld perimeter")
  else:
    out.write_text(content)
