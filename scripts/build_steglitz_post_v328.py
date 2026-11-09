"""Rebuild the complete source-bound Alte Post for the two existing quarter modes."""

from __future__ import annotations

import argparse
import base64
import json
import math
import subprocess
from collections import Counter
from pathlib import Path

import build_schlossstrasse_v327 as previous
import numpy as np
from build_bebelplatz_building_source import extract_parent
from build_public_institutions_v326 import (
  complete_part,
  merged_cell_faces,
  part_footprint,
  source_triangles,
)
from build_rixdorf_v304 import fingerprint, read, write
from build_surrounding_outlines import (
  COLORS,
  GROUND_Y,
  PackedMesh,
  building_footprint,
  chunk_payload,
  world,
)
from pyogrio import read_dataframe
from shapely import constrained_delaunay_triangles, make_valid
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

OWNER = "DEBE06YYB00008wL"
TOWER = "DEBE3DrjGW3j3kjy"
PACKET = "ring182--7_13"
KIND = "steglitz-post-v328"
OFFSET = 3 - 9.193
COPPER_EAVE = 31.55
POST_PEAK = 47.055 + OFFSET
BRICK = 0x9A5246
BRICK_REAR = 0x884839
STONE = 0xB6A788
STONE_DARK = 0x958772
TILE = 0x803E33
COPPER = 0x77A39D
GLASS = 0x344A51
SASH = 0xCBC5AC
DOOR = 0x263F43
SHAS = {
  "drawn": "9c557b4f8247ce5a5c058585d1e4f4779e5060498b98af0364b6ff1d40e84860",
  "minecraft": "e2ca22348a6a74e1d9212ae6375420ef4c2eb43d8ab7faf380c6ab29ba5d5792",
}
REFS = [
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065480",
  "https://www.notenkind.de/anfahrt.html",
  "https://commons.wikimedia.org/wiki/File:120922-Steglitz-Bergstra%C3%9Fe-1.JPG",
  "https://commons.wikimedia.org/wiki/File:160410-Steglitz-Postamt_Bergstra%C3%9Fe.JPG",
  "https://commons.wikimedia.org/wiki/File:120922-Steglitz-Postamt_Bergstr._1_von_hinten.JPG",
]


def original(owner_record, raw, native):
  """Replay the complete original building, including both Drawn polygons."""
  if not native:
    return original_drawn(raw, owner_record["geometry"])
  ox, _, oz = raw["origin"]
  ground = unary_union([previous.from_nav(r, ox, oz) for r in raw["nav"]["ground"]])
  replay = chunk_payload(
    PACKET,
    box(ox, oz, ox + 512, oz + 512),
    ground,
    [owner_record],
    {},
    minecraft=native,
  )
  old = [b for b in raw["nav"]["buildings"] if b["sourceId"] == OWNER]
  check = replay["nav"]["buildings"]
  assert len(old) == len(check) == (1 if native else 2)
  for actual, expected in zip(old, check, strict=True):
    assert (
      actual["height"] == expected["height"]
      and actual["minHeight"] == expected["minHeight"]
    )
    assert (
      previous.from_nav(actual, ox, oz)
      .symmetric_difference(previous.from_nav(expected, ox, oz))
      .area
      < 1e-8
    )
  colors = {
    np.asarray(c, dtype="<u2").tobytes()
    for c in previous._linear([COLORS["roof"], COLORS["building"]])
  }
  faces = [r for r in previous.packed_rows(replay["meshes"][0]) if r[6:12] in colors]
  retire = previous.select_exact(faces, previous.packed_rows(raw["meshes"][0]))
  ink = (
    []
    if native
    else previous.select_exact(
      previous.packed_rows(replay["lines"], ink=True),
      previous.packed_rows(raw["lines"], ink=True),
    )
  )
  return retire, ink, old


