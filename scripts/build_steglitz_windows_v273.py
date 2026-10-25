"""Finish the school photo window style on exactly identified old facade rows.

The measured school, v250 street/Aula/hall and v251 courtyard/modern facade
remain intact. This is the omitted old-side register, not another school shell.
"""

from __future__ import annotations

import json
import math

import numpy as np
from build_steglitz_school_v250 import (
  BRICK,
  CREAM,
  DARK,
  DATA,
  GEO,
  GLASS,
  GREEN,
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
from shapely.geometry import LineString, box

OUT = DATA / "steglitzWindowsV273.json"
EVIDENCE = GEO / "steglitz-windows-v273-evidence.json"
# Complete old east/front and courtyard-wing family, separated from the modern
# west wing and its round annex by the retained source part identities. The
# previous photo models already identify its Aula, clock and long side wings.
HISTORIC_PARTS = {
  "DEBE3Dr2NXbZSQfU",
  "DEBE3DE7hShD6utU",
  "DEBE3DUK6uFxnG51",
  "DEBE3DaafYxEtad7",
  "DEBE3DpDtepJDvCZ",
  "DEBE3DarKG4lBMOJ",
  "DEBE3DAlOSLgfAi1",
  "DEBE3DdEah9BJP4k",
  "DEBE3Ddj5cX7Y4kL",
  "DEBE3Dp3ftvZptzb",
  "DEBE3DgtLFRQrT77",
}
# The owner's second street photo shows this terminal return beside the long
# Heesestraße facade as blank brickwork with bands; it is not a window grid.
BLANK_END = "DEBE3DdEah9BJP4k/0"
FLOORS = [9.25, 14.85, 19.75]


def inventory():
  source = read(DATA / "steglitzV182Source.json")
  native = read(DATA / "steglitzV182Native.json")["boxes"]
  v250 = read(DATA / "steglitzSchoolV250.json")
  v251 = read(DATA / "steglitzCourtyardV251.json")
  previous = set(v250["remove"]["v182.boxes"]) | set(v251["removeSourceBoxes"])
  archive = GEO / "raw/lod2/LoD2_386_5813.zip"
  parts = [
    part_profile(p) for p in leaf_building_parts(extract_parent(archive, SCHOOL))
  ]
  offset = 3.55 - min(p["ground_y_m"] for p in parts)
  faces, audit = [], []
  for part in parts:
    for index, sheet in enumerate(part["surfaces"]):
      if sheet["kind"] != "WallSurface":
        continue
      key = f"{part['id']}/{index}"
      rings = [
        [[p[0], round(p[1] + offset, 3), p[2]] for p in ring] for ring in sheet["rings"]
      ]
      face = Front(rings, normal_of(rings[0]).tolist(), key, native)
      old = [i for i, r in enumerate(source["boxes"]) if face.owns(r, 0.20)]
      remaining = [i for i in old if i not in previous]
      historic = part["id"] in HISTORIC_PARTS
      reason = (
        "modern part retained"
        if not historic
        else "previous complete photo facade retained"
        if old and not remaining
        else "no older window estimate on this measured sheet"
        if not remaining
        else "photo blank terminal return"
        if key == BLANK_END
        else "remaining old window register replaced"
      )
      audit.append(
        {
          "key": key,
          "historic": historic,
          "reason": reason,
          "oldRows": old,
          "remainingRows": remaining,
          "selected": historic and bool(remaining),
        }
      )
      if historic and remaining:
        # Every replacement is one of the exact original procedural pane/sill
        # pairs. A foreign fitting or changed estimate invalidates generation.
        assert all(source["boxes"][i][-1] in {0x51666A, 0xDDD4BF} for i in remaining)
        faces.append((face, remaining))
  return source, native, v250, v251, parts, faces, audit, offset


def build():
  source, native, v250, v251, parts, faces, audit, offset = inventory()
  drawn, rods, blocks, ranges = [], [], [], []

  def member(f, u, y, w, h, color, out=0.22, depth=0.06):
    if not f.wall.buffer(0.001).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
      return
    drawn.append([*f.point(u, y, out), w, h, depth, f.yaw, color])
    f.native_member(blocks, u, y, w, h, color, out)

  def stroke(f, a, b, color, width=0.085):
    if not f.wall.buffer(0.001).covers(
      LineString([a, b]).buffer(width / 2, cap_style=2)
    ):
      return
    rods.append([*f.point(*a, 0.29), *f.point(*b, 0.29), width, color])
    n = max(1, math.ceil(math.dist(a, b) / 0.24))
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

  def arc(f, u, y, w, rise, color, width):
    pts = [
      (u + w / 2 * math.cos(math.pi * i / 6), y + rise * math.sin(math.pi * i / 6))
      for i in range(7)
    ]
    for a, b in zip(pts, pts[1:]):
      stroke(f, a, b, color, width)

  def window(f, u, y):
    # Tall two-leaf opening, upper transom and an actual segmental upper light.
    # The three narrow upper strips are glazing, never a box across its arch.
    w, h, rise = 1.48, 3.15, 0.25
    spring = y + h / 2 - rise
    bottom = y - h / 2
    member(f, u, (bottom + spring) / 2, w, spring - bottom, GLASS, 0.14)
    for i in range(3):
      yy = rise * (i + 0.5) / 3
      half = w / 2 * math.sqrt(1 - (yy / rise) ** 2)
      member(f, u, spring + yy, half * 2, rise / 3 + 0.01, GLASS, 0.14)
    for dx in [-w / 2, 0, w / 2]:
      member(f, u + dx, (bottom + spring) / 2, 0.075, spring - bottom, CREAM, 0.25)
    for yy in [bottom, y + 0.43]:
      member(f, u, yy, w + 0.08, 0.085, CREAM, 0.25)
    arc(f, u, spring, w, rise, CREAM, 0.085)
    arc(f, u, spring + 0.08, w + 0.28, rise + 0.10, DARK, 0.13)
    member(f, u, bottom - 0.12, w + 0.28, 0.13, DARK, 0.23)

  for f, old in faces:
    start = [len(drawn), len(rods), len(blocks)]
    # Keep the retained lateral bay placement. Only the proved wrong vertical
    # five-storey repeat yields to the three photographed historic registers.
    centers = sorted(
      {
        round(float((np.asarray(source["boxes"][i][:3]) - f.a) @ f.d), 3)
        for i in old
        if source["boxes"][i][-1] == 0x51666A
      }
    )
    windows = []
    if f.key != BLANK_END:
      for u in centers:
        for y in FLOORS:
          if f.wall.buffer(-0.1).covers(box(u - 0.95, y - 1.8, u + 0.95, y + 1.8)):
            window(f, u, y)
            windows.append([u, y])
        member(f, u, 4.62, 0.94, 1.0, DARK, 0.14)
        arc(f, u, 5.12, 1.08, 0.19, DARK, 0.11)
        member(f, u, 4.62, 0.055, 0.96, CREAM, 0.25)
      # The observed pale-green/cream diamond course above the middle floor.
      for u in centers:
        if not any(abs(v - u) < 0.001 and y == FLOORS[-1] for v, y in windows):
          continue
        member(f, u, 17.25, 2.0, 0.54, GREEN, 0.14)
        for c in [-0.62, 0, 0.62]:
          pts = [
            (u + c - 0.23, 17.25),
            (u + c, 17.47),
            (u + c + 0.23, 17.25),
            (u + c, 17.03),
          ]
          for a, b in zip(pts, pts[1:] + pts[:1]):
            stroke(f, a, b, CREAM, 0.055)
    else:
      member(f, f.length / 2, 17.25, f.length - 1.2, 0.55, GREEN, 0.14)
      for u in np.arange(0.9, f.length - 0.7, 0.64):
        pts = [(u - 0.22, 17.25), (u, 17.47), (u + 0.22, 17.25), (u, 17.03)]
        for a, b in zip(pts, pts[1:] + pts[:1]):
          stroke(f, a, b, CREAM, 0.055)
      for y in [7.0, 8.25, 9.5, 10.75]:
        member(f, f.length / 2, y, f.length - 0.18, 0.12, DARK, 0.17)
    for y in [6.2, 11.85, 12.1, 21.85]:
      member(f, f.length / 2, y, f.length - 0.18, 0.12, DARK, 0.17)
    ranges.append(
      {
        "key": f.key,
        "rings": f.rings,
        "normal": f.n.tolist(),
        "oldRows": old,
        "boxes": [start[0], len(drawn)],
        "rods": [start[1], len(rods)],
        "nativeBeforeMerge": [start[2], len(blocks)],
        "windows": windows,
        "blankEnd": f.key == BLANK_END,
      }
    )
  surface_colors = []
  for i, sheet in enumerate(source["surfaces"]):
    if (
      sheet["owner"] == SCHOOL
      and sheet["color"] == 0xB9896C
      and any(
        all(f.owns(p, 0.02) for tri in sheet["triangles"] for p in tri)
        for f, _ in faces
      )
    ):
      surface_colors.append([i, BRICK])
  protected_native = {r[0] for data in [v250, v251] for r in data["nativeColors"]}
  native_colors = [
    [i, BRICK]
    for i, r in enumerate(native)
    if i not in protected_native
    and r[-1] in {0x51666A, 0xDDD4BF, 0xB9896C}
    and any(f.owns(r, 1.15) for f, _ in faces)
  ]

  def rounded(rows):
    return [[round(float(v), 4) for v in r[:-1]] + [int(r[-1])] for r in rows]

  drawn, rods = rounded(drawn), rounded(rods)
  blocks = merge_boxes(rounded(blocks))
  # Exact native support cuts occasionally create sub-centimetre ornament
  # splinters. They cannot survive centimetre encoding as positive boxes.
  # This filters only NEW fittings, never any original occupied source cell.
  splinters = sum(any(round(v * 100) <= 0 for v in r[3:6]) for r in blocks)
  blocks = [r for r in blocks if all(round(v * 100) > 0 for v in r[3:6])]
  origin = [-3240, 0, 6820]
  palette = sorted({r[-1] for rows in [drawn, rods, blocks] for r in rows})

  def encode(rows, rod=False):
    result = []
    for row in rows:
      r = list(row)
      for j in range(6 if rod else 3):
        r[j] -= origin[j % 3]
      for j in range(7 if rod else 6):
        r[j] = round(r[j] * 100)
      if not rod and len(r) == 8:
        r[6] = round(r[6] * 10000)
      r[-1] = palette.index(r[-1])
      result.append(r)
    return result

  fingerprints = {
    "sourceBoxes": fingerprint(source["boxes"]),
    "sourceSurfaces": fingerprint(source["surfaces"]),
    "nativeRows": fingerprint(native),
    "v250": fingerprint(v250),
    "v251": fingerprint(v251),
  }
  model = {
    "version": 273,
    "owner": SCHOOL,
    "origin": origin,
    "palette": palette,
    "boxes": encode(drawn),
    "rods": encode(rods, True),
    "nativeRows": encode(blocks),
    "removeSourceBoxes": sorted({i for _, old in faces for i in old}),
    "surfaceColors": surface_colors,
    "nativeColors": native_colors,
    "fingerprints": fingerprints,
    "counts": {
      "auditedParts": len(parts),
      "historicParts": len(HISTORIC_PARTS),
      "correctedFaces": len(faces),
      "replacedOldRows": sum(len(old) for _, old in faces),
      "tallWindows": sum(len(r["windows"]) for r in ranges),
      "blankEndWalls": 1,
      "boxes": len(drawn),
      "rods": len(rods),
      "native": len(blocks),
    },
  }
  evidence = {
    "version": 273,
    "owner": SCHOOL,
    "terrainOffsetY": round(offset, 3),
    "archiveSha256": sha(GEO / "raw/lod2/LoD2_386_5813.zip"),
    "sourceSha256": {
      str((DATA / name).relative_to(ROOT)): sha(DATA / name)
      for name in [
        "steglitzV182Source.json",
        "steglitzV182Native.json",
        "steglitzV182Navigation.json",
        "steglitzSchoolV250.json",
        "steglitzCourtyardV251.json",
        "steglitzCourtGroundV251.json",
        "schoolsPlacesV205.json",
      ]
    },
    "allWallSheets": audit,
    "historicParts": sorted(HISTORIC_PARTS),
    "protectedModernParts": sorted(
      p["id"] for p in parts if p["id"] not in HISTORIC_PARTS
    ),
    "faces": ranges,
    "counts": model["counts"],
    "omittedSubCentimetreDetailSplinters": splinters,
    "fingerprints": fingerprints,
    "policy": "Replace only remaining obsolete Altbau pane/sill estimates. Complete source geometry, roof shapes, court, hall and earlier photo facades retained. Lateral unphotographed bay counts remain display estimates. No photographs or textures ship. Native details are built independently against the complete retained orthogonal outer support cells.",
    "references": [
      {
        "source": "Owner street photos BBA9F225-1033-4902-9EEA-019F872FA338 images1–4",
        "use": "Three tall white-framed segmental window registers, basement, dark brick courses, pale green/cream diamond spandrels; image2 blank Heesestraße terminal return. The established main Aula remains v250.",
      },
      {
        "source": "Owner courtyard photos 62908D5D-235A-461D-AD29-0109F5E52649 images1–5",
        "use": "Confirms matching historic wing window style and separate modern bands; Aula/clock/hall/modern reference details remain v250/v251 unchanged.",
      },
    ],
    "cameras": {
      "outerWing": {"eye": [-3230, 14, 6879], "target": [-3230, 14, 6853]},
      "terminalReturn": {"eye": [-3179, 15, 6775], "target": [-3205, 15, 6785]},
    },
  }
  return model, evidence


if __name__ == "__main__":
  model, evidence = build()
  OUT.write_text(json.dumps(model, separators=(",", ":")) + "\n")
  EVIDENCE.write_text(json.dumps(evidence, indent=2) + "\n")
  print(OUT.name, OUT.stat().st_size, model["counts"])
