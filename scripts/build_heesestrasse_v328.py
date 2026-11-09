"""Compile bounded additions to the actual Heesestraße street-facing walls."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import subprocess
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from build_rixdorf_v304 import fingerprint, read, write
from build_surrounding_outlines import GROUND_Y, PackedMesh, polygons_from_geometry
from shapely import constrained_delaunay_triangles, make_valid, orient_polygons
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import nearest_points, unary_union

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app"
EVIDENCE = ROOT / "geo_data/regierungsviertel/heesestrasse-v328-source.json.gz"
PACKETS = APP / "public/mesh/surrounding-berlin-v159"
OUT = APP / "src/data/heesestrasseV328Packets.json"
ID = "ring182--7_13"
KIND = "heesestrasse-v328"
SOURCE_SHA = "3a7441e9c327970754687dca42a29e7e0f5eb251e022774a1121d97d2bf19309"
RAW_SHA = {
  "drawn": "9c557b4f8247ce5a5c058585d1e4f4779e5060498b98af0364b6ff1d40e84860",
  "minecraft": "e2ca22348a6a74e1d9212ae6375420ef4c2eb43d8ab7faf380c6ab29ba5d5792",
}
CORNERS = {"8": "Südendstraße", "17": "Südendstraße", "12": "Bergstraße"}
PROTECTED = {"DEBE06YYB00008wL", "DEBE06YYB0000waY", "DEBE06YYB0000AUq"}


def digest(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def rgb(color):
  return tuple((color >> shift) & 255 for shift in (16, 8, 0))


def nav_geometry(row, ox, oz):
  return make_valid(translate(Polygon(row["ring"], row["holes"]), ox, oz))


@dataclass
class Wall:
  start: np.ndarray
  course: np.ndarray
  out: np.ndarray
  plane: Polygon
  length: float
  source: str
  road: str
  outside: object

  def point(self, u, y, depth):
    x, z = self.start + self.course * u + self.out * depth
    return float(x), float(y), float(z)


def orientation(a, b, owner):
  course = np.asarray(b) - np.asarray(a)
  length = float(np.linalg.norm(course))
  if not length:
    return None
  course /= length
  n = np.array([-course[1], course[0]])
  mid = (np.asarray(a) + b) / 2
  if owner.covers(Point(mid + n * 0.16)):
    n = -n
  if owner.covers(Point(mid + n * 0.16)):
    return None
  return course, n, length, mid


def street_of(mid, normal, roads, names, blockers):
  """Project along the facade's own outward half plane toward a real road."""
  p = Point(mid)
  hits = []
  for name in names:
    road = roads[name]
    q = nearest_points(p, road)[1]
    delta = np.asarray(q.coords[0]) - mid
    distance = np.linalg.norm(delta)
    if not 0 < distance < 23 or np.dot(normal, delta / distance) < 0.70:
      continue
    ray = LineString([mid + normal * 0.23, q.coords[0]])
    if blockers.intersection(ray).length > 0.075:
      continue
    hits.append((distance, name))
  return min(hits)[1] if hits else None


def measured_walls(family, host, roads, blockers):
  owner = shape(family["footprint"])
  offset = GROUND_Y - min(
    p["groundY"] for p in family["parts"] if p["groundY"] is not None
  )
  allowed = [
    "Heesestraße",
    *([CORNERS[family["number"]]] if family["number"] in CORNERS else []),
  ]
  outline = owner.boundary.buffer(0.018)
  old_outline = host.boundary.buffer(0.018)
  result = []
  for part in family["parts"]:
    for s in part["surfaces"]:
      if s["kind"] != "WallSurface":
        continue
      rings = [np.asarray(r, dtype=float) for r in s["rings"]]
      points = rings[0]
      a, b = max(
        ((a[[0, 2]], b[[0, 2]]) for a in points for b in points),
        key=lambda p: math.dist(*p),
      )
      o = orientation(a, b, owner)
      if o is None:
        continue
      direction, n, length, mid = o
      edge = LineString([a, b])
      low, high = min(points[:, 1]), max(points[:, 1])
      if length < 0.70 or high - low < 3.3 or low > part["groundY"] + 1.2:
        continue
      if not outline.covers(edge) or not old_outline.covers(edge):
        continue
      road = street_of(mid, n, roads, allowed, blockers)
      if road is None:
        continue
      # Retain the full measured plane and every aperture. The source support
      # must project back to one straight facade to centimetre precision.
      rings_2d = []
      for r in rings:
        xy = r[:, [0, 2]] - a
        if max(np.abs(xy @ n)) > 0.012:
          break
        rings_2d.append(list(zip(xy @ direction, r[:, 1] + offset, strict=True)))
      if len(rings_2d) != len(rings):
        continue
      wall = Polygon(rings_2d[0], rings_2d[1:])
      if not wall.is_valid or wall.area <= 0:
        continue
      result.append(
        Wall(a, direction, n, wall, length, s["sourcePolygonId"], road, blockers)
      )
  return result


