"""Step 10: retained-source Tierpark and Köpenick recognition supplement."""

from __future__ import annotations

import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import normal_of, triangles_for
from build_steglitz_v182 import native_blocks
from build_surrounding_outlines import line_parts, tags_for, world
from pyproj import Transformer
from shapely.geometry import Point, Polygon, box, mapping
from shapely.ops import transform, unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "geo_data/regierungsviertel/raw"
DATA = ROOT / "src/app/src/data"
GROUND = 3.0
TO_WGS84 = Transformer.from_crs(25833, 4326, always_xy=True).transform
TARGETS = [
  (
    "Schloss Friedrichsfelde",
    "399_5818",
    "DEBE11YYI00009hE",
    "way/11269749",
    0xE4D4AD,
    0x8E6557,
  ),
  (
    "Alfred-Brehm-Haus",
    "400_5817",
    "DEBE11YYI0000Nxm",
    "way/11269594",
    0xCEC9B8,
    0x839E9C,
  ),
  ("Giraffenhaus", "400_5818", "DEBE11YYI0000GSB", "way/11643292", 0xB8A480, 0x718384),
  (
    "Schloss Köpenick",
    "402_5811",
    "DEBE09YYP00036uB",
    "way/137219848",
    0xDBD3BB,
    0x706C63,
  ),
  (
    "Stadtkirche St. Laurentius",
    "403_5811",
    "DEBE09YYP0002bXT",
    "way/27058690",
    0xA77A5F,
    0x956B59,
  ),
  (
    "Rathaus Köpenick",
    "403_5811",
    "DEBE09YYP0002hWB",
    "relation/57493",
    0xA16D55,
    0x555E5B,
  ),
  (
    "Rathaus Köpenick",
    "403_5811",
    "DEBE09YYP0002ue2",
    "relation/57493",
    0xA16D55,
    0x555E5B,
  ),
  (
    "Rathaus Köpenick",
    "403_5811",
    "DEBE09YYP0002y5Q",
    "relation/57493",
    0xA16D55,
    0x555E5B,
  ),
  (
    "Rathaus Köpenick",
    "403_5811",
    "DEBE09YYP00039u7",
    "relation/57493",
    0xA16D55,
    0x555E5B,
  ),
]
REFERENCES = [
  "https://www.tierpark-berlin.de/de/tickets-service/tierpark-plan",
  "https://www.tierpark-berlin.de/de/ueber-uns/historie",
  "https://www.tierpark-berlin.de/de/tierpark-erleben/tiere-erlebniswelten/regenwaldhaus",
  "https://www.schloss-friedrichsfelde.de/das-schloss",
  "https://www.berlin.de/ba-treptow-koepenick/politik-und-verwaltung/aemter/stadtentwicklungsamt/denkmalschutz/artikel.41403.php",
  "https://www.visitberlin.de/de/rathaus-koepenick",
]


