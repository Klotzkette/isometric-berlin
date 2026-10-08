"""Step 10: Grunewaldturm and Brücke-Museum, source-bound static recognition."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import normal_of, triangles_for
from build_grunewald_terrain_v190 import offset_at
from build_steglitz_v182 import native_blocks
from build_surrounding_outlines import source_identity, tags_for, world
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/grunewald-v190"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "grunewald-landmarks-v190-source.json.gz"
REFERENCES = [
  {
    "title": "Grunewaldturm-01-Frontansicht.jpg",
    "author": "Muck",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
    "url": "https://commons.wikimedia.org/wiki/File:Grunewaldturm-01-Frontansicht.jpg",
    "use": "Non-bundled visual reference: brick, open gallery, spire and pointed arches.",
  },
  {
    "title": "2021-05-26-Bruecke-Museum-Berlin-Dahlem-Bussardsteig-Werner-Duettmann-A.jpg",
    "author": "Gunnar Klack",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
    "url": "https://commons.wikimedia.org/wiki/File:2021-05-26-Bruecke-Museum-Berlin-Dahlem-Bussardsteig-Werner-Duettmann-A.jpg",
    "use": "Non-bundled visual reference: concrete, glazing and roof-edge material.",
  },
]


def encode(v: object) -> bytes:
  return (json.dumps(v, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def extract() -> dict:
  """Retain complete original source sheets and all replacing OSM owners."""
  osm = gpd.read_file(
    GEO / "raw/outskirts-v187/candidate.gpkg",
    layer="multipolygons",
    where="osm_id='7868401' OR osm_way_id IN ('23722446','1540042306','1540042311','1540042312','1540042313','1525010580','1540043981')",
  ).to_crs(25833)
  records = []
  for key, owner, code in [
    ("museum", "DEBE06YYB0000Bv3", "382_5814"),
    ("museum", "DEBE06YYB0004u5T", "382_5814"),
    ("tower", "DEBE04YY50003FsE", "377_5815"),
  ]:
    archive = RAW / f"LoD2_{code}.zip"
    parent = extract_parent(archive, owner)
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    records.append(
      {
        "key": key,
        "owner": owner,
        "sourceUrl": f"https://gdi.berlin.de/data/a_lod2/atom/{archive.name}",
        "sourceSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "parts": parts,
      }
    )
  return {
    "schemaVersion": 1,
    "profiles": records,
    "osmFeatures": [
      {
        "type": "Feature",
        "geometry": mapping(world(row.geometry)),
        "properties": {"sourceId": source_identity(row), "tags": tags_for(row)},
      }
      for _, row in osm.iterrows()
    ],
    "references": REFERENCES,
    "facts": [
      "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/tuerme/artikel.1129193.php",
      "https://www.bruecke-museum.de/en/museum/63/architecture",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075316",
    ],
  }


def build() -> None:
  if not SOURCE.exists():
    SOURCE.write_bytes(gzip.compress(encode(extract()), mtime=0))
  src = json.loads(gzip.decompress(SOURCE.read_bytes()))
  sites = []
  nav = []
  exclusions = []
  evidence = []
  for key, name in [
    ("museum", "Brücke-Museum"),
    ("tower", "Grunewaldturm auf dem Karlsberg"),
  ]:
    site = {"key": key, "name": name, "surfaces": [], "boxes": [], "owners": []}
    sources = [p for p in src["profiles"] if p["key"] == key]
    footprint = unary_union(
      [Polygon(p["ring"], p["holes"]) for s in sources for p in s["parts"]]
    )
    anchor = footprint.representative_point()
    base = 3 + offset_at(anchor.x, anchor.y) + 0.05
    datum = min(p["ground_y_m"] for s in sources for p in s["parts"])
    dy = base - datum
    for record in sources:
      site["owners"].append(record["owner"])
      for part in record["parts"]:
        nav.append(
          {
            "id": part["id"],
            "owner": record["owner"],
            "sourceId": record["owner"],
            "ring": part["ring"],
            "holes": part["holes"],
            "groundY": round(part["ground_y_m"] + dy, 3),
            "topY": round(part["top_y_m"] + dy, 3),
            "heightSource": "Berlin LoD2 measured part; common site altitude from Grunewald DGM field",
          }
        )
        for surface in part["surfaces"]:
          rings = [
            [[x, round(y + dy, 3), z] for x, y, z in r] for r in surface["rings"]
          ]
          color = (
            (0xB0ACA0 if surface["kind"] == "WallSurface" else 0x646B68)
            if key == "museum"
            else (0xA96D52 if surface["kind"] == "WallSurface" else 0xA08068)
          )
          site["surfaces"].append(
            {
              "triangles": triangles_for(rings),
              "color": color,
              "kind": surface["kind"],
              "owner": record["owner"],
              "part": part["id"],
            }
          )
          if key == "museum" and surface["kind"] == "WallSurface":
            museum_details(site, rings)
      evidence.append(
        {
          "key": key,
          "owner": record["owner"],
          "sourceParts": len(record["parts"]),
          "rigidYOffset": round(dy, 3),
          "displayBaseY": round(base, 3),
        }
      )
    replacing = [
      f
      for f in src["osmFeatures"]
      if (f["properties"]["sourceId"] == "OSM-relation-7868401") == (key == "museum")
    ]
    owned = unary_union([footprint, *[shape(f["geometry"]) for f in replacing]])
    exclusions.append(
      {
        "type": "Feature",
        "geometry": mapping(owned),
        "properties": {
          "name": name,
          "crs": "scene x,z; EPSG:25833 easting-389500,5820000-northing",
          "parentIds": site["owners"],
          "sourceIds": [f["properties"]["sourceId"] for f in replacing],
        },
      }
    )
    if key == "tower":
      tower_details(site, src, base, nav)
    sites.append(site)
  payload = {"schemaVersion": 1, "sites": sites}
  (DATA / "grunewaldLandmarksV190.json").write_bytes(encode(payload))
  native = {"schemaVersion": 1, "sites": []}
  for site in sites:
    # These include solid shaft/pier members, not just shallow facade panels.
    # Sample all six exterior faces so native mode never becomes a flat front.
    skins = list(site["surfaces"])
    for x, y, z, w, h, d, yaw, color in site["boxes"]:
      corners = []
      for u, v, t in [
        (-1, -1, -1),
        (1, -1, -1),
        (1, 1, -1),
        (-1, 1, -1),
        (-1, -1, 1),
        (1, -1, 1),
        (1, 1, 1),
        (-1, 1, 1),
      ]:
        px, pz = u * w / 2, t * d / 2
        corners.append(
          [
            x + math.cos(yaw) * px + math.sin(yaw) * pz,
            y + v * h / 2,
            z - math.sin(yaw) * px + math.cos(yaw) * pz,
          ]
        )
      tris = []
      for a, b, c, e in [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (3, 2, 6, 7),
        (0, 3, 7, 4),
        (1, 5, 6, 2),
      ]:
        tris.extend(
          [[corners[a], corners[b], corners[c]], [corners[a], corners[c], corners[e]]]
        )
      skins.append({"triangles": tris, "color": color})
    rows = native_blocks({**site, "surfaces": skins, "boxes": [], "rods": []})
    native["sites"].append(
      {
        "key": site["key"],
        "name": site["name"],
        "owners": site["owners"],
        "boxes": rows,
      }
    )
  (DATA / "grunewaldLandmarksV190Native.json").write_bytes(encode(native))
  (DATA / "grunewaldLandmarksV190Navigation.json").write_bytes(
    encode({"buildings": nav})
  )
  (GEO / "grunewald-landmarks-v190-exclusions.geojson").write_bytes(
    encode(
      {
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": "LOCAL:BERLIN-SCENE-XZ"}},
        "features": exclusions,
      }
    )
  )
  (GEO / "grunewald-landmarks-v190-evidence.json").write_bytes(
    encode(
      {
        "schemaVersion": 1,
        "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "owners": evidence,
        "references": REFERENCES,
        "facts": src["facts"],
        "policy": "All measured museum source sheets retained. Tower source records only6.528m terrace;55m tower and36m gallery use published district heights, OSM position/upper-pylon footprint, with independently authored unsurveyed subdivisions. Previous55m whole-terrace fallback replaced exactly, full source inventory retained. No image pixels or textures.",
        "sourceTriangles": sum(
          len(s["triangles"])
          for g in sites
          for s in g["surfaces"]
          if s.get("kind") in {"RoofSurface", "WallSurface"}
        ),
        "drawnBoxes": sum(len(g["boxes"]) for g in sites),
        "nativeRuns": sum(len(g["boxes"]) for g in native["sites"]),
      }
    )
  )
  print([(s["key"], len(s["surfaces"]), len(s["boxes"])) for s in sites], flush=True)


def museum_details(site: dict, rings: list) -> None:
  """Shallow surveyed-plane accents; no invented dense generic office windows."""
  n = normal_of(rings[0])
  pts = np.asarray(rings[0])
  if abs(n[1]) > 0.02:
    return
  a, b = max(
    ((a, b) for a in pts for b in pts),
    key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
  )
  d = np.asarray([b[0] - a[0], 0, b[2] - a[2]])
  length = np.linalg.norm(d)
  if length < 2:
    return
  d /= length
  lo, hi = pts[:, 1].min(), pts[:, 1].max()
  yaw = math.atan2(-d[2], d[0])

  def put(u: float, y: float, w: float, h: float, depth: float, c: int) -> None:
    p = a + d * u + n * (0.04 + depth / 2)
    site["boxes"].append(
      [
        round(p[0], 3),
        round(y, 3),
        round(p[2], 3),
        round(w, 3),
        round(h, 3),
        depth,
        round(yaw, 6),
        c,
      ]
    )

  put(length / 2, hi - 0.12, length, 0.24, 0.12, 0x58635F)
  # Short recessed wall segments between the tall picture-wall niches provide
  # the museum's glass rhythm. Exact individual panes are not surveyed.
  if 2.2 < length < 8.5 and hi - lo > 2.2:
    put(length / 2, lo + 1.12, length - 0.36, 2.12, 0.04, 0x80938E)
    for u in np.arange(0.18, length - 0.1, 1.65):
      put(float(u), lo + 1.12, 0.07, 2.2, 0.11, 0xAAB5A2)
    put(length / 2, lo + 0.06, length, 0.12, 0.12, 0xAAB5A2)
  else:
    for y in np.arange(lo + 0.55, hi - 0.4, 0.65):
      put(length / 2, float(y), length, 0.023, 0.045, 0x969A8E)


def tower_details(site: dict, src: dict, base: float, nav: list) -> None:
  """Open pointed arches, narrow shaft, real upper opening, steep brick roof."""
  # Four actual mapped upper corner turrets constrain centre and orientation.
  fs = {f["properties"]["sourceId"]: shape(f["geometry"]) for f in src["osmFeatures"]}
  p = fs["OSM-way-1540042306"].centroid
  q = fs["OSM-way-1540042311"].centroid
  corners = [
    fs[f"OSM-way-{i}"].centroid
    for i in [1540042306, 1540042311, 1540042312, 1540042313]
  ]
  cx, cz = np.mean([[p.x, p.y] for p in corners], axis=0)
  angle = math.atan2(q.y - p.y, q.x - p.x)
  c, s = math.cos(angle), math.sin(angle)

  def point(x: float, y: float, z: float) -> list:
    return [
      round(cx + c * x - s * z, 3),
      round(base + y, 3),
      round(cz + s * x + c * z, 3),
    ]

  def block(
    x: float, y: float, z: float, w: float, h: float, d: float, color: int
  ) -> None:
    site["boxes"].append([*point(x, y, z), w, h, d, -angle, color])

  def face(points: list, color: int) -> None:
    site["surfaces"].append(
      {
        "triangles": triangles_for([[point(*p) for p in points]]),
        "color": color,
        "kind": "RecognitionSurface",
      }
    )

  brick = 0xAB654B
  dark = 0x80523F
  stone = 0xC0AF89
  # The measured6.5m terrace remains below this open lower hall.
  for x in [-5.2, 5.2]:
    for z in [-5.2, 5.2]:
      block(x, 10, z, 2.3, 7, 2.3, brick)
  # Four Gothic arch fields are genuine openings, not black painted rectangles.
  for side in range(4):

    def r(x: float, y: float, z: float) -> tuple:
      a = side * math.pi / 2
      return (math.cos(a) * x - math.sin(a) * z, y, math.sin(a) * x + math.cos(a) * z)

    curve = [
      (-4, 9),
      (-3.7, 10.4),
      (-2.9, 11.8),
      (-1.65, 13.1),
      (0, 14.2),
      (1.65, 13.1),
      (2.9, 11.8),
      (3.7, 10.4),
      (4, 9),
    ]
    for (x0, y0), (x1, y1) in zip(curve, curve[1:]):
      face(
        [r(x0, y0, -6.25), r(x1, y1, -6.25), r(x1, 15.2, -6.25), r(x0, 15.2, -6.25)],
        brick,
      )
    for x in [-5.4, 5.4]:
      for y in np.arange(7.4, 14.5, 0.7):
        xx, yy, zz = r(x, float(y), -6.4)
        block(xx, yy, zz, 1.2, 0.09, 0.14, dark)
  block(0, 16, 0, 12.8, 1.5, 12.8, dark)
  # Four round lower turrets give the characteristic broad Gothic shoulder.
  for xx in [-5.25, 5.25]:
    for zz in [-5.25, 5.25]:
      for j in range(12):
        aa, bb = j * math.tau / 12, (j + 1) * math.tau / 12
        face(
          [
            (xx + 1.03 * math.cos(aa), 14, zz + 1.03 * math.sin(aa)),
            (xx + 1.03 * math.cos(bb), 14, zz + 1.03 * math.sin(bb)),
            (xx + 1.03 * math.cos(bb), 19.5, zz + 1.03 * math.sin(bb)),
            (xx + 1.03 * math.cos(aa), 19.5, zz + 1.03 * math.sin(aa)),
          ],
          brick,
        )
        face(
          [
            (xx + 1.25 * math.cos(aa), 19.5, zz + 1.25 * math.sin(aa)),
            (xx + 1.25 * math.cos(bb), 19.5, zz + 1.25 * math.sin(bb)),
            (xx, 23, zz),
          ],
          dark,
        )
  block(0, 25, 0, 6.2, 17.5, 6.2, brick)
  for y in np.arange(17, 33.2, 1.0):
    block(0, float(y), -3.14, 6.25, 0.025, 0.04, 0xC07A5B)
    block(3.14, float(y), 0, 0.04, 0.025, 6.25, 0xC07A5B)
  # Overhung gallery and corner pinnacles; every side remains see-through.
  block(0, 34, 0, 8.0, 1.4, 8.0, dark)
  for x in [-3.3, 3.3]:
    for z in [-3.3, 3.3]:
      block(x, 39, z, 0.8, 9, 0.8, brick)
  for side in [-1, 1]:
    block(0, 35.5, side * 3.6, 6.7, 0.45, 0.42, stone)
    block(side * 3.6, 35.5, 0, 0.42, 0.45, 6.7, stone)
    for u in np.arange(-2.9, 3, 0.48):
      block(float(u), 37.25, side * 3.65, 0.045, 3.1, 0.045, 0x53574D)
      block(side * 3.65, 37.25, float(u), 0.045, 3.1, 0.045, 0x53574D)
  block(0, 42.9, 0, 7.6, 0.65, 7.6, dark)
  for side in range(4):
    aa = side * math.pi / 2

    def upper(x: float, y: float, z: float) -> tuple:
      return math.cos(aa) * x - math.sin(aa) * z, y, math.sin(aa) * x + math.cos(aa) * z

    curve = [
      (-2.9, 39.8),
      (-2.4, 40.5),
      (-1.3, 41.4),
      (0, 42.1),
      (1.3, 41.4),
      (2.4, 40.5),
      (2.9, 39.8),
    ]
    for (x0, y0), (x1, y1) in zip(curve, curve[1:]):
      face(
        [
          upper(x0, y0, -3.5),
          upper(x1, y1, -3.5),
          upper(x1, 42.6, -3.5),
          upper(x0, 42.6, -3.5),
        ],
        brick,
      )
  # Small ceramic shield and abstract historic eagle, independently authored.
  for side in [0, 2]:
    zz = -3.17 if side == 0 else 3.17
    face(
      [(-1.15, 28.7, zz), (1.15, 28.7, zz), (1.15, 31.5, zz), (-1.15, 31.5, zz)], stone
    )
    for sign in [-1, 1]:
      face(
        [
          (0, 29.2, zz - 0.02),
          (sign * 0.9, 30.1, zz - 0.02),
          (sign * 0.9, 31.1, zz - 0.02),
          (0, 30.3, zz - 0.02),
        ],
        0x3F4843,
      )
    block(0, 30, zz, 0.34, 2.3, 0.055, 0x3F4843)
  for side in range(4):
    aa = side * math.pi / 2
    pp = [(-3.8, 43.2, -3.8), (3.8, 43.2, -3.8), (0, 55, 0)]
    face(
      [
        (math.cos(aa) * x - math.sin(aa) * z, y, math.sin(aa) * x + math.cos(aa) * z)
        for x, y, z in pp
      ],
      brick,
    )
  for x in [-3.3, 3.3]:
    for z in [-3.3, 3.3]:
      block(x, 44, z, 0.65, 3, 0.65, brick)
      for side in range(4):
        aa = side * math.pi / 2
        bb = (side + 1) * math.pi / 2
        face(
          [
            (x + 0.6 * math.cos(aa), 45.5, z + 0.6 * math.sin(aa)),
            (x + 0.6 * math.cos(bb), 45.5, z + 0.6 * math.sin(bb)),
            (x, 47, z),
          ],
          dark,
        )
  # The shaft has its own footprint, never a55m collider over the entire terrace.
  ring = [
    [point(x, 0, z)[0], point(x, 0, z)[2]]
    for x, z in [(-3.1, -3.1), (3.1, -3.1), (3.1, 3.1), (-3.1, 3.1)]
  ]
  nav.append(
    {
      "id": "grunewaldturm-shaft",
      "owner": "OSM-way-23722446",
      "sourceId": "OSM-way-23722446",
      "ring": ring,
      "holes": [],
      "groundY": round(base + 16, 3),
      "topY": round(base + 55, 3),
      "heightSource": "Published55m overall height, OSM upper-pylon plan; local subdivisions display estimates",
    }
  )


if __name__ == "__main__":
  build()
