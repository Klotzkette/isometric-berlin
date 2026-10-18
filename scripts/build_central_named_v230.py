"""Five finite central-site refinements, replayed from immutable retained sources.

No facade survey is inferred. Existing aperture axes remain unchanged; the only
transferred body is the fully replayed main water-tower extrusion.
"""

from __future__ import annotations

import copy
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_breitscheid_towers_v161 import triangles_for
from build_school_culture_v228 import box
from build_schools_places_v205 import Face, group
from build_steglitz_v182 import native_blocks
from shapely.geometry import LineString, Point, Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "central-named-v230-source.json"


def read(path: Path) -> dict:
  """Read the finite source subset, never fetch during a replay."""
  return json.loads(path.read_text())


def new(key: str, name: str, owner: str, camera: list) -> dict:
  """One independently culled group per requested location."""
  return dict(**group(name, owner), key=key, camera=camera, sourceGeometryRetained=True)


def member_line(
  g: dict, a: list, b: list, width: float, height: float, color: int
) -> None:
  """A shallow continuous drawn course and its separate orthogonal segments."""
  length = math.hypot(b[0] - a[0], b[2] - a[2])
  if length < 0.01:
    return
  box(
    g,
    [(a[i] + b[i]) / 2 for i in range(3)],
    [length, height, width],
    -math.atan2(b[2] - a[2], b[0] - a[0]),
    color,
  )


