"""Bounded v206 Urania source correction and catalogue-constrained steel arc.

No network or full-city rebuild. The committed receipt retains all 21 LoD2
sheets; only the photographed ground-floor recess alters three street sheets.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import Point, Polygon, shape
from shapely.ops import triangulate

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/urania-arc-v206-source.json"
DEST = ROOT / "src/app/src/data/uraniaArcV206.json"
NAVIGATION = ROOT / "src/app/src/data/uraniaArcV206Navigation.json"
GROUND, SOFFIT, TOP = 5.2, 8.55, 19.935


def rounded(p):
  return [round(v, 4) for v in p]


def new_site(id_, name):
  return {"id": id_, "name": name, "triangles": [], "boxes": [], "nativeBlocks": []}


def triangle(site, points, color, kind, source_index=None):
  row = {"points": [rounded(p) for p in points], "color": color, "kind": kind}
  if source_index is not None:
    row["sourceIndex"] = source_index
  site["triangles"].append(row)


def quad(site, points, color, kind):
  triangle(site, points[:3], color, kind)
  triangle(site, [points[0], points[2], points[3]], color, kind)


def box(site, x, y, z, w, h, d, yaw, color, native=True):
  site["boxes"].append(rounded([x, y, z, w, h, d, yaw]) + [color])
  if not native:
    return
  # Axis-aligned thin surface strips, never a rotated building-sized voxel box.
  pitch = 0.2 if color in [0xEBDD16, 0xDECE20, 0x8C1D48, 0xC8C1AE] else 0.7
  count = max(1, math.ceil(w / pitch))
  tx, tz = math.cos(yaw), -math.sin(yaw)
  for i in range(count):
    u = (i + 0.5) * w / count - w / 2
    site["nativeBlocks"].append(
      rounded(
        [
          x + tx * u,
          y,
          z + tz * u,
          max(0.055, abs(tx) * w / count + abs(tz) * d),
          h,
          max(0.055, abs(tz) * w / count + abs(tx) * d),
        ]
      )
      + [color]
    )


def surface(site, ring, color, index):
  """Triangulate source in its true plane; retain exact source vertex positions."""
  horizontal = max(p[1] for p in ring) - min(p[1] for p in ring) < 0.001
  if horizontal:
    plan = Polygon([(p[0], p[2]) for p in ring])

    def to_world(p):
      return [p[0], ring[0][1], p[1]]
  else:
    a = ring[0]
    b = max(ring, key=lambda p: math.hypot(p[0] - a[0], p[2] - a[2]))
    length = math.hypot(b[0] - a[0], b[2] - a[2])
    if length < 0.00001:
      return
    tx, tz = (b[0] - a[0]) / length, (b[2] - a[2]) / length
    plan = Polygon([((p[0] - a[0]) * tx + (p[2] - a[2]) * tz, p[1]) for p in ring])

    def to_world(p):
      return [a[0] + tx * p[0], p[1], a[2] + tz * p[0]]

  for t in triangulate(plan):
    if not plan.covers(t.representative_point()):
      continue
    pts = [to_world(p) for p in list(t.exterior.coords)[:3]]
    if (
      horizontal
      and (pts[1][2] - pts[0][2]) * (pts[2][0] - pts[0][0])
      - (pts[1][0] - pts[0][0]) * (pts[2][2] - pts[0][2])
      < 0
    ):
      pts.reverse()
    # The higher roof is the exact original v188 indexed mesh in drawn mode.
    if index != 19:
      triangle(site, pts, color, "source", index)
  # These street sheets have their native surface supplied by the full glass
  # grid below. A second thicker source voxel plane would conceal its colours.
  if index in [9, 10]:
    return
  lo, bottom, hi, top = plan.bounds
  if horizontal:
    for x in range(math.floor(lo), math.ceil(hi)):
      for z in range(math.floor(bottom), math.ceil(top)):
        if plan.covers(Point(x + 0.5, z + 0.5)):
          site["nativeBlocks"].append(
            [x + 0.5, ring[0][1] - 0.045, z + 0.5, 1, 0.09, 1, color]
          )
  else:
    cols, rows = max(1, math.ceil(hi - lo)), max(1, math.ceil(top - bottom))
    for i in range(cols):
      u, width = lo + (i + 0.5) * (hi - lo) / cols, (hi - lo) / cols
      for j in range(rows):
        y, height = bottom + (j + 0.5) * (top - bottom) / rows, (top - bottom) / rows
        if not plan.covers(Point(u, y)):
          continue
        p = to_world([u, y])
        site["nativeBlocks"].append(
          rounded(p + [abs(tx) * width + 0.07, height, abs(tz) * width + 0.07])
          + [color]
        )


# Small original monoline glyphs: preserve the photographed case, no font/texture.
GLYPHS = {
  "U": [[(0, 1), (0, 0.2), (0.12, 0), (0.48, 0), (0.6, 0.2), (0.6, 1)]],
  "B": [
    [(0, 0), (0, 1), (0.4, 1), (0.6, 0.85), (0.6, 0.65), (0.4, 0.5), (0, 0.5)],
    [(0.4, 0.5), (0.6, 0.35), (0.6, 0.15), (0.4, 0), (0, 0)],
  ],
  "D": [[(0, 0), (0, 1), (0.3, 1), (0.6, 0.8), (0.6, 0.2), (0.3, 0), (0, 0)]],
  "a": [
    [(0.55, 0), (0.55, 0.65), (0.15, 0.65), (0, 0.5), (0, 0.15), (0.15, 0), (0.55, 0)]
  ],
  "r": [[(0, 0), (0, 0.65)], [(0, 0.45), (0.2, 0.65), (0.45, 0.65)]],
  "n": [
    [(0, 0), (0, 0.65)],
    [(0, 0.45), (0.2, 0.65), (0.4, 0.65), (0.55, 0.45), (0.55, 0)],
  ],
  "i": [[(0.25, 0), (0.25, 0.65)], [(0.25, 0.85), (0.25, 0.92)]],
  "e": [
    [
      (0, 0.32),
      (0.55, 0.32),
      (0.55, 0.5),
      (0.4, 0.65),
      (0.15, 0.65),
      (0, 0.5),
      (0, 0.15),
      (0.15, 0),
      (0.5, 0),
    ]
  ],
  "l": [[(0.2, 1), (0.2, 0.1), (0.3, 0), (0.45, 0)]],
  "k": [[(0, 0), (0, 1)], [(0.55, 0.65), (0, 0.25)], [(0.22, 0.4), (0.6, 0)]],
  "s": [
    [
      (0.55, 0.65),
      (0.15, 0.65),
      (0, 0.5),
      (0.15, 0.35),
      (0.4, 0.3),
      (0.55, 0.15),
      (0.4, 0),
      (0, 0),
    ]
  ],
  "p": [
    [
      (0, -0.25),
      (0, 0.65),
      (0.35, 0.65),
      (0.55, 0.5),
      (0.55, 0.3),
      (0.35, 0.2),
      (0, 0.2),
    ]
  ],
  "o": [
    [
      (0.15, 0),
      (0, 0.15),
      (0, 0.5),
      (0.15, 0.65),
      (0.4, 0.65),
      (0.55, 0.5),
      (0.55, 0.15),
      (0.4, 0),
      (0.15, 0),
    ]
  ],
  "t": [[(0.25, 0.9), (0.25, 0.1), (0.35, 0), (0.55, 0)], [(0, 0.65), (0.55, 0.65)]],
  "h": [
    [(0, 0), (0, 1)],
    [(0, 0.45), (0.2, 0.65), (0.4, 0.65), (0.55, 0.45), (0.55, 0)],
  ],
}


def facade(site, a, b):
  length = math.dist(a, b)
  tx, tz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
  nx, nz = tz, -tx

  def point(u, y, out=0):
    return [a[0] + tx * u + nx * out, y, a[1] + tz * u + nz * out]

  def member(u, y, w, h, d, color, out=0.075):
    p = point(u, y, out)
    start = len(site["nativeBlocks"])
    box(site, *p, w, h, d, -math.atan2(tz, tx), color)
    # Axis-aligned frontage has a stepped depth. Keep native frames and sign
    # layers in front of those steps instead of letting backing cells hide ink.
    shift = 0.25 if color in [0x3E4848, 0x252D2B] else 0
    if color in [0xEBDD16, 0xDECE20, 0x8C1D48, 0xC8C1AE]:
      shift = 0.5
    for block in site["nativeBlocks"][start:]:
      block[0] = round(block[0] + nx * shift, 4)
      block[2] = round(block[2] + nz * shift, 4)

  def panel(u, y, w, h, color, out=0.045):
    quad(
      site,
      [
        point(u - w / 2, y - h / 2, out),
        point(u + w / 2, y - h / 2, out),
        point(u + w / 2, y + h / 2, out),
        point(u - w / 2, y + h / 2, out),
      ],
      color,
      "mirror-glass",
    )
    # Use the same final rows in native; avoid also rendering these boxes drawn.
    n = len(site["boxes"])
    member(u, y, w, h, 0.045, color, out)
    del site["boxes"][n:]

  def text(text_, u, y, h, width, color, out):
    advance = 0.78
    scale = width / (len(text_) * advance - 0.18)
    for char_index, char in enumerate(text_):
      for path in GLYPHS[char]:
        for p, q in zip(path, path[1:]):
          # Source edge runs opposite the outside observer's screen-right.
          p2 = [u + width / 2 - (char_index * advance + p[0]) * scale, y + p[1] * h]
          q2 = [u + width / 2 - (char_index * advance + q[0]) * scale, y + q[1] * h]
          dx, dy = q2[0] - p2[0], q2[1] - p2[1]
          norm = max(0.0001, math.hypot(dx, dy))
          half = 0.042
          du, dv = -dy / norm * half, dx / norm * half
          quad(
            site,
            [
              point(p2[0] + du, p2[1] + dv, out),
              point(q2[0] + du, q2[1] + dv, out),
              point(q2[0] - du, q2[1] - dv, out),
              point(p2[0] - du, p2[1] - dv, out),
            ],
            color,
            "sign-lettering",
          )
          for j in range(max(1, math.ceil(norm / 0.09))):
            t = (j + 0.5) / max(1, math.ceil(norm / 0.09))
            pos = point(p2[0] + dx * t, p2[1] + dy * t, out + 0.65)
            site["nativeBlocks"].append(rounded(pos + [0.105, 0.11, 0.105]) + [color])

  return length, point, member, panel, text


def urania(evidence):
  site = new_site(
    "urania-v206", "Urania: complete source envelope and photographed entrance"
  )
  converted = []
  for i, s in enumerate(evidence["urania"]["surfaces"]):
    ring = [
      [round(x - 389500, 3), round(h - 34.676 + GROUND, 3), round(5820000 - z, 3)]
      for x, z, h in s["ringsEpsg25833Nhn"][0]
    ]
    converted.append({"type": s["type"], "ring": ring})
    if i in [4, 9, 10]:
      ring = [[p[0], max(SOFFIT, p[1]), p[2]] for p in ring]
    color = 0xA9AAA0 if i < 19 else 0x8A9996
    if i in [4, 9, 10]:
      color = 0x738E94
    if i < 2:
      color = 0x9C9C8F
    surface(site, ring, color, i)
  site["sourceSurfaces"] = converted
  faces = [
    ([-1650.413, 1940.127], [-1636.966, 1905.217], 26),
    ([-1627.003, 1949.136], [-1649.59, 1940.444], 17),
  ]
  site["facades"] = []
  for face_index, (a, b, bays) in enumerate(faces):
    length, p, member, panel, text = facade(site, a, b)
    pitch = length / bays
    rows = 8
    row_h = (TOP - SOFFIT) / rows
    site["facades"].append(
      {"a": a, "b": b, "bays": bays, "rows": rows, "entranceInsetM": 1.65}
    )
    palette = [
      0x52665D,
      0x60746C,
      0x6F827D,
      0x879798,
      0x93A4A9,
      0xA0B2B9,
      0xAEC0C5,
      0xB9C9CC,
    ]
    for i in range(bays):
      for j in range(rows):
        c = palette[j]
        if i % 7 in [0, 1]:
          c -= 0x030302
        panel(
          (i + 0.5) * pitch, SOFFIT + (j + 0.5) * row_h, pitch - 0.055, row_h - 0.055, c
        )
    for i in range(bays + 1):
      member(i * pitch, (TOP + SOFFIT) / 2, 0.042, TOP - SOFFIT, 0.065, 0x3E4848)
    for j in range(rows + 1):
      member(length / 2, SOFFIT + j * row_h, length, 0.047, 0.07, 0x3E4848)
    member(length / 2, TOP - 0.04, length, 0.08, 0.12, 0xC1C8C4)
    # Recess is a thin inner glazing plane with returns/soffit, not a solid fill.
    inset = 1.65
    end = 0.65
    panel(
      length / 2,
      (GROUND + SOFFIT) / 2,
      length - 2 * end,
      SOFFIT - GROUND - 0.06,
      0x344440,
      -inset,
    )
    for i in range(1, bays):
      member(
        i * pitch,
        (GROUND + SOFFIT) / 2,
        0.065,
        SOFFIT - GROUND,
        0.1,
        0x252D2B,
        -inset + 0.05,
      )
    quad(
      site,
      [
        p(0, SOFFIT),
        p(length, SOFFIT),
        p(length, SOFFIT, -inset),
        p(0, SOFFIT, -inset),
      ],
      0xB3B5AB,
      "entrance-soffit",
    )
    # Thin sill and upper lintel, all behind the outer column line.
    member(length / 2, GROUND + 0.10, length - 0.4, 0.16, 0.12, 0x9B9B8C, -inset)
    member(length / 2, SOFFIT - 0.12, length - 0.4, 0.19, 0.14, 0x4B514A, -inset)
    for k in range(8 if face_index == 0 else 5):
      u = 0.95 + k * (length - 1.9) / (7 if face_index == 0 else 4)
      x, _, z = p(u, GROUND, -0.26)
      radius = 0.30
      for n in range(12):
        v = n * math.tau / 12
        w = (n + 1) * math.tau / 12
        quad(
          site,
          [
            [x + radius * math.cos(v), GROUND, z + radius * math.sin(v)],
            [x + radius * math.cos(w), GROUND, z + radius * math.sin(w)],
            [x + radius * math.cos(w), SOFFIT, z + radius * math.sin(w)],
            [x + radius * math.cos(v), SOFFIT, z + radius * math.sin(v)],
          ],
          [0xD0D1C4, 0xBFC3B9, 0xACB1A8][n // 4],
          "pale-round-column",
        )
      site["nativeBlocks"].append(
        rounded([x, (GROUND + SOFFIT) / 2, z, 0.6, SOFFIT - GROUND, 0.6]) + [0xC4C8BE]
      )
    if face_index == 0:
      member(10.4, 13.8, 10, 4.8, 0.18, 0xEBDD16, 0.20)
      member(10.4, 12.55, 8.9, 1.92, 0.13, 0x8C1D48, 0.34)
      # Narrow pale plaque border, visible in the owner's photograph.
      for v in [-1, 1]:
        member(10.4, 12.55 + v * 0.98, 9.03, 0.075, 0.15, 0xC8C1AE, 0.35)
      for u in [-1, 1]:
        member(10.4 + u * 4.48, 12.55, 0.075, 1.98, 0.15, 0xC8C1AE, 0.35)
      text("UraniaBerlin", 10.4, 14.62, 1.20, 8.65, 0x303438, 0.315)
      text("Denksporthalle", 10.4, 12.14, 0.98, 8.2, 0xF0E7DC, 0.435)
      site["signs"] = [
        {
          "text": "UraniaBerlin",
          "faceIndex": 0,
          "u": 10.4,
          "baselineY": 14.62,
          "width": 8.65,
        },
        {
          "text": "Denksporthalle",
          "faceIndex": 0,
          "u": 10.4,
          "baselineY": 12.14,
          "width": 8.2,
        },
      ]
    else:
      # Tall yellow return panel; only legible identity is repeated, no invented programme.
      member(length - 3.2, 14.2, 3.8, 10.7, 0.12, 0xDECE20, 0.20)
      for y in [10.2, 12.15, 14.1, 16.05, 18.0]:
        text("Urania", length - 3.2, y, 0.58, 3.15, 0x3B3E32, 0.285)
  return site


def arc(evidence):
  site = new_site("arc-1245-v206", "Bernar Venet: Arc de 124,5°")
  data = evidence["arc"]
  angle = math.radians(data["angleDegrees"])
  width, thickness = data["sectionEstimateM"]
  # Solve the catalogue span/height with an explicitly estimated rectangular
  # section; the angle is the artwork title, not a new site measurement.
  lo, hi = math.radians(65), math.radians(95)
  for _ in range(70):
    tall = (lo + hi) / 2
    short = angle - tall
    radius = 40 / (math.sin(tall) + math.sin(short))
    height = radius - (radius - width) * math.cos(tall)
    if height < 21:
      lo = tall
    else:
      hi = tall
  tall = (lo + hi) / 2
  short = angle - tall
  radius = 40 / (math.sin(tall) + math.sin(short))
  dx, dz = data["tallEndDirectionXz"]
  norm = math.hypot(dx, dz)
  dx /= norm
  dz /= norm
  nx, nz = -dz, dx
  # Fit the *span midpoint*, not the hidden support, to the OSM locator.
  support_offset = -radius * (math.sin(tall) - math.sin(short)) / 2
  sx = data["locatorXz"][0] + dx * support_offset
  sz = data["locatorXz"][1] + dz * support_offset

  def point(theta, r, side):
    return [
      sx + dx * r * math.sin(theta) + nx * side * thickness / 2,
      GROUND + radius - r * math.cos(theta),
      sz + dz * r * math.sin(theta) + nz * side * thickness / 2,
    ]

  intervals = 128
  for i in range(intervals):
    a = -short + angle * i / intervals
    b = -short + angle * (i + 1) / intervals
    for side in [-1, 1]:
      quad(
        site,
        [
          point(a, radius, side),
          point(b, radius, side),
          point(b, radius - width, side),
          point(a, radius - width, side),
        ],
        0x272E30 if side == 1 else 0x333A3B,
        "arc-broad-face",
      )
    for r, c in [(radius, 0x151C1E), (radius - width, 0x465052)]:
      quad(
        site,
        [point(a, r, -1), point(b, r, -1), point(b, r, 1), point(a, r, 1)],
        c,
        "arc-edge",
      )
    points = [
      point(t, r, s) for t in [a, b] for r in [radius, radius - width] for s in [-1, 1]
    ]
    bounds = [(min(p[k] for p in points), max(p[k] for p in points)) for k in range(3)]
    site["nativeBlocks"].append(
      rounded([(a + b) / 2 for a, b in bounds] + [max(0.06, b - a) for a, b in bounds])
      + [0x293234]
    )
  for theta in [-short, tall]:
    quad(
      site,
      [
        point(theta, radius, -1),
        point(theta, radius, 1),
        point(theta, radius - width, 1),
        point(theta, radius - width, -1),
      ],
      0x4B5454,
      "arc-open-end-section",
    )
  site["profile"] = {
    "angleDegrees": 124.5,
    "catalogueSpanM": 40,
    "catalogueMaximumHeightM": 21,
    "radiusEstimateM": radius,
    "tallAngleEstimateDegrees": math.degrees(tall),
    "shortAngleEstimateDegrees": math.degrees(short),
    "sectionEstimateM": [width, thickness],
    "locatorXz": data["locatorXz"],
    "supportEstimateXz": [sx, sz],
    "tallEndDirectionXz": [dx, dz],
    "intervals": intervals,
    "groundY": GROUND,
  }
  median = shape(data["medianGeometry"]).buffer(0.001)
  assert all(
    median.covers(Point(p[0], p[2])) for t in site["triangles"] for p in t["points"]
  ), "Arc must stay inside retained grass median"
  return site


def build(evidence):
  sites = [urania(evidence), arc(evidence)]
  return {
    "schemaVersion": 1,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "sourceOwner": "11687794",
    "sourceParent": "DEBE07YY900005Dq",
    "sourceHeightM": 14.735,
    "sourceFootprint": evidence["urania"]["officialFootprint"],
    "groundY": GROUND,
    "estimates": evidence["correction"]["displayEstimates"],
    "sites": sites,
  }


def navigation(result, evidence):
  """Small collision data, independent of the renderer's triangles/instances."""
  site = result["sites"][0]
  high = Polygon([(p[0], p[2]) for p in site["sourceSurfaces"][0]["ring"]])
  rear = Polygon([(p[0], p[2]) for p in site["sourceSurfaces"][1]["ring"]])
  inset = high
  for face in site["facades"]:
    a, b = face["a"], face["b"]
    length = math.dist(a, b)
    tx, tz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
    nx, nz = tz, -tx

    def p(u, inward):
      return [a[0] + tx * u - nx * inward, a[1] + tz * u - nz * inward]

    inset = inset.intersection(
      Polygon(
        [p(-100, 1.65), p(length + 100, 1.65), p(length + 100, 100), p(-100, 100)]
      )
    )

  def part(id_, polygon, base, top):
    return {
      "id": id_,
      "ring": [rounded(p) for p in polygon.exterior.coords],
      "holes": [[rounded(p) for p in r.coords] for r in polygon.interiors],
      "groundY": base,
      "topY": top,
    }

  parts = [
    part("urania-v206-recessed-interior", inset, GROUND, TOP),
    part("urania-v206-source-upper", high, SOFFIT, TOP),
    part("urania-v206-source-rear", rear, GROUND, 14.088),
  ]
  for i, block in enumerate(b for b in site["nativeBlocks"] if b[-1] == 0xC4C8BE):
    x, _, z = block[:3]
    ring = [
      [x + 0.3 * math.cos(n * math.tau / 12), z + 0.3 * math.sin(n * math.tau / 12)]
      for n in range(12)
    ]
    parts.append(
      part(f"urania-v206-entrance-column-{i}", Polygon(ring), GROUND, SOFFIT)
    )
  return {
    "sourceOwner": result["sourceOwner"],
    "sourceParent": result["sourceParent"],
    "sourceSha256": result["sourceSha256"],
    "legacyVoxelColumns": evidence["legacyReplacement"]["voxelColumns"],
    "legacyVoxelCellM": evidence["legacyReplacement"]["voxelCellM"],
    "parts": parts,
    "roofPlanes": [
      part("upper-roof", high, SOFFIT, TOP),
      part("rear-roof", rear, GROUND, 14.088),
    ],
  }


def main():
  evidence = json.loads(SOURCE.read_text())
  result = build(evidence)
  DEST.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
  NAVIGATION.write_text(
    json.dumps(navigation(result, evidence), ensure_ascii=False, separators=(",", ":"))
    + "\n"
  )
  print(
    json.dumps(
      {
        s["id"]: {
          "triangles": len(s["triangles"]),
          "boxes": len(s["boxes"]),
          "nativeBlocks": len(s["nativeBlocks"]),
        }
        for s in result["sites"]
      }
    )
  )
  print(
    "Runtime bytes",
    DEST.stat().st_size,
    "SHA256",
    hashlib.sha256(DEST.read_bytes()).hexdigest(),
  )


if __name__ == "__main__":
  main()
