"""Step 10: surveyed Teehaus footprint, documented post-fire ruin presentation.

The December 2025 photographs supersede the intact roof in the older survey.
All six source parts and every source boundary survive in the evidence file.
Facade openings and fire damage are reference estimates, not a new survey.
"""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from pathlib import Path

import numpy as np
from build_breitscheid_towers_v161 import triangles_for
from build_citywest_cinemas_v166 import footprints, polygons_of
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_387_5819.zip"
PARENTS = {"DEBE01YYK0002QHT", "DEBE01YYK0003VSX", "DEBE01YYK0003VOb"}
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
GROUND, DATUM = 5.2, 32.733
DEST = ROOT / "src/app/src/data/teehausRuinV168Source.json"
ORIGIN = np.array([-1597.4, 153.1])
ALONG = np.array([0.937, 0.3493])
ALONG /= np.linalg.norm(ALONG)
ACROSS = np.array([-ALONG[1], ALONG[0]])
WHITE, CHAR, BRICK, WOOD = 0xC8C9BC, 0x383B36, 0x805344, 0x4A3F34
REFERENCES = [
  "https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2026/pressemitteilung.1660471.php",
  *[
    "https://commons.wikimedia.org/wiki/File:Teehaus_Englischer_Garten_Gro%C3%9Fer_Tiergarten_Berlin-Tiergarten_2025-12-12_"
    + n
    + ".jpg"
    for n in ["01", "02", "03", "04"]
  ],
  "https://www.openstreetmap.org/way/25500391",
]


def at(u, v, h):
  p = ORIGIN + ALONG * u + ACROSS * v
  return [round(float(p[0]), 4), round(GROUND + h, 4), round(float(p[1]), 4)]


def extract():
  with zipfile.ZipFile(ARCHIVE) as z:
    tree = ET.fromstring(z.read(z.namelist()[0]))
  parts, original = [], []
  for parent in tree.findall(".//b:Building", NS):
    pid = parent.get("{" + NS["g"] + "}id")
    if pid not in PARENTS:
      continue
    for part in leaf_building_parts(parent) or [parent]:
      sid = part.get("{" + NS["g"] + "}id")
      own = []
      for bd in part.findall("b:boundedBy", NS):
        for s in bd:
          for poly in s.findall(".//g:Polygon", NS):
            rings = []
            for pos in poly.findall(".//g:posList", NS):
              a = list(map(float, pos.text.split()))
              ring = [
                [
                  round(a[i] - 389500, 3),
                  round(a[i + 2] - DATUM + GROUND, 3),
                  round(5820000 - a[i + 1], 3),
                ]
                for i in range(0, len(a), 3)
              ]
              if ring[0] == ring[-1]:
                ring.pop()
              rings.append(ring)
            own.append(
              {
                "partId": sid,
                "parentId": pid,
                "kind": s.tag.split("}")[-1],
                "sourcePolygonId": poly.get("{" + NS["g"] + "}id"),
                "rings": rings,
              }
            )
      foot = footprints(own)
      parts.append(
        {
          "id": sid,
          "parentId": pid,
          "groundY": min(p[1] for s in own for r in s["rings"] for p in r),
          "topY": max(p[1] for s in own for r in s["rings"] for p in r),
          "polygons": [
            {
              "ring": list(p.exterior.coords)[:-1],
              "holes": [list(r.coords)[:-1] for r in p.interiors],
            }
            for p in polygons_of(foot)
          ],
        }
      )
      original.extend(own)
  assert len(parts) == 6
  return parts, original


