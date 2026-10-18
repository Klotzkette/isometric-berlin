"""Step 10: append short positively mapped curb courses to existing city packets."""

from __future__ import annotations

import argparse
import base64
import json
import math
import re
from collections import Counter, defaultdict
from typing import Any

import numpy as np
import pyogrio
import shapely
from shapely.affinity import affine_transform, translate
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.generation.road_geometry import parse_osm_measure_m
from scripts import build_alt_mitte_transport_v206 as transport
from scripts import build_district_facades_v188 as base
from scripts.build_surrounding_outlines import PackedMesh, line_parts

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
DATA = ROOT / "src/app/src/data"
SCOPE = GEO / "house-districts-v233.geojson"
SOURCE = GEO / "house-curbs-v233-source.json.gz"
EVIDENCE = GEO / "house-curbs-v233-evidence.json.gz"
OUTPUT = DATA / "houseCurbsV233.json"
COLOUR = (214, 210, 197)


def world(g: Any) -> Any:
  return affine_transform(g, [1, 0, 0, -1, -389500, 5820000])


def tags(row: dict) -> dict[str, str]:
  t = dict(re.findall(r'"([^"\\]+)"=>"([^"\\]*)"', str(row.get("other_tags"))))
  for key in ("highway", "barrier", "name"):
    if isinstance(row.get(key), str):
      t[key] = row[key]
  return t


def eligible(t: dict[str, str], length: float) -> bool:
  """Bound complete mapped ways, not arbitrary clipped road-centre offsets."""
  height = parse_osm_measure_m(t.get("kerb:height", t.get("height")))
  return (
    t.get("barrier") == "kerb"
    and 2 <= length <= 120
    and transport.at_grade(t)
    and t.get("kerb") not in ("flush", "lowered", "no", "rolled")
    and (t.get("kerb") in ("raised", "regular") or bool(height and height > 0))
    and not any(k in t for k in ("was:barrier", "disused:barrier"))
  )


def eligible_flat(t: dict[str, str], length: float) -> bool:
  """An explicitly mapped course without a declared rise is only a flat edge."""
  return (
    t.get("barrier") == "kerb"
    and 2 <= length <= 120
    and transport.at_grade(t)
    and not t.get("kerb")
    and not any(
      k in t for k in ("kerb:height", "height", "was:barrier", "disused:barrier")
    )
  )


