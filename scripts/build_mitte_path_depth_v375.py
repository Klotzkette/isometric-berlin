"""Find original grass obstructing Mitte paths and preserve the ground outside their measured overlap.

Run the matching Bun capture first. The inputs are real post-triangulation
Render/Worker coordinates including the existing openings and Tiergarten cuts.
"""

import argparse
import base64
import gzip
import hashlib
import json
import sqlite3
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
MESH = ROOT / "src/app/public/mesh/regierungsviertel"
FAMILIES = ("sand", "earth", "paved")
RESERVED = (box(120, 107, 390, 297), box(164, 297, 180, 304), box(292, 220, 560, 379))


def read(path):
  return json.loads(path.read_bytes())


def source_polygon(row):
  if len(row["ring"]) < 3:
    return Polygon()
  return shapely.make_valid(
    Polygon(
      np.array(row["ring"]) / 10,
      [np.array(hole) / 10 for hole in row.get("holes", []) if len(hole) > 2],
    )
  )


def to_world(projected):
  return affine_transform(projected, [1, 0, 0, -1, -389500, 5820000])


def districts():
  return {
    record["properties"]["nam"]: to_world(shape(record["geometry"]))
    for record in read(GEO / "house-districts-v233.geojson")["features"]
    if record["properties"]["sch"][6:8] == "01"
  }


def study_scope():
  core = read(DATA / "surroundingCityScope.json")["core"]
  return (
    shapely.union_all(list(districts().values()))
    .intersection(Polygon(core["ring"], core["holes"]))
    .difference(shapely.union_all(RESERVED))
  )


def restricted(kind):
  """Existing authorities retain their entire projected surfaces, including holes."""
  src = read(MESH / "surface-polygons.json")
  masks = [
    source_polygon(r)
    for r in src["water"] + src["roads"]
    if r.get("kind") != ("paving" if kind == "paved" else kind)
  ]
  masks.extend(source_polygon(r) for r in src["parks"] if r["kind"] == "garden")
  masks.extend(source_polygon(r) for r in read(MESH / "lod2-prisms.json")["buildings"])
  masks.extend(
    Polygon(r["stair"]["ring"])
    for r in read(DATA / "ubahnAccessV326.json")["entries"]
    if r["stair"]
  )
  masks.extend(RESERVED)
  for filename in ["districtStreets", "schlossEastStreets", "mitteRoadsV343"]:
    group = read(DATA / (filename + ".json"))
    for row in group["surfaces"] + group.get("supplement", {}).get("surfaces", []):
      xz = (
        np.frombuffer(base64.b64decode(row["positions_cm_b64"]), "<i4").reshape(-1, 2)
        / 100
      )
      indices = np.frombuffer(base64.b64decode(row["indices_b64"]), "<u4").reshape(
        -1, 3
      )
      masks.extend(shapely.polygons(xz[indices]))
  for filename in ["mitteSquareStreetsV367", "innerCitySquareStreetsV368"]:
    for row in read(DATA / (filename + ".json"))["groups"]:
      raw = base64.b64decode(row["xz"])
      xz = np.frombuffer(raw, "<i2" if "origin" in row else "<i4").reshape(-1, 2)
      xz = (xz + np.array(row.get("origin", [0, 0]))) / 100
      indices = np.frombuffer(base64.b64decode(row["index"]), "<u2").reshape(-1, 3)
      masks.extend(shapely.polygons(xz[indices]))
  masks.append(shape(read(DATA / "kulturforumPlazaV343.json")["footprint"]))
  # Split long, complex road unions into local views for spatial queries.
  # The tile borders introduce no gaps and do not change eligibility.
  local = []
  for geom in masks:
    if geom.is_empty:
      continue
    x0, z0, x1, z1 = geom.bounds
    if max(x1 - x0, z1 - z0) <= 180 or shapely.get_num_coordinates(geom) < 48:
      local.append(geom)
      continue
    for x in range(128 * int(np.floor(x0 / 128)), int(np.ceil(x1)), 128):
      for z in range(128 * int(np.floor(z0 / 128)), int(np.ceil(z1)), 128):
        q = shapely.clip_by_rect(geom, x, z, x + 128, z + 128)
        if not q.is_empty:
          local.append(q if q.is_valid else shapely.make_valid(q))
  return shapely.STRtree(local)


