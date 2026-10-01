"""Retain the Cafe am Neuen See source roofs and prepare bounded garden detail."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import normal_of, triangles_for
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_387_5819.zip"
MAP = ROOT / "geo_data/regierungsviertel/raw/cafe-v164/selected-map-features.json"
PATH_MAP = ROOT / "geo_data/regierungsviertel/raw/cafe-v164/osm-map.xml"
DEST = ROOT / "src/app/src/data/cafeNeuerSeeV164Source.json"
GROUND = 5.2
LEGACY = ["yG0owFin", "SgY4xGay", "ian6cfqM", "fl00001D", "K0002Klw", "K0002KWV"]


def paint_native_glazing(blocks: dict, details: list) -> None:
  """Colour existing wall cells only when their centres project inside real panes."""
  for x, y, z, w, h, _depth, yaw, color, role in details:
    if role != "glass":
      continue
    cos, sin = math.cos(yaw), math.sin(yaw)
    for u in np.arange(-w / 2 + 0.05, w / 2, 0.35):
      for v in np.arange(-h / 2 + 0.05, h / 2, 0.35):
        cell = (
          math.floor(x + cos * u),
          math.floor(y + v - GROUND),
          math.floor(z - sin * u),
        )
        if cell not in blocks or blocks[cell][3] not in (0xAD9B7C, color):
          continue
        cx, cy, cz, _ = blocks[cell]
        along = (cx - x) * cos - (cz - z) * sin
        if abs(along) < w / 2 and abs(cy - y) < h / 2:
          blocks[cell][3] = color


def mapped_garden_paths(garden: Polygon) -> list[dict]:
  """Keep complete mapped path courses and explicit width/clearance estimates."""
  osm = ET.parse(PATH_MAP).getroot()
  tr = Transformer.from_crs(4326, 25833, always_xy=True)
  nodes = {}
  for node in osm.findall("node"):
    east, north = tr.transform(float(node.get("lon")), float(node.get("lat")))
    nodes[node.get("id")] = [round(east - 389500, 3), round(5820000 - north, 3)]
  result = []
  for way in osm.findall("way"):
    tags = {tag.get("k"): tag.get("v") for tag in way.findall("tag")}
    if tags.get("highway") not in ("footway", "path", "pedestrian", "steps"):
      continue
    line = [nodes[node.get("ref")] for node in way.findall("nd")]
    if len(line) < 2 or not garden.intersects(LineString(line).buffer(2)):
      continue
    width = float(tags["width"]) if "width" in tags else 2.2
    result.append(
      {
        "osmWay": way.get("id"),
        "line": line,
        "widthM": width,
        "widthSource": "OSM width" if "width" in tags else "2.2m display estimate",
        "furnitureClearanceM": 0.5,
      }
    )
  return result


def garden_floor_detail(
  garden: Polygon, seating: Polygon, buildings: Polygon, pond: Polygon, paths: list
) -> dict:
  """Prepare exact bounded ground polygons and compact orthogonal floor runs."""
  path_ground = unary_union(
    [LineString(p["line"]).buffer(p["widthM"] / 2) for p in paths]
  )
  excluded = unary_union([buildings, pond, path_ground])
  timber = seating.difference(excluded)
  gravel = garden.union(seating).difference(excluded.union(timber))
  surfaces, runs, polygons = [], [], []
  for kind, area, color, y in [
    ("gravel", gravel, 0xB7AD92, 5.32),
    ("timber", timber, 0xA18A67, 5.42),
  ]:
    for shape in getattr(area, "geoms", [area]):
      if shape.geom_type != "Polygon" or shape.area < 0.001:
        continue
      xz = [list(shape.exterior.coords)[:-1]] + [
        list(r.coords)[:-1] for r in shape.interiors
      ]
      rings = [[[float(x), y, float(z)] for x, z in r] for r in xz]
      surfaces.append({"kind": kind, "color": color, "triangles": triangles_for(rings)})
      polygons.append({"kind": kind, "ring": xz[0], "holes": xz[1:]})
    x0, z0, x1, z1 = area.bounds
    for z in range(math.floor(z0), math.ceil(z1)):
      start = None
      for x in range(math.floor(x0), math.ceil(x1) + 1):
        occupied = x < math.ceil(x1) and area.covers(Point(x + 0.5, z + 0.5))
        if occupied and start is None:
          start = x
        elif not occupied and start is not None:
          runs.append(
            [(start + x) / 2, round(y - 0.06, 3), z + 0.5, x - start, 0.12, 1, color]
          )
          start = None
  # Planks follow the rectangle's long axis, clipped to the actual mapped deck.
  edges = list(
    zip(
      list(seating.exterior.coords)[:-1], list(seating.exterior.coords)[1:], strict=True
    )
  )
  a, b = max(edges, key=lambda e: math.dist(*e))
  dx, dz = b[0] - a[0], b[1] - a[1]
  length = math.hypot(dx, dz)
  u = (dx / length, dz / length)
  v = (-u[1], u[0])
  center = seating.centroid.coords[0]
  offsets = [
    (x - center[0]) * v[0] + (z - center[1]) * v[1] for x, z in seating.exterior.coords
  ]
  planks = []
  for offset in np.arange(min(offsets), max(offsets), 0.35):
    line = LineString(
      [
        (center[0] + u[0] * t + v[0] * offset, center[1] + u[1] * t + v[1] * offset)
        for t in [-length * 2, length * 2]
      ]
    ).intersection(timber)
    for segment in getattr(line, "geoms", [line]):
      if segment.geom_type == "LineString" and segment.length > 0.02:
        planks.append([[float(x), float(z)] for x, z in segment.coords])
  # Only the mapped deck bank face gets a rail, never the whole garden perimeter.
  shoreline = timber.boundary.intersection(pond.buffer(2))
  rails = []
  for segment in getattr(shoreline, "geoms", [shoreline]):
    if segment.geom_type != "LineString":
      continue
    for a, b in zip(list(segment.coords)[:-1], list(segment.coords)[1:], strict=True):
      if math.dist(a, b) > 0.15:
        rails.append([list(a), list(b)])
  return {
    "gardenSurfaces": surfaces,
    "gardenNativeRuns": runs,
    "gardenFloorPolygons": polygons,
    "deckPlankLines": planks,
    "shorelineDeckRails": rails,
    "deckY": 5.42,
    "gardenSurfaceStatus": "Exact mapped garden/seating clipped against source building footprints, mapped pond and preserved path courses. Gravel/timber palettes and plank spacing are display estimates. Native ground is one-metre centre-sampled row runs; building cells unchanged.",
  }


def facade(rings: list) -> list:
  """Photo-proportioned timber posts and glazing clipped to actual wall planes."""
  normal = normal_of(rings[0])
  if abs(normal[1]) > 0.01:
    return []
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda pair: math.hypot(pair[1][0] - pair[0][0], pair[1][2] - pair[0][2]),
  )
  base = np.array(a)
  direction = np.array([b[0] - a[0], 0, b[2] - a[2]])
  length = float(np.linalg.norm(direction))
  if length < 0.25:
    return []
  direction /= length
  wall = Polygon(
    [
      [(float(np.dot(np.subtract(p, base), direction)), p[1]) for p in r] for r in rings
    ][0]
  ).buffer(-0.015)
  if wall.is_empty:
    return []
  low, y0, high, y1 = wall.bounds
  rows = []
  yaw = math.atan2(-direction[2], direction[0])

  def emit(u, y, w, h, color, offset=0.07, depth=0.08, role="frame"):
    if (
      w <= 0
      or h <= 0
      or not wall.covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
    ):
      return
    p = base + direction * u + normal * offset
    rows.append(
      [
        round(p[0], 3),
        round(y, 3),
        round(p[2], 3),
        round(w, 3),
        round(h, 3),
        depth,
        round(yaw, 6),
        color,
        role,
      ]
    )

  # A continuous low restaurant, not stacked generic office window rows.
  h = min(3.25, y1 - y0 - 0.42)
  if h < 0.35:
    return []
  n = max(1, round(length / 1.5))
  pitch = (high - low) / n
  for i in range(n):
    u = low + (i + 0.5) * pitch
    w = pitch - 0.11
    emit(u, y0 + 0.20 + h / 2, w, h, 0x526C69, role="glass")
    emit(u - w / 2 - 0.025, y0 + 0.20 + h / 2, 0.07, h, 0x73543C, 0.16, 0.12)
    emit(u + w / 2 + 0.025, y0 + 0.20 + h / 2, 0.07, h, 0x73543C, 0.16, 0.12)
    for y in [y0 + 0.18, y0 + h * 0.72, y0 + 0.25 + h]:
      emit(u, y, w, 0.08, 0x917456, 0.18, 0.10)
  emit((low + high) / 2, y0 + 0.32, high - low - 0.06, 0.20, 0x9C8465, 0.12, 0.12)
  emit((low + high) / 2, y1 - 0.15, high - low - 0.06, 0.16, 0x77654C, 0.16, 0.18)
  return rows


def build() -> dict:
  """Retain source rings and build both drawn and native representations offline."""
  parents, parts, surfaces, details = [], [], [], []
  blocks = {}
  for parent_id in ["DEBE01ALfl000004", "DEBE01ALfl00001D"]:
    parent = extract_parent(ARCHIVE, parent_id)
    raw = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    offset = GROUND - min(p["ground_y_m"] for p in raw)
    parents.append(
      {"id": parent_id, "sourceParts": raw, "displayOffsetY": round(offset, 3)}
    )
    for original in raw:
      p = json.loads(json.dumps(original))
      p["ground_y_m"] = round(p["ground_y_m"] + offset, 3)
      p["top_y_m"] = round(p["top_y_m"] + offset, 3)
      for s in p["surfaces"]:
        for ring in s["rings"]:
          for q in ring:
            q[1] = round(q[1] + offset, 3)
        roof = s["kind"] == "RoofSurface"
        color = 0x737C75 if roof else 0xAD9B7C
        ts = triangles_for(s["rings"])
        surfaces.append(
          {"partId": p["id"], "kind": s["kind"], "color": color, "triangles": ts}
        )
        if not roof:
          details.extend(facade(s["rings"]))
        for tri in ts:
          a, b, c = map(np.array, tri)
          n = max(
            1,
            math.ceil(
              max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
              / 0.65
            ),
          )
          for i in range(n + 1):
            for j in range(n + 1 - i):
              q = a + (b - a) * i / n + (c - a) * j / n
              key = (math.floor(q[0]), math.floor(q[1] - GROUND), math.floor(q[2]))
              if roof or key not in blocks:
                blocks[key] = [
                  key[0] + 0.5,
                  round(GROUND + key[1] + 0.5, 3),
                  key[2] + 0.5,
                  color,
                ]
      parts.append(p)
  paint_native_glazing(blocks, details)
  features = json.loads(MAP.read_text())
  by_id = {f["id"]: f for f in features}
  # Two automatically derived ~30 m LoD2 roof envelopes sit in the tree canopy
  # above OSM's explicitly one-storey toilet. Preserve those source bodies and
  # limit this documented display correction to these exact identities.
  for pid in ["DEBE01YYK0002Klw", "DEBE01YYK0002KWV"]:
    parent = extract_parent(ARCHIVE, pid)
    parents.append(
      {
        "id": pid,
        "sourceParts": [
          part_profile(p) for p in leaf_building_parts(parent) or [parent]
        ],
        "displayCorrection": "One-storey OSM toilet 118603618; 3.2m estimated display height. Photogrammetric canopy contamination is an inference; see source notes.",
      }
    )
  r = by_id["118603618"]["world_xz_m"][:-1]
  low = [[x, GROUND, z] for x, z in r]
  high = [[x, GROUND + 3.2, z] for x, z in r]
  sheets = [{"kind": "RoofSurface", "rings": [high]}] + [
    {
      "kind": "WallSurface",
      "rings": [[low[i], low[(i + 1) % len(r)], high[(i + 1) % len(r)], high[i]]],
    }
    for i in range(len(r))
  ]
  parts.append(
    {
      "id": "osm-way-118603618",
      "height_m": 3.2,
      "ground_y_m": GROUND,
      "top_y_m": GROUND + 3.2,
      "ring": r,
      "holes": [],
      "surfaces": sheets,
      "displayEstimate": True,
    }
  )
  for sheet in sheets:
    roof = sheet["kind"] == "RoofSurface"
    ts = triangles_for(sheet["rings"])
    color = 0x68706A if roof else 0x967A57
    surfaces.append(
      {
        "partId": "osm-way-118603618",
        "kind": sheet["kind"],
        "color": color,
        "triangles": ts,
      }
    )
    for tri in ts:
      a, b, c = map(np.array, tri)
      n = max(
        1,
        math.ceil(
          max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b)) / 0.6
        ),
      )
      for i in range(n + 1):
        for j in range(n + 1 - i):
          q = a + (b - a) * i / n + (c - a) * j / n
          k = (math.floor(q[0]), math.floor(q[1] - GROUND), math.floor(q[2]))
          blocks[k] = [k[0] + 0.5, round(GROUND + k[1] + 0.5, 3), k[2] + 0.5, color]
  garden = Polygon(by_id["118616321"]["world_xz_m"])
  seating = Polygon(by_id["1069887158"]["world_xz_m"])
  buildings = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
  sandpits = [by_id[k]["world_xz_m"] for k in ["8968204444", "8968204465"]]
  available = garden.union(seating).difference(buildings.buffer(2.4))
  paths = mapped_garden_paths(garden.union(seating))
  path_clearance = unary_union(
    [
      LineString(p["line"]).buffer(p["widthM"] / 2 + p["furnitureClearanceM"])
      for p in paths
    ]
  )
  available = available.difference(path_clearance)
  for p in sandpits:
    available = available.difference(Point(p).buffer(4.5))
  water = next(
    p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json").read_text()
    )["water"]
    if p.get("name") == "Neuer See"
  )
  pond = Polygon(
    [(x / 10, z / 10) for x, z in water["ring"]],
    [[(x / 10, z / 10) for x, z in h] for h in water["holes"]],
  )
  available = available.difference(pond.buffer(0.4))
  tables, chairs = [], []
  for x in np.arange(-1915, -1825, 5.8):
    for z in np.arange(837, 945, 5.8):
      p = Point(x, z)
      if not available.covers(p.buffer(2.5)):
        continue
      (chairs if p.distance(pond) < 12 and len(chairs) < 8 else tables).append(
        [round(x, 3), round(z, 3)]
      )
  tables = tables[:42]
  boats = []
  for x, z, yaw in [
    (-1900, 884, 0.45),
    (-1920, 875, 1.1),
    (-1940, 890, -0.5),
    (-1950, 864, 0.8),
    (-1940, 848, -0.7),
    (-1900, 860, 0.15),
  ]:
    if not pond.covers(Point(x, z).buffer(3)):
      raise ValueError(f"Boat leaves the real water outline: {x},{z}")
    boats.append([x, z, yaw])
  # Small open-sided seasonal tents. Operator confirms covered event areas;
  # these are explicit placements, not surveyed permanent building footprints.
  canopies = []
  for x, z in tables[::-1]:
    if available.covers(box(x - 3.5, z - 3, x + 3.5, z + 3)) and all(
      math.hypot(x - a, z - b) > 12 for a, b in canopies
    ):
      canopies.append([x, z])
      if len(canopies) == 2:
        break
  old = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  return {
    "schemaVersion": 1,
    "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_387_5819.zip",
    "sourceSha256": hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
    "license": "dl-de/zero-2-0",
    "mapSourceSha256": hashlib.sha256(MAP.read_bytes()).hexdigest(),
    "pathMapSourceSha256": hashlib.sha256(PATH_MAP.read_bytes()).hexdigest(),
    "pathMapSourceUrl": "https://api.openstreetmap.org/api/0.6/map?bbox=13.3415,52.5092,13.3463,52.5127",
    "mapLicense": "ODbL-1.0",
    "groundY": GROUND,
    "waterY": 5.36,
    "nativeWaterY": 5.2,
    "parents": parents,
    "parts": parts,
    "surfaces": surfaces,
    "facadeBoxes": details,
    "nativeBlocks": list(blocks.values()),
    "legacyPrisms": [p for p in old if p["id"] in LEGACY],
    "features": features,
    "protectedPaths": paths,
    "water": water,
    "tables": tables,
    "chairTables": chairs,
    "boats": boats,
    "canopies": canopies,
    "sandpits": sandpits,
    **garden_floor_detail(garden, seating, buildings, pond, paths),
    "detailStatus": "Full official walls and roofs retained with rigid terrain datum translation. Glazing, timber subdivisions, furniture layouts, seasonal canopies and boat positions are display estimates. Both sandpit centres and the boat-rental pier follow OSM. Boats remain entirely in the mapped lake.",
  }


def main() -> None:
  source = build()
  DEST.write_text(json.dumps(source, separators=(",", ":")) + "\n")
  roof_cells = {}
  for x, y, z, _ in source["nativeBlocks"]:
    roof_cells[(x, z)] = max(roof_cells.get((x, z), -999), y + 0.5)
  nav = {
    "parts": [{k: v for k, v in p.items() if k != "surfaces"} for p in source["parts"]],
    "legacyPrisms": source["legacyPrisms"],
    "roofTriangles": [
      t
      for s in source["surfaces"]
      if s["kind"] == "RoofSurface"
      for t in s["triangles"]
    ],
    "nativeRoofCells": [[x, z, y] for (x, z), y in roof_cells.items()],
  }
  DEST.with_name("cafeNeuerSeeV164Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(
    {
      "parts": len(source["parts"]),
      "surfaces": len(source["surfaces"]),
      "facadeBoxes": len(source["facadeBoxes"]),
      "nativeBlocks": len(source["nativeBlocks"]),
      "tables": len(source["tables"]),
      "chairs": len(source["chairTables"]) * 4,
      "boats": len(source["boats"]),
      "canopies": source["canopies"],
    }
  )


if __name__ == "__main__":
  main()
