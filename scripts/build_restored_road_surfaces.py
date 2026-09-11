"""Prepare bounded exact street meshes, preserving newer authored surfaces."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from shapely.affinity import affine_transform, rotate, translate
from shapely.geometry import LineString, Polygon, box
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

try:
  from scripts.hansaplatz_streets import hansaplatz_clearance
except ModuleNotFoundError:  # Direct `uv run scripts/...py` invocation.
  from hansaplatz_streets import hansaplatz_clearance

ROOT = Path(__file__).resolve().parents[1]
TILE_M = 64
BATCH_M = 512


def polygons(geometry: BaseGeometry) -> list[Polygon]:
  """Extract polygons without discarding small valid source components."""
  if geometry.is_empty:
    return []
  if isinstance(geometry, Polygon):
    return [geometry]
  return [part for g in getattr(geometry, "geoms", []) for part in polygons(g)]


def lines(geometry: BaseGeometry) -> list[LineString]:
  """Keep only line components of a clipped original kerb."""
  if isinstance(geometry, LineString):
    return [] if geometry.is_empty else [geometry]
  return [part for g in getattr(geometry, "geoms", []) for part in lines(g)]


def owned_surfaces(source: dict[str, Any], root: Path) -> BaseGeometry:
  """Subtract actual replacement footprints, never whole district windows."""
  district = json.loads((root / "src/app/src/data/districtStreets.json").read_text())
  owners: list[BaseGeometry] = []
  for surface in district["surfaces"]:
    positions = (
      np.frombuffer(base64.b64decode(surface["positions_cm_b64"]), dtype="<i4").reshape(
        -1, 2
      )
      / 100
    )
    indices = np.frombuffer(
      base64.b64decode(surface["indices_b64"]), dtype="<u4"
    ).reshape(-1, 3)
    owners.append(unary_union(shapely.polygons(positions[indices])))
  owners.extend(Polygon(p["ring"], p["holes"]) for p in source["approach"])
  p = source["bebel"]
  owners.append(box(p["minX"], p["minZ"], p["maxX"], p["maxZ"]))
  owners.append(
    affine_transform(hansaplatz_clearance(root), [1, 0, 0, -1, -389500, 5820000])
  )
  h = source["hand"]
  hx, _, hz = h["world"]
  yaw = h["localYawRadians"]
  owners.append(
    translate(rotate(box(-1.8, -1.8, 1.8, 1.8), -yaw, use_radians=True), hx, hz)
  )
  # Same narrow photo-proportioned connection as the retained Hand model.
  dx, dz = -2151.634 - hx, -72.277 - hz
  ex, ez = (
    math.cos(yaw) * dx - math.sin(yaw) * dz,
    math.sin(yaw) * dx + math.cos(yaw) * dz,
  )
  sx, sz = ex * 1.5 / ez, 1.5
  start = (
    hx + math.cos(yaw) * sx + math.sin(yaw) * sz,
    hz - math.sin(yaw) * sx + math.cos(yaw) * sz,
  )
  owners.append(LineString([start, (-2151.634, -72.277)]).buffer(0.9, cap_style="flat"))
  tx, tz = source["t4"]["worldM"]
  owners.append(
    translate(rotate(box(-15, -3.82, 15, 3.82), -0.2, use_radians=True), tx, tz)
  )
  return unary_union(owners)


def encode(values: Any, dtype: str) -> str:
  """Store bounded typed buffers directly, without JSON number object graphs."""
  return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode("ascii")


def terrain_triangles(
  points: list[tuple[float, float]],
) -> list[list[tuple[float, float]]]:
  """Keep the prior renderer's 64 m maximum terrain sampling edge."""
  a, b, c = points
  if max(math.dist(a, b), math.dist(b, c), math.dist(c, a)) <= 64:
    return [points]
  ab, bc, ca = [
    tuple((u + v) / 2 for u, v in zip(p, q)) for p, q in [(a, b), (b, c), (c, a)]
  ]
  return [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]


