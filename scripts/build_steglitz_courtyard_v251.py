"""Photo-led courtyard detail, keeping complete LoD2 shells and v250 fronts."""

from __future__ import annotations

import json
import math

import numpy as np
from build_steglitz_school_v250 import (
  DATA,
  GEO,
  ROOT,
  SCHOOL,
  Front,
  extract_parent,
  fingerprint,
  leaf_building_parts,
  merge_boxes,
  normal_of,
  part_profile,
  read,
  sha,
)
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

OUT = DATA / "steglitzCourtyardV251.json"
EVIDENCE = GEO / "steglitz-courtyard-v251-evidence.json"
BRICK, DARK, CREAM, GLASS, LIGHT = 0xA36750, 0x63544B, 0xE1DCCB, 0x819A9B, 0xB6C6C2
GREEN, GOLD, WHITE, ROOF = 0x849181, 0xCFB57D, 0xD9D8CC, 0xA65D45
PART = "DEBE3DaafYxEtad7"
CLOCK = "DEBE3DE7hShD6utU"
MODERN = "DEBE3DKr6xQqvvnx"
# Photographed courtyard wings; counts are restrained image estimates. The
# west end of the north wing is blank above its masonry courses, not a grid.
WINGS = {
  "DEBE3Ddj5cX7Y4kL/2": 3,
  "DEBE3DgtLFRQrT77/1": 3,
  "DEBE3DgtLFRQrT77/3": 0,
  "DEBE3DAlOSLgfAi1/3": 3,
  "DEBE3DpDtepJDvCZ/0": 7,
  "DEBE3DpDtepJDvCZ/4": 2,
  "DEBE3DarKG4lBMOJ/5": 2,
}
WING_FLOORS = [9.25, 14.85, 19.75]


