"""Five exact photographed Oranienburger owners, full source roofs and finite receipts."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import math
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_moabit_landmarks_v269 as shell
import build_west_streets_v163 as streets
import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile, world_ring
from build_breitscheid_towers_v161 import triangles_for
from build_karl_marx_allee_v161 import Detail, native_detail, packed_detail
from build_koepenicker_landmarks_v268 import frame
from build_oranien_corridors_v167 import core_ornament
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import nearest_points, unary_union

from isometric_berlin.data.fetch_lod2 import NS, leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/src/data"
BASE = ROOT / "src/app/public/mesh/regierungsviertel"
PACKETS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
ARCHIVE = GEO / "raw/lod2/LoD2_390_5820.zip"
PHOTOS = Path(
  "/tmp/codex-remote-attachments/01a07905-2d69-7ec1-914c-28ee2c8f6d85/BE1A5685-F95C-4669-8D55-A818AA0B4C49"
)
SITES = [
  dict(
    key="white45",
    name="Oranienburger Straße 45",
    owner="DEBE01YYK00004fg",
    prism="-1403271",
    osm="relation/1403271",
    wall=(221, 216, 197),
    roof=(80, 84, 82),
    bays=8,
    photos=[4, 5, 6, 7],
  ),
  dict(
    key="brick46",
    name="Oranienburger Straße 46–47",
    owner="DEBE01YYK00006o3",
    prism="-1403208",
    osm="relation/1403208",
    wall=(166, 145, 120),
    roof=(83, 84, 79),
    bays=8,
    photos=[5, 6, 7, 8],
  ),
  dict(
    key="yellow48",
    name="Oranienburger Straße 48–49",
    owner="DEBE01YYK0000EXQ",
    prism="97720960",
    osm="way/97720960",
    wall=(221, 213, 170),
    roof=(82, 87, 86),
    bays=6,
    photos=[7, 8],
  ),
  dict(
    key="ochre50",
    name="Oranienburger Straße 50",
    owner="DEBE01YYK00006Ft",
    prism="97720962",
    osm="way/97720962",
    wall=(195, 159, 108),
    roof=(76, 83, 84),
    bays=7,
    photos=[8],
  ),
  dict(
    key="redCorner",
    name="Rotes Eckhaus Oranienburger Straße / Auguststraße",
    owner="DEBE01YYK00002MI",
    prism="97997063",
    osm="way/97997063",
    wall=(173, 102, 94),
    roof=(84, 93, 94),
    bays=8,
    photos=[1, 2, 3],
  ),
]
STONE = (206, 200, 181)
GLASS = (60, 78, 83)
FRAME = (183, 190, 183)
DARK = (64, 66, 62)


def digest(path):
  with path.open("rb") as f:
    return hashlib.file_digest(f, "sha256").hexdigest()


def write(path, value):
  raw = (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def fnv(parts):
  h = 2166136261
  for text in parts:
    for c in text:
      h = ((h ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return h


def arch(u, low, high, width):
  r = width / 2
  spring = high - r
  return Polygon(
    [
      (u - r, low),
      (u + r, low),
      *[
        (u + r * math.cos(a), spring + r * math.sin(a))
        for a in np.linspace(0, math.pi, 13)
      ],
    ]
  )


def railpost(model, x, z, low, high, colour=FRAME):
  """Tiny world-aligned railing post; never a walking roof or hidden building box."""
  ring = [
    (x - 0.035, z - 0.035),
    (x + 0.035, z - 0.035),
    (x + 0.035, z + 0.035),
    (x - 0.035, z + 0.035),
  ]
  for a, b in zip(ring, ring[1:] + ring[:1]):
    q = [[a[0], low, a[1]], [b[0], low, b[1]], [b[0], high, b[1]], [a[0], high, a[1]]]
    for mesh in [model.drawn, model.native]:
      mesh.triangle(q[:3], colour)
      mesh.triangle([q[0], q[2], q[3]], colour)
  model.roles["terrace rail post"] += 1


def merge_detail(model, detail, role):
  """Copy one bounded independent detail into the owner's existing two batches."""
  for destination, source in [
    (model.drawn, detail.drawn),
    (model.native, detail.native),
  ]:
    rows = list(source.vertices)
    remap = [
      destination.vertex(
        (r[0] / 100 + source.origin_x, r[1] / 100 - 10, r[2] / 100 + source.origin_z),
        tuple(r[3:]),
      )
      for r in rows
    ]
    destination.indices.extend(remap[i] for i in source.indices)
  model.detail_solids.append(
    dict(
      role=role,
      minY=detail.ground,
      maxY=detail.ground + detail.spec["height"],
      drawnFootprints=[
        shell.polygon_record(p) for p in shell.polygons(detail.footprint)
      ],
      nativeFootprints=[
        shell.polygon_record(p) for p in shell.polygons(detail.native_footprint)
      ],
    )
  )
  model.roles[role] += 1


