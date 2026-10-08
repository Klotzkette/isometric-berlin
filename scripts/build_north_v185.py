"""Step 10: bounded retained-source northern facade and garden accents."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import geopandas as gpd
from build_bebelplatz_building_source import part_profile
from build_surrounding_outlines import tags_for, world
from shapely.geometry import MultiPolygon, Point, Polygon, box, mapping, shape
from shapely.ops import nearest_points, unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "geo_data/regierungsviertel/raw/outer-v159"
DEST = ROOT / "src/app/src/data/northV185.json"
SOURCES = [
  "https://www.kulturbrauerei.de/gelaende/geschichte/",
  "https://www.berlin.de/sehenswuerdigkeiten/3560308-3558930-kulturbrauerei.html",
  "https://www.berlin.de/ba-mitte/ueber-den-bezirk/sehenswertes/parks-und-gaerten/",
  "https://www.haas-architekten.de/projekte/wohnbauten/choriner-hoefe",
  "https://www.collignonarchitektur.com/de/projekte/choriner-hoefe",
]


def digest(path: Path) -> str:
  """Keep exact input fingerprints without carrying source cache duplicates."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def multi_mapping(geometry: Any) -> dict:
  """Use one consistent bounded polygon representation for runtime planting."""
  polygons = (
    [geometry]
    if geometry.geom_type == "Polygon"
    else [p for p in geometry.geoms if p.geom_type == "Polygon"]
  )
  return mapping(MultiPolygon(polygons))


def constrain_faces(faces: list[dict], owners: list[dict]) -> list[dict]:
  """Fit a safe facade rectangle to true LoD2 walls below roof/gable starts."""
  selected = {p["id"]: p for p in owners}
  walls: dict[str, list] = {}
  for tile in ["391_5821", "392_5821", "392_5822"]:
    path = ROOT / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip"
    with zipfile.ZipFile(path) as archive:
      for name in archive.namelist():
        if not name.endswith((".gml", ".xml")):
          continue
        with archive.open(name) as stream:
          for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            owner_id = element.get(GML_ID)
            if owner_id in selected and owner_id not in walls:
              parts = [
                part_profile(p) for p in leaf_building_parts(element) or [element]
              ]
              walls[owner_id] = [
                s for p in parts for s in p["surfaces"] if s["kind"] == "WallSurface"
              ]
            element.clear()
  result = []
  for face in faces:
    ax, az = face["a"]
    bx, bz = face["b"]
    length = math.hypot(bx - ax, bz - az)
    tx, tz = (bx - ax) / length, (bz - az) / length
    nx, nz = face["normal"]
    ground = selected[face["id"]]["sourceGroundY"]
    projected = []
    for surface in walls.get(face["id"], []):
      if any(
        abs((p[0] - ax) * nx + (p[2] - az) * nz) > 0.035 for p in surface["rings"][0]
      ):
        continue
      rings = [
        [[(p[0] - ax) * tx + (p[2] - az) * tz, p[1] - ground] for p in r]
        for r in surface["rings"]
      ]
      projected.append(Polygon(rings[0], rings[1:]).buffer(0))
    if not projected:
      continue
    wall = unary_union(projected).intersection(box(0, -2, length, 100))
    bottom = max(0, wall.bounds[1])
    # A scan over the finite source vertex elevations finds the tallest whole
    # rectangle contained in the wall, rather than following a roof apex.
    levels = sorted(
      {
        p[1]
        for poly in (
          [wall] if wall.geom_type == "Polygon" else getattr(wall, "geoms", [])
        )
        if poly.geom_type == "Polygon"
        for p in poly.exterior.coords
      },
      reverse=True,
    )
    for top in levels:
      if top - bottom < 4:
        break
      if wall.buffer(0.002).covers(box(0.08, bottom + 0.03, length - 0.08, top - 0.03)):
        result.append(
          {
            **face,
            "wallBottom": round(bottom, 3),
            "wallTop": round(top, 3),
            "wallGeometry": mapping(wall),
          }
        )
        break
  return result


