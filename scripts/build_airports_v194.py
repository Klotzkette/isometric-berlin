"""Step 10: complete retained Tempelhof sheets and bounded Tegel recognition."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_breitscheid_towers_v161 import normal_of, triangles_for
from shapely.geometry import LineString, Point, Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "airports-v194-source.json"


def native_surfaces(surfaces: list[dict], boxes: list[list]) -> list[list]:
  """Independent 2m exterior lattice; exact greedy union, never filled buildings."""
  cells = {}
  grid = 2.0
  for surf in surfaces:
    for tri in surf["triangles"]:
      a, b, c = np.array(tri)
      n = max(
        1,
        math.ceil(
          max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
          / 1.15
        ),
      )
      # Bounded rows avoid quadratic temporary arrays on broad roof triangles.
      for i in range(n + 1):
        points = a + (b - a) * i / n + np.arange(n - i + 1)[:, None] * (c - a) / n
        keys = np.unique(np.floor(points / grid).astype(int), axis=0)
        for key in keys:
          cells[tuple(key)] = surf["color"]
  # Finer facade marks remain one independent, axis-aligned exterior skin.
  details = []
  for x, y, z, w, h, d, yaw, color in boxes:
    n = max(1, math.ceil(w / 2))
    for i in range(n):
      u = (i + 0.5) * w / n - w / 2
      details.append(
        [
          round(x + math.cos(yaw) * u, 4),
          y,
          round(z - math.sin(yaw) * u, 4),
          abs(math.cos(yaw)) * w / n + abs(math.sin(yaw)) * d,
          h,
          abs(math.sin(yaw)) * w / n + abs(math.cos(yaw)) * d,
          color,
        ]
      )
  lines = {}
  for (x, y, z), color in cells.items():
    lines.setdefault((y, z, color), []).append(x)
  runs = []
  for (y, z, color), xs in sorted(lines.items()):
    xs.sort()
    start = end = xs[0]
    for x in [*xs[1:], None]:
      if x is not None and x == end + 1:
        end = x
        continue
      runs.append(
        [
          (start + end + 1) * grid / 2,
          (y + 0.5) * grid,
          (z + 0.5) * grid,
          (end - start + 1) * grid,
          grid,
          grid,
          color,
        ]
      )
      start = end = x
  # Join adjacent Z bands only when full X extent, height and colour match.
  bands = {}
  for x, y, z, w, h, d, c in runs:
    bands.setdefault((x, y, w, h, c), []).append(z)
  result = []
  for (x, y, w, h, c), zs in sorted(bands.items()):
    zs.sort()
    start = end = zs[0]
    for z in [*zs[1:], None]:
      if z is not None and abs(z - end - grid) < 1e-8:
        end = z
        continue
      result.append([x, y, (start + end) / 2, w, h, end - start + grid, c])
      start = end = z
  stacks = {}
  for x, y, z, w, h, d, c in result:
    stacks.setdefault((x, z, w, d, c), []).append(y)
  merged = []
  for (x, z, w, d, c), ys in sorted(stacks.items()):
    ys.sort()
    start = end = ys[0]
    for y in [*ys[1:], None]:
      if y is not None and abs(y - end - grid) < 1e-8:
        end = y
        continue
      merged.append([x, (start + end) / 2, z, w, end - start + grid, d, c])
      start = end = y
  return merged + details


def flat_native(poly: Polygon, y: float, color: int) -> list[list]:
  """2m horizontal strips within an exact mapped surface, no volume sampling."""
  rows = []
  minx, minz, maxx, maxz = poly.bounds
  for iz in range(math.floor(minz / 2), math.ceil(maxz / 2)):
    # Require both band edges within the footprint; small residual remains drawn-only stair tolerance.
    a = poly.intersection(
      LineString([(minx - 1, iz * 2 + 0.001), (maxx + 1, iz * 2 + 0.001)])
    )
    b = poly.intersection(
      LineString([(minx - 1, iz * 2 + 1.999), (maxx + 1, iz * 2 + 1.999)])
    )
    for ga in getattr(a, "geoms", [a]):
      for gb in getattr(b, "geoms", [b]):
        if ga.is_empty or gb.is_empty:
          continue
        lo = max(ga.bounds[0], gb.bounds[0])
        hi = min(ga.bounds[2], gb.bounds[2])
        if hi > lo:
          rows.append([(lo + hi) / 2, y - 0.04, iz * 2 + 1, hi - lo, 0.08, 2, color])
  return rows


def build() -> dict:
  src = json.loads(SOURCE.read_text())
  surfaces = []
  boxes = []
  flat = []
  native_flat = []
  nav = []
  facades = []

  def surface(rings: list, color: int, role: str) -> None:
    ts = triangles_for(rings)
    if ts:
      surfaces.append({"color": color, "role": role, "triangles": ts})

  def plane(poly, y: float, color: int) -> None:
    for p in getattr(poly, "geoms", [poly]):
      if p.geom_type != "Polygon":
        continue
      rings = [[[x, y, z] for x, z in r.coords] for r in [p.exterior, *p.interiors]]
      flat.append({"color": color, "triangles": triangles_for(rings)})
      native_flat.extend(flat_native(p, y, color))

  def prism(poly, bottom: float, top: float, wall: int, roof: int, owner: str) -> None:
    for p in getattr(poly, "geoms", [poly]):
      if p.geom_type != "Polygon":
        continue
      surface(
        [[[x, top, z] for x, z in r.coords] for r in [p.exterior, *p.interiors]],
        roof,
        "roof",
      )
      for ring in [p.exterior, *p.interiors]:
        for a, b in zip(ring.coords, list(ring.coords)[1:]):
          surface(
            [
              [
                [a[0], bottom, a[1]],
                [b[0], bottom, b[1]],
                [b[0], top, b[1]],
                [a[0], top, a[1]],
              ]
            ],
            wall,
            "wall",
          )
      nav.append(
        {
          "id": owner,
          "rings": [list(p.exterior.coords), *[list(r.coords) for r in p.interiors]],
          "minY": bottom,
          "maxY": top,
        }
      )

  # Exact retained LoD2 sheets replace only six coarse parent envelopes.
  for parent in src["parents"]:
    for s in parent["surfaces"]:
      if s["kind"] == "GroundSurface":
        continue
      pts = [p for ring in s["rings"] for p in ring]
      bottom = min(p[1] for p in pts)
      top = max(p[1] for p in pts)
      plan = Polygon(
        [(p[0], p[2]) for p in s["rings"][0]],
        [[(p[0], p[2]) for p in r] for r in s["rings"][1:]],
      ).buffer(0)
      if plan.area < 0.05:
        a, b = max(
          ((a, b) for a in pts for b in pts),
          key=lambda q: (q[1][0] - q[0][0]) ** 2 + (q[1][2] - q[0][2]) ** 2,
        )
        plan = LineString([(a[0], a[2]), (b[0], b[2])]).buffer(0.12, cap_style=2)
      for q in getattr(plan, "geoms", [plan]):
        if q.geom_type == "Polygon" and q.area > 0.001:
          nav.append(
            {
              "id": parent["id"] + "/" + s["id"],
              "rings": [
                list(q.exterior.coords),
                *[list(r.coords) for r in q.interiors],
              ],
              "minY": bottom - 0.16 if s["kind"] == "RoofSurface" else bottom,
              "maxY": max(top, bottom + 0.16),
            }
          )
      surface(
        s["rings"],
        0xAAA69A if s["kind"] == "RoofSurface" else 0xB6A788,
        "tempelhof-source",
      )
      if s["kind"] != "WallSurface":
        continue
      ring = np.array(s["rings"][0])
      n = np.array(normal_of(ring.tolist()))
      if abs(n[1]) > 0.03:
        continue
      a, b = max(
        ((a, b) for a in ring for b in ring),
        key=lambda q: np.linalg.norm((q[1] - q[0])[[0, 2]]),
      )
      delta = (b - a)[[0, 2]]
      length = np.linalg.norm(delta)
      if length < 9:
        continue
      direction = delta / length
      low = float(min(ring[:, 1]))
      high = float(max(ring[:, 1]))
      height = high - low
      if height < 5:
        continue
      centre = ring.mean(axis=0)
      towards = np.array([1350 - centre[0], 4750 - centre[2]])
      towards /= np.linalg.norm(towards)
      entrance = s["id"] == "UUID_2760c007-1fc2-41d9-abae-f4e80bd91795"
      hangar = (
        parent["id"].endswith("0088X")
        and height > 10
        and np.dot(n[[0, 2]], towards) > 0.65
      )
      # Preserve small returns and roof recesses without inventing facade rhythm.
      if (
        not entrance
        and not hangar
        and not (parent["id"].endswith(("002ol", "008Ks", "02daO")) and height > 8)
      ):
        continue
      projected = Polygon(
        [[(p[[0, 2]] - a[[0, 2]]) @ direction, p[1]] for p in ring]
      ).buffer(-0.08)
      yaw = -math.atan2(direction[1], direction[0])
      count = max(1, round(length / (3.35 if entrance else 3 if hangar else 4)))
      for i in range(count):
        u = (i + 0.5) * length / count
        w = min(2.3, length / count * 0.62)
        levels = (
          [(low + 10.2, 8.8), (low + 19.7, 2.5), (low + 23.3, 2.5)]
          if entrance
          else [(low + height * 0.48, min(12, height - 2))]
          if hangar
          else [(y, 2.15) for y in np.arange(low + 2.4, high - 1.4, 3.7)]
        )
        for y, h in levels:
          if not projected.covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
            continue
          if entrance:
            xz = a[[0, 2]] + direction * u + n[[0, 2]] * 0.12
            boxes.append(
              [
                float(xz[0]),
                float(y),
                float(xz[1]),
                w + 0.34,
                h + 0.34,
                0.10,
                yaw,
                0xD5C9AD,
              ]
            )
            facades.append(
              {
                "box": len(boxes) - 1,
                "normal": n[[0, 2]].tolist(),
                "owner": parent["id"],
                "sourcePolygon": s["id"],
              }
            )
          # 2m source-native skin needs bounded proud native members; normal recorded below.
          xz = a[[0, 2]] + direction * u + n[[0, 2]] * (0.25 if entrance else 0.14)
          boxes.append(
            [
              float(xz[0]),
              float(y),
              float(xz[1]),
              w,
              h,
              0.12,
              yaw,
              0x45564F if hangar else 0x546465,
            ]
          )
          facades.append(
            {
              "box": len(boxes) - 1,
              "normal": n[[0, 2]].tolist(),
              "owner": parent["id"],
              "sourcePolygon": s["id"],
            }
          )
          xz = a[[0, 2]] + direction * u + n[[0, 2]] * (0.36 if entrance else 0.24)
          boxes.append(
            [
              float(xz[0]),
              float(y),
              float(xz[1]),
              0.09,
              h,
              0.07,
              yaw,
              0xA8A58C if hangar else 0xD5C9AD,
            ]
          )
          facades.append(
            {
              "box": len(boxes) - 1,
              "normal": n[[0, 2]].tolist(),
              "owner": parent["id"],
              "sourcePolygon": s["id"],
            }
          )
  # Both former Tegel runways: all five exact mapped sections, tagged 46m width.
  runways = []
  for f in src["features"]:
    if f["site"] != "tegel":
      continue
    g = shape(f["geometry"])
    tags = f["tags"]
    if g.geom_type == "LineString":
      width = float(tags["width"])
      poly = g.buffer(width / 2, cap_style=2, join_style=2)
      plane(poly, 3.08, 0x737774)
      runways.append(
        {
          "id": f["id"],
          "ref": tags.get("ref"),
          "lengthM": g.length,
          "widthM": width,
          "coordinates": list(g.coords),
        }
      )
      # Sparse centre dashes are display cues, not surveyed present-day paint.
      for start in np.arange(35, g.length - 30, 65):
        a, b = g.interpolate(start), g.interpolate(min(start + 23, g.length))
        dx, dz = b.x - a.x, b.y - a.y
        boxes.append(
          [
            (a.x + b.x) / 2,
            3.12,
            (a.y + b.y) / 2,
            math.hypot(dx, dz),
            0.025,
            0.45,
            -math.atan2(dz, dx),
            0xC3C5B8,
          ]
        )
      continue
    if f["id"] == "way/24378177":
      p = max(g.geoms, key=lambda p: p.area)
      centre = p.centroid

      def scaled(scale):
        return Polygon(
          [
            (centre.x + (x - centre.x) * scale, centre.y + (z - centre.y) * scale)
            for x, z in p.exterior.coords
          ]
        )

      # Two distinct control cabins on the exact mapped tower anchor; all profiles within source footprint.
      for scale, bottom, top, col in [
        (0.37, 3, 22, 0xBFC2B6),
        (0.76, 22, 25, 0xBFC2B6),
        (1, 25, 35, 0xAEB6AD),
        (0.32, 35, 41, 0xBFC2B6),
        (0.64, 41, 45, 0xBFC2B6),
        (0.73, 45, 52, 0x40585C),
        (0.75, 52, 53, 0xAEB6AD),
      ]:
        prism(scaled(scale), bottom, top, col, 0x919D98, f["id"])
      for bottom, top, scale in [(26, 29, 1), (32, 34, 1)]:
        p = scaled(scale)
        for a, b in zip(p.exterior.coords, list(p.exterior.coords)[1:]):
          dx, dz = b[0] - a[0], b[1] - a[1]
          length = math.hypot(dx, dz)
          boxes.append(
            [
              (a[0] + b[0]) / 2,
              (bottom + top) / 2,
              (a[1] + b[1]) / 2,
              length,
              top - bottom,
              0.18,
              -math.atan2(dz, dx),
              0x40585C,
            ]
          )
      continue
    heights = {
      "relation/13234": 10.5,
      "relation/611684": 3.3,
      "way/24378140": 17.5,
      "way/24378279": 7,
      "way/56455515": 10.5,
      "way/56459643": 8,
    }
    h = heights[f["id"]]
    prism(g, 3, 3 + h, 0xBCC1B5, 0x9FA79F, f["id"])
    if f["id"] in ["relation/13234", "way/24378140"]:
      for p in g.geoms:
        for ring in [p.exterior, *p.interiors]:
          for a, b in zip(ring.coords, list(ring.coords)[1:]):
            dx, dz = b[0] - a[0], b[1] - a[1]
            length = math.hypot(dx, dz)
            if length < 5:
              continue
            for y in [6.2, 10.2] if h < 15 else [6.2, 10.2, 14.2, 18.2]:
              boxes.append(
                [
                  (a[0] + b[0]) / 2,
                  y,
                  (a[1] + b[1]) / 2,
                  length,
                  1.85,
                  0.22,
                  -math.atan2(dz, dx),
                  0x465F61,
                ]
              )
              normal = [dz / length, -dx / length]
              if p.contains(
                Point(
                  (a[0] + b[0]) / 2 + normal[0] * 0.1,
                  (a[1] + b[1]) / 2 + normal[1] * 0.1,
                )
              ):
                normal = [-v for v in normal]
              facades.append(
                {
                  "box": len(boxes) - 1,
                  "normal": normal,
                  "owner": f["id"],
                  "sourcePolygon": f["id"],
                }
              )
              for i in range(1, max(2, round(length / 3))):
                t = i / max(2, round(length / 3))
                boxes.append(
                  [
                    a[0] + dx * t,
                    y,
                    a[1] + dz * t,
                    0.12,
                    1.85,
                    0.32,
                    -math.atan2(dz, dx),
                    0xC7CCBD,
                  ]
                )
                facades.append(
                  {
                    "box": len(boxes) - 1,
                    "normal": normal,
                    "owner": f["id"],
                    "sourcePolygon": f["id"],
                  }
                )
  # Source-normal shifts only affect native recognition marks; source sheets remain unshifted.
  native_boxes = [r.copy() for r in boxes]
  for f in facades:
    r = native_boxes[f["box"]]
    r[0] += f["normal"][0] * 1.7
    r[2] += f["normal"][1] * 1.7
  native = native_surfaces(surfaces, native_boxes) + native_flat
  payload = {
    "surfaces": surfaces + flat,
    "boxes": boxes,
    "blocks": native,
    "navigation": nav,
  }
  DATA.joinpath("airportsV194.json").write_text(
    json.dumps(payload, separators=(",", ":")) + "\n"
  )
  evidence = {
    "version": "1.0.94",
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "tempelhofOwners": [p["id"] for p in src["parents"]],
    "sourceSurfaceCount": sum(len(p["surfaces"]) for p in src["parents"]),
    "runways": runways,
    "facadeCount": len(facades),
    "counts": {
      "triangles": sum(len(s["triangles"]) for s in payload["surfaces"]),
      "boxes": len(boxes),
      "nativeBlocks": len(native),
    },
    "estimates": "Facade bays, material swatches, Tegel terminal heights lacking height tags, stepped tower cabin proportions, and runway centre dashes are display estimates. Historic reference appearance, no claim about current airport operations. Exact mapped runway sections retained despite inconsistent legacy length tags.",
  }
  GEO.joinpath("airports-v194-evidence.json").write_text(
    json.dumps(evidence, indent=2) + "\n"
  )
  return evidence


if __name__ == "__main__":
  print(json.dumps(build()["counts"]))