def wall_quad(mesh, points, color):
  mesh.triangle(points[:3], rgb(color))
  mesh.triangle([points[0], points[2], points[3]], rgb(color))


def panel(mesh, wall, profile, color, depth, *, relief=0.0, clip=False):
  if profile.is_empty:
    return False
  limit = wall.plane.buffer(-0.022)
  if clip:
    profile = profile.intersection(limit)
  elif not limit.covers(profile):
    return False
  polygons = list(polygons_from_geometry(profile))
  if not polygons:
    return False
  for polygon in polygons:
    left, _, right, _ = polygon.bounds
    p, q = wall.start + wall.course * left, wall.start + wall.course * right
    xz = LineString([p + wall.out * depth, q + wall.out * depth])
    if wall.outside.intersection(xz).length > 0.012:
      return False
    if relief:
      sweep = Polygon(
        [
          p + wall.out * (depth - relief),
          q + wall.out * (depth - relief),
          q + wall.out * depth,
          p + wall.out * depth,
        ]
      )
      if wall.outside.intersection(sweep).area > 1e-6:
        return False
  for polygon in polygons:
    for triangle in constrained_delaunay_triangles(polygon).geoms:
      mesh.triangle(
        [wall.point(u, y, depth) for u, y in list(triangle.exterior.coords)[:3]],
        rgb(color),
      )
    if relief:
      for ring in (polygon.exterior, *polygon.interiors):
        for a, b in zip(ring.coords, list(ring.coords)[1:]):
          wall_quad(
            mesh,
            [
              wall.point(*a, depth - relief),
              wall.point(*b, depth - relief),
              wall.point(*b, depth),
              wall.point(*a, depth),
            ],
            color,
          )
  return True


def frame(
  mesh, wall, u, y, width, height, frame_color, glass, *, native, wall_depth=0.07
):
  border = 0.11 if native else 0.074
  if not panel(
    mesh,
    wall,
    box(
      u - width / 2 - border,
      y - height / 2 - border,
      u + width / 2 + border,
      y + height / 2 + border,
    ),
    frame_color,
    wall_depth,
  ):
    return False
  panel(
    mesh,
    wall,
    box(u - width / 2, y - height / 2, u + width / 2, y + height / 2),
    glass,
    wall_depth + 0.025,
  )
  panel(
    mesh,
    wall,
    box(u - border * 0.45, y - height / 2, u + border * 0.45, y + height / 2),
    frame_color,
    wall_depth + 0.050,
  )
  panel(
    mesh,
    wall,
    box(
      u - width / 2 - border,
      y - height / 2 - 0.13,
      u + width / 2 + border,
      y - height / 2 - 0.04,
    ),
    frame_color,
    wall_depth + 0.067,
    relief=0.055,
  )
  return True


def house_axes(walls):
  """Use one street grid for adjacent parallel measured planes of a façade."""
  result = {}
  for road in {w.road for w in walls}:
    group = [w for w in walls if w.road == road]
    major = max(group, key=lambda w: w.length)
    axis = major.course
    parallel = [w for w in group if abs(w.course @ axis) >= 0.94]
    span = [
      float(w.point(u, 0, 0)[0] * axis[0] + w.point(u, 0, 0)[2] * axis[1])
      for w in parallel
      for u in (0, w.length)
    ]
    result[road] = axis, min(span), max(span)
  return result


