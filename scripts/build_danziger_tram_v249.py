"""Step 10: complete retained Danziger tram courses and a bounded stop pilot.

Additive only. Original road/rail packets are never rewritten. The native rails
are independently traced orthogonal routes, not rotated drawn instances.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from pathlib import Path

import pyogrio
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Polygon, box
from shapely.ops import linemerge, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/outer-v159/candidate.gpkg"
OUT = ROOT / "src/app/src/data/danzigerTramV249.json"
EVIDENCE = GEO / "danziger-tram-v249-source.json"
TERRAIN = ROOT / "src/app/src/data/parkReliefV182.json"
# The two connected through courses of M10, including every intervening short
# mapped junction piece. Crossing M2/M4 and turning connectors remain untouched.
TRACK_IDS = [
  "148753779",
  "172962275",
  "94131355",
  "93707831",
  "153964325",
  "406073853",
  "93707829",
  "155533115",
  "155533116",
  "155533125",
  "1049894526",
  "323881804",
  "1047227964",
  "406073855",
  "153963645",
  "155533117",
  "93707833",
  "86260987",
  "93628048",
]
PLATFORM_IDS = ["96351862", "96351856"]
GAUGE = 1.435
NATIVE_STEP = 1.5
STEEL, STONE, TACTILE = 0xADB7BC, 0xBFBBAE, 0xE6DFCA
YELLOW, GLASS, DARK = 0xF0C727, 0x40545A, 0x383F40


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def world(geometry: object) -> object:
  return affine_transform(geometry, [1, 0, 0, -1, -389500, 5820000])


def rounded(points: object) -> list:
  return [[round(float(x), 4), round(float(z), 4)] for x, z in points]


def terrain_split_path(line: LineString) -> list:
  """Keep the complete rail course, split only at existing DGM triangle edges."""
  profiles = json.loads(TERRAIN.read_bytes())["profiles"]
  result = [line.coords[0]]
  for a, b in zip(line.coords, list(line.coords)[1:], strict=False):
    cuts = {0.0, 1.0}
    for profile in profiles:
      west, north, east, south = profile["support"]
      if not LineString([a, b]).intersects(box(west, north, east, south)):
        continue
      step = profile["stepM"]
      # DGM cells contain NW–SE diagonals, besides their x/z grid edges.
      for av, bv, origin in [
        (a[0], b[0], west),
        (a[1], b[1], north),
        (a[0] - a[1], b[0] - b[1], west - north),
      ]:
        if abs(bv - av) < 1e-10:
          continue
        low, high = sorted([av, bv])
        for i in range(
          math.ceil((low - origin) / step), math.floor((high - origin) / step) + 1
        ):
          t = (origin + i * step - av) / (bv - av)
          x, z = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
          if (
            1e-8 < t < 1 - 1e-8
            and west - 1e-5 <= x <= east + 1e-5
            and north - 1e-5 <= z <= south + 1e-5
          ):
            cuts.add(t)
    for t in sorted(cuts)[1:]:
      result.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
  return rounded(result)


def native_rail_path(line: LineString) -> list:
  """Complete source path subdivided for independent axis-aligned blocks.

  Each output span becomes its tight world-axis box. This avoids a shifted
  staircase crossing the adjacent track; no rotated rail mesh is used.
  """
  points = [line.coords[0]]
  for a, b in zip(line.coords, list(line.coords)[1:], strict=False):
    count = max(1, math.ceil(math.dist(a, b) / NATIVE_STEP))
    for i in range(1, count + 1):
      points.append(
        (a[0] + (b[0] - a[0]) * i / count, a[1] + (b[1] - a[1]) * i / count)
      )
  return rounded(points)


def clear_native_rail_crossings(paths: list) -> list:
  """Subdivide only blocks that touch another rail: no invented rail crossing."""
  for _ in range(8):
    polygons, owners = [], []
    for owner, path in enumerate(paths):
      for index, (a, b) in enumerate(zip(path, path[1:], strict=False)):
        polygons.append(
          box(
            min(a[0], b[0]) - 0.05,
            min(a[1], b[1]) - 0.05,
            max(a[0], b[0]) + 0.05,
            max(a[1], b[1]) + 0.05,
          )
        )
        owners.append((owner, index))
    tree, split = STRtree(polygons), set()
    for i, p in enumerate(polygons):
      for j in tree.query(p, predicate="intersects"):
        if j <= i or owners[i][0] == owners[j][0]:
          continue
        if p.intersection(polygons[j]).area > 1e-8:
          split.update((owners[i], owners[j]))
    if not split:
      return paths
    result = []
    for owner, path in enumerate(paths):
      points = [path[0]]
      for index, (a, b) in enumerate(zip(path, path[1:], strict=False)):
        if (owner, index) in split:
          points.append([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
        points.append(b)
      result.append(rounded(points))
    paths = result
  raise AssertionError("Native railheads must stay distinct")


def frame(line: LineString, at: float | None = None) -> tuple:
  at = line.length / 2 if at is None else at
  p = line.interpolate(at)
  a, b = (
    line.interpolate(max(0, at - 0.1)),
    line.interpolate(min(line.length, at + 0.1)),
  )
  length = a.distance(b)
  tx, tz = (b.x - a.x) / length, (b.y - a.y) / length
  return p.x, p.y, tx, tz


class Fittings:
  def __init__(self) -> None:
    self.drawn: list = []
    self.native: list = []
    self.floors: list = []
    self.solids: list = []

  def box(
    self,
    pose: tuple,
    u: float,
    y: float,
    v: float,
    w: float,
    h: float,
    d: float,
    color: int,
    role: str = "",
  ) -> None:
    x, z, tx, tz = pose
    x, z = x + tx * u - tz * v, z + tz * u + tx * v
    self.drawn.append([x, y, z, w, h, d, -math.atan2(tz, tx), color])
    corners = [
      (x + tx * a - tz * b, z + tz * a + tx * b)
      for a, b in [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
    ]
    poly = Polygon(corners)
    # Independent world-axis spans of the specified fitting footprint. Thick
    # bodies use interior half-metre slices, fine fittings use 25cm slices.
    # A closed source polygon is sectioned directly; no native rotation exists.
    cell = 0.5 if d >= 0.5 and w >= 1 else 0.25
    low, north, high, south = poly.bounds
    count = max(1, math.ceil((south - north) / cell))
    native_first = len(self.native)
    for i in range(count):
      za, zb = (
        north + (south - north) * i / count,
        north + (south - north) * (i + 1) / count,
      )
      zz = (za + zb) / 2
      section = poly.intersection(LineString([(low - 1, zz), (high + 1, zz)]))
      if section.is_empty or section.length < 0.01:
        continue
      left, _, right, _ = section.bounds
      self.native.append(
        [(left + right) / 2, y, zz, right - left, h, zb - za + 0.00004, color]
      )
    if role == "floor":
      self.floors.append(
        {
          "ring": rounded(corners),
          "top": round(y + h / 2, 4),
          "native": [native_first, len(self.native)],
        }
      )
    elif role == "solid":
      self.solids.append(
        {
          "ring": rounded(corners),
          "low": round(y - h / 2, 4),
          "high": round(y + h / 2, 4),
          "native": [native_first, len(self.native)],
        }
      )

  def stop(self, line: LineString) -> None:
    pose, length = frame(line), line.length
    # The retained line is a platform centre course, not a surveyed area ring.
    self.box(pose, 0, 3.28, 0, length, 0.24, 1.7, STONE, "floor")
    for side in [-1, 1]:
      self.box(pose, 0, 3.415, side * 0.69, length - 1.2, 0.03, 0.12, TACTILE)
    # Source tags establish shelter/bench/bin/display, not their exact placement.
    self.box(pose, 0, 5.84, 0, 5.4, 0.14, 1.5, DARK)
    for u in [-2.45, 2.45]:
      self.box(pose, u, 4.62, 0.57, 0.09, 2.4, 0.09, DARK, "solid")
    self.box(pose, 0, 4.60, 0.62, 5, 2.1, 0.06, 0x9DAAA8, "solid")
    self.box(pose, 0, 3.91, 0.25, 2.4, 0.12, 0.45, 0x9D8060, "solid")
    for u in [-0.9, 0.9]:
      self.box(pose, u, 3.67, 0.25, 0.08, 0.48, 0.35, DARK, "solid")
    self.box(pose, 4, 3.85, 0.15, 0.42, 0.86, 0.42, 0x626E64, "solid")
    for u in [-length / 2 + 4, length / 2 - 4]:
      self.box(pose, u, 4.91, 0.3, 0.07, 3, 0.07, DARK, "solid")
      self.box(pose, u, 6.25, 0.3, 0.58, 0.58, 0.08, YELLOW)
      for d in [-0.16, 0.16]:
        self.box(pose, u + d, 6.25, 0.35, 0.07, 0.39, 0.03, 0x287351)
      self.box(pose, u, 6.25, 0.35, 0.32, 0.07, 0.03, 0x287351)
    self.box(pose, 3, 5.82, 0.1, 1.15, 0.38, 0.12, DARK)
    self.box(pose, 3, 5.82, 0.17, 0.84, 0.06, 0.02, 0xE4B85B)

  def tram(self, pose: tuple) -> None:
    # Manufacturer's seven-module 40.55m diagram is normalized to its separately
    # stated 40m carbody length. Door/window layout remains recognition geometry.
    lengths = [7.1, 5.15, 4.05, 3.75, 4.05, 5.15, 7.1]
    scale, cursor = 40 / 40.55, -20.0
    for i, raw in enumerate(lengths):
      length = raw * scale
      u = cursor + length / 2
      self.box(pose, u, 4.75, 0, length, 2.42, 2.4, YELLOW, "solid")
      self.box(pose, u, 3.74, 0, length, 0.24, 2.38, 0xD0A521)
      for side in [-1, 1]:
        self.box(pose, u, 5.35, side * 1.205, length - 0.55, 0.95, 0.035, GLASS)
        for part in range(max(1, int(length / 1.7))):
          xx = u - length / 2 + 0.8 + part * 1.7
          if xx < u + length / 2 - 0.25:
            self.box(pose, xx, 5.35, side * 1.23, 0.065, 0.98, 0.035, DARK)
      self.box(pose, u, 6.20, 0, length - 0.12, 0.18, 2.30, YELLOW)
      self.box(pose, u, 6.50, 0, min(2.8, length - 0.4), 0.34, 1.38, 0xB4B9B2)
      cursor += length
      if i < 6:
        self.box(
          pose,
          cursor + 0.35 * scale,
          4.83,
          0,
          0.70 * scale,
          2.38,
          2.26,
          0x686C69,
          "solid",
        )
        cursor += 0.7 * scale
    for u in [-13.8, -7.6, 0, 7.6, 13.8]:
      for side in [-1, 1]:
        self.box(pose, u, 4.85, side * 1.24, 1.30, 2.02, 0.035, 0x5B6A69)
        self.box(pose, u, 4.85, side * 1.268, 0.055, 2.02, 0.02, YELLOW)
    for u in [-15.5, -5.3, 5.3, 15.5]:
      self.box(pose, u, 3.60, 0, 1.7, 0.60, 1.90, DARK, "solid")
      for side in [-1, 1]:
        self.box(pose, u, 3.57, side * 0.7175, 1.40, 0.66, 0.13, 0x292D2C)
    for side in [-1, 1]:
      self.box(pose, side * 19.92, 5.20, 0, 0.07, 1.30, 1.9, GLASS)
      self.box(pose, side * 19.96, 4.02, 0, 0.05, 0.22, 1.95, DARK)
      for v in [-0.72, 0.72]:
        self.box(pose, side * 19.97, 4.35, v, 0.04, 0.16, 0.30, 0xECE3C0)
      self.box(pose, side * 19.97, 5.96, 0, 0.04, 0.28, 1.2, DARK)
    # Compact pantograph with two rising arms and contact shoe; static display.
    for u in [-1.1, 1.1]:
      self.box(pose, u, 6.95, 0, 0.09, 0.75, 0.10, DARK)
    self.box(pose, 0, 7.33, 0, 2.5, 0.10, 0.30, DARK)


def build() -> tuple[dict, dict]:
  ids = TRACK_IDS + PLATFORM_IDS
  frame_source = pyogrio.read_dataframe(
    RAW, layer="lines", where="osm_id IN (" + ",".join("'" + i + "'" for i in ids) + ")"
  ).to_crs(25833)
  features = {}
  for _, row in frame_source.iterrows():
    tags = dict(re.findall(r'"([^"]+)"=>"([^"]*)"', str(row.other_tags)))
    features[row.osm_id] = {
      "id": row.osm_id,
      "name": row["name"] if isinstance(row["name"], str) else None,
      "tags": tags,
      "coordinates": rounded(world(row.geometry).coords),
    }
  assert set(features) == set(ids)
  tracks = [LineString(features[i]["coordinates"]) for i in TRACK_IDS]
  merged = linemerge(unary_union(tracks))
  assert merged.geom_type == "MultiLineString" and len(merged.geoms) == 2
  rails, native_rails = [], []
  for line in merged.geoms:
    for side in [-1, 1]:
      rail = line.offset_curve(side * GAUGE / 2, join_style="mitre")
      rails.append(terrain_split_path(rail))
      native_rails.append(native_rail_path(rail))
  native_rails = clear_native_rail_crossings(native_rails)
  model = Fittings()
  for owner in PLATFORM_IDS:
    model.stop(LineString(features[owner]["coordinates"]))
  track = LineString(features["323881804"]["coordinates"])
  platform_centre = LineString(features[PLATFORM_IDS[0]]["coordinates"]).interpolate(
    0.5, normalized=True
  )
  pose = frame(track, track.project(platform_centre))
  model.tram(pose)

  def rows_round(rows: list) -> list:
    return [[round(v, 5) if isinstance(v, float) else v for v in row] for row in rows]

  data = {
    "version": 249,
    "railTop": 3.24,
    "gauge": GAUGE,
    "rails": rails,
    "nativeRails": native_rails,
    "boxes": rows_round(model.drawn),
    "nativeBoxes": rows_round(model.native),
    "floors": model.floors,
    "solids": model.solids,
  }
  counts = {
    "drawnRows": sum(len(p) - 1 for p in rails) + len(model.drawn),
    "nativeRows": sum(len(p) - 1 for p in native_rails) + len(model.native),
  }
  data["counts"] = counts
  evidence = {
    "version": 249,
    "source": str(RAW.relative_to(ROOT)),
    "sha256": sha(RAW),
    "license": "© OpenStreetMap contributors, ODbL 1.0",
    "features": list(features.values()),
    "sourceLengthM": sum(t.length for t in tracks),
    "nativeBlockMaxLengthM": NATIVE_STEP,
    "tram": {
      "track": "323881804",
      "pose": list(pose),
      "lengthM": 40,
      "widthM": 2.4,
      "bodyHeightM": 3.45,
      "modules": 7,
      "animated": False,
    },
    "platformWidthEstimateM": 1.7,
    "platformTopEstimate": 3.40,
    "groundDatum": "At Husemannstraße existing ground is3.00m and rail top3.15m; new railheads3.16–3.24m. Eastern railheads follow the existing DGM triangles (native samples its existing4m terrain cells), retaining their relative20cm centre height. Station and rigid vehicle stay on their verified3m ground.",
    "terrain": {"source": str(TERRAIN.relative_to(ROOT)), "sha256": sha(TERRAIN)},
    "estimates": "Railhead width/height, platform width/height, shelter/bench/bin/display locations and fitting dimensions are display estimates; tags establish their existence, not positions. Native railheads use complete independently orthogonal tight boxes along source spans of at most1.5m; no centreline is shifted and no smooth mesh is rotated. Vehicle subpart sizes and display pose are illustrative; no live vehicle location is implied.",
    "preservation": "All 19 complete retained M10 through ways and 2 platform courses retained. Cross-route/turning rails and all old road/rail/source bytes untouched. Core catenary stops west of this site; no existing tram model is replaced.",
    "references": [
      {
        "url": "https://www.bvg.de/de/verbindungen/linienuebersicht/m10",
        "credit": "Berliner Verkehrsbetriebe (BVG)",
        "use": "M10 through Danziger Straße and Husemannstraße stop identity; reference only.",
      },
      {
        "url": "https://trampicturebook.de/tram/download/bombadier/Flexity-Berlin.pdf",
        "credit": "Bombardier Transportation, FLEXITY Berlin data sheet, ©2007–2008 Bombardier Inc.; mirrored by trampicturebook.de",
        "use": "Primary manufacturer data: seven modules, 40m body, 2.4m width, 3.45m height, 1.435m gauge, 1.3m doors. Diagram overall40.55m versus table40m is recorded; recognition carbody uses table40m. Reference only, no image/plan bundled.",
      },
    ],
    "counts": counts,
    "gpuInstanceDeltaBytes": {k: v * 76 for k, v in counts.items()},
  }
  assert counts["nativeRows"] * 76 < 700_000
  encoded = json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n"
  assert len(encoded.encode()) < 500_000
  return data, evidence


if __name__ == "__main__":
  data, evidence = build()
  for path, value in [(OUT, data), (EVIDENCE, evidence)]:
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")
  print(
    json.dumps(
      {
        "dataBytes": OUT.stat().st_size,
        **evidence["counts"],
        "gpuDelta": evidence["gpuInstanceDeltaBytes"],
      }
    )
  )
