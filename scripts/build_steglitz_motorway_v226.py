"""Step 10: recover the bounded mapped A103 bridge, preserving earlier packets."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import shapely
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import transform, unary_union

from isometric_berlin.generation.road_geometry import road_width_m, road_width_source

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "steglitz-motorway-v226-source.json"
# Display estimates, not surveyed altitudes. Long approaches join the retained
# flat cartographic road without dropping the deck onto either mapped crossing.
PROFILE = [[6490, 3.09], [6640, 9.4], [6895, 9.4], [7060, 3.09]]
THICKNESS = 0.4
CELL = 2
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True)


def digest(path: Path) -> str:
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def dump(path: Path, value: Any) -> None:
  path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")


def world(x: Any, y: Any, z: Any = None) -> tuple[Any, Any]:
  e, n = PROJECT.transform(x, y)
  try:
    return [v - 389500 for v in e], [5820000 - v for v in n]
  except TypeError:
    return e - 389500, 5820000 - n


def height(z: float) -> float:
  for (a, low), (b, high) in zip(PROFILE, PROFILE[1:]):
    if a <= z <= b:
      return low + (high - low) * (z - a) / (b - a)
  return 3.09


def parts(geometry: BaseGeometry) -> list[Polygon]:
  if geometry.is_empty:
    return []
  if geometry.geom_type == "Polygon":
    return [geometry]
  return [p for item in getattr(geometry, "geoms", []) for p in parts(item)]


def source_plans(source: dict[str, Any]) -> tuple[BaseGeometry, list[dict[str, Any]]]:
  scope = shape(source["priorScopes"])
  clip = box(*source["renderClipXZ"])
  plans, records = [], []
  for feature in source["features"]:
    line = transform(world, shape(feature["geometry"]))
    width = road_width_m(feature["tags"])
    width_source = road_width_source(feature["tags"])
    assert width and feature["tags"].get("lanes")
    plan = line.buffer(width / 2, cap_style=2, join_style=2).intersection(clip)
    assert scope.buffer(0.001).covers(plan), feature["id"]
    plans.append(plan)
    records.append(
      {
        "id": feature["id"],
        "displayWidthM": width,
        "widthSource": width_source,
        "widthSourceValue": feature["tags"].get(width_source),
        "laneDerivedWidthEstimate": width_source == "lanes",
        "sourcePoints": list(line.coords),
        "renderLengthM": line.intersection(clip).length,
        "bridge": feature["tags"].get("bridge") == "yes",
        "retainedProjection": bool(feature.get("priorProjectedRoad")),
      }
    )
  return unary_union(plans), records


def protected_files() -> dict[str, str]:
  paths = [DATA / "outerThinOutlines.json", DATA / "westernMotorwaysV205.json"]
  folder = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  manifest = folder / "manifest.json"
  paths.append(manifest)
  for chunk in json.loads(manifest.read_text())["chunks"]:
    if box(*chunk["bounds"]).intersects(box(-3800, 6490, -3000, 7400)):
      paths.extend(folder / chunk[mode]["url"] for mode in ["drawn", "minecraft"])
  return {str(p.relative_to(ROOT)): digest(p) for p in paths}


def build() -> dict[str, Any]:
  source = json.loads(SOURCE.read_text())
  plan, records = source_plans(source)
  positions, colors, native, rails = [], [], [], []

  def tri(points: list[list[float]], color: int) -> None:
    positions.extend(round(v, 4) for p in points for v in p)
    colors.extend([color] * 3)

  # The profile breaks subdivide triangles without simplifying any source bend.
  bands = [6400, *[p[0] for p in PROFILE], 7400]
  for a, b in zip(bands, bands[1:]):
    for p in parts(plan.intersection(box(-4000, a, -2800, b))):
      for t in shapely.constrained_delaunay_triangles(p).geoms:
        points = list(t.exterior.coords)[:3]
        tri([[x, height(z), z] for x, z in points], 0x60665F)
        tri([[x, height(z) - THICKNESS, z] for x, z in reversed(points)], 0xA1A49A)
      for ring in [p.exterior, *p.interiors]:
        for u, v in zip(ring.coords, list(ring.coords)[1:]):
          # Only exterior deck edges, not internal profile-band seams.
          if (
            plan.boundary.distance(LineString([u, v]).interpolate(0.5, normalized=True))
            > 0.001
          ):
            continue
          au, av = [u[0], height(u[1]), u[1]], [v[0], height(v[1]), v[1]]
          bu, bv = (
            [u[0], height(u[1]) - THICKNESS, u[1]],
            [v[0], height(v[1]) - THICKNESS, v[1]],
          )
          tri([au, av, bv], 0xB7B8AC)
          tri([au, bv, bu], 0xB7B8AC)

  # Sparse parapets only along mapped bridge edges. Endpoint gaps remain open;
  # no invented lane separators, arrow symbols, zebra crossings or pier spacing.
  bridge = unary_union(
    [
      transform(world, shape(f["geometry"])).buffer(
        road_width_m(f["tags"]) / 2 + 0.2, cap_style=2, join_style=2
      )
      for f in source["features"]
      if f["tags"].get("bridge") == "yes"
    ]
  )
  ends = [
    Point(p)
    for f in source["features"]
    for p in [
      list(transform(world, shape(f["geometry"])).coords)[0],
      list(transform(world, shape(f["geometry"])).coords)[-1],
    ]
  ]
  # Only true graph ends are gaps: connected OSM way boundaries are continuous.
  dead_ends = [p for p in ends if sum(p.distance(q) < 0.02 for q in ends) == 1]
  for p in parts(plan):
    for ring in [p.exterior, *p.interiors]:
      for a, b in zip(ring.coords, list(ring.coords)[1:]):
        length = math.dist(a, b)
        count = max(1, math.ceil(length / 2))
        for i in range(count):
          t0, t1 = i / count, (i + 1) / count
          u = [a[j] + (b[j] - a[j]) * t0 for j in [0, 1]]
          v = [a[j] + (b[j] - a[j]) * t1 for j in [0, 1]]
          x, z = (u[0] + v[0]) / 2, (u[1] + v[1]) / 2
          mid = Point(x, z)
          if not bridge.covers(mid) or any(p.distance(mid) < 8 for p in dead_ends):
            continue
          low = height(z)
          rails.append(
            [
              round(x, 4),
              round(low + 0.275, 4),
              round(z, 4),
              round(math.dist(u, v), 4),
              0.55,
              0.18,
              round(-math.atan2(v[1] - u[1], v[0] - u[0]), 8),
              0xCBCBC0,
            ]
          )

  x0, z0, x1, z1 = plan.bounds
  for z in range(math.floor(z0 / CELL) * CELL, math.ceil(z1 / CELL) * CELL, CELL):
    start = None
    top = round(height(z + CELL / 2) * 4) / 4
    for x in range(
      math.floor(x0 / CELL) * CELL, math.ceil(x1 / CELL) * CELL + CELL, CELL
    ):
      inside = x < x1 and plan.covers(Point(x + CELL / 2, z + CELL / 2))
      if inside and start is None:
        start = x
      if not inside and start is not None:
        native.append(
          [
            (start + x) / 2,
            top - THICKNESS / 2,
            z + CELL / 2,
            x - start,
            THICKNESS,
            CELL,
            0x60665F,
          ]
        )
        start = None
  native_rails = []
  for x, y, z, w, h, d, yaw, color in rails:
    c, s = abs(math.cos(yaw)), abs(math.sin(yaw))
    native_rails.append(
      [
        x,
        round((y - 0.275) * 4) / 4 + 0.275,
        z,
        max(0.18, c * w + s * d),
        h,
        max(0.18, s * w + c * d),
        color,
      ]
    )

  polygons = [
    [[list(p) for p in ring.coords] for ring in [p.exterior, *p.interiors]]
    for p in parts(plan)
  ]
  nav = {
    "bounds": list(plan.bounds),
    "polygons": polygons,
    "profile": PROFILE,
    "thickness": THICKNESS,
    "cellM": CELL,
    "rails": rails,
    "nativeRails": native_rails,
  }
  payload = {
    "positions": positions,
    "colors": colors,
    "rails": rails,
    "nativeRows": [*native, *native_rails],
  }
  evidence = {
    "schemaVersion": 1,
    "sourceSha256": digest(SOURCE),
    "preserved": protected_files(),
    "records": records,
    "bounds": list(plan.bounds),
    "newScopeAreaM2": 0,
    "triangles": len(positions) // 9,
    "drawnRailBoxes": len(rails),
    "nativeDeckRuns": len(native),
    "nativeRailBlocks": len(native_rails),
    "laneMarkings": 0,
    "piers": 0,
    "profileEstimate": PROFILE,
    "planAreaM2": plan.area,
    "plan": mapping(plan),
  }
  dump(DATA / "steglitzMotorwayV226.json", payload)
  dump(DATA / "steglitzMotorwayV226Navigation.json", nav)
  dump(GEO / "steglitz-motorway-v226-evidence.json", evidence)
  return {
    k: evidence[k]
    for k in [
      "bounds",
      "triangles",
      "drawnRailBoxes",
      "nativeDeckRuns",
      "nativeRailBlocks",
      "planAreaM2",
    ]
  }


if __name__ == "__main__":
  print(json.dumps(build()))
