"""Source-tagged crossing/curb complements inside existing ordinary city packets."""

from __future__ import annotations

import argparse
import base64
import json
import math
from collections import Counter
from typing import Any

import numpy as np
import pyogrio
import shapely
from shapely.affinity import translate
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.generation.road_geometry import (
  parse_osm_measure_m,
  road_width_m,
  road_width_source,
)
from scripts import build_alt_mitte_transport_v206 as transport
from scripts import build_house_curbs_v233 as curbs
from scripts.build_surrounding_outlines import PackedMesh, line_parts, linear_rgb_bytes

ROOT, GEO, OUT = curbs.ROOT, curbs.GEO, curbs.OUT
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "city-streets-v249-source.json.gz"
EVIDENCE = GEO / "city-streets-v249-evidence.json.gz"
OUTPUT = DATA / "cityStreetsV249.json"
WHITE, STONE, ASPHALT = (235, 232, 217), (214, 210, 197), (109, 112, 109)
KIND = "city-streets-v249"


def read(path: Any) -> Any:
  return curbs.base.read_json(path)


def write(path: Any, value: Any) -> None:
  curbs.base.write_json(path, value)


def ribbon(row: list) -> Polygon:
  x, z, length, width, yaw, *_ = row
  c, s = math.cos(yaw), math.sin(yaw)
  return Polygon(
    [
      (x + u * c - v * s, z + u * s + v * c)
      for u, v in [
        (-length / 2, -width / 2),
        (length / 2, -width / 2),
        (length / 2, width / 2),
        (-length / 2, width / 2),
      ]
    ]
  )


def earlier() -> tuple[Any, Any, set[str], list]:
  """Keep earlier source paint, raised curbs and authored streets clear."""
  paint, kerbs, keys, paths = [], [], set(), []
  for name in ("altMitteTransportV206", "boulevardTransportV210"):
    p = DATA / (name + ".json")
    paths.append(p)
    paint.extend(ribbon(r) for c in read(p)["cells"] for r in c["rows"])
  p = GEO / "citywest-streets-v235-evidence.json"
  paths.append(p)
  paint.extend(shape(r["geometry"]) for r in read(p)["coverage"])
  for p in [
    GEO / "alt-mitte-transport-v206-evidence.json",
    GEO / "boulevard-transport-v210-evidence.json",
    GEO / "citywest-streets-v235-evidence.json",
  ]:
    paths.append(p)
    keys.update(r["key"] for r in read(p)["paintOwners"])
  for name in ("districtStreets", "schlossEastStreets"):
    p = DATA / (name + ".json")
    paths.append(p)
    payload = read(p)
    kerbs.extend(LineString(r).buffer(0.4) for r in payload["curbs_m"])
    paint.extend(
      LineString(r["points"]).buffer(0.7) for r in payload.get("markings_m", [])
    )
  p = GEO / "house-curbs-v233-evidence.json.gz"
  paths.append(p)
  for r in read(p)["courses"]:
    kerbs.append(shape(r["geometry"]).buffer(0.4))
    keys.add(r["key"])
  p = DATA / "boulevardCurbsV210.json"
  paths.append(p)
  kerbs.extend(LineString([r[:2], r[2:]]).buffer(0.4) for r in read(p)["segments"])
  p = GEO / "schlossstrasse-v247-evidence.json"
  paths.append(p)
  kerbs.extend(shape(r["geometry"]).buffer(0.4) for r in read(p)["kerbs"])
  # The authored City West street datum is higher than the ordinary packets.
  # Never publish hidden lower duplicates beneath that required street model.
  p = GEO / "west-streets-v163.json"
  paths.append(p)
  protected = [shape(r["geometry"]).buffer(43) for r in read(p)["roads"]]
  return (
    unary_union(paint + protected),
    unary_union(kerbs + protected),
    keys,
    paths,
  )


