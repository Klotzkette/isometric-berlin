"""Step 10: complete Tacheles survey with explicit current-roof/passage corrections.

Every original polygon remains in Evidence. Photographs are reference only; all
geometry is authored on metric survey planes, with current details as estimates.
"""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile

import numpy as np
from build_breitscheid_towers_v161 import triangles_for
from build_citywest_cinemas_v166 import footprints, polygons_of
from build_surrounding_outlines import ROOT
from build_zoo_grounds_v165 import native_rows, sample_triangles
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
DEST = ROOT / "src/app/src/data/tachelesV167Source.json"
ARCHIVE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_390_5820.zip"
PARENTS = {
  "DEBE01YYK0000D41": "Fotografiska / former Kunsthaus Tacheles",
  "DEBE01YYK0000B92": "Tacheles western historic wing",
}
PRISM_IDS = {"40754304", "19283679"}
A = np.array([1177.782, -753.118])
D = np.array([1241.877, -725.251]) - A
LENGTH = float(np.linalg.norm(D))
D /= LENGTH
N = np.array([D[1], -D[0]])
GROUND = 5.2
EAVE = 27.448
PASSAGE = (60.0, 68.25)
STONE, DARK, GLASS, ROOF = 0xBBB29E, 0x4B5050, 0x53676C, 0x788581


def xyz(u: float, y: float, v: float = 0) -> list:
  p = A + D * u + N * v
  return [round(float(p[0]), 4), round(float(y), 4), round(float(p[1]), 4)]


def uv(p: list) -> tuple[float, float]:
  q = np.array([p[0], p[2]]) - A
  return float(q @ D), float(q @ N)


def arch_polygon(center: float, radius: float, spring: float, bottom: float) -> Polygon:
  return Polygon(
    [
      (center - radius, bottom),
      (center + radius, bottom),
      *[
        (center + radius * math.cos(a), spring + radius * math.sin(a))
        for a in np.linspace(0, math.pi, 25)
      ],
    ]
  )


def rings_for(poly: Polygon, at) -> list:
  return [
    [at(*p) for p in ring.coords[:-1]] for ring in [poly.exterior, *poly.interiors]
  ]


def extract() -> tuple[list, list, list]:
  with zipfile.ZipFile(ARCHIVE) as z:
    tree = ET.fromstring(z.read(z.namelist()[0]))
  parents, parts, original = [], [], []
  for parent in tree.findall(".//b:Building", NS):
    pid = parent.get("{" + NS["g"] + "}id")
    if pid not in PARENTS:
      continue
    leaves = leaf_building_parts(parent) or [parent]
    datum = 32.602 if pid.endswith("D41") else 32.372
    parents.append(
      {
        "id": pid,
        "name": PARENTS[pid],
        "groundNHN": datum,
        "groundY": GROUND,
        "tile": "390_5820",
        "partIds": [p.get("{" + NS["g"] + "}id") for p in leaves],
      }
    )
    for part in leaves:
      sid = part.get("{" + NS["g"] + "}id")
      own = []
      for bd in part.findall("b:boundedBy", NS):
        for surface in bd:
          kind = surface.tag.split("}")[-1]
          for poly in surface.findall(".//g:Polygon", NS):
            rings = []
            for pos in poly.findall(".//g:posList", NS):
              a = list(map(float, pos.text.split()))
              ring = [
                [
                  round(a[i] - 389500, 3),
                  round(a[i + 2] - datum + GROUND, 3),
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
                "sourcePolygonId": poly.get("{" + NS["g"] + "}id"),
                "kind": kind,
                "rings": rings,
                "triangles": triangles_for(rings)
                if kind in ["RoofSurface", "WallSurface"]
                else [],
                "color": 0x9A7863
                if kind == "RoofSurface" and pid.endswith("B92")
                else ROOF
                if kind == "RoofSurface"
                else STONE,
              }
            )
      foot = footprints(own)
      points = [p for s in own for r in s["rings"] for p in r]
      parts.append(
        {
          "id": sid,
          "parentId": pid,
          "groundY": GROUND,
          "topY": max(p[1] for p in points),
          "measuredHeightM": float(part.findtext("b:measuredHeight", "0", NS)),
          "polygons": [
            {
              "ring": [[round(x, 3), round(z, 3)] for x, z in p.exterior.coords[:-1]],
              "holes": [
                [[round(x, 3), round(z, 3)] for x, z in r.coords[:-1]]
                for r in p.interiors
              ],
            }
            for p in polygons_of(foot)
          ],
          "footprintAreaM2": round(foot.area, 6),
        }
      )
      original.extend(own)
  assert len(parents) == 2 and len(parts) == 4
  return parents, parts, original