def original_drawn(raw, original_footprint):
  """Prove every actual quantized wall, roof and ink piece from its complete owner nav.

  Drawn has three coincident boundary edges and three collapsed centimetre
  segments. Replaying GEOS on the unrounded source changes the tessellation
  near those seams. Bind exact packet words after proving wall/ink
  multiplicity and complete disjoint roof coverage instead.
  """
  ox, _, oz = raw["origin"]
  old = [row for row in raw["nav"]["buildings"] if row["sourceId"] == OWNER]
  assert len(old) == 2 and all(
    r["height"] == 38.16 and r["minHeight"] == 0 for r in old
  )
  domain = unary_union([make_valid(previous.from_nav(r, ox, oz)) for r in old])
  assert domain.symmetric_difference(original_footprint).area < 0.75
  for row in raw["nav"]["buildings"]:
    if row["sourceId"] == OWNER or row["height"] != 38.16 or row["minHeight"] != 0:
      continue
    outside = make_valid(previous.from_nav(row, ox, oz))
    assert outside.intersection(domain).area < 1e-8
    assert outside.boundary.intersection(domain.boundary).length < 1e-8

  rings = [
    [(round(x * 100), round(z * 100)) for x, z in ring]
    for row in old
    for ring in (row["ring"], *row["holes"])
  ]
  assert all(r[0] == r[-1] for r in rings)
  expected = Counter(
    tuple(sorted((a, b))) for ring in rings for a, b in zip(ring, ring[1:])
  )
  vertices = {p for ring in rings for p in ring}
  part = raw["meshes"][0]
  pos = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
  rgb = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
  wall, roof, ink = previous._linear(
    [COLORS["building"], COLORS["roof"], COLORS["ink"]]
  )
  hits, wall_counts, sheets = [], Counter(), []
  for i, indices_at in enumerate(indices):
    pts = [tuple(map(int, p)) for p in pos[indices_at]]
    xz = tuple(sorted({(x, z) for x, _, z in pts}))
    ys = {y for _, y, _ in pts}
    if not set(xz) <= vertices:
      continue
    if ys == {1300, 5116} and len(xz) == 2 and np.all(rgb[indices_at] == wall):
      wall_counts[xz] += 1
    elif ys == {5116} and len(xz) == 3 and np.all(rgb[indices_at] == roof):
      sheets.append(Polygon([(x / 100 + ox, z / 100 + oz) for x, z in xz]))
    else:
      continue
    hits.append(i)
  assert wall_counts == Counter({e: 2 * n for e, n in expected.items() if e[0] != e[1]})
  assert abs(sum(p.area for p in sheets) - domain.area) < 1e-8
  assert unary_union(sheets).symmetric_difference(domain).area < 1e-8

  raw_ink = raw["lines"]
  lp = np.frombuffer(base64.b64decode(raw_ink["positions"]), "<u2").reshape(-1, 2, 3)
  lc = np.frombuffer(base64.b64decode(raw_ink["colors"]), "u1").reshape(-1, 2, 3)
  ink_hits, counts = [], Counter()
  for i, (line, color) in enumerate(zip(lp, lc, strict=True)):
    edge = tuple(sorted((int(x), int(z)) for x, _, z in line))
    if set(edge) <= vertices and np.all(line[:, 1] == 5118) and np.all(color == ink):
      counts[edge] += 1
      ink_hits.append(i)
  assert counts == expected
  return hits, ink_hits, old


def photo_roof(footprint):
  """The photo's bell, lantern and cap within the measured tower plan and peak."""
  plan = orient(footprint, sign=1)
  centre = plan.centroid.coords[0]
  rim = list(plan.exterior.coords)[:-1]
  levels = (
    (COPPER_EAVE, 1),
    (32.5, 1),
    (34.35, 0.84),
    (35.5, 0.56),
    (35.8, 0.57),
    (37.15, 0.57),
    (37.4, 0.49),
    (38.35, 0.33),
    (39.8, 0.33),
    (40.35, 0.20),
    (POST_PEAK, 0.045),
  )
  rings = [
    [
      (centre[0] + (x - centre[0]) * r, y, centre[1] + (z - centre[1]) * r)
      for x, z in rim
    ]
    for y, r in levels
  ]
  for level, (low, high) in enumerate(zip(rings, rings[1:])):
    for i, p in enumerate(low):
      j = (i + 1) % len(low)
      color = (0x73918D, 0x84ADA4, 0x6F9691, 0x577D78)[i % 4]
      if level in (4, 8) and i % 2 == 0:
        color = 0x263D3D
      yield [p, high[i], high[j]], color
      yield [p, high[j], low[j]], color
  final = rings[-1]
  for i in range(1, len(final) - 1):
    yield [final[0], final[i + 1], final[i]], COPPER


