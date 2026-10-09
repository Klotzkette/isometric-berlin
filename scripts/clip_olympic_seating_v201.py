"""Step 10: exact Waldbühne seat-sheet substitution, never a broad ground cut.

Pure clip_seating(payload, masks) returns a new payload and a reversible receipt.
Drawn masks are complete source-owner polygons. Native masks are the union of occupied 1 m cells, intersected with the eleven
old OSM sheets' actual 2 m skin.
Original v187 geometry, other grounds, rods, boxes, height and colour survive.
"""

from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import json
import math
from pathlib import Path

from build_west_landmarks_v187 import world
from shapely import constrained_delaunay_triangles
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
SEAT_IDS = {"way/48613327", *(f"way/{i}" for i in range(48613560, 48613570))}
SEAT_COLOR = 0xB6A990


def encode(value: object) -> bytes:
  return (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


def digest(value: object) -> str:
  return hashlib.sha256(encode(value)).hexdigest()


def projected(triangle: list) -> Polygon:
  return Polygon([(p[0], p[2]) for p in triangle])


def clip_triangle(triangle: list, mask) -> list:
  """Subtract XZ coverage and interpolate only new vertices on the old plane."""
  source = projected(triangle)
  if source.is_empty or source.area == 0 or source.intersection(mask).area == 0:
    return [triangle]
  remainder = source.difference(mask)
  if remainder.is_empty:
    return []
  a, b, c = triangle
  determinant = (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0])
  original = {(p[0], p[2]): p for p in triangle}

  def lift(x: float, z: float) -> list:
    if (x, z) in original:
      return original[x, z]
    u = ((x - a[0]) * (c[2] - a[2]) - (z - a[2]) * (c[0] - a[0])) / determinant
    v = ((b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0])) / determinant
    return [x, a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]), z]

  result = []
  for piece in constrained_delaunay_triangles(remainder).geoms:
    points = list(piece.exterior.coords)[:3]
    if piece.area == 0:
      continue
    tri = [lift(x, z) for x, z in points]
    sign = (tri[1][0] - tri[0][0]) * (tri[2][2] - tri[0][2]) - (
      tri[1][2] - tri[0][2]
    ) * (tri[2][0] - tri[0][0])
    if sign * determinant < 0:
      tri[1], tri[2] = tri[2], tri[1]
    result.append(tri)
  return result


def clip_native_box(row: list, mask) -> list:
  """Orthogonal remainder rectangles; old Y, thickness and color are exact."""
  x, y, z, width, height, depth, color = row
  source = box(x - width / 2, z - depth / 2, x + width / 2, z + depth / 2)
  intersection = source.intersection(mask)
  if intersection.is_empty or intersection.area == 0:
    return [row]
  remainder = source.difference(mask)
  if remainder.is_empty:
    return []
  polygons = [remainder] if remainder.geom_type == "Polygon" else list(remainder.geoms)
  points = [
    p
    for poly in polygons
    for ring in [poly.exterior, *poly.interiors]
    for p in ring.coords
  ]
  xs, zs = sorted({p[0] for p in points}), sorted({p[1] for p in points})
  rectangles = []
  for lo_z, hi_z in zip(zs, zs[1:]):
    start = None
    for lo_x, hi_x in zip(xs, xs[1:]):
      inside = remainder.covers(Point((lo_x + hi_x) / 2, (lo_z + hi_z) / 2))
      if inside and start is None:
        start = lo_x
      if start is not None and (not inside or hi_x == xs[-1]):
        end = hi_x if inside else lo_x
        rectangles.append([start, lo_z, end, hi_z])
        start = None
  # Losslessly coalesce equal X intervals in consecutive Z rows.
  merged = []
  for lo_x, lo_z, hi_x, hi_z in rectangles:
    previous = next(
      (r for r in reversed(merged) if r[0] == lo_x and r[2] == hi_x and r[3] == lo_z),
      None,
    )
    if previous is not None:
      previous[3] = hi_z
    else:
      merged.append([lo_x, lo_z, hi_x, hi_z])
  return [
    [(a + c) / 2, y, (b + d) / 2, c - a, height, d - b, color] for a, b, c, d in merged
  ]


