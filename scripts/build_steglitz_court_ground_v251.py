"""Mapped Steglitz sports ground, with reference-only courtyard photograph detail."""

from __future__ import annotations

import json
import math

from build_steglitz_school_v250 import DATA, GEO, ROOT, SCHOOL, fingerprint, read, sha
from build_steglitz_v182 import world
from shapely.geometry import LineString, Polygon, shape
from shapely.ops import transform, unary_union

OUT = DATA / "steglitzCourtGroundV251.json"
FLOOR = DATA / "steglitzCourtGroundV251Floor.json"
EVIDENCE = GEO / "steglitz-court-ground-v251-evidence.json"
RAW = GEO / "raw/v182-steglitz"
ORIGIN = [-3250, 3.55, 6820]
# Palette indices keep the small offline addition compact.
RED, WHITE, YELLOW, BLUE, PAVING, METAL, BLACK, ORANGE, CONCRETE, BARK, LEAF = range(11)
PALETTE = [
  0xAA514A,
  0xEBE9D8,
  0xE2CD58,
  0x4F83AA,
  0xA9A99E,
  0x939B98,
  0x39413F,
  0xCB673E,
  0xC2C2B4,
  0x71604A,
  0x6B8050,
]
PHOTOS = "/tmp/codex-remote-attachments/01a07905-2d69-7ec1-914c-28ee2c8f6d85/62908D5D-235A-461D-AD29-0109F5E52649"


def mapped_way(identity: str) -> Polygon:
  feature = next(
    f
    for f in read(RAW / "multipolygons.json")["features"]
    if str(f["properties"].get("osm_way_id")) == identity
  )
  geom = transform(world, shape(feature["geometry"]))
  return (
    max(geom.geoms, key=lambda p: p.area) if geom.geom_type == "MultiPolygon" else geom
  )


