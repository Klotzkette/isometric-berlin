"""Photo-supported entrance fittings; retain the complete measured v238 hall.

Only the exact earlier sign and two front-door estimates yield. Dimensions of
the photo-derived three doors, steps, signs and ticket aperture are estimates.
"""

from __future__ import annotations

import base64
import hashlib
import json
import math
from collections import Counter

import numpy as np
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_panorama_facade_v202 import fingerprint
from build_small_tiergarten_v237 import oriented
from build_venues_hermann_v238 import (
  GEO,
  ROOT,
  architecture,
  face_axes,
  read,
  rgb,
  write,
)
from shapely.geometry import box

OUTPUT = ROOT / "src/app/src/data/columbiahalleV257.json"
EVIDENCE = GEO / "columbiahalle-v257-evidence.json.gz"
# Original geometric line paths, not a font, image or sampled photo texture.
# The owner's front photo shows thin neon tubes and narrow marquee letters.
STROKES = {
  "A": [[(0, 0), (0.5, 1), (1, 0)], [(0.2, 0.4), (0.8, 0.4)]],
  "B": [
    [(0, 0), (0, 1), (0.75, 1), (1, 0.84), (1, 0.66), (0.75, 0.5), (0, 0.5)],
    [(0.75, 0.5), (1, 0.34), (1, 0.16), (0.75, 0), (0, 0)],
  ],
  "C": [
    [
      (1, 0.8),
      (1, 0.9),
      (0.85, 1),
      (0.15, 1),
      (0, 0.9),
      (0, 0.1),
      (0.15, 0),
      (0.85, 0),
      (1, 0.1),
      (1, 0.2),
    ]
  ],
  "E": [[(1, 1), (0, 1), (0, 0), (1, 0)], [(0, 0.5), (0.8, 0.5)]],
  "F": [[(0, 0), (0, 1), (1, 1)], [(0, 0.5), (0.8, 0.5)]],
  "H": [[(0, 0), (0, 1)], [(1, 0), (1, 1)], [(0, 0.5), (1, 0.5)]],
  "I": [[(0.5, 0), (0.5, 1)]],
  "K": [[(0, 0), (0, 1)], [(1, 1), (0, 0.45), (1, 0)]],
  "L": [[(0, 1), (0, 0), (1, 0)]],
  "M": [[(0, 0), (0, 1), (0.5, 0.4), (1, 1), (1, 0)]],
  "N": [[(0, 0), (0, 1), (1, 0), (1, 1)]],
  "O": [
    [
      (0.15, 0),
      (0, 0.1),
      (0, 0.9),
      (0.15, 1),
      (0.85, 1),
      (1, 0.9),
      (1, 0.1),
      (0.85, 0),
      (0.15, 0),
    ]
  ],
  "R": [
    [(0, 0), (0, 1), (0.8, 1), (1, 0.85), (1, 0.65), (0.8, 0.5), (0, 0.5)],
    [(0.5, 0.5), (1, 0)],
  ],
  "S": [
    [
      (1, 0.85),
      (0.85, 1),
      (0.15, 1),
      (0, 0.85),
      (0, 0.65),
      (0.15, 0.5),
      (0.85, 0.5),
      (1, 0.35),
      (1, 0.15),
      (0.85, 0),
      (0.15, 0),
      (0, 0.15),
    ]
  ],
  "T": [[(0, 1), (1, 1)], [(0.5, 1), (0.5, 0)]],
  "U": [[(0, 1), (0, 0.1), (0.15, 0), (0.85, 0), (1, 0.1), (1, 1)]],
  "Y": [[(0, 1), (0.5, 0.5), (1, 1)], [(0.5, 0.5), (0.5, 0)]],
  "1": [[(0.1, 0.75), (0.5, 1), (0.5, 0)]],
  "2": [[(0, 0.85), (0.15, 1), (0.8, 1), (1, 0.8), (1, 0.65), (0, 0), (1, 0)]],
  "3": [
    [(0, 1), (0.8, 1), (1, 0.85), (1, 0.65), (0.8, 0.5), (0.3, 0.5)],
    [(0.8, 0.5), (1, 0.35), (1, 0.15), (0.8, 0), (0, 0)],
  ],
  "6": [
    [
      (0.9, 1),
      (0.2, 1),
      (0, 0.8),
      (0, 0.15),
      (0.15, 0),
      (0.85, 0),
      (1, 0.15),
      (1, 0.4),
      (0.85, 0.55),
      (0, 0.55),
    ]
  ],
  "8": [
    [
      (0.15, 0.5),
      (0, 0.65),
      (0, 0.85),
      (0.15, 1),
      (0.85, 1),
      (1, 0.85),
      (1, 0.65),
      (0.85, 0.5),
      (0.15, 0.5),
      (0, 0.35),
      (0, 0.15),
      (0.15, 0),
      (0.85, 0),
      (1, 0.15),
      (1, 0.35),
      (0.85, 0.5),
    ]
  ],
  "9": [
    [
      (1, 0.45),
      (0.15, 0.45),
      (0, 0.6),
      (0, 0.85),
      (0.15, 1),
      (0.85, 1),
      (1, 0.85),
      (1, 0.2),
      (0.8, 0),
      (0.1, 0),
    ]
  ],
  ".": [[(0.5, 0.03), (0.5, 0.10)]],
  ":": [[(0.5, 0.15), (0.5, 0.22)], [(0.5, 0.65), (0.5, 0.72)]],
  " ": [],
}
STROKES["0"] = STROKES["O"]
PHOTO_REFINEMENT = {
  "file": "1-Photo-1.jpg",
  "sha256": "a58ef9ba5106ff5e5530766ead152b4f90c4a971a68b8bf8fd66d5e4dc69873d",
  "previousFacadePayloadSha256": "f439800adb397827f7a4c3440f571e1f1cdabe98d3f54d38a5612492bd920470",
  "supersededEstimates": "v257 block lettering, marquee proportions, separated doors and unbacked KASSE lettering",
  "observedLabels": [
    "COLUMBIA",
    "HALLE",
    "19.10.2026",
    "THE SISTERS OF MERCY",
    "EINLASS:18:30",
    "KASSE",
  ],
  "nativeConstruction": "Independent world-axis vertical stroke tiles; no rotated drawn triangles or texture sampling",
}


