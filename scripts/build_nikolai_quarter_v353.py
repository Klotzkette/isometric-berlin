"""Photo-bound Nikolaikirchplatz fronts over exact retained LoD2 owners.

The old window layers are independently regenerated and matched by centimetre
triangle identity. Native replacements use actual cardinal predecessor faces.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

from scripts import build_alt_mitte_v169 as old
from scripts.alt_mitte_v169_packets import append_ink, empty_packet
from scripts.build_cluster_facades_v320 import part_fingerprint
from scripts.build_fuel_packets_v351 import Mesh, rgb
from scripts.build_karl_marx_allee_v161 import Detail, native_detail
from scripts.build_mcdonalds_inventory_v351 import read, write
from scripts.build_nikolaiviertel_v239 import architectural_details
from scripts.build_scheunenviertel_v168 import merge_native_faces

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
TASK = Path(
  "/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/city-v353/quarter"
)
KIND = "nikolai-quarter-v353"
BALCONY = "DEBE00YYUf00009S"
INK_HOST = "4_0-alt-mitte-v169-1"
SOURCE = GEO / "nikolaiviertel-v239-source.json.gz"
REFS = [
  "https://www.berlin.museum/museum/knoblauchhaus",
  "https://www.berlin.museum/wp-content/uploads/2025/07/museum-knoblauchhaus-bei-nacht.jpg",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011272",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011266",
  "https://berlin-nikolaiviertel.com/2024/09/lessing-mendelsohn-und-die-buergerhaeuser-am-nikolaikirchplatz/",
  "https://berlin-nikolaiviertel.com/wp-content/uploads/2024/10/IMG_8613.jpg",
  "https://berlin-nikolaiviertel.com/wp-content/uploads/2024/10/IMG_8611.jpg",
  "https://berlin-nikolaiviertel.com/wp-content/uploads/2024/10/IMG_8612.jpg",
  "https://berlin-nikolaiviertel.com/wp-content/uploads/2024/10/IMG_4201.jpg",
  "https://berlin-nikolaiviertel.com/restaurants-berlin-nikolaiviertel/zum-nussbaum/",
  "https://berlin-nikolaiviertel.com/wp-content/uploads/2023/11/zum-nussbaum-IMG_5941.jpg",
  "https://berlin-nikolaiviertel.com/wp-content/uploads/2023/11/zum-nussbaum-IMG_5945.jpg",
  "https://www.berlin.museum/museum/ephraim-palais",
  "https://www.berlin.museum/wp-content/uploads/2022/09/DSC186350_1920px.jpg",
]


def profile(key, owner, part, a, b, levels, bays, top, color, style, **extra):
  return dict(
    key=key,
    owner="DEBE01YYK" + owner,
    part=part,
    a=a,
    b=b,
    levels=levels,
    bays=bays,
    top=top,
    color=color,
    style=style,
    **extra,
  )


# Coordinates are literal selected source wall endpoints. Facade layout is a
# photographic interpretation, never a measured aperture or entrance survey.
PROFILES = [
  profile(
    "knoblauch-square",
    "00003ze",
    "DEBE3DlJnINt5Big",
    [2396.510, 327.875],
    [2404.182, 317.278],
    3,
    6,
    16.524,
    [226, 218, 200],
    "knoblauch",
    blind=[1, 4],
  ),
  profile(
    "knoblauch-post",
    "00003ze",
    "DEBE3DlJnINt5Big",
    [2406.631, 337.284],
    [2396.510, 327.875],
    3,
    7,
    16.524,
    [226, 218, 200],
    "knoblauch",
    curve=True,
  ),
  profile(
    "post19-front",
    "00005JA",
    "DEBE01YYK00005JA",
    [2440.270, 331.732],
    [2445.764, 324.668],
    3,
    4,
    17.344,
    [228, 220, 204],
    "classic",
  ),
  profile(
    "pink-front",
    "00007so",
    "DEBE01YYK00007so",
    [2445.764, 324.668],
    [2453.397, 316.604],
    3,
    4,
    17.432,
    [199, 166, 159],
    "classic",
  ),
  profile(
    "tall-cream-front",
    "00001s9",
    "DEBE3Dk70lhyuCNj",
    [2453.591, 316.397],
    [2457.387, 312.890],
    3,
    3,
    16.595,
    [231, 223, 203],
    "classic",
  ),
  profile(
    "gedenkbibliothek-front",
    "00001s9",
    "DEBE3DOeOf4u3DjS",
    [2457.387, 312.890],
    [2461.159, 309.591],
    2,
    3,
    13.202,
    [224, 219, 195],
    "library",
    dormer=True,
  ),
  profile(
    "low-cream-front",
    "0000B7V",
    "DEBE01YYK0000B7V",
    [2461.353, 309.425],
    [2467.854, 304.620],
    2,
    5,
    13.219,
    [232, 226, 209],
    "low",
    dormer=True,
  ),
  profile(
    "lessing-front",
    "0000BYA",
    "DEBE3DtW12Qt9IoL",
    [2472.499, 303.798],
    [2475.366, 300.593],
    3,
    3,
    16.549,
    [227, 214, 190],
    "lessing",
  ),
  profile(
    "padden-front",
    "0000BYA",
    "DEBE3DryKhkIGEFh",
    [2475.626, 300.301],
    [2483.855, 291.071],
    3,
    5,
    16.492,
    [226, 221, 210],
    "classic",
  ),
  profile(
    "nussbaum-gable",
    "00009i8",
    "DEBE3Dfe9lRwmySx",
    [2420.414, 249.357],
    [2412.910, 254.197],
    2,
    4,
    14.830,
    [224, 219, 202],
    "nussbaum",
    facadeTop=9.415,
    gable=True,
  ),
  profile(
    "nussbaum-long",
    "00009i8",
    "DEBE3Dfe9lRwmySx",
    [2412.910, 254.197],
    [2407.779, 246.242],
    2,
    3,
    9.415,
    [224, 219, 202],
    "nussbaum",
  ),
  profile(
    "ephraim-corner",
    "00004FS",
    "DEBE01YYK00004FS",
    [2424.287, 384.024],
    [2424.317, 397.663],
    4,
    3,
    22.969,
    [222, 213, 191],
    "palais",
    curve=True,
    curveTolerance=3.1,
  ),
  profile(
    "ephraim-north-wing",
    "00004FS",
    "DEBE01YYK00004FS",
    [2419.757, 378.268],
    [2424.124, 384.151],
    4,
    3,
    22.969,
    [222, 213, 191],
    "palais",
  ),
  profile(
    "ephraim-south-wing",
    "00004FS",
    "DEBE01YYK00004FS",
    [2424.159, 397.550],
    [2419.756, 403.546],
    4,
    3,
    22.969,
    [222, 213, 191],
    "palais",
  ),
]


def basis(p):
  a, b = np.array(p["a"]), np.array(p["b"])
  length = float(np.linalg.norm(b - a))
  d = (b - a) / length
  n = np.array([d[1], -d[0]])
  return a, d, n, length


def key(points):
  origin = np.array([2048, -10, 0])
  return tuple(
    sorted(
      tuple(
        round(float(v)) + int(o * 100)
        for v, o in zip((np.array(p) - origin) * 100, origin, strict=True)
      )
      for p in points
    )
  )


def unpack(mesh, origin):
  p = (
    np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(-1, 3) / 100
    + origin
  )
  i = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
  c = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
  return [(p[t], c[t]) for t in i]


def selected(p, points, tolerance=0.23):
  a, d, n, length = basis(p)
  q = np.array(points)
  u = (q[:, [0, 2]] - a) @ d
  # The Poststraße front is gently bowed and keeps its literal source chords.
  gap = abs((q[:, [0, 2]] - a) @ n)
  return (
    min(u) > -0.25
    and max(u) < length + 0.25
    and max(gap) < (p.get("curveTolerance", 1.1) if p.get("curve") else tolerance)
    and min(q[:, 1]) >= 2.95
    and max(q[:, 1]) <= p["top"] + 0.32
  )


def same_source_faces(source, p):
  owner = next(b for b in source["buildings"] if b["id"] == p["owner"])
  part = next(b for b in owner["parts"] if b["id"] == p["part"])
  return [
    s
    for s in part["surfaces"]
    if s["kind"] == "WallSurface" and selected(p, s["rings"][0], 0.24)
  ]


def patches(mesh, p, faces, rectangle, color, offset=0.04):
  """Clip in photographic u/y, lift onto each actual Drawn/cardinal wall."""
  a, d, _, _ = basis(p)
  count = 0
  for points in faces:
    q = np.array(points)
    norm = np.cross(q[1] - q[0], q[2] - q[0])
    mag = np.linalg.norm(norm)
    if mag < 1e-7 or abs(norm[1] / mag) > 0.01:
      continue
    norm /= mag
    if np.dot(norm[[0, 2]], basis(p)[2]) < 0.2:
      norm = -norm
    uv = np.column_stack(((q[:, [0, 2]] - a) @ d, q[:, 1]))
    field = Polygon(uv).buffer(0).intersection(rectangle)
    if field.is_empty or field.area < 0.0002:
      continue
    # Actual supporting plane determines cardinality and position.
    tangent = np.array([-norm[2], norm[0]])
    denom = float(tangent @ d)
    if abs(denom) < 0.1:
      continue
    ubase = float((q[0, [0, 2]] - a) @ d)
    for tri in shapely.constrained_delaunay_triangles(field).geoms:
      pts = []
      for u, y in list(tri.exterior.coords)[:3]:
        xz = q[0, [0, 2]] + tangent * ((u - ubase) / denom) + norm[[0, 2]] * offset
        pts.append([xz[0], y, xz[1]])
      if (
        np.dot(np.cross(np.subtract(pts[1], pts[0]), np.subtract(pts[2], pts[0])), norm)
        < 0
      ):
        pts.reverse()
      mesh.triangle(pts, [rgb(color)] * 3)
      count += 1
  return count


def ornament(mesh, p, faces, native):
  """Distinct photographed bay counts, blind panels, timber sashes and bands."""
  _, _, _, width = basis(p)
  base = 3.0
  top = p["top"]
  trim = [240, 232, 212]
  shadow = [153, 145, 128]
  wood = [69, 59, 46]
  glass = [87, 103, 103]
  low = top - 3.05 if p.get("dormer") else p.get("facadeTop", top)
  pitch = (low - base) / p["levels"]
  bay = width / p["bays"]

  def rect(u, y, w, h, c, off=0.055):
    return patches(
      mesh, p, faces, box(u - w / 2, y - h / 2, u + w / 2, y + h / 2), c, off
    )

  count = 0
  count += rect(width / 2, base + 0.27, width, 0.54, [164, 158, 144])
  for y in [base + pitch, low - 0.23, low - 0.46]:
    count += rect(width / 2, y, width, 0.16, trim, 0.10)
  for row in range(p["levels"]):
    for col in range(p["bays"]):
      yc = base + (row + 0.53) * pitch
      wh = min(2.35, pitch * 0.59)
      ww = min(1.30, bay * 0.59)
      u = (col + 0.5) * bay
      blind = row > 0 and col in p.get("blind", [])
      # Documented Lessing portal is the rightmost bay as viewed from street.
      # u follows the street panorama right-to-left, hence bay zero.
      door = p["style"] == "lessing" and row == 0 and col == 0
      if door:
        wh = pitch * 0.75
        yc = base + wh / 2 + 0.32
      count += rect(u, yc, ww + 0.23, wh + 0.22, trim, 0.065)
      count += rect(u, yc, ww + 0.04, wh + 0.04, shadow, 0.08)
      count += rect(u, yc, ww, wh, p["color"] if blind else wood, 0.095)
      if not blind:
        if door:
          for yy in [yc - 0.65, yc + 0.35]:
            count += rect(u, yy, ww - 0.17, 0.08, [110, 88, 61], 0.13)
        else:
          count += rect(u, yc, ww - 0.18, wh - 0.16, glass, 0.12)
          count += rect(u, yc, 0.055, wh, wood, 0.15)
          for yy in [yc - wh * 0.23, yc + wh * 0.19]:
            count += rect(u, yy, ww, 0.055, wood, 0.15)
      count += rect(u, yc - wh / 2 - 0.12, ww + 0.35, 0.13, trim, 0.17)
      if p["style"] == "classic" and row == 1:
        count += rect(u, yc + wh / 2 + 0.25, ww + 0.48, 0.12, trim, 0.17)
      if p["style"] in ["low", "lessing"] and row > 0:
        count += rect(u, yc - wh / 2 - 0.52, ww * 0.85, 0.36, p["color"], 0.10)
  if p["style"] == "nussbaum":
    count += rect(
      width / 2, base + pitch * 0.46, width, pitch * 0.92, [213, 201, 161], 0.075
    )
    # Repaint the low plinth field before adding its actual broad sashes,
    # dark timber shutters and the common pub name band.
    for yy in np.arange(base + 0.45, base + pitch, 0.5):
      count += rect(width / 2, yy, width, 0.045, [141, 136, 119], 0.09)
    for col in range(p["bays"]):
      u = (col + 0.5) * bay
      ww = min(1.25, bay * 0.56)
      yc = base + 1.25
      count += rect(u, yc, ww, 1.65, trim, 0.12)
      count += rect(u, yc, ww - 0.15, 1.48, glass, 0.15)
      count += rect(u, yc, 0.07, 1.6, trim, 0.18)
      count += rect(u, yc + 0.32, ww, 0.06, trim, 0.18)
      for du in [-1, 1]:
        count += rect(u + du * (ww / 2 + 0.23), yc, 0.31, 1.72, [64, 58, 44], 0.14)
    count += rect(
      width / 2, base + pitch + 0.12, width * 0.72, 0.36, [233, 224, 202], 0.13
    )
    if p.get("gable"):
      for u in [width * 0.38, width * 0.62]:
        count += rect(u, 10.7, 0.88, 1.42, wood, 0.1)
        count += rect(u, 10.7, 0.69, 1.23, trim, 0.12)
        count += rect(u, 10.7, 0.045, 1.25, wood, 0.15)
      for u in [width * 0.46, width * 0.56]:
        count += rect(u, 13.3, 0.32, 0.51, wood, 0.1)
  if p["style"] == "palais":
    for col in range(p["bays"] + 1):
      u = col * bay
      for du in [-0.12, 0.12]:
        count += rect(u + du, (base + top) / 2, 0.16, top - base - 0.65, trim, 0.16)
    for row in range(1, 4):
      yy = base + pitch * row
      count += rect(width / 2, yy, width, 0.22, trim, 0.15)
      if p.get("curve"):
        count += rect(width / 2, yy + 0.83, width, 0.06, [157, 126, 53], 0.19)
        for u in np.arange(0.18, width, 0.40):
          count += patches(
            mesh,
            p,
            faces,
            Polygon(
              [
                (u - 0.13, yy + 0.45),
                (u, yy + 0.78),
                (u + 0.13, yy + 0.45),
                (u, yy + 0.12),
              ]
            ),
            [165, 133, 57],
            0.19,
          )
  if p["style"] == "knoblauch":
    y = base + pitch * 2 - 0.1
    count += rect(width / 2, y, width, 0.42, trim, 0.12)
    # Small relief lozenges evoke the documented running vine frieze; these
    # are a display abstraction, not a tracing or exact sculptural survey.
    for u in np.arange(0.4, width - 0.15, 0.48):
      count += patches(
        mesh,
        p,
        faces,
        Polygon([(u - 0.17, y), (u, y + 0.12), (u + 0.17, y), (u, y - 0.12)]),
        [193, 182, 154],
        0.16,
      )
  if p["style"] == "library":
    count += rect(width / 2, base + pitch + 0.40, width, 0.50, [215, 207, 177], 0.14)
    for yy in np.arange(base + 0.65, base + pitch, 0.58):
      count += rect(width / 2, yy, width, 0.035, shadow, 0.065)
  if p.get("dormer"):
    count += rect(width / 2, (low + top) / 2, width, top - low, [79, 64, 52], 0.055)
    for col in range(p["bays"]):
      u = (col + 0.5) * bay
      y = low + 1.5
      count += rect(u, y, min(1.2, bay * 0.66), 1.28, [120, 98, 72], 0.08)
      count += rect(u, y, min(1.02, bay * 0.53), 1.1, glass, 0.1)
      count += rect(u, y, 0.05, 1.2, wood, 0.13)
      count += rect(u, y, min(1.1, bay * 0.6), 0.05, wood, 0.13)
    count += rect(width / 2, low + 0.35, width, 0.15, [119, 83, 62], 0.14)
    count += rect(width / 2, top - 0.13, width, 0.20, wood, 0.16)
  if p["style"] == "lessing":
    # Public commemorative plaque: no fabricated inscription.
    count += rect(
      width / 2, base + pitch - 0.78, width * 0.39, 1.25, [63, 66, 53], 0.18
    )
    for u in np.linspace(0.25, width - 0.25, 4):
      count += rect(u, base + pitch - 0.30, 0.20, 0.72, wood, 0.21)
  return count


def balcony_model(mesh, cap_mesh, record, native):
  """Open balconies replace the exact LoD2 balcony strip's false solid extrusion."""
  source_poly = old.footprint(record)
  footprint = source_poly
  if native:
    # Independently constructed quarter-metre cardinal skin on the mapped strip.
    x0, z0, x1, z1 = source_poly.bounds
    footprint = unary_union(
      [
        box(x / 4, z / 4, (x + 1) / 4, (z + 1) / 4)
        for x in range(math.floor(x0 * 4), math.ceil(x1 * 4))
        for z in range(math.floor(z0 * 4), math.ceil(z1 * 4))
        if source_poly.covers(Point((x + 0.5) / 4, (z + 0.5) / 4))
      ]
    )
  front = LineString(
    [
      (2425.522, 383.218),
      (2426.731, 384.84),
      (2428.181, 386.948),
      (2428.63, 388.016),
      (2428.909, 389.132),
      (2428.934, 392.532),
      (2428.653, 393.646),
      (2428.203, 394.698),
      (2426.743, 396.84),
      (2425.542, 398.457),
    ]
  )
  nav = []

  def solid(poly, lo, hi, color, label, target=mesh):
    target.prism(poly, lo, hi, rgb(color))
    for n, piece in enumerate(getattr(poly, "geoms", [poly])):
      if piece.geom_type != "Polygon":
        continue
      nav.append(
        dict(
          ring=[
            [round(x - 2048, 3), round(z, 3)]
            for x, z in list(piece.exterior.coords)[:-1]
          ],
          holes=[
            [[round(x - 2048, 3), round(z, 3)] for x, z in list(r.coords)[:-1]]
            for r in piece.interiors
          ],
          sourceId=f"{KIND}:ephraim-balcony:{label}:{n}",
          minHeight=lo - 3,
          height=hi - 3,
          heightSource="existing LoD2 balcony footprint; photo-estimated open slab and column heights",
        )
      )

  levels = [3 + (22.969 - 3) / 4 * i for i in [1, 2, 3]]
  for i, y in enumerate(levels):
    solid(footprint, y - 0.24, y, [213, 202, 177], f"slab-{i}")
  # The upper cornice is the companion's nonempty successor geometry.
  solid(footprint, 22.65, 22.90, [216, 204, 180], "cornice", cap_mesh)
  for i, t in enumerate([0.06, 0.23, 0.41, 0.59, 0.77, 0.94]):
    pt = front.interpolate(t, normalized=True)
    if native:
      cx, cz = round(pt.x * 4) / 4, round(pt.y * 4) / 4
      column = box(cx - 0.25, cz - 0.25, cx + 0.25, cz + 0.25)
    else:
      column = Point(pt.x, pt.y).buffer(0.25, quad_segs=3)
    solid(column, 3, levels[0] - 0.24, [208, 198, 176], f"column-{i}")
  # Continuous dark/gold rails and closely spaced open balusters. The original
  # decorative back-wall fittings remain; these sit on the actual outer strip.
  for row, y in enumerate(levels):
    for j in range(3):
      yy = y + 0.18 + j * 0.37
      if native:
        edge = footprint.difference(footprint.buffer(-0.06, join_style=2))
        mesh.prism(edge, yy, yy + 0.05, rgb([140, 111, 46]))
      else:
        for a, b in zip(front.coords, list(front.coords)[1:]):
          rail = LineString([a, b]).buffer(0.035, cap_style=2)
          mesh.prism(rail, yy, yy + 0.05, rgb([140, 111, 46]))
    for j in range(1, 47):
      pt = front.interpolate(j / 47, normalized=True)
      if native:
        cx, cz = round(pt.x * 4) / 4, round(pt.y * 4) / 4
      else:
        cx, cz = pt.x, pt.y
      mesh.prism(
        box(cx - 0.025, cz - 0.025, cx + 0.025, cz + 0.025),
        y + 0.12,
        y + 0.99,
        rgb([146, 116, 47]),
      )
  return nav