def water_tower(source: dict) -> tuple[dict, dict, dict, dict]:
  """Retain every measured roof/wall; translate the parent rigidly to y=3."""
  p = copy.deepcopy(source["water"][0])
  shift = 3 - p["ground_y_m"]
  for s in p["surfaces"]:
    for r in s["rings"]:
      for v in r:
        v[1] += shift
  g = new("wasserturm", "Wasserturm Prenzlauer Berg", p["id"], [3288, 65, -1683])
  poly = Polygon(p["ring"], p["holes"])
  center = np.array(poly.centroid.coords[0])
  surfaces = []
  roof = []
  for s in p["surfaces"]:
    ts = triangles_for(s["rings"])
    isroof = s["kind"] == "RoofSurface"
    surfaces.append(
      {
        "color": 0x737164 if isroof else 0xAD7854,
        "triangles": ts,
        "sourceKind": s["kind"],
      }
    )
    if isroof:
      roof.extend(ts)
  # Twelve radial bays follow the source's repeated radial pilaster rhythm.
  # The 6 occupied storeys are documented; aperture proportions are estimates.
  for k in range(12):
    angle = math.radians(35 + 30 * k)
    n = np.array([math.cos(angle), math.sin(angle)])
    hits = poly.boundary.intersection(LineString([center, center + n * 25]))
    pts = list(hits.geoms) if hasattr(hits, "geoms") else [hits]
    pos = np.array(max(pts, key=lambda q: Point(center).distance(q)).coords[0])
    tangent = np.array([-n[1], n[0]])
    yaw = -math.atan2(tangent[1], tangent[0])

    def at(u: float, y: float, out: float = 0.18) -> list:
      q = pos + tangent * u + n * out
      return [float(q[0]), y, float(q[1])]

    for level in range(6):
      y = 5.65 + level * 4.15
      # White frames, subdued glazing and brick segmental heads, no black holes.
      for c, size, out in [
        (0xD9C9A8, [1.48, 2.35, 0.10], 0.18),
        (0x738B87, [1.17, 2.02, 0.10], 0.26),
      ]:
        start = len(g["nativeRows"])
        box(g, at(0, y, out), size, yaw, c)
        for row in g["nativeRows"][start:]:
          row[0] += n[0] * (1.05 if c == 0xD9C9A8 else 1.25)
          row[2] += n[1] * (1.05 if c == 0xD9C9A8 else 1.25)
      start = len(g["nativeRows"])
      box(g, at(0, y, 0.34), [0.075, 2.02, 0.07], yaw, 0xD7CFB8)
      box(g, at(0, y + 0.3, 0.34), [1.17, 0.075, 0.07], yaw, 0xD7CFB8)
      box(g, at(0, y - 1.17, 0.28), [1.68, 0.14, 0.22], yaw, 0xBEA079)
      for row in g["nativeRows"][start:]:
        row[0] += n[0] * 1.35
        row[2] += n[1] * 1.35
      for j in range(7):
        a = math.pi * j / 7
        b = math.pi * (j + 1) / 7
        aa = at(0.8 * math.cos(a), y + 1.16 + 0.38 * math.sin(a), 0.25)
        bb = at(0.8 * math.cos(b), y + 1.16 + 0.38 * math.sin(b), 0.25)
        g["rods"].append([*aa, *bb, 0.13, 0x8B5D42])
        mid = [(aa[i] + bb[i]) / 2 for i in range(3)]
        mid[0] += n[0] * 1.25
        mid[2] += n[1] * 1.25
        g["nativeRows"].append([*mid, 0.22, 0.20, 0.22, 0x8B5D42])
  # Source ring segments, not an ideal cylinder, control the brick cornices.
  ring = p["ring"]
  for y in [3.55, 29.1, 34.5, 35.35]:
    for a, b in zip(ring, ring[1:] + ring[:1]):
      mid = (np.array(a) + np.array(b)) / 2
      n = (mid - center) / np.linalg.norm(mid - center)
      member_line(
        g,
        [a[0] + n[0] * 0.1, y, a[1] + n[1] * 0.1],
        [b[0] + n[0] * 0.1, y, b[1] + n[1] * 0.1],
        0.18,
        0.16,
        0x9A6848,
      )
  # The narrow old standpipe tower remains its existing independent owner.
  old = source["water"][1]
  rr = old["ring"]
  for y in [4.0, 31.6, 34.4]:
    for a, b in zip(rr, rr[1:] + rr[:1]):
      member_line(g, [a[0], y, a[1]], [b[0], y, b[1]], 0.18, 0.16, 0xAC8260)
  common = {"key": "wasserturm", "name": g["name"], "owners": [p["id"]]}
  drawn = {**common, "surfaces": surfaces}
  native = {
    **common,
    "blocks": native_blocks({"surfaces": surfaces, "boxes": [], "rods": []}),
  }
  nav = {
    "key": "wasserturm",
    "bounds": list(poly.bounds),
    "owners": [
      {
        "id": p["id"],
        "owner": p["id"],
        "ring": p["ring"],
        "holes": p["holes"],
        "low": 3,
        "high": p["top_y_m"] + shift,
      }
    ],
    "roofTriangles": roof,
    "pads": [],
  }
  g["recognition"] = {
    "windowBays": 12,
    "occupiedStoreys": 6,
    "officialPublishedHeightM": 30,
    "retainedLod2HeightM": round(p["top_y_m"] - p["ground_y_m"], 3),
    "rigidOffsetY": shift,
    "completeSourceSurfaceCount": len(surfaces),
  }
  return g, drawn, native, nav


