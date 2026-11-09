"""Compile the bounded Steglitz supplement from the retained site sources."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from shapely import constrained_delaunay_triangles
from shapely.affinity import rotate, translate
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union
from shapely.prepared import prep
from shapely.strtree import STRtree

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "steglitz-public-space-v327-source.json"
OUT = DATA / "steglitzPublicSpaceV327.json"
EVIDENCE = GEO / "steglitz-public-space-v327-evidence.json"
PODIUM = "way/34782007"
TOWER = "way/34782008"
PARKING = "way/34782006"
PLAZA_Y = 3.025
CAP = 110 * 1024


def read(path):
  return json.loads(path.read_bytes())


def digest(path):
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def polygon(row):
  return Polygon(row["ring"], row["holes"])


def units(a, b):
  delta = np.subtract(b, a)
  length = float(np.linalg.norm(delta))
  return delta / length, length


def pieces(shape, kind):
  if shape.is_empty:
    return
  if shape.geom_type == kind:
    yield shape
  elif hasattr(shape, "geoms"):
    for child in shape.geoms:
      yield from pieces(child, kind)


def rect(center, width, depth, angle):
  outline = box(-width / 2, -depth / 2, width / 2, depth / 2)
  return translate(rotate(outline, -angle, use_radians=True), *center)


def edges(ring):
  return zip(ring, ring[1:] + ring[:1], strict=True)


class Model:
  def __init__(self):
    self.drawn = []
    self.native = []
    self.surfaces = []
    self.counts = Counter()

  def block(self, native, role, center, y, dimensions, rgb, yaw=0):
    x, z = center
    row = [x, y, z, *dimensions]
    assert all(math.isfinite(float(v)) for v in row) and min(dimensions) > 0
    if native:
      assert yaw == 0
      self.native.append([round(float(v), 4) for v in row] + [rgb])
    else:
      self.drawn.append([round(float(v), 4) for v in row] + [round(yaw, 8), rgb])
    self.counts[("native" if native else "drawn") + ":" + role] += 1

  def face(self, role, rgb, triangle, normal=None):
    points = [list(map(float, p)) for p in triangle]
    cross = np.cross(
      np.subtract(points[1], points[0]), np.subtract(points[2], points[0])
    )
    if np.linalg.norm(cross) < 1e-8:
      return
    if normal is not None and np.dot(cross, normal) < 0:
      points.reverse()
    self.surfaces.append([rgb, *[round(v, 5) for p in points for v in p]])
    self.counts["drawn:" + role] += 1


def merge_axis_rows(rows):
  """Join exact adjacent skin cuboids of equal colour without infill."""
  for axis in (1, 0, 2):
    groups = defaultdict(list)
    for row in rows:
      groups[tuple(v for i, v in enumerate(row) if i not in (axis, axis + 3))].append(
        row
      )
    result = []
    for group in groups.values():
      group.sort(key=lambda row: row[axis] - row[axis + 3] / 2)
      current = list(group[0])
      for row in group[1:]:
        high = current[axis] + current[axis + 3] / 2
        low = row[axis] - row[axis + 3] / 2
        if high != low:
          result.append(current)
          current = list(row)
          continue
        start = current[axis] - current[axis + 3] / 2
        end = row[axis] + row[axis + 3] / 2
        current[axis], current[axis + 3] = (start + end) / 2, end - start
      result.append(current)
    rows = result
  return rows


def clipped_triangle(triangle, domain, lower):
  """Clip in a non-degenerate projection, then lift onto the original plane."""
  a, b, c = np.asarray(triangle)
  normal = np.cross(b - a, c - a)
  xz = Polygon([[p[0], p[2]] for p in triangle])
  if xz.area > 1e-7:
    if max(a[1], b[1], c[1]) <= lower or abs(normal[1]) < 1e-8:
      return

    def height(x, z):
      return float(a[1] - (normal[0] * (x - a[0]) + normal[2] * (z - a[2])) / normal[1])

    shape = xz.intersection(domain)
    for patch in pieces(shape, "Polygon"):
      for tri in constrained_delaunay_triangles(patch).geoms:
        out = [[x, height(x, z), z] for x, z in list(tri.exterior.coords)[:3]]
        # Selected roofs never intersect the lower datum. The same guard
        # leaves the partly buried face to the original source shell.
        if min(p[1] for p in out) >= lower - 1e-7:
          yield out, normal
    return
  start, end = max(
    ((p[[0, 2]], q[[0, 2]]) for p in (a, b, c) for q in (a, b, c)),
    key=lambda ab: float(np.linalg.norm(ab[1] - ab[0])),
  )
  tangent, length = units(start, end)
  plane = Polygon(
    [(float(np.dot(p[[0, 2]] - start, tangent)), p[1]) for p in (a, b, c)]
  )
  if plane.area < 1e-8 or max(a[1], b[1], c[1]) <= lower:
    return
  for segment in pieces(LineString([start, end]).intersection(domain), "LineString"):
    lo, hi = sorted(
      float(np.dot(np.asarray(p) - start, tangent))
      for p in (segment.coords[0], segment.coords[-1])
    )
    patch = plane.intersection(box(lo, lower, hi, plane.bounds[3] + 1))
    for poly in pieces(patch, "Polygon"):
      for tri in constrained_delaunay_triangles(poly).geoms:
        out = []
        for u, y in list(tri.exterior.coords)[:3]:
          x, z = start + tangent * u
          out.append([x, y, z])
        yield out, normal


def podium_upper(model, legacy, previous_native):
  """Recover only actual upper shell fragments missing under the V182 owner."""
  measured = read(GEO / "ring-kreisel-parts-v182.json")["parents"][0]
  archive = GEO / "raw/lod2" / measured["tile"]
  assert (
    measured["id"] == "DEBE06YYB0000Xmt" and digest(archive) == measured["sourceSha256"]
  )
  original = extract_parent(archive, measured["id"])
  parts = [part_profile(p) for p in leaf_building_parts(original)]
  assert {p["id"] for p in parts} == {p["id"] for p in measured["parts"]}
  lower = legacy[PODIUM]["topY"]
  # Keep a centimetric clearance at the exact prior owner edges. The active
  # outside part fragments and both distinct neighbouring bodies remain intact.
  domain = (
    polygon(legacy[PODIUM])
    .buffer(-0.025)
    .difference(
      unary_union([polygon(legacy[TOWER]), polygon(legacy[PARKING])]).buffer(0.15)
    )
  )
  offset = legacy[PODIUM]["groundY"] - min(p["ground_y_m"] for p in parts)
  roofs, roof_planes, admitted = [], [], []
  for part in parts:
    if part["top_y_m"] - part["ground_y_m"] > 45:
      continue
    before = len(model.surfaces)
    for surface in part["surfaces"]:
      rings = [[[x, y + offset, z] for x, y, z in ring] for ring in surface["rings"]]
      roof = surface["kind"] == "RoofSurface"
      for triangle in triangles_for(rings):
        for clipped, normal in clipped_triangle(triangle, domain, lower):
          model.face(
            "measured-podium-roof" if roof else "measured-podium-wall",
            0x858681 if roof else 0xBBB8AA,
            clipped,
            normal,
          )
      if roof:
        projected = Polygon(
          [(x, z) for x, _, z in rings[0]],
          [[(x, z) for x, _, z in hole] for hole in rings[1:]],
        )
        if not projected.is_valid or projected.area < 0.001:
          continue
        for triangle in triangles_for(rings):
          a, b, c = np.asarray(triangle)
          normal = np.cross(b - a, c - a)
          if abs(normal[1]) < 1e-7:
            continue
          face = Polygon([p[[0, 2]] for p in (a, b, c)]).intersection(domain)
          if face.area > 0.001:
            roofs.append(face)
            roof_planes.append((a, normal, part["id"]))
    if len(model.surfaces) > before:
      admitted.append(part["id"])

  # Native is an independent conservative cardinal skin from the original
  # source roof planes. Its cells are not transformed Drawn triangles or boxes.
  tree = STRtree(roofs)
  support = unary_union(roofs)
  contained = prep(support)
  minimum = math.floor(lower) + 1
  old_roof = unary_union(
    [
      box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)
      for x, y, z, w, h, d, _ in previous_native
      if y + h / 2 == minimum and domain.intersects(Point(x, z))
    ]
  )
  supports_native = prep(old_roof)
  old_packet_records = {}
  existing = []
  for id in ("-8_13", "-7_13"):
    path = (
      ROOT
      / "src/app/public/mesh/surrounding-berlin-v159"
      / f"ring182-{id}.minecraft.json.gz"
    )
    old_packet_records[str(path.relative_to(ROOT))] = digest(path)
    packet = json.loads(gzip.decompress(path.read_bytes()))
    ox, _, oz = packet["origin"]
    for row in packet["nav"]["buildings"]:
      area = translate(polygon(row).buffer(0), ox, oz)
      if domain.intersection(area).area > 0.000001:
        existing.append(area)
  foreign = unary_union(existing)
  cells = {}
  outside_existing_cells = 0
  x0, z0, x1, z1 = support.bounds
  for z in range(math.ceil(z0), math.floor(z1)):
    for x in range(math.ceil(x0), math.floor(x1)):
      square = box(x, z, x + 1, z + 1)
      if not contained.covers(square) or not supports_native.covers(square):
        continue
      if foreign.intersection(square).area > 1e-7:
        outside_existing_cells += 1
        continue
      samples = defaultdict(list)
      spans = defaultdict(list)
      for i in tree.query(square, predicate="intersects"):
        a, n, owner = roof_planes[i]
        for patch in pieces(roofs[i].intersection(square), "Polygon"):
          spans[owner].append(patch)
          samples[owner].extend(
            a[1] - (n[0] * (u - a[0]) + n[2] * (v - a[2])) / n[1]
            for u, v in patch.exterior.coords
          )
      if not samples:
        continue
      whole = [
        min(values)
        for owner, values in samples.items()
        if unary_union(spans[owner]).area >= 1 - 1e-8
      ]
      top = math.floor(max(whole) if whole else min(map(min, samples.values()))) + 1
      if top > minimum:
        cells[x, z] = top
  rows = []
  for (x, z), top in cells.items():
    sides = min(
      cells.get((x + dx, z + dz), minimum)
      for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1))
    )
    if sides < top - 1:
      rows.append(
        [x + 0.5, (sides + top - 1) / 2, z + 0.5, 1, top - 1 - sides, 1, 0xBBB8AA]
      )
    rows.append([x + 0.5, top - 0.5, z + 0.5, 1, 1, 1, 0x858681])
  merged = merge_axis_rows(rows)
  for x, y, z, w, h, d, color in merged:
    model.block(True, "measured-podium-skin", (x, z), y, (w, h, d), color)
  return {
    "parent": measured["id"],
    "parts": sorted(admitted),
    "archiveSha256": digest(archive),
    "rigidYOffsetM": offset,
    "nativeWholeRoofCells": len(cells),
    "oldRoofY": lower,
    "nativeRows": len(merged),
    "areaM2": round(support.area, 5),
    "existingNativePacketCellsRetained": outside_existing_cells,
    "packetSourcePins": old_packet_records,
  }


def outside_edge(shape, a, b):
  direction, length = units(a, b)
  normal = np.array([-direction[1], direction[0]])
  midpoint = (np.asarray(a) + b) / 2
  if shape.covers(Point(midpoint + normal * 0.2)):
    normal *= -1
  return direction, normal, length, math.atan2(-direction[1], direction[0])


def construction_facades(model, legacy, native):
  tower, park = legacy[TOWER], legacy[PARKING]
  # The new secondary scaffold rails lie between the retained floor rails.
  for a, b in edges(tower["ring"]):
    _, n, length, yaw = outside_edge(polygon(tower), a, b)
    if length < 3.8:
      continue
    center = (np.asarray(a) + b) / 2 + n * 0.15
    for level in range(6, 30):
      y = tower["groundY"] + (tower["topY"] - tower["groundY"]) * (level + 0.5) / 30
      model.block(
        False,
        "secondary-scaffold",
        center,
        y,
        (length - 0.15, 0.065, 0.072),
        0xBCB4A1,
        yaw,
      )

  # The rear parking elevation has pale cladding and horizontal dark vents.
  parking = polygon(park)
  for a, b in edges(park["ring"]):
    direction, normal, length, yaw = outside_edge(parking, a, b)
    center = (np.asarray(a) + b) / 2
    if (
      length < 16 or polygon(legacy[PODIUM]).distance(Point(center + normal * 0.3)) < 1
    ):
      continue
    for level in range(1, 11):
      y = park["groundY"] + (park["topY"] - park["groundY"]) * (level + 0.48) / 11
      model.block(
        False,
        "parking-panel-bands",
        center + normal * 0.14,
        y + 0.59,
        (length - 0.4, 0.31, 0.06),
        0xCFCDC1,
        yaw,
      )
      for side in (-1, 1):
        model.block(
          False,
          "parking-vents",
          center + normal * 0.18 + direction * side * length * 0.36,
          y,
          (length * 0.19, 0.78, 0.075),
          0x373E42,
          yaw,
        )
    model.block(
      False,
      "parking-blue-fascia",
      center + normal * 0.18,
      park["groundY"] + 3.2,
      (length - 0.42, 0.55, 0.08),
      0x2D537A,
      yaw,
    )

  # Add to actual cardinal source skin faces, never to a rotated Drawn proxy.
  for part, levels, color, role in [
    (tower, (63, 79, 94, 111, 119), 0xC2B9A7, "secondary-scaffold"),
    (park, (8, 12, 17, 22, 27), 0x465052, "parking-vents"),
  ]:
    shape = polygon(part)
    nearby = prep(shape.buffer(1.5))
    for y in levels:
      row_cells = set()
      for x, cy, z, w, h, d, _ in native:
        if not cy - h / 2 <= y < cy + h / 2 or not nearby.covers(Point(x, z)):
          continue
        for u in range(round(x - w / 2), round(x + w / 2)):
          for v in range(round(z - d / 2), round(z + d / 2)):
            if shape.boundary.distance(Point(u + 0.5, v + 0.5)) < 1.4:
              row_cells.add((u, v))
      spans = defaultdict(list)
      for x, z in sorted(row_cells):
        for dx, dz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
          if (x + dx, z + dz) in row_cells or shape.covers(
            Point(x + 0.5 + dx, z + 0.5 + dz)
          ):
            continue
          plane = x + (dx > 0) if dx else z + (dz > 0)
          spans[(dx, dz, plane)].append(z if dx else x)
      for (dx, dz, plane), along in spans.items():
        runs = []
        for u in sorted(set(along)):
          if runs and u == runs[-1][1]:
            runs[-1][1] += 1
          else:
            runs.append([u, u + 1])
        for low, high in runs:
          if high - low < (3 if part is tower else 4):
            continue
          mid, length = (low + high) / 2, high - low
          center = (plane + dx * 0.047, mid) if dx else (mid, plane + dz * 0.047)
          dims = (0.085, 0.12, length) if dx else (length, 0.12, 0.085)
          model.block(True, role, center, y + 0.21, dims, color)


def aligned_block(
  model, native, role, center, y, width, height, depth, color, direction
):
  if native:
    dims = (
      (width, height, depth)
      if abs(direction[0]) >= abs(direction[1])
      else (depth, height, width)
    )
    model.block(True, role, center, y, dims, color)
  else:
    model.block(
      False,
      role,
      center,
      y,
      (width, height, depth),
      color,
      math.atan2(-direction[1], direction[0]),
    )


def plaza_details(model, source, floors, legacy):
  ways = {row["id"]: row for row in source["ways"]}
  points = {row["id"]: np.asarray(row["p"]) for row in source["points"]}
  plaza = polygon(floors["drawn"][0])
  native_paving = unary_union(
    [box(x0, z0, x1, z1) for x0, z0, x1, z1, y in floors["native"] if y == PLAZA_Y]
  )
  common = plaza.intersection(native_paving)
  course = LineString(ways["775412153"]["points"])
  trees = unary_union(
    [
      Point(row["p"]).buffer(0.95)
      for row in source["points"]
      if row["tags"].get("natural") == "tree"
    ]
  )
  other = unary_union(
    [
      course.buffer(1.55),
      trees,
      Point(points["6874973858"]).buffer(1.1),
      polygon(legacy["way/775632534"]).buffer(1.5),
    ]
  )
  allowed = common.difference(other)
  direction, _ = units(ways["775412153"]["points"][0], ways["775412153"]["points"][-1])
  normal = np.array([-direction[1], direction[0]])
  yaw = math.atan2(-direction[1], direction[0])
  anchors, footprints = [], []
  center = points["3980482215"]
  # A representative market-day layout leaves the mapped through path and all
  # monument, fountain, stair and tree areas free. Its booths are estimates.
  candidates = [
    center + direction * u + normal * v
    for u in range(-17, 22, 2)
    for v in range(-15, 16, 2)
  ]
  for p in sorted(candidates, key=lambda p: float(np.linalg.norm(p - center))):
    drawn = rect(p, 2.95, 2.48, yaw)
    cardinal = rect(
      p, 2.95, 2.48, 0 if abs(direction[0]) >= abs(direction[1]) else math.pi / 2
    )
    footprint = drawn.union(cardinal)
    if not allowed.covers(footprint) or any(
      q.distance(footprint) < 1.5 for q in footprints
    ):
      continue
    anchors.append(p)
    footprints.append(footprint)
    if len(anchors) == 6:
      break
  assert len(anchors) == 6, len(anchors)
  for native in (False, True):
    d = (
      direction
      if not native
      else np.array([1, 0] if abs(direction[0]) >= abs(direction[1]) else [0, 1])
    )
    n = np.array([-d[1], d[0]])
    for i, p in enumerate(anchors):
      roof = (0x668267, 0xB56C51, 0x687E8F)[i % 3]
      for u in (-1.2, 1.2):
        for v in (-0.89, 0.89):
          aligned_block(
            model,
            native,
            "market-frame",
            p + d * u + n * v,
            PLAZA_Y + 1.03,
            0.055,
            2.06,
            0.055,
            0x59625B,
            d,
          )
      aligned_block(
        model,
        native,
        "market-counter",
        p - n * 0.4,
        PLAZA_Y + 0.79,
        2.42,
        0.15,
        0.86,
        0x8F7B63,
        d,
      )
      for j in range(5):
        aligned_block(
          model,
          native,
          "market-crate",
          p + d * ((j - 2) * 0.43) - n * 0.4,
          PLAZA_Y + 0.92,
          0.39,
          0.15,
          0.61,
          0x394D3D,
          d,
        )
        aligned_block(
          model,
          native,
          "market-produce",
          p + d * ((j - 2) * 0.43) - n * 0.4,
          PLAZA_Y + 1.01,
          0.29,
          0.08,
          0.47,
          (0xC7A448, 0x7B9550, 0xBE7654, 0xA3A255, 0x6C7F49)[(j + i) % 5],
          d,
        )
      for j in range(7):
        tone = roof if j % 2 == 0 else 0xE7DFCB
        u0, u1 = (j - 3.5) * 0.4, (j - 2.5) * 0.4
        if native:
          for v, dy in [(-0.77, 0.06), (0, 0.23), (0.77, 0.06)]:
            aligned_block(
              model,
              True,
              "market-awning",
              p + d * ((u0 + u1) / 2) + n * v,
              PLAZA_Y + 2.04 + dy,
              0.4,
              0.105,
              0.77,
              tone,
              d,
            )
        else:
          for v0, v1, y0, y1 in [(-1.15, 0, 2.06, 2.31), (0, 1.15, 2.31, 2.06)]:
            quad = []
            for u, v, y in [(u0, v0, y0), (u1, v0, y0), (u1, v1, y1), (u0, v1, y1)]:
              x, z = p + d * u + n * v
              quad.append([x, PLAZA_Y + y, z])
            model.face("market-awning", tone, quad[:3], [0, 1, 0])
            model.face("market-awning", tone, [quad[0], quad[2], quad[3]], [0, 1, 0])

    # The municipal record describes a red information stele. Muted fields
    # identify its layout without reproducing images, names or inscriptions.
    p = points["6874973858"]
    assert plaza.covers(Point(p))
    aligned_block(
      model,
      native,
      "red-memorial-stele",
      p,
      PLAZA_Y + 1.03,
      0.84,
      2.06,
      0.12,
      0xA4493F,
      d,
    )
    aligned_block(
      model,
      native,
      "red-memorial-stele",
      p - n * 0.065,
      PLAZA_Y + 1.29,
      0.70,
      1.18,
      0.02,
      0xDBCFC0,
      d,
    )
    for j in range(6):
      aligned_block(
        model,
        native,
        "red-memorial-stele",
        p - n * 0.078 + d * 0.22,
        PLAZA_Y + 1.75 - j * 0.16,
        0.16,
        0.108,
        0.012,
        0x746D66,
        d,
      )

  return {
    "marketSource": "node/3980482215",
    "marketStands": [list(map(float, p)) for p in anchors],
    "reservedWalkWidthM": 3.1,
    "memorialSource": "node/6874973858",
    "plazaSource": "relation/10741017",
    "retainedSourceHoles": len(plaza.interiors),
  }


def transit_details(model, source, floors, legacy, previous_native):
  ways = {row["id"]: row for row in source["ways"]}
  plaza = polygon(floors["drawn"][0])
  old_native = unary_union(
    [box(x0, z0, x1, z1) for x0, z0, x1, z1, y in floors["native"] if y == PLAZA_Y]
  )
  trees = unary_union(
    [
      Point(row["p"]).buffer(0.75)
      for row in source["points"]
      if row["tags"].get("natural") == "tree"
    ]
  )
  platform_ids = []
  for id in ("392427434", "392427437"):
    way = ways[id]
    assert way["tags"]["shelter"] == "yes" and way["tags"]["highway"] == "platform"
    a, b = map(np.asarray, (way["points"][0], way["points"][-1]))
    direction, length = units(a, b)
    n = np.array([-direction[1], direction[0]])
    yaw = math.atan2(-direction[1], direction[0])
    clear = plaza.intersection(old_native).difference(trees)
    p = next(
      (
        a + direction * u + n * v
        for u in (length / 2, 4, length - 4)
        for v in (0, -0.85, 0.85, -1.65, 1.65)
        if clear.covers(rect(a + direction * u + n * v, 4.25, 1.55, yaw))
        and clear.covers(
          rect(
            a + direction * u + n * v,
            4.25,
            1.55,
            0 if abs(direction[0]) >= abs(direction[1]) else math.pi / 2,
          )
        )
      ),
      None,
    )
    if p is None:
      continue
    platform_ids.append("way/" + id)
    for native in (False, True):
      d = (
        direction
        if not native
        else np.array([1, 0] if abs(direction[0]) >= abs(direction[1]) else [0, 1])
      )
      e = np.array([-d[1], d[0]])
      aligned_block(
        model,
        native,
        "bus-shelter-roof",
        p,
        PLAZA_Y + 2.36,
        4.2,
        0.14,
        1.5,
        0x667274,
        d,
      )
      aligned_block(
        model,
        native,
        "bus-shelter-fascia",
        p - e * 0.7,
        PLAZA_Y + 2.37,
        4.1,
        0.13,
        0.12,
        0x3E636D,
        d,
      )
      for u in (-1.85, 1.85):
        aligned_block(
          model,
          native,
          "bus-shelter-post",
          p + d * u + e * 0.58,
          PLAZA_Y + 1.14,
          0.08,
          2.28,
          0.08,
          0x586668,
          d,
        )
      aligned_block(
        model,
        native,
        "bus-shelter-bench",
        p + e * 0.42,
        PLAZA_Y + 0.46,
        2.6,
        0.09,
        0.4,
        0xA29B83,
        d,
      )
      for u in (-0.93, 0.93):
        aligned_block(
          model,
          native,
          "bus-shelter-bench",
          p + d * u + e * 0.42,
          PLAZA_Y + 0.23,
          0.08,
          0.46,
          0.26,
          0x566367,
          d,
        )
      aligned_block(
        model,
        native,
        "bus-information",
        p + d * 1.26 + e * 0.58,
        PLAZA_Y + 1.46,
        0.73,
        0.87,
        0.075,
        0x38535C,
        d,
      )
      aligned_block(
        model,
        native,
        "bus-information",
        p + d * 1.26 + e * 0.532,
        PLAZA_Y + 1.47,
        0.57,
        0.68,
        0.022,
        0xD3CDB6,
        d,
      )

  # Mark the edges of the earlier physical stair opening without covering it.
  # Heights remain tied to its retained paving and packet navigation.
  stair = ways["346265207"]
  a, b = map(np.asarray, (stair["points"][0], stair["points"][-1]))
  axis, _ = units(a, b)
  hole = min(
    (Polygon(ring) for ring in floors["drawn"][0]["holes"]),
    key=lambda g: g.distance(LineString([a, b])),
  )
  rails = 0
  ring = list(hole.exterior.coords)[:-1]
  for a, b in edges(ring):
    d, n, length, yaw = outside_edge(hole, a, b)
    if length < 4 or abs(float(np.dot(axis, d))) < 0.8:
      continue
    p = (np.asarray(a) + b) / 2 + n * 0.13
    if not plaza.covers(rect(p, length - 0.12, 0.10, yaw)):
      continue
    rails += 1
    model.block(
      False,
      "stair-mouth-rail",
      p,
      PLAZA_Y + 0.96,
      (length - 0.12, 0.065, 0.065),
      0x627071,
      yaw,
    )
    for j in range(1, math.ceil(length / 1.25)):
      t = j / math.ceil(length / 1.25)
      q = np.asarray(a) * (1 - t) + np.asarray(b) * t + n * 0.13
      for native in (False, True):
        ground = (
          3 if native and not old_native.covers(rect(q, 0.06, 0.06, 0)) else PLAZA_Y
        )
        top = PLAZA_Y + 0.96
        model.block(
          native,
          "stair-mouth-post",
          q,
          (ground + top) / 2,
          (0.06, top - ground, 0.06),
          0x5D6B6B,
        )
    # Cardinal pieces cover the source course in smaller orthogonal segments.
    segments = math.ceil((length - 0.14) / 0.45)
    for j in range(segments):
      q = p + d * (length - 0.14) * ((j + 0.5) / segments - 0.5)
      model.block(
        True,
        "stair-mouth-rail",
        q,
        PLAZA_Y + 0.96,
        (
          0.065 + abs(d[0]) * (length - 0.14) / segments,
          0.065,
          0.065 + abs(d[1]) * (length - 0.14) / segments,
        ),
        0x627071,
      )

  # Face the two mapped PSV course ends at the real podium outline. These
  # metal markers describe the approaches to the still retained V182 shell.
  podium = polygon(legacy[PODIUM])
  portals = []
  for id in ("70168262", "30157285"):
    way = ways[id]
    assert way["tags"]["psv"] == "yes" and way["tags"]["tunnel"] == "building_passage"
    p = min(
      (Point(way["points"][0]), Point(way["points"][-1])), key=podium.boundary.distance
    )
    a, b = min(
      edges(legacy[PODIUM]["ring"]), key=lambda edge: LineString(edge).distance(p)
    )
    d, n, length, yaw = outside_edge(podium, a, b)
    if length < 5.4 or podium.boundary.distance(p) > 0.035:
      continue
    u = max(2.65, min(length - 2.65, float(np.dot(np.asarray(p.coords[0]) - a, d))))
    q = np.asarray(a) + d * u + n * 0.24
    portals.append("way/" + id)
    for x in (-2.27, 2.27):
      model.block(
        False,
        "bus-portal-blue-jamb",
        q + d * x,
        4.87,
        (0.25, 3.54, 0.16),
        0x2A5576,
        yaw,
      )
    model.block(
      False, "bus-portal-metal-lintel", q, 6.64, (4.78, 0.31, 0.22), 0x8E9692, yaw
    )
    # Bind the Native jambs to actual original cardinal faces, including the
    # change of cardinal axis at a stepped corner.
    axis = int(np.argmax(abs(n)))
    side = math.copysign(1, n[axis])
    for x in (-2.27, 2.27):
      desired = q + d * x
      found = []
      for px, py, pz, w, h, depth, _ in previous_native:
        center, size = np.array([px, pz]), np.array([w, depth])
        if not py - h / 2 <= 4.9 < py + h / 2 or np.linalg.norm(center - desired) > 4:
          continue
        other = 1 - axis
        face = center.copy()
        face[axis] += side * size[axis] / 2
        face[other] = np.clip(
          desired[other],
          center[other] - size[other] / 2 + 0.15,
          center[other] + size[other] / 2 - 0.15,
        )
        distance = float(np.linalg.norm(face - desired))
        if distance < 1.5:
          found.append((distance, face))
      if found:
        _, face = min(found, key=lambda row: row[0])
        face[axis] += side * 0.081
        dims = (0.16, 3.54, 0.27) if axis == 0 else (0.27, 3.54, 0.16)
        model.block(True, "bus-portal-blue-jamb", face, 4.87, dims, 0x2A5576)
  return {
    "platformCanopies": platform_ids,
    "stairRailSource": "way/346265207",
    "stairSides": rails,
    "busPortalMarkers": portals,
    "retainedBlockedV182Passage": True,
  }


def build():
  source = read(SOURCE)
  old_nav = DATA / "steglitzV182Navigation.json"
  old_native = DATA / "steglitzV182Native.json"
  old_floors = DATA / "steglitzGroundV247.json"
  retained = [
    old_nav,
    old_native,
    old_floors,
    DATA / "steglitzV182Source.json",
    DATA / "steglitzV246Details.json",
    DATA / "hermannEhlersFountainV248.json",
  ]
  legacy = {row["id"]: row for row in read(old_nav)["buildings"]}
  model = Model()
  previous_native = read(old_native)["boxes"]
  upper = podium_upper(model, legacy, previous_native)
  construction_facades(model, legacy, previous_native)
  floors = read(old_floors)
  plaza = plaza_details(model, source, floors, legacy)
  transit = transit_details(model, source, floors, legacy, previous_native)
  vertices, indices, slots = [], [], {}
  for color, *coords in model.surfaces:
    for i in (0, 3, 6):
      key = (*coords[i : i + 3], color)
      if key not in slots:
        slots[key] = len(vertices)
        vertices.append(key)
      indices.append(slots[key])
  assert len(vertices) < 65536
  runtime = {
    "schemaVersion": 1,
    "drawn": model.drawn,
    "native": model.native,
    "vertices": vertices,
    "indices": indices,
  }
  geometry = {
    "drawn": len(model.drawn) * 76 + len(vertices) * 27 + len(indices) * 2 + 648,
    "native": len(model.native) * 76 + 648,
  }
  assert max(geometry.values()) <= CAP, (geometry, model.counts)
  evidence = {
    "schemaVersion": 1,
    "sourceSha256": digest(SOURCE),
    "retained": {str(p.relative_to(ROOT)): digest(p) for p in retained},
    "upperPodium": upper,
    "plaza": plaza,
    "transit": transit,
    "counts": dict(model.counts),
    "bufferBytes": geometry,
  }
  return runtime, evidence


def main():
  data, evidence = build()
  OUT.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  evidence["dataSha256"] = digest(OUT)
  EVIDENCE.write_text(json.dumps(evidence, indent=2) + "\n")
  print(
    json.dumps(
      {
        "counts": evidence["counts"],
        "bufferBytes": evidence["bufferBytes"],
        "upper": evidence["upperPodium"],
      }
    )
  )


if __name__ == "__main__":
  main()
