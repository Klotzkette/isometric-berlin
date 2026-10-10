"""Step 10: mapped paint and missing curb courses on four named boulevards."""

from __future__ import annotations

import argparse
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

import build_alt_mitte_transport_v206 as transport
import pyogrio
import shapely
from build_surrounding_outlines import load_projected_polygon, polygonal
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

from isometric_berlin.generation.road_geometry import VEHICULAR_HIGHWAYS, road_width_m

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src/data"
RAW = GEO / "raw/outer-v159"
NAMES = ("Kurfürstendamm", "Friedrichstraße", "Karl-Marx-Allee", "Karl-Marx-Straße")
SOURCE = GEO / "boulevard-transport-v210-source.json"
SCOPE = GEO / "boulevard-transport-v210-scope.geojson"
OUT = APP / "boulevardTransportV210.json"
GROUND = APP / "boulevardTransportGroundV210.json"
EVIDENCE = GEO / "boulevard-transport-v210-evidence.json"
CURBS = APP / "boulevardCurbsV210.json"


def world(geometry):
  """Retain projected source vertices in the established viewer frame."""
  return affine_transform(geometry, [1, 0, 0, -1, -389500, 5820000])


def extract() -> None:
  """Freeze complete geometry, then constrain paint to named carriageways."""
  names = ",".join(f"'{name}'" for name in NAMES)
  named = pyogrio.read_dataframe(
    RAW / "candidate.gpkg", layer="lines", where=f"name IN ({names})"
  ).to_crs(25833)
  roads = []
  for row in named.to_dict("records"):
    tags = dict(re.findall(r'"([^\"]+)"=>"([^\"]*)"', str(row.get("other_tags", ""))))
    tags.update({k: row[k] for k in ("name", "highway") if isinstance(row.get(k), str)})
    if tags.get("highway") in VEHICULAR_HIGHWAYS and transport.at_grade(tags):
      roads.append(
        {
          "key": f"way/{row['osm_id']}",
          "tags": tags,
          "geometry": mapping(world(row["geometry"])),
        }
      )
  # A narrow corridor is not a district expansion. Retain the old-Mitte paint
  # verbatim; only its complement receives another paint layer.
  corridor = unary_union(
    [
      shape(r["geometry"]).buffer(road_width_m(r["tags"]) / 2 + 1, cap_style=2)
      for r in roads
    ]
  )
  permitted = []
  for name in (
    "bounds.geojson",
    "bounds-ring-v182.geojson",
    "bounds-city-v183.geojson",
  ):
    permitted.append(world(load_projected_polygon(GEO / name)))
  corridor = corridor.intersection(unary_union(permitted))
  paint_scope = corridor.difference(transport.boundary())
  transport.write(
    SCOPE,
    {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "properties": {"coordinateSystem": "viewer metres", "streets": NAMES},
          "geometry": mapping(paint_scope),
        }
      ],
    },
  )
  metric = affine_transform(corridor.buffer(22), [1, 0, 0, -1, 389500, 5820000])
  bbox = transform(
    Transformer.from_crs(25833, 4326, always_xy=True).transform, metric
  ).bounds
  features = {}
  for layer, path in (("lines", RAW / "candidate.gpkg"), ("points", transport.PBF)):
    frame = pyogrio.read_dataframe(path, layer=layer, bbox=bbox).to_crs(25833)
    for row in frame.to_dict("records"):
      geometry = world(row["geometry"])
      if not corridor.intersects(geometry):
        continue
      tags = dict(re.findall(r'"([^\"]+)"=>"([^\"]*)"', str(row.get("other_tags", ""))))
      tags.update(
        {k: row[k] for k in ("name", "highway") if isinstance(row.get(k), str)}
      )
      tags = {
        k: v
        for k, v in tags.items()
        if k in transport.TAGS or k.startswith(("cycleway:", "parking:", "turn:lanes"))
      }
      relevant = (
        tags.get("highway") in VEHICULAR_HIGHWAYS
        or tags.get("highway") in ("crossing", "traffic_signals")
        or any(tags.get(k) == "crossing" for k in ("footway", "cycleway", "path"))
        or "road_marking" in tags
      )
      if relevant:
        key = f"{'way' if layer == 'lines' else 'node'}/{row['osm_id']}"
        features[key] = {"key": key, "tags": tags, "geometry": mapping(geometry)}
  transport.write(
    SOURCE,
    {
      "source": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      "sourceSha256": transport.digest(transport.PBF),
      "license": "ODbL-1.0",
      "coordinateSystem": "viewer metres",
      "features": sorted(features.values(), key=lambda r: r["key"]),
      "namedRoads": roads,
      "corridor": mapping(corridor),
    },
  )


