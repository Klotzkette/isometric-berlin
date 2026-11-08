"""Step 10: finite public sites, complete original sheets and measured park relief.

Only new V326 derivatives are written. Earlier packets and source records stay
immutable. Public photographs guide estimates, never metric building geometry.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
from shapely import make_valid
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import (
  GML_ID,
  NS,
  building_footprint,
  leaf_building_parts,
)
from scripts.build_bebelplatz_building_source import part_profile
from scripts.build_breitscheid_towers_v161 import normal_of, triangles_for
from scripts.build_surrounding_outlines import (
  PackedMesh,
  load_projected_polygon,
  navigation_polygons,
  tags_for,
  world,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/north-east-v326"
SOURCE = GEO / "north-east-public-sites-v326-source.json.gz"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
DATA = ROOT / "src/app/src/data"
KIND = "north-east-public-sites-v326"
BASELINE_MANIFEST = GEO / "public-fidelity-v326-published206-manifest.json.gz"
BASELINE_MANIFEST_SHA256 = (
  "a0e6feb92ff3624360b207472c27b0d5006d389688ba1c78415af32746ba2d0e"
)
SITE_IDS = {
  "rehberge": ("relation", "8027588"),
  "lake": ("way", "4537841"),
  "prison-west": ("way", "4805433"),
  "prison-east": ("way", "4807989"),
  "ploetzensee-memorial": ("way", "759414113"),
}
OLD_BOUNDS = (
  "bounds.geojson",
  "bounds-ring-v182.geojson",
  "bounds-city-v183.geojson",
  "bounds-outskirts-v187.geojson",
  "bounds-north-v190.geojson",
  "bounds-named-v194.geojson",
  "bounds-named-v198.geojson",
  "bounds-east-v200.geojson",
  "bounds-prisons-memorials-v209.geojson",
  "bounds-named-v306.geojson",
)


def read(path: Path) -> Any:
  """Read a complete retained plain or gzip JSON record."""
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: Any) -> None:
  """Write deterministic new derivatives; never rewrite a previous source."""
  raw = (
    json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  ).encode()
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  """Bind the complete input bytes."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def baseline_manifest() -> dict[str, Any]:
  """The complete immutable206 inventory, never our later additions."""
  raw = gzip.decompress(BASELINE_MANIFEST.read_bytes())
  if hashlib.sha256(raw).hexdigest() != BASELINE_MANIFEST_SHA256:
    raise ValueError("Changed immutable published206 source manifest")
  return json.loads(raw)


def osm_id(row: Any) -> str:
  """Keep GDAL's original OSM way/relation identity."""
  return (
    "way/" + row.osm_way_id
    if isinstance(row.osm_way_id, str)
    else "relation/" + str(row.osm_id)
  )


def complete_scope(source: dict[str, Any]) -> Any:
  """Exact named land plus complete admitted parents, never an enclosing buffer."""
  return shape(source["completeNewScope"])


def finish_source(source: dict[str, Any]) -> dict[str, Any]:
  """Keep whole boundary-crossing leaves and audit the original mapped tree points."""
  old = world(
    unary_union(
      [load_projected_polygon(GEO / n) for n in OLD_BOUNDS if (GEO / n).exists()]
    )
  )
  named = unary_union([shape(s["newScope"]) for s in source["sites"]])
  owners = unary_union([shape(p["footprint"]) for p in source["parents"]])
  source["completeNewScope"] = mapping(named.union(owners).difference(old))
  baseline = unary_union(
    [
      make_valid(Polygon(p["ring"], p.get("holes", [])))
      for p in baseline_manifest()["footprint"]
    ]
  )
  if shape(source["completeNewScope"]).intersection(baseline).area > 0:
    raise ValueError("Named new ground overlaps complete published206 coverage")
  source["completeParentOutsideNamed"] = [
    {
      "id": p["id"],
      "geometry": mapping(shape(p["footprint"]).difference(named).difference(old)),
      "areaM2": shape(p["footprint"]).difference(named).difference(old).area,
    }
    for p in source["parents"]
    if shape(p["footprint"]).difference(named).difference(old).area > 0.001
  ]
  trees_path = RAW / "mapped-trees.json"
  if not trees_path.exists():
    pbf = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
    points = gpd.read_file(
      pbf,
      layer="points",
      bbox=(13.300, 52.529, 13.356, 52.563),
      where='other_tags LIKE \'%"natural"=>"tree"%\'',
    ).to_crs(25833)
    points.geometry = points.geometry.map(world)
    records = [
      {
        "id": "node/" + str(r.osm_id),
        "tags": tags_for(r),
        "position": [r.geometry.x, r.geometry.y],
      }
      for _, r in points.iterrows()
      if complete_scope(source).covers(r.geometry)
    ]
    write(
      trees_path,
      {"source": str(pbf.relative_to(ROOT)), "sha256": sha(pbf), "nodes": records},
    )
  source["mappedTreeSource"] = read(trees_path)
  return source


