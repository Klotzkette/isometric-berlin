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
  GLYPHS,
  ROOT,
  architecture,
  face_axes,
  read,
  rgb,
  text_label,
  write,
)
from shapely.geometry import box

OUTPUT = ROOT / "src/app/src/data/columbiahalleV257.json"
EVIDENCE = GEO / "columbiahalle-v257-evidence.json.gz"
GLYPHS.update(
  {
    "D": ["110", "101", "101", "101", "110"],
    "F": ["111", "100", "110", "100", "100"],
    "K": ["101", "101", "110", "101", "101"],
    "R": ["110", "101", "110", "101", "101"],
    "0": ["111", "101", "101", "101", "111"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["111", "001", "111", "100", "111"],
    "6": ["111", "100", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"],
    ".": ["0", "0", "0", "0", "1"],
  }
)


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

  def label(word, u, y, height, tone, out=0):
    p = center + direction * u + normal * (outset + out)
    text_label(
      result, word, [p[0], y, p[1]], direction, normal, height, rgb(tone), native
    )

  # One photographed entrance wall, no source/roof envelope moves.
  fitting(0, 6.24, 10.18, 6.44, 0.07, 0xD3C69F, "photo-plaster-facing")
  for u in [-3.25, 0, 3.25]:
    fitting(u, 4.78, 2.22, 2.72, 0.12, 0x242523, "three-black-double-doors", 0.10)
    fitting(u, 4.78, 0.065, 2.64, 0.16, 0x55564B, "double-door-centre", 0.19)
    fitting(u, 5.7, 2.13, 0.065, 0.17, 0x535448, "door-transom", 0.20)
    for x in [-0.16, 0.16]:
      fitting(u + x, 4.62, 0.055, 0.47, 0.19, 0xC1BFA7, "door-pull", 0.23)
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
  fitting(0, 6.56, 9.45, 1.1, 0.16, 0xECE3C5, "cream-marquee", 0.18)
  for y in [6.02, 6.56, 7.10]:
    fitting(0, y, 9.5, 0.035, 0.18, 0x64604E, "marquee-frame", 0.28)
  label("19.10.2026", 0, 6.83, 0.28, 0x9F3837, 0.30)
  label("THE SISTERS OF MERCY", 0, 6.28, 0.39, 0xA23939, 0.30)
  label("COLUMBIA", 0, 8.55, 0.87, 0x477FE1, 0.17)
  label("HALLE", 0, 7.64, 0.38, 0x477FE1, 0.17)
  # Photo's ticket booth belongs to the right low measured wing.
  fitting(10.7, 4.55, 1.65, 1.35, 0.12, 0x383B35, "ticket-aperture", 1.95)
  fitting(10.7, 3.87, 1.88, 0.12, 0.42, 0x777B6D, "ticket-sill", 2.04)
  label("KASSE", 10.7, 5.7, 0.42, 0x42443D, 2.03)
  # A few queue rails at either side; no crowd faces, no door obstruction.
  for u in [-5.8, 5.8]:
    for v in [2.0, 3.3, 4.6]:
      fitting(u, 3.55, 0.07, 1.1, 0.07, 0x51534D, "queue-post", v)
    fitting(u, 4.05, 0.06, 0.055, 2.7, 0x62645B, "queue-rail", 3.3)
  for u in [-4.7, 4.7]:
    fitting(u, 6.0, 0.23, 0.32, 0.26, 0xE3CB85, "entry-wall-lamp", 0.36)
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
