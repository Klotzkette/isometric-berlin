"""Step 10: mapped ordinary Spree bridge fittings, owned by existing packets.

No previous mesh or navigation field is removed. Plans and lane counts are OSM;
vertical placement follows the retained packet. Member sections, deck depth,
arch soffit curvature and untagged footway widths are explicit display estimates.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import shapely
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import substring, unary_union

from isometric_berlin.data.fetch_lod2 import polygons_from_geometry
from isometric_berlin.generation.road_geometry import (
  VEHICULAR_HIGHWAYS,
  mapped_lane_count,
  road_width_m,
  road_width_source,
)
from scripts.build_house_curbs_v233 import ground_guard
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
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "spree-bridges-v242-source.json"
EVIDENCE = GEO / "spree-bridges-v242-evidence.json"
OUTPUT = DATA / "spreeBridgesV242.json"
RAW = GEO / "raw/spree-bridges-v242"
STAGED = RAW / "packets"
OWNERS = {
  "222755815",
  "342078865",
  "342085681",
  "342078864",
  "355281429",
  "371368732",
  "375699626",
  "404897470",
  "539296523",
  "659119664",
  "659119880",
  "659122810",
  "339201207",
  "339201178",
  "339201182",
  "339201206",
  "339201209",
  "339201208",
  "334070711",
  "334070715",
  "334070717",
  "1017420119",
  "329180743",
  "333893473",
}
ASPHALT, PAVING, CURB = (102, 109, 111), (194, 189, 176), (223, 216, 199)
METAL, STEEL, STONE, PAINT = (
  (65, 79, 79),
  (110, 125, 125),
  (168, 151, 130),
  (235, 232, 217),
)


def read(path: Path) -> Any:
  """Read a retained JSON document without changing its bytes."""
  data = path.read_bytes()
  return json.loads(gzip.decompress(data) if path.suffix == ".gz" else data)


def write(path: Path, value: Any) -> None:
  """Write deterministic bounded derived evidence."""
  path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")


def digest(path: Path) -> str:
  """Hash independently retained source bytes."""
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def retained_packet(packet: dict, receipt: dict) -> dict:
  """Recover exactly the previous complete packet on cache-free rebuilds."""
  assert len(packet["meshes"]) == receipt["meshes"] + 1
  assert packet["meshes"][-1]["kind"] == "spree-bridges-v242"
  original = dict(packet, meshes=packet["meshes"][:-1], nav=dict(packet["nav"]))
  del original["nav"]["spreeBridgesV242"]
  identity = hashlib.sha256(
    json.dumps(original, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()
  assert identity == receipt["originalContentSha256"]
  return original


def extract() -> None:
  """Freeze complete mapped bridge rings and intersecting tagged transport ways."""
  retained_receipts = read(SOURCE).get("coreReceipts", []) if SOURCE.exists() else []
  cache = GEO / "raw/outskirts-v187/candidate.gpkg"
  outlines = {}
  for layer in ("lines", "multipolygons"):
    rows = gpd.read_file(cache, layer=layer, where="man_made='bridge'").to_crs(25833)
    for _, row in rows.iterrows():
      tags = tags_for(row)
      identity = str(tags.get("osm_way_id") or tags.get("osm_id"))
      if identity not in OWNERS:
        continue
      geometry = world(row.geometry)
      if geometry.geom_type == "LineString":
        assert geometry.is_ring
        geometry = Polygon(geometry)
      outlines[identity] = dict(
        id=identity, name=tags["name"], tags=tags, geometry=mapping(geometry), roads=[]
      )
  assert set(outlines) == OWNERS
  roads = gpd.read_file(
    cache, layer="lines", where="highway IS NOT NULL AND other_tags LIKE '%\"bridge\"%'"
  ).to_crs(25833)
  for _, row in roads.iterrows():
    tags = tags_for(row)
    if tags.get("bridge", "no") in ("no", "false", "0"):
      continue
    if tags.get("highway") == "proposed":
      continue
    geometry = world(row.geometry)
    width_tags = dict(tags)
    if tags.get("highway") == "construction":
      width_tags["highway"] = tags.get("construction", "construction")
    for bridge in outlines.values():
      if geometry.intersection(shape(bridge["geometry"])).length < 4:
        continue
      bridge["roads"].append(
        dict(
          id=str(row.osm_id),
          tags=tags,
          geometry=mapping(geometry),
          width=road_width_m(width_tags),
          widthSource=road_width_source(width_tags),
        )
      )
  write(
    SOURCE,
    dict(
      schemaVersion=1,
      source="Geofabrik Berlin 2026-09-29 / retained OpenStreetMap",
      license="ODbL-1.0",
      sourceFile=str(cache.relative_to(ROOT)),
      sourceSha256=digest(cache),
      bridges=sorted(outlines.values(), key=lambda b: b["name"]),
      coreReceipts=retained_receipts,
      estimates="Source rings, axes, tagged lanes and bridge:structure are retained. All heights, soffit/rail sections and untagged widths are display estimates; road datum follows each retained packet. No source bridge is silently replaced.",
    ),
  )


def raster(geometry: Any, cell: float = 0.5, fully_inside: bool = False) -> Any:
  """Independent orthogonal surface cells, merged into scanline runs."""
  if geometry.is_empty:
    return Polygon()
  minx, minz, maxx, maxz = geometry.bounds
  xs = np.arange(math.floor(minx / cell), math.ceil(maxx / cell)) * cell + cell / 2
  runs = []
  for zi in range(math.floor(minz / cell), math.ceil(maxz / cell)):
    z = zi * cell + cell / 2
    hits = shapely.intersects_xy(geometry, xs, np.full(len(xs), z))
    if fully_inside:
      hits &= shapely.covers(
        geometry, shapely.box(xs - cell / 2, z - cell / 2, xs + cell / 2, z + cell / 2)
      )
    edges = np.flatnonzero(np.diff(np.r_[False, hits, False]))
    for a, b in zip(edges[::2], edges[1::2]):
      runs.append(
        box(xs[a] - cell / 2, z - cell / 2, xs[b - 1] + cell / 2, z + cell / 2)
      )
  return unary_union(runs).simplify(0, preserve_topology=True)


def extrusion(
  mesh: PackedMesh,
  geometry: Any,
  low: float,
  high: float,
  colour: tuple,
  top: bool = True,
) -> None:
  """Closed prism of a bounded source fitting, preserving polygon holes."""
  geometry = polygonal(geometry)
  if geometry.is_empty:
    return
  if top:
    mesh.surface(geometry, high, colour)
  for line in line_parts(geometry.boundary):
    for a, b in zip(line.coords, list(line.coords)[1:]):
      p = [(a[0], low, a[1]), (b[0], low, b[1]), (b[0], high, b[1]), (a[0], high, a[1])]
      mesh.triangle([p[0], p[1], p[2]], colour)
      mesh.triangle([p[0], p[2], p[3]], colour)


def components(bridge: dict, native: bool) -> dict:
  """Compile complete bridge once; clipping later cannot invent end railings."""
  outline = shape(bridge["geometry"])
  roads = [
    r
    for r in bridge["roads"]
    if r["tags"].get("highway") in VEHICULAR_HIGHWAYS and r["width"]
  ]
  routes = roads or bridge["roads"]
  assert routes, bridge["name"]
  axis = max(
    (shape(r["geometry"]).intersection(outline) for r in routes), key=lambda g: g.length
  )
  axis = max(line_parts(axis), key=lambda g: g.length)
  a, b = list(axis.coords)[0], list(axis.coords)[-1]
  length = math.dist(a, b)
  ux, uz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
  # Real mapped edge follows the bridge plan, including asymmetry and flare.
  lateral = []
  for ring in [
    r for p in polygons_from_geometry(outline) for r in [p.exterior, *p.interiors]
  ]:
    for p, q in zip(ring.coords, list(ring.coords)[1:]):
      d = math.dist(p, q)
      if d > 0.05 and abs((q[0] - p[0]) * ux + (q[1] - p[1]) * uz) / d > 0.68:
        lateral.append(LineString([p, q]))
  sides = unary_union(lateral)
  carriageway = unary_union(
    [
      shape(r["geometry"]).buffer(r["width"] / 2, cap_style=2, join_style=2)
      for r in roads
    ]
  ).intersection(outline)
  # Keep a narrow outer footway where the source separately maps it; broad
  # unclassified residual strips are labelled as estimated bridge footways.
  construction = (
    unary_union(
      [
        shape(r["geometry"]).buffer(r["width"] / 2, cap_style=2, join_style=2)
        for r in bridge["roads"]
        if r["tags"].get("highway") == "construction" and r["width"]
      ]
    )
    .intersection(outline)
    .difference(carriageway)
  )
  walks = outline.difference(carriageway.union(construction)) if roads else outline
  paint = []
  painted_ids = []
  for road in roads:
    count = mapped_lane_count(road["tags"])
    if (
      not count
      or count < 2
      or not float(count).is_integer()
      or road["tags"].get("lane_markings") == "no"
    ):
      continue
    source_axis = shape(road["geometry"])
    painted_ids.append(road["id"])
    for lane in range(1, int(count)):
      offset = road["width"] * (lane / count - 0.5)
      shifted = source_axis.offset_curve(offset)
      for line in line_parts(shifted):
        for start in np.arange(1.0, line.length, 9.0):
          dash = substring(line, start, min(start + 3.0, line.length))
          if dash.geom_type == "LineString":
            paint.append(dash.buffer(0.065, cap_style=2).intersection(carriageway))
  rails = sides.buffer(0.055, cap_style=2, join_style=2)
  posts = []
  for line in lateral:
    n = max(1, math.ceil(line.length / 2.4))
    posts.extend(
      line.interpolate(i / n, normalized=True).buffer(0.085, quad_segs=1)
      for i in range(n + 1)
    )
  post_plan = unary_union(posts)
  if bridge["id"] == "342078865":
    # Primary heritage record 09050376: stone balustrade and three shallow
    # arches, dark Rhenish basalt. Individual divisions remain estimates.
    rails = sides.buffer(0.22, cap_style=2, join_style=2)
    posts = []
    for line in lateral:
      n = max(1, math.ceil(line.length / 0.85))
      posts.extend(
        line.interpolate(i / n, normalized=True).buffer(0.16, quad_segs=1)
        for i in range(n + 1)
      )
    post_plan = unary_union(posts)
  if bridge["id"] == "222755815":
    # CityRecognitionRefinements already owns the complete Luther metal
    # rail/pylon ornament. Preserve those fittings rather than double them.
    rails, post_plan = Polygon(), Polygon()
  curbs = (
    carriageway.boundary.intersection(outline.buffer(-0.12))
    .buffer(0.11, cap_style=2)
    .intersection(outline)
    if roads
    else Polygon()
  )
  # Avoid transverse artificial curbs where a source road starts/ends on deck.
  for road in roads:
    c = list(shape(road["geometry"]).coords)
    curbs = curbs.difference(
      unary_union(
        [Point(c[0]).buffer(road["width"]), Point(c[-1]).buffer(road["width"])]
      )
    )
  if native:
    outline = raster(outline)
    carriageway = raster(carriageway).intersection(outline)
    construction = raster(construction).intersection(outline).difference(carriageway)
    walks = outline.difference(carriageway.union(construction)) if roads else outline
    # A quarter-metre stair-stepped parapet is genuinely block native.
    rails = raster(rails.buffer(0.125), 0.25) if not rails.is_empty else rails
    post_plan = raster(unary_union([p.buffer(0.13) for p in posts]), 0.25)
    curbs = raster(curbs.buffer(0.08), 0.25).intersection(outline)
    paint = [raster(p.buffer(0.07), 0.25).intersection(carriageway) for p in paint]
    if bridge["id"] == "222755815":
      rails, post_plan = Polygon(), Polygon()
  return dict(
    outline=outline,
    road=carriageway,
    construction=construction,
    walks=walks,
    curbs=curbs,
    rails=rails,
    posts=post_plan,
    paint=unary_union(paint),
    lateral=lateral,
    axis=axis,
    roadBridge=bool(roads),
    paintedRoadIds=painted_ids,
  )


def append_model(
  mesh: PackedMesh, bridge: dict, c: dict, support: Any, ground: float, native: bool
) -> tuple[list, list]:
  """Complete mapped deck section and fittings at its retained vertical datum."""
  ox, oz = mesh.origin_x, mesh.origin_z
  clip = c["outline"].intersection(support)
  floors, solids = [], []
  deck_y = ground + 0.14
  walk_y = ground + (0.28 if c["roadBridge"] else 0.16)
  # Deck closes the actual mapped footprint, without changing approach
  # altitude. The earlier road faces remain intact underneath.
  mesh.surface(clip, deck_y, ASPHALT if c["roadBridge"] else PAVING)
  # Close each slice with a real underside. Arch wedges are never a
  # decorative facade underneath a continuous flat slab.
  axis = c["axis"]
  aa, bb = list(axis.coords)[0], list(axis.coords)[-1]
  length = math.dist(aa, bb)
  ux, uz = (bb[0] - aa[0]) / length, (bb[1] - aa[1]) / length

  def band(start: float, end: float) -> Any:
    return Polygon(
      [
        (aa[0] + ux * u - uz * v, aa[1] + uz * u + ux * v)
        for u, v in [(start, -200), (end, -200), (end, 200), (start, 200)]
      ]
    )

  spans = 3 if bridge["id"] == "342078865" else 2 if bridge["id"] == "339201207" else 1
  is_arch = bridge["tags"].get("bridge:structure") == "arch"
  basalt = (95, 98, 96)
  colour = basalt if bridge["id"] == "342078865" else STONE if is_arch else STEEL
  # Marschall's retained historic arch supports only its northern footway.
  north_arch = Polygon()
  if bridge["id"] == "339201207":
    north_side = min(c["lateral"], key=lambda line: line.centroid.y)
    north_arch = north_side.buffer(2.2, cap_style=2).intersection(c["outline"])
    if native:
      north_arch = raster(north_arch).intersection(c["outline"])
  parts = [(clip.difference(north_arch), is_arch, colour)]
  if not north_arch.is_empty:
    parts.append((clip.intersection(north_arch), True, STONE))
  for part, curved, material in parts:
    if part.is_empty:
      continue

    def low(p: tuple) -> float:
      if not curved:
        return deck_y - 0.65
      u = (p[0] - aa[0]) * ux + (p[1] - aa[1]) * uz
      t = min(1 - 1e-8, max(0, u / length)) * spans % 1
      return deck_y - 0.55 - 1.65 * (abs(t - 0.5) * 2) ** 2

    assigned = Polygon()
    total = max(1, math.ceil(length / 2)) if curved else 1
    for index in range(total):
      section = part.intersection(
        band(
          -200 if index == 0 else index * length / total,
          200 + length if index == total - 1 else (index + 1) * length / total,
        )
      )
      if native:
        section = raster(section).intersection(part).difference(assigned)
        assigned = assigned.union(section)
      section = polygonal(section)
      if section.is_empty:
        continue
      bottom = math.floor(low((section.centroid.x, section.centroid.y)) * 4) / 4
      for polygon in polygons_from_geometry(section):
        for triangle in shapely.constrained_delaunay_triangles(polygon).geoms:
          points = [
            (x, bottom if native else low((x, z)), z)
            for x, z in list(triangle.exterior.coords)[:3]
          ]
          mesh.triangle(points, material)
      for line in line_parts(section.boundary):
        for a, b in zip(line.coords, list(line.coords)[1:]):
          low_a, low_b = (bottom, bottom) if native else (low(a), low(b))
          mesh.triangle(
            [(a[0], low_a, a[1]), (b[0], low_b, b[1]), (b[0], deck_y, b[1])], material
          )
          mesh.triangle(
            [(a[0], low_a, a[1]), (b[0], deck_y, b[1]), (a[0], deck_y, a[1])], material
          )
  # End abutments attach to the exact source ends; only verified span
  # divisions introduce interior piers. Member widths/depths are estimates.
  support_bands = [band(-200, 1.1), band(length - 1.1, length + 200)]
  if spans > 1:
    support_bands.extend(
      band(length * i / spans - 0.75, length * i / spans + 0.75)
      for i in range(1, spans)
    )
  for support_band in support_bands:
    pier = support_band.intersection(c["outline"])
    if native:
      pier = raster(pier).intersection(c["outline"])
    pier = pier.intersection(support)
    extrusion(mesh, pier, -1.25, deck_y - 0.5, colour)
  work_surface = c["construction"].intersection(support)
  mesh.surface(work_surface, deck_y + 0.01, (143, 136, 124))
  walks = c["walks"].intersection(support)
  extrusion(mesh, walks, deck_y, walk_y, PAVING)
  curbs = c["curbs"].intersection(support)
  extrusion(mesh, curbs, deck_y, walk_y + 0.02, CURB)
  paint = c["paint"].intersection(support)
  mesh.surface(paint, deck_y + 0.025, PAINT)
  rail_plan = c["rails"].intersection(support)
  posts = c["posts"].intersection(support)
  rail_colour = (95, 98, 96) if bridge["id"] == "342078865" else METAL
  for low, high in [(walk_y + 0.24, walk_y + 0.31), (walk_y + 1.02, walk_y + 1.1)]:
    extrusion(mesh, rail_plan, low, high, rail_colour)
  extrusion(mesh, posts, walk_y, walk_y + 1.13, rail_colour)
  floor_polys = [
    (clip, deck_y),
    (walks, walk_y),
    (curbs, walk_y + 0.02),
    (paint, deck_y + 0.025),
    (work_surface, deck_y + 0.01),
  ]
  for p, y in floor_polys:
    floors.extend(
      dict(**r, y=round(y, 3))
      for r in navigation_polygons(shapely.set_precision(polygonal(p), 0.01), ox, oz)
    )
  solid_plan = rail_plan.union(posts)
  solids.extend(
    dict(**r, low=round(walk_y, 3), high=round(walk_y + 1.13, 3))
    for r in navigation_polygons(
      shapely.set_precision(polygonal(solid_plan), 0.01), ox, oz
    )
  )
  return floors, solids


def core_packet(bridge: dict, c: dict, receipt: dict, native: bool) -> dict:
  """Required complete source plan, preserving the earlier 14-step camber."""
  minx, minz, _, _ = c["outline"].bounds
  ox, oz = math.floor(minx - 1), math.floor(minz - 1)
  mesh = PackedMesh(ox, oz)
  floors, solids = [], []
  cx, cz = receipt["center"]
  ax, az = receipt["axis"]
  half = receipt["halfLength"]

  def point(u: float, v: float) -> tuple:
    return cx + ax * u - az * v, cz + az * u + ax * v

  assigned = Polygon()
  for i in range(14):
    a, b = -half + i * half / 7, -half + (i + 1) * half / 7
    # First/last bands include source-outline edges outside the raster fit.
    start, end = (-1000 if i == 0 else a), (1000 if i == 13 else b)
    section = Polygon(
      [point(start, -1000), point(end, -1000), point(end, 1000), point(start, 1000)]
    )
    support = c["outline"].intersection(section)
    if native:
      support = raster(support).intersection(c["outline"]).difference(assigned)
      assigned = assigned.union(support)
    if support.area < 0.001:
      continue
    rise = 0.5 * math.cos(((a + b) / 2) / half * math.pi / 2) ** 2
    ground = receipt["baseY"] + rise - 0.14
    if native:
      ground = round((ground + 0.14) * 4) / 4 - 0.14
    f, s = append_model(mesh, bridge, c, support, ground, native)
    floors.extend(f)
    solids.extend(s)
  return dict(
    schemaVersion=1,
    origin=[ox, -10, oz],
    meshes=[mesh.payload("spree-bridges-v242")],
    nav=dict(
      ground=[],
      buildings=[],
      water=[],
      roads=[],
      bridges=[],
      groundY=receipt["baseY"],
      spreeBridgesV242=dict(floors=floors, solids=solids),
    ),
    owner=bridge["id"],
    name=bridge["name"],
  )


def build() -> dict:
  """Append compact source-bound fittings only to original primary packets."""
  source = read(SOURCE)
  previous_receipts = read(EVIDENCE)["packets"] if EVIDENCE.exists() else {}
  manifest = read(OUT / "manifest.json")
  packets, receipts, counts, coverage = {}, {}, Counter(), []
  core_receipts = {r["sourceId"]: r for r in source["coreReceipts"]}
  core = {"drawn": [], "minecraft": []}
  STAGED.mkdir(parents=True, exist_ok=True)
  (RAW / "original").mkdir(exist_ok=True)
  entries = [e for e in manifest["chunks"] if not e.get("detailCompanionOf")]
  owners = {}
  for bridge in source["bridges"]:
    footprint = shape(bridge["geometry"])
    owners[bridge["id"]] = dict(
      name=bridge["name"],
      structure=bridge["tags"].get("bridge:structure", "beam"),
      packets=[],
      sourceArea=footprint.area,
      coveredArea=0,
    )
  for native in (False, True):
    family = "minecraft" if native else "drawn"
    compiled = [(b, components(b, native)) for b in source["bridges"]]
    for b, c in compiled:
      if b["id"] in core_receipts:
        packet = core_packet(b, c, core_receipts[b["id"]], native)
        core[family].append(packet)
        m = packet["meshes"][0]
        counts[family + "CoreVertices"] += len(base64.b64decode(m["positions"])) // 6
        counts[family + "CoreTriangles"] += len(base64.b64decode(m["indices"])) // 12
        counts[family + "CoreBytes"] += sum(
          len(base64.b64decode(m[k])) for k in ("positions", "colors", "indices")
        )
        if not native:
          owners[b["id"]]["core"] = True
          owners[b["id"]]["coveredArea"] = c["outline"].area
    compiled = [(b, c) for b, c in compiled if b["id"] not in core_receipts]
    targets = unary_union([c["outline"].buffer(0.6) for _, c in compiled])
    for entry in entries:
      tile = box(*entry["bounds"])
      if not targets.intersects(tile):
        continue
      packet_path = OUT / entry[family]["url"]
      frozen_path = RAW / "original" / entry[family]["url"]
      key = family + ":" + entry["id"]
      original = read(frozen_path if frozen_path.exists() else packet_path)
      restored = "spreeBridgesV242" in original["nav"]
      if restored:
        original = retained_packet(original, previous_receipts[key])
      original_sha = (
        previous_receipts[key]["sha256"]
        if restored
        else digest(frozen_path if frozen_path.exists() else packet_path)
      )
      if not original["nav"]["ground"] or original["nav"]["groundY"] != 3:
        continue
      ox, _, oz = original["origin"]
      support = unary_union(
        [
          translate(Polygon(p["ring"], p["holes"]), ox, oz)
          for p in original["nav"]["ground"]
        ]
      ).intersection(tile)
      if not targets.intersects(support):
        continue
      if native:
        support = raster(support.intersection(targets), 0.25, fully_inside=True)
      mesh = PackedMesh(ox, oz)
      floors, solids, owner_ids = [], [], []
      for bridge, c in compiled:
        clip = c["outline"].intersection(support)
        if clip.area < 0.05:
          continue
        owner_ids.append(bridge["id"])
        ground = original["nav"]["groundY"]
        extra_floors, extra_solids = append_model(
          mesh, bridge, c, support, ground, native
        )
        floors.extend(extra_floors)
        solids.extend(extra_solids)
        if not native:
          owners[bridge["id"]]["packets"].append(entry["id"])
          owners[bridge["id"]]["coveredArea"] += clip.area
          coverage.append(
            dict(
              owner=bridge["id"],
              packet=entry["id"],
              geometry=mapping(clip),
              paintedRoadIds=c["paintedRoadIds"],
            )
          )
      payload = mesh.payload("spree-bridges-v242")
      if payload:
        if not frozen_path.exists() and not restored:
          frozen_path.write_bytes(packet_path.read_bytes())
        enriched = dict(
          original,
          meshes=[*original["meshes"], payload],
          nav=dict(
            original["nav"], spreeBridgesV242=dict(floors=floors, solids=solids)
          ),
        )
        assert len(enriched["meshes"]) <= 16
        raw_bytes = (json.dumps(enriched, separators=(",", ":")) + "\n").encode()
        assert len(raw_bytes) <= 12 * 1024 * 1024
        staged_path = STAGED / entry[family]["url"]
        staged_path.write_bytes(gzip.compress(raw_bytes, mtime=0))
        packets[key] = dict(
          origin=original["origin"],
          guard=ground_guard(original["nav"]["ground"]),
          groundY=3,
          owners=owner_ids,
        )
        receipts[key] = dict(
          url=str(packet_path.relative_to(ROOT)),
          sha256=original_sha,
          originalContentSha256=hashlib.sha256(
            json.dumps(original, sort_keys=True, separators=(",", ":")).encode()
          ).hexdigest(),
          staged=str(staged_path.relative_to(ROOT)),
          stagedSha256=digest(staged_path),
          previousPublishedSha256=previous_receipts.get(key, {}).get("stagedSha256"),
          bytes=staged_path.stat().st_size,
          decodedBytes=len(raw_bytes),
          meshes=len(original["meshes"]),
        )
        counts[family + "Vertices"] += len(mesh.vertices)
        counts[family + "Triangles"] += len(mesh.indices) // 3
        counts[family + "Bytes"] += sum(
          len(base64.b64decode(payload[k])) for k in ("positions", "colors", "indices")
        )
  for owner in owners.values():
    owner["uncoveredArea"] = max(0, owner["sourceArea"] - owner["coveredArea"])
    if owner["coveredArea"] == 0:
      owner["status"] = "source-retained; outside all existing primary packet bounds"
    elif owner["uncoveredArea"] > 0.01:
      owner["status"] = (
        "mapped surface inside original primary ground owner; retained core-owned bank overlap excluded"
      )
    else:
      owner["status"] = "complete mapped footprint"
  counts["coreOwners"] = len(core["drawn"])
  counts["streamedOwners"] = sum(bool(o["packets"]) for o in owners.values())
  write(
    OUTPUT,
    dict(
      schemaVersion=1,
      sourceSha256=digest(SOURCE),
      ids=sorted(packets),
      packets=packets,
      core=core,
    ),
  )
  counts["coreJsonBytes"] = OUTPUT.stat().st_size
  counts["coreJsonGzipBytes"] = len(gzip.compress(OUTPUT.read_bytes(), mtime=0))
  write(
    DATA / "spreeBridgeCorePreviousV242.json",
    dict(cellM=4, records=source["coreReceipts"]),
  )
  write(
    EVIDENCE,
    dict(
      originalGeometryRetained=True,
      extraManifestEntries=0,
      sourceSha256=digest(SOURCE),
      outputSha256=digest(OUTPUT),
      packets=receipts,
      counts=dict(counts),
      owners=owners,
      coverage=coverage,
      estimates=source["estimates"],
      exclusions="Core authored BRIDGE_PROFILES, Monbijou and Oberbaum remain unchanged. Twelve generic whole-cluster estimates are replaced only by complete mapped core plans after exact cells and datum receipts match. Outer additions require existing immutable primary ground ownership; Rohrdamm has no current packet coverage; the 39.91 square metre Muehlendamm core-owned bank portion remains untouched.",
    ),
  )
  return dict(
    counts,
    packets=len(packets),
    owners=sum(bool(o["packets"]) for o in owners.values()),
  )


def apply_staged() -> dict:
  """Publish checked additions atomically, refusing any changed original owner."""
  evidence = read(EVIDENCE)
  manifest_path = OUT / "manifest.json"
  manifest = read(manifest_path)
  entries = {e["id"]: e for e in manifest["chunks"]}
  pending = []
  for key, receipt in evidence["packets"].items():
    family, identity = key.split(":", 1)
    entry = entries[identity]
    assert not entry.get("detailCompanionOf")
    public, staged = ROOT / receipt["url"], ROOT / receipt["staged"]
    assert digest(staged) == receipt["stagedSha256"]
    allowed = (
      receipt["sha256"],
      receipt["stagedSha256"],
      receipt.get("previousPublishedSha256"),
    )
    assert digest(public) in allowed
    assert entry[family]["sha256"] in allowed
    assert public.name == entry[family]["url"]
    pending.append((public, staged))
    entry[family].update(
      bytes=receipt["bytes"],
      decodedBytes=receipt["decodedBytes"],
      sha256=receipt["stagedSha256"],
    )
  # All owners and payloads are verified before changing the first public byte.
  for public, staged in pending:
    temporary = public.with_suffix(public.suffix + ".v242-tmp")
    temporary.write_bytes(staged.read_bytes())
    temporary.replace(public)
  temporary = manifest_path.with_suffix(".v242-tmp")
  write(temporary, manifest)
  temporary.replace(manifest_path)
  return dict(applied=len(pending), newManifestEntries=0)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--refresh-source", action="store_true")
  parser.add_argument("--apply-staged", action="store_true")
  args = parser.parse_args()
  if args.apply_staged:
    print(json.dumps(apply_staged()))
  else:
    if args.refresh_source or not SOURCE.exists():
      extract()
    print(json.dumps(build()))