def source_selection(original: dict, osm: dict) -> tuple[dict, object]:
  """Recover source identity from the immutable, exact old sheet polygons."""
  polygons = {}
  for feature in osm["features"]:
    oid = feature["properties"]["id"]
    if oid in SEAT_IDS:
      assert feature["properties"]["tags"]["leisure"] == "bleachers"
      polygons[oid] = transform(lambda x, z: world(x, z), shape(feature["geometry"]))
  assert set(polygons) == SEAT_IDS
  selected = {}
  for group in original["groups"]:
    if not group["name"].startswith("Olympiapark"):
      continue
    for index, surface in enumerate(group["surfaces"]):
      if surface["color"] != SEAT_COLOR:
        continue
      coverage = unary_union([projected(t) for t in surface["triangles"]])
      matches = [
        oid
        for oid, polygon in polygons.items()
        if coverage.symmetric_difference(polygon).area < 1e-8
      ]
      assert len(matches) <= 1
      if matches:
        assert all(p[1] == 3.6 for t in surface["triangles"] for p in t)
        selected[group["name"], index] = matches[0]
  assert set(selected.values()) == SEAT_IDS and len(selected) == 11
  # The old native skin samples exactly these source triangles at 2 m cell
  # centers; preserve its small boundary overhangs rather than invent a smooth
  # native boundary. No other native colour/layer is eligible for substitution.
  cells = set()
  for polygon in polygons.values():
    w, n, e, s = polygon.bounds
    for ix in range(math.floor(w / 2), math.ceil(e / 2)):
      for iz in range(math.floor(n / 2), math.ceil(s / 2)):
        if polygon.covers(Point(ix * 2 + 1, iz * 2 + 1)):
          cells.add((ix * 2, iz * 2))
  return selected, unary_union([box(x, z, x + 2, z + 2) for x, z in sorted(cells)])


