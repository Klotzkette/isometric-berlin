"""Regenerate the finite v288 corridor from retained local source archives."""

from __future__ import annotations

import base64
import json
import math
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pyogrio
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / "scripts")]
# These retained build helpers require the repository path installed above.
from isometric_berlin.data.fetch_lod2 import leaf_building_parts  # noqa: E402
from scripts import build_district_facades_v188 as base  # noqa: E402
from scripts.build_bebelplatz_building_source import (  # noqa: E402
  extract_parent,
  part_profile,
)
from scripts.build_breitscheid_towers_v161 import triangles_for  # noqa: E402
from scripts.build_house_doors_v233 import nav_fingerprint  # noqa: E402
from scripts.build_roof_house_v233 import fingerprint  # noqa: E402

OUT = ROOT / "src/app/src/data"
EVIDENCE = ROOT / "geo_data/regierungsviertel/potsdamer-corridor-v288-evidence.json"
manifest = base.read_json(base.OUT / "manifest.json")
descs = {d["id"]: d for d in manifest["chunks"]}
old = base.read_json(base.GEO / "district-facades-v188-evidence.json.gz")
faces = [
  f
  for f in old["faces"]
  if f.get("streetName")
  in {"Potsdamer Straße", "Hauptstraße", "Dominicusstraße", "Sachsendamm"}
  and f["a"][0] < 0
]
chunks = {}
inputs = {}
stream_counts = Counter()
for tile in sorted(set(f["chunk"] for f in faces)):
  cid = "district188-" + tile
  desc = descs[cid]
  plans = {}
  for family in ["drawn", "minecraft"]:
    packet = base.read_json(base.OUT / desc[family]["url"])
    ox, oy, oz = packet["origin"]
    fs = []
    for f in faces:
      if f["chunk"] != tile:
        continue
      rows = f["nativeSpans"] if family == "minecraft" else [f]
      for a in rows:
        if a.get("windowCount", f["windowCount"]) == 0:
          continue
        width = math.dist(a["a"], a["b"])
        native = family == "minecraft"
        nrow = max(
          1,
          int(
            (a.get("high", f["high"]) - a.get("low", f["low"]) - 1.5)
            / (4 if native else 3.6)
          ),
        )
        ncol = max(1, int((width - 1.5) / (4 if native else 3.8)))
        omitted = [] if native else f.get("omittedWindowColumns", [])
        count = nrow * (ncol - len(omitted))
        stream_counts[family + "Windows"] += count
        fs.append(
          dict(
            owner=f["owner"],
            a=[a["a"][0] - ox, a["a"][1] - oz],
            b=[a["b"][0] - ox, a["b"][1] - oz],
            low=a.get("low", f["low"]) - oy,
            high=a.get("high", f["high"]) - oy,
            normal=a["normal"],
            omitted=omitted,
          )
        )
    if not fs:
      continue
    records = [
      dict(
        mesh=i,
        kind=p["kind"],
        fingerprint=fingerprint([p["positions"], p["colors"], p["indices"]]),
      )
      for i, p in enumerate(packet["meshes"])
    ]
    plans[family] = dict(
      origin=packet["origin"],
      guard=nav_fingerprint(packet["nav"]),
      records=records,
      faces=fs,
    )
    inputs[desc[family]["url"]] = base.digest(base.OUT / desc[family]["url"])
    parent = descs[tile][family]["url"]
    inputs[parent] = base.digest(base.OUT / parent)
  chunks[cid] = plans
stream = dict(schemaVersion=1, chunks=chunks)
(OUT / "potsdamerCorridorV288.json").write_text(
  json.dumps(stream, separators=(",", ":")) + "\n"
)

prism_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
voxel_path = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
prisms = base.read_json(prism_path)
voxels = base.read_json(voxel_path)
# Exact parent/tile identities retained in the v288 source-family evidence.
# Extract all full source parts directly; no task-output identity cache is needed.
official = {}
for key, parent, tile in [
  ("loeser", "DEBE01YYK0002NK8", "389_5818"),
  ("hansa", "DEBE01YYK0002P0X", "389_5818"),
  ("werner", "DEBE01YYK0002Ngg", "389_5818"),
  ("bank", "DEBE07YY900001dL", "388_5817"),
]:
  archive = ROOT / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip"
  entity = extract_parent(archive, parent)
  official[key] = dict(
    parent=parent,
    tile=tile,
    parts=[
      part_profile(part) for part in list(leaf_building_parts(entity)) or [entity]
    ],
  )
