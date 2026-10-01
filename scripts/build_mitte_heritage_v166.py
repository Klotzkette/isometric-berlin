"""Step 10: source-bound Mitte parks, cemeteries and historical buildings.

Bounded OSM selection, complete surveyed parents, offline native skins. No
protected map/plan or photographic texture is included in the viewer.
"""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile

import geopandas as gpd
import numpy as np
import pandas as pd
from build_bebelplatz_building_source import part_profile
from build_breitscheid_towers_v161 import normal_of, triangles_for
from build_surrounding_outlines import ROOT, load_projected_polygon, tags_for, world
from build_zoo_grounds_v165 import native_rows, polygon_parts, sample_triangles
from shapely.geometry import LineString, Polygon, box, mapping
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

RAW = ROOT / "geo_data/regierungsviertel/raw/outer-v159"
DEST = ROOT / "src/app/src/data/mitteHeritageV166Source.json"
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
PARK_IDS = {"104954713", "340138573", "1089402877", "16573560", "25335920", "449835634"}
HERO_IDS = {"33791235": "jandorf", "27214404": "elisabeth", "46990778": "villa"}
BBOX = (13.382, 52.521, 13.410, 52.538)


def identity(row: pd.Series) -> str:
  """OGR separates relation identities from simple polygon way identities."""
  return str(row.osm_id) if pd.notna(row.osm_id) else str(row.osm_way_id)


def facade(rings: list, ground: float, kind: str) -> list:
  """Clipped glazing and restrained historical divisions; no surveyed bays claimed."""
  normal = normal_of(rings[0])
  if abs(normal[1]) > 0.03:
    return []
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda ab: math.hypot(ab[0][0] - ab[1][0], ab[0][2] - ab[1][2]),
  )
  base = np.array(a)
  d = np.array([b[0] - a[0], 0, b[2] - a[2]], float)
  length = np.linalg.norm(d)
  if length < 1.5:
    return []
  d /= length
  coords = [[(float(np.dot(np.array(p) - base, d)), p[1]) for p in r] for r in rings]
  poly = Polygon(coords[0], coords[1:]).buffer(0)
  rows = []
  yaw = math.atan2(-d[2], d[0])

  def emit(
    u: float,
    y: float,
    w: float,
    h: float,
    c: int,
    out: float = 0.11,
    depth: float = 0.14,
  ) -> None:
    if not poly.buffer(-0.02).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
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
        c,
      ]
    )

  if kind == "elisabeth":
    # Two rows of horizontal side windows; the front is reserved for its portico.
    if length < 23:
      return []
    for y in [ground + 3.2, ground + 8.1]:
      for u in np.linspace(3, length - 3, 6):
        emit(u, y, 2.8, 1.55, 0xB7AA90, 0.08, 0.2)
        emit(u, y, 2.42, 1.20, 0x485453, 0.19)
        emit(u, y, 0.08, 1.20, 0xC6BBA5, 0.24)
    return rows
  spacing = 4.25 if kind == "jandorf" else 3.7
  bays = max(1, round(length / (2.1 if kind == "jandorf" else 3.1)))
  pitch = length / bays
  for floor in range(9):
    y = ground + 2.4 + floor * spacing
    for i in range(bays):
      u = (i + 0.5) * pitch
      w = pitch * (0.73 if kind == "jandorf" else 0.49)
      h = 3.15 if kind == "jandorf" else 1.9
      emit(u, y, w + 0.24, h + 0.27, 0xB4A789, 0.07, 0.24)
      emit(u, y, w, h, 0x536865, 0.18)
      emit(u, y, 0.07, h, 0xCFCCB7, 0.23)
      emit(u, y + h * 0.12, w, 0.08, 0xCDC9B2, 0.24)
      emit(u, y - h / 2 - 0.13, w + 0.35, 0.15, 0xCCC0A5, 0.26, 0.32)
      if kind == "jandorf":
        emit(u + pitch / 2 - 0.08, y, 0.15, spacing - 0.12, 0xB8AE94, 0.18, 0.3)
        for k in [-0.28, 0, 0.28]:
          emit(u + k * w, y + h / 2 + 0.22, 0.10, 0.3, 0x9B907A, 0.21)
    emit(
      length / 2,
      ground + (floor + 1) * spacing - 0.04,
      length - 0.08,
      0.18,
      0xB7AB92,
      0.2,
      0.3,
    )
  return rows