def kollwitz(source: dict) -> dict:
  """Keep exact mapped lawns, playground barrier and bench positions."""
  g = new("kollwitzplatz", "Kollwitzplatz", "OSM-way-24638848", [3228, 39, -1800])
  park = shape(
    next(p["geometry"] for p in source["kollwitz"]["areas"] if p["id"] == "24638848")
  )
  for a in source["kollwitz"]["areas"]:
    if a["tags"].get("landuse") != "grass":
      continue
    geom = shape(a["geometry"])
    polygons = list(geom.geoms) if hasattr(geom, "geoms") else [geom]
    for p in polygons:
      for aa, b in zip(p.exterior.coords, list(p.exterior.coords)[1:]):
        member_line(g, [aa[0], 3.12, aa[1]], [b[0], 3.12, b[1]], 0.14, 0.11, 0xB4AE9B)
  for barrier in source["kollwitz"]["barriers"]:
    coords = shape(barrier["geometry"]).coords
    for a, b in zip(coords, list(coords)[1:]):
      length = math.dist(a, b)
      if barrier["tags"]["barrier"] == "wall":
        member_line(g, [a[0], 3.3, a[1]], [b[0], 3.3, b[1]], 0.25, 0.6, 0xAC8063)
      else:
        for y in [3.3, 4.05]:
          member_line(g, [a[0], y, a[1]], [b[0], y, b[1]], 0.07, 0.07, 0x59695B)
        for t in np.arange(0, length, 1.7):
          q = np.array(a) + (np.array(b) - a) * t / length
          box(g, [*q[:1], 3.6, q[1]], [0.09, 1.1, 0.09], 0, 0x59695B)
  bench_count = 0
  for p in source["kollwitz"]["points"]:
    if p["tags"].get("amenity") != "bench":
      continue
    x, z = p["p"]
    aim = np.array(park.centroid.coords[0]) - p["p"]
    yaw = math.atan2(aim[0], aim[1])
    box(g, [x, 3.47, z], [1.8, 0.12, 0.48], yaw, 0xA78C64)
    for dx in [-0.65, 0.65]:
      box(
        g,
        [x + math.cos(yaw) * dx, 3.23, z - math.sin(yaw) * dx],
        [0.12, 0.48, 0.4],
        yaw,
        0x5B6259,
      )
    if p["tags"].get("backrest") == "yes":
      box(
        g,
        [x - math.sin(yaw) * 0.23, 3.84, z - math.cos(yaw) * 0.23],
        [1.8, 0.48, 0.09],
        yaw,
        0x9A805A,
      )
    bench_count += 1
  # Recorded sculpture: seated figure in a heavy folded coat, not a bust.
  monument = next(p for p in source["kollwitz"]["points"] if p["id"] == 603037654)
  x, z = monument["p"]
  bronze = 0x59665B
  for y, size, dx, dz, c in [
    (3.18, [2.8, 0.36, 2.2], 0, 0, 0xB6AF98),
    (3.55, [2.55, 0.45, 1.95], 0, 0, 0xC3BBA2),
    (4.1, [1.5, 0.45, 1.1], 0, 0, bronze),
    (4.7, [1.45, 0.8, 1.1], 0, 0.12, bronze),
    (5.45, [1.3, 0.85, 0.75], 0, -0.16, bronze),
    (6.06, [0.64, 0.65, 0.58], 0, -0.1, 0x647164),
  ]:
    box(g, [x + dx, y, z + dz], size, 0, c)
  for side in [-1, 1]:
    box(g, [x + side * 0.49, 4.07, z + 0.62], [0.48, 0.58, 0.65], 0, bronze)
    box(g, [x + side * 0.64, 5.16, z + 0.28], [0.26, 0.32, 0.76], side * 0.13, 0x647164)
  box(g, [x - 0.32, 4.98, z + 0.79], [0.84, 0.11, 0.5], -0.13, 0x738072)
  g["recognition"] = {
    "osmPark": "way/24638848",
    "osmSculpture": "node/603037654",
    "mappedBenches": bench_count,
    "sculptureEstimate": "Seated bronze silhouette, estimated dimensions and orientation; source point exact",
    "furnitureOrientation": "Toward park interior where OSM has no direction; display estimate",
  }
  return g


