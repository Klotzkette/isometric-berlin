"""Bounded six-street edge and traffic-signal refinements on retained surfaces."""

from __future__ import annotations

import base64
import json
import math
from collections import Counter
from typing import Any

import numpy as np
import pyogrio
import shapely
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import nearest_points, unary_union

from scripts import build_city_streets_v249 as city
from scripts import build_citywest_streets_v235 as west
from scripts.build_surrounding_outlines import polygons_from_geometry

curbs, transport = city.curbs, city.transport
ROOT, GEO, DATA, OUT = city.ROOT, city.GEO, city.DATA, city.OUT
SOURCE = GEO / "main-streets-v254-source.json.gz"
EVIDENCE = GEO / "main-streets-v254-evidence.json.gz"
OUTPUT = DATA / "mainStreetEdgesV254.json"
SIGNALS = DATA / "mainStreetSignalsV254.json"
NAMES = (
  "Kastanienallee",
  "Torstraße",
  "Danziger Straße",
  "Kurfürstendamm",
  "Tauentzienstraße",
  "Kantstraße",
)
KIND = "main-street-edges-v254"


def extract() -> None:
  """Retain complete named ways and nearby explicit controls/access gaps."""
  raw = GEO / "raw/outer-v159/candidate.gpkg"
  rows = pyogrio.read_dataframe(raw, layer="lines", where="highway IS NOT NULL").to_crs(
    25833
  )
  roads, access = [], []
  for row in rows.to_dict("records"):
    tags = curbs.tags(row)
    if not transport.at_grade(tags):
      continue
    g = curbs.world(row["geometry"])
    if tags.get("highway") in transport.VEHICULAR_HIGHWAYS:
      roads.append(dict(key="way/" + row["osm_id"], tags=tags, geometry=mapping(g)))
    elif tags.get("footway") == "crossing" or tags.get("cycleway") == "crossing":
      access.append(g.buffer(1.8))
  named = [r for r in roads if r["tags"].get("name") in NAMES]
  scope = unary_union(
    [
      shape(r["geometry"]).buffer(
        transport.road_width_m(r["tags"]) / 2 + 3, cap_style=2
      )
      for r in named
    ]
  )
  context = scope.buffer(35)
  shapely.prepare(context)
  nearby = [r for r in roads if shape(r["geometry"]).intersects(context)]
  rows = pyogrio.read_dataframe(
    transport.PBF, layer="points", bbox=(13.26, 52.48, 13.47, 52.56)
  ).to_crs(25833)
  signals = []
  for row in rows.to_dict("records"):
    tags = curbs.tags(row)
    if tags.get("highway") != "traffic_signals":
      continue
    g = curbs.world(row["geometry"])
    if context.contains(g) and scope.distance(g) < 12:
      signals.append(dict(key="node/" + row["osm_id"], tags=tags, geometry=mapping(g)))
  city.write(
    SOURCE,
    dict(
      source="Retained Geofabrik Berlin OpenStreetMap, 2026-09-29; ODbL-1.0",
      rawSha256=curbs.base.digest(raw),
      pbfSha256=curbs.base.digest(transport.PBF),
      named=named,
      roads=nearby,
      signals=signals,
      scope=mapping(scope),
      access=mapping(
        unary_union([g for g in access if context.intersects(g)]).intersection(
          scope.buffer(3)
        )
      ),
    ),
  )


def usable_edge(road: Any, floor: Any, allowed: Any, axes: list[dict]) -> Any:
  """Exclude cuts across a road: only longitudinal, supported boundaries."""
  pieces = []
  for line in city.line_parts(road.boundary.intersection(allowed)):
    for a, b in zip(line.coords, list(line.coords)[1:]):
      segment = LineString([a, b])
      if segment.length < 0.5:
        continue
      mid = segment.interpolate(0.5, normalized=True)
      nearest = min(axes, key=lambda r: r["g"].distance(mid))
      tx, tz = transport.tangent(nearest["g"], mid)
      sx, sz = (b[0] - a[0]) / segment.length, (b[1] - a[1]) / segment.length
      if abs(tx * sx + tz * sz) >= 0.85:
        pieces.append(segment)
  return unary_union(pieces).intersection(floor.buffer(-0.13))