def build() -> dict:
  """Capture complete source footprints, paths, graves and leaf surfaces."""
  frame = gpd.read_file(
    RAW / "candidate.gpkg", layer="multipolygons", bbox=BBOX
  ).to_crs(25833)
  frame.geometry = frame.geometry.map(world)
  frame["identity"] = frame.apply(identity, axis=1)
  core = world(
    load_projected_polygon(ROOT / "geo_data/regierungsviertel/bounds-v158.geojson")
  )
  parks = [
    {
      "id": r.identity,
      "name": tags_for(r).get("name", ""),
      "geometry": mapping(r.geometry),
      "shape": r.geometry,
    }
    for _, r in frame.iterrows()
    if r.identity in PARK_IDS
  ]
  area = unary_union([p["shape"] for p in parks])
  targets = []
  for _, r in frame.iterrows():
    t = tags_for(r)
    if t.get("building") and (
      r.identity in HERO_IDS or area.covers(r.geometry.representative_point())
    ):
      targets.append(
        {
          "id": r.identity,
          "name": t.get("name", ""),
          "kind": HERO_IDS.get(
            r.identity, "chapel" if t["building"] == "chapel" else "parkhouse"
          ),
          "shape": r.geometry,
          "tags": t,
        }
      )
  parents = []
  parts = []
  surfaces = []
  facades = []
  cells = {}
  for tile in ["390_5820", "390_5821", "391_5820", "391_5821"]:
    path = RAW.parent / "lod2" / f"LoD2_{tile}.zip"
    with zipfile.ZipFile(path) as z:
      tree = ET.fromstring(z.read(z.namelist()[0]))
    for parent in tree.findall(".//b:Building", NS):
      gs = []
      for s in parent.findall(".//b:GroundSurface//g:Polygon", NS):
        rings = []
        for e in s.findall(".//g:posList", NS):
          v = list(map(float, e.text.split()))
          rings.append(
            [(v[i] - 389500, 5820000 - v[i + 1]) for i in range(0, len(v), 3)]
          )
        if rings:
          gs.append(Polygon(rings[0], rings[1:]).buffer(0))
      shape = unary_union(gs)
      if shape.is_empty:
        continue
      matches = [
        t
        for t in targets
        if t["shape"].intersection(shape).area > min(10, t["shape"].area * 0.15)
      ]
      if not matches:
        continue
      match = max(matches, key=lambda t: t["shape"].intersection(shape).area)
      kind = match["kind"]
      raw = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
      ground = 5.2 if core.covers(shape.representative_point()) else 3.0
      offset = ground - min(p["ground_y_m"] for p in raw)
      pid = parent.get("{" + NS["g"] + "}id")
      parents.append(
        {
          "id": pid,
          "osm": match["id"],
          "name": match["name"],
          "kind": kind,
          "groundY": ground,
          "displayOffsetY": round(offset, 3),
          "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/" + path.name,
          "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
          "sourceParts": raw,
        }
      )
      for original in raw:
        p = json.loads(json.dumps(original))
        p.update(parentId=pid, kind=kind)
        p["ground_y_m"] = round(p["ground_y_m"] + offset, 3)
        p["top_y_m"] = round(p["top_y_m"] + offset, 3)
        for s in p["surfaces"]:
          for ring in s["rings"]:
            for q in ring:
              q[1] = round(q[1] + offset, 3)
          color = (
            0x77766A
            if s["kind"] == "RoofSurface"
            else (
              0xC0B69C
              if kind == "jandorf"
              else 0xDED7BF
              if kind == "elisabeth"
              else 0xB8A287
            )
          )
          ts = triangles_for(s["rings"])
          surfaces.append(
            {"partId": p["id"], "kind": s["kind"], "color": color, "triangles": ts}
          )
          sample_triangles(cells, ts, color)
          if s["kind"] == "WallSurface":
            facades.extend(facade(s["rings"], ground, kind))
        parts.append(p)
  occupied = unary_union(
    [r.geometry for _, r in frame.iterrows() if tags_for(r).get("building")]
  )
  points = gpd.read_file(
    RAW / "berlin-260929.osm.pbf", layer="points", bbox=BBOX
  ).to_crs(25833)
  points.geometry = points.geometry.map(world)
  props = []
  for _, r in points.iterrows():
    if not area.buffer(2).covers(r.geometry):
      continue
    t = tags_for(r)
    if (
      t.get("amenity") in ["bench", "drinking_water"]
      or t.get("historic") in ["tomb", "memorial"]
      or t.get("tourism") == "artwork"
      or t.get("cemetery") == "grave"
      or t.get("playground")
      or t.get("natural") == "tree"
    ):
      props.append(
        {
          "id": str(r.osm_id),
          "x": round(r.geometry.x, 3),
          "z": round(r.geometry.y, 3),
          "y": 5.2 if core.covers(r.geometry) else 3.0,
          "tags": t,
        }
      )
  lines = gpd.read_file(RAW / "candidate.gpkg", layer="lines", bbox=BBOX).to_crs(25833)
  lines.geometry = lines.geometry.map(world)
  paths = []
  barriers = []
  for _, r in lines.iterrows():
    t = tags_for(r)
    g = r.geometry.intersection(area)
    if g.is_empty:
      continue
    for line in getattr(g, "geoms", [g]):
      if line.geom_type != "LineString" or line.length < 0.1:
        continue
      record = {
        "id": str(r.osm_id),
        "line": [[round(x, 3), round(z, 3)] for x, z in line.coords],
        "tags": t,
        "groundY": 5.2 if core.covers(line.representative_point()) else 3.0,
      }
      if t.get("highway") in [
        "footway",
        "path",
        "pedestrian",
        "steps",
        "cycleway",
        "service",
      ]:
        w = t.get("width", "3" if t["highway"] == "service" else "2")
        try:
          w = float(w)
        except ValueError:
          w = 2
        paths.append(record | {"width": max(0.65, min(8, w))})
      if t.get("barrier") in ["fence", "wall", "hedge"]:
        barriers.append(record)
  path_area = (
    unary_union(
      [LineString(p["line"]).buffer(p["width"] / 2, quad_segs=8) for p in paths]
    )
    .intersection(area)
    .difference(occupied)
  )
  waters = []
  beds = []
  graves = []
  for _, r in frame.iterrows():
    t = tags_for(r)
    p = r.geometry
    if not area.covers(p.representative_point()):
      continue
    if (
      t.get("natural") == "water"
      or t.get("leisure") == "swimming_pool"
      or t.get("amenity") == "fountain"
    ):
      waters.append(p)
    if t.get("landuse") == "flowerbed" or t.get("leisure") in [
      "garden",
      "playground",
      "pitch",
    ]:
      beds.append(
        {"id": r.identity, "kind": t.get("leisure", "flowerbed"), "shape": p, "tags": t}
      )
    if (
      t.get("historic") == "tomb"
      or t.get("cemetery") == "grave"
      or t.get("landuse") == "cemetery_sector"
    ):
      graves.append({"id": r.identity, "tags": t, "geometry": mapping(p)})
  water = unary_union(waters).difference(occupied)
  path_area = path_area.difference(water)
  ground_surfaces = []
  ground_runs = []
  ground_polygons = []

  def ground(shape: object, kind: str, color: int, raise_y: float) -> None:
    for zone, base in [(shape.intersection(core), 5.2), (shape.difference(core), 3.0)]:
      for p in polygon_parts(zone):
        rings = [list(p.exterior.coords)[:-1]] + [
          list(h.coords)[:-1] for h in p.interiors
        ]
        y = base + raise_y
        ground_polygons.append(
          {"kind": kind, "rings": rings, "y": y, "area": round(p.area, 3)}
        )
        ground_surfaces.append(
          {
            "kind": kind,
            "color": color,
            "triangles": triangles_for([[[x, y, z] for x, z in r] for r in rings]),
          }
        )
        x0, z0, x1, z1 = p.bounds
        for z in range(math.floor(z0), math.ceil(z1)):
          row = p.intersection(LineString([(x0 - 1, z + 0.5), (x1 + 1, z + 0.5)]))
          for seg in getattr(row, "geoms", [row]):
            if seg.geom_type != "LineString" or seg.is_empty:
              continue
            a, _, b, _ = seg.bounds
            start, end = math.ceil(a - 0.5), math.floor(b - 0.5)
            if end >= start:
              ground_runs.append(
                [
                  (start + end + 1) / 2,
                  round(y - 0.05, 3),
                  z + 0.5,
                  end - start + 1,
                  0.1,
                  1,
                  color,
                ]
              )

  # Ground surfacing remains additive; no original roads, trees or parcels removed.
  ground(
    path_area.buffer(0.14)
    .difference(path_area)
    .intersection(area)
    .difference(occupied.union(water)),
    "path edging",
    0xD0CAB7,
    0.28,
  )
  ground(path_area, "mapped paths", 0xBEB6A0, 0.26)
  ground(water, "mapped water", 0x5B929B, 0.25)
  for b in beds:
    ground(
      b["shape"].difference(path_area.union(water).union(occupied)),
      b["kind"],
      0x987E6F
      if b["kind"] == "pitch"
      else 0xC1B58C
      if b["kind"] == "playground"
      else 0x74936C,
      0.23,
    )
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  full = unary_union([Polygon(p["ring"], p["holes"]).buffer(0) for p in parts])
  legacy = [
    p
    for p in prisms
    if p["id"] in {"95341742", "53332485", "53257435"}
    or (lambda g: g.area > 0 and full.intersection(g).area / g.area > 0.96)(
      Polygon(
        [(x / 10, z / 10) for x, z in p["ring"]],
        [[[x / 10, z / 10] for x, z in h] for h in p["holes"]],
      ).buffer(0)
    )
  ]
  outer = gpd.read_file(RAW / "resolved-outlines.gpkg", layer="buildings")
  outerids = set(outer.sourceId)
  return {
    "parents": parents,
    "parts": parts,
    "surfaces": surfaces,
    "facadeBoxes": facades,
    "nativeRows": native_rows(cells),
    "parks": [{k: v for k, v in p.items() if k != "shape"} for p in parks],
    "paths": paths,
    "barriers": barriers,
    "props": props,
    "graves": graves,
    "groundSurfaces": ground_surfaces,
    "groundRuns": ground_runs,
    "groundPolygons": ground_polygons,
    "legacyPrisms": legacy,
    "outerOwners": [p["id"] for p in parents if p["id"] in outerids],
    "sourceStatus": "OSM Sept 29 2026 courses and tagged individual objects. All source LoD2 parts retained at shared parent datum. Ground heights remain existing scene datum, not a new terrain survey. Untagged path widths, facade divisions, tree crowns and grave/bench dimensions are procedural display estimates; no unrecorded grave fields fabricated.",
  }


