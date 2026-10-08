"""Step 10: exact northern sites with bounded, explicitly schematic accents."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from collections import defaultdict
from pathlib import Path
from typing import Any

import geopandas as gpd
from build_bebelplatz_building_source import part_profile, world_ring
from build_breitscheid_towers_v161 import triangles_for
from build_steglitz_v182 import native_blocks
from build_suhrkamp_pfefferberg_v189 import facade_faces
from build_surrounding_outlines import line_parts, road_width_m, tags_for, world
from pyproj import Transformer
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import transform, unary_union

from isometric_berlin.data.fetch_lod2 import (
  GML_ID,
  NS,
  building_footprint,
  leaf_building_parts,
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
RAW = DATA / "raw"
SOURCE = DATA / "north-sites-v190-source.json"
WGS = Transformer.from_crs(25833, 4326, always_xy=True).transform
SITES = {"weissensee": "6197783", "schoenhauser": "20461299", "teutoburger": "23710933"}
SPECIAL = {
  "156581840": "weissensee-hall",
  "121840587": "platzhaus",
  "185763575": "lapidarium",
}


def digest(path: Path) -> str:
  """Fingerprint retained permitted sources."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def identity(row: Any) -> str:
  """Retain the OSM element kind."""
  way = row.get("osm_way_id")
  return "way/" + str(way) if isinstance(way, str) else "way/" + str(row.osm_id)