class Wall:
  """Clip photo-inferred relief to the original wall plane, including holes."""

  def __init__(self, surface, footprint):
    pts = surface["rings"][0]
    p, q = max(
      ((a, b) for i, a in enumerate(pts) for b in pts[:i]),
      key=lambda ab: math.hypot(ab[0][0] - ab[1][0], ab[0][2] - ab[1][2]),
    )
    length = math.hypot(q[0] - p[0], q[2] - p[2])
    if length < 0.05:
      raise ValueError("No wall direction")
    dx, dz = (q[0] - p[0]) / length, (q[2] - p[2]) / length
    x, z = (p[0] + q[0]) / 2, (p[2] + q[2]) / 2
    if footprint.covers(Point(x + dz * 0.08, z - dx * 0.08)):
      p, q, dx, dz = q, p, -dx, -dz
    self.x, self.z, self.dx, self.dz, self.length = p[0], p[2], dx, dz, length
    self.domain = Polygon(
      [self.project(a) for a in pts],
      [[self.project(a) for a in r] for r in surface["rings"][1:]],
    )
    if not self.domain.is_valid:
      self.domain = self.domain.buffer(0)
    self.outside = Point(x + dz * 0.15, z - dx * 0.15)
    self.centre = (x, z)

  def project(self, p):
    return ((p[0] - self.x) * self.dx + (p[2] - self.z) * self.dz, p[1] + OFFSET)

  def paint(self, mesh, profile, color, offset=0.035):
    clipped = self.domain.intersection(profile)
    for item in constrained_delaunay_triangles(clipped).geoms:
      if item.area < 0.002:
        continue
      # Polygon order is chosen for the outward normal (+dz, 0, -dx).
      tri = orient(item, sign=-1)
      mesh.triangle(
        [
          (
            self.x + self.dx * u + self.dz * offset,
            y,
            self.z + self.dz * u - self.dx * offset,
          )
          for u, y in list(tri.exterior.coords)[:3]
        ],
        previous.rgb(color),
      )

  def stripe(self, mesh, left, right, low, high, color, offset=0.05):
    self.paint(mesh, box(left, low, right, high), color, offset)


def arch(u, bottom, shoulder, width, rise, pointed):
  """Gothic opening outline, with a faceted arch in the small viewer scale."""
  r = width / 2
  if pointed:
    crown = [
      (u - r, shoulder),
      (u - r * 0.69, shoulder + rise * 0.43),
      (u, shoulder + rise),
      (u + r * 0.69, shoulder + rise * 0.43),
      (u + r, shoulder),
    ]
  else:
    crown = [
      (u + r * math.cos(a), shoulder + rise * math.sin(a))
      for a in np.linspace(math.pi, 0, 5)
    ]
  return Polygon([(u - r, bottom), *crown, (u + r, bottom)])


def opening(mesh, wall, u, y, w, h, *, tall=False, door=False):
  rise = w * (0.55 if tall or door else 0.31)
  spring = y + h - rise
  wall.paint(
    mesh, arch(u, y - 0.11, spring, w + 0.24, rise + 0.12, tall or door), STONE, 0.082
  )
  wall.paint(
    mesh, arch(u, y, spring, w, rise, tall or door), DOOR if door else GLASS, 0.105
  )
  trim = SASH if not door else 0x57716E
  wall.stripe(mesh, u - 0.035, u + 0.035, y + 0.025, spring + 0.06, trim, 0.123)
  for k in (0.36, 0.69) if door else (0.58,):
    at = y + (spring - y) * k
    wall.stripe(mesh, u - w * 0.46, u + w * 0.46, at - 0.028, at + 0.028, trim, 0.123)
  if not door:
    wall.stripe(
      mesh, u - w * 0.62, u + w * 0.62, y - 0.14, y - 0.015, STONE_DARK, 0.117
    )


