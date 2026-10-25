"""Step 10: bounded Pressehaus/North Alexander source-wall recognition receipts."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import Point, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "src/app/src/data/alexanderNorthV166Evidence.json"
SELECTION = {
  "slab": {
    "DEBE3DwHEnY2xVWt": [3, 9, 10],
    "DEBE3DfvcP9k77JN": [6],
    "DEBE3DJGKUpKTlcc": [2, 4],
    "DEBE3DZHJwwSZ1UQ": [0],
  },
  "stair": {"DEBE3DqRXYItwESq": [0, 4, 5]},
  "cafe": {"DEBE3DJG5XjFMrAD": [3, 8], "DEBE3DkpFVqv5thH": [5, 6]},
  "podium": {"DEBE3DWqlqIzTp04": [4, 6]},
}
WHITE, GREY, GLASS, DARK = 0xE9E9E1, 0xADB3B3, 0x71818A, 0x59666C


def digest(value: object) -> str:
  """Fingerprint immutable retained evidence independently of file formatting."""
  return hashlib.sha256(
    json.dumps(value, separators=(",", ":"), sort_keys=True).encode()
  ).hexdigest()


def build() -> dict:
  """Derive contained facade fittings; never alter a source surface or envelope."""
  raw = (ROOT / SOURCE).read_bytes()
  evidence = json.loads(raw)
  faces, rows = [], []
  for role, selection in SELECTION.items():
    for part in evidence["parts"]:
      for index in selection.get(part["id"], []):
        surface = part["surfaces"][index]
        assert surface["kind"] == "WallSurface"
        ring = surface["rings"][0]
        a, b = max(
          ((a, b) for a in ring for b in ring),
          key=lambda pair: math.hypot(pair[1][0] - pair[0][0], pair[1][2] - pair[0][2]),
        )
        length = math.hypot(b[0] - a[0], b[2] - a[2])
        dx, dz = (b[0] - a[0]) / length, (b[2] - a[2]) / length
        nx, nz = dz, -dx
        footprint = Polygon(part["ring"], part["holes"])
        if footprint.covers(
          Point((a[0] + b[0]) / 2 + nx * 0.1, (a[2] + b[2]) / 2 + nz * 0.1)
        ):
          nx, nz = -nx, -nz
        local = [
          [[(q[0] - a[0]) * dx + (q[2] - a[2]) * dz, q[1]] for q in r]
          for r in surface["rings"]
        ]
        polygon = Polygon(local[0], local[1:])
        face_id = len(faces)
        faces.append(
          {
            "role": role,
            "parent": part["parentId"],
            "part": part["id"],
            "surface": index,
            "surfaceSha256": digest(surface),
            "a": [a[0], a[2]],
            "b": [b[0], b[2]],
            "normal": [nx, nz],
            "localRings": local,
          }
        )

        def emit(
          u: float,
          y: float,
          width: float,
          height: float,
          colour: int,
          out: float = 0.57,
          depth: float = 0.12,
        ) -> None:
          values = [round(v, 3) for v in [u, y, width, height, out, depth]]
          u, y, width, height, _, _ = values
          if polygon.buffer(-0.025).covers(
            box(u - width / 2, y - height / 2, u + width / 2, y + height / 2)
          ):
            rows.append([face_id, *values, colour])

        if role == "slab":
          # Reference: the reconstructed deep white brise-soleil is not the
          # generic v166 small punched-window rhythm. Exact shallow backing
          # fields precede it while all old source and facade rows remain.
          for floor in range(16):
            bottom = 6.6 + floor * 3.68
            emit(length / 2, bottom + 1.84, length - 0.12, 3.65, GREY, 0.40)
            emit(length / 2, bottom + 1.95, length - 0.18, 1.62, GLASS, 0.49)
            emit(length / 2, bottom + 0.34, length - 0.12, 0.65, WHITE, 0.82, 0.55)
            bays = max(1, round(length / 1.16))
            for bay in range(1, bays):
              emit(length * bay / bays, bottom + 2.0, 0.095, 1.72, WHITE, 0.61)
          bays = max(1, round(length / 4.65))
          for bay in range(bays + 1):
            # Trim each fin against the same measured wall; upper and lower
            # segments stay separate around non-rectangular source cuts.
            u = 0.18 + (length - 0.36) * bay / bays
            for floor in range(16):
              emit(u, 8.44 + floor * 3.68, 0.26, 3.65, WHITE, 0.92, 0.78)
        elif role == "stair":
          for floor in range(18):
            bottom = 6.9 + floor * 3.68
            emit(length / 2, bottom + 1.7, length - 0.16, 3.36, GLASS, 0.40)
            emit(length / 2, bottom + 0.35, length - 0.12, 0.67, WHITE, 0.65, 0.34)
            for u in [0.18, length / 3, length * 2 / 3, length - 0.18]:
              emit(u, bottom + 1.84, 0.13, 3.62, WHITE, 0.66)
        elif role == "cafe":
          emit(length / 2, 8.45, length - 0.13, 9.55, 0xB8B6AA, 0.40)
          for bottom in [3.35, 7.8]:
            emit(length / 2, bottom + 1.45, length - 0.19, 2.9, DARK, 0.50)
            for bay in range(max(1, round(length / 2.5)) + 1):
              u = 0.18 + (length - 0.36) * bay / max(1, round(length / 2.5))
              emit(u, bottom + 1.45, 0.14, 2.94, WHITE, 0.68)
            emit(length / 2, bottom + 3.0, length - 0.12, 0.18, WHITE, 0.65)
          emit(length / 2, 7.05, length - 0.10, 1.05, 0xCAC8BA, 0.60, 0.36)
          # Recognise the location and warm/cool character of the protected
          # Neubert frieze without tracing or reproducing its composition.
          n = max(1, round(length / 2.8))
          colours = [0xB95D46, 0xC79860, 0x6C9099, 0xD7CFB7, 0x9A594C]
          for j in range(n):
            emit(
              (j + 0.5) * length / n,
              12.45,
              length / n - 0.04,
              2.12,
              colours[j % len(colours)],
              0.61,
            )
          emit(length / 2, 13.66, length - 0.12, 0.21, WHITE, 0.70, 0.30)
        else:
          # New Podium's measured sloping roof silhouette remains untouched;
          # this adds its visible vertical silver fins over the old low fronts.
          for floor in range(4):
            y = 5.05 + floor * 3.72
            emit(length / 2, y, length - 0.16, 3.6, 0x758B91, 0.4)
            emit(length / 2, y - 1.65, length - 0.12, 0.18, WHITE, 0.66)
          n = max(1, round(length / 1.6))
          for j in range(n + 1):
            emit(0.15 + (length - 0.30) * j / n, 10.8, 0.16, 14.2, 0xCED5D2, 0.72, 0.48)
  old = {
    "drawn": {
      "count": 150,
      "sha256": "2d4182338a42d47a524114906c2672bf9fd5ad9c493890a706eae2e972e3a4d6",
    },
    "native": {
      "count": 595,
      "sha256": "8cac53a4639ecfc9da31c16f6d0a8d0beafd9e5b4595bf99ac1ed4179de91a70",
    },
    "unrelatedDrawn": {
      "count": 214,
      "sha256": "3685753bfa95087a4e5f0a04cf801114f05537cce3f8e280bdc56d06681c5201",
    },
    "unrelatedNative": {
      "count": 983,
      "sha256": "8e981e55633312164468851d776264bbd73ff1072fb1ec29bdbbb4585e0e9990",
    },
  }
  return {
    "schema": 1,
    "sourcePath": SOURCE,
    "sourceSha256": hashlib.sha256(raw).hexdigest(),
    "sourcePartCount": len(evidence["parts"]),
    "faces": faces,
    "panels": rows,
    "retiredSignReceipt": old,
    "crown": {
      "centre": [2756.45, 77.3, -553.15],
      "radius": 3.2,
      "height": 2.6,
      "text": "BERLINER VERLAG",
      "periodSeconds": 90,
    },
    "historicalRoofText": "BERLINER ZEITUNG",
    "policy": "Retain every measured surface and earlier facade row. Exact shallow wall fields cover only generic prior window estimates. Retire only the fingerprinted inaccurate v166 two-flat-word crown. The separate BERLINER ZEITUNG lettering is the user's requested historical reinstatement, not a claimed present-day installation. Small fittings, glyphs and rotation period are display estimates.",
  }


if __name__ == "__main__":
  target = ROOT / "src/app/src/data/alexanderNorthV272.json"
  target.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