def detail_prism(ring, low, high, colour):
  """Source-front/roof attached estimate, independently rastered at native scale."""
  surfaces = []
  for a, b in zip(ring, ring[1:] + ring[:1]):
    surfaces.append(
      dict(
        kind="WallSurface",
        rings=[
          [[a[0], low, a[1]], [b[0], low, b[1]], [b[0], high, b[1]], [a[0], high, a[1]]]
        ],
      )
    )
  surfaces.append(dict(kind="RoofSurface", rings=[[[x, high, z] for x, z in ring]]))
  previous = shell.BRICK, shell.ROOF
  shell.BRICK = colour
  shell.ROOF = colour
  detail = shell.Church(
    dict(key="photo fitting", height=high - low),
    [dict(ring=ring, holes=[], surfaces=surfaces)],
    low,
  )
  detail.raster()
  underside = tuple(round(c * 0.8) for c in colour)
  detail.drawn.surface(detail.footprint, low, underside)
  detail.native.surface(detail.native_footprint, low, underside)
  shell.BRICK, shell.ROOF = previous
  return detail


def irregular_brick(model, surface):
  """Uneven exposed masonry and residual plaster; finite patches, not a facade grid."""
  _, _, _, p, length = frame(surface)
  u0, y0, u1, y1 = p.bounds
  if length < 2:
    return
  seed = int(round(surface["rings"][0][0][0] * 100)) & 0xFFFF
  rng = np.random.default_rng(seed)
  for j in range(max(12, round(length * 6))):
    u = float(rng.uniform(u0, u1))
    y = float(rng.uniform(max(y0, model.ground + 8.4), y1 - 0.3))
    w = float(rng.uniform(0.25, 1.25))
    h = float(rng.uniform(0.16, 0.7))
    points = [
      (u - w, y - h * 0.4),
      (u - w * 0.65, y - h),
      (u + w * 0.3, y - h * 0.7),
      (u + w, y - h * 0.25),
      (u + w * 0.8, y + h * 0.6),
      (u + w * 0.1, y + h),
      (u - w * 0.8, y + h * 0.65),
    ]
    shade = [
      (153, 123, 91),
      (173, 145, 108),
      (194, 169, 132),
      (202, 181, 147),
      (142, 122, 100),
    ][j % 5]
    model.fitting(
      surface,
      Polygon(points),
      shade,
      "irregular exposed brick/remaining plaster",
      0.012,
    )
  # Broken fragments of mortar follow visible brick courses, never continuous
  # repeated rows across a whole front or across its openings.
  for j in range(max(10, round(length * 4))):
    u = float(rng.uniform(u0, u1))
    y = float(rng.uniform(model.ground + 8.4, y1 - 0.4))
    w = float(rng.uniform(0.3, 1.15))
    model.fitting(
      surface,
      [u, y, u + w, y + 0.028],
      (210, 190, 158),
      "discontinuous pale mortar fragment",
      0.018,
    )