def clip_seating(
  payload: dict, masks: dict, *, original: dict | None = None, osm: dict | None = None
) -> tuple[dict, dict]:
  original_path = ROOT / "src/app/src/data/westLandmarksV187.json"
  osm_path = ROOT / "geo_data/regierungsviertel/west-landmarks-v187-osm.json"
  original = (
    original if original is not None else json.loads(original_path.read_bytes())
  )
  osm = osm if osm is not None else json.loads(osm_path.read_bytes())
  selected, native_source = source_selection(original, osm)
  source_path = ROOT / "geo_data/regierungsviertel/waldbuehne-v201-source.json.gz"
  source = json.loads(gzip.decompress(source_path.read_bytes()))
  seating = [owner for owner in source["owners"] if owner["id"] != "DEBE04YY500002GT"]
  owners = {owner["id"] for owner in seating}
  assert len(owners) == 21, "Only the 21 complete measured seating owners are eligible"
  drawn = shape(masks["seatingDrawn"])
  exact_source = unary_union(
    [Polygon(p["ring"], p["holes"]) for owner in seating for p in owner["parts"]]
  )
  assert drawn.is_valid and not drawn.is_empty
  assert drawn.symmetric_difference(exact_source).area < 1e-8
  raster = shape(masks["minecraft"])
  assert raster.is_valid
  for polygon in [raster] if raster.geom_type == "Polygon" else raster.geoms:
    for ring in [polygon.exterior, *polygon.interiors]:
      points = list(ring.coords)
      assert all(float(v).is_integer() for p in points for v in p)
      assert all(a[0] == b[0] or a[1] == b[1] for a, b in zip(points, points[1:]))
  # The supplied native mask also contains the stage's 1 m deck. Its complete
  # mapped footprint is >10 m from the old seating skin: even a corner-sampled
  # 1 m deck cell cannot touch a seat. This proves the intersection is seat-only.
  assert native_source.distance(shape(masks["stageDrawn"])) > math.sqrt(2)
  native = native_source.intersection(raster)
  result = copy.deepcopy(payload)
  receipt = {
    "schemaVersion": 1,
    "beforeSha256": digest(payload),
    "oldSourceSha256": digest(original),
    "osmSourceSha256": digest(osm),
    "maskSha256": digest(masks),
    "ownerIds": sorted(owners),
    "replacementSourceSha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
    "selectedOsmIds": sorted(SEAT_IDS),
    "surfaces": [],
    "native": [],
    "policy": "Only eleven exact old OSM seating sheets and their native skin overlap are superseded. All outside geometry, heights, colours, rods and other grounds remain; changes are reversible through exact original records.",
  }
  for group in result["groups"]:
    for index, surface in enumerate(group["surfaces"]):
      oid = selected.get((group["name"], index))
      if oid is None:
        continue
      before = surface["triangles"]
      after, changes = [], []
      for source_index, triangle in enumerate(before):
        pieces = clip_triangle(triangle, drawn)
        if pieces != [triangle]:
          changes.append(
            {
              "index": source_index,
              "start": len(after),
              "count": len(pieces),
              "before": triangle,
            }
          )
        after.extend(pieces)
      surface["triangles"] = after
      receipt["surfaces"].append(
        {
          "group": group["name"],
          "surfaceIndex": index,
          "osmId": oid,
          "beforeCount": len(before),
          "afterCount": len(after),
          "changes": changes,
        }
      )
    if not any(name == group["name"] for name, _ in selected):
      continue
    before = group["native"]
    after, changes = [], []
    for source_index, row in enumerate(before):
      pieces = (
        clip_native_box(row, native)
        if row[6] == SEAT_COLOR and row[4] == 0.4
        else [row]
      )
      if pieces != [row]:
        changes.append(
          {
            "index": source_index,
            "start": len(after),
            "count": len(pieces),
            "before": row,
          }
        )
      after.extend(pieces)
    group["native"] = after
    receipt["native"].append(
      {
        "group": group["name"],
        "beforeCount": len(before),
        "afterCount": len(after),
        "changes": changes,
      }
    )
  # Builders must pass freshly generated grounds, not overwrite the reversible
  # receipt with an empty second cut of an already substituted model.
  assert any(r["changes"] for r in receipt["surfaces"])
  assert any(r["changes"] for r in receipt["native"])
  receipt["afterSha256"] = digest(result)
  return result, receipt


def restore_clipped_payload(payload: dict, receipt: dict) -> dict:
  """Restore the preclip draped payload, so earlier terrain audits stay strict."""
  assert digest(payload) == receipt["afterSha256"]
  result = copy.deepcopy(payload)
  groups = {g["name"]: g for g in result["groups"]}
  for collection in ("surfaces", "native"):
    for report in receipt[collection]:
      group = groups[report["group"]]
      target = (
        group["surfaces"][report["surfaceIndex"]] if collection == "surfaces" else group
      )
      key = "triangles" if collection == "surfaces" else "native"
      current, original, offset = target[key], [], 0
      assert len(current) == report["afterCount"]
      for change in report["changes"]:
        original.extend(current[offset : change["start"]])
        assert len(original) == change["index"]
        original.append(change["before"])
        offset = change["start"] + change["count"]
      original.extend(current[offset:])
      assert len(original) == report["beforeCount"]
      target[key] = original
  assert digest(result) == receipt["beforeSha256"]
  return result


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--input", type=Path, required=True)
  parser.add_argument("--masks", type=Path, required=True)
  parser.add_argument("--output", type=Path, required=True)
  parser.add_argument("--audit", type=Path, required=True)
  args = parser.parse_args()
  assert (
    args.output.resolve()
    != (ROOT / "src/app/src/data/westLandmarksV187.json").resolve()
  )
  source = json.loads(args.input.read_bytes())
  clipped, audit = clip_seating(source, json.loads(args.masks.read_bytes()))
  assert restore_clipped_payload(clipped, audit) == source
  args.output.write_bytes(encode(clipped))
  args.audit.write_bytes(encode(audit))
  print(
    json.dumps(
      {"surfaces": len(audit["surfaces"]), "nativeGroups": len(audit["native"])}
    )
  )
