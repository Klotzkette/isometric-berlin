"""Bounded Moabit park furniture and Rathaus recognition, preserving terrain.

Plans/anchors are OSM source objects. Furniture dimensions and the restrained
portico interpretation are explicit display estimates, not surveyed openings.
No underground floor, terrain cut, building shell or walking rule is changed.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_region_outlines_v200 import polygons, world, xml_elements
from build_west_streets_v163 import partition_detail
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import triangulate, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
RAW = GEO / "raw/small-tiergarten-v237/map.osm"
SOURCE = GEO / "small-tiergarten-v237-source.json.gz"
EVIDENCE = GEO / "small-tiergarten-v237-evidence.json"
ADDITION = GEO / "moabit-v237-manifest-addition.json"
PARK = ROOT / "src/app/public/mesh/regierungsviertel/park-details.json"
GROUND = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
TOWN = ROOT / "src/app/src/data/townhallV227Profile.json"
REFS = [
  "https://www.latzundpartner.de/de/projekte/klassische-landschaften/kleiner-tiergarten-ottopark-berlin-de/",
  "https://www.kosp-berlin.de/projekt/kleiner-tiergarten-ottopark/",
  "https://www.berlin.de/sen/stadtentwicklung/quartiersentwicklung/staedtebaufoerderung/lebendige-zentren/gebiete/turmstrasse-1286528.php",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050351",
]
POLICY = "Exact mapped park, bench, shelter, path and entrance anchors. Furniture dimensions, orientation inferred from nearest path and portico/balcony proportions are display estimates. Existing terrain, buildings, trees, navigation, park paths and underground network remain unchanged; no unverified underpass or hill is invented."


def digest(p):
  return hashlib.sha256(p.read_bytes()).hexdigest()


def read(p):
  return json.loads(
    gzip.decompress(p.read_bytes()) if p.suffix == ".gz" else p.read_bytes()
  )


def write(p, value):
  data = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  p.write_bytes(gzip.compress(data, mtime=0) if p.suffix == ".gz" else data)


def extract():
  es = xml_elements(RAW)

  def geom(e):
    if e["type"] == "node":
      return Point(world(e["lon"], e["lat"]))
    points = [world(es["node", i]["lon"], es["node", i]["lat"]) for i in e["nodes"]]
    return (
      Polygon(points)
      if len(points) > 3 and points[0] == points[-1]
      else LineString(points)
    )

  park = unary_union([geom(es["way", i]) for i in (624604329, 623932032, 4592869)])
  town = next(s for s in read(TOWN)["sites"] if s["key"] == "tiergarten")
  town_scope = box(*town["bounds"]).buffer(3)
  rows = []
  for k, e in es.items():
    if e["type"] == "relation" or not e["tags"]:
      continue
    t, g = e["tags"], geom(e)
    eligible = (
      t.get("amenity") in ("bench", "shelter")
      or t.get("highway") in ("footway", "path", "steps")
      or t.get("barrier") == "kerb"
      or t.get("leisure") == "track"
    )
    if (
      (eligible and g.intersects(park))
      or (t.get("amenity") == "bench" and g.intersects(town_scope))
      or (t.get("entrance") and g.intersects(town_scope))
      or t.get("railway") == "subway_entrance"
    ):
      rows.append(dict(id=f"{k[0]}/{k[1]}", tags=t, geometry=mapping(g)))
  previous = read(PARK)
  paths = [
    p
    for p in previous["paths"]
    if LineString([(x, z) for x, y, z in p["points"]]).intersects(park.buffer(5))
  ]
  footprint = read(ROOT / "src/app/src/data/surroundingCityScope.json")["core"]
  assert Polygon(footprint["ring"], footprint["holes"]).covers(park)
  write(
    SOURCE,
    dict(
      schemaVersion=1,
      policy=POLICY,
      references=REFS,
      retrieved="2026-10-18",
      osmUrl="https://api.openstreetmap.org/api/0.6/map?bbox=13.332,52.5238,13.3505,52.529",
      osmRawSha256=digest(RAW),
      license="OSM contributors, ODbL 1.0; retained Berlin LoD2/DGM official provenance unchanged",
      inputs={str(p.relative_to(ROOT)): digest(p) for p in (PARK, GROUND, TOWN)},
      park=mapping(park),
      parkIds=["relation/8676818", "way/4592869"],
      town=town,
      features=rows,
      oldPaths=paths,
      excludedUnderpass="Only the existing mapped U9 passenger network and Rolleracht bridge are evidenced; no requested pedestrian underpass identity or surveyed depth established. Preserve them without speculative replacement.",
    ),
  )


def ground_sampler():
  p = read(GROUND)
  f = p["ground_height"]
  step = p["cell_m"] * f["stride_cells"]
  ox, oz = p["grid"]["min_x_idx"] * p["cell_m"], p["grid"]["min_z_idx"] * p["cell_m"]

  def at(x, z):
    ix, iz = int((x - ox) // step), int((z - oz) // step)
    assert 0 <= ix < f["cols"] and 0 <= iz < f["rows"]
    return f["y_dm"][iz * f["cols"] + ix] / 10

  return at


def oriented(detail, center, size, angle, color, role, native):
  """Independent axis-aligned native boxes; never rotate native triangles."""
  x, y, z = center
  w, h, d = size
  c, s = math.cos(angle), math.sin(angle)
  if not native:
    local = Detail()
    local.box([0, y, 0], size, color, role)
    for tri, rgb, tag in local.triangles:
      detail.triangles.append(
        ([[x + c * a - s * b, yy, z + s * a + c * b] for a, yy, b in tri], rgb, tag)
      )
    return
  # Thin horizontal planks are assembled from orthogonal short bars, not a
  # coarse diagonal prism. Native placement uses the same owner and dimensions.
  n = max(1, math.ceil(w / 0.3))
  for i in range(n):
    u = (i + 0.5) * w / n - w / 2
    detail.box(
      [x + c * u, y, z + s * u],
      [
        max(0.045, abs(c) * w / n + abs(s) * d),
        h,
        max(0.045, abs(s) * w / n + abs(c) * d),
      ],
      color,
      role,
    )


def models(source):
  details = {m: Detail() for m in ("drawn", "minecraft")}
  evidence = []
  ground = ground_sampler()
  park = shape(source["park"])
  rows = source["features"]
  paths = [
    shape(r["geometry"])
    for r in rows
    if r["tags"].get("highway") in ("footway", "path")
    and not r["tags"].get("tunnel")
    and not r["tags"].get("layer", "0").startswith("-")
  ]
  path_tree = STRtree(paths)

  def yaw_at(p):
    line = paths[int(path_tree.nearest(p))]
    at = line.project(p)
    a = line.interpolate(max(0, at - 0.5))
    b = line.interpolate(min(line.length, at + 0.5))
    return math.atan2(b.y - a.y, b.x - a.x)

  old = unary_union(
    [
      LineString([(x, z) for x, y, z in p["points"]]).buffer(
        p["w"] / 200 + 0.08, cap_style=2, join_style=2
      )
      for p in source["oldPaths"]
    ]
  )
  old_ids = {p["id"].split(":")[0] for p in source["oldPaths"]}
  bench_nodes = [
    r
    for r in rows
    if r["tags"].get("amenity") == "bench" and shape(r["geometry"]).geom_type == "Point"
  ]
  for row in rows:
    t, g, ident = row["tags"], shape(row["geometry"]), row["id"]
    if t.get("amenity") == "bench":
      if g.geom_type == "Point":
        seats = [(g, yaw_at(g))]
      elif g.geom_type == "LineString":
        count = int(t.get("seats", "1"))
        seats = []
        for i in range(count):
          pos = g.interpolate((i + 0.5) * g.length / count)
          if any(pos.distance(shape(b["geometry"])) < 0.65 for b in bench_nodes):
            continue
          at = g.project(pos)
          a = g.interpolate(max(0, at - 0.1))
          b = g.interpolate(min(g.length, at + 0.1))
          seats.append((pos, math.atan2(b.y - a.y, b.x - a.x)))
      else:
        continue
      for mode, d in details.items():
        native = mode == "minecraft"
        for p, angle in seats:
          x, z = p.x, p.y
          y = ground(x, z) + 0.045
          width = 0.57 if g.geom_type == "LineString" else 1.85
          wood = (97, 122, 91) if t.get("colour") == "green" else (139, 120, 87)
          if t.get("material") == "stone" or "Beton" in t.get("description", ""):
            wood = (180, 177, 164)
          c, s = math.cos(angle), math.sin(angle)

          def put(u, h, v, w, hh, dd, col):
            return oriented(
              d,
              [x + c * u - s * v, y + h, z + s * u + c * v],
              [w, hh, dd],
              angle,
              col,
              ident + ":bench",
              native,
            )

          for v in [-0.17, 0, 0.17]:
            put(0, 0.47, v, width, 0.10, 0.14, wood)
          for u in [-width * 0.34, width * 0.34]:
            put(u, 0.23, 0, 0.09, 0.46, 0.43, (75, 81, 74))
          if t.get("backrest") != "no":
            for h in [0.74, 0.94]:
              put(0, h, 0.23, width, 0.16, 0.075, wood)
          if t.get("armrest") == "yes":
            for u in [-width * 0.46, width * 0.46]:
              put(u, 0.7, 0, 0.06, 0.07, 0.44, (75, 81, 74))
      evidence.append(
        dict(
          id=ident,
          kind="bench",
          anchors=[[p.x, p.y] for p, a in seats],
          count=len(seats),
        )
      )
    elif ident == "way/1096688336":
      # Exact mapped container rectangle. Its outward long side stays open.
      rect = g.minimum_rotated_rectangle
      ps = list(rect.exterior.coords)
      edges = [(math.dist(a, b), a, b) for a, b in zip(ps, ps[1:])]
      length, a, b = max(edges)
      angle = math.atan2(b[1] - a[1], b[0] - a[0])
      width = min(e[0] for e in edges)
      x, z = g.centroid.x, g.centroid.y
      y = ground(x, z)
      c, s = math.cos(angle), math.sin(angle)
      for mode, d in details.items():

        def put(u, h, v, w, hh, dd, col):
          return oriented(
            d,
            [x + c * u - s * v, y + h, z + s * u + c * v],
            [w, hh, dd],
            angle,
            col,
            ident + ":shelter",
            mode == "minecraft",
          )

        put(0, 2.55, 0, length, 0.14, width, (183, 154, 55))
        put(0, 1.3, -width / 2, length, 2.5, 0.09, (200, 169, 62))
        for u in [-length / 2, length / 2]:
          put(u, 1.3, 0, 0.09, 2.5, width, (190, 157, 53))
        for u in np.arange(-length / 2 + 0.1, length / 2, 0.25):
          put(float(u), 1.3, -width / 2 - 0.035, 0.055, 2.42, 0.035, (156, 133, 58))
      evidence.append(
        dict(id=ident, kind="shelter", footprint=mapping(g), heightEstimateM=2.62)
      )
    elif (
      t.get("highway") in ("footway", "path")
      and g.geom_type == "LineString"
      and not t.get("tunnel")
      and t.get("layer", "0") == "0"
      and ident.split("/")[1] not in old_ids
    ):
      # Only genuinely missing plan strips; do not redraw existing paths.
      width = float(t.get("width", 2.4))
      patch = (
        g.buffer(width / 2, cap_style=2, join_style=2)
        .intersection(park)
        .difference(old)
      )
      if patch.area < 0.2:
        continue
      for mode, d in details.items():
        surface(
          d,
          patch,
          ground,
          (177, 170, 151),
          ident + ":missing-path",
          mode == "minecraft",
        )
      old = old.union(patch)
      evidence.append(
        dict(
          id=ident,
          kind="missing-path",
          geometry=mapping(patch),
          widthM=width,
          widthEstimated="width" not in t,
        )
      )
  # Surveyed centre wall and exact current main entrance point. No new body.
  main = next(r for r in rows if r["id"] == "node/1776326062")
  p = shape(main["geometry"])
  part = next(p for p in source["town"]["parts"] if p["id"] == "DEBE3DxQUEt451DE")
  edge = min(
    [e for e in part["wallEdges"] if e["base"] < 6],
    key=lambda e: LineString([e["a"], e["b"]]).distance(p),
  )
  line = LineString([edge["a"], edge["b"]])
  anchor = line.interpolate(line.project(p))
  dx = edge["b"][0] - edge["a"][0]
  dz = edge["b"][1] - edge["a"][1]
  angle = math.atan2(dz, dx)
  c, s = math.cos(angle), math.sin(angle)
  nx, nz = edge["normal"]
  for mode, d in details.items():

    def put(u, h, v, w, hh, dd, col):
      return oriented(
        d,
        [anchor.x + c * u + nx * v, edge["base"] + h, anchor.y + s * u + nz * v],
        [w, hh, dd],
        angle,
        col,
        "rathaus:portico",
        mode == "minecraft",
      )

    for u in [-3.9, -1.3, 1.3, 3.9]:
      put(u, 2.2, 1.28, 0.42, 4.4, 0.48, (193, 184, 164))
    put(0, 4.5, 0.9, 8.8, 0.25, 1.95, (195, 187, 170))
    put(0, 4.96, 1.8, 8.8, 0.72, 0.20, (203, 196, 180))
    for u in [-4.3, 4.3]:
      put(u, 4.96, 0.9, 0.18, 0.72, 1.95, (203, 196, 180))
    # Exact mapped door, kept open by flanking jambs; no opaque fill plane.
    for u in [-0.94, 0.94]:
      put(u, 1.5, 0.14, 0.14, 3, 0.19, (191, 181, 156))
    put(0, 3.05, 0.14, 2.02, 0.14, 0.19, (191, 181, 156))
  evidence.append(
    dict(
      id=main["id"],
      kind="rathaus-portico",
      wallOwner=part["id"],
      wall=edge,
      anchor=[anchor.x, anchor.y],
      displayEstimated=True,
    )
  )
  return details, evidence


def surface(detail, g, ground, color, role, native):
  for p in polygons(g):
    if not native:
      for tri in triangulate(p):
        if p.covers(tri):
          points = [
            [x, ground(x, z) + 0.055, z] for x, z in list(tri.exterior.coords)[:-1]
          ]
          detail.polygon(list(reversed(points)), color, role)
    else:
      # Independent contained 25cm cells, row merged, with no diagonal caps.
      x0, z0, x1, z1 = p.bounds
      step = 0.25
      for j in range(math.floor(z0 / step), math.ceil(z1 / step)):
        start = None
        for i in range(math.floor(x0 / step), math.ceil(x1 / step) + 1):
          cell = box(i * step, j * step, (i + 1) * step, (j + 1) * step)
          hit = p.covers(cell)
          if hit and start is None:
            start = i
          if not hit and start is not None:
            a, b = start * step, i * step
            z = (j + 0.5) * step
            detail.box(
              [(a + b) / 2, ground((a + b) / 2, z) + 0.035, z],
              [b - a, 0.04, step],
              color,
              role,
            )
            start = None


def build():
  src = read(SOURCE)
  for p, h in src["inputs"].items():
    assert digest(ROOT / p) == h, p
  details, records = models(src)
  partitions = {m: partition_detail(d) for m, d in details.items()}
  cells = sorted(set(partitions["drawn"]) | set(partitions["minecraft"]))
  chunks = []
  receipts = {}
  counts = Counter()
  for ix, iz in cells:
    identity = f"moabit237-{ix}_{iz}"
    tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
    desc = dict(id=identity, bounds=list(tile.bounds))
    for mode in details:
      mesh = packed_detail(partitions[mode][ix, iz], tile)
      assert mesh
      mesh["kind"] = "small-tiergarten-v237"
      packet = dict(
        schemaVersion=1,
        id=identity,
        origin=[ix * 512, -10, iz * 512],
        meshes=[mesh],
        nav=dict(groundY=5.2, ground=[], water=[], buildings=[]),
      )
      path = OUT / f"{identity}.{mode}.json.gz"
      write(path, packet)
      data = path.read_bytes()
      raw = gzip.decompress(data)
      nv = len(base64.b64decode(mesh["positions"])) // 6
      ni = len(base64.b64decode(mesh["indices"])) // 4
      gpu = nv * 12 + ni * (2 if nv <= 65535 else 4)
      assert nv < 400000 and ni < 2400000 and len(raw) < 12 * 1024 * 1024
      desc[mode] = dict(
        url=path.name,
        encoding="gzip",
        bytes=len(data),
        decodedBytes=len(raw),
        sha256=digest(path),
      )
      receipts[f"{mode}:{identity}"] = dict(vertices=nv, indices=ni, geometryBytes=gpu)
      counts[mode + "GeometryBytes"] += gpu
    chunks.append(desc)
  assert len(chunks) <= 4
  write(ADDITION, dict(chunks=chunks))
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      policy=POLICY,
      sourceSha256=digest(SOURCE),
      unchangedInputs=src["inputs"],
      records=records,
      counts=dict(counts),
      packets=receipts,
      underpass=src["excludedUnderpass"],
    ),
  )
  print(
    dict(
      chunks=len(chunks), records=dict(Counter(r["kind"] for r in records)), **counts
    )
  )


if __name__ == "__main__":
  import argparse

  p = argparse.ArgumentParser()
  p.add_argument("--refresh-source", action="store_true")
  args = p.parse_args()
  if args.refresh_source:
    extract()
  build()