def extract() -> dict[str, Any]:
  """Select complete named sites and all their complete official parent leaves."""
  candidate = GEO / "raw/outskirts-v187/candidate.gpkg"
  bbox = (13.300, 52.529, 13.356, 52.563)
  areas = gpd.read_file(candidate, layer="multipolygons", bbox=bbox).to_crs(25833)
  lines = gpd.read_file(candidate, layer="lines", bbox=bbox).to_crs(25833)
  areas.geometry = areas.geometry.map(world)
  lines.geometry = lines.geometry.map(world)
  old = world(
    unary_union(
      [
        load_projected_polygon(GEO / name)
        for name in OLD_BOUNDS
        if (GEO / name).exists()
      ]
    )
  )
  sites = []
  for key, (kind, identity) in SITE_IDS.items():
    rows = areas[areas["osm_way_id" if kind == "way" else "osm_id"] == identity]
    if len(rows) != 1:
      raise ValueError("Missing or duplicate complete named site " + key)
    row = rows.iloc[0]
    sites.append(
      {
        "key": key,
        "id": kind + "/" + identity,
        "tags": tags_for(row),
        "geometry": mapping(row.geometry),
        "oldScope": mapping(row.geometry.intersection(old)),
        "newScope": mapping(row.geometry.difference(old)),
      }
    )
  scope = unary_union([shape(s["geometry"]) for s in sites])
  parent_rows = []
  archives = [
    GEO / "raw/lod2/LoD2_385_5822.zip",
    GEO / "raw/lod2/LoD2_386_5822.zip",
    RAW / "LoD2_386_5823.zip",
    RAW / "LoD2_386_5824.zip",
    RAW / "LoD2_387_5823.zip",
    GEO / "raw/north-v306/LoD2_387_5824.zip",
  ]
  seen = set()
  for path in archives:
    with zipfile.ZipFile(path) as archive:
      for member in archive.namelist():
        if not member.lower().endswith((".gml", ".xml")):
          continue
        with archive.open(member) as stream:
          for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            identity = element.get(GML_ID)
            footprint = building_footprint(element)
            if footprint is None:
              element.clear()
              continue
            footprint = world(footprint)
            inside = footprint.intersection(scope).area
            if inside < 1 or inside / max(footprint.area, 0.01) < 0.5:
              element.clear()
              continue
            if identity in seen:
              element.clear()
              continue
            seen.add(identity)
            profiles = [
              part_profile(p) for p in leaf_building_parts(element) or [element]
            ]
            site = max(
              sites, key=lambda s: footprint.intersection(shape(s["geometry"])).area
            )["key"]
            parent_rows.append(
              {
                "id": identity,
                "site": site,
                "footprint": mapping(footprint),
                "parts": profiles,
                "archive": path.name,
                "archiveSha256": sha(path),
                "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/" + path.name,
              }
            )
            element.clear()
  land = []
  for _, row in areas.iterrows():
    tags = tags_for(row)
    if row.geometry.intersection(scope).area <= 0.01:
      continue
    if (
      tags.get("natural") in {"water", "wood"}
      or tags.get("landuse") in {"forest", "grass", "meadow"}
      or tags.get("leisure") in {"pitch", "playground", "sports_centre", "garden"}
      or osm_id(row) == "way/1376228645"
    ):
      land.append({"id": osm_id(row), "tags": tags, "geometry": mapping(row.geometry)})
  roads = []
  for _, row in lines.iterrows():
    tags = tags_for(row)
    if tags.get("highway") not in {
      "footway",
      "path",
      "steps",
      "pedestrian",
      "service",
      "cycleway",
    }:
      continue
    if row.geometry.intersection(scope).length < 0.1:
      continue
    roads.append(
      {"id": "way/" + str(row.osm_id), "tags": tags, "geometry": mapping(row.geometry)}
    )
  old_prisons = GEO / "prisons-memorials-v209-source.json"
  return finish_source(
    {
      "schemaVersion": 1,
      "sourceDate": "2026-09-29 retained OSM source",
      "oldPrisonsSource": {
        "path": str(old_prisons.relative_to(ROOT)),
        "sha256": sha(old_prisons),
      },
      "sites": sites,
      "parents": parent_rows,
      "land": land,
      "roads": roads,
      "boundsSources": [
        {"path": name, "sha256": sha(GEO / name)}
        for name in OLD_BOUNDS
        if (GEO / name).exists()
      ],
      "archives": [
        {"file": p.name, "sha256": sha(p), "bytes": p.stat().st_size} for p in archives
      ],
      "estimates": [
        "Public exterior fittings are photo-guided display estimates.",
        "Building coordinates and full wall/roof sheets are original LoD2; no private operational detail is inferred.",
      ],
    }
  )


def terrain(source: dict[str, Any]) -> dict[str, Any]:
  """Retain official eight-metre DGM checkpoints for the exact named footprint."""
  scope = complete_scope(source)
  x0, z0, x1, z1 = scope.bounds
  x0, z0 = math.floor(x0 / 16) * 16 - 16, math.floor(z0 / 16) * 16 - 16
  x1, z1 = math.ceil(x1 / 16) * 16 + 16, math.ceil(z1 / 16) * 16 + 16
  arrays, sources = {}, []
  for p in sorted(RAW.glob("DGM1*.zip")):
    a, b = map(int, p.stem.split("_")[1:])
    with zipfile.ZipFile(p) as archive:
      member = next(n for n in archive.namelist() if n.endswith(".xyz"))
      arrays[a * 1000, b * 1000] = np.loadtxt(
        archive.open(member), usecols=2, dtype=np.float32
      ).reshape(2000, 2000)
    sources.append(
      {"url": "https://gdi.berlin.de/data/dgm1/atom/" + p.name, "sha256": sha(p)}
    )
  values = []
  for z in range(z0, z1 + 1, 8):
    for x in range(x0, x1 + 1, 8):
      east, north = x + 389500, 5820000 - z
      key = math.floor(east / 2000) * 2000, math.floor(north / 2000) * 2000
      if key not in arrays:
        if scope.intersects(box(x - 16, z - 16, x + 16, z + 16)):
          raise ValueError("Unmeasured named terrain checkpoint " + str((x, z)))
        values.append(None)
        continue
      values.append(
        round((float(arrays[key][north - key[1], east - key[0]]) - 30) * 100)
      )
  result = {
    "schemaVersion": 1,
    "step": 8,
    "x0": x0,
    "z0": z0,
    "width": (x1 - x0) // 8 + 1,
    "height": (z1 - z0) // 8 + 1,
    "valuesCm": values,
    "domain": navigation_polygons(scope, 0, 0),
    "sources": sources,
  }
  lake = shape(next(s["geometry"] for s in source["sites"] if s["key"] == "lake"))
  samples = [
    height(result, x, z)
    for x in range(math.ceil(lake.bounds[0] / 16) * 16, math.floor(lake.bounds[2]), 16)
    for z in range(math.ceil(lake.bounds[1] / 16) * 16, math.floor(lake.bounds[3]), 16)
    if lake.contains(Point(x, z))
  ]
  result["lakeY"] = round(float(np.median(samples)), 2)
  result["lake"] = navigation_polygons(lake, 0, 0)
  result["fountainStepsSource"] = next(
    p for p in source["roads"] if p["id"] == "way/360362033"
  )
  result["fountainSteps"] = {
    "drawn": stair_layout(result, False),
    "native": stair_layout(result, True),
  }
  return result


def height(field: dict[str, Any], x: float, z: float, native: bool = False) -> float:
  """Exact represented triangle floors, or independent horizontal terraces."""
  if native:
    x, z = math.floor(x / 16) * 16 + 8, math.floor(z / 16) * 16 + 8
  u, v = (x - field["x0"]) / 8, (z - field["z0"]) / 8
  i, j = math.floor(u), math.floor(v)
  if not (0 <= i < field["width"] - 1 and 0 <= j < field["height"] - 1):
    raise ValueError("Terrain sample escaped measured field")
  a, b, c, d = (
    field["valuesCm"][jj * field["width"] + ii]
    for ii, jj in [(i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1)]
  )
  if any(q is None for q in [a, b, c, d]):
    raise ValueError("Missing terrain sample")
  u, v = u - i, v - j
  return (
    a + (b - a) * u + (c - a) * v
    if u + v <= 1
    else d + (c - d) * (1 - u) + (b - d) * (1 - v)
  ) / 100