def extract() -> None:
  """Freeze bounded candidates, source tags and access gaps without new scope."""
  paint, kerbs, existing, paths = earlier()
  manifest = read(OUT / "manifest.json")
  scope = shapely.STRtree(
    [Polygon(p["ring"], p["holes"]) for p in manifest["footprint"]]
  )
  raw = GEO / "raw/outer-v159/candidate.gpkg"
  paths.append(raw)
  rows = pyogrio.read_dataframe(
    raw, layer="lines", where="highway IS NOT NULL OR barrier = 'kerb'"
  ).to_crs(25833)
  ways, access = [], []
  for r in rows.to_dict("records"):
    tags, g = curbs.tags(r), curbs.world(r["geometry"])
    if not len(scope.query(g, predicate="intersects")) or not transport.at_grade(tags):
      continue
    key = "way/" + r["osm_id"]
    if tags.get("highway"):
      access.append((g, 2.5 if tags["highway"] in transport.VEHICULAR_HIGHWAYS else 1))
    if key in existing:
      continue
    crossing = any(tags.get(k) == "crossing" for k in ("footway", "cycleway", "path"))
    style = transport.crossing_style(tags)
    width = parse_osm_measure_m(tags.get("width"))
    if crossing and style == "zebra" and 1 <= g.length <= 60:
      ways.append(
        dict(key=key, kind="zebra", tags=tags, geometry=mapping(g), width=width or 3.0)
      )
    elif curbs.eligible(tags, g.length):
      height = parse_osm_measure_m(tags.get("kerb:height", tags.get("height")))
      if height is not None and not 0 < height <= 0.18:
        continue  # Tall boundary walls need their own complete walking solids.
      ways.append(
        dict(
          key=key, kind="kerb", tags=tags, geometry=mapping(g), height=height or 0.12
        )
      )
  access_tree = shapely.STRtree([g for g, _ in access])
  for f in ways:
    if f["kind"] != "kerb":
      continue
    g = shape(f["geometry"])
    gaps = [
      access[int(i)][0].buffer(access[int(i)][1])
      for i in access_tree.query(g.buffer(3))
    ]
    f["access"] = mapping(unary_union(gaps).intersection(g.buffer(0.4)))
  target = unary_union([shape(f["geometry"]).buffer(8) for f in ways])
  write(
    SOURCE,
    dict(
      schemaVersion=1,
      source="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      license="ODbL-1.0",
      features=sorted(ways, key=lambda f: f["key"]),
      oldPaint=mapping(paint.intersection(target)),
      oldKerbs=mapping(kerbs.intersection(target)),
      inputs={str(p.relative_to(ROOT)): curbs.base.digest(p) for p in paths},
      policy="Only retained OSM zebra crossing ways and explicit raised/regular or height-tagged short kerbs. No inferred crossings, traffic state, sidewalk or carriageway. Mapped lowered/flush kerbs are never raised.",
    ),
  )


def crossing_road_evidence() -> None:
  """Recover only already emitted crossings' path-cut road intersections.

  The original exporter subtracts path sheets from road sheets. Freeze the
  original OSM road corridor so restoration cannot spread along a sidewalk.
  """
  source, evidence = read(SOURCE), read(EVIDENCE)
  owners = {}
  for entry in evidence["emitted"]:
    owners[entry["packet"]] = [
      r["key"] for r in entry["records"] if r["kind"] == "zebra"
    ]
  # This same evidenced Friedenstraße crossing had no native paint at all:
  # the old path subtraction removed its complete native road support.
  frieden = "way/1266275581"
  if frieden in owners.get("drawn:8_-1", []):
    native = owners.setdefault("minecraft:8_-1", [])
    if frieden not in native:
      native.append(frieden)
  source["crossingPackets"] = owners
  keys = {key for values in owners.values() for key in values}
  candidates = [f for f in source["features"] if f["key"] in keys]
  bands = [shape(f["geometry"]).buffer(f["width"] / 2, cap_style=2) for f in candidates]
  tree = shapely.STRtree(bands)
  matches: dict[str, list] = {f["key"]: [] for f in candidates}
  rows = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/candidate.gpkg", layer="lines", where="highway IS NOT NULL"
  ).to_crs(25833)
  for row in rows.to_dict("records"):
    tags = curbs.tags(row)
    if tags.get(
      "highway"
    ) not in transport.VEHICULAR_HIGHWAYS or not transport.at_grade(tags):
      continue
    width = road_width_m(tags)
    if width is None:
      continue
    course = curbs.world(row["geometry"])
    corridor = course.buffer(width / 2, cap_style=1, join_style=1, quad_segs=3)
    for i in tree.query(corridor, predicate="intersects"):
      matches[candidates[i]["key"]].append(
        dict(
          key="way/" + row["osm_id"],
          tags=tags,
          width=width,
          widthSource=road_width_source(tags),
          geometry=mapping(course),
        )
      )
  for f in candidates:
    f["crossedRoads"] = matches[f["key"]]
  write(SOURCE, source)


