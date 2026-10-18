"""Step 10: bounded source-plane recognition around Bellevue and Tiergarten."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import re
from collections import Counter
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from build_boulevard_architecture_v235 import source_protection
from build_district_facades_v188 import digest, read_json, world, write_json
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_west_streets_v163 import partition_detail
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import nearest_points, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "spree-tiergarten-v237-source.json.gz"
EVIDENCE = GEO / "spree-tiergarten-v237-evidence.json"
ADDITION = GEO / "spree-v237-manifest-addition.json"
PRISMS = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
VOXELS = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
CANDIDATES = GEO / "raw/outer-v159/candidate.gpkg"
STREETS = {
  "Paulstraße",
  "Spenerstraße",
  "Lüneburger Straße",
  "Bettina-von-Arnim-Ufer",
  "Klingelhöferstraße",
  "Tiergartenstraße",
  "Rauchstraße",
  "Corneliusstraße",
}
SPECIAL = {
  "24046078": "saudi",
  "33135651": "kas-office",
  "609711202": "kas-office",
  "33755520": "kas-academy",
}
POLICY = "Exact retained core footprint/height, source-bound public-facing recognition. Window spacing, profile dimensions, ornamental screen modules and material swatches are display estimates, not surveyed openings. No source shell, roof, street, park, navigation or previous detail is removed. No new coverage or residency limit."
REFERENCES = [
  "https://www.borgert-architekten.de/projekte/saudiarabische-botschaft",
  "https://zweipink.de/projekt/bundesgeschaeftsstelle-cdu-berlin/",
  "https://www.kas.de/de/statische-inhalte-detail/-/content/das-haus",
  "https://cn-architekten.de/projekte/erweiterung-der-konrad-adenauer-stiftung",
  "https://www.belvue.de/v9/",
]


def extract():
  roads = pyogrio.read_dataframe(
    CANDIDATES,
    layer="lines",
    where="name IN (" + ",".join("'" + x + "'" for x in STREETS) + ")",
  ).to_crs(25833)
  area = box(-1650, -320, -450, 80).union(box(-1510, 970, -1150, 1410))
  streets = []
  for row in roads.itertuples():
    g = world(row.geometry).intersection(area)
    if not g.is_empty:
      streets.append(dict(id=str(row.osm_id), name=row.name, geometry=mapping(g)))
  road_union = unary_union([shape(r["geometry"]) for r in streets])
  mapped = pyogrio.read_dataframe(
    CANDIDATES, layer="multipolygons", bbox=(13.345, 52.505, 13.38, 52.528)
  ).to_crs(25833)
  rows, shapes = [], []
  for row in mapped.itertuples():
    if not isinstance(row.building, str):
      continue
    g = world(row.geometry)
    if not g.is_valid:
      continue
    tags = dict(
      re.findall(
        r'"([^\"]+)"=>"([^\"]*)"',
        row.other_tags if isinstance(row.other_tags, str) else "",
      )
    )
    rows.append(
      dict(
        osm=str(row.osm_way_id or row.osm_id),
        name=row.name if isinstance(row.name, str) else "",
        tags=tags,
        geometry=mapping(g),
      )
    )
    shapes.append(g)
  tree = STRtree(shapes)
  outer, protected = source_protection()
  protected |= {p[-8:] for p in outer}
  entrance_source = GEO / "house-doors-v233-context.json.gz"
  entrances = read_json(entrance_source)["entrances"]
  entrance_points = [Point(*e["point"]) for e in entrances]
  entrance_tree = STRtree(entrance_points)
  selected = []
  prisms = read_json(PRISMS)["buildings"]
  all_shapes = []
  for p in prisms:
    g = Polygon(
      np.array(p["ring"]) / 10, [np.array(h) / 10 for h in p.get("holes", [])]
    )
    if g.is_valid and g.intersects(area.buffer(60)):
      all_shapes.append(g)
    if (
      not g.is_valid
      or not area.intersects(g)
      or g.area < 6
      or p["h_dm"] < 65
      or g.distance(road_union) > 28
    ):
      continue
    candidates = [
      (g.intersection(shapes[int(i)]).area / g.area, int(i)) for i in tree.query(g)
    ]
    if not candidates:
      continue
    score, index = max(candidates)
    if score < 0.75:
      continue
    row = rows[index]
    special = SPECIAL.get(row["osm"])
    if not special and (
      g.area < 90
      or p["id"] in protected
      or row["name"]
      or row["tags"].get("diplomatic")
      or row["tags"].get("amenity")
    ):
      continue
    if row["osm"] == "25999445":
      continue
    nearest = min(streets, key=lambda r: shape(r["geometry"]).distance(g))
    selected.append(
      dict(
        prism=p,
        osm=row,
        match=round(score, 6),
        style=special or ("waterfront" if g.centroid.y < 100 else "embassy-context"),
        street=nearest["name"],
        entrances=[
          entrances[int(i)]
          for i in entrance_tree.query(g.boundary.buffer(0.25), predicate="intersects")
        ],
      )
    )
  # Complete inherited body data remains in immutable source assets; this small
  # replay contains every selected ring and the nearby source occupancy mask.
  write_json(
    SOURCE,
    dict(
      schema=1,
      policy=POLICY,
      references=REFERENCES,
      inputs={
        str(p.relative_to(ROOT)): digest(p)
        for p in [PRISMS, VOXELS, CANDIDATES, entrance_source]
      },
      roads=streets,
      buildings=selected,
      occupied=[mapping(g) for g in all_shapes],
    ),
  )
  print(
    "selected",
    len(selected),
    Counter(x["style"] for x in selected),
    [
      (x["prism"]["id"], x["osm"]["osm"], x["style"])
      for x in selected
      if x["style"].startswith(("saudi", "kas"))
    ],
  )


def models(source):
  result = {"drawn": Detail(), "minecraft": Detail()}
  occupied = unary_union([shape(g) for g in source["occupied"]])
  roads = unary_union([shape(r["geometry"]) for r in source["roads"]])
  vox = read_json(VOXELS)
  cell, grid = vox["cell_m"], vox["grid"]
  columns = {}
  for iz, runs in enumerate(vox["building_rows"]):
    z = (grid["min_z_idx"] + iz + 0.5) * cell
    if not (-360 < z < 1450):
      continue
    for start, count, low, high, *_ in runs:
      for ix in range(start, start + count):
        x = (grid["min_x_idx"] + ix + 0.5) * cell
        if -1680 < x < -400:
          columns[(round(x, 3), round(z, 3))] = (low / 10, high / 10)
  column_rows = [(x, z, lo, hi) for (x, z), (lo, hi) in columns.items()]
  records = []
  for item in source["buildings"]:
    p, tags, style = item["prism"], item["osm"]["tags"], item["style"]
    poly = shapely.orient_polygons(Polygon(np.array(p["ring"]) / 10), exterior_cw=False)
    low, high = p["y0_dm"] / 10, (p["y0_dm"] + p["h_dm"]) / 10
    # Keep below the retained roof area; no new roof/cornice is invented on a
    # pitched envelope. Existing source roofs remain visible and unchanged.
    # The retained core's fitted pitched roof has at most 5 m rise.
    # Stay below its eave even on the widest footprint.
    top = high - (5.1 if p.get("roof") in (2100, 3100, 3200, 3500) else 0.8)
    if top - low < 5:
      continue
    levels = (
      int(tags.get("building:levels", "0"))
      if tags.get("building:levels", "").isdigit()
      else 0
    )
    pitch = (
      (top - low + 0.8) / levels
      if levels and 2.3 < (top - low + 0.8) / levels < 5.5
      else 3.1
    )
    height = min(2.3, pitch - min(1.05, pitch * 0.28) - 0.65)
    stone = (210, 202, 183) if style == "waterfront" else (201, 202, 190)
    if (
      tags.get("building:colour", "").startswith("#")
      and len(tags["building:colour"]) == 7
    ):
      stone = tuple(int(tags["building:colour"][i : i + 2], 16) for i in (1, 3, 5))
    glass = (132, 153, 155) if style == "waterfront" else (113, 141, 147)
    frame = (220, 222, 211) if style == "waterfront" else (186, 197, 192)
    search = poly.buffer(3)
    nearby = [c for c in column_rows if search.covers(Point(c[0], c[1]))]
    walls = []
    for wi, (a, b) in enumerate(
      zip(poly.exterior.coords, list(poly.exterior.coords)[1:])
    ):
      a, b = np.array(a), np.array(b)
      delta = b - a
      length = float(np.linalg.norm(delta))
      if length < 0.35:
        continue
      u = delta / length
      n = np.array([u[1], -u[0]])
      middle = (a + b) / 2
      if occupied.covers(Point(*(middle + n * 0.4))):
        continue
      near = nearest_points(Point(*middle), roads)[1]
      toward = np.array([near.x, near.y]) - middle
      facing = float(np.dot(n, toward)) > 0 and np.linalg.norm(toward) < 42
      # Saudi's north half-rotunda has short measured segments; keep all
      # genuinely exposed northern segments and source-aligned atrium edge.
      screen = style == "saudi" and length < 5.2 and middle[1] < 1052
      if not facing and not screen:
        continue
      if length < 3 and not screen:
        continue
      start_count = len(result["drawn"].triangles)
      emitted = []

      def panel(along, y, w, h, color, out, role):
        if (
          w <= 0
          or h <= 0
          or along - w / 2 < 0.02
          or along + w / 2 > length - 0.02
          or y - h / 2 < low + 0.15
          or y + h / 2 > top
        ):
          return
        q = middle + u * (along - length / 2) + n * out
        corners = [
          [q[0] + u[0] * du, y + dy, q[1] + u[1] * du]
          for du, dy in [
            (-w / 2, -h / 2),
            (w / 2, -h / 2),
            (w / 2, h / 2),
            (-w / 2, h / 2),
          ]
        ]
        result["drawn"].polygon(list(reversed(corners)), color, role)
        # Native detail is independently attached to a delivered 4m
        # column face, never buried beneath that coarse envelope.
        axis = 0 if abs(n[0]) >= abs(n[1]) else 1
        sign = 1 if n[axis] > 0 else -1
        # Wide source ribbons become bounded staircase strips, not one long
        # displaced plane at the outermost column of a diagonal facade.
        slices = max(1, math.ceil(w / 1.8))
        for segment in range(slices):
          center_along = along - w / 2 + (segment + 0.5) * w / slices
          local_q = middle + u * (center_along - length / 2) + n * out
          hits = []
          for x, z, lo, hi in nearby:
            c = np.array([x, z])
            side = float(np.dot(c - middle, u))
            if (
              hi < y + h / 2
              or lo > y - h / 2
              or abs(side - (center_along - length / 2)) > w / slices / 2 + cell * 0.55
            ):
              continue
            reach = float(np.dot(c - middle, n))
            if abs(reach) > cell * 1.1:
              continue
            hits.append(c[axis] + sign * cell / 2)
          if not hits:
            continue
          face = (max(hits) if sign > 0 else min(hits)) + sign * (out + 0.03)
          pos = [local_q[0], y, local_q[1]]
          pos[0 if axis == 0 else 2] = face
          width = max(0.08, w / slices * abs(u[1 - axis]))
          size = [0.06, h, width] if axis == 0 else [width, h, 0.06]
          result["minecraft"].box(pos, size, color, role)
          emitted.append(role)

      doors = []
      for entrance in item.get("entrances", []):
        point = np.array(entrance["point"])
        at = float(np.dot(point - a, u))
        distance = abs(float(np.dot(point - a, n)))
        if distance <= 0.25 and 0.65 < at < length - 0.65:
          doors.append(at)
          panel(at, low + 1.35, 1.40, 2.5, stone, 0.13, "mapped entrance surround")
          panel(
            at, low + 1.32, 1.12, 2.3, (87, 114, 117), 0.18, "mapped entrance glass"
          )
          panel(at, low + 1.32, 0.075, 2.3, frame, 0.23, "mapped entrance divider")
          panel(
            at + 0.35,
            low + 1.2,
            0.08,
            0.32,
            (190, 194, 182),
            0.27,
            "mapped entrance handle",
          )

      if style == "kas-academy":
        # Operator documents stone event floors and a continuous upper
        # office glazing ribbon; never an invented ordinary pane grid.
        for y in np.arange(low + 0.55, top - 3.1, 1.1):
          panel(
            length / 2,
            float(y),
            length - 0.12,
            0.045,
            (164, 164, 153),
            0.12,
            "KAS stone joint",
          )
        band_y = top - 1.65
        panel(
          length / 2,
          band_y,
          length - 0.15,
          2.2,
          (116, 145, 148),
          0.15,
          "KAS continuous office glass band",
        )
        for at in np.arange(0.8, length - 0.3, 2.2):
          panel(
            float(at),
            band_y,
            0.075,
            2.2,
            (192, 199, 190),
            0.21,
            "KAS upper ribbon mullion",
          )
        panel(
          length / 2, top - 0.35, length - 0.15, 0.18, stone, 0.23, "KAS flat roof edge"
        )
        walls.append(
          dict(
            index=wi,
            a=a.tolist(),
            b=b.tolist(),
            normal=n.tolist(),
            screen=False,
            continuousUpperGlass=True,
            drawnTriangles=len(result["drawn"].triangles) - start_count,
            nativeFittings=len(emitted),
          )
        )
        continue
      if screen:
        # Square perforated metal lattice: subdivision/profile sizes
        # are restrained recognition estimates, no bitmap/text tracing.
        for y in np.arange(low + 2.0, top - 0.5, 1.75):
          panel(
            length / 2,
            y,
            max(0.05, length - 0.10),
            0.075,
            (182, 190, 187),
            0.24,
            "Saudi metal screen horizontal",
          )
          for along in np.arange(0.35, length - 0.2, 1.25):
            panel(
              float(along),
              float(y),
              0.065,
              min(1.65, top - y - 0.05),
              (184, 192, 189),
              0.25,
              "Saudi metal screen vertical",
            )
            panel(
              float(along),
              float(y),
              0.44,
              0.07,
              (204, 210, 204),
              0.27,
              "Saudi ornamental cross",
            )
        walls.append(
          dict(
            index=wi,
            a=a.tolist(),
            b=b.tolist(),
            normal=n.tolist(),
            screen=True,
            drawnTriangles=len(result["drawn"].triangles) - start_count,
            nativeFittings=len(emitted),
          )
        )
        continue
      bays = max(1, math.floor((length - 1.95) / 3.6 + 1))
      first = (length - (bays - 1) * 3.6) / 2
      floors = max(0, math.floor((top - low - 1.05 - height - 0.55) / pitch + 1))
      for floor in range(floors):
        y = low + min(1.05, pitch * 0.28) + floor * pitch + height / 2
        for bay in range(bays):
          at = first + bay * 3.6
          if floor == 0 and any(abs(at - d) < 1.4 for d in doors):
            continue
          panel(at, y, 1.25, height + 0.2, stone, 0.10, "source facade reveal")
          panel(at, y, 1.05, height, glass, 0.15, "source facade glazing")
          panel(at, y, 0.065, height, frame, 0.19, "source facade mullion")
          panel(at, y + 0.25, 1.05, 0.065, frame, 0.19, "source facade transom")
          panel(
            at, y - height / 2 - 0.09, 1.45, 0.12, stone, 0.24, "source facade sill"
          )
      if p.get("roof") == 1000:
        panel(
          length / 2,
          top - 0.2,
          length - 0.12,
          0.20,
          stone,
          0.16,
          "source flat-eave edge",
        )
      walls.append(
        dict(
          index=wi,
          a=a.tolist(),
          b=b.tolist(),
          normal=n.tolist(),
          screen=False,
          bays=bays,
          floors=floors,
          pitch=pitch,
          drawnTriangles=len(result["drawn"].triangles) - start_count,
          nativeFittings=len(emitted),
        )
      )
    if walls:
      records.append(
        dict(
          owner=p["id"],
          osm=item["osm"]["osm"],
          style=style,
          street=item["street"],
          walls=walls,
          sourceLow=low,
          sourceHigh=high,
        )
      )
  return result, records


def build():
  source = read_json(SOURCE)
  for path, expected in source["inputs"].items():
    assert digest(ROOT / path) == expected, path
  detail, records = models(source)
  partitions = {mode: partition_detail(m) for mode, m in detail.items()}
  cells = sorted(set(partitions["drawn"]) | set(partitions["minecraft"]))
  descriptors = []
  receipts = {}
  counts = Counter()
  for ix, iz in cells:
    tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
    identity = f"spree237-{ix}_{iz}"
    descriptor = dict(id=identity, bounds=list(tile.bounds))
    for mode in ("drawn", "minecraft"):
      mesh = packed_detail(partitions[mode].get((ix, iz), Detail()), tile)
      assert mesh, (identity, mode)
      mesh["kind"] = "spree-tiergarten-facades-v237"
      packet = dict(
        schemaVersion=1,
        id=identity,
        origin=[ix * 512, -10, iz * 512],
        meshes=[mesh],
        nav=dict(groundY=5.2, ground=[], water=[], buildings=[]),
      )
      raw = (json.dumps(packet, separators=(",", ":")) + "\n").encode()
      compressed = gzip.compress(raw, mtime=0)
      name = f"{identity}.{mode}.json.gz"
      (OUT / name).write_bytes(compressed)
      verts = len(base64.b64decode(mesh["positions"])) // 6
      indices = len(base64.b64decode(mesh["indices"])) // 4
      gpu = verts * 12 + indices * (2 if verts <= 65535 else 4)
      assert verts < 400000 and indices < 2400000 and len(raw) < 12 * 1024 * 1024
      descriptor[mode] = dict(
        url=name,
        encoding="gzip",
        bytes=len(compressed),
        decodedBytes=len(raw),
        sha256=hashlib.sha256(compressed).hexdigest(),
      )
      receipts[f"{mode}:{identity}"] = dict(
        vertices=verts, indices=indices, geometryBytes=gpu
      )
      counts[mode + "GeometryBytes"] += gpu
    descriptors.append(descriptor)
  assert len(cells) <= 8
  write_json(ADDITION, dict(chunks=descriptors))
  write_json(
    EVIDENCE,
    dict(
      policy=POLICY,
      sourceSha256=digest(SOURCE),
      unchangedInputs=source["inputs"],
      records=records,
      packets=receipts,
      counts=dict(counts),
      triangles={k: len(v.triangles) for k, v in detail.items()},
    ),
  )
  print(
    "packets",
    len(cells),
    "owners",
    len(records),
    "counts",
    dict(counts),
    "triangles",
    {k: len(v.triangles) for k, v in detail.items()},
  )


if __name__ == "__main__":
  import argparse

  p = argparse.ArgumentParser()
  p.add_argument("--refresh-source", action="store_true")
  a = p.parse_args()
  if a.refresh_source:
    extract()
  build()
