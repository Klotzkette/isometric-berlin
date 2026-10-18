"""Step 10: complete mapped BER ground and buildings in bounded airport packets."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
from collections import Counter, defaultdict
from typing import Any

import build_district_facades_v188 as base
import build_region_outlines_v200 as region
import numpy as np
import shapely
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_surrounding_outlines import (
  PackedMesh,
  line_parts,
  navigation_polygons,
)
from build_west_streets_v163 import partition_detail
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import split, transform, unary_union

from isometric_berlin.generation.road_geometry import parse_osm_measure_m, road_width_m

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
SOURCE = GEO / "ber-ground-v236-source.json.gz"
EVIDENCE = GEO / "ber-ground-v236-evidence.json"
PATCH = GEO / "ber-v236-manifest-addition.json"
ACCESS_NAMES = {
  "Willy-Brandt-Platz",
  "Melli-Beese-Ring",
  "Hugo-Junkers-Ring",
  "Elly-Beinhorn-Ring",
  "Schönefelder Allee",
}
LANDSIDE = (
  128894403,
  157811263,
  157811265,
  158252003,
  158252005,
  158251999,
  157807988,
  885812396,
  193019556,
  193019557,
  1083495099,
  193019551,
  519141136,
)
COLOURS = {
  "runway": (99, 104, 103),
  "apron": (181, 177, 163),
  "taxiway": (142, 145, 137),
  "road": (129, 131, 126),
  "parking": (156, 155, 146),
  "paving": (208, 201, 179),
  "grass": (177, 187, 149),
  "water": (119, 163, 167),
  "marking": (216, 182, 72),
  "rail": (103, 112, 103),
}


def projected(geometry: dict) -> Any:
  return shapely.make_valid(transform(region.world, shape(geometry)))


def extract() -> None:
  """Freeze complete relevant public source geometries; no raw cache at replay."""
  old = base.read_json(region.SOURCE)
  airport = projected(old["sites"]["BER"]["geometry"])
  elements = {}
  paths = [region.RAW / n for n in ("ber-map.osm", "ber-west.osm", "ber-north.osm")]
  for path in paths:
    elements.update(region.xml_elements(path))
  shapes, members = region.mapped_shapes(elements)
  shapes = {k: transform(region.world, g) for k, g in shapes.items()}
  access = [
    g
    for k, g in shapes.items()
    if elements[k]["tags"].get("name") in ACCESS_NAMES
    and elements[k]["tags"].get("highway") not in (None, "proposed", "construction")
  ]
  landside = unary_union([shapes["way", key] for key in LANDSIDE])
  selection = unary_union(
    [airport, landside.buffer(35), unary_union(access).buffer(35)]
  )
  features = {
    f["id"]: {**f, "geometry": mapping(projected(f["geometry"]))}
    for f in old["features"]
    if f["site"] == "BER"
  }
  for key, row in elements.items():
    t = row["tags"]
    g = (
      Point(*region.world(row["lon"], row["lat"]))
      if key[0] == "node"
      else shapes.get(key)
    )
    if g is None or g.is_empty or key in members or not selection.intersects(g):
      continue
    kind = None
    if key[0] == "way" and key[1] in LANDSIDE:
      kind = "building"
    elif t.get("aeroway") in {
      "runway",
      "taxiway",
      "taxilane",
      "parking_position",
      "apron",
    }:
      kind = t["aeroway"]
    elif t.get("area:highway") in {
      "footway",
      "pedestrian",
      "path",
      "steps",
      "emergency",
    }:
      kind = "paving"
    elif (
      t.get("amenity") in {"parking", "bus_station", "motorcycle_parking"}
      and t.get("parking") != "multi-storey"
      and not t.get("building")
    ):
      kind = "parking"
    elif (
      t.get("natural") == "water" or t.get("amenity") == "fountain"
    ) and g.geom_type in {"Polygon", "MultiPolygon"}:
      kind = "water"
    elif t.get("landuse") in {"grass", "meadow", "traffic_island"}:
      kind = "grass"
    elif t.get("railway") in {"rail", "light_rail"}:
      kind = "rail"
    elif t.get("highway") in {
      "motorway",
      "motorway_link",
      "trunk",
      "trunk_link",
      "primary",
      "secondary",
      "tertiary",
      "tertiary_link",
      "unclassified",
      "residential",
      "service",
      "living_street",
      "pedestrian",
      "footway",
      "path",
      "cycleway",
      "steps",
    }:
      if not t.get("indoor"):
        kind = "road"
    if kind:
      identity = f"{key[0]}/{key[1]}"
      features[identity] = dict(
        id=identity, site="BER", kind=kind, tags=t, geometry=mapping(g)
      )
  base.write_json(
    SOURCE,
    dict(
      schemaVersion=1,
      coordinateSystem="viewer metres; x=easting-389500,z=5820000-northing",
      license="OpenStreetMap contributors, ODbL-1.0",
      retrievedDate="2026-10-09",
      sourceUrls=[
        u for u in old["sources"] if "map?bbox=13.4" in u or "map?bbox=13.5" in u
      ],
      inputs={
        str(p.relative_to(ROOT)): base.digest(p) for p in [*paths, region.SOURCE]
      },
      previousBerSourceIds=sorted(
        f["id"] for f in old["features"] if f["site"] == "BER"
      ),
      aerodrome=mapping(airport),
      landside=mapping(landside),
      features=sorted(features.values(), key=lambda f: f["id"]),
      estimates={
        "taxiwayWidthM": 23,
        "roadWidth": "OSM width or existing lane/class display rule",
        "unmeasuredDeckLevelM": 5,
        "groundY": 3,
        "nativeGroundGridM": 1,
        "nativeLawnGridM": 1,
        "nativeMarkingGridM": 0.125,
      },
    ),
  )


def above_ground(t: dict) -> bool:
  return (
    t.get("tunnel") not in {"yes", "building_passage"}
    and float(t.get("layer", "0")) >= 0
  )


def ground_road(t: dict) -> bool:
  return t.get("level:ref") == "E0" or (
    t.get("bridge") != "yes"
    and (t.get("level") == "1" or float(t.get("layer", "0")) == 0)
  )


def footprint(f: dict) -> Any:
  """Dimensions without tags are openly declared cartographic widths."""
  g, t, kind = shape(f["geometry"]), f["tags"], f["kind"]
  if g.geom_type in {"Polygon", "MultiPolygon"}:
    return g
  if kind == "parking_position" and g.geom_type == "Point":
    return g.buffer(0.8, quad_segs=4)
  if kind == "runway":
    width = parse_osm_measure_m(t.get("width"))
    assert width in {45, 60}, f["id"]
  elif kind == "taxiway":
    width = parse_osm_measure_m(t.get("width")) or 23
  elif kind in {"taxilane", "parking_position"}:
    width = 0.3
  elif kind == "rail":
    width = 1.435
  else:
    width = road_width_m(t)
  return g.buffer(width / 2, cap_style="flat", join_style="round", quad_segs=3)


def ground_model(source: dict) -> tuple:
  groups, raised = defaultdict(list), []
  underground = []
  for f in source["features"]:
    kind, t = f["kind"], f["tags"]
    if kind in {"building", "aerodrome"}:
      continue
    if not above_ground(t):
      underground.append(f["id"])
      continue
    g = footprint(f)
    if kind == "road":
      level = float(t.get("layer", "0"))
      if (level > 0 or t.get("bridge") == "yes") and not ground_road(t):
        deck_level = 1 if t.get("level:ref") == "E1" else max(1, level)
        raised.append((f, g, 3.03 + deck_level * 5))
        continue
      if t.get("highway") in {"pedestrian", "footway", "path", "cycleway", "steps"}:
        kind = "paving"
    elif kind in {"taxilane", "parking_position"}:
      kind = "marking"
    groups[kind].append(g)
  merged = {k: shapely.make_valid(unary_union(v)) for k, v in groups.items()}
  merged["grass"] = unary_union(
    [shape(source["aerodrome"]), merged.get("grass", Polygon())]
  )
  buildings = unary_union(
    [
      shape(f["geometry"])
      for f in source["features"]
      if f["kind"] == "building"
      and not parse_osm_measure_m(f["tags"].get("min_height"))
      and f["tags"].get("building") not in {"roof", "bridge"}
    ]
  )
  # Source station stair/entrance footprints must never get a new solid paving lid.
  blocked = buildings.buffer(0.01)
  used, surfaces = Polygon(), []
  for kind in (
    "water",
    "runway",
    "road",
    "parking",
    "paving",
    "apron",
    "taxiway",
    "rail",
    "grass",
  ):
    g = merged.get(kind, Polygon()).difference(used).difference(blocked)
    if not g.is_empty:
      surfaces.append((kind, g, 3.03 if kind != "grass" else 3.0))
      used = unary_union([used, g])
  air_pavement = unary_union(
    [g for kind, g, _ in surfaces if kind in {"runway", "taxiway", "apron"}]
  )
  # Leads and stands are genuine mapped geometry; no inferred gate approach.
  marks = merged.get("marking", Polygon()).intersection(air_pavement)
  if not marks.is_empty:
    surfaces.append(("marking", marks, 3.05))
  # Layer numbers are ordering tags, not measured storey heights. Propagate
  # explicit E1 through connected upper access ways so a layer1/2 tag change
  # cannot manufacture a five metre cliff at a shared mapped node.
  node_owners = defaultdict(set)
  for i, (f, _, _) in enumerate(raised):
    for line in line_parts(shape(f["geometry"])):
      for x, z in line.coords:
        node_owners[round(x, 4), round(z, 4)].add(i)
  adjacency = defaultdict(set)
  for owners in node_owners.values():
    for i in owners:
      adjacency[i].update(owners)
  seen = set()
  for i in range(len(raised)):
    if i in seen:
      continue
    component, pending = set(), [i]
    while pending:
      current = pending.pop()
      if current in component:
        continue
      component.add(current)
      pending.extend(adjacency[current] - component)
    seen.update(component)
    target = (
      8.03
      if any(raised[j][0]["tags"].get("level:ref") == "E1" for j in component)
      else max(raised[j][2] for j in component)
    )
    for j in component:
      f, g, _ = raised[j]
      raised[j] = (f, g, target)
  # Connect genuinely shared source endpoints; do not invent off-axis ramps.
  ground_nodes = set()
  for f in source["features"]:
    if f["kind"] != "road" or not above_ground(f["tags"]):
      continue
    t = f["tags"]
    if ground_road(t):
      for line in line_parts(shape(f["geometry"])):
        ground_nodes.update((round(x, 4), round(z, 4)) for x, z in line.coords)
  profiled = []
  for f, g, y in raised:
    line = shape(f["geometry"])
    endpoints = [False, False]
    anchors = []
    if line.geom_type == "LineString":
      endpoints = [
        (round(x, 4), round(z, 4)) in ground_nodes
        for x, z in (line.coords[0], line.coords[-1])
      ]
      for index, (x, z) in enumerate(line.coords):
        key = round(x, 4), round(z, 4)
        if (
          key in ground_nodes
          or len(node_owners.get(key, ())) > 1
          or index in (0, len(line.coords) - 1)
        ):
          anchors.append(
            [
              line.project(Point(x, z), normalized=True),
              3.03 if key in ground_nodes else y,
            ]
          )
      if len(anchors) == 2 and all(endpoints):
        anchors.insert(1, [0.5, y])
    profiled.append(
      ({**f, "_groundEndpoints": endpoints, "_deckProfile": anchors}, g, y)
    )
  raised = profiled
  return surfaces, raised, underground, buildings


def native_surface(g: Any, step: float) -> Any:
  """Only fully contained axis-aligned cells; row merging is lossless."""
  if g.is_empty:
    return g
  shapely.prepare(g)
  x0, z0, x1, z1 = g.bounds
  xs = np.arange(math.floor(x0 / step) * step, x1, step)
  runs = []
  for z in np.arange(math.floor(z0 / step) * step, z1, step):
    # Narrow mapped leads occupy very few cells: construct boxes only at
    # interior centres, never a 4096² allocation for a 512m marking tile.
    interior = shapely.contains_xy(g, xs + step / 2, z + step / 2)
    covered = np.zeros(len(xs), dtype=bool)
    candidates = np.flatnonzero(interior)
    if len(candidates):
      px = xs[candidates]
      covered[candidates] = shapely.covers(g, shapely.box(px, z, px + step, z + step))
    edges = np.flatnonzero(np.diff(np.r_[False, covered, False]))
    for start, end in zip(edges[::2], edges[1::2]):
      runs.append(box(xs[start], z, xs[end - 1] + step, z + step))
  return unary_union(runs).simplify(0, preserve_topology=True)


def deck_height(f: dict, y: float, x: float, z: float) -> float:
  anchors = f.get("_deckProfile", [])
  if not anchors:
    return y
  line = shape(f["geometry"])
  t = line.project(Point(x, z), normalized=True)
  return float(np.interp(t, [a[0] for a in anchors], [a[1] for a in anchors]))


def deck_detail(raised: list, native: bool) -> Detail:
  detail = Detail()
  for f, g, y in raised:
    sloped = any(abs(a[1] - y) > 0.001 for a in f.get("_deckProfile", []))
    if native and sloped:
      # Independent orthogonal steps follow the same source-supported approach.
      # Merge contiguous cells of equal quantized height to bound packet size.
      shapely.prepare(g)
      x0, z0, x1, z1 = g.bounds
      for z in range(math.floor(z0), math.ceil(z1)):
        cells = []
        for x in range(math.floor(x0), math.ceil(x1)):
          if g.covers(box(x, z, x + 1, z + 1)):
            h = 3.03 + round((deck_height(f, y, x + 0.5, z + 0.5) - 3.03) * 4) / 4
            if cells and cells[-1][1] == x and cells[-1][2] == h:
              cells[-1][1] += 1
            else:
              cells.append([x, x + 1, h])
        for a, b, h in cells:
          detail.box(
            [(a + b) / 2, h - 0.175, z + 0.5],
            [b - a, 0.35, 1],
            COLOURS["road"],
            "mapped approach; estimated stepped deck",
          )
      continue
    if native:
      g = native_surface(g, 1)
    elif sloped:
      line = shape(f["geometry"])
      pieces = [g]
      for distance, _ in f.get("_deckProfile", [])[1:-1]:
        middle = line.interpolate(distance, normalized=True)
        near = line.interpolate(min(1, distance + 0.0001), normalized=True)
        dx, dz = near.x - middle.x, near.y - middle.y
        scale = 10000 / max(math.hypot(dx, dz), 0.001)
        cut = LineString(
          [
            (middle.x - dz * scale, middle.y + dx * scale),
            (middle.x + dz * scale, middle.y - dx * scale),
          ]
        )
        pieces = [part for piece in pieces for part in split(piece, cut).geoms]
      g = shapely.GeometryCollection(pieces)
    for polygon in region.polygons(g):
      for tri in shapely.constrained_delaunay_triangles(polygon).geoms:
        pts = [
          [x, deck_height(f, y, x, z), z] for x, z in list(tri.exterior.coords)[:3]
        ]
        a, b, c = pts
        if (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]) > 0:
          pts.reverse()
        detail.polygon(
          pts, COLOURS["road"], "mapped raised access deck; estimated level"
        )
      for line in line_parts(polygon.boundary):
        for a, b in zip(line.coords, list(line.coords)[1:]):
          detail.polygon(
            [
              [a[0], deck_height(f, y, *a) - 0.35, a[1]],
              [b[0], deck_height(f, y, *b) - 0.35, b[1]],
              [b[0], deck_height(f, y, *b), b[1]],
              [a[0], deck_height(f, y, *a), a[1]],
            ],
            (148, 149, 140),
            "deck fascia",
          )
  return detail


def build() -> dict:
  import build_ber_airport_buildings_v236 as architecture

  source = base.read_json(SOURCE)
  surfaces, raised, underground, buildings = ground_model(source)
  architecture_result = architecture.build()
  footprint_union = unary_union(
    [
      *(g for _, g, _ in surfaces),
      *(g for _, g, _ in raised),
      buildings,
      architecture_result["scope"],
    ]
  )
  water = unary_union([g for kind, g, _ in surfaces if kind == "water"])
  ground = footprint_union.difference(water)
  details = {}
  for family in ("drawn", "minecraft"):
    details[family] = partition_detail(architecture_result[family])
    decks = partition_detail(deck_detail(raised, family == "minecraft"))
    for key, detail in decks.items():
      details[family].setdefault(key, Detail()).triangles.extend(detail.triangles)
  x0, z0, x1, z1 = footprint_union.bounds
  cells = [
    (ix, iz)
    for ix in range(math.floor(x0 / 512), math.floor(x1 / 512) + 1)
    for iz in range(math.floor(z0 / 512), math.floor(z1 / 512) + 1)
    if footprint_union.intersection(
      box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
    ).area
    > 0.001
  ]
  descriptors, receipts, counts = [], {}, Counter()
  print(f"BER v236: {len(cells)} bounded 512m packets", flush=True)
  for ix, iz in cells:
    tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
    identity = f"ber236-{ix}_{iz}"
    descriptor = dict(id=identity, bounds=list(tile.bounds))
    nav = dict(
      ground=navigation_polygons(ground.intersection(tile), ix * 512, iz * 512),
      water=navigation_polygons(water.intersection(tile), ix * 512, iz * 512),
      roads=[],
      bridges=[],
      buildings=[],
      groundY=3,
    )
    for b in architecture_result["navigation"]:
      for polygon in navigation_polygons(
        b["geometry"].intersection(tile), ix * 512, iz * 512
      ):
        nav["buildings"].append(
          {**polygon, **{k: v for k, v in b.items() if k != "geometry"}}
        )
    for f, g, y in raised:
      if any(abs(a[1] - y) > 0.001 for a in f.get("_deckProfile", [])):
        # The movement data has no sloped-deck primitive; retain the existing
        # free ground movement rather than erect an invented tall ramp wall.
        continue
      for polygon in navigation_polygons(g.intersection(tile), ix * 512, iz * 512):
        nav["buildings"].append(
          {
            **polygon,
            "sourceId": f["id"] + "-deck",
            "minHeight": y - 3 - 0.35,
            "height": y - 3,
          }
        )
    for family in ("drawn", "minecraft"):
      mesh = PackedMesh(ix * 512, iz * 512)
      local_areas = {}
      for kind, geometry, y in surfaces:
        g = geometry.intersection(tile)
        if g.is_empty:
          continue
        if family == "minecraft":
          g = native_surface(g, 0.125 if kind == "marking" else 1)
        mesh.surface(g, y, COLOURS[kind])
        local_areas[kind] = g.area
      meshes = [
        m
        for m in [
          mesh.payload("ber-ground-v236"),
          packed_detail(details[family].get((ix, iz), Detail()), tile),
        ]
        if m
      ]
      for part in meshes:
        if part["kind"] != "ber-ground-v236":
          part["kind"] = "ber-buildings-and-access-v236"
      packet = dict(
        schemaVersion=1,
        id=identity,
        origin=[ix * 512, -10, iz * 512],
        meshes=meshes,
        nav=nav,
      )
      raw = (
        json.dumps(packet, separators=(",", ":"), ensure_ascii=False) + "\n"
      ).encode()
      compressed = gzip.compress(raw, compresslevel=9, mtime=0)
      url = f"{identity}.{family}.json.gz"
      (OUT / url).write_bytes(compressed)
      encoded_geometry_bytes = sum(
        sum(len(base64.b64decode(m[k])) for k in ("positions", "colors", "indices"))
        for m in meshes
      )
      vertex_count = sum(len(base64.b64decode(m["positions"])) // 6 for m in meshes)
      index_count = sum(len(base64.b64decode(m["indices"])) // 4 for m in meshes)
      geometry_bytes = vertex_count * 12 + index_count * (
        2 if vertex_count <= 65535 else 4
      )
      descriptor[family] = dict(
        url=url,
        encoding="gzip",
        bytes=len(compressed),
        decodedBytes=len(raw),
        sha256=hashlib.sha256(compressed).hexdigest(),
      )
      receipts[f"{family}:{identity}"] = dict(
        geometryBytes=geometry_bytes,
        encodedGeometryBytes=encoded_geometry_bytes,
        areasM2=local_areas,
        meshes=len(meshes),
        vertices=vertex_count,
        indices=index_count,
      )
      counts[family + "GeometryBytes"] += geometry_bytes
      counts[family + "CompressedBytes"] += len(compressed)
      counts[family + "DecodedBytes"] += len(raw)
    descriptors.append(descriptor)
    print(
      identity,
      descriptor["drawn"]["bytes"],
      descriptor["minecraft"]["bytes"],
      flush=True,
    )
  report = dict(
    sourceSha256=base.digest(SOURCE),
    counts=dict(counts),
    sourceKinds=dict(Counter(f["kind"] for f in source["features"])),
    packets=receipts,
    undergroundRetainedUnpainted=underground,
    raisedAccess=[
      dict(
        id=f["id"],
        deckY=y,
        sourceEndpointRamps=f.get("_groundEndpoints", [False, False]),
        sourceHeightAnchors=f.get("_deckProfile", []),
        heightEvidence="E0 stays at ground; E1 one 5m estimated storey; other positive layers 5m each",
      )
      for f, _, y in raised
    ],
    architecture=architecture_result["evidence"],
    surfaces=[dict(kind=k, areaM2=g.area, y=y) for k, g, y in surfaces],
    unchangedRegionalFiles={
      str(p.relative_to(ROOT)): base.digest(p)
      for p in [region.SOURCE, ROOT / "src/app/src/data/berAirportV205.json"]
    },
  )
  base.write_json(EVIDENCE, report)
  base.write_json(
    PATCH,
    dict(
      schemaVersion=1,
      version="1.0.136",
      chunks=descriptors,
      footprint=region.nav_polys(
        shapely.set_precision(footprint_union, 0.01).simplify(0.01)
      ),
      bounds=list(footprint_union.bounds),
      source=dict(
        source=str(SOURCE.relative_to(ROOT)),
        sourceSha256=base.digest(SOURCE),
        evidence=str(EVIDENCE.relative_to(ROOT)),
        counts=dict(counts),
        chunks=len(descriptors),
        footprintMetadataPrecisionM=0.01,
      ),
    ),
  )
  return dict(chunks=len(descriptors), **counts)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--refresh-source", action="store_true")
  args = parser.parse_args()
  if args.refresh_source or not SOURCE.exists():
    extract()
  print(json.dumps(build()))