def road_crossing(f: dict) -> Any:
  return unary_union(
    [
      shape(r["geometry"]).buffer(
        r["width"] / 2, cap_style=1, join_style=1, quad_segs=3
      )
      for r in f.get("crossedRoads", [])
    ]
  ).intersection(shape(f["geometry"]).buffer(f["width"] / 2, cap_style=2))


def surface_layers(packet: dict) -> tuple[Any, Any, Any]:
  """Read actual flat city faces, independently in each delivered family."""
  road, floor, paths = [], [], []
  road_rgb = linear_rgb_bytes(np.asarray([[109, 112, 109]], dtype=np.uint8))[0]
  path_rgb = linear_rgb_bytes(np.asarray([[201, 190, 162]], dtype=np.uint8))[0]
  for mesh in packet["meshes"]:
    if mesh["kind"] != "city":
      continue
    vertices = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
      + packet["origin"]
    )
    ids = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    colour = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
    triangles = vertices[ids]
    flat = (
      (np.ptp(triangles[:, :, 1], axis=1) < 0.001)
      & (triangles[:, 0, 1] >= 3)
      & (triangles[:, 0, 1] <= 3.12)
    )
    for i in np.flatnonzero(flat):
      poly = Polygon(triangles[i][:, [0, 2]])
      if poly.area < 1e-8:
        continue
      floor.append(poly)
      if abs(triangles[i, 0, 1] - 3.09) < 0.001 and np.all(colour[ids[i]] == road_rgb):
        road.append(poly)
      if abs(triangles[i, 0, 1] - 3.12) < 0.001 and np.all(colour[ids[i]] == path_rgb):
        paths.append(poly)
  return unary_union(road), unary_union(floor), unary_union(paths)


def surfaces(packet: dict) -> tuple[Any, Any]:
  road, floor, _ = surface_layers(packet)
  return road, floor


def protected_ground(packet: dict) -> Any:
  """Retain higher floors/paint from earlier authored street mesh parts."""
  result = []
  for mesh in packet["meshes"]:
    if mesh["kind"] == "city":
      continue
    vertices = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
      + packet["origin"]
    )
    ids = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    triangles = vertices[ids]
    higher = (
      (np.ptp(triangles[:, :, 1], axis=1) < 0.001)
      & (triangles[:, 0, 1] >= 3.15)
      & (triangles[:, 0, 1] <= 3.5)
    )
    for tri in triangles[higher]:
      poly = Polygon(tri[:, [0, 2]])
      if poly.area > 1e-8:
        result.append(poly)
  return unary_union(result)


