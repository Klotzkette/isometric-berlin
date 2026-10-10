"""Step 10: source-bound BMAS campus and Quartier 206 facade recognition.

Only thin attachments are generated. All source sheets, courts and earlier
building envelopes remain in their original runtime families.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, Point, Polygon, box, mapping
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_breitscheid_towers_v161 import normal_of
from scripts.build_ministry_spree_v207 import polygons

ROOT = Path(__file__).resolve().parents[1]
TARGETS = {
  "DEBE01YYK00001ld": "main",
  "DEBE01YYK00004My": "kleist",
  "DEBE01YYK000054P": "bank",
  "DEBE01YYK0000FJA": "south",
  "DEBE01YYK00001xE": "south",
  "DEBE01AL5DR00005": "regine",
}
PALE, TRIM, GLASS, FRAME, OCHRE = 0xCAC4B1, 0xE4DFCD, 0x617C85, 0x626A68, 0xBBAB8F


def digest(path: Path) -> str:
  """Return an input receipt without modifying its content."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def collect(root: Path) -> tuple[list, list, dict]:
  """Retain exact LoD2 parts and existing placement offsets for named owners."""
  prism_path = root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  zip_path = root / "geo_data/regierungsviertel/raw/lod2/LoD2_390_5819.zip"
  qpath = root / "src/app/src/gendarmenmarktPerimeterSource.json"
  legacy = {p["id"]: p for p in json.loads(prism_path.read_text())["buildings"]}
  parts, owners = [], []
  vpath = root / "geo_data/regierungsviertel/alt-mitte-v169/source-390_5819-00.json.gz"
  vparts = {
    p["id"]: p for b in json.load(gzip.open(vpath))["buildings"] for p in b["parts"]
  }
  for parent_id, kind in TARGETS.items():
    parent = extract_parent(zip_path, parent_id)
    for element in leaf_building_parts(parent) or [parent]:
      p = part_profile(element)
      old = legacy.get(p["id"][-8:])
      dy = (old["y0_dm"] / 10 if old else vparts[p["id"]]["groundY"]) - p["ground_y_m"]
      parts.append(dict(**p, parentId=parent_id, kind=kind, dy=dy, legacyPrism=old))
  q = next(
    p for p in json.loads(qpath.read_text())["buildings"] if p["key"] == "quartier206"
  )
  for p in q["officialParts"]:
    parts.append(
      dict(
        **p,
        parentId=next(
          (x["parentId"] for x in q["streetFronts"] if x["partId"] == p["id"]),
          q["parentIds"][0],
        ),
        kind="quartier206",
        dy=q["displayYTranslationM"],
      )
    )
  for p in parts:
    shape = Polygon(p["ring"], p["holes"])
    owners.append(
      dict(
        id=p["id"],
        parentId=p["parentId"],
        kind=p["kind"],
        anchor=list(shape.centroid.coords)[0],
        groundY=round(p["ground_y_m"] + p["dy"], 5),
        topY=round(p["top_y_m"] + p["dy"], 5),
      )
    )
  evidence = dict(
    schemaVersion=1,
    sourceAttribution="© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)",
    sourceUrl="https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5819.zip",
    sourceLicense="dl-de/zero-2-0",
    campusOsmIdentity="way/1351208381",
    parts=parts,
    q206StreetFronts=q["streetFronts"],
    retainedInputs={
      str(p.relative_to(root)): digest(p) for p in [prism_path, zip_path, qpath, vpath]
    },
    estimates="Materials, colours, frame depths, stone courses, apertures and lettering are bounded photographic recognition estimates. Source footprint, roof sheets, opening courts and placement offsets are measured/retained. No photographs or protected interiors are bundled.",
  )
  return parts, owners, evidence