def photographed_projections_and_roofs(model, spec):
  """Only the two visible white bays and a few photographed roof fittings."""
  g = model.ground
  if spec["key"] == "white45":
    a = np.array([1235.385, -760.825])
    d = np.array([0.927, 0.375])
    d /= np.linalg.norm(d)
    n = np.array([-d[1], d[0]])
    for u in [2.65, 17.1]:
      ring = [
        (a + d * (u - 1.55) - n * 0.06).tolist(),
        (a + d * (u + 1.55) - n * 0.06).tolist(),
        (a + d * (u + 1.4) + n * 0.82).tolist(),
        (a + d * (u - 1.4) + n * 0.82).tolist(),
      ]
      bay = detail_prism(ring, g + 8.05, g + 16.35, (226, 223, 207))
      for s in bay.walls:
        b, dd, nn, p, length = frame(s)
        if length < 2:
          continue
        c = np.mean(s["rings"][0], axis=0)
        if bay.footprint.covers(Point(*(c[[0, 2]] + nn[[0, 2]] * 0.18))):
          nn = -nn
        if nn[[0, 2]] @ n < 0.7:
          continue
        for y in [g + 10.1, g + 14.2]:
          bay.fitting(
            s,
            [0.24, y - 1.35, length - 0.24, y + 1.35],
            (190, 188, 174),
            "deep bay reveal",
            0.04,
          )
          bay.fitting(
            s,
            [0.38, y - 1.22, length - 0.38, y + 1.22],
            GLASS,
            "triple bay window",
            0.07,
          )
          for uu in [0.38, length / 3, 2 * length / 3, length - 0.38]:
            bay.fitting(
              s,
              [uu - 0.045, y - 1.24, uu + 0.045, y + 1.24],
              FRAME,
              "bay mullion",
              0.12,
            )
          bay.fitting(
            s, [0.3, y + 0.45, length - 0.3, y + 0.54], FRAME, "bay transom", 0.13
          )
          for uu in [0.08, length - 0.23]:
            bay.fitting(
              s,
              [uu, y - 1.55, uu + 0.16, y + 1.5],
              (240, 236, 217),
              "bay side column",
              0.2,
            )
          bay.fitting(
            s,
            [0.0, y - 1.6, length, y - 1.37],
            (239, 234, 215),
            "bay projecting cornice",
            0.28,
          )
        for yy in [g + 8.1, g + 12.3, g + 16.2]:
          bay.fitting(
            s,
            [0, yy - 0.13, length, yy + 0.13],
            (238, 234, 216),
            "bay floor ledge",
            0.27,
          )
      merge_detail(model, bay, "two-storey photo bay")
      # Balcony rail sits over the bay, with real open gaps between balusters.
      front = a + d * u + n * 0.91
      for off in np.linspace(-1.36, 1.36, 10):
        railpost(model, *(front + d * off), g + 16.38, g + 17.18, (238, 234, 218))
      rail = detail_prism(
        [
          (a + d * (u + o) + n * t).tolist()
          for o, t in [(-1.53, 0.75), (1.53, 0.75), (1.53, 1.0), (-1.53, 1.0)]
        ],
        g + 17.15,
        g + 17.3,
        (236, 230, 210),
      )
      merge_detail(model, rail, "upper balcony balustrade rail")
  if spec["key"] not in ("white45", "brick46"):
    return
  from build_roof_house_v233 import roof_height

  fittings = (
    [(1239.5, -769.5, 1.0, 1.1, 1.8), (1248.2, -762.3, 1.1, 1.1, 2.0)]
    if spec["key"] == "white45"
    else [
      (1217.7, -776.5, 1.0, 1.2, 2.3),
      (1225.5, -775.8, 1.1, 0.9, 2.8),
      (1230.0, -773.2, 1.0, 1.0, 2.1),
    ]
  )
  if spec["key"] == "white45":
    fittings += [(1243.8, -763.1, 1.0, 0.65, 0.22), (1245.7, -762.4, 0.9, 0.65, 0.22)]
  for x, z, w, h, height in fittings:
    polygon = box(x - w / 2, z - h / 2, x + w / 2, z + h / 2)
    if not model.footprint.covers(polygon):
      continue
    ys = []
    for xx, zz in list(polygon.exterior.coords)[:-1]:
      heights = [v for t in model.roofs if (v := roof_height(t, xx, zz)) is not None]
      if not heights:
        break
      ys.append(max(heights))
    if len(ys) != 4 or max(ys) - min(ys) > 0.35:
      continue
    low = max(ys) - 0.025
    high = low + height
    skylight = height < 0.5
    colour = (172, 187, 187) if skylight else (146, 86, 65)
    fitting = detail_prism(list(polygon.exterior.coords)[:-1], low, high, colour)
    if not skylight:
      for s in fitting.walls:
        _, _, _, p, length = frame(s)
        for y in np.arange(low + 0.2, high, 0.27):
          fitting.fitting(
            s, [0, y, length, y + 0.035], (184, 135, 102), "chimney mortar", 0.02
          )
      fitting.drawn.surface(polygon.buffer(-0.18), high + 0.015, (56, 57, 51))
      fitting.native.surface(
        fitting.native_footprint.buffer(-0.18), high + 0.015, (56, 57, 51)
      )
    merge_detail(
      model, fitting, "photo low rooflight" if skylight else "photo roof chimney"
    )