all_polys = []
for p in prisms["buildings"]:
  s = Polygon(
    [[x / 10, z / 10] for x, z in p["ring"]],
    [[[x / 10, z / 10] for x, z in h] for h in p.get("holes", [])],
  )
  all_polys.append(s if s.is_valid else s.buffer(0))
tree = STRtree(all_polys)
ctx = base.read_json(base.CONTEXT)
road_rows = [
  r
  for r in ctx["roads"]
  if r["name"] in {"Potsdamer Straße", "Schöneberger Ufer", "Bülowstraße"}
]
roads = [__import__("shapely").geometry.shape(r["geometry"]) for r in road_rows]
roadtree = STRtree(roads)
mercator_services = pyogrio.read_dataframe(
  base.GEO / "osm.gpkg", layer="roads", bbox=(389030, 5818130, 389100, 5818180)
)
mercator_services = mercator_services[
  mercator_services["id"].isin(["380225275", "380225266", "380225261", "380225268"])
]
service_rows = [
  dict(name="Mercator-Höfe mapped service way/" + r.id, geometry=base.world(r.geometry))
  for r in mercator_services.itertuples()
]
replaced = []
sites = []
source_meta = []
native_receipts = []
named_counts = Counter()
STYLE = {
  "loeser": dict(stone=0xC8B9A4, frame=0xD5D8D3, pane=0x789C9F, rows=8, pitch=3.4),
  "hansa": dict(stone=0xC2B59A, frame=0xBBAF94, pane=0x6B8187, rows=5, pitch=3.6),
  "werner": dict(stone=0xD1C8B7, frame=0xB6AC96, pane=0x71878D, rows=4, pitch=3.8),
  "bank": dict(stone=0xD1CEC0, frame=0xB4B8AE, pane=0x71868A, rows=6, pitch=3.1),
}


def encode(values, dtype):
  return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode()


