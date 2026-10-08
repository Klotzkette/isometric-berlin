"""Step 10: bounded source-bound KaDeWe / Wittenbergplatz display refinement."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
import shapely
from pyproj import Transformer
from shapely.geometry import Point, Polygon, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "src/app/src/data/westSquaresV188Detail.json"
V163 = ROOT / "src/app/src/data/westSquaresV163Source.json"
TAUENTZIEN = ROOT / "geo_data/regierungsviertel/tauentzien-v165.json"
AREA_IDS = {"5396406", "5748424", "26369804", "26369805"}
YAW = -0.598


def local(x: float, z: float) -> tuple[float, float]:
  return (
    math.cos(YAW) * (x + 2084.6) - math.sin(YAW) * (z - 1826.7),
    math.sin(YAW) * (x + 2084.6) + math.cos(YAW) * (z - 1826.7),
  )


def rings(poly: Polygon) -> list[list[list[float]]]:
  return [
    [[round(x, 3), round(z, 3)] for x, z in ring.coords[:-1]]
    for ring in [poly.exterior, *poly.interiors]
  ]


def polygons(geometry: Any) -> list[Polygon]:
  return list(geometry.geoms) if geometry.geom_type == "MultiPolygon" else [geometry]


def native_cells(geometry: Any, y: float, color: int) -> list[list[float]]:
  """A bounded 2.5 m native paving grid; do not fill holes or roads outside it."""
  rows = []
  min_x, min_z, max_x, max_z = geometry.bounds
  for ix in range(math.floor(min_x / 2.5), math.ceil(max_x / 2.5)):
    for iz in range(math.floor(min_z / 2.5), math.ceil(max_z / 2.5)):
      x, z = (ix + 0.5) * 2.5, (iz + 0.5) * 2.5
      # Entire cell stays inside the mapped floor; narrow residuals stay in the
      # retained original native ground. This also preserves every source hole.
      if geometry.covers(shapely.box(x - 1.25, z - 1.25, x + 1.25, z + 1.25)):
        rows.append([x, y, z, 2.5, 0.12, 2.5, 0, color])
  return rows


def make_payload() -> dict[str, Any]:
  source = json.loads(V163.read_text())
  tauentzien = json.loads(TAUENTZIEN.read_text())
  part = next(p for p in source["parts"] if p["name"] == "KaDeWe")
  foot = Polygon(part["rings"][0])
  collar = foot.difference(foot.buffer(-8, join_style="mitre"))
  roof = []
  for triangle in shapely.constrained_delaunay_triangles(collar).geoms:
    points = [
      [
        round(x, 3),
        round(35.70 + 4.6 * min(1, foot.boundary.distance(Point(x, z)) / 8), 3),
        round(z, 3),
      ]
      for x, z in list(triangle.exterior.coords)[:3]
    ]
    depth = sum(local(p[0], p[2])[1] for p in points) / 3
    roof.append({"points": points, "color": 0xB18478 if depth < 80 else 0x7E8984})

  # Six horizontal registers retain existing windows between their bands.
  # Each strip stays inside a particular measured source wall; front/side only.
  facade = []
  for index, surface in enumerate(part["sourceSurfaces"]):
    if surface["kind"] != "WallSurface":
      continue
    a, b = surface["rings"][0][:2]
    length = math.hypot(b[0] - a[0], b[2] - a[2])
    if length < 2:
      continue
    cx, cz = (a[0] + b[0]) / 2, (a[2] + b[2]) / 2
    if local(cx, cz)[1] > 78:
      continue
    dx, dz = (b[0] - a[0]) / length, (b[2] - a[2]) / length
    # All source outer-ring walls use the same outward normal.
    nx, nz = dz, -dx
    if foot.contains(Point(cx + nx, cz + nz)):
      nx, nz = -nx, -nz
    for y, h, depth, color in [
      (10.2, 0.32, 0.40, 0xC2BAA9),
      (13.55, 0.18, 0.25, 0xCCC4B5),
      (21.35, 0.20, 0.25, 0xC8C0B3),
      (25.25, 0.42, 0.55, 0xD4CCBD),
      (29.15, 0.20, 0.30, 0xC8C0B3),
      (34.8, 0.55, 0.65, 0xD4CCBD),
    ]:
      facade.append(
        {
          "sourceWall": index,
          "row": [
            round(cx + nx * depth / 2, 3),
            y,
            round(cz + nz * depth / 2, 3),
            round(length - 0.04, 3),
            h,
            depth,
            round(math.atan2(-dz, dx), 6),
            color,
          ],
        }
      )

  to_utm = Transformer.from_crs(4326, 25833, always_xy=True).transform
  areas = gpd.read_file(
    ROOT / "geo_data/regierungsviertel/raw/outer-v159/candidate.gpkg",
    layer="multipolygons",
  )
  paving, native = [], []
  for row in areas.to_dict("records"):
    identity = str(
      row["osm_way_id"] if row["osm_way_id"] == row["osm_way_id"] else row["osm_id"]
    )
    if identity not in AREA_IDS:
      continue
    projected = transform(
      lambda x, z: (x - 389500, 5820000 - z), transform(to_utm, row["geometry"])
    )
    color = 0xAAA99F if identity == "26369804" else 0xC5BFAF
    paving.append(
      {
        "id": identity,
        "polygons": [rings(p) for p in polygons(projected)],
        "color": color,
        "y": 5.52,
      }
    )
    native.extend(native_cells(projected, 5.52, color))

  road = unary_union(
    [
      shape(r["geometry"]).buffer(r["width"] / 2, cap_style="flat", join_style="mitre")
      for r in tauentzien["roads"]
      if r["highway"] not in {"footway", "pedestrian", "cycleway", "path"}
    ]
  )
  # Snap the derived surface at millimetre precision before serialisation, so
  # shared junction vertices cannot cross when decimal coordinates are written.
  road = shapely.set_precision(road, 0.001)
  roads = [
    {"polygons": [rings(p) for p in polygons(road)], "color": 0x8B908A, "y": 5.54}
  ]
  native.extend(native_cells(road, 5.54, 0x8B908A))
  return {
    "schemaVersion": 1,
    "scope": "Existing KaDeWe footprint, four mapped Wittenbergplatz paving owners and retained Tauentzien carriageways only; no new city bounds or owner replacement.",
    "sourceHashes": {
      "westSquaresV163": hashlib.sha256(V163.read_bytes()).hexdigest(),
      "tauentzienV165": hashlib.sha256(TAUENTZIEN.read_bytes()).hexdigest(),
    },
    "sourceDate": "2026-09-29 retained Geofabrik Berlin OSM extract",
    "licences": {
      "sourceBuildingsAndDOP": "dl-de/zero-2-0",
      "pavingAndStreetCourses": "ODbL-1.0",
    },
    "estimateStatus": "Roof collar width/rise, glass hall dimensions, cornice sections, paving elevation/colour and untagged road widths are procedural display estimates. DOP2025 supplies roof organisation, not a new height survey. Original source surfaces and all previous geometry remain.",
    "roofCollar": roof,
    "facadeBands": facade,
    "paving": paving,
    "roads": roads,
    "nativePaving": native,
    "roadIds": [
      r["id"]
      for r in tauentzien["roads"]
      if r["highway"] not in {"footway", "pedestrian", "cycleway", "path"}
    ],
    "sourceReferences": [
      "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
      "https://commons.wikimedia.org/wiki/File:KaDeWe_front.jpg",
      "https://commons.wikimedia.org/wiki/File:U-Bahnhof_Wittenbergplatz_0686.jpg",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066746",
      "https://www.berlin.de/sehenswuerdigkeiten/3559941-3558930-tauentzienstrasse.html",
    ],
  }


def main() -> None:
  payload = make_payload()
  DEST.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      {
        "bytes": DEST.stat().st_size,
        "roofTriangles": len(payload["roofCollar"]),
        "facadeBands": len(payload["facadeBands"]),
        "pavingOwners": len(payload["paving"]),
        "nativePaving": len(payload["nativePaving"]),
      }
    )
  )


if __name__ == "__main__":
  main()
