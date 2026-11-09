"""Rebuild two finite Steglitz packet owners from the retained source archive."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import subprocess
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
from build_bebelplatz_building_source import extract_parent
from build_breitscheid_towers_v161 import normal_of
from build_public_institutions_v326 import (
  clip_polygon,
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
  navigation_polygons,
  world,
)
from shapely import orient_polygons
from shapely.affinity import scale, translate
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app"
PUBLIC = APP / "public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "raw/lod2/LoD2_386_5813.zip"
KIND = "schlossstrasse-v327"
FAMILIES = {
  "titania": ("DEBE06YYB0000gop", "ring182--7_11", 23, 28544726, 29.30),
  "bierpinsel": ("DEBE06YYB0000lX5", "ring182--7_12", 10, 28503881, 42.55),
}
PACKET_SHAS = {
  "ring182--7_11.drawn.json.gz": "7294eb37a2686f0e67a239c257e4053a22bef02ef9b264d692c9aac3cd1759a3",
  "ring182--7_11.minecraft.json.gz": "4ca146f5baf92cf3642eed07de1cdaf4cb7e9943063ad500b5e7b8f507815459",
  "ring182--7_12.drawn.json.gz": "6f1e924e17b9358207cefa0889cd09910df8e8af874621ac218642d464ab7bfe",
  "ring182--7_12.minecraft.json.gz": "68fe37febe85e6d27b1ef923993a504ebbe1530b2dbbde624b8c5bc7d461d592",
}
TOWER = "DEBE3DuEAkYVoOyb"
TITANIA_CORNER = {
  "UUID_d0b2675a-ba6e-4b2a-8fd4-7d499276bf59",
  "UUID_d7479d70-f098-4950-b20a-1e3516e42228",
}
TITANIA_FRONT = {
  "UUID_7404e473-35c1-4ec0-95b7-8492ef724e4d",
  "UUID_6f310872-dc8b-42f5-9d05-b87ff5a1c8a5",
}
TITANIA_TOWER = {
  "UUID_304faa11-0e43-4d20-bf61-370f1c162bcc",
  "UUID_1eb6ed34-3e34-449d-85c4-996010654b06",
  "UUID_ef790452-5d8d-46eb-86cf-4d329464afe7",
}
# Small geometric lettering for the two evidenced street faces.
TITANIA_LETTERS = {
  "T": ("11111", "00100", "00100", "00100", "00100", "00100", "00100"),
  "I": ("111", "010", "010", "010", "010", "010", "111"),
  "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
  "N": ("10001", "11001", "11001", "10101", "10011", "10011", "10001"),
  "P": ("11110", "10001", "10001", "11110", "10000", "10000", "10000"),
  "L": ("10000", "10000", "10000", "10000", "10000", "10000", "11111"),
  "S": ("01111", "10000", "10000", "01110", "00001", "00001", "11110"),
  " ": ("000",) * 7,
}
CROWN_CENTER = (-3318.5, 6314.55)
CROWN_EAVE = 29.0
CROWN_BASE = 17.0
SHA = "73d66a1d622654e88db7b0e70ae079128a0114deda691fc95799ccff24d81fd2"


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def rgb(value):
  return tuple(value >> n & 255 for n in (16, 8, 0))


def quad(mesh, points, color):
  mesh.triangle(points[:3], rgb(color))
  mesh.triangle([points[0], points[2], points[3]], rgb(color))


def source_family(key):
  if sha(SOURCE) != SHA:
    raise ValueError("Changed complete LoD2 source archive")
  parent_id, packet, count, osm, _ = FAMILIES[key]
  element = extract_parent(SOURCE, parent_id)
  parts = [complete_part(p) for p in leaf_building_parts(element)]
  if len(parts) != count or len({p["id"] for p in parts}) != count:
    raise ValueError("Incomplete source family")
  footprint = world(building_footprint(element))
  return {
    "id": parent_id,
    "packet": packet,
    "osmWay": osm,
    "footprint": mapping(footprint),
    "parts": parts,
  }


def from_nav(row, ox, oz):
  return translate(Polygon(row["ring"], row["holes"]), ox, oz)


def packed_rows(mesh, *, ink=False):
  positions = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  colors = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
  values = np.column_stack([positions, colors]).astype("<u2")
  if ink:
    return [
      b"".join(sorted(p.tobytes() for p in row)) for row in values.reshape(-1, 2, 6)
    ]
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  rows = []
  for triangle in values[indices]:
    a, b, c = [p.tobytes() for p in triangle]
    rows.append(min(a + b + c, b + c + a, c + a + b))
  return rows


def select_exact(expected, actual):
  """Require exact full multiplicity before retiring any old primitive."""
  required = Counter(expected)
  found = Counter(row for row in actual if row in required)
  if found != required:
    raise ValueError(
      f"Old source primitive multiplicity differs: {sum((required - found).values())} missing, {sum((found - required).values())} foreign"
    )
  return [i for i, row in enumerate(actual) if row in required]


def original(key, family, raw, native):
  owner, packet, _, _, height = FAMILIES[key]
  ox, _, oz = raw["origin"]
  ground = unary_union([from_nav(p, ox, oz) for p in raw["nav"]["ground"]])
  replay = chunk_payload(
    packet,
    box(ox, oz, ox + 512, oz + 512),
    ground,
    [
      {
        "sourceId": owner,
        "geometry": shape(family["footprint"]),
        "height": height,
        "minHeight": 0,
        "heightSource": "Berlin LoD2 parent vertical envelope",
      }
    ],
    {},
    minecraft=native,
  )
  old = [b for b in raw["nav"]["buildings"] if b["sourceId"] == owner]
  check = [b for b in replay["nav"]["buildings"] if b["sourceId"] == owner]
  if (
    len(old) != 1
    or len(check) != 1
    or old[0]["height"] != check[0]["height"]
    or (
      from_nav(old[0], ox, oz).symmetric_difference(from_nav(check[0], ox, oz)).area
      > 1e-8
    )
  ):
    raise ValueError("Old building navigation did not reproduce")
  # Replay also includes the one ground complement, which is never selected.
  rs = packed_rows(replay["meshes"][0])
  roof_rgb, wall_rgb = (
    tuple(int(v) for v in colors)
    for colors in _linear([COLORS["roof"], COLORS["building"]])
  )
  paint = {np.array(c, dtype="<u2").tobytes() for c in (roof_rgb, wall_rgb)}
  selected = [r for r in rs if r[6:12] in paint]
  retired = select_exact(selected, packed_rows(raw["meshes"][0]))
  lines = (
    []
    if native
    else select_exact(
      packed_rows(replay["lines"], ink=True), packed_rows(raw["lines"], ink=True)
    )
  )
  return retired, lines, old


def _linear(colors):
  from build_surrounding_outlines import linear_rgb_bytes

  return linear_rgb_bytes(np.asarray(colors, dtype=np.uint8))


def surface_roofs(part, offset):
  return [
    t
    for s in part["surfaces"]
    if s["kind"] == "RoofSurface"
    for t in source_triangles(s, offset)
  ]


def cap_nav(footprint, low, top, owner, ox, oz, roof=None):
  for poly in navigation_polygons(footprint, ox, oz):
    if top <= low:
      raise ValueError("Empty modeled navigation solid")
    yield {
      **poly,
      "height": round(top - GROUND_Y, 2),
      "minHeight": round(low - GROUND_Y, 2),
      "sourceId": owner,
      **(
        {
          "roofTriangles": [
            [
              [round(x - ox, 2), round(y - GROUND_Y, 2), round(z - oz, 2)]
              for x, y, z in t
            ]
            for t in roof
          ]
        }
        if roof
        else {}
      ),
    }


def mounted_panel(mesh, s, offset, mode):
  """Clip the entire projecting trim rectangle against its one measured wall."""
  rings = s["rings"]
  p = np.asarray(rings[0])
  normal = normal_of(rings[0])
  base = p[0, [0, 2]]
  out = normal[[0, 2]]
  course = np.array([out[1], -out[0]])
  rings_2d = [
    [[(np.asarray(v)[[0, 2]] - base) @ course, v[1] + offset] for v in r] for r in rings
  ]
  wall = Polygon(rings_2d[0], rings_2d[1:])
  if not wall.is_valid or abs(normal[1]) > 0.025:
    raise ValueError("Recognized trim lost its measured wall plane")
  u0, low, u1, high = wall.bounds
  support = wall.buffer(-0.015)
  count = 0

  def panel(a, b, y0, y1, extrusion, color):
    nonlocal count
    if b <= a or not support.covers(box(a, y0, b, y1)):
      return
    pts = []
    for u, y in ((a, y0), (b, y0), (b, y1), (a, y1)):
      x, z = base + u * course + out * extrusion
      pts.append((x, y, z))
    quad(mesh, pts, color)
    count += 1

  if mode == "tower":
    for n in range(math.ceil((low - 12.65) / 0.78), math.floor((high - 12.65) / 0.78)):
      y = 12.65 + 0.78 * n
      if y >= 12.5:
        panel(u0 + 0.04, u1 - 0.04, y, y + 0.49, 0.055, 0x202E37)
        panel(u0 + 0.04, u1 - 0.04, y + 0.49, y + 0.64, 0.12, 0xE5DDCA)
  elif mode == "corner":
    panel(u0 + 0.09, u1 - 0.09, 3.45, 7.66, 0.06, 0x465C5A)
    panel(u0 + 0.07, u1 - 0.07, 7.78, 8.53, 0.21, 0x242E31)
    for y in (8.72, 9.16, 9.62, 10.05):
      panel(u0 + 0.06, u1 - 0.06, y, y + 0.14, 0.13, 0xE7DECC)
    for column in np.linspace(u0 + 0.12, u1 - 0.12, 10):
      panel(column - 0.035, column + 0.035, 3.46, 7.67, 0.087, 0xAAB6AF)
  else:
    for y in (8.9, 11.25, 14.83):
      panel(u0 + 0.05, u1 - 0.05, y, y + 0.055, 0.07, 0x8C7662)
    for u in np.linspace(u0 + 1.6, u1 - 1.6, max(2, round((u1 - u0) / 3.05))):
      panel(u - 0.26, u + 0.26, 4.1, 12.3, 0.052, 0xA7957F)
    label = "TITANIA PALAST"
    columns = sum(len(TITANIA_LETTERS[c][0]) + 1 for c in label)
    pixel = min(0.22, (u1 - u0 - 1.6) / columns)
    start = (u0 + u1 - columns * pixel) / 2
    top = high - 0.55
    for c in label:
      for j, row in enumerate(TITANIA_LETTERS[c]):
        for i, filled in enumerate(row):
          if filled == "1":
            panel(
              start + i * pixel,
              start + (i + 1) * pixel,
              top - (j + 1) * pixel,
              top - j * pixel,
              0.08,
              0x61464A,
            )
      start += (len(TITANIA_LETTERS[c][0]) + 1) * pixel
  return count


def titania(mesh, family):
  nav, counts = [], Counter()
  offset = GROUND_Y - min(p["groundY"] for p in family["parts"])
  for part in family["parts"]:
    roofs = surface_roofs(part, offset)
    for surface in part["surfaces"]:
      key = surface["sourcePolygonId"]
      role = surface["kind"]
      if role == "GroundSurface":
        continue
      color = 0x645F57 if role == "RoofSurface" else 0xB59C82
      if key in TITANIA_TOWER:
        color = 0x746D65
      for t in source_triangles(surface, offset):
        mesh.triangle(t, rgb(color))
        counts[role] += 1
      for ids, mode in (
        (TITANIA_TOWER, "tower"),
        (TITANIA_CORNER, "corner"),
        (TITANIA_FRONT, "front"),
      ):
        if key in ids:
          counts[mode] += mounted_panel(mesh, surface, offset, mode)
    nav.extend(
      cap_nav(
        part_footprint(part),
        part["groundY"] + offset,
        part["topY"] + offset,
        part["id"],
        mesh.origin_x,
        mesh.origin_z,
        roofs,
      )
    )
  if min(counts["tower"], counts["corner"], counts["front"]) < 10:
    raise ValueError("A photographed Titania frontage lost its source backing")
  return nav, counts


def crown_slice(footprint, factor):
  return scale(footprint, xfact=factor, yfact=factor, origin=CROWN_CENTER)


def shaft_ring():
  cx, cz = CROWN_CENTER
  return Polygon(
    [
      (cx + 2.5 * math.cos(i * math.tau / 12), cz + 2.5 * math.sin(i * math.tau / 12))
      for i in range(12)
    ]
  )


def taper(footprint, y):
  return crown_slice(
    footprint, min(1, 0.36 + (y - CROWN_BASE) * 0.64 / (CROWN_EAVE - CROWN_BASE))
  )


def stair_landings(footprint):
  """Interpret the photographed side landings inside the measured crown plan."""
  east = np.array([0.85, 0.53])
  north = np.array([0.53, -0.85])
  shaft = np.array(CROWN_CENTER)
  for i, height in enumerate((9.5, 11.8, 14.1, 16.4, 18.7)):
    centre = shaft - east * (2.9 + 0.38 * i) + north * (1.1 + 0.18 * i)
    landing = Polygon(
      [
        centre + east * u + north * v
        for u, v in ((-2, -1.35), (2, -1.35), (2, 1.35), (-2, 1.35))
      ]
    )
    if not footprint.covers(landing):
      raise ValueError("Photo-fitted landing escapes the measured building plan")
    yield height, landing


def shell_side(mesh, lower, upper, low, high, color):
  a = list(orient_polygons(lower, exterior_cw=True).exterior.coords)
  b = list(orient_polygons(upper, exterior_cw=True).exterior.coords)
  for (x, z), (u, v), (X, Z), (U, V) in zip(a[:-1], a[1:], b[:-1], b[1:], strict=True):
    quad(mesh, [(x, low, z), (u, low, v), (U, high, V), (X, high, Z)], color)


def bierpinsel(mesh, family):
  offset = GROUND_Y - min(p["groundY"] for p in family["parts"])
  full = shape(family["footprint"])
  # The official leaves encode the complete measured crown projection and roof.
  # Their vertical walls all run to grade. Keep the upper wall/roof sheets and
  # replace only the below-eave form with the documented open taper and shaft.
  counts = Counter()
  roofs = [t for part in family["parts"] for t in surface_roofs(part, offset)]
  for part in family["parts"]:
    for surface in part["surfaces"]:
      role = surface["kind"]
      if role == "GroundSurface":
        continue
      color = 0x656963 if role == "RoofSurface" else 0xB6B7AD
      for t in source_triangles(surface, offset):
        clipped = clip_polygon(t, 1, CROWN_EAVE, True)
        for i in range(1, len(clipped) - 1):
          mesh.triangle([clipped[0], clipped[i], clipped[i + 1]], rgb(color))
          counts[role] += 1
  stages = [
    (CROWN_BASE, taper(full, CROWN_BASE)),
    (22.4, taper(full, 22.4)),
    (26.2, taper(full, 26.2)),
    (CROWN_EAVE, full),
  ]
  for (low, a), (high, b), color in zip(
    stages[:-1], stages[1:], (0x5C5F60, 0x3C4348, 0xADAFA5), strict=True
  ):
    shell_side(mesh, a, b, low, high, color)
  shaft = shaft_ring()
  shell_side(mesh, shaft, shaft, GROUND_Y, CROWN_BASE, 0xB8B4A3)
  mesh.surface(taper(full, CROWN_BASE).difference(shaft), CROWN_BASE, rgb(0x545654))
  for y, landing in stair_landings(full):
    mesh.surface(landing, y + 0.42, rgb(0xC3BEA9))
    mesh.surface(landing, y, rgb(0x8B887C))
    shell_side(mesh, landing, landing, y, y + 0.42, 0xAAA591)
    counts["sideLandings"] += 1
  # Narrow dark mullions follow the measured long flat facets. Pale frame and
  # three lower glazing bands reflect the September 2026 district photographs.
  outline = list(orient_polygons(full, exterior_cw=True).exterior.coords)
  cx, cz = CROWN_CENTER
  for i, (a, b) in enumerate(zip(outline[:-1], outline[1:], strict=True)):
    length = math.dist(a, b)
    if not 1.7 < length < 7.8:
      continue
    out = np.array([a[1] - b[1], b[0] - a[0]]) / length
    # Offset to the exterior is independent of the source ring winding.
    mid = (np.array(a) + b) / 2
    if full.covers(Point(mid + out * 0.12)):
      out = -out
    first, last = (
      np.array(a) * 0.86 + np.array(b) * 0.14,
      np.array(a) * 0.14 + np.array(b) * 0.86,
    )

    top = min(sample_roof(roofs, *(q - out * 0.08)) for q in (first, mid, last))
    if not math.isfinite(top):
      continue

    def facade_panel(lo, hi, color, proud):
      hi = min(hi, top - 0.06)
      if hi <= lo + 0.06:
        return
      p, q = first + out * proud, last + out * proud
      quad(
        mesh,
        [(p[0], lo, p[1]), (q[0], lo, q[1]), (q[0], hi, q[1]), (p[0], hi, p[1])],
        color,
      )
      counts["bands"] += 1

    facade_panel(29.18, 32.0, 0x2E3941, 0.06)
    facade_panel(34.25, 36.36, 0x40525D, 0.06)
    facade_panel(39.02, 41.15, 0x555E61, 0.06)
    facade_panel(32.05, 32.36, 0xD7D2BE, 0.11)
    facade_panel(36.4, 36.69, 0xD7D2BE, 0.11)
    # A handful of visibly coloured lower fascia fields, not a graffiti image.
    if i % 4 == 0:
      facade_panel(29.02, 29.3, (0xA55B4F, 0x6D8F9A, 0xB49B65)[i % 3], 0.095)
    p = np.array(a) + out * 0.12
    q = p + (np.array(b) - a) * min(0.18 / length, 0.15)
    core = np.array([cx, cz])
    rim = [(CROWN_BASE, 0.36), (CROWN_EAVE, 1), (top - 0.05, 1)]
    for (lo, lf), (hi, hf) in zip(rim[:-1], rim[1:], strict=True):
      u, v = core + (p - core) * lf, core + (q - core) * lf
      U, V = core + (p - core) * hf, core + (q - core) * hf
      quad(
        mesh,
        [(u[0], lo, u[1]), (v[0], lo, v[1]), (V[0], hi, V[1]), (U[0], hi, U[1])],
        0x4E5355,
      )
  ox, oz = mesh.origin_x, mesh.origin_z
  nav = list(cap_nav(shaft, GROUND_Y, CROWN_BASE, "bierpinsel-v327-shaft", ox, oz))
  # Elevated taper solids have different supports at different heights. No
  # crown footprint is made solid at ground or at bridge deck level.
  for index, ((lo, p), (hi, _)) in enumerate(zip(stages[:-1], stages[1:], strict=True)):
    nav.extend(cap_nav(p, lo, hi, f"bierpinsel-v327-taper-{index}", ox, oz))
  for index, (y, landing) in enumerate(stair_landings(full)):
    nav.extend(
      cap_nav(landing, y, y + 0.42, f"bierpinsel-v327-landing-{index}", ox, oz)
    )
  for part in family["parts"]:
    nav.extend(
      cap_nav(
        part_footprint(part),
        CROWN_EAVE,
        part["topY"] + offset,
        part["id"],
        ox,
        oz,
        surface_roofs(part, offset),
      )
    )
  return nav, counts


def sample_roof(roof, x, z):
  """The highest actual sheet crossing a vertical column centre."""
  top = -math.inf
  for a, b, c in roof:
    den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
    if abs(den) <= 1e-12:
      continue
    u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den
    w = 1 - u - v
    if min(u, v, w) >= -1e-8:
      top = max(top, u * a[1] + v * b[1] + w * c[1])
  return top


def native_model(mesh, key, family, original_support, outside):
  # The cardinal model uses source-roof samples and an independent occupied
  # voxel column construction. No Drawn triangles or tilted fittings enter it.
  footprint = shape(family["footprint"])
  offset = GROUND_Y - min(p["groundY"] for p in family["parts"])
  roofs = [t for p in family["parts"] for t in surface_roofs(p, offset)]
  tower = [
    t for p in family["parts"] if p["id"] == TOWER for t in surface_roofs(p, offset)
  ]
  shaft = shaft_ring() if key == "bierpinsel" else None
  landings = list(stair_landings(footprint)) if key == "bierpinsel" else []
  x0, z0, x1, z1 = footprint.bounds
  grid = 2 if key == "titania" else 1
  cells, columns = {}, {}
  for x in range(math.floor(x0 / grid), math.ceil(x1 / grid)):
    for z in range(math.floor(z0 / grid), math.ceil(z1 / grid)):
      p = Point((x + 0.5) * grid, (z + 0.5) * grid)
      square = box(x * grid, z * grid, (x + 1) * grid, (z + 1) * grid)
      if (
        not footprint.covers(p)
        or not original_support.covers(square)
        or outside.intersection(square).area > 1e-8
      ):
        continue
      highest = sample_roof(roofs, p.x, p.y)
      if not math.isfinite(highest):
        continue
      if key == "bierpinsel":
        low = (
          GROUND_Y
          if shaft.covers(p)
          else next(
            (
              y
              for y in range(math.ceil(CROWN_BASE), math.ceil(CROWN_EAVE) + 1)
              if taper(footprint, y).covers(p)
            ),
            math.inf,
          )
        )
      else:
        low = GROUND_Y
      if not math.isfinite(low):
        continue
      lo, hi = round(low - GROUND_Y), round(highest - GROUND_Y)
      if hi <= lo:
        continue
      levels = set(range(lo, hi))
      is_tower = math.isfinite(sample_roof(tower, p.x, p.y))
      corner = -3152 < p.x < -3140 and 6031 < p.y < 6048
      for y in range(lo, hi):
        level = GROUND_Y + y
        if key == "bierpinsel":
          color = (
            0xB8B4A3
            if level < CROWN_BASE
            else 0x51585A
            if level < 28
            else 0x35444D
            if y % 5 < 2
            else 0xB6B7AD
          )
        elif is_tower and level >= 13:
          color = 0x293740 if y % 2 else 0xE0D8C6
        elif corner and level <= 9:
          color = 0x4B605E if level <= 7 else 0x262F31 if level == 8 else 0xD9D1BE
        else:
          color = 0xA78E75 if y in (5, 9, 14) else 0xB59C82
        cells[x, y, z] = rgb(color)
      for y, landing in landings:
        level = round(y - GROUND_Y)
        if landing.covers(p) and level not in levels:
          cells[x, level, z] = rgb(0xAAA591)
          levels.add(level)
      bottom = min(levels)
      for level in range(bottom, max(levels) + 2):
        if level not in levels and bottom < level:
          columns.setdefault((bottom, level), []).append(square)
        if level not in levels:
          bottom = level + 1
  if not cells:
    raise ValueError("No source-bound native cardinal columns")
  triangles = 0
  for t, color in merged_cell_faces(cells, 1):
    a, b, c = t
    if (
      a[1] == b[1] == c[1]
      and (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]) < 0
    ):
      color = rgb(0x68665F)
    mesh.triangle([(x * grid, y + GROUND_Y, z * grid) for x, y, z in t], color)
    triangles += 1
  nav = []
  for (lo, hi), squares in sorted(columns.items()):
    coverage = unary_union(squares).simplify(0)
    for p in cap_nav(
      coverage,
      GROUND_Y + lo,
      GROUND_Y + hi,
      f"{key}-native-v327-{lo}-{hi}",
      mesh.origin_x,
      mesh.origin_z,
    ):
      nav.append(p)
  return nav, {
    "occupiedVoxels": len(cells),
    "cardinalColumns": sum(map(len, columns.values())),
    "triangles": triangles,
    "verticalIntervals": len(columns),
  }


def records(chunk):
  return [
    {"mesh": i, "kind": m["kind"], "fingerprint": fingerprint(m)}
    for i, m in enumerate(chunk["meshes"])
  ]


def compile_packets():
  owners = {key: source_family(key) for key in FAMILIES}
  path_list = [PUBLIC / name for name in PACKET_SHAS]
  for path in path_list:
    if sha(path) != PACKET_SHAS[path.name]:
      raise ValueError(f"Unexpected published original bytes: {path.name}")
  run = subprocess.run(
    [
      "bun",
      str(APP / "scripts/capture-schlossstrasse-predecessors-v327.ts"),
      *map(str, path_list),
    ],
    cwd=APP,
    capture_output=True,
    text=True,
    check=False,
  )
  if run.returncode:
    raise ValueError(run.stderr)
  predecessors = json.loads(run.stdout)
  plans, evidence = {}, {}
  for key, family in owners.items():
    for mode in ("drawn", "minecraft"):
      native = mode == "minecraft"
      name = f"{family['packet']}.{mode}.json.gz"
      path = PUBLIC / name
      raw = read(path)
      pred = predecessors[name]
      prepared = pred.pop("prepared")
      ox, _, oz = raw["origin"]
      retire, lines, old_nav = original(key, family, raw, native)
      if packed_rows(prepared["meshes"][0]) != packed_rows(raw["meshes"][0]):
        raise ValueError("Previous modification changed the original target mesh")
      if any(n not in prepared["nav"]["buildings"] for n in old_nav):
        raise ValueError("Previous modification owns the same navigation")
      if prepared.get("lines") != raw.get("lines"):
        raise ValueError("Previous modification owns the same source ink stream")
      mesh = PackedMesh(ox, oz)
      if native:
        support = from_nav(old_nav[0], ox, oz)
        nearby = unary_union(
          [
            q
            for n in raw["nav"]["buildings"]
            if n not in old_nav
            if (q := from_nav(n, ox, oz)).intersects(support)
          ]
        )
        append_nav, counts = native_model(mesh, key, family, support, nearby)
      else:
        append_nav, counts = (titania if key == "titania" else bierpinsel)(mesh, family)
      append = mesh.payload(KIND)
      if not append:
        raise ValueError("The new source body is empty")
      plan_key = f"{mode}:{family['packet']}"
      plans[plan_key] = {
        "origin": raw["origin"],
        "records": records(raw),
        "preparedRecords": records(prepared),
        **pred,
        "append": append,
        "appendFingerprint": fingerprint(append),
        "retire": [{"mesh": 0, "triangles": retire}],
        "retireLines": lines,
        "retireNav": old_nav,
        "appendNav": append_nav,
        "owners": [family["id"]],
      }
      if len(mesh.vertices) * 12 + len(mesh.indices) * 4 > 130 * 1024:
        raise ValueError(
          f"New source geometry exceeds the finite V327 allowance: {plan_key}, {len(mesh.vertices)} vertices, {len(mesh.indices)} indices"
        )
      evidence[plan_key] = {
        "oldPacketSha256": PACKET_SHAS[name],
        "retiredTriangles": len(retire),
        "retiredInkSegments": len(lines),
        "appendVertices": len(mesh.vertices),
        "appendTriangles": len(mesh.indices) // 3,
        "appendNavSolids": len(append_nav),
        "construction": counts,
      }
  return {"schemaVersion": 1, "keys": list(plans), "packets": plans}, {
    "schemaVersion": 1,
    "archiveSha256": SHA,
    "archive": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_386_5813.zip",
    "sourceFamilies": owners,
    "packets": evidence,
  }


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--output", type=Path, default=APP / "src/data/schlossstrasseV327Packets.json"
  )
  parser.add_argument(
    "--evidence", type=Path, default=GEO / "schlossstrasse-v327-source.json.gz"
  )
  args = parser.parse_args()
  plans, evidence = compile_packets()
  write(args.output, plans)
  write(args.evidence, evidence)
  print(json.dumps(evidence["packets"], indent=2))


if __name__ == "__main__":
  main()
