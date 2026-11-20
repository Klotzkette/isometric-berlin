"""Reconnect the mapped lower street or water beneath a lifted rail bed.

Only the old rail pigment/height is eligible. Keep the rest of each source
triangle, including the approaches beyond both edges, at the original level.
"""

import base64
import gzip
import json
from pathlib import Path

import numpy as np
from shapely import STRtree, constrained_delaunay_triangles, get_parts
from shapely.affinity import translate
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
PACK = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
RAIL = (41, 32, 24)


def polygons(shape):
  if shape.geom_type == "Polygon":
    return [shape] if shape.area > 1e-6 else []
  return [p for part in getattr(shape, "geoms", []) for p in polygons(part)]


def coords(geometry):
  # All vertices here are local XZ metres. Preserve the source precision and
  # shared triangulation edges to a tenth of a millimetre.
  return [
    round(float(n), 4)
    for poly in polygons(geometry)
    for tri in get_parts(constrained_delaunay_triangles(poly))
    for p in list(tri.exterior.coords)[:3]
    for n in p
  ]


def array(mesh, field, dtype):
  return np.frombuffer(base64.b64decode(mesh[field]), dtype=dtype).reshape(-1, 3)


def patch(packet, spans, competing_tracks):
  mesh = packet["meshes"][0]
  if mesh["kind"] != "city" or mesh.get("colorType", "u8") != "u8":
    return []
  origin = np.asarray(packet["origin"])[[0, 2]]
  decks = unary_union(
    [
      Polygon(np.asarray(s["edges"][0] + s["edges"][1][::-1]) - origin).buffer(0)
      for s in spans
      if s.get("deck") and s.get("edges")
    ]
  )
  if decks.is_empty:
    return []
  # The underlying street may itself carry tram or railway tracks. Keep those
  # source ribbons intact even if they share a street polygon with the bridge.
  world_decks = translate(decks, xoff=origin[0], yoff=origin[1])
  selected = competing_tracks.query(world_decks, predicate="dwithin", distance=3)
  if selected.size:
    keep = unary_union([competing_tracks.geometries[i].buffer(3) for i in selected])
    decks = decks.difference(translate(keep, xoff=-origin[0], yoff=-origin[1]))
    if decks.is_empty:
      return []
  v = array(mesh, "positions", "<u2") * 0.01
  faces = array(mesh, "indices", "<u4")
  rgb = array(mesh, "colors", "u1")
  col = rgb[faces[:, 0]]
  y = v[faces, 1] + packet["origin"][1]
  xz = v[:, [0, 2]]

  def surface(height):
    return np.all(np.abs(y - height) < 0.001, axis=1)

  def region(ids):
    return unary_union(
      [
        poly
        for i in ids
        if (poly := Polygon(xz[faces[i]])).area > 1e-6 and poly.distance(decks) < 1
      ]
    )

  masks = {}
  witnesses = {}
  for key, height in (("street", 3.09), ("path", 3.12), ("water", -1.15)):
    ids = np.flatnonzero(surface(height))
    witnesses[key] = region(ids)
    if not len(ids):
      continue
    src = ids[0]
    if not np.all(rgb[faces[ids]] == col[src]):
      continue
    masks[key] = (height, int(faces[src][0]))
  rail = np.flatnonzero(surface(3.15) & np.all(col == RAIL, axis=1))
  rail = [
    i
    for i in rail
    if np.all(rgb[faces[i]] == RAIL) and Polygon(xz[faces[i]]).intersects(decks)
  ]
  if not rail:
    return []
  footprint = unary_union([Polygon(xz[faces[i]]) for i in rail]).intersection(decks)
  original_roads = [
    Polygon(v["ring"], v["holes"]).buffer(0) for v in packet["nav"].get("roads", [])
  ]
  # Navigation retains the original road/path polygon across the rail paint.
  # Require matching visible pavement on the rim, skipping ambiguous junctions.
  cuts = []
  for area in polygons(footprint.intersection(unary_union(original_roads))):
    rim = area.boundary.buffer(0.035)
    adjacent = [
      k
      for k in ("street", "path")
      if k in masks and rim.intersection(witnesses[k]).area > 0.045
    ]
    if len(adjacent) == 1:
      cuts.append((area, adjacent[0]))
  cuts.extend(
    (p, "water")
    for p in polygons(
      footprint.intersection(witnesses["water"]).difference(
        unary_union([p for p, k in cuts])
      )
    )
  )
  if not cuts:
    return []
  search = STRtree([g for g, k in cuts])
  result = []
  for face_id in rail:
    ids = faces[face_id]
    triangle = Polygon(xz[ids])
    sections = []
    for j in search.query(triangle):
      area, kind = cuts[j]
      part = triangle.intersection(area)
      if part.area > 0.0005:
        sections.append((part, kind))
    if not sections:
      continue
    outside = triangle.difference(unary_union([p for p, k in sections]))
    assert abs(triangle.area - outside.area - sum(p.area for p, k in sections)) < 0.001
    parts = [[3.15, int(ids[0]), coords(outside)]]
    parts += [[*masks[k], coords(p)] for p, k in sections if k != "water"]
    result.append(
      [int(face_id) * 3, *map(int, ids), [part for part in parts if part[-1]]]
    )
  return result


def main():
  manifest = json.loads((PACK / "manifest.json").read_bytes())
  spans = json.loads((DATA / "steelRailSpansV369.json").read_bytes())["tiles"]
  exclusion_path = (
    ROOT / "geo_data/regierungsviertel/ground-rail-exclusions-v369.json.gz"
  )
  records = json.loads(gzip.decompress(exclusion_path.read_bytes()))["records"]
  competing_tracks = STRtree([LineString(row["points"]) for row in records])
  result = {}
  for tile in manifest["chunks"]:
    key = tile["id"]
    if key not in spans:
      continue
    for family in ("drawn", "minecraft"):
      rows = patch(
        json.loads(gzip.decompress((PACK / tile[family]["url"]).read_bytes())),
        spans[key][family],
        competing_tracks,
      )
      if rows:
        result.setdefault(key, {})[family] = rows
  (DATA / "railUnderpassFloorsV369.json").write_text(
    json.dumps(result, separators=(",", ":"), allow_nan=False) + "\n"
  )
  print(
    len(result),
    "tiles,",
    sum(len(rows) for family in result.values() for rows in family.values()),
    "registered source triangles",
  )


if __name__ == "__main__":
  main()