def pane_positions(wall, number, axes):
  axis, start, end = axes[wall.road]
  if abs(wall.course @ axis) < 0.94:
    return [wall.length / 2] if wall.length >= 1.28 else []
  base = float(wall.start @ axis)
  sign = float(wall.course @ axis)
  return [(target - base) / sign for target in axis_positions(number, start, end)]


def axis_positions(number, start, end):
  width = end - start
  count = 7 if number == "3" else 6 if number == "18" else max(1, round(width / 2.65))
  return [start + (i + 0.5) * width / count for i in range(count)]


def native_pane_positions(faces, number, axes):
  """Each complete frontage axis owns one verified cardinal face, never a copy."""
  by_face = [[] for _ in faces]
  for road, (axis, start, end) in axes.items():
    candidates = [
      (i, wall, float(wall.start @ axis), float(wall.course @ axis))
      for i, wall in enumerate(faces)
      if wall.road == road and abs(wall.course @ axis) >= 0.40
    ]
    for target in axis_positions(number, start, end):
      offers = []
      for i, wall, base, sign in candidates:
        if wall.length < 1.1:
          continue
        margin = min(1.04, wall.length * 0.55) / 2 + 0.15
        u = min(wall.length - margin, max(margin, (target - base) / sign))
        error = abs(base + sign * u - target)
        if error <= 1.05 and all(abs(u - other) >= 1.12 for other in by_face[i]):
          offers.append((error, -abs(sign), i, u))
      if offers:
        _, _, i, u = min(offers)
        by_face[i].append(u)
  return by_face


def roofline(walls):
  """Estimate common floor bands below the actual street-facing source eaves."""
  return float(np.median([w.plane.bounds[3] for w in walls if w.length >= 1.3]))


def decorate(mesh, wall, number, levels, eave, positions, *, native, axis_extent):
  count = Counter()
  pitch = (eave - GROUND_Y - 0.75) / levels
  heritage = number == "3"
  balconies = number == "18"
  frame_color = 0x755A4C if heritage else 0xBEB7A3 if balconies else 0xA7A496
  glass = 0x414C4A if heritage else 0x465756 if balconies else 0x596764
  axis, start, end = axis_extent
  mid = (start + end) / 2
  for u in positions:
    course_position = float((wall.start + wall.course * u) @ axis)
    relative = (course_position - start) / max(end - start, 0.001)
    for floor in range(levels):
      y = GROUND_Y + 0.65 + (floor + 0.53) * pitch
      h = min(pitch * 0.52, 2.02 if heritage else 1.86)
      width = min(1.04 if native else 1.20, wall.length * 0.55)
      if heritage and floor == 0 and abs(course_position - mid) < 1.28:
        continue
      if frame(mesh, wall, u, y, width, h, frame_color, glass, native=native):
        count["window"] += 1
        if balconies and floor > 0 and (relative < 0.20 or relative > 0.80):
          w = min(1.75, wall.length * 0.72)
          if native:
            w = min(w, 2 * min(u, wall.length - u) - 0.10)
          y0 = y - h * 0.45
          if panel(
            mesh,
            wall,
            box(u - w / 2, y0 - 0.13, u + w / 2, y0 + 0.52),
            0xCDC0A1,
            0.23 if native else 0.31,
            relief=0.16,
          ):
            count["balcony"] += 1
  if heritage or balconies:
    color = 0x586450 if heritage else 0xA89576
    for y in (GROUND_Y + 0.91, GROUND_Y + 0.65 + pitch, eave - 0.31):
      if panel(
        mesh,
        wall,
        box(0.025, y - 0.047, wall.length - 0.025, y + 0.047),
        color,
        0.08,
        clip=True,
      ):
        count["course"] += 1
  if heritage:
    # The photographed central arched door is fitted to the complete frontage
    # grid, so the arch does not restart across adjoining source wall sheets.
    sign = float(wall.course @ axis)
    if abs(sign) >= (0.43 if native else 0.94):
      u = (mid - float(wall.start @ axis)) / sign
      spring, radius, floor = GROUND_Y + 3.08, 0.94, GROUND_Y + 0.15
      if native:
        profile = unary_union(
          [
            box(u - radius, floor, u + radius, spring + 0.30),
            box(u - 0.66, spring + 0.30, u + 0.66, spring + 0.63),
            box(u - 0.34, spring + 0.63, u + 0.34, spring + 0.82),
          ]
        )
      else:
        ring = [(u - radius, floor), (u + radius, floor)] + [
          (
            u + radius * math.cos(i * math.pi / 14),
            spring + radius * math.sin(i * math.pi / 14),
          )
          for i in range(15)
        ]
        profile = Polygon(ring)
      if panel(
        mesh, wall, profile.buffer(0.085, join_style=2), 0x495C48, 0.09, clip=True
      ):
        panel(mesh, wall, profile, 0x613930, 0.12, clip=True)
        count["portal"] += 1
  return count