def corrected_shell(original: list) -> tuple[list, list]:
  """Replace only the verified conflicting D41 upper roof and open arch volume."""
  surfaces, actions = [], []
  opening = arch_polygon(sum(PASSAGE) / 2, (PASSAGE[1] - PASSAGE[0]) / 2, 13.0, -100)
  for s in original:
    if s["kind"] not in ["RoofSurface", "WallSurface"]:
      continue
    if s["parentId"].endswith("B92"):
      surfaces.append(s)
      continue
    if s["kind"] == "RoofSurface":
      actions.append(
        {
          "sourcePolygonId": s["sourcePolygonId"],
          "action": "superseded-current-low-roof",
          "originalRetained": True,
        }
      )
      continue
    ring = s["rings"][0]
    a, b = max(
      ((a, b) for a in ring for b in ring),
      key=lambda q: math.hypot(q[0][0] - q[1][0], q[0][2] - q[1][2]),
    )
    p = np.array(a)
    direction = np.array([b[0] - a[0], 0, b[2] - a[2]])
    direction /= np.linalg.norm(direction)
    poly = Polygon([[(np.array(q) - p) @ direction, q[1]] for q in ring]).buffer(0)
    clipped = poly.intersection(box(-1000, -100, 1000, EAVE))
    # Opening is a local u/y subtraction on the front and rear envelope only.
    du = float(np.array([direction[0], direction[2]]) @ D)
    if abs(du) > 0.8:
      u0 = uv(a)[0]
      cut = Polygon([((u - u0) / du, y) for u, y in opening.exterior.coords])
      clipped = clipped.difference(cut)
    ts = []
    for q in polygons_of(clipped):
      rr = rings_for(
        q,
        lambda u, y: [
          round(float(p[0] + direction[0] * u), 4),
          round(y, 4),
          round(float(p[2] + direction[2] * u), 4),
        ],
      )
      ts.extend(triangles_for(rr))
    changed = abs(poly.area - clipped.area) > 1e-4
    if changed:
      actions.append(
        {
          "sourcePolygonId": s["sourcePolygonId"],
          "action": "current-eave-and-open-passage-cut",
          "originalRetained": True,
          "removedAreaM2": round(poly.area - clipped.area, 6),
        }
      )
    surfaces.append({**s, "triangles": ts, "displayCorrection": changed})
  return surfaces, actions