def read_conflicts(capture_dir, kind):
  rows = json.loads(
    gzip.decompress((capture_dir / (kind + "-conflicts.json.gz")).read_bytes())
  )
  return [
    (face, owner, source, depth, bytes.fromhex(wkb))
    for face, owner, source, depth, wkb in rows
  ]


def read_source(capture_dir, key):
  vertices = (
    np.fromfile(capture_dir / (key + ".xyz"), "<f4").reshape(-1, 3).astype(float)
  )
  triangles = np.fromfile(capture_dir / (key + ".tri"), "<u4").reshape(-1, 3)
  return vertices, triangles


def planes(xyz):
  normals = np.cross(xyz[:, 1] - xyz[:, 0], xyz[:, 2] - xyz[:, 0])
  out = np.empty_like(normals)
  out[:, 0] = -normals[:, 0] / normals[:, 1]
  out[:, 1] = -normals[:, 2] / normals[:, 1]
  out[:, 2] = xyz[:, 0, 1] - out[:, 0] * xyz[:, 0, 0] - out[:, 1] * xyz[:, 0, 2]
  return out


def nondegenerate(xyz):
  return np.abs(np.cross(xyz[:, 1] - xyz[:, 0], xyz[:, 2] - xyz[:, 0])[:, 1]) > 1e-6


def height(plane, xz):
  return np.einsum("ik,ijk->ij", plane[:, :2], xz) + plane[:, 2, None]


def half_plane(polygon, diff):
  """Visible portion of a convex path/host intersection, where the host lies higher."""
  points = shapely.get_coordinates(polygon)
  depths = points @ diff[:2] + diff[2]
  if depths.min() >= 0:
    return polygon
  cut = []
  for j in range(len(points) - 1):
    if depths[j] >= 0:
      cut.append(points[j])
    if (depths[j] > 0) != (depths[j + 1] > 0):
      cut.append(
        points[j]
        + (points[j + 1] - points[j]) * depths[j] / (depths[j] - depths[j + 1])
      )
  return Polygon(cut) if len(cut) >= 3 else Polygon()


def pedestrian_scope():
  """Public park and pedestrian-area context for the separate restored paving family."""

  def geometry(gpkg_blob):
    flags = gpkg_blob[3]
    coordinates = (0, 4, 6, 6, 8)[(flags >> 1) & 7]
    return shapely.make_valid(
      to_world(shapely.from_wkb(gpkg_blob[8 + 8 * coordinates :]))
    )

  with sqlite3.connect(f"file:{GEO / 'osm.gpkg'}?mode=ro", uri=True) as conn:
    rows = conn.execute("select geom from parks where leisure='park'").fetchall()
    rows += conn.execute("""select geom from roads where highway='pedestrian'
          and (tunnel is null or tunnel='no') and (bridge is null or bridge='no')
          and (layer is null or layer='0')""").fetchall()
    islands = conn.execute(
      "select geom from roads where highway='traffic_island' or [crossing:island]='yes'"
    ).fetchall()
  greens = [
    g
    for (raw,) in rows
    if (g := geometry(raw)).geom_type in ("Polygon", "MultiPolygon")
  ]
  masks = [
    g
    for (raw,) in islands
    if (g := geometry(raw)).geom_type in ("Polygon", "MultiPolygon")
  ]
  src = read(MESH / "surface-polygons.json")
  masks.extend(
    source_polygon(r) for r in src["roads"] if r["kind"] in ("asphalt", "wood", "metal")
  )
  masks.extend(source_polygon(r) for r in src["parks"] if r["kind"] == "garden")
  return (
    study_scope()
    .intersection(shapely.union_all(greens))
    .difference(shapely.union_all(masks))
  )