class RedCornerNativeModel(shell.Church):
  """Photo paint clips onto every real cardinal stair face and its own tier."""

  def fitting(self, surface, shape, colour, role, depth=0.055, normal=None):
    # Keep the established drawn triangles exactly. The former dominant-axis
    # projection went behind unpainted stair risers and truncated terrace glass
    # against the lower roof's outer edge; discard only that native artwork.
    actual_native = self.native
    self.native = type(actual_native)(actual_native.origin_x, actual_native.origin_z)
    try:
      super().fitting(surface, shape, colour, role, depth, normal)
    finally:
      self.native = actual_native
    a, d, n, poly, length = frame(surface)
    if normal is not None:
      n = np.array(normal)
    elif self.footprint.covers(
      Point(*(a[[0, 2]] + d[[0, 2]] * length / 2 + n[[0, 2]] * 0.18))
    ):
      n = -n
    panel = poly.intersection(box(*shape) if isinstance(shape, list) else shape)
    if panel.is_empty:
      return
    if not hasattr(self, "cardinal_faces"):
      self.cardinal_faces = []
      for (ix, iz), high in self.cells.items():
        for dx, dz in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
          low = self.cells.get((ix + dx, iz + dz), self.ground)
          if high <= low:
            continue
          axis = 0 if dx else 2
          other = 2 if dx else 0
          sign = dx + dz
          fixed = (ix + (dx > 0)) * shell.CELL if dx else (iz + (dz > 0)) * shell.CELL
          along = (iz if dx else ix) * shell.CELL
          self.cardinal_faces.append((axis, other, sign, fixed, along, low, high))
      self.native_face_artwork = []
    for axis, other, sign, fixed, along, low, high in self.cardinal_faces:
      if n[axis] * sign <= 0.05 or abs(d[other]) < 0.05:
        continue
      q0 = np.array([0.0, 0.0, 0.0])
      q0[axis] = fixed
      q0[other] = along
      q1 = q0.copy()
      q1[other] += shell.CELL
      middle = (q0 + q1) / 2
      if abs((middle - a)[[0, 2]] @ n[[0, 2]]) > 0.8:
        continue
      u0 = (q0 - a)[[0, 2]] @ d[[0, 2]]
      u1 = (q1 - a)[[0, 2]] @ d[[0, 2]]
      clipped = panel.intersection(box(min(u0, u1), low, max(u0, u1), high))
      if clipped.is_empty or clipped.area < 0.0001:
        continue
      first = len(self.native.indices) // 3
      for component in shell.polygons(clipped):
        rings = [
          list(component.exterior.coords)[:-1],
          *[list(h.coords)[:-1] for h in component.interiors],
        ]
        world = []
        for ring in rings:
          result = []
          for u, y in ring:
            point = [0.0, float(y), 0.0]
            point[axis] = fixed + sign * (depth + 0.015)
            point[other] = along + (u - u0) / (u1 - u0) * shell.CELL
            result.append(point)
          world.append(result)
        for triangle in triangles_for(world):
          self.native.triangle(triangle, colour)
      last = len(self.native.indices) // 3
      if last > first:
        self.native_face_artwork.append(
          dict(
            role=role,
            axis=axis,
            sign=sign,
            boundary=fixed,
            low=low,
            high=high,
            offset=depth + 0.015,
            firstTriangle=first,
            triangleCount=last - first,
            colour=colour,
          )
        )


