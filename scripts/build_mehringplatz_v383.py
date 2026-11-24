"""Bake the measured two housing rings, their open pedestrian level and the elevated station."""

from __future__ import annotations

import base64
import gzip
import json
import math
from pathlib import Path

import numpy as np
import shapely as sh
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

from scripts.build_arbeitsministerium_quartier_v383 import lathe
from scripts.build_kreuzberg_plaetze_v380 import Mesh, polygons, trees

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/mehringplatz-v383.json.gz"
DATA = ROOT / "src/app/src/data/mehringplatzV383"
CENTER = np.array([1329.26, 2246.84])
ORIGIN = [1329, 0, 2260]
BASE = 5.2
PAVING = 5.72
WALL = (211, 205, 181)
CONCRETE = (179, 176, 162)
GLASS = (90, 111, 115)
JOINERY = (167, 170, 157)
SHOP = (81, 102, 103)


def source_poly(rings):
  return Polygon(rings[0], rings[1:]).buffer(0)


def cardinal(g):
  """Keep occupied 0.8 m cells, preserving continuous openings and shared part edges."""
  if g.is_empty:
    return g
  x0, z0, x1, z1 = g.bounds
  step = 0.8
  cx = np.arange(math.floor(x0 / step), math.ceil(x1 / step))
  cz = np.arange(math.floor(z0 / step), math.ceil(z1 / step))
  columns = []
  for j in cz:
    mask = sh.contains_xy(g, (cx + 0.5) * step, np.full(len(cx), (j + 0.5) * step))
    nz = np.flatnonzero(np.diff(np.r_[False, mask, False]))
    for i, k in zip(nz[::2], nz[1::2]):
      columns.append(
        box(cx[i] * step, j * step, (cx[k - 1] + 1) * step, (j + 1) * step)
      )
  return unary_union(columns)


def rings(g):
  for piece in polygons(g):
    for r in [piece.exterior, *piece.interiors]:
      points = list(r.coords)
      for a, b in zip(points, points[1:]):
        a, b = np.array(a), np.array(b)
        width = np.linalg.norm(b - a)
        if width < 0.03:
          continue
        tangent = (b - a) / width
        normal = np.array([-tangent[1], tangent[0]])
        if piece.covers(Point((a + b) * 0.5 + normal * 0.025)):
          normal = -normal
        yield a, b, tangent, normal, width


def extrude(mesh, g, bottom, top, tone):
  if top <= bottom:
    return
  mesh.ground(g, top, tone)
  for a, b, t, n, w in rings(g):
    shade = np.array(tone) * (0.90 + 0.055 * n[0] - 0.04 * n[1])
    mesh.face(
      [
        (a[0], bottom, a[1]),
        (b[0], bottom, b[1]),
        (b[0], top, b[1]),
        (a[0], top, a[1]),
      ],
      shade,
    )