def polygons(geometry: Any) -> list[Polygon]:
  """Keep every disconnected part and hole."""
  if geometry.is_empty:
    return []
  return (
    [geometry]
    if isinstance(geometry, Polygon)
    else [p for child in getattr(geometry, "geoms", []) for p in polygons(child)]
  )


def clip_triangle(
  triangle: list[list[float]], bounds: tuple[float, ...]
) -> list[list[list[float]]]:
  """Split a source triangle only on packet boundaries, retaining its winding."""
  points = triangle
  for axis, edge, sign in [
    (0, bounds[0], 1),
    (0, bounds[2], -1),
    (2, bounds[1], 1),
    (2, bounds[3], -1),
  ]:
    clipped = []
    for i, a in enumerate(points):
      b = points[(i + 1) % len(points)]
      da, db = (a[axis] - edge) * sign, (b[axis] - edge) * sign
      if da >= 0:
        clipped.append(a)
      if (da >= 0) != (db >= 0):
        t = da / (da - db)
        clipped.append([a[k] + t * (b[k] - a[k]) for k in range(3)])
    points = clipped
    if len(points) < 3:
      return []
  return [[points[0], points[i], points[i + 1]] for i in range(1, len(points) - 1)]


class SitePackets:
  """One normal source-pinned packet per finite 512-metre site intersection."""

  def __init__(self, native: bool) -> None:
    self.native = native
    self.meshes: dict[tuple[int, int], PackedMesh] = {}
    self.record_solids = False
    self.solids: list[dict[str, Any]] = []

  def triangle(self, triangle: list[list[float]], color: int) -> None:
    """Retain full sheets, including any original vertex on a packet seam."""
    a = np.asarray(triangle)
    if self.record_solids and Polygon([(p[0], p[2]) for p in triangle]).area > 1e-8:
      self.solids.append(
        {
          "ring": [[float(p[0]), float(p[2])] for p in triangle],
          "holes": [],
          "low": float(a[:, 1].min()) - 0.025,
          "high": float(a[:, 1].max()) + 0.025,
        }
      )
    tint = (color >> 16 & 255, color >> 8 & 255, color & 255)
    for tx in range(
      math.floor(a[:, 0].min() / 512), math.floor(a[:, 0].max() / 512) + 1
    ):
      for tz in range(
        math.floor(a[:, 2].min() / 512), math.floor(a[:, 2].max() / 512) + 1
      ):
        bounds = (tx * 512, tz * 512, (tx + 1) * 512, (tz + 1) * 512)
        clipped = clip_triangle(triangle, bounds)
        if not clipped:
          continue
        mesh = self.meshes.setdefault((tx, tz), PackedMesh(tx * 512, tz * 512))
        for tri in clipped:
          mesh.triangle(tri, tint)

  def surface(
    self, geometry: Any, field: dict[str, Any], color: int, lift: float = 0
  ) -> None:
    """Drape complete mapped polygons with measured corners, not a cover plane."""
    from shapely import constrained_delaunay_triangles

    step = 16 if self.native else 8
    for polygon in polygons(geometry):
      x0, z0, x1, z1 = polygon.bounds
      for x in range(math.floor(x0 / step) * step, math.ceil(x1 / step) * step, step):
        for z in range(math.floor(z0 / step) * step, math.ceil(z1 / step) * step, step):
          halves = (
            [box(x, z, x + step, z + step)]
            if self.native
            else [
              Polygon([(x, z), (x + step, z), (x, z + step)]),
              Polygon([(x + step, z + step), (x, z + step), (x + step, z)]),
            ]
          )
          for half in halves:
            local = polygon.intersection(half)
            if local.area < 1e-7:
              continue
            for part in polygons(local):
              for tri in constrained_delaunay_triangles(part).geoms:
                points = [
                  [
                    a,
                    height(field, x + step / 2, z + step / 2, True) + lift
                    if self.native
                    else height(field, a, b) + lift,
                    b,
                  ]
                  for a, b in list(tri.exterior.coords)[:3]
                ]
                if (
                  np.cross(
                    np.subtract(points[1], points[0]), np.subtract(points[2], points[0])
                  )[1]
                  < 0
                ):
                  points.reverse()
                self.triangle(points, color)

  def cuboid(
    self, p: list[float], size: list[float], color: int, yaw: float = 0
  ) -> None:
    """Native callers supply cardinal boxes; Drawn fittings use original planes."""
    sx, sy, sz = (v / 2 for v in size)
    corners = []
    c, s = math.cos(yaw), math.sin(yaw)
    for x, y, z in [
      (-sx, -sy, -sz),
      (sx, -sy, -sz),
      (sx, sy, -sz),
      (-sx, sy, -sz),
      (-sx, -sy, sz),
      (sx, -sy, sz),
      (sx, sy, sz),
      (-sx, sy, sz),
    ]:
      corners.append([p[0] + x * c + z * s, p[1] + y, p[2] - x * s + z * c])
    capture = self.record_solids
    if capture:
      self.solids.append(
        {
          "ring": [[float(corners[i][0]), float(corners[i][2])] for i in [0, 1, 5, 4]],
          "holes": [],
          "low": float(p[1] - sy),
          "high": float(p[1] + sy),
        }
      )
      self.record_solids = False
    for face in [
      (0, 3, 2, 1),
      (4, 5, 6, 7),
      (0, 4, 7, 3),
      (1, 2, 6, 5),
      (3, 7, 6, 2),
      (0, 1, 5, 4),
    ]:
      self.triangle([corners[i] for i in face[:3]], color)
      self.triangle([corners[i] for i in [face[0], face[2], face[3]]], color)
    self.record_solids = capture


def field_surface(out: SitePackets, geometry: Any, y: float, color: int) -> None:
  """Horizontal source water/plinth, retaining exact rings and holes."""
  from shapely import constrained_delaunay_triangles

  for p in polygons(geometry):
    for tri in constrained_delaunay_triangles(p).geoms:
      points = [[x, y, z] for x, z in list(tri.exterior.coords)[:3]]
      if (
        np.cross(np.subtract(points[1], points[0]), np.subtract(points[2], points[0]))[
          1
        ]
        < 0
      ):
        points.reverse()
      out.triangle(points, color)


