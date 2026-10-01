"""Step 10: surveyed Hackesche Höfe and Hackescher Markt station architecture.

Every source wall/roof and court survives. Facade decoration is a restrained,
photo-proportioned interpretation clipped to those walls, not a window survey.
"""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import normal_of, triangles_for
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_391_5820.zip"
DEST = ROOT / "src/app/src/data/hackescherMarktV163Source.json"
GROUND = 5.2
# Exact parents intersecting OSM site 337201828 and station way 170063224.
COURTS = """DEBE01YYK0001yOO DEBE01YYK0000Bif DEBE01YYK00001EC DEBE01YYK00006K1
DEBE01YYK0001yHp DEBE01YYK0001yKI DEBE01YYK00009kp DEBE01YYK00005Oq
DEBE01YYK0001xKs DEBE01YYK0001xzR DEBE01YYK0001yCy DEBE01YYK00007Sa
DEBE01YYK0001xI6 DEBE01YYK0001ya5 DEBE01YYK0000CdE DEBE01YYK00003Zc
DEBE00YY217000ZG DEBE01YYK0001xD2 DEBE01YYK0001xFc DEBE01YYK0001xDz
DEBE01YYK0001xFJ DEBE01YYK0001zCN DEBE01YYK0001yYS DEBE01YYK00009PF""".split()
STATION = """DEBE00YYkb00008G DEBE01YYK00004lV DEBE00YYjG0000CR
DEBE00YYkE00008C DEBE01YYK0001yrt""".split()
LEGACY = [
  "-8249215",
  "83761431",
  "23816380",
  "33389624",
  "83761430",
  "83761429",
  "n-546258",
  "70063224",
  "70063225",
  "77110613",
]