def extract() -> None:
  """Freeze exact source ways and complete local avoidance evidence."""
  paths = [SCOPE, DATA / "surroundingCityScope.json"]
  scope = unary_union(
    [world(shape(f["geometry"])) for f in base.read_json(SCOPE)["features"]]
  )
  southwest = unary_union(
    [
      world(shape(f["geometry"]))
      for f in base.read_json(SCOPE)["features"]
      if str(f["properties"]["sch"]).startswith("11000006")
    ]
  )
  core = base.read_json(paths[1])["core"]
  # The established core already has continuous raised asphalt edges. This
  # supplement uses only existing ordinary outer packets and no new load entry.
  scope = scope.difference(Polygon(core["ring"], core["holes"]))
  raw = GEO / "raw/outer-v159/candidate.gpkg"
  paths.append(raw)
  rows = pyogrio.read_dataframe(raw, layer="lines", where="barrier = 'kerb'").to_crs(
    25833
  )
  features = []
  for row in rows.to_dict("records"):
    g, t = world(row["geometry"]), tags(row)
    if eligible(t, g.length) and scope.covers(g):
      h = parse_osm_measure_m(t.get("kerb:height", t.get("height")))
      features.append(
        dict(
          key="way/" + row["osm_id"],
          tags=t,
          geometry=mapping(g),
          height=h if h else 0.12,
          heightEstimated=not bool(h),
        )
      )
    elif eligible_flat(t, g.length) and southwest.covers(g):
      features.append(
        dict(
          key="way/" + row["osm_id"],
          tags=t,
          geometry=mapping(g),
          height=0,
          heightEstimated=False,
          presentation="mapped-flat-edge",
        )
      )
  features.sort(key=lambda f: bool(f.get("presentation")))
  target = unary_union([shape(f["geometry"]) for f in features]).buffer(2)
  nearby = target.buffer(0.5)
  shapely.prepare(target)
  shapely.prepare(nearby)
  old = []
  for name in ("districtStreets", "schlossEastStreets"):
    p = DATA / (name + ".json")
    paths.append(p)
    old.extend(LineString(r) for r in base.read_json(p)["curbs_m"])
  p = DATA / "boulevardCurbsV210.json"
  paths.append(p)
  old.extend(LineString([r[:2], r[2:]]) for r in base.read_json(p)["segments"])
  p = DATA / "southKiezV185.json"
  paths.append(p)
  for x, _, z, length, _, _, yaw, colour in base.read_json(p)["boxes"]:
    if colour == 0xCFCBBB:
      dx, dz = math.cos(yaw) * length / 2, -math.sin(yaw) * length / 2
      old.append(LineString([(x - dx, z - dz), (x + dx, z + dz)]))
  p = DATA / "restoredRoadSurfaces.ndjson.txt"
  paths.append(p)
  for line in p.read_text().splitlines()[1:]:
    r = json.loads(line)
    if r["kind"] == "kerbs":
      a = np.frombuffer(base64.b64decode(r["xz"]), "<f4").reshape(-1, 4)
      old.extend(LineString([p[:2], p[2:]]) for p in a)
  p = GEO / "west-streets-v163.json"
  paths.append(p)
  west = unary_union(
    [shape(r["geometry"]).buffer(43) for r in base.read_json(p)["roads"]]
  )
  previous = unary_union(
    [g.buffer(0.5) for g in old if nearby.intersects(g)] + [west]
  ).intersection(target)
  blocked = []
  for folder in ("outer-v159", "ring-v182", "city-v183"):
    p = GEO / f"raw/{folder}/resolved-outlines.gpkg"
    paths.append(p)
    for g in pyogrio.read_dataframe(p, layer="buildings").geometry:
      if g.intersects(target):
        blocked.append(g.buffer(0.3).intersection(target))
    for r in pyogrio.read_dataframe(p, layer="surfaces").to_dict("records"):
      if r["kind"] == "water" and r["geometry"].intersects(target):
        blocked.append(r["geometry"].buffer(0.3).intersection(target))
  access = []
  # Explicit access ways remain open. Two-metre foot/cycle gaps and five-metre
  # vehicle gaps are conservative display clearances, not surveyed opening widths.
  ways = pyogrio.read_dataframe(raw, layer="lines", where="highway IS NOT NULL").to_crs(
    25833
  )
  for row in ways.to_dict("records"):
    g, t = world(row["geometry"]), tags(row)
    if not g.intersects(target) or not transport.at_grade(t):
      continue
    width = (
      1
      if t["highway"] in ("footway", "cycleway", "path", "steps", "pedestrian")
      else 2.5
    )
    access.append(g.buffer(width, cap_style=2).intersection(target))
  base.write_json(
    SOURCE,
    dict(
      features=features,
      previous=mapping(previous),
      blocked=mapping(unary_union(blocked)),
      access=mapping(unary_union(access)),
      scope=mapping(scope.intersection(target)),
      inputs={str(p.relative_to(ROOT)): base.digest(p) for p in paths},
      source="OpenStreetMap Geofabrik Berlin 2026-09-29, ODbL-1.0",
      policy="Complete mapped curb ways 2–120m outside the detailed core; retain original ways and subtract prior curbs, buildings, water and mapped access gaps. Positive rise: .22m width and untagged .12m rise estimates. Steglitz-Zehlendorf ways lacking height/type: .08m flat edge only, no inferred rise.",
    ),
  )


def safe_course(f: dict, source: dict) -> Any:
  excluded = unary_union([shape(source[k]) for k in ("previous", "blocked", "access")])
  return (
    shape(f["geometry"])
    .difference(excluded.buffer(0.18))
    .intersection(shape(source["scope"]).buffer(-0.18))
  )


