"""Step 10: complete surveyed City West cinemas and Savignyplatz frontages.

The source survey and current place identities remain distinct from estimated
facade details. No shared packet or shared application file is overwritten.
"""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
from build_breitscheid_towers_v161 import normal_of, triangles_for
from build_surrounding_outlines import tags_for, world
from shapely.geometry import LineString, Point, Polygon, box, mapping
from shapely.ops import nearest_points, unary_union

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "src/app/src/data/cityWestCinemasV166Source.json"
RAW = ROOT / "geo_data/regierungsviertel/raw/outer-v159"
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
SAVIGNY = [
  "DEBE04YY500002gm",
  "DEBE04YY50000C4o",
  "DEBE04YY50000EDX",
  "DEBE04YY50000BfB",
  "DEBE04YY50000JhD",
  "DEBE04YY50000J26",
  "DEBE04YY500002YP",
  "DEBE04YY50000KcL",
  "DEBE04YY50000P2l",
  "DEBE04AL36G00019",
  "DEBE04YY50000Hwo",
  "DEBE04YY500009Vw",
  "DEBE04YY500000z7",
  "DEBE04YY500002QM",
  "DEBE04YY500009ke",
  "DEBE04YY50000KJu",
  "DEBE04YY500001BS",
  "DEBE04YY50000Hec",
]
PARENTS = {p: "Savignyplatz frontage" for p in SAVIGNY}
PARENTS.update(
  {
    "DEBE04YY50002Xuw": "Kant Kino / Kantstraße 54",
    "DEBE00YY1EZ0000h": "Zoo Palast",
    "DEBE04YY500004MZ": "FÜRST / former Kudamm-Karree surveyed ensemble",
  }
)
OUTER = {"DEBE04YY50002Xuw"}
COLORS = [0xD8D2BE, 0xD6C9B3, 0xDFD9C8, 0xC5B49B, 0xE0D5BA]


def polygons_of(g: Any) -> list[Any]:
  return [
    p
    for p in (list(g.geoms) if hasattr(g, "geoms") else [g])
    if p.geom_type == "Polygon"
  ]


def footprints(surfaces: list[dict]) -> Any:
  return unary_union(
    [
      Polygon(
        [(p[0], p[2]) for p in s["rings"][0]],
        [[(p[0], p[2]) for p in r] for r in s["rings"][1:]],
      )
      for s in surfaces
      if s["kind"] == "GroundSurface"
    ]
  )


