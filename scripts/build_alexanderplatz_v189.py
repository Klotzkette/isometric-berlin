"""Step 10: shallow Haus des Reisens recognition over unchanged source packets."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src/data"
SOURCE = GEO / "alt-mitte-v169/source-392_5820-00.json.gz"
PARENT = "DEBE01YYK000079q"
TOWER = {"DEBE3DmWlV6OWmD4", "DEBE3DzaoFCR9Gu1"}
PODIUM = {"DEBE3DnW9EyzIo28": 6, "DEBE3DUGF4z5vluW": 4}


def build() -> tuple[dict, dict, dict]:
  """Emit only surface members; retain the complete original building as evidence."""
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  building = next(b for b in source["buildings"] if b["id"] == PARENT)
  boxes, native, faces = [], [], []
  counts: dict[str, int] = {}

  def record(
    a: np.ndarray,
    d: np.ndarray,
    n: np.ndarray,
    u: float,
    y: float,
    w: float,
    h: float,
    depth: float,
    out: float,
    color: int,
    role: str,
    pitch: float = 0,
    native_member: bool = True,
  ) -> None:
    p = a + d * u + n * out
    yaw = -math.atan2(d[2], d[0])
    boxes.append(
      [
        *[round(float(v), 5) for v in [p[0], y, p[2], w, h, depth, yaw, pitch]],
        color,
      ]
    )
    counts[role] = counts.get(role, 0) + 1
    if not native_member:
      return
    # Independently orthogonal surface accents clear the retained 2 m source
    # envelope. No source facade or full building block is replaced.
    steps = max(1, math.ceil(w / 1.8))
    for i in range(steps):
      q = a + d * (u - w / 2 + (i + 0.5) * w / steps) + n * (out + 1.05)
      native.append(
        [
          *[
            round(float(v), 5)
            for v in [
              q[0],
              y,
              q[2],
              max(0.18, abs(d[0]) * w / steps + abs(n[0]) * depth),
              max(0.12, h),
              max(0.18, abs(d[2]) * w / steps + abs(n[2]) * depth),
            ]
          ],
          color,
        ]
      )

  for part in building["parts"]:
    for index, surface in enumerate(part["surfaces"]):
      if surface["kind"] != "WallSurface":
        continue
      pts = np.array(surface["rings"][0])
      normal = np.zeros(3)
      for i in range(1, len(pts) - 1):
        normal += np.cross(pts[i] - pts[0], pts[i + 1] - pts[0])
      if np.linalg.norm(normal) < 0.01:
        continue
      normal /= np.linalg.norm(normal)
      if abs(normal[1]) > 0.01:
        continue
      a, b = max(
        ((a, b) for a in pts for b in pts),
        key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
      )
      length = math.hypot(b[0] - a[0], b[2] - a[2])
      if length < 8:
        continue
      d = np.array([b[0] - a[0], 0, b[2] - a[2]]) / length
      if np.dot(np.array([-d[2], 0, d[0]]), normal) < 0:
        a, b, d = b, a, -d
      n = np.array([-d[2], 0, d[0]])
      wall = Polygon(
        [(float(np.dot(p - a, d)), float(p[1])) for p in pts],
        [
          [(float(np.dot(np.array(p) - a, d)), p[1]) for p in ring]
          for ring in surface["rings"][1:]
        ],
      ).buffer(0)
      lo, base, hi, top = wall.bounds
      first, first_native = len(boxes), len(native)
      if part["id"] in TOWER and top - base > 40:
        # Seventeen source-tagged storeys include the two-storey podium.
        # Repeated dimensions below are a visual fit, never facade survey data.
        lower, upper, floors = 14.8, 69.4, 15
        floor_pitch = (upper - lower) / floors
        # The retained generic windows use a different row pitch. A thin
        # source-contained backing covers that old display rhythm only where
        # this new curtain wall is actually supplied. Its outer face is 0.32 m
        # from the wall; the new glazing starts at 0.325 m and faces outwards.
        backing = box(lo + 0.02, lower, hi - 0.02, upper)
        assert wall.covers(backing)
        record(
          a,
          d,
          n,
          (lo + hi) / 2,
          (lower + upper) / 2,
          hi - lo - 0.04,
          upper - lower,
          0.06,
          0.29,
          0xC0C2B7,
          "source-contained-curtain-wall-backing",
          native_member=False,
        )
        for floor in range(floors):
          bottom = lower + floor * floor_pitch
          for y, height, depth, out, color, role, native_member in [
            (bottom + 1.95, 2.5, 0.11, 0.38, 0x668594, "window-band", False),
            (bottom + 0.46, 0.60, 0.20, 0.49, 0xCACAC1, "aluminium-spandrel", True),
            (bottom + 1.05, 0.12, 0.28, 0.62, 0xDDDCD1, "projecting-sill", False),
            (bottom + 3.34, 0.15, 0.18, 0.51, 0xDDDCD1, "upper-frame", False),
          ]:
            strip = box(lo + 0.12, y - height / 2, hi - 0.12, y + height / 2)
            if wall.covers(strip):
              record(
                a,
                d,
                n,
                (lo + hi) / 2,
                y,
                hi - lo - 0.24,
                height,
                depth,
                out,
                color,
                role,
                native_member=native_member,
              )
        bays = max(3, round(length / 2.4))
        for i in range(bays + 1):
          u = lo + 0.18 + (hi - lo - 0.36) * i / bays
          strip = box(u - 0.055, lower + 0.1, u + 0.055, upper - 0.1)
          if wall.covers(strip):
            record(
              a,
              d,
              n,
              u,
              (lower + upper) / 2,
              0.11,
              upper - lower - 0.2,
              0.22,
              0.66,
              0xDDDCD1,
              "continuous-aluminium-mullion",
            )
      elif PODIUM.get(part["id"]) == index:
        # Two measured, exposed long podium edges only. Eight short members
        # make each thin concave concrete shell; no roof slab is replaced.
        count = max(1, round(length / 2.3))
        width = (length - 0.24) / count
        for bay in range(count):
          u = lo + 0.12 + (bay + 0.5) * width
          for step in range(8):
            t0, t1 = step / 8, (step + 1) / 8
            out0, out1 = 0.08 + t0 * 1.15, 0.08 + t1 * 1.15
            y0, y1 = top + 0.08 + 1.25 * t0**2, top + 0.08 + 1.25 * t1**2
            record(
              a,
              d,
              n,
              u,
              (y0 + y1) / 2,
              width - 0.16,
              0.14,
              math.hypot(out1 - out0, y1 - y0),
              (out0 + out1) / 2,
              0xDBD9CA,
              "curved-podium-shell",
              -math.atan2(y1 - y0, out1 - out0),
              native_member=step % 2 == 0,
            )
      if len(boxes) > first:
        faces.append(
          {
            "partId": part["id"],
            "surfaceIndex": index,
            "rings": surface["rings"],
            "normal": n.tolist(),
            "firstBox": first,
            "boxCount": len(boxes) - first,
            "firstNative": first_native,
            "nativeCount": len(native) - first_native,
          }
        )
  digest = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
  common = {
    "schemaVersion": 1,
    "parentId": PARENT,
    "osmId": "way/24273225",
    "sourceSha256": digest,
    "fullStaticDetailOnTouch": True,
  }
  drawn = {**common, "boxes": boxes, "counts": counts}
  blocks = {**common, "boxes": native}
  evidence = {
    **common,
    "sourcePath": str(SOURCE.relative_to(ROOT)),
    "building": copy.deepcopy(building),
    "faces": faces,
    "policy": "Additive thin recognition members only. Every old source sheet, facade, packet and navigation record remains unchanged. Seven source-contained upper-facade backing planes mask the superseded generic window rhythm only behind the new drawn curtain wall. No reconstructed plaza, ground modification, current-work claim, relief tracing, image texture or new tour stop.",
    "displayEstimates": "Material swatches, 15 upper window rows, bay pitch, member sections and repeated shell curvature are visual estimates. Source heights and six original parts are retained.",
    "sources": [
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09020852",
      "https://www.museum-der-1000-orte.de/kunstwerke/kunstwerk/der-mensch-uberwindet-zeit-und-raum",
    ],
    "camera": {"target": [3074, 37, -394], "distance": 150},
  }
  return drawn, blocks, evidence


def main() -> None:
  """Write this isolated supplement without touching existing city assets."""
  drawn, native, evidence = build()
  for path, data in [
    (APP / "alexanderplatzV189.json", drawn),
    (APP / "alexanderplatzV189Native.json", native),
    (GEO / "alexanderplatz-v189-evidence.json", evidence),
  ]:
    path.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      {
        "drawn": len(drawn["boxes"]),
        "native": len(native["boxes"]),
        "faces": len(evidence["faces"]),
        "roles": drawn["counts"],
      }
    )
  )


if __name__ == "__main__":
  main()
