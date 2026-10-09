"""Step 10: bounded northern park, palace, Panke and memorial source supplement."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import geopandas as gpd
import numpy as np
from build_bebelplatz_building_source import part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_surrounding_outlines import load_projected_polygon, tags_for, world
from pyproj import Transformer
from shapely import constrained_delaunay_triangles
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

from isometric_berlin.data.fetch_lod2 import (
  GML_ID,
  NS,
  building_footprint,
  leaf_building_parts,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/north-parks-v198"
SOURCE = GEO / "north-parks-v198-source.json"
DEST = ROOT / "src/app/src/data/northParksV198.json"
OLD = [
  "bounds.geojson",
  "bounds-ring-v182.geojson",
  "bounds-city-v183.geojson",
  "bounds-outskirts-v187.geojson",
  "bounds-north-v190.geojson",
  "bounds-named-v194.geojson",
]
SITES = {
  "schlosspark": ("relation", "947050"),
  "heide": ("relation", "946980"),
  "memorial": ("way", "28104405"),
}


def write(path: Path, value: object) -> None:
  path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def parts(geometry: object) -> list:
  if geometry.is_empty:
    return []
  return (
    [geometry]
    if geometry.geom_type in {"Polygon", "LineString"}
    else [p for g in getattr(geometry, "geoms", []) for p in parts(g)]
  )


def rid(row: object) -> str:
  return (
    "way/" + str(row.osm_way_id)
    if isinstance(row.get("osm_way_id"), str)
    else (
      "relation/" if row.geometry.geom_type in {"Polygon", "MultiPolygon"} else "way/"
    )
    + str(row.osm_id)
  )


def extract() -> dict:
  """Retain full OSM rings and official palace/gate source surfaces."""
  gpkg = GEO / "raw/north-city-v190/candidate.gpkg"
  bbox = (13.365, 52.556, 13.432, 52.585)
  frames = {}
  for layer in ["multipolygons", "lines", "points"]:
    frame = gpd.read_file(gpkg, layer=layer, bbox=bbox).to_crs(25833)
    frame.geometry = frame.geometry.map(world)
    frames[layer] = frame
  areas, lines, points = (frames[k] for k in ["multipolygons", "lines", "points"])
  prior = world(unary_union([load_projected_polygon(GEO / p) for p in OLD]))
  sites = []
  for key, (kind, oid) in SITES.items():
    row = areas[areas["osm_id" if kind == "relation" else "osm_way_id"] == oid].iloc[0]
    sites.append(
      {
        "key": key,
        "id": kind + "/" + oid,
        "tags": tags_for(row),
        "geometry": mapping(row.geometry),
      }
    )
  site_union = unary_union([shape(p["geometry"]) for p in sites])
  stream_rows = [(r, tags_for(r)) for _, r in lines.iterrows() if r["name"] == "Panke"]
  streams = unary_union([r.geometry for r, t in stream_rows if t.get("waterway")])
  # Relevant connected Berlin course only, through Pankow parks to the retained
  # city. No upstream Bernau strip or rectangular district fill.
  streams = streams.intersection(box(-200, -7150, 4200, -4200))
  river = [
    (r, tags_for(r))
    for _, r in areas.iterrows()
    if tags_for(r).get("water") == "river" and r.geometry.distance(streams) < 8
  ]
  river_union = unary_union([r.geometry for r, _ in river])
  corridor = streams.buffer(14).union(river_union.buffer(5))
  roads = []
  for _, r in lines.iterrows():
    t = tags_for(r)
    if t.get("highway") not in {
      "residential",
      "tertiary",
      "secondary",
      "primary",
      "unclassified",
      "service",
      "footway",
      "path",
      "steps",
      "pedestrian",
    }:
      continue
    allowed = site_union.buffer(25)
    if t.get("name") in {
      "Tschaikowskistraße",
      "Germanenstraße",
      "Hermann-Hesse-Straße",
      "Grabbeallee",
      "Ossietzkystraße",
    }:
      allowed = allowed.union(site_union.buffer(100))
    clipped = r.geometry.intersection(allowed.union(corridor))
    if clipped.is_empty:
      continue
    pedestrian = t.get("highway") in {"footway", "path", "steps"}
    try:
      width = float(
        t.get(
          "width", 2.4 if pedestrian else 6 if t.get("highway") == "service" else 10
        )
      )
    except ValueError:
      width = 2.4 if pedestrian else 8
    roads.append(
      {
        "id": rid(r),
        "geometry": mapping(clipped),
        "tags": t,
        "widthM": width,
        "widthStatus": "OSM width"
        if "width" in t
        else "explicit road-class display estimate",
      }
    )
  road_union = unary_union(
    [shape(r["geometry"]).buffer(r["widthM"] / 2 + 2.2) for r in roads]
  )
  buildings = []
  memorial = shape(sites[2]["geometry"])
  for _, r in areas.iterrows():
    t = tags_for(r)
    if not t.get("building") or r.geometry.area < 6:
      continue
    if r.geometry.distance(site_union) > 25 and r.geometry.distance(road_union) > 12:
      continue
    # Existing bodies stay wholly owned by their old chunks.
    if prior.intersection(r.geometry).area > 0.1:
      continue
    key = (
      "castle"
      if r.osm_way_id == "24315051"
      else "obelisk"
      if r.osm_way_id == "28685779"
      else "gate"
      if memorial.covers(r.geometry.representative_point())
      else "context"
    )
    buildings.append(
      {"id": rid(r), "key": key, "tags": t, "geometry": mapping(r.geometry)}
    )
  scope = (
    site_union.union(corridor)
    .union(road_union)
    .union(unary_union([shape(b["geometry"]) for b in buildings]))
  )
  extra = scope.difference(prior)
  records = []
  for _, r in areas[areas.intersects(scope)].iterrows():
    t = tags_for(r)
    if (
      t.get("landuse") not in {"grass", "forest"}
      and t.get("natural") not in {"wood", "water"}
      and t.get("leisure") not in {"garden", "playground", "pitch"}
    ):
      continue
    if r.geometry.area > 1_000_000:
      continue
    records.append(
      {"id": rid(r), "tags": t, "geometry": mapping(r.geometry.intersection(scope))}
    )
  walls = []
  for _, r in lines[lines.intersects(scope)].iterrows():
    t = tags_for(r)
    if t.get("barrier") not in {"wall", "retaining_wall", "fence"}:
      continue
    if t.get("barrier") == "retaining_wall" and r.geometry.distance(streams) > 20:
      continue
    walls.append(
      {"id": rid(r), "tags": t, "geometry": mapping(r.geometry.intersection(scope))}
    )
  markers = []
  for _, r in points[points.intersects(scope)].iterrows():
    t = tags_for(r)
    if (
      t.get("natural") == "tree"
      or t.get("historic") == "memorial"
      or t.get("amenity") == "bench"
    ):
      markers.append(
        {"id": "node/" + str(r.osm_id), "tags": t, "point": list(r.geometry.coords[0])}
      )
  targets = [b for b in buildings if b["key"] in {"castle", "gate"}]
  official = []
  archives = []
  for path in sorted(RAW.glob("LoD2*.zip")):
    archives.append(
      {
        "url": "https://gdi.berlin.de/data/a_lod2/atom/" + path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      }
    )
    with zipfile.ZipFile(path) as archive:
      for member in archive.namelist():
        if not member.endswith((".gml", ".xml")):
          continue
        with archive.open(member) as stream:
          for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            footprint = building_footprint(element)
            if footprint is not None:
              footprint = world(footprint)
              matches = [
                target
                for target in targets
                if footprint.intersection(shape(target["geometry"])).area
                > shape(target["geometry"]).area * 0.5
              ]
              if (
                matches
                and footprint.intersection(
                  unary_union([shape(t["geometry"]) for t in matches])
                ).area
                / max(0.01, footprint.area)
                > 0.5
              ):
                profiles = [
                  part_profile(p) for p in leaf_building_parts(element) or [element]
                ]
                official.append(
                  {
                    "id": element.get(GML_ID),
                    "osm": [t["id"] for t in matches],
                    "key": matches[0]["key"],
                    "footprint": mapping(footprint),
                    "parts": profiles,
                  }
                )
            element.clear()
  result = {
    "source": "Retained Geofabrik Berlin 2026-09-29, ODbL-1.0; official LoD2/DGM1 dl-de/zero-2-0",
    "sites": sites,
    "scope": mapping(scope),
    "newScope": mapping(extra),
    "priorScope": mapping(prior),
    "river": [
      {"id": rid(r), "geometry": mapping(r.geometry), "tags": t} for r, t in river
    ],
    "streams": mapping(streams),
    "roads": roads,
    "buildings": buildings,
    "land": records,
    "walls": walls,
    "markers": markers,
    "official": official,
    "lod2Sources": archives,
  }
  write(SOURCE, result)
  inverse = Transformer.from_crs(25833, 4326, always_xy=True).transform
  wgs = transform(inverse, affine_transform(scope, [1, 0, 0, -1, 389500, 5820000]))
  write(
    GEO / "bounds-north-parks-v198.geojson",
    {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {
            "revision": "v1.0.98",
            "areaM2": scope.area,
            "newAreaM2": extra.area,
            "scope": "Exact named park polygons and finite Panke/approach street strips; no full district",
          },
          "geometry": mapping(wgs),
        }
      ],
    },
  )
  print(
    "Extract",
    len(buildings),
    "buildings",
    len(official),
    "official",
    len(roads),
    "roads",
    len(markers),
    "markers",
    len(walls),
    "walls",
    extra.area,
    flush=True,
  )
  return result


def polylist(g):
  return [p for p in parts(g) if isinstance(p, Polygon) and p.area > 0.00001]


def footprint(g):
  return [
    {
      "ring": list(p.exterior.coords)[:-1],
      "holes": [list(r.coords)[:-1] for r in p.interiors],
    }
    for p in polylist(g)
  ]


def field_for(s):
  extent = shape(s["newScope"])
  prior = shape(s["priorScope"])
  w, n, e, b = extent.bounds
  step = 32
  w = math.floor(w / step) * step - step
  n = math.floor(n / step) * step - step
  e = math.ceil(e / step) * step + step
  b = math.ceil(b / step) * step + step
  archives = {}
  hashes = []
  for path in sorted(RAW.glob("DGM1*.zip")):
    code = path.stem.split("_")[1:]
    key = (int(code[0]) * 1000, int(code[1]) * 1000)
    with zipfile.ZipFile(path) as z:
      name = next(name for name in z.namelist() if name.endswith(".xyz"))
      archives[key] = np.loadtxt(z.open(name), usecols=2, dtype=np.float32).reshape(
        2000, 2000
      )
    hashes.append(
      {
        "url": "https://gdi.berlin.de/data/dgm1/atom/" + path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      }
    )

  def raw(x, z):
    east, north = x + 389500, 5820000 - z
    key = (math.floor(east / 2000) * 2000, math.floor(north / 2000) * 2000)
    if key not in archives:
      return None
    return (
      float(archives[key][math.floor(north - key[1]), math.floor(east - key[0])]) - 30
    )

  values = []
  water_values = []
  missing = []
  for z in range(n, b + 1, step):
    row = []
    water_row = []
    for x in range(w, e + 1, step):
      y = raw(x, z)
      if y is None:
        if extent.intersects(box(x - step, z - step, x + step, z + step)):
          missing.append((x, z))
        y = 3
      # Existing north190 is a flat display datum. Blend only the new strip,
      # never displace, cover or rewrite old source geometry.
      distance = max(0, prior.distance(Point(x, z)) - 46)
      t = min(1, distance / 64)
      weight = t * t * (3 - 2 * t)
      row.append(round(3 + (y - 3) * weight, 3))
      water_row.append(round(-1.15 + (y - 0.60 + 1.15) * weight, 3))
    values.append(row)
    water_values.append(water_row)
  if missing:
    raise ValueError(("Missing local DGM coverage", missing[:8]))
  paths = []
  for r in s["roads"]:
    pedestrian = r["tags"].get("highway") in {"footway", "path", "steps"}
    for line in parts(shape(r["geometry"])):
      if isinstance(line, LineString):
        for a, c in zip(list(line.coords)[:-1], list(line.coords)[1:], strict=True):
          paths.append(
            [
              *a,
              *c,
              r["widthM"] / 2,
              0.05 if pedestrian else 0.07,
              r["tags"].get("bridge") == "yes",
            ]
          )
  return {
    "paths": paths,
    "bounds": [w, n, e, b],
    "step": step,
    "heights": values,
    "waterHeights": water_values,
    "nativeStep": 16,
    "scope": footprint(extent),
    "waters": footprint(
      unary_union([shape(r["geometry"]) for r in s["river"]]).intersection(extent)
    ),
    "sources": hashes,
  }


def height(field, x, z, native=False, water=False):
  heights = field["waterHeights" if water else "heights"]
  if native:
    x = math.floor(x / 16) * 16 + 8
    z = math.floor(z / 16) * 16 + 8
  w, n, e, b = field["bounds"]
  u = (x - w) / 32
  v = (z - n) / 32
  ix = min(len(heights[0]) - 2, max(0, math.floor(u)))
  iz = min(len(heights) - 2, max(0, math.floor(v)))
  a = max(0, min(1, u - ix))
  c = max(0, min(1, v - iz))
  nw, ne = heights[iz][ix : ix + 2]
  sw, se = heights[iz + 1][ix : ix + 2]
  return (
    nw * (1 - a) + ne * (a - c) + se * c
    if a >= c
    else nw * (1 - c) + sw * (c - a) + se * a
  )


class Output:
  def __init__(self, native, field):
    self.native = native
    self.field = field
    self.cells = {}
    self.triangles = 0
    self.instances = 0

  def cell(self, x, z):
    key = f"{math.floor(x / 1024)}:{math.floor(z / 1024)}"
    if key not in self.cells:
      self.cells[key] = {
        "id": key,
        "positions": [],
        "colors": [],
        "indices": [],
        "boxes": [],
        "vertices": {},
      }
    return self.cells[key]

  def tri(self, points, color):
    if any(not math.isfinite(v) for p in points for v in p):
      raise ValueError(points)
    cell = self.cell(sum(p[0] for p in points) / 3, sum(p[2] for p in points) / 3)
    # Match the established display-byte convention of retained city ground.
    # Full-view screenshots previously reproduced the hand-linearised bytes
    # directly; no global renderer/material change is made here.
    rgb = [(color >> 16) & 255, (color >> 8) & 255, color & 255]
    for p in points:
      p = [round(float(v), 3) for v in p]
      key = tuple(p + rgb)
      index = cell["vertices"].get(key)
      if index is None:
        index = len(cell["positions"]) // 3
        cell["vertices"][key] = index
        cell["positions"].extend(p)
        cell["colors"].extend(rgb)
      cell["indices"].append(index)
    self.triangles += 1

  def quad(self, p, color):
    self.tri([p[0], p[1], p[2]], color)
    self.tri([p[0], p[2], p[3]], color)

  def put(self, x, y, z, w, h, d, color, yaw=0):
    if min(w, h, d) <= 0:
      return
    if self.native:
      if abs(yaw) > 1e-8:
        # Subdivide along the narrow facade axis instead of a broad rotated
        # bounding rectangle that could obstruct paths or cover real openings.
        count = max(1, math.ceil(w / 0.8))
        length = w / count
        for i in range(count):
          along = (i + 0.5) * length - w / 2
          self.put(
            x + math.cos(yaw) * along,
            y,
            z - math.sin(yaw) * along,
            max(0.16, abs(math.cos(yaw)) * length + abs(math.sin(yaw)) * d),
            h,
            max(0.16, abs(math.sin(yaw)) * length + abs(math.cos(yaw)) * d),
            color,
          )
        return
      row = [x, y, z, w, h, d, color]
    else:
      row = [x, y, z, w, h, d, yaw, color]
    self.cell(x, z)["boxes"].append(
      [round(v, 3) if isinstance(v, float) else v for v in row]
    )
    self.instances += 1

  def plan(self, geometry, color, offset=0, fixed=None, water=False):
    step = 16 if self.native else 32
    for poly in polylist(geometry):
      w, n, e, s = poly.bounds
      for z in range(math.floor(n / step) * step, math.ceil(s / step) * step, step):
        for x in range(math.floor(w / step) * step, math.ceil(e / step) * step, step):
          cut = poly.intersection(box(x, z, x + step, z + step))
          cuts = (
            [cut]
            if self.native
            else [
              cut.intersection(Polygon([(x, z), (x + step, z), (x + step, z + step)])),
              cut.intersection(Polygon([(x, z), (x + step, z + step), (x, z + step)])),
            ]
          )
          for g in cuts:
            for q in polylist(g):
              for t in constrained_delaunay_triangles(q).geoms:
                self.tri(
                  [
                    [
                      px,
                      (
                        fixed
                        if fixed is not None
                        else height(self.field, x + step / 2, z + step / 2, True, water)
                        if self.native
                        else height(self.field, px, pz, False, water)
                      )
                      + offset,
                      pz,
                    ]
                    for px, pz in list(t.exterior.coords)[:3]
                  ],
                  color,
                )

  def risers(self, geometry, color, offset):
    """Close only the existing raised pavement edge, without moving its top."""
    step = 16 if self.native else 32
    for poly in polylist(geometry):
      for ring in [poly.exterior, *poly.interiors]:
        points = list(ring.coords)
        for a, b in zip(points[:-1], points[1:], strict=True):
          cuts = {0.0, 1.0}
          coordinates = [(a[0], b[0]), (a[1], b[1])]
          if not self.native:
            coordinates.append((a[1] - a[0], b[1] - b[0]))
          for av, bv in coordinates:
            if abs(bv - av) < 1e-8:
              continue
            for edge in range(
              math.floor(min(av, bv) / step) * step,
              math.ceil(max(av, bv) / step) * step + 1,
              step,
            ):
              t = (edge - av) / (bv - av)
              if 0 < t < 1:
                cuts.add(t)
          cuts = sorted(cuts)
          for t0, t1 in zip(cuts[:-1], cuts[1:], strict=True):
            p = [a[k] + (b[k] - a[k]) * t0 for k in range(2)]
            q = [a[k] + (b[k] - a[k]) * t1 for k in range(2)]
            if self.native:
              y0 = y1 = height(self.field, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2, True)
            else:
              y0 = height(self.field, *p)
              y1 = height(self.field, *q)
            self.quad(
              [
                [p[0], y0, p[1]],
                [q[0], y1, q[1]],
                [q[0], y1 + offset, q[1]],
                [p[0], y0 + offset, p[1]],
              ],
              color,
            )

  def finish(self):
    for c in self.cells.values():
      del c["vertices"]
    return list(self.cells.values())


def build(s):
  field = field_for(s)
  write(ROOT / "src/app/src/data/northParksV198Terrain.json", field)
  extra = shape(s["newScope"])
  prior = shape(s["priorScope"])
  streams = shape(s["streams"])
  water = unary_union(
    polylist(
      unary_union([shape(r["geometry"]) for r in s["river"]]).intersection(extra)
    )
  )
  roads = [
    (
      r,
      shape(r["geometry"])
      .buffer(r["widthM"] / 2, cap_style=2, join_style=2)
      .intersection(extra),
    )
    for r in s["roads"]
  ]
  roads_union = unary_union([g for r, g in roads])
  building_union = unary_union([shape(b["geometry"]) for b in s["buildings"]])
  owners = {owner for p in s["official"] for owner in p["osm"]}
  native_heroes = []
  land_shapes = [
    (
      r,
      unary_union(polylist(shape(r["geometry"]).intersection(extra))).difference(water),
    )
    for r in s["land"]
  ]
  paved_mask = unary_union(
    polylist(
      unary_union(
        [
          g
          if r["tags"].get("highway") in {"footway", "path", "steps"}
          else g.buffer(1.6).intersection(extra)
          for r, g in roads
        ]
      )
    )
  ).difference(water)
  visible_land = []
  occupied = paved_mask
  for r, g in reversed(land_shapes):
    if g.is_empty:
      continue
    visible_land.append((r, g.difference(occupied)))
    occupied = occupied.union(g)
  base_land = extra.difference(water.union(occupied))
  # Authoritative walls/roof source sheets, individually retained in evidence.
  hero_source = []
  for model in s["official"]:
    for part in model["parts"]:
      for surface in part["surfaces"]:
        color = (
          (0x9A7662 if model["key"] == "castle" else 0x858276)
          if surface["kind"] == "RoofSurface"
          else (0xD7CFB7 if model["key"] == "castle" else 0x999487)
        )
        hero_source.append(
          {
            "triangles": triangles_for(surface["rings"]),
            "color": color,
            "owner": model["id"],
          }
        )
  from build_steglitz_v182 import native_blocks

  native_heroes = native_blocks({"surfaces": hero_source, "boxes": [], "rods": []})
  audit = {
    "sourceOwners": [m["id"] for m in s["official"]],
    "osmBuildings": len(s["buildings"]),
    "mappedTrees": sum(m["tags"].get("natural") == "tree" for m in s["markers"]),
    "representations": {},
    "estimates": [
      "OSM absent widths use explicit class widths; mapped 2D path positions remain unchanged.",
      "Unmeasured ordinary OSM buildings use source levels or restrained estimated heights; facade bays are schematic, not surveyed.",
      "New water is a0.60m display recess below the DGM bank field away from the seam, joining legacy waterY-1.15 independently.46m flat seam margin then64m new-side datum transition. Not a hydrological survey.",
      "Native terrain uses 16m horizontal terraces; wall/roof heroes independently voxelised at retained 1m exterior resolution.",
      "Unmapped forest canopy positions illustrate only sourced wooded/park polygons, with paths, buildings and water excluded.",
      "Obelisk total33.5m measured by primary authority; taper, bronze urn and sculptural recognition are explicitly visual estimates.",
    ],
    "counts": {},
  }
  navigation = {"context": [], "heroes": [], "nativeHeroBoxes": native_heroes}
  for model in s["official"]:
    for part in model["parts"]:
      poly = Polygon(part["ring"], part["holes"])
      roofs = [
        t
        for surface in part["surfaces"]
        if surface["kind"] == "RoofSurface"
        for t in triangles_for(surface["rings"])
      ]
      navigation["heroes"].append(
        {
          "id": model["id"],
          "footprint": footprint(poly),
          "bounds": list(poly.bounds),
          "base": part["ground_y_m"],
          "top": part["top_y_m"],
          "roofs": roofs,
        }
      )
  for native in [False, True]:
    out = Output(native, field)
    # Full original mapped outlines retained. Old north190 is never covered.
    out.plan(base_land, 0x71956D)
    for land, g in visible_land:
      t = land["tags"]
      color = (
        0x52734B
        if t.get("landuse") == "forest" or t.get("natural") == "wood"
        else 0x7C9965
        if t.get("landuse") == "grass"
        else 0x85976B
      )
      out.plan(g, color, 0.015)
    out.plan(water, 0x356B70, water=True)
    # Recessed earth/stone bank faces join the exact source water ring to DGM.
    for p in polylist(water):
      for ring in [p.exterior, *p.interiors]:
        points = list(ring.coords)
        for a, b in zip(points[:-1], points[1:], strict=True):
          cuts = {0.0, 1.0}
          if native:
            for axis in range(2):
              if abs(b[axis] - a[axis]) < 1e-8:
                continue
              for edge in range(
                math.floor(min(a[axis], b[axis]) / 16) * 16,
                math.ceil(max(a[axis], b[axis]) / 16) * 16 + 1,
                16,
              ):
                t = (edge - a[axis]) / (b[axis] - a[axis])
                if 0 < t < 1:
                  cuts.add(t)
          else:
            count = max(1, math.ceil(math.dist(a, b) / 8))
            cuts.update(i / count for i in range(count + 1))
          cuts = sorted(cuts)
          for t0, t1 in zip(cuts[:-1], cuts[1:], strict=True):
            p0 = [a[k] + (b[k] - a[k]) * t0 for k in range(2)]
            p1 = [a[k] + (b[k] - a[k]) * t1 for k in range(2)]
            if native:
              mid = [(p0[k] + p1[k]) / 2 for k in range(2)]
              y0 = y1 = height(field, *mid, True)
              w0 = w1 = height(field, *mid, True, True)
            else:
              y0 = height(field, *p0)
              y1 = height(field, *p1)
              w0 = height(field, *p0, False, True)
              w1 = height(field, *p1, False, True)
            out.quad(
              [
                [p0[0], y0, p0[1]],
                [p1[0], y1, p1[1]],
                [p1[0], w1, p1[1]],
                [p0[0], w0, p0[1]],
              ],
              0x7E8267,
            )
    # Exact road/path axes, bounded widths and continuous paved footpaths.
    for r, g in roads:
      pedestrian = r["tags"].get("highway") in {"footway", "path", "steps"}
      if not pedestrian:
        pavement = g.buffer(1.6).intersection(extra).difference(water)
        out.plan(pavement, 0xB6B3A4, 0.035)
        out.risers(pavement, 0xB6B3A4, 0.035)
      if r["tags"].get("bridge") != "yes":
        g = g.difference(water)
      out.plan(g, 0xA49B80 if pedestrian else 0x737876, 0.05 if pedestrian else 0.07)
      out.risers(g, 0xA49B80 if pedestrian else 0x737876, 0.05 if pedestrian else 0.07)
    for b in s["buildings"]:
      if b["id"] in owners or b["key"] == "obelisk":
        continue
      g = shape(b["geometry"])
      t = b["tags"]
      corners = [q for p in polylist(g) for q in p.exterior.coords]
      base = min(height(field, x, z, native) for x, z in corners)
      try:
        h = float(t.get("height", float(t.get("building:levels", 2)) * 3.1))
      except ValueError:
        h = 6.2
      h = max(2, min(h, 32))
      if not native:
        navigation["context"].append(
          {
            "id": b["id"],
            "footprint": footprint(g),
            "bounds": list(g.bounds),
            "base": base,
            "nativeBase": min(height(field, x, z, True) for x, z in corners),
            "height": h,
          }
        )
      seed = int(b["id"].split("/")[-1])
      color = [0xC9C0AB, 0xC0B8AC, 0xB8B1A1, 0xBBB0A2, 0xC4B9A8][seed % 5]
      if native:
        # Rasterise only this new OSM footprint, then merge full equal rows.
        for p in polylist(g):
          w, n, e, south = p.bounds
          for z in range(math.floor(n / 2) * 2, math.ceil(south / 2) * 2, 2):
            run = None
            for x in range(math.floor(w / 2) * 2, math.ceil(e / 2) * 2 + 2, 2):
              inside = p.covers(Point(x + 1, z + 1))
              if inside and run is None:
                run = x
              if not inside and run is not None:
                out.put((run + x) / 2, base + h / 2, z + 1, x - run, h, 2, color)
                out.put(
                  (run + x) / 2, base + h + 0.12, z + 1, x - run, 0.24, 2, 0x77716A
                )
                run = None
      else:
        out.plan(g, 0x77716A, 0, base + h)
        for p in polylist(g):
          for ring in [p.exterior, *p.interiors]:
            points = list(ring.coords)
            for a, bp in zip(points[:-1], points[1:], strict=True):
              out.quad(
                [
                  [a[0], base, a[1]],
                  [bp[0], base, bp[1]],
                  [bp[0], base + h, bp[1]],
                  [a[0], base + h, a[1]],
                ],
                color,
              )
              length = math.dist(a, bp)
              if length < 5:
                continue
              yaw = -math.atan2(bp[1] - a[1], bp[0] - a[0])
              dx, dz = (bp[0] - a[0]) / length, (bp[1] - a[1]) / length
              normal = Point(
                (a[0] + bp[0]) / 2 + dz * 0.3, (a[1] + bp[1]) / 2 - dx * 0.3
              )
              sign = -1 if g.covers(normal) else 1
              for floor in range(max(1, int(h / 3.1))):
                for j in range(max(1, int(length / 4))):
                  at = (j + 0.5) * length / max(1, int(length / 4))
                  x = a[0] + dx * at + dz * 0.025 * sign
                  z = a[1] + dz * at - dx * 0.025 * sign
                  out.put(
                    x, base + 1.9 + floor * 3.1, z, 1.05, 1.35, 0.06, 0x667779, yaw
                  )
    if native:
      for r in native_heroes:
        out.put(*r[:6], int(r[6]))
    else:
      for surface in hero_source:
        for triangle in surface["triangles"]:
          out.tri(triangle, surface["color"])
    # Measured palace walls receive small frame/recess accents only below eaves.
    for model in s["official"]:
      if model["key"] != "castle":
        continue
      g = shape(model["footprint"])
      for part in model["parts"]:
        for surface in part["surfaces"]:
          if surface["kind"] != "WallSurface":
            continue
          ring = surface["rings"][0]
          low = min(p[1] for p in ring)
          top = min((p[1] for p in ring if p[1] > low + 0.2), default=low)
          bottom = [p for p in ring if p[1] < low + 0.05]
          if len(bottom) != 2 or top - low < 5:
            continue
          a, b = bottom
          length = math.hypot(b[0] - a[0], b[2] - a[2])
          dx, dz = (b[0] - a[0]) / length, (b[2] - a[2]) / length
          yaw = -math.atan2(dz, dx)
          if length < 5:
            continue
          sign = (
            -1
            if g.covers(
              Point((a[0] + b[0]) / 2 + dz * 0.3, (a[2] + b[2]) / 2 - dx * 0.3)
            )
            else 1
          )
          for y in [low + 2.5, low + 6.4, low + 10.2]:
            if y + 1.1 > top:
              continue
            for j in range(max(1, round(length / 3.3))):
              at = (j + 0.5) * length / max(1, round(length / 3.3))
              x = a[0] + dx * at
              z = a[2] + dz * at
              out.put(
                x + dz * 0.13 * sign,
                y,
                z - dx * 0.13 * sign,
                1.32,
                2.04,
                0.20,
                0xE8E1CE,
                yaw,
              )
              out.put(
                x + dz * 0.25 * sign,
                y,
                z - dx * 0.25 * sign,
                1.03,
                1.78,
                0.06,
                0x65777A,
                yaw,
              )
              out.put(
                x + dz * 0.29 * sign,
                y,
                z - dx * 0.29 * sign,
                0.06,
                1.78,
                0.04,
                0xE8E1CE,
                yaw,
              )
    # Obelisk: source footprint, authoritative overall height, tapered shaft.
    monument = next(b for b in s["buildings"] if b["key"] == "obelisk")
    g = shape(monument["geometry"])
    p = g.centroid
    cx, cz = p.x, p.y
    base = height(field, cx, cz, native)
    out.put(cx, base + 0.5, cz, 10, 1, 10, 0x77776E)
    out.put(cx, base + 1.6, cz, 7.8, 1.2, 7.8, 0x5F625E)
    out.put(cx, base + 3.5, cz, 5.5, 2.6, 5.5, 0x666863)
    if native:
      for j in range(72):
        y = 4.8 + (j + 0.5) * 28.7 / 72
        w = (
          3.65 - (y - 4.8) / 26.6 * 1.75
          if y < 31.4
          else max(0.12, 1.9 * (33.5 - y) / 2.1)
        )
        out.put(cx, base + y, cz, w, 28.7 / 72, w, 0x9B9B8F)
    else:
      lower = [
        [cx - 1.825, base + 4.8, cz - 1.825],
        [cx + 1.825, base + 4.8, cz - 1.825],
        [cx + 1.825, base + 4.8, cz + 1.825],
        [cx - 1.825, base + 4.8, cz + 1.825],
      ]
      upper = [
        [cx - 0.95, base + 31.4, cz - 0.95],
        [cx + 0.95, base + 31.4, cz - 0.95],
        [cx + 0.95, base + 31.4, cz + 0.95],
        [cx - 0.95, base + 31.4, cz + 0.95],
      ]
      for i in range(4):
        out.quad([lower[i], lower[(i + 1) % 4], upper[(i + 1) % 4], upper[i]], 0x9B9B8F)
        out.tri([upper[i], upper[(i + 1) % 4], [cx, base + 33.5, cz]], 0xA6A69B)
    # The Mother figure stays at its mapped point; anatomy is an approximation,
    # no invented inscriptions or individual grave names.
    mother = next(m for m in s["markers"] if m["id"] == "node/2274670443")
    mx, mz = mother["point"]
    my = height(field, mx, mz, native)
    out.put(mx, my + 0.4, mz, 5, 0.8, 4, 0x595A55)
    out.put(mx, my + 2.6, mz, 1.8, 3.6, 1.3, 0x4C615A)
    out.put(mx, my + 4.7, mz, 0.84, 0.9, 0.84, 0x53675E)
    out.put(mx, my + 1.5, mz - 1.05, 3.7, 0.85, 1.15, 0x506158)
    # All mapped barrier alignments; brick colour only where the tag says brick.
    for wall in s["walls"]:
      original = shape(wall["geometry"])
      geom = (
        original if original.distance(streams) < 20 else original.intersection(extra)
      )
      t = wall["tags"]
      fence = t.get("barrier") == "fence"
      retaining = t.get("barrier") == "retaining_wall"
      color = (
        0x956F58
        if t.get("material") == "brick"
        else 0x919184
        if not fence
        else 0x66766C
      )
      for line in parts(geom):
        if not isinstance(line, LineString):
          continue
        points = list(line.coords)
        for a, b in zip(points[:-1], points[1:], strict=True):
          length = math.dist(a, b)
          count = max(1, math.ceil(length / 4))
          yaw = -math.atan2(b[1] - a[1], b[0] - a[0])
          for i in range(count):
            f = (i + 0.5) / count
            x = a[0] + (b[0] - a[0]) * f
            z = a[1] + (b[1] - a[1]) * f
            y = 3 if prior.covers(Point(x, z)) else height(field, x, z, native)
            if fence:
              out.put(x, y + 0.6, z, 0.09, 1.2, 0.09, color)
              out.put(x, y + 1, z, length / count, 0.06, 0.08, color, yaw)
            else:
              h = 0.85 if retaining else 1.45
              out.put(
                x,
                y + h / 2 - 0.18 if retaining else y + h / 2,
                z,
                length / count,
                h,
                0.3,
                color,
                yaw,
              )
              out.put(
                x,
                y + h - 0.18 if retaining else y + h,
                z,
                length / count,
                0.12,
                0.42,
                0xAEA995,
                yaw,
              )
    # Park trees: every mapped tree retained; additional canopy only in sourced
    # woodland, with deterministic spacing and all paths/water/buildings masked.
    trees = [
      m["point"]
      for m in s["markers"]
      if m["tags"].get("natural") == "tree" and extra.covers(Point(m["point"]))
    ]
    woods = unary_union(
      [
        shape(r["geometry"])
        for r in s["land"]
        if r["tags"].get("landuse") == "forest" or r["tags"].get("natural") == "wood"
      ]
    ).intersection(extra)
    mask = roads_union.buffer(3).union(water.buffer(3)).union(building_union.buffer(4))
    w, n, e, south = woods.bounds if not woods.is_empty else [0, 0, 0, 0]
    for x in range(math.floor(w / 28) * 28, math.ceil(e / 28) * 28, 28):
      for z in range(math.floor(n / 28) * 28, math.ceil(south / 28) * 28, 28):
        px = x + 7 * math.sin(x * 19 + z)
        pz = z + 7 * math.cos(z * 17 + x)
        if (
          woods.covers(Point(px, pz))
          and not mask.covers(Point(px, pz))
          and all(math.hypot(px - a, pz - b) > 8 for a, b in trees)
        ):
          trees.append([px, pz])
    for i, (x, z) in enumerate(trees):
      y = height(field, x, z, native)
      h = 7 + (i % 5) * 0.65
      out.put(x, y + h / 2, z, 0.33, h, 0.33, 0x766B54)
      if native:
        out.put(x, y + h, z, 4.8, 4.6, 4.8, 0x456C42)
        out.put(x, y + h + 2, z, 3.4, 2.0, 3.4, 0x527B45)
      else:
        radius = 2.6 + (i % 3) * 0.3
        bottom = [x, y + h - 2, z]
        top = [x, y + h + 3.7, z]
        ring = [
          [
            x + radius * math.cos(j * math.pi / 4),
            y + h + 0.6,
            z + radius * math.sin(j * math.pi / 4),
          ]
          for j in range(8)
        ]
        for j in range(8):
          out.tri([ring[j], ring[(j + 1) % 8], top], 0x527B45 + (i % 3) * 0x030200)
          out.tri([ring[(j + 1) % 8], ring[j], bottom], 0x456C42)
    # Native terrace skirts close the exposed vertical step edges; no terrain
    # body fill and no second displaced mountain.
    if native:
      for wet, ground, shade in [
        (False, extra.difference(water), 0x698761),
        (True, water, 0x356B70),
      ]:
        w, n, e, south = ground.bounds
        for axis in [0, 1]:
          start, end, low, high = (w, e, n, south) if axis == 0 else (n, south, w, e)
          for edge in range(
            math.ceil(start / 16) * 16, math.floor(end / 16) * 16 + 1, 16
          ):
            for along in range(
              math.floor(low / 16) * 16, math.ceil(high / 16) * 16, 16
            ):
              coords = (
                [(edge, along), (edge, along + 16)]
                if axis == 0
                else [(along, edge), (along + 16, edge)]
              )
              line = LineString(coords).intersection(ground)
              if line.is_empty:
                continue
              centers = (
                [(edge - 8, along + 8), (edge + 8, along + 8)]
                if axis == 0
                else [(along + 8, edge - 8), (along + 8, edge + 8)]
              )
              ys = [height(field, *p, True, wet) for p in centers]
              if abs(ys[0] - ys[1]) < 0.002:
                continue
              for linepart in parts(line):
                if not isinstance(linepart, LineString):
                  continue
                a, b = linepart.coords[0], linepart.coords[-1]
                out.quad(
                  [
                    [a[0], min(ys), a[1]],
                    [b[0], min(ys), b[1]],
                    [b[0], max(ys), b[1]],
                    [a[0], max(ys), a[1]],
                  ],
                  shade,
                )
    cells = out.finish()
    mode = "native" if native else "drawn"
    path = ROOT / f"src/app/src/data/northParksV198{mode.title()}.json"
    paths = [
      ROOT / f"src/app/src/data/northParksV198{mode.title()}{i}.json" for i in range(2)
    ]
    for i, p in enumerate(paths):
      write(
        p,
        {
          "cells": cells[
            i * math.ceil(len(cells) / 2) : (i + 1) * math.ceil(len(cells) / 2)
          ]
        },
      )
    if path.exists():
      path.unlink()
    audit["representations"][mode] = {
      "triangles": out.triangles,
      "instances": out.instances,
      "cells": len(cells),
      "finalGeometryBytes": sum(
        len(c["positions"]) * 4
        + len(c["colors"])
        + len(c["indices"]) * 4
        + len(c["boxes"]) * 76
        for c in cells
      ),
      "sourceBytes": sum(p.stat().st_size for p in paths),
      "files": [
        {"name": p.name, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
        for p in paths
      ],
    }
    audit["counts"][mode] = {
      "trees": len(trees),
      "officialParents": len(s["official"]),
      "mappedWaterPolygons": len(s["river"]),
      "graveChambersAuthoritative": 16,
    }
    print(mode, audit["representations"][mode], flush=True)
  navigation["obelisk"] = {
    "point": [cx, cz],
    "base": height(field, cx, cz),
    "nativeBase": height(field, cx, cz, True),
    "height": 33.5,
  }
  write(ROOT / "src/app/src/data/northParksV198Buildings.json", navigation)
  audit["priorScopeHashes"] = [
    {"path": p, "sha256": hashlib.sha256((GEO / p).read_bytes()).hexdigest()}
    for p in OLD
  ]
  audit["panke"] = {
    "mappedCourseLengthM": streams.length,
    "retainedCourseLengthM": streams.intersection(prior).length,
    "addedCourseLengthM": streams.difference(prior).length,
    "retainedBarrierIds": [
      w["id"]
      for w in s["walls"]
      if shape(w["geometry"]).distance(streams) < 20
      and not shape(w["geometry"]).intersection(prior).is_empty
    ],
  }
  audit["scopeAreaM2"] = extra.area
  audit["terrainSources"] = field["sources"]
  write(GEO / "north-parks-v198-evidence.json", audit)


if __name__ == "__main__":
  import sys

  source = (
    extract()
    if "--extract" in sys.argv or not SOURCE.exists()
    else json.loads(SOURCE.read_text())
  )
  build(source)
