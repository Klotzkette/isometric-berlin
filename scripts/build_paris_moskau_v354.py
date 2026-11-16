"""Measured Paris–Moskau shell and photo-estimated exterior, independently cardinal."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import subprocess
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from scripts.build_fuel_packets_v351 import Mesh as BaseMesh
from scripts.build_fuel_packets_v351 import rgb

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
BASELINE = "4bb88fa3d836f0313407bbe0abeef32dca20f63e"
ORIGIN = [-480, 0, -440]
CX, CZ, ANGLE = -466.2, -420.575, -math.atan2(2.7, 11.8)
C, S = math.cos(ANGLE), math.sin(ANGLE)
SOURCE = {
  "id": "K0002Tlk",
  "ring": [[-4731, -4176], [-4713, -4257], [-4595, -4230], [-4613, -4150]],
  "holes": [],
  "y0_dm": 41,
  "h_dm": 106,
  "class": 0,
  "roof": 3100,
  "tone": [65, 70, 68],
}
COLUMNS = [
  [-118, -106, 40, 160, 3],
  [-117, -106, 41, 161, 3],
  [-116, -106, 43, 163, 3],
  [-118, -105, 41, 161, 3],
  [-117, -105, 42, 162, 3],
  [-116, -105, 43, 163, 3],
]
PAINT = {
  "plaster": (234, 231, 216),
  "timber": (36, 48, 57),
  "brick": (133, 64, 49),
  "roof": (147, 79, 56),
  "glass": (63, 82, 84),
  "frame": (227, 230, 219),
  "plinth": (70, 61, 55),
  "awning": (166, 34, 38),
}


class Mesh(BaseMesh):
  def triangle(self, points, colors):
    q = np.rint((np.asarray(points) - self.origin) * 100).astype(np.int64)
    if np.any(np.cross(q[1] - q[0], q[2] - q[0])):
      super().triangle(points, colors)


def cardinal(p, cell=0.1):
  x0, z0, x1, z1 = p.bounds
  rects = []
  for z in range(math.floor(z0 / cell), math.ceil(z1 / cell)):
    xs = np.arange(math.floor(x0 / cell), math.ceil(x1 / cell))
    ok = shapely.covers(
      p, shapely.points((xs + 0.5) * cell, np.full(len(xs), (z + 0.5) * cell))
    )
    gaps = np.flatnonzero(np.diff(np.r_[False, ok, False]))
    for a, b in zip(gaps[::2], gaps[1::2], strict=True):
      rects.append(box(xs[a] * cell, z * cell, (xs[b - 1] + 1) * cell, (z + 1) * cell))
  return unary_union(rects).simplify(0)


def point(x, y, z):
  return [CX + x * C + z * S, y, CZ - x * S + z * C]


def rect(x0, z0, x1, z1):
  return Polygon(
    [
      (point(x, 0, z)[0], point(x, 0, z)[2])
      for x, z in [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]
    ]
  )


def build(native=False):
  mesh = Mesh(ORIGIN)
  counts = {}

  def prism(p, lo, hi, paint, label="detail", cell=0.1):
    if native:
      p = cardinal(p, cell)
    if p.is_empty:
      return
    start = len(mesh.indices)
    mesh.prism(p, lo, hi, rgb(PAINT[paint]))
    counts[label] = counts.get(label, 0) + (len(mesh.indices) - start) // 3

  def block(x, y, z, w, h, d, paint, label="detail"):
    prism(
      rect(x - w / 2, z - d / 2, x + w / 2, z + d / 2),
      y - h / 2,
      y + h / 2,
      paint,
      label,
    )

  def tri(a, b, c, paint):
    mesh.triangle([point(*p) for p in (a, b, c)], [rgb(PAINT[paint])] * 3)

  def roof(x0, x1, z0, z1, eave, peak, across="z"):
    # Native is constructed from horizontal cardinal roof courses, not a
    # re-used rotated Drawn roof. Main eave and peak retain the measured envelope.
    if native:
      n = math.ceil((peak - eave) / 0.25)
      for i in range(n):
        lo, hi = eave + i * (peak - eave) / n, eave + (i + 1) * (peak - eave) / n
        f = (i + 0.5) / n
        if across == "z":
          half = (z1 - z0) / 2 * (1 - f)
          z = (z0 + z1) / 2
          p = rect(x0, z - half, x1, z + half)
        else:
          half = (x1 - x0) / 2 * (1 - f)
          x = (x0 + x1) / 2
          p = rect(x - half, z0, x + half, z1)
        prism(p, lo, hi, "roof", "roof", 0.2)
      return
    if across == "z":
      q = [
        (x0, eave, z0),
        (x1, eave, z0),
        (x1, eave, z1),
        (x0, eave, z1),
        (x0, peak, (z0 + z1) / 2),
        (x1, peak, (z0 + z1) / 2),
      ]
    else:
      q = [
        (x0, eave, z1),
        (x0, eave, z0),
        (x1, eave, z0),
        (x1, eave, z1),
        ((x0 + x1) / 2, peak, z1),
        ((x0 + x1) / 2, peak, z0),
      ]
    for a, b, c in [(0, 4, 1), (1, 4, 5), (2, 5, 3), (3, 5, 4)]:
      tri(q[a], q[b], q[c], "roof")

  footprint = Polygon([(x / 10, z / 10) for x, z in SOURCE["ring"]])
  # The retained front ground is 3.9; the source floor is 4.1. The 20 cm
  # foundation continuation grounds the plinth without changing terrain.
  prism(footprint, 3.9, 4.65, "plinth", "measured shell")
  prism(footprint, 4.65, 7.75, "plaster", "measured shell")
  # The front upper loggia is an actual open recess: no old full-height
  # prism, glazing proxy or new flat wall remains behind its outer plane.
  notch = rect(-1.55, -4.6, 1.55, -2.65)
  prism(footprint.difference(notch), 7.75, 10.7, "plaster", "open loggia shell")
  block(0, 7.8, -3.45, 3.1, 0.14, 1.7, "timber", "loggia floor")
  block(0, 9.0, -2.69, 1.35, 2.2, 0.1, "glass", "loggia rear door")
  block(0, 9.0, -2.77, 0.08, 2.2, 0.1, "frame")
  # Four photographed north ground openings: broad left window, door, then
  # two narrower windows. Pane widths and sill/lintel heights are estimates.
  for x, w, door in [
    (-4.15, 1.7, False),
    (-0.8, 1.0, True),
    (1.2, 1.25, False),
    (3.95, 1.25, False),
  ]:
    lo = 4.12 if door else 4.95
    hi = 7.12
    block(
      x, (lo + hi) / 2, -4.19, w + 0.3, hi - lo + 0.3, 0.12, "brick", "north openings"
    )
    block(x, (lo + hi) / 2, -4.28, w, hi - lo, 0.12, "glass", "north openings")
    for xx in [x - w / 2 + 0.055, x + w / 2 - 0.055, x]:
      block(xx, (lo + hi) / 2, -4.36, 0.07, hi - lo, 0.08, "frame")
    block(x, 6.25, -4.36, w, 0.07, 0.08, "frame")
    for yy in [lo, hi]:
      block(x, yy, -4.36, w, 0.07, 0.08, "frame")
    # Segmental brick lintel, kept a bounded visible relief.
    for k in range(9):
      xx = x - w * 0.5 + k * w / 8
      yy = hi + 0.13 + 0.12 * (1 - ((xx - x) / (w * 0.5)) ** 2)
      block(xx, yy, -4.31, w / 8 + 0.025, 0.16, 0.11, "brick")
  # Both visible gable ends have the paired upper windows and framed timber.
  for side in [-1, 1]:
    x = side * 6.03
    for z in [-2.0, 2.0]:
      block(x, 9.1, z, 0.16, 1.75, 1.05, "timber", "gable openings")
      block(x + side * 0.09, 9.1, z, 0.12, 1.53, 0.85, "glass", "gable openings")
      for zz in [z - 0.39, z, z + 0.39]:
        block(x + side * 0.17, 9.1, zz, 0.08, 1.53, 0.065, "frame")
      block(x + side * 0.17, 9.45, z, 0.08, 0.065, 0.85, "frame")
    # Triangular infill follows the same 10.7–14.7 roof envelope.
    if native:
      for i in range(16):
        half = 4.15 * (1 - (i + 0.5) / 16)
        block(
          x, 10.7 + (i + 0.5) * 0.25, 0, 0.2, 0.25, half * 2, "plaster", "gable infill"
        )
    else:
      a, b, c = (x, 10.7, -4.15), (x, 10.7, 4.15), (x, 14.7, 0)
      tri(a, b, c, "plaster")
      tri(c, b, a, "plaster")
    for z in [-3.6, -2.25, -0.75, 0.75, 2.25, 3.6]:
      hi = 14.7 - abs(z) / 4.15 * 4
      block(
        x + side * 0.13,
        (7.8 + hi) / 2,
        z,
        0.16,
        hi - 7.8,
        0.13,
        "timber",
        "gable timber",
      )
    for y in [7.85, 10.4, 11.8]:
      half = min(4.15, (14.7 - y) / 4 * 4.15)
      block(x + side * 0.14, y, 0, 0.16, 0.13, half * 2, "timber", "gable timber")
    # Red brick base-floor quoins, and two east terrace-side openings.
    for z in [-4.08, 4.08]:
      for i in range(13):
        block(x, 4.8 + i * 0.22, z, 0.23, 0.15, 0.4 if i % 2 else 0.55, "brick")
    if side == 1:
      for z in [-2, 1.8]:
        block(6.09, 5.95, z, 0.16, 2.2, 1.45, "brick")
        block(6.19, 5.95, z, 0.12, 1.95, 1.15, "glass")
        block(6.27, 5.95, z, 0.07, 1.95, 0.07, "frame")
        block(6.27, 6.35, z, 0.07, 0.07, 1.15, "frame")
  # North facade timber is mostly white infill; it must not become a generic
  # window grid. The loggia gap stays clear between the two central posts.
  for side in [-1, 1]:
    z = side * 4.2
    xs = [-5.9, -4.6, -3.05, -1.6, 1.6, 3.05, 4.6, 5.9]
    for x in xs:
      block(x, 9.21, z, 0.14, 2.88, 0.14, "timber", "timber")
    for y in [7.85, 8.12, 9.35, 10.58]:
      spans = [(-6, -1.55), (1.55, 6)] if side == -1 else [(-6, 6)]
      for lo, hi in spans:
        block((lo + hi) / 2, y, z, hi - lo, 0.13, 0.14, "timber", "timber")
  # Main gable roof, projecting central gable and two small dormers.
  roof(-6.38, 6.38, -4.55, 4.55, 10.7, 14.7)
  roof(-1.85, 1.85, -4.65, -1.15, 10.95, 13.6, "x")
  for x in [-3.6, 3.6]:
    block(x, 12.12, -2.35, 1.0, 1.1, 0.65, "timber", "dormers")
    block(x, 12.12, -2.72, 0.7, 0.83, 0.12, "glass", "dormers")
    block(x, 12.12, -2.8, 0.06, 0.83, 0.08, "frame")
    roof(x - 0.7, x + 0.7, -2.95, -1.85, 12.65, 13.15, "x")
  for x, z, h in [(-2.3, 0.8, 1.5), (3.65, 0.7, 0.85)]:
    block(x, 14.05 + h / 2, z, 0.53, h, 0.64, "brick", "chimneys")
    block(x, 14.05 + h, z, 0.63, 0.12, 0.74, "plinth")
  # Loggia balustrade: open individual posts, not a solid dark/glass panel.
  for y in [8.05, 8.65]:
    block(0, y, -4.32, 3.05, 0.11, 0.14, "timber", "loggia balustrade")
  for x in np.linspace(-1.4, 1.4, 13):
    block(x, 8.36, -4.32, 0.09, 0.6, 0.11, "timber", "loggia balustrade")
  for x in [-1.55, 1.55]:
    block(x, 9.47, -4.32, 0.17, 3.25, 0.17, "timber", "loggia posts")
  # Gable verge outlines and hanging fretwork are photo-estimated silhouettes.
  for side in [-1, 1]:
    for i in range(20):
      t = (i + 0.5) / 20
      block(
        side * t * 1.85,
        13.6 - t * 2.65,
        -4.67,
        0.15,
        0.22,
        0.15,
        "timber",
        "gable ornament",
      )
    for i in range(9):
      x = side * (i + 0.5) * 0.19
      y = 13.6 - abs(x) / 1.85 * 2.65
      block(x, y - 0.22, -4.66, 0.105, 0.36, 0.14, "timber", "gable ornament")
  # Mapped building's east terrace awning, red in the current operator photo.
  # No new terrace ground, guessed entrance or neighbouring site furniture.
  for i in range(8):
    block(
      6.15 + (i + 0.5) * 0.17,
      7.65 - (i + 0.5) * 0.09,
      -0.1,
      0.18,
      0.1,
      4.9,
      "awning",
      "east awning",
    )
  block(7.51, 6.93, -0.1, 0.1, 0.2, 4.9, "awning")
  # Sign-sized light plaque above the photographed entrance. No raster imagery.
  block(0.55, 7.48, -4.32, 2.85, 0.34, 0.13, "frame", "name plaque")
  payload = mesh.payload()
  payload["kind"] = "paris-moskau-v354"
  return {
    "origin": ORIGIN,
    "mesh": payload,
    "triangles": len(mesh.indices) // 3,
    "features": counts,
  }


def main():
  original = subprocess.check_output(
    ["git", "show", f"{BASELINE}:src/app/src/CityRecognitionRefinements.ts"],
    cwd=ROOT,
    text=True,
  )
  fn = original[
    original.index("function addParisMoskau(") : original.index(
      "function addStorefronts("
    )
  ]
  receipt = {
    "schemaVersion": 1,
    "baseline": BASELINE,
    "sourcePrism": SOURCE,
    "nativeColumns": COLUMNS,
    "previousFunction": fn,
    "previousFunctionSha256": hashlib.sha256(fn.encode()).hexdigest(),
    "sourceUrls": [
      "https://www.openstreetmap.org/way/181479019",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050226",
      "https://denkmaldatenbank.berlin.de/media/uploads/Tie/09050226a.jpg",
      "https://www.paris-moskau.de/images/og-image.webp",
      "https://www.paris-moskau.de/",
    ],
    "credits": [
      "Geoportal Berlin / LoD2, dl-de/by-2-0",
      "© OpenStreetMap contributors, ODbL",
      "Landesdenkmalamt Berlin, exterior photograph © LDA 2004 (reference only)",
      "Restaurant PARIS-MOSKAU, operator exterior publication (reference only; photographer/date unspecified)",
    ],
    "geometryStatus": "Source footprint/base/total roof height retained; eaves, beams, apertures, dormers, loggia and awning estimated from primary exterior photographs. No public interior or new entrance navigation.",
  }
  GEO.mkdir(exist_ok=True, parents=True)
  (GEO / "paris-moskau-v354-source.json.gz").write_bytes(
    gzip.compress(
      json.dumps(receipt, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0
    )
  )
  data = {"schemaVersion": 1, "sourcePrism": SOURCE, "nativeColumns": COLUMNS}
  alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#"
  counts = {}
  for mode in ["drawn", "minecraft"]:
    built = build(mode == "minecraft")
    packed = built["mesh"]
    colors = (
      np.frombuffer(base64.b64decode(packed["colors"]), dtype="u1").astype("<u2") * 257
    )
    packed.update(
      key="Paris-Moskau photo-referenced exterior v354",
      native=mode == "minecraft",
      colorType="u16linear",
      colors=base64.b64encode(colors.tobytes()).decode(),
      origin=ORIGIN,
      vertices=len(colors) // 3,
      triangles=built["triangles"],
    )
    decoded = json.dumps(packed, separators=(",", ":")).encode()
    compressed = gzip.compress(decoded, mtime=0)
    padding = (4 - len(compressed) % 4) % 4
    words = compressed + bytes(padding)
    encoded = [str(padding)]
    for at in range(0, len(words), 4):
      word = int.from_bytes(words[at : at + 4], "big")
      s = ""
      for _ in range(5):
        word, digit = divmod(word, 85)
        s = alphabet[digit] + s
      encoded.append(s)
    data[mode] = {
      "payload": "".join(encoded),
      "decodedBytes": len(decoded),
      "triangles": built["triangles"],
      "features": built["features"],
    }
    counts[mode] = built["triangles"]
  raw = json.dumps(data, separators=(",", ":")).encode()
  (DATA / "parisMoskauV354.json").write_bytes(raw)
  print(
    json.dumps(
      {
        "bytes": len(raw),
        "gzipBytes": len(gzip.compress(raw, mtime=0)),
        "triangles": counts,
      }
    )
  )


if __name__ == "__main__":
  main()