def decorate(model, spec, roads):
  """Photo-relative storeys and relief on measured public wall planes only."""
  g = model.ground
  for surface in list(model.walls):
    a, d, n, p, length = frame(surface)
    if abs(n[1]) > 0.05 or length < 0.38:
      continue
    centre = np.mean(surface["rings"][0], axis=0)
    fitting_footprint = surface.get("fittingFootprint", model.footprint)
    if fitting_footprint.covers(Point(*(centre[[0, 2]] + n[[0, 2]] * 0.18))):
      n = -n
    near = nearest_points(Point(*centre[[0, 2]]), roads)[1]
    vec = np.array([near.x - centre[0], near.y - centre[2]])
    if np.linalg.norm(vec) > 21 or vec @ n[[0, 2]] < 0.1:
      continue
    u0, y0, u1, y1 = p.bounds
    # The terrace walls have their own uninterrupted glazing reading.
    terrace = surface.get("estimated", False)
    if (
      not terrace
      and LineString([centre[[0, 2]] + n[[0, 2]] * 0.2, (near.x, near.y)])
      .intersection(model.footprint)
      .length
      > 0.12
    ):
      continue
    red = spec["key"] == "redCorner"
    stone = (
      (238, 234, 218)
      if spec["key"] == "white45"
      else (160, 151, 130)
      if spec["key"] == "brick46"
      else STONE
    )
    if spec["key"] == "brick46":
      irregular_brick(model, surface)
    if red and not terrace:
      model.fitting(
        surface,
        [u0, g, u1, g + 7.2],
        (217, 214, 198),
        "photographed pale lower wall",
        0.025,
      )
    curved = red and length < 1.0
    if terrace or curved:
      model.fitting(
        surface,
        [u0, g + 3.8 if curved else y0 + 0.12, u1, y1 - 0.15],
        GLASS,
        "curved corner glazing" if curved else "penthouse glazing",
        0.055,
        normal=n,
      )
      for u in np.arange(u0, u1, 1.15 if terrace else max(length, 1)):
        model.fitting(
          surface,
          [u, y0, u + 0.075, y1],
          FRAME,
          "corner/terrace mullion",
          0.09,
          normal=n,
        )
      for y in (
        [g + 4.1, g + 7.6, g + 11.1, g + 14.6, g + 18.1]
        if curved
        else [y0 + 0.12, y1 - 0.2]
      ):
        model.fitting(
          surface,
          [u0, y - 0.07, u1, y + 0.07],
          FRAME,
          "glass floor edge",
          0.11,
          normal=n,
        )
      continue
    if length < 1.4:
      if spec["key"] in ("white45", "brick46", "ochre50"):
        for y in [g + 4.4, g + 8.7, g + 12.8, g + 17.0, y1 - 0.55]:
          model.fitting(
            surface,
            [u0, y - 0.13, u1, y + 0.13],
            stone,
            "projecting measured bay cornice",
            0.17,
          )
      continue
    count = max(1, round(length / (2.95 if spec["key"] != "yellow48" else 3.05)))
    pitch = length / count
    for j in range(count):
      u = (j + 0.5) * pitch
      for level, y in enumerate([g + 6.0, g + 10.1, g + 14.2, g + 18.3]):
        h = 2.45 if spec["key"] == "yellow48" else 2.65
        w = min(1.45, pitch * 0.58)
        if y + h / 2 > y1 - 0.7:
          continue
        opening = (
          arch(u, y - h / 2, y + h / 2, w)
          if level == 3 and spec["key"] == "white45"
          else box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
        )
        model.fitting(
          surface,
          opening.buffer(0.15, join_style="mitre"),
          stone,
          "photo window reveal",
          0.09,
        )
        model.fitting(surface, opening, GLASS, "photo window", 0.12)
        model.fitting(
          surface,
          [u - 0.035, y - h / 2, u + 0.035, y + h / 2 - 0.05],
          FRAME,
          "window mullion",
          0.15,
        )
        model.fitting(
          surface,
          [u - w / 2, y + 0.35, u + w / 2, y + 0.43],
          FRAME,
          "window transom",
          0.15,
        )
        model.fitting(
          surface,
          [u - w / 2 - 0.19, y - h / 2 - 0.14, u + w / 2 + 0.19, y - h / 2 + 0.02],
          stone,
          "projecting sill",
          0.22,
        )
        if spec["key"] in ("white45", "ochre50") and level in (1, 3):
          ped = Polygon(
            [
              (u - w * 0.69, y + h / 2 + 0.2),
              (u + w * 0.69, y + h / 2 + 0.2),
              (u, y + h / 2 + 0.85),
            ]
          )
          model.fitting(
            surface,
            ped.boundary.buffer(0.07, join_style="mitre"),
            stone,
            "triangular pediment",
            0.2,
          )
        elif spec["key"] == "brick46" and level in (1, 3):
          head = arch(
            u, y + h / 2 + 0.05, y + h / 2 + (1.1 if level == 3 else 0.6), w * 1.2
          )
          model.fitting(
            surface,
            head.boundary.buffer(0.045),
            stone,
            "restricted photo lintel arch",
            0.06,
          )
      if not red:
        order = j * pitch if spec["key"] in ("white45", "brick46") else u
        width = 0.12 if spec["key"] in ("white45", "brick46") else 0.08
        model.fitting(
          surface,
          [order - width, g + 4.6, order + width, min(y1 - 0.5, g + 20.5)],
          stone,
          "fine vertical facade order",
          0.16
          if spec["key"] == "white45"
          else 0.025
          if spec["key"] == "brick46"
          else 0.03,
        )
    if spec["key"] == "white45":
      for u in np.arange(0.0, length + 0.1, pitch):
        for yy in [g + 8.7, g + 12.8, g + 17.0, g + 20.4]:
          model.fitting(
            surface,
            [u - 0.25, yy - 0.16, u + 0.25, yy + 0.12],
            stone,
            "projecting pilaster capital/base",
            0.28,
          )
      for u in np.arange(0.3, length - 0.2, 0.42):
        model.fitting(
          surface,
          [u - 0.06, g + 16.65, u + 0.06, g + 17.24],
          stone,
          "upper balustrade spindle",
          0.18,
        )
      model.fitting(
        surface, [u0, g + 17.18, u1, g + 17.34], stone, "upper balustrade coping", 0.24
      )
    # Public lower frontage is opaque glazing, not an invented passable entrance.
    for j in range(count):
      u = (j + 0.5) * pitch
      w = min(2.1, pitch - 0.45)
      model.fitting(
        surface,
        [u - w / 2, g + 0.3, u + w / 2, g + 3.6],
        DARK,
        "lower commercial bay",
        0.08,
      )
      model.fitting(
        surface,
        [u - 0.04, g + 0.3, u + 0.04, g + 3.6],
        FRAME,
        "lower bay divider",
        0.11,
      )
    for y in [g + 4.25, g + 8.6, g + 12.7, g + 16.8, min(y1 - 0.36, g + 21.4)]:
      if y + 0.15 < y1:
        model.fitting(
          surface,
          [u0, y - 0.1, u1, y + 0.1],
          stone,
          "continuous source-wall cornice",
          0.2,
        )
    if spec["key"] in ("white45", "brick46"):
      for u in np.arange(0.25, length - 0.1, 0.65):
        model.fitting(
          surface,
          [u - 0.08, y1 - 0.75, u + 0.08, y1 - 0.47],
          stone,
          "small eave dentil",
          0.14,
        )