def native_envelope(root: Path, shapes: list, owners: list, evidence: dict) -> dict:
  """Union retained original 4m columns with the independent v169 1m spans."""
  area = unary_union(shapes)
  near = area.buffer(6)
  path = root / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  evidence["retainedInputs"][str(path.relative_to(root))] = digest(path)
  voxel = json.loads(path.read_text())
  grid, cell = voxel["grid"], voxel["cell_m"]
  columns = {}

  def merge(x: int, z: int, lo: float, hi: float) -> None:
    if (x, z) in columns:
      lo, hi = min(lo, columns[x, z][0]), max(hi, columns[x, z][1])
    columns[x, z] = (lo, hi)

  for iz, runs in enumerate(voxel["building_rows"]):
    z = (grid["min_z_idx"] + iz) * cell
    if not near.bounds[1] - cell <= z <= near.bounds[3] + cell:
      continue
    for ix, count, lo, hi, _ in runs:
      for i in range(ix, ix + count):
        x = (grid["min_x_idx"] + i) * cell
        if not near.intersects(box(x, z, x + cell, z + cell)):
          continue
        for dx in range(int(cell)):
          for dz in range(int(cell)):
            merge(x + dx, z + dz, lo / 10, hi / 10)
  for packet in [6, 7]:
    path = root / f"src/app/src/data/altMitteV169Navigation/packet-{packet:03}.json"
    evidence["retainedInputs"][str(path.relative_to(root))] = digest(path)
    for x0, z0, x1, z1, hi in json.loads(path.read_text()):
      if not near.intersects(box(x0, z0, x1, z1)):
        continue
      for x in range(x0, x1):
        for z in range(z0, z1):
          if near.covers(Point(x + 0.5, z + 0.5)):
            oi = min(
              range(len(shapes)),
              key=lambda i: shapes[i].distance(Point(x + 0.5, z + 0.5)),
            )
            lo = math.floor((owners[oi]["groundY"] - 3) / 2) * 2 + 3
            merge(x, z, lo, hi)
  # Q206 has an additional retained 2.5m official shell. Sample its measured
  # roof planes at the exact runtime lattice, then conservatively cover its
  # fractional extent on our 1m clearance grid. No source shell is altered.
  qdata = json.loads(
    (root / "src/app/src/gendarmenmarktPerimeterSource.json").read_text()
  )
  q = next(b for b in qdata["buildings"] if b["key"] == "quartier206")
  qp = [(p, Polygon(p["ring"], p["holes"])) for p in q["officialParts"]]
  areaq = unary_union([shape for _, shape in qp])
  qcols = []
  for ix in range(math.floor(areaq.bounds[0] / 2.5), math.ceil(areaq.bounds[2] / 2.5)):
    for iz in range(
      math.floor(areaq.bounds[1] / 2.5), math.ceil(areaq.bounds[3] / 2.5)
    ):
      x, z = (ix + 0.5) * 2.5, (iz + 0.5) * 2.5
      lows, tops = [], []
      for part, shape in qp:
        if not shape.covers(Point(x, z)):
          continue
        roof = []
        for sheet in part["surfaces"]:
          if sheet["kind"] != "RoofSurface":
            continue
          rr = sheet["rings"]
          plan = Polygon(
            [(a, c) for a, _, c in rr[0]],
            [[(a, c) for a, _, c in hole] for hole in rr[1:]],
          )
          if not plan.covers(Point(x, z)):
            continue
          n = normal_of(rr[0])
          a = rr[0][0]
          if abs(n[1]) > 0.00001:
            roof.append(
              min(
                part["top_y_m"], a[1] - (n[0] * (x - a[0]) + n[2] * (z - a[2])) / n[1]
              )
            )
        tops.append(
          (max(roof) if roof else part["top_y_m"]) + q["displayYTranslationM"]
        )
        lows.append(part["ground_y_m"] + q["displayYTranslationM"])
      if not tops:
        continue
      lo, hi = min(lows), max(tops)
      qcols.append([ix * 2.5, iz * 2.5, (ix + 1) * 2.5, (iz + 1) * 2.5, lo, hi])
      for xx in range(math.floor(ix * 2.5), math.ceil((ix + 1) * 2.5)):
        for zz in range(math.floor(iz * 2.5), math.ceil((iz + 1) * 2.5)):
          merge(xx, zz, lo, hi)
  evidence["nativeQuartier206Columns"] = qcols
  evidence["nativeEnvelope"] = [
    [x, z, lo, hi] for (x, z), (lo, hi) in sorted(columns.items())
  ]
  evidence["nativePolicy"] = (
    "Conservative union of the unchanged 4m source columns and all v169 1m source spans; clearance uses full horizontal and vertical tile extents, never only centres. Original columns are retained. Exposed finishing tiles are axis-aligned and do not fill a court."
  )
  return columns