for key in ["loeser", "hansa", "werner", "bank"]:
  fam = official[key]
  parts = fam["parts"]
  shape = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
  style = STYLE[key]
  site_roads = (
    roads + [r["geometry"] for r in service_rows] if key == "werner" else roads
  )
  site_roadnames = (
    [r["name"] for r in road_rows] + [r["name"] for r in service_rows]
    if key == "werner"
    else [r["name"] for r in road_rows]
  )
  site_roadtree = STRtree(site_roads)
  owners = []
  if key != "loeser":
    for p, s in zip(prisms["buildings"], all_polys):
      if s.area and s.intersection(shape).area / s.area > 0.98:
        owners.append(p)
    replaced += owners
  else:
    owners = [
      p for p in prisms["buildings"] if any(p["id"] == q["id"][-8:] for q in parts)
    ]
  x0, z0, _, _ = shape.bounds
  origin = [math.floor(x0) - 2, -5, math.floor(z0) - 2]
  positions = []
  colors = []
  indices = []
  blocks = []
  fittings = []
  fronts = []

  def triangle(t, tint):
    start = len(positions)
    for x, y, z in t:
      positions.append(
        [round(x - origin[0], 3), round(y - origin[1], 3), round(z - origin[2], 3)]
      )
      colors.append(base.linear(((tint >> 16) & 255, (tint >> 8) & 255, tint & 255)))
    indices.extend([start, start + 1, start + 2])

  # Required full original LoD2 walls and roofs for the three proved false OSM-height owners.
  if key != "loeser":
    for p in parts:
      for sf in p["surfaces"]:
        tint = 0x817E72 if sf["kind"] == "RoofSurface" else style["stone"]
        for tri in triangles_for(sf["rings"]):
          triangle(tri, tint)
        if sf["kind"] == "WallSurface":
          pts = np.array(sf["rings"][0])
          lo = pts[:, 1].min()
          hi = pts[:, 1].max()
          # Independently cardinal wall columns, never rotated smooth boxes.
          unique = []
          for q in pts:
            v = (float(q[0]), float(q[2]))
            if v not in unique:
              unique.append(v)
          if len(unique) < 2:
            continue
          a, b = max(
            ((a, b) for a in unique for b in unique), key=lambda ab: math.dist(*ab)
          )
          w = math.dist(a, b)
          n = max(1, math.ceil(w / 0.8))
          dx = (b[0] - a[0]) / w
          dz = (b[1] - a[1]) / w
          for i in range(n):
            t = (i + 0.5) / n
            x = a[0] + (b[0] - a[0]) * t
            z = a[1] + (b[1] - a[1]) * t
            target = t * w
            cross = []
            for q, r in zip(pts, np.roll(pts, -1, axis=0)):
              u = (q[0] - a[0]) * dx + (q[2] - a[1]) * dz
              v = (r[0] - a[0]) * dx + (r[2] - a[1]) * dz
              if abs(v - u) < 1e-8:
                continue
              if min(u, v) - 1e-7 <= target <= max(u, v) + 1e-7:
                cross.append(q[1] + (r[1] - q[1]) * (target - u) / (v - u))
            bottom, top = (min(cross), max(cross)) if len(cross) > 1 else (lo, hi)
            blocks.append(
              [
                round(x, 4),
                round((bottom + top) / 2, 4),
                round(z, 4),
                round(abs(dx) * w / n + 0.24, 4),
                round(top - bottom, 4),
                round(abs(dz) * w / n + 0.24, 4),
                tint,
              ]
            )
        else:
          # Independent roof columns sampled on a frozen 1m lattice; preserve full source roof profile.
          for tri in triangles_for(sf["rings"]):
            q = np.array(tri)
            poly = Polygon(q[:, [0, 2]])
            if poly.area < 1e-6:
              continue
            mat = np.column_stack((q[:, 0], q[:, 2], np.ones(3)))
            coef = np.linalg.solve(mat, q[:, 1])
            a, b, c, d = poly.bounds
            for ix in range(math.floor(a), math.ceil(c)):
              for iz in range(math.floor(b), math.ceil(d)):
                tile = box(ix, iz, ix + 1, iz + 1)
                if not poly.intersects(tile):
                  continue
                clip = poly.intersection(tile)
                if clip.area < 0.02:
                  continue
                x, z = (
                  (clip.bounds[0] + clip.bounds[2]) / 2,
                  (clip.bounds[1] + clip.bounds[3]) / 2,
                )
                y = coef @ [x, z, 1]
                blocks.append(
                  [
                    round(x, 4),
                    round(y, 4),
                    round(z, 4),
                    round(min(1, clip.bounds[2] - clip.bounds[0]), 4),
                    0.26,
                    round(min(1, clip.bounds[3] - clip.bounds[1]), 4),
                    tint,
                  ]
                )

  # Exterior public fronts follow exact retained footprint edges and public road normals.
  # Keep all genuine courtyard holes open and do not add panes to the photographed blank Mercator party wall.
  class Fittings(list):
    def append(self, row):
      super().append(row + [round(float(n[0]), 8), round(float(n[1]), 8)])

  fittings = Fittings()
  for part in parts:
    poly = Polygon(part["ring"], part["holes"])
    high = part["top_y_m"]
    low = max(part["ground_y_m"], 3)
    if high - low < 6:
      continue
    for a, b in zip(part["ring"], part["ring"][1:] + part["ring"][:1]):
      a = np.array(a)
      b = np.array(b)
      width = np.linalg.norm(b - a)
      if width < 2.5:
        continue
      d = (b - a) / width
      n = np.array([-d[1], d[0]])
      if poly.covers(Point(*((a + b) / 2 + n * 0.15))):
        n = -n
      # A boundary must actually belong to the complete family exterior.
      if shape.covers(Point(*((a + b) / 2 + n * 0.16))):
        continue
      midpoint = Point(*((a + b) / 2))
      ri = int(site_roadtree.nearest(midpoint))
      road = site_roads[ri]
      if road.distance(midpoint) > (90 if key == "werner" else 42):
        continue
      near = __import__("shapely").ops.nearest_points(midpoint, road)[1]
      tow = np.array(near.coords[0]) - (a + b) / 2
      if np.dot(tow, n) / max(np.linalg.norm(tow), 0.0001) < 0.65:
        continue
      # Family overlap is intentionally ignored; unrelated source fronts must remain unoccluded.
      approach = LineString(
        [(a + b) / 2 + n * 0.3, (a + b) / 2 + n * max(1, np.linalg.norm(tow) - 2)]
      )
      foreign = [
        int(i)
        for i in tree.query(approach, predicate="intersects")
        if prisms["buildings"][int(i)]["id"] not in {o["id"] for o in owners}
      ]
      if foreign:
        continue
      rows = (
        style["rows"]
        if key != "bank"
        else (10 if high - low > 30 else 6 if high - low > 16 else 2)
      )
      cols = 2 if key == "werner" else max(1, round((width - 0.5) / style["pitch"]))
      for row in range(rows):
        y = low + 2.6 + (row + 0.5) * (high - low - 3.6) / rows
        h = min(2.0, (high - low - 3.6) / rows * 0.68)
        pw = (
          min(2.6, width / cols * 0.72)
          if key in {"loeser", "bank"}
          else min(1.45, width / cols * 0.62)
        )
        for col in range(cols):
          u = (col + 0.5) * width / cols
          x, z = a + d * u + n * 0.16
          fittings.append(
            [
              round(x, 4),
              round(y, 4),
              round(z, 4),
              round(pw, 4),
              round(h, 4),
              0.07,
              round(math.atan2(-d[1], d[0]), 8),
              style["pane"],
              "pane",
            ]
          )
          for delta in [-1, 1]:
            xx, zz = a + d * (u + delta * (pw / 2 + 0.065)) + n * 0.205
            fittings.append(
              [
                round(xx, 4),
                round(y, 4),
                round(zz, 4),
                0.11,
                round(h + 0.18, 4),
                0.075,
                round(math.atan2(-d[1], d[0]), 8),
                style["frame"],
                "jamb",
              ]
            )
          for yy, hh, ww, role in [
            (y - h / 2 - 0.08, 0.13, pw + 0.24, "sill"),
            (y + h / 2 + 0.07, 0.10, pw + 0.18, "head"),
            (y, 0.04, pw, "transom"),
          ]:
            fittings.append(
              [
                round(x + n[0] * 0.07, 4),
                round(yy, 4),
                round(z + n[1] * 0.07, 4),
                round(ww, 4),
                hh,
                0.08,
                round(math.atan2(-d[1], d[0]), 8),
                style["frame"],
                role,
              ]
            )
        # Continuous masonry spandrels are recognisable at Loeser & Wolff.
        if key == "loeser":
          x, z = (a + b) / 2 + n * 0.12
          fittings.append(
            [
              round(x, 4),
              round(y - h / 2 - 0.30, 4),
              round(z, 4),
              round(width - 0.12, 4),
              0.32,
              0.10,
              round(math.atan2(-d[1], d[0]), 8),
              style["stone"],
              "sandstone-band",
            ]
          )
      if key == "hansa":
        # Source-text-confirmed sandstone pilasters and projecting crown, no historic lettering.
        for col in range(cols + 1):
          u = max(0.15, min(width - 0.15, col * width / cols))
          x, z = a + d * u + n * 0.21
          fittings.append(
            [
              round(x, 4),
              round((low + high) / 2, 4),
              round(z, 4),
              0.22,
              round(high - low - 0.7, 4),
              0.22,
              round(math.atan2(-d[1], d[0]), 8),
              style["stone"],
              "pilaster",
            ]
          )
      x, z = (a + b) / 2 + n * 0.20
      fittings.append(
        [
          round(x, 4),
          round(high - 0.3, 4),
          round(z, 4),
          round(width - 0.1, 4),
          0.23,
          0.30,
          round(math.atan2(-d[1], d[0]), 8),
          style["frame"],
          "cornice",
        ]
      )
      fronts.append(
        dict(
          part=part["id"],
          a=a.tolist(),
          b=b.tolist(),
          normal=n.tolist(),
          rows=rows,
          cols=cols,
          street=site_roadnames[ri],
        )
      )
  # Native fittings are independently axis aligned and ray fitted to the
  # actual existing/required body columns, avoiding the v287 buried-skin bug.
  refs = list(blocks)
  if key == "loeser":
    bx0, bz0, bx1, bz1 = shape.bounds
    for iz, row in enumerate(voxels["building_rows"]):
      zi = voxels["grid"]["min_z_idx"] + iz
      if not bz0 - 5 <= zi * 4 <= bz1 + 5:
        continue
      for start, count, y0, y1, cls in row:
        for off in range(start, start + count):
          xi = voxels["grid"]["min_x_idx"] + off
          if bx0 - 5 <= xi * 4 <= bx1 + 5:
            refs.append(
              [xi * 4 + 2, (y0 + y1) / 20, zi * 4 + 2, 4, (y1 - y0) / 10, 4, 0]
            )
  native_fittings = []
  refs = np.array(refs, dtype=float)
  for row in fittings:
    x, y, z, w, h, dep, yaw, tint, role, nx, nz = row
    dx = math.cos(yaw)
    dz = -math.sin(yaw)
    count = max(1, math.ceil(w / 0.8))
    step = w / count
    axis = 0 if abs(nx) >= abs(nz) else 2
    sign = 1 if (nx if axis == 0 else nz) > 0 else -1
    for i in range(count):
      u = (i + 0.5) * step - w / 2
      pos = np.array([x + dx * u, y, z + dz * u])
      dims = np.array(
        [abs(dx) * step + abs(dz) * dep, h, abs(dz) * step + abs(dx) * dep]
      )
      other = 2 if axis == 0 else 0
      near = (
        (
          np.abs(refs[:, other] - pos[other])
          < (refs[:, other + 3] + dims[other]) * 0.5 - 0.015
        )
        & (np.abs(refs[:, 1] - y) < (refs[:, 4] + h) * 0.5 - 0.015)
        & (np.abs(refs[:, axis] - pos[axis]) < 4.5)
      )
      if not near.any():
        continue
      edges = refs[near, axis] + sign * refs[near, axis + 3] * 0.5
      outside = edges.max() if sign > 0 else edges.min()
      pos[axis] = outside + sign * (dims[axis] * 0.5 + 0.075)
      if abs(pos[axis] - (x + dx * u if axis == 0 else z + dz * u)) > 3.6:
        continue
      native_fittings.append(
        [
          *[round(float(v), 4) for v in pos],
          *[round(float(v), 4) for v in dims],
          tint,
          role,
        ]
      )
  sites.append(
    dict(
      key=key,
      parent=fam["parent"],
      origin=origin,
      sourceGround=min(p["ground_y_m"] for p in parts),
      anchor=list(shape.centroid.coords[0]),
      drawn=dict(
        positions=encode(positions, "<f4"),
        colors=encode(colors, "u1"),
        indices=encode(indices, "<u4"),
      ),
      blocks=blocks,
      fittings=fittings,
      nativeFittings=native_fittings,
      fronts=fronts,
      oldIds=[p["id"] for p in owners],
    )
  )
  source_meta.append(
    dict(
      key=key,
      parent=fam["parent"],
      tile=fam["tile"],
      parts=parts,
      oldPrisms=owners,
      fronts=fronts,
    )
  )
  named_counts[key + "Fittings"] = len(fittings)
  named_counts[key + "NativeBodyColumns"] = len(blocks)
  named_counts[key + "DrawnBodyVertices"] = len(positions)

