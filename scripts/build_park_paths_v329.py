"""Exact current path complements and material cues on retained park ground."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import subprocess
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely
from build_rixdorf_v304 import fingerprint, read, write
from build_surrounding_outlines import (
  COLORS,
  PackedMesh,
  line_parts,
  linear_rgb_bytes,
  polygonal,
)
from shapely.affinity import translate
from shapely.geometry import Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.generation.road_geometry import road_width_m, road_width_source

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app"
PACKETS = APP / "public/mesh/surrounding-berlin-v159"
SOURCE = ROOT / "geo_data/regierungsviertel/park-paths-v329-source.json.gz"
OUTPUT = APP / "src/data/parkPathsV329Packets.json"
KIND = "park-paths-v329"
EXCLUDED = {"3_-3", "4_-3"}
MATERIALS = {
  "asphalt": (128, 135, 130),
  "paving_stones": (174, 169, 155),
  "sett": (157, 151, 139),
  "cobblestone": (157, 151, 139),
  "pebblestone": (159, 155, 144),
  "concrete": (176, 180, 171),
  "concrete:plates": (176, 180, 171),
  "grass_paver": (157, 164, 137),
  "ground": (158, 136, 110),
  "dirt": (158, 136, 110),
  "earth": (158, 136, 110),
  "sand": (214, 197, 152),
  "wood": (155, 131, 99),
}
EXISTING_PATH = tuple(linear_rgb_bytes(np.array([COLORS["path"]]))[0])
GROUND_PALETTES = {
  tuple(p) for p in linear_rgb_bytes(np.array([COLORS["park"], COLORS["ground"]]))
}


def digest(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def nav_polygon(row, x, z):
  return shapely.make_valid(translate(Polygon(row["ring"], row["holes"]), x, z))


def world_triangles(part, origin, bounds):
  """Read an old packed part without touching any runtime-owned buffers."""
  vertices = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
  index = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
  points = vertices[index].astype(np.float64) * 0.01 + origin
  near = (
    (points[:, :, 0].max(axis=1) >= bounds[0])
    & (points[:, :, 0].min(axis=1) <= bounds[2])
    & (points[:, :, 2].max(axis=1) >= bounds[1])
    & (points[:, :, 2].min(axis=1) <= bounds[3])
  )
  return points[near], index[near]


def raw_floors(raw, scope):
  """Only literal horizontal, uniform-colour originals establish a path floor."""
  floors = defaultdict(list)
  path = defaultdict(list)
  base = raw["nav"]["groundY"]
  for part in raw["meshes"]:
    if part["kind"] != "city" or part.get("colorType", "u8") != "u8":
      continue
    faces, indices = world_triangles(part, raw["origin"], scope.bounds)
    colors = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
    for xyz, ix in zip(faces, indices, strict=True):
      if xyz[0, 1] != xyz[1, 1] or xyz[0, 1] != xyz[2, 1]:
        continue
      if not np.all(colors[ix] == colors[ix[0]]):
        continue
      color, y = tuple(colors[ix[0]]), round(xyz[0, 1], 2)
      if color == EXISTING_PATH and abs(y - base - 0.12) < 0.005:
        target = path
      elif color in GROUND_PALETTES and -0.005 <= y - base <= 0.015:
        target = floors
      else:
        continue
      triangle = Polygon(xyz[:, [0, 2]])
      if triangle.area > 1e-8 and triangle.intersects(scope):
        target[y].append(triangle.intersection(scope))
  return {
    "ground": {y: polygonal(unary_union(v)) for y, v in floors.items()},
    "path": {y: polygonal(unary_union(v)) for y, v in path.items()},
  }


def earlier_support(parts, origin, scope):
  """Mask the exact projected old finer recipes, including bridges and kerbs."""
  triangles = []
  for part in parts:
    faces, _ = world_triangles(part, origin, scope.bounds)
    for p in shapely.polygons(faces[:, :, [0, 2]]):
      if p.area > 1e-8 and p.intersects(scope):
        triangles.append(p.intersection(scope))
  return polygonal(unary_union(triangles))


def square_raster(area):
  """Only full .5 m grid squares on physically retained native support."""
  rectangles = []
  for component in shapely.get_parts(area):
    if component.is_empty or component.area < 0.25:
      continue
    x0, z0, x1, z1 = component.bounds
    xs = np.arange(math.floor(x0 * 2), math.ceil(x1 * 2))
    for zi in range(math.floor(z0 * 2), math.ceil(z1 * 2)):
      cells = shapely.box(xs / 2, zi / 2, (xs + 1) / 2, (zi + 1) / 2)
      covered = shapely.covers(component, cells)
      gaps = np.flatnonzero(np.diff(np.r_[False, covered, False]))
      for a, b in zip(gaps[::2], gaps[1::2], strict=True):
        rectangles.append(box(xs[a] / 2, zi / 2, (xs[b - 1] + 1) / 2, (zi + 1) / 2))
  return polygonal(unary_union(rectangles)).simplify(0)


def material_width(tags, mode):
  width = road_width_m(tags)
  if width is None or width > 12:
    return None
  # The full old path is already exact. A new material reading can extend
  # only into that footprint; the Native original may be at most one cell
  # wider because it was rasterized on a coarser grid.
  return width / 2 + (0.50 if mode == "minecraft" else 0.02)


def compile_tile(raw, mode, parks, names, receipt, gaps):
  ox, _, oz = raw["origin"]
  nav = raw["nav"]
  extents = unary_union([shape(parks[name]["boundary"]) for name in names])
  surface_domain = polygonal(
    unary_union([nav_polygon(r, ox, oz) for r in nav["ground"]])
  ).intersection(extents)
  if surface_domain.is_empty:
    return None
  prior = earlier_support(receipt["priorAdditions"], raw["origin"], surface_domain)
  obstacles = polygonal(
    unary_union(
      [
        g
        for key in ("buildings", "water", "bridges")
        for row in nav.get(key, [])
        if (g := nav_polygon(row, ox, oz)).intersects(surface_domain)
      ]
    )
  )
  road = polygonal(
    unary_union(
      [
        g
        for row in nav.get("roads", [])
        if (g := nav_polygon(row, ox, oz)).intersects(surface_domain)
      ]
    )
  )
  excluded = unary_union([prior, obstacles]).buffer(0.035)
  substrates = raw_floors(raw, surface_domain)
  mesh = PackedMesh(ox, oz)
  overlays = {"gap": [], "material": []}
  stats, used = [], set()
  for purpose in ("gap", "material"):
    if purpose == "gap":
      sources = {name: set(gaps.get(name, [])) for name in names}
      floors = {
        y: g.difference(excluded).difference(road.buffer(0.025))
        for y, g in substrates["ground"].items()
      }
    else:
      sources = {
        name: {
          p["id"] for p in parks[name]["paths"] if p["tags"].get("surface") in MATERIALS
        }
        for name in names
      }
      floors = {y: g.difference(excluded) for y, g in substrates["path"].items()}
    for y, physical in sorted(floors.items()):
      for name in names:
        if not sources[name]:
          continue
        official = shape(parks[name]["boundary"])
        fitted = physical.intersection(official).buffer(-0.012)
        if fitted.is_empty:
          continue
        painted = Polygon()
        nearby = fitted.buffer(7)
        for item in parks[name]["paths"]:
          if item["id"] not in sources[name]:
            continue
          tags = item["tags"]
          line = shape(item["geometry"])
          if not line.intersects(nearby):
            continue
          width = road_width_m(tags) if purpose == "gap" else material_width(tags, mode)
          if width is None or not 0.30 <= width <= 12:
            continue
          color = MATERIALS.get(tags.get("surface"), COLORS["path"])
          area_tag = tags.get("area") == "yes"
          if area_tag:
            if not line.is_ring:
              continue
            strip = Polygon(line.coords)
            if not strip.is_valid:
              continue
          elif purpose == "gap":
            axes = [
              part
              for part in line_parts(line.intersection(fitted))
              if part.length >= 2.5
            ]
            if not axes:
              continue
            strip = unary_union([a.buffer(width / 2, quad_segs=3) for a in axes])
          else:
            strip = line.buffer(width, cap_style="flat", quad_segs=3)
          area = polygonal(strip.intersection(fitted).difference(painted))
          if mode == "minecraft":
            area = square_raster(area)
          if area.area < 0.75:
            continue
          mesh.surface(area, round(y + 0.01, 2), color)
          painted = unary_union([painted, area])
          overlays[purpose].append(area)
          used.add(item["id"])
          stats.append(
            {
              "park": name,
              "id": item["id"],
              "purpose": purpose,
              "areaM2": round(area.area, 3),
              "substrateY": y,
              "widthSource": "mapped-area" if area_tag else road_width_source(tags),
              "surface": tags.get("surface"),
            }
          )
  append = mesh.payload(KIND)
  if append is None:
    return None
  vertices, indices = len(mesh.vertices), len(mesh.indices)
  if vertices > 25_000 or indices > 180_000 or len(used) > 512:
    raise ValueError("Park work exceeds its finite packet allowance")
  plan = {
    **{
      key: receipt[key]
      for key in ("navGuard", "lineGuard", "preparedNavGuard", "preparedLineGuard")
    },
    "origin": raw["origin"],
    "records": [
      {"mesh": i, "kind": m["kind"], "fingerprint": fingerprint(m)}
      for i, m in enumerate(raw["meshes"])
    ],
    "append": append,
    "appendFingerprint": fingerprint(append),
    "retire": [],
    "owners": sorted(used),
  }
  return plan, {
    "vertices": vertices,
    "triangles": indices // 3,
    "patches": stats,
    "overlays": {name: mapping(unary_union(areas)) for name, areas in overlays.items()},
  }


def compile_all(source):
  jobs, packets = [], {}
  for key, pinned in source["packets"].items():
    mode, chunk = key.split(":")
    if chunk in EXCLUDED or mode not in ("drawn", "minecraft"):
      raise ValueError("Unexpected source scope")
    path = PACKETS / pinned["path"]
    if digest(path) != pinned["sha256"]:
      raise ValueError(f"Changed original packet bytes {key}")
    raw = read(path)
    if not any(part["kind"] == "city" for part in raw["meshes"]):
      continue
    jobs.append({"id": chunk, "mode": mode, "path": str(path)})
    packets[key] = raw
  command = ["bun", str(APP / "scripts/capture-park-path-predecessors-v329.ts")]
  p = subprocess.run(
    command,
    cwd=APP,
    input=json.dumps(jobs),
    text=True,
    capture_output=True,
    check=False,
  )
  if p.returncode:
    raise ValueError(p.stderr)
  receipts = {
    row["key"]: row for line in p.stdout.splitlines() if (row := json.loads(line))
  }
  plans, audit = {}, {}
  for key, raw in packets.items():
    pin = source["packets"][key]
    part = compile_tile(
      raw, key.split(":")[0], source["parks"], pin["parks"], receipts[key], pin["gaps"]
    )
    if part:
      plans[key], audit[key] = part
  return {"schemaVersion": 1, "keys": list(plans), "packets": plans}, audit


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--output", type=Path, default=OUTPUT)
  parser.add_argument("--audit", type=Path)
  args = parser.parse_args()
  plan, audit = compile_all(read(SOURCE))
  if not plan["keys"]:
    raise ValueError("No source-owned park path surfaces")
  write(args.output, plan)
  if args.audit:
    write(args.audit, audit)
  print(
    json.dumps(
      {
        "recipes": len(plan["keys"]),
        "patches": sum(len(a["patches"]) for a in audit.values()),
      }
    )
  )


if __name__ == "__main__":
  main()