def fill_front(mesh, a, axis, normal, width, old_height, low, kind):
  mid = a + axis * width / 2
  # The arc coordinate keeps successive projected and recessed bay faces in register.
  radial = mid - CENTER
  distance = np.linalg.norm(radial)
  tangent = np.array([-radial[1], radial[0]]) / distance
  sense = 1 if tangent @ axis >= 0 else -1
  run = math.atan2(radial[1], radial[0]) * distance
  pitch = 3.45 if kind == "inner" else 3.05
  if kind == "aok":
    pitch = 2.08

  def plate(left, right, lo, hi, offset, tone):
    left, right = max(0.0, left), min(width, right)
    if right - left < 0.015 or hi - lo < 0.015:
      return
    a1 = a + axis * left + normal * offset
    b1 = a + axis * right + normal * offset
    mesh.face(
      [(a1[0], lo, a1[1]), (b1[0], lo, b1[1]), (b1[0], hi, b1[1]), (a1[0], hi, a1[1])],
      tone,
    )

  def repeats(start, stop, lo, hi, offset, tone):
    center = (run % pitch) * sense
    k0 = math.floor((-width / 2 - center - stop) / pitch)
    for k in range(k0, k0 + int(width / pitch) + 5):
      uu = width / 2 + center + k * pitch
      plate(uu + start, uu + stop, lo, hi, offset, tone)

  top = old_height
  if kind == "inner":
    if low <= BASE + 0.08:
      # The stair towers run to ground between the open pilotis.
      for y in np.arange(BASE + 1.05, top - 1.15, 3.15):
        repeats(-0.64, 0.64, y, y + 0.59, 0.085, (84, 99, 102))
    first = BASE + 3.07
    step = (top - first - 0.48) / 3
    for floor in range(3):
      y = first + step * floor
      repeats(-1.26, 1.26, y + 0.72, y + step - 0.29, 0.07, (148, 147, 132))
      repeats(-1.14, 1.13, y + 0.82, y + step - 0.39, 0.10, GLASS)
      repeats(0.23, 0.31, y + 0.8, y + step - 0.32, 0.14, JOINERY)
      repeats(-1.23, 1.22, y + 0.63, y + 0.76, 0.14, (187, 183, 163))
    plate(0, width, top - 0.34, top - 0.05, 0.09, (176, 176, 162))
  elif kind == "aok":
    step = (top - BASE - 0.25) / 5
    for i in range(5):
      y = BASE + step * i
      plate(0, width, y + 0.58, y + step - 0.22, 0.065, (87, 123, 101))
      repeats(-0.87, 0.87, y + 0.65, y + step - 0.30, 0.085, (96, 123, 116))
      repeats(-0.91, -0.83, y + 0.62, y + step - 0.24, 0.115, (107, 144, 101))
      plate(0, width, y + step - 0.22, y + step - 0.10, 0.10, (180, 171, 121))
  else:
    tall = top - BASE
    # The two projecting storeys contain the shopfront and the concrete parapet.
    floors = max(2, round(tall / 3.35))
    step = (tall - 0.25) / floors
    for i in range(floors):
      y = BASE + step * i
      if i < 2:
        tone = SHOP if i == 0 else (97, 114, 114)
        plate(0, width, y + 0.24, y + step - 0.41, 0.065, tone)
        repeats(-0.11, 0.11, y + 0.19, y + step - 0.35, 0.10, JOINERY)
        plate(0, width, y + step - 0.44, y + step - 0.13, 0.17, CONCRETE)
        if i == 0:
          plate(0, width, y + step - 0.92, y + step - 0.84, 0.12, JOINERY)
      else:
        repeats(-1.28, 1.28, y + 0.71, y + step - 0.33, 0.07, GLASS)
        repeats(-0.28, -0.19, y + 0.68, y + step - 0.30, 0.105, JOINERY)
        repeats(-1.34, 1.33, y + 0.60, y + 0.72, 0.11, (175, 171, 155))


def add_roof(mesh, raw, g, native, datum):
  if native:
    # The official roof patches keep their own levels on the cardinal body.
    for patch in raw["roof"]:
      hull = Polygon(
        [(x, z) for x, _, z in patch[0]], [[(x, z) for x, _, z in h] for h in patch[1:]]
      ).buffer(0)
      if hull.area < 0.05:
        continue
      straight = cardinal(hull).intersection(g)
      mesh.ground(
        straight,
        round((np.mean([v[1] for v in patch[0]]) - datum + BASE) * 5) / 5 + 0.03,
        (132, 135, 125),
      )
  else:
    for patch in raw["roof"]:
      xyz = np.array(patch[0])
      hull = Polygon(
        xyz[:, [0, 2]], [np.array(h)[:, [0, 2]] for h in patch[1:]]
      ).buffer(0)
      if hull.area < 0.02:
        continue
      x0, z0 = xyz[0, [0, 2]]
      rhs = xyz[:, 1] - xyz[0, 1]
      slope = np.linalg.lstsq(xyz[:, [0, 2]] - [x0, z0], rhs, rcond=None)[0]
      mesh.polygon(
        hull,
        (135, 137, 125),
        lambda x, z: (
          x,
          float(
            xyz[0, 1] + (x - x0) * slope[0] + (z - z0) * slope[1] - datum + BASE + 0.02
          ),
          z,
        ),
      )


