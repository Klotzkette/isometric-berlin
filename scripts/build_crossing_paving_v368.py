"""Repair false pedestrian paving inside OpenStreetMap unmarked asphalt crossings.

Run from the repository root with uv run python -m scripts.build_crossing_paving_v368.
Mesh support, elevations and centimetre precision come from the actual drawn tiles.
"""

import base64
import json
import zlib
from collections import Counter

import numpy as np
import pyogrio
import shapely
from shapely.geometry import box

from isometric_berlin.generation.road_geometry import road_width_m
from scripts import build_city_streets_v249 as streets
from scripts import build_house_curbs_v233 as curbs
from scripts.build_surrounding_outlines import PackedMesh, linear_rgb_bytes
from scripts.ring_paving_scope_v368 import regions, scope

DATA, GEO, OUT = streets.DATA, streets.GEO, streets.OUT
OSM = GEO / "raw/outer-v159/candidate.gpkg"
PATH_RGB = linear_rgb_bytes(np.array([[201, 190, 162]], np.uint8))[0]
ASPHALT = (109, 112, 109)
ROAD_CLASSES = {
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  "service",
  "living_street",
}


def projected(rows):
  geometry = rows.to_crs(25833).geometry.affine_transform(
    [1, 0, 0, -1, -389500, 5820000]
  )
  return rows.set_geometry(geometry).loc[shapely.intersects(geometry.array, scope())]


def candidates():
  ways = projected(
    pyogrio.read_dataframe(
      OSM,
      layer="lines",
      where="highway IN ('footway','cycleway','path') AND other_tags LIKE '%unmarked%'",
    )
  )
  roads = projected(
    pyogrio.read_dataframe(
      OSM,
      layer="lines",
      where="highway IN ("
      + ",".join("'" + c + "'" for c in sorted(ROAD_CLASSES))
      + ")",
    )
  ).to_dict("records")
  axes = shapely.STRtree([r["geometry"] for r in roads])
  crossings = []
  for row in ways.to_dict("records"):
    tags = curbs.tags(row)
    if not (
      tags.get(tags["highway"]) == "crossing"
      and tags.get("crossing") == "unmarked"
      and tags.get("crossing:markings", "no") == "no"
      and streets.transport.at_grade(tags)
      and tags.get("surface") in {None, "asphalt"}
      and not tags.get("traffic_calming")
    ):
      continue
    centre = row["geometry"]
    if not 1 <= centre.length <= 70:
      continue
    band = centre.buffer(road_width_m(tags) / 2, cap_style="flat", quad_segs=3)
    road_ids, corridors = [], []
    for index in sorted(axes.query(centre, predicate="intersects")):
      road = roads[index]
      t = curbs.tags(road)
      if not (
        streets.transport.at_grade(t)
        and (t.get("surface") == "asphalt" or tags.get("surface") == "asphalt")
        and t.get("surface") in {None, "asphalt"}
        and not t.get("traffic_calming")
      ):
        continue
      road_ids.append(road["osm_id"])
      corridors.append(road["geometry"].buffer(road_width_m(t) / 2, quad_segs=3))
    if corridors:
      geometry = band.intersection(shapely.union_all(corridors)).intersection(scope())
      if geometry.area > 0.2:
        crossings.append((row["osm_id"], road_ids, geometry))
  return sorted(crossings, key=lambda row: int(row[0]))


def path_tree(packet):
  """Exact triangles only: skip decorations, existing road, buildings and rail."""
  support = []
  for mesh in packet["meshes"]:
    if mesh["kind"] != "city" or mesh.get("colorType", "u8") != "u8":
      continue
    pos = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
    ids = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    rgb = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
    eligible = (pos[:, 1] == 1312) & np.all(rgb == PATH_RGB, axis=1)
    subset = ids[np.all(eligible[ids], axis=1)]
    if len(subset):
      coords = pos[:, [0, 2]] / 100 + np.asarray(packet["origin"])[[0, 2]]
      triangles = shapely.polygons(coords[subset])
      support.extend(triangles[shapely.area(triangles) > 1e-8])
  return shapely.STRtree(support)


def surface_guard(packet):
  crc = 0
  for mesh in packet["meshes"]:
    if mesh["kind"] == "city":
      for key in ("positions", "colors", "indices"):
        crc = zlib.crc32(mesh[key].encode("ascii"), crc)
  return crc


def asset(name, obj):
  (DATA / (name + ".json")).write_text(json.dumps(obj, separators=(",", ":")) + "\n")


