"""Step 10: additive HU main-building ornament; previous hero models untouched."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "src/app/src/data/humboldtMainV168Source.json"
SOURCE = ROOT / "src/app/src/bebelplatzBuildingSource.json"
FACADES = ROOT / "src/app/src/BebelplatzFacades.ts"
SHELLS = ROOT / "src/app/src/BebelplatzBuildingShells.ts"
STONE, LIGHT, SHADE = 0xD9D3C2, 0xE6DFCF, 0xAFA896
FRAME, METAL = 0xB8BBA9, 0x505448
AXES = [
  ("west-main", [1469.323, 133.647], [1493.234, 131.571], -1, 6, False),
  ("central", [1494.135, 136.511], [1522.051, 134.087], -1, 5, True),
  ("east-main", [1522.117, 129.063], [1546.027, 126.986], -1, 6, False),
  ("west-court", [1469.323, 133.647], [1473.188, 181.393], 1, 9, False),
  ("east-court", [1546.027, 126.986], [1550.169, 174.708], -1, 9, False),
  ("west-end-left", [1436.287, 184.596], [1446.08, 183.746], -1, 2, False),
  ("west-end-risalit", [1446.276, 184.492], [1463.322, 183.022], -1, 3, True),
  ("west-end-right", [1463.395, 182.243], [1473.188, 181.393], -1, 2, False),
  ("east-end-left", [1550.169, 174.708], [1559.982, 173.856], -1, 2, False),
  ("east-end-risalit", [1560.177, 174.602], [1577.213, 173.123], -1, 3, True),
  ("east-end-right", [1577.277, 172.354], [1587.11, 171.501], -1, 2, False),
]


def build() -> dict:
  """Reuse measured planes and previous display dimensions without new shells."""
  previous = json.loads(SOURCE.read_text())["profiles"]["humboldt"]
  boxes, rods, beads, axes = [], [], [], []

  def rounded(v: list | np.ndarray) -> list:
    return [round(float(n), 4) for n in v]

  for name, a, b, side, bays, risalit in AXES:
    a, b = np.array(a), np.array(b)
    span = float(np.linalg.norm(b - a))
    d = (b - a) / span
    n = np.array([d[1] * side, -d[0] * side])
    central = name == "central"
    out = 0.34 if name in ["central", "west-main", "east-main"] else 0.45
    axis = {
      "name": name,
      "start": a.tolist(),
      "end": b.tolist(),
      "side": side,
      "bays": bays,
      "risalit": risalit,
      "lengthM": round(span, 6),
      "existingDetailOut": out,
    }
    axes.append(axis)

    def point(u: float, y: float, offset: float) -> list:
      q = a + d * u + n * offset
      return [float(q[0]), y, float(q[1])]

    def box(
      u: float,
      y: float,
      w: float,
      h: float,
      depth: float,
      offset: float,
      color: int,
      role: int,
    ) -> None:
      boxes.append(
        rounded(point(u, y, offset))
        + [w, h, depth, round(math.atan2(-d[1], d[0]), 6), color, role]
      )

    def rod(p: list, q: list, r: float, color: int, role: int) -> None:
      if np.linalg.norm(np.subtract(p, q)) > 0.001:
        rods.append(rounded(p) + rounded(q) + [r, color, role])

    def path(points: list, r: float, color: int, role: int) -> None:
      for p, q in zip(points, points[1:]):
        rod(p, q, r, color, role)

    def bead(
      u: float,
      y: float,
      offset: float,
      w: float,
      h: float,
      depth: float,
      color: int,
      role: int,
    ) -> None:
      beads.append(rounded(point(u, y, offset)) + [w, h, depth, color, role])

    # Fine upper plaster courses stay behind the existing projecting glazing.
    # Vertical joints are staggered estimates; pane ranges are never crossed.
    window_width = 2.9 if central else 2.15
    pitch = span / bays
    for y in np.arange(10.8, 23.95, 0.54):
      gaps = [(0.08, span - 0.08)]
      if 11.8 < y < 18.0 or 18.85 < y < 21.7:
        gaps = []
        for i in range(bays + 1):
          lo = 0.08 if i == 0 else (i - 0.5) * pitch + window_width / 2 + 0.20
          hi = span - 0.08 if i == bays else (i + 0.5) * pitch - window_width / 2 - 0.20
          if hi > lo:
            gaps.append((lo, hi))
      for lo, hi in gaps:
        box((lo + hi) / 2, float(y), hi - lo, 0.028, 0.045, 0.07, SHADE, 1)
    # Egg-and-dart / dentil rhythm below existing cornice, not a second cornice.
    for u in np.arange(0.24, span - 0.1, 0.51):
      box(float(u), 23.88, 0.14, 0.22, 0.20, out + 0.13, LIGHT, 2)
      bead(float(u) + 0.23, 24.47, out + 0.10, 0.09, 0.12, 0.10, SHADE, 2)
    for i in range(bays):
      u = (i + 0.5) * pitch
      w = 2.9 if central else 2.15
      spring = 16.75
      rise = w * 0.34
      # Additional fanlight bars and narrow secondary pane divisions.
      for du in [-w * 0.25, w * 0.25]:
        box(u + du, 14.4, 0.026, 4.54, 0.055, out + 0.26, FRAME, 3)
      for t in np.linspace(0.18, math.pi - 0.18, 7):
        rod(
          point(u, spring, out + 0.26),
          point(
            u + w * 0.47 * math.cos(t), spring + rise * 0.95 * math.sin(t), out + 0.26
          ),
          0.018,
          FRAME,
          3,
        )
      if risalit:
        # Existing wing heads remain; the main risalit gets its missing head.
        if central:
          bead(u, 18.09, out + 0.38, 0.28, 0.40, 0.23, LIGHT, 4)
          bead(u, 18.11, out + 0.51, 0.10, 0.13, 0.10, SHADE, 4)
          for sign in [-1, 1]:
            bead(u + sign * 0.12, 18.02, out + 0.44, 0.07, 0.10, 0.075, STONE, 4)
        # Symmetric botanical swags around the arch, independently authored.
        for sign in [-1, 1]:
          pts = []
          for t in np.linspace(0, 1, 11):
            uu = u + sign * (0.28 + t * 0.98)
            yy = 18.04 - 0.40 * math.sin(math.pi * t)
            pts.append(point(uu, yy, out + 0.38))
            if 0 < t < 1:
              bead(uu, yy - 0.06, out + 0.42, 0.10, 0.17, 0.09, LIGHT, 5)
          path(pts, 0.028, STONE, 5)
          box(u + sign * 1.29, 17.93, 0.15, 0.30, 0.13, out + 0.37, LIGHT, 5)
      # Small brackets under old window sills instead of replacing their frames.
      for sign in [-1, 1]:
        for y in [11.71, 18.71]:
          box(u + sign * (w / 2 - 0.1), y, 0.18, 0.32, 0.22, out + 0.18, STONE, 6)
          bead(
            u + sign * (w / 2 - 0.1), y - 0.15, out + 0.22, 0.12, 0.18, 0.16, SHADE, 6
          )
    if not central:
      # Existing square baluster spindles gain a shallow turned belly/collar.
      count = max(1, math.floor(span / 0.82))
      for i in range(count + 1):
        u = i * span / count
        bead(u, 25.49, out, 0.25, 0.35, 0.28, LIGHT, 7)
        box(u, 25.69, 0.24, 0.065, 0.28, out, STONE, 7)
    if central:
      for i in range(6):
        u = 0.65 + i * (span - 1.3) / 5
        # Six existing shafts remain. Thin relief/shadow flutes follow their taper.
        for j in range(20):
          t = 2 * math.pi * j / 20
          r0, r1 = 0.475, 0.437
          p = point(u + r0 * math.cos(t), 10.96, 0.96 + r0 * math.sin(t))
          q = point(u + r1 * math.cos(t), 22.87, 0.96 + r1 * math.sin(t))
          rod(p, q, 0.021, SHADE, 8)
        # Measured column axes also anchor the primary-described rear pilasters.
        box(u, 17.1, 0.78, 12.86, 0.18, 0.19, STONE, 9)
        for y, width in [(10.65, 1.15), (23.2, 1.02), (23.61, 1.33)]:
          box(u, y, width, 0.14, 0.42, 0.35, LIGHT, 9)
        # Two small acanthus tiers, with curled leaf ends and corner volutes.
        for row, y in enumerate([22.92, 23.27]):
          for j in range(8):
            t = 2 * math.pi * (j + 0.5 * row) / 8
            rr = 0.46 + row * 0.05
            leaf_u = u + rr * math.cos(t)
            leaf_out = 0.96 + rr * math.sin(t)
            bead(leaf_u, y, leaf_out, 0.17, 0.35, 0.16, LIGHT, 10)
            bead(leaf_u, y + 0.14, leaf_out + 0.025, 0.12, 0.10, 0.13, STONE, 10)
        for sign in [-1, 1]:
          pts = [
            point(
              u + sign * (0.38 + 0.14 * math.cos(t)), 23.59 + 0.12 * math.sin(t), 1.30
            )
            for t in np.linspace(0, 2 * math.pi, 15)
          ]
          path(pts, 0.035, STONE, 10)
        # Small grooves articulate the existing roof statue robes, no new figures.
        for shift in [-0.22, -0.11, 0, 0.11, 0.22]:
          rod(
            point(u + shift, 26.50, 0.78),
            point(u + shift * 0.5, 27.65, 0.73),
            0.019,
            SHADE,
            11,
          )
      # Paired recessed portal leaves keep original glass/transom and stone frame.
      for sign in [-1, 1]:
        uu = span / 2 + sign * 0.82
        for y in [5.85, 6.74, 7.63]:
          box(uu, y, 1.29, 0.73, 0.08, 0.67, METAL, 12)
          box(uu, y, 1.05, 0.50, 0.06, 0.74, 0x606251, 12)
        rod(
          point(span / 2 + sign * 0.20, 6.23, 0.83),
          point(span / 2 + sign * 0.20, 6.76, 0.83),
          0.029,
          0xB8A16A,
          12,
        )
      for sign in [-1, 1]:
        for y in [6.2, 7.4, 8.6]:
          box(span / 2 + sign * 1.89, y, 0.22, 0.13, 0.27, 0.69, LIGHT, 12)

  # Independent orthogonal accents. Submillimetre plaster lines stay a drawn
  # surface cue; native priorities are capitals, arch relief and panelled doors.
  native = {}

  def put(p: list, color: int, size: float = 0.22) -> None:
    key = (size, *(round(float(v) / 0.11) for v in p))
    native[key] = [round(float(v), 4) for v in p] + [size, size, size, color]

  for r in beads:
    if r[7] in [2, 4, 5, 6, 7, 10]:
      native[(r[7], *r[:3])] = r[:3] + [
        max(0.22, r[3]),
        max(0.22, r[4]),
        max(0.22, r[5]),
        r[6],
      ]
  for x, y, z, w, h, depth, yaw, color, role in boxes:
    if role not in [2, 6, 9, 12]:
      continue
    count = max(1, math.ceil(w / 0.55))
    for i in range(count):
      u = -w / 2 + (i + 0.5) * w / count
      native[(role, x, y, z, i)] = [
        round(x + math.cos(yaw) * u, 4),
        y,
        round(z - math.sin(yaw) * u, 4),
        max(0.22, w / count * abs(math.cos(yaw)) + depth * abs(math.sin(yaw))),
        max(0.22, h),
        max(0.22, w / count * abs(math.sin(yaw)) + depth * abs(math.cos(yaw))),
        color,
      ]
  for r in rods:
    if r[8] not in [5, 10, 12]:
      continue
    a, b = np.array(r[:3]), np.array(r[3:6])
    for t in np.linspace(0, 1, max(2, math.ceil(np.linalg.norm(b - a) / 0.22))):
      put(a + (b - a) * t, r[7])
  return {
    "schemaVersion": 1,
    "building": "Humboldt-Universität main building, Unter den Linden 6",
    "lod2ParentId": previous["parent_id"],
    "sourcePartIds": [p["id"] for p in previous["parts"]],
    "osmIdentity": "relation/6647",
    "existingPrismOwner": "ion-6647",
    "newReplacedOwners": [],
    "sourceArchive": {
      "url": previous["source_url"],
      "sha256": previous["source_sha256"],
    },
    "preservedFiles": [
      {
        "path": str(p.relative_to(ROOT)),
        "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
      }
      for p in [SOURCE, FACADES, SHELLS]
    ],
    "sourceBoundaryPolygons": sum(len(p["surfaces"]) for p in previous["parts"]),
    "axes": axes,
    "boxes": boxes,
    "rods": rods,
    "beads": beads,
    "nativeBoxes": list(native.values()),
    "roles": {
      "1": "fine plaster courses",
      "2": "cornice dentils and egg cues",
      "3": "additional glazing and fanlight bars",
      "4": "central arch keystones",
      "5": "botanical garlands",
      "6": "sill brackets",
      "7": "turned baluster bellies",
      "8": "six column flutes",
      "9": "rear pilasters",
      "10": "capital leaf tiers and volutes",
      "11": "existing robe folds",
      "12": "paired entry door panels",
    },
    "sourcePolicy": "Additive ornament only. All previous measured building surfaces, source roofs, court holes, gateway, sculptural silhouettes and native models remain unchanged. New local dimensions and relief patterns are display estimates supported by primary architectural descriptions and inspected free visual references.",
  }


def main() -> None:
  data = build()
  DEST.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  nav = {
    "lod2ParentId": data["lod2ParentId"],
    "osmIdentity": data["osmIdentity"],
    "newReplacedOwners": [],
    "newCollisionSolids": [],
    "newRoofSupport": [],
    "sourceGroundY": -1.245,
    "streetThresholdY": 5.2,
    "sourceTopY": 25.018,
    "policy": "Surface ornament only; existing Bebelplatz source roof/court and gate collision remain authoritative. No new ground obstruction or roof plane.",
  }
  DEST.with_name("humboldtMainV168Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print({k: len(data[k]) for k in ["axes", "boxes", "rods", "beads", "nativeBoxes"]})


if __name__ == "__main__":
  main()