def facade(
  rings: list[list[list[float]]], ground: float, kind: str, roads: Any
) -> list[list[float]]:
  """Procedural cues entirely clipped to their authoritative source plane."""
  normal = normal_of(rings[0])
  if abs(normal[1]) > 0.02:
    return []
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
  )
  base = np.array(a)
  d = np.array([b[0] - a[0], 0, b[2] - a[2]], dtype=float)
  length = float(np.linalg.norm(d))
  if length < (1.0 if kind == "zoo" else 2):
    return []
  d /= length
  poly = Polygon(
    [[(float(np.dot(np.subtract(p, base), d)), p[1]) for p in r] for r in rings][0],
    [[(float(np.dot(np.subtract(p, base), d)), p[1]) for p in r] for r in rings[1:]],
  )
  if not poly.is_valid:
    poly = poly.buffer(0)
  center = np.mean(np.array(rings[0]), axis=0)
  closest = nearest_points(Point(center[0], center[2]), roads)[1]
  front = (closest.x - center[0]) * normal[0] + (closest.y - center[2]) * normal[
    2
  ] > 0.1 and closest.distance(Point(center[0], center[2])) < 40
  if kind == "savigny" and not front:
    return []
  yaw = math.atan2(-d[2], d[0])
  rows = []

  def emit(
    u: float,
    y: float,
    w: float,
    h: float,
    color: int,
    role: int = 1,
    depth: float = 0.14,
    out: float = 0.1,
    clip: bool = True,
  ) -> None:
    if clip and not poly.buffer(-0.025).covers(
      box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
    ):
      return
    p = base + d * u + normal * out
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

  if kind == "zoo":
    # The main auditorium is predominantly blank light-yellow ceramic, with
    # small repeated relief studs. Glazing belongs to the low street foyer.
    if normal[0] < -0.3 and normal[2] > 0.3 and poly.bounds[3] > ground + 20:
      for u in [length / 2]:
        for y in np.arange(ground + 12, poly.bounds[3] - 2.4, 2.4):
          emit(float(u), float(y), 0.15, 0.15, 0x9B7D44, 4, 0.18, 0.16)
    if front and poly.bounds[1] < ground + 2:
      for u in np.arange(0.9, length, 0.95):
        emit(float(u), ground + 2.1, 0.84, 3.6, 0x526360)
        emit(float(u) - 0.45, ground + 2.1, 0.065, 3.8, 0xBFA567, 2, 0.18, 0.18)
      emit(length / 2, ground + 4.6, length - 0.3, 0.23, 0xCEC5A7, 2, 0.4, 0.2)
    return rows
  pitch = 3.5 if kind == "tower" else 3.4
  bays = max(1, round(length / (2.05 if kind == "tower" else 3.1)))
  step = length / bays
  for floor in range(34 if kind == "tower" else 9):
    y = ground + 2.2 + floor * pitch
    for i in range(bays):
      u = (i + 0.5) * step
      w = step * (0.71 if kind == "tower" else 0.54)
      h = 2.5 if kind == "tower" else 1.9
      if not poly.buffer(-0.06).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
        continue
      emit(u, y, w, h, [0x63726E, 0x526764, 0x798581][(floor + i) % 3])
      emit(u, y - h / 2 - 0.10, w + 0.26, 0.15, 0xE3DDCB, 2, 0.25, 0.17)
      emit(u, y, 0.07, h, 0xE6E3D7, 2, 0.18, 0.20)
      if kind == "savigny" and floor > 0:
        emit(u, y + h / 2 + 0.12, w + 0.35, 0.18, 0xD6C9AE, 2, 0.3, 0.19)
    if kind == "tower":
      line = poly.intersection(
        LineString(
          [
            (-1, ground + (floor + 1) * pitch),
            (length + 1, ground + (floor + 1) * pitch),
          ]
        )
      )
      for seg in (
        [line] if line.geom_type == "LineString" else getattr(line, "geoms", [])
      ):
        if seg.length > 1:
          lo, _, hi, _ = seg.bounds
          emit(
            (lo + hi) / 2,
            ground + (floor + 1) * pitch,
            hi - lo,
            0.18,
            0xD7D5C9,
            2,
            0.18,
            0.15,
            False,
          )
  return rows


