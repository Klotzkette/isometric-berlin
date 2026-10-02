"""Measured TU Berlin main building and Schleuseninsel UT2 source refinement.

The survey erroneously encloses the whole UT2 pipe at laboratory roof height.
Only that declared solid is superseded by a source-bounded structural estimate.
All other source surfaces, leaf parts and courtyard holes are displayed intact.
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
from build_surrounding_outlines import ROOT
from build_zoo_grounds_v165 import native_rows, sample_triangles
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
ARCHIVE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_386_5819.zip"
DEST = ROOT / "src/app/src/data"
PARENTS = {
  "DEBE04YY500006Rw": "TU Berlin main building, historic wings, northern slab and Audimax",
  "DEBE01YYK0002RC3": "VWS Umlauftank 2, laboratory and long experimental channel",
  "DEBE01YYK0002PZZ": "VWS red brick southern experimental hall",
  "DEBE01YYK0002Skp": "VWS historic channel and rounded western head",
  "DEBE01YYK0002VBQ": "VWS adjoining service building",
}
LEGACY_IDS = {
  "Yu5NppI5",
  "O5AGB7fA",
  "GZbL6snz",
  "U6frqVw8",
  "6Va8XF4g",
  "Yez44z7p",
  "K0002Skp",
  "K0002VBQ",
  "-3348239",
  "14269403",
}
CORRECTED = "DEBE3DQSGZbL6snz"
MODERN = "DEBE3DrjkRIowu3J"
HISTORIC = "DEBE3DEQEZDlPNqy"
GROUND = 5.2
BLUE, PINK, PINK_RIB = 0x1457C5, 0xE59AB9, 0xC9789B
STONE, ALUMINIUM, GLASS, FRAME, ROOF = 0xCEBF9E, 0xBCC3C4, 0x3E545D, 0xDEDDCC, 0x747C77
A = np.array([-2606.55, 641.02])
D = np.array([0.9493, 0.3144])
D /= np.linalg.norm(D)
N = np.array([-D[1], D[0]])


def xyz(u: float, y: float, v: float = 0) -> list[float]:
  p = A + D * u + N * v
  return [round(float(p[0]), 4), round(float(y), 4), round(float(p[1]), 4)]


def poly_record(p: Polygon) -> dict:
  return {
    "ring": [[round(x, 4), round(z, 4)] for x, z in p.exterior.coords[:-1]],
    "holes": [
      [[round(x, 4), round(z, 4)] for x, z in h.coords[:-1]] for h in p.interiors
    ],
  }


def extract() -> tuple[list, list, list]:
  with zipfile.ZipFile(ARCHIVE) as z:
    tree = ET.fromstring(z.read(z.namelist()[0]))
  parents, parts, original = [], [], []
  for parent in tree.findall(".//b:Building", NS):
    pid = parent.get("{" + NS["g"] + "}id")
    if pid not in PARENTS:
      continue
    leaves = leaf_building_parts(parent) or [parent]
    datum = 33.829 if pid.endswith("6Rw") else 31.49
    parents.append(
      {
        "id": pid,
        "name": PARENTS[pid],
        "groundNHN": datum,
        "groundY": GROUND,
        "tile": "386_5819",
        "partIds": [p.get("{" + NS["g"] + "}id") for p in leaves],
      }
    )
    for part in leaves:
      sid = part.get("{" + NS["g"] + "}id")
      own = []
      for bounded in part.findall("b:boundedBy", NS):
        for surface in bounded:
          kind = surface.tag.split("}")[-1]
          for poly in surface.findall(".//g:Polygon", NS):
            rings = []
            for pos in poly.findall(".//g:posList", NS):
              q = list(map(float, pos.text.split()))
              ring = [
                [
                  round(q[i] - 389500, 3),
                  round(q[i + 2] - datum + GROUND, 3),
                  round(5820000 - q[i + 1], 3),
                ]
                for i in range(0, len(q), 3)
              ]
              if ring[0] == ring[-1]:
                ring.pop()
              rings.append(ring)
            color = (
              ROOF
              if kind == "RoofSurface"
              else (ALUMINIUM if sid == MODERN else STONE)
              if pid.endswith("6Rw")
              else BLUE
              if sid in [CORRECTED, "DEBE3DppYez44z7p"]
              else 0xAA654E
            )
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
                "color": color,
              }
            )
      pts = [q for s in own for r in s["rings"] for q in r]
      foot = footprints(own)
      parts.append(
        {
          "id": sid,
          "parentId": pid,
          "groundY": min(q[1] for q in pts),
          "topY": max(q[1] for q in pts),
          "measuredHeightM": float(part.findtext("b:measuredHeight", "0", NS)),
          "polygons": [poly_record(p) for p in polygons_of(foot)],
          "footprintAreaM2": round(foot.area, 6),
        }
      )
      original.extend(own)
  assert len(parents) == 5 and len(parts) == 24
  return parents, parts, original


def add_box(
  rows: list,
  a: np.ndarray,
  d: np.ndarray,
  n: np.ndarray,
  u: float,
  y: float,
  out: float,
  w: float,
  h: float,
  depth: float,
  color: int,
  role: str,
) -> None:
  p = a + d * u + n * out
  rows.append(
    [
      round(float(p[0]), 4),
      round(y, 4),
      round(float(p[1]), 4),
      round(w, 4),
      round(h, 4),
      round(depth, 4),
      round(math.atan2(-d[1], d[0]), 7),
      color,
      role,
    ]
  )


def arch(center: float, bottom: float, height: float, width: float) -> Polygon:
  radius = width / 2
  spring = bottom + height - radius
  return Polygon(
    [
      (center - radius, bottom),
      (center + radius, bottom),
      *[
        (center + radius * math.cos(a), spring + radius * math.sin(a))
        for a in np.linspace(0, math.pi, 13)
      ],
    ]
  )


def facades(original: list, parts: list) -> tuple[list, list]:
  """Visible wall-plane estimates; no envelope or courtyard is simplified."""
  rows, ornaments = [], []
  shape_by_id = {
    p["id"]: unary_union([Polygon(q["ring"], q["holes"]) for q in p["polygons"]])
    for p in parts
  }
  for s in original:
    if s["kind"] != "WallSurface" or s["partId"] == CORRECTED:
      continue
    ring = s["rings"][0]
    a, b = max(
      ((a, b) for a in ring for b in ring),
      key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
    )
    origin = np.array([a[0], a[2]])
    direction = np.array([b[0] - a[0], b[2] - a[2]])
    length = float(np.linalg.norm(direction))
    if length < 3:
      continue
    direction /= length
    normal = np.array([-direction[1], direction[0]])
    middle = origin + direction * length / 2
    if shape_by_id[s["partId"]].buffer(0.01).contains(Point(*(middle + normal * 0.3))):
      normal = -normal
    plane = Polygon(
      [[(np.array([p[0], p[2]]) - origin) @ direction, p[1]] for p in ring]
    ).buffer(0)
    bottom, top = plane.bounds[1], plane.bounds[3]
    modern = s["partId"] == MODERN
    historic = s["partId"] == HISTORIC or s["partId"].endswith("jxvsCG9L")
    stairs = s["partId"].endswith("Yez44z7p")
    if top - bottom < 2.5:
      continue
    if modern:
      # Ten storeys including the entrance level, matching the official inventory.
      ys = np.arange(8.55, 48, 4.35)
      spacing, ww, hh = 2.65, 2.44, 1.9
    elif historic:
      ys = [8.4, 14.0, 20.15, 26.2]
      spacing, ww, hh = 4.2, 2.0, 3.5
    elif stairs:
      ys = np.arange(8.7, 38, 3.5)
      spacing, ww, hh = 3.1, 0.95, 1.15
    elif s["parentId"].endswith("6Rw"):
      # The asymmetric Audimax has no invented window grid.
      if s["partId"].endswith(("UHY8GMw1", "wYwxhVVT")):
        for u in np.arange(0.7, length, 1.25):
          yy = (bottom + top) / 2
          if plane.covers(box(u - 0.06, bottom + 0.25, u + 0.06, top - 0.25)):
            add_box(
              rows,
              origin,
              direction,
              normal,
              u,
              yy,
              0.08,
              0.1,
              top - bottom - 0.5,
              0.14,
              0xBDB39A,
              "audimax-vertical-stone-panel-joint",
            )
        continue
      ys = np.arange(bottom + 1.8, top - 0.5, 3.3)
      spacing, ww, hh = 3.2, 2.0, 1.8
    else:
      ys = [bottom + 2.5, bottom + 7.4]
      spacing, ww, hh = 5.3, 3.1, 3.6
    apertures = []
    count = max(1, math.floor(length / spacing))
    for y in ys:
      for i in range(count):
        u = (i + 0.5) * length / count
        width = min(ww, length / count - 0.5)
        height = hh
        arched = historic or (s["partId"].endswith("O5AGB7fA") and y == ys[0])
        p = (
          arch(u, y - height / 2, height, width)
          if arched
          else box(u - width / 2, y - height / 2, u + width / 2, y + height / 2)
        )
        if not plane.buffer(-0.14).covers(p):
          continue
        apertures.append(p)
        if arched:

          def at(q: tuple, out: float) -> list:
            xz = origin + direction * q[0] + normal * out
            return [
              round(float(xz[0]), 4),
              round(float(q[1]), 4),
              round(float(xz[1]), 4),
            ]

          glass_ring = [at(q, 0.075) for q in p.exterior.coords[:-1]]
          ornaments.append(
            {
              "kind": "WallSurface",
              "role": "historic-arched-glazing",
              "color": GLASS,
              "triangles": triangles_for([glass_ring]),
            }
          )
          outer = p.buffer(0.18, join_style=2)
          trim = outer.difference(p)
          for q in polygons_of(trim):
            rr = [
              [at(v, 0.12) for v in r.coords[:-1]] for r in [q.exterior, *q.interiors]
            ]
            ornaments.append(
              {
                "kind": "WallSurface",
                "role": "historic-arch-stone-surround",
                "color": FRAME,
                "triangles": triangles_for(rr),
              }
            )
        else:
          add_box(
            rows,
            origin,
            direction,
            normal,
            u,
            y,
            0.08,
            width,
            height,
            0.12,
            GLASS,
            "ribbon-glazing" if modern else "rectangular-glazing",
          )
        add_box(
          rows,
          origin,
          direction,
          normal,
          u,
          y,
          0.18,
          0.08,
          height,
          0.14,
          FRAME,
          "window-mullion",
        )
        add_box(
          rows,
          origin,
          direction,
          normal,
          u,
          y - height * 0.1,
          0.19,
          width,
          0.09,
          0.14,
          FRAME,
          "window-transom",
        )
        if not modern:
          add_box(
            rows,
            origin,
            direction,
            normal,
            u,
            y - height / 2 - 0.16,
            0.16,
            width + 0.35,
            0.21,
            0.32,
            FRAME,
            "projecting-window-sill",
          )
    if modern:
      for y in np.arange(7.1, 49, 4.35):
        if plane.covers(box(0.15, y - 0.13, length - 0.15, y + 0.13)):
          add_box(
            rows,
            origin,
            direction,
            normal,
            length / 2,
            y,
            0.16,
            length - 0.3,
            0.25,
            0.26,
            ALUMINIUM,
            "continuous-aluminium-spandrel-edge",
          )
      for u in np.arange(0.15, length, 2.65):
        if plane.covers(box(u - 0.04, bottom + 0.3, u + 0.04, top - 0.3)):
          add_box(
            rows,
            origin,
            direction,
            normal,
            u,
            (bottom + top) / 2,
            0.14,
            0.08,
            top - bottom - 0.6,
            0.18,
            0x9BA6AA,
            "continuous-facade-mullion",
          )
    elif historic:
      for y in [5.8, 10.9, 17.1, 23.5, top - 0.55, top - 0.16]:
        if plane.covers(box(0.05, y - 0.1, length - 0.05, y + 0.1)):
          add_box(
            rows,
            origin,
            direction,
            normal,
            length / 2,
            y,
            0.18,
            length - 0.1,
            0.22,
            0.4,
            FRAME,
            "historic-stone-cornice",
          )
      # Projecting base courses reflect the surviving sandstone rustication.
      for y in np.arange(6, 10.6, 0.65):
        for u in np.arange(0.7, length, 1.65):
          course = box(u - 0.65, y - 0.16, u + 0.65, y + 0.16)
          if plane.covers(course) and not any(
            course.intersects(p.buffer(0.16)) for p in apertures
          ):
            add_box(
              rows,
              origin,
              direction,
              normal,
              u,
              y,
              0.11,
              1.3,
              0.32,
              0.2,
              0xB8A286,
              "sandstone-rustication",
            )
  return rows, ornaments


def prism_surfaces(
  u0: float,
  u1: float,
  y0: float,
  y1: float,
  v0: float,
  v1: float,
  color: int,
  role: str,
) -> list:
  vertices = [
    xyz(u, y, v)
    for u, y, v in [
      (u0, y0, v0),
      (u1, y0, v0),
      (u1, y0, v1),
      (u0, y0, v1),
      (u0, y1, v0),
      (u1, y1, v0),
      (u1, y1, v1),
      (u0, y1, v1),
    ]
  ]
  result = []
  for ids, kind in [
    ([0, 1, 5, 4], "WallSurface"),
    ([1, 2, 6, 5], "WallSurface"),
    ([2, 3, 7, 6], "WallSurface"),
    ([3, 0, 4, 7], "WallSurface"),
    ([4, 5, 6, 7], "RoofSurface"),
    ([0, 3, 2, 1], "ClosureSurface"),
  ]:
    result.append(
      {
        "kind": kind,
        "role": role,
        "color": color,
        "triangles": [
          [vertices[ids[0]], vertices[ids[1]], vertices[ids[2]]],
          [vertices[ids[0]], vertices[ids[2]], vertices[ids[3]]],
        ],
      }
    )
  return result


def tube_surface(path: list, radius: float, color: int, role: str) -> dict:
  triangles = []
  rings = []
  for u, y, tu, ty in path:
    # Cross-section normal lies in the loop plane; the second axis is its depth.
    rings.append(
      [
        xyz(
          u - ty * radius * math.cos(a),
          y + tu * radius * math.cos(a),
          0.15 + radius * math.sin(a),
        )
        for a in np.linspace(0, 2 * math.pi, 25)[:-1]
      ]
    )
  for a, b in zip(rings, rings[1:] + rings[:1]):
    for j in range(24):
      k = (j + 1) % 24
      triangles.extend([[a[j], b[j], b[k]], [a[j], b[k], a[k]]])
  return {"kind": "RoofSurface", "role": role, "color": color, "triangles": triangles}


def water_geometry() -> tuple[list, list]:
  """Open loop and raised blue hall, dimensions constrained by survey and photos."""
  surfaces = prism_surfaces(
    16.8, 43, 17.8, 39.667, -4.6, 4.9, BLUE, "ut2-raised-blue-laboratory"
  )
  # A lower central service shaft and separate steel piers leave visible gaps.
  surfaces += prism_surfaces(
    29.1, 36.6, 7, 17.8, -4.4, 4.7, BLUE, "ut2-lower-service-shaft"
  )
  for u in [17.2, 26.5, 37.1, 42.5]:
    for v in [-4.2, 4.5]:
      surfaces += prism_surfaces(
        u - 0.23, u + 0.23, 5.2, 17.8, v - 0.23, v + 0.23, 0x74818B, "ut2-steel-support"
      )
  path = []
  # Closed stadium in a vertical plane, with true central air space.
  for u in np.linspace(8.7, 43, 38, endpoint=False):
    path.append((u, 22.1, 1, 0))
  for a in np.linspace(math.pi / 2, -math.pi / 2, 36, endpoint=False):
    path.append(
      (43 + 5.85 * math.cos(a), 16.25 + 5.85 * math.sin(a), math.sin(a), -math.cos(a))
    )
  for u in np.linspace(43, 8.7, 38, endpoint=False):
    path.append((u, 10.4, -1, 0))
  for a in np.linspace(-math.pi / 2, -3 * math.pi / 2, 36, endpoint=False):
    path.append(
      (8.7 + 5.85 * math.cos(a), 16.25 + 5.85 * math.sin(a), math.sin(a), -math.cos(a))
    )
  surfaces.append(tube_surface(path, 4.45, PINK, "ut2-open-pink-circulation-loop"))
  rows = []
  for v, sgn in [(-4.6, -1), (4.9, 1)]:
    for u0, u1, y in [
      (20.2, 25.5, 33.7),
      (29.9, 42.6, 33.7),
      (38.6, 42.6, 29.8),
      (38.6, 42.6, 26.0),
    ]:
      add_box(
        rows,
        A,
        D,
        N,
        (u0 + u1) / 2,
        y,
        v + sgn * 0.09,
        u1 - u0,
        1.15,
        0.14,
        GLASS,
        "ut2-offset-horizontal-window-strip",
      )
      for u in np.arange(u0, u1 + 0.05, 1.1):
        add_box(
          rows,
          A,
          D,
          N,
          u,
          y,
          v + sgn * 0.19,
          0.07,
          1.3,
          0.16,
          0xB3B9B2,
          "ut2-window-mullion",
        )
    for u in np.arange(17, 43, 4.25):
      add_box(
        rows,
        A,
        D,
        N,
        u,
        28.8,
        v + sgn * 0.08,
        0.07,
        21.2,
        0.12,
        0x3C76D0,
        "ut2-blue-panel-joint",
      )
  for u in [9.8, 13.5, 15.6, 44.5, 47]:
    for y in [10.4, 22.1]:
      ring = []
      for a in np.linspace(0, 2 * math.pi, 33):
        ring.append((a, xyz(u, y + 4.57 * math.cos(a), 0.15 + 4.57 * math.sin(a))))
      ts = []
      for (_, a), (_, b) in zip(ring, ring[1:]):
        aa = [a[0] + D[0] * 0.17, a[1], a[2] + D[1] * 0.17]
        bb = [b[0] + D[0] * 0.17, b[1], b[2] + D[1] * 0.17]
        ts.extend([[a, b, bb], [a, bb, aa]])
      surfaces.append(
        {
          "kind": "WallSurface",
          "role": "ut2-pink-flange-rib",
          "color": PINK_RIB,
          "triangles": ts,
        }
      )
  # Roof ridge lights and exhausts; visual estimates, not machinery simulation.
  for u in [20, 25, 30, 35, 40]:
    surfaces += prism_surfaces(
      u - 1.6, u + 1.6, 39.667, 40.05, -2.9, 2.9, 0xB7C7CA, "ut2-low-rooflight"
    )
  return surfaces, rows


def sample_boxes(rows: list, step: float = 0.5) -> list:
  """Independent orthogonal detail cubes, with lossless horizontal run merging."""
  cells = {}
  for x, y, z, w, h, depth, yaw, color, *_ in rows:
    # Surface-centre sampling avoids a solid voxel volume and bounds memory.
    xs = np.linspace(-w / 2, w / 2, max(2, math.ceil(w / step) + 1))
    ys = np.linspace(-h / 2, h / 2, max(2, math.ceil(h / step) + 1))
    for xx in xs:
      for yy in ys:
        p = (
          math.floor((x + math.cos(yaw) * xx) / step),
          math.floor((y + yy) / step),
          math.floor((z - math.sin(yaw) * xx) / step),
        )
        cells[p] = color
  return merge_cells(cells, step)


def merge_cells(cells: dict, step: float) -> list:
  groups = defaultdict(list)
  for (x, y, z), color in cells.items():
    groups[(y, z, color)].append(x)
  rows = []
  for (y, z, c), xs in sorted(groups.items()):
    xs.sort()
    start = prev = xs[0]
    for x in xs[1:] + [xs[-1] + 2]:
      if x != prev + 1:
        rows.append(
          [
            round((start + prev + 1) * step / 2, 4),
            round((y + 0.5) * step, 4),
            round((z + 0.5) * step, 4),
            round((prev - start + 1) * step, 4),
            step,
            step,
            c,
          ]
        )
        start = x
      prev = x
  return rows


def vertical_bands(cells: dict, step: float, datum: float) -> list:
  """Compact actual native skin intervals; disjoint vertical gaps stay disjoint."""
  columns = defaultdict(list)
  for x, y, z in cells:
    columns[(x, z)].append(y)
  result = []
  for (x, z), ys in sorted(columns.items()):
    ys = sorted(set(ys))
    start = prev = ys[0]
    for y in ys[1:] + [ys[-1] + 2]:
      if y != prev + 1:
        result.append(
          [x, z, round(datum + start * step, 4), round(datum + (prev + 1) * step, 4)]
        )
        start = y
      prev = y
  return result


def photo_references() -> list:
  entries = [
    (
      "tu-front",
      "tu_berlin_main_building",
      "Technische-Universitaet-Hauptgebaeude-Berlin-Charlottenburg-06-2017.jpg",
      "Gunnar Klack",
      "4.0",
      "northern aluminium ribbon facade and windowless asymmetric Audimax",
    ),
    (
      "tu-south",
      "tu_berlin_main_building",
      "Charlottenburg TU-Hauptgebäude Südfassade.JPG",
      "Fridolin freudenfett (Peter Kuley)",
      "3.0",
      "surviving sandstone south facade, arched windows, rustication and cornices",
    ),
    (
      "tu-west",
      "tu_berlin_main_building",
      "Charlottenburg TU Hauptgebäude Westfassade.JPG",
      "Fridolin freudenfett (Peter Kuley)",
      "3.0",
      "west historic wing and bridge opening",
    ),
    (
      "ut-loop",
      "tu_berlin_umlauftank_2",
      "Technische-Universitaet-Berlin-Umlauftank-2-Versuchanstalt-fuer-Wasserbau-und-Schiffbau-03-2017.jpg",
      "Gunnar Klack",
      "4.0",
      "pink loop, blue laboratory and brick south hall",
    ),
    (
      "ut-side",
      "tu_berlin_umlauftank_2",
      "TUB-Umlaufkanal-Schleuseninsel.jpg",
      "KK nationsonline",
      "4.0",
      "elevated blue hall, offset window ribbons, open lower bays and exposed loop",
    ),
    (
      "ut-angle",
      "tu_berlin_umlauftank_2",
      "Umlaufkanal berlin 2.jpg",
      "Dreas",
      "4.0",
      "side depth, open loop air gap and brick arched hall windows",
    ),
  ]
  return [
    {
      "landmark_id": landmark,
      "title": "File:" + title,
      "page_url": "https://commons.wikimedia.org/wiki/File:" + title.replace(" ", "_"),
      "license": "CC BY-SA " + version,
      "license_url": "https://creativecommons.org/licenses/by-sa/" + version + "/",
      "artist": artist,
      "credit": artist + " / CC BY-SA " + version,
      "role": "external_visual_QA_reference_attribution_only",
      "photo_bundled": False,
      "inspection_date": "2026-10-02",
      "visual_reference": role,
    }
    for _, landmark, title, artist, version, role in entries
  ]


def make_payload() -> tuple[dict, dict, dict]:
  parents, parts, original = extract()
  surfaces = [s for s in original if s["triangles"] and s["partId"] != CORRECTED]
  boxes, ornaments = facades(original, parts)
  water, water_boxes = water_geometry()
  navigation = []
  surfaces += water + ornaments
  boxes += water_boxes
  cells = {}
  for s in surfaces:
    sample_triangles(cells, s["triangles"], s["color"])
  native = native_rows(cells)
  details = sample_boxes(boxes)
  for p in parts:
    if p["id"] == CORRECTED:
      continue
    for i, q in enumerate(p["polygons"]):
      navigation.append(
        {
          "id": p["id"] + f":nav:{i}",
          "sourcePartId": p["id"],
          "parentId": p["parentId"],
          "groundY": p["groundY"],
          "topY": p["topY"],
          **q,
        }
      )
  water_cells = {}
  for surface in water:
    sample_triangles(water_cells, surface["triangles"], surface["color"])
  fine_cells = {}
  for x, y, z, width, _, _, color in sample_boxes(water_boxes):
    for xx in range(round((x - width / 2) / 0.5), round((x + width / 2) / 0.5)):
      fine_cells[(xx, round((y - 0.25) / 0.5), round((z - 0.25) / 0.5))] = color
  legacy = [
    p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
    if p["id"] in LEGACY_IDS
  ]
  assert len(legacy) == 10
  roofs = [t for s in surfaces if s["kind"] == "RoofSurface" for t in s["triangles"]]
  roof_cells = {}
  for x, y, z in cells:
    roof_cells[(x, z)] = max(roof_cells.get((x, z), -100), GROUND + y + 1)
  payload = {
    "schemaVersion": 1,
    "parents": parents,
    "sourceParts": parts,
    "parts": navigation,
    "surfaces": surfaces,
    "facadeBoxes": boxes,
    "nativeRows": native,
    "nativeDetailRows": details,
    "legacyPrisms": legacy,
  }
  nav = {k: payload[k] for k in ["parents", "sourceParts", "parts", "legacyPrisms"]}
  nav.update(
    {
      "structureNativeBands": vertical_bands(water_cells, 1, GROUND),
      "structureNativeFineBands": vertical_bands(fine_cells, 0.5, 0),
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
    "photoReferences": photo_references(),
    "osmContext": {
      "snapshot": "berlin-260929.osm.pbf",
      "mainRelation": "3348239",
      "vwsWay": "684361710",
      "TUAddress": "Straße des 17. Juni 135, Berlin",
      "VWSAddress": "Müller-Breslau-Straße 15 / Schleuseninsel, Berlin",
    },
    "displayChanges": [
      {
        "sourcePolygonId": s["sourcePolygonId"],
        "partId": CORRECTED,
        "action": "superseded-solid-survey-envelope-with-open-industrial-structure",
        "originalRetained": True,
      }
      for s in original
      if s["partId"] == CORRECTED and s["triangles"]
    ],
    "references": [
      {
        "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040623",
        "role": "official TU historic campus, surviving south wing, modern north slab and Audimax",
      },
      {
        "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050433",
        "role": "official VWS island complex, pink vertical loop, elevated blue laboratory and historic channels",
      },
      {
        "url": "https://www.tu.berlin/dms/einrichtungen-services/versuchseinrichtungen/umlauftank-ut2",
        "role": "TU identity and scientific use of UT2, distinct from other cavitation tanks",
      },
      {
        "url": "https://wuestenrot-stiftung.de/umlauftank-2-ludwig-leo-berlin/",
        "role": "restoration authority, original metal panels, windows and roof lights",
      },
    ],
    "estimates": [
      "Every facade bay, glazing subdivision, arch trim and relief course is independently authored on a measured survey wall. No photo pixels or copied plans are bundled.",
      "UT2 GZbL6snz is a survey simplification that closes the whole machinery silhouette to roof height. The bounded open loop, raised hall, columns and shaft replace only that part. All original polygons remain verbatim in this evidence.",
      "UT2 tube outside radius 4.45 m, loop centreline turn radius 5.85 m, laboratory width 26.2 m and lower void heights are photo-informed display estimates anchored to the 54.9 m surveyed footprint and 34.467 m measured height. They are not fabrication dimensions.",
      "Main TU source courts, bridges, small annexes, current northern slab, windowless Audimax and historic southern wings remain separate surveyed leaves. VWS eastern buildings beyond the bounded five-parent scope retain their existing source owners.",
    ],
    "counts": {
      "parents": len(parents),
      "parts": len(parts),
      "originalSurfaces": len(original),
      "sourceTriangles": sum(len(s["triangles"]) for s in original),
      "displayTriangles": sum(len(s["triangles"]) for s in surfaces),
      "facadeBoxes": len(boxes),
      "nativeCells": len(cells),
      "nativeRuns": len(native),
      "nativeDetailRuns": len(details),
      "navigationPolygons": len(navigation),
    },
  }
  return payload, nav, evidence


def main() -> None:
  payload, nav, evidence = make_payload()
  for name, p in [("Source", payload), ("Navigation", nav), ("Evidence", evidence)]:
    (DEST / f"tuWaterV168{name}.json").write_text(
      json.dumps(p, separators=(",", ":"), ensure_ascii=False) + "\n"
    )
  Path("/tmp/tu-water-v168-attribution.json").write_text(
    json.dumps(evidence["photoReferences"], indent=2, ensure_ascii=False) + "\n"
  )
  print(evidence["counts"])


if __name__ == "__main__":
  main()