def choriner(source: dict) -> dict:
  """Masonry/lobby cues on the existing Schiffer facade; no second window grid."""
  old = read(DATA / "northV185.json")
  owner = "DEBE01YYK00005YZ"
  offset = read(DATA / "weinbergBuildingOffsetsV176.json")["offsets"][owner]
  g = new(
    "choriner-hoefe", "Choriner Höfe · Choriner Straße 84", owner, [2413, 26, -1276]
  )
  for raw in old["faces"]:
    if raw["id"] != owner:
      continue
    a = np.array(raw["a"])
    b = np.array(raw["b"])
    d = (b - a) / np.linalg.norm(b - a)
    wall = shape(raw["wallGeometry"])
    rings = []
    for r in [wall.exterior, *wall.interiors]:
      rings.append(
        [[a[0] + d[0] * u, 3 + offset + y, a[1] + d[1] * u] for u, y in r.coords]
      )
    f = Face(g, rings, [raw["normal"][0], 0, raw["normal"][1]])
    length = f.right - f.left
    floors = min(7, max(1, math.floor((f.top - f.base - 1) / 3.65)))
    pitch_y = (f.top - f.base - 1.5) / floors
    bays = max(1, math.floor(length / 3.7))
    pitch = length / bays
    # Fine stone joints run through the opaque piers, between delivered panes.
    for i in range(1, bays):
      u = f.left + i * pitch
      for level in range(floors):
        y = f.base + 1.85 + level * pitch_y
        f.member(u, y, 0.045, min(2, pitch_y * 0.58), 0xA29F8C, 0.055, 0.4)
    for y in [f.base + 0.6, f.top - 0.4]:
      f.member((f.left + f.right) / 2, y, length - 0.2, 0.1, 0xD2CBB5, 0.07, 0.4)
    # Reuse exact delivered openings: subtle warm lower glazing reflections.
    for i in range(bays):
      u = f.left + (i + 0.5) * pitch
      y = f.base + 1.85
      f.member(u, y - 0.45, min(1.9, pitch * 0.42), 0.13, 0xB7C4B8, 0.05, 0.42)
  # Follow every retained level roof edge: this makes the documented stepped
  # silhouette legible without filling a terrace or inventing a parapet wall.
  for sheet in source["chorinerRoofSheets"]:
    for ring in sheet["rings"]:
      if max(p[1] for p in ring) - min(p[1] for p in ring) > 0.015:
        continue
      for a, b in zip(ring, ring[1:] + ring[:1]):
        member_line(
          g,
          [a[0], a[1] + offset + 0.045, a[2]],
          [b[0], b[1] + offset + 0.045, b[2]],
          0.12,
          0.09,
          0xD3CCB6,
        )
  g["recognition"] = {
    "architect": "Frank Schiffer",
    "identity": "Haus aus Stein, completed 2012; street house, side wing and courtyard house",
    "terrainOffsetY": offset,
    "newWindowGrids": 0,
    "limitation": "Joints and reflected glazing bands are estimates aligned to prior v185 bays; stepped source roofs and courtyard openings remain unchanged",
  }
  return g


def lennon() -> dict:
  """Small brick-head keys and fine frames on the existing school aperture axes."""
  school = next(
    s
    for s in read(GEO / "schools-v185-evidence.json")["schools"]
    if s["name"] == "John-Lennon-Gymnasium"
  )
  g = new("john-lennon-gymnasium", school["name"], school["owner"], [2244, 25, -1327])
  for raw in school["faces"]:
    f = Face(g, raw["rings"], raw["normal"])
    length = f.right - f.left
    pitch = length / max(1, round(length / 3.4))
    for y in np.arange(f.base + 2.25, f.top - 0.8, 3.25):
      for u in np.arange(f.left + 0.05 + pitch / 2, f.right - 0.05, pitch):
        rise = 0.55 if y > f.top - 4.4 else 0.2
        f.member(float(u), float(y + 0.9 + rise), 0.17, 0.24, 0xD8BB92, 0.09, 0.47)
        # Corner glints stay on the existing pane, rather than black recesses.
        f.member(float(u - 0.48), float(y - 0.1), 0.045, 1.55, 0xAEC1B5, 0.045, 0.46)
    for y in [f.base + 0.48, f.top - 0.32]:
      f.member((f.left + f.right) / 2, y, length - 0.2, 0.09, 0xAC7A58, 0.07, 0.44)
  g["recognition"] = {
    "terrainOffsetY": school["displayTerrainOffsetY"],
    "architect": "Hermann Blankenstein",
    "newWindowGrids": 0,
    "limitation": "Shallow details follow the retained v205 openings; exact aperture survey unavailable",
  }
  return g