def raised_walls(mesh, raw, color):
  """Retain the surveyed gables and setbacks above the lowest roof eave."""
  for patch in raw.get("walls", []):
    if not patch:
      continue
    vertices = np.asarray(patch[0])
    coords = vertices[:, [0, 2]]
    i, j = np.unravel_index(
      np.argmax(((coords[:, None] - coords[None, :]) ** 2).sum(axis=2)),
      (len(coords), len(coords)),
    )
    direction = coords[j] - coords[i]
    length = np.linalg.norm(direction)
    if length < 0.02:
      continue
    axis = direction / length
    start = coords[i]

    def local(ring):
      return [(float((np.array([x, z]) - start) @ axis), y) for x, y, z in ring]

    outline = Polygon(local(patch[0]), [local(hole) for hole in patch[1:]]).buffer(0)
    crop = outline.intersection(
      box(-0.01, raw["eave"], length + 0.01, raw["top"] + 0.01)
    )

    def world(u, y):
      x, z = start + axis * u
      return x, y - raw["ground"] + BASE, z

    mesh.polygon(crop, color, world)


def roof_levels(raw):
  patches = []
  for roof in raw["roof"]:
    xyz = np.asarray(roof[0])
    footprint = Polygon(
      xyz[:, [0, 2]], [np.array(h)[:, [0, 2]] for h in roof[1:]]
    ).buffer(0)
    if footprint.area > 0.02:
      height = round((float(xyz[:, 1].mean()) - raw["ground"] + BASE) * 5) / 5
      patches.append((footprint, height))
  return patches


def read_buildings(source):
  parts = []
  for raw in source["parts"]:
    if raw["osm"] in ("w25483631", "w16110464"):
      continue
    key = raw["osm"]
    kind = "inner" if key == "w38799552" else "outer"
    parts.append((kind, raw, source_poly(raw["ring"])))
  old = source["original"]["25483631"]
  g = Polygon(np.array(old["ring"]) / 10, [np.array(r) / 10 for r in old["holes"]])
  raw = dict(
    part="25483631",
    osm="w25483631",
    ground=0,
    eave=old["h_dm"] / 10,
    top=old["h_dm"] / 10,
    roof=[],
  )
  parts.append(("aok", raw, g))
  return parts


def mapped_supports(source):
  return unary_union([source_poly(r["rings"]) for r in source["overhangs"]])


def add_body(collector, kind, raw, p, native, neighbours, raised, nav):
  top = BASE + raw["eave"] - raw["ground"]
  g = cardinal(p) if native else p
  if g.is_empty:
    return
  mesh = collector
  color = (202, 196, 157) if kind == "aok" else WALL
  lo = BASE
  if kind == "inner":
    lo = BASE + (5.72 if raw["part"] == "DEBE3DJCXUAQbycW" else 3.02)
    mesh.ground(g, lo, (155, 155, 142))
    exposed = p.difference(raised.buffer(0.16)).buffer(0)
    # Real stair-body feet occupy the breaks between OSM elevated runs.
    for tower in polygons(exposed):
      if tower.area < 1 or tower.buffer(-0.20).is_empty:
        continue
      foot = cardinal(tower) if native else tower
      extrude(mesh, foot, BASE, lo, WALL)
      for pier in polygons(foot):
        nav.append((raw["osm"], raw["part"] + "-treppe", pier, BASE, lo))
    for over in sorted(
      polygons(raised.intersection(p)), key=lambda v: v.area, reverse=True
    ):
      if over.area < 45:
        continue
      angle = math.atan2(over.centroid.y - CENTER[1], over.centroid.x - CENTER[0])
      unit = np.array([math.cos(angle), math.sin(angle)])
      pc = np.array(over.representative_point().coords[0])
      t = np.array([-unit[1], unit[0]])
      for k in [-1, 1]:
        x, z = pc + t * k * 1.8
        if not over.contains(Point(x, z)):
          continue
        pier = box(x - 0.23, z - 0.27, x + 0.23, z + 0.27)
        extrude(mesh, pier, BASE, lo, (147, 149, 139))
        nav.append((raw["osm"], raw["part"] + "-stütze", pier, BASE, lo))
  levels = roof_levels(raw) if raw.get("walls") else []
  for a, b, d, n, w in rings(g):
    z0, z1 = lo, top
    target = Point((a + b) * 0.5 - n * (0.4 if native else 0.035))
    roof_top = min(levels, key=lambda r: r[0].distance(target))[1] if levels else top
    if native:
      z1 = max(lo, roof_top)
    probe = (a + b) / 2 + n * (0.83 if native else 0.15)
    exposed = not any(
      other[2].contains(Point(probe))
      and BASE + other[1]["eave"] - other[1]["ground"] >= top - 0.6
      for other in neighbours
    )
    shade = np.array(color) * (0.95 + 0.035 * n[0] - 0.023 * n[1])
    mesh.face(
      [(a[0], z0, a[1]), (b[0], z0, b[1]), (b[0], z1, b[1]), (a[0], z1, a[1])], shade
    )
    if exposed and roof_top - lo > 2.4:
      fill_front(mesh, a, d, n, w, roof_top, lo, kind)
  if raw.get("walls") and not native:
    raised_walls(mesh, raw, color)
  # Measured roofs take precedence over coarse body caps; underside is intentionally distinct.
  if raw["roof"]:
    add_roof(mesh, raw, g, native, raw["ground"])
  else:
    mesh.ground(g, top, (135, 139, 127))
  for solid in polygons(g):
    nav.append((raw["osm"], raw["part"], solid, lo, BASE + raw["top"] - raw["ground"]))