def build() -> dict:
  """Append small meshes; keep every delivered city packet immutable."""
  source = city.read(SOURCE)
  axes = [{**r, "g": shape(r["geometry"])} for r in source["named"]]
  scope, access = shape(source["scope"]), shape(source["access"])
  _, old_kerbs, _, _ = city.earlier()
  previous = city.read(city.EVIDENCE)
  old_kerbs = old_kerbs.union(
    unary_union(
      [
        shape(r["geometry"]).buffer(0.2)
        for entry in previous["emitted"]
        for r in entry["records"]
        if r["kind"] == "kerb"
      ]
    )
  )
  # The dedicated DGM Weinberg field is already detailed: do not attach a flat
  # ordinary-ground curb to that slope. Its existing details remain untouched.
  terrain = box(*city.read(DATA / "weinbergTerrainV176.json")["support"])
  allowed = scope.difference(access).difference(old_kerbs).difference(terrain)
  entries = city.read(OUT / "manifest.json")["chunks"]
  packets, receipts, emitted, counts = {}, {}, [], Counter()
  supports: dict[str, list] = {"drawn": [], "minecraft": []}
  floors: dict[str, list] = {"drawn": [], "minecraft": []}
  for entry in entries:
    if entry.get("detailCompanionOf") or not box(*entry["bounds"]).intersects(scope):
      continue
    for family in ("drawn", "minecraft"):
      path = OUT / entry[family]["url"]
      packet = city.read(path)
      if packet["origin"][1] != -10 or packet["nav"]["groundY"] != 3:
        continue
      ox, _, oz = packet["origin"]
      ground = unary_union(
        [
          translate(Polygon(p["ring"], p["holes"]), ox, oz)
          for p in packet["nav"]["ground"]
        ]
      )
      road, floor, paths = city.surface_layers(packet)
      if road.is_empty:
        continue
      blocked = unary_union(
        [
          translate(Polygon(p["ring"], p.get("holes", [])), ox, oz).buffer(0.2)
          for p in packet["nav"]["buildings"]
        ]
      )
      road = road.intersection(ground)
      floor = floor.intersection(ground).difference(blocked)
      supports[family].append(road.intersection(scope.buffer(30)))
      floors[family].append(paths.intersection(floor).intersection(scope.buffer(30)))
      safe = (
        allowed.intersection(box(*entry["bounds"]).buffer(-0.5))
        .intersection(ground.buffer(-0.5))
        .difference(blocked)
        .difference(city.protected_ground(packet).buffer(0.2))
      )
      course = usable_edge(road, floor, safe, axes)
      poly = course.buffer(0.11 if family == "drawn" else 0.27, cap_style=2)
      poly = poly.intersection(floor).intersection(safe)
      if family == "minecraft":
        # Rasterise each narrow piece, avoiding a city-wide bounding-box loop.
        poly = unary_union(
          [city.native_pixels(p, floor) for p in polygons_from_geometry(poly)]
        )
      if poly.area < 0.05:
        continue
      mesh = city.PackedMesh(ox, oz)
      mesh.surface(poly, 3.24, city.STONE)
      for line in city.line_parts(poly.boundary):
        for a, b in zip(line.coords, list(line.coords)[1:]):
          p = [
            (a[0], 3.09, a[1]),
            (b[0], 3.09, b[1]),
            (b[0], 3.24, b[1]),
            (a[0], 3.24, a[1]),
          ]
          mesh.triangle(p[:3], city.STONE)
          mesh.triangle([p[0], p[2], p[3]], city.STONE)
      key = family + ":" + entry["id"]
      payload = mesh.payload(KIND)
      packets[key] = dict(
        origin=packet["origin"],
        guard=curbs.ground_guard(packet["nav"]["ground"]),
        mesh=payload,
      )
      receipts[key] = dict(
        url=str(path.relative_to(ROOT)), sha256=curbs.base.digest(path)
      )
      emitted.append(
        dict(
          packet=key,
          geometry=mapping(poly),
          support=mapping(floor.intersection(poly.buffer(0.5))),
        )
      )
      counts[family + "LengthM"] += round(course.length, 2)
      counts[family + "Bytes"] += sum(
        len(base64.b64decode(payload[k])) for k in ("positions", "colors", "indices")
      )
  city.write(
    OUTPUT,
    dict(
      schemaVersion=1,
      sourceSha256=curbs.base.digest(SOURCE),
      ids=sorted(packets),
      packets=packets,
    ),
  )
  signal_records, signal_support, signal_heights = signal_placements(
    source, supports, floors
  )
  city.write(
    SIGNALS, dict(schemaVersion=1, source=source["source"], signals=signal_records)
  )
  counts["signals"] = len(signal_records)
  report = dict(
    sourceSha256=curbs.base.digest(SOURCE),
    counts=dict(counts),
    packets=receipts,
    emitted=emitted,
    signals=signal_records,
    signalSupport=signal_support,
    signalHeightReceipts=signal_heights,
    retainedRoads=len(axes),
    preservedManifestSha256=curbs.base.digest(OUT / "manifest.json"),
    estimates="Curb width .22m, rise .15m; orthogonal native .25m raster. Signal verge offsets/orientation without directional tags are display estimates, not surveyed pole locations.",
  )
  city.write(EVIDENCE, report)
  return report