def build() -> tuple[dict, dict]:
  source = read(DATA / "steglitzV182Source.json")
  native = read(DATA / "steglitzV182Native.json")["boxes"]
  archive = GEO / "raw/lod2/LoD2_386_5813.zip"
  parts = [
    part_profile(p) for p in leaf_building_parts(extract_parent(archive, SCHOOL))
  ]
  offset = 3.55 - min(p["ground_y_m"] for p in parts)
  sheets = {}
  for part in parts:
    for i, s in enumerate(part["surfaces"]):
      sheets[f"{part['id']}/{i}"] = {
        "kind": s["kind"],
        "rings": [
          [[p[0], round(p[1] + offset, 3), p[2]] for p in ring] for ring in s["rings"]
        ],
      }

  def face(key: str) -> Front:
    rings = sheets[key]["rings"]
    return Front(rings, normal_of(rings[0]).tolist(), key, native)

  rear = [face(f"{PART}/{i}") for i in [4, 8, 13]]
  # LoD2 divides the single planar clock gable at its ridge. Join only those two
  # measured coplanar halves, preserving the original projected boundary.
  g1, g2 = face(f"{CLOCK}/1"), face(f"{CLOCK}/2")
  ref = g2
  union = unary_union(
    [
      Polygon([(float((np.array(p) - ref.a) @ ref.d), p[1]) for p in f.rings[0]])
      for f in [g1, g2]
    ]
  ).convex_hull
  clock_ring = [ref.point(u, y, 0) for u, y in list(union.exterior.coords)[:-1]]
  clock = Front([clock_ring], ref.n.tolist(), f"{CLOCK}/1+2", native)
  modern = face(f"{MODERN}/0")
  # Thin joint beside the modern wing is also photographed as pale concrete.
  joint = face("DEBE3Dux27LQOga1/3")
  wings = [face(key) for key in WINGS]
  faces = rear + [clock, modern, joint] + wings
  drawn, rods, blocks, ranges = [], [], [], []

  def member(f, u, y, w, h, color, out=0.22, depth=0.06):
    if not f.wall.buffer(0.002).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
      return
    drawn.append([*f.point(u, y, out), w, h, depth, f.yaw, color])
    before = len(blocks)
    f.native_member(blocks, u, y, w, h, color, out)
    if depth > 0.2:
      for row in blocks[before:]:
        row[f.axis + 3] = depth

  def stroke(f, a, b, color=DARK, width=0.10):
    if not f.wall.buffer(0.002).covers(
      LineString([a, b]).buffer(width / 2, cap_style=2)
    ):
      return
    rods.append([*f.point(*a, 0.29), *f.point(*b, 0.29), width, color])
    length = math.dist(a, b)
    n = max(1, math.ceil(length / 0.25))
    for i in range(n):
      t = (i + 0.5) / n
      f.native_member(
        blocks,
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        width,
        0.24,
        color,
        0.29,
      )

  def arc(f, u, y, w, h, color=DARK, width=0.12, n=8):
    pts = [
      (u + w / 2 * math.cos(math.pi * i / n), y + h * math.sin(math.pi * i / n))
      for i in range(n + 1)
    ]
    for a, b in zip(pts, pts[1:]):
      stroke(f, a, b, color, width)

  def circle(f, u, y, r, color=CREAM):
    pts = [
      (u + r * math.cos(math.tau * i / 12), y + r * math.sin(math.tau * i / 12))
      for i in range(13)
    ]
    for a, b in zip(pts, pts[1:]):
      stroke(f, a, b, color, 0.11)
    member(f, u, y, r * 1.25, r * 1.25, LIGHT, 0.15)

  def window(f, u, y, w=1.38, h=3.15, head=True):
    member(f, u, y, w, h, GLASS, 0.13)
    member(f, u, y + h * 0.30, w - 0.10, h * 0.33, LIGHT, 0.17)
    for dx in [-w / 2, 0, w / 2]:
      member(f, u + dx, y, 0.07, h, CREAM, 0.24)
    for yy in [y - h / 2, y + 0.42, y + h / 2]:
      member(f, u, yy, w + 0.1, 0.08, CREAM, 0.25)
    if head:
      arc(f, u, y + h / 2 + 0.08, w + 0.27, 0.25)
    member(f, u, y - h / 2 - 0.12, w + 0.28, 0.13, DARK, 0.23)

  def diamond(f, u, y, w):
    member(f, u, y, w, 0.55, GREEN, 0.13)
    for c in np.arange(u - w / 2 + 0.3, u + w / 2 - 0.1, 0.65):
      pts = [(c - 0.2, y), (c, y + 0.2), (c + 0.2, y), (c, y - 0.2), (c - 0.2, y)]
      for a, b in zip(pts, pts[1:]):
        stroke(f, a, b, CREAM, 0.055)

  # Three real storeys replace the five/six old generic estimates on these
  # exact walls. A compact cream surround, mullion/transom and four-part
  # segmental lintel express each tall aperture without extra facade layers.
  for f in wings:
    start = [len(drawn), len(rods), len(blocks)]
    bays = WINGS[f.key]
    centers = [(i + 0.5) * f.length / bays for i in range(bays)]
    for u in centers:
      for y in WING_FLOORS:
        w, h = 1.52, 3.15
        member(f, u, y, w, h, CREAM, 0.13)
        member(f, u, y, w - 0.15, h - 0.15, GLASS, 0.19)
        member(f, u, y, 0.075, h, CREAM, 0.25)
        member(f, u, y + 0.42, w, 0.08, CREAM, 0.25)
        member(f, u, y - h / 2 - 0.12, w + 0.28, 0.13, DARK, 0.23)
        arc(f, u, y + h / 2 + 0.08, w + 0.25, 0.27, DARK, 0.12, 4)
      # Recessed basement openings and the pale/green spandrel above floor 2.
      member(f, u, 4.62, 0.94, 1.0, DARK, 0.13)
      arc(f, u, 5.12, 1.10, 0.19, DARK, 0.10, 4)
      member(f, u, 17.25, 2.1, 0.5, GREEN, 0.13)
      pts = [(u - 0.25, 17.25), (u, 17.45), (u + 0.25, 17.25), (u, 17.05)]
      for a, b in zip(pts, pts[1:] + pts[:1]):
        stroke(f, a, b, CREAM, 0.07)
    for yy in [6.2, 12.05, 21.85]:
      member(f, f.length / 2, yy, f.length - 0.18, 0.16, DARK, 0.17)
    if not bays:
      for yy in [7.0, 8.25, 9.5, 10.75]:
        member(f, f.length / 2, yy, f.length - 0.18, 0.12, DARK, 0.17)
    ranges.append(
      {
        "key": f.key,
        "boxes": [start[0], len(drawn)],
        "rods": [start[1], len(rods)],
        "nativeBeforeMerge": [start[2], len(blocks)],
        "windowBays": bays,
        "storeyCenters": WING_FLOORS if bays else [],
      }
    )

  for f in rear:
    start = [len(drawn), len(rods), len(blocks)]
    u = f.length / 2
    # Three great Aula lights: lower triplet, high curved head, round oculus.
    for dx in [-1.4, 0, 1.4]:
      window(f, u + dx, 20.55, 1.07, 3.95, False)
    arc(f, u, 22.64, 4.8, 2.6, DARK, 0.25, 10)
    arc(f, u, 22.64, 4.35, 2.3, CREAM, 0.11, 10)
    circle(f, u, 23.6, 0.82)
    for dx in [-2.45, 2.45]:
      member(f, u + dx, 24.75, 0.55, 1.62, GOLD, 0.13)
      for yy in [24.25, 25.0]:
        stroke(f, (u + dx - 0.17, yy), (u + dx, yy + 0.18), DARK, 0.08)
        stroke(f, (u + dx, yy + 0.18), (u + dx + 0.17, yy), DARK, 0.08)
    member(f, u, 25.64, 5.45, 0.25, GOLD, 0.13)
    diamond(f, u, 17.25, 4.8)
    if f is not rear[1]:
      for y in [9.25, 14.85]:
        for dx in [-1.6, 1.6]:
          window(f, u + dx, y)
      member(f, u, 6.2, f.length - 0.10, 0.16, DARK, 0.17)
      member(f, u, 12.05, f.length - 0.10, 0.22, DARK, 0.17)
    member(f, u, 26.0, f.length - 0.15, 0.20, DARK, 0.17)
    ranges.append(
      {
        "key": f.key,
        "boxes": [start[0], len(drawn)],
        "rods": [start[1], len(rods)],
        "nativeBeforeMerge": [start[2], len(blocks)],
      }
    )

  f = clock
  u = f.length / 2
  start = [len(drawn), len(rods), len(blocks)]
  # Existing lower projection: no invented building mass. Clock below ridge,
  # five small arch windows, two entrances and a stepped central fountain.
  circle(f, u, 16.05, 0.53, CREAM)
  stroke(f, (u, 16.05), (u - 0.16, 16.35), DARK, 0.065)
  stroke(f, (u, 16.05), (u + 0.24, 15.86), DARK, 0.065)
  for dx in [-2.15, -1.075, 0, 1.075, 2.15]:
    window(f, u + dx, 13.15, 0.60, 1.52, False)
    arc(f, u + dx, 13.91, 0.80, 0.42, DARK, 0.11, 6)
  for dx in [-1.0, 0, 1.0]:
    cy = 7.55 if dx else 8.15
    hh = 2.5 if dx else 3.7
    window(f, u + dx, cy, 0.74, hh, False)
    arc(f, u + dx, cy + hh / 2, 0.88, 0.55, CREAM, 0.09, 6)
  arc(f, u, 9.75, 3.2, 1.15, DARK, 0.23, 8)
  for dx in [-3.4, 3.4]:
    member(f, u + dx, 6.4, 1.48, 3.05, 0x4B4B43, 0.15)
    arc(f, u + dx, 7.94, 1.85, 1.0, DARK, 0.25, 8)
    for dy in [0.0, 0.18, 0.36]:
      member(f, u + dx, 4.7 + dy, 1.6, 0.12, 0x89877A, 0.30, 0.18)
  member(f, u, 5.9, 0.74, 1.20, CREAM, 0.25)
  member(f, u, 5.2, 1.58, 0.23, 0x9D9B8C, 0.49, 0.70)
  member(f, u, 4.6, 0.32, 0.90, 0x969381, 0.38, 0.27)
  for width, yy in [(2.3, 3.78), (1.9, 3.98)]:
    member(f, u, yy, width, 0.14, 0x858579, 0.40, 0.78)
  for yy in [5.85, 10.65, 11.05, 11.50]:
    member(f, u, yy, f.length - 0.2, 0.10, DARK, 0.17)
  # Follow both measured gable slopes, inset from the actual boundary.
  stroke(f, (0.25, 12.8), (u, 18.7), DARK, 0.14)
  stroke(f, (u, 18.7), (f.length - 0.25, 13.0), DARK, 0.14)
  ranges.append(
    {
      "key": f.key,
      "boxes": [start[0], len(drawn)],
      "rods": [start[1], len(rods)],
      "nativeBeforeMerge": [start[2], len(blocks)],
    }
  )

  start = [len(drawn), len(rods), len(blocks)]
  f = modern
  member(f, f.length / 2, 4.15, f.length - 0.1, 1.15, 0x976B56, 0.13)
  # Five full horizontal window strips, not a generic scattered window grid.
  for y in [6.2, 9.9, 13.6, 17.3, 21.0]:
    member(f, f.length / 2, y, f.length - 0.8, 2.25, GLASS, 0.13)
    for i in range(25):
      x = 0.4 + (f.length - 0.8) * i / 24
      member(f, x, y, 0.07, 2.28, 0xB8BDB7, 0.24)
    for yy in [y - 1.18, y + 1.18]:
      member(f, f.length / 2, yy, f.length - 0.65, 0.11, 0xAAADA5, 0.25)
  for yy in [8.03, 11.73, 15.43, 19.13, 23.25]:
    member(f, f.length / 2, yy, f.length - 0.1, 0.12, 0xCBCBC0, 0.18)
  ranges.append(
    {
      "key": f.key,
      "boxes": [start[0], len(drawn)],
      "rods": [start[1], len(rods)],
      "nativeBeforeMerge": [start[2], len(blocks)],
    }
  )

  removals = [
    i for i, r in enumerate(source["boxes"]) if any(f.owns(r, 0.20) for f in faces)
  ]
  colors = []
  # Exact wall matches, and exact source roof vertex membership for red tiling.
  tiled_parts = {
    PART,
    CLOCK,
    "DEBE3DAlOSLgfAi1",
    "DEBE3Ddj5cX7Y4kL",
    "DEBE3DpDtepJDvCZ",
    "DEBE3DgtLFRQrT77",
  }
  roofs = [
    s
    for k, s in sheets.items()
    if k.split("/")[0] in tiled_parts and s["kind"] == "RoofSurface"
  ]
  roof_vertices = [{tuple(p) for ring in s["rings"] for p in ring} for s in roofs]
  roof_indexes = []
  for i, s in enumerate(source["surfaces"]):
    if s["owner"] != SCHOOL:
      continue
    pts = [p for t in s["triangles"] for p in t]
    for f in faces:
      if all(f.owns(p, 0.02) for p in pts):
        colors.append([i, WHITE if f in [modern, joint] else BRICK])
        break
    else:
      if s["color"] == 0x5A625D and any(
        all(tuple(p) in vertices for p in pts) for vertices in roof_vertices
      ):
        colors.append([i, ROOF])
        roof_indexes.append(i)
  native_colors = []
  for i, r in enumerate(native):
    if r[6] not in [0xB9896C, 0x51666A, 0xDDD4BF, 0x5A625D]:
      continue
    if r[6] == 0x5A625D:
      # Retain all cells. Exact slab centres touching an audited red roof sheet
      # may be repainted, but never below the roof's lowest surveyed elevation.
      p = np.array(r[:3])
      for s in roofs:
        q = np.array(s["rings"][0])
        n = normal_of(s["rings"][0])
        if p[1] < q[:, 1].min() - 0.55:
          continue
        if abs(float((p - q[0]) @ n)) > 0.8:
          continue
        footprint = Polygon(q[:, [0, 2]])
        if footprint.is_valid and footprint.buffer(0.1).covers(
          __import__("shapely").geometry.Point(p[[0, 2]])
        ):
          native_colors.append([i, ROOF])
          break
    elif any(f.owns(r, 1.15) for f in faces):
      color = WHITE if any(f.owns(r, 1.15) for f in [modern, joint]) else BRICK
      native_colors.append([i, color])

  def rounded(rows):
    return [[round(float(v), 4) for v in r[:-1]] + [int(r[-1])] for r in rows]

  drawn, rods = rounded(drawn), rounded(rods)
  blocks = merge_boxes(rounded(blocks))
  origin = [-3240, 0, 6820]
  palette = sorted({int(r[-1]) for rows in [drawn, rods, blocks] for r in rows})

  def encode(rows, rod=False):
    result = []
    for r in rows:
      q = list(r)
      for j in range(6 if rod else 3):
        q[j] -= origin[j % 3]
      for j in range(7 if rod else 6):
        q[j] = round(q[j] * 100)
      if not rod and len(r) == 8:
        q[6] = round(q[6] * 10000)
      q[-1] = palette.index(int(r[-1]))
      result.append(q)
    return result

  receipts = {
    "sourceBoxes": fingerprint(source["boxes"]),
    "sourceSurfaces": fingerprint(source["surfaces"]),
    "nativeRows": fingerprint(native),
    "v250": fingerprint(read(DATA / "steglitzSchoolV250.json")),
  }
  model = {
    "version": 251,
    "owner": SCHOOL,
    "origin": origin,
    "palette": palette,
    "boxes": encode(drawn),
    "rods": encode(rods, True),
    "nativeRows": encode(blocks),
    "removeSourceBoxes": removals,
    "surfaceColors": colors,
    "nativeColors": native_colors,
    "fingerprints": receipts,
    "counts": {
      "boxes": len(drawn),
      "rods": len(rods),
      "native": len(blocks),
      "aulaArches": 3,
      "smallGableWindows": 5,
      "modernWindowBands": 5,
      "historicWingFloors": 3,
      "historicWingWindowBays": sum(WINGS.values()),
      "historicWingBlankEndWalls": 1,
    },
  }
  evidence = {
    "version": 251,
    "owner": SCHOOL,
    "terrainOffsetY": round(offset, 3),
    "archiveSha256": sha(archive),
    "sourceSha256": {
      str((DATA / name).relative_to(ROOT)): sha(DATA / name)
      for name in [
        "steglitzV182Source.json",
        "steglitzV182Native.json",
        "steglitzV182Navigation.json",
        "steglitzSchoolV250.json",
        "schoolsPlacesV205.json",
        "schoolCultureV228.json",
      ]
    },
    "faces": [{"key": f.key, "rings": f.rings, "normal": f.n.tolist()} for f in faces],
    "clockSourceHalves": [sheets[f"{CLOCK}/{i}"] for i in [1, 2]],
    "ranges": ranges,
    "tiledRoofIndices": roof_indexes,
    "roofSheets": roofs,
    "counts": model["counts"],
    "fingerprints": receipts,
    "policy": "Only exact photographed old detail estimates and paint yield. Every source coordinate, roof, occupied native cell and v250 feature stays. Centimetre-quantized thin local detail; aperture dimensions are photo estimates. No images or textures shipped.",
    "references": [
      {
        "source": "Owner photos 20 October 2026, 62908D5D-235A-461D-AD29-0109F5E52649 images1–5",
        "use": "Courtyard Aula, clock gable, two entry arches/fountain, red tiled roofs, historic three-storey wings with basement and blank north-wing end, and five modern window-band floors. Image3 confirms v250 hall remains.",
      },
      {
        "url": "https://rundgang.gymnasiumsteglitz.de/#g281",
        "use": "School-operated courtyard contextual reference; reference only.",
      },
    ],
    "cameras": {
      "aula": {"eye": [-3247, 14, 6824], "target": [-3217, 17, 6825]},
      "modern": {"eye": [-3247, 16, 6812], "target": [-3264, 13, 6837]},
    },
  }
  return model, evidence


if __name__ == "__main__":
  model, evidence = build()
  OUT.write_text(json.dumps(model, separators=(",", ":")) + "\n")
  EVIDENCE.write_text(json.dumps(evidence, indent=2) + "\n")
  print(
    OUT.stat().st_size,
    model["counts"],
    len(model["removeSourceBoxes"]),
    len(model["surfaceColors"]),
  )
