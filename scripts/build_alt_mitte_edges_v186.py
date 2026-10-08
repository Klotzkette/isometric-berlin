"""Step 10: two restrained edge accents on exposed measured Alt-Mitte walls."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import nearest_points, transform, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "alt-mitte-v169"
APP = ROOT / "src/app/src/data"
ROADS = GEO / "alt-mitte-edges-v186-streets.json"
EVIDENCE = GEO / "alt-mitte-edges-v186-evidence.json"
EXCLUSION_FILES = [
  GEO / "schools-v185-evidence.json",
  GEO / "public-places-v185-evidence.json",
  GEO / "scheunen-facades-v183-evidence.json",
  APP / "northV185.json",
  APP / "bndHeadquartersV174Navigation.json",
  APP / "zionskircheV174Evidence.json",
  APP / "berlinWallMemorialV174Navigation.json",
  APP / "zionskirchplatzV175Evidence.json",
  APP / "cityRecognitionV182.json",
]
TRANSFERRED = {
  "DEBE00YY1TF0003o",
  "DEBE01YYK00001Xy",
  "DEBE01YYK00002iS",
  "DEBE01YYK00003SW",
  "DEBE01YYK00001QK",
}
POLICY = (
  "At most one clear mapped-street-facing measured wall per active generic "
  "Alt-Mitte parent, with two thin edge accents. The original complete source "
  "buildings, windows, roads, holes, roofs and authored details remain intact. "
  "Profile dimensions and colours are non-surveyed graphic display estimates, "
  "not evidence of actual historical cornices. No new window or entrance claims."
)


def digest(path: Path) -> str:
  """Hash unchanged source input."""
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def write(path: Path, value: Any) -> None:
  """Write compact finite derived data."""
  path.write_text(json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n")


def boundary() -> Any:
  """Use the complete frozen conservative pre-2001 district selection."""
  data = json.loads((GEO / "alt-mitte-v169-boundary.geojson").read_text())
  geometry = shape(data["features"][0]["geometry"])
  if geometry.bounds[0] < 1000:
    geometry = transform(
      Transformer.from_crs(4326, 25833, always_xy=True).transform, geometry
    )
  return affine_transform(geometry, [1, 0, 0, -1, -389500, 5820000])


def extract_streets() -> None:
  """Freeze only named street courses near Alt-Mitte from retained OSM data."""
  import pyogrio

  allowed = {
    "primary",
    "secondary",
    "tertiary",
    "residential",
    "unclassified",
    "living_street",
    "pedestrian",
  }
  data = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/candidate.gpkg",
    layer="lines",
    where="name IS NOT NULL AND highway IS NOT NULL",
  ).to_crs(25833)
  scope = boundary().buffer(32)
  rows = []
  for record in data.itertuples():
    if record.highway not in allowed or '"tunnel"=>"yes"' in str(record.other_tags):
      continue
    geometry = affine_transform(record.geometry, [1, 0, 0, -1, -389500, 5820000])
    if not scope.intersects(geometry):
      continue
    geometry = geometry.intersection(scope)
    if geometry.is_empty:
      continue
    rows.append(
      {
        "id": str(record.osm_id),
        "name": record.name,
        "highway": record.highway,
        "geometry": mapping(geometry),
      }
    )
  write(
    ROADS,
    {
      "source": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      "sourceSha256": digest(GEO / "raw/outer-v159/berlin-260929.osm.pbf"),
      "licence": "ODbL-1.0",
      "boundarySha256": digest(GEO / "alt-mitte-v169-boundary.geojson"),
      "roads": sorted(rows, key=lambda r: r["id"]),
    },
  )


def exclusions() -> set[str]:
  """Protect later exact authored/accents identities, including legacy aliases."""
  ids = set(TRANSFERRED)

  def visit(value: Any) -> None:
    if isinstance(value, dict):
      for v in value.values():
        if isinstance(v, str) and v.startswith(("DEBE", "OSM-way-")):
          ids.add(v)
        else:
          visit(v)
    elif isinstance(value, list):
      for v in value:
        visit(v)

  for path in EXCLUSION_FILES:
    visit(json.loads(path.read_text()))
  ids.update(x[-8:] for x in tuple(ids) if x.startswith("DEBE"))
  ids.update(x.removeprefix("OSM-way-") for x in tuple(ids) if x.startswith("OSM-way-"))
  return ids


def footprint(record: dict) -> Any:
  """Preserve every measured footprint and courtyard void."""
  return unary_union(
    [
      shapely.make_valid(Polygon(p["ring"], p.get("holes", [])))
      for p in record["footprintPolygons"]
    ]
  )


def wall_frame(surface: dict) -> tuple | None:
  """Project a vertical source wall without changing its rings or holes."""
  pts = np.array(surface["rings"][0])
  n = np.zeros(3)
  for i in range(1, len(pts) - 1):
    n += np.cross(pts[i] - pts[0], pts[i + 1] - pts[0])
  norm = float(np.linalg.norm(n))
  if norm < 0.01 or abs(n[1] / norm) > 0.001:
    return None
  n /= norm
  a, b = max(
    ((a, b) for a in pts for b in pts),
    key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
  )
  d = np.array([b[0] - a[0], 0, b[2] - a[2]], dtype=float)
  length = float(np.linalg.norm(d))
  if length < 8:
    return None
  d /= length
  rings = [
    [(float(np.dot(np.array(p) - a, d)), p[1]) for p in ring]
    for ring in surface["rings"]
  ]
  wall = shapely.make_valid(Polygon(rings[0], rings[1:]))
  if wall.is_empty:
    return None
  return a, d, n, wall


def profile_rows(frame: tuple, offset_y: float) -> tuple[list, list]:
  """Fit modest horizontal sections fully below the source wall top/gable."""
  a, d, n, wall = frame
  lo, base, hi, top = wall.bounds
  # Sample every source edge breakpoint plus interiors: for a piecewise-linear
  # wall this finds the lowest upper envelope, without treating a gable tip as
  # a rectangular eave. Exact full rectangle containment is checked afterwards.
  xs = {lo + 0.18, hi - 0.18}
  for poly in [wall] if wall.geom_type == "Polygon" else wall.geoms:
    if poly.geom_type == "Polygon":
      xs.update(min(hi - 0.18, max(lo + 0.18, x)) for x, _ in poly.exterior.coords)
  heights = []
  for x in xs:
    section = wall.intersection(LineString([(x, base - 1), (x, top + 1)]))
    if not section.is_empty:
      heights.append(section.bounds[3])
  eave = min(heights, default=base)
  if eave - base < 8:
    return [], []
  rows, sections = [], []
  for role, y, h, depth, color in [
    ("upper edge", eave - 0.29, 0.14, 0.25, 0xC9C5B7),
    ("base edge", base + 0.30, 0.25, 0.16, 0xB1AFA2),
  ]:
    rectangle = box(lo + 0.18, y - h / 2, hi - 0.18, y + h / 2)
    if not wall.covers(rectangle):
      continue
    left, bottom, right, upper = rectangle.bounds
    pos = a + d * ((left + right) / 2) + n * (depth / 2 + 0.035)
    rows.append(
      [
        *[
          round(float(v), 3)
          for v in [pos[0], y + offset_y, pos[2], right - left, h, depth]
        ],
        round(-math.atan2(d[2], d[0]), 6),
        color,
        1 if np.dot(n, np.array([-d[2], 0, d[0]])) > 0 else -1,
      ]
    )
    sections.append({"role": role, "rectangle": [left, bottom, right, upper]})
  return rows, sections


def build() -> tuple[dict, dict]:
  """Scan every frozen family; publish accents only on eligible clear streets."""
  manifest = json.loads((SOURCE / "source-manifest.json").read_text())
  records = []
  for chunk in manifest["chunks"]:
    records.extend(
      json.loads(gzip.decompress((SOURCE / chunk["file"]).read_bytes()))["buildings"]
    )
  all_footprints = [footprint(r) for r in records]
  occupied = unary_union(all_footprints)
  shapely.prepare(occupied)
  road_records = json.loads(ROADS.read_text())["roads"]
  roads = [shape(r["geometry"]) for r in road_records]
  road_index = STRtree(roads)
  offsets = json.loads((APP / "weinbergBuildingOffsetsV176.json").read_text())[
    "offsets"
  ]
  excluded = exclusions()
  counts: Counter = Counter()
  cells: dict[str, list] = defaultdict(list)
  native_counts: Counter = Counter()
  faces = []
  for building in sorted(records, key=lambda r: r["id"]):
    counts["inventory_" + building["category"]] += 1
    if building["category"] not in {"core", "outer"}:
      continue
    if building["sourceType"] != "official-lod2":
      counts["unmeasuredResidualUnchanged"] += 1
      continue
    ids = {
      building["id"],
      *building.get("legacyPrismIds", []),
      *building.get("outerOwnerIds", []),
    }
    if ids & excluded:
      counts["protectedLaterAccent"] += 1
      continue
    if building.get("osmTags", {}).get("building:material") == "glass":
      counts["mappedGlass"] += 1
      continue
    candidates = []
    for part in building["parts"]:
      for surface in part["surfaces"]:
        if surface["kind"] != "WallSurface":
          continue
        frame = wall_frame(surface)
        if frame is None:
          continue
        a, d, n, wall = frame
        lo, base, hi, top = wall.bounds
        if top - base < 8 or base > part["groundY"] + 0.5:
          continue
        center = a + d * ((lo + hi) / 2)
        p = Point(center[0], center[2])
        street_index = int(road_index.nearest(p))
        nearest = nearest_points(p, roads[street_index])[1]
        vx, vz = nearest.x - p.x, nearest.y - p.y
        distance = math.hypot(vx, vz)
        if not 1 <= distance <= 26 or (vx * n[0] + vz * n[2]) / distance < 0.78:
          continue
        sightline = LineString(
          [(p.x + n[0] * 0.45, p.y + n[2] * 0.45), (nearest.x, nearest.y)]
        )
        if occupied.intersects(sightline):
          continue
        # Both near-wall and complete outward approach must be free across the
        # facade; center-only checks could accidentally select party-wall ends.
        blocked = False
        for u in [
          lo + 0.5,
          lo + (hi - lo) / 4,
          (hi + lo) / 2,
          hi - (hi - lo) / 4,
          hi - 0.5,
        ]:
          pt = a + d * u
          approach = LineString(
            [
              (pt[0] + n[0] * 0.45, pt[2] + n[2] * 0.45),
              (pt[0] + n[0] * min(5, distance), pt[2] + n[2] * min(5, distance)),
            ]
          )
          if occupied.intersects(approach):
            blocked = True
            break
        if blocked:
          continue
        offset_y = float(offsets.get(building["id"], 0))
        rows, sections = profile_rows(frame, offset_y)
        if not rows:
          continue
        candidates.append(
          (
            hi - lo,
            part,
            surface,
            frame,
            street_index,
            rows,
            sections,
            offset_y,
          )
        )
    if not candidates:
      counts["noEligibleStreetWall"] += 1
      continue
    _, part, surface, frame, street_index, rows, sections, offset_y = max(
      candidates, key=lambda c: c[0]
    )
    cell = f"{math.floor(rows[0][0] / 512)}:{math.floor(rows[0][2] / 512)}"
    native_count = sum(math.ceil(r[3] / 2.4) for r in rows)
    faces.append(
      {
        "parentId": building["id"],
        "category": building["category"],
        "partId": part["id"],
        "sourcePolygonId": surface["sourcePolygonId"],
        "rings": surface["rings"],
        "normal": [round(float(v), 6) for v in frame[2]],
        "terrainOffsetY": offset_y,
        "streetId": road_records[street_index]["id"],
        "cell": cell,
        "firstBox": len(cells[cell]),
        "boxCount": len(rows),
        "firstNative": native_counts[cell],
        "nativeCount": native_count,
        "sections": sections,
      }
    )
    cells[cell].extend(rows)
    native_counts[cell] += native_count
    counts["accented_" + building["category"]] += 1
  drawn = {
    "schemaVersion": 1,
    "cells": [{"cell": k, "rows": v} for k, v in sorted(cells.items())],
  }
  counts["drawnInstances"] = sum(len(c["rows"]) for c in drawn["cells"])
  counts["nativeInstances"] = sum(native_counts.values())
  assert counts["drawnInstances"] * 76 < 1.5 * 1024 * 1024
  evidence = {
    "schemaVersion": 1,
    "policy": POLICY,
    "counts": dict(counts),
    "inputSha256": {
      str(p.relative_to(ROOT)): digest(p)
      for p in [
        SOURCE / "source-manifest.json",
        GEO / "alt-mitte-v169-boundary.geojson",
        ROADS,
        APP / "weinbergBuildingOffsetsV176.json",
        *EXCLUSION_FILES,
      ]
    },
    "sourceChunks": [
      {"file": c["file"], "sha256": c["sha256"]} for c in manifest["chunks"]
    ],
    "excludedIds": sorted(excluded),
    "faces": faces,
  }
  return drawn, evidence


def main() -> None:
  """Create independent additions without rewriting a delivered city packet."""
  if not ROADS.exists():
    extract_streets()
  drawn, evidence = build()
  write(APP / "altMitteEdgesV186.json", drawn)
  write(EVIDENCE, evidence)
  print(evidence["counts"])
  print(
    {
      "cells": len(drawn["cells"]),
      "drawnBytes": (APP / "altMitteEdgesV186.json").stat().st_size,
    }
  )


if __name__ == "__main__":
  main()
