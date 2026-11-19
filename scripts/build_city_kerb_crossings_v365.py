"""Select level/low OSM kerb stones on delivered Berlin road margins (offline)."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from shapely import STRtree
from shapely.affinity import translate
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import substring, unary_union

from scripts.build_alt_mitte_transport_v206 import at_grade
from scripts.build_house_curbs_v233 import (
  DATA,
  GEO,
  OUT,
  base,
  ground_guard,
  tags,
  world,
)
from scripts.build_surrounding_outlines import COLORS, PackedMesh, linear_rgb_bytes

PBF = GEO / "raw/city-v346/berlin-2026-11-13.osm.pbf"
OUTFILE = DATA / "cityKerbCrossingsV365.json"
RECEIPTS = GEO / "city-kerb-crossings-v365.json.gz"
KIND = "crossing-kerb-stones-v365"
DISTRICTS = set(
  "Mitte|Friedrichshain-Kreuzberg|Pankow|Charlottenburg-Wilmersdorf|Spandau|Steglitz-Zehlendorf|Tempelhof-Schöneberg|Neukölln|Treptow-Köpenick|Marzahn-Hellersdorf|Lichtenberg|Reinickendorf".split(
    "|"
  )
)
DRIVABLE = (
  "primary",
  "secondary",
  "tertiary",
  "residential",
  "unclassified",
  "living_street",
)
SWATCHES = ((188, 186, 176), (195, 193, 182), (185, 184, 176))
# A projection of the final streaming mesh (all regional detail admitted) found
# pre-existing higher visible faces at these six mapped courses. Reserve their
# sample locations but do not ship a second, partly hidden representation.
COVERED_WAYS = {
  "1450921758": "Waldemarstraße",
  "1450914433": "Mariannenplatz",
  "1264804564": "Manteuffelstraße",
  "1328822813": "Biesenbrower Straße",
  "452784733": "Sonnenallee",
  "992191335": "Urbanstraße",
}
MAX_PER_DISTRICT = 16
STONE_HALF_WIDTH = 0.125
DISPLAY_LIFT = 0.012


def frame(cache, name, layer, query):
  file = cache / f"{name}.gpkg"
  if file.exists():
    return pyogrio.read_dataframe(file)
  result = pyogrio.read_dataframe(PBF, layer=layer, where=query).to_crs(25833)
  pyogrio.write_dataframe(result, file, driver="GPKG")
  return result


def prior_geometry():
  lines = []
  for name in ("districtStreets", "schlossEastStreets"):
    lines.extend(
      LineString(r)
      for r in base.read_json(DATA / (name + ".json"))["curbs_m"]
      if len(r) > 1
    )
  lines.extend(
    LineString([r[:2], r[2:]])
    for r in base.read_json(DATA / "boulevardCurbsV210.json")["segments"]
  )
  for x, _, z, length, _, _, yaw, colour in base.read_json(DATA / "southKiezV185.json")[
    "boxes"
  ]:
    if colour == 0xCFCBBB:
      dx, dz = math.cos(yaw) * length / 2, -math.sin(yaw) * length / 2
      lines.append(LineString([(x - dx, z - dz), (x + dx, z + dz)]))
  for row in (DATA / "restoredRoadSurfaces.ndjson.txt").read_text().splitlines()[1:]:
    r = json.loads(row)
    if r["kind"] == "kerbs":
      for a, b, c, d in np.frombuffer(base64.b64decode(r["xz"]), "<f4").reshape(-1, 4):
        lines.append(LineString([(a, b), (c, d)]))
  lines.extend(
    shape(f["geometry"])
    for f in base.read_json(GEO / "house-curbs-v233-evidence.json.gz")["courses"]
  )
  lines.extend(
    shape(f["geometry"])
    for f in base.read_json(GEO / "main-streets-v254-evidence.json.gz")["emitted"]
    if f["packet"].startswith("drawn:")
  )
  lines.extend(
    shape(r["geometry"]).buffer(43)
    for r in base.read_json(GEO / "west-streets-v163.json")["roads"]
  )
  core = base.read_json(DATA / "surroundingCityScope.json")["core"]
  lines.append(Polygon(core["ring"], core["holes"]))
  return STRtree(lines)


def delivered(entry, family):
  p = base.read_json(OUT / entry[family]["url"])
  origin = p["origin"]
  if p["nav"]["groundY"] != 3 or origin[1] != -10:
    return None

  def nav(key):
    return unary_union(
      [
        translate(Polygon(r["ring"], r["holes"]).buffer(0), origin[0], origin[2])
        for r in p["nav"].get(key, [])
      ]
    )

  if not p["nav"].get("roads") or not p["nav"]["ground"]:
    return None
  levels, boxes = [], []
  for m in p["meshes"]:
    if m["kind"] != "city":
      continue
    points = (
      np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3) / 100
      + origin
    )
    ids = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    faces = points[ids]
    faces = faces[
      (np.ptp(faces[:, :, 1], axis=1) < 0.001)
      & (faces[:, 0, 1] >= 2.99)
      & (faces[:, 0, 1] <= 3.16)
    ]
    if len(faces):
      levels.append(faces)
      boxes.append(
        np.column_stack(
          (
            faces[:, :, 0].min(1),
            faces[:, :, 2].min(1),
            faces[:, :, 0].max(1),
            faces[:, :, 2].max(1),
          )
        )
      )
  if not levels:
    return None
  # Buildings are numerous. Keep their individual footprints in a spatial
  # index instead of unioning all the houses every time a tile is examined.
  blocked = STRtree(
    [
      translate(Polygon(r["ring"], r["holes"]).buffer(0), origin[0], origin[2])
      for key in ("water", "buildings", "bridges")
      for r in p["nav"].get(key, [])
    ]
  )
  road_surface = nav("roads")
  margins = road_surface.boundary
  raw = p.get("lines") or {}
  if (
    family == "drawn"
    and raw.get("colors")
    and raw.get("positionType", "u16cm") == "u16cm"
  ):
    seg = np.frombuffer(base64.b64decode(raw["positions"]), "<u2").reshape(-1, 2, 3)
    rgb = np.frombuffer(base64.b64decode(raw["colors"]), "u1").reshape(-1, 2, 3)
    # Legacy exporter emits this unique colour and Y only for the exterior
    # asphalt boundary. It removes clip edges before serializing the linework.
    curb_rgb = linear_rgb_bytes(np.array([COLORS["kerb"]]))[0]
    sel = np.all(rgb == curb_rgb, axis=(1, 2)) & np.all(seg[:, :, 1] == 1313, axis=1)
    edges = seg[sel][:, :, [0, 2]] / 100 + [origin[0], origin[2]]
    if len(edges):
      margins = shapely.multilinestrings(shapely.linestrings(edges))
  return dict(
    origin=origin,
    guard=ground_guard(p["nav"]["roads"]),
    ground=nav("ground"),
    margin=margins,
    road_surface=road_surface,
    blocked=blocked,
    faces=np.concatenate(levels),
    boxes=np.concatenate(boxes),
  )


def support(packet, footprint):
  """Partition the complete footprint by the topmost originally delivered faces."""
  if not packet["ground"].covers(footprint) or len(
    packet["blocked"].query(footprint, predicate="intersects")
  ):
    return None
  bounds = packet["boxes"]
  a, b, c, d = footprint.bounds
  hits = (
    (bounds[:, 0] <= c)
    & (bounds[:, 1] <= d)
    & (bounds[:, 2] >= a)
    & (bounds[:, 3] >= b)
  )
  levels = defaultdict(list)
  for t in packet["faces"][hits]:
    geom = Polygon(t[:, [0, 2]])
    if geom.area and geom.intersects(footprint):
      patch = geom.intersection(footprint)
      if patch.area > 1e-8:
        levels[round(float(t[0, 1]), 2)].append(patch)
  covered = Polygon()
  top = {}
  for y in sorted(levels, reverse=True):
    patch = unary_union(levels[y]).difference(covered)
    if patch.area > 1e-8:
      top[y] = patch
      covered = covered.union(patch)
  return top if top and covered.buffer(0.001).covers(footprint) else None


def near_margin(margin, course, distance):
  # Clip only for this test. Buffering an entire 512 m street network at every
  # access point is expensive and cannot affect the local distance envelope.
  x0, z0, x1, z1 = course.bounds
  local = shapely.clip_by_rect(
    margin, x0 - distance, z0 - distance, x1 + distance, z1 + distance
  )
  return not local.is_empty and local.buffer(distance).covers(course)


def native_stones(line):
  """Use the cells occupied by the mapped course; no rotation of drawn slabs."""
  x0, z0, x1, z1 = line.bounds
  cells = []
  for x in range(math.floor(x0 * 4), math.floor(x1 * 4) + 1):
    for z in range(math.floor(z0 * 4), math.floor(z1 * 4) + 1):
      cell = box(x / 4, z / 4, (x + 1) / 4, (z + 1) / 4)
      if line.intersection(cell).length > 0.015:
        cells.append(cell)
  return unary_union(cells).simplify(0, preserve_topology=True)


def draw_stones(mesh, line, layers):
  """A level, walkable cap. Size and alternating stone tones are display estimates."""
  count = max(1, round(line.length / 0.93))
  for i in range(count):
    segment = substring(
      line, (i + 0.008) * line.length / count, (i + 0.992) * line.length / count
    )
    footprint = segment.buffer(STONE_HALF_WIDTH, cap_style="flat", join_style="bevel")
    for y, layer in layers.items():
      mesh.surface(
        footprint.intersection(layer), y + DISPLAY_LIFT, SWATCHES[i % len(SWATCHES)]
      )


def build(cache):
  if (
    base.digest(PBF)
    != "228890fba84d33cf51231a08425cc58683fe327b9cbe1e7a746fa1c4a1360e50"
  ):
    raise ValueError("Expected the retained Berlin November 13 OSM extract")
  districts = frame(
    cache,
    "districts",
    "multipolygons",
    "boundary = 'administrative' AND admin_level = '9'",
  )
  districts = districts[districts.name.isin(DISTRICTS)]
  assert set(districts.name) == DISTRICTS
  kerbs = frame(cache, "kerbs", "lines", "barrier = 'kerb'")
  kerbs = kerbs[
    kerbs.other_tags.str.contains(r'"kerb"=>"(?:flush|lowered)"', na=False, regex=True)
  ]
  ways = kerbs.sjoin(
    districts[["name", "geometry"]].rename(columns={"name": "district"}),
    predicate="within",
  )
  roads = frame(cache, "access", "lines", "highway IS NOT NULL")
  roads = roads[roads.highway.isin(DRIVABLE) & roads.name.notna()]
  roads = roads[
    [at_grade(tags(r)) for r in roads[["other_tags", "highway"]].to_dict("records")]
  ].reset_index(drop=True)
  nearby = STRtree(roads.geometry.values)
  existing = prior_geometry()
  manifest = base.read_json(OUT / "manifest.json")
  descriptors = {
    e["id"]: e for e in manifest["chunks"] if not e.get("detailCompanionOf")
  }
  by_cell = defaultdict(list)
  for key, e in descriptors.items():
    x0, z0, x1, z1 = e["bounds"]
    if x1 - x0 > 520 or z1 - z0 > 520:
      continue
    for x in range(math.floor(x0 / 512), math.ceil(x1 / 512)):
      for z in range(math.floor(z0 / 512), math.ceil(z1 / 512)):
        by_cell[x, z].append(key)

  @lru_cache(maxsize=18)
  def packet(key, family):
    return delivered(descriptors[key], family)

  features, meshes, packets = [], {}, {}
  counts = Counter()
  cells = set()

  def order(row):
    point = row["geometry"].interpolate(0.5, normalized=True)
    tile = (math.floor((point.x - 389500) / 512), math.floor((5820000 - point.y) / 512))
    return hashlib.sha256(str(tile).encode()).digest(), hashlib.sha256(
      row["osm_id"].encode()
    ).digest()

  for row in sorted(ways.to_dict("records"), key=order):
    district = row["district"]
    if counts[district] >= MAX_PER_DISTRICT:
      continue
    t = tags(row)
    if not at_grade(t) or any(
      k in t for k in ("indoor", "disused:barrier", "was:barrier")
    ):
      continue
    g = row["geometry"]
    if not 1.1 <= g.length <= 17 or not g.is_simple or g.is_ring:
      continue
    line = world(g)
    mid = line.interpolate(0.5, normalized=True)
    cell = (district, math.floor(mid.x / 600), math.floor(mid.y / 600))
    if cell in cells or len(existing.query(line, predicate="dwithin", distance=0.58)):
      continue
    road_index = nearby.nearest(g)
    road = roads.iloc[road_index]
    if g.distance(road.geometry) > 16:
      continue
    drawn_foot = line.buffer(
      STONE_HALF_WIDTH + 0.015, cap_style="flat", join_style="bevel"
    )
    for key in by_cell[math.floor(mid.x / 512), math.floor(mid.y / 512)]:
      desc = descriptors[key]
      if not box(*desc["bounds"]).buffer(-0.35).covers(drawn_foot):
        continue
      drawn = packet(key, "drawn")
      if drawn is None or not near_margin(drawn["margin"], line, 0.95):
        continue
      yd = support(drawn, drawn_foot)
      if yd is None:
        continue
      native = packet(key, "minecraft")
      if native is None:
        continue
      raster = native_stones(line)
      if raster.is_empty or len(
        existing.query(raster, predicate="dwithin", distance=0.35)
      ):
        continue
      if not near_margin(native["road_surface"], raster, 2.8):
        continue
      yn = support(native, raster)
      if yn is None:
        continue
      # Do not let a diagonally clipped Native source edge manufacture
      # sub-cell slivers. Reject the site if its visible level boundary
      # cannot be represented with independently aligned, quarter-metre cells.
      native_layers = {
        y: layer.simplify(0.00001, preserve_topology=True) for y, layer in yn.items()
      }
      if any(
        not np.allclose(
          (coords := shapely.get_coordinates(layer)) * 4,
          np.round(coords * 4),
          rtol=0,
          atol=0.002,
        )
        for layer in native_layers.values()
      ):
        continue
      counts[district] += 1
      cells.add(cell)
      if row["osm_id"] in COVERED_WAYS:
        break
      for family, p in [("drawn", drawn), ("minecraft", native)]:
        modekey = family + ":" + key
        if modekey not in meshes:
          meshes[modekey] = PackedMesh(p["origin"][0], p["origin"][2])
          packets[modekey] = dict(origin=p["origin"], roadsGuard=p["guard"])
      draw_stones(meshes["drawn:" + key], line, yd)
      for y, patch in native_layers.items():
        meshes["minecraft:" + key].surface(patch, y + DISPLAY_LIFT, SWATCHES[0])
      features.append(
        dict(
          osmWay=row["osm_id"],
          type=t["kerb"],
          district=district,
          road=road["name"],
          roadWay=road["osm_id"],
          owner=key,
          centre=[round(mid.x, 2), round(mid.y, 2)],
          course=mapping(line),
          lengthM=round(line.length, 3),
          drawnGroundY=sorted(yd),
          nativeGroundY=sorted(yn),
        )
      )
      if counts[district] == 1:
        print(
          district, road["name"], key, features[-1]["centre"], sorted(yd), flush=True
        )
      break
  for key, m in meshes.items():
    packets[key]["mesh"] = m.payload(KIND)
  base.write_json(OUTFILE, packets)
  base.write_json(
    DATA / "cityKerbCrossingOwnersV365.json", sorted({f["owner"] for f in features})
  )
  base.write_json(
    RECEIPTS,
    dict(
      pbfSha256=base.digest(PBF),
      source="OpenStreetMap/Geofabrik Berlin 2026-11-13, ODbL-1.0",
      runtimeSha256=base.digest(OUTFILE),
      counts=dict(sorted(Counter(f["district"] for f in features).items())),
      coveredWays=COVERED_WAYS,
      features=features,
      owners={
        k: {m: descriptors[k][m]["sha256"] for m in ("drawn", "minecraft")}
        for k in sorted({f["owner"] for f in features})
      },
      estimates="25 cm stone width, ~93 cm stone module, subtle tone changes. Both flush and lowered kerbs use a level cap on the actual rendered ground; 1 cm depth separation only. No kerb height, pedestrian clearance or tactile markings are inferred.",
    ),
  )
  print(dict(counts), len(features), len(meshes), OUTFILE.stat().st_size, flush=True)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--cache", type=Path, default=GEO / "raw/kerb-source-v365")
  args = parser.parse_args()
  args.cache.mkdir(exist_ok=True, parents=True)
  build(args.cache)
