"""Step 10: shallow cornice/plinth depth on retained Scheunenviertel walls."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import nearest_points, unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/scheunenviertel-v168.json"
DEST = ROOT / "src/app/src/data/scheunenFacadesV183.json"


def footprint(building: dict[str, Any]) -> Any:
  """Read complete source grounds, including all courtyard holes."""
  return unary_union(
    [
      Polygon(
        [(p[0], p[2]) for p in s["rings"][0]],
        [[(p[0], p[2]) for p in r] for r in s["rings"][1:]],
      ).buffer(0)
      for part in building["parts"]
      for s in part["surfaces"]
      if s["kind"] == "GroundSurface"
    ]
  )


def build(source: dict[str, Any]) -> dict[str, Any]:
  """Use at most one longest, clear street wall for each eligible source parent."""
  records = {
    b["id"]: b
    for name in ["buildings", "retainedDetailedBuildings"]
    for b in source[name]
  }
  quarter = shape(source["scope"])
  roads = unary_union([shape(r["geometry"]) for r in source["roads"]])
  occupied = unary_union([footprint(b) for b in records.values()])
  boxes: list[list[float]] = []
  native: list[list[float]] = []
  faces = []
  for owner, building in sorted(records.items()):
    if owner in source["excludedDetailedOwners"]:
      continue
    candidates = []
    for part in building["parts"]:
      for surface in part["surfaces"]:
        if surface["kind"] != "WallSurface":
          continue
        pts = np.array(surface["rings"][0])
        n = np.zeros(3)
        for i in range(1, len(pts) - 1):
          n += np.cross(pts[i] - pts[0], pts[i + 1] - pts[0])
        norm = float(np.linalg.norm(n))
        if norm < 0.01 or abs(n[1] / norm) > 0.03:
          continue
        n /= norm
        a, b = max(
          ((a, b) for a in pts for b in pts),
          key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
        )
        d = np.array([b[0] - a[0], 0, b[2] - a[2]], dtype=float)
        length = float(np.linalg.norm(d))
        if length < 8:
          continue
        d /= length
        wall = Polygon(
          [(float(np.dot(p - a, d)), p[1]) for p in pts],
          [
            [(float(np.dot(np.array(p) - a, d)), p[1]) for p in r]
            for r in surface["rings"][1:]
          ],
        ).buffer(0)
        lo, base, hi, top = wall.bounds
        if top - base < 10 or base > 3.5:
          continue
        center = a + d * ((lo + hi) / 2)
        plan = Point(center[0], center[2])
        nearest = nearest_points(plan, roads)[1]
        vx, vz = nearest.x - plan.x, nearest.y - plan.y
        distance = math.hypot(vx, vz)
        if distance > 22 or distance < 0.1 or (vx * n[0] + vz * n[2]) / distance < 0.7:
          continue
        segment = LineString(
          [(a[0] + d[0] * lo, a[2] + d[2] * lo), (a[0] + d[0] * hi, a[2] + d[2] * hi)]
        )
        if not quarter.covers(segment):
          continue
        if any(
          occupied.covers(Point(center[0] + n[0] * v, center[2] + n[2] * v))
          for v in [1, 3, 5]
        ):
          continue
        candidates.append((length, part["id"], surface, a, d, n, wall))
    if not candidates:
      continue
    length, part_id, surface, a, d, n, wall = max(candidates, key=lambda item: item[0])
    lo, base, hi, top = wall.bounds
    yaw = -math.atan2(d[2], d[0])
    first = len(boxes)
    nf = len(native)
    # Profile adds genuine shallow depth around the old v168 flat cornice. It
    # never emits another pane, full wall, shop sign, doorway or courtyard face.
    profiles = [
      (top - 0.38, 0.16, 0.37, 0.30, 0xDBD4C1, "projecting eave cap"),
      (top - 0.53, 0.09, 0.20, 0.26, 0x888A7F, "cornice undercut"),
      (base + 0.50, 0.70, 0.16, 0.18, 0xB8B2A0, "low plinth"),
      (base + 0.90, 0.08, 0.24, 0.23, 0xD6CEBB, "plinth lip"),
    ]
    for y, h, depth, offset, color, role in profiles:
      strip = wall.intersection(box(lo + 0.1, y - h / 2, hi - 0.1, y + h / 2))
      for poly in (
        [strip] if strip.geom_type == "Polygon" else getattr(strip, "geoms", [])
      ):
        if poly.geom_type != "Polygon":
          continue
        left, bot, right, up = poly.bounds
        if right - left < 1 or not wall.covers(box(left, bot, right, up)):
          continue
        u = (left + right) / 2
        p = a + d * u + n * offset
        boxes.append(
          [
            *[
              round(v, 3)
              for v in [p[0], (bot + up) / 2, p[2], right - left, up - bot, depth]
            ],
            round(yaw, 6),
            color,
          ]
        )
        if role not in ["projecting eave cap", "low plinth"]:
          continue
        count = max(1, math.ceil((right - left) / 1.4))
        for i in range(count):
          u = left + (i + 0.5) * (right - left) / count
          p = a + d * u + n * 1.30
          native.append(
            [
              *[
                round(v, 3)
                for v in [
                  p[0],
                  (bot + up) / 2,
                  p[2],
                  max(0.35, abs(d[0]) * 1.45),
                  up - bot,
                  max(0.35, abs(d[2]) * 1.45),
                ]
              ],
              color,
            ]
          )
    if len(boxes) > first:
      faces.append(
        {
          "parentId": owner,
          "partId": part_id,
          "rings": surface["rings"],
          "normal": [round(v, 6) for v in n],
          "firstBox": first,
          "boxCount": len(boxes) - first,
          "firstNative": nf,
          "nativeCount": len(native) - nf,
        }
      )
  return {
    "schemaVersion": 1,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "faces": faces,
    "boxes": boxes,
    "nativeRows": native,
    "policy": "One clear street wall per source parent; only shallow eave/plinth members. Source shells, windows, tenant signs, courts, native surfaces and packets remain unchanged. Profile widths/depths/colours are neighbourhood display estimates, not per-building surveys.",
  }


def main() -> None:
  """Build compact standalone additions without rebuilding any city packet."""
  result = build(json.loads(SOURCE.read_text()))
  faces = result.pop("faces")
  native = result.pop("nativeRows")
  (ROOT / "geo_data/regierungsviertel/scheunen-facades-v183-evidence.json").write_text(
    json.dumps(
      {
        "faces": faces,
        "sourceSha256": result["sourceSha256"],
        "policy": result["policy"],
      },
      separators=(",", ":"),
    )
    + "\n"
  )
  DEST.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  DEST.with_name("scheunenFacadesV183Native.json").write_text(
    json.dumps({"nativeRows": native}, separators=(",", ":")) + "\n"
  )
  print(
    {
      "faces": len(faces),
      "boxes": len(result["boxes"]),
      "native": len(native),
      "bytes": DEST.stat().st_size,
    }
  )


if __name__ == "__main__":
  main()
