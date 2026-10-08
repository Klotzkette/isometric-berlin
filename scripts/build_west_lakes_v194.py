"""Bounded named west-lake supplement; no earlier packet or source is modified.

OSM rings are retained exactly in source.geojson. Display heights and roof/window
subdivisions are explicitly visual estimates, not measured LoD2 reconstruction.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_steglitz_v182 import native_blocks
from build_surrounding_outlines import (
  load_projected_polygon,
  native_polygon,
  polygons_from_geometry,
  world,
)
from pyproj import Transformer
from shapely import constrained_delaunay_triangles
from shapely.geometry import Point, Polygon, mapping, shape
from shapely.ops import transform, triangulate, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "west-lakes-v194-source.geojson"
WATER = -1.15
GROUND = 3.0
PARK = 0x7CA069
WATER_COLOR = 0x69949D
BANK = 0xADAE96
TO_METRIC = Transformer.from_crs(4326, 25833, always_xy=True).transform
TO_GEO = Transformer.from_crs(25833, 4326, always_xy=True).transform


def all_polygons(g):
  return list(polygons_from_geometry(g))


def rings(g):
  return [
    [
      [list(p) for p in poly.exterior.coords],
      *[list(map(list, r.coords)) for r in poly.interiors],
    ]
    for poly in all_polygons(g)
  ]


def surfaces(g, y, color):
  result = []
  for p in all_polygons(g):
    for tri in constrained_delaunay_triangles(p).geoms:
      pts = [[x, y, z] for x, z in list(tri.exterior.coords)[:3]]
      result.append(pts)
  return {"triangles": result, "color": color}


def walls(g, base, top, color):
  triangles = []
  for poly in all_polygons(g):
    for ring in [poly.exterior, *poly.interiors]:
      for (ax, az), (bx, bz) in zip(ring.coords, list(ring.coords)[1:]):
        a, b, c, d = [ax, base, az], [bx, base, bz], [bx, top, bz], [ax, top, az]
        triangles.extend([[a, b, c], [a, c, d]])
  return {"triangles": triangles, "color": color}


def volume(site, g, base, top, color, roof=None):
  if g.is_empty:
    return
  site["surfaces"].extend([walls(g, base, top, color), surfaces(g, top, roof or color)])


def hip(site, g, base, rise, color):
  """Source-clipped roof with inset ridges; never bridge a U-shaped court."""
  inset = g.buffer(-2, join_style=2)
  if inset.is_empty:
    inset = g.buffer(-0.8, join_style=2)
  points = unary_union([g.boundary, inset.boundary])
  ts = []
  for t in triangulate(points):
    if g.covers(t):
      ts.append(
        [
          [x, base + min(1, Point(x, z).distance(g.boundary) / 2) * rise, z]
          for x, z in list(t.exterior.coords)[:3]
        ]
      )
  site["surfaces"].append({"triangles": ts, "color": color})


def boxrow(site, p, y, w, h, d, yaw, color):
  site["boxes"].append([p[0], y, p[1], w, h, d, yaw, color])


def windows(site, g, base, floors, spacing=3.2, cream=0xE2DBC9):
  """Bounded photo-informed rhythm on actual straight walls, estimated spacing."""
  for poly in all_polygons(g):
    for ring in [poly.exterior, *poly.interiors]:
      for a, b in zip(ring.coords, list(ring.coords)[1:]):
        a, b = np.array(a), np.array(b)
        length = np.linalg.norm(b - a)
        if length < 2.5:
          continue
        d = (b - a) / length
        n = np.array([-d[1], d[0]])
        if g.contains(Point(*(a + b) / 2 + n * 0.08)):
          n = -n
        yaw = math.atan2(-d[1], d[0])
        count = max(1, int(length / spacing))
        for k in range(count):
          p = a + d * length * (k + 0.5) / count + n * 0.075
          for level in range(floors):
            y = base + 1.7 + level * 3.15
            boxrow(site, p, y, 1.05, 1.70, 0.10, yaw, cream)
            boxrow(site, p + n * 0.08, y, 0.77, 1.43, 0.10, yaw, 0x53646A)
            boxrow(site, p + n * 0.15, y, 0.07, 1.43, 0.06, yaw, cream)
            boxrow(site, p + n * 0.15, y, 0.77, 0.07, 0.06, yaw, cream)
        # Restrained continuous cornice on the same exact source wall.
        boxrow(
          site,
          (a + b) / 2 + n * 0.10,
          base + floors * 3.15 + 0.1,
          length,
          0.18,
          0.22,
          yaw,
          cream,
        )


def site_for(key, name, owner):
  return {
    "key": key,
    "name": name,
    "owners": [owner],
    "surfaces": [],
    "boxes": [],
    "rods": [],
  }


def heroes(geoms, ids):
  output = []
  # Four source corner projections, not four freestanding invented towers.
  g = geoms["schloss-tegel"]
  s = site_for(
    "schloss-tegel", "Humboldt-Schloss / Schloss Tegel", ids["schloss-tegel"]
  )
  volume(s, g, GROUND, 11.0, 0xE4E0D2)
  hip(s, g, 11.0, 2.3, 0x626663)
  windows(s, g, GROUND, 2, 3.5)
  coords = list(g.exterior.coords)
  rect = list(g.minimum_rotated_rectangle.exterior.coords)[:4]
  for idx in range(4):
    a = np.array(rect[idx])
    b = np.array(rect[(idx + 1) % 4])
    c = np.array(rect[(idx - 1) % 4])
    u = (b - a) / np.linalg.norm(b - a)
    v = (c - a) / np.linalg.norm(c - a)
    tower = g.intersection(
      Polygon([a, a + u * 5.7, a + u * 5.7 + v * 5.7, a + v * 5.7])
    )
    if tower.is_empty or tower.area < 8:
      raise ValueError("Invalid Tegel source tower")
    volume(s, tower, 11.0, 16.0, 0xE9E5D8)
    hip(s, tower, 16.0, 1.0, 0x656967)
    windows(s, tower, 11.0, 1, 3.0)
  output.append(s)
  g = geoms["villa-borsig"]
  s = site_for("villa-borsig", "Villa Borsig on Reiherwerder", ids["villa-borsig"])
  volume(s, g, GROUND, 11.7, 0xC7B27C)
  hip(s, g, 11.7, 4.0, 0x865541)
  windows(s, g, GROUND, 2, 3.25, 0xE5DECC)
  # Dormers only above existing long source edges, all kept inside roof footprint.
  for a, b in zip(g.exterior.coords, list(g.exterior.coords)[1:]):
    a, b = np.array(a), np.array(b)
    d = b - a
    length = np.linalg.norm(d)
    if length < 9:
      continue
    d /= length
    n = np.array([-d[1], d[0]])
    if not g.contains(Point(*(a + b) / 2 + n)):
      n = -n
    for t in [0.25, 0.75]:
      p = a + (b - a) * t + n * 1.0
      if g.covers(Point(*p)):
        boxrow(s, p, 13.0, 0.95, 1.2, 0.7, math.atan2(-d[1], d[0]), 0xE0D6BB)
        boxrow(
          s, p - n * 0.4, 13.0, 0.60, 0.82, 0.06, math.atan2(-d[1], d[0]), 0x4E6061
        )
  output.append(s)
  g = geoms["schloss-pfaueninsel"]
  s = site_for(
    "schloss-pfaueninsel",
    "Schloss Pfaueninsel: white ruin towers and iron bridge",
    ids["schloss-pfaueninsel"],
  )
  volume(s, g, GROUND, 10.6, 0xE9E7D9)
  windows(s, g, GROUND, 2, 3.0, 0xF0ECDF)
  coords = list(g.exterior.coords)
  towerpolys = [Polygon(coords[2:33]), Polygon(coords[63:94])]
  centres = []
  for tower in towerpolys:
    tower = tower.intersection(g)
    centres.append(np.array(tower.centroid.coords[0]))
    volume(s, tower, 10.6, 16.0, 0xEEEADE)
    # Thin horizontal white bands preserve exact tower source perimeter.
    volume(s, tower.buffer(0.08), 14.4, 14.65, 0xF2EEE2)
    for angle in np.arange(0, 2 * math.pi, math.pi / 3):
      c = np.array(tower.centroid.coords[0])
      p = c + np.array([math.cos(angle), math.sin(angle)]) * 2.94
      boxrow(s, p, 13.55, 0.85, 1.8, 0.1, math.pi / 2 - angle, 0x566467)
    for angle in np.arange(0, 2 * math.pi, math.pi / 4):
      p = (
        np.array(tower.centroid.coords[0])
        + np.array([math.cos(angle), math.sin(angle)]) * 2.5
      )
      boxrow(s, p, 16.25, 0.8, 0.5, 0.5, math.pi / 2 - angle, 0xEEEADE)
  # Open iron walkway between towers, never a solid wall between their crowns.
  a, b = centres
  d = b - a
  length = np.linalg.norm(d)
  u = d / length
  n = np.array([-u[1], u[0]])
  yaw = math.atan2(-u[1], u[0])
  middle = (a + b) / 2
  boxrow(s, middle, 14.05, length - 4.7, 0.16, 1.05, yaw, 0x464F4C)
  for side in [-1, 1]:
    boxrow(s, middle + n * side * 0.52, 14.90, length - 4.7, 0.07, 0.06, yaw, 0x414A46)
    for f in np.linspace(0.18, 0.82, 12):
      boxrow(s, a + d * f + n * side * 0.52, 14.5, 0.055, 0.80, 0.055, 0, 0x414A46)
  # Complete mapped white-board upper-wall parts, including tagged sloping caps.
  for key, rise in [
    ("pfaueninsel-part-1540816649", 0.4),
    ("pfaueninsel-part-1543022894", 0.6),
    ("pfaueninsel-part-1543260963", 0.3),
  ]:
    part = geoms[key]
    s["owners"].append(ids[key])
    direction = np.array([math.sin(math.radians(140)), -math.cos(math.radians(140))])
    values = [np.dot(p, direction) for p in part.exterior.coords]
    low, high = min(values), max(values)

    def top(p):
      return GROUND + 12 - rise + (np.dot(p, direction) - low) / (high - low) * rise

    tris = []
    for a, b in zip(part.exterior.coords, list(part.exterior.coords)[1:]):
      aa, bb = [a[0], GROUND + 9, a[1]], [b[0], GROUND + 9, b[1]]
      cc, dd = [b[0], top(b), b[1]], [a[0], top(a), a[1]]
      tris.extend([[aa, bb, cc], [aa, cc, dd]])
    for t in constrained_delaunay_triangles(part).geoms:
      tris.append([[x, top([x, z]), z] for x, z in list(t.exterior.coords)[:3]])
    s["surfaces"].append({"triangles": tris, "color": 0xEEEADE})
  # Distinct small octagonal belvedere and low cap visible in permitted photograph.
  turret = Point(*centres[0]).buffer(1.20, resolution=2)
  volume(s, turret, 16.0, 18.5, 0xECE8DC)
  hip(s, turret, 18.5, 0.75, 0x6D817B)
  output.append(s)
  return output


def pack(site):
  """Final indexed attributes: no per-face source-object graph at runtime."""
  lookup = {}
  position = []
  colors = []
  indices = []
  for surface in site["surfaces"]:
    for t in surface["triangles"]:
      for p in t:
        key = (*[round(float(v), 4) for v in p], surface["color"])
        if key not in lookup:
          lookup[key] = len(position) // 3
          position.extend(key[:3])
          colors.append(key[3])
        indices.append(lookup[key])
  return {k: v for k, v in site.items() if k not in ["surfaces", "rods"]} | {
    "positions": position,
    "colors": colors,
    "indices": indices,
  }


def main():
  raw = json.loads(SOURCE.read_text())
  props = {f["properties"]["key"]: f["properties"] for f in raw["features"]}
  metric = {
    f["properties"]["key"]: transform(TO_METRIC, shape(f["geometry"]))
    for f in raw["features"]
  }
  geoms = {k: world(v) for k, v in metric.items()}
  geoms = {
    k: (list(g.geoms)[0] if g.geom_type == "MultiPolygon" and len(g.geoms) == 1 else g)
    for k, g in geoms.items()
  }
  ids = {k: p["id"] for k, p in props.items()}
  # v187 covers all earlier local water and island-shore models; never replay it.
  old = world(load_projected_polygon(GEO / "bounds-outskirts-v187.geojson"))
  tegel = geoms["tegel-water"]
  island = geoms["pfaueninsel"]
  klein = geoms["kleiner-wannsee"]
  lake_scope = unary_union([Polygon(p.exterior) for p in all_polygons(tegel)]).buffer(
    22
  )
  scope = unary_union(
    [
      lake_scope,
      island,
      klein.buffer(12),
      geoms["grosser-wannsee"],
      *[geoms[k].buffer(32) for k in ["schloss-tegel", "villa-borsig"]],
    ]
  )
  # Geography has one connected constant water datum; all island holes are kept.
  waters = {"tegel-water": tegel, "kleiner-wannsee": klein.difference(old)}
  lands = {
    "tegel-water": lake_scope.difference(tegel).difference(old),
    "pfaueninsel": island.difference(old),
    "schloss-tegel-context": geoms["schloss-tegel"].buffer(32).difference(old),
    "villa-borsig-context": geoms["villa-borsig"]
    .buffer(32)
    .difference(tegel)
    .difference(lake_scope)
    .difference(old),
  }
  native_waters = {
    k: native_polygon(g).simplify(0).difference(old)
    if k != "tegel-water"
    else native_polygon(g).simplify(0)
    for k, g in waters.items()
  }
  scenes = {False: [], True: []}
  for native in [False, True]:
    for key in [
      "tegel-water",
      "kleiner-wannsee",
      "pfaueninsel",
      "schloss-tegel-context",
      "villa-borsig-context",
    ]:
      s = site_for(key, key, ids.get(key, key))
      if key in waters:
        water = native_waters[key] if native else waters[key]
        s["surfaces"].append(surfaces(water, WATER, WATER_COLOR))
        # New outer shores only: do not turn source-partition or old/new cut lines into banks.
        coast = tegel if key == "tegel-water" else klein
        coastline = (
          coast.boundary.difference(old.buffer(0.015))
          if key != "tegel-water"
          else coast.boundary
        )
        if key == "tegel-water":
          s["surfaces"].append(walls(water, WATER, GROUND, BANK))
        else:
          for line in (
            [coastline]
            if coastline.geom_type == "LineString"
            else getattr(coastline, "geoms", [])
          ):
            if line.geom_type == "LineString":
              strip = line.buffer(0.06, cap_style=2)
              s["surfaces"].append(surfaces(strip, WATER + 0.03, BANK))
      if key in lands:
        land = lands[key]
        if native:
          land = (
            native_polygon(land)
            .simplify(0)
            .difference(old)
            .difference(native_waters["tegel-water"])
          )
        s["surfaces"].append(surfaces(land, GROUND + 0.01, PARK))
      scenes[native].append(pack(s))
  hero_sites = heroes(geoms, ids)
  for h in hero_sites:
    scenes[False].append(pack(h))
    n = native_blocks(h)
    scenes[True].append(
      {
        "key": h["key"],
        "name": h["name"],
        "owners": h["owners"],
        "positions": [],
        "indices": [],
        "colors": [],
        "boxes": n,
      }
    )
  source_areas = {k: round(g.area, 6) for k, g in geoms.items()}
  source_inventory = {
    k: {
      "id": ids[k],
      "areaM2": source_areas[k],
      "rings": sum(1 + len(p.interiors) for p in all_polygons(g)),
      "vertices": sum(
        len(p.exterior.coords) + sum(len(r.coords) for r in p.interiors)
        for p in all_polygons(g)
      ),
    }
    for k, g in geoms.items()
  }
  evidence = {
    "version": "1.0.94",
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "sourceInventory": source_inventory,
    "newWaterAreaM2": {k: round(g.area, 6) for k, g in waters.items()},
    "newLandAreaM2": {k: round(g.area, 6) for k, g in lands.items()},
    "waterY": WATER,
    "wannseePartitionAudit": {
      k: {"completeAreaM2": g.area, "missingPriorScopeM2": g.difference(old).area}
      for k, g in geoms.items()
      if k in ["grosser-wannsee", "havel-wannsee", "havel-pfaueninsel"]
    },
    "geometryPolicy": "Complete OSM rings retained; additions only outside v187. No prior packet edits. Native 2m horizontal water/land terraces, 1m exterior building blocks. No hidden solid infill.",
    "heightProvenance": "OSM footprints exact; Schloss Tegel source 3 levels. All vertical silhouettes/roof/window dimensions are photo-informed display estimates (no cached LoD2 tile/owner available); Pfauen source height13 itself estimated. Flat existing world datum3m, no invented terrain relief.",
    "creditsPath": "west-lakes-v194-visual-references.json",
  }
  for native, sites in scenes.items():
    filename = "westLakesV194Native.json" if native else "westLakesV194.json"
    (DATA / filename).write_text(
      json.dumps({"sites": sites}, separators=(",", ":")) + "\n"
    )
    evidence[filename] = {
      "bytes": (DATA / filename).stat().st_size,
      "triangles": sum(len(s["indices"]) // 3 for s in sites),
      "boxes": sum(len(s["boxes"]) for s in sites),
    }
  nav = {
    "waterY": WATER,
    "drawn": [
      {"key": k, "polygons": rings(g), "bounds": g.bounds} for k, g in waters.items()
    ],
    "native": [
      {"key": k, "polygons": rings(g), "bounds": g.bounds}
      for k, g in native_waters.items()
    ],
    "buildings": [
      {
        "id": ids[h["key"]],
        "key": h["key"],
        "polygons": rings(geoms[h["key"]]),
        "groundY": GROUND,
        "topY": max(p[1] for s in h["surfaces"] for t in s["triangles"] for p in t),
      }
      for h in hero_sites
    ],
  }
  (DATA / "westLakesV194Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  from shapely.affinity import affine_transform

  metric_scope = affine_transform(scope, [1, 0, 0, -1, 389500, 5820000])
  (GEO / "bounds-west-lakes-v194.geojson").write_text(
    json.dumps(
      {
        "type": "FeatureCollection",
        "features": [
          {
            "type": "Feature",
            "properties": {
              "scope": "Exact named lakes/island plus 22m Tegel shore and 32m hero context; old scope retained",
              "areaM2": scope.area,
            },
            "geometry": mapping(transform(TO_GEO, metric_scope)),
          }
        ],
      },
      separators=(",", ":"),
    )
    + "\n"
  )
  (GEO / "west-lakes-v194-evidence.json").write_text(
    json.dumps(evidence, indent=2) + "\n"
  )
  print(
    json.dumps(
      {k: v for k, v in evidence.items() if k.endswith(".json") or k.startswith("new")},
      indent=2,
    )
  )


if __name__ == "__main__":
  main()
