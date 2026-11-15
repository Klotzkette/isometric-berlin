"""Finite, source-owned Frohnau garden, complete LoD2 bodies and hillside access.

No earlier packet is changed. The official heritage garden, less the entire
retained coverage, is the only new terrain domain. Dimensions of the 73 steps
and eight landings are explicitly inferred between the mapped endpoints.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
import shapely
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts
from scripts.build_bebelplatz_building_source import part_profile
from scripts.build_karl_marx_allee_v161 import Detail, packed_detail
from scripts.build_kladow_airfield_v346 import triangles_for
from scripts.build_rixdorf_v304 import native_model
from scripts.build_surrounding_outlines import (
  navigation_polygons,
  polygons_from_geometry,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/buddhist-frohnau-v347"
SOURCE = GEO / "buddhist-frohnau-v347-source.json.gz"
KEY = "buddhist347--9_-26"
ORIGIN = [-4608, -10, -13312]
TILE = box(-4608, -13312, -4096, -12800)
BASELINE = "84d3c452"
PATH_IDS = [
  "217729064",
  "660153859",
  "660153860",
  "660153861",
  "660153862",
  "660153863",
  "660153864",
]


def wire(q):
  return (
    json.dumps(
      q,
      ensure_ascii=False,
      separators=(",", ":"),
      allow_nan=False,
      default=lambda v: (
        v.item()
        if isinstance(v, np.generic)
        else (_ for _ in ()).throw(TypeError(type(v)))
      ),
    )
    + "\n"
  ).encode()


def write(p, q):
  p.parent.mkdir(parents=True, exist_ok=True)
  b = wire(q)
  p.write_bytes(gzip.compress(b, mtime=0) if p.suffix == ".gz" else b)


def read(p):
  b = p.read_bytes()
  return json.loads(gzip.decompress(b) if p.suffix == ".gz" else b)


def sha(p):
  return hashlib.sha256(p.read_bytes()).hexdigest()


def capture():
  heritage = read(RAW / "heritage-garden.json")
  feature = next(q for q in heritage["features"] if q["properties"]["id"] == "09046233")
  garden = affine_transform(shape(feature["geometry"]), [1, 0, 0, -1, -389500, 5820000])
  baseline = subprocess.check_output(
    [
      "git",
      "show",
      BASELINE + ":src/app/public/mesh/surrounding-berlin-v159/manifest.json",
    ],
    cwd=ROOT,
  )
  manifest = json.loads(baseline)
  old = unary_union(
    [
      shapely.make_valid(Polygon(q["ring"], q.get("holes", [])))
      for q in manifest["footprint"]
    ]
  )
  scope = garden.difference(old)
  assert scope.intersection(old).area < 1e-6
  records = [
    q
    for q in read(RAW / "osm-selected.json")["features"]
    if shape(q["geometry"]).intersects(garden)
    and q["id"].split("/")[-1] in PATH_IDS + ["49753550", "77967300", "508729598"]
  ]
  parents = []
  with zipfile.ZipFile(RAW / "LoD2_385_5833.zip") as z:
    for filename in z.namelist():
      if not filename.endswith((".gml", ".xml")):
        continue
      with z.open(filename) as f:
        for _, p in ET.iterparse(f, events=("end",)):
          if p.tag != f"{{{NS['bldg']}}}Building":
            continue
          try:
            parts = [part_profile(q) for q in leaf_building_parts(p) or [p]]
          except ValueError:
            p.clear()
            continue
          footprint = unary_union([Polygon(q["ring"], q["holes"]) for q in parts])
          if garden.intersection(footprint).area > 0.1:
            if not scope.buffer(0.01).covers(footprint):
              raise ValueError("Complete site family leaves new coverage")
            parents.append(dict(id=p.get(GML_ID), parts=parts))
          p.clear()
  assert {q["id"] for q in parents} == {
    "DEBE12YYJ0003qrb",
    "DEBE12YYJ0003grq",
    "DEBE12YYJ0003hDn",
    "DEBE00YY1dT0007Y",
    "DEBE12YYJ0005CPX",
    "DEBE12YYJ0005ClC",
  }
  dgm = np.load(RAW / "dgm-height.npy")

  def h(x, z):
    value = float(
      dgm[math.floor(5820000 - z - 5832000), math.floor(389500 + x - 384000)]
    )
    assert math.isfinite(value)
    return round(value, 2)

  # Actual one-metre source cells, never a synthetic hill. Retain the entire
  # 512m owner grid; all samples lie inside this single DGM archive.
  grids = {}
  for native in [False, True]:
    count = 128 if native else 129
    half = 2 if native else 0
    grids["minecraft" if native else "drawn"] = [
      [h(ORIGIN[0] + x * 4 + half, ORIGIN[2] + z * 4 + half) for x in range(count)]
      for z in range(count)
    ]
  paths = {
    q["id"].split("/")[-1]: q for q in records if q["id"].split("/")[-1] in PATH_IDS
  }
  stair = shape(paths["660153861"]["geometry"])
  source = dict(
    schemaVersion=1,
    key=KEY,
    origin=ORIGIN,
    scope=mapping(scope),
    officialGarden=feature,
    retained=dict(
      commit=BASELINE,
      manifestSha256=hashlib.sha256(baseline).hexdigest(),
      overlapM2=garden.intersection(old).area,
    ),
    parents=parents,
    records=records,
    dgmGridNHN=grids,
    datumNHN=h(*shape(paths["217729064"]["geometry"]).coords[0]) - 3,
    stair=dict(
      endpoints=list(stair.coords),
      lowerNHN=h(*stair.coords[0]),
      upperNHN=h(*stair.coords[-1]),
      steps=73,
      landings=8,
      widthM=1.5,
    ),
    sources=[
      dict(file=p.name, sha256=sha(p))
      for p in [
        RAW / "LoD2_385_5833.zip",
        RAW / "DGM1_384_5832.zip",
        RAW / "heritage-garden.json",
        RAW / "osm-selected.json",
      ]
    ],
    references=[
      "https://www.berlin.de/ba-reinickendorf/ueber-den-bezirk/tourismus/artikel.82764.php",
      "https://www.berlin.de/ba-reinickendorf/aktuelles/pressemitteilungen/2024/pressemitteilung.1473448.php",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046233",
      "https://das-buddhistische-haus.de/de/gallery/4-das-buddhistische-haus",
    ],
    policy="Complete official source sheets and relative elevations retained. DGM1 samples are measured bare earth; garden edge blends into scene y=3 over 6m. 73 risers and 8 landings documented, individual runs, landing lengths, facade tones and portal dimensions are visual estimates. No interior claims; no textures; current named site only.",
  )
  write(SOURCE, source)
  print(
    "captured",
    len(parents),
    "families",
    sum(len(p["parts"]) for p in parents),
    "parts",
    round(scope.area, 2),
    "m2",
  )


def surface(d, polygon, y, color, role):
  for q in polygons_from_geometry(polygon):
    for tri in shapely.constrained_delaunay_triangles(q).geoms:
      points = [[x, y, z] for x, z in list(tri.exterior.coords)[:3]]
      points.reverse()
      d.polygon(points, color, role)


def build(out):
  s = read(SOURCE)
  scope = shape(s["scope"])
  assert TILE.covers(scope)
  paths = {
    q["id"].split("/")[-1]: shape(q["geometry"])
    for q in s["records"]
    if q["id"].split("/")[-1] in PATH_IDS
  }
  path = unary_union(
    [
      q.buffer(0.75, cap_style=2, join_style=2)
      for k, q in paths.items()
      if k != "660153861"
    ]
  ).intersection(scope)
  stair = paths["660153861"]
  a, b = np.array(stair.coords[0]), np.array(stair.coords[-1])
  axis = (b - a) / np.linalg.norm(b - a)
  side = np.array([-axis[1], axis[0]])
  start = s["stair"]["lowerNHN"] - s["datumNHN"]
  end = s["stair"]["upperNHN"] - s["datumNHN"]
  tread = (stair.length - 8 * 1.1) / 73
  riser = (end - start) / 73
  rows = []
  distance = 0
  step = 0
  for flight in range(9):
    for _ in range(9 if flight == 0 else 8):
      step += 1
      p, q = a + axis * distance, a + axis * (distance + tread)
      poly = Polygon(
        [p - side * 0.75, q - side * 0.75, q + side * 0.75, p + side * 0.75]
      )
      rows.append(
        dict(kind="step", index=step, polygon=poly, y=round(start + step * riser, 2))
      )
      distance += tread
    if flight < 8:
      p, q = a + axis * distance, a + axis * (distance + 1.1)
      rows.append(
        dict(
          kind="landing",
          index=flight + 1,
          polygon=Polygon(
            [p - side * 0.75, q - side * 0.75, q + side * 0.75, p + side * 0.75]
          ),
          y=round(start + step * riser, 2),
        )
      )
      distance += 1.1
  assert step == 73 and abs(distance - stair.length) < 1e-8
  footprint = unary_union(
    [Polygon(p["ring"], p["holes"]) for q in s["parents"] for p in q["parts"]]
  )
  descriptors = dict(id=KEY, bounds=list(TILE.bounds))
  fallback = dict(
    key=KEY,
    origin=ORIGIN,
    footprint=navigation_polygons(scope, 0, 0),
    grids={},
    stairs={},
    worldBounds=list(scope.bounds),
  )
  stats = {}
  for native in [False, True]:
    mode = "minecraft" if native else "drawn"
    raw = np.array(s["dgmGridNHN"][mode]) - s["datumNHN"]
    n = len(raw)
    grid = np.empty_like(raw, dtype="<i2")
    for j in range(n):
      for i in range(n):
        x, z = (
          ORIGIN[0] + i * 4 + (2 if native else 0),
          ORIGIN[2] + j * 4 + (2 if native else 0),
        )
        pt = Point(x, z)
        distance_edge = scope.boundary.distance(pt) if scope.covers(pt) else 0
        t = min(1, distance_edge / 6)
        weight = t * t * (3 - 2 * t)
        h = 3 + (raw[j, i] - 3) * weight
        # The mapped stair corridor must not be occluded by coarser DGM cells.
        if stair.distance(pt) < 2.8:
          u = min(1, max(0, np.dot(np.array([x, z]) - a, axis) / stair.length))
          h = min(h, start + (end - start) * u - 0.18)
        grid[j, i] = round(h * 100)

    def height(x, z):
      u, v = (x - ORIGIN[0]) / 4, (z - ORIGIN[2]) / 4
      i, j = min(127, max(0, math.floor(u))), min(127, max(0, math.floor(v)))
      if native:
        return float(grid[j, i]) / 100
      aa, bb = u - i, v - j
      return (
        float(
          grid[j, i] * (1 - max(aa, bb))
          + grid[j + 1, i + 1] * min(aa, bb)
          + grid[j, i + 1] * (aa - bb)
          if aa >= bb
          else grid[j, i] * (1 - bb)
          + grid[j + 1, i + 1] * aa
          + grid[j + 1, i] * (bb - aa)
        )
        / 100
      )

    ground = Detail()
    for j in range(128):
      for i in range(128):
        x, z = ORIGIN[0] + i * 4, ORIGIN[2] + j * 4
        cell = box(x, z, x + 4, z + 4)
        clip = (
          cell.intersection(scope)
          .difference(footprint)
          .difference(stair.buffer(0.76, cap_style=2))
        )
        if clip.is_empty:
          continue
        pieces = [
          (clip.intersection(path), (163, 157, 140)),
          (clip.difference(path), (108, 119, 76)),
        ]
        for polygon, color in pieces:
          if native:
            surface(
              ground, polygon, height(x + 2, z + 2), color, "independent DGM cell"
            )
          else:
            for tri in [
              Polygon([(x, z), (x + 4, z), (x + 4, z + 4)]),
              Polygon([(x, z), (x + 4, z + 4), (x, z + 4)]),
            ]:
              for q in polygons_from_geometry(polygon.intersection(tri)):
                for t in shapely.constrained_delaunay_triangles(q).geoms:
                  pts = [
                    [xx, height(xx, zz), zz] for xx, zz in list(t.exterior.coords)[:3]
                  ][::-1]
                  ground.polygon(pts, color, "DGM slope")
        if native:
          # Exactly matching cardinal cliff risers join all stepped ground cells.
          y = height(x + 2, z + 2)
          for xx, zz, xx1, zz1, h2 in [
            (x + 4, z, x + 4, z + 4, height(x + 6, z + 2)),
            (x, z + 4, x + 4, z + 4, height(x + 2, z + 6)),
          ]:
            edge = (
              LineString([(xx, zz), (xx1, zz1)])
              .intersection(scope)
              .difference(footprint)
            )
            for line in getattr(edge, "geoms", [edge]):
              if line.is_empty or line.geom_type != "LineString" or abs(y - h2) < 0.01:
                continue
              (ax, az), (bx, bz) = line.coords[0], line.coords[-1]
              ground.polygon(
                [[ax, y, az], [bx, y, bz], [bx, h2, bz], [ax, h2, az]],
                (98, 108, 72),
                "native terrain riser",
              )
    detail = Detail()
    nav = []
    for parent in s["parents"]:
      model = Detail()
      roofs = []
      low = min(p["ground_y_m"] for p in parent["parts"]) + 30 - s["datumNHN"]
      for p in parent["parts"]:
        for sh in p["surfaces"]:
          rings = [
            [[x, y + 30 - s["datumNHN"], z] for x, y, z in r] for r in sh["rings"]
          ]
          pitched = (
            sh["kind"] == "RoofSurface"
            and max(v[1] for r in rings for v in r)
            - min(v[1] for r in rings for v in r)
            > 0.3
          )
          color = (
            (139, 74, 55)
            if pitched
            else (108, 111, 102)
            if sh["kind"] == "RoofSurface"
            else (217, 190, 103)
          )
          for t in triangles_for(rings):
            model.triangles.append((t, color, "source " + sh["kind"]))
            if sh["kind"] == "RoofSurface":
              roofs.append(t)
      if native:
        model, caps = native_model(model)
        union = unary_union([box(*c[:4]) for c in caps])
        for q in navigation_polygons(union, *[ORIGIN[0], ORIGIN[2]]):
          q.update(
            sourceId=parent["id"],
            height=max(c[4] for c in caps) - 3,
            minHeight=max(0, math.floor(low - 3)),
            nativeRoofCaps=[
              [x - ORIGIN[0], z - ORIGIN[2], xx - ORIGIN[0], zz - ORIGIN[2], y - 3]
              for x, z, xx, zz, y in caps
            ],
          )
          nav.append(q)
      else:
        for p in parent["parts"]:
          for q in navigation_polygons(
            Polygon(p["ring"], p["holes"]), ORIGIN[0], ORIGIN[2]
          ):
            q.update(
              sourceId=parent["id"],
              partId=p["id"],
              height=p["top_y_m"] + 30 - s["datumNHN"] - 3,
              minHeight=max(0, p["ground_y_m"] + 30 - s["datumNHN"] - 3),
              roofTriangles=[
                [[x - ORIGIN[0], y - 3, z - ORIGIN[2]] for x, y, z in t] for t in roofs
              ],
            )
            nav.append(q)
      detail.triangles.extend(model.triangles)
    floors = []
    stairs = Detail()
    for row in rows:
      poly = row["polygon"]
      y = row["y"]
      if native:
        # Finite quarter-metre plan cells retain every documented riser; their
        # heights come directly from the independently sampled native stair plan.
        cells = []
        for ix in range(math.floor(poly.bounds[0] * 4), math.ceil(poly.bounds[2] * 4)):
          for iz in range(
            math.floor(poly.bounds[1] * 4), math.ceil(poly.bounds[3] * 4)
          ):
            q = box(ix / 4, iz / 4, (ix + 1) / 4, (iz + 1) / 4)
            if poly.covers(q.centroid):
              cells.append(q)
        poly = unary_union(cells)
      surface(stairs, poly, y, (173, 167, 146), "73 risers / eight landings")
      for p in polygons_from_geometry(poly):
        ring = list(p.exterior.coords)
        for (x, z), (xx, zz) in zip(ring, ring[1:]):
          stairs.polygon(
            [[x, y, z], [xx, y, zz], [xx, y - 0.17, zz], [x, y - 0.17, z]],
            (138, 135, 122),
            "stair riser",
          )
      for p in navigation_polygons(poly, ORIGIN[0], ORIGIN[2]):
        floors.append(dict(p, y=y))
    # The portal is grounded at the mapped bottom of the documented staircase.
    # Only photographed pale posts and red gate bars are represented; no invented elephant relief.
    for sign in [-1, 1]:
      x, z = a + side * sign * 1.0 - axis * 0.35
      y = start
      stairs.box(
        [x, y + 1.6, z], [0.4, 3.2, 0.4], (230, 223, 199), "photo-estimated portal post"
      )
      stairs.box(
        [x, y + 3.2, z],
        [0.56, 0.16, 0.56],
        (239, 231, 209),
        "photo-estimated portal cap",
      )
    if not native:
      # Slender continuous rail runs follow each flight and each landing.
      for sign in [-1, 1]:
        for row in rows:
          ring = list(row["polygon"].exterior.coords)
          pp = np.array(ring[0]) + side * (1.5 if sign > 0 else 0)
          qq = np.array(ring[1]) + side * (1.5 if sign > 0 else 0)
          y = row["y"] + 0.85
          stairs.polygon(
            [
              [pp[0], y - 0.035, pp[1]],
              [qq[0], y - 0.035, qq[1]],
              [qq[0], y + 0.035, qq[1]],
              [pp[0], y + 0.035, pp[1]],
            ],
            (80, 86, 80),
            "mapped handrail",
          )
    else:
      # Cardinal posts retain a safe, readable rail line without rotated boxes.
      for t in np.arange(0, stair.length, 1):
        for sign in [-1, 1]:
          x, z = a + axis * t + side * sign * 0.8
          y = start + (end - start) * t / stair.length
          stairs.box(
            [round(x * 4) / 4, y + 0.45, round(z * 4) / 4],
            [0.08, 0.9, 0.08],
            (80, 86, 80),
            "native handrail post",
          )
    packet = dict(
      schemaVersion=1,
      origin=ORIGIN,
      meshes=[],
      nav=dict(
        ground=navigation_polygons(scope, ORIGIN[0], ORIGIN[2]),
        water=[],
        buildings=nav,
        groundY=3,
        spreeBridgesV242=dict(floors=floors, solids=[]),
      ),
      gardenTerrainV330=base64.b64encode(grid.tobytes()).decode(),
    )
    for d, kind in [
      (ground, "buddhist-frohnau-ground-v347"),
      (detail, "buddhist-frohnau-buildings-v347"),
      (stairs, "buddhist-frohnau-access-v347"),
    ]:
      m = packed_detail(d, TILE)
      if m:
        m["kind"] = kind
        packet["meshes"].append(m)
    body = wire(packet)
    packed = gzip.compress(body, mtime=0)
    assert len(packed) < 1_100_000 and len(body) < 4_400_000
    out.mkdir(parents=True, exist_ok=True)
    filename = KEY + "." + mode + ".json.gz"
    (out / filename).write_bytes(packed)
    descriptors[mode] = dict(
      url=filename,
      encoding="gzip",
      bytes=len(packed),
      decodedBytes=len(body),
      sha256=hashlib.sha256(packed).hexdigest(),
    )
    fallback["grids"][mode] = packet["gardenTerrainV330"]
    fallback["stairs"][mode] = floors
    stats[mode] = dict(
      triangles=sum(
        len(base64.b64decode(m["indices"])) // 12 for m in packet["meshes"]
      ),
      buildingNavigation=len(nav),
      floors=len(floors),
      packetBytes=len(packed),
    )
  manifest = dict(
    schemaVersion=1,
    chunks=[descriptors],
    footprint=navigation_polygons(scope, 0, 0),
    bounds=list(scope.bounds),
    groundY=3,
    source=dict(
      file=SOURCE.name, sha256=sha(SOURCE), gardenId="09046233", scopeAreaM2=scope.area
    ),
  )
  write(out / "manifest-addition.json", manifest)
  write(GEO / "buddhist-frohnau-v347-manifest.json", manifest)
  write(ROOT / "src/app/src/data/buddhistFrohnauGroundV347.json", fallback)
  write(
    GEO / "buddhist-frohnau-v347-evidence.json",
    dict(
      sourceSha256=sha(SOURCE),
      scopeM2=scope.area,
      oldOverlapM2=s["retained"]["overlapM2"],
      parents=len(s["parents"]),
      parts=sum(len(p["parts"]) for p in s["parents"]),
      sourceSheets=sum(len(q["surfaces"]) for p in s["parents"] for q in p["parts"]),
      steps=73,
      landings=8,
      riserM=riser,
      treadM=tread,
      statistics=stats,
      sourcePolicy=s["policy"],
    ),
  )
  print(json.dumps(stats), flush=True)


if __name__ == "__main__":
  p = argparse.ArgumentParser(description=__doc__)
  p.add_argument("--capture", action="store_true")
  p.add_argument("--out", type=Path)
  args = p.parse_args()
  if args.capture:
    capture()
  if args.out:
    build(args.out)