def main() -> None:
  data = build()
  evidence = {
    k: data[k]
    for k in [
      "parents",
      "parts",
      "parks",
      "paths",
      "barriers",
      "props",
      "graves",
      "groundPolygons",
      "legacyPrisms",
      "outerOwners",
      "sourceStatus",
    ]
  }
  DEST.with_name("mitteHeritageV166Evidence.json").write_text(
    json.dumps(evidence, separators=(",", ":")) + "\n"
  )
  data["parents"] = [
    {k: v for k, v in p.items() if k != "sourceParts"} for p in data["parents"]
  ]
  data["parts"] = [
    {k: v for k, v in p.items() if k != "surfaces"} for p in data["parts"]
  ]
  del data["groundPolygons"]
  nav = {k: data[k] for k in ["parts", "legacyPrisms", "outerOwners"]}
  nav["roofTriangles"] = [
    t for s in data["surfaces"] if s["kind"] == "RoofSurface" for t in s["triangles"]
  ]
  nav["nativeRoofRuns"] = [
    [x - w / 2, x + w / 2, math.floor(z), y + h / 2]
    for x, y, z, w, h, d, c in data["nativeRows"]
  ]
  DEST.with_name("mitteHeritageV166Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  DEST.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  print({k: len(v) for k, v in data.items() if isinstance(v, list)})
  print("bytes", DEST.stat().st_size)


if __name__ == "__main__":
  main()