def native_skins(
  triangles: list[tuple[list[list[float]], int]],
) -> dict[tuple[int, int, int], int]:
  """Independently sample complete original sheets into hollow cardinal skins."""
  cells = {}
  for tri, color in triangles:
    a, b, c = map(np.asarray, tri)
    n = max(
      1,
      math.ceil(
        max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b)) / 0.68
      ),
    )
    for i in range(n + 1):
      js = np.arange(n + 1 - i)[:, None]
      points = a + (b - a) * i / n + (c - a) * js / n
      for q in np.unique(np.floor(points).astype(int), axis=0):
        cells[tuple(map(int, q))] = color
  return cells


def emit_cells(out: SitePackets, cells: dict[tuple[int, int, int], int]) -> None:
  """Merge only exactly identical exposed coplanar cells/colours, retaining holes."""
  from collections import defaultdict

  groups = defaultdict(set)
  for point, color in cells.items():
    for axis in range(3):
      others = [i for i in range(3) if i != axis]
      for sign in [-1, 1]:
        neighbour = list(point)
        neighbour[axis] += sign
        if tuple(neighbour) in cells:
          continue
        plane = point[axis] + (sign == 1)
        groups[axis, sign, plane, color].add((point[others[0]], point[others[1]]))
  for (axis, sign, plane, color), selected in sorted(groups.items()):
    original = selected.copy()
    rectangles = []
    while selected:
      u, v = min(selected, key=lambda p: (p[1], p[0]))
      end = u + 1
      while (end, v) in selected:
        end += 1
      top = v + 1
      while all((x, top) in selected for x in range(u, end)):
        top += 1
      for x in range(u, end):
        for y in range(v, top):
          selected.remove((x, y))
      rectangles.append((u, v, end, top))
    if {
      (x, y) for a, b, c, d in rectangles for x in range(a, c) for y in range(b, d)
    } != original:
      raise ValueError("Native rectangle lost or filled an original surface cell")
    others = [i for i in range(3) if i != axis]
    for a, b, c, d in rectangles:
      points = []
      for u, v in [(a, b), (c, b), (c, d), (a, d)]:
        point = [0, 0, 0]
        point[axis], point[others[0]], point[others[1]] = plane, u, v
        points.append(point)
      if (
        np.cross(np.subtract(points[1], points[0]), np.subtract(points[2], points[0]))[
          axis
        ]
        * sign
        < 0
      ):
        points.reverse()
      out.triangle(points[:3], color)
      out.triangle([points[0], points[2], points[3]], color)


def stair_layout(field: dict[str, Any], native: bool) -> list[dict[str, Any]]:
  """Actual eight-step course; tread width/sections remain display estimates."""
  record = field["fountainStepsSource"]
  points = list(shape(record["geometry"]).coords)
  a, b = np.asarray(points[0]), np.asarray(points[-1])
  direction = (a - b) / np.linalg.norm(a - b)
  tangent = np.asarray([-direction[1], direction[0]])
  count = int(record["tags"]["step_count"])
  length = float(np.linalg.norm(a - b))
  result = []
  for i in range(count):
    p = b + (a - b) * (i + 0.5) / count
    width, depth = 8.0, length / count
    yaw = math.atan2(-tangent[1], tangent[0])
    if native:
      tangent, direction = np.asarray([0, 1]), np.asarray([-1, 0])
      yaw = math.pi / 2
    corners = [
      [
        float(p[0] + tangent[0] * u + direction[0] * v),
        float(p[1] + tangent[1] * u + direction[1] * v),
      ]
      for u, v in [
        (-width / 2, -depth / 2),
        (width / 2, -depth / 2),
        (width / 2, depth / 2),
        (-width / 2, depth / 2),
      ]
    ]
    top = max(height(field, x, z, native) for x, z in corners) + 0.025
    result.append(
      {
        "p": [float(p[0]), top - 0.075, float(p[1])],
        "size": [width, 0.15, depth],
        "yaw": yaw,
        "top": top,
        "ring": corners + [corners[0]],
        "holes": [],
      }
    )
  return result


def fountain(
  out: SitePackets, field: dict[str, Any], record: dict[str, Any]
) -> dict[str, Any]:
  """Kolbe/Haacke's screw silhouette, bowl, approach steps and paired reliefs."""
  fp = shape(record["geometry"])
  x, z = fp.centroid.x, fp.centroid.y
  y = height(field, x, z, out.native)
  bronze, stone = 0x56634E, 0xC1BAA5
  out.record_solids = True
  # Three full revolutions widen upwards; exact small sections are estimates.
  if out.native:
    sculpture = {}
    for ix in range(-12, 13):
      for iz in range(-12, 13):
        radius = math.hypot(ix / 4, iz / 4)
        if 2.65 < radius < 3.1:
          out.cuboid([x + ix / 4, y + 0.55, z + iz / 4], [0.25, 0.45, 0.25], bronze)
        for iy in range(16):
          h = iy / 4
          angle = math.atan2(iz, ix)
          screw_radius = 0.65 + h * 0.42
          phase = (angle / (2 * math.pi) - h * 0.75) % 1
          if radius <= 0.45 or radius < screw_radius and min(phase, 1 - phase) < 0.095:
            sculpture[ix, iy, iz] = True
    for ix, iy, iz in sculpture:
      out.cuboid(
        [x + ix / 4, y + 1.05 + iy / 4, z + iz / 4], [0.25, 0.25, 0.25], bronze
      )
  else:
    for j in range(64):
      a, b = j * math.tau / 64, (j + 1) * math.tau / 64
      q = [
        [x + radius * math.cos(t), y + level, z + radius * math.sin(t)]
        for radius, level, t in [
          (2.65, 0.6, a),
          (3, 0.74, a),
          (3, 0.74, b),
          (2.65, 0.6, b),
        ]
      ]
      out.triangle(q[:3], bronze)
      out.triangle([q[0], q[2], q[3]], bronze)
    for j in range(192):
      a, b = j / 192, (j + 1) / 192
      points = []
      for t, inner in [(a, True), (a, False), (b, False), (b, True)]:
        h = t * 4
        radius = 0.32 if inner else 0.65 + h * 0.42
        angle = t * 3 * math.tau
        points.append(
          [x + radius * math.cos(angle), y + 0.85 + h, z + radius * math.sin(angle)]
        )
      out.triangle(points[:3], bronze)
      out.triangle([points[0], points[2], points[3]], bronze)
    out.cuboid([x, y + 2.45, z], [0.48, 3.9, 0.48], bronze)
  # Actual source steps lie east of the basin, on the Carl-Leid-Weg approach.
  layout = field["fountainSteps"]["native" if out.native else "drawn"]
  for step in layout:
    if out.native:
      out.cuboid(step["p"], [step["size"][2], step["size"][1], step["size"][0]], stone)
    else:
      out.cuboid(step["p"], step["size"], stone, step["yaw"])
  last = layout[-1]
  for side in [-1, 1]:
    point = last["ring"][0 if side == -1 else 1]
    px, pz = point
    out.cuboid([px, last["top"] + 0.8, pz], [0.65, 1.6, 0.6], stone)
    out.cuboid([px + 0.34, last["top"] + 1.15, pz], [0.035, 0.56, 0.42], bronze)
  out.record_solids = False
  field.setdefault("fountainSolids", {})["native" if out.native else "drawn"] = (
    out.solids
  )
  return {
    "sourceId": record["id"],
    "anchor": [x, y, z],
    "bowlDiameterM": 6,
    "spiralHeightM": 4,
    "waterRunning": False,
    "stepsSource": field["fountainStepsSource"]["id"],
    "stepCount": len(layout),
    "smallSections": "Photo-guided estimates; no survey or current running-water claim",
  }