def column(mesh, center, ground, native):
  x, z = center
  sides = 10 if native else 26
  lathe(
    mesh,
    x,
    z,
    ground,
    [
      (0, 1.60, 1.60, 0),
      (0.22, 1.60, 1.60, 0),
      (0.23, 1.32, 1.32, 1),
      (0.51, 1.27, 1.27, 1),
      (0.68, 1.14, 1.14, 2),
      (3.28, 1.10, 1.10, 2),
      (3.37, 1.28, 1.28, 1),
      (3.62, 1.28, 1.28, 1),
      (3.79, 0.73, 0.73, 0),
      (4.05, 0.67, 0.67, 0),
      (15.00, 0.51, 0.51, 2),
      (15.11, 0.64, 0.64, 1),
      (15.57, 0.76, 0.76, 1),
      (15.85, 0.60, 0.60, 1),
      (16.18, 0.53, 0.53, 1),
    ],
    [(167, 161, 143), (187, 179, 157), (166, 161, 139)],
    sides,
  )
  bronze = (87, 96, 78)
  lathe(
    mesh,
    x,
    z,
    ground,
    [
      (16.15, 0.27, 0.26, 0),
      (16.47, 0.35, 0.32, 0),
      (16.94, 0.29, 0.26, 0),
      (17.36, 0.19, 0.18, 0),
      (17.70, 0.28, 0.20, 0),
      (17.80, 0.14, 0.13, 0),
      (18.03, 0.13, 0.12, 0),
      (18.10, 0.11, 0.10, 0),
    ],
    [bronze],
    8,
  )
  for s in (-1, 1):
    # Nike's lifted wings remain separately legible above the capital.
    mesh.face(
      [
        (x + s * 0.13, ground + 17.6, z),
        (x + s * 0.53, ground + 18.53, z - 0.09),
        (x + s * 0.78, ground + 19, z - 0.24),
        (x + s * 0.68, ground + 18.10, z - 0.17),
        (x + s * 0.34, ground + 17.38, z - 0.04),
      ],
      (105, 112, 91),
    )
    mesh.rod(
      (x + s * 0.18, ground + 17.64, z),
      (x + s * 0.38, ground + 17.46, z + 0.12),
      0.085,
      bronze,
      6,
    )