def make_payload() -> dict:
  # Source courses, not protected landscape or architecture plans.
  lines = gpd.read_file(
    RAW / "candidate.gpkg", layer="lines", bbox=(13.306, 52.4995, 13.337, 52.5078)
  ).to_crs(25833)
  roads = []
  for _, r in lines.iterrows():
    t = tags_for(r)
    if t.get("highway") and t.get("tunnel", "no") == "no":
      roads.append(
        {
          "id": f"OSM-way-{r.osm_id}",
          "name": t.get("name", ""),
          "tags": t,
          "geometry": mapping(world(r.geometry)),
        }
      )
  road_geometry = unary_union(
    [
      __import__("shapely").geometry.shape(r["geometry"])
      for r in roads
      if r["tags"]["highway"] not in ["footway", "path", "cycleway", "steps"]
    ]
  )
  parts = []
  parents = []
  all_surfaces = []
  details = []
  archives = []
  for tile in ["385_5818", "386_5818"]:
    path = ROOT / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip"
    with zipfile.ZipFile(path) as z:
      tree = ET.fromstring(z.read(z.namelist()[0]))
    archives.append(
      {
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/{path.name}",
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      }
    )
    for parent in tree.findall(".//b:Building", NS):
      pid = parent.get("{" + NS["g"] + "}id")
      if pid not in PARENTS:
        continue
      datum = min(
        float(v)
        for e in parent.findall(".//b:GroundSurface//g:posList", NS)
        for v in e.text.split()[2::3]
      )
      ground = 3 if pid in OUTER else 5.2
      kind = (
        "kant"
        if pid == "DEBE04YY50002Xuw"
        else "zoo"
        if pid == "DEBE00YY1EZ0000h"
        else "tower"
        if pid == "DEBE04YY500004MZ"
        else "savigny"
      )
      parent_surfaces = []
      for part in parent.findall(".//b:BuildingPart", NS) or [parent]:
        sid = part.get("{" + NS["g"] + "}id")
        ss = []
        for boundary in part.findall("b:boundedBy", NS):
          for surface in boundary:
            for polygon in surface.findall(".//g:Polygon", NS):
              rings = []
              for e in polygon.findall(".//g:posList", NS):
                a = list(map(float, e.text.split()))
                ring = [
                  [
                    round(a[i] - 389500, 3),
                    round(a[i + 2] - datum + ground, 3),
                    round(5820000 - a[i + 1], 3),
                  ]
                  for i in range(0, len(a), 3)
                ]
                if ring[0] == ring[-1]:
                  ring.pop()
                rings.append(ring)
              ss.append(
                {
                  "partId": sid,
                  "kind": surface.tag.split("}")[-1],
                  "rings": rings,
                  "sourcePolygonId": polygon.get("{" + NS["g"] + "}id"),
                }
              )
        parent_surfaces.extend(ss)
        foot = footprints(ss)
        points = [p for s in ss for r in s["rings"] for p in r]
        parts.append(
          {
            "id": sid,
            "parentId": pid,
            "building": PARENTS[pid],
            "groundY": min(p[1] for p in points),
            "topY": max(p[1] for p in points),
            "heightM": float(
              part.findtext("b:measuredHeight", default="0", namespaces=NS)
            ),
            "polygons": [
              {
                "ring": [[round(x, 3), round(z, 3)] for x, z in p.exterior.coords[:-1]],
                "holes": [
                  [[round(x, 3), round(z, 3)] for x, z in r.coords[:-1]]
                  for r in p.interiors
                ],
              }
              for p in polygons_of(foot)
            ],
            "footprintAreaM2": round(foot.area, 6),
          }
        )
        for s in ss:
          roof = s["kind"] == "RoofSurface"
          s["color"] = (
            0x98958A
            if roof
            else 0xCDB77E
            if kind == "zoo"
            else 0xD6D0BB
            if kind == "kant"
            else 0xD0CFC4
            if kind == "tower"
            else COLORS[SAVIGNY.index(pid) % len(COLORS)]
          )
          s["triangles"] = (
            triangles_for(s["rings"])
            if s["kind"] in ["WallSurface", "RoofSurface"]
            else []
          )
          all_surfaces.append(s)
          if s["kind"] == "WallSurface":
            details.extend(facade(s["rings"], ground, kind, road_geometry))
      parents.append(
        {
          "id": pid,
          "name": PARENTS[pid],
          "tile": tile,
          "groundNHN": datum,
          "groundY": ground,
          "kind": kind,
          "outer": pid in OUTER,
        }
      )
  assert {p["id"] for p in parents} == set(PARENTS)
  parent_feet = {
    p["id"]: footprints(
      [
        s
        for s in all_surfaces
        if any(q["id"] == s["partId"] and q["parentId"] == p["id"] for q in parts)
      ]
    )
    for p in parents
  }
  current = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  legacy = []
  conflict = []
  for p in parents:
    foot = parent_feet[p["id"]]
    owned = []
    for r in current["buildings"]:
      poly = Polygon(
        [(x / 10, z / 10) for x, z in r["ring"]],
        [[(x / 10, z / 10) for x, z in h] for h in r["holes"]],
      )
      if poly.area and foot.intersection(poly).area / poly.area > 0.70:
        owned.append({**r, "replacementParentId": p["id"]})
    legacy.extend(owned)
    old = unary_union(
      [
        Polygon(
          [(x / 10, z / 10) for x, z in r["ring"]],
          [[(x / 10, z / 10) for x, z in h] for h in r["holes"]],
        )
        for r in owned
      ]
    )
    conflict.append(
      {
        "parentId": p["id"],
        "legacyPrismIds": [r["id"] for r in owned],
        "officialFootprintAreaM2": round(foot.area, 6),
        "legacyFootprintAreaM2": round(old.area, 6),
        "legacyOnlyAreaM2": round(old.difference(foot).area, 6),
        "officialOnlyAreaM2": round(foot.difference(old).area, 6),
      }
    )
  assert len({r["id"] for r in legacy}) == len(legacy)
  context = unary_union(list(parent_feet.values())).buffer(50)
  from shapely.geometry import shape

  roads = [
    {**r, "geometry": mapping(shape(r["geometry"]).intersection(context))}
    for r in roads
    if shape(r["geometry"]).intersects(context)
  ]
  # Keep the precise OSM park/path/grass polygons and each exact mapped course.
  park_rows = gpd.read_file(
    RAW / "candidate.gpkg",
    layer="multipolygons",
    bbox=(13.321, 52.5048, 13.3237, 52.5069),
  ).to_crs(25833)
  park = []
  zone = box(-3440, 1280, -3270, 1480)
  for _, r in park_rows.iterrows():
    t = tags_for(r)
    geom = world(r.geometry)
    if not zone.covers(geom.representative_point()) or geom.area > 21000:
      continue
    if (
      t.get("landuse") == "grass"
      or t.get("leisure") == "park"
      or t.get("highway") == "footway"
      or t.get("name") == "Savignyplatz"
    ):
      sid = f"OSM-{'relation' if str(r.osm_id) not in ['nan', 'None'] else 'way'}-{r.osm_id if str(r.osm_id) not in ['nan', 'None'] else r.osm_way_id}"
      park.append({"id": sid, "tags": t, "geometry": mapping(geom)})
  surface_details = []
  for p in park:
    if p["tags"].get("highway") != "footway":
      continue
    for poly in polygons_of(__import__("shapely").geometry.shape(p["geometry"])):
      ring = [[[x, 5.32, z] for x, z in poly.exterior.coords[:-1]]] + [
        [[x, 5.32, z] for x, z in r.coords[:-1]] for r in poly.interiors
      ]
      surface_details.append(
        {
          "color": 0xB8AD96,
          "triangles": triangles_for(ring),
          "role": "mapped Savignyplatz sett paths",
        }
      )
  # Thin exact lawn-edge masonry avoids blanketing or moving the existing roads.
  for p in park:
    if p["tags"].get("landuse") != "grass":
      continue
    for poly in polygons_of(__import__("shapely").geometry.shape(p["geometry"])):
      for a, b in zip(poly.exterior.coords, list(poly.exterior.coords)[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dz)
        if length > 0.1:
          details.append(
            [
              round((a[0] + b[0]) / 2, 3),
              5.34,
              round((a[1] + b[1]) / 2, 3),
              round(length, 3),
              0.22,
              0.14,
              round(math.atan2(-dz, dx), 6),
              0xC5BBA5,
              5,
            ]
          )
  # Kant's five documented colossal pilasters, side balconies and cinema panel.
  a = np.array([-4329.524, 1250.986])
  b = np.array([-4302.227, 1254.112])
  d = (b - a) / np.linalg.norm(b - a)
  n = np.array([-d[1], d[0]])
  yaw = math.atan2(-d[1], d[0])

  def kant_box(
    u: float,
    y: float,
    w: float,
    h: float,
    depth: float,
    out: float,
    color: int,
    role: int,
  ) -> None:
    c = a + d * u + n * out
    details.append(
      [round(c[0], 3), y, round(c[1], 3), w, h, depth, round(yaw, 6), color, role]
    )

  for u in [3.1, 5.75, 8.4, 11.05, 13.7]:
    kant_box(u, 14.7, 0.46, 15.0, 0.24, 0.18, 0xDDD6C1, 6)
    kant_box(u, 22.4, 0.8, 0.38, 0.38, 0.23, 0xC5BBA3, 6)
    for shift in [-0.13, 0, 0.13]:
      kant_box(u + shift, 14.7, 0.035, 14.4, 0.08, 0.34, 0xA9A38F, 6)
  for u in [1.1, 19.5]:
    for y in [13.5, 17.7]:
      kant_box(u, y, 5.0, 0.20, 1.05, 0.62, 0xCBC5B2, 7)
      kant_box(u, y + 0.48, 5.0, 0.8, 0.14, 1.08, 0xD8D2BE, 7)
  kant_box(8.1, 23.9, 15.2, 0.85, 0.18, 1.1, 0xD8D2BE, 7)
  kant_box(21.2, 7.8, 10.6, 2.7, 0.3, 0.35, 0xDBD8C3, 8)
  kant_box(21.2, 8.96, 10.2, 0.50, 0.16, 0.56, 0x222824, 8)
  for i, color in enumerate([0xC8C69C, 0xB2C6AD, 0xA6BBC2, 0xB9ADC1, 0xA7BFA7]):
    kant_box(21.2, 8.45 - i * 0.35, 9.9, 0.27, 0.10, 0.55, color, 8)
  blocks = {}
  for s in all_surfaces + surface_details:
    for tri in s["triangles"]:
      a, b, c = map(np.array, tri)
      steps = max(
        1,
        math.ceil(
          max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
          / 1.15
        ),
      )
      for i in range(steps + 1):
        for j in range(steps + 1 - i):
          p = a + (b - a) * i / steps + (c - a) * j / steps
          cell = tuple(math.floor(float(v) / 2) for v in p)
          blocks[cell] = [cell[0] * 2 + 1, cell[1] * 2 + 1, cell[2] * 2 + 1, s["color"]]
  for x, y, z, w, h, depth, yaw, color, role in details:
    if role not in [1, 5]:
      continue
    for u in np.arange(-w / 2 + 0.1, w / 2, 0.7):
      for v in np.arange(-h / 2 + 0.1, h / 2, 0.7):
        cell = (
          math.floor((x + math.cos(yaw) * u) / 2),
          math.floor((y + v) / 2),
          math.floor((z - math.sin(yaw) * u) / 2),
        )
        if cell in blocks:
          cx, cy, cz, _ = blocks[cell]
          along = (cx - x) * math.cos(yaw) - (cz - z) * math.sin(yaw)
          if abs(along) < w / 2 and abs(cy - y) < h / 2:
            blocks[cell][3] = color
  evidence = gpd.read_file(
    RAW / "candidate.gpkg",
    layer="multipolygons",
    where="osm_id = '104701' OR osm_way_id IN ('23010077','623444790','492760729')",
  ).to_crs(25833)
  osm_evidence = [
    {
      "id": f"OSM-{'relation' if str(r.osm_id) not in ['nan', 'None'] else 'way'}-{r.osm_id if str(r.osm_id) not in ['nan', 'None'] else r.osm_way_id}",
      "tags": tags_for(r),
      "geometry": mapping(world(r.geometry)),
    }
    for _, r in evidence.iterrows()
  ]
  point = gpd.read_file(
    RAW / "berlin-260929.osm.pbf", layer="points", where="osm_id = '312618622'"
  ).to_crs(25833)
  osm_evidence.extend(
    {
      "id": f"OSM-node-{r.osm_id}",
      "tags": tags_for(r),
      "geometry": mapping(world(r.geometry)),
    }
    for _, r in point.iterrows()
  )
  with (RAW / "berlin-260929.osm.pbf").open("rb") as archive:
    osm_sha256 = hashlib.file_digest(archive, "sha256").hexdigest()
  return {
    "schemaVersion": 1,
    "osmEvidence": osm_evidence,
    "osmSourceUrl": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    "osmSourceSha256": osm_sha256,
    "licences": {"buildings": "dl-de/zero-2-0", "map": "ODbL-1.0"},
    "sourceArchives": archives,
    "parents": parents,
    "parts": parts,
    "surfaces": all_surfaces,
    "facadeBoxes": details,
    "nativeBlocks": list(blocks.values()),
    "legacyPrisms": legacy,
    "sourceConflicts": conflict,
    "publicRealm": park,
    "roads": roads,
    "pavingSurfaces": surface_details,
    "sourcePolicy": "Complete official survey walls, roofs, parts and holes retained. Legacy OSM rings and estimates stay as provenance; exact-ID owners replace their coarse presentation. Facade rhythms, relief, glazing, signs and curbs are procedural display estimates. FÜRST is the existing mapped Kudamm-Karree ensemble, not a proposed Karstadt tower. Current 2026 construction differs from this survey; no planned extra floors or unverified finished state are asserted.",
  }


def main() -> None:
  p = make_payload()
  DEST.write_text(json.dumps(p, separators=(",", ":")) + "\n")
  roofs = {}
  for x, y, z, _ in p["nativeBlocks"]:
    roofs[(x, z)] = max(roofs.get((x, z), -100), y + 1)
  nav = {k: p[k] for k in ["parents", "parts", "legacyPrisms"]}
  nav.update(
    {
      "roofTriangles": [
        t for s in p["surfaces"] if s["kind"] == "RoofSurface" for t in s["triangles"]
      ],
      "nativeRoofCells": [[x, z, y] for (x, z), y in roofs.items()],
    }
  )
  DEST.with_name("cityWestCinemasV166Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(
    json.dumps(
      {
        k: len(p[k])
        for k in [
          "parents",
          "parts",
          "surfaces",
          "facadeBoxes",
          "nativeBlocks",
          "legacyPrisms",
          "publicRealm",
          "roads",
        ]
      }
    )
  )


def candidate_packets(output: Path) -> dict:
  """Remove only Kant's coarse outer owner in isolated reviewable candidates."""
  import gzip

  import shapely
  from build_karl_marx_allee_v161 import mesh_signature
  from build_surrounding_outlines import (
    DEFAULT_OUTPUT,
    chunk_payload,
    load_projected_polygon,
    polygonal,
  )

  output.mkdir(parents=True, exist_ok=True)
  manifest = json.loads((DEFAULT_OUTPUT / "manifest.json").read_text())
  bounds = world(
    load_projected_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  core = world(
    load_projected_polygon(ROOT / "geo_data/regierungsviertel/bounds-v158.geojson")
  )
  buildings = gpd.read_file(RAW / "resolved-outlines.gpkg", layer="buildings").to_dict(
    "records"
  )
  surfaces = {
    r["kind"]: r.geometry
    for _, r in gpd.read_file(
      RAW / "resolved-outlines.gpkg", layer="surfaces"
    ).iterrows()
  }
  own = unary_union([b["geometry"] for b in buildings if b["sourceId"] in OUTER])
  patches = []
  audit = []
  for d in manifest["chunks"]:
    tile = box(*d["bounds"])
    if not tile.intersects(own):
      continue
    selected = [b for b in buildings if b["geometry"].intersects(tile)]
    local = {
      k: polygonal(shapely.make_valid(shapely.clip_by_rect(g, *tile.bounds)))
      for k, g in surfaces.items()
    }
    result = {"id": d["id"], "bounds": d["bounds"]}
    entry = {"id": d["id"], "ownedSourceIds": sorted(OUTER), "modes": {}}
    for mode in ["drawn", "minecraft"]:
      original = json.loads(
        gzip.decompress((DEFAULT_OUTPUT / d[mode]["url"]).read_bytes())
      )
      baseline = chunk_payload(
        d["id"],
        tile,
        bounds.difference(core).intersection(tile),
        selected,
        local,
        minecraft=mode == "minecraft",
      )
      assert not mesh_signature(baseline) - mesh_signature(original), (
        f"Missing baseline source in {d['id']} {mode}"
      )
      replacement = chunk_payload(
        d["id"],
        tile,
        bounds.difference(core).intersection(tile),
        selected,
        local,
        minecraft=mode == "minecraft",
        replaced_source_ids=frozenset(OUTER),
      )
      # Existing later street meshes remain byte-identical. Baseline mesh kinds
      # are replaced only after the exact source-triangle subset assertion.
      kinds = {m["kind"] for m in baseline["meshes"]}
      replacement["meshes"].extend(
        m for m in original["meshes"] if m["kind"] not in kinds
      )
      for key in ["ground", "water", "roads", "bridges"]:
        replacement["nav"][key] = original["nav"][key]
      removed = mesh_signature(baseline) - mesh_signature(replacement)
      assert not (mesh_signature(original) - removed) - mesh_signature(replacement)
      replacement["nav"]["buildings"] = [
        b for b in original["nav"]["buildings"] if b["sourceId"] not in OUTER
      ]
      raw = (
        json.dumps(replacement, separators=(",", ":"), ensure_ascii=False) + "\n"
      ).encode()
      packed = gzip.compress(raw, mtime=0)
      (output / d[mode]["url"]).write_bytes(packed)
      result[mode] = {
        "url": d[mode]["url"],
        "encoding": "gzip",
        "bytes": len(packed),
        "decodedBytes": len(raw),
        "sha256": hashlib.sha256(packed).hexdigest(),
      }
      entry["modes"][mode] = {
        "oldSha256": d[mode]["sha256"],
        "newSha256": result[mode]["sha256"],
        "retainedUnownedNavigation": len(replacement["nav"]["buildings"]),
      }
    patches.append(result)
    audit.append(entry)
  patch = {
    "chunks": patches,
    "source": {
      "cityWestCinemasV166": {
        "sourceIds": sorted(OUTER),
        "policy": "Complete surveyed source moved to lazy CityWestCinemasV166 owner; all unowned packet geometry, surfaces and navigation retained.",
      }
    },
    "audit": audit,
  }
  (output / "citywest-cinemas-manifest-patch.json").write_text(
    json.dumps(patch, indent=2) + "\n"
  )
  return patch


if __name__ == "__main__":
  main()
