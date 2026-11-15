"""Source-bound open fuel canopies with complete former-owner receipts."""

from __future__ import annotations

import argparse
import base64
import gzip
import json
import math
import subprocess
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union

from scripts.build_fuel_inventory_v351 import GEO, ROOT, read, write
from scripts.build_surrounding_outlines import (
  linear_rgb_bytes,
  polygons_from_geometry,
)

APP = ROOT / "src/app"
PACKETS = APP / "public/mesh/surrounding-berlin-v159"
TASK = Path(
  "/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/city-v351"
)
KIND = "fuel-stations-v351"


def poly(b, origin):
  return shapely.make_valid(
    translate(Polygon(b["ring"], b.get("holes", [])), origin[0], origin[2])
  )


def scan():
  source = read(GEO / "fuel-v351-source.json.gz")
  sites = {r["id"]: r for r in source["records"]}
  roofs = [
    r
    for r in source["roofs"]
    if r.get("site") and sites[r["site"]].get("legacyModelIndex") is None
  ]
  chunks = [
    c
    for c in read(PACKETS / "manifest.json")["chunks"]
    if not c["id"].startswith("fuel351-")
  ]
  jobs = {}
  candidates = []
  for roof in roofs:
    g = shape(roof["geometry"])
    hosts = []
    for c in chunks:
      if not box(*c["bounds"]).intersects(g):
        continue
      raw = read(PACKETS / c["drawn"]["url"])
      origin = raw["origin"]
      grounds = unary_union([poly(b, origin) for b in raw["nav"]["ground"]])
      area = grounds.intersection(g).area
      if area < g.area * 0.02:
        continue
      owners = []
      for b in raw["nav"]["buildings"]:
        p = poly(b, origin)
        overlap = p.intersection(g).area
        if overlap > 1:
          owners.append(
            {
              "sourceId": b["sourceId"],
              "coverage": overlap / max(p.area, 0.01),
              "roofCoverage": overlap / g.area,
              "height": b["height"],
              "heightSource": b.get("heightSource"),
            }
          )
      hosts.append({"id": c["id"], "coverage": area / g.area, "owners": owners})
      for mode in ("drawn", "minecraft"):
        jobs[(c["id"], mode)] = {
          "id": c["id"],
          "mode": mode,
          "path": str(PACKETS / c[mode]["url"]),
        }
    candidates.append({"roof": roof, "site": sites[roof["site"]], "hosts": hosts})
  write(TASK / "fuel-candidates.json", candidates)
  write(TASK / "fuel-capture-jobs.json", list(jobs.values()))
  print(
    "candidate roofs",
    len(candidates),
    "with ground",
    sum(bool(c["hosts"]) for c in candidates),
    "host jobs",
    len(jobs),
  )
  subprocess.run(
    ["bun", "scripts/capture-fuel-v351.ts", str(TASK / "fuel-captures")],
    input=json.dumps(list(jobs.values())),
    text=True,
    cwd=APP,
    check=True,
  )


class Mesh:
  def __init__(self, origin):
    self.origin = np.array(origin)
    self.vertices = {}
    self.indices = []

  def triangle(self, points, colors):
    ix = []
    for p, c in zip(points, colors, strict=True):
      q = tuple(np.rint((np.array(p) - self.origin) * 100).astype(int))
      rgb = tuple(int(x) for x in c)
      if min(q) < 0 or max(q) > 65535:
        raise ValueError("outside quantized host")
      key = q + rgb
      if key not in self.vertices:
        self.vertices[key] = len(self.vertices)
      ix.append(self.vertices[key])
    if len(set(ix)) == 3:
      self.indices.extend(ix)

  def surface(self, p, y, c, down=False):
    for piece in polygons_from_geometry(p):
      for t in shapely.constrained_delaunay_triangles(piece).geoms:
        pts = [(x, y, z) for x, z in list(t.exterior.coords)[:3]]
        if (
          np.cross(np.subtract(pts[1], pts[0]), np.subtract(pts[2], pts[0]))[1] > 0
        ) == down:
          pts.reverse()
        self.triangle(pts, [c] * 3)

  def prism(self, p, lo, hi, c, top=None):
    self.surface(p, hi, top or c)
    self.surface(p, lo, c, True)
    for part in polygons_from_geometry(shapely.orient_polygons(p, exterior_cw=True)):
      for ring in [part.exterior, *part.interiors]:
        for (x, z), (a, b) in zip(ring.coords, list(ring.coords)[1:]):
          q = [(x, lo, z), (a, lo, b), (a, hi, b), (x, hi, z)]
          self.triangle(q[:3], [c] * 3)
          self.triangle([q[0], q[2], q[3]], [c] * 3)

  def payload(self):
    v = np.array(list(self.vertices), dtype=np.uint16)

    def enc(a):
      return base64.b64encode(a.tobytes()).decode()

    return dict(
      kind=KIND,
      positionType="u16cm",
      positions=enc(v[:, :3].astype("<u2")),
      colors=enc(v[:, 3:].astype("u1")),
      indices=enc(np.array(self.indices, dtype="<u4")),
    )