def old_receipts(prism_ids):
  """Replay exactly the original individual source recipes before indexing removal."""
  a = json.loads((GEO / "mitte-streets-v166.json").read_bytes())
  b = json.loads((GEO / "oranien-corridors-v167.json").read_bytes())
  roads = unary_union([shape(r["geometry"]) for r in a["roads"]])
  oranien = unary_union([shape(r["geometry"]) for r in b["roads"]])
  details = {"drawn": {}, "minecraft": {}}
  for mode in details:
    details[mode]["mitte-street-fronts-v166"] = Detail()
    if mode == "drawn":
      details[mode]["oranien-corridors-v167"] = Detail()
  for p in a["corePrisms"]:
    if p["id"] not in prism_ids:
      continue
    d = streets.core_detail(p, roads)
    details["drawn"]["mitte-street-fronts-v166"].triangles.extend(d.triangles)
    details["minecraft"]["mitte-street-fronts-v166"].triangles.extend(
      native_detail(d).triangles
    )
  for p in b["retainedDetailedCorePrisms"]:
    if p["id"] in prism_ids:
      details["drawn"]["oranien-corridors-v167"].triangles.extend(
        core_ornament(p, oranien).triangles
      )
  result = {"schema": 1, "keys": [], "packets": {}}
  manifest = json.loads((PACKETS / "manifest.json").read_bytes())
  descriptor = next(d for d in manifest["chunks"] if d["id"] == "2_-2")
  tile = box(*descriptor["bounds"])

  def keys(mesh):
    points = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
    rgb = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    rows = np.concatenate([points.astype(np.int32), rgb.astype(np.int32)], axis=1)
    return [tuple(sorted(tuple(map(int, v)) for v in rows[t])) for t in ix]

  for mode in details:
    p = json.loads(gzip.decompress((PACKETS / descriptor[mode]["url"]).read_bytes()))
    records = []
    for kind, d in details[mode].items():
      expected = Counter(keys(packed_detail(d, tile)))
      total = sum(expected.values())
      for i, m in enumerate(p["meshes"]):
        if m["kind"] != kind:
          continue
        selected = []
        for j, k in enumerate(keys(m)):
          if expected[k]:
            selected.append(j)
            expected[k] -= 1
        if selected:
          records.append(
            dict(
              mesh=i,
              kind=kind,
              fingerprint=fnv([m["positions"], m["colors"], m["indices"]]),
              triangles=selected,
            )
          )
      assert not +expected, (mode, kind, total, sum(expected.values()))
    key = mode + ":2_-2"
    result["keys"].append(key)
    result["packets"][key] = dict(
      origin=p["origin"],
      records=records,
      sourceAsset=descriptor[mode],
      sourcePrisms=sorted(prism_ids),
    )
  return result


