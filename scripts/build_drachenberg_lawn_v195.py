"""Step 10: restore only the omitted mapped Drachenberg lawn and crossing path."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import shapely
from build_surrounding_outlines import road_width_m, road_width_source, tags_for
from build_teufelsberg_terrain_v195 import DATA as FIELD_PATH
from build_teufelsberg_terrain_v195 import offset_at
from pyproj import Transformer
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
CACHE = GEO / "raw/outskirts-v187/candidate.gpkg"
DATA = ROOT / "src/app/src/data/drachenbergLawnV195.json"
EVIDENCE = GEO / "drachenberg-lawn-v195-evidence.json"
SCOPE_FILES = (
  "bounds.geojson",
  "bounds-ring-v182.geojson",
  "bounds-city-v183.geojson",
  "bounds-outskirts-v187.geojson",
  "bounds-north-v190.geojson",
  "bounds-named-v194.geojson",
)
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
UNPROJECT = Transformer.from_crs(25833, 4326, always_xy=True).transform
COLORS = {"lawn": [51, 90, 36], "path": [149, 131, 92]}


def encode(value: object) -> bytes:
  return (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


def world(geometry: shapely.Geometry) -> shapely.Geometry:
  return transform(lambda x, y, z=None: (x - 389500, 5820000 - y), geometry)


def projected(geometry: shapely.Geometry) -> shapely.Geometry:
  return transform(lambda x, z, y=None: (x + 389500, 5820000 - z), geometry)


def polygons(geometry: shapely.Geometry) -> list[Polygon]:
  if geometry.is_empty:
    return []
  if geometry.geom_type == "Polygon":
    return [geometry]
  return [part for g in getattr(geometry, "geoms", []) for part in polygons(g)]


def footprint(geometry: shapely.Geometry) -> list[dict]:
  return [
    {
      "ring": [list(p) for p in g.exterior.coords[:-1]],
      "holes": [[list(p) for p in ring.coords[:-1]] for ring in g.interiors],
    }
    for g in polygons(geometry)
  ]


def faces(geometry: shapely.Geometry) -> list[np.ndarray]:
  return [
    np.asarray(list(triangle.exterior.coords)[:3])
    for polygon in polygons(geometry)
    for triangle in shapely.constrained_delaunay_triangles(polygon).geoms
    if triangle.area > 1e-8
  ]


def surface_triangles(
  geometry: shapely.Geometry, baseline: float, native: bool
) -> list[np.ndarray]:
  """Clip complete source courses to the common 8 m planes or terrace cells."""
  w, n, e, s = geometry.bounds
  result = []
  for z in range(math.floor(n / 8) * 8, math.ceil(s / 8) * 8, 8):
    for x in range(math.floor(w / 8) * 8, math.ceil(e / 8) * 8, 8):
      cell = geometry.intersection(box(x, z, x + 8, z + 8))
      cuts = (
        [cell]
        if native
        else [
          cell.intersection(Polygon([(x, z), (x + 8, z), (x + 8, z + 8)])),
          cell.intersection(Polygon([(x, z), (x + 8, z + 8), (x, z + 8)])),
        ]
      )
      for cut in cuts:
        for triangle in faces(cut):
          points = np.asarray(
            [
              [
                px,
                baseline + offset_at(x + 4, z + 4)
                if native
                else baseline + offset_at(px, pz),
                pz,
              ]
              for px, pz in triangle
            ]
          )
          if np.cross(points[1] - points[0], points[2] - points[0])[1] < 0:
            points = points[::-1]
          result.append(points)
  if native:
    # One wall per crossed grid edge, exactly clipped to the added source area.
    for axis, start, end, low, high in [(0, w, e, n, s), (2, n, s, w, e)]:
      for edge in range(math.ceil(start / 8) * 8, math.floor(end / 8) * 8 + 1, 8):
        for along in range(math.floor(low / 8) * 8, math.ceil(high / 8) * 8, 8):
          a, b = (
            ((edge, along), (edge, along + 8))
            if axis == 0
            else ((along, edge), (along + 8, edge))
          )
          line = LineString([a, b]).intersection(geometry)
          pieces = (
            [line]
            if line.geom_type == "LineString"
            else list(getattr(line, "geoms", []))
          )
          centres = (
            [(edge - 4, along + 4), (edge + 4, along + 4)]
            if axis == 0
            else [(along + 4, edge - 4), (along + 4, edge + 4)]
          )
          heights = [baseline + offset_at(x, z) for x, z in centres]
          if abs(heights[0] - heights[1]) < 1e-8:
            continue
          for piece in pieces:
            if piece.geom_type != "LineString" or piece.length < 1e-8:
              continue
            for a, b in zip(
              list(piece.coords)[:-1], list(piece.coords)[1:], strict=True
            ):
              p = np.asarray(
                [
                  [a[0], min(heights), a[1]],
                  [b[0], min(heights), b[1]],
                  [b[0], max(heights), b[1]],
                  [a[0], max(heights), a[1]],
                ]
              )
              result.extend([p[[0, 1, 2]], p[[0, 2, 3]]])
  return result


def build() -> dict:
  """Use retained OSM records; never rewrite any old terrain or source scope."""
  lawn_frame = gpd.read_file(
    CACHE, layer="multipolygons", where="osm_way_id = '15700939'"
  )
  path_frame = gpd.read_file(CACHE, layer="lines", where="osm_id = '185585685'")
  assert len(lawn_frame) == len(path_frame) == 1
  lawn = lawn_frame.to_crs(25833).geometry.iloc[0]
  route = path_frame.to_crs(25833).geometry.iloc[0]
  lawn_tags, path_tags = tags_for(lawn_frame.iloc[0]), tags_for(path_frame.iloc[0])
  assert lawn_tags["landuse"] == "grass" and path_tags["highway"] == "path"
  old_scopes, scope_records = [], []
  for name in SCOPE_FILES:
    raw = (GEO / name).read_bytes()
    old_scopes.extend(
      transform(PROJECT, shape(f["geometry"])) for f in json.loads(raw)["features"]
    )
    scope_records.append({"path": name, "sha256": hashlib.sha256(raw).hexdigest()})
  old = unary_union(old_scopes)
  missing = lawn.difference(old)
  assert 647.25 < missing.area < 647.27
  width = road_width_m(path_tags)
  assert width is not None
  paving = route.buffer(
    width / 2, cap_style="round", join_style="round", quad_segs=3
  ).intersection(missing)
  patch, path_surface = world(missing), world(paving)
  surfaces = [
    ("lawn", patch.difference(path_surface), 3.01),
    ("path", path_surface, 3.12),
  ]
  origin = [math.floor(patch.bounds[0] / 8) * 8, 0, math.floor(patch.bounds[1] / 8) * 8]
  modes, counts = {}, {}
  for native in (False, True):
    vertices, indices, colors, lookup = [], [], [], {}
    for role, geometry, baseline in surfaces:
      for triangle in surface_triangles(geometry, baseline, native):
        for point in triangle:
          local = tuple(round(float(v), 9) for v in point - origin)
          key = (*local, *COLORS[role])
          if key not in lookup:
            lookup[key] = len(vertices)
            vertices.append(local)
            colors.append(COLORS[role])
          indices.append(lookup[key])
    name = "native" if native else "drawn"
    modes[name] = {"positions": vertices, "colors": colors, "indices": indices}
    counts[name] = {"vertices": len(vertices), "triangles": len(indices) // 3}
  payload = {
    "schemaVersion": 1,
    "sourceId": "OSM-way-15700939",
    "pathSourceId": "OSM-way-185585685",
    "origin": origin,
    "bounds": list(patch.bounds),
    "footprint": footprint(patch),
    "pathFootprint": footprint(path_surface),
    **modes,
  }
  DATA.write_bytes(encode(payload))
  evidence = {
    "schemaVersion": 1,
    "baselineRelease": "v1.0.94",
    "sourceUrl": "https://www.openstreetmap.org/way/15700939",
    "pathSourceUrl": "https://www.openstreetmap.org/way/185585685",
    "sourceLicense": "ODbL-1.0",
    "sourceCache": str(CACHE.relative_to(ROOT)),
    "sourceCacheSha256": hashlib.sha256(CACHE.read_bytes()).hexdigest(),
    "sourceTags": lawn_tags,
    "sourceGeoJSON": mapping(lawn_frame.to_crs(4326).geometry.iloc[0]),
    "sourceProjectedGeoJSON": mapping(lawn),
    "sourceAreaM2": lawn.area,
    "oldScopes": scope_records,
    "patchAreaM2": patch.area,
    "patchGeoJSON": mapping(transform(UNPROJECT, missing)),
    "patchWorldGeoJSON": mapping(patch),
    "pathTags": path_tags,
    "pathSourceGeoJSON": mapping(path_frame.to_crs(4326).geometry.iloc[0]),
    "pathProjectedGeoJSON": mapping(route),
    "pathPatchWorldGeoJSON": mapping(path_surface),
    "pathWidthM": width,
    "pathWidthSource": road_width_source(path_tags),
    "pathPatchAreaM2": path_surface.area,
    "fieldSha256": hashlib.sha256(FIELD_PATH.read_bytes()).hexdigest(),
    "dataSha256": hashlib.sha256(DATA.read_bytes()).hexdigest(),
    "counts": counts,
    "policy": "Add only the exact omitted mapped lawn, partitioned around its retained crossing dirt path. Every earlier surface and scope remains unchanged. Drawn ground follows measured 8m planes; native ground has matching 8m terraces and grid risers. No images or textures.",
  }
  EVIDENCE.write_bytes(encode(evidence))
  return evidence


if __name__ == "__main__":
  result = build()
  print(
    json.dumps(
      {
        key: result[key]
        for key in (
          "patchAreaM2",
          "pathWidthM",
          "pathWidthSource",
          "pathPatchAreaM2",
          "counts",
        )
      },
      indent=2,
    )
  )