def rgb(c):
  return tuple(int(v) for v in linear_rgb_bytes(np.array([c]))[0])


METAL = rgb((164, 169, 165))
BLACK = rgb((40, 44, 43))
WHITE = rgb((229, 230, 216))
CONCRETE = rgb((154, 153, 142))
DISPLAY = rgb((40, 73, 72))
BRANDS = {
  "aral": (18, 87, 172),
  "shell": (239, 193, 42),
  "totalenergies": (219, 55, 53),
  "total": (219, 55, 53),
  "esso": (207, 50, 50),
  "star": (220, 97, 27),
  "sprint": (0, 139, 75),
  "q1": (252, 133, 31),
  "hem": (23, 146, 99),
  "jet": (238, 198, 29),
  "h2 mobility": (62, 157, 169),
}


def round_ring(p, origin):
  return [
    [round(x - origin[0], 2), round(z - origin[2], 2)] for x, z in p.exterior.coords
  ]


def navsolid(p, lo, hi, origin, ground, identity):
  return dict(
    ring=round_ring(p, origin),
    holes=[
      [[round(x - origin[0], 2), round(z - origin[2], 2)] for x, z in r.coords]
      for r in p.interiors
    ],
    height=round(hi - ground, 2),
    minHeight=round(lo - ground, 2),
    sourceId=identity,
    heightSource="mapped fuel canopy; bounded column/pump recognition dimensions estimated",
  )