def street_wall(mesh, wall, part, portal):
  length = wall.length
  x, z = wall.centre
  if part == TOWER and (z < 6722.55 or x > -3191.1) and length >= 1.8:
    for u in (0.18, length - 0.18):
      wall.stripe(mesh, u - 0.125, u + 0.125, 3.2, COPPER_EAVE, STONE, 0.11)
    for y in (10.1, 15.2, 20.2):
      opening(mesh, wall, length / 2, y, min(1.12, length * 0.43), 2.75)
    if x > -3192.5 and z < 6722.5:
      opening(
        mesh,
        wall,
        length / 2,
        3.05,
        min(2.03, length * 0.68),
        5.3,
        tall=True,
        door=True,
      )
    elif length > 2.8:
      wall.stripe(mesh, length * 0.17, length * 0.83, 3.06, 5.1, STONE_DARK)
    if length > 2.7:
      u = length / 2
      wall.paint(
        mesh, arch(u, 23.0, 28.55, length * 0.83, 2.28, True), STONE_DARK, 0.067
      )
      for du in (-0.24, 0, 0.24):
        opening(mesh, wall, u + du * length, 23.3, length * 0.16, 5.75, tall=True)
      rosette = Point(u, 28.95).buffer(length * 0.214, quad_segs=5)
      wall.paint(mesh, rosette, STONE, 0.13)
      wall.paint(mesh, Point(u, 28.95).buffer(length * 0.163, quad_segs=5), DOOR, 0.145)
      for angle in np.linspace(0, 2 * math.pi, 8, endpoint=False):
        end = (
          u + math.cos(angle) * length * 0.16,
          28.95 + math.sin(angle) * length * 0.16,
        )
        wall.paint(mesh, LineString([(u, 28.95), end]).buffer(0.036), STONE, 0.16)
    return
  street = z < 6731.75 or x > -3194.2 and z < 6777 or x < -3233 and z < 6754
  if length < 4 or not street:
    return
  count = max(2, round(length / 3.3))
  for u in [length * (i + 0.5) / count for i in range(count)]:
    for i, y in enumerate((5.15, 10.1, 14.7, 19.5, 23.3)):
      if (
        i == 0
        and part == "DEBE3Dgt1HhHu9sF"
        and abs(wall.x + wall.dx * u - portal[0]) < 1.7
      ):
        opening(mesh, wall, u, 3.05, 1.75, 4.65, tall=True, door=True)
      else:
        opening(
          mesh,
          wall,
          u,
          y,
          min(1.55, length / count * 0.55),
          3.0 if i < 4 else 2.45,
          tall=i == 3,
        )
  for y in (8.8, 18.25, 22.64):
    wall.stripe(mesh, 0.02, length - 0.02, y - 0.07, y + 0.10, STONE, 0.08)


def drawn(mesh, family):
  footprint = shape(family["footprint"])
  nav = []
  for part in family["parts"]:
    support = part_footprint(part)
    roof = []
    for surface in part["surfaces"]:
      kind = surface["kind"]
      if kind == "GroundSurface" or part["id"] == TOWER and kind == "RoofSurface":
        continue
      if kind == "RoofSurface":
        for triangle in source_triangles(surface, OFFSET):
          roof.append(triangle)
          mesh.triangle(
            triangle,
            previous.rgb(TILE if part["id"] != "DEBE3DCOxAg40flN" else 0x696863),
          )
        continue
      try:
        wall = Wall(surface, support)
      except ValueError:
        continue
      if part["id"] == TOWER:
        wall.domain = wall.domain.intersection(box(-100, 3, 100, COPPER_EAVE))
      if wall.domain.is_empty:
        continue
      if part["id"] == TOWER:
        wall.paint(mesh, wall.domain, BRICK, 0)
      else:
        for triangle in source_triangles(surface, OFFSET):
          mesh.triangle(
            triangle,
            previous.rgb(
              BRICK if wall.outside.distance(footprint.boundary) < 0.18 else BRICK_REAR
            ),
          )
      if not footprint.covers(wall.outside):
        wall.stripe(mesh, -0.01, wall.length + 0.01, 3.02, 8.45, STONE_DARK, 0.026)
      street_wall(mesh, wall, part["id"], (-3207.275, 6720.764))
    if part["id"] == TOWER:
      for triangle, color in photo_roof(support):
        roof.append(triangle)
        mesh.triangle(triangle, previous.rgb(color))
    assert roof, part["id"]
    nav.extend(
      previous.cap_nav(
        support,
        GROUND_Y,
        max(p[1] for t in roof for p in t),
        f"steglitz-post-v328-{part['id']}",
        mesh.origin_x,
        mesh.origin_z,
        roof,
      )
    )
  return nav