def body_triangles(source: dict[str, Any]) -> list[tuple[list[list[float]], int]]:
  """Every original measured wall and roof from every selected complete leaf."""
  result = []
  for owner in source["parents"]:
    for part in owner["parts"]:
      for surface in part["surfaces"]:
        color = (
          0x8E7264
          if surface["kind"] == "RoofSurface"
          else 0xA46E55
          if owner["site"].startswith("prison")
          else 0xB3A58E
        )
        result.extend((t, color) for t in triangles_for(surface["rings"]))
  return result


def tree(out: SitePackets, x: float, y: float, z: float, index: int) -> None:
  """Illustrative woodland crowns only inside mapped woods, away from sources."""
  h, radius = 8 + index % 5 * 0.6, 3.0 + index % 3 * 0.25
  out.cuboid([x, y + h / 2, z], [0.38, h, 0.38], 0x716653)
  if out.native:
    out.cuboid([x, y + h, z], [5.5, 4.5, 5.5], 0x577849)
    out.cuboid([x, y + h + 2.5, z], [3.5, 1.5, 3.5], 0x638652)
  else:
    ring = [
      [
        x + radius * math.cos(j * math.tau / 8),
        y + h,
        z + radius * math.sin(j * math.tau / 8),
      ]
      for j in range(8)
    ]
    for j in range(8):
      out.triangle([ring[j], ring[(j + 1) % 8], [x, y + h + 4, z]], 0x5F814E)
      out.triangle([ring[(j + 1) % 8], ring[j], [x, y + h - 2.5, z]], 0x4D7042)


def terrain_skirts(out: SitePackets, scope: Any, field: dict[str, Any]) -> None:
  """Close only the exact shared edges of neighbouring Native terraces."""
  from shapely.geometry import LineString

  def lines(g: Any) -> list[Any]:
    return (
      [g]
      if g.geom_type == "LineString"
      else [p for q in getattr(g, "geoms", []) for p in lines(q)]
    )

  x0, z0, x1, z1 = scope.bounds
  for axis in [0, 1]:
    a0, a1, b0, b1 = (x0, x1, z0, z1) if axis == 0 else (z0, z1, x0, x1)
    for a in range(math.ceil(a0 / 16) * 16, math.floor(a1 / 16) * 16 + 1, 16):
      for b in range(math.floor(b0 / 16) * 16, math.ceil(b1 / 16) * 16, 16):
        p, q = (a, b), (a, b + 16)
        if axis == 1:
          p, q = p[::-1], q[::-1]
        segment = LineString([p, q]).intersection(scope)
        if segment.is_empty:
          continue
        y0 = height(
          field, a - 8 if axis == 0 else b + 8, b + 8 if axis == 0 else a - 8, True
        )
        y1 = height(
          field, a + 8 if axis == 0 else b + 8, b + 8 if axis == 0 else a + 8, True
        )
        if abs(y0 - y1) < 0.01:
          continue
        for line in lines(segment):
          if line.length < 0.01:
            continue
          for p, q in zip(line.coords, list(line.coords)[1:]):
            out.triangle(
              [[p[0], y0, p[1]], [q[0], y0, q[1]], [q[0], y1, q[1]]], 0x7D9570
            )
            out.triangle(
              [[p[0], y0, p[1]], [q[0], y1, q[1]], [p[0], y1, p[1]]], 0x7D9570
            )