def build():
  source = read(SOURCE)
  balcony = next(
    b
    for b in read(GEO / "alt-mitte-v169/source-391_5819-00.json.gz")["buildings"]
    if b["id"] == BALCONY
  )
  occupied = unary_union(
    [
      old.footprint(b)
      for b in read(GEO / "alt-mitte-v169/source-391_5819-00.json.gz")["buildings"]
    ]
  )
  # Reproduce the exact v169 colour grouping before cardinal coplanar merging.
  ranks = {}
  old.APPEARANCE.clear()
  for previous in read(GEO / "alt-mitte-v169/appearance-baseline.json.gz")["records"]:
    for binding in previous["bindings"]:
      for part in binding["parts"]:
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if rank > ranks.get(part["partId"], (False, -1)):
          old.APPEARANCE[part["partId"]] = previous
          ranks[part["partId"]] = rank
  records = {b["id"]: b for b in source["buildings"]}
  records[BALCONY] = balcony
  owners = {p["owner"] for p in PROFILES}
  oldkeys = {}
  nativekeys = {}
  bodykeys = {}
  roofkeys = {}
  roofcolors = {}
  rooflow = {}
  surfaces = {}
  for owner in owners | {BALCONY}:
    shell, front, _, _ = old.model(records[owner], occupied)
    full = Detail()
    full.triangles = shell.triangles + front.triangles
    oldkeys[owner] = {key(t) for t, c, r in full.triangles}
    bodykeys[owner] = {key(t) for t, c, r in shell.triangles}
    roofkeys[owner] = {
      key(t) for t, c, r in shell.triangles if r == "source RoofSurface"
    }
    roofcolors[owner] = {
      rgb(c) for t, c, r in shell.triangles if r == "source RoofSurface"
    }
    rooflow[owner] = min(
      q[1] for t, c, r in shell.triangles if r == "source RoofSurface" for q in t
    )
    nat = merge_native_faces(native_detail(full))
    nativekeys[owner] = {key(t) for t, c, r in nat.triangles}
  write(
    TASK / "native-key-cache.json.gz",
    {o: [list(k) for k in ks] for o, ks in nativekeys.items()},
  )
  for p in PROFILES:
    fs = same_source_faces(source, p)
    assert fs, p["key"]
    surfaces[p["key"]] = fs
  evidence = []
  sources = []
  plans = {}
  for mode in ["drawn", "minecraft"]:
    native = mode == "minecraft"
    main = read(TASK / "support" / f"{mode}-4_0.json.gz")
    fittings = read(TASK / "support" / f"{mode}-nikolai239-4_0.json.gz")
    assert not main["declined"] and not fittings["declined"]
    outputs = {
      id: Mesh(c["prepared"]["origin"])
      for id, c in [("4_0", main), ("nikolai239-4_0", fittings)]
    }
    if not native:
      ink = read(TASK / "support" / f"drawn-{INK_HOST}.json.gz")
      outputs[INK_HOST] = Mesh(ink["prepared"]["origin"])
    retired = {id: defaultdict(list) for id in outputs}
    facegroups = defaultdict(list)
    retiredreceipts = []
    for mi, m in enumerate(main["prepared"]["meshes"]):
      if m["kind"] != "alt-mitte-v169":
        continue
      for ti, (pts, colors) in enumerate(
        unpack(m, np.array(main["prepared"]["origin"]))
      ):
        if (
          pts[:, 0].max() < 2370
          or pts[:, 0].min() > 2490
          or pts[:, 2].max() < 235
          or pts[:, 2].min() > 420
        ):
          continue
        normal = np.cross(pts[1] - pts[0], pts[2] - pts[0])
        mag = np.linalg.norm(normal)
        if mag < 1e-6:
          continue
        normal /= mag
        candidates = []
        triangle_key = key(pts)
        if triangle_key in (nativekeys[BALCONY] if native else oldkeys[BALCONY]):
          retired["4_0"][mi].append(ti)
          retiredreceipts.append(
            dict(
              host="4_0",
              mesh=mi,
              triangle=ti,
              owner=BALCONY,
              profile="false-solid-balcony",
              positions=pts.tolist(),
              colors=colors.tolist(),
            )
          )
          continue
        roofowner = (
          next(
            (
              o
              for o in sorted(owners)
              if (
                triangle_key in nativekeys[o]
                and tuple(colors[0]) in roofcolors[o]
                and min(pts[:, 1]) >= rooflow[o] - 2.1
              )
              if native
            ),
            None,
          )
          if native
          else next((o for o in sorted(owners) if triangle_key in roofkeys[o]), None)
        )
        if roofowner:
          retired["4_0"][mi].append(ti)
          retiredreceipts.append(
            dict(
              host="4_0",
              mesh=mi,
              triangle=ti,
              owner=roofowner,
              profile="source-roof-colour",
              positions=pts.tolist(),
              colors=colors.tolist(),
            )
          )
          outputs["4_0"].triangle(pts, [rgb([130, 85, 64])] * 3)
          continue
        for p in PROFILES:
          # Exact identity of the old owner is a prerequisite. A
          # neighbour's coplanar triangle cannot enter by proximity.
          ks = nativekeys[p["owner"]] if native else oldkeys[p["owner"]]
          if triangle_key not in ks:
            continue
          if native:
            a, d, n, length = basis(p)
            u = (pts[:, [0, 2]] - a) @ d
            gap = (pts[:, [0, 2]] - a) @ n
            admitted = (
              abs(normal[1]) < 0.01
              and np.dot(normal[[0, 2]], n) > 0.2
              and max(u) > 0
              and min(u) < length
              and min(gap) > -0.25
              and max(gap) < 2.8 + p.get("curveTolerance", 0)
              and max(pts[:, 1]) > 3
              and min(pts[:, 1]) < p["top"]
            )
          else:
            admitted = selected(p, pts) and (
              abs(normal[1]) < 0.01 or triangle_key not in bodykeys[p["owner"]]
            )
          if admitted:
            candidates.append(p)
        if not candidates:
          continue
        # Shared family corners resolve by nearest literal wall; never
        # authorize the same triangle twice.
        p = min(
          candidates,
          key=lambda p: abs(np.mean((pts[:, [0, 2]] - basis(p)[0]) @ basis(p)[2])),
        )
        retired["4_0"][mi].append(ti)
        retiredreceipts.append(
          dict(
            host="4_0",
            mesh=mi,
            triangle=ti,
            owner=p["owner"],
            profile=p["key"],
            positions=pts.tolist(),
            colors=colors.tolist(),
          )
        )
        # In Drawn distinguish the measured wall plane from its old
        # offset glazing. Native already has a single painted surface.
        gap = np.max(abs((pts[:, [0, 2]] - basis(p)[0]) @ basis(p)[2]))
        isbody = native or triangle_key in bodykeys[p["owner"]]
        if native:
          a, d, _, length = basis(p)
          uv = np.column_stack(((pts[:, [0, 2]] - a) @ d, pts[:, 1]))
          poly = Polygon(uv)
          target = poly.intersection(box(0, 3, length, p["top"]))
          remain = poly.difference(target)
          assert np.all(colors == colors[0]), "nonuniform old Native colour"
          assert abs(target.area + remain.area - poly.area) < 1e-6
          tangent = np.array([-normal[2], normal[0]])
          denom = float(tangent @ d)
          for field, col, isfront in [
            (target, p["color"], True),
            (remain, colors[0].tolist(), False),
          ]:
            if field.is_empty:
              continue
            for tri in shapely.constrained_delaunay_triangles(field).geoms:
              piece = []
              for u, y in list(tri.exterior.coords)[:3]:
                xz = pts[0, [0, 2]] + tangent * ((u - uv[0, 0]) / denom)
                piece.append([xz[0], y, xz[1]])
              if (
                np.dot(
                  np.cross(
                    np.subtract(piece[1], piece[0]), np.subtract(piece[2], piece[0])
                  ),
                  normal,
                )
                < 0
              ):
                piece.reverse()
              outputs["4_0"].triangle(piece, [rgb(col) if isfront else col] * 3)
              if isfront:
                facegroups[p["key"]].append(piece)
        elif isbody:
          outputs["4_0"].triangle(pts, [rgb(p["color"])] * 3)
          facegroups[p["key"]].append(pts.tolist())
    # v239 fittings: regenerate exact old family-only triangles; any detail
    # outside corrected frontages, including church/Ephraim, stays untouched.
    detail, _ = architectural_details(source, native)
    detailmap = defaultdict(list)
    for pts, col, role in detail.triangles:
      for p in PROFILES:
        if selected(p, pts, 2.1 if native else 0.6) and not (
          p["style"] == "palais"
          and role
          in [
            "rococo-paired-pilaster",
            "rounded-palais-belt",
            "palais-gilt-rail",
            "palais-gilt-baluster",
          ]
        ):
          detailmap[key(pts)].append(p)
    for mi, m in enumerate(fittings["prepared"]["meshes"]):
      for ti, (pts, colors) in enumerate(
        unpack(m, np.array(fittings["prepared"]["origin"]))
      ):
        if key(pts) not in detailmap:
          continue
        retired["nikolai239-4_0"][mi].append(ti)
        retiredreceipts.append(
          dict(
            host="nikolai239-4_0",
            mesh=mi,
            triangle=ti,
            owner=detailmap[key(pts)][0]["owner"],
            positions=pts.tolist(),
            colors=colors.tolist(),
          )
        )
    for p in PROFILES:
      fs = facegroups[p["key"]]
      assert fs, (mode, p["key"], "no actual predecessor face")
      count = ornament(outputs["nikolai239-4_0"], p, fs, native)
      assert count > 0
      evidence.append(
        dict(mode=mode, profile=p["key"], supportFaces=len(fs), detailTriangles=count)
      )
    balcony_nav = balcony_model(
      outputs["4_0"], outputs["4_0"] if native else outputs[INK_HOST], balcony, native
    )
    hosts = [("4_0", main), ("nikolai239-4_0", fittings)] + (
      [(INK_HOST, ink)] if not native else []
    )
    for id, c in hosts:
      plan = c["plan"]
      retired_lines = []
      if id == INK_HOST:
        edges = [
          (a, b)
          for part in balcony["parts"]
          for f in part["surfaces"]
          if f["kind"] in ["WallSurface", "RoofSurface", "ClosureSurface"]
          for ring in f["rings"]
          for a, b in zip(ring, ring[1:] + ring[:1])
        ]
        packed = [empty_packet(INK_HOST, [2048, 0, 2560, 512])]
        append_ink(packed, edges, INK_HOST, [2048, 0, 2560, 512])
        expected = {
          tuple(sorted(tuple(v) for v in row))
          for row in np.frombuffer(
            base64.b64decode(packed[-1]["lines"]["positions"]), "<u2"
          ).reshape(-1, 2, 3)
        }
        actual = np.frombuffer(
          base64.b64decode(c["prepared"]["lines"]["positions"]), "<u2"
        ).reshape(-1, 2, 3)
        found = set()
        for i, row in enumerate(actual):
          k = tuple(sorted(tuple(v) for v in row))
          if k in expected:
            retired_lines.append(i)
            found.add(k)
        assert expected == found, ("unmatched balcony ink", len(expected - found))
        write(
          GEO / "nikolai-quarter-v353-balcony-ink.json.gz",
          dict(
            sourceId=BALCONY,
            segments=[
              dict(ordinal=i, positions=actual[i].tolist()) for i in retired_lines
            ],
          ),
        )
      retire_nav = (
        [b for b in c["prepared"]["nav"]["buildings"] if b["sourceId"] == BALCONY]
        if id == "4_0"
        else []
      )
      if id == "4_0":
        assert len(retire_nav) == 1
      append = outputs[id].payload()
      append["kind"] = KIND
      plan.update(
        owners=sorted(owners | {BALCONY}),
        retire=[
          dict(mesh=m, triangles=sorted(set(ts)))
          for m, ts in sorted(retired[id].items())
        ],
        retireLines=retired_lines,
        retireNav=retire_nav,
        appendNav=balcony_nav if id == "4_0" else [],
        append=append,
        appendFingerprint=part_fingerprint(append),
      )
      plans[f"{mode}:{id}"] = plan
    write(TASK / f"{mode}-retirement-receipt.json.gz", retiredreceipts)
    write(GEO / f"nikolai-quarter-v353-{mode}-retirement.json.gz", retiredreceipts)
  for i, (k, plan) in enumerate(plans.items()):
    val = dict(schemaVersion=1, keys=[k], packets={k: plan})
    f = f"nikolaiQuarterV353Packets{i:03d}.json.gz"
    write(DATA / f, val)
    raw = gzip.decompress((DATA / f).read_bytes())
    assert len(raw) < 2 * 1024 * 1024 and (DATA / f).stat().st_size < 512 * 1024
    sources.append(dict(file=f, keys=[k], decodedBytes=len(raw)))
  write(DATA / "nikolaiQuarterV353Index.json", dict(schemaVersion=1, sources=sources))
  write(
    GEO / "nikolai-quarter-v353-source.json.gz",
    dict(
      schemaVersion=1,
      retrieved="2026-11-15",
      references=REFS,
      profiles=PROFILES,
      sourceSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
      buildings=[b for b in source["buildings"] if b["id"] in owners],
      balconySource=balcony,
      balconyCorrection="Photographed open balcony strip DEBE00YYUf00009S was a false solid house extrusion; exact original triangles, ink and navigation preserved in receipts, replaced by open slabs, columns and rails. Slab/column heights are photo estimates.",
      policy="Exact LoD2 wall placement; photographic bay rhythm/materials and fitting sizes are estimates. Retain unrelated triangles, original house roof positions and all ground. Selected tiled roofs recoloured without shape changes. Only the separately archived false-solid balcony family yields to photographed open slabs, supports and matching bounded navigation. No new house entrance.",
    ),
  )
  write(
    GEO / "nikolai-quarter-v353-validation.json.gz",
    dict(
      schemaVersion=1,
      faces=evidence,
      keys=list(plans),
      retired={
        k: sum(len(r["triangles"]) for r in p["retire"]) for k, p in plans.items()
      },
      compressedBytes=sum((DATA / r["file"]).stat().st_size for r in sources),
    ),
  )
  print(json.dumps(read(GEO / "nikolai-quarter-v353-validation.json.gz"), indent=2))


if __name__ == "__main__":
  build()
