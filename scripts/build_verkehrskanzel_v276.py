"""Source-bound open pavilion and estimated historic traffic-control cabin."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_tiergarten_werkhof_v275 import roof_at

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/verkehrskanzel-v276-source.json.gz"
OUT = ROOT / "src/app/src/data/verkehrskanzelV276.json"
SHIFT = 0.652


def build():
  """Retain all source faces in evidence and build both full-detail modes."""
  raw = SOURCE.read_bytes()
  source = json.loads(gzip.decompress(raw))
  points, tones, drawn, native, solids, roles = [], [], [], [], [], []
  native_cabin = []
  native_fit_receipts = []
  native_cabin_frame_receipts = []

  def tris(rows, color):
    for t in rows:
      points.extend(t)
      tones.append(color)

  def prism(ring, lo, hi, color):
    tris(triangles_for([[[x, hi, z] for x, z in ring]]), color)
    for a, b in zip(ring, ring[1:] + ring[:1]):
      tris(
        triangles_for(
          [[[*a[:1], lo, a[1]], [*b[:1], lo, b[1]], [b[0], hi, b[1]], [a[0], hi, a[1]]]]
        ),
        color,
      )

  def rect(x, y, z, w, h, d, color, yaw=0, role="fitting"):
    drawn.append([x, y, z, w, h, d, yaw, color])
    roles.append(role)
    # The drawn cabin leans outward. Its native walls instead occupy the
    # vertical upper-ring cell shell; generate those posts against that shell
    # below, rather than burying the drawn lower-ring posts inside the glass.
    if role == "cabin-frame":
      return
    first_native = len(native)
    # Native fittings are independently axis-aligned small boxes, never rotated.
    if abs(yaw) < 1e-10:
      native.append([x, y, z, w, h, d, 0, color])
    else:
      p = Polygon(
        [
          (
            x + math.cos(yaw) * u + math.sin(yaw) * v,
            z - math.sin(yaw) * u + math.cos(yaw) * v,
          )
          for u, v in [
            (-w / 2, -d / 2),
            (w / 2, -d / 2),
            (w / 2, d / 2),
            (-w / 2, d / 2),
          ]
        ]
      )
      for ix in range(math.floor(p.bounds[0] * 8), math.ceil(p.bounds[2] * 8)):
        for iz in range(math.floor(p.bounds[1] * 8), math.ceil(p.bounds[3] * 8)):
          if (
            p.intersection(box(ix / 8, iz / 8, (ix + 1) / 8, (iz + 1) / 8)).area > 0.001
          ):
            native.append(
              [(ix + 0.5) / 8, y, (iz + 0.5) / 8, 0.125, h, 0.125, 0, color]
            )
    if role.startswith("kiosk-"):
      occupied = unary_union(
        [box(x, z, x + 1, z + 1) for x, z, _ in solids[0]["nativeCells"]]
      )
      for row in native[first_native:]:
        original = list(row)
        steps = 0
        while (
          occupied.intersection(
            box(
              row[0] - row[3] / 2,
              row[2] - row[5] / 2,
              row[0] + row[3] / 2,
              row[2] + row[5] / 2,
            )
          ).area
          > 1e-8
        ):
          row[0] += nx * 0.0625
          row[2] += nz * 0.0625
          steps += 1
          assert steps <= 28, "Native kiosk fitting failed bounded facade fit"
        native_fit_receipts.append(
          {
            "role": role,
            "original": original,
            "rendered": list(row),
            "offset": steps * 0.0625,
          }
        )

  for parent in source["parents"]:
    part = parent["parts"][0]
    canopy = parent["id"].endswith("2cND")
    poly = Polygon(part["ring"], part["holes"])
    roof = []
    for s in part["surfaces"]:
      rings = [[[x, y + SHIFT, z] for x, y, z in r] for r in s["rings"]]
      t = triangles_for(rings)
      if s["kind"] == "RoofSurface":
        roof.extend(t)
        tris(t, 0xC2C3B4)
      elif not canopy:
        tris(t, 0x364F4B)
    lo = part["ground_y_m"] + SHIFT
    hi = part["top_y_m"] + SHIFT
    if canopy:
      # Thin edge and underside preserve the entire measured fan-shaped roof.
      for a, b in zip(part["ring"], part["ring"][1:] + part["ring"][:1]):
        ya = roof_at(roof, *a) or hi
        yb = roof_at(roof, *b) or hi
        tris(
          triangles_for(
            [
              [
                [a[0], ya, a[1]],
                [b[0], yb, b[1]],
                [b[0], yb - 0.18, b[1]],
                [a[0], ya - 0.18, a[1]],
              ]
            ]
          ),
          0xDDDCCF,
        )
      tris([[[x, y - 0.18, z] for x, y, z in t] for t in roof], 0xD2D1C4)
    cells = []
    for x in range(math.floor(poly.bounds[0]), math.ceil(poly.bounds[2])):
      for z in range(math.floor(poly.bounds[1]), math.ceil(poly.bounds[3])):
        if not poly.covers(Point(x + 0.5, z + 0.5)):
          continue
        top = roof_at(roof, x + 0.5, z + 0.5)
        if top is None:
          continue
        bottom = top - 0.20 if canopy else lo
        native.append(
          [
            x + 0.5,
            (bottom + top) / 2,
            z + 0.5,
            1,
            top - bottom,
            1,
            0,
            0xC2C3B4 if canopy else 0x364F4B,
          ]
        )
        cells.append([x, z, top])
    ns = unary_union([box(x, z, x + 1, z + 1) for x, z, _ in cells])
    solids.append(
      {
        "sourceId": "09164073" if canopy else "88847139",
        "ring": part["ring"],
        "holes": part["holes"],
        "minY": hi - 0.2 if canopy else lo,
        "maxY": hi,
        "roofTriangles": roof,
        "nativeCells": cells,
        "openCanopy": canopy,
        "nativeRing": list(ns.exterior.coords)[:-1],
        "nativeHoles": [list(r.coords)[:-1] for r in ns.interiors],
      }
    )
  # Cabin points follow the small mapped projecting step on way709164073.
  # Dimensions above the roof and the outward-leaning glazing are visual estimates.
  center = (-2784.70, 1651.15)
  yaw = -0.54

  def xy(u, v):
    return [
      center[0] + math.cos(yaw) * u + math.sin(yaw) * v,
      center[1] - math.sin(yaw) * u + math.cos(yaw) * v,
    ]

  lower = [
    xy(u, v) for u, v in [(-1.35, -0.85), (1.35, -0.85), (1.35, 0.85), (-1.35, 0.85)]
  ]
  upper = [
    xy(u, v) for u, v in [(-1.62, -1.02), (1.62, -1.02), (1.62, 1.02), (-1.62, 1.02)]
  ]
  floor, roofY = 9.30, 11.75
  prism(lower, floor - 0.16, floor, 0xD1CEC0)
  prism(upper, roofY, roofY + 0.14, 0xC8C7B9)
  for i in range(4):
    a, b = lower[i], lower[(i + 1) % 4]
    aa, bb = upper[i], upper[(i + 1) % 4]
    tris(
      triangles_for(
        [
          [
            [*a[:1], floor, a[1]],
            [b[0], floor, b[1]],
            [bb[0], roofY, bb[1]],
            [aa[0], roofY, aa[1]],
          ]
        ]
      ),
      0x749A9D,
    )
    # Render each slender outward-leaning frame as a small exact quad prism.
    for t in [0, 0.25, 0.5, 0.75, 1]:
      p = [a[j] + (b[j] - a[j]) * t for j in range(2)]
      q = [aa[j] + (bb[j] - aa[j]) * t for j in range(2)]
      for h in range(10):
        f = (h + 0.5) / 10
        rect(
          p[0] + (q[0] - p[0]) * f,
          floor + (roofY - floor) * f,
          p[1] + (q[1] - p[1]) * f,
          0.055,
          (roofY - floor) / 10,
          0.055,
          0xDEDCCD,
          role="cabin-frame",
        )
  # Independent orthogonal shell grid, including true empty cabin interior.
  for ring, y, h, color, wall in [
    (lower, floor - 0.16, 0.16, 0xD1CEC0, False),
    (upper, roofY, 0.14, 0xC8C7B9, False),
    (upper, floor, roofY - floor, 0x749A9D, True),
  ]:
    p = Polygon(ring)
    for ix in range(math.floor(p.bounds[0] * 4), math.ceil(p.bounds[2] * 4)):
      for iz in range(math.floor(p.bounds[1] * 4), math.ceil(p.bounds[3] * 4)):
        pt = Point((ix + 0.5) / 4, (iz + 0.5) / 4)
        if p.covers(pt) and (not wall or p.boundary.distance(pt) < 0.22):
          row = [pt.x, y + h / 2, pt.y, 0.25, h, 0.25, 0, color]
          native.append(row)
          native_cabin.append(row)
  # Native posts follow the actual vertical quarter-metre glass-wall cells.
  # Fit against those cells only: the separate horizontal roof/head plate is
  # not a substitute for visible full-height window posts. A small explicit
  # gap survives Float32 conversion; no glass, floor or roof cell is moved.
  glass_cells = unary_union(
    [
      box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)
      for x, _, z, w, _, d, _, color in native_cabin
      if color == 0x749A9D
    ]
  )
  clearance = glass_cells.buffer(0.015625)
  cabin_polygon = Polygon(upper)
  for face in range(4):
    a, b = upper[face], upper[(face + 1) % 4]
    length = math.dist(a, b)
    out_x, out_z = (b[1] - a[1]) / length, -(b[0] - a[0]) / length
    mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
    if cabin_polygon.covers(Point(mid[0] + out_x * 0.3, mid[1] + out_z * 0.3)):
      out_x, out_z = -out_x, -out_z
    for t in [0, 0.25, 0.5, 0.75, 1]:
      original = [a[j] + (b[j] - a[j]) * t for j in range(2)]
      steps = 1
      while True:
        offset = steps * 0.03125
        x = original[0] + out_x * offset
        z = original[1] + out_z * offset
        if (
          clearance.intersection(
            box(x - 0.0275, z - 0.0275, x + 0.0275, z + 0.0275)
          ).area
          < 1e-10
        ):
          break
        steps += 1
        assert steps <= 16, "Native cabin frame failed bounded glass-cell fit"
      indices = []
      for h in range(10):
        f = (h + 0.5) / 10
        indices.append(len(native))
        native.append(
          [
            x,
            floor + (roofY - floor) * f,
            z,
            0.055,
            (roofY - floor) / 10,
            0.055,
            0,
            0xDEDCCD,
          ]
        )
      native_cabin_frame_receipts.append(
        {
          "face": face,
          "fraction": t,
          "upperRingPoint": original,
          "outwardNormal": [out_x, out_z],
          "offset": offset,
          "nativeIndices": indices,
        }
      )
  # Solid concrete pillar at the projection, with a narrow non-working desk above.
  rect(center[0], 7.25, center[1], 0.56, 4.10, 0.56, 0xC8C5B8, role="cabin-support")
  desk = xy(0, -0.50)
  rect(desk[0], 9.98, desk[1], 1.75, 0.12, 0.36, 0x525952, yaw, role="historic-desk")
  for x, z in [(-2795, 1660), (-2790, 1664)]:
    assert poly.covers(Point(x, z))
    top = (roof_at(roof, x, z) or 8.67) - 0.18
    rect(x, (5.2 + top) / 2, z, 0.10, top - 5.2, 0.10, 0x303D38, role="canopy-support")
  # Kiosk's small serving window and ribbed lower panel: estimates on its NE face.
  a, b = (-2788.592, 1650.499), (-2786.194, 1652.217)
  length = math.dist(a, b)
  nx, nz = (b[1] - a[1]) / length, -(b[0] - a[0]) / length
  a = [a[0] + nx * 0.09, a[1] + nz * 0.09]
  b = [b[0] + nx * 0.09, b[1] + nz * 0.09]
  length = math.dist(a, b)
  angle = math.atan2(-(b[1] - a[1]), b[0] - a[0])
  cx, cz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
  rect(cx, 6.97, cz, length, 1.6, 0.10, 0x8BA0A0, angle, "kiosk-window")
  for i in range(16):
    t = (i + 0.5) / 16
    rect(
      a[0] + (b[0] - a[0]) * t,
      5.82,
      a[1] + (b[1] - a[1]) * t,
      0.055,
      1.0,
      0.055,
      0xB9BDAF,
      role="kiosk-rib",
    )
  rect(
    center[0] - 0.36,
    6.75,
    center[1] - 0.30,
    0.35,
    0.25,
    0.035,
    0x6F7980,
    yaw,
    "heritage-plaque",
  )

  def pack(rows, dtype):
    return base64.b64encode(np.asarray(rows, dtype=dtype).tobytes()).decode()

  return {
    "schemaVersion": 1,
    "sourceSha256": hashlib.sha256(raw).hexdigest(),
    "parts": solids,
    "drawnPositions": pack(points, "<f4"),
    "drawnColors": pack(tones, "<u4"),
    "drawnDetails": pack(drawn, "<f4"),
    "nativeDetails": pack(native, "<f4"),
    "roles": roles,
    "posts": [
      r
      for r, role in zip(drawn, roles, strict=True)
      if role in {"canopy-support", "cabin-support"}
    ],
    "nativeCabinBoxes": native_cabin,
    "nativeFittingReceipts": native_fit_receipts,
    "nativeCabinFrameReceipts": native_cabin_frame_receipts,
    "cabin": {
      "ring": upper,
      "minY": floor - 0.16,
      "maxY": roofY + 0.14,
      "locationStatus": "OSM projecting canopy step, estimated cabin dimensions",
    },
    "counts": {
      "triangles": len(tones),
      "drawnBoxes": len(drawn),
      "nativeBoxes": len(native),
    },
  }


if __name__ == "__main__":
  data = build()
  OUT.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  print(data["counts"])
