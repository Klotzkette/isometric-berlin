"""Step 10: complete Moabit church sources and explicitly evidenced upper forms."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_koepenicker_landmarks_v268 import frame
from build_surrounding_outlines import PackedMesh
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import split, unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
BASE = ROOT / "src/app/public/mesh/regierungsviertel"
OUT = ROOT / "src/app/src/data"
CELL = 0.5
BRICK, DARK, GREEN, STONE, GLASS, COPPER, ROOF = (
  (161, 79, 58),
  (61, 49, 42),
  (65, 89, 72),
  (205, 192, 161),
  (69, 88, 94),
  (75, 85, 79),
  (120, 68, 54),
)
SITES = [
  dict(
    key="paulus",
    name="Sankt Paulus",
    owner="DEBE01YYK0002JYD",
    prism="06483932",
    osm="way/106483932",
    tile="387_5821",
    height=45,
  ),
  dict(
    key="heiland",
    name="Heilandskirche",
    owner="DEBE01YYK0002JYQ",
    prism="37533771",
    osm="way/37533771",
    tile="387_5820",
    height=87,
  ),
]


def digest(path: Path) -> str:
  """Hash an immutable input without copying its archive."""
  with path.open("rb") as f:
    return hashlib.file_digest(f, "sha256").hexdigest()


def write(path: Path, value: Any) -> None:
  """Write one small deterministic new artifact."""
  raw = (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def polygons(poly: Any) -> list:
  """Keep all polygon components and their holes."""
  return [
    p
    for p in getattr(poly, "geoms", [poly])
    if p.geom_type == "Polygon" and p.area > 0.000001
  ]


def polygon_record(poly: Polygon) -> dict:
  """World-coordinate footprints for the required core navigation."""
  return dict(
    ring=[list(p) for p in list(poly.exterior.coords)[:-1]],
    holes=[[list(p) for p in list(h.coords)[:-1]] for h in poly.interiors],
  )


class Church:
  """One complete source shell, separate cardinal reading and clipped fittings."""

  def __init__(self, spec: dict, parts: list, ground: float) -> None:
    self.spec, self.parts, self.ground = spec, parts, ground
    self.footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
    x0, z0, _, _ = self.footprint.bounds
    self.origin = [math.floor(x0) - 2, -10, math.floor(z0) - 2]
    self.drawn, self.native = (
      PackedMesh(self.origin[0], self.origin[2]),
      PackedMesh(self.origin[0], self.origin[2]),
    )
    self.roofs, self.walls, self.additions = [], [], []
    self.roles = Counter()
    for p in parts:
      for s in p["surfaces"]:
        ts = triangles_for(s["rings"])
        if s["kind"] == "RoofSurface":
          self.roofs.extend(ts)
        else:
          self.walls.append(s)
        for t in ts:
          self.triangle(t, ROOF if s["kind"] == "RoofSurface" else BRICK)
    self.source_triangles = len(self.drawn.indices) // 3

  def triangle(self, t: list, colour: tuple) -> None:
    """Keep source vertices; directional colour makes the complete form legible."""
    q = np.array(t)
    n = np.cross(q[1] - q[0], q[2] - q[0])
    length = np.linalg.norm(n)
    shade = 0.90 + 0.10 * abs(n[1]) / length if length else 1
    self.drawn.triangle(t, tuple(round(c * shade) for c in colour))

  def face(self, q: list, colour: tuple, roof: bool = False) -> None:
    """Add an explicitly estimated planar sheet and matching top surface."""
    ts = triangles_for([q])
    for t in ts:
      self.triangle(t, colour)
    if roof:
      self.roofs.extend(ts)
    else:
      self.walls.append(dict(kind="WallSurface", rings=[q], estimated=True))
    self.additions.append(dict(rings=[q], roof=roof, colour=colour))

  def loft(
    self, ring: list, low: float, high: float, top_scale: float, colour: tuple
  ) -> None:
    """Source-bound tower shaft or pyramidal/octagonal roof with no rotated native copy."""
    c = Polygon(ring).centroid
    upper = [
      [c.x + (x - c.x) * top_scale, c.y + (z - c.y) * top_scale] for x, z in ring
    ]
    for i, a in enumerate(ring):
      b = ring[(i + 1) % len(ring)]
      u = upper[i]
      v = upper[(i + 1) % len(ring)]
      self.face(
        [[a[0], low, a[1]], [b[0], low, b[1]], [v[0], high, v[1]], [u[0], high, u[1]]],
        colour,
        top_scale < 1,
      )
    if top_scale == 1:
      for t in triangles_for([[[x, high, z] for x, z in upper]]):
        self.triangle(t, colour)
        self.roofs.append(t)

  def gabled_nave(self, part: dict) -> None:
    """Photographically certain nave roof; 15/28m eave/ridge heights are estimates."""
    poly = Polygon(part["ring"], part["holes"])
    centre = np.array([-2123.4, -845.5])
    d = np.array([0.992, 0.126])
    d /= np.linalg.norm(d)
    normal = np.array([-d[1], d[0]])

    def y(x: float, z: float) -> float:
      return (
        self.ground
        + 15
        + 13 * max(0, 1 - abs((np.array([x, z]) - centre) @ normal) / 15.4)
      )

    line = LineString([centre - d * 100, centre + d * 100])
    for p in polygons(split(poly, line)):
      for tri in shapely.constrained_delaunay_triangles(p).geoms:
        self.face(
          [[x, y(x, z), z] for x, z in list(tri.exterior.coords)[:3]], ROOF, True
        )
    for ring in [poly.exterior, *poly.interiors]:
      r = list(ring.coords)[:-1]
      for a, b in zip(r, r[1:] + r[:1]):
        self.face(
          [
            [a[0], part["top_y_m"], a[1]],
            [b[0], part["top_y_m"], b[1]],
            [b[0], y(*b), b[1]],
            [a[0], y(*a), a[1]],
          ],
          BRICK,
        )

  def raster(self) -> None:
    """Independent world-aligned 0.5m columns sampled from every complete roof."""
    x0, z0, x1, z1 = self.footprint.bounds
    keys = np.array(
      [
        (ix, iz)
        for iz in range(math.floor(z0 / CELL), math.ceil(z1 / CELL))
        for ix in range(math.floor(x0 / CELL), math.ceil(x1 / CELL))
      ],
      dtype=int,
    )
    xs, zs = (keys[:, 0] + 0.5) * CELL, (keys[:, 1] + 0.5) * CELL
    mask = shapely.contains_xy(self.footprint, xs, zs)
    keys = keys[mask]
    xs = xs[mask]
    zs = zs[mask]
    heights = np.full(len(keys), -np.inf)
    for a, b, c in self.roofs:
      den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
      if abs(den) < 1e-8:
        continue
      u = ((b[2] - c[2]) * (xs - c[0]) + (c[0] - b[0]) * (zs - c[2])) / den
      v = ((c[2] - a[2]) * (xs - c[0]) + (a[0] - c[0]) * (zs - c[2])) / den
      h = u * a[1] + v * b[1] + (1 - u - v) * c[1]
      inside = (u >= -1e-6) & (v >= -1e-6) & (u + v <= 1.000001)
      heights[inside] = np.maximum(heights[inside], h[inside])
    assert np.isfinite(heights).all()
    self.cells = {
      tuple(k): min(
        self.ground + self.spec["height"], math.ceil(float(y) / CELL) * CELL
      )
      for k, y in zip(keys, heights, strict=True)
    }
    tops = defaultdict(list)
    for (ix, iz), top in self.cells.items():
      tops[top].append(box(ix * CELL, iz * CELL, (ix + 1) * CELL, (iz + 1) * CELL))
    for top, areas in tops.items():
      self.native.surface(
        unary_union(areas), top, COPPER if top > self.ground + 32 else ROOF
      )
    self.native_footprint = unary_union([p for a in tops.values() for p in a])
    strips = defaultdict(list)
    for (ix, iz), top in self.cells.items():
      for dx, dz in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
        low = self.cells.get((ix + dx, iz + dz), self.ground)
        if top <= low:
          continue
        axis = 0 if dx else 2
        fixed = (ix + (dx > 0)) * CELL if dx else (iz + (dz > 0)) * CELL
        strips[(axis, fixed, low, top, dx + dz)].append(iz if dx else ix)
    for (axis, fixed, low, top, sign), values in strips.items():
      values.sort()
      start = end = values[0]
      for val in [*values[1:], None]:
        if val is not None and val == end + 1:
          end = val
          continue
        a, b = start * CELL, (end + 1) * CELL
        q = (
          [[fixed, low, a], [fixed, top, a], [fixed, top, b], [fixed, low, b]]
          if axis == 0
          else [[a, low, fixed], [b, low, fixed], [b, top, fixed], [a, top, fixed]]
        )
        colour = (
          COPPER
          if low > self.ground + (48 if self.spec["key"] == "heiland" else 32)
          else BRICK
        )
        self.native.triangle(q[:3], colour)
        self.native.triangle([q[0], q[2], q[3]], colour)
        start = end = val
    self.native_shell = len(self.native.indices) // 3

  def fitting(
    self,
    surface: dict,
    shape: Any,
    colour: tuple,
    role: str,
    depth: float = 0.055,
    normal: Any = None,
  ) -> None:
    """Clipped drawn paint and matching actual cardinal native wall planes."""
    a, d, n, poly, length = frame(surface)
    if normal is not None:
      n = np.array(normal)
    elif self.footprint.covers(
      Point(*(a[[0, 2]] + d[[0, 2]] * length / 2 + n[[0, 2]] * 0.18))
    ):
      n = -n
    panel = poly.intersection(box(*shape) if isinstance(shape, list) else shape)
    if panel.is_empty or panel.area < 0.0001:
      return
    for p in polygons(panel):
      rings = [list(p.exterior.coords)[:-1]] + [
        list(h.coords)[:-1] for h in p.interiors
      ]
      world = [
        [
          [
            float(a[0] + d[0] * u + n[0] * depth),
            y,
            float(a[2] + d[2] * u + n[2] * depth),
          ]
          for u, y in r
        ]
        for r in rings
      ]
      for t in triangles_for(world):
        self.drawn.triangle(t, colour)
    axis = 2 if abs(n[2]) >= abs(n[0]) else 0
    other = 0 if axis == 2 else 2
    u0, y0, u1, y1 = panel.bounds
    p0, p1 = a + d * u0, a + d * u1
    lo, hi = sorted([p0[other], p1[other]])
    for step in range(math.floor(lo / CELL), math.ceil(hi / CELL)):
      along = (step + 0.5) * CELL
      u = (along - a[other]) / d[other]
      if not u0 - 0.001 <= u <= u1 + 0.001:
        continue
      line = panel.intersection(LineString([(u, y0), (u, y1)]))
      if line.is_empty:
        continue
      pos = a + d * u
      candidates = []
      for off in range(-2, 3):
        ix, iz = (
          (step, math.floor(pos[2] / CELL) + off)
          if axis == 2
          else (math.floor(pos[0] / CELL) + off, step)
        )
        top = self.cells.get((ix, iz))
        if top is not None and top >= y0:
          boundary = (iz + (n[2] > 0)) * CELL if axis == 2 else (ix + (n[0] > 0)) * CELL
          candidates.append((boundary, top))
      if not candidates:
        continue
      fixed, roof = max(candidates) if n[axis] > 0 else min(candidates)
      fixed += math.copysign(depth + 0.015, n[axis])
      for segment in getattr(line, "geoms", [line]):
        bottom, top = segment.bounds[1], min(segment.bounds[3], roof - 0.015)
        if top <= bottom:
          continue
        left, right = along - CELL / 2 - 0.003, along + CELL / 2 + 0.003
        q = (
          [
            [left, bottom, fixed],
            [right, bottom, fixed],
            [right, top, fixed],
            [left, top, fixed],
          ]
          if axis == 2
          else [
            [fixed, bottom, left],
            [fixed, bottom, right],
            [fixed, top, right],
            [fixed, top, left],
          ]
        )
        self.native.triangle(q[:3], colour)
        self.native.triangle([q[0], q[2], q[3]], colour)
    self.roles[role] += 1

  def lancet(
    self, s: dict, u: float, low: float, high: float, width: float, role: str
  ) -> None:
    """Pointed Gothic opening cue; it does not claim an interior aperture."""
    r = width / 2
    spring = high - r * 1.4
    points = [
      (u - r, low),
      (u + r, low),
      (u + r, spring),
      (u + r * 0.75, spring + r * 0.7),
      (u, high),
      (u - r * 0.75, spring + r * 0.7),
      (u - r, spring),
    ]
    p = Polygon(points)
    self.fitting(s, p.buffer(0.14, join_style="mitre"), STONE, role + " surround", 0.07)
    self.fitting(s, p, GLASS if "window" in role else DARK, role, 0.10)
    for offset in [-width / 6, width / 6] if role == "nave window" else [0]:
      self.fitting(
        s,
        [u + offset - 0.045, low, u + offset + 0.045, high - 0.15],
        BRICK,
        role + " mullion",
        0.13,
      )


def build() -> dict:
  """Only new artifacts: two precise fallback transfers and complete source owners."""
  prism_path = BASE / "lod2-prisms.json"
  voxel_path = BASE / "minecraft-voxels.json"
  prisms = json.loads(prism_path.read_bytes())["buildings"]
  voxel = json.loads(voxel_path.read_bytes())
  cell = voxel["cell_m"]
  all_polys = {
    p["id"]: Polygon(
      [[x / 10, z / 10] for x, z in p["ring"]],
      [[[x / 10, z / 10] for x, z in r] for r in p["holes"]],
    )
    for p in prisms
  }
  runtime = dict(schema=1, sites=[])
  profile = dict(schema=1, cellM=cell, nativeCellM=CELL, sites=[])
  evidence = dict(
    schema=1,
    sites=[],
    inputs={str(p.relative_to(ROOT)): digest(p) for p in [prism_path, voxel_path]},
  )
  for spec in SITES:
    previous = next(p for p in prisms if p["id"] == spec["prism"])
    ground = previous["y0_dm"] / 10
    archive = GEO / f"raw/lod2/LoD2_{spec['tile']}.zip"
    parent = extract_parent(archive, spec["owner"])
    original = [part_profile(p) for p in leaf_building_parts(parent)]
    parts = copy.deepcopy(original)
    source_ground = min(p["ground_y_m"] for p in parts)
    shift = ground - source_ground
    for p in parts:
      p["top_y_m"] += shift
      p["ground_y_m"] += shift
      for s in p["surfaces"]:
        for r in s["rings"]:
          for q in r:
            q[1] += shift
    model = Church(spec, parts, ground)
    if spec["key"] == "paulus":
      tower_ids = ["DEBE3DntGsQjBi5m", "DEBE3Dr3ZmBw6Vk5"]
      base, cap, tip = ground + 26, ground + 33, ground + 44
    else:
      model.gabled_nave(next(p for p in parts if p["id"] == "DEBE3Dyj2wnGoSDN"))
      tower_ids = ["DEBE3DyvAFdwloz7"]
      base, cap, tip = ground + 47, ground + 51, ground + 86
    towers = []
    for tid in tower_ids:
      p = next(p for p in parts if p["id"] == tid)
      ring = p["ring"]
      c = Polygon(ring).centroid
      model.loft(ring, base, cap, 1, BRICK)
      spire_ring = ring
      if spec["key"] == "heiland":
        rectangle = list(Polygon(ring).minimum_rotated_rectangle.exterior.coords)[:-1]
        spire_ring = [
          [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
          for a, b in zip(rectangle, rectangle[1:] + rectangle[:1])
          for t in [0.2, 0.8]
        ]
      model.loft(spire_ring, cap, tip, 0.025, COPPER)
      # Fine cross/finial is cardinal in both modes and reaches published overall height.
      model.loft(
        [
          [c.x - 0.07, c.y - 0.07],
          [c.x + 0.07, c.y - 0.07],
          [c.x + 0.07, c.y + 0.07],
          [c.x - 0.07, c.y + 0.07],
        ],
        tip,
        ground + spec["height"],
        1,
        DARK,
      )
      model.loft(
        [
          [c.x - 0.50, c.y - 0.07],
          [c.x + 0.50, c.y - 0.07],
          [c.x + 0.50, c.y + 0.07],
          [c.x - 0.50, c.y + 0.07],
        ],
        ground + spec["height"] - 0.44,
        ground + spec["height"] - 0.31,
        1,
        DARK,
      )
      towers.append(
        dict(
          partId=tid,
          centre=[c.x, c.y],
          ring=ring,
          baseY=base,
          capY=cap,
          tipY=ground + spec["height"],
        )
      )
    model.raster()
    # Facade fields attach only to true exposed sheets, leaving measured roofs intact.
    used = []
    for i, s in enumerate(model.walls):
      a, d, n, poly, length = frame(s)
      low, high = poly.bounds[1], poly.bounds[3]
      if length < 3 or high - low < 5:
        continue
      center = a + d * length / 2
      outside = [
        not model.footprint.covers(Point(*(center[[0, 2]] + n[[0, 2]] * sign * 0.22)))
        for sign in [1, -1]
      ]
      if not any(outside):
        continue
      used.append(i)
      if low < ground + 5 and high > ground + 10:
        for y in [ground + 0.48, ground + 5.6, high - 0.45]:
          model.fitting(
            s,
            [0, y, length, y + 0.14],
            GREEN if spec["key"] == "paulus" else STONE,
            "masonry belt",
          )
        for y in np.arange(ground + 0.8, min(high - 0.6, ground + 7), 0.42):
          model.fitting(
            s,
            [0, y, length, y + 0.018],
            (187, 132, 108),
            "restrained masonry course",
            0.032,
          )
        if length >= 3:
          count = max(1, round(length / 5.8))
          for j in range(count):
            u = (j + 0.5) * length / count
            # Keep front portal/rose sheets clear for their dedicated composition.
            if spec["key"] == "paulus" and center[2] < -1090 and abs(n[2]) > 0.8:
              continue
            model.lancet(
              s,
              u,
              max(low + 0.5, ground + 4.8),
              min(high - 0.7, ground + 13.5),
              min(2.5, length / count * 0.42),
              "nave window",
            )
      for edge in [0.15, length - 0.15]:
        model.fitting(
          s,
          [edge - 0.09, low + 0.15, edge + 0.09, high - 0.1],
          GREEN if spec["key"] == "paulus" else (186, 109, 77),
          "glazed corner edging",
        )
    # Exact main source front plane at Paulus, spanning two unchanged wall sheets.
    if spec["key"] == "paulus":
      part = next(p for p in parts if p["id"] == "DEBE3DmYYnnX4Xxe")
      front = [
        s
        for s in part["surfaces"]
        if s["kind"] == "WallSurface"
        and frame(s)[4] > 9
        and frame(s)[0][2] < -1090
        and abs(frame(s)[2][2]) > 0.8
      ]
      for s in front:
        _, _, _, _, length = frame(s)
        u = length / 2
        rose = Point(u, ground + 15.4)
        model.fitting(
          s, rose.buffer(3.73, quad_segs=24), GREEN, "rose outer glazed brick", 0.09
        )
        model.fitting(
          s, rose.buffer(3.48, quad_segs=24), STONE, "rose stone field", 0.12
        )
        model.fitting(
          s, rose.buffer(1.35, quad_segs=20), GLASS, "rose central glass", 0.15
        )
        for k in range(8):
          ang = k * math.pi / 4
          p = Point(u + 2.31 * math.cos(ang), ground + 15.4 + 2.31 * math.sin(ang))
          model.fitting(
            s, p.buffer(0.98, quad_segs=12), BRICK, "rose petal brick", 0.15
          )
          model.fitting(
            s, p.buffer(0.82, quad_segs=12), GLASS, "rose eight glass petals", 0.18
          )
        for offset in [-2.8, 0, 2.8]:
          model.lancet(
            s,
            u + offset,
            ground + 0.12,
            ground + (6.3 if offset == 0 else 4.6),
            2 if offset == 0 else 1.5,
            "closed entrance door",
          )
        for offset in [-3.8, -2.4, -1.2, 0, 1.2, 2.4, 3.8]:
          model.lancet(
            s, u + offset, ground + 22, ground + 24.4, 0.65, "gable blind lancet"
          )
    # Belfry openings and the four clock gables follow exact tower wall planes.
    for tower in towers:
      ring = tower["ring"]
      for a, b in zip(ring, ring[1:] + ring[:1]):
        length = math.dist(a, b)
        if length < 1.5:
          continue
        high = tower["capY"]
        low = ground + (20 if spec["key"] == "paulus" else 27)
        s = dict(
          kind="WallSurface",
          rings=[
            [
              [a[0], low, a[1]],
              [b[0], low, b[1]],
              [b[0], high, b[1]],
              [a[0], high, a[1]],
            ]
          ],
        )
        model.lancet(
          s,
          length / 2,
          low + 0.6,
          high - 1.0,
          min(length * 0.58, 2.3),
          "belfry opening",
        )
        for y in np.arange(low + 1, high - 1, 0.55):
          model.fitting(
            s,
            [length * 0.25, y, length * 0.75, y + 0.08],
            BRICK,
            "belfry louvre",
            0.145,
          )
        model.fitting(
          s,
          [0, high - 0.45, length, high - 0.24],
          GREEN if spec["key"] == "paulus" else STONE,
          "tower cornice",
          0.16,
        )
        if spec["key"] == "heiland":
          # Four principal source shaft sides carry clocks and pointed brick gables.
          if length < 5:
            continue
          y = ground + 48.6
          model.fitting(
            s, Point(length / 2, y).buffer(1.4, quad_segs=16), STONE, "clock rim", 0.21
          )
          model.fitting(
            s, Point(length / 2, y).buffer(1.19, quad_segs=16), DARK, "clock face", 0.24
          )
          for k in range(12):
            ang = k * math.pi / 6
            u = length / 2 + math.sin(ang) * 0.98
            v = y + math.cos(ang) * 0.98
            model.fitting(
              s,
              [u - 0.045, v - 0.09, u + 0.045, v + 0.09],
              STONE,
              "clock hour tick",
              0.27,
            )
          model.fitting(
            s,
            [length / 2 - 0.035, y - 0.1, length / 2 + 0.035, y + 0.85],
            STONE,
            "clock hand",
            0.28,
          )
          model.fitting(
            s,
            [length / 2 - 0.72, y - 0.035, length / 2 + 0.1, y + 0.035],
            STONE,
            "clock hand",
            0.28,
          )
    # Minimal independent native finials retain the published highest point.
    for tower in towers:
      x, z = tower["centre"]
      tip = tower["tipY"]
      q = [
        [x - 0.13, tip - 1, z - 0.13],
        [x + 0.13, tip - 1, z - 0.13],
        [x + 0.13, tip, z - 0.13],
        [x - 0.13, tip, z - 0.13],
      ]
      for fixed in [z - 0.13, z + 0.13]:
        r = [[p[0], p[1], fixed] for p in q]
        model.native.triangle(r[:3], DARK)
        model.native.triangle([r[0], r[2], r[3]], DARK)
    oldpoly = all_polys[spec["prism"]]
    near = {
      k: p
      for k, p in all_polys.items()
      if box(*p.bounds).intersects(oldpoly.buffer(cell).envelope)
    }
    columns, controls = [], []
    x0, z0, x1, z1 = oldpoly.bounds
    for zi, runs in enumerate(voxel["building_rows"]):
      iz = voxel["grid"]["min_z_idx"] + zi
      z = (iz + 0.5) * cell
      if not z0 - cell <= z <= z1 + cell:
        continue
      for offset, count, low, high, kind in runs:
        first = voxel["grid"]["min_x_idx"] + offset
        for ix in range(first, first + count):
          x = (ix + 0.5) * cell
          if not x0 - cell <= x <= x1 + cell:
            continue
          square = box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)
          if oldpoly.intersection(square).area < 0.001:
            continue
          foreign = [
            k
            for k, p in near.items()
            if k != spec["prism"] and p.intersection(square).area > 0.001
          ]
          row = [ix, iz, low, high, kind]
          if foreign:
            controls.append(dict(column=row, foreign=foreign))
          else:
            columns.append(row)
    neighbours = [p for p in prisms if p["id"] in near and p["id"] != spec["prism"]]
    roof_triangles = [[[round(float(v), 5) for v in q] for q in t] for t in model.roofs]
    metrics = dict(
      sourceParts=len(original),
      sourceSheets=sum(len(p["surfaces"]) for p in original),
      sourceTriangles=model.source_triangles,
      drawnTriangles=len(model.drawn.indices) // 3,
      nativeTriangles=len(model.native.indices) // 3,
      nativeShellTriangles=model.native_shell,
      nativeCells=len(model.cells),
      roles=dict(model.roles),
    )
    runtime["sites"].append(
      dict(
        key=spec["key"],
        name=spec["name"],
        origin=model.origin,
        drawn=model.drawn.payload("moabit-landmarks-v269"),
        native=model.native.payload("moabit-landmarks-v269"),
      )
    )
    record = dict(
      **spec,
      groundY=ground,
      topY=ground + spec["height"],
      previousPrism=previous,
      columns=columns,
      neighbours=neighbours,
      drawnFootprints=[polygon_record(p) for p in polygons(model.footprint)],
      nativeFootprints=[polygon_record(p) for p in polygons(model.native_footprint)],
      roofTriangles=roof_triangles,
      metrics=metrics,
      towers=towers,
    )
    profile["sites"].append(record)
    evidence["sites"].append(
      dict(
        **spec,
        originalParts=original,
        sourceGroundY=source_ground,
        displayGroundY=ground,
        sourceShiftY=shift,
        previousPrism=previous,
        exclusiveNativeColumns=columns,
        retainedForeignNativeColumns=controls,
        neighbours=neighbours,
        additions=model.additions,
        metrics=metrics,
      )
    )
    evidence["inputs"][str(archive.relative_to(ROOT))] = digest(archive)
  refs = ROOT / "docs/moabit-landmarks-v269-references.json"
  evidence["references"] = json.loads(refs.read_bytes())
  evidence["inputs"][str(refs.relative_to(ROOT))] = digest(refs)
  profile["fullStaticDetailOnTouch"] = True
  profile["independentlyOrthogonalNative"] = True
  evidence["policy"] = (
    "Complete original source sheets remain in the required drawn replacement, with independently sampled full native surface. Only exact original14mOSMprisms and exclusive voxelcolumn tuples yield. Source-bound upper tower forms and Heilands nave restore publicly photographed omissions; small dimensions are estimates. Neighbours, source files, terrain, coverage, budgets and93tourstops stay unchanged."
  )
  evidence["estimates"] = (
    "Published tower totals45m/87m. Tower upper stage heights, copper helm slopes, clock/gable/belfry subdivisions, rose petals, window bays and material hues are photo-based estimates. Heilands source nave is only3.131mhigh; its visible red gabled roof uses estimated15m eave/28m ridge heights above delivered ground, retaining every original low source sheet underneath. No interior or walkable doorway is claimed."
  )
  write(OUT / "moabitLandmarksV269.json", runtime)
  write(OUT / "moabitLandmarksV269Profile.json", profile)
  write(GEO / "moabit-landmarks-v269-evidence.json.gz", evidence)
  print(
    json.dumps(
      dict(
        runtimeBytes=(OUT / "moabitLandmarksV269.json").stat().st_size,
        profileBytes=(OUT / "moabitLandmarksV269Profile.json").stat().st_size,
        sites=[
          dict(key=s["key"], **s["metrics"], columns=len(s["columns"]))
          for s in profile["sites"]
        ],
      ),
      ensure_ascii=False,
    )
  )
  return evidence


if __name__ == "__main__":
  build()