def build(source: dict[str, Any], root: Path = ROOT) -> dict[str, Any]:
  """Triangulate disjoint clipped tiles offline; keep every represented area."""
  owned = owned_surfaces(source, root)
  print("Replacement footprints prepared", flush=True)
  # Buffer only kerb suppression by its physical half-width to avoid doubles.
  kerb_owned = owned.buffer(0.15)
  tiles: dict[tuple[str, int, int], list[Polygon]] = {}
  curb_tiles: dict[tuple[int, int], list[list[tuple[float, float]]]] = {}
  inventory: dict[str, dict[str, float | int]] = {}
  for source_index, road in enumerate(source["roads"]):
    kind = road["kind"]
    polygon = shapely.make_valid(Polygon(road["ring"], road["holes"]))
    restored = polygon.difference(owned)
    item = inventory.setdefault(
      kind,
      {
        "records": 0,
        "source_area_m2": 0.0,
        "restored_area_m2": 0.0,
        "owned_area_m2": 0.0,
        "clipped_area_m2": 0.0,
        "union_area_m2": 0.0,
        "overlap_area_m2": 0.0,
        "triangulated_area_m2": 0.0,
      },
    )
    item["records"] += 1
    item["source_area_m2"] += polygon.area
    item["restored_area_m2"] += restored.area
    item["owned_area_m2"] += polygon.intersection(owned).area
    for part in polygons(restored):
      x0, z0, x1, z1 = part.bounds
      for ix in range(math.floor(x0 / TILE_M), math.floor(x1 / TILE_M) + 1):
        for iz in range(math.floor(z0 / TILE_M), math.floor(z1 / TILE_M) + 1):
          clipped = polygons(
            shapely.make_valid(
              shapely.clip_by_rect(
                part,
                ix * TILE_M,
                iz * TILE_M,
                (ix + 1) * TILE_M,
                (iz + 1) * TILE_M,
              )
            )
          )
          if clipped:
            tiles.setdefault((kind, ix, iz), []).extend(clipped)
    if kind == "asphalt":
      for ring in [road["ring"], *road["holes"]]:
        if len(ring) < 3:
          continue
        for line in lines(LineString([*ring, ring[0]]).difference(kerb_owned)):
          points = list(line.coords)
          for a, b in zip(points, points[1:]):
            if math.dist(a, b) < 0.05:
              continue
            key = (
              math.floor((a[0] + b[0]) / (2 * BATCH_M)),
              math.floor((a[1] + b[1]) / (2 * BATCH_M)),
            )
            curb_tiles.setdefault(key, []).append([a, b])
    if source_index % 250 == 0:
      print(f"Clipped source {source_index + 1}/{len(source['roads'])}", flush=True)
  batches = []
  grouped: dict[tuple[str, int, int], list[BaseGeometry]] = {}
  for (kind, ix, iz), parts in sorted(tiles.items()):
    key = (kind, ix * TILE_M // BATCH_M, iz * TILE_M // BATCH_M)
    union = unary_union(parts)
    clipped_area = sum(part.area for part in parts)
    inventory[kind]["clipped_area_m2"] += clipped_area
    inventory[kind]["union_area_m2"] += union.area
    inventory[kind]["overlap_area_m2"] += max(0.0, clipped_area - union.area)
    for part in polygons(union):
      triangles = shapely.constrained_delaunay_triangles(part)
      inventory[kind]["triangulated_area_m2"] += triangles.area
      grouped.setdefault(key, []).extend(triangles.geoms)
  for (kind, ix, iz), triangles in sorted(grouped.items()):
    vertices: list[tuple[float, float]] = []
    indices: list[int] = []
    lookup: dict[tuple[float, float], int] = {}
    for triangle in triangles:
      for points in terrain_triangles(list(triangle.exterior.coords)[:3]):
        # Three's upward XZ winding is clockwise in the source plane.
        if shapely.is_ccw(triangle.exterior):
          points.reverse()
        for p in points:
          if p not in lookup:
            lookup[p] = len(vertices)
            vertices.append(p)
          indices.append(lookup[p])
    batches.append(
      {
        "id": f"restored-{kind}-{ix}-{iz}",
        "kind": kind,
        "xz": encode(vertices, "<f4"),
        "indices": encode(indices, "<u4"),
      }
    )
  for (ix, iz), segments in sorted(curb_tiles.items()):
    batches.append(
      {
        "id": f"restored-kerbs-{ix}-{iz}",
        "kind": "kerbs",
        "xz": encode(segments, "<f4"),
      }
    )
  return {
    "format": "bounded-source-road-surfaces",
    "version": 1,
    "source_sha256": source["source_sha256"],
    "district_sha256": hashlib.sha256(
      (root / "src/app/src/data/districtStreets.json").read_bytes()
    ).hexdigest(),
    "tile_m": TILE_M,
    "inventory": inventory,
    "ownership": [
      "DistrictStreets exact triangles",
      "Brandenburg approach",
      "Bebelplatz glass/library",
      "Hansaplatz courts/U9/buildings",
      "Hand mit Uhr paving",
      "T4 memorial field",
    ],
    "batches": batches,
  }


def write_cache(path: Path, payload: dict[str, Any]) -> None:
  """One bounded batch per line avoids a whole-cache JSON graph on phones."""
  batches = payload["batches"]
  header = {key: value for key, value in payload.items() if key != "batches"}
  header["batch_count"] = len(batches)
  header["encoding"] = "ndjson-base64-float32"
  with path.open("w") as output:
    output.write(json.dumps(header, separators=(",", ":")) + "\n")
    for batch in batches:
      output.write(json.dumps(batch, separators=(",", ":")) + "\n")


def main() -> None:
  """Regenerate the release's bounded road cache from committed source data."""
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--output",
    type=Path,
    default=ROOT / "src/app/src/data/restoredRoadSurfaces.ndjson.txt",
  )
  args = parser.parse_args()
  with tempfile.TemporaryDirectory(prefix="restored-roads-") as temporary:
    prepared = Path(temporary) / "source.json"
    subprocess.run(
      ["bun", "src/app/scripts/prepare-restored-road-source.ts", str(prepared)],
      cwd=ROOT,
      check=True,
    )
    result = build(json.loads(prepared.read_text()))
  write_cache(args.output, result)
  print(
    json.dumps(
      {
        "bytes": args.output.stat().st_size,
        "batches": len(result["batches"]),
        "inventory": result["inventory"],
      },
      indent=2,
    )
  )


if __name__ == "__main__":
  main()
