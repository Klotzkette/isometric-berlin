"""Step 10: complete Treptowers/Arena leaves and the exact Badeschiff deck.

Original packets are read-only. New models retain every official source sheet;
facade subdivisions and the independent one-metre native roofs are display fits.
"""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import math
import subprocess
from collections import Counter
from pathlib import Path

import build_surrounding_outlines as exporter
import geopandas as gpd
import numpy as np
import shapely
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import normal_of, triangles_for
from build_neukoelln_landmarks_v305 import box_surfaces, roof_heights
from pyproj import Transformer
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app"
DATA = APP / "src/data"
RAW = GEO / "raw/treptow-v317"
PUBLIC = APP / "public/mesh/surrounding-berlin-v159"
KIND = "treptow-waterfront-v317"
SITES = [
  ("treptowers", "DEBE09YYP0000AJc", "LoD2_395_5817.zip", "ring-v182"),
  ("arena", "DEBE09YYP0000E8C", "LoD2_394_5817.zip", "outer-v159"),
]


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)


def write(path, value):
  raw = (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def fnv(text):
  value = 2166136261
  for c in text:
    value = ((value ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return value


def polygon_parts(g):
  return [g] if g.geom_type == "Polygon" else list(g.geoms)


class Packed:
  def __init__(self, key, native, origin):
    self.key, self.native, self.origin = key, native, np.asarray(origin)
    self.points, self.colors, self.indices, self.lookup = [], [], [], {}
    self.rows = []

  def triangle(self, points, tone):
    points = np.asarray(points, dtype=float)
    n = np.cross(points[1] - points[0], points[2] - points[0])
    if np.linalg.norm(n) < 1e-9:
      return
    n /= np.linalg.norm(n)
    shade = 0.76 + 0.24 * max(0, float(np.dot(n, [-0.408, 0.816, 0.408])))
    rgb = np.asarray([(tone >> 16) & 255, (tone >> 8) & 255, tone & 255]) / 255
    linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    color = np.rint(linear * shade * 65535).astype(int).tolist()
    vertices = (np.rint(np.round(points * 100, 6)) - np.rint(self.origin * 100)).astype(
      int
    )
    if vertices.min() < 0 or vertices.max() > 65535:
      raise ValueError("Required model outside its centimetre origin")
    for p in vertices.tolist():
      k = (*p, *color)
      if k not in self.lookup:
        self.lookup[k] = len(self.points)
        self.points.append(p)
        self.colors.append(color)
      self.indices.append(self.lookup[k])

  def quad(self, a, b, c, d, tone):
    self.triangle([a, b, c], tone)
    self.triangle([a, c, d], tone)

  def box(self, center, size, tone):
    if self.native:
      self.rows.append([*center, *size, tone])
      return
    x, y, z = center
    w, h, d = np.asarray(size) / 2
    p = [
      [x + sx * w, y + sy * h, z + sz * d]
      for sx, sy, sz in [
        (-1, -1, -1),
        (1, -1, -1),
        (1, -1, 1),
        (-1, -1, 1),
        (-1, 1, -1),
        (1, 1, -1),
        (1, 1, 1),
        (-1, 1, 1),
      ]
    ]
    for a, b, c, d in [
      (0, 3, 2, 1),
      (4, 5, 6, 7),
      (0, 1, 5, 4),
      (1, 2, 6, 5),
      (2, 3, 7, 6),
      (3, 0, 4, 7),
    ]:
      self.quad(p[a], p[b], p[c], p[d], tone)

  def payload(self):
    def enc(values, dtype):
      return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode()

    if self.native:
      palette = list(dict.fromkeys(r[6] for r in self.rows))
      rows = np.asarray([r[:6] for r in self.rows])
      rows[:, :3] -= self.origin
      rows = np.rint(rows * 100).astype(int)
      if rows.min() < 0 or rows.max() > 65535:
        raise ValueError("Native row outside exact local centimetres")
      return dict(
        key=self.key,
        native=True,
        origin=self.origin.tolist(),
        count=len(rows),
        columns=[enc(rows[:, i], "<u2") for i in range(6)],
        palette=palette,
        tones=enc([palette.index(r[6]) for r in self.rows], "u1"),
      )
    return dict(
      key=self.key,
      native=self.native,
      positionType="u16cm",
      colorType="u16linear",
      origin=self.origin.tolist(),
      positions=enc(self.points, "<u2"),
      colors=enc(self.colors, "<u2"),
      indices=enc(self.indices, "<u4"),
      vertices=len(self.points),
      triangles=len(self.indices) // 3,
    )


def extract():
  sites = []
  for key, pid, archive, layer in SITES:
    parent = extract_parent(GEO / "raw/lod2" / archive, pid)
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    old = gpd.read_file(
      GEO / f"raw/{layer}/resolved-outlines.gpkg",
      layer="buildings",
      where=f"sourceId='{pid}'",
    ).iloc[0]
    predecessor = {k: v for k, v in old.items() if k != "geometry"}
    predecessor["geometry"] = mapping(old.geometry)
    sites.append(
      dict(
        key=key,
        parent=pid,
        archive=archive,
        archiveSha256=sha(GEO / "raw/lod2" / archive),
        parts=parts,
        predecessor=predecessor,
      )
    )
  frame = gpd.read_file(GEO / "raw/outer-v159/candidate.gpkg", layer="multipolygons")
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform
  features = {}
  for identity in ["45197923", "174099109"]:
    r = frame[frame.osm_way_id == identity].iloc[0]
    g = transform(
      lambda x, y: (x - 389500, 5820000 - y), transform(project, r.geometry)
    )
    features[identity] = dict(
      geometry=mapping(g), tags=r.drop("geometry").dropna().to_dict()
    )
  old = gpd.read_file(
    GEO / "raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    where="sourceId='OSM-way-45197923'",
  ).iloc[0]
  deck = {
    k: v
    for k, v in old.items()
    if k != "geometry" and not (isinstance(v, float) and math.isnan(v))
  }
  deck["geometry"] = mapping(old.geometry)
  result = dict(schemaVersion=1, sites=sites, mapped=features, deckPredecessor=deck)
  write(GEO / "treptow-waterfront-v317-source.json.gz", result)
  return result


def native_body(parts, model):
  cells = {}
  for p in parts:
    g = Polygon(p["ring"], p["holes"])
    x0, z0, x1, z1 = g.bounds
    xs, zs = np.meshgrid(
      np.arange(math.floor(x0), math.ceil(x1)), np.arange(math.floor(z0), math.ceil(z1))
    )
    xs, zs = xs.ravel(), zs.ravel()
    mask = shapely.contains_xy(g, xs + 0.5, zs + 0.5)
    xs, zs = xs[mask], zs[mask]
    roofs = [
      t
      for s in p["surfaces"]
      if s["kind"] == "RoofSurface"
      for t in triangles_for(s["rings"])
    ]
    tops = roof_heights(roofs, xs + 0.5, zs + 0.5)
    tops[~np.isfinite(tops)] = p["top_y_m"]
    for x, z, top in zip(xs, zs, tops, strict=True):
      low = math.floor(p["ground_y_m"] * 2) / 2
      high = math.ceil(top * 2) / 2
      prev = cells.get((int(x), int(z)), (low, low))
      cells[(int(x), int(z))] = min(low, prev[0]), max(high, prev[1])
  nav = []
  for z in sorted({z for _, z in cells}):
    xs = sorted(x for x, zz in cells if zz == z)
    at = 0
    while at < len(xs):
      first = last = xs[at]
      low, high = cells[(first, z)]
      at += 1
      while at < len(xs) and xs[at] == last + 1 and cells[(xs[at], z)] == (low, high):
        last = xs[at]
        at += 1
      model.box(
        [(first + last + 1) / 2, (low + high) / 2, z + 0.5],
        [last - first + 1, high - low, 1],
        0xB6B5AA if model.key.startswith("trept") else 0x936E59,
      )
      nav.append([first, z, last + 1, z + 1, low, high])
  return nav


def facade(parts, site):
  """Place reference-fitted windows on exposed exact measured wall planes."""
  shapes = [Polygon(p["ring"], p["holes"]).buffer(0) for p in parts]
  seen, count, recipes = set(), 0, []
  for pi, p in enumerate(parts):
    for s in p["surfaces"]:
      if s["kind"] != "WallSurface":
        continue
      rings = s["rings"]
      n = normal_of(rings[0])
      if abs(n[1]) > 0.02:
        continue
      a, b = max(
        ((a, b) for a in rings[0] for b in rings[0]),
        key=lambda pair: math.hypot(pair[1][0] - pair[0][0], pair[1][2] - pair[0][2]),
      )
      d = np.asarray([b[0] - a[0], 0, b[2] - a[2]])
      length = np.linalg.norm(d)
      if length < 5:
        continue
      d /= length
      base = np.asarray(a)
      polygon = Polygon(
        [(float(np.dot(np.asarray(q) - base, d)), q[1]) for q in rings[0]],
        [
          [(float(np.dot(np.asarray(q) - base, d)), q[1]) for q in ring]
          for ring in rings[1:]
        ],
      )
      lo, hi = min(q[1] for q in rings[0]), max(q[1] for q in rings[0])
      tower = site == "treptowers" and hi > 100
      pitch = 3.80 if tower else 3.25 if site == "treptowers" else 3.4
      y_start = math.ceil((lo + 1) / pitch) * pitch + 0.5
      u_step = 2.55 if tower else 3.2
      slots = []
      for iy, y in enumerate(np.arange(y_start, hi - 0.8, pitch)):
        for iu, u in enumerate(np.arange(1.7, length - 1, u_step)):
          width, height = (
            (2.03, 2.90)
            if tower
            else (2.18, 1.85)
            if site == "treptowers"
            else (1.8, 2.10)
          )
          patch = box(u - width / 2, y - height / 2, u + width / 2, y + height / 2)
          if not polygon.covers(patch):
            continue
          center = base + d * u + n * 0.09
          key = tuple(np.rint([center[0] * 10, y * 10, center[2] * 10]).astype(int))
          if key in seen:
            continue
          outward = Point(center[0] + n[0] * 0.3, center[2] + n[2] * 0.3)
          if any(
            j != pi
            and shape.covers(outward)
            and other["ground_y_m"] <= y <= other["top_y_m"]
            for j, (shape, other) in enumerate(zip(shapes, parts, strict=True))
          ):
            continue
          seen.add(key)
          slots.append(iy * 256 + iu)
          count += 1
      if slots:
        recipes.append(
          [
            *base.tolist(),
            d[0],
            d[2],
            n[0],
            n[2],
            u_step,
            y_start,
            pitch,
            width,
            height,
            0x577787 if tower else 0x657C84 if site == "treptowers" else 0x647C75,
            base64.b64encode(np.asarray(slots, dtype="<u2").tobytes()).decode(),
          ]
        )
  return recipes, count


def arena_details(parts, drawn, native):
  """Photo-fitted crosswise rooflights on the unchanged measured roof planes."""
  main = next(p for p in parts if p["id"] == "DEBE3DUM1D2ufSd6")
  roofs = [
    t
    for s in main["surfaces"]
    if s["kind"] == "RoofSurface"
    for t in triangles_for(s["rings"])
  ]
  a = np.asarray([5502.591, 2541.772])
  b = np.asarray([5589.686, 2584.016])
  d = (b - a) / np.linalg.norm(b - a)
  n = np.asarray([-d[1], d[0]])
  for station in np.linspace(10, 86, 6):
    for across in np.arange(-32, 32, 2):
      xz = np.asarray(
        [
          a + d * (station + u) + n * v
          for u, v in [
            (-1.1, across),
            (1.1, across),
            (1.1, across + 2),
            (-1.1, across + 2),
          ]
        ]
      )
      ys = roof_heights(roofs, xz[:, 0], xz[:, 1])
      if not np.isfinite(ys).all():
        continue
      drawn.quad(
        *[[p[0], y + 0.07, p[1]] for p, y in zip(xz, ys, strict=True)], 0x849DA4
      )
      center = xz.mean(axis=0)
      y = (
        math.ceil(
          float(
            roof_heights(roofs, np.asarray([center[0]]), np.asarray([center[1]]))[0]
          )
          * 2
        )
        / 2
      )
      native.box(
        [round(center[0]), y + 0.035, round(center[1])], [1, 0.07, 1], 0x849DA4
      )
  # Each gable receives an arched glazed field clipped to every original wall
  # polygon. This changes surface recognition, never the retained envelope.
  for end in [a, b]:
    for s in main["surfaces"]:
      if s["kind"] != "WallSurface":
        continue
      norm = normal_of(s["rings"][0])
      if abs(np.dot(norm[[0, 2]], d)) < 0.98:
        continue
      points = np.asarray(s["rings"][0])
      base = points[0]
      if np.linalg.norm(base[[0, 2]] - end) > 40:
        continue
      wall = Polygon([(float(np.dot(p[[0, 2]] - end, n)), p[1]) for p in points])
      if not wall.is_valid:
        wall = wall.buffer(0)
      for v in np.arange(-33, 33, 1.5):
        top = 8.8 + 5.7 * math.sqrt(max(0, 1 - (v / 34) ** 2))
        panel = wall.intersection(box(v, 5.2, v + 1.35, top))
        for g in (
          polygon_parts(panel)
          if not panel.is_empty and panel.geom_type in ["Polygon", "MultiPolygon"]
          else []
        ):
          if g.area < 0.1:
            continue
          rings = [[[*(end + n * u), yy] for u, yy in list(g.exterior.coords)[:-1]]]
          # triangulate in the measured vertical wall frame.
          converted = [
            [[p[0] + norm[0] * 0.10, p[2], p[1] + norm[2] * 0.10] for p in rings[0]]
          ]
          for t in triangles_for(converted):
            drawn.triangle(t, 0x637C80)
          xz = end + n * (v + 0.65) + norm[[0, 2]] * 0.18
          low = 5.2
          high = min(top, float(points[:, 1].max()))
          if high > low:
            native.box(
              [round(xz[0] * 2) / 2, (low + high) / 2, round(xz[1] * 2) / 2],
              [0.5, high - low, 0.5],
              0x637C80,
            )


def compile_data(source):
  models, nav, audit, facades = [], {"drawn": [], "minecraft": []}, [], []
  for site in source["sites"]:
    key = site["key"]
    origin = [5800, -10, 2600] if key == "treptowers" else [5400, -10, 2450]
    drawn, native = (
      Packed(key + "-complete-source", False, origin),
      Packed(key + "-cardinal", True, origin),
    )
    parts = copy.deepcopy(site["parts"])
    offset = 3 - min(p["ground_y_m"] for p in parts)
    for p in parts:
      p["ground_y_m"] += offset
      p["top_y_m"] += offset
      for s in p["surfaces"]:
        for ring in s["rings"]:
          for q in ring:
            q[1] += offset
    footprint = unary_union([Polygon(p["ring"], p["holes"]).buffer(0) for p in parts])
    outside = shape(site["predecessor"]["geometry"]).difference(footprint)
    complements = box_surfaces(
      outside, 3, 3 + site["predecessor"]["height"], site["parent"]
    )
    for p in parts + complements:
      roofs = []
      for s in p["surfaces"]:
        ts = triangles_for(s["rings"])
        if s["kind"] == "RoofSurface":
          roofs.extend(ts)
        for t in ts:
          tone = (
            (0x7D8887 if s["kind"] == "RoofSurface" else 0xB6B5AA)
            if key == "treptowers"
            else (0x7C8380 if s["kind"] == "RoofSurface" else 0x936E59)
          )
          drawn.triangle(t, tone)
      nav["drawn"].append(
        dict(
          sourceId=p["id"],
          parentId=site["parent"],
          ring=p["ring"],
          holes=p["holes"],
          low=p["ground_y_m"],
          high=p["top_y_m"],
          roofTriangles=roofs,
        )
      )
    runs = native_body(parts + complements, native)
    nav["minecraft"].extend([site["parent"], *r] for r in runs)
    recipes, windows = facade(parts, key)
    facades.extend(recipes)
    if key == "arena":
      arena_details(parts, drawn, native)
    models.extend([drawn.payload(), native.payload()])
    audit.append(
      dict(
        key=key,
        leaves=len(parts),
        sourceSurfaces=sum(len(p["surfaces"]) for p in parts),
        yOffset=offset,
        outsideArea=outside.area,
        windowEstimates=windows,
        nativeRuns=len(runs),
      )
    )
  # Correct the exact nine-metre floating-platform fallback to a thin timber
  # deck. Its full mapped outline, including every step-in, is retained.
  deck = shape(source["mapped"]["45197923"]["geometry"])
  pool = shape(source["mapped"]["174099109"]["geometry"])
  for native in [False, True]:
    m = Packed("badeschiff-deck-and-barge", native, [5450, -10, 2400])
    regions = []
    for identity, g, low, high, tone in [
      ("deck", deck, 3.25, 3.65, 0xA58C69),
      ("pool", pool, 1.25, 3.45, 0x57B6C5),
    ]:
      if native:
        x0, z0, x1, z1 = g.bounds
        for z in range(math.floor(z0), math.ceil(z1)):
          xs = [
            x
            for x in range(math.floor(x0), math.ceil(x1))
            if g.covers(Point(x + 0.5, z + 0.5))
          ]
          for x in xs:
            # One-metre cardinal rim and visible blue water top.
            if identity == "pool":
              m.box(
                [x + 0.5, (low + high - 0.04) / 2, z + 0.5],
                [1, high - 0.04 - low, 1],
                0x343F43,
              )
              m.box([x + 0.5, high - 0.02, z + 0.5], [1, 0.04, 1], tone)
            else:
              m.box([x + 0.5, (low + high) / 2, z + 0.5], [1, high - low, 1], tone)
            regions.append(["badeschiff-" + identity, x, z, x + 1, z + 1, low, high])
      else:
        for p in box_surfaces(g, low, high, "badeschiff-" + identity):
          roofs = []
          for s in p["surfaces"]:
            ts = triangles_for(s["rings"])
            if s["kind"] == "RoofSurface":
              roofs.extend(ts)
            for t in ts:
              m.triangle(
                t,
                tone if identity == "deck" or s["kind"] == "RoofSurface" else 0x343F43,
              )
          nav["drawn"].append(
            dict(
              sourceId=p["id"],
              parentId="badeschiff",
              ring=p["ring"],
              holes=p["holes"],
              low=low,
              high=high,
              roofTriangles=roofs,
            )
          )
      # Retained ring edges carry an estimated low barge/deck coping.
      for p in polygon_parts(g):
        for a, b in zip(p.exterior.coords, list(p.exterior.coords)[1:]):
          length = math.dist(a, b)
          if native:
            for t in np.arange(0, length, 0.5):
              x, z = np.asarray(a) + (np.asarray(b) - a) * t / length
              m.box(
                [round(x * 2) / 2, high + 0.08, round(z * 2) / 2],
                [0.5, 0.16, 0.5],
                0x586D74 if identity == "pool" else 0xBAA17D,
              )
          else:
            d = (np.asarray(b) - a) / length
            n = np.asarray([-d[1], d[0]]) * 0.10
            m.quad(
              [a[0] + n[0], high + 0.08, a[1] + n[1]],
              [b[0] + n[0], high + 0.08, b[1] + n[1]],
              [b[0] - n[0], high + 0.08, b[1] - n[1]],
              [a[0] - n[0], high + 0.08, a[1] - n[1]],
              0x586D74 if identity == "pool" else 0xBAA17D,
            )
          if (
            identity == "deck"
            and pool.distance(Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) > 0.5
          ):
            # Restrained railings match the photographed outer deck, retaining
            # the actual unrailed shared pool edge and the shore approach.
            for t in np.arange(0.7, length, 2.3):
              x, z = np.asarray(a) + (np.asarray(b) - a) * t / length
              m.box(
                [
                  round(x * 2) / 2 if native else x,
                  high + 0.48,
                  round(z * 2) / 2 if native else z,
                ],
                [0.09, 0.96, 0.09],
                0xB8AEA0,
              )
            d = (np.asarray(b) - a) / length
            if native:
              for t in np.arange(0.25, length, 0.5):
                x, z = np.asarray(a) + d * t
                m.box(
                  [round(x * 2) / 2, high + 0.96, round(z * 2) / 2],
                  [0.5, 0.07, 0.5],
                  0xB8AEA0,
                )
            else:
              normal = np.asarray([-d[1], d[0]]) * 0.045
              for offset in [-0.035, 0.035]:
                m.quad(
                  [a[0] + normal[0], high + 0.96 + offset, a[1] + normal[1]],
                  [b[0] + normal[0], high + 0.96 + offset, b[1] + normal[1]],
                  [b[0] - normal[0], high + 0.96 + offset, b[1] - normal[1]],
                  [a[0] - normal[0], high + 0.96 + offset, a[1] - normal[1]],
                  0xB8AEA0,
                )
              m.quad(
                [a[0], high + 0.925, a[1]],
                [b[0], high + 0.925, b[1]],
                [b[0], high + 0.995, b[1]],
                [a[0], high + 0.995, a[1]],
                0xB8AEA0,
              )
    # Short DOP-fitted timber return joins the exact mapped landing to the
    # existing bank. Its final four metres descend continuously to old grade.
    a = np.asarray([5518.31, 2498.259])
    b = np.asarray([5512.2, 2510.6])
    axis = b - a
    length = np.linalg.norm(axis)
    direction = axis / length
    across = np.asarray([-direction[1], direction[0]]) * 1.8
    for i in range(14):
      t, s = i / 14, (i + 1) / 14
      c0, c1 = a + axis * t, a + axis * s
      high = round(3.65 if i < 10 else 3.65 - (i - 9) * 0.65 / 4, 2)
      g = Polygon([c0 - across, c1 - across, c1 + across, c0 + across])
      if native:
        x0, z0, x1, z1 = g.bounds
        for z in range(math.floor(z0), math.ceil(z1)):
          for x in range(math.floor(x0), math.ceil(x1)):
            if not g.covers(Point(x + 0.5, z + 0.5)):
              continue
            m.box([x + 0.5, high - 0.15, z + 0.5], [1, 0.30, 1], 0xA58C69)
            regions.append(
              ["badeschiff-shore-return", x, z, x + 1, z + 1, high - 0.30, high]
            )
      else:
        for p in box_surfaces(
          g, high - 0.30, high, "badeschiff-shore-return-" + str(i)
        ):
          roofs = []
          for surface in p["surfaces"]:
            ts = triangles_for(surface["rings"])
            if surface["kind"] == "RoofSurface":
              roofs.extend(ts)
            for triangle in ts:
              m.triangle(triangle, 0xA58C69)
          nav["drawn"].append(
            dict(
              sourceId=p["id"],
              parentId="badeschiff",
              ring=p["ring"],
              holes=p["holes"],
              low=high - 0.30,
              high=high,
              roofTriangles=roofs,
            )
          )
    if native:
      nav["minecraft"].extend(regions)
    models.append(m.payload())
  write(
    DATA / "treptowWaterfrontV317Core.json",
    dict(schemaVersion=1, models=models, facades=facades),
  )
  write(DATA / "treptowWaterfrontV317Navigation.json", nav)
  return audit


def triangle_keys(mesh):
  p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return [tuple(sorted(tuple(map(int, q)) for q in p[t])) for t in ix]


def packets(source):
  targets = [s["predecessor"] for s in source["sites"]] + [source["deckPredecessor"]]
  identities = {t["sourceId"] for t in targets}
  manifest = read(PUBLIC / "manifest.json")
  selected = []
  # Search only the finite three source-owner tiles, across their actual layers.
  for c in manifest["chunks"]:
    if c["id"].split("-")[-1] not in ["10_4", "10_5", "11_5"] and c["id"] not in [
      "10_4",
      "10_5",
      "11_5",
    ]:
      continue
    for mode in ["drawn", "minecraft"]:
      path = PUBLIC / c[mode]["url"]
      raw = read(path)
      if any(b["sourceId"] in identities for b in raw["nav"]["buildings"]):
        selected.append((mode, path))
  code = r"""
import {prepareSurroundingQuarterPredecessorV303} from './src/SurroundingCityGeometry';
const out={};
const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h;};
const pins=p=>({records:p.meshes.map((m,mesh)=>({mesh,kind:m.kind,fingerprint:fnv(m.positions+m.colors+m.indices)})),nav:fnv(JSON.stringify(p.nav)),lines:p.lines?fnv(p.lines.positions+(p.lines.colors??'')):null});
for(const path of Bun.argv.slice(1)){
 const bytes=new Uint8Array(await Bun.file(path).arrayBuffer());
 const raw=JSON.parse(new TextDecoder().decode(Bun.gunzipSync(bytes))),native=path.includes('.minecraft.');
 const steps=prepareSurroundingQuarterPredecessorV303(raw,raw.id,native,{neighbourhoodV300:true,westKiezV302:true,golgathaV270:true,tachelesFrontsV270:true,northernSitesV266:true,chariteBridgesV265:true,schlossplatzV239:true,staatsoperV240:true,architectureV241:true,littenStadthausV297:true,wallGalleryV298:true});
 let n=steps.next();while(!n.done)n=steps.next();out[path]={raw:pins(raw),prepared:pins(n.value),packet:n.value};
}process.stdout.write(JSON.stringify(out));
"""
  captures = json.loads(
    subprocess.check_output(
      ["bun", "-e", code, *[str(p) for _, p in selected]], cwd=APP
    )
  )
  plans = {}
  audit = []
  for mode, path in selected:
    native = mode == "minecraft"
    raw = read(path)
    cap = captures[str(path)]
    p = cap["packet"]
    ox, _, oz = p["origin"]
    tile = box(ox, oz, ox + 512, oz + 512)
    wanted = Counter()
    lines = Counter()
    owners = []
    for old in targets:
      g = exporter.polygonal(shape(old["geometry"]).intersection(tile))
      if native:
        g = exporter.native_polygon(g).intersection(tile)
      if g.is_empty:
        continue
      owners.append(old["sourceId"])
      low = 3 + old["minHeight"]
      high = 3 + max(old["height"], old["minHeight"] + 1)
      if native:
        high = 3 + max(2, round((high - 3) / 2) * 2)
      outline = (
        shapely.orient_polygons(g, exterior_cw=True).boundary
        if native
        else shapely.orient_polygons(
          shape(old["geometry"]), exterior_cw=True
        ).boundary.intersection(tile)
      )
      mesh = exporter.PackedMesh(ox, oz)
      mesh.building(g, low, high, outline)
      wanted.update(triangle_keys(mesh.payload("city")))
      if not native:
        for line in exporter.line_parts(
          g.boundary.difference(tile.boundary.buffer(0.02))
        ):
          for a, b in zip(line.coords, list(line.coords)[1:]):
            lines[
              tuple(
                sorted(
                  [
                    tuple(
                      round(v * 100) for v in [a[0] - ox, high + 0.02 + 10, a[1] - oz]
                    ),
                    tuple(
                      round(v * 100) for v in [b[0] - ox, high + 0.02 + 10, b[1] - oz]
                    ),
                  ]
                )
              )
            ] += 1
    retire = []
    for mi, m in enumerate(p["meshes"]):
      if m["kind"] != "city":
        continue
      indices = []
      for i, t in enumerate(triangle_keys(m)):
        if wanted[t]:
          indices.append(i)
          wanted[t] -= 1
      if indices:
        retire.append(dict(mesh=mi, triangles=indices))
    if sum(wanted.values()):
      raise ValueError((path.name, "missing body", sum(wanted.values())))
    retire_lines = []
    if p.get("lines"):
      ps = np.frombuffer(base64.b64decode(p["lines"]["positions"]), "<u2").reshape(
        -1, 2, 3
      )
      for i, line in enumerate(ps):
        k = tuple(sorted(tuple(map(int, q)) for q in line))
        if lines[k]:
          retire_lines.append(i)
          lines[k] -= 1
    if sum(lines.values()):
      raise ValueError((path.name, "missing ink", sum(lines.values())))
    nav = [b for b in p["nav"]["buildings"] if b["sourceId"] in owners]
    if set(b["sourceId"] for b in nav) != set(owners):
      raise ValueError("Missing source navigation owner")
    key = mode + ":" + raw["id"]
    plans[key] = dict(
      origin=raw["origin"],
      records=cap["raw"]["records"],
      preparedRecords=cap["prepared"]["records"],
      navGuard=cap["raw"]["nav"],
      lineGuard=cap["raw"]["lines"],
      preparedNavGuard=cap["prepared"]["nav"],
      preparedLineGuard=cap["prepared"]["lines"],
      retire=retire,
      retireLines=retire_lines,
      retireNav=nav,
      appendNav=[],
      owners=owners,
    )
    audit.append(
      dict(
        key=key,
        packetSha256=sha(path),
        sourceOwners=owners,
        triangles=sum(len(r["triangles"]) for r in retire),
        lines=len(retire_lines),
        nav=len(nav),
      )
    )
  if not plans:
    raise ValueError("No real streamed predecessors")
  write(
    DATA / "treptowWaterfrontV317Packets.json",
    dict(schemaVersion=1, keys=list(plans), packets=plans),
  )
  return audit


def main():
  source = extract()
  models = compile_data(source)
  transfers = packets(source)
  write(
    GEO / "treptow-waterfront-v317-evidence.json",
    dict(
      schemaVersion=1,
      sourceSha256=sha(GEO / "treptow-waterfront-v317-source.json.gz"),
      models=models,
      transfers=transfers,
      referenceOnlyImages={p.name: sha(p) for p in RAW.glob("*.jpg")},
      orthophotoSha256=sha(RAW / "site-dop.png"),
      policy="Exact complete old owners only, all source sheets retained; rigid site datum to retained3m terrain and facade subdivisions estimated; full cardinal native/navigation agree.",
    ),
  )
  for p in [
    DATA / "treptowWaterfrontV317Core.json",
    DATA / "treptowWaterfrontV317Navigation.json",
    DATA / "treptowWaterfrontV317Packets.json",
    GEO / "treptow-waterfront-v317-source.json.gz",
  ]:
    print(p.name, p.stat().st_size, len(gzip.compress(p.read_bytes(), mtime=0)))
  print(transfers)


if __name__ == "__main__":
  main()
