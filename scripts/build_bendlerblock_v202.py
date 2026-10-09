"""Restore complete Bendlerblock source families and the open memorial court.

LoD2/OSM coordinates are retained. The shallow facade articulation and sculpture
are explicitly proportional interpretations of the credited free photographs.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from shapely import constrained_delaunay_triangles, make_valid
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_breitscheid_towers_v161 import normal_of
from scripts.build_linden_corridor_v197 import merge_native_runs

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
ARCHIVE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_388_5818.zip"
PARENTS = ["DEBE01YYK0002MMp", "DEBE00YY2Bq0001i"]
GROUND = 5.2
# Retained OSM building_passage centrelines, in the metric viewer frame.
PASSAGES = [
  {
    "id": "771045155",
    "a": [-604.08, 1224.25],
    "b": [-589.17, 1228.46],
    "width": 4.4,
    "height": 4.8,
  },
  {
    "id": "771045154",
    "a": [-670.91, 1214.61],
    "b": [-683.31, 1210.88],
    "width": 3.8,
    "height": 4.4,
  },
  {
    "id": "771045153",
    "a": [-646.37, 1200.22],
    "b": [-644.3, 1192.42],
    "width": 2.8,
    "height": 3.5,
  },
]
REFERENCES = [
  {
    "title": "File:Innenhof Bendlerblock.jpg",
    "author": "Michael Klemm",
    "license": "CC BY-SA 3.0",
    "url": "https://commons.wikimedia.org/wiki/File:Innenhof_Bendlerblock.jpg",
  },
  {
    "title": "File:Bendlerblock Statue August 2009.jpg",
    "author": "Stefan Kemmerling (Kemmi.1)",
    "license": "CC BY-SA 3.0",
    "url": "https://commons.wikimedia.org/wiki/File:Bendlerblock_Statue_August_2009.jpg",
  },
  {
    "title": "File:Berlin, Tiergarten, Reichpietschufer, Bendler-Block 02.jpg",
    "author": "Jörg Zägel",
    "license": "CC BY-SA 3.0",
    "url": "https://commons.wikimedia.org/wiki/File:Berlin,_Tiergarten,_Reichpietschufer,_Bendler-Block_02.jpg",
  },
]


def components(p):
  return [
    q for q in getattr(p, "geoms", [p]) if q.geom_type == "Polygon" and q.area > 1e-8
  ]


def triangles_for(rings):
  """Resolve touching source roof holes without simplification or lost area."""
  normal = normal_of(rings[0])
  drop = int(np.argmax(np.abs(normal)))
  axes = [i for i in range(3) if i != drop]
  planar = [[(p[axes[0]], p[axes[1]]) for p in r] for r in rings]
  lookup = {
    q: p
    for ring, projected in zip(rings, planar, strict=True)
    for p, q in zip(ring, projected, strict=True)
  }
  polygon = make_valid(Polygon(planar[0], planar[1:]))
  origin = np.array(rings[0][0])
  result = []
  for poly in components(polygon):
    for t in constrained_delaunay_triangles(poly).geoms:
      vertices = []
      for q in list(t.exterior.coords)[:3]:
        if q in lookup:
          vertices.append(lookup[q])
          continue
        p = origin.copy()
        p[axes] = q
        p[drop] = (
          origin[drop]
          - sum(normal[a] * (p[a] - origin[a]) for a in axes) / normal[drop]
        )
        vertices.append([round(float(v), 6) for v in p])
      result.append(vertices)
  return result


def write(path, data):
  raw = (json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def prism_shape(p):
  return Polygon(
    [(x / 10, z / 10) for x, z in p["ring"]],
    [[(x / 10, z / 10) for x, z in h] for h in p.get("holes", [])],
  )


def build():
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  by_id = {p["id"]: p for p in prisms}
  families = []
  for parent in PARENTS:
    node = extract_parent(ARCHIVE, parent)
    parts = [part_profile(p) for p in leaf_building_parts(node)]
    families.append(
      {
        "id": parent,
        "shiftY": round(GROUND - min(p["ground_y_m"] for p in parts), 3),
        "parts": parts,
      }
    )
  source = {
    "schemaVersion": 1,
    "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_388_5818.zip",
    "archiveSha256": hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
    "license": "dl-de/zero-2-0",
    "families": families,
    "passages": PASSAGES,
    "visualReferences": REFERENCES,
  }
  source_path = ROOT / "geo_data/regierungsviertel/bendlerblock-v202-source.json.gz"
  write(source_path, source)
  surfaces, boxes, nav = [], [], []
  full_shapes = [Polygon(p["ring"], p["holes"]) for f in families for p in f["parts"]]
  occupied = unary_union(full_shapes)
  passage_shapes = [
    (LineString([p["a"], p["b"]]).buffer(p["width"] / 2, cap_style="square"), p)
    for p in PASSAGES
  ]

  def emit(x, y, z, w, h, d, yaw, color, role, nx=0, nz=0):
    boxes.append(
      [round(float(v), 5) for v in [x, y, z, w, h, d, yaw]] + [color, role, nx, nz]
    )

  for fi, family in enumerate(families):
    for part in family["parts"]:
      shift = family["shiftY"]
      roof_triangles = []
      for si, s in enumerate(part["surfaces"]):
        rings = [[[x, round(y + shift, 3), z] for x, y, z in r] for r in s["rings"]]
        n = normal_of(rings[0])
        roof = s["kind"] == "RoofSurface"
        color = (
          (0x9D563E if fi == 0 else 0x776F63)
          if roof
          else (0xC1B59E if fi == 0 else 0xD7D3C9)
        )
        triangles = triangles_for(rings)
        if roof:
          roof_triangles += triangles
        elif abs(n[1]) < 0.01:
          a, b = max(
            ((a, b) for a in rings[0] for b in rings[0]),
            key=lambda q: math.hypot(q[1][0] - q[0][0], q[1][2] - q[0][2]),
          )
          base = np.array(a)
          direction = np.array([b[0] - a[0], 0, b[2] - a[2]])
          length = np.linalg.norm(direction)
          if length < 0.01:
            continue
          direction /= length
          mid = base + direction * length / 2
          if occupied.contains(Point(mid[0] + n[0] * 0.2, mid[2] + n[2] * 0.2)):
            n = -n
          local = Polygon(
            [
              [(float(np.dot(np.subtract(v, base), direction)), v[1]) for v in r]
              for r in rings
            ][0],
            [
              [(float(np.dot(np.subtract(v, base), direction)), v[1]) for v in r]
              for r in rings[1:]
            ],
          )
          for corridor, p in passage_shapes:
            cross = LineString([[a[0], a[2]], [b[0], b[2]]]).intersection(corridor)
            if cross.is_empty:
              continue
            us = [
              float(np.dot(np.array([x, 0, z]) - np.array([a[0], 0, a[2]]), direction))
              for x, z in cross.coords
            ]
            local = local.difference(
              box(min(us), GROUND - 0.2, max(us), GROUND + p["height"])
            )
          triangles = []
          for poly in components(make_valid(local)):
            for t in constrained_delaunay_triangles(poly).geoms:
              triangles.append(
                [
                  [
                    round(float(base[0] + u * direction[0]), 3),
                    round(y, 3),
                    round(float(base[2] + u * direction[2]), 3),
                  ]
                  for u, y in list(t.exterior.coords)[:3]
                ]
              )
          # Cornices, pale frames and fine white crossbars follow each actual wall.
          if length >= 2.5 and local.bounds[1] < GROUND + 1:
            bottom, top = local.bounds[1], local.bounds[3]
            floors = max(1, min(5, round((top - bottom) / 4.35)))
            pitch = (min(top, GROUND + 22) - GROUND) / floors
            bays = max(1, round(length / (3.4 if fi == 0 else 3.25)))
            yaw = math.atan2(-direction[2], direction[0])

            def mark(u, y, w, h, color, role, out=0.10, depth=0.08):
              if not local.buffer(-0.015).covers(
                box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
              ):
                return
              p = base + direction * u + n * out
              emit(
                p[0], y, p[2], w, h, depth, yaw, color, role, float(n[0]), float(n[2])
              )

            for f in range(floors):
              y = GROUND + (f + 0.53) * pitch
              for bay in range(bays):
                u = (bay + 0.5) * length / bays
                w = min(1.6, length / bays * 0.57)
                h = min(2.65, pitch * 0.68)
                mark(u, y, w + 0.26, h + 0.26, 0xA79F90, 2, 0.065)
                mark(u, y, w, h, 0x637879, 3, 0.125)
                for side in [-1, 1]:
                  mark(u + side * (w - 0.065) / 2, y, 0.09, h, 0xE9E3D4, 4, 0.18)
                  mark(u, y + side * (h - 0.065) / 2, w, 0.09, 0xE9E3D4, 4, 0.18)
                mark(u, y, 0.075, h, 0xE9E3D4, 4, 0.19)
                for dy in [-h * 0.20, h * 0.22]:
                  mark(u, y + dy, w, 0.065, 0xE9E3D4, 4, 0.19)
                mark(u, y - h / 2 - 0.12, w + 0.42, 0.16, 0xD8D0BD, 5, 0.22, 0.27)
                if fi == 0:
                  mark(
                    u + length / bays * 0.42, y, 0.19, pitch * 0.9, 0xAEA38E, 6, 0.10
                  )
              mark(
                length / 2,
                GROUND + (f + 1) * pitch,
                length - 0.14,
                0.17,
                0xD5CDBB,
                5,
                0.16,
                0.24,
              )
        surfaces.append(
          {
            "partId": part["id"],
            "sourceSurface": si,
            "kind": s["kind"],
            "triangles": triangles,
            "color": color,
            "role": 0,
          }
        )
      nav.append(
        {
          "id": part["id"],
          "ring": part["ring"],
          "holes": part["holes"],
          "groundY": GROUND,
          "topY": part["top_y_m"] + shift,
          "roofTriangles": roof_triangles,
        }
      )

  # Ehrenhof: exact surrounding source walls bound its paving; free photographs
  # establish transverse low steel works, not garden hedges. The nine mapped
  # OSM trees remain entirely owned by the existing ParkDetails source layer.
  center = np.array([-641.563, 1214.09])
  yaw = -0.282

  def local(x, z):
    return center + [
      math.cos(yaw) * x + math.sin(yaw) * z,
      -math.sin(yaw) * x + math.cos(yaw) * z,
    ]

  court = Polygon(
    [local(x, z) for x, z in [(-27, -14), (32, -14), (32, 14), (-27, 14)]]
  ).difference(occupied)
  for poly in components(court):
    surfaces.append(
      {
        "kind": "CourtPaving",
        "triangles": triangles_for(
          [
            [[x, GROUND + 0.09, z] for x, z in ring.coords]
            for ring in [poly.exterior, *poly.interiors]
          ]
        ),
        "color": 0xAAA69C,
        "role": 7,
      }
    )
  # Sparse cobble courses are vector geometry rather than a photo texture.
  for z in np.arange(-13.5, 14, 1.5):
    line = LineString([local(-27, z), local(32, z)]).buffer(0.025).intersection(court)
    for q in components(line):
      surfaces.append(
        {
          "kind": "PavingJoint",
          "triangles": triangles_for(
            [
              [[x, GROUND + 0.095, z] for x, z in ring.coords]
              for ring in [q.exterior, *q.interiors]
            ]
          ),
          "color": 0x8F8C83,
          "role": 8,
        }
      )

  def localbox(x, y, z, w, h, d, color, role):
    angle = yaw + math.pi / 2 if role in [9, 10] else yaw
    p = center + [
      math.cos(angle) * x + math.sin(angle) * z,
      -math.sin(angle) * x + math.cos(angle) * z,
    ]
    emit(*[p[0], GROUND + y, p[1], w, h, d, angle, color, role])

  # The bound figure faces the east access; anatomy is a small faceted reading,
  # never a claimed scan. Hands are bound in FRONT (correcting the old proxy).
  bronze = 0x58605A
  localbox(0, 0.13, 0, 0.83, 0.08, 0.67, bronze, 9)
  for side in [-1, 1]:
    localbox(side * 0.17, 0.20, 0.10, 0.21, 0.16, 0.42, bronze, 9)
    localbox(side * 0.16, 0.68, 0, 0.18, 0.88, 0.20, bronze, 9)
    localbox(side * 0.19, 1.25, -0.03, 0.27, 0.55, 0.27, bronze, 9)
  localbox(0, 1.62, -0.02, 0.58, 0.34, 0.31, bronze, 9)
  localbox(0, 1.99, -0.01, 0.67, 0.48, 0.36, bronze, 9)
  localbox(0, 2.30, 0, 0.20, 0.22, 0.22, bronze, 9)
  localbox(0, 2.55, 0, 0.31, 0.37, 0.32, bronze, 9)
  localbox(0, 2.53, 0.18, 0.08, 0.13, 0.09, 0x62675F, 9)
  for side in [-1, 1]:
    localbox(side * 0.38, 1.92, 0.06, 0.15, 0.45, 0.18, bronze, 9)
    localbox(side * 0.20, 1.73, 0.29, 0.40, 0.15, 0.18, bronze, 9)
  localbox(0, 1.76, 0.33, 0.21, 0.18, 0.20, 0x74776A, 9)
  for y in [1.70, 1.77]:
    localbox(0, y, 0.435, 0.23, 0.028, 0.032, 0x343B36, 10)
  # Inscription plate formerly on the pedestal, now lying before the figure.
  localbox(0, 0.12, 2.8, 1.85, 0.04, 1.10, 0x555D56, 10)
  for z in np.arange(2.43, 3.2, 0.14):
    localbox(0, 0.145, z, 1.46, 0.012, 0.025, 0x94998A, 10)
  for x, z, length in [(-13, -1, 16), (15, 1, 17)]:
    localbox(x, 0.24, z, 0.38, 0.30, length, 0x404743, 11)
  # Do not duplicate the nine existing OSM court trees with approximate trees.
  # South wall memorial plaque: retained mapped anchor and correct vertical form.
  emit(-628.542, GROUND + 1.7, 1231.243, 2.7, 1.65, 0.10, yaw, 0x59635C, 13)
  for y in [1.25, 1.5, 1.75, 2.0]:
    emit(-628.56, GROUND + y, 1231.16, 2.1, 0.035, 0.035, yaw, 0xB2B5A4, 13)

  # Independent orthogonal skin, with no filled courtyard or hidden solid bulk.
  cells = {}

  def put(p, color, size, role):
    key = (size, *(math.floor(float(v) / size) for v in p))
    cells[key] = [color, role]

  for s in surfaces:
    size = 1 if s["role"] == 0 else 0.5
    for t in s["triangles"]:
      a, b, c = np.asarray(t)
      steps = max(
        1,
        math.ceil(
          max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
          / (size * 0.6)
        ),
      )
      for i in range(steps + 1):
        for j in range(steps + 1 - i):
          p = a + (b - a) * i / steps + (c - a) * j / steps
          if s["role"] == 0 and any(
            cor.covers(Point(p[0], p[2])) and p[1] < GROUND + pas["height"]
            for cor, pas in passage_shapes
          ):
            continue
          put(p, s["color"], size, s["role"])
  for x, y, z, w, h, d, yaw, color, role, nx, nz in boxes:
    size = 0.125 if role in [9, 10, 13] else 0.5
    if role in [9, 10, 11, 12, 13]:
      # Memorial bodies have depth: sample every exposed box face, including
      # horizontal inscription plates and the complete long transverse works.
      # Coalescing below joins only occupied cells; no courtyard is solid-filled.
      spans = [w, h, d]
      for fixed in range(3):
        free = [axis for axis in range(3) if axis != fixed]
        for sign in [-1, 1]:
          fixed_value = sign * spans[fixed] / 2
          for aa in np.linspace(
            -spans[free[0]] / 2,
            spans[free[0]] / 2,
            max(2, math.ceil(spans[free[0]] / (size * 0.65)) + 1),
          ):
            for bb in np.linspace(
              -spans[free[1]] / 2,
              spans[free[1]] / 2,
              max(2, math.ceil(spans[free[1]] / (size * 0.65)) + 1),
            ):
              local = [0.0, 0.0, 0.0]
              local[fixed] = fixed_value
              local[free[0]] = aa
              local[free[1]] = bb
              u, v, t = local
              put(
                [
                  x + math.cos(yaw) * u + math.sin(yaw) * t,
                  y + v,
                  z - math.sin(yaw) * u + math.cos(yaw) * t,
                ],
                color,
                size,
                role,
              )
      continue
    if min(w, h) < 0.08:
      continue
    for u in np.arange(-w / 2 + min(w / 2, 0.05), w / 2 + 0.001, max(size * 0.7, 0.03)):
      for v in np.arange(
        -h / 2 + min(h / 2, 0.03), h / 2 + 0.001, max(size * 0.7, 0.03)
      ):
        put(
          [x + math.cos(yaw) * u + nx * 0.48, y + v, z - math.sin(yaw) * u + nz * 0.48],
          color,
          size,
          role,
        )
  cols = {}
  for (size, x, y, z), (color, role) in cells.items():
    cols.setdefault((size, x, z, color, role), []).append(y)
  blocks = []
  for (size, x, z, color, role), ys in sorted(cols.items()):
    ys = sorted(set(ys))
    start = end = ys[0]
    for y in [*ys[1:], None]:
      if y == end + 1:
        end = y
        continue
      blocks.append(
        [
          (x + 0.5) * size,
          (start + end + 1) * size / 2,
          (z + 0.5) * size,
          color,
          size,
          role,
          (end - start + 1) * size,
          size,
        ]
      )
      start = end = y
  blocks = merge_native_runs(blocks)
  write(
    DATA / "bendlerblockV202.json",
    {"surfaces": surfaces, "boxes": boxes, "blocks": blocks},
  )
  ids = ["-7903504"] + [
    p["id"][-8:] for f in families for p in f["parts"] if p["id"][-8:] in by_id
  ]
  old = [by_id[i] for i in ids]
  # Freeze every replaced native cell with its exact vertical signature. A
  # neighboring overlapping source owner is never culled by an area predicate.
  vp = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json").read_text()
  )
  cell = vp["cell_m"]
  grid = vp["grid"]
  columns = []
  originals = [(p, prism_shape(p)) for p in old]
  others = [
    prism_shape(p)
    for p in prisms
    if p["id"] not in ids and prism_shape(p).intersects(box(-830, 1140, -575, 1405))
  ]
  for iz, row in enumerate(vp["building_rows"]):
    z = (grid["min_z_idx"] + iz + 0.5) * cell
    if not 1140 < z < 1405:
      continue
    for x0, count, y0, y1, _ in row:
      for ix in range(x0, x0 + count):
        x = (grid["min_x_idx"] + ix + 0.5) * cell
        if not -830 < x < -575:
          continue
        point = Point(x, z)
        if any(q.contains(point) for q in others):
          continue
        if any(
          q.covers(point)
          and abs(y0 / 10 - p["y0_dm"] / 10) < 0.01
          and abs(y1 / 10 - (p["y0_dm"] / 10 + math.ceil(p["h_dm"] / 10 / cell) * cell))
          < 0.01
          for p, q in originals
        ):
          columns.append([x, z, y0 / 10, y1 / 10])
  write(
    DATA / "bendlerblockV202Navigation.json",
    {
      "parts": nav,
      # Exact native source-skin top faces; keep navigation independent from
      # the large display buffer and match visible block steps at roof edges.
      "nativeRoofFaces": [
        [
          r[0] - r[4] / 2,
          r[2] - r[7] / 2,
          r[0] + r[4] / 2,
          r[2] + r[7] / 2,
          r[1] + r[6] / 2,
        ]
        for r in blocks
        if r[5] == 0
      ],
      "passages": PASSAGES,
      "prismIds": ids,
      "columns": columns,
      "court": [
        {
          "ring": list(q.exterior.coords),
          "holes": [list(h.coords) for h in q.interiors],
        }
        for q in components(court)
      ],
    },
  )
  write(
    DATA / "bendlerblockV202Evidence.json",
    {
      "sourceSha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
      "sourceFamilies": PARENTS,
      "sourcePartCount": len(nav),
      "sourcePolygonCount": sum(
        len(p["surfaces"]) for f in families for p in f["parts"]
      ),
      "previousOwners": old,
      "sourceSuppressionReason": "The full 10-part source family replaces only its eight clipped LoD2 owners and exact OSM relation placeholder; original millimetre source rings and all uncut wall/roof surfaces are retained. Three OSM building_passages open the photographed court approaches.",
      "courtCorrection": "Remove two erroneous garden hedge bars and four duplicate approximate tree additions; retain all nine existing OSM court trees unchanged through ParkDetails. Bound arms move to front; pedestal reduced to ground plate; Reusch works cross the approach. Preserve mapped statue/plaque anchors.",
      "courtTrees": {
        "owner": "ParkDetails",
        "retainedOsmTrees": 9,
        "addedTrees": 0,
        "sourcePath": "src/app/public/mesh/regierungsviertel/park-details.json",
        "sourceSha256": hashlib.sha256(
          (
            ROOT / "src/app/public/mesh/regierungsviertel/park-details.json"
          ).read_bytes()
        ).hexdigest(),
      },
      "interpretation": "Source roof sheets, heights and courtyard rings are measured; colors, fenestration, sculpture, paving courses and passage clearance are image-informed proportional presentation, not an architectural survey. The LoD2 main roof is flat: no undocumented new roof volume is invented.",
      "visualReferences": REFERENCES,
      "primarySources": [
        "https://www.gdw-berlin.de/ort-der-erinnerung/1945-bis-heute",
        "https://www.gdw-berlin.de/ort-der-erinnerung/der-bendlerblock",
        "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050300",
      ],
      "drawnBoxes": len(boxes),
      "drawnTriangles": sum(len(s["triangles"]) for s in surfaces),
      "nativeBoxes": len(blocks),
      "replacedNativeColumns": len(columns),
    },
  )
  print(
    "Bendlerblock",
    len(nav),
    "parts;",
    len(boxes),
    "facade/memorial boxes;",
    len(blocks),
    "native boxes;",
    len(columns),
    "old columns",
  )


if __name__ == "__main__":
  build()