def decoration(rings: list, station: bool, parent: str) -> list:
  """Window panes, frames, ceramic fields and cornices inside real wall planes."""
  n = normal_of(rings[0])
  if abs(n[1]) > 0.02:
    return []
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda p: math.hypot(p[1][0] - p[0][0], p[1][2] - p[0][2]),
  )
  base = np.array(a)
  d = np.array([b[0] - a[0], 0, b[2] - a[2]], dtype=float)
  length = float(np.linalg.norm(d))
  if length < 2:
    return []
  d /= length
  local = [
    [(float(np.dot(np.subtract(p, base), d)), p[1]) for p in ring] for ring in rings
  ]
  poly = Polygon(local[0], local[1:]).buffer(-0.025)
  if poly.is_empty:
    return []
  low, y0, high, y1 = poly.bounds
  yaw = math.atan2(-d[2], d[0])
  rows = []
  # Inner face of the Endell first court, identified by its real source plane.
  centre = np.array([2098.0, 0, -533.0])
  inward = (
    parent.endswith("09PF")
    and np.dot(n, centre - base) > 0
    and np.linalg.norm((base - centre)[[0, 2]]) < 55
  )
  front = parent.endswith("09PF") and n[2] > 0.35 and base[2] > -530

  def emit(u, y, w, h, color, out=0.075, depth=0.12, role="frame"):
    if (
      w <= 0
      or h <= 0
      or not poly.covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
    ):
      return
    p = base + d * u + n * out
    rows.append(
      [
        round(p[0], 3),
        round(y, 3),
        round(p[2], 3),
        round(w, 3),
        round(h, 3),
        depth,
        round(yaw, 6),
        color,
        role,
      ]
    )

  if station:
    # Romanesque/Renaissance round-headed glazing and yellow/red brick bands.
    bays = max(1, round(length / 6.8))
    pitch = length / bays
    for i in range(bays):
      u = low + (i + 0.5) * pitch
      w = min(4.8, pitch * 0.73)
      for floor, y in enumerate([GROUND + 3.1, GROUND + 10.0]):
        h = 3.1 if floor == 0 else 3.0
        emit(u, y, w, h, 0x354B4E, role="pane")
        emit(u, y, w + 0.26, 0.14, 0xC1A475, out=0.18, depth=0.2)
        for side in [-1, 1]:
          emit(u + side * w / 2, y, 0.13, h, 0xBDA273, out=0.18, depth=0.2)
        emit(u, y, 0.10, h, 0x969881, out=0.21)
        # Elliptic head assembled from small flat facets, still within source.
        for k in range(24):
          t = (k + 0.5) * math.pi / 24
          emit(
            u + math.cos(t) * w / 2,
            y + h / 2 + math.sin(t) * w * 0.25,
            0.24,
            0.20,
            0xCAB187,
            out=0.16,
          )
    for y in np.arange(GROUND + 0.8, y1, 0.64):
      emit((low + high) / 2, y, high - low, 0.045, 0x99734F, out=0.035, depth=0.055)
    for y in [GROUND + 6.1, GROUND + 7.0, GROUND + 13.1]:
      emit((low + high) / 2, y, high - low, 0.22, 0xC1A176, out=0.12, depth=0.22)
    return rows
  bays = max(1, round(length / (3.0 if inward else 3.4)))
  pitch = length / bays
  floors = 5 if front else max(1, min(6, round((y1 - GROUND) / 4.05)))
  for floor in range(floors):
    y = GROUND + 2.15 + floor * 4.05
    for i in range(bays):
      u = low + (i + 0.5) * pitch
      w = min(pitch * 0.7, 2.7)
      h = 2.8 if floor == 0 or front or inward else 2.15
      emit(u, y, w + 0.23, h + 0.23, 0xE4E0C8, role="surround")
      emit(u, y, w, h, 0x526B69, out=0.15, role="pane")
      emit(u, y, 0.075, h, 0xC7CCB5, out=0.23)
      emit(u, y + 0.35, w, 0.075, 0xC7CCB5, out=0.23)
      emit(u, y - h / 2 - 0.12, w + 0.4, 0.13, 0xD9D2B6, out=0.20, depth=0.30)
      if inward:
        # Cream and cobalt tile bands with green inlays echo Endell's actual
        # first-court glazed fields. No photograph or sampled texture is used.
        for side in [-1, 1]:
          emit(u + side * (w / 2 + 0.24), y, 0.12, h + 0.5, 0x48688B, out=0.15)
        if floor < floors - 1:
          emit(u, y + 2.07, w, 0.76, 0xE3E0CA)
          for k in [-1, 0, 1]:
            emit(u + k * w / 3, y + 2.07, 0.34, 0.52, 0x456B8A, out=0.16)
            emit(u + k * w / 3, y + 2.07, 0.12, 0.24, 0x7F9A74, out=0.23)
    emit(
      (low + high) / 2,
      y - 1.95,
      high - low,
      0.13,
      0xA5AA91 if inward else 0xC4BBA3,
      out=0.14,
      depth=0.22,
    )
  return rows


