"""Step 10: bounded OSM zoo grounds and retained official animal-house envelopes."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import normal_of, triangles_for
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "geo_data/regierungsviertel/raw/zoo-v165"
DEST = ROOT / "src/app/src/data/zooGroundsV165Source.json"
GROUND = 5.2
MAP_URL = "https://api.openstreetmap.org/api/0.6/map?bbox=13.329,52.503,13.345,52.517"
PARENT_INVENTORY = [
  {
    "id": "DEBE01YYK0002Ky5",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_386_5818.zip",
    "matches": [["16870088", "Elefantenhaus"]],
    "parts": [
      "DEBE3DOj4hWCz26H",
      "DEBE3DlaudFoWODQ",
      "DEBE3DO3gErXnTnq",
      "DEBE3Do3nULBkRLC",
      "DEBE3DfffBaO8MFR",
      "DEBE3DANrYo0IOEm",
    ],
  },
  {
    "id": "DEBE01AL2sL00001",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_386_5818.zip",
    "matches": [["1102580371", "Nashornhaus"]],
    "parts": ["DEBE01AL2sL00001"],
  },
  {
    "id": "DEBE01YYK0002NM4",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5818.zip",
    "matches": [["17042389", "Flusspferdehaus"]],
    "parts": ["DEBE01YYK0002NM4"],
  },
  {
    "id": "DEBE01YYK0002Llm",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5818.zip",
    "matches": [["16970136", "Antilopenhaus"]],
    "parts": [
      "DEBE3Drui8AqAV8i",
      "DEBE3DXnWX0r0nE6",
      "DEBE3Dunk6GwyXsb",
      "DEBE3Dvn9C6CeHpi",
      "DEBE3DEBkxMuG68E",
      "DEBE3DlyqEefwivU",
    ],
  },
  {
    "id": "DEBE01YYK0003UYz",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5818.zip",
    "matches": [["16870088", "Elefantenhaus"]],
    "parts": ["DEBE01YYK0003UYz"],
  },
  {
    "id": "DEBE01YYK0002Mk0",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5818.zip",
    "matches": [["18330093", "Zoo-Aquarium Berlin"]],
    "parts": ["DEBE3DailHARv4Sq", "DEBE3DDAMmaLbxkE", "DEBE3DvWlPmk5vEL"],
  },
  {
    "id": "DEBE00YY1Ff00063",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5818.zip",
    "matches": [["48122775", "Löwentor"]],
    "parts": ["DEBE00YY1Ff00063"],
  },
  {
    "id": "DEBE01YYK0003V55",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5818.zip",
    "matches": [["18330093", "Zoo-Aquarium Berlin"]],
    "parts": ["DEBE01YYK0003V55"],
  },
  {
    "id": "DEBE01YYK0003VAC",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5818.zip",
    "matches": [["17042389", "Flusspferdehaus"]],
    "parts": ["DEBE01YYK0003VAC"],
  },
  {
    "id": "DEBE01YYK0002OG3",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5818.zip",
    "matches": [["18330093", "Zoo-Aquarium Berlin"]],
    "parts": [
      "DEBE3DL0UZXzrV1s",
      "DEBE3Dj2Ix6gbYfB",
      "DEBE3DUEOai1t2He",
      "DEBE3DV4A9VpupDQ",
      "DEBE3DrZxtUbZFMS",
      "DEBE3DyDgW8pE8kk",
      "DEBE3DToU0QtGkc0",
      "DEBE3DLLDuDVX5dO",
      "DEBE3DxSlhKFYrA8",
      "DEBE3DhHiRWN7rIk",
      "DEBE3DoUnf69nvMl",
      "DEBE3DiqwJsx53AQ",
      "DEBE3DoyPgBlSkfG",
      "DEBE3DqH1PrGKdq6",
      "DEBE3DSfvUKGMhoI",
      "DEBE3DKzT1Dr3MkB",
      "DEBE3DTAcQSJTzq8",
      "DEBE3DyYDsD0Q9vv",
      "DEBE3DtAjEu04sQE",
      "DEBE3DieV4VgbKvj",
      "DEBE3DEo2Gt0Ueja",
    ],
  },
  {
    "id": "DEBE01AL2sL00006",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5818.zip",
    "matches": [["1102580371", "Nashornhaus"]],
    "parts": ["DEBE01AL2sL00006"],
  },
  {
    "id": "DEBE01AL2sL00007",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5818.zip",
    "matches": [["1102580371", "Nashornhaus"]],
    "parts": ["DEBE01AL2sL00007"],
  },
  {
    "id": "DEBE01YYK0002Ox9",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5819.zip",
    "matches": [["schleusenkrug", "Schleusenkrug"]],
    "parts": ["DEBE3DaIyvHJ6MDq", "DEBE3DuF5mcLWNSh"],
  },
  {
    "id": "DEBE01YYK0002OEA",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5819.zip",
    "matches": [["48120295", "Vogelhaus"]],
    "parts": ["DEBE01YYK0002OEA"],
  },
  {
    "id": "DEBE01YYK0002NEV",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5819.zip",
    "matches": [["48120295", "Vogelhaus"]],
    "parts": ["DEBE01YYK0002NEV"],
  },
  {
    "id": "DEBE01YYK0002Kn3",
    "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5819.zip",
    "matches": [["238917065", ""]],
    "parts": ["DEBE3DyRAaBHh6LD", "DEBE3DWINsha0OLq", "DEBE3DmLE7NF4nBG"],
  },
]

PARENT_INVENTORY.extend(
  [
    {
      "id": "DEBE00YYgD00006I",
      "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5818.zip",
      "matches": [["32995989", "Condor aviary"]],
    },
    {
      "id": "DEBE00YYgD00006J",
      "file": "geo_data/regierungsviertel/raw/lod2/LoD2_387_5818.zip",
      "matches": [["32995991", "Marsh bird aviary"]],
    },
  ]
)

HERO_OSM = {
  "238917065",
  "48120295",
  "16870088",
  "16970136",
  "17042389",
  "18330093",
  "1102580371",
  "48122775",
  "schleusenkrug",
  "32995989",
  "32995991",
}


def map_features() -> list[dict]:
  """Retain tagged nodes/ways in the zoo and the adjacent beer garden."""
  tree = ET.parse(RAW / "osm-map.xml").getroot()
  tr = Transformer.from_crs(4326, 25833, always_xy=True)
  nodes = {}
  for e in tree.findall("node"):
    x, z = tr.transform(float(e.get("lon")), float(e.get("lat")))
    nodes[e.get("id")] = [round(x - 389500, 3), round(5820000 - z, 3)]
  ways = {e.get("id"): e for e in tree.findall("way")}
  zoo = Polygon([nodes[n.get("ref")] for n in ways["9393789"].findall("nd")])
  beer = Polygon([nodes[n.get("ref")] for n in ways["1046088364"].findall("nd")])
  scope = zoo.union(beer.buffer(12))
  features = []
  keys = {
    "name",
    "building",
    "building:part",
    "building:levels",
    "height",
    "highway",
    "surface",
    "width",
    "bridge",
    "tunnel",
    "natural",
    "landuse",
    "attraction",
    "barrier",
    "fence_type",
    "water",
    "waterway",
    "tourism",
    "amenity",
    "entrance",
    "species",
    "note",
    "access",
    "playground",
  }
  for e in tree:
    tags = {t.get("k"): t.get("v") for t in e.findall("tag") if t.get("k") in keys}
    if not tags or e.tag not in ("way", "node"):
      continue
    coords = (
      nodes[e.get("id")]
      if e.tag == "node"
      else [nodes[n.get("ref")] for n in e.findall("nd")]
    )
    geom = Point(coords) if e.tag == "node" else LineString(coords)
    if scope.intersects(geom):
      features.append(
        {"type": e.tag, "id": e.get("id"), "tags": tags, "coordinates": coords}
      )
  return features


def polygon_parts(shape):
  """Iterate every nonempty area, retaining holes."""
  for p in getattr(shape, "geoms", [shape]):
    if p.geom_type == "Polygon" and p.area > 0.001:
      yield p


def native_rows(cells: dict) -> list[list]:
  """Lossless row merging of one-metre source-surface blocks, never solid fill."""
  grouped = defaultdict(list)
  for (x, y, z), color in cells.items():
    grouped[(y, z, color)].append(x)
  rows = []
  for (y, z, color), xs in sorted(grouped.items()):
    xs.sort()
    start = previous = xs[0]
    for x in xs[1:] + [xs[-1] + 2]:
      if x != previous + 1:
        rows.append(
          [
            (start + previous + 1) / 2,
            round(GROUND + y + 0.5, 3),
            z + 0.5,
            previous - start + 1,
            1,
            1,
            color,
          ]
        )
        start = x
      previous = x
  return rows


def sample_triangles(cells: dict, triangles: list, color: int) -> None:
  """Vectorised source-surface sampling; compact occupancy stays offline."""
  for triangle in triangles:
    a, b, c = np.array(triangle)
    n = max(
      1,
      math.ceil(
        max(np.linalg.norm(a - b), np.linalg.norm(a - c), np.linalg.norm(b - c)) / 0.65
      ),
    )
    for i in range(n + 1):
      js = np.arange(n + 1 - i)[:, None]
      points = a + (b - a) * i / n + (c - a) * js / n
      points[:, 1] -= GROUND
      for p in np.floor(points).astype(int):
        cells[tuple(int(v) for v in p)] = color


def facade(rings: list, palette: tuple[int, int], glazed: bool = False) -> list:
  """Bounded independently authored mullions/panes on measured wall planes."""
  normal = normal_of(rings[0])
  if abs(normal[1]) > 0.01:
    return []
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda v: math.hypot(v[1][0] - v[0][0], v[1][2] - v[0][2]),
  )
  direction = np.array([b[0] - a[0], 0, b[2] - a[2]])
  length = np.linalg.norm(direction)
  if length < 2:
    return []
  direction /= length
  base = np.array(a)
  wall = Polygon(
    [(float(np.dot(np.subtract(p, base), direction)), p[1]) for p in rings[0]]
  ).buffer(-0.08)
  if wall.is_empty:
    return []
  lo, y0, hi, y1 = wall.bounds
  rows = []
  width = 2.1 if glazed else 1.25
  for u in np.arange(lo + 1.2, hi - 0.5, 2.5 if glazed else 3.2):
    for y in np.arange(y0 + 1.9, y1 - 0.6, 3.1):
      h = 2.45 if glazed else 1.8
      if wall.covers(box(u - width / 2, y - h / 2, u + width / 2, y + h / 2)):
        q = base + direction * u + normal * 0.07
        yaw = math.atan2(-direction[2], direction[0])
        rows.append(
          [
            round(q[0], 3),
            round(y, 3),
            round(q[2], 3),
            width,
            h,
            0.08,
            round(yaw, 6),
            palette[0],
          ]
        )
        for du in [-width / 2, 0, width / 2]:
          v = q + direction * du + normal * 0.05
          rows.append(
            [
              round(v[0], 3),
              round(y, 3),
              round(v[2], 3),
              0.07,
              h + 0.08,
              0.08,
              round(yaw, 6),
              palette[1],
            ]
          )
  return rows


def build() -> dict:
  """Prepare complete source buildings, mapped ground and structural anchors."""
  features = map_features()
  by_id = {p["id"]: p for p in features}
  zoo = Polygon(by_id["9393789"]["coordinates"])
  beer = Polygon(by_id["1046088364"]["coordinates"])
  parents, parts, surfaces, facades, cells = [], [], [], [], {}
  selected = PARENT_INVENTORY
  for record in selected:
    identity = record["matches"][0][0]
    if identity not in HERO_OSM:
      continue
    path = ROOT / record["file"]
    element = extract_parent(path, record["id"])
    raw = [part_profile(p) for p in leaf_building_parts(element) or [element]]
    offset = GROUND - min(p["ground_y_m"] for p in raw)
    parents.append(
      {
        "id": record["id"],
        "osm": identity,
        "name": record["matches"][0][1],
        "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/" + path.name,
        "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "displayOffsetY": round(offset, 3),
        "sourceParts": raw,
      }
    )
    for original in raw:
      p = json.loads(json.dumps(original))
      p["ground_y_m"] = round(p["ground_y_m"] + offset, 3)
      p["top_y_m"] = round(p["top_y_m"] + offset, 3)
      p["osm"] = identity
      for s in p["surfaces"]:
        for ring in s["rings"]:
          for q in ring:
            q[1] = round(q[1] + offset, 3)
        roof = s["kind"] == "RoofSurface"
        glass = (
          identity in ("32995989", "32995991")
          or (identity == "17042389" and record["id"].endswith("2NM4"))
          or (identity == "238917065" and p["id"].endswith("WINsha0OLq"))
        )
        color = 0x758C86 if glass else (0x69756B if roof else 0xC6B79A)
        if identity == "schleusenkrug":
          color = 0x576D66 if roof else 0x748B83
        elif identity == "18330093":
          color = 0x708479 if roof else 0xC6AF91
        elif identity == "16870088":
          color = 0x788B76 if roof else 0xB49772
        ts = triangles_for(s["rings"])
        surfaces.append(
          {
            "partId": p["id"],
            "kind": s["kind"],
            "color": color,
            "glass": glass,
            "triangles": ts,
          }
        )
        sample_triangles(cells, ts, color)
        if not roof and not glass:
          facades.extend(
            facade(
              s["rings"],
              (0x506E68, 0x887857),
              identity in ("schleusenkrug", "238917065"),
            )
          )
      parts.append(p)
  # All source animal-house outlines remain in the model. Their OSM rings also
  # prevent paths and beer-garden furniture from crossing building footprints.
  buildings = []
  for f in features:
    if f["type"] == "way" and f["tags"].get("building") and len(f["coordinates"]) > 3:
      p = Polygon(f["coordinates"]).buffer(0)
      if zoo.contains(p.representative_point()) or beer.buffer(12).contains(
        p.representative_point()
      ):
        buildings.append(p)
  occupied = unary_union(buildings)
  paths, habitats, waters, barriers = [], [], [], []
  for f in features:
    t, coords = f["tags"], f["coordinates"]
    if f["type"] != "way":
      continue
    if (
      t.get("highway") in ("footway", "path", "pedestrian", "steps", "service")
      and not t.get("tunnel")
      and not t.get("bridge")
    ):
      line = LineString(coords)
      if zoo.intersects(line) or beer.intersects(line):
        width = (
          float(t.get("width", "3.0").split()[0])
          if t.get("width", "3.0").split()[0].replace(".", "").isdigit()
          else 3.0
        )
        paths.append(
          {
            "id": f["id"],
            "line": coords,
            "width": width,
            "widthSource": "OSM" if "width" in t else "display estimate",
            "surface": t.get("surface", "paving_stones"),
          }
        )
    if (
      t.get("attraction") == "animal"
      and not t.get("building")
      and len(coords) > 3
      and coords[0] == coords[-1]
    ):
      habitats.append(
        {
          "id": f["id"],
          "name": t.get("name", "Mapped enclosure"),
          "ring": coords[:-1],
          "surface": t.get("natural", t.get("landuse", "grassland")),
          "species": t.get("species", ""),
        }
      )
    if (
      t.get("natural") == "water"
      and len(coords) > 3
      and coords[0] == coords[-1]
      and zoo.covers(Polygon(coords).representative_point())
    ):
      waters.append(
        {"id": f["id"], "ring": coords[:-1], "name": t.get("name", "Zoo pond")}
      )
    if t.get("barrier") in ("fence", "wall", "hedge") and zoo.covers(
      LineString(coords).representative_point()
    ):
      barriers.append(
        {
          "id": f["id"],
          "line": coords,
          "kind": t["barrier"],
          "height": float(t.get("height", 1.3))
          if str(t.get("height", 1.3)).replace(".", "").isdigit()
          else 1.3,
        }
      )
  water_area = unary_union([Polygon(p["ring"]) for p in waters])
  path_area = (
    unary_union(
      [LineString(p["line"]).buffer(p["width"] / 2, quad_segs=3) for p in paths]
    )
    .intersection(zoo.union(beer))
    .difference(occupied.union(water_area))
  )
  ground_surfaces, ground_runs, ground_polygons = [], [], []

  def ground(shape, kind, color, y):
    for p in polygon_parts(shape):
      rings = [list(p.exterior.coords)[:-1]] + [
        list(h.coords)[:-1] for h in p.interiors
      ]
      ground_polygons.append({"kind": kind, "rings": rings, "area": round(p.area, 3)})
      ground_surfaces.append(
        {
          "kind": kind,
          "color": color,
          "triangles": triangles_for([[[x, y, z] for x, z in r] for r in rings]),
        }
      )
      x0, z0, x1, z1 = p.bounds
      for z in range(math.floor(z0), math.ceil(z1)):
        line = p.intersection(LineString([(x0 - 1, z + 0.5), (x1 + 1, z + 0.5)]))
        for segment in getattr(line, "geoms", [line]):
          if segment.geom_type != "LineString" or segment.is_empty:
            continue
          a, _, b, _ = segment.bounds
          start, end = math.ceil(a - 0.5), math.floor(b - 0.5)
          if end >= start:
            ground_runs.append(
              [
                (start + end + 1) / 2,
                round(y - 0.06, 3),
                z + 0.5,
                end - start + 1,
                0.12,
                1,
                color,
              ]
            )

  for h in habitats:
    p = (
      Polygon(h["ring"])
      .buffer(0)
      .intersection(zoo)
      .difference(occupied.union(water_area).union(path_area))
    )
    color = (
      0xB6B09A
      if h["surface"] == "bare_rock"
      else 0xC8BB96
      if h["surface"] == "sand"
      else 0x85966B
    )
    ground(p, "habitat:" + h["id"], color, 5.38)
  ground(path_area, "paths", 0xBCB8A5, 5.44)
  ground(water_area.difference(occupied), "ponds", 0x58848A, 5.42)
  beer_ground = beer.difference(occupied.union(path_area).union(water_area))
  ground(beer_ground, "biergarten", 0xB5AE95, 5.43)
  furniture = []
  allowed = beer_ground.buffer(-2)
  for z in np.arange(778, 830, 3.8):
    for x in np.arange(-2480, -2400, 4.3):
      if allowed.covers(Point(x, z).buffer(1.6)):
        furniture.append([round(x, 3), round(z, 3)])
  # Exact retention identities are matched to the delivered source envelopes.
  legacy = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  suffixes = {p["id"][-8:] for p in parts} | {
    "18330093",
    "16870088",
    "16970136",
    "48376801",
  }
  legacy = [p for p in legacy if p["id"] in suffixes]
  return {
    "schemaVersion": 1,
    "groundY": GROUND,
    "mapSourceUrl": MAP_URL,
    "mapSourceSha256": hashlib.sha256((RAW / "osm-map.xml").read_bytes()).hexdigest(),
    "licenses": ["ODbL-1.0", "dl-de/zero-2-0"],
    "features": features,
    "parents": parents,
    "parts": parts,
    "surfaces": surfaces,
    "facadeBoxes": facades,
    "nativeRows": native_rows(cells),
    "nativeCellCount": len(cells),
    "legacyPrisms": legacy,
    "zooRing": by_id["9393789"]["coordinates"][:-1],
    "habitats": habitats,
    "paths": paths,
    "waters": waters,
    "barriers": barriers,
    "groundSurfaces": ground_surfaces,
    "groundRuns": ground_runs,
    "groundPolygons": ground_polygons,
    "schleusenkrugTables": furniture,
    "polarFoxStatus": "The Zoo's official 2016 annual report says its last arctic fox moved to Neumuenster and no enclosure remained planned at the predator house. Current OSM and the official species list provide no current polar-fox location. Current mapped predator habitats are retained; no invented fox enclosure or false current animals.",
    "detailStatus": "All selected LoD2 boundary surfaces retained; rigid translation to scene ground only. Mapped paths, water, enclosures and barriers retain source courses. Facade rhythm, aviary height/net spacing, animal poses and climbing-rock relief are documented display estimates, never proprietary plan traces. All original other zoo buildings and trees remain eligible in existing source layers.",
  }


def main() -> None:
  source = build()
  evidence = {
    "parents": source["parents"],
    "displayParts": source["parts"],
    "features": source.pop("features"),
    "paths": source["paths"],
    "waters": source["waters"],
    "groundPolygons": source.pop("groundPolygons"),
  }
  source["paths"] = [
    {k: v for k, v in p.items() if k != "line"} for p in source["paths"]
  ]
  source["waters"] = [
    {k: v for k, v in p.items() if k != "ring"} for p in source["waters"]
  ]
  DEST.with_name("zooGroundsV165Evidence.json").write_text(
    json.dumps(evidence, separators=(",", ":")) + "\n"
  )
  source["parents"] = [
    {k: v for k, v in p.items() if k != "sourceParts"} for p in source["parents"]
  ]
  source["parts"] = [
    {k: v for k, v in p.items() if k != "surfaces"} for p in source["parts"]
  ]
  DEST.write_text(json.dumps(source, separators=(",", ":")) + "\n")
  roofs = {}
  for x, y, z, w, h, _d, _c in source["nativeRows"]:
    for ix in range(round(x - w / 2), round(x + w / 2)):
      key = (ix, int(z))
      roofs[key] = max(roofs.get(key, -999), y + h / 2)
  grouped = defaultdict(list)
  for (x, z), y in roofs.items():
    grouped[(z, y)].append(x)
  roof_runs = []
  for (z, y), xs in sorted(grouped.items()):
    xs.sort()
    start = previous = xs[0]
    for x in xs[1:] + [xs[-1] + 2]:
      if x != previous + 1:
        roof_runs.append([start, previous + 1, z, y])
        start = x
      previous = x
  nav = {
    "parts": [{k: v for k, v in p.items() if k != "surfaces"} for p in source["parts"]],
    "legacyPrisms": source["legacyPrisms"],
    "roofTriangles": [
      t
      for s in source["surfaces"]
      if s["kind"] == "RoofSurface"
      for t in s["triangles"]
    ],
    "nativeRoofRuns": roof_runs,
  }
  DEST.with_name("zooGroundsV165Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(
    {
      k: len(source[k])
      for k in [
        "parts",
        "surfaces",
        "nativeRows",
        "legacyPrisms",
        "paths",
        "habitats",
        "waters",
        "barriers",
        "groundRuns",
        "schleusenkrugTables",
      ]
    }
  )
  print("source bytes", DEST.stat().st_size)


if __name__ == "__main__":
  main()