def native(mesh, family, support, other):
  footprint = shape(family["footprint"])
  roofs = []
  tower = next(part_footprint(p) for p in family["parts"] if p["id"] == TOWER)
  for part in family["parts"]:
    roofs.extend(
      [t for t, _ in photo_roof(tower)]
      if part["id"] == TOWER
      else previous.surface_roofs(part, OFFSET)
    )
  x0, z0, x1, z1 = footprint.bounds
  cells, columns = {}, {}
  for x in range(math.floor(x0), math.ceil(x1)):
    for z in range(math.floor(z0), math.ceil(z1)):
      square = box(x, z, x + 1, z + 1)
      mid = square.centroid
      if (
        not support.covers(square)
        or not footprint.covers(square)
        or other.intersection(square).area > 1e-7
      ):
        continue
      roof = previous.sample_roof(roofs, mid.x, mid.y)
      if not math.isfinite(roof):
        continue
      high = math.floor(roof + 0.001)
      if high <= 3:
        continue
      turret = tower.covers(mid)
      north = z < 6731
      face = x > -3195 or north
      on_bay = (x if north else z) % 4 == 1
      for y in range(3, high):
        color = STONE_DARK if y < 8 else BRICK
        if turret and y >= 31:
          color = COPPER if y not in (36, 39) else 0x547871
        elif turret and y >= 22:
          color = STONE if (x + z) % 3 == 1 or y in (22, 28, 30) else DOOR
        elif turret and y in (4, 5, 6, 11, 12, 16, 17, 21):
          color = (
            DOOR if (x == -3192 and z <= 6722 or x == -3195 or z == 6724) else color
          )
        elif face and on_bay and y in (5, 6, 10, 11, 14, 15, 19, 20, 23, 24):
          color = GLASS
        elif face and y in (8, 18, 22):
          color = STONE
        cells[x, y, z] = previous.rgb(color)
      columns.setdefault(high, []).append(square)
  for tri, color in merged_cell_faces(cells, 1):
    if all(p[1] == tri[0][1] for p in tri):
      x, y, z = (sum(p[i] for p in tri) / 3 for i in range(3))
      color = previous.rgb(COPPER if y > 31 and tower.covers(Point(x, z)) else TILE)
    mesh.triangle(tri, color)
  nav = []
  for high, squares in sorted(columns.items()):
    nav.extend(
      previous.cap_nav(
        unary_union(squares),
        3,
        high,
        f"steglitz-post-v328-blocks-{high}",
        mesh.origin_x,
        mesh.origin_z,
      )
    )
  assert nav and cells
  return nav