# Exact old native source columns can yield only where all contributing core
# footprint owners belong to this finite five-prism transfer. Adjacent owners
# that merely touch a cell are never retired.
old_ids = {p["id"] for p in replaced}
column_rows = []
columns = []
for iz, row in enumerate(voxels["building_rows"]):
  zi = voxels["grid"]["min_z_idx"] + iz
  hits = []
  if not 1400 <= zi * 4 <= 2400:
    continue
  for run in row:
    start, count, y0, y1, cls = run
    for off in range(start, start + count):
      xi = voxels["grid"]["min_x_idx"] + off
      x = xi * 4 + 2
      z = zi * 4 + 2
      point = Point(x, z)
      candidates = [int(i) for i in tree.query(point, predicate="intersects")]
      if not candidates:
        continue
      ids = {prisms["buildings"][i]["id"] for i in candidates}
      if ids and ids <= old_ids:
        columns.append([xi, zi, y0, y1, cls])
        hits.append(xi)
  if hits:
    column_rows.append(dict(index=iz, row=row))
loeser = next(s for s in sites if s["key"] == "loeser")
loeser_shape = unary_union(
  [Polygon(p["ring"], p["holes"]) for p in official["loeser"]["parts"]]
)
bx0, bz0, bx1, bz1 = loeser_shape.bounds
for iz, row in enumerate(voxels["building_rows"]):
  zi = voxels["grid"]["min_z_idx"] + iz
  if bz0 - 5 <= zi * 4 <= bz1 + 5:
    column_rows.append(dict(index=iz, row=row))