def native_walls(measured, host, blockers, low, high):
  allowed = {}
  for w in measured:
    a = w.start
    b = a + w.course * w.length
    allowed.setdefault(w.road, []).append((w.out, LineString([a, b])))
  result = []
  for p in polygons_from_geometry(orient_polygons(host, exterior_cw=True)):
    for a, b in zip(p.exterior.coords, list(p.exterior.coords)[1:]):
      o = orientation(a, b, host)
      if o is None:
        continue
      course, normal, width, mid = o
      if width < 1 or (a[0] != b[0] and a[1] != b[1]):
        continue
      # The independently voxelized source has its own cardinal external faces.
      # Relate a candidate to a nearby measured street face of the same owner.
      offers = [
        (line.distance(Point(mid)), name)
        for name, walls in allowed.items()
        for n, line in walls
        if normal @ n > 0.43 and line.distance(Point(mid)) < 2.50
      ]
      if not offers or blockers.covers(Point(mid + normal * 0.20)):
        continue
      _, name = min(offers)
      if (
        blockers.intersection(
          LineString([mid + normal * 0.04, mid + normal * 0.32])
        ).length
        > 0.02
      ):
        continue
      result.append(
        Wall(
          np.asarray(a),
          course,
          normal,
          box(0, low, width, high),
          width,
          f"cardinal:{a}:{b}",
          name,
          blockers,
        )
      )
  return result


