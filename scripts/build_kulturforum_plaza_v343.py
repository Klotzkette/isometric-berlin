"""Restore the mapped Philharmonie-West plaza omitted by linear road buffers.

The original OSM relation is retained with all rings. This is an exact new-only
paving owner; preceding smooth surfaces, structures and planted holes stay theirs.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, box, mapping
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
GROUND = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
PRISMS = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"


def pieces(g):
  if isinstance(g, Polygon):
    return [] if g.is_empty else [g]
  return [p for child in getattr(g, "geoms", []) for p in pieces(child)]


def build():
  original = pyogrio.read_dataframe(
    GEO / "osm.gpkg", layer="roads", where="id='9976187' AND element='relation'"
  ).iloc[0]
  owner = affine_transform(original.geometry, [1, 0, 0, -1, -389500, 5820000])
  envelope = owner.envelope.buffer(2)
  ground = json.loads(GROUND.read_text())
  cell, grid, h = ground["cell_m"], ground["grid"], ground["ground_height"]
  heights = np.asarray(h["y_dm"]).reshape(h["rows"], h["cols"]) / 10

  def sample(p):
    fx = (p[:, 0] / cell - grid["min_x_idx"]) / h["stride_cells"] - 0.5
    fz = (p[:, 1] / cell - grid["min_z_idx"]) / h["stride_cells"] - 0.5
    ix, iz = np.floor(fx).astype(int), np.floor(fz).astype(int)
    tx, tz = fx - ix, fz - iz
    x0, x1 = np.clip(ix, 0, h["cols"] - 1), np.clip(ix + 1, 0, h["cols"] - 1)
    z0, z1 = np.clip(iz, 0, h["rows"] - 1), np.clip(iz + 1, 0, h["rows"] - 1)
    return (heights[z0, x0] * (1 - tx) + heights[z0, x1] * tx) * (1 - tz) + (
      heights[z1, x0] * (1 - tx) + heights[z1, x1] * tx
    ) * tz

  # Preserve every rendered predecessor, including broad and narrow road kinds.
  old, old_triangles, old_planes, old_owners = [], [], [], []
  rows = json.loads((DATA / "districtStreets.json").read_text())["surfaces"]
  rows = [{**r, "owner": "district:" + r["kind"]} for r in rows]
  for line in (DATA / "restoredRoadSurfaces.ndjson.txt").open():
    r = json.loads(line)
    if r.get("kind") in ("paving", "asphalt"):
      rows.append({**r, "owner": r["id"]})
  for r in rows:
    if r["kind"] not in ("paving", "asphalt", "sidewalk", "gravel"):
      continue
    p = (
      np.frombuffer(base64.b64decode(r["xz"]), "<f4").reshape(-1, 2).astype(float)
      if "xz" in r
      else np.frombuffer(base64.b64decode(r["positions_cm_b64"]), "<i4").reshape(-1, 2)
      / 100
    )
    if not box(*np.r_[p.min(axis=0), p.max(axis=0)]).intersects(envelope):
      continue
    ii = np.frombuffer(
      base64.b64decode(r.get("indices", r.get("indices_b64"))), "<u4"
    ).reshape(-1, 3)
    lift = (
      0.1
      if r["kind"] == "paving"
      else (
        0.14
        if "xz" in r
        else {"asphalt": 0.18, "sidewalk": 0.32, "gravel": 0.3}[r["kind"]]
      )
    )
    ys = (sample(p) + lift).astype("<f4").astype(float)
    for i, ids in enumerate(ii):
      tri = p[ids].astype("<f4").astype(float)
      poly = Polygon(tri)
      if poly.area < 1e-8 or not poly.intersects(envelope):
        continue
      old.append(poly)
      if r["kind"] == "paving":
        old_triangles.append(poly)
        old_planes.append(np.linalg.solve(np.column_stack((tri, np.ones(3))), ys[ids]))
      old_owners.append([r["owner"], i])
  old_surface = shapely.union_all(old)
  buildings = []
  for row in json.loads(PRISMS.read_text())["buildings"]:
    poly = Polygon(
      np.asarray(row["ring"]) / 10, [np.asarray(a) / 10 for a in row.get("holes", [])]
    )
    if poly.intersects(envelope):
      buildings.append(shapely.make_valid(poly))
  parks = pyogrio.read_dataframe(
    GEO / "osm.gpkg", layer="parks", bbox=(389230, 5818900, 389360, 5819100)
  )
  planting = []
  for g in parks.geometry:
    p = affine_transform(g, [1, 0, 0, -1, -389500, 5820000])
    if p.intersects(owner):
      planting.append(p)
  # Memorial contexts are complete retained owner extents, never pavement infill.
  memorial = shapely.union_all(
    [box(-198.4, 897.2, -132.4, 948.2), box(-211, 918, -190, 946)]
  ).buffer(0.5)
  tree_sources = []
  tree_clearances = []
  trees = pyogrio.read_dataframe(
    GEO / "osm.gpkg", layer="vegetation", bbox=(389230, 5818900, 389360, 5819100)
  )
  for _, row in trees.iterrows():
    point = affine_transform(row.geometry, [1, 0, 0, -1, -389500, 5820000])
    if point.geom_type == "Point" and owner.contains(point):
      tree_sources.append({"osmNode": str(row["id"]), "position": [point.x, point.y]})
      # Conservative display clearance around independently mapped tree trunks.
      # These are explicitly not surveyed pit outlines; earlier land stays intact.
      tree_clearances.append(point.buffer(1.0, quad_segs=3))
  excluded = shapely.union_all(
    [old_surface, *buildings, *planting, *tree_clearances, memorial]
  )
  area = shapely.make_valid(owner.difference(excluded))
  raw = []
  # Small source-clipped faces follow the existing terrain rather than retaining
  # flat 4 m raster-run steps. The grid is tessellation, not a visible boundary.
  x0, z0, x1, z1 = area.bounds
  for x in range(math.floor(x0 / 4) * 4, math.ceil(x1 / 4) * 4, 4):
    for z in range(math.floor(z0 / 4) * 4, math.ceil(z1 / 4) * 4, 4):
      for poly in pieces(area.intersection(box(x, z, x + 4, z + 4))):
        for tri in shapely.constrained_delaunay_triangles(poly).geoms:
          if tri.area > 1e-8:
            raw.append(list(tri.exterior.coords)[:3])
  triangles = np.asarray(raw, dtype="<f4")
  footprint = shapely.union_all(shapely.polygons(triangles.astype(float)))
  unique, indices = np.unique(triangles.reshape(-1, 2), axis=0, return_inverse=True)
  y = sample(unique) + 0.1
  tree = STRtree(old_triangles)
  seam_vertices = 0
  for i, p in enumerate(unique):
    point = shapely.Point(p)
    ids = tree.query(point.buffer(0.0002))
    hits = [int(j) for j in ids if old_triangles[j].distance(point) < 0.0002]
    if hits:
      j = min(hits, key=lambda j: old_triangles[j].distance(point))
      y[i] = np.dot([*p, 1], old_planes[j])
      seam_vertices += 1
  positions = np.column_stack((unique[:, 0], y, unique[:, 1])).astype("<f4")
  sources = {
    str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
    for p in [
      GROUND,
      PRISMS,
      DATA / "districtStreets.json",
      DATA / "restoredRoadSurfaces.ndjson.txt",
    ]
  }
  sources["retained OSM relation 9976187"] = hashlib.sha256(
    shapely.to_wkb(owner)
  ).hexdigest()
  sources["retained mapped tree positions"] = hashlib.sha256(
    json.dumps(tree_sources, sort_keys=True).encode()
  ).hexdigest()
  sha = hashlib.sha256(json.dumps(sources, sort_keys=True).encode()).hexdigest()
  height_guard = 2166136261
  for value in h["y_dm"]:
    height_guard = ((height_guard ^ int(value)) * 16777619) & 0xFFFFFFFF
  data = dict(
    schemaVersion=1,
    sourceSha256=sha,
    osmRelation="9976187",
    footprint=mapping(footprint),
    groundGrid=grid,
    groundCellM=cell,
    heightGuard=height_guard,
    heightRows=h["rows"],
    heightCols=h["cols"],
    heightStride=h["stride_cells"],
    positions=base64.b64encode(positions.tobytes()).decode(),
    indices=base64.b64encode(indices.astype("<u4").tobytes()).decode(),
    counts=dict(vertices=len(unique), triangles=len(raw)),
    areaM2=round(footprint.area, 6),
    jointM=[0.75, 0.35, 0.014],
    jointAngleDeg=18,
    origin=[-220, 980],
  )
  payload = (json.dumps(data, separators=(",", ":")) + "\n").encode()
  (DATA / "kulturforumPlazaV343.json").write_bytes(payload)
  evidence = dict(
    sourceSha256=sha,
    inputs=sources,
    originalOwner=mapping(owner),
    originalAreaM2=owner.area,
    originalHoles=len(owner.interiors),
    footprint=mapping(footprint),
    excluded=mapping(excluded.intersection(owner)),
    oldSmoothSurfaceOwners=old_owners,
    treeClearances=tree_sources,
    treeClearancePolicy="Retain earlier land in conservative 1m-radius twelve-sided margins around mapped trunks; dimensions are an explicit protective display estimate, not surveyed tree-pit outlines.",
    newAreaM2=footprint.area,
    planeJoinVertices=seam_vertices,
    payloadBytes=len(payload),
    policy="Complete retained OSM paving relation 9976187, minus all previous smooth roads, buildings, mapped planting and retained T4/Serra contexts. Exact original raster-land outside complement supplied through the RoadGroundV343 transaction.",
    material="Restrained Kies-Braun interpreted as warm grey-beige, supplier75x35cm slab dimensions. Procedural anti-aliased joint pattern, no texture. Joint phase/bond/14mm width and color are visual estimates.",
    references=[
      "https://www.godelmann.de/de/referenzen/kulturforum-am-scharounplatz",
      "https://gruen-berlin.de/pressemitteilung/freianlagen-des-kulturforums-eroeffnet",
      "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
    ],
    sourceDate="2026-11-14",
  )
  (GEO / "kulturforum-plaza-v343-evidence.json.gz").write_bytes(
    gzip.compress(
      (json.dumps(evidence, separators=(",", ":")) + "\n").encode(), mtime=0
    )
  )
  print(
    json.dumps({k: data[k] for k in ("sourceSha256", "counts", "areaM2")}),
    "bytes",
    len(payload),
    "seam vertices",
    seam_vertices,
    "outside area",
    footprint.difference(owner).area,
  )


if __name__ == "__main__":
  build()
