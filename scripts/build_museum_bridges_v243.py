"""Three exact core bridge owners; no packet, terrain or v242 data mutation.

Mapped complete plans and road tags are retained. Heritage records constrain
span counts, materials and ornament types. All unsurveyed sections, sculpture
silhouettes, camber and paint placement remain explicit display estimates.
"""

from __future__ import annotations

import argparse
import base64
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import shapely
from shapely.geometry import LineString, Point, Polygon, mapping, shape
from shapely.ops import substring, unary_union

from isometric_berlin.data.fetch_lod2 import polygons_from_geometry
from isometric_berlin.generation.road_geometry import road_width_m, road_width_source
from scripts.build_spree_bridges_v242 import (
  ASPHALT,
  CURB,
  PAINT,
  PAVING,
  components,
  digest,
  extrusion,
  raster,
  read,
  write,
)
from scripts.build_surrounding_outlines import (
  PackedMesh,
  line_parts,
  navigation_polygons,
  polygonal,
  tags_for,
  world,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "museum-bridges-v243-source.json"
PREVIOUS = DATA / "museumBridgePreviousV243.json"
OUTPUT = DATA / "museumBridgesV243.json"
EVIDENCE = GEO / "museum-bridges-v243-evidence.json"
OWNERS = {"339201218": "09030067", "339201179": "09030062", "339201216": "09030072"}
STONE, GRANITE, MARBLE = (190, 181, 158), (160, 105, 89), (235, 231, 214)
IRON, BRONZE, ALUMINIUM = (54, 70, 69), (104, 110, 83), (153, 161, 159)


def extract() -> None:
  cache = GEO / "raw/outskirts-v187/candidate.gpkg"
  bridges = []
  for layer in ("lines", "multipolygons"):
    for _, row in (
      gpd.read_file(cache, layer=layer, where="man_made='bridge'")
      .to_crs(25833)
      .iterrows()
    ):
      tags = tags_for(row)
      owner = str(tags.get("osm_way_id") or tags.get("osm_id"))
      if owner not in OWNERS:
        continue
      geometry = world(row.geometry)
      if geometry.geom_type == "LineString":
        assert geometry.is_ring
        geometry = Polygon(geometry)
      bridges.append(
        dict(
          id=owner,
          name=tags["name"],
          tags=tags,
          geometry=mapping(geometry),
          roads=[],
          reference="https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr="
          + OWNERS[owner],
        )
      )
  assert {b["id"] for b in bridges} == set(OWNERS)
  roads = gpd.read_file(
    cache, layer="lines", where="highway IS NOT NULL AND other_tags LIKE '%\"bridge\"%'"
  ).to_crs(25833)
  for _, row in roads.iterrows():
    tags = tags_for(row)
    if tags.get("bridge", "no") in ("no", "false", "0"):
      continue
    geometry = world(row.geometry)
    for bridge in bridges:
      if geometry.intersection(shape(bridge["geometry"])).length < 4:
        continue
      bridge["roads"].append(
        dict(
          id=str(row.osm_id),
          tags=tags,
          geometry=mapping(geometry),
          width=road_width_m(tags),
          widthSource=road_width_source(tags),
        )
      )
  write(
    SOURCE,
    dict(
      schemaVersion=1,
      sourceFile=str(cache.relative_to(ROOT)),
      sourceSha256=digest(cache),
      source="Retained OpenStreetMap / Geofabrik Berlin 2026-09-29",
      license="ODbL-1.0",
      bridges=bridges,
      groundSha256=digest(
        ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
      ),
      previousSha256=digest(PREVIOUS),
      interpretation="Complete mapped outlines/axes and tagged lane counts. LDA: Schloß three masonry arches, eight paired marble figure groups on red granite plinths, cast iron rails; Eiserne one iron arch faced in limestone, masonry parapets with bronze openwork; Schleusen steel beam, wrought iron wave/windrose rail with eight aluminium-copy medallions. All ornament subdivision, statue silhouettes, vertical dimensions and marking intervals are estimates, not measured replicas.",
    ),
  )


def plans(bridge: dict, native: bool) -> dict:
  c = components(bridge, False)
  # The old width-radius endpoint exclusion erases every curb on these short
  # crossings. Keep only longitudinal road/footway boundaries instead; never
  # place a transverse kerb across either open bridge approach.
  aa, bb = list(c["axis"].coords)[0], list(c["axis"].coords)[-1]
  length = math.dist(aa, bb)
  ux, uz = (bb[0] - aa[0]) / length, (bb[1] - aa[1]) / length
  shared = c["road"].boundary.intersection(c["walks"].boundary)
  long_edges = []
  for line in line_parts(shared):
    for a, b in zip(line.coords, list(line.coords)[1:]):
      d = math.dist(a, b)
      if d > 0.05 and abs((b[0] - a[0]) * ux + (b[1] - a[1]) * uz) / d > 0.68:
        long_edges.append(LineString([a, b]))
  c["curbs"] = (
    unary_union(long_edges).buffer(0.11, cap_style=2).intersection(c["outline"])
  )
  # Positive lane evidence only. Bicycle strips occupy part of the tagged
  # carriageway width; do not split that whole width into motor lanes.
  paint = []
  for road in bridge["roads"]:
    tags, width = road["tags"], road["width"]
    if not width or tags.get("lanes") != "2":
      continue
    axis = shape(road["geometry"])
    right = float(tags.get("cycleway:right:width", tags.get("cycleway:both:width", 0)))
    left = float(tags.get("cycleway:left:width", tags.get("cycleway:both:width", 0)))
    # World Z is south: OSM right is positive offset_curve in this frame.
    for offset in (
      [width / 2 - right]
      if right and not left
      else [-width / 2 + left, width / 2 - right]
      if left and right
      else []
    ):
      paint.extend(
        line.buffer(0.065, cap_style=2)
        for line in line_parts(axis.offset_curve(offset))
      )
    separator = (left - right) / 2
    for line in line_parts(axis.offset_curve(separator)):
      for start in np.arange(1.0, line.length, 7.0):
        segment = substring(line, start, min(start + 2.5, line.length))
        if segment.geom_type == "LineString":
          paint.append(segment.buffer(0.065, cap_style=2))
  c["paint"] = unary_union(paint).intersection(c["road"])
  if native:
    c["outline"] = raster(c["outline"])
    c["road"] = raster(c["road"]).intersection(c["outline"])
    c["walks"] = c["outline"].difference(c["road"])
    c["curbs"] = raster(c["curbs"].buffer(0.08), 0.25).intersection(c["outline"])
    c["paint"] = (
      raster(c["paint"].buffer(0.07), 0.25).intersection(c["road"])
      if paint
      else Polygon()
    )
  return c


def build_bridge(bridge: dict, receipt: dict, native: bool) -> dict:
  c = plans(bridge, native)
  ox, oz = [math.floor(v - 2) for v in c["outline"].bounds[:2]]
  mesh = PackedMesh(ox, oz)
  floors, solids = [], []
  cx, cz = receipt["center"]
  ax, az = receipt["axis"]
  half = receipt["halfLength"]
  base = receipt["baseY"]
  owner = bridge["id"]
  is_schloss = owner == "339201218"
  spans = 3 if is_schloss else 1
  arch = owner != "339201216"
  aa, bb = list(c["axis"].coords)[0], list(c["axis"].coords)[-1]
  length = math.dist(aa, bb)
  ux, uz = (bb[0] - aa[0]) / length, (bb[1] - aa[1]) / length

  def at(u: float, v: float) -> tuple:
    return aa[0] + ux * u - uz * v, aa[1] + uz * u + ux * v

  def band(a: float, b: float) -> Polygon:
    return Polygon([at(a, -100), at(b, -100), at(b, 100), at(a, 100)])

  def height(x: float, z: float) -> float:
    t = max(-half, min(half - 1e-8, (x - cx) * ax + (z - cz) * az))
    step = max(0, min(13, int((t + half) / (2 * half) * 14)))
    u = -half + (step + 0.5) * half / 7
    y = base + 0.5 * math.cos(u / half * math.pi / 2) ** 2
    return round(y * 4) / 4 if native else y

  def nav(p, low: float, high: float | None = None) -> None:
    rows = navigation_polygons(shapely.set_precision(polygonal(p), 0.01), ox, oz)
    if high is None:
      floors.extend(dict(**r, y=round(low, 3)) for r in rows)
    else:
      solids.extend(dict(**r, low=round(low, 3), high=round(high, 3)) for r in rows)

  assigned = Polygon()
  outer_edge = c["outline"].boundary.buffer(1e-7)
  for i in range(14):
    a, b = -half + i * half / 7, -half + (i + 1) * half / 7

    def point(u, v):
      return cx + ax * u - az * v, cz + az * u + ax * v

    clip = c["outline"].intersection(
      Polygon(
        [
          point(-100 if i == 0 else a, -100),
          point(100 if i == 13 else b, -100),
          point(100 if i == 13 else b, 100),
          point(-100 if i == 0 else a, 100),
        ]
      )
    )
    if native:
      clip = raster(clip).intersection(c["outline"]).difference(assigned)
      assigned = assigned.union(clip)
    clip = polygonal(clip)
    if clip.is_empty:
      continue
    center = point((a + b) / 2, 0)
    y = height(*center)

    def underside(x, z):
      t = (
        max(0, min(1 - 1e-8, ((x - aa[0]) * ux + (z - aa[1]) * uz) / length))
        * spans
        % 1
      )
      return y - 0.55 - (1.6 * (abs(t - 0.5) * 2) ** 2 if arch else 0.28)

    bottom = math.floor(underside(clip.centroid.x, clip.centroid.y) * 4) / 4
    for p in polygons_from_geometry(clip):
      for tri in shapely.constrained_delaunay_triangles(p).geoms:
        mesh.triangle(
          [
            (x, bottom if native else underside(x, z), z)
            for x, z in list(tri.exterior.coords)[:3]
          ],
          STONE,
        )
      for line in line_parts(p.boundary):
        for p0, p1 in zip(line.coords, list(line.coords)[1:]):
          low0, low1 = (bottom, bottom) if native else (underside(*p0), underside(*p1))
          # Camber segmentation is not a stone stripe across the carriageway.
          # Keep all geometry; only the actual outline receives stone fascia.
          tone = STONE if outer_edge.covers(LineString([p0, p1])) else ASPHALT
          mesh.triangle(
            [(p0[0], low0, p0[1]), (p1[0], low1, p1[1]), (p1[0], y, p1[1])], tone
          )
          mesh.triangle(
            [(p0[0], low0, p0[1]), (p1[0], y, p1[1]), (p0[0], y, p0[1])], tone
          )
    mesh.surface(clip, y, ASPHALT)
    nav(clip, y)
    for key, top, tone in [("walks", y + 0.14, PAVING), ("curbs", y + 0.16, CURB)]:
      area = c[key].intersection(clip)
      extrusion(mesh, area, y, top, tone)
      nav(area, top)
    paint = c["paint"].intersection(clip)
    mesh.surface(paint, y + 0.025, PAINT)
    nav(paint, y + 0.025)
  # Actual span division, with supported end bands; the plate is never floating.
  for u in [0, length, *([length / 3, 2 * length / 3] if is_schloss else [])]:
    p = band(u - 0.7, u + 0.7).intersection(c["outline"])
    if native:
      p = raster(p).intersection(c["outline"])
    extrusion(mesh, p, -1.25, base - 0.5, STONE)

  def fit(p, y0, y1, tone, solid=False):
    if native:
      p = raster(p, 0.25)
    extrusion(mesh, p, y0, y1, tone)
    if solid:
      nav(p, y0, y1)

  def rect(x, z, w, d):
    return Polygon(
      [
        (x + ux * u - uz * v, z + uz * u + ux * v)
        for u, v in [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
      ]
    )

  # Split only along real long edges; both approach ends remain open. A single
  # full-height narrow rail collision strip matches their barrier function.
  for edge in c["lateral"]:
    count = max(1, math.ceil(edge.length / 0.9))
    for i in range(count):
      p0, p1 = (
        edge.interpolate(i / count, normalized=True),
        edge.interpolate((i + 1) / count, normalized=True),
      )
      line = LineString([p0, p1])
      y = height(line.centroid.x, line.centroid.y) + 0.14
      if owner == "339201179":
        fit(line.buffer(0.23, cap_style=2), y, y + 0.22, STONE)
        fit(line.buffer(0.23, cap_style=2), y + 1.00, y + 1.13, STONE)
        fit(p0.buffer(0.19, quad_segs=1), y, y + 1.13, STONE)
        # Bronze rectangular openwork panel; the void remains visible.
        fit(line.buffer(0.055, cap_style=2), y + 0.35, y + 0.42, BRONZE)
        fit(line.buffer(0.055, cap_style=2), y + 0.86, y + 0.92, BRONZE)
        fit(
          line.interpolate(0.5, normalized=True).buffer(0.06, quad_segs=1),
          y + 0.35,
          y + 0.92,
          BRONZE,
        )
      else:
        for low, high in [(0.18, 0.25), (1.02, 1.10)]:
          fit(line.buffer(0.055, cap_style=2), y + low, y + high, IRON)
        fit(p0.buffer(0.07, quad_segs=1), y, y + 1.12, IRON)
        # Fine middle curves suggest Schinkel marine motifs / Schleusen waves;
        # they are bounded recognition strokes, not invented heraldic replicas.
        for j in range(4):
          q = line.interpolate((j + 0.5) / 4, normalized=True)
          fit(
            q.buffer(0.055, quad_segs=1),
            y + 0.38 + 0.18 * math.sin(j * math.pi / 2),
            y + 0.58 + 0.18 * math.sin(j * math.pi / 2),
            IRON,
          )
      barrier = line.buffer(0.26 if owner == "339201179" else 0.08, cap_style=2)
      if native:
        barrier = raster(barrier, 0.25)
      nav(barrier, y, y + 1.13)

  # Four evenly distributed features per side: eight heritage groups / panels.
  # Position along each long perimeter is interpolated, not a surveyed anchor.
  sides = []
  for sign in [-1, 1]:
    matching = [
      line
      for line in c["lateral"]
      if (((line.centroid.x - aa[0]) * -uz + (line.centroid.y - aa[1]) * ux) > 0)
      == (sign > 0)
    ]
    points = [p for line in matching for p in line.coords]
    points.sort(key=lambda p: (p[0] - aa[0]) * ux + (p[1] - aa[1]) * uz)
    if points:
      sides.append(LineString([points[0], points[-1]]))
  if is_schloss:
    for edge in sides:
      for t in [0.035, 1 / 3, 2 / 3, 0.965]:
        p = edge.interpolate(t, normalized=True)
        x, z = p.x, p.y
        y = height(x, z) + 0.14
        # Red granite pedestal, cornice, and paired light marble silhouettes.
        fit(rect(x, z, 1.7, 1.35), y, y + 0.23, GRANITE, True)
        fit(rect(x, z, 1.35, 1.08), y + 0.23, y + 1.65, GRANITE, True)
        fit(rect(x, z, 1.65, 1.35), y + 1.65, y + 1.85, GRANITE, True)
        for side, h in [(-0.37, 1.65), (0.37, 1.25)]:
          fx, fz = x + ux * side, z + uz * side
          fit(rect(fx, fz, 0.38, 0.40), y + 1.85, y + 1.85 + h * 0.68, MARBLE, True)
          fit(
            rect(fx, fz, 0.55, 0.34),
            y + 1.85 + h * 0.48,
            y + 1.85 + h * 0.87,
            MARBLE,
            True,
          )
          fit(
            Point(fx, fz).buffer(0.18, quad_segs=2),
            y + 1.85 + h * 0.85,
            y + 2.05 + h,
            MARBLE,
            True,
          )
          fit(
            rect(fx + ux * 0.27, fz + uz * 0.27, 0.12, 0.19),
            y + 2.15,
            y + 1.85 + h * 0.78,
            MARBLE,
            True,
          )
        # Small rounded shield on the warrior; marble relief stays abstract.
        fit(
          rect(x + ux * 0.65, z + uz * 0.65, 0.10, 0.40),
          y + 1.98,
          y + 2.53,
          MARBLE,
          True,
        )
  elif owner == "339201216":
    for edge in sides:
      for t in [0.14, 0.38, 0.62, 0.86]:
        p = edge.interpolate(t, normalized=True)
        y = height(p.x, p.y) + 0.14
        # Upright circular medallion made as horizontal chords in the side plane.
        for i in range(8):
          low = -0.30 + i * 0.075
          mid = low + 0.0375
          width = 2 * math.sqrt(max(0, 0.30**2 - mid**2))
          fit(
            rect(p.x, p.y, width, 0.09),
            y + 0.67 + low,
            y + 0.67 + low + 0.075,
            ALUMINIUM,
          )
        # Small windrose cross, cast iron, alternating between medallions.
        q = edge.interpolate(min(0.98, t + 0.1), normalized=True)
        qy = height(q.x, q.y) + 0.14
        fit(rect(q.x, q.y, 0.38, 0.09), qy + 0.61, qy + 0.68, IRON)
        fit(rect(q.x, q.y, 0.07, 0.09), qy + 0.46, qy + 0.83, IRON)
  return dict(
    schemaVersion=1,
    origin=[ox, -10, oz],
    owner=owner,
    name=bridge["name"],
    meshes=[mesh.payload("spree-bridges-v242")],
    nav=dict(
      ground=[],
      buildings=[],
      water=[],
      roads=[],
      bridges=[],
      groundY=base,
      spreeBridgesV242=dict(floors=floors, solids=solids),
    ),
  )


def build() -> None:
  source, previous = read(SOURCE), read(PREVIOUS)
  assert source["previousSha256"] == digest(PREVIOUS)
  assert source["groundSha256"] == digest(
    ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  )
  by_id = {b["id"]: b for b in source["bridges"]}
  core = {
    family: [build_bridge(by_id[r["sourceId"]], r, native) for r in previous["records"]]
    for native, family in [(False, "drawn"), (True, "minecraft")]
  }
  write(OUTPUT, dict(schemaVersion=1, core=core))
  counts = {}
  for family, packets in core.items():
    counts[family] = {
      "owners": len(packets),
      "packedBytes": sum(
        len(base64.b64decode(m[k]))
        for p in packets
        for m in p["meshes"]
        for k in ["positions", "colors", "indices"]
      ),
      "triangles": sum(
        len(base64.b64decode(p["meshes"][0]["indices"])) // 12 for p in packets
      ),
    }
  write(
    EVIDENCE,
    dict(
      sourceSha256=digest(SOURCE),
      outputSha256=digest(OUTPUT),
      previousSha256=digest(PREVIOUS),
      counts=counts,
      noOuterPacketChanges=True,
      unchangedV242Sha256=digest(DATA / "spreeBridgesV242.json"),
    ),
  )
  print(counts)


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract:
    extract()
  build()
