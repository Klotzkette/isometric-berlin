"""Step10: exact Waldbühne seating sheets and an open source-bound tent.

This is a separate final ownership transition after Olympic terrain. Raw LoD2
and OSM evidence remains complete; only false closed grandstand/tent proxies
are replaced. Nothing outside their precise footprints is discarded.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from functools import lru_cache

import geopandas as gpd
import numpy as np
from build_bebelplatz_building_source import part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_olympic_terrain_v201 import GEO, ROOT, encode, offset_at
from build_west_landmarks_v187 import world
from shapely import constrained_delaunay_triangles
from shapely.geometry import MultiPoint, Point, Polygon, box, mapping, shape
from shapely.ops import transform, triangulate, unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts

DATA = ROOT / "src/app/src/data"
RAW = GEO / "raw/waldbuehne-v201"
SOURCE = GEO / "waldbuehne-v201-source.json.gz"
SEATS = {
  f"DEBE04AL2ua000{v}"
  for v in "3k 3w 2k 3e 36 2p 34 3h 3i 38 2o 2l 39 3B 3n 3x 3j 4V 3s 2n 2m".split()
}
PROXIES = SEATS | {"DEBE04YY500002GT", "OSM-way-767528490"}


@lru_cache(maxsize=1)
def source() -> dict:
  if SOURCE.exists():
    return json.loads(gzip.decompress(SOURCE.read_bytes()))
  archive = GEO / "raw/lod2/LoD2_379_5819.zip"
  owners = []
  with zipfile.ZipFile(archive) as z:
    for m in z.namelist():
      if not m.endswith((".xml", ".gml")):
        continue
      with z.open(m) as f:
        for _, el in ET.iterparse(f, events=("end",)):
          if el.tag != f"{{{NS['bldg']}}}Building":
            continue
          id = el.get(GML_ID)
          if id in PROXIES:
            owners.append(
              {
                "id": id,
                "parts": [part_profile(p) for p in leaf_building_parts(el) or [el]],
              }
            )
          el.clear()
  fs = json.loads((GEO / "raw/v187-west/olympic-multipolygons.json").read_bytes())[
    "features"
  ]
  tent = next(f for f in fs if f["properties"].get("osm_way_id") == "767528490")
  records = gpd.read_file(
    GEO / "raw/outskirts-v187/resolved-outlines.gpkg",
    layer="buildings",
    where="sourceId IN (" + ",".join("'" + id + "'" for id in sorted(PROXIES)) + ")",
  )
  assert len(owners) == 22 and len(records) == 23
  result = {
    "license": "dl-de/zero-2-0 + ODbL-1.0",
    "archive": {
      "url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_379_5819.zip",
      "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    },
    "owners": owners,
    "tentOSM": tent,
    "proxyRecords": [
      {
        **{
          k: None if isinstance(v, float) and not math.isfinite(v) else v
          for k, v in r.items()
        },
        "geometry": mapping(r["geometry"]),
      }
      for r in records.to_dict("records")
    ],
    "conflict": "LoD2 seating roof sheets are sloping earthwork surfaces, not solid parent-height prisms. The GT stage envelope closes the open tensile theatre; its complete original sheets remain here, while the exact OSM tent perimeter carries the photograph-supported open two-peak membrane. Unpublished membrane subdivision heights are display estimates bounded by the measured stage top35.66m.",
  }
  SOURCE.write_bytes(gzip.compress(encode(result), mtime=0))
  return result


def height(tri: list, x: float, z: float) -> float:
  a, b, c = np.asarray(tri)
  n = np.cross(b - a, c - a)
  return float(a[1] - (n[0] * (x - a[0]) + n[2] * (z - a[2])) / n[1])


def build() -> dict:
  s = source()
  surfaces = []
  floors = []
  mask = []
  blocks = []
  native_floors = []
  native_masks = []

  def sheet(tri, col, role):
    surfaces.append({"triangles": [tri], "color": col, "role": role})

  for owner in s["owners"]:
    if owner["id"] not in SEATS:
      continue
    for p in owner["parts"]:
      poly = Polygon(p["ring"], p["holes"])
      mask.append(poly)
      roof = []
      for face in p["surfaces"]:
        ts = triangles_for(face["rings"])
        for t in ts:
          sheet(
            t,
            0xB7B1A0 if face["kind"] == "RoofSurface" else 0x979382,
            "exact-seat-source",
          )
          if (
            face["kind"] == "RoofSurface"
            and Polygon([(v[0], v[2]) for v in t]).area > 1e-8
          ):
            roof.append(t)
            floors.append(t)
      # Thin independent grid skin, never a filled solid grandstand.
      x0, z0, x1, z1 = poly.bounds
      for x in range(math.floor(x0), math.ceil(x1)):
        for z in range(math.floor(z0), math.ceil(z1)):
          tile = box(x, z, x + 1, z + 1)
          if not poly.covers(tile):
            continue
          for t in roof:
            if Polygon([(v[0], v[2]) for v in t]).covers(Point(x + 0.5, z + 0.5)):
              y = round(height(t, x + 0.5, z + 0.5) * 4) / 4
              blocks.append([x + 0.5, y - 0.10, z + 0.5, 1, 0.2, 1, 0xB7B1A0])
              native_floors.append([x, z, y])
              native_masks.append(tile)
              break
  tent = transform(lambda x, y: world(x, y), shape(s["tentOSM"]["geometry"]))
  if tent.geom_type == "MultiPolygon":
    tent = max(tent.geoms, key=lambda p: p.area)
  c = tent.centroid
  u = np.asarray([0.883, -0.469])
  v = np.asarray([0.469, 0.883])
  centre = np.asarray([c.x, c.y])
  peaks = [centre - u * 12 - v * 3, centre + u * 12 - v * 3]

  def roof_y(x, z):
    d = min(float(np.linalg.norm(np.asarray([x, z]) - p)) for p in peaks)
    return 15.9 + 19.76 * math.exp(-d / 8.5)

  # Exact original53 perimeter vertices plus a small interior triangulation.
  points = list(tent.exterior.coords)[:-1] + [tuple(p) for p in peaks]
  x0, z0, x1, z1 = tent.bounds
  points += [
    (x, z)
    for x in range(math.ceil(x0), math.floor(x1), 2)
    for z in range(math.ceil(z0), math.floor(z1), 2)
    if tent.contains(Point(x, z))
  ]
  roof_tris = []
  for t in triangulate(MultiPoint(points)):
    cut = t.intersection(tent)
    if cut.area < 1e-8:
      continue
    for a in constrained_delaunay_triangles(cut).geoms:
      t3 = [
        [round(x, 3), round(roof_y(x, z), 4), round(z, 3)]
        for x, z in list(a.exterior.coords)[:3]
      ]
      sheet(t3, 0xF1EFE2, "open-two-peak-membrane")
      roof_tris.append(t3)
  # Stage slab stays at the measured source foot, with its curved OSM outline.
  deck = tent.buffer(-3.5)
  deck_y = 6.55
  for t in constrained_delaunay_triangles(deck).geoms:
    sheet(
      [[x, deck_y, z] for x, z in list(t.exterior.coords)[:3]], 0x797A75, "stage-deck"
    )
  rods = []
  for p in peaks:
    low = 3 + offset_at(*p)
    rods.append([*[], p[0], low, p[1], p[0], 35.66, p[1], 0.32, 0x8A8C86])
  for x in range(math.floor(x0), math.ceil(x1)):
    for z in range(math.floor(z0), math.ceil(z1)):
      if not tent.covers(Point(x + 0.5, z + 0.5)):
        continue
      blocks.append(
        [
          x + 0.5,
          round(roof_y(x + 0.5, z + 0.5) * 4) / 4,
          z + 0.5,
          1,
          0.25,
          1,
          0xF1EFE2,
        ]
      )
      if deck.covers(Point(x + 0.5, z + 0.5)):
        blocks.append([x + 0.5, deck_y - 0.12, z + 0.5, 1, 0.24, 1, 0x797A75])
        native_floors.append([x, z, deck_y])
        native_masks.append(box(x, z, x + 1, z + 1))
  for p in peaks:
    low = 3 + offset_at(*p, True)
    blocks.append([p[0], (low + 35.66) / 2, p[1], 0.4, 35.66 - low, 0.4, 0x8A8C86])
  # Restrained curved bench cues only on existing mapped source seating; spacing
  # and wood shade are annotation, not an invented survey of every individual seat.
  arena = np.asarray([-9676.0, 107.0])
  from shapely.geometry import LineString

  seat_union = unary_union(mask)
  for radius in np.arange(19, 106, 1.05):
    curve = LineString(
      [
        arena + [math.cos(t) * radius, math.sin(t) * radius]
        for t in np.linspace(0, math.pi, 180)
      ]
    )
    segments = curve.intersection(seat_union)
    for line in getattr(segments, "geoms", [segments]):
      if line.geom_type != "LineString":
        continue
      for a, b in zip(list(line.coords), list(line.coords)[1:]):
        p = (np.asarray(a) + b) / 2
        for tri in floors:
          if Polygon([(q[0], q[2]) for q in tri]).covers(Point(*p)):
            ya, yb = height(tri, *a) + 0.12, height(tri, *b) + 0.12
            rods.append([a[0], ya, a[1], b[0], yb, b[1], 0.11, 0x7F725B])
            break
  draw = {
    "sites": [
      {
        "key": "Waldbühne source seating and open tent",
        "owners": sorted(PROXIES),
        "boxes": [],
        "rods": [[round(v, 5) if isinstance(v, float) else v for v in r] for r in rods],
        "positions": [
          round(v, 5) for s in surfaces for t in s["triangles"] for p in t for v in p
        ],
        "indices": list(range(sum(len(s["triangles"]) * 3 for s in surfaces))),
        "colors": [s["color"] for s in surfaces for t in s["triangles"] for p in t],
      }
    ]
  }
  native = {
    "sites": [
      {
        "key": "Waldbühne independent block seating and tent",
        "owners": sorted(PROXIES),
        "boxes": blocks,
        "rods": [],
        "positions": [],
        "indices": [],
        "colors": [],
      }
    ]
  }
  nav = {
    "bounds": [-9718, 75, -9625, 209],
    "floorTriangles": floors,
    "nativeFloors": native_floors,
    "roofTriangles": roof_tris,
    "deck": {"ring": list(deck.exterior.coords)[:-1], "y": deck_y},
    "legs": rods[:2],
  }
  for name, value in [
    ("waldbuehneV201", draw),
    ("waldbuehneV201Native", native),
    ("waldbuehneV201Navigation", nav),
  ]:
    (DATA / f"{name}.json").write_bytes(encode(value))
  masks = {
    "drawn": mapping(unary_union([seat_union, deck])),
    "minecraft": mapping(unary_union(native_masks)),
    "seatingDrawn": mapping(seat_union),
    "stageDrawn": mapping(deck),
  }
  (GEO / "waldbuehne-v201-ground-masks.json").write_bytes(encode(masks))
  evidence = {
    "source": SOURCE.name,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "owners": sorted(PROXIES),
    "fullSourceSeatingSurfaces": sum(
      len(p["surfaces"]) for o in s["owners"] if o["id"] in SEATS for p in o["parts"]
    ),
    "seatingGroundArea": seat_union.area,
    "nativeGroundArea": shape(masks["minecraft"]).area,
    "renderTriangles": len(draw["sites"][0]["indices"]) // 3,
    "nativeBoxes": len(blocks),
    "benchSegments": len(rods) - 2,
    "sourceRoofTriangles": len(floors),
    "interpretation": "21 original sloping seating owners retained with exact mm source sheets. Closed stage-envelope conflicts corrected to an open two-peak source-bound tent; complete rejected source walls retained. Roof height35.66 is measured maximum, intermediate membrane profile and benches are explicit visual annotations. Separate thin orthogonal native floor cells; ground removal exactly matches each representation mask.",
  }
  (GEO / "waldbuehne-v201.json").write_bytes(encode(evidence))
  return evidence


if __name__ == "__main__":
  print(json.dumps(build(), indent=2))
