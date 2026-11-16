"""Finite source-bound Düppel huts and Brücke/Kunsthaus garden recognition.

The village is medieval, not a Stone Age settlement. Mapped positions and retained
measured envelopes are source evidence; joinery, thatch and furniture dimensions
are documented photographic display estimates. No reference pixels are shipped.
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

import numpy as np
import shapely
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union

from scripts.build_karl_marx_allee_v161 import Detail
from scripts.build_public_institutions_v326 import (
  InstitutionPackets,
  merged_cell_faces,
  native_columns,
  part_footprint,
  source_triangles,
)
from scripts.build_surrounding_outlines import PackedMesh

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
DATA = ROOT / "src/app/src/data"
KIND = "museums-southwest-v354"
SOURCE = GEO / "museums-southwest-v354-source.json.gz"
HUTS = {"346675394": "10", "159434613": "11", "159434612": "15"}
FAMILIES = {"DEBE06YYA000081C", "DEBE06YYA0000Ipi", "DEBE06YYA00009CA"}
WOOD, DARK, THATCH, CLAY = (
  (143, 125, 99),
  (91, 80, 64),
  (187, 176, 137),
  (174, 151, 111),
)


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path, value):
  raw = (
    json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  ).encode()
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def source(output):
  original = read(output / "mapped.json.gz")["records"]
  site = next(r for r in original if r["properties"].get("osm_way_id") == "28147152")
  area = shape(site["geometry"])
  rows = [r for r in original if area.buffer(0.1).covers(shape(r["geometry"]).centroid)]
  buildings = [r for r in rows if r["properties"].get("building")]
  manifest = read(PUBLIC / "manifest.json")
  hosts = [c for c in manifest["chunks"] if box(*c["bounds"]).intersects(area)]
  audits = []
  for row in buildings:
    geometry = shape(row["geometry"])
    matches = {}
    for mode in ["drawn", "minecraft"]:
      found = []
      for h in hosts:
        if mode not in h:
          continue
        packet = read(PUBLIC / h[mode]["url"])
        for b in packet["nav"]["buildings"]:
          g = translate(
            Polygon(b["ring"], b.get("holes", [])),
            packet["origin"][0],
            packet["origin"][2],
          )
          overlap = geometry.intersection(g).area
          if overlap > 1e-7:
            found.append(dict(host=h["id"], owner=b["sourceId"], overlapM2=overlap))
      matches[mode] = found
    identity = row["properties"]["osm_way_id"]
    status = "existing-envelope-retained"
    if identity in HUTS:
      assert not matches["drawn"] and not matches["minecraft"], (identity, matches)
      status = "new-numbered-hut-photographic-typology-on-mapped-outline"
    elif not matches["drawn"] and not matches["minecraft"]:
      status = "unresolved-individual-photo-identity-no-guessed-house"
    audits.append(
      dict(
        osmWay=identity,
        ref=row["properties"].get("ref"),
        status=status,
        matches=matches,
      )
    )
  all_families = read(GEO / "public-institutions-v326-source.json.gz")["families"]
  families = [f for f in all_families if f["id"] in FAMILIES]
  assert {f["id"] for f in families} == FAMILIES
  refs = [
    (
      "museum-period-and-current-site",
      "https://www.berlin.museum/museum/museumsdorf-dueppel",
    ),
    (
      "timber-post-block-and-reed-construction",
      "https://www.dueppel.de/museumsdorf/gebaeude/",
    ),
    (
      "hay-store-10-photos-and-location",
      "https://retold.eu/case-study/system/buildings/building-10",
    ),
    (
      "museum-photogrammetry-collection",
      "https://sketchfab.com/stadtmuseumBLN/collections/museumsdorf-duppel-museum-village-duppel-a243b7c749734464b0d720c526f113f6",
    ),
    (
      "bruecke-built-architecture",
      "https://www.bruecke-museum.de/de/museum/63/architektur",
    ),
    ("kunsthaus-current-exterior", "https://kunsthaus-dahlem.de/haus/ueber-uns/"),
    ("current-cafe-and-terrace", "https://www.cafe-im-kunsthaus-dahlem.de/"),
    (
      "future-competition-not-built",
      "https://www.berlin.de/sen/bauen/wettbewerbe/2026/bruecke-museum/",
    ),
  ]
  value = dict(
    schemaVersion=1,
    checked="2026-11-16",
    period="reconstructed village around 1170–1220; separate bronze-age experimental huts are not Stone Age",
    sourceFiles={
      str(p.relative_to(ROOT)): sha(p)
      for p in [
        GEO / "raw/city-v346/berlin-2026-11-13.osm.pbf",
        GEO / "public-institutions-v326-source.json.gz",
      ]
    },
    villageSite=site,
    mapped=rows,
    brueckeMapped=read(output / "bruecke-osm.json.gz"),
    originalFamilies=families,
    inventory=audits,
    references=[dict(role=r, url=u, accessed="2026-11-16") for r, u in refs],
    estimates="Individual elevations, reed thickness, log diameters, door leaf and furniture dimensions are display estimates, not a measured architectural survey. Museum photo/model numbering is a typology reference reconciled to mapped ref tags, not a traced excavation plan.",
  )
  write(SOURCE, value)
  return value


def tint(color, delta):
  return tuple(max(0, min(255, v + delta)) for v in color)


def beam(detail, a, b, radius, color, role):
  a, b = np.asarray(a, float), np.asarray(b, float)
  d = b - a
  d /= np.linalg.norm(d)
  u = np.cross(d, [0, 1, 0] if abs(d[1]) < 0.9 else [1, 0, 0])
  u /= np.linalg.norm(u)
  v = np.cross(d, u)
  for k in range(6):
    c = u * math.cos(k * math.tau / 6) + v * math.sin(k * math.tau / 6)
    e = u * math.cos((k + 1) * math.tau / 6) + v * math.sin((k + 1) * math.tau / 6)
    detail.polygon(
      [
        (a + c * radius).tolist(),
        (b + c * radius).tolist(),
        (b + e * radius).tolist(),
        (a + e * radius).tolist(),
      ],
      tint(color, (k % 3 - 1) * 5),
      role,
    )


def frame(row):
  g = shape(row["geometry"])
  if g.geom_type == "MultiPolygon":
    assert len(g.geoms) == 1
    g = g.geoms[0]
  p = list(g.minimum_rotated_rectangle.exterior.coords)[:4]
  i = max(range(4), key=lambda i: math.dist(p[i], p[(i + 1) % 4]))
  a, b, c, d = [np.array(p[(i + j) % 4]) for j in range(4)]
  u, v = b - a, d - a
  length, width = np.linalg.norm(u), np.linalg.norm(v)
  u, v = u / length, v / width
  center = (a + c) / 2
  return g, center, u, v, length, width


def hut(row, native):
  g, center, u, v, length, width = frame(row)
  name = HUTS[row["properties"]["osm_way_id"]]
  store = name == "10"
  eave, top = (2.65, 5.25) if store else (1.3, 4.7 if name == "11" else 5.35)
  detail, nav = Detail(), []

  def point(x, y, z):
    p = center + u * x + v * z
    return [float(p[0]), float(y + 3), float(p[1])]

  def roof(x, z):
    slope = (
      max(abs(z) / (width / 2), max(0, (abs(x) - (length - width) / 2)) / (width / 2))
      if store
      else abs(z) / (width / 2)
    )
    return eave + (top - eave) * max(0, 1 - slope)

  identity = KIND + ":hut-" + name
  if native:
    # Independent solid membership sampled on source-contained quarter-metre cells.
    # The store retains its open volume, platform, four supports and roof interval.
    cells, intervals = {}, {}
    step = 0.25
    x0, z0, x1, z1 = g.bounds
    for ix in range(math.floor(x0 / step), math.ceil(x1 / step)):
      for iz in range(math.floor(z0 / step), math.ceil(z1 / step)):
        square = box(ix * step, iz * step, (ix + 1) * step, (iz + 1) * step)
        if not g.covers(square):
          continue
        p = np.array([(ix + 0.5) * step, (iz + 0.5) * step]) - center
        x, z = float(np.dot(p, u)), float(np.dot(p, v))
        high = 3 + roof(x, z)
        ranges = []
        if store:
          ranges = [(3.4, 3.65, WOOD), (high - 0.3, high, THATCH)]
          if (
            abs(abs(x) - (length / 2 - 0.55)) < 0.3
            and abs(abs(z) - (width / 2 - 0.5)) < 0.3
          ):
            ranges.append((3, 3 + eave, WOOD))
          elif z > width / 2 - 0.65 and abs(x) < length / 2 - 0.55:
            ranges.append((3.65, 4.4, DARK))
        else:
          ranges = [(3, high, WOOD)]
        column_ys = set()
        for low, high, color in ranges:
          for iy in range(math.floor(low / step), math.ceil(high / step)):
            col = THATCH if not store and iy * step > 3 + eave else color
            cells[ix, iy, iz] = col
            column_ys.add(iy)
        ys = sorted(column_ys)
        runs = []
        for y in ys:
          if runs and runs[-1][1] == y:
            runs[-1][1] = y + 1
          else:
            runs.append([y, y + 1])
        for low, high in runs:
          intervals.setdefault((low * step, high * step), []).append(square)
    for tri, color in merged_cell_faces(cells, step):
      detail.triangles.append((tri, color, "independent native hut"))
    for (low, high), squares in intervals.items():
      union = unary_union(squares)
      for poly in [union] if union.geom_type == "Polygon" else union.geoms:
        nav.append(nav_record(poly, low, high, identity))
  else:
    # Surface tessellation follows the surveyed plan. The roof's thickness and
    # subtle reed-course tones are explicit texture-free recognition estimates.
    if store:
      deck = [
        point(x, 0.5, z)
        for x, z in [
          (-length / 2, -width / 2),
          (length / 2, -width / 2),
          (length / 2, width / 2),
          (-length / 2, width / 2),
        ]
      ]
      detail.polygon(deck, WOOD, "raised store deck")
      nav.append(nav_record(g, 3.38, 3.52, identity + ":deck"))
      for x in [-length / 2 + 0.55, length / 2 - 0.55]:
        for z in [-width / 2 + 0.5, width / 2 - 0.5]:
          beam(
            detail,
            point(x, 0, z),
            point(x, eave, z),
            0.13,
            WOOD,
            "four open store posts",
          )
          q = Point(point(x, 0, z)[0], point(x, 0, z)[2]).buffer(0.16, resolution=3)
          nav.append(nav_record(q, 3, 3 + eave, identity + ":post"))
      for y in np.arange(0.65, 1.4, 0.09):
        beam(
          detail,
          point(-length / 2 + 0.5, y, width / 2 - 0.5),
          point(length / 2 - 0.5, y, width / 2 - 0.5),
          0.035,
          DARK,
          "woven willow store screen",
        )
      for x in np.arange(-length / 2, length / 2, 0.24):
        beam(
          detail,
          point(x, 0.52, -width / 2),
          point(x, 0.52, width / 2),
          0.025,
          DARK,
          "deck board joint",
        )
      for z in [-width / 2 + 0.5, width / 2 - 0.5]:
        beam(
          detail,
          point(-length / 2 + 0.5, eave, z),
          point(length / 2 - 0.5, eave, z),
          0.11,
          WOOD,
          "store wall plate",
        )
    else:
      # Log walls and gables occupy the mapped outline; the plan is not filled
      # with modern glazing or a generic repeated window grid.
      for i in range(4):
        a, b = (
          list(g.geoms)[0].exterior.coords[i : i + 2]
          if g.geom_type == "MultiPolygon"
          else list(g.exterior.coords)[i : i + 2]
        )
        for y in np.arange(0.1, eave, 0.2):
          beam(
            detail,
            [a[0], 3 + y, a[1]],
            [b[0], 3 + y, b[1]],
            0.105,
            WOOD,
            "horizontal blockwork",
          )
      for x in [-length / 2, length / 2]:
        detail.polygon(
          [point(x, eave, -width / 2), point(x, top, 0), point(x, eave, width / 2)],
          CLAY if name == "11" else WOOD,
          "gable material",
        )
        if name == "15":
          for y in np.arange(eave, top, 0.22):
            half = width / 2 * (top - y) / (top - eave)
            beam(
              detail,
              point(x, y, -half),
              point(x, y, half),
              0.065,
              WOOD,
              "gable log courses",
            )
      for x in np.arange(-length / 2 + 0.25, length / 2, 0.55):
        for sign in [-1, 1]:
          beam(
            detail,
            point(x, top + 0.12, 0),
            point(x, top - 0.45, sign * 0.45),
            0.045,
            WOOD,
            "crossed ridge retainers",
          )
      # Closed timber door cue; no guessed walk-through portal or indoor room.
      x = length / 2 + 0.02
      detail.polygon(
        [
          point(x, 0.05, -0.5),
          point(x, 0.05, 0.35),
          point(x, 1.75, 0.35),
          point(x, 1.75, -0.5),
        ],
        tint(WOOD, -13),
        "timber door leaf display estimate",
      )
    nx = max(8, round(length / 0.28))
    roof_tris = []
    # Quarter the roof so hip/ridge diagonals are exact, then add fine reed ribs.
    r0, r1 = (
      point(-max(0, (length - width) / 2), top, 0),
      point(max(0, (length - width) / 2), top, 0),
    )
    if not store:
      r0, r1 = point(-length / 2, top, 0), point(length / 2, top, 0)
    corners = [
      point(x, eave, z)
      for x, z in [
        (-length / 2, -width / 2),
        (length / 2, -width / 2),
        (length / 2, width / 2),
        (-length / 2, width / 2),
      ]
    ]
    faces = [[corners[0], corners[1], r1, r0], [corners[2], corners[3], r0, r1]]
    if store:
      faces += [[corners[3], corners[0], r0], [corners[1], corners[2], r1]]
    for f in faces:
      start = len(detail.triangles)
      detail.polygon(f, THATCH, "reed roof")
      roof_tris.extend(t for t, _, _ in detail.triangles[start:])
    for sign in [-1, 1]:
      for i in range(nx):
        x = -length / 2 + (i + 0.5) * length / nx
        z0 = 0 if not store else max(0, abs(x) - (length - width) / 2)
        a, b = (
          point(x, roof(x, sign * z0) + 0.03, sign * z0),
          point(x, eave + 0.025, sign * width / 2),
        )
        beam(detail, a, b, 0.012, tint(THATCH, (i % 5 - 2) * 5), "fine reed bundles")
    for a, b in zip(corners, corners[1:] + corners[:1]):
      beam(detail, a, b, 0.1, tint(THATCH, -18), "thick reed eave")
    record = nav_record(g, 3 + eave - 0.3 if store else 3, 3 + top, identity, roof_tris)
    if store:
      record["bottomRoofTriangles"] = [
        [[x, y - 0.3, z] for x, y, z in t] for t in roof_tris
      ]
    nav.append(record)
  return (
    detail,
    nav,
    dict(
      number=name,
      osmWay=row["properties"]["osm_way_id"],
      bounds=list(g.bounds),
      eaveM=eave,
      ridgeM=top,
      independentNative=native,
    ),
  )


def nav_record(poly, low, high, identity, roofs=None):
  row = dict(
    ring=[list(p) for p in poly.exterior.coords],
    holes=[[list(p) for p in h.coords] for h in poly.interiors],
    sourceId=identity,
    minHeight=0,
    groundOffset=low - 3,
    height=high - low,
    heightSource="mapped-outline-photo-estimated-v354",
  )
  if roofs:
    row["roofTriangles"] = roofs
  return row


def local_nav(rows, origin):
  result = []
  for r in rows:
    row = {
      **r,
      "ring": [
        [round(x - origin[0], 4), round(z - origin[2], 4)] for x, z in r["ring"]
      ],
      "holes": [
        [[round(x - origin[0], 4), round(z - origin[2], 4)] for x, z in h]
        for h in r["holes"]
      ],
    }
    for field in ["roofTriangles", "bottomRoofTriangles"]:
      if field not in row:
        continue
      row[field] = [
        [
          [round(x - origin[0], 4), round(y - 3, 4), round(z - origin[2], 4)]
          for x, y, z in t
        ]
        for t in row[field]
      ]
      # Surrounding roofTriangle Y is relative to nav.groundY + groundOffset.
      off = row["groundOffset"]
      for tri in row[field]:
        for p in tri:
          p[1] -= off
    result.append(row)
  return result


def palisade(s, native):
  line = shape(
    next(
      r["geometry"] for r in s["mapped"] if r["properties"].get("osm_id") == "159434619"
    )
  )
  gate = shape(
    next(
      r["geometry"]
      for r in s["mapped"]
      if r["properties"].get("osm_id") == "3531946274"
    )
  )
  center = line.project(gate)
  gap = 3.2
  detail, nav = Detail(), []
  if native:
    # Independent cardinal posts contained in the documented timber-fence band.
    band = line.buffer(0.18).difference(gate.buffer(gap / 2))
    cells = {}
    x0, z0, x1, z1 = band.bounds
    step = 0.2
    for ix in range(math.floor(x0 / step), math.ceil(x1 / step)):
      for iz in range(math.floor(z0 / step), math.ceil(z1 / step)):
        q = box(ix * step, iz * step, (ix + 1) * step, (iz + 1) * step)
        if not band.covers(q):
          continue
        for iy in range(15, 35):
          cells[ix, iy, iz] = WOOD
        nav.append(nav_record(q, 3, 7, KIND + ":palisade"))
    for tri, color in merged_cell_faces(cells, step):
      detail.triangles.append((tri, color, "native mapped palisade"))
  else:
    for distance in np.arange(0.1, line.length, 0.24):
      if abs(distance - center) < gap / 2:
        continue
      p = line.interpolate(distance)
      high = 6.9 + (int(distance / 0.24) % 3) * 0.045
      beam(
        detail, [p.x, 3, p.y], [p.x, high, p.y], 0.125, WOOD, "mapped palisade timbers"
      )
      detail.lathe(
        p.x, p.y, [(high, 0.125), (high + 0.14, 0)], WOOD, "split timber top", 6
      )
      nav.append(
        nav_record(p.buffer(0.14, resolution=3), 3, high + 0.14, KIND + ":palisade")
      )
  a, b = line.interpolate(center - gap / 2), line.interpolate(center + gap / 2)
  if native:
    for distance in np.arange(center - gap / 2, center + gap / 2, 0.16):
      p = line.interpolate(distance)
      detail.box([p.x, 6.8, p.y], [0.22, 0.25, 0.22], WOOD, "cardinal gate lintel")
  else:
    beam(
      detail, [a.x, 6.8, a.y], [b.x, 6.8, b.y], 0.18, WOOD, "open timber gate lintel"
    )
  from shapely.geometry import LineString

  nav.append(
    nav_record(
      LineString([(a.x, a.y), (b.x, b.y)]).buffer(0.2, cap_style=2),
      6.6,
      7,
      KIND + ":gate-lintel",
    )
  )
  return (
    detail,
    nav,
    dict(
      feature="palisade",
      osmWay="159434619",
      gateNode="3531946274",
      gateClearWidthM=gap,
      heightSource="OSM height=4m; timber gauge from official entrance photo, display estimate",
      independentNative=native,
    ),
  )


def support_height(triangles, x, z):
  a, b, c = triangles[:, 0], triangles[:, 1], triangles[:, 2]
  det = (b[:, 2] - c[:, 2]) * (a[:, 0] - c[:, 0]) + (c[:, 0] - b[:, 0]) * (
    a[:, 2] - c[:, 2]
  )
  valid = np.abs(det) > 1e-8
  u = np.full(len(a), -99.0)
  v = u.copy()
  u[valid] = (
    (b[valid, 2] - c[valid, 2]) * (x - c[valid, 0])
    + (c[valid, 0] - b[valid, 0]) * (z - c[valid, 2])
  ) / det[valid]
  v[valid] = (
    (c[valid, 2] - a[valid, 2]) * (x - c[valid, 0])
    + (a[valid, 0] - c[valid, 0]) * (z - c[valid, 2])
  ) / det[valid]
  ok = valid & (u >= -1e-7) & (v >= -1e-7) & (u + v <= 1 + 1e-7)
  values = (u * a[:, 1] + v * b[:, 1] + (1 - u - v) * c[:, 1])[ok]
  assert len(values) and 15 < float(max(values)) < 20, (x, z, values)
  return float(max(values))


def cafe(s, output, native):
  mode = "minecraft" if native else "drawn"
  host = "outer187--14_11"
  capture = read(output / f"capture-{mode}-{host}.json.gz")
  triangles = np.asarray(capture["triangles"]).reshape(-1, 3, 3)
  area = shape(
    next(
      r["geometry"]
      for r in s["brueckeMapped"]
      if r["properties"].get("osm_way_id") == "1558604602"
    )
  )
  buildings = unary_union(
    [
      shape(r["geometry"])
      for r in s["brueckeMapped"]
      if r["properties"].get("building")
    ]
  )
  detail, nav, audit = Detail(), [], []
  metal = (49, 52, 49)
  wood = (147, 119, 78)
  for index, (x, z) in enumerate(
    [(-6756.5, 5675.5), (-6754.5, 5669.5), (-6760.5, 5657), (-6748.5, 5657)]
  ):
    assert (
      area.covers(Point(x, z).buffer(1.2)) and Point(x, z).distance(buildings) > 1.2
    )
    grounds = []

    def floor(px, pz):
      y = support_height(triangles, px, pz)
      grounds.append([px, round(y, 5), pz])
      return y

    # Four supported logical table groups; their current movable arrangement and
    # count are not claimed as a survey. Slats/X-frames are seen in café photos.
    top = (
      max(floor(x + dx, z + dz) for dx in [-0.4, 0.4] for dz in [-0.32, 0.32]) + 0.72
    )
    for dx in np.arange(-0.48, 0.5, 0.2):
      detail.box([x + dx, top, z], [0.18, 0.045, 0.8], wood, "cafe slatted table")
    nav.append(
      nav_record(
        box(x - 0.58, z - 0.44, x + 0.58, z + 0.44),
        top - 0.03,
        top + 0.03,
        KIND + ":cafe-table",
      )
    )
    for dz in [-0.3, 0.3]:
      if native:
        for dx in [-0.36, 0.36]:
          low = floor(x + dx, z + dz)
          detail.box(
            [x + dx, (low + top) / 2, z + dz],
            [0.05, top - low, 0.05],
            metal,
            "independent cardinal table leg",
          )
          nav.append(
            nav_record(
              box(x + dx - 0.035, z + dz - 0.035, x + dx + 0.035, z + dz + 0.035),
              low,
              top,
              KIND + ":cafe-leg",
            )
          )
      else:
        for sign in [-1, 1]:
          px = x + sign * 0.36
          low = floor(px, z + dz)
          beam(
            detail,
            [px, low, z + dz],
            [x - sign * 0.3, top - 0.04, z + dz],
            0.024,
            metal,
            "folding X table support",
          )
    for sign in [-1, 1]:
      cz = z + sign * 0.86
      seat = (
        max(floor(x + dx, cz + dz) for dx in [-0.2, 0.2] for dz in [-0.18, 0.18]) + 0.42
      )
      for dz in [-0.14, 0, 0.14]:
        detail.box([x, seat, cz + dz], [0.45, 0.04, 0.12], wood, "wood slat chair seat")
      for y in [seat + 0.22, seat + 0.38]:
        detail.box(
          [x, y, cz + sign * 0.2], [0.45, 0.12, 0.04], wood, "wood slat chair back"
        )
      nav.append(
        nav_record(
          box(x - 0.25, cz - 0.24, x + 0.25, cz + 0.24),
          seat - 0.03,
          seat + 0.43,
          KIND + ":cafe-chair",
        )
      )
      for dx in [-0.2, 0.2]:
        for dz in [-0.18, 0.18]:
          low = floor(x + dx, cz + dz)
          if native:
            detail.box(
              [x + dx, (low + seat) / 2, cz + dz],
              [0.04, seat - low, 0.04],
              metal,
              "cardinal chair leg",
            )
          else:
            beam(
              detail,
              [x + dx, low, cz + dz],
              [x + dx, seat, cz - dz],
              0.018,
              metal,
              "folding chair leg",
            )
    audit.append(dict(group=index, center=[x, z], support=grounds))
  return (
    detail,
    nav,
    dict(
      feature="kunsthaus-cafe-terrace",
      osmWay="1558604602",
      tables=4,
      chairs=8,
      independentNative=native,
      placement="bounded recognition arrangement inside mapped current seating area; movable furniture positions/count are estimates",
      groundSamples=audit,
      groundCaptureSha256=sha(output / f"capture-{mode}-{host}.json.gz"),
    ),
  )


def surface_parts(geometry, kind):
  if geometry.is_empty:
    return []
  if geometry.geom_type == kind:
    return [geometry]
  return [g for p in getattr(geometry, "geoms", []) for g in surface_parts(p, kind)]


def measured_details(part, offset, faces, native):
  """Surface-attached material articulation, never guessed doors or openings."""
  detail = Detail()
  if native:
    import shapely

    groups = {}
    for tri, color in faces:
      points = np.asarray(tri)
      n = np.cross(points[1] - points[0], points[2] - points[0])
      axis = int(np.argmax(abs(n)))
      if abs(n[axis]) < 1e-8 or (
        axis == 1 and (n[axis] < 0 or color != (157, 151, 140))
      ):
        continue
      axes = [i for i in range(3) if i != axis]
      groups.setdefault(
        (axis, float(points[0, axis]), int(np.sign(n[axis]))), []
      ).append(Polygon(points[:, axes]))
    for (axis, plane, sign), polygons in groups.items():
      axes = [i for i in range(3) if i != axis]
      poly = unary_union(polygons)
      lo0, lo1, hi0, hi1 = poly.bounds
      stripe_axis = 0 if axis == 1 else axes.index(1)
      low, high = (lo0, hi0) if stripe_axis == 0 else (lo1, hi1)
      for at in np.arange(math.ceil(low / 0.24) * 0.24, high, 0.24):
        band = (
          box(at, lo1 - 1, at + 0.035, hi1 + 1)
          if stripe_axis == 0
          else box(lo0 - 1, at, hi0 + 1, at + 0.035)
        )
        for fragment in surface_parts(poly.intersection(band), "Polygon"):
          for triangle in shapely.constrained_delaunay_triangles(fragment).geoms:
            points = []
            for p in list(triangle.exterior.coords)[:3]:
              v = [0.0, 0.0, 0.0]
              v[axis] = plane + sign * 0.015
              for i, a in enumerate(axes):
                v[a] = p[i]
              points.append(v)
            detail.polygon(
              points,
              tint(THATCH, 9) if axis == 1 else tint(WOOD, -15),
              "native source-face reed or timber course",
            )
    return detail
  roof_edges = set()
  footprint = part_footprint(part)
  for surface in part["surfaces"]:
    kind = surface["kind"]
    if kind not in ["RoofSurface", "WallSurface"]:
      continue
    ring = np.asarray(surface["rings"][0], float).copy()
    ring[:, 1] += offset
    triangles = source_triangles(surface, offset)
    first = next(
      (
        np.asarray(t)
        for t in triangles
        if np.linalg.norm(np.cross(np.asarray(t)[1] - t[0], np.asarray(t)[2] - t[0]))
        > 1e-8
      ),
      None,
    )
    if first is None:
      continue
    n = np.cross(first[1] - first[0], first[2] - first[0])
    n /= np.linalg.norm(n)
    if kind == "RoofSurface":
      if abs(n[1]) < 0.05:
        continue
      gradient = -n[[0, 2]] / n[1]
      if np.linalg.norm(gradient) < 0.01:
        continue
      downhill = gradient / np.linalg.norm(gradient)
      across = np.array([-downhill[1], downhill[0]])
      matrix = np.array([across, downhill])
      origin = ring[0, [0, 2]]
      poly = Polygon([(matrix @ (p[[0, 2]] - origin)).tolist() for p in ring])
      lo, bottom, hi, top = poly.bounds
      for at in np.arange(lo + 0.06, hi, 0.23):
        for line in surface_parts(
          poly.intersection(LineString([(at, bottom - 1), (at, top + 1)])), "LineString"
        ):
          ends = []
          for p in [line.coords[0], line.coords[-1]]:
            xz = origin + matrix.T @ np.asarray(p)
            y = first[0, 1] + np.dot(gradient, xz - first[0, [0, 2]]) + 0.025
            ends.append([xz[0], y, xz[1]])
          if math.dist(*ends) > 0.04:
            beam(detail, *ends, 0.018, tint(THATCH, 10), "measured roof reed course")
      for a, b in zip(ring, np.roll(ring, -1, axis=0)):
        key = tuple(sorted([tuple(np.round(a, 3)), tuple(np.round(b, 3))]))
        if key in roof_edges:
          continue
        roof_edges.add(key)
        beam(
          detail,
          a + [0, 0.035, 0],
          b + [0, 0.035, 0],
          0.065,
          tint(THATCH, -9),
          "measured eave or ridge cap",
        )
    else:
      normal = n[[0, 2]]
      if np.linalg.norm(normal) < 0.1:
        continue
      normal /= np.linalg.norm(normal)
      center = ring[:, [0, 2]].mean(axis=0)
      if (
        np.dot(normal, center - np.array([footprint.centroid.x, footprint.centroid.y]))
        < 0
      ):
        normal = -normal
      tangent = np.array([-normal[1], normal[0]])
      origin = ring[0, [0, 2]]
      poly = Polygon([[np.dot(p[[0, 2]] - origin, tangent), p[1]] for p in ring])
      lo, bottom, hi, top = poly.bounds
      for y in np.arange(bottom + 0.12, top, 0.23):
        for line in surface_parts(
          poly.intersection(LineString([(lo - 1, y), (hi + 1, y)])), "LineString"
        ):
          ends = []
          for p in [line.coords[0], line.coords[-1]]:
            xz = origin + tangent * p[0] + normal * 0.025
            ends.append([xz[0], p[1], xz[1]])
          if math.dist(*ends) > 0.04:
            beam(detail, *ends, 0.025, tint(WOOD, -16), "measured wall timber course")
  return detail


def family_models(families, native):
  old, new = InstitutionPackets(), InstitutionPackets()
  old.mode = new.mode = "minecraft" if native else "drawn"
  for f in families:
    offset = 3 - min(p["groundY"] for p in f["parts"] if p["groundY"] is not None)
    for part in f["parts"]:
      surfaces = [(s["kind"], source_triangles(s, offset)) for s in part["surfaces"]]
      if native:
        step, cells = native_columns(part, part_footprint(part), surfaces, offset)
        faces = list(merged_cell_faces(cells, step))
      else:
        faces = [
          (tri, (157, 151, 140) if kind == "RoofSurface" else (211, 208, 195))
          for kind, tris in surfaces
          for tri in tris
        ]
      for tri, color in faces:
        old.triangle(tri, color, f["id"])
        a, b, c = np.asarray(tri, dtype=float)
        normal = np.cross(b - a, c - a)
        normal /= max(1e-9, np.linalg.norm(normal))
        shade = round(normal[0] * 7 + normal[2] * 9)
        new.triangle(
          tri, tint(THATCH if color == (157, 151, 140) else WOOD, shade), f["id"]
        )
      for tri, color, _ in measured_details(part, offset, faces, native).triangles:
        new.triangle(tri, color, f["id"])
  assert len(old.buffers) == 1 and set(old.buffers) == {(-19, 20)}
  return old.buffers[-19, 20].payload("public-institutions-v326"), new.buffers[
    -19, 20
  ].payload(KIND)


def village_ground(s, output, native):
  """Only the mapped southern village clearing absent from retained ground.

  The site is grassland, with dirt access paths. The 3 m existing village datum
  is an explicit display estimate, not a newly surveyed terrain elevation.
  """
  mode = "minecraft" if native else "drawn"
  capture = read(output / f"capture-{mode}-outer187--19_20.json.gz")
  origin = capture["raw"]["origin"]
  site = shape(s["villageSite"]["geometry"])
  footprint = site.intersection(box(-9727.98, 10240.02, -9216.02, 10751.98))
  excluded = [
    shape(r["geometry"]).buffer(0.2 if r["properties"].get("building") else 0)
    for r in s["mapped"]
    if r["properties"].get("building")
    or r["properties"].get("landuse") == "forest"
    or r["properties"].get("natural") == "water"
  ]
  for field in ["ground", "water", "roads"]:
    excluded += [
      translate(Polygon(p["ring"], p.get("holes", [])), origin[0], origin[2])
      for p in capture["nav"].get(field, [])
    ]
  footprint = footprint.difference(unary_union(excluded))
  paths = unary_union(
    [
      shape(r["geometry"]).buffer(
        1.6 if r["properties"]["highway"] in ["service", "track"] else 0.9,
        cap_style=2,
      )
      for r in s["mapped"]
      if r["properties"].get("highway")
    ]
  ).intersection(footprint)
  grass = footprint.difference(paths)
  detail = Detail()
  coverage = []
  for geometry, color, role in [
    (grass, (112, 133, 88), "mapped village grassland"),
    (paths, (161, 151, 129), "mapped dirt path; estimated width"),
  ]:
    if native:
      # Independent one-metre cells wholly inside each exact mapped area;
      # contiguous runs reduce geometry without crossing a source boundary.
      runs = []
      x0, z0, x1, z1 = geometry.bounds
      for z in range(math.floor(z0), math.ceil(z1)):
        xs = np.arange(math.floor(x0), math.ceil(x1))
        cells = shapely.box(xs, z, xs + 1, z + 1)
        ok = shapely.covers(geometry, cells)
        ends = np.flatnonzero(np.diff(np.r_[False, ok, False]))
        for a, b in zip(ends[::2], ends[1::2]):
          runs.append(box(int(xs[a]), z, int(xs[b - 1]) + 1, z + 1))
      geometry = unary_union(runs)
    for p in surface_parts(geometry, "Polygon"):
      coverage.append(
        dict(ring=list(p.exterior.coords), holes=[list(h.coords) for h in p.interiors])
      )
      for tri in shapely.constrained_delaunay_triangles(p).geoms:
        points = [[x, 3.02, z] for x, z in list(tri.exterior.coords)[:3]]
        detail.polygon(points, color, role)
  return detail, dict(
    feature="southern-village-ground",
    osmWay="28147152",
    independentNative=native,
    sourceAreaM2=round(footprint.area, 3),
    coverage=coverage,
    floorY=3.02,
    estimate="Existing village baseline 3m; 1.8m footpaths/3.2m service paths are display widths, not surveys. Woodlands, all mapped buildings and retained ground/roads/water excluded.",
  )


def mesh_positions(mesh, origin):
  p = (
    np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
    .reshape(-1, 3)
    .astype(float)
    / 100
    + origin
  )
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return p[ix]


def key(tri):
  return tuple(
    sorted(tuple(int(v) for v in row) for row in np.rint(np.asarray(tri) * 100))
  )


def build(output):
  s = read(SOURCE)
  metadata = []
  for native in [False, True]:
    mode = "minecraft" if native else "drawn"
    detail, nav = Detail(), []
    for row in s["mapped"]:
      if row["properties"].get("osm_way_id") in HUTS:
        d, n, meta = hut(row, native)
        detail.triangles.extend(d.triangles)
        nav.extend(n)
        metadata.append(meta)
    d, n, meta = palisade(s, native)
    detail.triangles.extend(d.triangles)
    nav.extend(n)
    metadata.append(meta)
    d, meta = village_ground(s, output, native)
    detail.triangles.extend(d.triangles)
    metadata.append(meta)
    origin = [-9728, -10, 10240]
    mesh = PackedMesh(origin[0], origin[2])
    for tri, color, _ in detail.triangles:
      mesh.triangle(tri, color)
    write(output / f"{mode}-outer187--19_20-mesh.json.gz", mesh.payload(KIND))
    write(output / f"{mode}-outer187--19_20-nav.json.gz", local_nav(nav, origin))
    old, new = family_models(s["originalFamilies"], native)
    write(output / f"{mode}-publicInstitutions326--19_20-p0-mesh.json.gz", new)
    write(output / f"{mode}-publicInstitutions326--19_20-p0-old.json.gz", old)
    d, n, meta = cafe(s, output, native)
    metadata.append(meta)
    mesh = PackedMesh(-7168, 5632)
    for tri, color, _ in d.triangles:
      mesh.triangle(tri, color)
    write(output / f"{mode}-outer187--14_11-mesh.json.gz", mesh.payload(KIND))
    write(
      output / f"{mode}-outer187--14_11-nav.json.gz", local_nav(n, [-7168, -10, 5632])
    )
  write(output / "model-audit.json", metadata)


def finish(output):
  packets, reports = {}, []
  for path in sorted(output.glob("capture-*.json.gz")):
    c = read(path)
    raw, prepared, plan = c["raw"], c["prepared"], c["plan"]
    mode, host = c["mode"], c["id"]
    retire = []
    oldpath = output / f"{mode}-{host}-old.json.gz"
    if oldpath.exists():
      expected = read(oldpath)
      counts = Counter(key(t) for t in mesh_positions(expected, raw["origin"]))
      total = sum(counts.values())
      for mi, m in enumerate(prepared["meshes"]):
        if m["kind"] != expected["kind"]:
          continue
        selected = []
        for ti, t in enumerate(mesh_positions(m, raw["origin"])):
          k = key(t)
          if counts[k]:
            selected.append(ti)
            counts[k] -= 1
        if selected:
          retire.append(dict(mesh=mi, triangles=selected))
      assert sum(counts.values()) == 0, (host, total, sum(counts.values()))
    navpath = output / f"{mode}-{host}-nav.json.gz"
    append_nav = read(navpath) if navpath.exists() else []
    plan.update(
      retire=retire,
      retireLines=[],
      retireNav=[],
      appendNav=append_nav,
      owners=sorted(FAMILIES)
      if retire
      else [
        KIND + ":" + ("kunsthaus-cafe" if host == "outer187--14_11" else "dueppel")
      ],
    )
    packets[f"{mode}:{host}"] = plan
    reports.append(
      dict(
        key=f"{mode}:{host}",
        retiredTriangles=sum(len(r["triangles"]) for r in retire),
        appendedTriangles=len(base64.b64decode(plan["append"]["indices"])) // 12,
        appendedNavigation=len(append_nav),
        declined=c["declined"],
      )
    )
  runtime = DATA / "museumsSouthwestV354Packets.json.gz"
  write(runtime, dict(schemaVersion=1, keys=list(packets), packets=packets))
  write(
    DATA / "museumsSouthwestV354Index.json",
    dict(
      keys=list(packets),
      decodedBytes=len(gzip.decompress(runtime.read_bytes())),
      compressedBytes=runtime.stat().st_size,
      sha256=sha(runtime),
      ground=[
        m
        for m in read(output / "model-audit.json")
        if m.get("feature") == "southern-village-ground"
      ],
    ),
  )
  s = read(SOURCE)
  s["transfers"] = reports
  s["models"] = read(output / "model-audit.json")
  write(SOURCE, s)
  print(reports)
  print("runtime", runtime.stat().st_size)


if __name__ == "__main__":
  p = argparse.ArgumentParser()
  p.add_argument("stage", choices=["source", "build", "finish"])
  p.add_argument("directory", type=Path)
  a = p.parse_args()
  globals()[a.stage](a.directory)