def triangle_key(row):
  tri, color, _ = row
  return hashlib.sha256(
    json.dumps([sorted(tri), color], separators=(",", ":")).encode()
  ).hexdigest()


def corrected(row):
  tri, _, role = row
  return role in {"venue-name-board", "geometric-venue-lettering"} or (
    role == "mapped-entrance-door" and np.mean(tri, axis=0)[0] < 1345
  )


def details(building, native):
  result = Detail()
  f = face_axes(building)[13]
  a, direction, normal = f["a"], f["d"], f["n"]
  center = a + direction * f["length"] / 2
  angle = math.atan2(direction[1], direction[0])
  outset = 0.84 if native else 0.18

  def fitting(u, y, w, h, depth, tone, role, out=0):
    p = center + direction * u + normal * (outset + out)
    oriented(result, [p[0], y, p[1]], [w, h, depth], angle, rgb(tone), role, native)

  def stroke(start, end, thickness, tone, role, out):
    """Façade-local line in drawn; separately built orthogonal tiles in native."""
    start, end = np.array(start), np.array(end)
    delta = end - start
    if native:
      # Thin signs are surface geometry, so their independent native tiles need
      # no hidden box faces. Split along the facade width, never rotate a face.
      count = max(1, math.ceil(abs(delta[0]) / 0.075))
      if abs(delta[0]) > 1e-8 and abs(delta[1]) > 1e-8:
        count = max(
          count, math.ceil(abs(delta[0]) / 0.04), math.ceil(abs(delta[1]) / 0.06)
        )
      along = int(np.argmax(np.abs(direction)))
      across = 1 - along
      for i in range(count):
        lo = start + delta * i / count
        hi = start + delta * (i + 1) / count
        mid = (lo + hi) / 2
        p = center + direction * mid[0] + normal * (outset + out)
        half = (abs(hi[0] - lo[0]) + thickness) * abs(direction[along]) / 2
        bottom, top = (
          min(lo[1], hi[1]) - thickness / 2,
          max(lo[1], hi[1]) + thickness / 2,
        )
        corners = []
        for u, y in [(-half, bottom), (half, bottom), (half, top), (-half, top)]:
          q = p.copy()
          q[along] += u
          q[across] = p[across]
          corners.append([float(q[0]), float(y), float(q[1])])
        result.polygon(corners, rgb(tone), role)
      return
    perpendicular = np.array([-delta[1], delta[0]])
    perpendicular *= thickness / (2 * np.linalg.norm(perpendicular))
    corners = []
    for uv in [
      start - perpendicular,
      end - perpendicular,
      end + perpendicular,
      start + perpendicular,
    ]:
      p = center + direction * uv[0] + normal * (outset + out)
      corners.append([float(p[0]), float(uv[1]), float(p[1])])
    result.polygon(corners, rgb(tone), role)

  def label(
    word, u, y, width, height, tone, role, out, thickness=0.040, condensed=False
  ):
    # Fixed, explicitly spaced photo-fit width; dots/spaces stay narrow. The
    # date and concert line use condensed letters; the venue uses wide tubes.
    advance = [0.35 if ch in ".:" else 0.7 if ch == " " else 1.6 for ch in word]
    unit = height * 0.42 if condensed else width / (sum(advance) - 0.6)
    widths = [unit * (step if step < 1 else 1) for step in advance]
    gap = (width - sum(widths)) / (len(word) - 1)
    cursor = u - width / 2
    for ch, glyph_width in zip(word, widths):
      for path in STROKES[ch]:
        points = [(cursor + x * glyph_width, y + (v - 0.5) * height) for x, v in path]
        for start, end in zip(points, points[1:]):
          stroke(start, end, thickness, tone, role, out)
      cursor += glyph_width + gap

  # One photographed entrance wall, no source/roof envelope moves.
  fitting(0, 6.24, 10.18, 6.44, 0.07, 0xCCC4AA, "photo-plaster-facing")
  fitting(0, 8.65, 10.16, 1.62, 0.08, 0x494D4E, "dark-neon-fascia", 0.06)
  fitting(0, 4.83, 8.99, 3.10, 0.13, 0x96998F, "entry-outer-reveal", 0.08)
  fitting(0, 4.83, 8.81, 2.94, 0.15, 0x171B1C, "joined-black-entry-frame", 0.12)
  for index, u in enumerate([-2.92, 0, 2.92]):
    fitting(u, 4.77, 2.65, 2.72, 0.05, 0x292E2D, f"entry-bay-{index + 1}", 0.23)
    fitting(u, 5.67, 2.64, 0.83, 0.06, 0x1B2021, "black-entry-transoms", 0.27)
    fitting(u, 5.22, 2.72, 0.075, 0.07, 0x545950, "transom-crossbar", 0.29)
    # Broad dark leaves stand slightly proud, leaving the opening legible.
    fitting(u - 0.99, 4.30, 0.63, 1.83, 0.10, 0x1E2222, "entry-door-leaf", 0.34)
    fitting(u - 0.71, 4.44, 0.045, 0.44, 0.14, 0xA7AAA0, "door-pull", 0.41)
    fitting(u + 1.22, 4.30, 0.065, 1.83, 0.11, 0x707468, "entry-jamb-edge", 0.32)
  # Shallow stepped approach leaves three clear door axes. No navigation solid.
  for i in range(3):
    fitting(
      0,
      3.075 + i * 0.15,
      10.1,
      0.15,
      1.55 - i * 0.42,
      0xB6B29B,
      "three-entry-steps",
      0.78 - i * 0.21,
    )
  fitting(0, 7.10, 9.64, 1.50, 0.16, 0x9E9D86, "marquee-outer-casing", 0.18)
  fitting(0, 7.10, 9.49, 1.40, 0.18, 0xF8E9B8, "cream-marquee", 0.21)
  for y in [6.40, 6.78, 7.16, 7.54, 7.80]:
    fitting(0, y, 9.51, 0.018, 0.025, 0xC5B887, "marquee-letter-tracks", 0.315)
  for u in [-4.77, -1.59, 1.59, 4.77]:
    fitting(u, 7.10, 0.021, 1.43, 0.026, 0xB6B395, "marquee-panel-joints", 0.315)
  label(
    "19.10.2026", 0, 7.43, 3.80, 0.27, 0xB42D25, "marquee-date", 0.430, condensed=True
  )
  label(
    "THE SISTERS OF MERCY",
    0,
    7.03,
    7.35,
    0.30,
    0xB42D25,
    "marquee-concert",
    0.430,
    condensed=True,
  )
  label(
    "EINLASS:18:30",
    3.13,
    6.56,
    2.00,
    0.14,
    0xB42D25,
    "marquee-entry-time",
    0.430,
    0.022,
    condensed=True,
  )
  for tone, thickness, out in [(0x135BDC, 0.060, 0.17), (0x72C4FF, 0.019, 0.18)]:
    label(
      "COLUMBIA", 0, 8.79, 6.85, 0.70, tone, "outlined-blue-columbia", out, thickness
    )
    label(
      "HALLE", 0, 8.13, 1.80, 0.22, tone, "blue-halle-subtitle", out, thickness * 0.62
    )
    stroke(
      (-3.48, 8.33), (3.48, 8.33), thickness * 0.7, tone, "blue-neon-underline", out
    )
  # Photo's ticket booth belongs to the right low measured wing.
  fitting(10.7, 4.55, 1.80, 1.50, 0.09, 0x909184, "ticket-reveal", 1.90)
  fitting(10.7, 4.55, 1.65, 1.35, 0.12, 0x383B35, "ticket-aperture", 1.95)
  fitting(10.7, 4.80, 1.50, 0.73, 0.10, 0x4B514D, "ticket-shutter", 2.02)
  fitting(10.7, 4.17, 1.15, 0.47, 0.10, 0x171C1B, "ticket-counter-opening", 2.03)
  fitting(10.7, 3.87, 1.88, 0.12, 0.42, 0x777B6D, "ticket-sill", 2.04)
  fitting(10.7, 5.69, 1.76, 0.48, 0.10, 0x363D3E, "kasse-dark-plaque", 2.03)
  label("KASSE", 10.7, 5.69, 1.33, 0.28, 0xE3E7D9, "kasse-white-lettering", 2.19, 0.038)
  fitting(10.7, 6.10, 0.38, 0.08, 0.23, 0xDCE3C8, "ticket-window-lamp", 2.09)
  # A few queue rails at either side; no crowd faces, no door obstruction.
  for u in [-5.8, 5.8]:
    for v in [2.0, 3.3, 4.6]:
      fitting(u, 3.55, 0.07, 1.1, 0.07, 0x51534D, "queue-post", v)
    fitting(u, 4.05, 0.06, 0.055, 2.7, 0x62645B, "queue-rail", 3.3)
  for u in [-4.7, 4.7]:
    fitting(u, 6.15, 0.34, 0.16, 0.26, 0xF3D792, "entry-wall-lamp", 0.36)
  return result