def curbs(source: dict) -> dict:
  """Use the retained delivered asphalt outlines, never close a junction/cut."""
  core = json.loads((APP / "surroundingCityScope.json").read_text())["core"]
  core = Polygon(core["ring"], core["holes"])
  target = unary_union(
    [
      shape(r["geometry"]).buffer(road_width_m(r["tags"]) / 2 + 0.6, cap_style=2)
      for r in source["namedRoads"]
      if r["tags"]["name"] in ("Karl-Marx-Allee", "Karl-Marx-Straße")
    ]
  ).difference(core)
  # Existing v163 Kudamm and full-core Friedrichstrasse curbs are already
  # source-aligned. Do not add coplanar duplicates over those retained courses.
  surfaces = []
  occupied = []
  # Keep complete immediately adjacent source footprints in the exclusion
  # receipt too. A full native pixel is corridor-clipped already, but this
  # independently proves that no former diagonal-box overhang reaches them.
  occupied_context = target.buffer(0.5)
  receipts = {}
  for folder in ("outer-v159", "ring-v182", "city-v183"):
    path = GEO / f"raw/{folder}/resolved-outlines.gpkg"
    receipts[str(path.relative_to(ROOT))] = transport.digest(path)
    frame = pyogrio.read_dataframe(path, layer="surfaces")
    surfaces.extend(
      row["geometry"]
      for row in frame.to_dict("records")
      if row["kind"] == "road" and row["geometry"].intersects(target)
    )
    occupied.extend(
      row["geometry"]
      for row in frame.to_dict("records")
      if row["kind"] == "water" and row["geometry"].intersects(occupied_context)
    )
    frame = pyogrio.read_dataframe(path, layer="buildings")
    occupied.extend(g for g in frame.geometry if g.intersects(occupied_context))
  asphalt = polygonal(unary_union(surfaces))
  edge = asphalt.boundary.intersection(target.buffer(-0.15)).difference(
    unary_union(occupied).buffer(0.15)
  )
  # Preserve the existing Richardplatz/Schudomastrasse curb family, including
  # its short connecting portions near Karl-Marx-Strasse.
  old = json.loads((APP / "southKiezV185.json").read_text())["boxes"]
  old_lines = []
  for x, y, z, length, height, depth, yaw, colour in old:
    if colour != 0xCFCBBB:
      continue
    c, s = math.cos(yaw), -math.sin(yaw)
    old_lines.append(
      LineString(
        [
          (x - c * length / 2, z - s * length / 2),
          (x + c * length / 2, z + s * length / 2),
        ]
      )
    )
  old_curb_area = unary_union(old_lines).buffer(0.3)
  edge = edge.difference(old_curb_area)
  # Independently rasterise the exact retained course at quarter-metre
  # resolution. Full pixels must stay clear of buildings, water, old curbs,
  # the core and the selected source corridor. No diagonal segment AABB.
  native_allowed = target.difference(unary_union(occupied).buffer(0.01)).difference(
    old_curb_area
  )
  shapely.prepare(native_allowed)
  pixels = set()
  for line in transport.line_parts(edge):
    for a, b in zip(line.coords, list(line.coords)[1:]):
      # A supercover sampled more finely than one pixel supplies candidates;
      # the exact source segment, not its bounding rectangle, selects them.
      segment = LineString([a, b])
      length = segment.length
      count = max(1, math.ceil(length / 0.1))
      candidates = set()
      for i in range(count + 1):
        t = i / count
        ix = math.floor((a[0] + (b[0] - a[0]) * t) * 4)
        iz = math.floor((a[1] + (b[1] - a[1]) * t) * 4)
        candidates.update((ix + dx, iz + dz) for dx in (-1, 0, 1) for dz in (-1, 0, 1))
      for ix, iz in candidates:
        pixel = box(ix / 4, iz / 4, (ix + 1) / 4, (iz + 1) / 4)
        if segment.intersection(pixel).length > 1e-8 and native_allowed.covers(pixel):
          pixels.add((ix, iz))

  def merge(rows, axis):
    groups = defaultdict(list)
    for row in rows:
      groups[tuple(row[i] for i in range(4) if i not in (axis, axis + 2))].append(row)
    output = []
    for group in groups.values():
      merged = []
      for row in sorted(group, key=lambda r: r[axis]):
        if merged and merged[-1][axis] + merged[-1][axis + 2] == row[axis]:
          merged[-1][axis + 2] += row[axis + 2]
        else:
          merged.append(row.copy())
      output.extend(merged)
    return output

  # Choose the smaller lossless rectangle cover per 4m terrain cell. This
  # retains every accepted pixel and never merges across a terrain/cull seam.
  tiles = defaultdict(list)
  for ix, iz in sorted(pixels):
    tiles[(ix // 16, iz // 16)].append([ix, iz, 1, 1])
  native_runs = []
  for rows in tiles.values():
    xy = merge(merge(rows, 0), 1)
    yx = merge(merge(rows, 1), 0)
    native_runs.extend(xy if len(xy) <= len(yx) else yx)
  native_runs.sort()
  segments = []
  for line in transport.line_parts(edge):
    for a, b in zip(line.coords, list(line.coords)[1:]):
      length = math.dist(a, b)
      for i in range(math.ceil(length / 2)):
        n = math.ceil(length / 2)
        segments.append(
          [
            round(a[0] + (b[0] - a[0]) * t, 4)
            if j % 2 == 0
            else round(a[1] + (b[1] - a[1]) * t, 4)
            for j, t in enumerate((i / n, i / n, (i + 1) / n, (i + 1) / n))
          ]
        )
  transport.write(
    CURBS,
    {
      "segments": segments,
      "nativeRuns": native_runs,
      "nativePixelSizeM": 0.25,
      "nativePixelCount": len(pixels),
      "sourceSha256": transport.digest(SOURCE),
      "sourceLengthM": round(edge.length, 3),
      "policy": "Full delivered asphalt union boundary; no transverse junction/scope edges. Original Kudamm/core/Richardplatz curbs retained; 0.22m curb width and 0.19m rise are display estimates.",
    },
  )
  transport.write(
    GEO / "boulevard-curbs-v210-evidence.json",
    {
      "sourceGeometry": mapping(edge),
      "occupiedGeometry": mapping(unary_union(occupied)),
      "nativePixelSizeM": 0.25,
      "nativePixels": len(pixels),
      "nativeRuns": len(native_runs),
      "inputSha256": receipts,
      "runtimeSha256": transport.digest(CURBS),
    },
  )
  return {
    "segments": len(segments),
    "lengthM": round(edge.length, 3),
    "nativePixels": len(pixels),
    "nativeRuns": len(native_runs),
  }


def build() -> None:
  """Share the tested source-only paint grammar; old v206 files stay untouched."""
  source = json.loads(SOURCE.read_text())
  scope = shape(json.loads(SCOPE.read_text())["features"][0]["geometry"])
  transport.build(
    source_path=SOURCE,
    output_path=OUT,
    ground_path=GROUND,
    corrections_path=APP / "boulevardTransportCorrectionsV210.json",
    evidence_path=EVIDENCE,
    boundary_path=SCOPE,
    scope=scope,
    version="v210",
    include_signals=False,
    interior_junction_clearance_m=4,
  )
  result = json.loads(OUT.read_text())
  result["source"] = (
    "OSM Geofabrik Berlin 2026-09-29, ODbL-1.0; four named boulevard carriageways outside retained v206 paint"
  )
  transport.write(OUT, result)
  evidence = json.loads(EVIDENCE.read_text())
  evidence["curbs"] = curbs(source)
  evidence["namedSourceWays"] = dict(
    Counter(r["tags"]["name"] for r in source["namedRoads"])
  )
  evidence["retainedPreviousGeometry"] = [
    "all v206 Alt-Mitte paint",
    "all v163 Kudamm curbs/pavements",
    "all restored full-core Friedrichstrasse curbs",
    "all v185 Richardplatz/Schudomastrasse curbs",
    "all original road surfaces and buildings",
  ]
  transport.write(EVIDENCE, evidence)
  print(
    json.dumps(
      {
        "paint": result["counts"],
        "curbs": evidence["curbs"],
        "streets": evidence["namedSourceWays"],
      },
      indent=2,
    )
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract or not SOURCE.exists():
    extract()
  build()