def signal_placements(
  source: dict, supports: dict, floors: dict
) -> tuple[list[dict], dict, list[dict]]:
  """Use mapped controls, exterior road verges, and actual delivered support."""
  west_road, west_native, _ = west.supports()
  west_paving = city.read(DATA / "westSquaresV188Detail.json")
  west_floor = unary_union(
    [Polygon(p[0], p[1:]) for r in west_paving["paving"] for p in r["polygons"]]
  )
  road = unary_union(supports["drawn"]).union(west_road)
  floor = unary_union(floors["drawn"]).union(west_floor)
  west_native_floor = unary_union(
    [
      box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)
      for x, y, z, w, h, d, yaw, c in west_paving["nativePaving"]
      if abs(y + h / 2 - 5.58) < 0.001
    ]
  )
  native_floor = unary_union(floors["minecraft"]).union(west_native_floor)
  all_carriageways = road.union(unary_union(supports["minecraft"])).union(west_native)
  terrain = box(*city.read(DATA / "weinbergTerrainV176.json")["support"])
  safe = (
    floor.intersection(native_floor)
    .difference(all_carriageways.buffer(0.4))
    .difference(terrain)
  )
  roads = [{**r, "g": shape(r["geometry"])} for r in source["roads"]]
  records = []
  for f in source["signals"]:
    point = shape(f["geometry"])
    if not floor.buffer(1).contains(point):
      continue
    target = (
      point if safe.contains(point) else nearest_points(point, safe.buffer(-0.15))[1]
    )
    if target.distance(point) > 18:
      continue
    x, z = round(target.x, 1), round(target.y, 1)
    target = Point(x, z)
    if not safe.contains(target):
      continue
    r = min(roads, key=lambda r: r["g"].distance(point))
    tx, tz = transport.tangent(r["g"], point)
    direction = f["tags"].get("traffic_signals:direction")
    connected = r["g"].distance(point) < 0.35
    if connected and direction in ("forward", "backward"):
      forward, evidence = direction == "forward", "mapped_direction"
    elif connected and r["tags"].get("oneway") in ("yes", "-1"):
      forward, evidence = r["tags"]["oneway"] == "yes", "mapped_oneway"
    else:
      forward = (target.x - point.x) * (-tz) + (target.y - point.y) * tx >= 0
      evidence = "right_hand_approach_estimate"
    facing = (-tx, -tz) if forward else (tx, tz)
    is_west = west_floor.covers(target)
    records.append(
      dict(
        osm_key=f["key"],
        source_dm=[round(point.x * 10), round(point.y * 10)],
        position_dm=[round(x * 10), round(z * 10)],
        offset_dm=round(point.distance(target) * 10),
        placement="surveyed_verge"
        if point.distance(target) < 0.08
        else "relocated_verge",
        road_clearance_dm=round(road.distance(target) * 10),
        heading_rad=round(math.atan2(*facing), 7),
        refined_v206=True,
        ground_y_m=5.52 if is_west else 3.12,
        native_ground_y_m=5.58 if is_west else 3.12,
        road_key=r["key"],
        direction_evidence=evidence,
      )
    )
  probes = unary_union(
    [
      Point(r["position_dm"][0] / 10, r["position_dm"][1] / 10).buffer(1)
      for r in records
    ]
  )
  proof = dict(
    drawn=mapping(floor.intersection(probes)),
    native=mapping(native_floor.intersection(probes)),
    drawnRoads=mapping(road.intersection(probes)),
    nativeRoads=mapping(
      unary_union(supports["minecraft"]).union(west_native).intersection(probes)
    ),
    westDrawn=mapping(west_floor.intersection(probes)),
    westNative=mapping(west_native_floor.intersection(probes)),
  )
  heights = resolve_signal_support_heights(records)
  return sorted(records, key=lambda r: r["osm_key"]), proof, heights