def digest(path: Path) -> str:
  """Fingerprint each retained source."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def identity(row: Any) -> str:
  """Retain complete OSM kind and identifier."""
  way = row.get("osm_way_id")
  return "way/" + str(way) if isinstance(way, str) else "relation/" + str(row.osm_id)


def polygons(geometry: Any) -> list[Polygon]:
  """Ignore only empty/non-area intersection fragments."""
  if geometry.is_empty:
    return []
  if geometry.geom_type == "Polygon":
    return [geometry]
  return [p for g in getattr(geometry, "geoms", []) for p in polygons(g)]


def facade(rings: list, name: str) -> list[list]:
  """Bound approximate, deliberately sparse openings to true source wall faces."""
  normal = normal_of(rings[0])
  if abs(normal[1]) > 0.01:
    return []
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda pair: math.hypot(pair[1][0] - pair[0][0], pair[1][2] - pair[0][2]),
  )
  d = np.array([b[0] - a[0], 0, b[2] - a[2]], dtype=float)
  length = float(np.linalg.norm(d))
  if length < 4:
    return []
  d /= length
  wall_rings = [[(float(np.dot(np.subtract(p, a), d)), p[1]) for p in r] for r in rings]
  wall = Polygon(wall_rings[0], wall_rings[1:]).buffer(0)
  bottom, top = wall.bounds[1], wall.bounds[3]
  bays = max(1, round(length / (5 if "Brehm" in name else 3.6)))
  documented_levels = {
    "Schloss Friedrichsfelde": 2,
    "Schloss Köpenick": 3,
    "Alfred-Brehm-Haus": 1,
    "Giraffenhaus": 1,
    "Rathaus Köpenick": 3,
    "Stadtkirche St. Laurentius": 1,
  }[name]
  levels = min(documented_levels, max(1, round((top - bottom) / 4.3)))
  opening_height = (
    3.2
    if name in {"Alfred-Brehm-Haus", "Giraffenhaus", "Stadtkirche St. Laurentius"}
    else 2.5
  )
  result = []
  for level in range(levels):
    y = bottom + (level + 0.52) * (top - bottom) / levels
    for i in range(bays):
      u = (i + 0.5) * length / bays
      if not wall.buffer(-0.12).covers(
        box(u - 0.65, y - opening_height / 2, u + 0.65, y + opening_height / 2)
      ):
        continue
      p = np.array(a) + d * u + normal * 0.045
      result.append(
        [
          round(p[0], 3),
          round(y, 3),
          round(p[2], 3),
          1.3,
          opening_height,
          0.065,
          math.atan2(-d[2], d[0]),
          0x607C82,
        ]
      )
      result.append(
        [
          round(p[0] + normal[0] * 0.05, 3),
          round(y - opening_height / 2 - 0.04, 3),
          round(p[2] + normal[2] * 0.05, 3),
          1.55,
          0.12,
          0.16,
          math.atan2(-d[2], d[0]),
          0xDAD3BE,
        ]
      )
  return result


def native_ground(poly: Polygon, color: int) -> list[list]:
  """Independent two-metre flat native surface, only fully contained cells."""
  result = []
  x0, z0, x1, z1 = poly.bounds
  for z in range(math.floor(z0 / 2) * 2, math.ceil(z1 / 2) * 2, 2):
    start = None
    for x in range(math.floor(x0 / 2) * 2, math.ceil(x1 / 2) * 2 + 2, 2):
      inside = poly.covers(box(x, z, x + 2, z + 2))
      if inside and start is None:
        start = x
      if not inside and start is not None:
        result.append([(start + x) / 2, 3.03, z + 1, x - start, 0.04, 2, color])
        start = None
  return result


def build() -> tuple[dict, dict, dict, dict]:
  """Keep measured complete hero shells and only actual mapped zoo features."""
  cells: dict[str, dict] = defaultdict(
    lambda: {"surfaces": [], "boxes": [], "native": []}
  )
  owners, exclusions, source_profiles = [], [], []

  def cell_for(x: float, z: float) -> dict:
    return cells[f"{math.floor(x / 512)}_{math.floor(z / 512)}"]

  # All parts in one OSM building keep a single vertical datum. Otherwise the
  # distinct source tower/annex parents could drift vertically relative to it.
  extracted = []
  group_ground: dict[str, float] = {}
  for name, tile, pid, osm, wall_color, roof_color in TARGETS:
    path = RAW / "lod2" / f"LoD2_{tile}.zip"
    parent = extract_parent(path, pid)
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    extracted.append((name, pid, osm, wall_color, roof_color, path, parts))
    low = min(p["ground_y_m"] for p in parts)
    group_ground[osm] = min(low, group_ground.get(osm, low))
  for name, pid, osm, wall_color, roof_color, path, parts in extracted:
    offset = GROUND - group_ground[osm]
    footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
    cell = cell_for(footprint.centroid.x, footprint.centroid.y)
    shell = {"surfaces": [], "boxes": [], "rods": []}
    for part in parts:
      for s in part["surfaces"]:
        rings = [
          [[p[0], round(p[1] + offset, 3), p[2]] for p in ring] for ring in s["rings"]
        ]
        shell["surfaces"].append(
          {
            "triangles": triangles_for(rings),
            "color": roof_color if s["kind"] == "RoofSurface" else wall_color,
            "owner": pid,
          }
        )
        if s["kind"] == "WallSurface":
          shell["boxes"].extend(facade(rings, name))
    cell["surfaces"].extend(shell["surfaces"])
    cell["boxes"].extend(shell["boxes"])
    cell["native"].extend(native_blocks(shell))
    owners.append(
      {
        "id": pid,
        "osmId": osm,
        "name": name,
        "parts": len(parts),
        "polygons": sum(len(p["surfaces"]) for p in parts),
        "sourceUrl": f"https://gdi.berlin.de/data/a_lod2/atom/{path.name}",
        "sourceSha256": digest(path),
        "rigidYOffset": round(offset, 3),
        "height": round(max(p["top_y_m"] for p in parts) - group_ground[osm], 3),
        "center": [round(footprint.centroid.x, 3), round(footprint.centroid.y, 3)],
      }
    )
    exclusions.append(
      {
        "type": "Feature",
        "properties": {
          "id": pid,
          "osmId": osm,
          "name": name,
          "completeSourceOwner": True,
          "height": owners[-1]["height"],
        },
        "geometry": mapping(
          transform(lambda x, z: TO_WGS84(x + 389500, 5820000 - z), footprint)
        ),
      }
    )
    source_profiles.append({"id": pid, "parts": parts})

  gpkg = RAW / "east-v187/candidate.gpkg"
  # The current LoD2 Rathaus includes the low roof but not its 54 m tower.
  # Exact OSM building-part footprint/height add the absent upper structure.
  towers = gpd.read_file(
    gpkg, layer="multipolygons", bbox=(13.5742, 52.4449, 13.5756, 52.44595)
  ).to_crs(25833)
  tower = world(towers[towers.osm_way_id == "180315073"].iloc[0].geometry)
  tower = polygons(tower)[0]
  tower_ring = list(tower.exterior.coords)[:-1]
  center = tower.centroid
  shell = {"surfaces": [], "boxes": [], "rods": []}
  for a, b in zip(tower_ring, tower_ring[1:] + tower_ring[:1]):
    wall = [[a[0], 25, a[1]], [b[0], 25, b[1]], [b[0], 47, b[1]], [a[0], 47, a[1]]]
    shell["surfaces"].append(
      {"triangles": triangles_for([wall]), "color": 0xA16D55, "owner": "way/180315073"}
    )
    shell["surfaces"].append(
      {
        "triangles": [[[a[0], 47, a[1]], [b[0], 47, b[1]], [center.x, 57, center.y]]],
        "color": 0x515B58,
        "owner": "way/180315073",
      }
    )
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dz)
    if length < 4:
      continue
    # Paired belfry slots and a small four-sided clock cue, dimension estimates.
    nx, nz = dz / length, -dx / length
    mx, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    if tower.covers(Point(mx + nx * 0.1, mz + nz * 0.1)):
      nx, nz = -nx, -nz
    for sign in [-1, 1]:
      shell["boxes"].append(
        [
          mx + dx / length * sign * 1.05 + nx * 0.04,
          43,
          mz + dz / length * sign * 1.05 + nz * 0.04,
          0.85,
          3.2,
          0.08,
          math.atan2(-dz, dx),
          0x4D625F,
        ]
      )
    c = [mx + nx * 0.05, 37.5, mz + nz * 0.05]
    clock = [
      [
        c[0] + dx / length * math.cos(i * math.tau / 16) * 1.2,
        c[1] + math.sin(i * math.tau / 16) * 1.2,
        c[2] + dz / length * math.cos(i * math.tau / 16) * 1.2,
      ]
      for i in range(16)
    ]
    shell["surfaces"].append(
      {
        "triangles": [[c, clock[i], clock[(i + 1) % 16]] for i in range(16)],
        "color": 0xD8D2B4,
        "owner": "way/180315073",
      }
    )
  cell = cell_for(center.x, center.y)
  cell["surfaces"].extend(shell["surfaces"])
  cell["boxes"].extend(shell["boxes"])
  cell["native"].extend(native_blocks(shell))
  owners.append(
    {
      "id": "way/180315073",
      "osmId": "way/180315073",
      "name": "Rathaus Köpenick upper tower",
      "height": 54,
      "sourceUrl": "https://www.openstreetmap.org/way/180315073",
      "heightSource": "OSM 54m and 10m roof; visitBerlin corroborates overall 54m",
      "displayClockHeight": 37.5,
      "ring": tower_ring,
      "center": [center.x, center.y],
    }
  )
  exclusions.append(
    {
      "type": "Feature",
      "properties": {
        "id": "way/180315073",
        "osmId": "way/180315073",
        "height": 54,
        "name": "Rathaus Köpenick tower",
      },
      "geometry": mapping(
        transform(lambda x, z: TO_WGS84(x + 389500, 5820000 - z), tower)
      ),
    }
  )
  areas = gpd.read_file(
    gpkg, layer="multipolygons", bbox=(13.5203, 52.4948, 13.5389, 52.51)
  ).to_crs(25833)
  areas.geometry = areas.geometry.map(world)
  zoo = areas[areas.osm_way_id == "356446013"].iloc[0].geometry
  areas = areas[areas.geometry.representative_point().within(zoo)]
  lines = gpd.read_file(
    gpkg, layer="lines", bbox=(13.5203, 52.4948, 13.5389, 52.51)
  ).to_crs(25833)
  lines.geometry = lines.geometry.map(world)
  lines = lines[lines.geometry.intersects(zoo)]
  points = gpd.read_file(
    gpkg, layer="points", bbox=(13.5203, 52.4948, 13.5389, 52.51)
  ).to_crs(25833)
  points.geometry = points.geometry.map(world)
  gates = points[
    points.barrier.isin(["gate", "entrance", "lift_gate", "kissing_gate"])
    & points.geometry.within(zoo)
  ]
  gate_gaps = unary_union([p.buffer(1.25) for p in gates.geometry])
  obstacles = [
    r.geometry
    for _, r in areas.iterrows()
    if isinstance(r.building, str) or r.natural == "water"
  ]
  for _, r in lines.iterrows():
    if isinstance(r.highway, str):
      tags = tags_for(r)
      try:
        width = float(tags.get("width", "3"))
      except ValueError:
        width = 3.0
      obstacles.append(r.geometry.buffer(max(1.5, width / 2)))
  cutout = unary_union(obstacles)
  enclosures, barriers = [], []
  for _, r in areas.iterrows():
    tags = tags_for(r)
    if tags.get("attraction") != "animal" or isinstance(r.building, str):
      continue
    geometry = r.geometry.intersection(zoo).difference(cutout).buffer(0)
    if geometry.is_empty:
      continue
    # Species locations and patch geometry are mapped; palette is explicitly
    # illustrative vegetation/soil, never a claim to survey every enclosure.
    color = 0xBFAF89 if tags.get("surface") in {"sand", "dirt", "earth"} else 0x95AA7C
    for poly in polygons(geometry):
      rings = [
        [[round(x, 3), 3.035, round(z, 3)] for x, z in ring.coords]
        for ring in [poly.exterior, *poly.interiors]
      ]
      cell = cell_for(poly.centroid.x, poly.centroid.y)
      cell["surfaces"].append({"triangles": triangles_for(rings), "color": color})
      cell["native"].extend(native_ground(poly, color))
    enclosures.append(
      {
        "id": identity(r),
        "name": str(r["name"]) if isinstance(r["name"], str) else None,
        "geometry": mapping(geometry),
        "species": tags.get("species"),
        "mappedGeometry": mapping(r.geometry),
      }
    )
  for _, r in lines.iterrows():
    if r.barrier not in {"fence", "wall", "retaining_wall"}:
      continue
    tags = tags_for(r)
    try:
      height = float(tags.get("height", "1.35" if r.barrier == "fence" else "0.7"))
    except ValueError:
      height = 1.35 if r.barrier == "fence" else 0.7
    height = max(0.3, min(5, height))
    barrier_geometry = r.geometry.intersection(zoo).difference(gate_gaps)
    for line in line_parts(barrier_geometry):
      for a, b in zip(line.coords, list(line.coords)[1:]):
        length = math.dist(a, b)
        if length < 0.01:
          continue
        count = max(1, math.ceil(length / 3.5))
        dx, dz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
        cx, cz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        cell = cell_for(cx, cz)
        if r.barrier == "fence":
          for y in [height * 0.48, height]:
            cell["boxes"].append(
              [cx, GROUND + y, cz, length, 0.075, 0.075, math.atan2(-dz, dx), 0x727A69]
            )
          for k in range(count):
            t = (k + 0.5) / count
            cell["boxes"].append(
              [
                a[0] + (b[0] - a[0]) * t,
                GROUND + height / 2,
                a[1] + (b[1] - a[1]) * t,
                0.12,
                height,
                0.12,
                0,
                0x707968,
              ]
            )
            cell["native"].append(
              [
                a[0] + (b[0] - a[0]) * t,
                GROUND + height / 2,
                a[1] + (b[1] - a[1]) * t,
                0.24,
                height,
                0.24,
                0x707968,
              ]
            )
        else:
          cell["boxes"].append(
            [
              cx,
              GROUND + height / 2,
              cz,
              length,
              height,
              0.28,
              math.atan2(-dz, dx),
              0xABA58F,
            ]
          )
        # Independent orthogonal bars preserve openings in each recorded way.
        steps = max(1, math.ceil(length / 1.2))
        for k in range(steps):
          t = (k + 0.5) / steps
          cell["native"].append(
            [
              a[0] + (b[0] - a[0]) * t,
              GROUND + (height * 0.85 if r.barrier == "fence" else height / 2),
              a[1] + (b[1] - a[1]) * t,
              abs(dx) * length / steps + 0.18,
              0.22 if r.barrier == "fence" else height,
              abs(dz) * length / steps + 0.18,
              0x727A69 if r.barrier == "fence" else 0xABA58F,
            ]
          )
    barriers.append(
      {
        "id": "way/" + str(r.osm_id),
        "type": r.barrier,
        "height": height,
        "heightSource": "OSM explicit height"
        if "height" in tags
        else "display estimate",
        "geometry": mapping(barrier_geometry),
      }
    )
  drawn = {
    "cells": [
      {"id": key, "surfaces": val["surfaces"], "boxes": val["boxes"]}
      for key, val in sorted(cells.items())
    ]
  }
  native = {
    "cells": [{"id": key, "boxes": val["native"]} for key, val in sorted(cells.items())]
  }
  evidence = {
    "version": "1.0.87",
    "owners": owners,
    "osmSource": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    "osmSha256": digest(RAW / "outer-v159/berlin-260929.osm.pbf"),
    "zooId": "way/356446013",
    "zooGeometry": mapping(zoo),
    "enclosures": enclosures,
    "barriers": barriers,
    "gateNodes": [
      {
        "id": "node/" + str(r.osm_id),
        "point": [r.geometry.x, r.geometry.y],
        "gapRadiusEstimate": 1.25,
      }
      for _, r in gates.iterrows()
    ],
    "references": REFERENCES,
    "sourceProfiles": source_profiles,
    "provenance": "Exact full LoD2 walls/roofs with rigid ground translation per OSM group. Palette, restrained window spacing and untagged fence heights are display estimates. Zoo patches retain mapped enclosure outlines minus source paths, water and buildings. Official visitor plan consulted for current named exhibits only, not traced or bundled. Source date may lag subsequent zoo works.",
    "drawnTriangles": sum(
      len(s["triangles"]) for c in drawn["cells"] for s in c["surfaces"]
    ),
    "drawnBoxes": sum(len(c["boxes"]) for c in drawn["cells"]),
    "nativeBoxes": sum(len(c["boxes"]) for c in native["cells"]),
    "cells": len(cells),
  }
  return (
    drawn,
    native,
    evidence,
    {
      "type": "FeatureCollection",
      "coordinateFrame": "OGC:CRS84 longitude, latitude",
      "features": exclusions,
    },
  )


def main() -> None:
  """Generate only this independent bounded supplement."""
  drawn, native, evidence, exclusions = build()
  offsets = {
    owner["id"]: owner["rigidYOffset"]
    for owner in evidence["owners"]
    if "rigidYOffset" in owner
  }
  navigation = {
    "buildings": [
      {
        "id": part["id"],
        "owner": parent["id"],
        "ring": part["ring"],
        "holes": part["holes"],
        "groundY": round(part["ground_y_m"] + offsets[parent["id"]], 3),
        "topY": round(part["top_y_m"] + offsets[parent["id"]], 3),
      }
      for parent in evidence["sourceProfiles"]
      for part in parent["parts"]
    ]
  }
  tower = next(owner for owner in evidence["owners"] if owner["id"] == "way/180315073")
  navigation["buildings"].append(
    {
      "id": tower["id"],
      "owner": tower["id"],
      "ring": tower["ring"],
      "holes": [],
      "groundY": GROUND,
      "topY": GROUND + tower["height"],
    }
  )
  for path, payload in [
    (DATA / "eastLandmarksV187.json", drawn),
    (DATA / "eastLandmarksV187Native.json", native),
    (DATA / "eastLandmarksV187Navigation.json", navigation),
    (ROOT / "geo_data/regierungsviertel/east-landmarks-v187-evidence.json", evidence),
    (
      ROOT / "geo_data/regierungsviertel/east-landmarks-v187-exclusions.geojson",
      exclusions,
    ),
  ]:
    path.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    print(path.relative_to(ROOT), path.stat().st_size)
  print(
    {k: evidence[k] for k in ["drawnTriangles", "drawnBoxes", "nativeBoxes", "cells"]}
  )


if __name__ == "__main__":
  main()