def build_new_packets(source: dict[str, Any], field: dict[str, Any]) -> dict[str, Any]:
  """New-only mapped park/lake/prison packets; previous public files stay exact."""
  scope = complete_scope(source)
  water = unary_union(
    [
      shape(q["geometry"])
      for q in source["land"]
      if q["tags"].get("natural") == "water"
    ]
  )
  woods = unary_union(
    [
      shape(q["geometry"])
      for q in source["land"]
      if q["tags"].get("natural") == "wood" or q["tags"].get("landuse") == "forest"
    ]
  ).intersection(scope)
  building_union = unary_union([shape(p["footprint"]) for p in source["parents"]])
  roads = []
  for row in source["roads"]:
    try:
      width = float(row["tags"].get("width", "2.4").split()[0])
    except ValueError:
      width = 2.4
    roads.append(shape(row["geometry"]).buffer(width / 2, cap_style=2, join_style=2))
  road_union = unary_union(roads).intersection(scope).difference(water)
  fountain_record = next(q for q in source["land"] if q["id"] == "way/1376228645")
  reserved = (
    road_union.buffer(3)
    .union(water.buffer(5))
    .union(building_union.buffer(5))
    .union(shape(fountain_record["geometry"]).buffer(5))
  )
  trees = [p["position"] for p in source["mappedTreeSource"]["nodes"]]
  mapped_tree_count = len(trees)
  mapped_exclusion = unary_union([Point(*p).buffer(8) for p in trees])
  for x in range(math.floor(woods.bounds[0] / 22) * 22, math.ceil(woods.bounds[2]), 22):
    for z in range(
      math.floor(woods.bounds[1] / 22) * 22, math.ceil(woods.bounds[3]), 22
    ):
      px, pz = x + 4 * math.sin(x * 19 + z), z + 4 * math.cos(z * 17 + x)
      if (
        woods.covers(Point(px, pz))
        and not reserved.covers(Point(px, pz))
        and not mapped_exclusion.covers(Point(px, pz))
      ):
        trees.append([px, pz])
  field["trees"] = [
    {
      "x": x,
      "z": z,
      "drawnY": height(field, x, z),
      "nativeY": height(field, x, z, True),
      "height": 8 + i % 5 * 0.6,
    }
    for i, (x, z) in enumerate(trees)
  ]
  original = body_triangles(source)
  native, native_columns = {}, {}
  for parent in source["parents"]:
    own = native_skins(body_triangles({"parents": [parent]}))
    native.update(own)
    columns = {}
    for x, y, z in own:
      low, high = columns.get((x, z), (y, y + 1))
      columns[x, z] = min(low, y), max(high, y + 1)
    native_columns[parent["id"]] = columns
  prison_boundary = unary_union(
    [shape(s["geometry"]) for s in source["sites"] if s["key"].startswith("prison")]
  ).boundary
  public_prisons = {
    "owners": [
      {
        **p,
        "site": "hq",
        "displayOffsetY": 0,
        "displayGroundY": min(q["ground_y_m"] for q in p["parts"]),
      }
      for p in source["parents"]
      if p["site"].startswith("prison")
    ]
  }
  public_fronts = {}
  descriptors: dict[tuple[int, int], dict[str, Any]] = {}
  for block in [False, True]:
    out = SitePackets(block)
    out.surface(scope.difference(water).difference(woods), field, 0xA1B58B)
    out.surface(woods.difference(water), field, 0x879F75)
    out.surface(road_union, field, 0xB8AE96, 0.09)
    lake = shape(next(s["geometry"] for s in source["sites"] if s["key"] == "lake"))
    field_surface(out, lake, field["lakeY"], 0x638E94)
    if block:
      terrain_skirts(out, scope.difference(water), field)
      emit_cells(out, native)
    else:
      for tri, tint in original:
        out.triangle(tri, tint)
    public_fronts["native" if block else "drawn"] = (
      headquarters_native(out, public_prisons, {}, set(native), prison_boundary)
      if block
      else headquarters_drawn(out, public_prisons, prison_boundary)
    )
    for i, (x, z) in enumerate(trees):
      tree(out, x, height(field, x, z, block), z, i)
    fountain_proof = fountain(out, field, fountain_record)
    for (tx, tz), mesh in sorted(out.meshes.items()):
      key = f"northEast326-{tx}_{tz}"
      origin_x, origin_z = tx * 512, tz * 512
      tile = box(origin_x, origin_z, origin_x + 512, origin_z + 512)
      ground = scope.intersection(tile)
      part = mesh.payload(KIND)
      if part is None:
        continue
      if len(mesh.vertices) > 400000 or len(mesh.indices) > 2400000:
        raise ValueError("Finite named packet exceeds existing decoder budget")
      nav_buildings = []
      for parent in source["parents"]:
        columns = native_columns[parent["id"]]
        fp = (
          unary_union([box(x, z, x + 1, z + 1) for x, z in columns])
          if block
          else shape(parent["footprint"])
        ).intersection(tile)
        if fp.area < 0.01:
          continue
        low = (
          min(v[0] for v in columns.values())
          if block
          else min(p["ground_y_m"] for p in parent["parts"])
        )
        high = (
          max(v[1] for v in columns.values())
          if block
          else max(p["top_y_m"] for p in parent["parts"])
        )
        roofs = [
          [[q[0] - origin_x, q[1] - low, q[2] - origin_z] for q in tri]
          for p in parent["parts"]
          for s in p["surfaces"]
          if s["kind"] == "RoofSurface"
          for tri in triangles_for(s["rings"])
        ]
        for p in navigation_polygons(fp, origin_x, origin_z):
          caps = (
            [
              [
                x - origin_x,
                z - origin_z,
                x + 1 - origin_x,
                z + 1 - origin_z,
                top - low,
              ]
              for (x, z), (_, top) in columns.items()
              if tile.intersects(box(x, z, x + 1, z + 1))
            ]
            if block
            else []
          )
          nav_buildings.append(
            {
              **p,
              "sourceId": parent["id"],
              "minHeight": 0,
              "height": high - low,
              "groundOffset": low - 3,
              **({"nativeRoofCaps": caps} if block else {"roofTriangles": roofs}),
            }
          )
      packet = {
        "schemaVersion": 1,
        "origin": [origin_x, -10, origin_z],
        "meshes": [part],
        "nav": {
          "ground": navigation_polygons(ground.difference(water), origin_x, origin_z),
          "water": navigation_polygons(water.intersection(tile), origin_x, origin_z),
          "roads": navigation_polygons(
            road_union.intersection(tile), origin_x, origin_z
          ),
          "buildings": nav_buildings,
          "groundY": 3,
        },
      }
      mode = "minecraft" if block else "drawn"
      path = PUBLIC / f"{key}.{mode}.json.gz"
      write(path, packet)
      descriptor = descriptors.setdefault(
        (tx, tz),
        {"id": key, "bounds": list(tile.bounds), "buildingCount": len(nav_buildings)},
      )
      descriptor[mode] = {
        "url": path.name,
        "bytes": path.stat().st_size,
        "decodedBytes": len(gzip.decompress(path.read_bytes())),
        "encoding": "gzip",
        "sha256": sha(path),
      }
  write(GEO / "ploetzensee-public-fronts-v326-evidence.json.gz", public_fronts)
  return {
    "schemaVersion": 1,
    "chunks": list(descriptors.values()),
    "footprint": navigation_polygons(scope, 0, 0),
    "sourceSha256": sha(SOURCE),
    "trees": len(trees),
    "mappedTrees": mapped_tree_count,
    "illustrativeWoodlandTrees": len(trees) - mapped_tree_count,
    "sourceTriangles": len(original),
    "nativeSurfaceCells": len(native),
    "fountain": fountain_proof,
  }


def fitting(
  out: SitePackets,
  center: np.ndarray,
  tangent: np.ndarray,
  normal: np.ndarray,
  width: float,
  h: float,
  tint: int,
) -> None:
  """A complete pane, separate white reveals, sill and central mullion."""
  yaw = 0 if out.native else math.atan2(-tangent[2], tangent[0])
  for u, dy, w, high, depth, offset, color in [
    (0, 0, width, h, 0.08, 0.08, 0x607679),
    (-width / 2, 0, 0.07, h + 0.14, 0.12, 0.15, tint),
    (width / 2, 0, 0.07, h + 0.14, 0.12, 0.15, tint),
    (0, -h / 2, width + 0.14, 0.09, 0.19, 0.18, tint),
    (0, h / 2, width + 0.14, 0.07, 0.12, 0.15, tint),
    (0, 0, 0.055, h, 0.09, 0.17, tint),
  ]:
    p = center + tangent * u + normal * offset
    p[1] += dy
    size = (
      [w, high, depth] if not out.native or abs(normal[2]) > 0.5 else [depth, high, w]
    )
    out.cuboid(p.tolist(), size, color, yaw)