def resolve_signal_support_heights(records: list[dict]) -> list[dict]:
  """Resolve the top retained pavement, including earlier authored street skins.

  Generic city paths establish the plan footprint but can sit beneath a retained
  3.22 m v163 pavement. Read those complete delivered triangles independently per
  family rather than burying a pole at the generic 3.12 m datum.
  """
  entries = city.read(OUT / "manifest.json")["chunks"]
  cache, receipts = {}, []
  for record in sorted(records, key=lambda record: record["osm_key"]):
    x, z = (v / 10 for v in record["position_dm"])
    point = Point(x, z)
    for family, field in (
      ("drawn", "ground_y_m"),
      ("minecraft", "native_ground_y_m"),
    ):
      nominal = record[field]
      candidates = []
      for entry in entries:
        if not box(*entry["bounds"]).covers(point):
          continue
        key = family + ":" + entry["id"]
        if key not in cache:
          path = OUT / entry[family]["url"]
          packet = city.read(path)
          triangles = []
          for index, mesh in enumerate(packet["meshes"]):
            positions = (
              np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
              .reshape(-1, 3)
              .astype(float)
              / 100
              + packet["origin"]
            )
            indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(
              -1, 3
            )
            points = positions[indices]
            flat = np.ptp(points[:, :, 1], axis=1) < 0.001
            for triangle in np.flatnonzero(flat):
              p = points[triangle]
              poly = Polygon(p[:, [0, 2]])
              if poly.area > 1e-8 and 3 <= p[0, 1] <= 6.5:
                triangles.append((poly, p, index, int(triangle), mesh["kind"]))
          cache[key] = path, triangles
        path, triangles = cache[key]
        for poly, triangle, mesh, index, kind in triangles:
          height = float(triangle[0, 1])
          if nominal - 0.01 <= height <= nominal + 0.5 and poly.covers(point):
            candidates.append(
              (
                height,
                {
                  "osmKey": record["osm_key"],
                  "family": family,
                  "packet": key,
                  "url": str(path.relative_to(ROOT)),
                  "sha256": curbs.base.digest(path),
                  "mesh": mesh,
                  "triangle": index,
                  "kind": kind,
                  "points": np.round(triangle, 2).tolist(),
                },
              )
            )
      assert candidates, (record["osm_key"], family, nominal)
      height, receipt = max(candidates, key=lambda candidate: candidate[0])
      record[field] = round(height, 2)
      receipts.append({**receipt, "height": record[field]})
  return receipts


if __name__ == "__main__":
  if not SOURCE.exists():
    extract()
  print(json.dumps(build()["counts"], indent=2))