def build(root: Path = ROOT) -> tuple[dict, dict]:
  """Build exact attached planes and bounded drawn/native detail batches."""
  parts, owners, evidence = collect(root)
  shapes = [Polygon(p["ring"], p["holes"]) for p in parts]
  columns = native_envelope(root, shapes, owners, evidence)
  boxes, surfaces, faces, blocks = [], [], [], []
  native_max = 0.0
  roles = Counter()
  occluded = Counter()
  q_fronts = {(f["partId"], f["surfaceIndex"]) for f in evidence["q206StreetFronts"]}
  q_base = min(f["wallBaseY"] for f in evidence["q206StreetFronts"])
  q_eaves = Counter()
  for f in evidence["q206StreetFronts"]:
    q_eaves[round(f["wallTopY"] * 2) / 2] += f["lengthM"]
  q_eave = q_eaves.most_common(1)[0][0]
  for oi, p in enumerate(parts):
    kind = p["kind"]
    ground = owners[oi]["groundY"]
    for si, sheet in enumerate(p["surfaces"]):
      if sheet["kind"] != "WallSurface":
        continue
      if kind == "quartier206" and (p["id"], si) not in q_fronts:
        continue
      ring = np.asarray(sheet["rings"][0])
      ring[:, 1] += p["dy"]
      n3 = normal_of(ring.tolist())
      if abs(n3[1]) > 0.01:
        continue
      a, b = max(
        ((a, b) for a in ring for b in ring),
        key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
      )
      a, b = a[[0, 2]], b[[0, 2]]
      length = float(np.linalg.norm(b - a))
      if length < 1.0:
        continue
      direction = (b - a) / length
      n = np.array([-direction[1], direction[0]])
      if float(n @ n3[[0, 2]]) < 0:
        n = -n
      if shapes[oi].contains(Point(*((a + b) / 2 + n * 0.12))):
        n = -n
      # Add only photographed outer campus fronts and the named new Regine
      # building. Opposed internal courts keep their earlier source facades;
      # unobserved new window grids there would add speculation and memory.
      if kind not in ["quartier206", "regine"]:
        blocked = 0
        for fraction in [0.2, 0.5, 0.8]:
          origin = a + direction * (length * fraction)
          ray = LineString([origin + n * 0.25, origin + n * 65])
          if any(
            j != oi
            and parts[j]["kind"] != "quartier206"
            and owners[j]["topY"] > ground + 8
            and ray.intersects(shape)
            for j, shape in enumerate(shapes)
          ):
            blocked += 1
        if blocked == 3:
          continue
      yaw = math.atan2(-direction[1], direction[0])
      planar = [
        [[float((np.array([x, z]) - a) @ direction), y + p["dy"]] for x, y, z in r]
        for r in sheet["rings"]
      ]
      local = Polygon(planar[0], planar[1:]).buffer(0)
      check = LineString([a + n * 0.18, b + n * 0.18])
      for j, shape in enumerate(shapes):
        if j == oi:
          continue
        hit = check.intersection(shape)
        for span in (
          [hit] if hit.geom_type == "LineString" else getattr(hit, "geoms", [])
        ):
          if span.geom_type != "LineString" or span.length < 0.01:
            continue
          us = [float((np.asarray(q) - a) @ direction) for q in span.coords]
          local = local.difference(
            box(min(us) - 0.015, -50, max(us) + 0.015, owners[j]["topY"] + 0.02)
          )
      if local.is_empty or local.area < 1:
        continue
      fi = len(faces)
      faces.append(
        dict(
          owner=oi,
          surface=si,
          a=a.tolist(),
          direction=direction.tolist(),
          normal=n.tolist(),
          exposedPolygons=[mapping(poly) for poly in polygons(local)],
        )
      )
      # The exact earlier Q206 facade recipe is substituted. Every measured
      # source sheet and all unrelated perimeter facades remain unchanged.
      attach = 0.34

      def world(u: float, y: float, out: float) -> list:
        q = a + direction * u + n * (attach + out)
        return [float(q[0]), y, float(q[1])]

      colour = 0xDBD9CC if kind == "quartier206" else OCHRE if kind == "bank" else PALE
      if kind == "regine" and owners[oi]["topY"] - ground < 8:
        colour = GLASS
      triangles = []
      for poly in polygons(local):
        for t in constrained_delaunay_triangles(poly).geoms:
          triangles.append(
            [
              [round(v, 5) for v in world(u, y, 0.01)]
              for u, y in list(t.exterior.coords)[:3]
            ]
          )
      surfaces.append(dict(triangles=triangles, color=colour, owner=oi, face=fi))

      def emit(
        u: float,
        y: float,
        w: float,
        h: float,
        tint: int,
        role: str,
        depth: float = 0.08,
        out: float = 0.13,
      ) -> None:
        nonlocal native_max
        if (
          w <= 0
          or h <= 0
          or not local.buffer(0.002).covers(
            box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
          )
        ):
          return
        q = world(u, y, out)
        boxes.append(
          [*[round(v, 5) for v in [*q, w, h, depth, yaw]], tint, oi, fi, role]
        )
        roles[role] += 1
        # A finely stepped native counterpart: preserve each member's length,
        # height and colour, but use axis-aligned surface tiles with conservative
        # clearance against both retained native envelope families.
        count = max(1, math.ceil(w / (2.5 if kind == "quartier206" else 2)))
        for it in range(count):
          uu = u - w / 2 + (it + 0.5) * w / count
          pp = a + direction * uu
          tile = w / count
          bw = abs(direction[0]) * tile + abs(n[0]) * depth
          bd = abs(direction[1]) * tile + abs(n[1]) * depth
          bw = max(0.055, bw)
          bd = max(0.055, bd)
          finish = out + 0.12
          clearance = 0.35 + finish
          candidates = []
          for ix in range(
            math.floor(pp[0] - bw / 2 - 5), math.ceil(pp[0] + bw / 2 + 5)
          ):
            for iz in range(
              math.floor(pp[1] - bd / 2 - 5), math.ceil(pp[1] + bd / 2 + 5)
            ):
              span = columns.get((ix, iz))
              if not span or span[1] <= y - h / 2 or span[0] >= y + h / 2:
                continue
              # Exit an expanded native cell along the outward facade normal.
              tmin, tmax = -1e9, 1e9
              for axis, (v, half, lo) in enumerate(
                [(pp[0], bw / 2, ix), (pp[1], bd / 2, iz)]
              ):
                if abs(n[axis]) < 1e-8:
                  if v < lo - half - 0.035 or v > lo + 1 + half + 0.035:
                    tmax = -1e10
                    break
                else:
                  ts = sorted(
                    [
                      (lo - half - 0.035 - v) / n[axis],
                      (lo + 1 + half + 0.035 - v) / n[axis],
                    ]
                  )
                  tmin = max(tmin, ts[0])
                  tmax = min(tmax, ts[1])
              if tmax >= max(tmin, 0):
                candidates.append((tmin, tmax))
          # Walk the union of ray intervals including the finishing depth.
          # This also catches a close peer entering the final tile's extent.
          for start, end in sorted(candidates):
            if start <= clearance <= end:
              clearance = end + 0.075
          # When quantized retained peers close a source recess, no exposed
          # native face exists there. Do not move detail across that neighbour.
          if clearance - finish > 4.5:
            occluded[kind] += 1
            continue
          native_max = max(native_max, clearance - finish)
          # Per-role outward depth keeps paired panes/mullions legible after
          # clearing quantized mass, rather than collapsing them onto one skin.
          pt = pp + n * clearance
          blocks.append(
            [*[round(v, 5) for v in [pt[0], y, pt[1], bw, h, bd]], tint, oi, fi, role]
          )

      high = local.bounds[3]
      height = high - ground
      if height < 3:
        continue
      floor_count = 6 if kind in ["regine", "south"] else 4
      floor_pitch = max(2.8, min(5.4, (height - 0.9) / floor_count))
      layout = [
        (ground + (floor + 0.5) * floor_pitch + 0.15, floor_pitch)
        for floor in range(floor_count)
      ]
      if kind == "quartier206":
        # Same six upper levels plus storefront as the retained source facade.
        # A single common datum keeps high/low oriel sheets from compressing
        # six invented storeys into one short source wall.
        upper = q_base + 4.7
        floor_pitch = (q_eave - upper - 0.75) / 6
        layout = [(q_base + 2.35, 4.7)] + [
          (upper + (i + 0.5) * floor_pitch, floor_pitch) for i in range(9)
        ]
      elif kind == "bank":
        layout = [
          (ground + height * fraction, height * size)
          for fraction, size in [
            (0.075, 0.08),
            (0.27, 0.19),
            (0.49, 0.17),
            (0.72, 0.19),
            (0.91, 0.075),
          ]
        ]
      pitch = 3.3 if kind == "main" else 3.1 if kind in ["south", "regine"] else 3.7
      bays = max(1, round(length / pitch))
      pitch = length / bays
      for floor, (y, storey_pitch) in enumerate(layout):
        wh = storey_pitch * (
          1
          if kind == "bank"
          else 0.80
          if kind == "quartier206" and floor == 0
          else 0.65
        )
        for bay in range(bays):
          u = (bay + 0.5) * pitch
          ww = pitch * (
            0.83 if kind == "quartier206" else 0.43 if kind == "main" else 0.52
          )
          if kind == "bank" and floor in [1, 3]:
            radius = min(ww / 2, wh * 0.32)
            spring = y + wh / 2 - radius
            emit(u, y - radius / 2, ww, wh - radius, GLASS, "pane", out=0.09)
            for step in range(10):
              dx = -radius + (step + 0.5) * 2 * radius / 10
              cap = math.sqrt(max(0, radius * radius - dx * dx))
              emit(
                u + dx,
                spring + cap / 2,
                2 * radius / 10 + 0.005,
                cap,
                GLASS,
                "arch-pane",
                out=0.09,
              )
            for angle in np.linspace(0, math.pi, 13):
              emit(
                u + (radius + 0.13) * math.cos(angle),
                spring + (radius + 0.13) * math.sin(angle),
                0.23,
                0.26,
                TRIM,
                "arch-voussoir",
                0.18,
                0.28,
              )
          else:
            emit(u, y, ww, wh, GLASS, "pane", out=0.09)
          for sign in [-1, 1]:
            emit(
              u + sign * (ww / 2 + 0.07), y, 0.13, wh + 0.16, TRIM, "reveal", out=0.21
            )
          emit(u, y - wh / 2 - 0.08, ww + 0.3, 0.16, TRIM, "sill", 0.25, 0.22)
          emit(u, y, 0.07, wh, FRAME, "mullion", out=0.28)
          emit(u, y - wh * 0.04, ww, 0.065, FRAME, "transom", out=0.28)
          if kind == "main" and floor == 2:
            emit(u, y + wh / 2 + 0.18, ww + 0.42, 0.28, TRIM, "hood", 0.35, 0.24)
          if kind in ["south", "regine"] and (bay + floor) % 4 == 0:
            emit(u, y + wh * 0.27, ww * 0.92, wh * 0.38, 0xC7C6B2, "blind", out=0.30)
        emit(
          length / 2,
          y + storey_pitch / 2,
          length - 0.08,
          0.15 if kind == "quartier206" else 0.12,
          FRAME if kind == "quartier206" else TRIM,
          "course",
          0.12,
          0.25,
        )
        if kind == "quartier206":
          for delta in [-wh / 2 - 0.13, 0, wh / 2 + 0.13]:
            emit(
              length / 2,
              y + delta,
              length - 0.08,
              0.10,
              0x485A62,
              "graphite-ribbon",
              0.10,
              0.23,
            )
          if floor == 0:
            emit(
              length / 2,
              q_base + 0.65,
              length - 0.08,
              0.10,
              FRAME,
              "storefront-transom",
              0.10,
              0.28,
            )
      emit(
        length / 2,
        high - 0.3,
        length - 0.08,
        0.30,
        TRIM,
        "cornice",
        1.0 if kind == "quartier206" else 0.38,
        0.55 if kind == "quartier206" else 0.25,
      )
      if kind in ["bank", "kleist"]:
        for yy in np.arange(
          ground + 0.4,
          high - height * 0.16 if kind == "bank" else min(high, ground + 5.2),
          0.58,
        ):
          emit(
            length / 2, yy, length - 0.08, 0.07, 0x978B78, "rustication", 0.075, 0.20
          )
        for bay in range(bays + 1 if kind == "kleist" else 0):
          u = bay * pitch
          emit(
            u, ground + height * 0.51, 0.32, height * 0.47, TRIM, "pilaster", 0.26, 0.24
          )
          emit(u, ground + height * 0.745, 0.64, 0.32, TRIM, "capital", 0.36, 0.31)
      # Exact main Mauerstraße front: three tall framed portals within the
      # retained eastern risalit. Their proportions remain photo estimates.
      if p["id"] == "DEBE3DYALdhIhSj3" and n[0] > 0.8 and length > 40:
        for fraction in [0.12, 0.20, 0.28]:
          u = length * fraction
          emit(u, ground + 3.8, 2.45, 6.8, 0x334445, "main-portal", 0.12, 0.31)
          for side in [-1, 1]:
            emit(
              u + side * 1.4, ground + 3.8, 0.28, 7.35, TRIM, "portal-frame", 0.25, 0.44
            )
          emit(u, ground + 7.45, 3.1, 0.28, TRIM, "portal-frame", 0.25, 0.44)
      # Kleist's giant-order facade and dentilled classical cornice are applied
      # only to its source eastern street wall, not to rear neighbour faces.
      if (kind == "kleist" and n[0] > 0.8) or kind == "bank":
        for u in np.arange(0.3, length, 0.64):
          emit(u, high - 0.65, 0.19, 0.26, TRIM, "dentil", 0.32, 0.36)
      if kind == "quartier206":
        # Each source bay carries its own continuous horizontal bands. Thin
        # joints describe stone slabs, preserving every measured angular facet.
        for yy in np.arange(ground + 0.65, high, 0.74):
          emit(
            length / 2, yy, length - 0.08, 0.045, 0x747C78, "stone-joint", 0.06, 0.15
          )
        # Tall corner glazing below the projecting source oriels, visible in
        # the credited Friedrichstraße photograph. This adds no entry hole or
        # solid canopy; circulation continues to use the unchanged geometry.
        corners = {
          "DEBE3Dr6g2Nf0AVK": [1211.106, 594.458],
          "DEBE3DN6oo7T1GdL": [1211.106, 594.458],
          "DEBE3DyRJjimuioQ": [1216.939, 672.646],
          "DEBE3Dd3GaCJVUVp": [1216.939, 672.646],
        }
        if p["id"] in corners:
          corner_u = float((np.array(corners[p["id"]]) - a) @ direction)
          u = 2.05 if corner_u < length / 2 else length - 2.05
          emit(u, ground + 3.9, 3.35, 7.1, 0x435D64, "corner-glazing", 0.10, 0.46)
          for sign in [-1, 1]:
            emit(
              u + sign * 1.75, ground + 3.9, 0.23, 7.6, TRIM, "corner-jamb", 0.24, 0.58
            )
          for yy in [
            ground + 1.2,
            ground + 2.5,
            ground + 3.9,
            ground + 5.3,
            ground + 6.7,
          ]:
            emit(u, yy, 3.3, 0.095, FRAME, "corner-transom", 0.10, 0.60)
          emit(u, ground + 3.9, 0.11, 7.1, FRAME, "corner-mullion", 0.10, 0.60)
          emit(u, ground + 7.55, 3.7, 0.3, TRIM, "corner-lintel", 0.45, 0.63)
  evidence["faces"] = faces
  evidence["nativeMaximumClearanceM"] = round(native_max, 5)
  evidence["nativeOccludedSourceRecessTiles"] = dict(occluded)
  evidence["quartier206StoreyDatum"] = {
    "base": q_base,
    "prevailingEave": q_eave,
    "upperFloors": 6,
  }
  result = dict(
    schemaVersion=1,
    owners=owners,
    boxes=boxes,
    blocks=blocks,
    surfaces=surfaces,
    sourceSuppressionIds=[],
    stats=dict(
      drawnInstances=len(boxes),
      nativeInstances=len(blocks),
      drawnTriangles=sum(len(s["triangles"]) for s in surfaces),
      roles=dict(roles),
      nativeMaximumClearanceM=round(native_max, 5),
    ),
  )
  return result, evidence


def main() -> None:
  """Write the bounded derived payload and independent source receipt."""
  result, evidence = build()
  for name, data in [
    ("labourQuartierV208", result),
    ("labourQuartierV208Evidence", evidence),
  ]:
    (ROOT / f"src/app/src/data/{name}.json").write_text(
      json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
  print(json.dumps(result["stats"], indent=2))


if __name__ == "__main__":
  main()
