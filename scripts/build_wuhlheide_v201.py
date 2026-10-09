"""Step 10: exact Wuhlheide source, measured amphitheatre relief and open roof."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import zipfile
from functools import lru_cache
from pathlib import Path

import numpy as np
from build_grunewald_terrain_v190 import sample_grid, smooth
from build_region_outlines_v200 import mapped_shapes, world, xml_elements
from shapely.geometry import box, mapping, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/wuhlheide-v201"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "wuhlheide-v201-source.json.gz"
FIELD = DATA / "wuhlheideTerrainV201.json"
SUPPORT = (11536, 6416, 11808, 6704)
STEP, NATIVE_STEP, FADE = 4, 4, 32
PROXIES = {"OSM-way-20418995", "OSM-way-33468397"}


def encode(value: object) -> bytes:
  return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


@lru_cache(maxsize=1)
def field() -> dict:
  return json.loads(FIELD.read_bytes())


def offset_at(x: float, z: float, native: bool = False) -> float:
  if native:
    x, z = (
      math.floor(x / NATIVE_STEP) * NATIVE_STEP + NATIVE_STEP / 2,
      math.floor(z / NATIVE_STEP) * NATIVE_STEP + NATIVE_STEP / 2,
    )
  if SUPPORT[0] < x < SUPPORT[2] and SUPPORT[1] < z < SUPPORT[3]:
    return sample_grid(field()["profiles"][0], x, z)
  return 0.0


def extract() -> dict:
  """Retain full mapped vertices and every local 1m DGM sample, never imagery."""
  elements = xml_elements(RAW / "site.osm")
  shapes, _ = mapped_shapes(elements)
  rows = []
  for key, geom in shapes.items():
    projected = transform(world, geom)
    if not projected.intersects(box(*SUPPORT)):
      continue
    tags = elements[key]["tags"]
    if tags and any(
      k in tags
      for k in ["building", "highway", "barrier", "amenity", "landuse", "leisure"]
    ):
      rows.append(
        {
          "id": f"{key[0]}/{key[1]}",
          "tags": tags,
          "geometry": mapping(geom),
          "worldGeometry": mapping(projected),
        }
      )
  path = RAW / "DGM1_400_5812.zip"
  member = "dgm1_33_400_5812_2_be.xyz"
  with zipfile.ZipFile(path) as archive, archive.open(member) as stream:
    full = np.loadtxt(stream, usecols=2, dtype=np.float32).reshape(2000, 2000)
  west, north, east, south = SUPPORT
  samples = [
    [round(float(full[8000 - z, x - 10500]), 2) for x in range(west, east + 1)]
    for z in range(north, south + 1)
  ]
  source = {
    "schemaVersion": 1,
    "crs": "EPSG:25833; world x=E-389500,z=5820000-N",
    "osm": {
      "url": "https://api.openstreetmap.org/api/0.6/map?bbox=13.541,52.459,13.549,52.464",
      "sha256": hashlib.sha256((RAW / "site.osm").read_bytes()).hexdigest(),
      "license": "ODbL-1.0",
      "features": rows,
    },
    "dgm": {
      "url": "https://gdi.berlin.de/data/dgm1/atom/DGM1_400_5812.zip",
      "member": member,
      "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      "license": "dl-de-zero-2.0",
      "support": SUPPORT,
      "stepM": 1,
      "nhn": samples,
    },
  }
  SOURCE.write_bytes(gzip.compress(encode(source), mtime=0, compresslevel=9))
  return source


def build_field() -> dict:
  source = (
    json.loads(gzip.decompress(SOURCE.read_bytes())) if SOURCE.exists() else extract()
  )
  sample = source["dgm"]["nhn"]
  west, north, east, south = SUPPORT
  values = []
  for z in range(north, south + 1, STEP):
    row = []
    for x in range(west, east + 1, STEP):
      edge = min(x - west, east - x, z - north, south - z)
      row.append(round((sample[z - north][x - west] - 33) * smooth(edge / FADE), 4))
    values.append(row)
  result = {
    "schemaVersion": 1,
    "groundY": 3,
    "datumNHN": 30,
    "nativeStepM": NATIVE_STEP,
    "fadeM": FADE,
    "profiles": [
      {
        "name": "Wuhlheide measured amphitheatre and embankment",
        "support": SUPPORT,
        "stepM": STEP,
        "offsets": values,
      }
    ],
  }
  FIELD.write_bytes(encode(result))
  field.cache_clear()
  return result


def build_model() -> dict:
  """One small source-bound seat/roof model in each independent interpretation."""
  import build_weinberg_terrain_packets_v176 as terrain
  from build_breitscheid_towers_v161 import triangles_for
  from build_surrounding_outlines import line_parts
  from shapely.geometry import LineString, Point, Polygon
  from shapely.ops import unary_union

  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  features = {r["id"]: r for r in source["osm"]["features"]}
  seating = shape(features["way/20418995"]["worldGeometry"])
  roof = shape(features["way/33468397"]["worldGeometry"])
  steps = [r for r in source["osm"]["features"] if r["tags"].get("highway") == "steps"]
  aisles = unary_union([shape(r["worldGeometry"]).buffer(1.6) for r in steps])
  buildings = unary_union(
    [
      shape(r["worldGeometry"])
      for r in source["osm"]["features"]
      if r["tags"].get("building") and r["id"] not in ["way/20418995", "way/33468397"]
    ]
  )
  benches = seating.difference(aisles.union(buildings.buffer(0.4)))
  u = np.array([0.947, 0.321])
  u /= np.linalg.norm(u)
  v = np.array([-u[1], u[0]])
  center = np.array([11662.0, 6598.0])

  def local(x, z):
    return center + u * x + v * z

  angle = math.atan2(-u[1], u[0])
  deck = Polygon(
    [local(x, z) for x, z in [(-11.25, -6), (11.25, -6), (11.25, 10), (-11.25, 10)]]
  )
  nav = {
    "bounds": list(SUPPORT),
    "stage": {
      "ring": [[round(x, 3), round(z, 3)] for x, z in deck.exterior.coords],
      "holes": [],
      "topY": 6.4,
    },
    "roof": {
      "ring": [[round(x, 3), round(z, 3)] for x, z in roof.exterior.coords],
      "holes": [],
      "bottomY": 14.5,
      "topY": 24.5,
    },
    "legs": [],
  }
  peaks = [(-11, -2, 24.5), (11, -2, 24.5), (-7, 9, 21.5), (7, 9, 21.5)]

  def roof_y(x, z):
    a, b = (np.array([x, z]) - center) @ u, (np.array([x, z]) - center) @ v
    return 14.7 + max(
      (h - 14.7) * max(0, 1 - math.hypot(a - p, b - q) / 17) ** 2.1 for p, q, h in peaks
    )

  def poly_triangles(g):
    for p in [g] if g.geom_type == "Polygon" else getattr(g, "geoms", []):
      if p.geom_type != "Polygon" or p.is_empty:
        continue
      rr = [[[x, 0, z] for x, z in r.coords] for r in [p.exterior, *p.interiors]]
      yield from triangles_for(rr)

  def contours(level):
    p = field()["profiles"][0]
    w, n, e, s = SUPPORT
    vals = p["offsets"]
    result = []
    for iz in range(len(vals) - 1):
      z = n + iz * STEP
      if z < 6510 or z > 6624:
        continue
      for ix in range(len(vals[0]) - 1):
        x = w + ix * STEP
        if x < 11608 or x > 11736:
          continue
        pts = [
          (x, 3 + vals[iz][ix], z),
          (x + STEP, 3 + vals[iz][ix + 1], z),
          (x + STEP, 3 + vals[iz + 1][ix + 1], z + STEP),
          (x, 3 + vals[iz + 1][ix], z + STEP),
        ]
        for ids in [(0, 1, 2), (0, 2, 3)]:
          cuts = []
          for ia, ib in zip(ids, ids[1:] + ids[:1]):
            a, b = pts[ia], pts[ib]
            if (a[1] <= level < b[1]) or (b[1] <= level < a[1]):
              t = (level - a[1]) / (b[1] - a[1])
              cuts.append((a[0] + t * (b[0] - a[0]), a[2] + t * (b[2] - a[2])))
          if len(cuts) == 2:
            for segment in line_parts(LineString(cuts).intersection(benches)):
              if segment.length > 0.06:
                result.append(segment)
    return result

  contour_rows = [
    (round(level, 3), contours(level)) for level in np.arange(4.2, 15.6, 0.34)
  ]
  terrain.SUPPORT = SUPPORT
  terrain.STEP = STEP
  terrain.NATIVE_STEP = NATIVE_STEP
  terrain.sample_offset = lambda x, z: offset_at(x, z)
  terrain.sample_native_offset = lambda x, z: offset_at(x, z, True)
  outputs = []
  for native in [False, True]:
    group = {
      "key": "Wuhlheide source-bound seating, tent and access stairs",
      "owners": sorted(PROXIES),
      "boxes": [],
      "rods": [],
      "positions": [],
      "indices": [],
      "colors": [],
    }
    unique = {}

    def tri(points, tint):
      for point in points:
        p = tuple(round(float(c), 3) for c in point)
        key = (p, tint)
        if key not in unique:
          unique[key] = len(group["colors"])
          group["positions"].extend(p)
          group["colors"].append(tint)
        group["indices"].append(unique[key])

    def block(p, size, tint, a=0):
      if native:
        # Native geometry is separately constructed; no rotated facade shortcut.
        c, s = math.cos(a), math.sin(a)
        footprint = Polygon(
          [
            (p[0] + c * x + s * z, p[2] - s * x + c * z)
            for x, z in [
              (-size[0] / 2, -size[2] / 2),
              (size[0] / 2, -size[2] / 2),
              (size[0] / 2, size[2] / 2),
              (-size[0] / 2, size[2] / 2),
            ]
          ]
        )
        x0, z0, x1, z1 = footprint.bounds
        for zz in np.arange(z0 + 0.3, z1 + 0.3, 0.6):
          for line in line_parts(
            footprint.intersection(LineString([(x0 - 1, zz), (x1 + 1, zz)]))
          ):
            if line.length > 0.02:
              group["boxes"].append(
                [
                  (line.bounds[0] + line.bounds[2]) / 2,
                  float(p[1]),
                  float(zz),
                  line.length,
                  float(size[1]),
                  0.6,
                  tint,
                ]
              )
      else:
        group["boxes"].append([*map(float, p), *map(float, size), float(a), tint])

    def rod(a, b, width, tint):
      if native:
        a, b = np.asarray(a), np.asarray(b)
        d = b - a
        n = max(1, math.ceil(np.linalg.norm(d) / 0.7))
        for i in range(n):
          q = a + d * (i + 0.5) / n
          group["boxes"].append(
            [
              *map(float, q),
              max(width, abs(d[0]) / n),
              max(width, abs(d[1]) / n),
              max(width, abs(d[2]) / n),
              tint,
            ]
          )
      else:
        group["rods"].append([*map(float, a), *map(float, b), width, tint])

    # Exact source grandstand footprint, empty central arena and all mapped aisles.
    for t in poly_triangles(seating.difference(buildings)):
      points = np.asarray(t)
      points[:, 1] = 3.22
      for piece in terrain.drape_triangle(points, minecraft=native):
        tri(piece, 0x9D9E8E)
    # Every estimated bench row is clipped to measured terrain contours and the
    # mapped stand, leaving actual radial access routes and the FOH intact.
    for level, segments in contour_rows:
      for segment in segments:
        a, b = np.array(segment.coords[0]), np.array(segment.coords[-1])
        d = b - a
        length = np.linalg.norm(d)
        if native:
          n = max(1, math.ceil(length / 0.8))
          for k in range(n):
            q = a + d * (k + 0.5) / n
            y = 3 + offset_at(*q, True) + 0.52
            group["boxes"].append(
              [
                float(q[0]),
                y,
                float(q[1]),
                max(0.35, abs(d[0]) / n),
                0.12,
                max(0.35, abs(d[1]) / n),
                0xC4C8BE,
              ]
            )
        else:
          block(
            [(a[0] + b[0]) / 2, level + 0.5, (a[1] + b[1]) / 2],
            [length, 0.12, 0.36],
            0xC4C8BE,
            -math.atan2(d[1], d[0]),
          )
    for entry in steps:
      line = shape(entry["worldGeometry"])
      count = int(
        entry["tags"].get("step_count", max(2, math.ceil(line.length / 0.45)))
      )
      for i in range(count):
        p = line.interpolate((i + 0.5) / count, normalized=True)
        a = line.interpolate(i / count, normalized=True)
        b = line.interpolate((i + 1) / count, normalized=True)
        y = 3 + offset_at(p.x, p.y, native) + 0.27
        block(
          [p.x, y, p.y],
          [math.hypot(b.x - a.x, b.y - a.y), 0.14, 3.0],
          0xB5B3A4,
          -math.atan2(b.y - a.y, b.x - a.x),
        )
      for side in [-1, 1]:
        last = None
        for d in np.arange(0, line.length + 0.01, 1.5):
          p = line.interpolate(d)
          a = line.interpolate(max(0, d - 0.1))
          b = line.interpolate(min(line.length, d + 0.1))
          dx, dz = b.x - a.x, b.y - a.y
          length = max(0.001, math.hypot(dx, dz))
          x, z = p.x - side * dz / length * 1.4, p.y + side * dx / length * 1.4
          y = 3 + offset_at(x, z, native) + 1.05
          if last:
            rod(last, [x, y, z], 0.055, 0x7B8078)
          last = [x, y, z]
    # Operator publishes the 22.5 x16m playing surface; floor and steel heights
    # are explicit display estimates, unlike the measured earthwork.
    c = local(0, 2)
    block([c[0], 6.1, c[1]], [22.5, 0.6, 16], 0x505855, angle)
    for i in [0, 3, 6, 8, 11, 14, 16, 19]:
      q = np.array(roof.exterior.coords[i])
      delta = q - center
      foot = q - delta * 0.12
      low = 3 + offset_at(*foot, native)
      rod([foot[0], low, foot[1]], [q[0], 14.7, q[1]], 0.32, 0x8D9793)
      if not native:
        nav["legs"].append(
          {
            "a": [float(foot[0]), low, float(foot[1])],
            "b": [float(q[0]), 14.7, float(q[1])],
            "radius": 0.2,
          }
        )
    # Complete OSM scalloped roof outline, sampled only in elevation. Four
    # tensile peaks are a documented photographic interpretation, no textures.
    x0, z0, x1, z1 = roof.bounds
    peak_world = [(*local(x, z), h) for x, z, h in peaks]

    def cell_height(x, z):
      return max(
        [roof_y(x + 0.5, z + 0.5)]
        + [h for px, pz, h in peak_world if x <= px < x + 1 and z <= pz < z + 1]
      )

    for z in np.arange(math.floor(z0), math.ceil(z1), 1):
      for x in np.arange(math.floor(x0), math.ceil(x1), 1):
        cell = roof.intersection(box(x, z, x + 1, z + 1))
        if cell.is_empty:
          continue
        if native:
          if roof.covers(Point(x + 0.5, z + 0.5)):
            high = cell_height(x, z)
            low = min(
              [high - 0.35]
              + [
                cell_height(x + dx, z + dz) - 0.35
                for dx, dz in [(1, 0), (-1, 0), (0, 1), (0, -1)]
                if roof.covers(Point(x + dx + 0.5, z + dz + 0.5))
              ]
            )
            group["boxes"].append(
              [x + 0.5, (high + low) / 2, z + 0.5, 1, high - low, 1, 0xE9E9D9]
            )
        else:
          for t in poly_triangles(cell):
            peak = next(
              (
                (px, pz, h)
                for px, pz, h in peak_world
                if Polygon([(p[0], p[2]) for p in t]).covers(Point(px, pz))
              ),
              None,
            )
            if peak:
              px, pz, h = peak
              for a, b in zip(t, [*t[1:], t[0]]):
                tri(
                  [
                    [a[0], roof_y(a[0], a[2]), a[2]],
                    [b[0], roof_y(b[0], b[2]), b[2]],
                    [px, h, pz],
                  ],
                  0xE9E9D9,
                )
            else:
              tri([[p[0], roof_y(p[0], p[2]), p[2]] for p in t], 0xE9E9D9)
    for x, z, h in peaks:
      q = local(x, z)
      block([q[0], h + 0.03, q[1]], [0.85, 0.2, 0.85], 0x939B92)
    # Deck approach across the true stage front remains visibly open.
    assert len(group["colors"]) < 65536
    outputs.append({"schemaVersion": 1, "sites": [group]})
  (DATA / "wuhlheideV201.json").write_bytes(encode(outputs[0]))
  (DATA / "wuhlheideV201Native.json").write_bytes(encode(outputs[1]))
  (DATA / "wuhlheideV201Navigation.json").write_bytes(encode(nav))
  report = {
    "version": "1.0.101",
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "owners": sorted(PROXIES),
    "stageSizeM": [22.5, 16],
    "arenaFloorSample": [11674, 6568, round(3 + offset_at(11674, 6568), 3)],
    "rimSample": [11730, 6560, round(3 + offset_at(11730, 6560), 3)],
    "facts": [
      "https://www.wuhlheide.de/location/geschichte",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046018",
      "https://www.berlin.de/sen/stadt/stadtdaten/geoinformation/landesvermessung/geotopographie-atkis/dgm-digitale-gelaendemodelle/",
    ],
    "references": [
      {
        "url": "https://commons.wikimedia.org/wiki/File:BerlinWuhlheide-2014.JPG",
        "author": "Lugnuts",
        "license": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
        "use": "Visual recognition only: four white tensile peaks, inclined steel legs, open stage and curved backless bench rows; no tracing, sampling or embedded image.",
      },
      {
        "url": "https://commons.wikimedia.org/wiki/File:Wuhlheide_Konzert_Green_Day_2022-06-01_Bild_1.jpg",
        "author": "Strubbl",
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
        "use": "2022 corroboration of current roof silhouette and exposed spectator slopes; no photographic texture.",
      },
    ],
    "interpretation": "OSM supplies exact full footprints and stair routes; DGM supplies sampled earthwork. Bench spacing/width, roof membrane elevations and steel-member dimensions are display estimates, not measured architectural survey. Open-air grandstand has no solid roof or walls. Existing toilets, backstage and FOH remain original complete owners, rigidly translated to measured terrain.",
  }
  reference_receipts = {
    "https://commons.wikimedia.org/wiki/File:BerlinWuhlheide-2014.JPG": {
      "downloadUrl": "https://upload.wikimedia.org/wikipedia/commons/2/21/BerlinWuhlheide-2014.JPG",
      "referenceSha256": "e842e5348a92f1e9a3a2aef0b52d89e0372ea31ac674915991f9c57821d46466",
      "accessed": "2026-10-09",
    },
    "https://commons.wikimedia.org/wiki/File:Wuhlheide_Konzert_Green_Day_2022-06-01_Bild_1.jpg": {
      "downloadUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Wuhlheide_Konzert_Green_Day_2022-06-01_Bild_1.jpg/960px-Wuhlheide_Konzert_Green_Day_2022-06-01_Bild_1.jpg",
      "referenceSha256": "2db6d116c20eb14806dfda543bd820ca421e79b443b7e8ee270788ab7d4b07a9",
      "accessed": "2026-10-09",
    },
  }
  for row in report["references"]:
    row.update(reference_receipts[row["url"]])
  (GEO / "wuhlheide-v201-evidence.json").write_text(json.dumps(report, indent=2) + "\n")
  print(
    "Wuhlheide model",
    [
      [
        (
          len(g["boxes"]),
          len(g["rods"]),
          len(g["positions"]) // 3,
          len(g["indices"]) // 3,
        )
        for g in o["sites"]
      ]
      for o in outputs
    ],
    flush=True,
  )
  return report


if __name__ == "__main__":
  build_field()
  build_model()