column_rows.sort(key=lambda r: r["index"])
retained = [p for p in prisms["buildings"] if p["id"] in loeser["oldIds"]]
core = dict(schemaVersion=1, sites=sites)
(OUT / "potsdamerCorridorCoreV288.json").write_text(
  json.dumps(core, separators=(",", ":")) + "\n"
)
owners = dict(
  schemaVersion=1,
  oldPrisms=replaced,
  retainedPrisms=retained,
  nativeGrid=voxels["grid"],
  nativeRows=column_rows,
  nativeColumns=columns,
)
(OUT / "potsdamerCorridorV288Owners.json").write_text(
  json.dumps(owners, separators=(",", ":")) + "\n"
)
navigation = []
for s in sites:
  if s["key"] == "loeser":
    continue
  for p in official[s["key"]]["parts"]:
    navigation.append(
      dict(
        id=p["id"],
        parent=s["parent"],
        ring=p["ring"],
        holes=p["holes"],
        low=p["ground_y_m"],
        high=p["top_y_m"],
        roofTriangles=[
          t
          for sf in p["surfaces"]
          if sf["kind"] == "RoofSurface"
          for t in triangles_for(sf["rings"])
        ],
      )
    )
profile = dict(
  schemaVersion=1,
  oldCoreIds=[p["id"] for p in replaced],
  retainedCoreIds=[p["id"] for p in retained],
  nativeColumns=columns,
  stream=dict(stream_counts),
  owners=[
    dict(
      key=s["key"],
      parent=s["parent"],
      anchor=s["anchor"],
      sourceGround=s["sourceGround"],
      oldIds=s["oldIds"],
      drawnBodyVertices=len(base64.b64decode(s["drawn"]["positions"])) // 12,
      drawnFittings=len(s["fittings"]),
      nativeBody=len(s["blocks"]),
      nativeFittings=len(s["nativeFittings"]),
    )
    for s in sites
  ],
  navigation=navigation,
)
(OUT / "potsdamerCorridorV288Profile.json").write_text(
  json.dumps(profile, separators=(",", ":")) + "\n"
)
evidence = dict(
  schemaVersion=1,
  policy="Finite named public fronts; all original sources preserved. Source sheets are metric; every added window, sill, mullion and material tone is an explicitly estimated recognition fitting. Old height fallbacks yield only after complete replacement admission.",
  references=[
    dict(
      title="Potsdamer Straße ISEK 2026, printed pages17/19/29/43",
      url="https://www.berlin.de/ba-mitte/politik-und-verwaltung/bezirksamt/beschluesse-des-bezirksamts/2021/1125_2026_isek_anlage-klein.pdf?ts=1772011482",
      credit="Bezirksämter Mitte/Tempelhof-Schöneberg; photographs forward / Studio AAD; reference only",
    ),
    dict(
      title="Loeser & Wolff owner exterior photograph",
      url="https://www.polis.de/portfolios/potsdamer-strasse-58/",
      credit="POLIS Immobilien AG; exterior reference only; no pixels bundled",
    ),
    *[
      dict(
        title=t,
        url="https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=" + n,
        credit="Landesdenkmalamt Berlin; architectural identity and materials",
      )
      for t, n in [
        ("Loeser & Wolff", "09050309"),
        ("Hansa-Haus des Westens", "09050314"),
        ("Anton-von-Werner-Haus", "09050279"),
        ("Potsdamer/Bülow bank offices", "09066659"),
        ("Kathreiner-Haus", "09066666"),
      ]
    ],
  ],
  preservedInputs={
    "lod2-prisms.json": base.digest(prism_path),
    "minecraft-voxels.json": base.digest(voxel_path),
    **inputs,
  },
  sourceArchives={
    tile: base.digest(ROOT / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip")
    for tile in ["389_5818", "388_5817"]
  },
  sourceFamilies=source_meta,
  oldNativeColumns=columns,
  streamFaces=faces,
  streamCounts=dict(stream_counts),
  namedCounts=dict(named_counts),
  runtimeBytes={
    p.name: p.stat().st_size
    for p in [
      OUT / "potsdamerCorridorV288.json",
      OUT / "potsdamerCorridorCoreV288.json",
    ]
  },
)
EVIDENCE.write_text(
  json.dumps(evidence, separators=(",", ":"), ensure_ascii=False) + "\n"
)
print(
  json.dumps(
    dict(
      stream=dict(stream_counts),
      named=dict(named_counts),
      oldPrisms=len(replaced),
      nativeColumns=len(columns),
      bytes=evidence["runtimeBytes"],
    )
  )
)