def build():
  crossings = candidates()
  shapes = shapely.STRtree([r[2] for r in crossings])
  print(f"{len(crossings)} OSM asphalt crossings in scope", flush=True)
  manifest = streets.read(OUT / "manifest.json")
  protected, _, _, _ = streets.earlier()
  # Exclude other owners' marked or elevated street work even in older base packets.
  shards, owners, covered, points = {}, {}, {}, {}
  counts = Counter()
  areas = Counter()
  for tile in manifest["chunks"]:
    if tile.get("detailCompanionOf") or tile["id"] in {"3_-3", "4_-3"}:
      continue
    clip = box(*tile["bounds"])
    relevant = sorted(shapes.query(clip, predicate="intersects"))
    if not relevant:
      continue
    packet = streets.read(OUT / tile["drawn"]["url"])
    if (
      packet["nav"]["groundY"] != 3
      or packet["origin"][1] != -10
      or not packet["nav"].get("roads")
    ):
      continue
    paths = path_tree(packet)
    if not len(paths):
      continue
    taken = streets.protected_ground(packet).union(protected.intersection(clip))
    parts, records = [], []
    for i in relevant:
      osmid, roadids, geom = crossings[i]
      hits = paths.query(geom, predicate="intersects")
      if not len(hits):
        continue
      patch = (
        shapely.union_all(paths.geometries.take(hits))
        .intersection(geom)
        .difference(taken)
      )
      if patch.area < 0.2:
        continue
      parts.append(patch)
      records.append(osmid)
      covered[osmid] = roadids
      point = patch.representative_point()
      points.setdefault(osmid, (round(point.x, 2), round(point.y, 2)))
    if not parts:
      continue
    patch = shapely.union_all(parts, grid_size=0.01)
    origin = packet["origin"]
    mesh = PackedMesh(origin[0], origin[2])
    mesh.surface(patch, 3.15, ASPHALT)
    payload = mesh.payload("unmarked-crossings-v368")
    if not payload:
      continue
    # Compact monochrome horizontal surface; redundant Y and RGB are reconstructed at load.
    packed = np.frombuffer(base64.b64decode(payload["positions"]), "<u2").reshape(-1, 3)
    faces = np.frombuffer(base64.b64decode(payload["indices"]), "<u4").reshape(-1, 3)
    # Winding is certified after centimetre packing: a sliver beside a kerb
    # can collapse or flip when the source triangle is finally quantized.
    xz = packed[:, [0, 2]].astype(np.int64)
    ab = xz[faces[:, 1]] - xz[faces[:, 0]]
    ac = xz[faces[:, 2]] - xz[faces[:, 0]]
    turn = ab[:, 0] * ac[:, 1] - ac[:, 0] * ab[:, 1]
    oriented = faces.copy()
    oriented[turn > 0] = faces[turn > 0, ::-1]
    indices = oriented[turn != 0].reshape(-1)
    assert len(packed) < 65535
    shard = str((int(origin[0]) // 512 + 3 * (int(origin[2]) // 512)) % 8)
    owners[tile["id"]] = int(shard)
    shards.setdefault(shard, {})[tile["id"]] = {
      "origin": origin,
      "roadsGuard": curbs.ground_guard(packet["nav"]["roads"]),
      "surfaceGuard": surface_guard(packet),
      "xz": base64.b64encode(packed[:, [0, 2]].astype("<u2").tobytes()).decode(),
      "indices": base64.b64encode(indices.astype("<u2").tobytes()).decode(),
    }
    areas[tile["id"]] = round(patch.area, 2)
    counts["vertices"] += len(packed)
    counts["triangles"] += len(indices) // 3
  asset("crossingPavingOwnersV368", owners)
  for k, shard in shards.items():
    asset("crossingPavingV368_" + k, shard)
  zone_counts = {
    key: sum(polygon.covers(shapely.Point(pt)) for pt in points.values())
    for key, polygon in regions().items()
  }
  report = dict(
    source="OpenStreetMap / Geofabrik Berlin, 2026-09-29",
    license="ODbL-1.0",
    sourceGpkgSHA256=curbs.base.digest(OSM),
    coordinates="viewer x/z metres",
    uniqueWays=len(covered),
    tiles=len(owners),
    squareMetres=round(sum(areas.values()), 2),
    zoneCounts=zone_counts,
    geometry=dict(counts),
    tileAreas=areas,
    crossings={
      key: [covered[key], list(points[key])] for key in sorted(covered, key=int)
    },
  )
  streets.write(GEO / "unmarked-crossings-v368-evidence.json.gz", report)
  print(
    {key: v for key, v in report.items() if key not in {"tileAreas", "crossings"}},
    flush=True,
  )


if __name__ == "__main__":
  build()