def extract() -> dict:
  """Extract finite source evidence; source wall/roof geometry is never simplified."""
  gpkg = RAW / "north-city-v190/candidate.gpkg"
  if not gpkg.exists():
    gpkg = RAW / "outskirts-v187/candidate.gpkg"
  areas = gpd.read_file(
    gpkg, layer="multipolygons", bbox=(13.4, 52.528, 13.48, 52.55)
  ).to_crs(25833)
  areas.geometry = areas.geometry.map(world)
  lines = gpd.read_file(gpkg, layer="lines", bbox=(13.4, 52.528, 13.48, 52.55)).to_crs(
    25833
  )
  lines.geometry = lines.geometry.map(world)
  point_path = RAW / "north-city-v190/candidate.gpkg"
  points = gpd.read_file(
    point_path, layer="points", bbox=(13.4, 52.528, 13.48, 52.55)
  ).to_crs(25833)
  points.geometry = points.geometry.map(world)
  sites = []
  for key, osm in SITES.items():
    row = areas[areas.osm_way_id == osm].iloc[0]
    polygon = row.geometry
    records = []
    for _, r in lines[lines.intersects(polygon)].iterrows():
      tags = tags_for(r)
      if tags.get("highway") not in {
        "footway",
        "path",
        "steps",
        "service",
        "pedestrian",
      } and tags.get("barrier") not in {"wall", "fence"}:
        continue
      records.append(
        {
          "id": identity(r),
          "geometry": mapping(r.geometry.intersection(polygon)),
          "tags": tags,
          "width": float(
            road_width_m(tags)
            or (3 if tags.get("highway") in {"footway", "path", "steps"} else 7)
          ),
          "widthStatus": "OSM tag or existing road-class estimate",
        }
      )
    markers = []
    for _, r in points[points.intersects(polygon)].iterrows():
      tags = tags_for(r)
      if (
        tags.get("historic") in {"tomb", "memorial"}
        or tags.get("cemetery") == "grave"
        or tags.get("amenity") in {"bench", "fountain"}
        or tags.get("barrier") in {"gate", "entrance"}
      ):
        markers.append(
          {
            "id": "node/" + str(r.osm_id),
            "name": tags.get("name", ""),
            "point": [r.geometry.x, r.geometry.y],
            "tags": tags,
          }
        )
    buildings = [
      mapping(r.geometry)
      for _, r in areas[areas.intersects(polygon)].iterrows()
      if tags_for(r).get("building")
    ]
    sites.append(
      {
        "key": key,
        "id": "way/" + osm,
        "geometry": mapping(polygon),
        "lines": records,
        "markers": markers,
        "buildingMasks": buildings,
      }
    )
  prior = json.loads((ROOT / "src/app/src/data/northV185.json").read_text())
  brewery = {b["id"]: b for b in prior["owners"] if b["kind"] == "kulturbrauerei"}
  specials = {osm: areas[areas.osm_way_id == osm].iloc[0].geometry for osm in SPECIAL}
  roads = []
  for _, r in lines[lines.name == "Kastanienallee"].iterrows():
    tags = tags_for(r)
    if tags.get("highway") not in {"tertiary", "residential"}:
      continue
    roads.append(
      {
        "id": identity(r),
        "geometry": mapping(r.geometry),
        "width": float(
          road_width_m(tags)
          or (3 if tags.get("highway") in {"footway", "path", "steps"} else 7)
        ),
        "tags": tags,
      }
    )
  road_union = unary_union([shape(r["geometry"]) for r in roads])
  old = gpd.read_file(
    RAW / "outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    bbox=(2000, -2800, 3200, -1100),
  )
  kast = old[(old.geometry.distance(road_union) < 18) & (old.height > 12)]
  kast = kast.sort_values("sourceId")
  kast_ids = set(kast.iloc[:: max(1, len(kast) // 22)].head(24).sourceId) - set(brewery)
  buildings, archives = [], {}
  for tile in ["392_5821", "392_5822", "395_5822"]:
    path = RAW / "lod2" / f"LoD2_{tile}.zip"
    archives[tile] = {
      "sha256": digest(path),
      "url": f"https://gdi.berlin.de/data/a_lod2/atom/{path.name}",
      "license": "dl-de/zero-2-0",
    }
    with zipfile.ZipFile(path) as archive:
      for name in archive.namelist():
        if not name.endswith((".gml", ".xml")):
          continue
        with archive.open(name) as stream:
          for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            pid = element.get(GML_ID)
            footprint = building_footprint(element)
            footprint = world(footprint) if footprint is not None else None
            kind, osm = (
              ("kulturbrauerei", "32294784")
              if pid in brewery
              else ("kastanienallee", "")
              if pid in kast_ids
              else (None, None)
            )
            if footprint is not None:
              for sid, poly in specials.items():
                if footprint.intersection(poly).area / max(0.01, footprint.area) > 0.60:
                  kind, osm = SPECIAL[sid], sid
            if kind and footprint is not None:
              parts = []
              for p in leaf_building_parts(element) or [element]:
                profile = part_profile(p)
                for sk in ["GroundSurface", "ClosureSurface"]:
                  for poly in p.findall(f".//bldg:{sk}//gml:Polygon", NS):
                    profile["surfaces"].append(
                      {
                        "kind": sk,
                        "rings": [
                          world_ring(pos) for pos in poly.findall(".//gml:posList", NS)
                        ],
                      }
                    )
                parts.append(profile)
              low = min(p["ground_y_m"] for p in parts)
              if pid in brewery:
                low = brewery[pid]["sourceGroundY"]
              buildings.append(
                {
                  "id": pid,
                  "kind": kind,
                  "osmId": "way/" + osm if osm else None,
                  "tile": tile,
                  "sourceGroundY": low,
                  "translationY": 3 - low,
                  "parts": parts,
                  "footprint": mapping(footprint),
                  "replaceOwner": kind != "kastanienallee",
                }
              )
            element.clear()
  # The Lapidarium's six distinct parents retain a single relative datum.
  for kind in ["lapidarium", "weissensee-hall"]:
    group = [b for b in buildings if b["kind"] == kind]
    low = min((b["sourceGroundY"] for b in group), default=0)
    for b in group:
      b["translationY"] = 3 - low
  return {
    "schemaVersion": 1,
    "sites": sites,
    "buildings": buildings,
    "kastanienallee": roads,
    "archives": archives,
    "source": "Geofabrik Berlin 2026-09-29 ODbL-1.0; Berlin LoD2 dl-de/zero-2-0",
    "inputSha256": {str(gpkg.relative_to(ROOT)): digest(gpkg)},
    "neighbours": [mapping(p) for p in old.geometry],
    "policy": "Complete walls/roofs replace exact coarse owners only. Existing v185 details/terrain remain. Additional unnamed grave-field markers are schematic, not individual grave surveys; exact mapped graves retain OSM identity without invented inscriptions. Display grounds retain established y=3 datum.",
  }


def put(
  cell: dict,
  x: float,
  y: float,
  z: float,
  w: float,
  h: float,
  d: float,
  yaw: float,
  color: int,
) -> None:
  """Independent orthogonal native members with projected bounds, not rotated cubes."""
  cell["boxes"].append([round(v, 4) for v in [x, y, z, w, h, d, yaw]] + [color])
  count = max(1, math.ceil(w / 2))
  c, s = abs(math.cos(yaw)), abs(math.sin(yaw))
  for i in range(count):
    u = (i + 0.5) * w / count - w / 2
    cell["native"].append(
      [
        round(x + math.cos(yaw) * u, 3),
        round(y, 3),
        round(z - math.sin(yaw) * u, 3),
        round(c * w / count + s * d, 3),
        round(h, 3),
        round(s * w / count + c * d, 3),
        color,
      ]
    )


def build(source: dict) -> tuple[dict, dict, dict]:
  """Create complete measured owners and bounded path/stone/entry accents."""
  cells: dict[str, dict] = defaultdict(
    lambda: {"boxes": [], "native": [], "surfaces": []}
  )
  evidence = {"graveFields": [], "mappedGraves": [], "faces": [], "sourceSheetCount": 0}

  def cell(x: float, z: float) -> dict:
    return cells[f"{math.floor(x / 256)}_{math.floor(z / 256)}"]

  occupied = unary_union([shape(p) for p in source["neighbours"]])
  exclusions = []
  for b in source["buildings"]:
    fp = shape(b["footprint"])
    c = cell(fp.centroid.x, fp.centroid.y)
    if b["replaceOwner"]:
      wall = (
        0xAE795B
        if b["kind"] == "kulturbrauerei"
        else 0xCEB881
        if b["kind"] == "weissensee-hall"
        else 0xA0785C
        if b["kind"] == "platzhaus"
        else 0xAFB0A4
      )
      shell = {"boxes": [], "rods": [], "surfaces": []}
      for p in b["parts"]:
        for s in p["surfaces"]:
          rings = [
            [[v[0], round(v[1] + b["translationY"], 3), v[2]] for v in r]
            for r in s["rings"]
          ]
          shell["surfaces"].append(
            {
              "owner": b["id"],
              "triangles": triangles_for(rings),
              "color": 0x676C66 if s["kind"] == "RoofSurface" else wall,
            }
          )
          evidence["sourceSheetCount"] += 1
      c["surfaces"].extend(shell["surfaces"])
      c["native"].extend(native_blocks(shell))
      exclusions.append(
        {
          "type": "Feature",
          "properties": {
            "id": b["id"],
            "osmId": b["osmId"],
            "name": b["kind"],
            "completeSourceOwner": True,
          },
          "geometry": mapping(transform(lambda x, z: WGS(x + 389500, 5820000 - z), fp)),
        }
      )
    faces = facade_faces(b, occupied)
    if b["kind"] == "kulturbrauerei":
      # v185 already owns the arched windows/courses. Only source-roof eaves here.
      for p in b["parts"]:
        for s in p["surfaces"]:
          if s["kind"] != "RoofSurface":
            continue
          r = s["rings"][0]
          for a, d in zip(r, r[1:] + r[:1]):
            length = math.hypot(d[0] - a[0], d[2] - a[2])
            if length < 3 or abs(d[1] - a[1]) > 0.08:
              continue
            put(
              c,
              (a[0] + d[0]) / 2,
              a[1] + b["translationY"] + 0.035,
              (a[2] + d[2]) / 2,
              length,
              0.13,
              0.18,
              -math.atan2(d[2] - a[2], d[0] - a[0]),
              0x78634E,
            )
      continue
    if b["kind"] == "kastanienallee":
      road = unary_union([shape(r["geometry"]) for r in source["kastanienallee"]])
      faces = [
        f
        for f in faces
        if Point((f["a"][0] + f["b"][0]) / 2, (f["a"][1] + f["b"][1]) / 2).distance(
          road
        )
        < 22
      ]
      faces = sorted(faces, key=lambda f: f["length"], reverse=True)[:1]
    if b["kind"] == "platzhaus":
      faces = sorted(faces, key=lambda f: f["length"], reverse=True)[:2]
    for f in faces:
      evidence["faces"].append(f)
      ax, az = f["a"]
      bx, bz = f["b"]
      length = f["length"]
      tx, tz = (bx - ax) / length, (bz - az) / length
      nx, nz = f["normal"]
      yaw = -math.atan2(tz, tx)

      def face(
        u: float, y: float, w: float, h: float, d: float, color: int, out: float = 0.18
      ) -> None:
        scratch = {"boxes": [], "native": []}
        put(
          scratch,
          ax + tx * u + nx * out,
          y,
          az + tz * u + nz * out,
          w,
          h,
          d,
          yaw,
          color,
        )
        c["boxes"].extend(scratch["boxes"])
        # Match the independent native skin's exterior, including oblique
        # voxel bounds; otherwise its source blocks hide thin drawn reveals.
        for row in scratch["native"]:
          row[0] = round(row[0] + nx * 1.02, 3)
          row[2] = round(row[2] + nz * 1.02, 3)
        c["native"].extend(scratch["native"])

      height = f["top"] - f["bottom"]
      face(length / 2, f["top"] - 0.26, length - 0.2, 0.20, 0.28, 0xC8B597)
      face(length / 2, f["bottom"] + 0.4, length - 0.2, 0.48, 0.16, 0x8D8D7F)
      if b["kind"] == "lapidarium":
        continue
      floors = (
        1
        if b["kind"] in {"platzhaus", "weissensee-hall"}
        else min(6, max(1, int((height - 1) / 3.7)))
      )
      bays = max(1, int(length / (3.3 if b["kind"] == "platzhaus" else 3.8)))
      for j in range(floors):
        y = f["bottom"] + 1.8 + j * (height - 1.5) / floors
        h = min(2.2, (height - 1.8) / floors * 0.58)
        if y + h / 2 > f["top"] - 0.55:
          continue
        for i in range(bays):
          u = (i + 0.5) * length / bays
          w = min(1.75, length / bays * 0.56)
          if b["kind"] in {"platzhaus", "weissensee-hall"}:
            # Reference-only round-headed iron openings: polygon surfaces remain
            # within the source wall rectangle; these are not surveyed portals.
            w = min(w, h * 0.75)

            def arch(aw: float, ah: float, out: float, colour: int) -> None:
              radius = aw / 2
              spring = y + ah / 2 - radius
              local = [[u - aw / 2, y - ah / 2], [u + aw / 2, y - ah / 2]]
              local += [
                [
                  u + radius * math.cos(k * math.pi / 12),
                  spring + radius * math.sin(k * math.pi / 12),
                ]
                for k in range(13)
              ]
              ring = [
                [ax + tx * v + nx * out, yy, az + tz * v + nz * out] for v, yy in local
              ]
              c["surfaces"].append(
                {
                  "owner": "recognition-" + b["id"],
                  "triangles": triangles_for([ring]),
                  "color": colour,
                }
              )
              # Native openings keep separate stepped arches and vertical bars.
              for fraction, dy, hh in [
                (1, -radius / 2, ah - radius),
                (0.78, ah / 2 - radius * 0.65, radius * 0.6),
                (0.4, ah / 2 - radius * 0.18, radius * 0.36),
              ]:
                scratch = {"boxes": [], "native": []}
                put(
                  scratch,
                  ax + tx * u + nx * (out + 1.02),
                  y + dy,
                  az + tz * u + nz * (out + 1.02),
                  aw * fraction,
                  hh,
                  0.12,
                  yaw,
                  colour,
                )
                c["native"].extend(scratch["native"])

            arch(w + 0.24, h + 0.2, 0.23, 0xB8A57F)
            arch(w, h, 0.32, 0x435B59)
            for fraction in [-0.28, 0, 0.28]:
              face(u + w * fraction, y - 0.06, 0.07, h - 0.25, 0.07, 0x797D6D, 0.40)
          else:
            face(u, y, w + 0.24, h + 0.2, 0.12, 0xD0C4AD, 0.21)
            face(u, y, w, h, 0.10, 0x708F95, 0.30)
            face(u, y, 0.09, h, 0.08, 0xD2CEC0, 0.39)
          face(u, y - h / 2 - 0.14, w + 0.3, 0.12, 0.30, 0xC7C1AD, 0.33)
  for site in source["sites"]:
    poly = shape(site["geometry"])
    paths = []
    for r in site["lines"]:
      geom = shape(r["geometry"])
      tags = r["tags"]
      if tags.get("barrier") in {"wall", "fence"}:
        height = (
          float(tags.get("height", 2.4))
          if str(tags.get("height", "2.4")).replace(".", "", 1).isdigit()
          else 2.4
        )
        for line in line_parts(geom):
          for a, b in zip(line.coords, list(line.coords)[1:]):
            length = math.dist(a, b)
            if length > 0.01:
              put(
                cell((a[0] + b[0]) / 2, (a[1] + b[1]) / 2),
                (a[0] + b[0]) / 2,
                3 + height / 2,
                (a[1] + b[1]) / 2,
                length,
                height,
                0.3,
                -math.atan2(b[1] - a[1], b[0] - a[0]),
                0x8E7F6C,
              )
        continue
      paths.append(geom.buffer(r["width"] / 2 + 1.4))
      for line in line_parts(geom):
        for a, b in zip(line.coords, list(line.coords)[1:]):
          dx, dz = b[0] - a[0], b[1] - a[1]
          length = math.hypot(dx, dz)
          if length < 0.02:
            continue
          for sign in [-1, 1]:
            x = (a[0] + b[0]) / 2 + dz / length * r["width"] / 2 * sign
            z = (a[1] + b[1]) / 2 - dx / length * r["width"] / 2 * sign
            put(
              cell(x, z), x, 3.10, z, length, 0.16, 0.18, -math.atan2(dz, dx), 0xAEA897
            )
    named = []
    for m in site["markers"]:
      x, z = m["point"]
      tags = m["tags"]
      c = cell(x, z)
      if (
        tags.get("historic") in {"tomb", "memorial"} or tags.get("cemetery") == "grave"
      ):
        named.append(Point(x, z).buffer(5))
        evidence["mappedGraves"].append(m)
        put(c, x, 3.13, z, 2, 0.26, 1.9, 0, 0xA5A594)
        put(c, x, 4.1, z, 0.85, 1.85, 0.35, 0, 0x8C9385)
        put(c, x, 5.07, z, 0.95, 0.14, 0.45, 0, 0xB5B7A8)
      elif tags.get("amenity") == "bench" and site["key"] == "teutoburger":
        put(c, x, 3.5, z, 1.8, 0.14, 0.5, 0, 0x9B805C)
        put(c, x, 3.88, z + 0.25, 1.8, 0.5, 0.10, 0, 0x8E7559)
    if site["key"] == "teutoburger":
      continue
    if site["key"] == "schoenhauser":
      # The documented enclosing wall follows the exact cemetery boundary;
      # its 2.4 m height/material are display estimates. Source paths and the
      # Lapidarium interrupt the wall, so no entry is sealed by a guessed slab.
      gaps = unary_union(paths + [shape(p).buffer(0.4) for p in site["buildingMasks"]])
      perimeter = poly.boundary.difference(gaps)
      evidence["schoenhauserEnclosure"] = {
        "geometry": mapping(perimeter),
        "gaps": mapping(gaps),
        "heightStatus": "2.4 m display estimate; cemetery boundary anchor, not separate wall survey",
      }
      for line in line_parts(perimeter):
        for a, b in zip(line.coords, list(line.coords)[1:]):
          length = math.dist(a, b)
          if length < 0.02:
            continue
          x, z = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
          angle = -math.atan2(b[1] - a[1], b[0] - a[0])
          put(cell(x, z), x, 4.2, z, length, 2.4, 0.28, angle, 0x9A8B77)
          put(cell(x, z), x, 5.43, z, length, 0.13, 0.34, angle, 0xB4AA94)
    forbidden = unary_union(
      paths + [shape(p).buffer(4) for p in site["buildingMasks"]] + named
    )
    allowed = poly.buffer(-4).difference(forbidden)
    fields = []
    # Sparse representative fields are not a false per-grave survey. The exact
    # cemetery perimeter and mapped individual grave anchors remain distinct.
    pitch = 13 if site["key"] == "weissensee" else 6.5
    x0, z0, x1, z1 = poly.bounds
    z = z0 + pitch / 2
    while z < z1:
      x = x0 + pitch / 2
      while x < x1:
        fp = box(x - 0.6, z - 0.9, x + 0.6, z + 0.9)
        if allowed.covers(fp):
          color = [0xAFB09F, 0x919B8C, 0xBCB8A7][int(abs(x + z)) % 3]
          c = cell(x, z)
          put(c, x, 3.13, z, 1.15, 0.22, 1.7, 0, color)
          put(c, x, 3.8, z - 0.68, 0.78, 1.25, 0.22, 0, color)
          fields.append([round(x, 3), round(z, 3)])
        x += pitch
      z += pitch
    evidence["graveFields"].append(
      {
        "site": site["key"],
        "status": "schematic unnamed representative markers, not measured graves",
        "allowed": mapping(allowed),
        "centers": fields,
      }
    )
  for r in source["kastanienallee"]:
    for line in line_parts(shape(r["geometry"])):
      for a, b in zip(line.coords, list(line.coords)[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dz)
        if length < 0.02:
          continue
        for side in [-1, 1]:
          x = (a[0] + b[0]) / 2 + dz / length * r["width"] / 2 * side
          z = (a[1] + b[1]) / 2 - dx / length * r["width"] / 2 * side
          put(cell(x, z), x, 3.09, z, length, 0.14, 0.19, -math.atan2(dz, dx), 0xB5B2A3)
  drawn = {
    "schemaVersion": 1,
    "cells": [
      {"id": k, "boxes": v["boxes"], "surfaces": v["surfaces"]}
      for k, v in sorted(cells.items())
    ],
    "sourceOwnerIds": [b["id"] for b in source["buildings"] if b["replaceOwner"]],
  }
  native = {
    "schemaVersion": 1,
    "cells": [{"id": k, "boxes": v["native"]} for k, v in sorted(cells.items())],
  }
  evidence["exclusions"] = {"type": "FeatureCollection", "features": exclusions}
  return drawn, native, evidence


def main() -> None:
  """Rebuild from committed evidence unless explicitly extracting retained caches."""
  import sys

  if "--extract" in sys.argv or not SOURCE.exists():
    source = extract()
    SOURCE.write_text(json.dumps(source, separators=(",", ":")) + "\n")
    # Give parent integration exact exclusions before expensive native conversion.
    early = [
      {
        "type": "Feature",
        "properties": {
          "id": b["id"],
          "osmId": b["osmId"],
          "name": b["kind"],
          "completeSourceOwner": True,
        },
        "geometry": mapping(
          transform(lambda x, z: WGS(x + 389500, 5820000 - z), shape(b["footprint"]))
        ),
      }
      for b in source["buildings"]
      if b["replaceOwner"]
    ]
    (DATA / "north-sites-v190-exclusions.geojson").write_text(
      json.dumps(
        {"type": "FeatureCollection", "features": early}, separators=(",", ":")
      )
      + "\n"
    )
    print("Extracted", len(source["buildings"]), "owners; exclusions ready", flush=True)
    if "--extract-only" in sys.argv:
      return
  source = json.loads(SOURCE.read_text())
  drawn, native, evidence = build(source)
  for path, payload in [
    (ROOT / "src/app/src/data/northSitesV190.json", drawn),
    (ROOT / "src/app/src/data/northSitesV190Native.json", native),
    (DATA / "north-sites-v190-evidence.json", evidence),
  ]:
    path.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
  print(
    "Drawn",
    len(drawn["cells"]),
    "cells",
    sum(len(c["boxes"]) for c in drawn["cells"]),
    "boxes; native",
    sum(len(c["boxes"]) for c in native["cells"]),
  )


if __name__ == "__main__":
  main()