def build():
  b = read(GEO / "venues-hermann-v238-source.json.gz")["buildings"][1]
  original = read(ROOT / "src/app/src/data/venuesV238Replacement.json")
  models, _ = architecture(b)
  data, audit = {}, {}
  for mode, native in [("drawn", False), ("minecraft", True)]:
    old = original["packets"][mode + ":2_7"]["replacement"]
    tile = box(1024, 3584, 1536, 4096)
    replay = packed_detail(models[mode], tile)
    assert all(replay[k] == old[k] for k in ["positions", "colors", "indices"])
    retired = [r for r in models[mode].triangles if corrected(r)]
    retained = [r for r in models[mode].triangles if not corrected(r)]
    added = details(b, native)
    new = Detail()
    new.triangles = retained + added.triangles
    replacement = packed_detail(new, tile)
    replacement["kind"] = old["kind"]
    data[mode] = dict(
      fingerprint=fingerprint([old[k] for k in ["positions", "colors", "indices"]]),
      replacement=replacement,
    )
    audit[mode] = dict(
      retiredTriangleHashes=[triangle_key(r) for r in retired],
      retainedTriangles=len(retained),
      addedTriangles=len(added.triangles),
      sourceTriangles=sum(
        r[2].startswith(b["parent"] + "/") or r[2] == "independent-measured-native-skin"
        for r in retained
      ),
      roles=dict(Counter(r[2] for r in added.triangles)),
      beforeBytes=sum(
        len(base64.b64decode(old[k])) for k in ["positions", "colors", "indices"]
      ),
      afterBytes=sum(
        len(base64.b64decode(replacement[k]))
        for k in ["positions", "colors", "indices"]
      ),
    )
  write(OUTPUT, dict(schema=1, owner=b["parent"], **data))
  write(
    EVIDENCE,
    dict(
      schema=1,
      owner=b["parent"],
      sourceShellPreserved=True,
      sourceSha256=hashlib.sha256(
        (GEO / "venues-hermann-v238-source.json.gz").read_bytes()
      ).hexdigest(),
      originalReplacementSha256=hashlib.sha256(
        (ROOT / "src/app/src/data/venuesV238Replacement.json").read_bytes()
      ).hexdigest(),
      correction="Only exact v238 name board, lettering and two main-door estimates; side door, eaves, four measured parts and navigation unchanged.",
      estimates="Photo-fitted positions, material colours and dimensions; not surveyed openings or an as-built interior.",
      photoRefinement=PHOTO_REFINEMENT,
      modes=audit,
    ),
  )
  print(
    json.dumps(
      {
        k: {f: v for f, v in a.items() if f != "retiredTriangleHashes"}
        for k, a in audit.items()
      },
      indent=2,
    )
  )


if __name__ == "__main__":
  build()