def make_payload() -> tuple[dict, dict, dict]:
  parents, parts, original = extract()
  surfaces, actions = corrected_shell(original)
  boxes = []

  def face(ring, color, kind="OrnamentSurface", role="detail"):
    surfaces.append(
      {
        "partId": "authored-current-tacheles",
        "kind": kind,
        "color": color,
        "triangles": triangles_for([ring]),
        "role": role,
      }
    )

  def rect(u, y, w, h, color, v=0.15, depth=0.14, role="detail"):
    boxes.append(
      [
        *xyz(u, y, v),
        round(w, 4),
        round(h, 4),
        round(depth, 4),
        round(math.atan2(-D[1], D[0]), 7),
        color,
        role,
      ]
    )

  def arc(center, spring, radius, color, v=0.22, width=0.2, role="arch"):
    for a, b in zip(np.linspace(0, math.pi, 25)[:-1], np.linspace(0, math.pi, 25)[1:]):
      ring = [
        xyz(center + r * math.cos(t), spring + r * math.sin(t), v)
        for r, t in [(radius, a), (radius, b), (radius + width, b), (radius + width, a)]
      ]
      face(ring, color, role=role)

  def arch_glass(center, v=0.13, width=3.8):
    radius = width / 2
    poly = arch_polygon(center, radius, 10.6, 5.45)
    face(
      [xyz(u, y, v) for u, y in poly.exterior.coords[:-1]], GLASS, role="arched-glazing"
    )
    arc(center, 10.6, radius, 0xB0A38A, v + 0.12, 0.20)
    rect(center, 9.05, width, 0.24, DARK, v + 0.18, 0.24, "arch-transom")
    rect(center, 8.0, 0.075, 5.1, DARK, v + 0.24, 0.08, "mullion")
    for du in [-width / 2 + 0.04, width / 2 - 0.04]:
      rect(center + du, 8.0, 0.085, 5.1, DARK, v + 0.24, 0.1, "mullion")

  # Twelve observed-scale arches across the long stone frontage; spacing is an estimate.
  centers = [2.65, 7.35, 12.05, 16.75, 23.4, 28.1, 32.8, 37.5, 42.2, 46.9, 51.6, 56.3]
  for u in centers:
    arch_glass(u)
    for y in [17.0, 20.85, 24.7]:
      for du in [-1.32, 0, 1.32]:
        rect(u + du, y, 1.10, 2.65, GLASS, 0.16, 0.11, "upper-window")
        rect(u + du, y + 0.91, 1.10, 0.06, DARK, 0.26, 0.08, "window-transom")
        rect(u + du, y - 1.44, 1.33, 0.16, 0xC9BFAA, 0.25, 0.23, "window-sill")
      for du in [-2.12, 2.12]:
        rect(u + du, y, 0.24, 3.6, 0xC8BFAC, 0.22, 0.25, "pilaster")
    # Restrained diamond/keystone relief; independent low relief geometry.
    face(
      [
        xyz(u, 13.25, 0.34),
        xyz(u + 0.23, 13.04, 0.34),
        xyz(u, 12.75, 0.34),
        xyz(u - 0.23, 13.04, 0.34),
      ],
      0xC9BCA1,
      role="stone-keystone",
    )
  # Continuous cornices and real open balustrade above the rusticated plinth.
  for y, h, out in [
    (13.6, 0.24, 0.28),
    (14.7, 0.22, 0.35),
    (26.9, 0.30, 0.34),
    (27.4, 0.19, 0.50),
  ]:
    rect(29.3, y, 58.2, h, 0xC6BBA4, out, 0.3, "cornice")
  for u in np.arange(0.65, 58.4, 0.57):
    rect(float(u), 14.15, 0.14, 0.9, 0xCEC4AC, 0.24, 0.19, "baluster")
  for u in np.arange(0.5, 59.4, 2.35):
    if any(abs(u - c) < 2.1 for c in centers):
      continue
    for y in np.arange(5.65, 13.3, 0.55):
      rect(float(u), float(y), 0.56, 0.37, 0xB0A68F, 0.12, 0.12, "rustication")
  # The east passage has no opaque plane below its arched soffit.
  center = sum(PASSAGE) / 2
  radius = (PASSAGE[1] - PASSAGE[0]) / 2
  for v in [0.17, -16.0]:
    arc(center, 13.0, radius, 0xB8AB91, v, 0.47, "passage-arch")
    for u in PASSAGE:
      rect(u, 9.05, 0.43, 7.7, 0xB7AA92, v, 0.48, "passage-pier")
  for a, b in zip(np.linspace(0, math.pi, 25)[:-1], np.linspace(0, math.pi, 25)[1:]):
    face(
      [
        xyz(center + radius * math.cos(a), 13 + radius * math.sin(a), 0.0),
        xyz(center + radius * math.cos(b), 13 + radius * math.sin(b), 0.0),
        xyz(center + radius * math.cos(b), 13 + radius * math.sin(b), -16.0),
        xyz(center + radius * math.cos(a), 13 + radius * math.sin(a), -16.0),
      ],
      0x9C9687,
      role="passage-soffit",
    )
  for u in PASSAGE:
    face(
      [xyz(u, GROUND, 0), xyz(u, 13, 0), xyz(u, 13, -16), xyz(u, GROUND, -16)],
      0xA79D88,
      role="passage-inner-wall",
    )
  rect(center, 9.5, radius * 2, 1.0, DARK, -7.7, 1.25, "surviving-high-bridge")
  rect(center, 10.0, radius * 2, 1.05, 0x353B3B, 0.4, 0.27, "passage-sign")
  for y in [19.2, 23.45]:
    for du in [-2.45, 0, 2.45]:
      rect(center + du, y, 1.62, 2.75, GLASS, 0.19, 0.12, "portal-upper-window")
  # The current photographed low rooftop replaces only stale D41 roof polygons.
  main = next(p for p in parts if p["id"] == "DEBE01YYK0000D41")
  for p in main["polygons"]:
    face([[x, EAVE, z] for x, z in p["ring"]], ROOF, "RoofSurface", "current-flat-roof")
  # Low prism with a narrow ridge, inset inside the surveyed main envelope.
  u0, u1 = 22.4, 68.3
  v0, v1 = -3.8, -12.4
  ridge = -8.1
  top = 30.75
  for ring in [
    [xyz(u0, EAVE, v0), xyz(u1, EAVE, v0), xyz(u1, top, ridge), xyz(u0, top, ridge)],
    [xyz(u0, top, ridge), xyz(u1, top, ridge), xyz(u1, EAVE, v1), xyz(u0, EAVE, v1)],
    [xyz(u0, EAVE, v0), xyz(u0, top, ridge), xyz(u0, EAVE, v1)],
    [xyz(u1, EAVE, v0), xyz(u1, EAVE, v1), xyz(u1, top, ridge)],
  ]:
    face(ring, 0x7C999A, "RoofSurface", "current-rooftop-prism")
  # Sloping prism ribs are real thin geometry, sampled separately for native mode.
  for u in np.arange(u0, u1 + 0.01, 2.0):
    for va, vb in [(v0, ridge), (ridge, v1)]:
      ya, yb = (EAVE, top) if va == v0 else (top, EAVE)
      face(
        [
          xyz(u - 0.055, ya, va),
          xyz(u + 0.055, ya, va),
          xyz(u + 0.055, yb, vb),
          xyz(u - 0.055, yb, vb),
        ],
        0xCDD0C7,
        role="roof-glazing-rib",
      )
  rect((u0 + u1) / 2, top + 0.04, u1 - u0, 0.13, 0xD0D3C9, ridge, 0.18, "roof-ridge")
  # Current courtyard face: exposed floor edges and retained brick around glazing.
  for u in np.arange(23.5, 58, 4.7):
    back = -17.60 if u < 33.9 else -16.25
    for y in [7.45, 11.4, 15.4, 19.4, 23.4]:
      rect(float(u), y, 3.6, 2.95, 0x495B62, back, 0.18, "courtyard-window")
      rect(float(u), y, 0.095, 2.95, 0x303D40, back - 0.13, 0.11, "courtyard-mullion")
    for y in [9.35, 13.35, 17.35, 21.35, 25.35]:
      rect(float(u), y, 4.65, 0.29, 0x9E998B, back - 0.03, 0.50, "exposed-floor-edge")
  # Small independently authored folded entrance canopy, not a copied logo/image.
  for aa, bb in [(36.3, 38.1), (38.1, 39.9)]:
    face(
      [
        xyz(aa, 10.15, 0.35),
        xyz(bb, 10.15, 0.35),
        xyz(bb, 12.1, 1.5 if bb == 38.1 else 0.35),
        xyz(aa, 12.1, 1.5 if aa == 38.1 else 0.35),
      ],
      0x3E484F,
      role="folded-entrance-sign",
    )

  native = {}
  for s in surfaces:
    sample_triangles(native, s["triangles"], s["color"])
  # Window and ornament native pieces are orthogonal .4 m independent blocks.
  fine = {}
  for x, y, z, w, h, depth, yaw, color, _ in boxes:
    for u in np.linspace(-w / 2, w / 2, max(2, math.ceil(w / 0.35) + 1)):
      for yy in np.linspace(-h / 2, h / 2, max(2, math.ceil(h / 0.35) + 1)):
        p = [x + math.cos(yaw) * u, y + yy, z - math.sin(yaw) * u]
        key = tuple(math.floor(q / 0.4) for q in p)
        fine[key] = color
  fine_rows = [
    [
      round(x * 0.4 + 0.2, 4),
      round(y * 0.4 + 0.2, 4),
      round(z * 0.4 + 0.2, 4),
      0.4,
      0.4,
      0.4,
      c,
    ]
    for (x, y, z), c in sorted(fine.items())
  ]
  passage_poly = Polygon(
    [
      [xyz(u, 0, v)[0], xyz(u, 0, v)[2]]
      for u, v in [
        (PASSAGE[0], 1),
        (PASSAGE[1], 1),
        (PASSAGE[1], -20),
        (PASSAGE[0], -20),
      ]
    ]
  )
  navigation = []
  for part in parts:
    geom = unary_union([Polygon(p["ring"], p["holes"]) for p in part["polygons"]])
    if part["parentId"].endswith("D41"):
      geom = geom.difference(passage_poly)
    for i, p in enumerate(polygons_of(geom)):
      navigation.append(
        {
          "id": part["id"] + f":nav:{i}",
          "sourcePartId": part["id"],
          "parentId": part["parentId"],
          "ring": [[round(x, 4), round(z, 4)] for x, z in p.exterior.coords[:-1]],
          "holes": [
            [[round(x, 4), round(z, 4)] for x, z in h.coords[:-1]] for h in p.interiors
          ],
          "groundY": GROUND,
          "topY": 30.75 if part["parentId"].endswith("D41") else part["topY"],
        }
      )
  # Separate overhead obstacle preserves roof walking above the open ground lane.
  # The native .4 m bridge blocks extend to Y8.8 (drawn bridge underside Y9.0).
  main_footprint = unary_union(
    [Polygon(p["ring"], p["holes"]) for p in main["polygons"]]
  )
  for i, p in enumerate(polygons_of(main_footprint.intersection(passage_poly))):
    navigation.append(
      {
        "id": "DEBE01YYK0000D41:upper-passage:" + str(i),
        "sourcePartId": "DEBE01YYK0000D41",
        "parentId": "DEBE01YYK0000D41",
        "ring": [[round(x, 4), round(z, 4)] for x, z in p.exterior.coords[:-1]],
        "holes": [],
        "groundY": 8.8,
        "topY": 30.75,
      }
    )
  old = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  legacy = [p for p in old["buildings"] if p["id"] in PRISM_IDS]
  assert len(legacy) == 2
  roofs = [t for s in surfaces if s["kind"] == "RoofSurface" for t in s["triangles"]]
  roof_cells = {}
  for (x, y, z), _ in native.items():
    roof_cells[(x, z)] = max(roof_cells.get((x, z), -100), GROUND + y + 1)
  payload = {
    "schemaVersion": 1,
    "parents": parents,
    "sourceParts": parts,
    "parts": navigation,
    "surfaces": surfaces,
    "facadeBoxes": boxes,
    "nativeRows": native_rows(native),
    "nativeDetailRows": fine_rows,
    "legacyPrisms": legacy,
    "passage": {
      "u": list(PASSAGE),
      "springY": 13,
      "clearHeightM": 3.6,
      "ring": [
        [xyz(u, 0, v)[0], xyz(u, 0, v)[2]]
        for u, v in [
          (PASSAGE[0], 1),
          (PASSAGE[1], 1),
          (PASSAGE[1], -20),
          (PASSAGE[0], -20),
        ]
      ],
    },
  }
  nav = {
    k: payload[k]
    for k in ["parents", "sourceParts", "parts", "legacyPrisms", "passage"]
  }
  nav.update(
    {
      "roofTriangles": roofs,
      "nativeRoofCells": [
        [x, z, round(y, 4)] for (x, z), y in sorted(roof_cells.items())
      ],
    }
  )
  evidence = {
    "schemaVersion": 1,
    "sourceArchive": str(ARCHIVE.relative_to(ROOT)),
    "sourceSha256": hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
    "sourceParents": parents,
    "sourceParts": parts,
    "originalSurfaces": original,
    "photoReferences": [
      {
        "landmark_id": "tacheles_fotografiska_berlin",
        "title": "File:Mitte Oranienburger Straße Am Tacheles.jpg",
        "page_url": "https://commons.wikimedia.org/wiki/File:Mitte_Oranienburger_Stra%C3%9Fe_Am_Tacheles.jpg",
        "license": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "artist": "Fridolin freudenfett",
        "credit": "Fridolin freudenfett / CC BY-SA 4.0",
        "role": "external_visual_QA_reference_attribution_only",
        "photo_bundled": False,
        "inspection_date": "2026-10-02",
        "visual_reference": "current full street facade and low rooftop silhouette",
      },
      {
        "landmark_id": "tacheles_fotografiska_berlin",
        "title": "File:Mitte Oranienburger Straße Am Tacheles-001.jpg",
        "page_url": "https://commons.wikimedia.org/wiki/File:Mitte_Oranienburger_Stra%C3%9Fe_Am_Tacheles-001.jpg",
        "license": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "artist": "Fridolin freudenfett",
        "credit": "Fridolin freudenfett / CC BY-SA 4.0",
        "role": "external_visual_QA_reference_attribution_only",
        "photo_bundled": False,
        "inspection_date": "2026-10-02",
        "visual_reference": "arched glazing, stone rustication and museum entrance",
      },
      {
        "landmark_id": "tacheles_fotografiska_berlin",
        "title": "File:Mitte Oranienburger Straße Am Tacheles-003.jpg",
        "page_url": "https://commons.wikimedia.org/wiki/File:Mitte_Oranienburger_Stra%C3%9Fe_Am_Tacheles-003.jpg",
        "license": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "artist": "Fridolin freudenfett",
        "credit": "Fridolin freudenfett / CC BY-SA 4.0",
        "role": "external_visual_QA_reference_attribution_only",
        "photo_bundled": False,
        "inspection_date": "2026-10-02",
        "visual_reference": "current courtyard glazing and exposed former floor edges",
      },
      {
        "landmark_id": "tacheles_fotografiska_berlin",
        "title": "File:Mitte Oranienburger Straße Am Tacheles-004.jpg",
        "page_url": "https://commons.wikimedia.org/wiki/File:Mitte_Oranienburger_Stra%C3%9Fe_Am_Tacheles-004.jpg",
        "license": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "artist": "Fridolin freudenfett",
        "credit": "Fridolin freudenfett / CC BY-SA 4.0",
        "role": "external_visual_QA_reference_attribution_only",
        "photo_bundled": False,
        "inspection_date": "2026-10-02",
        "visual_reference": "verified open east passage, high bridge and low current roof",
      },
    ],
    "osmContext": {
      "snapshot": "berlin-260929.osm.pbf",
      "ownedWays": [
        {
          "id": "940754304",
          "building": "apartments",
          "building:levels": "5",
          "old_name": "Kunsthaus Tacheles",
          "addr:street": "Oranienburger Straße",
          "addr:housenumber": "54",
          "wikidata": "Q571421",
        },
        {
          "id": "419283679",
          "building": "apartments",
          "building:levels": "5",
          "addr:street": "Oranienburger Straße",
          "addr:housenumber": "54",
        },
      ],
      "retainedNeighbourOwners": [
        {
          "id": "940754327",
          "kind": "way",
          "description": "current eastern Am Tacheles neighbour, separate existing core source",
        },
        {
          "id": "12688119",
          "kind": "relation",
          "description": "current Am Tacheles courtyard complex; separate existing core source and courtyard holes retained",
        },
      ],
    },
    "displayChanges": actions,
    "currentRoof": {
      "status": "photo-verified low silhouette; dimensions are bounded display estimates",
      "eaveY": EAVE,
      "ridgeY": 30.75,
      "sourceEaveY": EAVE,
      "supersededSourceMaximumY": 41.578,
    },
    "identity": {
      "osmWays": ["940754304", "419283679"],
      "oldName": "Kunsthaus Tacheles",
      "currentName": "Fotografiska Berlin",
      "monumentId": "09035146",
      "architect": "Franz Ahrens",
      "construction": "1907–1909",
      "osmConflict": "building=apartments is stale for current museum use",
    },
    "references": [
      {
        "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035146",
        "role": "official monument identity, surviving head building, limestone base and balustrade; historical use text is outdated",
      },
      {
        "url": "https://www.herzogdemeuron.com/projects/439-am-tacheles/",
        "role": "architect current 2018–2024 redevelopment, retained Kunsthaus and reinterpreted courtyard connections",
      },
      {
        "url": "https://berlin.fotografiska.com/en/visit",
        "role": "current museum and street address",
      },
      {
        "url": "https://barclara.fotografiska.com/en/about-clara",
        "role": "current rooftop prism use",
      },
    ],
    "estimates": [
      "Street bay dimensions, window subdivisions, rustication, reliefs, bridge, passage arch, current rooftop prism and its low ridge are independently authored visual estimates anchored to surveyed walls.",
      "No historical demolished gallery or dome is rebuilt. All neighbouring Am Tacheles geometry remains in its existing source owner.",
      "Original ground footprints, all four source leaves and every original wall/roof/closure polygon remain here; only declared current D41 roof and open passage conflicts modify displayed triangles.",
      "No photographic textures, mural tracing, copied plans or restored graffiti.",
    ],
    "counts": {
      "parents": len(parents),
      "parts": len(parts),
      "originalSurfaces": len(original),
      "displaySurfaces": len(surfaces),
      "displayTriangles": sum(len(s["triangles"]) for s in surfaces),
      "facadeBoxes": len(boxes),
      "nativeSourceCells": len(native),
      "nativeSourceRuns": len(payload["nativeRows"]),
      "nativeDetailCells": len(fine_rows),
      "navigationPolygons": len(navigation),
    },
  }
  return payload, nav, evidence


def main():
  payload, nav, evidence = make_payload()
  for name, p in [("Source", payload), ("Navigation", nav), ("Evidence", evidence)]:
    DEST.with_name("tachelesV167" + name + ".json").write_text(
      json.dumps(p, separators=(",", ":"), ensure_ascii=False) + "\n"
    )
  print(evidence["counts"])


if __name__ == "__main__":
  main()