def build():
  prisms = json.loads((BASE / "lod2-prisms.json").read_bytes())["buildings"]
  voxel = json.loads((BASE / "minecraft-voxels.json").read_bytes())
  cell = voxel["cell_m"]
  previous = {p["id"]: p for p in prisms}
  all_polys = {
    p["id"]: Polygon(np.array(p["ring"]) / 10, [np.array(h) / 10 for h in p["holes"]])
    for p in prisms
  }
  streets_source = json.loads((GEO / "mitte-streets-v166.json").read_bytes())
  roads = unary_union(
    [
      shape(r["geometry"])
      for r in streets_source["roads"]
      if r["name"] == "Oranienburger Straße"
    ]
  )
  side = unary_union([roads, LineString([(1295, -747), (1316, -820)])])
  runtime = dict(schema=1, sites=[])
  profile = dict(schema=1, cellM=cell, nativeCellM=shell.CELL, sites=[])
  source = dict(
    schema=1,
    archive=dict(
      path=str(ARCHIVE.relative_to(ROOT)),
      sha256=digest(ARCHIVE),
      license="dl-de/zero-2-0",
    ),
    sites=[],
    photos=[],
  )
  evidence = dict(
    schema=1,
    inputs={
      str(p.relative_to(ROOT)): digest(p)
      for p in [
        BASE / "lod2-prisms.json",
        BASE / "minecraft-voxels.json",
        GEO / "mitte-streets-v166.json",
        GEO / "oranien-corridors-v167.json",
        ROOT / "docs/tacheles-fronts-v270-references.json",
      ]
    },
    sites=[],
  )
  for n in [1, 2, 3, 4, 5, 6, 7, 8]:
    p = PHOTOS / f"{n}-Photo-{n}.jpg"
    source["photos"].append(
      dict(
        name=p.name,
        sha256=digest(p),
        usage="User-provided geometric/material reference only; bitmap not bundled.",
      )
    )
  for spec in SITES:
    parent = extract_parent(ARCHIVE, spec["owner"])
    leaves = leaf_building_parts(parent) or [parent]
    original = [part_profile(p) for p in leaves]
    sheets = []
    for part in leaves:
      for bounded in part.findall("bldg:boundedBy", NS):
        for surface in bounded:
          for poly in surface.findall(".//gml:Polygon", NS):
            sheets.append(
              dict(
                part=part.get("{" + NS["gml"] + "}id"),
                id=poly.get("{" + NS["gml"] + "}id"),
                kind=surface.tag.split("}")[-1],
                rings=[world_ring(pos) for pos in poly.findall(".//gml:posList", NS)],
              )
            )
    old = previous[spec["prism"]]
    ground = old["y0_dm"] / 10
    low = min(p["ground_y_m"] for p in original)
    shift = ground - low
    parts = copy.deepcopy(original)
    for p in parts:
      p["ground_y_m"] += shift
      p["top_y_m"] += shift
      for s in p["surfaces"]:
        for ring in s["rings"]:
          for q in ring:
            q[1] += shift
    top = max(p["top_y_m"] for p in parts)
    spec = {**spec, "height": top - ground + (5.6 if spec["key"] == "redCorner" else 0)}
    shell.BRICK = spec["wall"]
    shell.ROOF = spec["roof"]
    model = (RedCornerNativeModel if spec["key"] == "redCorner" else shell.Church)(
      spec, parts, ground
    )
    model.detail_solids = []
    if spec["key"] == "redCorner":
      # Measured curved roof survives as the first terrace slab. Only the two
      # photographed setback glass storeys are added, with explicit 2.7m estimates.
      for inset, lo, hi in [
        (1.15, top + 0.12, top + 2.75),
        (2.35, top + 2.9, top + 5.6),
      ]:
        for p in shell.polygons(model.footprint.buffer(-inset, join_style="mitre")):
          first = len(model.walls)
          model.loft(list(p.exterior.coords)[:-1], lo, hi, 1, GLASS)
          for wall in model.walls[first:]:
            wall["fittingFootprint"] = p
      model.roles["photo two setback glass storeys"] = 2
    model.raster()
    decorate(model, spec, side if spec["key"] == "redCorner" else roads)
    if spec["key"] == "redCorner":
      # Terrace rails follow the measured offset contour, never a generic rectangle.
      for inset, y in [(0.35, top + 1.05), (1.45, top + 3.8)]:
        poly = model.footprint.buffer(-inset, join_style="mitre")
        for p in shell.polygons(poly):
          ring = list(p.exterior.coords)[:-1]
          for a, b in zip(ring, ring[1:] + ring[:1]):
            q = [
              [a[0], y - 0.035, a[1]],
              [b[0], y - 0.035, b[1]],
              [b[0], y + 0.035, b[1]],
              [a[0], y + 0.035, a[1]],
            ]
            for t in triangles_for([q]):
              model.drawn.triangle(t, FRAME)
            # Independent narrow cardinal segments for the railing.
            length = math.dist(a, b)
            for distance in np.arange(0, length, 1.2):
              u = distance / length
              railpost(
                model, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, y - 1.0, y
              )
            for t in np.arange(0, length, 0.5):
              u = (t + 0.25) / length
              x = a[0] + (b[0] - a[0]) * u
              z = a[1] + (b[1] - a[1]) * u
              axis = 0 if abs(b[0] - a[0]) >= abs(b[1] - a[1]) else 2
              qq = (
                [
                  [x - 0.25, y - 0.04, z],
                  [x + 0.25, y - 0.04, z],
                  [x + 0.25, y + 0.04, z],
                  [x - 0.25, y + 0.04, z],
                ]
                if axis == 0
                else [
                  [x, y - 0.04, z - 0.25],
                  [x, y - 0.04, z + 0.25],
                  [x, y + 0.04, z + 0.25],
                  [x, y + 0.04, z - 0.25],
                ]
              )
              model.native.triangle(qq[:3], FRAME)
              model.native.triangle([qq[0], qq[2], qq[3]], FRAME)
    photographed_projections_and_roofs(model, spec)
    oldpoly = all_polys[spec["prism"]]
    near = {
      k: p
      for k, p in all_polys.items()
      if box(*p.bounds).intersects(oldpoly.buffer(cell).envelope)
    }
    columns = []
    controls = []
    x0, z0, x1, z1 = oldpoly.bounds
    for zi, runs in enumerate(voxel["building_rows"]):
      iz = voxel["grid"]["min_z_idx"] + zi
      if not z0 - cell <= (iz + 0.5) * cell <= z1 + cell:
        continue
      for off, count, lo, hi, kind in runs:
        first = voxel["grid"]["min_x_idx"] + off
        for ix in range(first, first + count):
          if not x0 - cell <= (ix + 0.5) * cell <= x1 + cell:
            continue
          square = box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)
          if oldpoly.intersection(square).area < 0.001:
            continue
          foreign = [
            k
            for k, p in near.items()
            if k != spec["prism"] and p.intersection(square).area > 0.001
          ]
          row = [ix, iz, lo, hi, kind]
          if foreign:
            controls.append(dict(column=row, foreign=foreign))
          else:
            columns.append(row)
    neighbours = [p for p in prisms if p["id"] in near and p["id"] != spec["prism"]]
    metrics = dict(
      sourceParts=len(original),
      sourceSheets=len(sheets),
      sourceTriangles=model.source_triangles,
      drawnTriangles=len(model.drawn.indices) // 3,
      nativeTriangles=len(model.native.indices) // 3,
      nativeCells=len(model.cells),
      nativeShellTriangles=model.native_shell,
      roles=dict(model.roles),
    )
    runtime["sites"].append(
      dict(
        key=spec["key"],
        name=spec["name"],
        origin=model.origin,
        drawn=model.drawn.payload("tacheles-fronts-v270"),
        native=model.native.payload("tacheles-fronts-v270"),
      )
    )
    profile["sites"].append(
      dict(
        key=spec["key"],
        name=spec["name"],
        owner=spec["owner"],
        prism=spec["prism"],
        groundY=ground,
        topY=max(
          [ground + spec["height"], *[d["maxY"] + 0.015 for d in model.detail_solids]]
        ),
        shellTopY=ground + spec["height"],
        detailSolids=model.detail_solids,
        previousPrism=old,
        columns=columns,
        neighbours=neighbours,
        drawnFootprints=[
          shell.polygon_record(p) for p in shell.polygons(model.footprint)
        ],
        nativeFootprints=[
          shell.polygon_record(p) for p in shell.polygons(model.native_footprint)
        ],
        roofTriangles=[
          [[round(float(v), 5) for v in p] for p in t] for t in model.roofs
        ],
        metrics=metrics,
      )
    )
    source["sites"].append(
      dict(
        **spec,
        originalParts=original,
        originalSheets=sheets,
        groundY=ground,
        sourceShiftY=shift,
        previousPrism=old,
      )
    )
    evidence["sites"].append(
      dict(
        key=spec["key"],
        metrics=metrics,
        retainedForeignNativeColumns=controls,
        additions=model.additions,
        detailSolids=model.detail_solids,
        nativeFaceArtwork=getattr(model, "native_face_artwork", []),
      )
    )
  receipts = old_receipts({s["prism"] for s in SITES})
  for r in receipts["packets"].values():
    evidence["inputs"][str((PACKETS / r["sourceAsset"]["url"]).relative_to(ROOT))] = r[
      "sourceAsset"
    ]["sha256"]
  write(GEO / "tacheles-fronts-v270-source.json.gz", source)
  evidence["inputs"][
    str((GEO / "tacheles-fronts-v270-source.json.gz").relative_to(ROOT))
  ] = digest(GEO / "tacheles-fronts-v270-source.json.gz")
  write(OUT / "tachelesFrontsV270.json", runtime)
  write(OUT / "tachelesFrontsV270Profile.json", profile)
  write(OUT / "tachelesFrontsV270Receipts.json", receipts)
  evidence["runtime"] = {
    n: digest(OUT / n)
    for n in [
      "tachelesFrontsV270.json",
      "tachelesFrontsV270Profile.json",
      "tachelesFrontsV270Receipts.json",
    ]
  }
  write(GEO / "tacheles-fronts-v270-evidence.json.gz", evidence)
  print(
    json.dumps(
      dict(
        sites=[dict(key=s["key"], **s["metrics"]) for s in profile["sites"]],
        transfers={
          k: sum(len(r["triangles"]) for r in p["records"])
          for k, p in receipts["packets"].items()
        },
        bytes={n: (OUT / n).stat().st_size for n in evidence["runtime"]},
      )
    )
  )


if __name__ == "__main__":
  build()
