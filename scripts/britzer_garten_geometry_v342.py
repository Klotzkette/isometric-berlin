"""Source-bound Britzer Garten fittings; dimensions not mapped are display estimates."""

from __future__ import annotations

import hashlib
import math
from collections import defaultdict

import numpy as np
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union

from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_surrounding_outlines import line_parts, polygons_from_geometry
from scripts.marzahn_garden_context_geometry_v330 import draw_trees, quad
from scripts.marzahn_garden_landmarks_v330 import Garden, fitted_boxes

GLASS = (80, 107, 103)
STONE = (163, 157, 139)
GREEN = (103, 130, 75)
STEEL = (174, 183, 177)
CAFE = "DEBE08YYF0001XTO"
PAVILION = "DEBE08YYF0001dFe"
ORANGERIE = "DEBE08YYF0001aOw"


def beam(model, a, b, width, color):
  """A smooth solid prism in Drawn, independently sampled cardinal bars in Native."""
  a, b = np.array(a, dtype=float), np.array(b, dtype=float)
  delta = b - a
  length = np.linalg.norm(delta)
  if length < 0.001:
    return
  if model.native:
    n = max(1, math.ceil(length / 0.22))
    for i in range(n):
      p = a + delta * ((i + 0.5) / n)
      x, y, z = p
      model.solid(
        box(x - width / 2, z - width / 2, x + width / 2, z + width / 2),
        y - width / 2,
        y + width / 2,
        color,
        grid=0.1,
        strict=False,
      )
    return
  u = delta / length
  helper = np.array([0, 1, 0]) if abs(u[1]) < 0.9 else np.array([1, 0, 0])
  v = np.cross(u, helper)
  v = v / np.linalg.norm(v) * width / 2
  w = np.cross(u, v)
  rings = [
    [tuple(p + v * s + w * t) for s, t in [(1, 1), (-1, 1), (-1, -1), (1, -1)]]
    for p in (a, b)
  ]
  for i in range(4):
    quad(
      model.triangles,
      rings[0][i],
      rings[0][(i + 1) % 4],
      rings[1][(i + 1) % 4],
      rings[1][i],
      color,
    )
  quad(model.triangles, *rings[1], color)


def roof_height(tris, x, z, default):
  values = []
  for a, b, c in tris:
    u = np.array([b[0] - a[0], b[2] - a[2]])
    v = np.array([c[0] - a[0], c[2] - a[2]])
    det = u[0] * v[1] - u[1] * v[0]
    if abs(det) < 1e-8:
      continue
    qx, qz = x - a[0], z - a[2]
    r = (qx * v[1] - qz * v[0]) / det
    s = (u[0] * qz - u[1] * qx) / det
    if r >= -1e-5 and s >= -1e-5 and r + s <= 1.00001:
      values.append(a[1] + r * (b[1] - a[1]) + s * (c[1] - a[1]))
  return max(values) if values else default