def native_pixels(polygon: Any, support: Any) -> Any:
  """Independent contained quarter-metre faces, with lossless run compaction."""
  if polygon.is_empty:
    return polygon
  shapely.prepare(polygon)
  shapely.prepare(support)
  x0, z0, x1, z1 = polygon.bounds
  result = []
  for iz in range(math.floor(z0 * 4), math.ceil(z1 * 4)):
    start = None
    for ix in range(math.floor(x0 * 4), math.ceil(x1 * 4) + 1):
      p = box(ix / 4, iz / 4, (ix + 1) / 4, (iz + 1) / 4)
      eligible = polygon.covers(p) and support.covers(p)
      if eligible and start is None:
        start = ix
      if not eligible and start is not None:
        result.append(box(start / 4, iz / 4, ix / 4, (iz + 1) / 4))
        start = None
  return unary_union(result).simplify(0, preserve_topology=True)


def zebra(line: Any, width: float) -> Any:
  """Keep source course; half-metre bars/gaps are presentation estimates."""
  bars = []
  for part in line_parts(line):
    for at in range(math.floor(part.length)):
      p = part.interpolate(at + 0.5)
      tx, tz = transport.tangent(part, p)
      bar = LineString(
        [
          (p.x - tz * width / 2, p.y + tx * width / 2),
          (p.x + tz * width / 2, p.y - tx * width / 2),
        ]
      )
      bars.append(bar.buffer(0.25, cap_style=2))
  return unary_union(bars)