def headquarters_drawn(
  out: SitePackets, old: dict[str, Any], public_boundary: Any = None
) -> dict[str, Any]:
  """Only previously blank HQ parents; all four existing authored fronts stay."""
  protected = {
    "DEBE11YYI00001A0",
    "DEBE11YYI00001PT",
    "DEBE11YYI0000MqA",
    "DEBE11YYI0000O2G",
  }
  owners = [p for p in old["owners"] if p["site"] == "hq"]
  footprints = [shape(p["footprint"]) for p in owners]
  windows = []
  for owner_index, owner in enumerate(owners):
    if owner["id"] in protected:
      continue
    fp = footprints[owner_index]
    for part in owner["parts"]:
      for sheet_index, sheet in enumerate(part["surfaces"]):
        if sheet["kind"] != "WallSurface":
          continue
        rings = [
          [[x, y + owner["displayOffsetY"], z] for x, y, z in r] for r in sheet["rings"]
        ]
        n = normal_of(rings[0])
        if abs(n[1]) > 0.015:
          continue
        a, b = max(
          ((a, b) for a in rings[0] for b in rings[0]),
          key=lambda q: math.hypot(q[1][0] - q[0][0], q[1][2] - q[0][2]),
        )
        a, b = np.asarray(a), np.asarray(b)
        d = b - a
        d[1] = 0
        length = float(np.linalg.norm(d))
        if length < 3.5:
          continue
        d /= length
        n = np.asarray([d[2], 0, -d[0]])
        midpoint = (a + b) / 2
        if fp.covers(Point(midpoint[0] + n[0] * 0.2, midpoint[2] + n[2] * 0.2)):
          n *= -1
        planar = [
          [(float(np.dot(np.subtract(v, a), d)), v[1]) for v in ring] for ring in rings
        ]
        wall = Polygon(planar[0], planar[1:]).buffer(-0.12)
        if wall.is_empty:
          continue
        low, high = wall.bounds[1], wall.bounds[3]
        if high - low < 4.0:
          continue
        bays = max(1, round(length / 2.8))
        ground_y = owner.get("displayGroundY", 3)
        for floor in range(max(1, math.ceil((high - ground_y) / 3.15))):
          y = ground_y + 2.0 + floor * 3.15
          for bay in range(bays):
            u, width = (bay + 0.5) * length / bays, min(1.35, length / bays * 0.66)
            rectangle = box(
              u - width / 2 - 0.12, y - 0.95, u + width / 2 + 0.12, y + 0.95
            )
            if not wall.covers(rectangle):
              continue
            p = a + d * u
            p[1] = y
            if (
              public_boundary is not None
              and public_boundary.distance(Point(p[0], p[2])) > 55
            ):
              continue
            if any(
              j != owner_index and q.covers(Point(p[0] + n[0] * 0.6, p[2] + n[2] * 0.6))
              for j, q in enumerate(footprints)
            ):
              continue
            fitting(out, p, d, n, width, 1.65, 0xD8D5C8)
            windows.append(
              {
                "owner": owner["id"],
                "part": part["id"],
                "sheet": sheet_index,
                "u": u,
                "y": y,
                "width": width,
                "wall": mapping(wall),
                "rectangle": list(rectangle.bounds),
              }
            )
  return {"windows": windows, "protectedParents": sorted(protected)}


def headquarters_native(
  out: SitePackets,
  old: dict[str, Any],
  envelopes: dict[str, Any],
  supplied_cells: set[tuple[int, int, int]] | None = None,
  public_boundary: Any = None,
) -> dict[str, Any]:
  """Independent bays on complete exposed one-metre retained Native wall faces."""
  from collections import defaultdict

  from shapely import STRtree
  from shapely.ops import unary_union

  protected = {
    "DEBE11YYI00001A0",
    "DEBE11YYI00001PT",
    "DEBE11YYI0000MqA",
    "DEBE11YYI0000O2G",
  }
  owners = [p for p in old["owners"] if p["site"] == "hq" and p["id"] not in protected]
  footprints = [shape(p["footprint"]) for p in owners]
  tree_index = STRtree([p.boundary for p in footprints])
  cells = set() if supplied_cells is None else supplied_cells
  for r in envelopes.get("envelopeBlocks", []):
    if r[0] < 0 or r[2] < 0:
      continue
    for x in range(round(r[0] - r[3] / 2), round(r[0] + r[3] / 2)):
      for y in range(round(r[1] - r[4] / 2), round(r[1] + r[4] / 2)):
        for z in range(round(r[2] - r[5] / 2), round(r[2] + r[5] / 2)):
          cells.add((x, y, z))
  faces = defaultdict(list)
  for x, y, z in sorted(cells):
    for axis, sign in [(0, -1), (0, 1), (2, -1), (2, 1)]:
      q = [x, y, z]
      q[axis] += sign
      if tuple(q) in cells:
        continue
      plane = (x if axis == 0 else z) + (sign == 1)
      u = z if axis == 0 else x
      point = Point(plane, u + 0.5) if axis == 0 else Point(u + 0.5, plane)
      if public_boundary is not None and public_boundary.distance(point) > 55:
        continue
      indices, distances = tree_index.query_nearest(
        point, max_distance=1.45, return_distance=True
      )
      if len(indices) != 1:
        continue
      owner, distance = int(indices[0]), float(distances[0])
      if distance > 1.45:
        continue
      nx, nz = (sign, 0) if axis == 0 else (0, sign)
      if footprints[owner].covers(
        Point(point.x + nx * 1.6, point.y + nz * 1.6)
      ) or not footprints[owner].covers(Point(point.x - nx * 1.6, point.y - nz * 1.6)):
        continue
      faces[owner, axis, sign, plane].append(box(u, y, u + 1, y + 1))
  windows = []
  for (owner, axis, sign, plane), rectangles in faces.items():
    support = unary_union(rectangles)
    low_u, low_y, high_u, high_y = support.bounds
    n = np.asarray([sign, 0, 0] if axis == 0 else [0, 0, sign])
    d = np.asarray([0, 0, 1] if axis == 0 else [1, 0, 0])
    for y in np.arange(owners[owner].get("displayGroundY", 3) + 2.0, high_y, 3.15):
      for u in np.arange(math.ceil(low_u / 2.8) * 2.8, high_u, 2.8):
        rectangle = box(u - 0.7, y - 0.9, u + 0.7, y + 0.9)
        if not support.covers(rectangle):
          continue
        p = np.asarray([plane, y, u] if axis == 0 else [u, y, plane])
        fitting(out, p, d, n, 1.2, 1.55, 0xD8D5C8)
        windows.append(
          {
            "owner": owners[owner]["id"],
            "axis": axis,
            "sign": sign,
            "plane": plane,
            "rectangle": list(rectangle.bounds),
          }
        )
  return {"windows": windows, "actualRetainedWallCells": len(cells)}