def measured_buildings(source, model):
  """All complete interior-site LoD2 leaves, with independent cardinal roof columns."""
  owners = []
  account = []
  model.roof_navigation = {}
  for row in source["lod2"]["buildings"]:
    footprint = Polygon(row["ring"], row["holes"])
    if footprint.difference(model.park).area > 0.02:
      account.append(
        {"id": row["id"], "status": "retained-source-boundary-leaf-not-expanded"}
      )
      continue
    identity = row["id"]
    kind = (
      "cafe"
      if identity == CAFE
      else "green"
      if identity == PAVILION or row["parentId"] == ORANGERIE
      else "ordinary"
    )
    roof = (
      (113, 119, 103)
      if kind == "cafe"
      else GREEN
      if kind == "green"
      else (130, 124, 112)
    )
    wall = (142, 137, 123) if kind == "cafe" else (182, 177, 157)
    low = row["ground_y_m"]
    high = row["top_y_m"]
    roofs = []
    for surface in row["surfaces"]:
      t = list(triangles_for(surface["rings"]))
      if surface["kind"] == "RoofSurface":
        roofs.extend(t)
      if not model.native:
        model.triangles.extend(
          (p, roof if surface["kind"] == "RoofSurface" else wall) for p in t
        )
    if model.native:
      # Cardinal grid cells have independently sampled original roof surfaces,
      # retaining measured sloped/stepped roofs and inner courtyard exclusions.
      step = 0.75
      x0, z0, x1, z1 = footprint.bounds
      cells = defaultdict(list)
      for ix in range(math.floor(x0 / step), math.ceil(x1 / step)):
        for iz in range(math.floor(z0 / step), math.ceil(z1 / step)):
          x, z = (ix + 0.5) * step, (iz + 0.5) * step
          if not footprint.covers(Point(x, z)):
            continue
          top = round(roof_height(roofs, x, z, high) * 10) / 10
          cells[top].append(box(ix * step, iz * step, (ix + 1) * step, (iz + 1) * step))
      for top, polys in cells.items():
        for p in polygons_from_geometry(unary_union(polys)):
          model.uncut_solid(p, low, top, wall, roof)
      complete = unary_union([p for parts in cells.values() for p in parts]).simplify(0)
      model.solids.append((identity, complete, low, max(cells) - low))
      model.roof_navigation[identity] = {
        "nativeRoofCaps": [
          [*p.bounds, round(top - low, 3)]
          for top, parts in cells.items()
          for p in parts
        ]
      }
    # All source-building envelopes remain physical; no invented public rooms.
    if not model.native:
      model.solids.append((identity, footprint, low, high - low))
      model.roof_navigation[identity] = {
        "roofTriangles": [
          [[x, round(y - low, 3), z] for x, y, z in triangle] for triangle in roofs
        ]
      }
    owners.append(footprint)
    account.append({"id": identity, "status": "complete-LoD2-shell", "role": kind})
    if kind in ("green", "cafe"):
      edges = list(footprint.exterior.coords)
      # External photos establish glazing along the southern public garden front.
      # Window subdivision and setback are explicit display estimates.
      for a, b in zip(edges, edges[1:]):
        length = math.dist(a, b)
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        if length < 1.8 or mid[1] < footprint.centroid.y - 0.5:
          continue
        nx, nz = (b[1] - a[1]) / length, -(b[0] - a[0]) / length
        # Source polygon winding-independent outward normal.
        if footprint.covers(Point(mid[0] + nx * 0.12, mid[1] + nz * 0.12)):
          nx, nz = -nx, -nz
        base = max(low, model.g(*mid)) + 0.18
        top = min(high - 0.35, base + (3.15 if kind == "cafe" else 2.65))
        if top - base < 0.6:
          continue
        count = max(1, round(length / 1.5))
        for i in range(count):
          u, v = (i + 0.08) / count, (i + 0.92) / count
          p = (
            a[0] + (b[0] - a[0]) * u + nx * 0.035,
            a[1] + (b[1] - a[1]) * u + nz * 0.035,
          )
          q = (
            a[0] + (b[0] - a[0]) * v + nx * 0.035,
            a[1] + (b[1] - a[1]) * v + nz * 0.035,
          )
          h = top
          if kind == "cafe":
            h = base + (top - base) * (
              0.7 + 0.3 * math.sin(math.pi * (i + 0.5) / count)
            )
          if model.native:
            for piece in polygons_from_geometry(
              fitted_boxes(LineString((p, q)).buffer(0.11), 0.15, False)
            ):
              model.uncut_solid(piece, base, h, GLASS, GLASS)
          else:
            quad(
              model.triangles,
              (p[0], base, p[1]),
              (q[0], base, q[1]),
              (q[0], h, q[1]),
              (p[0], h, p[1]),
              GLASS,
            )
          beam(model, (p[0], base, p[1]), (p[0], h, p[1]), 0.075, (107, 102, 87))
  return unary_union(owners), account


def bridge_models(source, model):
  """Mapped bridges retain actual vertices and measured bank-height fits."""
  floors = []
  barriers = []
  accounts = []
  for record in source["osm"]["records"]:
    tags = record["tags"]
    if (
      record["layer"] != "lines"
      or tags.get("bridge") in (None, "no")
      or not tags.get("highway")
    ):
      continue
    # Refuse the explicitly inaccessible damaged bridge, private service crossings
    # and play-equipment bridges without their separate measured supports.
    if (
      tags.get("access") in ("private", "no")
      or tags.get("foot") == "no"
      or tags.get("description") == "Teil des Spielplatzes"
    ):
      continue
    width = float(tags.get("width", "2.4").split()[0])
    for line in line_parts(shape(record["geometry"]).intersection(model.park)):
      length = line.length
      if length < 0.5:
        continue
      a, b = line.coords[0], line.coords[-1]
      lo, hi = model.g(*a), model.g(*b)
      ds = sorted(
        {
          0.0,
          length,
          *[line.project(Point(p)) for p in line.coords],
          *[
            length * i / math.ceil(length / 0.8)
            for i in range(1, math.ceil(length / 0.8))
          ],
        }
      )
      for start, end in zip(ds, ds[1:]):
        if end - start < 0.02:
          continue
        a, b = line.interpolate(start), line.interpolate(end)
        dx, dz = b.x - a.x, b.y - a.y
        n = math.hypot(dx, dz)
        nx, nz = -dz / n, dx / n
        y = round((lo + (hi - lo) * (start + end) / 2 / length + 0.04) * 100) / 100
        p = (
          LineString((a, b))
          .buffer(width / 2, cap_style="flat")
          .intersection(model.park)
        )
        if model.native:
          p = fitted_boxes(p.buffer(0.10), 0.25, False).intersection(model.park)
        # Piecewise constant small steps match exact represented walkable floor.
        model.solid(p, y - 0.14, y, (142, 130, 107), grid=0.25)
        floors.append((p, y))
        for side in (-1, 1):
          pp = (a.x + nx * width / 2 * side, a.y + nz * width / 2 * side)
          qq = (b.x + nx * width / 2 * side, b.y + nz * width / 2 * side)
          beam(
            model,
            (pp[0], y + 1.03, pp[1]),
            (qq[0], y + 1.03, qq[1]),
            0.09,
            (91, 86, 72),
          )
          if start == 0 or int(start / 1.6) != int(end / 1.6):
            beam(model, (pp[0], y, pp[1]), (pp[0], y + 1.08, pp[1]), 0.10, (91, 86, 72))
          rail = LineString((pp, qq)).buffer(0.08, cap_style="flat")
          if model.native:
            rail = fitted_boxes(rail, 0.1, False)
          barriers.append((rail.intersection(model.park), y, y + 1.08))
      accounts.append(
        {
          "id": record["id"],
          "lengthM": length,
          "widthM": width,
          "heightFit": "measured banks; unsurveyed deck interpolation",
        }
      )
  return floors, barriers, accounts


