"""Step 10: small additive Steglitz fittings in the existing required batch.

Measured shells, previous window registers and all original packets are immutable.
Photographs support recognition only. Small fittings/tones remain estimates.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
from pyproj import Transformer
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
OUT = DATA / "steglitzV246Details.json"
EVIDENCE = GEO / "steglitz-details-v246-evidence.json"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SCHOOL = "DEBE06YYB0000AUq"


def read(path: Path) -> Any:
  return json.loads(path.read_bytes())


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def merge_boxes(rows: list) -> list:
  """Losslessly join adjacent same-material native rectangles, never fill gaps."""
  for axis in [1, 2, 0]:
    groups = defaultdict(list)
    for row in rows:
      key = tuple(round(v, 4) for i, v in enumerate(row) if i not in [axis, axis + 3])
      groups[key].append(row)
    result = []
    for group in groups.values():
      group.sort(key=lambda r: r[axis] - r[axis + 3] / 2)
      current = list(group[0])
      for row in group[1:]:
        low = row[axis] - row[axis + 3] / 2
        top = current[axis] + current[axis + 3] / 2
        if abs(low - top) < 0.00015:
          lo = current[axis] - current[axis + 3] / 2
          hi = row[axis] + row[axis + 3] / 2
          current[axis] = round((lo + hi) / 2, 4)
          current[axis + 3] = round(hi - lo, 4)
        else:
          result.append(current)
          current = list(row)
      result.append(current)
    rows = result
  return rows


def build() -> tuple[dict, dict]:
  """Only source-anchored additions; no rewriting earlier source payloads."""
  source = read(DATA / "steglitzV182Source.json")
  native = read(DATA / "steglitzV182Native.json")["boxes"]
  school = next(
    s for s in read(DATA / "schoolsPlacesV205.json")["schools"] if s["owner"] == SCHOOL
  )
  drawn, blocks, panes, road_receipts = [], [], [], []
  counts = {}

  def put(target: list, row: list) -> None:
    target.append([round(float(v), 4) for v in row[:-1]] + [row[-1]])

  def front(
    row: list,
    n: np.ndarray,
    offset: float,
    y: float,
    w: float,
    h: float,
    color: int,
    depth: float = 0.035,
  ) -> None:
    p = np.array(row[:3]) + n * offset
    put(drawn, [p[0], y, p[2], w, h, depth, row[6], color])

  # Three explicitly retained Heesestraße walls, with their already rendered
  # opening register. Glazing stays behind the older v205 frames and arches.
  for face in school["faces"]:
    points = np.array(face["rings"][0])
    n = np.array(face["normal"])
    a, b = max(
      ((a, b) for a in points for b in points),
      key=lambda p: np.linalg.norm((p[1] - p[0])[[0, 2]]),
    )
    d = b - a
    d[1] = 0
    d /= np.linalg.norm(d)
    wall = Polygon([(float((p - a) @ d), p[1]) for p in points])
    for index, row in enumerate(source["boxes"]):
      if row[7] != 0x51666A:
        continue
      p = np.array(row[:3])
      u = float((p - a) @ d)
      if abs(float((p - a) @ n) - 0.055) > 0.004 or not wall.buffer(0.001).covers(
        box(u - row[3] / 2, row[1] - 0.85, u + row[3] / 2, row[1] + 0.85)
      ):
        continue
      panes.append(
        {"index": index, "owner": SCHOOL, "face": face["rings"], "normal": n.tolist()}
      )
      # Existing crossbar at y+.391 is kept unobscured, with two gently varied
      # opaque glass fields and a white central mullion from the photo.
      front(row, n, 0.10, row[1] - 0.24, row[3] - 0.14, 1.02, 0x8A9E9D)
      front(row, n, 0.10, row[1] + 0.62, row[3] - 0.14, 0.30, 0xB8C5C2)
      front(row, n, 0.18, row[1], 0.06, 1.62, 0xE0DDCE, 0.045)
      # Native faces are derived from the actual original orthogonal skin.
      # Split at every retained Z run; never rotate a drawn facade into native.
      zlo, zhi = (
        row[2] - row[3] * abs(d[2]) / 2 + 0.08,
        row[2] + row[3] * abs(d[2]) / 2 - 0.08,
      )
      candidates = [
        b
        for b in native
        if b[0] + b[3] / 2 > row[0] - 0.4
        and b[0] + b[3] / 2 < row[0] + 1.6
        and b[1] - b[4] / 2 < row[1] + 0.85
        and b[1] + b[4] / 2 > row[1] - 0.85
        and b[2] + b[5] / 2 > zlo
        and b[2] - b[5] / 2 < zhi
      ]
      cuts = sorted(
        {
          zlo,
          zhi,
          *[
            max(zlo, min(zhi, b[2] + sgn * b[5] / 2))
            for b in candidates
            for sgn in [-1, 1]
          ],
        }
      )
      spans = []
      for lo, hi in zip(cuts, cuts[1:]):
        if hi - lo < 0.02:
          continue
        support = [
          b for b in candidates if b[2] - b[5] / 2 <= (lo + hi) / 2 <= b[2] + b[5] / 2
        ]
        if not support:
          continue
        x = max(b[0] + b[3] / 2 for b in support)
        for y, h, c in [
          (row[1] - 0.24, 1.02, 0x8A9E9D),
          (row[1] + 0.62, 0.30, 0xB8C5C2),
        ]:
          ys = sorted(
            {
              y - h / 2,
              y + h / 2,
              *[
                max(y - h / 2, min(y + h / 2, b[1] + s * b[4] / 2))
                for b in support
                for s in [-1, 1]
              ],
            }
          )
          for yl, yh in zip(ys, ys[1:]):
            if yh - yl < 0.001:
              continue
            active = [
              b for b in support if b[1] - b[4] / 2 <= (yl + yh) / 2 <= b[1] + b[4] / 2
            ]
            if not active:
              continue
            face_x = max(b[0] + b[3] / 2 for b in active)
            put(
              blocks,
              [face_x + 0.035, (yl + yh) / 2, (lo + hi) / 2, 0.04, yh - yl, hi - lo, c],
            )
        spans.append([x, lo, hi])
      if spans:
        x, lo, hi = min(spans, key=lambda s: abs((s[1] + s[2]) / 2 - row[2]))
        put(
          blocks,
          [
            x + 0.09,
            row[1],
            max(lo + 0.03, min(hi - 0.03, row[2])),
            0.05,
            1.62,
            0.06,
            0xE0DDCE,
          ],
        )
      panes[-1]["nativeSupports"] = spans
  blocks = merge_boxes(blocks)
  counts["schoolOpenings"] = len(panes)
  counts["schoolDrawn"] = len(drawn)
  counts["schoolNative"] = len(blocks)

  # The old nine mirror plates remain intact, with a shallow finish on both
  # sides. Etched-field bars are non-verbal abstractions, not fabricated names.
  mirrors = [b for b in source["boxes"] if b[3] == 0.985 and b[4] == 3.5]
  assert len(mirrors) == 9
  for panel, row in enumerate(mirrors):
    t = np.array([math.cos(row[6]), 0, -math.sin(row[6])])
    n = np.array([math.sin(row[6]), 0, math.cos(row[6])])
    for sign in [-1, 1]:
      for dx in [-0.485, 0.485]:
        p = np.array(row[:3]) + t * dx + n * sign * 0.125
        put(drawn, [*p, 0.018, 3.48, 0.025, row[6], 0xD4DDDA])
      # Three etched image/text fields per face; fine rows elsewhere.
      fields = (
        [(0.2, 0.42, 0.66)]
        if panel in [1, 4, 7]
        else [(-0.55 + i * 0.17, 0.017, 0.66 - (i % 3) * 0.07) for i in range(9)]
      )
      for dy, h, w in fields:
        front(
          row,
          n * sign,
          0.145,
          row[1] + dy,
          w,
          h,
          0x748582 if h > 0.1 else 0x697B7A,
          0.025,
        )
      front(row, n * sign, 0.13, 6.76, 0.91, 0.19, 0xC5D0CE, 0.02)
  # Independent stepped native wall faces, taken from existing memorial cells.
  xs = [b[0] for b in mirrors]
  zs = [b[2] for b in mirrors]
  nearby = [
    b
    for b in native
    if min(xs) - 1.5 < b[0] < max(xs) + 1.5
    and min(zs) - 1 < b[2] < max(zs) + 1
    and b[1] - b[4] / 2 <= 4
    and b[1] + b[4] / 2 >= 7
  ]
  cuts = sorted({b[2] + sgn * b[5] / 2 for b in nearby for sgn in [-1, 1]})
  mirror_spans = []
  for lo, hi in zip(cuts, cuts[1:]):
    support = [b for b in nearby if b[2] - b[5] / 2 < (lo + hi) / 2 < b[2] + b[5] / 2]
    if not support:
      continue
    for sign in [-1, 1]:
      x = (
        max(b[0] + b[3] / 2 for b in support)
        if sign > 0
        else min(b[0] - b[3] / 2 for b in support)
      )
      for y, h, c in [
        (6.76, 0.19, 0xC5D0CE),
        (5.25, 0.035, 0x697B7A),
        (5.55, 0.035, 0x697B7A),
        (5.85, 0.035, 0x697B7A),
        (6.15, 0.035, 0x697B7A),
      ]:
        put(blocks, [x + sign * 0.035, y, (lo + hi) / 2, 0.04, h, (hi - lo) * 0.8, c])
      mirror_spans.append([x, lo, hi, sign])
  counts["mirrorPanels"] = len(mirrors)
  counts["memorialNativeSpans"] = len(mirror_spans)
  counts["memorialDrawn"] = len(drawn) - counts["schoolDrawn"]
  counts["memorialNative"] = len(blocks) - counts["schoolNative"]

  # The existing packet owns actual asphalt at y=3.09. Only paint, no raised
  # pavement or collision obstacle. Keep the rest of Schloßstraße unchanged.
  raw = GEO / "raw/v182-steglitz/lines.json"
  project = Transformer.from_crs(4326, 25833, always_xy=True)

  def world(x: Any, y: Any, z: Any = None) -> tuple[Any, Any]:
    e, n = project.transform(x, y)
    try:
      return [v - 389500 for v in e], [5820000 - v for v in n]
    except TypeError:
      return e - 389500, 5820000 - n

  roads = []
  grounds = []
  occupied = []
  packet_receipts = {}
  for packet_id in ["ring182--8_13", "ring182--7_13"]:
    file = PUBLIC / f"{packet_id}.drawn.json.gz"
    packet = json.loads(gzip.decompress(file.read_bytes()))
    ox, _, oz = packet["origin"]
    for p in packet["nav"]["ground"]:
      grounds.append(
        Polygon(
          [(x + ox, z + oz) for x, z in p["ring"]],
          [[(x + ox, z + oz) for x, z in r] for r in p.get("holes", [])],
        )
      )
    for p in packet["nav"]["buildings"]:
      occupied.append(Polygon([(x + ox, z + oz) for x, z in p["ring"]]))
    for p in packet["nav"]["roads"]:
      roads.append(
        Polygon(
          [(x + ox, z + oz) for x, z in p["ring"]],
          [[(x + ox, z + oz) for x, z in r] for r in p.get("holes", [])],
        )
      )
    packet_receipts[str(file.relative_to(ROOT))] = sha(file)
  road_union = unary_union(roads)
  ground_union = unary_union(grounds)
  for p in read(DATA / "steglitzV182Navigation.json")["buildings"]:
    occupied.append(Polygon(p["ring"], p.get("holes", [])))
  obstacles = unary_union([p if p.is_valid else p.buffer(0) for p in occupied])
  for feature in read(raw)["features"]:
    if feature["properties"].get("osm_id") not in {"451621864", "483483276"}:
      continue
    tags = dict(
      re.findall(r'"([^\"]+)"=>"([^\"]*)"', feature["properties"]["other_tags"])
    )
    assert tags["cycleway:right:surface:colour"] == "green"
    line = transform(world, shape(feature["geometry"]))
    width = float(tags["width"])
    cw = float(tags["cycleway:right:width"])
    additions = 0
    mapped = line.buffer(width / 2, cap_style=2, join_style=2)
    assert ground_union.buffer(0.025).covers(mapped)
    assert mapped.intersection(obstacles).area < 0.05
    # Existing v179/v180 coverage is a hairline, not an asphalt surface here.
    # Complete this exact finite mapped road body before placing its paint.
    for aa, bb in zip(line.coords, list(line.coords)[1:]):
      a = np.array(aa)
      b = np.array(bb)
      d = b - a
      length = float(np.linalg.norm(d))
      if length < 0.01:
        continue
      p = (a + b) / 2
      put(
        drawn,
        [p[0], 3.08, p[1], length, 0.02, width, math.atan2(-d[1], d[0]), 0x686D6C],
      )
    for x in np.arange(math.floor(mapped.bounds[0]), mapped.bounds[2], 1):
      for z in np.arange(math.floor(mapped.bounds[1]), mapped.bounds[3], 1):
        tile = box(x, z, x + 1, z + 1)
        if mapped.covers(tile):
          put(blocks, [x + 0.5, 3.08, z + 0.5, 1, 0.02, 1, 0x686D6C])
    # Leave both junction ends open; follow every original intermediate vertex.
    for k in range(2, max(2, int(line.length) - 2), 2):
      a = np.array(line.interpolate(k).coords[0])
      b = np.array(line.interpolate(min(k + 2, line.length - 2)).coords[0])
      d = b - a
      length = float(np.linalg.norm(d))
      if length < 0.1:
        continue
      d /= length
      n = np.array([-d[1], d[0]])
      p = (a + b) / 2 + n * (width - cw) / 2
      footprint = LineString([p - d * length / 2, p + d * length / 2]).buffer(
        cw / 2, cap_style=2
      )
      if not mapped.buffer(0.025).covers(footprint):
        continue
      yaw = math.atan2(-d[1], d[0])
      put(drawn, [p[0], 3.104, p[1], length, 0.012, cw, yaw, 0x608A74])
      additions += 1
      # Native paint uses a separate axis-aligned tiling strictly contained in
      # the same delivered road and tagged lane; no rotated native objects.
      for x in np.arange(math.ceil(footprint.bounds[0]), footprint.bounds[2], 1):
        for z in np.arange(math.ceil(footprint.bounds[1]), footprint.bounds[3], 1):
          tile = box(x, z, x + 1, z + 1)
          if footprint.covers(tile):
            put(blocks, [x + 0.5, 3.104, z + 0.5, 1, 0.012, 1, 0x608A74])
      # Source-tagged boundary marking, bounded stripe segments.
      continuous = tags.get("cycleway:right:marking:left") == "solid_line"
      if continuous or k % 4 == 2:
        edge = (a + b) / 2 + n * (width / 2 - cw)
        stripe_length = length if continuous else 1.5
        mark = LineString(
          [edge - d * stripe_length / 2, edge + d * stripe_length / 2]
        ).buffer(0.06, cap_style=2)
        if mapped.covers(mark):
          put(
            drawn, [edge[0], 3.12, edge[1], stripe_length, 0.012, 0.12, yaw, 0xDEDCCD]
          )
          # Conservative orthogonal short dashes inside the road, not a full
          # diagonal strip disguised as native.
          step_count = math.ceil(stripe_length / 0.5)
          step = stripe_length / step_count
          for i in range(step_count):
            frac = -stripe_length / 2 + (i + 0.5) * step
            q = edge + d * frac
            w, h = max(0.12, abs(d[0]) * step), max(0.12, abs(d[1]) * step)
            tile = box(q[0] - w / 2, q[1] - h / 2, q[0] + w / 2, q[1] + h / 2)
            if mapped.covers(tile):
              put(blocks, [q[0], 3.12, q[1], w, 0.012, h, 0xDEDCCD])
    road_receipts.append(
      {
        "id": feature["properties"]["osm_id"],
        "tags": tags,
        "geometry": mapping(line),
        "greenSegments": additions,
        "priorAsphaltOverlapM2": round(mapped.intersection(road_union).area, 3),
      }
    )
  counts["roadDrawn"] = len(drawn) - counts["schoolDrawn"] - counts["memorialDrawn"]
  counts["roadNative"] = len(blocks) - counts["schoolNative"] - counts["memorialNative"]
  start = counts["schoolNative"] + counts["memorialNative"]
  blocks = blocks[:start] + merge_boxes(blocks[start:])
  counts["roadNative"] = len(blocks) - start
  paths = [
    DATA / x
    for x in [
      "steglitzV182Source.json",
      "steglitzV182Native.json",
      "steglitzV182Navigation.json",
      "schoolsV185.json",
      "schoolsPlacesV205.json",
      "schoolCultureV228.json",
    ]
  ]
  evidence = {
    "version": 246,
    "counts": counts,
    "sourceSha256": {str(p.relative_to(ROOT)): sha(p) for p in paths},
    "packetSha256": packet_receipts,
    "panes": panes,
    "memorialNativeSupports": mirror_spans,
    "roads": road_receipts,
    "rawRoadSha256": sha(raw),
    "policy": "All original shells, roofs, fittings, navigation and packets retained byte-for-byte. Existing full/mobile batches; no new descriptor or draw call. Small opaque glass, etched fields and paint offsets are display estimates; no victim names, portrait pixels or real-time reflections.",
  }
  return {"version": 246, "boxes": drawn, "nativeRows": blocks}, evidence


def main() -> None:
  """Rebuild only the small additive row list and its preservation receipts."""
  data, evidence = build()
  for p, d in [(OUT, data), (EVIDENCE, evidence)]:
    p.write_text(json.dumps(d, separators=(",", ":"), ensure_ascii=False) + "\n")
  print(json.dumps({"bytes": OUT.stat().st_size, **evidence["counts"]}))


if __name__ == "__main__":
  main()