def memorial_crossbars(
  out: SitePackets, old_detail: dict[str, Any], old: dict[str, Any]
) -> int:
  """Borrow existing complete panes; add only missing horizontal lattice members."""
  rows = old_detail["blocks" if out.native else "boxes"]
  evidence = read(GEO / "prisons-memorials-v209-evidence.json")
  normals = {}
  for window in evidence["windows"]:
    face = evidence["faces"][window["face"]]
    if old["owners"][face["owner"]]["site"] != "hsh":
      continue
    a, d, n = (np.asarray(face[k]) for k in ["a", "direction", "outward"])
    p = a + d * window["along"] + n * (0.18 + (1.05 if out.native else 0))
    p[1] = window["y"]
    normals[tuple(round(float(x), 4) for x in p)] = n
  count = 0
  for r in rows:
    if r[7 if out.native else 8] != "hsh" or r[6 if out.native else 7] != 0x597276:
      continue
    key = tuple(r[:3])
    if key not in normals:
      raise ValueError("Original HSH pane has no complete wall/window receipt")
    p = np.asarray(r[:3]) + normals[key] * 0.24
    # Pane coordinates, bay/storey locations and all existing bars remain exact.
    if out.native:
      normal_axis = 2 if r[3] > r[5] else 0
      for dy in [-0.66, -0.44, -0.22, 0, 0.22, 0.66]:
        size = [r[3], 0.035, 0.055] if normal_axis == 2 else [0.055, 0.035, r[5]]
        out.cuboid([float(p[0]), float(p[1]) + dy, float(p[2])], size, 0x979D8D)
        count += 1
    else:
      for dy in [-0.66, -0.44, -0.22, 0, 0.22, 0.66]:
        out.cuboid(
          [float(p[0]), float(p[1]) + dy, float(p[2])],
          [r[3], 0.035, 0.055],
          0x979D8D,
          r[6],
        )
        count += 1
  return count


def fnv(text: str) -> int:
  """The existing complete exact packet string fingerprint."""
  value = 2166136261
  for char in text:
    value = ((value ^ ord(char)) * 16777619) & 0xFFFFFFFF
  return value


def build_existing_additions() -> dict[str, Any]:
  """Append-only recipes; all old source body/roof/fitting words remain intact."""
  old = read(GEO / "prisons-memorials-v209-source.json")
  old_detail = read(DATA / "prisonsMemorialsV209.json")
  envelopes = read(DATA / "prisonsMemorialsV209Envelopes.json")
  plans, audit = {}, {}
  for native in [False, True]:
    out = SitePackets(native)
    hq = (
      headquarters_native(out, old, envelopes)
      if native
      else headquarters_drawn(out, old)
    )
    crossbars = memorial_crossbars(out, old_detail, old)
    audit["native" if native else "drawn"] = {
      "hq": hq,
      "hshNewHorizontalBars": crossbars,
    }
    for (tx, tz), mesh in out.meshes.items():
      identity = (
        "outer187-15_1"
        if tx == 15 and tz == 1
        else "east200-17_-5"
        if tx == 17 and tz == -5
        else None
      )
      if identity is None:
        raise ValueError("New fitting escaped actual complete original packet")
      mode = "minecraft" if native else "drawn"
      raw = read(PUBLIC / f"{identity}.{mode}.json.gz")
      append = mesh.payload(KIND)
      records = [
        {
          "mesh": i,
          "kind": p["kind"],
          "fingerprint": fnv(p["positions"] + p["colors"] + p["indices"]),
        }
        for i, p in enumerate(raw["meshes"])
      ]
      plans[f"{mode}:{identity}"] = {
        "origin": raw["origin"],
        "records": records,
        "preparedRecords": records,
        "navGuard": 0,
        "preparedNavGuard": 0,
        "lineGuard": None,
        "preparedLineGuard": None,
        "append": append,
        "appendFingerprint": fnv(
          append["positions"] + append["colors"] + append["indices"]
        ),
        "retire": [],
        "retireLines": [],
        "retireNav": [],
        "appendNav": [],
        "owners": [
          p["id"] for p in old["owners"] if p["site"] == ("hq" if tx == 15 else "hsh")
        ],
      }
  write(
    DATA / "northEastPublicSitesV326Packets.json",
    {"schemaVersion": 1, "keys": sorted(plans), "packets": plans},
  )
  return audit


def main() -> None:
  """Extract only the finite named-source record in the first implementation step."""
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  parser.add_argument("--build", action="store_true")
  args = parser.parse_args()
  if args.extract:
    source = extract()
    write(SOURCE, source)
    print(
      json.dumps(
        {
          "parents": len(source["parents"]),
          "parts": sum(len(p["parts"]) for p in source["parents"]),
          "sites": [
            {"key": s["key"], "newM2": shape(s["newScope"]).area}
            for s in source["sites"]
          ],
        }
      )
    )
  if args.build:
    source = read(SOURCE)
    field = terrain(source)
    write(DATA / "northEastPublicSitesV326Terrain.json", field)
    index = build_new_packets(source, field)
    write(DATA / "northEastPublicSitesV326Terrain.json", field)
    write(DATA / "northEastPublicSitesV326Index.json", index)
    proof = build_existing_additions()
    write(GEO / "north-east-public-sites-v326-facades.json.gz", proof)
    print(
      json.dumps(
        {
          "chunks": len(index["chunks"]),
          "trees": index["trees"],
          "sourceTriangles": index["sourceTriangles"],
          "nativeSurfaceCells": index["nativeSurfaceCells"],
          "newPacketWireBytes": sum(
            d[m]["bytes"] for d in index["chunks"] for m in ["drawn", "minecraft"]
          ),
          "facadeWindows": {m: len(p["hq"]["windows"]) for m, p in proof.items()},
        }
      )
    )


if __name__ == "__main__":
  main()