def fingerprint(part):
  h = 2166136261
  for value in [part["positions"], part["colors"], part["indices"]]:
    for c in value:
      h = ((h ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return h


def decode(part, origin):
  xyz = (
    np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3) / 100
    + origin
  )
  colors = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
  return xyz, colors, ix


def canopy_faces(packet, b):
  """Find the complete literal roof and full height walls of exactly one owner."""
  origin = packet["origin"]
  p = poly(b, origin)
  ground = packet["nav"]["groundY"] + b.get("groundOffset", 0)
  low = ground + b["minHeight"]
  selected = []
  roof = []
  wall_area = 0
  boundary = p.boundary.buffer(0.025)
  for mi, part in enumerate(packet["meshes"]):
    if part["kind"] != "city" or part.get("colorType", "u8") != "u8":
      continue
    xyz, colors, ix = decode(part, origin)
    # Vectorized envelope rejection leaves only finite owner triangles.
    v = xyz[ix]
    bounds = p.bounds
    near = np.flatnonzero(
      (v[:, :, 0].max(1) >= bounds[0] - 0.03)
      & (v[:, :, 0].min(1) <= bounds[2] + 0.03)
      & (v[:, :, 2].max(1) >= bounds[1] - 0.03)
      & (v[:, :, 2].min(1) <= bounds[3] + 0.03)
      & (v[:, :, 1].max(1) > low + 0.02)
    )
    for ti in near:
      q = v[ti]
      proj = Polygon(q[:, [0, 2]])
      minimum = q[:, 1].min()
      if proj.area > 0.00001 and minimum > low + 0.1 and p.buffer(0.025).covers(proj):
        selected.append((mi, int(ti), q, colors[ix[ti]], "roof"))
        roof.append(proj)
      elif (
        proj.area < 0.000001
        and abs(minimum - low) < 0.025
        and boundary.covers(LineString(q[:, [0, 2]]))
      ):
        selected.append((mi, int(ti), q, colors[ix[ti]], "wall"))
        wall_area += float(np.linalg.norm(np.cross(q[1] - q[0], q[2] - q[0])) / 2)
  if not roof:
    return None, "no literal roof faces"
  footprint = unary_union(roof)
  if footprint.symmetric_difference(p).area > max(0.12, p.area * 0.002):
    return None, "roof coverage does not equal complete owner"
  # Source packets intentionally omit artificial walls on tile clip edges.
  # All literal vertical faces on this exact perimeter are captured above;
  # the complete roof union proves that this is the entire clipped owner.
  if wall_area < 1:
    return None, "no literal perimeter walls"
  return (
    selected,
    p,
    ground,
    min(q[:, 1].min() for _, _, q, _, kind in selected if kind == "roof"),
    footprint,
  ), None


def clip_above(q, c, y):
  rows = [(p.copy(), rgb.copy().astype(float)) for p, rgb in zip(q, c, strict=True)]
  out = []
  for a, b in zip(rows, rows[1:] + rows[:1]):
    ina = a[0][1] >= y
    inb = b[0][1] >= y
    if ina:
      out.append(a)
    if ina != inb:
      t = (y - a[0][1]) / (b[0][1] - a[0][1])
      out.append((a[0] + t * (b[0] - a[0]), np.rint(a[1] + t * (b[1] - a[1]))))
  return out


def details(mesh, p, ground, underside, brand, native, origin, identity):
  """Finite recognition parts, never asserted to be surveyed dispenser locations."""
  nav = []
  accent = rgb(BRANDS.get(brand.casefold(), (70, 108, 111)))
  safe = p.buffer(-0.65 if not native else -1.05)
  if safe.is_empty:
    return nav, 0
  # Drawn uses the independently sourced canopy axis; Native uses cardinal axes.
  r = p.minimum_rotated_rectangle
  coords = list(r.exterior.coords)
  edges = [(math.dist(a, b), np.array(b) - a) for a, b in zip(coords, coords[1:])]
  axis = max(edges, key=lambda x: x[0])[1]
  axis = axis / np.linalg.norm(axis)
  if native:
    axis = (
      np.array([1.0, 0.0]) if abs(axis[0]) >= abs(axis[1]) else np.array([0.0, 1.0])
    )
  cross = np.array([-axis[1], axis[0]])
  center = np.array(p.centroid.coords[0])
  width = max(np.dot(np.array(x) - center, axis) for x in p.exterior.coords) - min(
    np.dot(np.array(x) - center, axis) for x in p.exterior.coords
  )

  def rectangle(center, w, d):
    a = np.array(center)
    corners = [
      a + axis * x + cross * z
      for x, z in [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
    ]
    if native:
      lo = np.floor(np.min(corners, axis=0) * 2) / 2
      extent = np.maximum(
        np.round((np.max(corners, axis=0) - np.min(corners, axis=0)) * 2) / 2, 0.5
      )
      return box(lo[0], lo[1], lo[0] + extent[0], lo[1] + extent[1])
    return Polygon(corners)

  # Two/three separated islands leave a large clear central driving/walking band.
  count = 0
  for offset in (-0.27, 0.27):
    for side in (-1, 1):
      c = (
        center
        + axis * width * offset
        + cross * side * min(2.8, math.sqrt(p.area) * 0.12)
      )
      if native:
        c = np.round(c * 2) / 2
      column = rectangle(c, 0.34 if not native else 0.5, 0.34 if not native else 0.5)
      if not safe.covers(column):
        continue
      mesh.prism(column, ground, underside, METAL)
      nav.append(
        navsolid(column, ground, underside, origin, ground, identity + f":post:{count}")
      )
      island = rectangle(c, 2.8 if not native else 3.0, 1.15 if not native else 1.5)
      if safe.covers(island):
        mesh.prism(island, ground + 0.01, ground + 0.16, CONCRETE)
        nav.append(
          navsolid(
            island, ground, ground + 0.16, origin, ground, identity + f":island:{count}"
          )
        )
        pc = c + axis * 0.82
        body = rectangle(pc, 0.72 if not native else 1.0, 0.45 if not native else 0.5)
        if safe.covers(body):
          mesh.prism(body, ground + 0.16, ground + 1.58, WHITE, accent)
          nav.append(
            navsolid(
              body,
              ground + 0.16,
              ground + 1.58,
              origin,
              ground,
              identity + f":pump:{count}",
            )
          )
          top = rectangle(pc, 0.74 if not native else 1.0, 0.47 if not native else 0.5)
          mesh.prism(top, ground + 1.58, ground + 1.72, accent)
          screen = rectangle(
            pc + cross * 0.235, 0.4 if not native else 0.5, 0.02 if not native else 0.5
          )
          if safe.covers(screen):
            mesh.prism(screen, ground + 1.08, ground + 1.35, DISPLAY)
          if not native:
            for side2 in (-1, 1):
              hose = rectangle(pc + axis * side2 * 0.4, 0.055, 0.07)
              mesh.prism(hose, ground + 0.45, ground + 1.4, BLACK)
        count += 1
  # Coloured canopy fascia is confined to the supported mapped roof boundary.
  for piece in polygons_from_geometry(p):
    for a, b in zip(piece.exterior.coords, list(piece.exterior.coords)[1:]):
      if math.dist(a, b) < 0.4:
        continue
      line = LineString([a, b])
      band = line.buffer(0.035, cap_style="flat").intersection(p)
      if not band.is_empty:
        mesh.prism(band, underside + 0.03, underside + 0.24, accent)
  return nav, count


def compile_existing():
  candidates = read(TASK / "fuel-candidates.json")
  byhost = defaultdict(list)
  report = []
  eligible_global = {
    o["sourceId"]
    for c in candidates
    for h in c["hosts"]
    for o in h["owners"]
    if o["coverage"] > 0.88 and o["roofCoverage"] > 0.2 and o["height"] < 9
  }
  for c in candidates:
    for host in c["hosts"]:
      byhost[host["id"]].append((c, host))
  packets = {}
  owners_report = []
  for host, rows in byhost.items():
    for mode in ("drawn", "minecraft"):
      cap = read(TASK / f"fuel-captures/{mode}-{host}.json.gz")
      p = cap["prepared"]
      origin = p["origin"]
      native = mode == "minecraft"
      mesh = Mesh(origin)
      plan = cap["plan"]
      retire = defaultdict(set)
      retire_nav = []
      append_nav = []
      ownership = []
      used = set()
      for c, h in rows:
        roof = c["roof"]
        site = c["site"]
        eligible = {
          o["sourceId"]
          for o in h["owners"]
          if o["sourceId"] in eligible_global and o["coverage"] > 0.88
        }
        matches = [b for b in p["nav"]["buildings"] if b["sourceId"] in eligible]
        if not matches:
          report.append(
            {
              "roof": roof["id"],
              "site": site["id"],
              "mode": mode,
              "host": host,
              "state": "unresolved",
              "reason": "no unambiguous mapped canopy owner",
            }
          )
          continue
        for b in matches:
          if b["sourceId"] in used:
            continue
          if b["minHeight"] > 0:
            report.append(
              {
                "roof": roof["id"],
                "mode": mode,
                "host": host,
                "state": "already-open",
                "sourceId": b["sourceId"],
              }
            )
            continue
          result, reason = canopy_faces(p, b)
          if reason:
            report.append(
              {
                "roof": roof["id"],
                "mode": mode,
                "host": host,
                "state": "unresolved",
                "sourceId": b["sourceId"],
                "reason": reason,
              }
            )
            continue
          faces, footprint, ground, minroof, _ = result
          if minroof - ground < 2.5:
            report.append(
              {
                "roof": roof["id"],
                "mode": mode,
                "host": host,
                "state": "unresolved",
                "reason": "canopy roof clearance not supported",
              }
            )
            continue
          # Keep each measured roof face and its colours exactly; remove only the
          # full-depth walls, replacing them with the thin fascia and open supports.
          underside = round(minroof - (0.5 if native else 0.42), 2)
          for mi, ti, q, colors, kind in faces:
            if kind == "roof":
              continue
            retire[mi].add(ti)
            clipped = clip_above(q, colors, underside)
            for i in range(1, len(clipped) - 1):
              mesh.triangle(
                [clipped[j][0] for j in (0, i, i + 1)],
                [clipped[j][1] for j in (0, i, i + 1)],
              )
          mesh.surface(footprint, underside, WHITE, True)
          replacement = dict(
            b, minHeight=round(underside - ground + b.get("groundOffset", 0), 2)
          )
          # minHeight is relative to nav groundY; LoD2 groundOffset is preserved.
          replacement["minHeight"] = round(
            underside - p["nav"]["groundY"] - b.get("groundOffset", 0), 2
          )
          replacement["heightSource"] = (
            str(b.get("heightSource", ""))
            + "; mapped building=roof open underside, 0.42/0.50 m slab estimate"
          )
          replacement.pop("bottomRoofTriangles", None)
          extra, count = details(
            mesh,
            footprint,
            ground,
            underside,
            site["tags"].get("brand", site["tags"].get("name", "")),
            native,
            origin,
            roof["id"],
          )
          retire_nav.append(b)
          append_nav.extend([replacement, *extra])
          ownership.append("fuel-v351:" + roof["id"] + ":" + b["sourceId"])
          used.add(b["sourceId"])
          owners_report.append(
            {
              "roof": roof["id"],
              "site": site["id"],
              "mode": mode,
              "host": host,
              "sourceId": b["sourceId"],
              "oldNav": b,
              "newRoofNav": replacement,
              "worldBounds": list(footprint.bounds),
              "ground": ground,
              "underside": underside,
              "estimatedPumpGroups": count,
              "retiredWalls": sum(kind == "wall" for *_, kind in faces),
              "preservedRoofTriangles": sum(kind == "roof" for *_, kind in faces),
            }
          )
      if not mesh.indices:
        continue
      append = mesh.payload()
      plan.update(
        append=append,
        appendFingerprint=fingerprint(append),
        retire=[
          {"mesh": mi, "triangles": sorted(values)}
          for mi, values in sorted(retire.items())
        ],
        retireLines=[],
        retireNav=retire_nav,
        appendNav=append_nav,
        owners=ownership,
      )
      if len(plan["preparedRecords"]) + 1 > 16:
        raise ValueError("host part limit")
      packets[f"{mode}:{host}"] = plan
  write(
    GEO / "fuel-v351-ownership.json.gz",
    {"schemaVersion": 1, "owners": owners_report, "unresolved": report},
  )
  sources = []
  keys = list(packets)
  for start in range(0, len(keys), 16):
    group = keys[start : start + 16]
    file = f"fuelStationsV351Packets{start // 16:03}.json.gz"
    path = APP / "src/data" / file
    write(
      path,
      {"schemaVersion": 1, "keys": group, "packets": {k: packets[k] for k in group}},
    )
    sources.append(
      {
        "file": file,
        "keys": group,
        "decodedBytes": len(gzip.decompress(path.read_bytes())),
      }
    )
  write(
    APP / "src/data/fuelStationsV351Index.json",
    {"schemaVersion": 1, "sources": sources},
  )
  print(
    json.dumps(
      {
        "packets": len(packets),
        "owners": len(owners_report),
        "roofs": len(set(r["roof"] for r in owners_report)),
        "unresolved": len(report),
        "bytes": sum((APP / "src/data" / s["file"]).stat().st_size for s in sources),
      }
    )
  )


def cardinal_support(area):
  """Independent half-metre cells fully inside the mapped source perimeter."""
  rectangles = []
  for component in shapely.get_parts(area):
    if component.is_empty or component.area < 0.25:
      continue
    x0, z0, x1, z1 = component.bounds
    xs = np.arange(math.floor(x0 * 2), math.ceil(x1 * 2))
    for zi in range(math.floor(z0 * 2), math.ceil(z1 * 2)):
      cells = shapely.box(xs / 2, zi / 2, (xs + 1) / 2, (zi + 1) / 2)
      covered = shapely.covers(component, cells)
      gaps = np.flatnonzero(np.diff(np.r_[False, covered, False]))
      for a, b in zip(gaps[::2], gaps[1::2], strict=True):
        rectangles.append(box(xs[a] / 2, zi / 2, (xs[b - 1] + 1) / 2, (zi + 1) / 2))
  return unary_union(rectangles).simplify(0)


def compile_new():
  """Only separately mapped roofs absent from the old ground/body coverage."""
  import hashlib

  terrain = read(GEO / "fuel-v351-terrain.json.gz")
  samples = {r["roofId"]: r for r in terrain["sites"]}
  candidates = [c for c in read(TASK / "fuel-candidates.json") if not c["hosts"]]
  old_manifest = read(PACKETS / "manifest.json")
  old = [c for c in old_manifest["chunks"] if not c["id"].startswith("fuel351-")]
  chunks = []
  evidence = []
  for row in candidates:
    roof = row["roof"]
    site = row["site"]
    g = shape(roof["geometry"])
    sample = samples[roof["id"]]
    heights = [s["worldY"] for s in sample["samples"] if g.covers(Point(s["queryXZ"]))]
    if not heights:
      raise ValueError("No source terrain beneath roof")
    ground = round(float(np.median(heights)), 2)
    prior = {"drawn": [], "minecraft": []}
    for descriptor in old:
      if not box(*descriptor["bounds"]).intersects(g):
        continue
      for mode in ("drawn", "minecraft"):
        raw = read(PACKETS / descriptor[mode]["url"])
        for b in raw["nav"]["buildings"]:
          if poly(b, raw["origin"]).intersection(g).area > 0.1:
            raise ValueError("New canopy overlaps existing building owner")
        for b in raw["nav"]["ground"]:
          prior[mode].append(poly(b, raw["origin"]))
    identity = "fuel351-" + roof["id"].replace("/", "-")
    origin = [math.floor(g.bounds[0]) - 1, -10, math.floor(g.bounds[1]) - 1]
    descriptor = {
      "id": identity,
      "bounds": [
        math.floor(g.bounds[0] * 100) / 100 - 0.01,
        math.floor(g.bounds[1] * 100) / 100 - 0.01,
        math.ceil(g.bounds[2] * 100) / 100 + 0.01,
        math.ceil(g.bounds[3] * 100) / 100 + 0.01,
      ],
      "buildingCount": 1,
    }
    record = {
      "roof": roof["id"],
      "site": site["id"],
      "host": identity,
      "groundWorldY": ground,
      "heightDatum": "median of official DGM1 samples inside mapped roof; flat forecourt approximation",
      "terrainMinimum": min(heights),
      "terrainMaximum": max(heights),
      "oldGroundOverlapM2": {
        mode: g.intersection(unary_union(rows)).area for mode, rows in prior.items()
      },
      "sourceGeometry": roof["geometry"],
      "modes": {},
    }
    for native, mode in [(False, "drawn"), (True, "minecraft")]:
      footprint = cardinal_support(g) if native else g
      ground_complement = g.difference(unary_union(prior[mode]))
      floor = cardinal_support(ground_complement) if native else ground_complement
      base = round(ground * 2) / 2 if native else ground
      high_text = roof["tags"].get("height")
      low_text = roof["tags"].get("min_height")
      try:
        height = float(high_text) if high_text else 5.4
      except (TypeError, ValueError):
        height = 5.4
      try:
        clear = float(low_text) if low_text else height - 0.45
      except (TypeError, ValueError):
        clear = height - 0.45
      if not 3 < height < 12 or not 2.5 < clear < height:
        height, clear = 5.4, 4.95
      if native:
        height = round(height * 2) / 2
        clear = height - 0.5
      mesh = Mesh(origin)
      mesh.surface(floor, base, CONCRETE)
      nav = []
      for pi, p in enumerate(polygons_from_geometry(footprint)):
        mesh.prism(p, base + clear, base + height, WHITE)
        roof_nav = navsolid(
          p, base + clear, base + height, origin, base, roof["id"] + f":roof:{pi}"
        )
        roof_nav["heightSource"] = "OSM roof footprint; " + (
          "OSM height/min_height"
          if high_text and low_text
          else "canopy clearance and thickness estimated"
        )
        nav.append(roof_nav)
        extra, count = details(
          mesh,
          p,
          base,
          base + clear,
          site["tags"].get("brand", site["tags"].get("name", "")),
          native,
          origin,
          roof["id"] + f":part:{pi}",
        )
        nav.extend(extra)
      packet = {
        "schemaVersion": 1,
        "id": identity,
        "origin": origin,
        "meshes": [mesh.payload()],
        "nav": {
          "ground": [
            {
              "ring": round_ring(p, origin),
              "holes": [
                [
                  [round(x - origin[0], 2), round(z - origin[2], 2)]
                  for x, z in r.coords
                ]
                for r in p.interiors
              ],
            }
            for p in polygons_from_geometry(floor)
          ],
          "groundY": base,
          "buildings": nav,
          "water": [],
          "roads": [],
          "bridges": [],
        },
      }
      path = PACKETS / f"{identity}.{mode}.json.gz"
      write(path, packet)
      raw_bytes = gzip.decompress(path.read_bytes())
      descriptor[mode] = {
        "url": path.name,
        "bytes": path.stat().st_size,
        "decodedBytes": len(raw_bytes),
        "encoding": "gzip",
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      }
      record["modes"][mode] = {
        "groundY": base,
        "roofAreaM2": footprint.area,
        "groundAreaM2": floor.area,
        "columns": sum(":post:" in b["sourceId"] for b in nav),
        "pumps": sum(":pump:" in b["sourceId"] for b in nav),
        "vertices": len(mesh.vertices),
        "triangles": len(mesh.indices) // 3,
        "clearance": clear,
        "roofHeight": height,
      }
    chunks.append(descriptor)
    evidence.append(record)
  write(
    GEO / "fuel-v351-new-hosts.json.gz",
    {
      "schemaVersion": 1,
      "source": "fuel-v351-source.json.gz and fuel-v351-terrain.json.gz",
      "chunks": chunks,
      "sites": evidence,
      "policy": "Only exact mapped roof footprints and their source-ground complement, never district fill. Roof height, column locations and dispenser arrangements are bounded recognition estimates unless explicitly tagged.",
    },
  )
  write(TASK / "fuel-manifest-delta.json", {"chunks": chunks})
  print(
    json.dumps(
      {
        "newHosts": len(chunks),
        "packetBytes": sum(
          c[m]["bytes"] for c in chunks for m in ("drawn", "minecraft")
        ),
        "roofSites": len(set(e["site"] for e in evidence)),
      }
    )
  )


def compile_dispositions():
  """One honest disposition for every retained source site, including inactive."""
  from collections import Counter

  from scripts.build_fuel_inventory_v351 import INVENTORY, sha

  inventory = read(INVENTORY)
  old = read(GEO / "fuel-v351-ownership.json.gz")
  new = read(GEO / "fuel-v351-new-hosts.json.gz")
  operators = read(GEO / "fuel-v351-operator-evidence.json.gz")
  listed = {r["mappedId"] for r in operators["identityMatches"]}
  repaired = {r["site"]: r["roof"] for r in old["owners"]}
  added = {r["site"]: r["roof"] for r in new["sites"]}
  records = []
  for site in inventory["records"]:
    identity = site["id"]
    roof = []
    if site["state"] != "mapped-active":
      state = "inactive-source"
      reason = site["state"] + " source retained; not built as active station"
    elif site.get("legacyModelIndex") is not None:
      state = "preserved-legacy"
      reason = "Complete earlier detailed model retained byte-for-byte"
    elif identity in repaired:
      state = "canopy-corrected"
      reason = "Exact literal old roof retained; full-depth walls opened with matching navigation"
      roof = [repaired[identity]]
    elif identity in added:
      state = "newly-modeled-canopy"
      reason = "Exact mapped roof footprint with DGM-supported finite ground"
      roof = [added[identity]]
    else:
      state = "unresolved-geometry"
      reason = (
        "Matching navigation envelope lacks complete literal roof faces"
        if site.get("roofs")
        else "No unambiguous mapped canopy footprint"
      )
    records.append(
      {
        "id": identity,
        "mappedState": site["state"],
        "representation": state,
        "reason": reason,
        "roofs": roof,
        "operatorIdentity": "listed-in-current-primary-directory"
        if identity in listed
        else "not-independently-confirmed",
      }
    )
  write(
    GEO / "fuel-v351-dispositions.json.gz",
    {
      "schemaVersion": 1,
      "inventorySha256": sha(INVENTORY),
      "operatorEvidenceSha256": sha(GEO / "fuel-v351-operator-evidence.json.gz"),
      "counts": dict(Counter(r["representation"] for r in records)),
      "records": records,
    },
  )
  print(dict(Counter(r["representation"] for r in records)))


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--scan", action="store_true")
  parser.add_argument("--new", action="store_true")
  parser.add_argument("--audit", action="store_true")
  args = parser.parse_args()
  if args.scan:
    scan()
  elif args.new:
    compile_new()
  elif args.audit:
    compile_dispositions()
  else:
    compile_existing()