def build():
  parts, original = extract()
  footprint = unary_union(
    [Polygon(p["ring"], p["holes"]) for part in parts for p in part["polygons"]]
  )
  surfaces, actions, boxes, walls = [], [], [], []

  def surface(role, rings, color, source_id=None):
    ts = triangles_for(rings)
    if ts:
      surfaces.append(
        {"role": role, "sourcePolygonId": source_id, "color": color, "triangles": ts}
      )

  def emit_box(u, v, h, w, dep, height, color, role):
    boxes.append(
      [*at(u, v, h), w, height, dep, -math.atan2(ALONG[1], ALONG[0]), color, role]
    )

  for s in original:
    if s["kind"] != "WallSurface":
      actions.append(
        {
          "sourcePolygonId": s["sourcePolygonId"],
          "action": "roof-lost-in-fire"
          if s["kind"] == "RoofSurface"
          else "ground-retained-in-evidence",
          "originalRetained": True,
        }
      )
      continue
    ring = s["rings"][0]
    a, b = max(
      ((a, b) for a in ring for b in ring),
      key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
    )
    d = np.array([b[0] - a[0], b[2] - a[2]])
    length = float(np.linalg.norm(d))
    if length < 0.02:
      actions.append(
        {
          "sourcePolygonId": s["sourcePolygonId"],
          "action": "degenerate-boundary-archived",
          "originalRetained": True,
        }
      )
      continue
    d /= length
    mid = np.array([(a[0] + b[0]) / 2, (a[2] + b[2]) / 2])
    # Shared part boundaries are archived, never made into new walls across
    # the photographed open interior. Existing exterior support survives.
    normal = np.array([d[1], -d[0]])
    both_sides_inside = all(
      footprint.buffer(0.02).covers(Point(mid + normal * side * 0.2))
      for side in [-1, 1]
    )
    if both_sides_inside or footprint.boundary.distance(Point(mid)) > 0.12:
      actions.append(
        {
          "sourcePolygonId": s["sourcePolygonId"],
          "action": "internal-survey-boundary-archived",
          "originalRetained": True,
        }
      )
      continue
    origin = np.array([a[0], a[2]])
    poly = Polygon(
      [(float((np.array([p[0], p[2]]) - origin) @ d), p[1]) for p in ring]
    ).buffer(0)
    terminal = abs(float(d @ ACROSS)) > 0.88 and (
      float((mid - ORIGIN) @ ALONG) < 0.6 or float((mid - ORIGIN) @ ALONG) > 33.7
    )
    if terminal:
      actions.append(
        {
          "sourcePolygonId": s["sourcePolygonId"],
          "action": "photo-terminal-gable-reconciled",
          "originalRetained": True,
        }
      )
      continue
    gable = False
    if not gable:
      poly = poly.intersection(box(-0.01, GROUND, length + 0.01, GROUND + 3.25))
    normal = np.array([d[1], -d[0]])
    if footprint.covers(Point(mid + normal * 0.2)):
      normal = -normal
    openings = []
    if length > 3.7:
      for h, count, width in [
        (1.65, max(1, round(length / 2.55)), 1.05),
        (4.5, max(1, round(length / 2.55)), 0.95),
      ]:
        if h > 3 and not gable:
          continue
        for i in range(count):
          u = (i + 0.5) * length / count
          opening = box(
            u - width / 2, GROUND + h - 0.72, u + width / 2, GROUND + h + 0.72
          )
          if not poly.buffer(-0.12).covers(opening):
            continue
          openings.append(opening)
          # Dark wood frames lie on the actual surveyed wall plane.
          yaw = -math.atan2(d[1], d[0])
          for du, dy, w, h2 in [
            (-width / 2, 0, 0.075, 1.52),
            (width / 2, 0, 0.075, 1.52),
            (0, -0.72, width, 0.075),
            (0, 0.72, width, 0.075),
            (0, 0, 0.06, 1.44),
          ]:
            p = origin + d * (u + du) + normal * 0.035
            boxes.append(
              [
                round(float(p[0]), 4),
                GROUND + h + dy,
                round(float(p[1]), 4),
                w,
                h2,
                0.12,
                yaw,
                WOOD,
                "surviving timber window frame",
              ]
            )
    if gable and length > 6:
      eye = Point(length * 0.5, GROUND + 6.65).buffer(0.25, quad_segs=12)
      if poly.covers(eye):
        openings.append(eye)
    cut = poly.difference(unary_union(openings))
    for p in polygons_of(cut):

      def xyz(u, y):
        q = origin + d * u
        return [float(q[0]), y, float(q[1])]

      surface(
        "surviving gable" if gable else "open ground wall",
        [[xyz(*q) for q in r.coords[:-1]] for r in [p.exterior, *p.interiors]],
        WHITE,
        s["sourcePolygonId"],
      )
    # Small opaque soot/charring patches stay clipped to the surviving wall,
    # including its openings. They are vector presentation, never photo texture.
    if length > 3:
      for k in range(max(1, round(length / 3))):
        lo = k * length / max(1, round(length / 3))
        patch = Polygon(
          [
            (lo, GROUND + 3.25),
            (lo + 1.45, GROUND + 3.25),
            (lo + 1.2, GROUND + 2.96),
            (lo + 0.2, GROUND + 2.8),
          ]
        )
        for p in polygons_of(cut.intersection(patch)):
          surface(
            "scorched wall top",
            [
              [
                [
                  float((origin + d * u + normal * 0.018)[0]),
                  y,
                  float((origin + d * u + normal * 0.018)[1]),
                ]
                for u, y in r.coords[:-1]
              ]
              for r in [p.exterior, *p.interiors]
            ],
            0x77776B,
          )
    p0, p1 = origin, origin + d * length
    # Thin wall collision, not a solid box filling the ruin; doors are not
    # invented and the real site fence remains a visible perimeter marker.
    wall_poly = Polygon(
      [p0 - normal * 0.16, p1 - normal * 0.16, p1 + normal * 0.16, p0 + normal * 0.16]
    )
    if not poly.is_empty:
      walls.append(
        {
          "id": s["sourcePolygonId"],
          "ring": list(wall_poly.exterior.coords)[:-1],
          "groundY": GROUND,
          "topY": float(poly.bounds[3]),
        }
      )
    actions.append(
      {
        "sourcePolygonId": s["sourcePolygonId"],
        "action": "photo-retained-gable-with-openings"
        if gable
        else "photo-surviving-low-wall-with-openings",
        "originalRetained": True,
      }
    )
  # The photographed terminal facade is one continuous gable. The source
  # segmented its front into separate strips, not separate architectural bays.
  # Reconcile that conflict explicitly, retaining every original in Evidence.
  for u, v0, v1, height in [(0.0, -6.7, 7.99, 8.15), (33.96, -6.74, 6.84, 7.83)]:
    center = (v0 + v1) / 2
    face = Polygon([(v0, 0), (v1, 0), (v1, 3.25), (center, height), (v0, 3.25)])
    holes = []
    for v in [center - 4.0, center - 2.0, center, center + 2.0, center + 4.0]:
      opening = box(v - 0.53, 3.65, v + 0.53, 4.65)
      if face.covers(opening):
        holes.append(opening)
        for dv, dy, w, h in [
          (-0.56, 0, 0.075, 1.1),
          (0.56, 0, 0.075, 1.1),
          (0, -0.53, 1.19, 0.075),
          (0, 0.53, 1.19, 0.075),
          (0, 0, 0.055, 1.06),
        ]:
          q = at(u, v + dv, 4.15 + dy)
          boxes.append(
            [
              *q,
              w,
              h,
              0.14,
              -math.atan2(ACROSS[1], ACROSS[0]),
              WOOD,
              "continuous five-window gable row",
            ]
          )
    holes.append(Point(center, 6.7).buffer(0.24, quad_segs=12))
    # Front door/glass opening is asymmetrical in the reference photograph.
    for v, w in [(center + 3.3, 3.7), (center - 3.5, 1.2), (center - 0.8, 1.1)]:
      holes.append(box(v - w / 2, 0.2, v + w / 2, 2.6))
      for dv in [-w / 2, w / 2]:
        q = at(u, v + dv, 1.4)
        boxes.append(
          [
            *q,
            0.1,
            2.5,
            0.16,
            -math.atan2(ACROSS[1], ACROSS[0]),
            WOOD,
            "surviving entrance jamb",
          ]
        )
    for p in polygons_of(face.difference(unary_union(holes))):
      surface(
        "surviving gable",
        [[at(u, v, h) for v, h in r.coords[:-1]] for r in [p.exterior, *p.interiors]],
        WHITE,
      )
    # Scorched cornice above the entrance, independent of the lost main roof.
    q = at(u - 0.12 if u < 1 else u + 0.12, center, 3.32)
    boxes.append(
      [
        *q,
        11.4,
        0.16,
        0.36,
        -math.atan2(ACROSS[1], ACROSS[0]),
        CHAR,
        "retained facade coping",
      ]
    )
    # Leave the photographed entrance aperture open in collision as well.
    for j, (lo, hi, bottom, top) in enumerate(
      [
        (v0, center + 1.45, 0, height),
        (center + 5.15, v1, 0, height),
        (center + 1.45, center + 5.15, 2.6, height),
      ]
    ):
      if hi <= lo:
        continue
      pa, pb = np.array(at(u, lo, 0))[::2], np.array(at(u, hi, 0))[::2]
      walls.append(
        {
          "id": f"teehaus-terminal-{u}-{j}",
          "ring": list(
            Polygon(
              [
                pa - ALONG * 0.16,
                pb - ALONG * 0.16,
                pb + ALONG * 0.16,
                pa + ALONG * 0.16,
              ]
            ).exterior.coords
          )[:-1],
          "groundY": GROUND + bottom,
          "topY": GROUND + top,
        }
      )
  # The ruined interior is visibly open to the sky. Its lower dark slab and
  # limited charred members do not pretend that the original roof survives.
  for p in polygons_of(footprint.buffer(-0.25)):
    surface(
      "ruin floor",
      [
        [[x, GROUND + 0.09, z] for x, z in r.coords[:-1]]
        for r in [p.exterior, *p.interiors]
      ],
      0x69665B,
    )
  for u in [4.2, 28.5]:
    emit_box(
      u, 1.15, 2.46, 0.86, 0.86, 4.92, 0xA5A394, "continuous surviving chimney masonry"
    )
    for v in [0.83, 1.47]:
      emit_box(u, v, 9.025, 0.07, 0.07, 0.21, CHAR, "raised chimney cap support")
    emit_box(u, 1.15, 6.9, 0.82, 0.82, 4.1, BRICK, "standing chimney")
    emit_box(u, 1.15, 9.17, 1.03, 1.0, 0.13, CHAR, "chimney cap")
    for y in np.arange(5.0, 8.8, 0.22):
      emit_box(u, 1.15, float(y), 0.84, 0.85, 0.025, 0x62534A, "chimney brick joints")
  for u, v, h, length in [
    (5, 1.1, 3.25, 8),
    (12, 1.4, 0.45, 10),
    (20, 0.6, 0.3, 8),
    (28, 1.4, 3.1, 6),
  ]:
    emit_box(u, v, h, 0.2, length, 0.24, CHAR, "broken charred roof member")
  for u, v, w, d, h in [
    (9, -1, 3.2, 2.1, 0.23),
    (19, 3.3, 4.4, 1.9, 0.17),
    (26, -0.8, 2.8, 1.2, 0.32),
  ]:
    emit_box(u, v, h / 2 + 0.1, w, d, h, 0x625846, "limited collapsed roof debris")
  # Surviving low mossy thatch fragment on the service side, as photographed;
  # its extent is deliberately bounded and clearly separated from lost roofs.
  surface(
    "low surviving thatch fragment",
    [
      [
        at(u, v, h)
        for u, v, h in [(1, 7.95, 3.15), (8, 7.95, 3.15), (8, 4.7, 4.1), (1, 4.7, 4.1)]
      ]
    ],
    0x5E6451,
  )
  # Recorded temporary metal construction fence, outside the measured walls.
  fence = footprint.minimum_rotated_rectangle.buffer(3.2, join_style=2)
  for a, b in zip(list(fence.exterior.coords)[:-1], list(fence.exterior.coords)[1:]):
    d = np.subtract(b, a)
    length = float(np.linalg.norm(d))
    d /= length
    yaw = -math.atan2(d[1], d[0])
    count = max(1, math.ceil(length / 2.4))
    for i in range(count + 1):
      p = np.array(a) + d * length * i / count
      boxes.append(
        [
          float(p[0]),
          GROUND + 1,
          float(p[1]),
          0.045,
          2,
          0.045,
          0,
          0x888B83,
          "site fence post",
        ]
      )
    for y in [0.25, 1.85]:
      p = (np.array(a) + np.array(b)) / 2
      boxes.append(
        [
          float(p[0]),
          GROUND + y,
          float(p[1]),
          length,
          0.035,
          0.035,
          yaw,
          0x92958B,
          "site fence rail",
        ]
      )
  legacy = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  legacy = [p for p in legacy if p["id"] in {p["id"][-8:] for p in parts}]
  assert len(legacy) == 6
  # Independent orthogonal quarter-metre skin, merged only along x rows.
  # No smooth polygons or full-footprint infill are reused by Minecraft.
  cells = {}
  cell = 0.25
  all_surfaces = list(surfaces)
  for x, y, z, w, h, d, yaw, color, role in boxes:
    c, s = math.cos(yaw), math.sin(yaw)
    pts = [
      [x + dx * c + dz * s, y + dy, z - dx * s + dz * c]
      for dx, dy, dz in [
        (-w / 2, -h / 2, -d / 2),
        (w / 2, -h / 2, -d / 2),
        (w / 2, h / 2, -d / 2),
        (-w / 2, h / 2, -d / 2),
        (-w / 2, -h / 2, d / 2),
        (w / 2, -h / 2, d / 2),
        (w / 2, h / 2, d / 2),
        (-w / 2, h / 2, d / 2),
      ]
    ]
    all_surfaces.append(
      {
        "color": color,
        "triangles": [
          [pts[a], pts[b], pts[c]]
          for a, b, c in [
            (0, 1, 2),
            (0, 2, 3),
            (4, 7, 6),
            (4, 6, 5),
            (0, 4, 5),
            (0, 5, 1),
            (3, 2, 6),
            (3, 6, 7),
            (0, 3, 7),
            (0, 7, 4),
            (1, 5, 6),
            (1, 6, 2),
          ]
        ],
      }
    )
  for s in all_surfaces:
    for t in s["triangles"]:
      a, b, c = np.array(t)
      n = max(
        1,
        math.ceil(
          max(np.linalg.norm(a - b), np.linalg.norm(a - c), np.linalg.norm(b - c))
          / 0.17
        ),
      )
      for i in range(n + 1):
        q = a + (b - a) * i / n + (c - a) * np.arange(n + 1 - i)[:, None] / n
        for p in np.floor(q / cell).astype(int):
          cells[tuple(int(v) for v in p)] = s["color"]
  rows = []
  grouped = defaultdict(list)
  for (x, y, z), color in cells.items():
    grouped[(y, z, color)].append(x)
  for (y, z, color), xs in sorted(grouped.items()):
    xs.sort()
    start = prev = xs[0]
    for x in xs[1:] + [xs[-1] + 2]:
      if x != prev + 1:
        rows.append(
          [
            (start + prev + 1) * cell / 2,
            (y + 0.5) * cell,
            (z + 0.5) * cell,
            (prev - start + 1) * cell,
            cell,
            cell,
            color,
          ]
        )
        start = x
      prev = x
  evidence = {
    "parents": sorted(PARENTS),
    "parts": parts,
    "originalSurfaces": original,
    "actions": actions,
    "sourceArchiveSha256": hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
    "referenceUrls": REFERENCES,
    "state": "documented post-fire condition 2025-12-12; 2026 clearance announced, completion unverified",
    "geometryStatus": "surveyed footprint and retained gable planes; reference-estimated openings, damage and small details",
  }
  (ROOT / "geo_data/regierungsviertel/teehaus-ruin-v168-evidence.json").write_text(
    json.dumps(evidence, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  payload = {
    "parts": parts,
    "surfaces": surfaces,
    "boxes": boxes,
    "nativeRows": rows,
    "state": evidence["state"],
  }
  DEST.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
  nav = {"legacyPrisms": legacy, "parts": parts, "walls": walls}
  (DEST.parent / "teehausRuinV168Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(
    json.dumps(
      {
        "parts": len(parts),
        "originalBoundaries": len(original),
        "surfaces": len(surfaces),
        "boxes": len(boxes),
        "nativeRows": len(rows),
        "bytes": DEST.stat().st_size,
      }
    )
  )


if __name__ == "__main__":
  build()