def collect_conflicts(capture_dir, kind):
  scope = pedestrian_scope() if kind == "paved" else study_scope()
  shapely.prepare(scope)
  vertices, tri = read_source(capture_dir, kind + "-top")
  xyz = vertices[tri]
  valid = np.flatnonzero(nondegenerate(xyz))
  rings = xyz[valid][:, :, [0, 2]]
  polys = shapely.polygons(rings)
  inside = shapely.covers(scope, polys)
  valid = valid[inside]
  rings = rings[inside]
  polys = polys[inside]
  road_plane = planes(xyz[valid])
  tree = shapely.STRtree(polys)
  result = []

  def compare(owner, surfaces, corners, ground_plane, face_ids):
    host, way = tree.query(surfaces, predicate="intersects")
    if not len(host):
      return
    diff = ground_plane[host] - road_plane[way]
    keep = (height(diff, corners[host]).max(axis=1) > 0.0005) & (
      height(diff, rings[way]).max(axis=1) > 0.0005
    )
    host, way, diff = host[keep], way[keep], diff[keep]
    if not len(host):
      return
    overlap = shapely.intersection(surfaces[host], polys[way])
    positive = shapely.area(overlap) > 1e-6
    for h, w, d, polygon in zip(
      host[positive], way[positive], diff[positive], overlap[positive], strict=True
    ):
      max_depth = float((shapely.get_coordinates(polygon) @ d[:2] + d[2]).max())
      if max_depth <= 0.001:
        continue
      cut = half_plane(polygon, d)
      if cut.area > 1e-5:
        result.append(
          [
            int(valid[w]),
            owner,
            int(face_ids[h]),
            max_depth,
            shapely.to_wkb(cut, hex=True),
          ]
        )

  slabs = np.fromfile(capture_dir / "slabs.f32", "<f4").reshape(-1, 5)
  for i in range(0, len(slabs), 5000):
    s = slabs[i : i + 5000]
    corners = np.stack((s[:, [0, 1]], s[:, [2, 1]], s[:, [2, 3]], s[:, [0, 3]]), axis=1)
    flat = np.zeros((len(s), 3))
    flat[:, 2] = s[:, 4]
    compare("slab", shapely.box(*s[:, :4].T), corners, flat, np.arange(i, i + len(s)))
  for row in read(capture_dir / "records.json"):
    key = row["key"]
    if not key.startswith("park") or not key.endswith("-top"):
      continue
    vs, faces = read_source(capture_dir, key)
    for i in range(0, len(faces), 9000):
      batch = vs[faces[i : i + 9000]]
      idx = np.flatnonzero(nondegenerate(batch))
      batch = batch[idx]
      corners = batch[:, :, [0, 2]]
      compare(key, shapely.polygons(corners), corners, planes(batch), i + idx)
  result.sort(key=lambda item: (item[0], item[1], item[2]))
  path = capture_dir / (kind + "-conflicts.json.gz")
  path.write_bytes(
    gzip.compress(json.dumps(result, separators=(",", ":")).encode(), mtime=0)
  )
  return len(result)


def pieces(geometry):
  if geometry.is_empty or geometry.area < 1e-8:
    return
  if geometry.geom_type == "Polygon":
    yield geometry
  elif hasattr(geometry, "geoms"):
    for g in geometry.geoms:
      yield from pieces(g)