def build() -> dict:
  osm = ET.parse(
    ROOT / "geo_data/regierungsviertel/raw/mitte-places-v163/osm-map.xml"
  ).getroot()
  tr = Transformer.from_crs(4326, 25833, always_xy=True)
  nodes = {
    n.get("id"): tr.transform(float(n.get("lon")), float(n.get("lat")))
    for n in osm.findall("node")
  }
  ways = {w.get("id"): w for w in osm.findall("way")}

  def ring(k):
    return [
      (
        round(nodes[n.get("ref")][0] - 389500, 3),
        round(5820000 - nodes[n.get("ref")][1], 3),
      )
      for n in ways[k].findall("nd")
    ]

  passage_ids = [
    "48435239",
    "48435250",
    "48435264",
    "48435394",
    "48435427",
    "48435438",
    "48435445",
    "48435510",
    "48435514",
    "59286191",
  ]
  passages = [
    {"osmId": k, "line": ring(k), "widthM": 3.0, "heightM": 4.2} for k in passage_ids
  ]
  passage_area = unary_union(
    [LineString(v["line"]).buffer(1.5, cap_style="square") for v in passages]
  )

  def display_walls(s):
    if s["kind"] != "WallSurface":
      return [s["rings"]]
    n = normal_of(s["rings"][0])
    if abs(n[1]) > 0.02:
      return [s["rings"]]
    a, b = max(
      ((a, b) for a in s["rings"][0] for b in s["rings"][0]),
      key=lambda q: math.hypot(q[1][0] - q[0][0], q[1][2] - q[0][2]),
    )
    base = np.array(a)
    d = np.array([b[0] - a[0], 0, b[2] - a[2]])
    length = np.linalg.norm(d)
    if length < 0.01:
      return [s["rings"]]
    d /= length
    local = [
      [(float(np.dot(np.subtract(q, base), d)), q[1]) for q in r] for r in s["rings"]
    ]
    poly = Polygon(local[0], local[1:])
    cross = LineString([(a[0], a[2]), (b[0], b[2])]).intersection(passage_area)
    for line in getattr(cross, "geoms", [cross]):
      if line.geom_type != "LineString" or line.length < 0.01:
        continue
      us = [float(np.dot(np.array([x, 0, z]) - base, d)) for x, z in line.coords]
      poly = poly.difference(box(min(us), GROUND - 1, max(us), GROUND + 4.2))
    result = []
    for q in getattr(poly, "geoms", [poly]):
      if q.geom_type != "Polygon" or q.area < 0.001:
        continue
      result.append(
        [
          [
            [
              round(float(base[0] + d[0] * u), 3),
              round(y, 3),
              round(float(base[2] + d[2] * u), 3),
            ]
            for u, y in list(r.coords)[:-1]
          ]
          for r in [q.exterior, *q.interiors]
        ]
      )
    return result

  parents = []
  parts = []
  surfaces = []
  details = []
  blocks = {}
  for pid in COURTS + STATION:
    station = pid in STATION
    offset = GROUND - (4.434 if station else 4.205)
    e = extract_parent(ARCHIVE, pid)
    raw = [part_profile(p) for p in leaf_building_parts(e) or [e]]
    parents.append(
      {
        "id": pid,
        "kind": "station" if station else "courts",
        "sourceParts": raw,
        "displayOffsetY": round(offset, 3),
      }
    )
    for p0 in raw:
      p = json.loads(json.dumps(p0))
      p["ground_y_m"] = round(p["ground_y_m"] + offset, 3)
      p["top_y_m"] = round(p["top_y_m"] + offset, 3)
      p["parentId"] = pid
      p["kind"] = "station" if station else "courts"
      for s in p["surfaces"]:
        for ring in s["rings"]:
          for q in ring:
            q[1] = round(q[1] + offset, 3)
      parts.append(p)
      for s in p["surfaces"]:
        roof = s["kind"] == "RoofSurface"
        color = (
          (0x68746C if roof else 0xB68D62)
          if station
          else (
            0x547C65
            if roof and pid.endswith("09PF")
            else 0x73685D
            if roof
            else 0xE0D7B5
            if pid.endswith("09PF")
            else 0xCFC5AC
          )
        )
        display = display_walls(s) if not station else [s["rings"]]
        ts = [t for rings in display for t in triangles_for(rings)]
        surfaces.append(
          {"partId": p["id"], "kind": s["kind"], "color": color, "triangles": ts}
        )
        if not roof:
          for rings in display:
            details.extend(decoration(rings, station, pid))
        # Offline surface-only cubes; no filled hidden volume or runtime voxelisation.
        for tri in ts:
          a, b, c = map(np.array, tri)
          steps = max(
            1,
            math.ceil(
              max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
              / 1.2
            ),
          )
          for i in range(steps + 1):
            for j in range(steps + 1 - i):
              q = a + (b - a) * i / steps + (c - a) * j / steps
              cell = (
                math.floor(q[0] / 2),
                math.floor((q[1] - GROUND) / 2),
                math.floor(q[2] / 2),
              )
              if (
                not station
                and GROUND + cell[1] * 2 + 1 < GROUND + 4.2
                and passage_area.buffer(0.65).covers(
                  Point(cell[0] * 2 + 1, cell[2] * 2 + 1)
                )
              ):
                continue
              if roof or cell not in blocks:
                blocks[cell] = [
                  cell[0] * 2 + 1,
                  round(GROUND + cell[1] * 2 + 1, 3),
                  cell[2] * 2 + 1,
                  color,
                ]
  for x, y, z, w, h, dep, yaw, color, role in details:
    if role != "pane":
      continue
    for u in np.arange(-w / 2 + 0.2, w / 2, 0.7):
      for v in np.arange(-h / 2 + 0.2, h / 2, 0.7):
        cell = (
          math.floor((x + math.cos(yaw) * u) / 2),
          math.floor((y + v - GROUND) / 2),
          math.floor((z - math.sin(yaw) * u) / 2),
        )
        if cell in blocks:
          cx, cy, cz, _ = blocks[cell]
          along = (cx - x) * math.cos(yaw) - (cz - z) * math.sin(yaw)
          if abs(along) < w / 2 and abs(cy - y) < h / 2:
            blocks[cell][3] = color
  old = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  # Mapped pedestrian plaza and open court ground, never a square blanket.
  osm = ET.parse(
    ROOT / "geo_data/regierungsviertel/raw/mitte-places-v163/osm-map.xml"
  ).getroot()
  tr = Transformer.from_crs(4326, 25833, always_xy=True)
  nodes = {
    n.get("id"): tr.transform(float(n.get("lon")), float(n.get("lat")))
    for n in osm.findall("node")
  }
  ways = {w.get("id"): w for w in osm.findall("way")}

  def ring(k):
    return [
      (
        round(nodes[n.get("ref")][0] - 389500, 3),
        round(5820000 - nodes[n.get("ref")][1], 3),
      )
      for n in ways[k].findall("nd")
    ]

  court = Polygon(ring("337201828")).difference(
    unary_union(
      [Polygon(p["ring"], p["holes"]) for p in parts if p["kind"] == "courts"]
    )
  )
  court = court.union(passage_area.intersection(Polygon(ring("337201828"))))
  market = Polygon(
    ring("182814027"),
    [
      ring(k)
      for k in [
        "410287390",
        "410287391",
        "1073273822",
        "1073273823",
        "1073273825",
        "1073273826",
      ]
    ],
  )
  paving = []
  for name, shape in [("courts", court), ("market", market)]:
    for q in getattr(shape, "geoms", [shape]):
      if q.area < 1:
        continue
      paving.append(
        {
          "kind": name,
          "ring": list(q.exterior.coords)[:-1],
          "holes": [list(h.coords)[:-1] for h in q.interiors],
        }
      )
  return {
    "schemaVersion": 1,
    "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5820.zip",
    "sourceSha256": hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
    "license": "dl-de/zero-2-0",
    "groundY": GROUND,
    "parents": parents,
    "parts": parts,
    "surfaces": surfaces,
    "facadeBoxes": details,
    "nativeBlocks": list(blocks.values()),
    "legacyPrisms": [p for p in old if p["id"] in LEGACY],
    "paving": paving,
    "passages": passages,
    "detailStatus": "Official source geometry retained, rigid datum translation only. Photo-proportioned glazed tile fields, window subdivisions and brick courses are display estimates; all source courts remain open. Eight historical courts form the mapped complex, not eight invented square holes.",
  }


def main():
  p = build()
  DEST.write_text(json.dumps(p, separators=(",", ":")) + "\n")
  nav = {
    "parts": [
      {k: v for k, v in part.items() if k != "surfaces"} for part in p["parts"]
    ],
    "legacyPrisms": p["legacyPrisms"],
    "passages": p["passages"],
    "roofTriangles": [
      t for s in p["surfaces"] if s["kind"] == "RoofSurface" for t in s["triangles"]
    ],
  }
  roofs = {}
  for x, y, z, c in p["nativeBlocks"]:
    roofs[x, z] = max(roofs.get((x, z), -100), y + 1)
  nav["nativeRoofCells"] = [[x, z, y] for (x, z), y in roofs.items()]
  DEST.with_name("hackescherMarktV163Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(
    {
      k: len(p[k])
      for k in ["parents", "parts", "surfaces", "facadeBoxes", "nativeBlocks"]
    },
    "bytes",
    DEST.stat().st_size,
  )


if __name__ == "__main__":
  main()