def build() -> dict:
  """Prepare finite additive meshes; original packets are never rewritten."""
  source = read(SOURCE)
  old_paint, old_kerbs = (shape(source[k]) for k in ("oldPaint", "oldKerbs"))
  fs = source["features"]
  source_geometries = [shape(f["geometry"]) for f in fs]
  tree = shapely.STRtree(source_geometries)
  manifest = read(OUT / "manifest.json")
  packets, receipts, emitted, counts = {}, {}, [], Counter()
  for entry in manifest["chunks"]:
    if entry.get("detailCompanionOf"):
      continue
    bound = box(*entry["bounds"])
    candidates = [int(i) for i in tree.query(bound, predicate="intersects")]
    if not candidates:
      continue
    for family in ("drawn", "minecraft"):
      path = OUT / entry[family]["url"]
      packet = read(path)
      if packet["nav"]["groundY"] != 3 or packet["origin"][1] != -10:
        continue
      ox, _, oz = packet["origin"]
      ground = unary_union(
        [
          translate(Polygon(p["ring"], p["holes"]), ox, oz)
          for p in packet["nav"]["ground"]
        ]
      )
      if ground.is_empty:
        continue
      road, floor, paths = surface_layers(packet)
      protected = protected_ground(packet).buffer(0.02)
      road = (
        road.intersection(ground)
        .difference(old_paint.buffer(0.05))
        .difference(protected)
      )
      blocked = unary_union(
        [
          translate(Polygon(p["ring"], p.get("holes", [])), ox, oz).buffer(0.2)
          for p in packet["nav"]["buildings"]
        ]
      )
      floor = (
        floor.intersection(ground)
        .difference(blocked)
        .difference(old_kerbs.buffer(0.05))
      )
      mesh = PackedMesh(ox, oz)
      owners = []
      records = []
      for i in candidates:
        f, course = fs[i], source_geometries[i]
        if f["kind"] == "zebra":
          if f["key"] not in source["crossingPackets"].get(
            family + ":" + entry["id"], []
          ):
            continue
          repair = (
            road_crossing(f)
            .intersection(paths)
            .intersection(ground)
            .intersection(bound.buffer(-0.02))
            .difference(blocked)
            .difference(old_paint.buffer(0.05))
            .difference(protected)
          )
          if family == "minecraft":
            repair = native_pixels(repair, paths)
          support = road.union(repair)
          poly = (
            zebra(course, f["width"])
            .intersection(support.buffer(-0.02))
            .intersection(bound.buffer(-0.02))
          )
          if family == "minecraft":
            poly = native_pixels(poly, support)
          if poly.area < 0.1:
            continue
          if not repair.is_empty:
            mesh.surface(repair, 3.15, ASPHALT)
            records.append(
              dict(
                key=f["key"],
                kind="crossing-asphalt",
                geometry=mapping(repair),
                lowY=3.15,
                topY=3.15,
              )
            )
          mesh.surface(poly, 3.18, WHITE)
          counts[family + "ZebraWays"] += 1
          record = dict(
            key=f["key"],
            kind="zebra",
            geometry=mapping(poly),
            lowY=3.18,
            topY=3.18,
            visibilityProbe=list(
              poly.intersection(repair).buffer(-0.03).representative_point().coords
            )[0]
            if not poly.intersection(repair).buffer(-0.03).is_empty
            else None,
          )
        else:
          course = (
            course.difference(shape(f["access"]).buffer(0.18))
            .intersection(floor.buffer(-0.18))
            .intersection(bound.buffer(-0.18))
          )
          if course.length < 0.5:
            continue
          # The native step follows the mapped course with its own cells;
          # enlarge only to half a metre so full quarter-metre cells can fit.
          poly = (
            course.buffer(0.11 if family == "drawn" else 0.25, cap_style=2)
            .intersection(floor)
            .difference(shape(f["access"]).buffer(0.02))
          )
          if family == "minecraft":
            poly = native_pixels(poly, floor)
          if poly.area < 0.05:
            continue
          high = 3.12 + f["height"]
          mesh.surface(poly, high, STONE)
          for line in line_parts(poly.boundary):
            for a, b in zip(line.coords, list(line.coords)[1:]):
              p = [
                (a[0], 3, a[1]),
                (b[0], 3, b[1]),
                (b[0], high, b[1]),
                (a[0], high, a[1]),
              ]
              mesh.triangle([p[0], p[1], p[2]], STONE)
              mesh.triangle([p[0], p[2], p[3]], STONE)
          counts[family + "KerbWays"] += 1
          record = dict(
            key=f["key"], kind="kerb", geometry=mapping(poly), lowY=3, topY=high
          )
        owners.append(f["key"])
        records.append(record)
      payload = mesh.payload(KIND)
      if not payload:
        continue
      key = family + ":" + entry["id"]
      packets[key] = dict(
        origin=packet["origin"],
        guard=curbs.ground_guard(packet["nav"]["ground"]),
        mesh=payload,
      )
      receipts[key] = dict(
        url=str(path.relative_to(ROOT)),
        sha256=curbs.base.digest(path),
        sourceWays=sorted(set(owners)),
        meshCount=len(packet["meshes"]),
      )
      emitted.append(dict(packet=key, records=records))
      counts[family + "Vertices"] += len(mesh.vertices)
      counts[family + "Bytes"] += sum(
        len(base64.b64decode(payload[k])) for k in ("positions", "colors", "indices")
      )
  write(
    OUTPUT,
    dict(
      schemaVersion=1,
      sourceSha256=curbs.base.digest(SOURCE),
      ids=sorted(packets),
      packets=packets,
    ),
  )
  report = dict(
    sourceSha256=curbs.base.digest(SOURCE),
    outputSha256=curbs.base.digest(OUTPUT),
    counts=dict(counts),
    packets=receipts,
    emitted=emitted,
    originalGeometryRetained=True,
    extraManifestEntries=0,
    estimates="Unmapped crossing width 3m, zebra bars/gaps .5m; kerb width .22m drawn/.5m independent native course, untagged rise .12m above retained pavement datum; conservative mapped-access clearances. Restore asphalt only where the original source road corridor and evidenced zebra band intersect an actual 3.12m path face; repair3.15m/paint3.18m keep centimetre-quantized layers distinct. No inferred zebras, new signals or road footprint expansion.",
  )
  write(EVIDENCE, report)
  return report


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  parser.add_argument("--crossing-road-evidence", action="store_true")
  args = parser.parse_args()
  if args.extract or not SOURCE.exists():
    extract()
  if args.crossing_road_evidence or "crossingPackets" not in read(SOURCE):
    crossing_road_evidence()
  print(json.dumps(build()["counts"], indent=2))
