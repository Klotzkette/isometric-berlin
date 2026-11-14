"""Stage complete Britz shells, local facades and mapped garden surfaces."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import subprocess
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_marzahn_gardens_v330 import (
  disjoint_materials,
  geometry_tiles,
  nav_shape,
  packed_item,
  packet,
  packets_for,
  surface_sources,
)
from scripts.build_public_institutions_v326 import merged_cell_faces, native_columns
from scripts.build_surrounding_outlines import navigation_polygons, polygonal
from scripts.capture_britz_sites_v342 import OUT as SOURCE
from scripts.capture_britz_sites_v342 import ROOT, read, write
from scripts.marzahn_garden_context_geometry_v330 import draw_trees, quad
from scripts.marzahn_garden_landmarks_v330 import fitted_boxes

PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
BASE = "5566e5db"
EVIDENCE = ROOT / "geo_data/regierungsviertel/britz-sites-v342-evidence.json"
CREAM = (226, 217, 181)
GREEN = (43, 76, 62)
SLATE = (95, 96, 93)
GLASS = (66, 91, 103)
WHITE = (222, 222, 205)
BLUE = (92, 132, 177)
BRICK = (154, 93, 61)
STONE = (145, 143, 125)
ROOF_RED = (168, 99, 62)
SCHLOSS = "DEBE08YYF0001Us4"
KIRCHE = "DEBE08YYF0001U2a"
SCHWEIZER = "DEBE08YYF0001gcj"
RGB = tuple[int, int, int]
XYZ = tuple[float, float, float]
Triangle = tuple[list[XYZ], RGB]


def original(path: Path) -> bytes:
  """Read only immutable pre-correction publication inputs."""
  return subprocess.check_output(
    ["git", "show", f"{BASE}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def prior_state(scope: Any) -> tuple[dict, dict, dict, list]:
  """Retain complete previous geometry and per-family identities untouched."""
  baseline = json.loads(original(PUBLIC / "manifest.json"))
  owners, old_ground, pins = {}, {False: [], True: []}, []
  for descriptor in baseline["chunks"]:
    if not box(*descriptor["bounds"]).intersects(scope):
      continue
    for native, family in ((False, "drawn"), (True, "minecraft")):
      path = PUBLIC / descriptor[family]["url"]
      raw = original(path)
      payload = json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)
      x, _, z = payload["origin"]
      for row in payload["nav"].get("buildings", []):
        g = Polygon(
          [(a + x, b + z) for a, b in row["ring"]],
          [[(a + x, b + z) for a, b in h] for h in row.get("holes", [])],
        )
        if g.intersects(scope):
          owners.setdefault(row.get("parentId", row.get("sourceId")), set()).add(family)
      for row in payload["nav"].get("ground", []):
        old_ground[native].append(
          Polygon(
            [(a + x, b + z) for a, b in row["ring"]],
            [[(a + x, b + z) for a, b in h] for h in row.get("holes", [])],
          )
        )
      pins.append(
        {"path": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(raw).hexdigest()}
      )
  return baseline, owners, {k: unary_union(v) for k, v in old_ground.items()}, pins


def role(family: dict) -> tuple[str, RGB, RGB, int]:
  """Assign only documented site palettes, never a random rainbow."""
  if family["id"] == SCHLOSS:
    return "schloss", CREAM, SLATE, 2
  if family["id"] == KIRCHE:
    return "kirche", STONE, ROOF_RED, 1
  if family["id"] == SCHWEIZER:
    return "schweizer", (216, 198, 163), ROOF_RED, 2
  if family["site"] == "hufeisen":
    return "hufeisen", WHITE, (98, 103, 105), 3
  if family["site"] == "schlossGutshof":
    return "gutshof", (181, 146, 104), ROOF_RED, 2
  return "context", (202, 194, 168), ROOF_RED, 2


def panel(
  triangles: list,
  point: Any,
  u0: float,
  u1: float,
  y0: float,
  y1: float,
  depth: float,
  color: RGB,
) -> None:
  """Add a small exposed architectural plane on a verified source wall."""
  vertices = [
    point(u0, y0, depth),
    point(u1, y0, depth),
    point(u1, y1, depth),
    point(u0, y1, depth),
  ]
  normal = np.cross(
    np.subtract(vertices[1], vertices[0]), np.subtract(vertices[2], vertices[0])
  )
  outward = np.subtract(point(0, 0, 1), point(0, 0, 0))
  if np.dot(normal, outward) < 0:
    vertices.reverse()
  quad(triangles, *vertices, color)


def window(
  triangles: list, point: Any, u: float, y: float, w: float, h: float, kind: str
) -> None:
  """Render sill, reveals and visible joinery, using illustrative small sizes."""
  if kind == "kirche":
    # The documented lancet windows have pointed brick heads, not rectangular
    # modern openings. Every small point remains inside the proven wall mask.
    for extra, depth, color in ((0.12, 0.025, BRICK), (0.0, 0.045, GLASS)):
      outline = [
        (u - w / 2 - extra, y),
        (u + w / 2 + extra, y),
        (u + w / 2 + extra, y + h * 0.72),
        (u + w * 0.28, y + h * 0.91 + extra),
        (u, y + h + extra),
        (u - w * 0.28, y + h * 0.91 + extra),
        (u - w / 2 - extra, y + h * 0.72),
      ]
      for t in shapely.constrained_delaunay_triangles(Polygon(outline)).geoms:
        pts = [point(a, b, depth) for a, b in list(t.exterior.coords)[:3]]
        normal = np.cross(np.subtract(pts[1], pts[0]), np.subtract(pts[2], pts[0]))
        outward = np.subtract(point(0, 0, 1), point(0, 0, 0))
        if np.dot(normal, outward) < 0:
          pts.reverse()
        triangles.append((pts, color))
    panel(triangles, point, u - 0.035, u + 0.035, y, y + h * 0.90, 0.07, (79, 89, 82))
    return
  border = BRICK if kind == "kircheNative" else (218, 215, 196)
  panel(
    triangles,
    point,
    u - w / 2 - 0.11,
    u + w / 2 + 0.11,
    y - 0.1,
    y + h + 0.1,
    0.025,
    border,
  )
  panel(triangles, point, u - w / 2, u + w / 2, y, y + h, 0.045, GLASS)
  frame = GREEN if kind == "schloss" else (201, 205, 192)
  panel(triangles, point, u - 0.035, u + 0.035, y, y + h, 0.07, frame)
  for f in (0.35, 0.70):
    panel(
      triangles,
      point,
      u - w / 2,
      u + w / 2,
      y + h * f - 0.025,
      y + h * f + 0.025,
      0.075,
      frame,
    )
  panel(
    triangles,
    point,
    u - w / 2 - 0.12,
    u + w / 2 + 0.12,
    y - 0.12,
    y - 0.02,
    0.15,
    border,
  )
  if kind == "schloss":
    for side in (-1, 1):
      a, b = sorted((u + side * (w / 2 + 0.08), u + side * (w + 0.03)))
      panel(triangles, point, a, b, y, y + h, 0.08, GREEN)
      for j in range(1, 9):
        panel(
          triangles,
          point,
          a,
          b,
          y + h * j / 9,
          y + h * j / 9 + 0.025,
          0.09,
          (69, 97, 73),
        )


def drawn_fittings(
  family: dict,
  part: dict,
  shift: float,
  triangles: list,
  scope: Any,
  balcony_floors: list,
  balcony_barriers: list,
) -> dict:
  """Fit complete front rhythms into the actual projected source wall sheets."""
  kind, _, _, floors = role(family)
  house = shape(family["footprint"])
  stats = {"windows": 0, "balconies": 0, "wallSheets": 0}
  base = part["ground_y_m"] + shift
  for surface in part["surfaces"]:
    if surface["kind"] != "WallSurface":
      continue
    ring = surface["rings"][0]
    pairs = [(math.hypot(a[0] - b[0], a[2] - b[2]), a, b) for a in ring for b in ring]
    length, a, b = max(pairs)
    if length < 3.0:
      continue
    tx, tz = (b[0] - a[0]) / length, (b[2] - a[2]) / length
    nx, nz = -tz, tx
    cx, cz = (a[0] + b[0]) / 2, (a[2] + b[2]) / 2
    if house.covers(Point(cx + nx * 0.15, cz + nz * 0.15)):
      nx, nz = -nx, -nz
    if house.covers(Point(cx + nx * 0.18, cz + nz * 0.18)):
      continue  # An internal party wall is not a facade.
    uv = [
      [((p[0] - a[0]) * tx + (p[2] - a[2]) * tz, p[1] + shift) for p in r]
      for r in surface["rings"]
    ]
    wall = shapely.make_valid(Polygon(uv[0], uv[1:]))
    low, high = wall.bounds[1], wall.bounds[3]
    if high - max(low, base) < 2.8:
      continue

    def point(u: float, y: float, d: float = 0) -> XYZ:
      return (a[0] + tx * u + nx * d, y, a[2] + tz * u + nz * d)

    step = 4.8 if kind == "kirche" else (3.7 if kind == "schloss" else 3.2)
    cols = max(1, round(length / step))
    heights = [base + 0.9 + j * 3.05 for j in range(floors)]
    if kind == "kirche":
      heights = [base + 1.2]
    for y in heights:
      h = 3.0 if kind == "kirche" else (1.65 if kind == "schloss" else 1.55)
      w = 1.1 if kind == "kirche" else 1.25
      for j in range(cols):
        u = (j + 0.5) * length / cols
        if not wall.covers(
          box(u - w / 2 - 0.15, y - 0.15, u + w / 2 + 0.15, y + h + 0.15)
        ):
          continue
        window(triangles, point, u, y, w, h, kind)
        stats["windows"] += 1
    if kind in ("schloss", "gutshof", "schweizer"):
      for y in (base + 0.35, base + 3.0, base + 6.2):
        if wall.covers(box(0.05, y, length - 0.05, y + 0.16)):
          panel(
            triangles,
            point,
            0.05,
            length - 0.05,
            y,
            y + 0.16,
            0.10,
            (200, 190, 157) if kind == "schloss" else (149, 108, 76),
          )
    # Horseshoe garden facades: blue open loggia frames. Their supporting
    # footprint is a real source wall; the projection depth is a visual estimate.
    if kind == "hufeisen" and length >= 12:
      toward = nx * (5060 - cx) + nz * (7975 - cz)
      u, width, depth = length * 0.5, 3.0, 1.05
      if toward > 8:
        proj = Polygon(
          [
            (point(u - width / 2, 0, 0)[0], point(u - width / 2, 0, 0)[2]),
            (point(u + width / 2, 0, 0)[0], point(u + width / 2, 0, 0)[2]),
            (point(u + width / 2, 0, depth)[0], point(u + width / 2, 0, depth)[2]),
            (point(u - width / 2, 0, depth)[0], point(u - width / 2, 0, depth)[2]),
          ]
        )
        for y in (base + 3.0, base + 6.05, base + 9.1):
          if not wall.covers(
            box(u - width / 2, y - 0.1, u + width / 2, y + 1.0)
          ) or not scope.covers(proj):
            continue
          panel(
            triangles, point, u - width / 2, u + width / 2, y, y + 0.78, depth, BLUE
          )
          for side in (-1, 1):
            v = u + side * width / 2
            quad(
              triangles,
              point(v, y, 0),
              point(v, y, depth),
              point(v, y + 2.5, depth),
              point(v, y + 2.5, 0),
              BLUE,
            )
          quad(
            triangles,
            point(u - width / 2, y, 0),
            point(u + width / 2, y, 0),
            point(u + width / 2, y, depth),
            point(u - width / 2, y, depth),
            (127, 143, 158),
          )
          panel(
            triangles,
            point,
            u - width / 2,
            u + width / 2,
            y + 0.82,
            y + 0.88,
            depth,
            (52, 57, 55),
          )
          balcony_floors.append((proj, y))
          corners = list(proj.exterior.coords)
          for edge in (
            LineString(corners[1:3]),
            LineString(corners[2:4]),
            LineString([corners[3], corners[0]]),
          ):
            balcony_barriers.append(
              (
                edge.buffer(0.035, cap_style="flat"),
                y,
                y + (0.88 if edge.equals(LineString(corners[2:4])) else 2.5),
              )
            )
          stats["balconies"] += 1
    if kind == "kirche":
      # Small irregular grey fieldstone courses retain the public photograph's
      # material character. Individual stones are illustrative, not surveyed.
      for row in range(math.ceil(max(0, high - base) / 0.47)):
        y = base + row * 0.47 + 0.05
        for col in range(math.ceil(length / 0.72)):
          u = col * 0.72 + (row % 2) * 0.32
          slab = box(u, y, u + 0.55, y + 0.34)
          if wall.covers(slab):
            color = [
              (132, 135, 121),
              (157, 151, 133),
              (119, 127, 122),
              (166, 159, 139),
            ][(row * 7 + col * 3) % 4]
            panel(triangles, point, u, u + 0.55, y, y + 0.34, 0.008, color)
    stats["wallSheets"] += 1
  return stats


def native_fittings(triangles: list, shell: list, kind: str, base: float) -> int:
  """Use exposed cardinal shell rectangles, independently of Drawn windows."""
  count = 0
  for i in range(0, len(shell), 2):
    tri, _ = shell[i]
    pts = np.asarray(tri)
    spread = np.ptp(pts, axis=0)
    axis = 0 if spread[0] < 0.001 else (2 if spread[2] < 0.001 else None)
    if axis is None or spread[1] < 5.5:
      continue
    horizontal = 2 if axis == 0 else 0
    length = spread[horizontal]
    if length < 3:
      continue
    normal = np.cross(pts[1] - pts[0], pts[2] - pts[0])
    sign = 1 if normal[axis] > 0 else -1
    fixed = pts[0, axis] + sign * 0.04
    start = min(pts[:, horizontal])

    def point(u: float, y: float, d: float = 0) -> XYZ:
      p = [0.0, y, 0.0]
      p[axis] = fixed + sign * d
      p[horizontal] = start + u
      return tuple(p)

    if kind == "hufeisen" and length >= 8:
      center = [float(np.mean(pts[:, 0])), float(np.mean(pts[:, 2]))]
      toward = sign * ((5060 - center[0]) if axis == 0 else (7975 - center[1]))
      if toward > 6:
        for y in (base + 3, base + 6, base + 9):
          if y + 1 < max(pts[:, 1]):
            panel(
              triangles,
              point,
              length / 2 - 1.4,
              length / 2 + 1.4,
              y,
              y + 0.7,
              0.12,
              BLUE,
            )
            for side in (-1, 1):
              u = length / 2 + side * 1.4
              panel(
                triangles,
                point,
                u - 0.12,
                u + 0.12,
                y,
                min(y + 2.5, max(pts[:, 1]) - 0.1),
                0.12,
                BLUE,
              )
    cols = max(1, math.floor(length / 3))
    low, high = min(pts[:, 1]), max(pts[:, 1])
    for y in (base + 1, base + 4, base + 7):
      if y < low + 0.3 or y + 1.6 > high - 0.3:
        continue
      for j in range(cols):
        u = (j + 0.5) * length / cols
        window(
          triangles, point, u, y, 1.1, 1.5, "kircheNative" if kind == "kirche" else kind
        )
        count += 1
  return count


def discard_quantized_zero_area(mesh: Any) -> None:
  """Drop only exactly collinear new triangles created by centimetre rounding."""
  words = np.asarray(list(mesh.vertices), dtype=np.int64)[:, :3]
  indices = np.asarray(mesh.indices, dtype=np.int64).reshape(-1, 3)
  normal = np.cross(
    words[indices[:, 1]] - words[indices[:, 0]],
    words[indices[:, 2]] - words[indices[:, 0]],
  )
  mesh.indices = indices[np.any(normal != 0, axis=1)].ravel().tolist()


def build(output: Path) -> dict:
  """Stage only new finite packets; all preceding packets remain byte-exact."""
  source = read(SOURCE)
  scope = shape(source["scope"])
  baseline, old, old_ground, pins = prior_state(scope)
  prior = nav_shape(baseline["footprint"])
  domain = polygonal(scope.difference(prior.union(old_ground[False])))
  native_domain = fitted_boxes(domain.difference(old_ground[True]), 1, True)
  layers, roads, trees = surface_sources(source["osm"]["records"], scope)
  # Small mapped domestic gardens should read as green plots, not default grey.
  gardens = unary_union(
    [
      shape(r["geometry"])
      for r in source["osm"]["records"]
      if r["tags"].get("leisure") == "garden"
    ]
  )
  layers["lawn"] = layers["lawn"].union(gardens.intersection(scope))
  emitted, owners = {}, {}
  report = {
    "baseline": BASE,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "priorPackets": pins,
    "retainedExistingFamilies": sorted(old),
    "modes": {},
  }
  for native in (False, True):
    family_name = "minecraft" if native else "drawn"
    terrain_scope = native_domain if native else domain
    triangles, solids, buildings, nav_details = [], [], [], {}
    balcony_floors, balcony_barriers = [], []
    tallies = defaultdict(int)
    for family in source["lod2"]["families"]:
      if family["id"] in old:
        continue
      kind, wall_color, roof_color, _ = role(family)
      # One family-wide rigid vertical datum preserves all relative sheet heights.
      family_low = min(p["ground_y_m"] for p in family["parts"])
      shift = 3 - family_low
      owners[family["id"]] = {
        "site": family["site"],
        "role": kind,
        "parts": [p["id"] for p in family["parts"]],
      }
      for part in family["parts"]:
        footprint = Polygon(part["ring"], part["holes"])
        sheets = [
          (
            s["kind"],
            [[(x, y + shift, z) for x, y, z in t] for t in triangles_for(s["rings"])],
          )
          for s in part["surfaces"]
        ]
        low, high = part["ground_y_m"] + shift, part["top_y_m"] + shift
        roofs = [t for k, ts in sheets if k == "RoofSurface" for t in ts]
        if native:
          size, cells = native_columns(
            {**part, "groundY": part["ground_y_m"]}, footprint, sheets, shift
          )
          colored = {
            cell: roof_color if rgb == (157, 151, 140) else wall_color
            for cell, rgb in cells.items()
          }
          shell = list(merged_cell_faces(colored, size))
          triangles.extend(shell)
          # Independent exposed rectangle composition; orthogonal throughout.
          tallies["windows"] += native_fittings(triangles, shell, kind, low)
          columns = defaultdict(list)
          for x, y, z in cells:
            columns[x, z].append(y)
          footprint = unary_union(
            [
              box(x * size, z * size, (x + 1) * size, (z + 1) * size)
              for x, z in columns
            ]
          )
          low, high = (
            min(y for _, y, _ in cells) * size,
            (max(y for _, y, _ in cells) + 1) * size,
          )
          caps = [
            (x * size, z * size, (x + 1) * size, (z + 1) * size, (max(ys) + 1) * size)
            for (x, z), ys in columns.items()
          ]
          nav_details[part["id"]] = {"caps": caps, "low": low, "parent": family["id"]}
          tallies["nativeColumns"] += len(columns)
        else:
          triangles.extend(
            (t, roof_color if k == "RoofSurface" else wall_color)
            for k, ts in sheets
            for t in ts
          )
          for k, v in drawn_fittings(
            family, part, shift, triangles, scope, balcony_floors, balcony_barriers
          ).items():
            tallies[k] += v
          nav_details[part["id"]] = {"roof": roofs, "low": low, "parent": family["id"]}
        buildings.append((part["id"], footprint, low, high - low, False))
        tallies["leaves"] += 1
    exclusion = unary_union(
      [shape(f["footprint"]) for f in source["lod2"]["families"]]
    ).buffer(0.25)
    tree_triangles, tree_solids = draw_trees(
      trees,
      lambda x, z: 3 if terrain_scope.covers(Point(x, z)) else None,
      native,
      exclusion,
    )
    triangles.extend(tree_triangles)
    solids.extend(tree_solids)
    tallies["trees"] = len(tree_solids)
    water = fitted_boxes(layers["water"], 1, True) if native else layers["water"]
    materials = disjoint_materials({**layers, "water": water}, terrain_scope, native)
    by_tile = geometry_tiles(triangles)
    x0, z0, x1, z1 = scope.bounds
    for ix in range(math.floor(x0 / 512), math.ceil(x1 / 512)):
      for iz in range(math.floor(z0 / 512), math.ceil(z1 / 512)):
        local = terrain_scope.intersection(
          box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
        )
        if local.is_empty and (ix, iz) not in by_tile:
          continue
        grid = {
          "origin": [ix * 512, iz * 512],
          "cols": 129,
          "rows": 129,
          "stepM": 4,
          "heightsCm": [300] * 16641,
          "nativeHeightsCm": [300] * 16384,
        }
        terrain = {"grid": grid}
        meta, ground, details = packet(
          terrain,
          terrain_scope,
          terrain_scope,
          materials,
          water,
          roads,
          by_tile.get((ix, iz), []),
          solids,
          buildings,
          balcony_floors,
          balcony_barriers,
          lambda x, z: 3,
          (ix, iz),
          native,
        )
        for row in meta["nav"]["buildings"]:
          proof = nav_details.get(row["sourceId"])
          if proof is None:
            continue
          row["parentId"] = proof["parent"]
          row["heightSource"] = "complete-official-family-britz-v342"
          if native:
            row["nativeRoofCaps"] = [
              [a - ix * 512, b - iz * 512, c - ix * 512, d - iz * 512, y - proof["low"]]
              for a, b, c, d, y in proof["caps"]
              if c > ix * 512
              and a < (ix + 1) * 512
              and d > iz * 512
              and b < (iz + 1) * 512
            ]
          else:
            row["roofTriangles"] = [
              [[x - ix * 512, y - proof["low"], z - iz * 512] for x, y, z in t]
              for t in proof["roof"]
            ]
        discard_quantized_zero_area(ground)
        discard_quantized_zero_area(details)
        identity = f"britz342-{ix}_{iz}"
        emitted.setdefault(
          identity,
          {
            "id": identity,
            "bounds": [ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512],
            "origin": meta["origin"],
          },
        )[family_name] = packets_for(meta, ground, details)
    report["modes"][family_name] = dict(tallies)
  descriptors = []
  for identity, row in sorted(emitted.items()):
    for index in range(max(len(row[f]) for f in ("drawn", "minecraft"))):
      key = identity if not index else f"{identity}-p{index}"
      descriptor = {"id": key, "bounds": row["bounds"]}
      if index:
        descriptor["detailCompanionOf"] = identity
      for family_name in ("drawn", "minecraft"):
        if index < len(row[family_name]):
          raw, packed = row[family_name][index]
        else:
          raw, packed = packed_item(
            {
              "schemaVersion": 1,
              "origin": row["origin"],
              "nav": {"ground": [], "water": [], "buildings": [], "groundY": 3},
            },
            [],
          )
        filename = f"{key}.{family_name}.json.gz"
        output.mkdir(parents=True, exist_ok=True)
        (output / filename).write_bytes(packed)
        descriptor[family_name] = {
          "url": filename,
          "bytes": len(packed),
          "decodedBytes": len(raw),
          "encoding": "gzip",
          "sha256": hashlib.sha256(packed).hexdigest(),
        }
      descriptors.append(descriptor)
  delta = {
    "chunks": descriptors,
    "footprint": navigation_polygons(domain, 0, 0),
    "groundPrimaryIds": list(emitted),
    "sourceScope": mapping(scope),
    "newAreaM2": domain.area,
    "nativeAreaM2": native_domain.area,
    "nativeFootprint": navigation_polygons(native_domain, 0, 0),
    "oldFootprintCount": len(baseline["footprint"]),
    "baseline": BASE,
  }
  write(output / "britz342-manifest-delta.json", delta)
  report.update(
    {
      "owners": owners,
      "areaM2": domain.area,
      "nativeAreaM2": native_domain.area,
      "descriptors": len(descriptors),
      "gzipBytes": sum(
        d[f]["bytes"] for d in descriptors for f in ("drawn", "minecraft")
      ),
    }
  )
  write(EVIDENCE, report)
  print(
    json.dumps({k: report[k] for k in ("descriptors", "gzipBytes", "modes", "areaM2")})
  )
  return report


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out", type=Path, required=True)
  build(parser.parse_args().out)