def compile_mode(source, raw, mode, receipt):
  native = mode == "minecraft"
  ox, _, oz = raw["origin"]
  mesh = PackedMesh(ox, oz)
  roads = {
    name: unary_union(
      [
        LineString(r["vertices"])
        for r in source["roads"]
        if r["tags"]["name"] == name and r["tags"].get("highway")
      ]
    )
    for name in ("Heesestraße", "Südendstraße", "Bergstraße")
  }
  nav = [(r, nav_geometry(r, ox, oz)) for r in raw["nav"]["buildings"]]
  if native:
    drawn_raw = read(PACKETS / f"{ID}.drawn.json.gz")
    measured_hosts = [
      (r, nav_geometry(r, ox, oz)) for r in drawn_raw["nav"]["buildings"]
    ]
  else:
    measured_hosts = nav
  compiled = {}
  owners = [f["id"] for f in source["families"]]
  if len(set(owners)) != 17 or (
    set(owners) & (PROTECTED | set(receipt["previousFittingOwners"]))
  ):
    raise ValueError("Missing or overlapping Heesestraße owners")
  for family in source["families"]:
    owner = family["id"]
    match = [(r, g) for r, g in nav if r["sourceId"] == owner]
    measured = [(r, g) for r, g in measured_hosts if r["sourceId"] == owner]
    if len(match) != 1 or len(measured) != 1:
      raise ValueError(f"Incomplete actual old body: {owner}")
    old, host = match[0]
    host_near = host.buffer(28)
    old_outside = unary_union(
      [g for r, g in nav if r["sourceId"] != owner and host_near.intersects(g)]
    )
    measured_outside = unary_union(
      [
        g
        for r, g in measured_hosts
        if r["sourceId"] != owner and host_near.intersects(g)
      ]
    )
    walls = measured_walls(family, measured[0][1], roads, measured_outside)
    if not walls:
      raise ValueError(f"No evidenced road-facing wall: {family['number']}")
    axes = house_axes(walls)
    eave = roofline(walls)
    counts = Counter()
    used = set()
    if native:
      faces = native_walls(
        walls,
        host,
        old_outside,
        GROUND_Y + old["minHeight"],
        min(GROUND_Y + old["height"], eave),
      )
    else:
      faces = walls
    n = family["number"]
    groups = (
      native_pane_positions(faces, n, axes)
      if native
      else [pane_positions(w, n, axes) for w in faces]
    )
    for wall, positions in zip(faces, groups, strict=True):
      change = decorate(
        mesh,
        wall,
        n,
        family["levels"],
        eave,
        positions,
        native=native,
        axis_extent=axes[wall.road],
      )
      if change:
        used.add(wall.source)
        counts.update(change)
    if counts["window"] < 2:
      raise ValueError(
        f"No complete supported window group: {mode} {family['number']} {counts}, {len(faces)} faces, {groups}"
      )
    compiled[owner] = {
      "address": family["number"],
      "fittings": dict(counts),
      "faces": sorted(used),
      "sourceWalls": [w.source for w in walls],
    }
  part = mesh.payload(KIND)
  new_bytes = 12 * len(mesh.vertices) + 4 * len(mesh.indices)
  if not part or new_bytes > 256 * 1024:
    raise ValueError(f"Unexpected bounded Heesestraße mesh bytes {new_bytes}")
  recipe = {
    **{
      k: receipt[k]
      for k in ("navGuard", "lineGuard", "preparedNavGuard", "preparedLineGuard")
    },
    "origin": raw["origin"],
    "records": [
      {"mesh": i, "kind": m["kind"], "fingerprint": fingerprint(m)}
      for i, m in enumerate(raw["meshes"])
    ],
    "append": part,
    "appendFingerprint": fingerprint(part),
    "retire": [],
    "owners": owners,
  }
  return recipe, {
    "vertices": len(mesh.vertices),
    "triangles": len(mesh.indices) // 3,
    "bytes": new_bytes,
    "owners": compiled,
    "previousKinds": receipt["predecessorKinds"],
    "previousFittingOwners": receipt["previousFittingOwners"],
  }


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--output", type=Path, default=OUT)
  parser.add_argument("--audit", type=Path)
  args = parser.parse_args()
  if digest(EVIDENCE) != SOURCE_SHA:
    raise ValueError("Changed immutable Heesestraße source")
  source = read(EVIDENCE)
  paths = {mode: PACKETS / f"{ID}.{mode}.json.gz" for mode in RAW_SHA}
  if any(digest(path) != RAW_SHA[mode] for mode, path in paths.items()):
    raise ValueError("Changed published original ring packet")
  capture = subprocess.run(
    [
      "bun",
      str(APP / "scripts/capture-heesestrasse-predecessor-v328.ts"),
      *map(str, paths.values()),
    ],
    cwd=APP,
    check=True,
    capture_output=True,
    text=True,
  )
  proof = json.loads(capture.stdout)
  plans, audit = {}, {}
  for mode, path in paths.items():
    plan, info = compile_mode(source, read(path), mode, proof[mode])
    plans[f"{mode}:{ID}"] = plan
    audit[mode] = info
  write(args.output, {"schemaVersion": 1, "keys": list(plans), "packets": plans})
  if args.audit:
    write(args.audit, audit)
  print(
    json.dumps(
      {m: {k: v for k, v in o.items() if k != "owners"} for m, o in audit.items()},
      indent=2,
    )
  )


if __name__ == "__main__":
  main()