def slab(mesh: PackedMesh, a: tuple, b: tuple, low: float, high: float) -> None:
  """Only the exposed top and sides; no hidden bottom or per-segment caps."""
  dx, dz = b[0] - a[0], b[1] - a[1]
  length = math.hypot(dx, dz)
  if length < 0.001:
    return
  nx, nz = -dz / length * 0.11, dx / length * 0.11
  p = [
    (a[0] - nx, low, a[1] - nz),
    (b[0] - nx, low, b[1] - nz),
    (a[0] - nx, high, a[1] - nz),
    (b[0] - nx, high, b[1] - nz),
    (a[0] + nx, low, a[1] + nz),
    (b[0] + nx, low, b[1] + nz),
    (a[0] + nx, high, a[1] + nz),
    (b[0] + nx, high, b[1] + nz),
  ]
  for q in ((0, 1, 3, 2), (4, 6, 7, 5), (2, 3, 7, 6)):
    mesh.triangle([p[q[0]], p[q[2]], p[q[1]]], COLOUR)
    mesh.triangle([p[q[0]], p[q[3]], p[q[2]]], COLOUR)


def ground_guard(ground: list[dict]) -> int:
  """Millimetre source-ground identity, shared with the bounded runtime gate."""
  value = 2166136261
  text = "".join(
    "["
    + ";".join(",".join(str(math.floor(v * 1000 + 0.5)) for v in p) for p in ring)
    + "]"
    for polygon in ground
    for ring in [polygon["ring"], *polygon["holes"]]
  )
  for char in text:
    value = ((value ^ ord(char)) * 16777619) & 0xFFFFFFFF
  return value


def flat_ground(packet: dict) -> Any:
  """Read actual delivered near-horizontal base faces, excluding raised relief."""
  patches = []
  for part in packet["meshes"]:
    if part["kind"] != "city":
      continue
    p = (
      np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3) / 100
      + packet["origin"]
    )
    ids = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
    triangles = p[ids]
    keep = (
      (np.ptp(triangles[:, :, 1], axis=1) < 0.011)
      & (np.min(triangles[:, :, 1], axis=1) >= 2.99)
      & (np.max(triangles[:, :, 1], axis=1) <= 3.151)
    )
    patches.extend(
      Polygon(t[:, [0, 2]])
      for t in triangles[keep]
      if Polygon(t[:, [0, 2]]).area > 1e-8
    )
  return unary_union(patches)


def flat_levels(packet: dict, ground: Any) -> dict[float, Any]:
  """Project flat edge ink onto each topmost retained near-ground surface."""
  levels = defaultdict(list)
  for part in packet["meshes"]:
    if part["kind"] != "city":
      continue
    p = (
      np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3) / 100
      + packet["origin"]
    )
    ids = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
    triangles = p[ids]
    keep = (
      (np.ptp(triangles[:, :, 1], axis=1) < 0.011)
      & (triangles[:, 0, 1] >= 2.985)
      & (triangles[:, 0, 1] <= 3.155)
    )
    for t in triangles[keep]:
      y = round(float(t[0, 1]), 2)
      if 2.99 <= y <= 3.15 and np.ptp(t[:, 1]) < 0.011:
        polygon = Polygon(t[:, [0, 2]])
        if polygon.area > 1e-8:
          levels[y].append(polygon)
  covered = Polygon()
  result = {}
  for y in sorted(levels, reverse=True):
    layer = unary_union(levels[y]).intersection(ground)
    result[y] = layer.difference(covered)
    covered = covered.union(layer)
  return result


def flat_ink(mesh: PackedMesh, course: Any, y: float) -> None:
  for line in line_parts(course):
    for a, b in zip(line.coords, list(line.coords)[1:]):
      dx, dz = b[0] - a[0], b[1] - a[1]
      length = math.hypot(dx, dz)
      if length < 0.001:
        continue
      nx, nz = -dz / length * 0.04, dx / length * 0.04
      p = [
        (a[0] - nx, y, a[1] - nz),
        (a[0] + nx, y, a[1] + nz),
        (b[0] + nx, y, b[1] + nz),
        (b[0] - nx, y, b[1] - nz),
      ]
      mesh.triangle([p[0], p[1], p[2]], COLOUR)
      mesh.triangle([p[0], p[2], p[3]], COLOUR)