def build() -> dict[str, Any]:
  """Keep mapped owners, complete holes, measured heights and bounded additions."""
  areas = gpd.read_file(
    RAW / "candidate.gpkg", layer="multipolygons", bbox=(13.395, 52.528, 13.424, 52.542)
  ).to_crs(25833)
  areas.geometry = areas.geometry.map(world)
  streets = gpd.read_file(
    RAW / "candidate.gpkg", layer="lines", bbox=(13.407, 52.534, 13.423, 52.542)
  ).to_crs(25833)
  streets.geometry = streets.geometry.map(world)
  brewery = areas[areas.osm_way_id == "32294784"].iloc[0].geometry
  choriner = areas[areas.osm_way_id == "235997895"].iloc[0].geometry
  hagenauer = streets[streets.name == "Hagenauer Straße"]
  road = unary_union(hagenauer.geometry)
  owners = gpd.read_file(
    RAW / "resolved-outlines.gpkg", layer="buildings", bbox=(2200, -2400, 3200, -1100)
  )
  occupied = unary_union(owners.geometry)
  selected = []
  faces = []
  for _, owner in owners.iterrows():
    p = owner.geometry
    if brewery.covers(p.representative_point()) and owner.height > 6:
      kind = "kulturbrauerei"
    elif p.intersection(choriner).area / p.area > 0.45:
      kind = "choriner"
    elif p.distance(road) < 21 and owner.height > 10:
      kind = "hagenauer"
    else:
      continue
    candidates = []
    for poly in [p] if p.geom_type == "Polygon" else p.geoms:
      for ring in [poly.exterior, *poly.interiors]:
        for a, b in zip(ring.coords, list(ring.coords)[1:]):
          dx, dz = b[0] - a[0], b[1] - a[1]
          length = math.hypot(dx, dz)
          if length < (5 if kind == "kulturbrauerei" else 8):
            continue
          nx, nz = dz / length, -dx / length
          mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
          if p.covers(Point(mx + nx * 0.15, mz + nz * 0.15)):
            nx, nz = -nx, -nz
          # Exclude party walls and any hidden appendage face.
          if occupied.covers(Point(mx + nx * 1.6, mz + nz * 1.6)):
            continue
          if kind == "hagenauer":
            near = nearest_points(Point(mx, mz), road)[1]
            vx, vz = near.x - mx, near.y - mz
            if math.hypot(vx, vz) > 24 or vx * nx + vz * nz < 0.8 * math.hypot(vx, vz):
              continue
          candidates.append((length, a, b, nx, nz))
    if not candidates:
      continue
    source_id = owner.sourceId.strip()
    selected.append(
      {
        "id": source_id,
        "kind": kind,
        "height": owner.height,
        "sourceGroundY": owner.sourceGroundY,
        "geometry": mapping(p),
      }
    )
    for length, a, b, nx, nz in sorted(candidates, reverse=True)[:3]:
      faces.append(
        {
          "id": source_id,
          "kind": kind,
          "a": [round(v, 3) for v in a],
          "b": [round(v, 3) for v in b],
          "normal": [round(nx, 8), round(nz, 8)],
          "height": owner.height,
          "length": round(length, 3),
        }
      )
  heritage_path = ROOT / "src/app/src/data/mitteHeritageV166Source.json"
  heritage = json.loads(heritage_path.read_text())
  park = shape(next(p["geometry"] for p in heritage["parks"] if p["id"] == "104954713"))
  delivered_beds = unary_union(
    [
      Polygon([(p[0], p[2]) for p in t])
      for s in heritage["groundSurfaces"]
      if s["kind"] == "flowerbed"
      for t in s["triangles"]
    ]
  )
  beds = [
    {
      "id": "way/" + r.osm_way_id,
      "geometry": multi_mapping(r.geometry.intersection(delivered_beds)),
      "osmGeometry": mapping(r.geometry),
    }
    for _, r in areas.iterrows()
    if r.landuse == "flowerbed" and park.covers(r.geometry)
  ]
  # Take only the recorded seven planted beds. Existing sand, water, lawns,
  # Heine sculpture, trees and DGM terrain are untouched.
  roads = []
  for _, r in hagenauer.iterrows():
    tags = tags_for(r)
    roads.append(
      {
        "id": "way/" + str(r.osm_id),
        "line": [[round(x, 3), round(z, 3)] for x, z in r.geometry.coords],
        "width": float(tags["width"]),
        "widthSource": tags.get("source:width"),
        "surface": tags.get("surface"),
      }
    )
  return {
    "sourceStatus": "Retained OSM/LoD2 anchors and envelopes; shallow bay, cornice, brick, plant and kerb dimensions are display estimates. No source geometry replacement.",
    "sources": SOURCES,
    "inputSha256": {
      "resolvedOutlines": digest(RAW / "resolved-outlines.gpkg"),
      "osm": digest(RAW / "candidate.gpkg"),
      "heritage": digest(heritage_path),
    },
    "wallSourceTiles": [
      {
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{tile}.zip",
        "sha256": digest(ROOT / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip"),
      }
      for tile in ["391_5821", "392_5821", "392_5822"]
    ],
    "breweryOsm": "way/32294784",
    "chorinerOsm": "way/235997895",
    "parkOsm": "way/104954713",
    "owners": selected,
    "faces": constrain_faces(faces, selected),
    "beds": beds,
    "roads": roads,
    "cameras": {
      "kulturbrauerei": {"position": [3060, 130, -2040], "target": [2910, 14, -2200]},
      "hagenauer": {"position": [3210, 90, -2050], "target": [3094, 10, -2210]},
      "weinbergspark": {"position": [2050, 115, -1280], "target": [2010, 9, -1490]},
      "choriner": {"position": [2460, 95, -1150], "target": [2380, 18, -1300]},
    },
  }


if __name__ == "__main__":
  data = build()
  DEST.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  print(
    f"North v185: {len(data['owners'])} source owners, {len(data['faces'])} faces, {len(data['beds'])} mapped beds, {len(data['roads'])} road segments"
  )
