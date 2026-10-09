"""Step 10: small additive Tegel/Spandau recognition over retained source owners.

Only named decorative members and the previously absent mapped harbour footbridge
are added. All dimensions absent from source tags are explicit display estimates.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from pyproj import Transformer
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "tegel-spandau-v198-source.json"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
UNPROJECT = Transformer.from_crs(25833, 4326, always_xy=True).transform


def world(x: float, y: float) -> tuple[float, float]:
  """Retain the established metre-space projection, without simplified rings."""
  a, b = PROJECT(x, y)
  return a - 389500, 5820000 - b


def freeze_sources() -> dict:
  """Freeze exact selected existing source rows; no broad extraction or download."""
  if SOURCE.exists():
    return json.loads(SOURCE.read_text())
  sources = []
  for path, selected in [
    (
      "raw/tegel-spandau-v198/tegel-lines.geojson",
      {"316133773", "1067888573", "1067888574"},
    ),
    (
      "raw/tegel-spandau-v198/tegel-multipolygons.geojson",
      {"943646072", "1067859898", "8659535", "228201346"},
    ),
    ("raw/v187-west/citadel-lines.json", {"4902366", "304335233", "304335234"}),
  ]:
    rows = json.loads((GEO / path).read_text())["features"]
    sources.extend(
      f
      for f in rows
      if str(f["properties"].get("osm_way_id") or f["properties"].get("osm_id"))
      in selected
    )
  old = json.loads((GEO / "west-lakes-v194-source.geojson").read_text())
  sources.extend(
    f for f in old["features"] if f["properties"].get("id") == "way/24448740"
  )
  result = {
    "source": "Retained Geofabrik Berlin 2026-09-29",
    "license": "ODbL-1.0",
    "pbfSha256": old["sha256"],
    "features": sources,
  }
  SOURCE.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  return result


def make(native: bool = False) -> tuple[dict, dict]:
  """Make three independent bounded sites; native rods are axis-aligned steps."""
  source = freeze_sources()
  features = {
    str(
      f["properties"].get("id")
      or "way/"
      + str(f["properties"].get("osm_way_id") or f["properties"].get("osm_id"))
    ): f
    for f in source["features"]
  }

  def geom(oid: str):
    g = transform(world, shape(features[oid]["geometry"]))
    return list(g.geoms)[0] if g.geom_type == "MultiPolygon" else g

  sites = []
  anchors = []

  def site(key: str, owners: list[str]) -> dict:
    row = {
      "key": key,
      "owners": owners,
      "boxes": [],
      "rods": [],
      "positions": [],
      "indices": [],
      "colors": [],
    }
    sites.append(row)
    return row

  def box(s: dict, p: list, size: list, color: int, yaw: float = 0) -> None:
    s["boxes"].append([*[round(float(v), 5) for v in p], *size, yaw, color])

  def rod(s: dict, a, b, width: float, color: int) -> None:
    if math.dist(a, b) > 0.0001:
      s["rods"].append([*[round(float(v), 5) for v in [*a, *b]], width, color])

  def plane(s: dict, poly, y: float, color: int) -> None:
    for tri in constrained_delaunay_triangles(poly).geoms:
      start = len(s["positions"]) // 3
      for x, z in list(tri.exterior.coords)[:3]:
        s["positions"].extend([x, y, z])
        s["colors"].append(color)
      s["indices"].extend([start, start + 1, start + 2])

  # Schloss Tegel: eight upper relief fields, exactly two exposed outer walls
  # at each of the four existing corner projections. Existing windows stay clear.
  g = geom("way/24448740")
  s = site("Schloss Tegel: eight wind reliefs", ["way/24448740"])
  rect = list(g.minimum_rotated_rectangle.exterior.coords)[:4]
  for i in range(4):
    a, b, c = (
      np.array(rect[i]),
      np.array(rect[(i + 1) % 4]),
      np.array(rect[(i - 1) % 4]),
    )
    u, v = (b - a) / np.linalg.norm(b - a), (c - a) / np.linalg.norm(c - a)
    tower = g.intersection(
      Polygon([a, a + u * 5.7, a + u * 5.7 + v * 5.7, a + v * 5.7])
    )
    edges = []
    for aa, bb in zip(tower.exterior.coords, list(tower.exterior.coords)[1:]):
      edge = LineString([aa, bb])
      if edge.length > 2.5 and edge.difference(g.boundary.buffer(0.002)).length < 0.005:
        edges.append((np.array(aa), np.array(bb)))
    edges.sort(key=lambda pair: LineString(pair).distance(Point(*a)))
    edges = edges[:2]
    assert len(edges) == 2, (i, len(edges))
    for aa, bb in edges:
      d = (bb - aa) / np.linalg.norm(bb - aa)
      n = np.array([-d[1], d[0]])
      if g.contains(Point(*((aa + bb) / 2 + n * 0.1))):
        n = -n
      p = (aa + bb) / 2 + n * (0.7 if native else 0.14)
      yaw = math.atan2(-d[1], d[0])

      def local(x, y, z=0.0):
        q = p + d * x + n * z
        return [q[0], y, q[1]]

      anchors.append(
        {
          "kind": "wind-relief",
          "tower": i,
          "wall": [aa.tolist(), bb.tolist()],
          "center": local(0, 14.86),
        }
      )
      box(s, local(0, 14.86), [3.05, 0.88, 0.10], 0xD8D2BE, yaw)
      for yy, hh, ww in [
        (14.34, 0.09, 3.25),
        (15.39, 0.10, 3.25),
        (15.78, 0.14, math.dist(aa, bb) + 0.18),
      ]:
        box(s, local(0, yy, 0.04), [ww, hh, 0.15], 0xF1EBDD, yaw)
      # Modest wind-god silhouette: head, reclining body and wind-blown robe.
      # Original procedural annotation, not a pixel/outline trace of sculpture.
      box(s, local(-0.66, 15.02, 0.13), [0.23, 0.27, 0.13], 0xF4EDDC, yaw)
      rod(s, local(-0.50, 14.91, 0.14), local(0.28, 14.67, 0.14), 0.19, 0xEDE6D4)
      rod(s, local(0.24, 14.68, 0.14), local(0.86, 14.88, 0.14), 0.14, 0xEDE6D4)
      rod(s, local(-0.35, 14.88, 0.14), local(-0.97, 14.70, 0.14), 0.12, 0xEDE6D4)
      for k in range(4):
        rod(
          s,
          local(0.10 + k * 0.17, 14.63, 0.15),
          local(0.72 + k * 0.13, 14.96 - k * 0.045, 0.15),
          0.065,
          0xEEE8D8,
        )

  # Exact OSM harbour footbridge. No earlier water or shoreline is altered.
  # Vertical levels/rise and steel sections are deliberately display estimates.
  bridge = geom("way/943646072")
  axis = geom("way/316133773")
  s = site(
    "Sechserbruecke: red truss and mapped deck",
    ["way/943646072", "way/316133773", "way/1067888573", "way/1067888574"],
  )
  deck_y = 3.14
  if native:
    # Separate orthogonal 0.4m strips, fully inside the complete source polygon.
    # Keep only inner full tiles; no huge lake-grid arrays and no shoreline fill.
    lo = bridge.bounds
    for iz in range(math.floor(lo[1] / 0.4), math.ceil(lo[3] / 0.4)):
      pieces = bridge.intersection(
        Polygon(
          [
            (lo[0], iz * 0.4),
            (lo[2], iz * 0.4),
            (lo[2], (iz + 1) * 0.4),
            (lo[0], (iz + 1) * 0.4),
          ]
        )
      )
      for piece in (
        [pieces] if pieces.geom_type == "Polygon" else getattr(pieces, "geoms", [])
      ):
        if piece.is_empty or piece.geom_type != "Polygon":
          continue
        xmin, _, xmax, _ = piece.bounds
        first, last = math.ceil(xmin / 0.4), math.floor(xmax / 0.4)
        if last <= first:
          continue
        # Scan the few boundary cells, then merge a complete exact row.
        cells = [
          ix
          for ix in range(first, last)
          if bridge.covers(
            Polygon(
              [
                (ix * 0.4, iz * 0.4),
                ((ix + 1) * 0.4, iz * 0.4),
                ((ix + 1) * 0.4, (iz + 1) * 0.4),
                (ix * 0.4, (iz + 1) * 0.4),
              ]
            )
          )
        ]
        if cells:
          box(
            s,
            [((cells[0] + cells[-1] + 1) / 2) * 0.4, deck_y - 0.08, (iz + 0.5) * 0.4],
            [(cells[-1] - cells[0] + 1) * 0.4, 0.16, 0.4],
            0xA49A84,
          )
  else:
    plane(s, bridge, deck_y, 0xA49A84)
  a, b = np.array(axis.coords[0]), np.array(axis.coords[-1])
  d = (b - a) / np.linalg.norm(b - a)
  n = np.array([-d[1], d[0]])
  length = float(np.linalg.norm(b - a))
  red = 0x983F3D

  def bridgepoint(t, y, side):
    q = a + (b - a) * t + n * side
    return [q[0], y, q[1]]

  # Through-truss arch: twin upper chords, lower arch chords, vertical hangers
  # and crossed panels. Everything stays outside the open walking corridor.
  for side in [-1.86, 1.86]:
    ts = np.linspace(0, 1, 23)
    upper = [deck_y + 3.05 + 3.30 * (1 - (2 * t - 1) ** 2) for t in ts]
    for i in range(len(ts) - 1):
      t0, t1 = ts[i], ts[i + 1]
      h0, h1 = upper[i], upper[i + 1]
      rod(s, bridgepoint(t0, h0, side), bridgepoint(t1, h1, side), 0.17, red)
      rod(
        s, bridgepoint(t0, h0 - 1.35, side), bridgepoint(t1, h1 - 1.35, side), 0.14, red
      )
      rod(s, bridgepoint(t0, h0, side), bridgepoint(t1, h1 - 1.35, side), 0.095, red)
      rod(s, bridgepoint(t0, h0 - 1.35, side), bridgepoint(t1, h1, side), 0.095, red)
    for t, h in zip(ts, upper):
      rod(s, bridgepoint(t, deck_y, side), bridgepoint(t, h, side), 0.115, red)
    for height in [0.20, 1.05]:
      rod(
        s,
        bridgepoint(0, deck_y + height, side),
        bridgepoint(1, deck_y + height, side),
        0.075,
        red,
      )
    for t in np.linspace(0, 1, math.ceil(length / 0.60) + 1):
      rod(
        s,
        bridgepoint(t, deck_y + 0.17, side),
        bridgepoint(t, deck_y + 1.06, side),
        0.045,
        red,
      )
  # Two transverse portal ties above headroom; no low bars across passage.
  for t in [0, 1]:
    rod(
      s,
      bridgepoint(t, deck_y + 3.05, -1.86),
      bridgepoint(t, deck_y + 3.05, 1.86),
      0.17,
      red,
    )
  anchors.append(
    {
      "kind": "bridge",
      "axis": list(axis.coords),
      "deckY": deck_y,
      "lengthM": length,
      "clearWidthM": 3.55,
      "archRiseEstimateM": 6.35,
    }
  )

  # Torhaus: retain every exact official source sheet; add only thin front
  # architectural fittings bound to the exposed south-facing official edge.
  s = site(
    "Zitadelle Spandau: gate and approach railings",
    ["DEBE05YYY00006av", "way/4902366", "way/304335234"],
  )
  aa = np.array([-10738.918, -2612.245])
  bb = np.array([-10721.815, -2615.539])
  d = (bb - aa) / np.linalg.norm(bb - aa)
  n = np.array([-d[1], d[0]])
  p = (aa + bb) / 2 + n * (0.48 if native else 0.12)
  yaw = math.atan2(-d[1], d[0])
  base = 3.55

  def front(x, y, out=0):
    q = p + d * x + n * out
    return [q[0], y, q[1]]

  # The operator's brick front is a thin colour/material fitting over the
  # existing exact wall, not a replacement volume or generic window overlay.
  box(s, front(0, 12.14, -0.035), [17.08, 9.68, 0.075], 0xA96C50, yaw)
  # Banded stone plinth, side quoins and main round-arched portal.
  for side in [-1, 1]:
    for k in range(5):
      box(
        s, front(side * 5.25, base + 0.23 + k * 0.42), [6.1, 0.34, 0.13], 0xCDBD94, yaw
      )
    for k in range(6):
      box(
        s,
        front(side * 8.20, 7.0 + k * 0.66),
        [0.42 if k % 2 else 0.64, 0.52, 0.15],
        0xD6C6A1,
        yaw,
      )
    box(s, front(side * 2.04, base + 1.60, 0.06), [0.42, 3.2, 0.23], 0xD5C5A0, yaw)
    for y in [5.97, 11.73, 17.03]:
      box(s, front(side * 5.2, y), [6.28, 0.18, 0.22], 0xCDBD94, yaw)
  for i in range(25):
    t0 = math.pi * i / 25
    t1 = math.pi * (i + 1) / 25
    rod(
      s,
      front(2.05 * math.cos(t0), base + 3.2 + 2.05 * math.sin(t0), 0.08),
      front(2.05 * math.cos(t1), base + 3.2 + 2.05 * math.sin(t1), 0.08),
      0.42,
      0xD8C7A0,
    )
  # Actual five-bay upper central facade (four windows plus middle balcony door).
  for i, x in enumerate([-6.25, -3.05, 0, 3.05, 6.25]):
    h = 2.12 if i == 2 else 1.74
    y = 14.24
    box(s, front(x, y), [1.17, h, 0.10], 0xE4E0D2, yaw)
    box(s, front(x, y, 0.07), [0.96, h - 0.20, 0.08], 0x63777C, yaw)
    for xx in [-0.31, 0, 0.31]:
      box(s, front(x + xx, y, 0.12), [0.055, h - 0.2, 0.06], 0xEFEBDD, yaw)
    for yy in [-0.53, 0, 0.53]:
      box(s, front(x, y + yy, 0.12), [0.96, 0.055, 0.06], 0xEFEBDD, yaw)
  box(s, front(0, 12.88, 0.45), [2.22, 0.16, 1.0], 0x9C977F, yaw)
  for x in np.linspace(-1.0, 1.0, 9):
    rod(s, front(x, 13.02, 0.92), front(x, 13.68, 0.92), 0.045, 0x343F3B)
  rod(s, front(-1.1, 13.70, 0.92), front(1.1, 13.70, 0.92), 0.06, 0x343F3B)
  # Bounded arched heraldic panel above the old eaves, original low relief.
  for radius in [4.74, 4.93]:
    points = [
      front(radius * math.cos(t), 17.26 + 2.50 * math.sin(t), 0.20)
      for t in np.linspace(0, math.pi, 35)
    ]
    for a0, b0 in zip(points, points[1:]):
      rod(s, a0, b0, 0.12, 0xD8C8A5)
  box(s, front(0, 17.18, 0.18), [10.05, 0.20, 0.20], 0xD2BE99, yaw)
  box(s, front(0, 18.40, 0.35), [0.76, 1.02, 0.20], 0xCFCCC0, yaw)
  for side in [-1, 1]:
    for i in range(5):
      rod(
        s,
        front(side * 0.4, 18.5, 0.31),
        front(side * (1.0 + i * 0.38), 18.65 - i * 0.12, 0.31),
        0.14,
        0x35433C,
      )
      rod(
        s,
        front(side * 2.15, 17.60, 0.30),
        front(side * (1.42 + i * 0.23), 18.13 + i * 0.13, 0.30),
        0.13,
        0x91A789,
      )
  for i in [-1, 0, 1]:
    box(
      s, front(i * 0.30, 19.36, 0.35), [0.17, 0.40 if i else 0.58, 0.17], 0xC6A646, yaw
    )
  # Only existing mapped footway approach; do not add a new rectangular plaza.
  approach = list(geom("way/4902366").coords)[1:] + list(
    reversed(list(geom("way/304335234").coords))
  )
  # Remove common endpoint, retaining full source vertices in the receipt.
  clean = []
  for q in approach:
    if not clean or math.dist(clean[-1], q) > 0.001:
      clean.append(q)
  for a0, b0 in zip(clean, clean[1:]):
    a0, b0 = np.array(a0), np.array(b0)
    length = np.linalg.norm(b0 - a0)
    direction = (b0 - a0) / length
    normal = np.array([-direction[1], direction[0]])
    for side in [-1, 1]:
      a1 = a0 + normal * side * 2.2
      b1 = b0 + normal * side * 2.2
      for y in [3.65, 4.17]:
        rod(s, [a1[0], y, a1[1]], [b1[0], y, b1[1]], 0.055, 0x4F5548)
      for t in np.linspace(0, 1, math.ceil(length / 2.25) + 1):
        q = a1 + (b1 - a1) * t
        rod(s, [q[0], 3.12, q[1]], [q[0], 4.22, q[1]], 0.055, 0x4F5548)
  anchors.append(
    {
      "kind": "gate-front",
      "sourcePart": "DEBE3DaVK9zcyYcF",
      "wall": [aa.tolist(), bb.tolist()],
      "center": front(0, 10),
    }
  )

  if native:
    for s in sites:
      blocks = []
      # Independent block-native reading: split each rotated fitting into short
      # axis-parallel pieces rather than rendering rotated smooth duplicates.
      for x, y, z, w, h, depth, angle, color in s["boxes"]:
        count = max(1, math.ceil(w / 0.42))
        for k in range(count):
          u = w * ((k + 0.5) / count - 0.5)
          dx, dz = abs(math.cos(angle)) * w / count, abs(math.sin(angle)) * w / count
          blocks.append(
            [
              round(x + math.cos(angle) * u, 5),
              y,
              round(z - math.sin(angle) * u, 5),
              round(max(0.12, dx + abs(math.sin(angle)) * depth), 5),
              h,
              round(max(0.12, dz + abs(math.cos(angle)) * depth), 5),
              color,
            ]
          )
      for r in s["rods"]:
        a, b = np.array(r[:3]), np.array(r[3:6])
        delta = b - a
        count = max(1, math.ceil(float(np.linalg.norm(delta)) / 0.48))
        size = np.maximum(abs(delta) / count, max(0.12, r[6]))
        for i in range(count):
          blocks.append(
            [
              *[round(float(q), 5) for q in a + delta * (i + 0.5) / count],
              *[round(float(q), 5) for q in size],
              r[7],
            ]
          )
      s["boxes"] = blocks
      s["rods"] = []
  # Complete water owners retained; only their overlap with the earlier false
  # shore band is added. Existing lake water stays in WestLakesV194 unchanged.
  from repair_tegel_shore_v198 import masks

  water = masks()[int(native)]
  s = site(
    "Tegel harbour mouth: corrected source water", ["way/8659535", "way/228201346"]
  )
  plane(s, water, -1.15, 0x69949D)
  nav = {
    "bridgeRing": [list(p) for p in bridge.exterior.coords],
    "bridgeHoles": [[list(p) for p in r.coords] for r in bridge.interiors],
    "deckY": deck_y,
    "bridgeBounds": list(bridge.bounds),
    "nativeDeck": [r[:6] for r in sites[1]["boxes"]] if native else [],
    "waterPolygons": [
      [[list(q) for q in r.coords] for r in [p.exterior, *p.interiors]]
      for p in ([water] if water.geom_type == "Polygon" else water.geoms)
    ],
    "waterBounds": list(water.bounds),
  }
  return {"sites": sites}, {"anchors": anchors, "navigation": nav}


def build() -> None:
  """Write only this bounded feature family's files."""
  from repair_tegel_shore_v198 import repair

  repair()
  drawn, evidence = make()
  native, ne = make(True)
  for name, data in [
    ("tegelSpandauV198.json", drawn),
    ("tegelSpandauV198Native.json", native),
  ]:
    (DATA / name).write_text(json.dumps(data, separators=(",", ":")) + "\n")
  # Native deck-only rows (not truss/castle blocks) for exact walking footprint.
  nav = evidence["navigation"]
  nav["nativeWaterPolygons"] = ne["navigation"]["waterPolygons"]
  nav["nativeWaterBounds"] = ne["navigation"]["waterBounds"]
  nav["nativeDeck"] = [
    r[:6]
    for r in native["sites"][1]["boxes"]
    if abs(r[1] - (nav["deckY"] - 0.08)) < 1e-6 and abs(r[4] - 0.16) < 1e-6
  ]
  (DATA / "tegelSpandauV198Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  source = freeze_sources()
  bridge = next(
    f for f in source["features"] if f["properties"].get("osm_way_id") == "943646072"
  )
  scope = {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "sourceOwner": "way/943646072",
          "scope": "Exact named Tegeler Hafenbruecke footprint; no surrounding land fill",
        },
        "geometry": bridge["geometry"],
      }
    ],
  }
  (GEO / "bounds-tegel-spandau-v198.geojson").write_text(
    json.dumps(scope, separators=(",", ":")) + "\n"
  )
  evidence.pop("navigation")
  evidence.update(
    {
      "sourceFile": "tegel-spandau-v198-source.json",
      "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
      "estimatePolicy": "All untagged member widths, arch rise, vertical levels, facade ornament and colours are reference-informed procedural recognition estimates. Exact old source sheets/footprints/shore rings remain unchanged; no claim of surveyed architectural ornament.",
      "preservedInputs": {
        p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest()
        for p in [
          "src/app/src/data/westLandmarksV187.json",
          "geo_data/regierungsviertel/west-landmarks-v187-source.json",
          "geo_data/regierungsviertel/west-lakes-v194-source.geojson",
        ]
      },
      "counts": {
        mode: {
          "boxes": sum(len(s["boxes"]) for s in data["sites"]),
          "rods": sum(len(s["rods"]) for s in data["sites"]),
          "triangles": sum(len(s["indices"]) // 3 for s in data["sites"]),
        }
        for mode, data in [("drawn", drawn), ("native", native)]
      },
    }
  )
  (GEO / "tegel-spandau-v198-evidence.json").write_text(
    json.dumps(evidence, indent=2) + "\n"
  )
  print(evidence["counts"])


if __name__ == "__main__":
  build()