def park_details(source, ground, native, roads):
  model = Garden({"park": source["scope"]}, ground, native)
  model.tag = "britzer342"
  buildings, account = measured_buildings(source, model)
  records = source["osm"]["records"]
  byid = {r["id"]: r for r in records}
  exclusion = (
    buildings.buffer(0.6).union(roads.buffer(0.45)).union(shape(source["water"]))
  )
  tree_records = [
    (r["id"], shape(r["geometry"]), r["tags"])
    for r in records
    if r["layer"] == "points"
    and r["tags"].get("natural") == "tree"
    and model.park.covers(shape(r["geometry"]))
  ]
  trees, solids = draw_trees(tree_records, ground, native, exclusion)
  model.triangles.extend(trees)
  model.solids.extend(solids)
  # A mapped woodland boundary describes continuous woody cover, not individual
  # tree positions. These restrained canopy masses interpret that land cover;
  # they are deliberately separate from the individually mapped tree inventory.
  # No invented trunks/collisions or foliage over a mapped path or clearing.
  woods = unary_union(
    [
      shape(r["geometry"])
      for r in records
      if r["layer"] == "multipolygons"
      and (r["tags"].get("natural") == "wood" or r["tags"].get("landuse") == "forest")
    ]
  ).intersection(model.park)
  tree_space = unary_union([p.buffer(4) for _, p, _ in tree_records])
  canopy_domain = woods.difference(exclusion.buffer(1)).difference(tree_space)
  woodland_masses = 0
  for part in polygons_from_geometry(canopy_domain):
    x0, z0, x1, z1 = part.bounds
    for ix in range(math.floor(x0 / 7), math.ceil(x1 / 7)):
      for iz in range(math.floor(z0 / 7), math.ceil(z1 / 7)):
        seed = hashlib.sha256(f"woodland:{ix}:{iz}".encode()).digest()
        x = (ix + 0.35 + seed[0] / 850) * 7
        z = (iz + 0.35 + seed[1] / 850) * 7
        if not part.covers(Point(x, z).buffer(3.0)):
          continue
        y = model.g(x, z)
        model.sphere(
          (x, z),
          3.0,
          5.8,
          y + 7.2 + seed[2] / 150,
          (68 + seed[3] % 19, 107 + seed[4] % 24, 52 + seed[5] % 18),
          n=6,
        )
        woodland_masses += 1
  # Mapped flowerbeds and hedge courses keep their actual outlines and entrances.
  planted = 0
  hedges = 0
  for r in records:
    tags = r["tags"]
    geom = shape(r["geometry"])
    if r["layer"] == "lines" and tags.get("barrier") == "hedge":
      for line in line_parts(
        geom.intersection(model.park).difference(roads.buffer(0.3))
      ):
        model.wall_on(
          line, 0.65, 1.05, (78, 111, 63), r["id"], cap=(104, 133, 79), grid=0.25
        )
        hedges += 1
    if r["layer"] != "multipolygons" or tags.get("landuse") != "flowerbed":
      continue
    area = geom.intersection(model.park).difference(exclusion)
    if area.area < 0.5:
      continue
    model.floor(area, (101, 122, 70), 0.04)
    x0, z0, x1, z1 = area.bounds
    seed = hashlib.sha256(r["id"].encode()).digest()
    color = ((165, 104, 124), (197, 173, 115), (196, 178, 163), (146, 136, 166))[
      seed[0] % 4
    ]
    for x in np.arange(x0 + 0.5, x1, 2.2):
      for z in np.arange(z0 + 0.5, z1, 2.2):
        if not area.covers(Point(x, z).buffer(0.38)):
          continue
        model.sphere(
          (float(x), float(z)), 0.39, 0.55, model.g(x, z) + 0.27, (85, 112, 62), n=5
        )
        model.sphere((float(x), float(z)), 0.29, 0.18, model.g(x, z) + 0.6, color, n=5)
        planted += 1
  # Calendar square's 14m Gnomon, inclined to the polar axis, with open lattice.
  r = byid["node/2794358526"]
  x, z = shape(r["geometry"]).coords[0]
  y = model.g(x, z)
  top = (x, y + 14, z - 14 / math.tan(math.radians(52.43)))
  model.solid(Point(x, z).buffer(0.9), y - 0.02, y + 0.28, STONE, "gnomon-base")
  for off in (-0.48, 0.48):
    beam(model, (x + off, y + 0.2, z), top, 0.13, STEEL)
  beam(model, (x, y + 0.2, z + 0.7), top, 0.13, STEEL)
  for i in range(1, 14):
    f = i / 14
    px = x
    py = y + 14 * f
    pz = z + (top[2] - z) * f
    w = 0.48 * (1 - f)
    beam(model, (px - w, py, pz), (px + w, py, pz), 0.07, STEEL)
    beam(
      model,
      (px - w, py, pz),
      (px + w * 0.85, py + 0.8, pz + (top[2] - z) * 0.8 / 14),
      0.06,
      STEEL,
    )
  # Original mapped square, ornamental astronomical inlays, no invented text.
  square = shape(byid["way/454453427"]["geometry"]).intersection(model.park)
  model.floor(square, (180, 172, 151), 0.04)
  for radius in (5, 9, 13):
    model.floor(
      Point(x, z)
      .buffer(radius, quad_segs=24)
      .boundary.buffer(0.055)
      .intersection(square),
      (117, 105, 77),
      0.055,
      grid=0.2,
      strict=False,
    )
  for i in range(12):
    ang = i * math.tau / 12
    model.floor(
      LineString(
        (
          (x + math.sin(ang) * 4, z + math.cos(ang) * 4),
          (x + math.sin(ang) * 13, z + math.cos(ang) * 13),
        )
      )
      .buffer(0.045)
      .intersection(square),
      (125, 111, 79),
      0.058,
      grid=0.15,
      strict=False,
    )
  # Susanne Mahlmeister's two mapped groups, twelve tilted steel rods each.
  for key in ("node/9693101663", "node/9693101664"):
    px, pz = shape(byid[key]["geometry"]).coords[0]
    for i in range(12):
      a = (px + (i % 4 - 1.5) * 1.35, pz + (i // 4 - 1) * 1.05)
      gy = model.g(*a)
      beam(
        model,
        (a[0], gy, a[1]),
        (a[0] + 1.6, gy + 3.7 + (i % 3) * 0.28, a[1] - 0.8),
        0.15,
        (119, 121, 111),
      )
  # 600mm gauge follows every original Parkbahn line; current operator says paused.
  railway = 0
  for r in records:
    if r["layer"] != "lines" or r["tags"].get("railway") != "narrow_gauge":
      continue
    for line in line_parts(shape(r["geometry"]).intersection(model.park)):
      railway += line.length
      for side in (-0.3, 0.3):
        edge = line.offset_curve(side)
        for piece in line_parts(edge):
          model.floor(
            piece.buffer(0.055, cap_style="flat"),
            (92, 91, 82),
            0.10,
            grid=0.1,
            strict=False,
          )
      for d in np.arange(0.4, line.length, 1.3):
        p = line.interpolate(d)
        q = line.interpolate(min(line.length, d + 0.1))
        angle = math.atan2(q.y - p.y, q.x - p.x)
        nx, nz = -math.sin(angle) * 0.62, math.cos(angle) * 0.62
        beam(
          model,
          (p.x + nx, model.g(p.x, p.y) + 0.06, p.y + nz),
          (p.x - nx, model.g(p.x, p.y) + 0.06, p.y - nz),
          0.12,
          (101, 91, 72),
        )
  floors, barriers, bridge_account = bridge_models(source, model)
  return (
    model.triangles,
    model.solids,
    floors,
    barriers,
    {
      "buildings": account,
      "mappedTrees": len(tree_records),
      "estimatedWoodlandCanopyMasses": woodland_masses,
      "flowerClusters": planted,
      "hedgeSegments": hedges,
      "parkbahnLengthM": railway,
      "bridges": bridge_account,
    },
    model.roof_navigation,
  )