def triangles(geometry):
  for polygon in pieces(geometry):
    for t in shapely.constrained_delaunay_triangles(polygon).geoms:
      coords = list(t.exterior.coords)[:3]
      a, b, c = coords
      if (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0:
        coords.reverse()
      yield coords


def packed(values, dtype):
  return base64.b64encode(
    gzip.compress(np.asarray(values, dtype=dtype).tobytes(), mtime=0)
  ).decode()


def clipped_mask(geom, protected):
  ids = protected.query(geom, predicate="intersects")
  if len(ids):
    return geom.difference(shapely.union_all(protected.geometries.take(ids)))
  return geom


def slab_replacement(capture_dir):
  """Transfer only intersecting grass, retaining its original sides and material.
  While the real way streams, the proven opening receives its original way face
  at the source grade. The main thread retires those temporary faces on arrival.
  """
  raster = np.fromfile(capture_dir / "slabs.f32", "<f4").reshape(-1, 5)
  bounds = read(MESH / "ground-context.json")["grid"]
  accepted = defaultdict(list)
  union_by_family = {}
  report = {}
  probes = []
  provisional = defaultdict(list)
  blocks = read(capture_dir / "paved-blocks.json")
  block_starts = np.array([b["faces"] for b in blocks])
  ds = districts()
  for kind in FAMILIES:
    protect = restricted(kind)
    vertices, indices = read_source(capture_dir, kind + "-top")
    geometry = vertices[indices]
    rows = [r for r in read_conflicts(capture_dir, kind) if r[1] == "slab"]
    removed = []
    eligible = []
    areas = defaultdict(list)
    for path, _, host, depth, wkb in rows:
      # At differences over one metre the conventional ground stack can
      # also represent distinct levels; preserve those uncertain places.
      original = shapely.from_wkb(wkb)
      eligible.append(original)
      if depth > 1.0:
        continue
      g = clipped_mask(original, protect)
      if g.area < 0.0004:
        continue
      # Identical fragments on co-located source triangles need one temporary carrier.
      accepted[host].append(g)
      removed.append(g)
      top = raster[host, 4]
      profile = planes(geometry[path : path + 1])[0]
      key = (
        blocks[np.searchsorted(block_starts, path, side="right") - 1]["id"]
        if kind == "paved"
        else "surface-" + kind
      )
      for coords in triangles(g):
        provisional[key].extend([x, profile @ [x, z, 1], z] for x, z in coords)
      point = g.representative_point()
      district = next(name for name, poly in ds.items() if poly.covers(point))
      areas[district].append(g)
      if g.area > 1:
        probes.append(
          {
            "kind": kind,
            "batch": key,
            "district": district,
            "face": path,
            "slab": host,
            "area": round(g.area, 4),
            "xz": [round(point.x, 4), round(point.y, 4)],
            "sourceY": round(float(profile @ [point.x, point.y, 1]), 5),
            "blockerY": float(top),
          }
        )
    combined = shapely.union_all(removed)
    union_by_family[kind] = combined
    (capture_dir / (kind + "-slab-cuts.wkb")).write_bytes(shapely.to_wkb(combined))
    report[kind] = {
      "testedRasterOcclusionM2": round(shapely.union_all(eligible).area, 3),
      "removedRasterM2": round(combined.area, 3),
      "partAreasM2": {k: round(shapely.union_all(v).area, 3) for k, v in areas.items()},
    }
    print(kind, report[kind], flush=True)
  cells = []
  spans = []
  tops = []
  vertices = []
  edge_lines = []
  hosts = []
  for host, gs in sorted(accepted.items()):
    x0, z0, x1, z1, top = map(float, raster[host])
    clipped = shapely.union_all(gs)
    affected = []
    for i, x in enumerate(np.arange(x0, x1, 4)):
      if clipped.intersection(box(x, z0, x + 4, z1)).area > 1e-8:
        affected.append(i)
    if not affected:
      continue
    hosts.append(host)
    first = last = affected[0]
    for i in [*affected[1:], affected[-1] + 2]:
      if i == last + 1:
        last = i
        continue
      start = x0 + 4 * first
      end = x0 + 4 * (last + 1)
      complement = box(start, z0, end, z1).difference(clipped)
      ts, es = len(vertices), len(edge_lines)
      for t in triangles(complement):
        vertices.extend(t)
      for polygon in pieces(shapely.orient_polygons(complement)):
        for ring in [polygon.exterior, *polygon.interiors]:
          coords = list(ring.coords)
          for a, b in zip(coords, coords[1:]):
            edge_lines.extend([a, b])
      cells.append(
        [
          round(start / 4) - bounds["min_x_idx"],
          round(z0 / 4) - bounds["min_z_idx"],
          ts,
          len(vertices) - ts,
          es,
          len(edge_lines) - es,
        ]
      )
      spans.append(last - first + 1)
      tops.append(top)
      first = last = i
  # One indexed Float32 mesh per fallback batch. Share exact source coordinates
  # to prevent the small startup previews from retaining triangle soups.
  previews = {}
  for key, xyz in sorted(provisional.items()):
    points, ind = np.unique(np.asarray(xyz, dtype="<f4"), axis=0, return_inverse=True)
    assert len(points) < 65536
    previews[key] = {"xyz": packed(points, "<f4"), "indices": packed(ind, "<u2")}
  result = {
    "surfaceSha256": hashlib.sha256(
      (MESH / "surface-polygons.json").read_bytes()
    ).hexdigest(),
    "groundSha256": hashlib.sha256(
      (MESH / "ground-context.json").read_bytes()
    ).hexdigest(),
    "grid": bounds,
    "cells": packed(cells, "<u4"),
    "spans": packed(spans, "<u4"),
    "tops": packed(tops, "<f4"),
    "triangles": packed(vertices, "<f4"),
    "edges": packed(edge_lines, "<f4"),
    "previews": previews,
    "count": int(sum(spans)),
    "hostRuns": len(hosts),
  }
  (DATA / "mittePathDepthV375.json").write_text(
    json.dumps(result, separators=(",", ":")) + "\n"
  )
  report["unionM2"] = round(shapely.union_all(list(union_by_family.values())).area, 3)
  (capture_dir / "slab-report.json").write_text(json.dumps(report, indent=2))
  (capture_dir / "slab-probes.json").write_text(
    json.dumps(sorted(probes, key=lambda r: -r["area"]))
  )
  print(
    "union",
    report["unionM2"],
    "cells",
    sum(spans),
    "runs",
    len(hosts),
    "batches",
    len(previews),
  )


def visible_areas(capture_dir, lawn_dir, output):
  """Subtract remaining green occlusions before counting distinct path area."""

  def polygonal(g):
    # The two captures can share a zero-width boundary. Extract just the
    # positive area on a sub-millimetre grid, retaining path holes.
    return shapely.set_precision(g, 0.0001).buffer(0)

  areas = []
  for kind in FAMILIES:
    cuts = {
      "slab": polygonal(
        shapely.from_wkb((capture_dir / (kind + "-slab-cuts.wkb")).read_bytes())
      ),
      "lawn": polygonal(
        shapely.from_wkb((lawn_dir / ("lawn-cuts-" + kind + ".wkb")).read_bytes())
      ),
    }
    original = defaultdict(list)
    for _, owner, _, _, wkb in read_conflicts(capture_dir, kind):
      original["slab" if owner == "slab" else "lawn"].append(shapely.from_wkb(wkb))
    residual = [
      polygonal(polygonal(shapely.union_all(original[owner])).difference(cut))
      for owner, cut in cuts.items()
    ]
    areas.append(
      polygonal(
        shapely.union_all(list(cuts.values())).difference(
          polygonal(shapely.union_all(residual))
        )
      )
    )
  combined = shapely.union_all(areas)
  output.write_bytes(shapely.to_wkb(combined))
  return {
    name: round(combined.intersection(g).area, 2) for name, g in districts().items()
  }


if __name__ == "__main__":
  cli = argparse.ArgumentParser(description=__doc__)
  cli.add_argument("--capture", required=True, type=Path)
  cli.add_argument(
    "--reuse-conflicts",
    action="store_true",
    help="Use the saved results from the same source capture",
  )
  cli.add_argument(
    "--lawn-cuts",
    type=Path,
    help="Folder from build_mitte_path_lawns_v375.py --proof-dir",
  )
  cli.add_argument(
    "--visible-wkb", type=Path, help="Save the combined measurably exposed footprints"
  )
  args = cli.parse_args()
  if bool(args.lawn_cuts) != bool(args.visible_wkb):
    cli.error("Supply --lawn-cuts and --visible-wkb together")
  if not args.reuse_conflicts:
    for kind in FAMILIES:
      collect_conflicts(args.capture, kind)
  slab_replacement(args.capture)
  if args.lawn_cuts:
    print(
      "Net areas by Ortsteil (m²)",
      visible_areas(args.capture, args.lawn_cuts, args.visible_wkb),
    )