def build() -> dict:
  """Prepare sidecars; immutable existing packets supply streaming ownership."""
  source = base.read_json(SOURCE)
  manifest = base.read_json(OUT / "manifest.json")
  entries = {r["id"]: r for r in manifest["chunks"]}
  original_ids = {key for key in entries if re.fullmatch(r"-?\d+_-?\d+", key)}
  cell_owners = defaultdict(list)
  for entry in entries.values():
    if entry.get("detailCompanionOf"):
      continue
    x0, z0, x1, z1 = entry["bounds"]
    for iz in range(math.floor(z0 / 512), math.ceil(z1 / 512)):
      for ix in range(math.floor(x0 / 512), math.ceil(x1 / 512)):
        cell_owners[f"{ix}_{iz}"].append(entry["id"])
  by_tile = defaultdict(list)
  exclusions = unary_union(
    [shape(source[k]) for k in ("previous", "blocked", "access")]
  )
  scope = shape(source["scope"])
  shapely.prepare(scope)
  shapely.prepare(exclusions)
  course_exclusion = exclusions.buffer(0.18)
  course_scope = scope.buffer(-0.18)
  for f in source["features"]:
    course = (
      shape(f["geometry"]).difference(course_exclusion).intersection(course_scope)
    )
    for line in line_parts(course):
      lo, lz, hi, hz = line.bounds
      for iz in range(math.floor(lz / 512), math.floor(hz / 512) + 1):
        for ix in range(math.floor(lo / 512), math.floor(hi / 512) + 1):
          key = f"{ix}_{iz}"
          owners = (
            cell_owners[key]
            if f.get("presentation")
            else ([key] if key in original_ids else [])
          )
          for owner in owners:
            x0, z0, x1, z1 = entries[owner]["bounds"]
            part = line.intersection(
              box(
                max(ix * 512, x0) + 0.18,
                max(iz * 512, z0) + 0.18,
                min((ix + 1) * 512, x1) - 0.18,
                min((iz + 1) * 512, z1) - 0.18,
              )
            )
            if part.length > 0.2:
              by_tile[owner].append((f, part))
  packets, receipts, courses = {}, {}, []
  counts = Counter()
  for key, features in sorted(by_tile.items()):
    entry = entries[key]
    for family in ("drawn", "minecraft"):
      path = OUT / entry[family]["url"]
      packet = base.read_json(path)
      ox, oy, oz = packet["origin"]
      assert oy == -10
      ground = unary_union(
        [
          translate(Polygon(p["ring"], p["holes"]), ox, oz)
          for p in packet["nav"]["ground"]
        ]
      )
      # Only flat ordinary ground at the inherited 3m datum is admitted; source
      # elevations elsewhere stay untouched. No new curb is floated over a hill.
      if packet["nav"]["groundY"] != 3:
        continue
      ground = ground.intersection(flat_ground(packet))
      mesh = PackedMesh(ox, oz)
      used = []
      pixels = {}
      for f, part in features:
        if f.get("presentation"):
          continue
        part = part.intersection(ground.buffer(-0.18))
        if part.length < 0.2:
          continue
        used.append(f["key"])
        if family == "drawn":
          courses.append(
            dict(key=f["key"], tile=key, height=f["height"], geometry=mapping(part))
          )
          for line in line_parts(part):
            for a, b in zip(line.coords, list(line.coords)[1:]):
              slab(mesh, a, b, 3.09, 3.09 + f["height"])
        else:
          for line in line_parts(part):
            for a, b in zip(line.coords, list(line.coords)[1:]):
              segment = LineString([a, b])
              n = max(1, math.ceil(segment.length / 0.1))
              for i in range(n + 1):
                p = segment.interpolate(i / n, normalized=True)
                ix, iz = math.floor(p.x * 4), math.floor(p.y * 4)
                square = box(ix / 4, iz / 4, (ix + 1) / 4, (iz + 1) / 4)
                if (
                  ground.covers(square)
                  and not exclusions.intersects(square)
                  and scope.covers(square)
                ):
                  pixels[(ix, iz)] = max(pixels.get((ix, iz), 0), f["height"])
      if family == "minecraft":
        # Union identical-height square pixels before emitting exposed faces.
        # This keeps every pixel, while removing hidden internal run walls.
        heights = defaultdict(list)
        for (ix, iz), height in pixels.items():
          heights[height].append(box(ix / 4, iz / 4, (ix + 1) / 4, (iz + 1) / 4))
        for h, squares in heights.items():
          solid = unary_union(squares)
          compact = solid.simplify(0, preserve_topology=True)
          assert compact.equals(solid)
          solid = shapely.orient_polygons(compact, exterior_cw=True)
          mesh.surface(solid, 3.09 + h, COLOUR)
          for line in line_parts(solid.boundary):
            for a, b in zip(line.coords, list(line.coords)[1:]):
              p = [
                (a[0], 3.09, a[1]),
                (b[0], 3.09, b[1]),
                (b[0], 3.09 + h, b[1]),
                (a[0], 3.09 + h, a[1]),
              ]
              mesh.triangle([p[0], p[1], p[2]], COLOUR)
              mesh.triangle([p[0], p[2], p[3]], COLOUR)
        counts["nativePixels"] += len(pixels)
      flat_features = [(f, part) for f, part in features if f.get("presentation")]
      flat_face_start = len(mesh.indices) // 3
      if flat_features:
        flat_pixels = defaultdict(set)
        for y, level in flat_levels(packet, ground).items():
          for f, original in flat_features:
            part = original.intersection(level.buffer(-0.18))
            if part.length < 0.2:
              continue
            used.append(f["key"])
            if family == "drawn":
              courses.append(
                dict(
                  key=f["key"],
                  tile=key,
                  height=0,
                  groundY=y,
                  presentation="mapped-flat-edge",
                  geometry=mapping(part),
                )
              )
              flat_ink(mesh, part, y + 0.01)
            else:
              for line in line_parts(part):
                for a, b in zip(line.coords, list(line.coords)[1:]):
                  segment = LineString([a, b])
                  n = max(1, math.ceil(segment.length / 0.1))
                  for i in range(n + 1):
                    point = segment.interpolate(i / n, normalized=True)
                    ix, iz = math.floor(point.x * 4), math.floor(point.y * 4)
                    square = box(ix / 4, iz / 4, (ix + 1) / 4, (iz + 1) / 4)
                    if (
                      level.covers(square)
                      and not exclusions.intersects(square)
                      and scope.covers(square)
                    ):
                      flat_pixels[y].add((ix, iz))
        for y, cells in flat_pixels.items():
          surface = unary_union(
            [
              box(ix / 4, iz / 4, (ix + 1) / 4, (iz + 1) / 4)
              for ix, iz in sorted(cells)
            ]
          )
          mesh.surface(surface.simplify(0, preserve_topology=True), y + 0.01, COLOUR)
          counts["nativeFlatPixels"] += len(cells)
      p = mesh.payload("house-curbs-v233")
      if p:
        id = family + ":" + key
        packets[id] = dict(
          origin=packet["origin"], guard=ground_guard(packet["nav"]["ground"]), mesh=p
        )
        receipts[id] = dict(
          url=str(path.relative_to(ROOT)),
          sha256=base.digest(path),
          meshes=len(packet["meshes"]),
          sourceWays=sorted(set(used)),
        )
        if flat_face_start < len(mesh.indices) // 3:
          receipts[id]["flatFaceStart"] = flat_face_start
        counts[family + "Vertices"] += len(mesh.vertices)
        counts[family + "Bytes"] += sum(
          len(base64.b64decode(p[k])) for k in ("positions", "colors", "indices")
        )
  base.write_json(
    OUTPUT,
    dict(
      schemaVersion=1,
      sourceSha256=base.digest(SOURCE),
      ids=sorted(packets),
      packets=packets,
    ),
  )
  evidence = dict(
    sourceSha256=base.digest(SOURCE),
    outputSha256=base.digest(OUTPUT),
    courses=courses,
    packets=receipts,
    counts=dict(counts),
    originalGeometryRetained=True,
    extraManifestEntries=0,
    estimates=".22m raised curb width, untagged .12m rise; .08m flat edge on retained ground +.01m rendering offset without inferred rise; conservative access clearances and native quarter-metre raster",
  )
  base.write_json(EVIDENCE, evidence)
  return evidence


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract or not SOURCE.exists():
    extract()
  print(json.dumps(build()["counts"], indent=2))
