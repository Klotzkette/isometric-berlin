"""Finite Mensa and Bergstraße store models from the retained source frame.

The retained PBF contributes the three complete selected features. Store and
school photos are external architectural references. No reference pixels are
copied into the viewer payload.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import statistics
import zipfile
from collections import defaultdict
from pathlib import Path

from build_bebelplatz_building_source import extract_parent, part_profile
from pyogrio import read_dataframe
from pyproj import Transformer
from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon, box, mapping, shape
from shapely.geometry.polygon import orient
from shapely.ops import transform, unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "geo_data/regierungsviertel/raw/steglitz-v327-reference"
DATA = ROOT / "src/app/src/data"
PACKETS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SCHOOL_ZIP = RAW.parent / "lod2/LoD2_386_5813.zip"
OSM_PBF = RAW.parent / "outer-v159/berlin-260929.osm.pbf"
ALDI_IDS = {"DEBE06AL2xD0000Z", "DEBE06AL2xD0001P"}
PROJECTION = Transformer.from_crs(4326, 25833, always_xy=True)
ENTRY = {"lidl": (13.3299321, 52.4582847), "aldi": (13.3268946, 52.458113)}

CREAM = 0xDEDCD1
SILVER = 0xBDC3C4
STEEL = 0x393F44
GLASS = (0x405762, 0x526874, 0x3D505D, 0x5A707A)
BRICK = 0x484647


def digest(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def world(lon: float, lat: float) -> tuple[float, float]:
  east, north = PROJECTION.transform(lon, lat)
  return east - 389500, 5820000 - north


def world_shape(record: dict) -> Polygon:
  def project(lon, lat):
    east, north = PROJECTION.transform(lon, lat)
    return east - 389500, 5820000 - north

  result = transform(project, shape(record["geometry"]))
  assert result.geom_type == "MultiPolygon" and len(result.geoms) == 1
  return orient(result.geoms[0], sign=1)


def selected_osm():
  result = {}
  targets = {"16609777": "lidl", "729012945": "aldi", "387263944": "school"}
  data = read_dataframe(
    OSM_PBF,
    layer="multipolygons",
    bbox=(13.3244, 52.4564, 13.3308, 52.4592),
  )
  for _, row in data.iterrows():
    ids = (str(row.get("osm_id")), str(row.get("osm_way_id")))
    for identity in ids:
      name = targets.get(identity)
      if name:
        assert name not in result
        result[name] = {
          "id": identity,
          "tags": str(row["other_tags"]),
          "geometry": mapping(row.geometry),
        }
  assert set(result) == set(targets.values())
  return result


def raster_samples(file: str, points: set[tuple[int, int]]) -> dict:
  found = {}
  with (
    zipfile.ZipFile(RAW / file) as archive,
    archive.open(archive.namelist()[0]) as raw,
  ):
    for line in raw:
      e, n, h = map(float, line.split())
      key = (math.floor(e % 1_000_000), math.floor(n))
      if key in points:
        found[key] = h
  assert found.keys() == points
  return found


def supports():
  seen = {}
  aldi = {}
  for mode in ("drawn", "minecraft"):
    for tile in ("ring182--7_12", "ring182--7_13", "ring182--6_12", "ring182--6_13"):
      path = PACKETS / f"{tile}.{mode}.json.gz"
      packet = json.loads(gzip.decompress(path.read_bytes()))
      origin, nav = packet["origin"], packet["nav"]
      seen[path.name] = digest(path)
      assert nav["groundY"] == 3

      def polygon(row):
        def ring(pts):
          return [(x + origin[0], z + origin[2]) for x, z in pts]

        return Polygon(ring(row["ring"]), [ring(h) for h in row.get("holes", [])])

      aldi.setdefault(mode, []).extend(
        polygon(r) for r in nav["buildings"] if r["sourceId"] in ALDI_IDS
      )
      if "--6_" in tile:
        yield (
          mode,
          tile,
          [polygon(r) for r in nav["buildings"]],
          [polygon(r) for r in nav["ground"]],
        )
  yield (
    seen,
    {
      mode: orient(unary_union(rows).simplify(0), sign=1) for mode, rows in aldi.items()
    },
  )


def edges(poly):
  points = list(poly.exterior.coords)
  for a, b in zip(points, points[1:]):
    if math.dist(a, b) > 0.0001:
      yield a, b


class Front:
  def __init__(self, a, b):
    self.a, self.b = a, b
    self.length = math.dist(a, b)
    self.dx, self.dz = (b[0] - a[0]) / self.length, (b[1] - a[1]) / self.length
    self.nx, self.nz = self.dz, -self.dx
    self.yaw = math.atan2(-self.dz, self.dx)

  def point(self, u, offset=0):
    return self.a[0] + u * self.dx + offset * self.nx, self.a[
      1
    ] + u * self.dz + offset * self.nz

  def row(self, u, y, w, h, depth, rgb, offset=0.04):
    x, z = self.point(u, offset)
    return [x, y, z, w, h, depth, self.yaw, rgb]

  def sub(self, start, end):
    return Front(self.point(start), self.point(end))


def pane_band(rows, front, bottom, top, pitch, *, frame=STEEL, transom=True):
  count = max(1, round(front.length / pitch))
  step = front.length / count
  height = top - bottom
  for i in range(count):
    rows.append(
      front.row(
        (i + 0.5) * step, (top + bottom) / 2, step, height, 0.07, GLASS[i % len(GLASS)]
      )
    )
  for i in range(count + 1):
    rows.append(
      front.row(i * step, (top + bottom) / 2, 0.075, height, 0.105, frame, 0.082)
    )
  for y in (bottom, top, bottom + 0.28 * height) if transom else (bottom, top):
    rows.append(front.row(front.length / 2, y, front.length, 0.09, 0.105, frame, 0.084))


def mensa():
  parent = extract_parent(SCHOOL_ZIP, "DEBE06YYB0000AUq")
  profiles = [part_profile(part) for part in leaf_building_parts(parent)]
  arc_ids = {"DEBE3DrwNPVZQPmu", "DEBE3DR3T6f1tQ3n"}
  selected = [p for p in profiles if p["id"] in arc_ids]
  assert len(selected) == 2
  offset = 3.55 - min(p["ground_y_m"] for p in profiles)
  assert round(offset, 3) == -9.922
  drawn, native = [], []
  measured = []
  for p in selected:
    part = orient(Polygon(p["ring"]), sign=1)
    for index, wall in enumerate(p["surfaces"]):
      if wall["kind"] != "WallSurface":
        continue
      ring = wall["rings"][0]
      xz = {tuple((r[0], r[2])) for r in ring}
      if len(xz) != 2 or min(r[1] for r in ring) + offset > 4:
        continue
      a, b = next((a, b) for a, b in edges(part) if {a, b} == xz)
      front = Front(a, b)
      if not 1.0 <= front.length <= 1.2:
        continue
      measured.append({"part": p["id"], "wall": index, "ring": ring})
      high = min(r[1] for r in ring if r[1] > 22) + offset
      drawn.extend(
        [
          front.row(
            front.length / 2, (8.36 + 9.26) / 2, front.length, 0.9, 0.12, CREAM, 0.066
          ),
          front.row(
            front.length / 2,
            (12.36 + high) / 2,
            front.length,
            high - 12.36,
            0.13,
            CREAM,
            0.066,
          ),
        ]
      )
      pane_band(drawn, front, 9.26, 12.36, 1.12, frame=CREAM)
  assert len(measured) == 30
  # Select actual occupied one-metre cells at the band elevation. The old
  # source has its own cardinal envelope, including the unchanged flat joint.
  rows = json.loads((DATA / "steglitzV182Native.json").read_text())["boxes"]
  cells = set()
  for x, y, z, w, h, d, _ in rows:
    if not (y - h / 2 < 11 < y + h / 2 and w >= 1 and d >= 1):
      continue
    if not (-3310 < x < -3265 and 6825 < z < 6860):
      continue
    for cx in range(round(x - w / 2), round(x + w / 2)):
      for cz in range(round(z - d / 2), round(z + d / 2)):
        cells.add((cx, cz))
  west = {z: min(x for x, zz in cells if zz == z) for _, z in cells}
  north = {x: min(z for xx, z in cells if xx == x) for x, _ in cells}
  for f in cell_fronts(cells):
    x, z = f.point(f.length / 2)
    west_arc = (
      f.nx == -1
      and x == west.get(math.floor(z))
      and -3297.1 <= x < -3289.9
      and 6834 <= z <= 6853.2
    )
    north_arc = (
      f.nz == -1
      and z == north.get(math.floor(x))
      and 6833.9 <= z <= 6836.8
      and -3291 < x <= -3280.2
    )
    if west_arc or north_arc:
      native.extend(
        [
          f.row(0.5, 8.8, 1, 0.9, 0.14, CREAM, 0.09),
          f.row(0.5, 12.8, 1, 0.84, 0.14, CREAM, 0.09),
        ]
      )
      pane_band(native, f, 9.25, 12.38, 1, frame=CREAM)
  assert 30 <= len(native) < 450
  return drawn, native, measured


def cell_fronts(cells):
  for x, z in sorted(cells):
    for dx, dz, a, b in (
      (0, -1, (x, z), (x + 1, z)),
      (1, 0, (x + 1, z), (x + 1, z + 1)),
      (0, 1, (x + 1, z + 1), (x, z + 1)),
      (-1, 0, (x, z + 1), (x, z)),
    ):
      if (x + dx, z + dz) not in cells:
        yield Front(a, b)


def signage(signs, front, u, y, text, height, rgb, offset):
  x, z = front.point(u, offset)
  signs.append([x, y, z, front.dx, front.dz, front.nx, front.nz, text, height, rgb])


def aldi_front(poly, native):
  rows, signs = [], []
  sign_fronts = {}
  pieces = [poly] if poly.geom_type == "Polygon" else poly.geoms
  for a, b in (edge for piece in pieces for edge in edges(piece)):
    f = Front(a, b)
    # The owner photo and plan show the southwest entrance returning to
    # the west. Follow the actual retained silhouette of these two pieces.
    if f.nz > 0.9 and min(a[1], b[1]) > 6689:
      limit = -3164.0
      endpoints = sorted(
        [max(0, min(f.length, (limit - f.a[0]) / f.dx)), f.length if f.dx < 0 else 0]
      )
    elif f.nx < -0.9 and min(a[0], b[0]) < -3175:
      endpoints = sorted(
        [max(0, min(f.length, (6680.8 - f.a[1]) / f.dz)), f.length if f.dz > 0 else 0]
      )
    else:
      continue
    start, end = endpoints
    if end - start < 0.2:
      continue
    f = f.sub(start, end)
    u = f.length / 2
    rows.append(f.row(u, 5.02, f.length, 3.82, 0.09, BRICK))
    pane_band(rows, f, 3.15, 6.83, 1.16 if not native else 1.5, transom=False)
    rows.append(
      f.row(
        u,
        7.44,
        f.length,
        1.06,
        1.94 if f.length > 1 else 0.24,
        SILVER,
        0.92 if f.length > 1 else 0.1,
      )
    )
    rows.append(
      f.row(
        u,
        8.0,
        f.length,
        0.075,
        2.02 if f.length > 1 else 0.3,
        STEEL,
        0.92 if f.length > 1 else 0.1,
      )
    )
    if f.length >= 3.5:
      side = "south" if f.nz > 0.9 else "west"
      prior = sign_fronts.get(side)
      if prior is None or f.length > prior.length:
        sign_fronts[side] = f
  for f in sign_fronts.values():
    u = f.length / 2
    rows.append(f.row(u, 7.19, min(3.1, f.length - 0.2), 0.12, 0.13, 0xC63542, 1.93))
    signage(signs, f, u, 7.49, "ALDI", 0.57, 0x203B70, 2.00)
  assert rows and len(signs) == 2
  return rows, signs


def floor_triangles(poly, y, rgb):
  return [
    [rgb, *[v for x, z in list(t.exterior.coords)[:3] for v in (x, y, z)]]
    for t in constrained_delaunay_triangles(poly).geoms
  ]


def lidl_parts(poly, top, native):
  rows, signs, triangles, colliders, roof_runs = [], [], [], [], []
  bottom = 3.0
  upper = 6.53
  minx, minz, maxx, maxz = poly.bounds
  cells = (
    {
      (x, z)
      for x in range(math.floor(minx), math.ceil(maxx))
      for z in range(math.floor(minz), math.ceil(maxz))
      if poly.covers(box(x, z, x + 1, z + 1))
    }
    if native
    else set()
  )
  if native:
    grouped = defaultdict(list)
    for x, z in sorted(cells):
      grouped[z].append(x)
    for z, xs in sorted(grouped.items()):
      begin = previous = xs[0]
      for x in [*xs[1:], xs[-1] + 2]:
        if x != previous + 1:
          roof_runs.append([begin, z, previous + 1, z + 1])
          begin = x
        previous = x
    for a, b, c, d in roof_runs:
      rows.append(
        [
          (a + c) / 2,
          (upper + top) / 2,
          (b + d) / 2,
          c - a,
          top - upper,
          d - b,
          0,
          0x797F74,
        ]
      )
    fronts = list(cell_fronts(cells))
  else:
    fronts = [Front(a, b) for a, b in edges(poly)]
    triangles = floor_triangles(poly, top, 0x797F74) + floor_triangles(
      poly, upper, 0xA5A9A6
    )
  # Roof strips are placed in the two observed PV blocks of the official
  # 2026 orthophoto. Every entire panel is inside its represented roof.
  support = unary_union([box(*q) for q in roof_runs]) if native else poly
  for start_x, columns, start_z, ranks in [
    (-2976, 2, 6614, 28),
    (-2955.5, 1, 6630, 17),
  ]:
    for col in range(columns):
      for rank in range(ranks):
        x, z = start_x + 8.6 * col + 0.066 * (rank * 2.12), start_z + rank * 2.12
        if support.covers(box(x - 3.35, z - 0.76, x + 3.35, z + 0.76)):
          rows.append([x, top + 0.08, z, 6.7, 0.14, 1.52, 0, 0x323F50])
  for f in fronts:
    x, z = f.point(f.length / 2)
    street = f.nz > 0.45 and z > 6673
    lobby = f.nx < -0.45 and z > 6663 and x < -2969
    glazing = street or lobby
    lower_glass = lobby or street and x < -2967
    ymid = (upper + top) / 2
    if not native:
      a, b = f.a, f.b
      corners = [
        (a[0], upper, a[1]),
        (b[0], upper, b[1]),
        (b[0], top, b[1]),
        (a[0], top, a[1]),
      ]
      triangles.extend(
        [
          [CREAM, *corners[0], *corners[1], *corners[2]],
          [CREAM, *corners[0], *corners[2], *corners[3]],
        ]
      )
    if glazing:
      pane_band(
        rows,
        f,
        bottom + 0.14 if lower_glass else upper + 0.18,
        top - 1.12,
        1.35 if native else 1.28,
      )
      rows.append(f.row(f.length / 2, top - 0.54, f.length, 1.08, 0.17, SILVER, 0.08))
      rows.append(f.row(f.length / 2, upper + 0.04, f.length, 0.16, 0.11, STEEL, 0.11))
    elif native:
      rows.append(f.row(f.length / 2, ymid, f.length, top - upper, 0.07, CREAM))
    if lower_glass or f.nx < -0.45 or street:
      row = f.row(
        f.length / 2,
        (bottom + upper) / 2,
        f.length,
        upper - bottom,
        0.25,
        GLASS[0] if lower_glass else 0xC9C7B9,
        -0.11,
      )
      rows.append(row)
      colliders.append(row[:7])
  # The corner signs face the two photographed streets. Their attachment
  # planes are selected independently from each complete representation.
  for target in [(-2974.8, 6670), (-2966.9, 6678.1)]:
    candidates = [
      f
      for f in fronts
      if (f.nx < -0.45 and target[0] < -2970) or (f.nz > 0.45 and target[0] > -2970)
    ]
    f = min(candidates, key=lambda f: math.dist(f.point(f.length / 2), target))
    u = max(0, min(f.length, (target[0] - f.a[0]) * f.dx + (target[1] - f.a[1]) * f.dz))
    y = upper + 2.93
    rows.append(f.row(u, y, 2.28, 2.28, 0.23, 0x174B91, 0.18))
    for rank in range(-6, 7):
      fraction = (rank * 0.148) / 1.02
      chord = 2 * 1.02 * math.sqrt(1 - fraction**2)
      rows.append(f.row(u, y + rank * 0.148, chord, 0.148, 0.075, 0xD72F39, 0.32))
      rows.append(
        f.row(u, y + rank * 0.148, chord * 0.88, 0.129, 0.067, 0xF0D032, 0.365)
      )
    signage(signs, f, u, y, "LIDL", 0.48, 0x183F77, 0.44)
  # Two existing exposed corners are left open for the ground-level parking
  # deck. This finite architectural interpretation adds only visible piers.
  for x, z in [
    (-2974, 6622),
    (-2965, 6615),
    (-2954, 6615),
    (-2945, 6620),
    (-2944, 6632),
    (-2943, 6644),
    (-2942, 6656),
    (-2941, 6668),
  ]:
    if support.covers(box(x - 0.42, z - 0.42, x + 0.42, z + 0.42)):
      row = [x, (bottom + upper) / 2, z, 0.79, upper - bottom, 0.79, 0, 0x999E9B]
      rows.append(row)
      colliders.append(row[:7])
  return {
    "rows": rows,
    "signs": signs,
    "triangles": triangles,
    "colliders": colliders,
    "roofRuns": roof_runs,
  }


def quantize(value):
  if isinstance(value, dict):
    return {k: quantize(v) for k, v in value.items()}
  if isinstance(value, (list, tuple)):
    return [quantize(v) for v in value]
  return round(value, 6) if isinstance(value, float) else value


def native_rows(rows):
  """Bake cardinal directions as literal axis dimensions, with zero yaw."""
  result = []
  for row in rows:
    x, y, z, w, h, d, yaw, *tail = row
    assert abs(math.sin(2 * yaw)) < 1e-8
    if abs(math.sin(yaw)) > 0.5:
      w, d = d, w
    result.append([x, y, z, w, h, d, 0, *tail])
  return result


def build():
  osm = selected_osm()
  assert [osm[name]["id"] for name in ("lidl", "aldi", "school")] == [
    "16609777",
    "729012945",
    "387263944",
  ]
  lidl = world_shape(osm["lidl"])
  audit = list(supports())
  packet_hashes, aldi = audit[-1]
  for mode in ("drawn", "minecraft"):
    tiles = [row for row in audit[:-1] if row[0] == mode]
    if mode == "drawn":
      assert all(
        lidl.intersection(p).area < 0.001
        for _, _, buildings, _ in tiles
        for p in buildings
      )
    assert (
      unary_union([p for _, _, _, ground in tiles for p in ground])
      .buffer(0.02)
      .covers(lidl)
    )
  dgm_points = {(386526, 5813323), (386527, 5813323), (386528, 5813324)}
  roof_points = {
    (x, y)
    for x in (386529, 386534, 386540)
    for y in (5813332, 5813340, 5813350, 5813360, 5813370, 5813380)
  }
  dgm = raster_samples("dgm1_386_5812.zip", dgm_points)
  bdom = raster_samples("bdom_386_5812.zip", roof_points)
  top = round(3 + statistics.median(bdom.values()) - statistics.median(dgm.values()), 2)
  assert 13 < top < 14
  drawn_school, native_school, measured = mensa()
  families = {}
  for mode, school in [("drawn", drawn_school), ("minecraft", native_school)]:
    native = mode == "minecraft"
    parts = lidl_parts(lidl, top, native)
    if native:
      occupied = unary_union([box(*row) for row in parts["roofRuns"]])
      assert all(
        occupied.intersection(p).area < 0.001
        for m, _, buildings, _ in audit[:-1]
        if m == mode
        for p in buildings
      )
    aldi_rows, aldi_signs = aldi_front(aldi[mode], native)
    parts["rows"].extend(aldi_rows + school)
    parts["signs"].extend(aldi_signs)
    if native:
      parts["rows"] = native_rows(parts["rows"])
      parts["colliders"] = native_rows(parts["colliders"])
    families[mode] = parts
  payload = {
    "schemaVersion": 1,
    "roofY": top,
    "upperUndersideY": 6.53,
    "lidlRing": list(lidl.exterior.coords)[:-1],
    "families": families,
  }
  evidence = {
    "schemaVersion": 1,
    "references": {
      "lidl": [
        "https://www.lidl.de/s/de-DE/filialen/berlin-steglitz-zehlendorf/bergstrasse-86/",
        "https://baubetreuung-fischer.de/discounter.html",
        "https://www.openstreetmap.org/relation/16609777",
        "https://www.openstreetmap.org/node/11277917350",
      ],
      "aldi": [
        "https://www.aldi-nord.de/filialen-und-oeffnungszeiten/filialen-und-oeffnungszeiten/berlin/bergstrasse-93-97/3181113.html",
        "https://www.eduard-winter.de/EWBerg.html",
        "https://www.openstreetmap.org/way/729012945",
        "https://www.openstreetmap.org/node/11277040858",
      ],
      "school": [
        "https://gymnasiumsteglitz.de/kontakt",
        "https://lkkarchitekten.de/projekte/mensa-gymnasium-steglitz/",
        "https://www.berlin.de/ba-steglitz-zehlendorf/aktuelles/schulbauoffensive/weiterfuehrende-schulen/gymnasium-steglitz-1218110.php",
      ],
    },
    "osm": {
      "license": "ODbL-1.0",
      "pbfSha256": digest(OSM_PBF),
      "lidl": osm["lidl"],
      "aldi": osm["aldi"],
      "school": osm["school"],
      "entrancesWgs84": ENTRY,
    },
    "official": {
      "license": "dl-de/zero-2-0",
      "lod2Sha256": digest(SCHOOL_ZIP),
      "mensaWallSheets": measured,
      "dgm1Sha256": digest(RAW / "dgm1_386_5812.zip"),
      "bdom2026Sha256": digest(RAW / "bdom_386_5812.zip"),
      "dgmSamples": [[*p, y] for p, y in sorted(dgm.items())],
      "bdomSamples": [[*p, y] for p, y in sorted(bdom.items())],
      "trueDop2026": "https://gdi.berlin.de/services/wms/truedop_2026",
    },
    "retainedPacketsSha256": packet_hashes,
    "aldiRetainedOwners": sorted(ALDI_IDS),
    "displayEstimates": [
      "Glazing, canopy, signs and precise trim depths are photo interpretations.",
      "Lidl rigid datum is the retained streamed ground at 3 m. Roof is the sampled relative bDOM/DGM difference.",
      "Lidl upper underside, open parking columns and roof panel subgroups are exterior display estimates.",
      "LoD2 Mensa silhouette remains intact. Photo glazing/courses overlay only its existing upper arc.",
    ],
  }
  return quantize(payload), quantize(evidence)


if __name__ == "__main__":
  product, evidence = build()
  for path, value in [
    (DATA / "steglitzSchoolStoresV327.json", product),
    (
      ROOT / "geo_data/regierungsviertel/steglitz-school-stores-v327-evidence.json",
      evidence,
    ),
  ]:
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")
    print(path.name, path.stat().st_size, digest(path))
