"""Small, explicit photograph-guided details for six exact religious source owners."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from shapely.geometry import Polygon, box


def decorate(site: dict[str, Any]) -> None:
  """Keep authoritative sheets distinct from documented display estimates."""
  rows: list[list[float]] = []
  estimated: list[dict[str, Any]] = []
  details: list[dict[str, Any]] = []
  wall_color, roof_color = site["wallColor"], site["roofColor"]
  pale, dark = (0xD1B99A, 0x38454B)

  def tri(a, b, c, color, feature):
    estimated.append({"points": [a, b, c], "color": color, "feature": feature})

  def quad(a, b, c, d, color, feature):
    tri(a, b, c, color, feature)
    tri(a, c, d, color, feature)

  def member(a, b, section, color):
    rows.append([*a, *b, section, color])

  def panel(frame, u, y, w, h, pointed=False):
    a, tangent, normal = frame

    def p(uu, yy, out=0.105):
      return [
        a[0] + tangent[0] * uu + normal[0] * out,
        yy,
        a[1] + tangent[1] * uu + normal[1] * out,
      ]

    radius = w / 2
    spring = y + h - radius * (1.35 if pointed else 1)
    outline = [p(u - radius, y), p(u + radius, y), p(u + radius, spring)]
    for i in range(1, 13):
      theta = i * math.pi / 12
      rise = 1.35 * (1 - abs(math.cos(theta))) ** 0.65 if pointed else math.sin(theta)
      outline.append(p(u + radius * math.cos(theta), spring + radius * rise))
    center = p(u, y + h * 0.45)
    for i in range(len(outline)):
      tri(
        center,
        outline[i],
        outline[(i + 1) % len(outline)],
        dark,
        "estimated arch glazing",
      )
      member(outline[i], outline[(i + 1) % len(outline)], 0.13, pale)
    member(p(u, y + 0.1, 0.15), p(u, spring + radius * 0.65, 0.15), 0.09, pale)
    member(
      p(u - radius, y + h * 0.36, 0.15), p(u + radius, y + h * 0.36, 0.15), 0.09, pale
    )

  def rose(frame, u, y, r):
    a, t, n = frame

    def p(uu, yy):
      return [a[0] + t[0] * uu + n[0] * 0.16, yy, a[1] + t[1] * uu + n[1] * 0.16]

    center = p(u, y)
    points = [
      p(u + r * math.cos(i * math.tau / 24), y + r * math.sin(i * math.tau / 24))
      for i in range(24)
    ]
    for i in range(24):
      tri(center, points[i], points[(i + 1) % 24], dark, "estimated rose glazing")
      member(points[i], points[(i + 1) % 24], 0.16, pale)
    for i in range(8):
      member(center, points[i * 3], 0.12, pale)

  def frame_of(a, b, n=None):
    length = math.dist(a, b)
    t = [(b[i] - a[i]) / length for i in range(2)]
    return (a, t, n or [-t[1], t[0]])

  # Every repeated window's entire rectangle stays inside the exact source wall.
  for wi, wall in enumerate(site["walls"]):
    poly = Polygon(wall["polygon"])
    length = wall["length"]
    frame = frame_of(wall["a"], wall["b"], wall["normal"])
    height = wall["high"] - wall["low"]
    if height < 5 or length < 2.2:
      continue
    pitch = 4.4 if site["id"] == "rykestrasse" else 3.3
    count = max(1, int(length / pitch))
    width = min(1.65, length / count * 0.53)
    levels = [(wall["low"] + 2.2, min(6.2, height - 3.3))]
    if site["id"] == "rykestrasse" and height > 10:
      levels = [(5.2, 3.4), (10.3, 2.7)]
    if site["id"] == "sehitlik":
      levels = [(5.0, 3.7), (10.1, 2.7)]
    for j in range(count):
      u = (j + 0.5) * length / count
      for y, h in levels:
        if h < 2 or not poly.buffer(-0.12).covers(
          box(u - width / 2, y, u + width / 2, y + h)
        ):
          continue
        panel(
          frame,
          u,
          y,
          width,
          h,
          site["id"] in ("gethsemane", "samariter", "wilmersdorf"),
        )
        details.append(
          {"wallIndex": wi, "u": u, "bottomY": y, "width": width, "height": h}
        )
    # Thin masonry cornice follows only the exact, unoccluded source face.
    if poly.buffer(0.001).covers(
      box(0.12, wall["low"] + 0.7, length - 0.12, wall["low"] + 0.85)
    ):
      a, t, n = frame
      member(
        [
          a[0] + t[0] * 0.12 + n[0] * 0.13,
          wall["low"] + 0.78,
          a[1] + t[1] * 0.12 + n[1] * 0.13,
        ],
        [
          a[0] + t[0] * (length - 0.12) + n[0] * 0.13,
          wall["low"] + 0.78,
          a[1] + t[1] * (length - 0.12) + n[1] * 0.13,
        ],
        0.14,
        pale,
      )

  def profile(cx, cz, levels, sides, color, feature, phase=0):
    for (y0, r0), (y1, r1) in zip(levels, levels[1:]):
      for i in range(sides):
        t0 = phase + i * math.tau / sides
        t1 = phase + (i + 1) * math.tau / sides
        a = [cx + r0 * math.cos(t0), y0, cz + r0 * math.sin(t0)]
        b = [cx + r0 * math.cos(t1), y0, cz + r0 * math.sin(t1)]
        c = [cx + r1 * math.cos(t1), y1, cz + r1 * math.sin(t1)]
        d = [cx + r1 * math.cos(t0), y1, cz + r1 * math.sin(t0)]
        quad(a, b, c, d, color, feature)

  def tower(cx, cz, tx, tz, w, d, base, eave, top):
    tx, tz = np.array([tx, tz]) / math.hypot(tx, tz)
    corners = [
      [cx + u * tx - v * tz, cz + u * tz + v * tx]
      for u, v in [(-d / 2, -w / 2), (d / 2, -w / 2), (d / 2, w / 2), (-d / 2, w / 2)]
    ]
    # Footprint is wholly inside the documented western source tower lobe.
    assert Polygon(site["navigation"][0]["ring"]).buffer(0.02).covers(Polygon(corners))
    for i, a in enumerate(corners):
      b = corners[(i + 1) % 4]
      frame = frame_of(a, b)
      midpoint = [(a[j] + b[j]) / 2 for j in range(2)]
      if np.dot(frame[2], np.array(midpoint) - [cx, cz]) < 0:
        frame = (frame[0], frame[1], [-v for v in frame[2]])
      quad(
        [*a[:1], base, a[1]],
        [b[0], base, b[1]],
        [b[0], eave, b[1]],
        [a[0], eave, a[1]],
        wall_color,
        "estimated western tower upper shaft",
      )
      length = math.dist(a, b)
      for u in [length * 0.34, length * 0.66]:
        panel(frame, u, eave - 9, 0.95, 6.5, True)
      rose(frame, length / 2, eave - 12, 1.0)
      for y in [base + 1, eave - 10, eave]:
        member([a[0], y, a[1]], [b[0], y, b[1]], 0.24, pale)
    phase = math.atan2(tz, tx) + math.pi / 4
    profile(
      cx,
      cz,
      [(eave, w * 0.67), (eave + 2, w * 0.54), (top, 0.03)],
      8,
      0x65867F if site["id"] == "gethsemane" else roof_color,
      "estimated tall church spire",
      phase,
    )
    member([cx, top, cz], [cx, top + 1.4, cz], 0.15, pale)
    member(
      [cx - 0.6 * tx, top + 0.9, cz - 0.6 * tz],
      [cx + 0.6 * tx, top + 0.9, cz + 0.6 * tz],
      0.13,
      pale,
    )
    site["recognition"].append(
      {
        "feature": "western tower and spire",
        "anchor": [cx, cz],
        "footprint": corners,
        "baseY": base,
        "eaveY": eave,
        "topY": top + 1.4,
        "status": "Source-contained tower plan; height and subdivisions are photograph-proportioned display estimates.",
      }
    )

  site["recognition"] = []
  if site["id"] == "gethsemane":
    tower(3077.25, -3132.2, 0.972, -0.235, 7, 6, 17.74, 43, 61)
    for anchor in [(3110, -3124), (3102, -3154)]:
      wall = min(
        site["walls"],
        key=lambda w: math.dist(
          [(w["a"][j] + w["b"][j]) / 2 for j in range(2)], anchor
        ),
      )
      rose(
        frame_of(wall["a"], wall["b"], wall["normal"]), wall["length"] / 2, 14.2, 1.6
      )
  elif site["id"] == "samariter":
    tower(6427.9, 235.1, 0.952, 0.306, 8, 6, 16, 39, 61)
  elif site["id"] == "passion":
    cx, cz = 1673.2, 3307.9
    profile(
      cx,
      cz,
      [(29, 5.2), (37.5, 5.2)],
      8,
      wall_color,
      "estimated octagonal central belfry",
    )
    profile(
      cx,
      cz,
      [(37.5, 5.8), (39, 5.2), (49, 0.1)],
      8,
      roof_color,
      "estimated central patterned roof",
    )
    for i in range(8):
      t = i * math.tau / 8
      tn = (i + 1) * math.tau / 8
      a = [cx + 5.2 * math.cos(t), cz + 5.2 * math.sin(t)]
      b = [cx + 5.2 * math.cos(tn), cz + 5.2 * math.sin(tn)]
      f = frame_of(a, b, [math.cos((t + tn) / 2), math.sin((t + tn) / 2)])
      for u in [1.25, 2.65]:
        panel(f, u, 31.3, 0.8, 4.3)
    for anchor in [(1659.2, 3307.3), (1674, 3294)]:
      wall = min(
        site["walls"],
        key=lambda w: math.dist(
          [(w["a"][j] + w["b"][j]) / 2 for j in range(2)], anchor
        ),
      )
      rose(
        frame_of(wall["a"], wall["b"], wall["normal"]), wall["length"] / 2, 19.2, 2.0
      )
    site["recognition"].append(
      {
        "feature": "central octagonal belfry",
        "anchor": [cx, cz],
        "topY": 49,
        "status": "Official heritage description and permitted photo; source-centred display proportions, not measured height.",
      }
    )
  elif site["id"] == "wilmersdorf":
    cx, cz = -4146.72, 3397.2
    levels = [
      (12.5, 4.7),
      (14, 5.2),
      (16.5, 5.35),
      (19, 4.7),
      (21.4, 3.5),
      (23.7, 1.7),
      (25.642, 0.06),
    ]
    profile(
      cx,
      cz,
      levels,
      24,
      roof_color,
      "estimated curved Mughal dome replacing identified coarse crown",
    )
    for i in range(12):
      t = i * math.tau / 12
      for a, b in zip(levels, levels[1:]):
        member(
          [cx + a[1] * math.cos(t), a[0], cz + a[1] * math.sin(t)],
          [cx + b[1] * math.cos(t), b[0], cz + b[1] * math.sin(t)],
          0.07,
          0xB2B6AC,
        )
    for p in site["navigation"][-2:]:
      ring = p["ring"]
      x = sum(a[0] for a in ring) / len(ring)
      z = sum(a[1] for a in ring) / len(ring)
      top = p["topY"]
      profile(
        x,
        z,
        [
          (top - 5, 1.1),
          (top - 4.4, 1.45),
          (top - 3.1, 1.6),
          (top - 1.8, 1.05),
          (top, 0.03),
        ],
        16,
        roof_color,
        "estimated bulb cap within source minaret height",
      )
      profile(
        x,
        z,
        [(top - 7, 1.03), (top - 6.8, 1.55), (top - 6.4, 1.55), (top - 6.2, 1.03)],
        16,
        pale,
        "estimated source-anchored minaret balcony",
      )
    site["recognition"].append(
      {
        "feature": "curved dome and detached minaret balconies",
        "anchor": [cx, cz],
        "topY": 25.642,
        "status": "Complete original crown sheets retained in evidence; demonstrably coarse upper prisms are replaced at recorded cut levels by visually estimated curved profiles within source maximum heights.",
      }
    )
  elif site["id"] == "sehitlik":
    # Three circular inner rings of retained OSM relation 14114110 locate
    # the main dome and both minarets; not generic guessed corner offsets.
    cx, cz = 2504.082, 4224.089
    levels = [
      (14.848, 6.54),
      (16.2, 6.54),
      (17.6, 6.2),
      (19, 5.4),
      (20.4, 4.1),
      (21.6, 2.25),
      (22.3, 0.05),
    ]
    profile(
      cx, cz, levels, 32, roof_color, "estimated main dome on exact OSM circular hole"
    )
    for x, z in [(2491.816, 4227.828), (2508.745, 4212.136)]:
      profile(
        x,
        z,
        [
          (3, 1.18),
          (25.8, 1.18),
          (26, 1.9),
          (26.55, 1.9),
          (26.8, 1.05),
          (34, 1.05),
        ],
        16,
        0xD6CFBA,
        "OSM-ring anchored minaret; estimated shaft and single balcony",
      )
      profile(x, z, [(34, 1.13), (39.3, 0.04)], 16, 0x5B6266, "estimated minaret cone")
      member([x, 39.3, z], [x, 40.1, z], 0.14, 0xCFB56E)
    site["recognition"].append(
      {
        "feature": "central dome and two single-balcony minarets",
        "anchor": [cx, cz],
        "topY": 40.1,
        "osmRingId": "relation14114110",
        "status": "Circular footprints measured from retained OSM; 37.1 m total OSM height is treated as minaret envelope; dome and subdivision heights are visual estimates.",
      }
    )
  elif site["id"] == "rykestrasse":
    wall = min(
      site["walls"],
      key=lambda w: (
        math.dist([(w["a"][j] + w["b"][j]) / 2 for j in range(2)], [3226.7, -1740.3])
        + (0 if w["low"] > 14 else 10)
      ),
    )
    f = frame_of(wall["a"], wall["b"], wall["normal"])
    for u, r in [
      (wall["length"] * 0.22, 1.0),
      (wall["length"] * 0.5, 2.0),
      (wall["length"] * 0.78, 1.0),
    ]:
      rose(f, u, 19, r)
  # This source's three upper parts are coarse crown proxies, not real flat
  # mosque roofs. Preserve their complete originals; render only clipped lower
  # sheets and the explicit estimated profiles. No crown remains inside a dome.
  site["suppressedSourceTriangleIndices"] = []
  site["clippedSourceTriangles"] = []
  site["crownCorrections"] = []
  if site["id"] == "wilmersdorf":
    limits = {
      "DEBE3DXWJoAJ15h3": 12.5,
      **{p["id"]: p["topY"] - 5 for p in site["navigation"][-2:]},
    }
    for part_id, cut in limits.items():
      indices = []
      for index, triangle in enumerate(site["triangles"]):
        if (
          triangle["partId"] != part_id or max(p[1] for p in triangle["points"]) <= cut
        ):
          continue
        indices.append(index)
        polygon = triangle["points"]
        clipped = []
        for a, b in zip(polygon, polygon[1:] + polygon[:1]):
          if a[1] <= cut:
            clipped.append(a)
          if (a[1] <= cut) != (b[1] <= cut):
            t = (cut - a[1]) / (b[1] - a[1])
            clipped.append([a[j] + t * (b[j] - a[j]) for j in range(3)])
        for i in range(1, len(clipped) - 1):
          site["clippedSourceTriangles"].append(
            {**triangle, "points": [clipped[0], clipped[i], clipped[i + 1]]}
          )
      site["suppressedSourceTriangleIndices"].extend(indices)
      site["crownCorrections"].append(
        {
          "partId": part_id,
          "cutY": cut,
          "suppressedTriangleCount": len(indices),
          "reason": "Permitted visual reference shows curved dome/bulb crown; coarse flat source upper sheets would mask it. Original triangles and navigation retained unchanged as evidence; curved upper profile is a display estimate.",
        }
      )
    # A low shoulder deck closes the original square drum below the dome.
    part = next(p for p in site["navigation"] if p["id"] == "DEBE3DXWJoAJ15h3")
    ring = part["ring"]
    for a, b in zip(ring, ring[1:] + ring[:1]):
      tri(
        [-4146.72, 12.5, 3397.2],
        [a[0], 12.5, a[1]],
        [b[0], 12.5, b[1]],
        roof_color,
        "estimated low shoulder deck below dome",
      )
  site["members"] = rows
  site["estimatedTriangles"] = estimated
  site["windowEvidence"] = details
  # Native Minecraft is one separate axis-aligned, surface-only lattice.
  # Vertices plus <=.9m edge sampling preserve narrow ledges without filling rooms.
  cells: dict[tuple[int, int, int], int] = {}
  size = 0.9
  displayed = [
    t
    for i, t in enumerate(site["triangles"])
    if i not in site["suppressedSourceTriangleIndices"]
  ] + site["clippedSourceTriangles"]
  for triangle in displayed + estimated:
    a, b, c = [np.array(p) for p in triangle["points"]]
    n = max(
      1,
      math.ceil(
        max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b)) / size
      ),
    )
    for i in range(n + 1):
      for j in range(n + 1 - i):
        p = a + (b - a) * (i / n) + (c - a) * (j / n)
        cells[tuple(int(round(v / size)) for v in p)] = triangle["color"]
  for r in rows:
    a, b = np.array(r[:3]), np.array(r[3:6])
    n = max(1, math.ceil(np.linalg.norm(b - a) / 0.45))
    for i in range(n + 1):
      p = a + (b - a) * i / n
      cells[tuple(int(round(v / size)) for v in p)] = r[7]
  site["nativeBlocks"] = [
    [
      round(x * size, 3),
      round(y * size, 3),
      round(z * size, 3),
      size,
      size,
      size,
      color,
    ]
    for (x, y, z), color in sorted(cells.items())
  ]
  # MeshBasicMaterial needs a small baked face contrast to explain this curved
  # crown against its same-palette flat roof. Only these 384 drawn dome faces
  # change colour; source sheets, member colours and native cells stay exact.
  if site["id"] == "sehitlik":
    light = np.array([-0.5, 1, 0.5])
    light /= np.linalg.norm(light)
    for triangle in estimated:
      if triangle["feature"] != "estimated main dome on exact OSM circular hole":
        continue
      a, b, c = np.asarray(triangle["points"])
      normal = np.cross(b - a, c - a)
      normal /= np.linalg.norm(normal)
      midpoint = (a + b + c) / 3
      if np.dot(normal[[0, 2]], midpoint[[0, 2]] - [2504.082, 4224.089]) < 0:
        normal = -normal
      strength = float(np.dot(normal, light))
      triangle["color"] = (
        0x62767B if strength < 0.28 else 0x78878B if strength < 0.72 else 0x92A0A2
      )