def row_polygon(row: list, native: bool = False) -> Polygon:
  x, _, z, w, _, d = row[:6]
  yaw = 0 if native else row[6]
  c, s = math.cos(yaw), math.sin(yaw)
  return Polygon(
    [
      (x + u * c + v * s, z - u * s + v * c)
      for u, v in [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
    ]
  )


def build() -> tuple[dict, dict]:
  navigation = read(DATA / "steglitzV182Navigation.json")
  school_parts = [
    b
    for b in navigation["buildings"]
    if b["owner"]
    in {
      SCHOOL,
      "DEBE06YYB0000nL1",
      "DEBE06YYB0000nx8",
    }
  ]
  solids = unary_union([Polygon(b["ring"], b["holes"]) for b in school_parts])
  campus = mapped_way("387263944")
  pitches = [mapped_way(identity) for identity in ["1107082380", "1107082381"]]
  drawn, rods, native = [], [], []
  ranges = []

  def prism(x, y, z, w, h, d, color, yaw=0, block=True):
    drawn.append([x, y, z, w, h, d, yaw, color])
    if block:
      native.append([x, y, z, w, h, d, color])

  def beam(a, b, width, color):
    rods.append([*a, *b, width, color])
    # Native members use an independently orthogonal staircase, never a
    # rotated drawn cube. Long near-axis members merge into coarse safe runs.
    delta = [b[k] - a[k] for k in range(3)]
    axis = max(range(3), key=lambda k: abs(delta[k]))
    cross = max(abs(delta[k]) for k in range(3) if k != axis)
    steps = max(1, math.ceil(cross / max(width, 0.20)))
    for i in range(steps):
      p = [a[k] + delta[k] * (i + 0.5) / steps for k in range(3)]
      size = [width] * 3
      size[axis] = abs(delta[axis]) / steps + width * 0.25
      native.append([*p, *size, color])

  def paint(points, color, width=0.10):
    for a, b in zip(points, points[1:]):
      beam([a[0], 3.57, a[1]], [b[0], 3.57, b[1]], width, color)

  def record(name, action):
    start = [len(drawn), len(rods), len(native)]
    action()
    ranges.append(
      {
        "name": name,
        "boxes": [start[0], len(drawn)],
        "rods": [start[1], len(rods)],
        "native": [start[2], len(native)],
      }
    )

  frames = []
  for pitch in pitches:
    points = list(pitch.exterior.coords)
    a, b = points[0], points[1]
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dz)
    direction, across = (dx / length, dz / length), (-dz / length, dx / length)
    center = tuple(pitch.centroid.coords[0])
    depth = pitch.area / length
    yaw = -math.atan2(dz, dx)

    # The map quadrilateral is almost rectangular; a 4cm edge inset makes
    # the single drawn slab fully source-contained rather than expanding it.
    def at(u, v, c=center, d=direction, n=across):
      return (c[0] + u * d[0] + v * n[0], c[1] + u * d[1] + v * n[1])

    frames.append((at, length, depth, yaw))
    prism(
      *[center[0], 3.49, center[1]], length - 0.08, 0.12, depth - 0.08, RED, yaw, False
    )
    # Independently axis-aligned floor strips, clipped inward at both ends.
    x0, z0, x1, z1 = pitch.bounds
    count = math.ceil((z1 - z0) / 1.1)
    for j in range(count):
      lo = z0 + j * (z1 - z0) / count + (0.025 if j == 0 else 0)
      hi = z0 + (j + 1) * (z1 - z0) / count - (0.025 if j == count - 1 else 0)
      sections = [
        pitch.intersection(LineString([(x0 - 1, z), (x1 + 1, z)])) for z in [lo, hi]
      ]
      if all(s.geom_type == "LineString" and s.length > 0.1 for s in sections):
        left = max(s.bounds[0] for s in sections) + 0.03
        right = min(s.bounds[2] for s in sections) - 0.03
        if right > left:
          native.append(
            [(left + right) / 2, 3.49, (lo + hi) / 2, right - left, 0.12, hi - lo, RED]
          )
  # Photo-visible stone margins immediately beside the mapped fields. No
  # campus-wide paving or speculative under-building floor is introduced.
  for at, w, d, yaw in frames:
    for side in [-1, 1]:
      p = at(0, side * (d / 2 + 0.42))
      row = [p[0], 3.49, p[1], w - 0.25, 0.12, 0.65, yaw, PAVING]
      if campus.covers(row_polygon(row)) and not solids.intersects(row_polygon(row)):
        drawn.append(row)
        # A modest axis-aligned inset, split where the long border changes z.
        for j in range(math.ceil(w / 4)):
          n = math.ceil(w / 4)
          q = at(-w / 2 + (j + 0.5) * w / n, side * (d / 2 + 0.42))
          native.append([q[0], 3.49, q[1], w / n - 0.10, 0.12, 0.35, PAVING])
  ground_counts = [len(drawn), len(native)]

  def handball():
    at, w, d, _ = frames[0]
    end = w / 2 - 1.65
    half = d / 2 - 1.3
    paint(
      [at(-end, -half), at(end, -half), at(end, half), at(-end, half), at(-end, -half)],
      WHITE,
    )
    paint([at(0, -half), at(0, half)], WHITE)
    for side in [-1, 1]:
      # Curves reproduce the photographed handball pattern schematically;
      # radii/paint widths have not been surveyed.
      for radius, dashed in [(5.8, False), (8.4, True)]:
        for i in range(12):
          if dashed and i % 2:
            continue
          points = [
            at(side * (end - radius * math.cos(t)), radius * math.sin(t))
            for t in [
              -math.pi / 2 + math.pi * i / 12,
              -math.pi / 2 + math.pi * (i + 1) / 12,
            ]
          ]
          paint(points, WHITE, 0.09)
      for t in [-0.65, 0, 0.65]:
        paint([at(side * (end - 0.3), t), at(side * (end + 0.25), t)], WHITE, 0.09)
    # Short track-style ticks along the photographed southern white line.
    for i in range(13):
      u = -end + 1.2 + i * (2 * end - 2.4) / 12
      paint([at(u, half - 0.05), at(u, half + 0.32)], WHITE, 0.09)

  record("photographed white handball markings", handball)

  def basketball():
    at, w, d, _ = frames[1]
    hw = w / 2 - 0.9
    hd = d / 2 - 1.2
    paint([at(-hw, -hd), at(hw, -hd), at(hw, hd), at(-hw, hd), at(-hw, -hd)], YELLOW)
    paint([at(-hw, 0), at(hw, 0)], YELLOW)
    paint(
      [
        at(1.4 * math.cos(t), 1.4 * math.sin(t))
        for t in [i * math.tau / 12 for i in range(13)]
      ],
      YELLOW,
    )
    for side in [-1, 1]:
      paint(
        [
          at(-1.6, side * hd),
          at(-1.6, side * (hd - 3.6)),
          at(1.6, side * (hd - 3.6)),
          at(1.6, side * hd),
        ],
        YELLOW,
      )
      paint(
        [
          at(3.7 * math.sin(t), side * (hd - 1.1 - 3.7 * math.cos(t)))
          for t in [-math.pi / 2 + i * math.pi / 10 for i in range(11)]
        ],
        YELLOW,
        0.09,
      )
    # A second, blue rectangular register is visible in the owner's overview.
    paint(
      [
        at(-hw + 0.55, -hd + 0.8),
        at(hw - 0.55, -hd + 0.8),
        at(hw - 0.55, hd - 0.8),
        at(-hw + 0.55, hd - 0.8),
        at(-hw + 0.55, -hd + 0.8),
      ],
      BLUE,
      0.085,
    )

  record("yellow basketball and blue inset markings", basketball)

  def hoops():
    at, _, d, yaw = frames[1]
    for side in [-1, 1]:
      p = at(0, side * (d / 2 + 0.48))
      q = at(0, side * (d / 2 - 1.32))
      prism(p[0], 5.18, p[1], 0.15, 3.26, 0.15, METAL)
      beam([p[0], 6.4, p[1]], [q[0], 6.78, q[1]], 0.13, METAL)
      # Backboard front faces into the mapped basketball rectangle.
      prism(q[0], 6.70, q[1], 1.5, 0.92, 0.09, WHITE, yaw, False)
      native.append([q[0], 6.70, q[1], 1.5, 0.92, 0.09, WHITE])
      board = at(0, side * (d / 2 - 1.39))
      beam(
        [board[0] - 0.28, 6.6, board[1]], [board[0] + 0.28, 6.6, board[1]], 0.045, BLACK
      )
      hoop = at(0, side * (d / 2 - 1.67))
      for i in range(8):
        t, s = i * math.tau / 8, (i + 1) * math.tau / 8
        beam(
          [hoop[0] + 0.23 * math.cos(t), 6.38, hoop[1] + 0.23 * math.sin(t)],
          [hoop[0] + 0.23 * math.cos(s), 6.38, hoop[1] + 0.23 * math.sin(s)],
          0.045,
          ORANGE,
        )

  record("two mapped basketball hoops", hoops)

  def goal():
    at, w, _, _ = frames[0]
    # Small black grid goal is on the handball court's Aula-side end, not
    # directly against the gabled entrance and not an opaque collision wall.
    for back in [False, True]:
      u = w / 2 - 1.6 + (0.65 if back else 0)
      for v in [-1.5, 1.5]:
        p = at(u, v)
        beam([p[0], 3.55, p[1]], [p[0], 5.55 if not back else 5.15, p[1]], 0.07, BLACK)
      a, b = at(u, -1.5), at(u, 1.5)
      beam(
        [a[0], 5.55 if not back else 5.15, a[1]],
        [b[0], 5.55 if not back else 5.15, b[1]],
        0.07,
        BLACK,
      )
    u = w / 2 - 0.95
    for v in [-1, -0.5, 0, 0.5, 1]:
      p = at(u, v)
      beam([p[0], 3.6, p[1]], [p[0], 5.15, p[1]], 0.035, BLACK)
    for y in [4, 4.5, 5]:
      a, b = at(u, -1.5), at(u, 1.5)
      beam([a[0], y, a[1]], [b[0], y, b[1]], 0.035, BLACK)
    for v in [-1.5, 1.5]:
      a, b = at(w / 2 - 1.6, v), at(w / 2 - 0.95, v)
      beam([a[0], 5.55, a[1]], [b[0], 5.15, b[1]], 0.05, BLACK)

  record("photo-visible black grid goal", goal)

  tables = [[-3262.5, 6806.5], [-3250.0, 6806.1], [-3238.0, 6807.5]]

  def table_tennis():
    for x, z in tables:
      prism(x, 4.31, z, 2.74, 0.12, 1.52, CONCRETE)
      for dx in [-0.8, 0.8]:
        prism(x + dx, 3.90, z, 0.22, 0.7, 1.05, CONCRETE)
      beam([x, 4.39, z - 0.76], [x, 4.39, z + 0.76], 0.055, WHITE)
      prism(x, 4.48, z, 0.045, 0.24, 1.52, METAL)

  record("three photo-visible table tennis tables", table_tennis)

  points = read(RAW / "points.json")["features"]
  tree_ids = [
    "11394188656",
    "11394188657",
    "11394188660",
    "11394188661",
    "11394188662",
    "11394188663",
  ]
  trees = []

  def tree_detail():
    for identity in tree_ids:
      f = next(f for f in points if str(f["properties"].get("osm_id")) == identity)
      x, z = world(*f["geometry"]["coordinates"])
      mature = identity in [tree_ids[0], tree_ids[1], tree_ids[-1]]
      height = 8.4 if mature else 3.7
      width = 4.5 if mature else 1.3
      trees.append(
        {"id": f"node/{identity}", "point": [x, z], "heightEstimate": height}
      )
      prism(
        x,
        3.55 + height * 0.32,
        z,
        0.30 if mature else 0.11,
        height * 0.64,
        0.30 if mature else 0.11,
        BARK,
      )
      # Static layered crowns reuse the existing cube batch. Native crowns
      # are axis-aligned from inception and introduce no foliage texture.
      for dx, dz, s in [
        (0, 0, 1),
        (-0.29, 0.1, 0.72),
        (0.28, 0.12, 0.76),
        (0, -0.28, 0.70),
      ]:
        prism(
          x + dx * width,
          3.55 + height * 0.7,
          z + dz * width,
          width * s,
          height * 0.35,
          width * s,
          LEAF,
        )

  record("six retained OSM courtyard tree anchors", tree_detail)

  def compact(rows, rod=False):
    return [
      [
        round(v - ORIGIN[i % 3], 3)
        if i < (6 if rod else 3)
        else round(v, 4)
        if i == 6 and not rod and len(r) == 8
        else round(v, 3)
        if i < len(r) - 1
        else v
        for i, v in enumerate(r)
      ]
      for r in rows
    ]

  data = {
    "version": 251,
    "owner": SCHOOL,
    "origin": ORIGIN,
    "palette": PALETTE,
    "sourceReceipt": fingerprint(school_parts),
    "groundCounts": ground_counts,
    "boxes": compact(drawn),
    "rods": compact(rods, True),
    "nativeRows": compact(native),
  }
  evidence = {
    "version": 251,
    "owner": SCHOOL,
    "sourceReceipt": data["sourceReceipt"],
    "sourceSha256": {
      str(p.relative_to(ROOT)): sha(p)
      for p in [
        RAW / "multipolygons.json",
        RAW / "points.json",
        DATA / "steglitzV182Navigation.json",
        DATA / "steglitzV182Source.json",
        DATA / "steglitzV182Native.json",
      ]
    },
    "courtSources": [
      {"id": f"way/{identity}", "ring": list(p.exterior.coords)}
      for identity, p in zip(["1107082380", "1107082381"], pitches)
    ],
    "schoolBoundary": "way/387263944",
    "floorY": 3.55,
    "groundCounts": ground_counts,
    "recognitionRanges": ranges,
    "trees": trees,
    "tableEstimates": tables,
    "counts": {"drawnBoxes": len(drawn), "drawnRods": len(rods), "native": len(native)},
    "photos": [f"{PHOTOS}/{i}-Pasted-Image-{i}.jpg" for i in range(1, 6)],
    "policy": "Mapped pitch rings, 2 hoops and tree anchors. Paint pattern, hoop/goal/table positions and sizes and crown dimensions are photo-led estimates. All measured walls/roofs retained; no old row removed; no whole-court collision. Full mobile detail; independent orthogonal native rows; existing batch only.",
    "camera": {"position": [-3231, 21, 6840], "target": [-3252, 4, 6819]},
  }
  # Every new ground slab lies on the mapped campus, outside measured bodies.
  for rows, is_native in [
    (drawn[: ground_counts[0]], False),
    (native[: ground_counts[1]], True),
  ]:
    for row in rows:
      polygon = row_polygon(row, is_native)
      assert campus.buffer(0.002).covers(polygon)
      assert not polygon.intersects(solids)
  return data, evidence


def floor_profile(data: dict) -> dict:
  """Small navigation-only floor rows: never import the detailed render model."""
  return {
    "origin": [ORIGIN[0], ORIGIN[2]],
    "topY": ORIGIN[1],
    "bounds": [-3284, 6808, -3223, 6836],
    "drawn": [
      [r[0], r[2], r[3], r[5], r[6]] for r in data["boxes"][: data["groundCounts"][0]]
    ],
    "native": [
      [r[0], r[2], r[3], r[5]] for r in data["nativeRows"][: data["groundCounts"][1]]
    ],
  }


if __name__ == "__main__":
  content, evidence = build()
  OUT.write_text(json.dumps(content, separators=(",", ":")) + "\n")
  FLOOR.write_text(json.dumps(floor_profile(content), separators=(",", ":")) + "\n")
  EVIDENCE.write_text(json.dumps(evidence, indent=2) + "\n")
  print(OUT.name, OUT.stat().st_size, "bytes", evidence["counts"])