def square(source, native):
  meshes = []
  floor = Mesh(ORIGIN)
  greens = {i: source_poly(r) for i, r in source["openSpace"]}
  main = greens["w573431900"]
  lawn = greens["w1065766691"]
  water = greens["w608732506"]
  path = unary_union(
    [
      LineString(coords).buffer(w / 2, cap_style="square", join_style="round")
      for _, coords, _, w in source["paths"]
    ]
  )
  path = path.union(water.buffer(2.45))
  floor.ground(main.difference(lawn), (PAVING), (188, 185, 172))
  floor.ground(lawn.difference(path), PAVING + 0.045, (150, 163, 117))
  floor.ground(lawn.intersection(path).difference(water), PAVING, (198, 193, 176))
  floor.ground(
    water.buffer(0.22).difference(water.buffer(-0.32)), PAVING + 0.34, (190, 187, 169)
  )
  floor.ground(water.buffer(-0.32), PAVING + 0.20, (113, 144, 141))
  column(floor, [water.centroid.x, water.centroid.y], PAVING + 0.23, native)
  meshes.append(floor)
  vegetation = Mesh(ORIGIN)
  trees(vegetation, source["trees"], native)
  # This reusable canopy generator starts trunks at 3.33 m; the core pavement is at 5.72 m.
  vegetation.origin[1] += PAVING - 3.33
  meshes.append(vegetation)
  return meshes


def station(source, native):
  mesh = Mesh(ORIGIN)
  deck = source["railDeck"]
  platform = deck + 1.02
  railslate = (94, 109, 109)
  for _, ring in source["platforms"]:
    p = source_poly(ring)
    extrude(mesh, cardinal(p) if native else p, deck + 0.12, platform, (176, 173, 161))
    # Light edge just inside each surveyed platform; gaps between platforms remain for the tracks.
    mesh.ground(p.difference(p.buffer(-0.19)), platform + 0.025, (222, 218, 201))
  hall = source["hallRoof"]
  north = LineString(hall["north"])
  south = LineString(hall["south"])
  ridge = LineString(hall["ridge"])

  def cross(f):
    s = np.array(south.interpolate(f, normalized=True).coords[0])
    n = np.array(north.interpolate(f, normalized=True).coords[0])
    r = np.array(ridge.interpolate(f, normalized=True).coords[0])
    return n, s, r

  eave = platform + 3.35
  peak = eave + 2.85

  def pt(a, y):
    return (a[0], y, a[1])

  for j in range(12):
    n0, s0, r0 = cross(j / 12)
    n1, s1, r1 = cross((j + 1) / 12)
    y0 = eave + (1.10 if j == 0 or j == 12 else peak - eave)
    y1 = eave + (1.10 if j + 1 in (0, 12) else peak - eave)
    for a, b, c in [(n0, n1, (112, 118, 118)), (s0, s1, (177, 177, 165))]:
      mesh.face([pt(a, eave), pt(b, eave), pt(r1, y1), pt(r0, y0)], c)
      mesh.face(
        [pt(a, eave - 0.28), pt(b, eave - 0.28), pt(b, eave), pt(a, eave)],
        (106, 116, 112),
      )
      # Solid window aprons, large glass bands and the upright iron window frames.
      for lo, hi, col in [
        (platform + 0.10, platform + 1.10, (169, 169, 154)),
        (platform + 1.10, platform + 2.92, (105, 130, 134)),
        (platform + 2.92, eave - 0.22, (183, 182, 167)),
        (platform + 1.94, platform + 2.01, (160, 171, 160)),
      ]:
        mesh.face([pt(a, lo), pt(b, lo), pt(b, hi), pt(a, hi)], col)
      for f in [0, 0.33, 0.66]:
        h = a + (b - a) * f
        mesh.rod(pt(h, platform + 0.15), pt(h, eave), 0.075, (98, 115, 107), 4)
    if j % 2 == 0:
      mesh.rod(pt(n0, platform + 0.06), pt(n0, eave), 0.13, railslate, 4)
      mesh.rod(pt(s0, platform + 0.06), pt(s0, eave), 0.13, railslate, 4)
      mesh.rod(pt(n0, eave - 0.2), pt(r0, y0 - 0.2), 0.11, railslate, 4)
      mesh.rod(pt(s0, eave - 0.2), pt(r0, y0 - 0.2), 0.11, railslate, 4)
  for f in [0, 1]:
    n, s, r = cross(f)
    mesh.face([pt(n, eave), pt(s, eave), pt(r, eave + 1.10)], (170, 170, 156))
  station_part = next(p for p in source["parts"] if p["osm"] == "w16110464")
  foot = source_poly(station_part["ring"])
  high = BASE + station_part["top"] - station_part["ground"]
  body = cardinal(foot) if native else foot
  extrude(mesh, body, BASE, high, (196, 189, 161))
  for a, b, axis, n, w in rings(body):
    if n[1] < 0.5 or w < 0.65:
      continue

    def facade(s0, s1, bot, top, depth, color):
      s0, s1 = max(0, s0), min(w, s1)
      if s1 - s0 < 0.03:
        return
      left = a + axis * s0 + n * depth
      right = a + axis * s1 + n * depth
      mesh.face([pt(left, bot), pt(right, bot), pt(right, top), pt(left, top)], color)

    facade(0, w, high - 1.0, high - 0.68, 0.06, (145, 143, 124))
    if w >= 3.6:
      for u in np.arange(w / 2 % 3.4, w, 3.4):
        facade(u - 0.7, u + 0.65, BASE + 3.1, BASE + 5.03, 0.08, (72, 87, 81))
        facade(u - 0.85, u + 0.8, BASE + 5.03, BASE + 5.21, 0.12, (160, 155, 132))
  return mesh