def compile_packets():
  if previous.sha(previous.SOURCE) != previous.SHA:
    raise ValueError("Changed official LoD2 ZIP")
  parent = extract_parent(previous.SOURCE, OWNER)
  parts = [complete_part(p) for p in leaf_building_parts(parent)]
  assert len(parts) == len({p["id"] for p in parts}) == 14
  assert {p["groundY"] for p in parts} == {9.193}
  family = {
    "id": OWNER,
    "footprint": mapping(world(building_footprint(parent))),
    "parts": parts,
  }
  resolved = read_dataframe(
    previous.GEO / "raw/ring-v182/resolved-outlines.gpkg",
    layer="buildings",
    where=f"sourceId='{OWNER}'",
  )
  assert len(resolved) == 1
  old_owner = dict(resolved.iloc[0])
  assert old_owner["height"] == 38.16 and old_owner["minHeight"] == 0
  paths = {mode: previous.PUBLIC / f"{PACKET}.{mode}.json.gz" for mode in SHAS}
  for mode, path in paths.items():
    assert previous.sha(path) == SHAS[mode]
  predecessor = json.loads(
    subprocess.run(
      [
        "bun",
        str(previous.APP / "scripts/capture-steglitz-post-predecessors-v328.ts"),
        *map(str, paths.values()),
      ],
      cwd=previous.APP,
      capture_output=True,
      text=True,
      check=True,
    ).stdout
  )
  plans, proof = {}, {}
  for mode, path in paths.items():
    is_native = mode == "minecraft"
    raw = read(path)
    p = predecessor[path.name]
    prepared = p.pop("prepared")
    kinds = p.pop("kinds")
    assert kinds == ["network-fidelity-v326", "cluster-facades-v320"]
    assert prepared["meshes"][0] == raw["meshes"][0] and prepared.get(
      "lines"
    ) == raw.get("lines")
    retire, ink, old = original(old_owner, raw, is_native)
    assert all(n in prepared["nav"]["buildings"] for n in old)
    ox, _, oz = raw["origin"]
    mesh = PackedMesh(ox, oz)
    if is_native:
      support = previous.from_nav(old[0], ox, oz)
      other = unary_union(
        [previous.from_nav(r, ox, oz) for r in raw["nav"]["buildings"] if r not in old]
      )
      new = native(mesh, family, support, other)
    else:
      new = drawn(mesh, family)
    append = mesh.payload(KIND)
    key = f"{mode}:{PACKET}"
    size = len(mesh.vertices) * 12 + len(mesh.indices) * 4
    if size > 130 * 1024:
      raise ValueError(f"Post exceeds finite additions budget: {mode}: {size}")
    plans[key] = {
      "origin": raw["origin"],
      "records": previous.records(raw),
      "preparedRecords": previous.records(prepared),
      **p,
      "append": append,
      "appendFingerprint": fingerprint(append),
      "owners": [OWNER],
      "retire": [{"mesh": 0, "triangles": retire}],
      "retireLines": ink,
      "retireNav": old,
      "appendNav": new,
    }
    proof[key] = {
      "oldPacketSha256": SHAS[mode],
      "predecessors": kinds,
      "retiredFaces": len(retire),
      "retiredInk": len(ink),
      "newTriangles": len(mesh.indices) // 3,
      "newNav": len(new),
      "maxGpuBytes": size,
    }
  return {"schemaVersion": 1, "keys": list(plans), "packets": plans}, {
    "schemaVersion": 1,
    "archive": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_386_5813.zip",
    "archiveSha256": previous.SHA,
    "family": family,
    "referenceUrls": REFS,
    "groundOffset": OFFSET,
    "measuredPeak": POST_PEAK,
    "roofProfile": "Photographic bell and lantern, constrained to measured plan and peak",
    "musicSchool": {
      "operator": "Notenkind",
      "address": "Bergstraße 1",
      "osmNode": 5393857519,
    },
    "proof": proof,
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--output",
    type=Path,
    default=previous.APP / "src/data/steglitzPostV328Packets.json",
  )
  parser.add_argument(
    "--evidence", type=Path, default=previous.GEO / "steglitz-post-v328-source.json.gz"
  )
  args = parser.parse_args()
  if any(
    path.resolve().is_relative_to(previous.PUBLIC.resolve())
    for path in (args.output, args.evidence)
  ):
    raise ValueError("The original packet directory is read-only")
  plans, evidence = compile_packets()
  write(args.output, plans)
  write(args.evidence, evidence)
  print(json.dumps(evidence["proof"], indent=2))