def east_quarter(source: dict) -> dict:
  """Only mapped street-facing walls of the one block east of Weinbergsweg."""
  g = new(
    "weinbergsweg-east",
    "Block east of Weinbergsweg",
    "bounded-20-source-owners",
    [2147, 42, -1465],
  )
  for owner in source["quarter"]:
    for raw in owner["faces"]:
      f = Face(g, raw["rings"], raw["normal"])
      wall = f.wall.buffer(-0.05)
      if wall.is_empty:
        continue
      left, low, right, high = wall.bounds
      pitch = f.length / max(1, round(f.length / 3.4))
      # Replay the existing v169 register exactly, adding only a thin transom.
      for y in np.arange(
        max(raw["ground"] + 2.25, low + 1.2), min(raw["top"], high) - 0.8, 3.25
      ):
        for u in np.arange(left + pitch / 2, right, pitch):
          f.member(float(u), float(y + 0.38), 1.2, 0.06, 0xB6BFAE, 0.05, 0.19)
      f.member(
        (left + right) / 2, low + 0.52, right - left - 0.1, 0.11, 0xBBB39B, 0.08, 0.22
      )
  g["recognition"] = {
    "owners": [s["id"] for s in source["quarter"]],
    "newWindowGrids": 0,
    "boundary": source["blockBoundary"],
    "limitation": "Existing facades, paint and measured roofs remain; transoms are estimates on the exact prior v169 aperture axes",
  }
  return g


def build() -> None:
  """Write only new versioned assets and the auditable face-to-source mapping."""
  source = read(SOURCE)
  tower, drawn, native, nav = water_tower(source)
  sites = [tower, kollwitz(source), choriner(source), east_quarter(source), lennon()]
  evidence = {
    "schemaVersion": 1,
    "sourceHashes": source["sourceHashes"]
    | {str(SOURCE.relative_to(ROOT)): hashlib.sha256(SOURCE.read_bytes()).hexdigest()},
    "faces": {s["key"]: s.pop("faces") for s in sites},
    "sources": source["sources"],
    "policy": "Source bodies and previous detail layers retained; only exact water-tower ownership yields to full measured sheets. Window/furniture/material details are openly estimated.",
  }
  for site in sites:
    site.pop("labels")
    for field in ["boxes", "rods", "nativeRows"]:
      site[field] = [
        [round(v, 4) if isinstance(v, float) else v for v in row] for row in site[field]
      ]
    site["bounds"] = [
      min(r[0] - max(r[3], r[5]) / 2 for r in site["boxes"]),
      min(r[2] - max(r[3], r[5]) / 2 for r in site["boxes"]),
      max(r[0] + max(r[3], r[5]) / 2 for r in site["boxes"]),
      max(r[2] + max(r[3], r[5]) / 2 for r in site["boxes"]),
    ]
  for path, value in [
    (DATA / "centralNamedV230.json", {"schemaVersion": 1, "sites": sites}),
    (DATA / "centralNamedV230Envelopes.json", {"sites": [drawn]}),
    (DATA / "centralNamedV230Native.json", {"sites": [native]}),
    (DATA / "centralNamedV230Navigation.json", {"sites": [nav]}),
    (GEO / "central-named-v230-evidence.json", evidence),
  ]:
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")
  print(
    json.dumps(
      {
        s["key"]: {
          "drawn": len(s["boxes"]) + len(s["rods"]),
          "native": len(s["nativeRows"]),
        }
        for s in sites
      }
    )
  )


if __name__ == "__main__":
  build()