def nav_rings(g):
  def v(r):
    return [[round(x, 2), round(z, 2)] for x, z in list(r.coords)[:-1]]

  return [v(g.exterior), *[v(r) for r in g.interiors]]


def main():
  source = json.load(gzip.open(SOURCE))
  DATA.mkdir(exist_ok=True)
  parts = read_buildings(source)
  overhangs = mapped_supports(source)
  mode_nav = {}
  for native in (False, True):
    key = "native" if native else "drawn"
    nav = []
    site = []
    # Mesh packets stay bounded and independently culled in the normal viewer.
    for family in ["inner", "outer", "aok"]:
      selected = [r for r in parts if r[0] == family]
      for start in range(0, len(selected), 3):
        mesh = Mesh(ORIGIN)
        for r in selected[start : start + 3]:
          others = [v for v in parts if v is not r and v[2].distance(r[2]) < 2.0]
          add_body(mesh, *r, native, others, overhangs, nav)
        if mesh.triangles:
          site.append(mesh.finish())
    for mesh in [*square(source, native), station(source, native)]:
      site.append(mesh.finish())
    st = next(p for p in source["parts"] if p["osm"] == "w16110464")
    land = source_poly(st["ring"])
    deck = source["railDeck"]
    for p in polygons(cardinal(land) if native else land):
      nav.append(("w16110464", st["part"], p, BASE, BASE + st["top"] - st["ground"]))
    for osm, r in source["platforms"]:
      p = source_poly(r)
      for pp in polygons(cardinal(p) if native else p):
        nav.append(("w16110464", osm, pp, deck + 0.12, deck + 1.02))
    nlist = [
      [key, id, round(lo, 2), round(hi, 2), nav_rings(gg)]
      for key, id, gg, lo, hi in nav
    ]
    mode_nav[key] = nlist
    (DATA / (key + ".json")).write_text(json.dumps(site, separators=(",", ":")) + "\n")
    print(
      key,
      "meshes",
      len(site),
      "vertices",
      sum(p["n"] for p in site),
      "triangles",
      sum(p["f"] for p in site),
      "navigation",
      len(nav),
      flush=True,
    )
  # Compress both walkable footprints separately. The viewer decodes each once.
  encoded = {
    style: base64.b64encode(
      gzip.compress(json.dumps(rows, separators=(",", ":")).encode(), 9, mtime=0)
    ).decode()
    for style, rows in mode_nav.items()
  }
  (DATA / "navigation.json").write_text(
    json.dumps(encoded, separators=(",", ":")) + "\n"
  )
  cols = source["originalVoxelColumns"]
  ordered = sorted(cols, key=lambda r: (r[1], r[2], r[0]))
  runs = []
  for x, z, hi in ordered:
    if runs and z == runs[-1][0] and hi == runs[-1][3] and x == runs[-1][2] + 1:
      runs[-1][2] = x
    else:
      runs.append([z, x, x, hi])
  (DATA / "previous.json").write_text(json.dumps(runs, separators=(",", ":")) + "\n")


if __name__ == "__main__":
  main()
