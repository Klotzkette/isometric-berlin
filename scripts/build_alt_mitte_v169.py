"""Publish complete Alt-Mitte building families without replacing unrelated detail.

Measured core envelopes are resident before interaction. Fine facade additions
and outer buildings use bounded spatial packets. All inputs and subtraction
owners are anchored to immutable v1.0.68, making reruns idempotent.
"""

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

import geopandas as gpd
import numpy as np
import shapely
from alt_mitte_v169_packets import (
  append_ink,
  distribute,
  empty_packet,
  pack_detail,
  save_packet,
  triangles,
)
from build_concert_halls_v160 import normal_of
from build_karl_marx_allee_v161 import Detail, mesh_signature, native_detail
from build_scheunenviertel_v168 import merge_native_faces
from build_surrounding_outlines import (
  DEFAULT_OUTPUT,
  ROOT,
  chunk_payload,
  earcut_fallback,
  load_projected_polygon,
  navigation_polygons,
  world,
)
from integrate_city_refinements_v166 import (
  line_signature,
  subtract_lines,
  subtract_meshes,
)
from shapely.errors import GEOSException
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import polygons_from_geometry

SOURCE = ROOT / "geo_data/regierungsviertel/alt-mitte-v169"
APP_DATA = ROOT / "src/app/src/data"
BASE = "v1.0.68"
GLASS = (82, 108, 115)
STONE = (221, 216, 200)
FRAME = (91, 92, 87)
APPEARANCE: dict[str, dict] = {}


def triangulate(rings: list) -> list:
  """Keep source vertices/holes, with independently checked Earcut fallback."""
  normal = normal_of(rings[0])
  if not np.isfinite(normal).all():
    raise ValueError("Degenerate source plane must be audited, never silently lost")
  omitted = int(np.argmax(np.abs(normal)))
  axes = [i for i in range(3) if i != omitted]
  projection = [[(p[axes[0]], p[axes[1]]) for p in ring] for ring in rings]
  polygon = Polygon(projection[0], projection[1:])
  valid = shapely.make_valid(polygon)
  polygons = list(polygons_from_geometry(valid))
  lookup = {
    tuple(q): p
    for ring, projected in zip(rings, projection, strict=True)
    for p, q in zip(ring, projected, strict=True)
  }
  triangles_2d = []
  for poly in polygons:
    try:
      triangles_2d.extend(shapely.constrained_delaunay_triangles(poly).geoms)
    except GEOSException:
      triangles_2d.extend(earcut_fallback(poly))
  coverage = unary_union(triangles_2d)
  assert coverage.symmetric_difference(valid).area <= max(1e-5, valid.area * 1e-9)

  def lift(q: tuple) -> list:
    if q in lookup:
      return lookup[q]
    # make_valid can split a self-intersection. Interpolate that point on its
    # original source edge; never replace the roof by a fitted flat rectangle.
    for ring, projected in zip(rings, projection, strict=True):
      for i, a in enumerate(projected):
        j = (i + 1) % len(ring)
        b = projected[j]
        delta = np.subtract(b, a)
        denominator = float(np.dot(delta, delta))
        if denominator < 1e-15:
          continue
        t = float(np.dot(np.subtract(q, a), delta) / denominator)
        if (
          -1e-8 <= t <= 1 + 1e-8
          and np.linalg.norm(np.asarray(a) + t * delta - q) < 1e-7
        ):
          return (np.asarray(ring[i]) + t * (np.asarray(ring[j]) - ring[i])).tolist()
    raise ValueError(f"Triangulation introduced a non-source-edge point: {q}")

  result = []
  for triangle in triangles_2d:
    points = [lift(tuple(p)) for p in list(triangle.exterior.coords)[:3]]
    if (
      np.dot(
        np.cross(np.subtract(points[1], points[0]), np.subtract(points[2], points[0])),
        normal,
      )
      < 0
    ):
      points.reverse()
    result.append(points)
  return result


def encode(value: Any) -> bytes:
  """Stable UTF-8 evidence without non-finite geometry."""
  return json.dumps(
    value, separators=(",", ":"), ensure_ascii=False, allow_nan=False
  ).encode()


def base_bytes(path: Path) -> bytes:
  """Read the immutable release, never a previously modified output."""
  return subprocess.check_output(
    ["git", "show", f"{BASE}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def footprint(record: dict) -> Any:
  """Retain every exterior and courtyard ring."""
  return unary_union(
    [
      shapely.make_valid(Polygon(p["ring"], p.get("holes", [])))
      for p in record.get("footprintPolygons", [])
    ]
  )


def color_tag(value: Any) -> tuple[int, ...] | None:
  """Explicit mapped colour is evidence; unrecognised tags remain recorded."""
  if not isinstance(value, str):
    return None
  value = value.lower().strip()
  named = {
    "white": (238, 236, 226),
    "grey": (158, 160, 157),
    "gray": (158, 160, 157),
    "red": (159, 85, 66),
    "brown": (137, 111, 86),
    "beige": (216, 204, 180),
    "yellow": (222, 207, 157),
    "black": (66, 70, 72),
    "green": (111, 150, 137),
  }
  if value in named:
    return named[value]
  if value.startswith("#") and len(value) in (4, 7):
    try:
      value = value[1:]
      if len(value) == 3:
        value = "".join(c * 2 for c in value)
      return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))
    except ValueError:
      return None
  return None


def materials(record: dict) -> tuple[tuple[int, ...], tuple[int, ...], str]:
  """Mapped material/colour when present; restrained default otherwise."""
  tags = record.get("osmTags", {})
  materials = {
    "brick": (166, 119, 93),
    "sandstone": (215, 203, 171),
    "concrete": (186, 186, 176),
    "glass": (133, 163, 169),
    "plaster": (216, 210, 192),
    "stone": (200, 194, 179),
  }
  walls = color_tag(tags.get("building:colour")) or materials.get(
    tags.get("building:material")
  )
  roofs = color_tag(tags.get("roof:colour"))
  if roofs is None:
    roofs = {
      "copper": (113, 154, 139),
      "roof_tiles": (166, 112, 85),
      "slate": (102, 113, 118),
      "metal": (156, 163, 162),
    }.get(tags.get("roof:material"))
  return (
    walls or (210, 204, 186),
    roofs or (153, 155, 148),
    (
      "mapped tags with documented defaults"
      if walls or roofs
      else "neutral display estimate"
    ),
  )


def facade(rings: list, ground: float, top: float, occupied: Any) -> Detail:
  """Shallow window rhythm only on exposed source walls, never party walls.

  The rhythm is explicitly an estimate, not a window survey. There are no
  invented shop names, entrances or historic ornament. Every rectangle must
  fit entirely inside the measured plane, including its holes and gables.
  """
  result = Detail()
  n = normal_of(rings[0])
  if not np.isfinite(n).all() or abs(n[1]) > 0.05 or top - ground < 4:
    return result
  center = np.mean(rings[0], axis=0)
  # Three approach samples avoid blank party-wall windows and narrow seams.
  if any(
    occupied.covers(Point(center[0] + n[0] * d, center[2] + n[2] * d))
    for d in (0.5, 1.5, 3)
  ):
    return result
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda pair: math.hypot(pair[1][0] - pair[0][0], pair[1][2] - pair[0][2]),
  )
  dx, dz = b[0] - a[0], b[2] - a[2]
  length = math.hypot(dx, dz)
  if length < 2.4:
    return result
  dx, dz = dx / length, dz / length
  projected = [
    [((p[0] - a[0]) * dx + (p[2] - a[2]) * dz, p[1]) for p in ring] for ring in rings
  ]
  polygon = shapely.make_valid(Polygon(projected[0], projected[1:])).buffer(-0.05)
  if polygon.is_empty:
    return result
  u0, low, u1, high = polygon.bounds
  pitch = length / max(1, round(length / 3.4))

  def pane(
    u: float, y: float, w: float, h: float, color: tuple, offset: float, role: str
  ) -> None:
    rectangle = box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
    if polygon.covers(rectangle):
      result.polygon(
        [
          [a[0] + dx * x + n[0] * offset, yy, a[2] + dz * x + n[2] * offset]
          for x, yy in list(rectangle.exterior.coords)[:-1]
        ],
        color,
        role,
      )

  for y in np.arange(max(ground + 2.25, low + 1.2), min(top, high) - 0.8, 3.25):
    for u in np.arange(u0 + pitch / 2, u1, pitch):
      pane(u, y, 1.52, 2.03, STONE, 0.055, "window surround")
      pane(u, y, 1.25, 1.79, GLASS, 0.085, "window glazing")
      pane(u, y, 0.075, 1.78, FRAME, 0.11, "window mullion")
      pane(u, y - 0.91, 1.63, 0.11, STONE, 0.125, "stone window sill")
  return result


def model(record: dict, occupied: Any) -> tuple[Detail, Detail, list, list]:
  """Separate complete source shells from estimated, removable facade layers."""
  shells, fronts, nav, roofs = Detail(), Detail(), [], []
  wall, roof, _ = materials(record)
  for part in record["parts"]:
    ground_y = min(
      (
        point[1]
        for surface in part["surfaces"]
        if surface["kind"] == "GroundSurface"
        for ring in surface["rings"]
        for point in ring
      ),
      default=part["groundY"],
    )
    inherited = APPEARANCE.get(part["id"])
    part_wall = tuple(inherited["facade"]["srgb8"]) if inherited else wall
    part_roof = tuple(inherited["roof"]["srgb8"]) if inherited else roof
    for p in part.get("footprintPolygons", []):
      nav.append(
        {
          "id": part["id"],
          "sourceId": record["id"],
          **p,
          "groundY": ground_y,
          "topY": part["topY"],
        }
      )
    for surface in part["surfaces"]:
      kind, rings = surface["kind"], surface["rings"]
      if kind not in ("WallSurface", "RoofSurface", "ClosureSurface"):
        continue
      for triangle in triangulate(rings):
        shells.polygon(
          triangle, part_roof if kind == "RoofSurface" else part_wall, "source " + kind
        )
        if kind == "RoofSurface":
          roofs.append(triangle)
      if kind == "WallSurface":
        fronts.triangles.extend(
          facade(rings, ground_y, part["topY"], occupied).triangles
        )
  if not record["parts"]:
    # Explicit OSM-only residual: its old body and height remain authoritative
    # for this display. Only add window planes; no guessed official parent.
    for prism in record.get("legacyPrisms", []):
      poly = shapely.orient_polygons(
        Polygon(
          [(x / 10, z / 10) for x, z in prism["ring"]],
          [[(x / 10, z / 10) for x, z in r] for r in prism.get("holes", [])],
        ),
        exterior_cw=True,
      )
      low, high = prism["y0_dm"] / 10, (prism["y0_dm"] + prism["h_dm"]) / 10
      walls = [
        [[(ax, low, az), (bx, low, bz), (bx, high, bz), (ax, high, az)]]
        for ring in [poly.exterior, *poly.interiors]
        for (ax, az), (bx, bz) in zip(ring.coords, list(ring.coords)[1:])
      ]
      for rings in walls:
        fronts.triangles.extend(
          facade(
            rings, prism["y0_dm"] / 10, (prism["y0_dm"] + prism["h_dm"]) / 10, occupied
          ).triangles
        )
    if record["sourceType"] == "osm-outer":
      low = 3 + record["sourceAttributes"].get("minHeight", 0)
      top = 3 + record["sourceAttributes"]["height"]
      for p in record["footprintPolygons"]:
        poly = shapely.orient_polygons(
          Polygon(p["ring"], p.get("holes", [])), exterior_cw=True
        )
        for ring in [poly.exterior, *poly.interiors]:
          for (ax, az), (bx, bz) in zip(ring.coords, list(ring.coords)[1:]):
            rings = [[(ax, low, az), (bx, low, bz), (bx, top, bz), (ax, top, az)]]
            fronts.triangles.extend(facade(rings, low, top, occupied).triangles)
    if record.get("needsResidualShell"):
      low = record["groundY"]
      high = low + record["residualShellHeightM"]
      for p in record["footprintPolygons"]:
        poly = shapely.orient_polygons(
          Polygon(p["ring"], p.get("holes", [])), exterior_cw=True
        )
        nav.append(
          {
            "id": record["id"],
            "sourceId": record["id"],
            **p,
            "groundY": low,
            "topY": high,
            "heightSource": "OSM residual envelope; "
            + record["sourceAttributes"]["height_source"],
          }
        )
        for ring in [poly.exterior, *poly.interiors]:
          for (ax, az), (bx, bz) in zip(ring.coords, list(ring.coords)[1:]):
            shells.polygon(
              [[ax, low, az], [bx, low, bz], [bx, high, bz], [ax, high, az]],
              wall,
              "source WallSurface",
            )
        rings = [
          [[x, high, z] for x, z in ring.coords[:-1]]
          for ring in [poly.exterior, *poly.interiors]
        ]
        for triangle in triangulate(rings):
          if (
            np.cross(
              np.subtract(triangle[1], triangle[0]),
              np.subtract(triangle[2], triangle[0]),
            )[1]
            < 0
          ):
            triangle.reverse()
          shells.polygon(triangle, roof, "source RoofSurface")
          roofs.append(triangle)
  return shells, fronts, nav, roofs


def native_roofs(detail: Detail) -> dict[tuple[int, int], float]:
  """Exact 1m lookup of the generated 2m native upper surfaces."""
  cells: dict[tuple[int, int], float] = {}
  for points, _, _ in detail.triangles:
    a, b, c = np.asarray(points)
    n = np.cross(b - a, c - a)
    if n[1] <= 0 or max(p[1] for p in points) - min(p[1] for p in points) > 1e-7:
      continue
    p = Polygon([(p[0], p[2]) for p in points])
    x0, z0, x1, z1 = p.bounds
    for x in range(math.floor(x0), math.ceil(x1)):
      for z in range(math.floor(z0), math.ceil(z1)):
        if p.covers(Point(x + 0.5, z + 0.5)):
          cells[x, z] = max(cells.get((x, z), -math.inf), float(a[1]))
  return cells


def roof_spans(cells: dict[tuple[int, int], float]) -> list[list]:
  """Compress adjacent equal-height native roof cells without losing a cell."""
  rows: dict[tuple[int, float], list[int]] = defaultdict(list)
  for (x, z), y in cells.items():
    rows[z, y].append(x)
  spans = []
  for (z, y), xs in sorted(rows.items()):
    xs.sort()
    start = end = xs[0]
    for x in xs[1:]:
      if x == end + 1:
        end = x
      else:
        spans.append([start, z, end + 1, z + 1, y])
        start = end = x
    spans.append([start, z, end + 1, z + 1, y])
  return spans


def isometric_shading(detail: Detail) -> Detail:
  """Match the established five flat directional shades in the drawn modes."""
  result = Detail()
  for points, color, role in detail.triangles:
    a, b, c = np.asarray(points)
    n = np.cross(b - a, c - a)
    length = np.linalg.norm(n)
    if length > 1e-12:
      n = n / length
    shade = (
      1
      if n[1] > 0.55
      else 0.89
      if n[1] < -0.55
      else (
        (0.95 if n[0] > 0 else 0.89)
        if abs(n[0]) >= abs(n[2])
        else (0.92 if n[2] > 0 else 0.98)
      )
    )
    srgb = np.asarray(color) / 255
    linear = (
      np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4) * shade
    )
    shaded = np.where(
      linear <= 0.0031308, linear * 12.92, 1.055 * linear ** (1 / 2.4) - 0.055
    )
    result.triangles.append((points, tuple(np.rint(shaded * 255).astype(int)), role))
  return result


def generate(output: Path, apply: bool = False) -> dict:
  """Build one cell at a time; old geometry preservation is checked per cell."""
  output.mkdir(parents=True, exist_ok=True)
  source = json.loads((SOURCE / "source-manifest.json").read_bytes())
  appearance_file = SOURCE / "appearance-baseline.json.gz"
  appearance_bytes = (
    gzip.decompress(appearance_file.read_bytes())
    if appearance_file.exists()
    else (SOURCE / "appearance-baseline.json").read_bytes()
  )
  appearance = json.loads(appearance_bytes)
  ranks = {}
  APPEARANCE.clear()
  for previous in appearance["records"]:
    for binding in previous["bindings"]:
      for part in binding["parts"]:
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if rank > ranks.get(part["partId"], (False, -1)):
          APPEARANCE[part["partId"]] = previous
          ranks[part["partId"]] = rank
  cache_key = hashlib.sha256(
    Path(__file__).read_bytes() + encode(source) + appearance_bytes
  ).hexdigest()[:20]
  cache = Path("/tmp/v169-alt-mitte-model-cache") / cache_key
  cache.mkdir(parents=True, exist_ok=True)
  records = [
    b
    for c in source["chunks"]
    for b in json.loads(gzip.decompress((SOURCE / c["file"]).read_bytes()))["buildings"]
  ]
  all_footprints = [footprint(b) for b in records]
  occupied = unary_union(all_footprints)
  shapely.prepare(occupied)
  selected = [b for b in records if b["category"] != "retained"]
  partitions: dict[tuple[int, int], list] = defaultdict(list)
  for b in selected:
    f = footprint(b)
    if f.is_empty:
      continue
    minx, minz, maxx, maxz = f.bounds
    for ix in range(math.floor((minx - 2) / 512), math.floor((maxx + 2) / 512) + 1):
      for iz in range(math.floor((minz - 2) / 512), math.floor((maxz + 2) / 512) + 1):
        if f.distance(box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)) <= 2:
          partitions[ix, iz].append(b)
  manifest = json.loads(base_bytes(DEFAULT_OUTPUT / "manifest.json"))
  descriptors = {d["id"]: d for d in manifest["chunks"]}
  coarse = gpd.read_file(
    ROOT / "geo_data/regierungsviertel/raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
  ).to_dict("records")
  outer_ids = {
    i
    for b in selected
    if b["sourceType"] == "official-lod2"
    for i in b["outerOwnerIds"]
  }
  coarse = [b for b in coarse if b["sourceId"] in outer_ids]
  assert {b["sourceId"] for b in coarse} == outer_ids
  scope = world(
    load_projected_polygon(
      ROOT / "geo_data/regierungsviertel/bounds.geojson"
    ).difference(
      load_projected_polygon(ROOT / "geo_data/regierungsviertel/bounds-v158.geojson")
    )
  )
  core = {
    "schemaVersion": 1,
    "drawnChunks": [],
    "minecraftChunks": [],
    "sourceParents": [
      b["id"] for b in selected if b["category"] == "core" and b["parts"]
    ],
  }
  navigation = {
    "legacyPrisms": [],
    "parts": [],
    "roofTriangles": [],
    "nativeRoofCells": [],
  }
  nav_seen, roof_cells = set(), {}
  audit = {
    "version": "1.0.69",
    "baseRelease": BASE,
    "chunks": [],
    "buildings": [],
    "unownedTriangleLoss": 0,
    "unownedNavigationLoss": 0,
  }
  metadata_seen = set()
  for ix, iz in sorted(partitions):
    identity, bounds = (
      f"{ix}_{iz}",
      (ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512),
    )
    tile = box(*bounds)
    detail = {"drawn": Detail(), "minecraft": Detail()}
    resident = {"drawn": Detail(), "minecraft": Detail()}
    core_ink, outer_ink = [], []
    new_nav = []
    for b in partitions[ix, iz]:
      cached = cache / (hashlib.sha256(encode(b)).hexdigest() + ".json.gz")
      if cached.exists():
        data = json.loads(gzip.decompress(cached.read_bytes()))
        shells, fronts, native = Detail(), Detail(), Detail()
        shells.triangles, fronts.triangles, native.triangles = data[:3]
        nav, roofs, native_cells = data[3:]
        full = Detail()
        full.triangles = shells.triangles + fronts.triangles
      else:
        try:
          shells, fronts, nav, roofs = model(b, occupied)
          full = Detail()
          full.triangles = shells.triangles + fronts.triangles
          native = merge_native_faces(native_detail(full))
          native_cells = (
            [[x, z, y] for (x, z), y in native_roofs(native).items()]
            if b["category"] == "core"
            else []
          )
        except Exception as error:
          raise RuntimeError(f"Invalid generated family {b['id']}") from error
        cached.write_bytes(
          gzip.compress(
            encode(
              [
                shells.triangles,
                fronts.triangles,
                native.triangles,
                nav,
                roofs,
                native_cells,
              ]
            ),
            compresslevel=3,
            mtime=0,
          )
        )
      is_core = b["category"] == "core" and bool(b["parts"])
      ink = core_ink if is_core else outer_ink
      ink.extend(
        (a, c)
        for p in b["parts"]
        for s in p["surfaces"]
        if s["kind"] in ("WallSurface", "RoofSurface", "ClosureSurface")
        for ring in s["rings"]
        for a, c in zip(ring, ring[1:] + ring[:1])
      )
      if is_core:
        resident["drawn"].triangles.extend(shells.triangles)
        resident["minecraft"].triangles.extend(native.triangles)
        detail["drawn"].triangles.extend(fronts.triangles)
        if b["id"] not in nav_seen:
          nav_seen.add(b["id"])
          navigation["legacyPrisms"].extend(b["legacyPrisms"])
          navigation["parts"].extend(nav)
          navigation["roofTriangles"].extend(roofs)
          for x, z, y in native_cells:
            roof_cells[x, z] = max(roof_cells.get((x, z), -math.inf), y)
      else:
        detail["drawn"].triangles.extend(full.triangles)
        detail["minecraft"].triangles.extend(native.triangles)
        new_nav.extend(nav)
      if b["id"] not in metadata_seen:
        metadata_seen.add(b["id"])
        audit["buildings"].append(
          {
            "id": b["id"],
            "category": b["category"],
            "sourceType": b["sourceType"],
            "parts": [p["id"] for p in b["parts"]],
            "sourceTriangles": len(shells.triangles),
            "facadeTriangles": len(fronts.triangles),
            "nativeTriangles": len(native.triangles),
            "materialEvidence": materials(b)[2],
          }
        )
    owned = [b for b in coarse if b["geometry"].intersects(tile)]
    entry = {"id": identity, "bounds": list(bounds)}
    mode_packets = {}
    chunk_audit = {
      "id": identity,
      "owners": sorted(b["sourceId"] for b in owned),
      "modes": {},
    }
    for mode in detail:
      original = (
        json.loads(
          gzip.decompress(
            base_bytes(DEFAULT_OUTPUT / descriptors[identity][mode]["url"])
          )
        )
        if identity in descriptors
        else empty_packet(identity, bounds)
      )
      payload = json.loads(json.dumps(original))
      ground = scope.intersection(tile)
      baseline = chunk_payload(
        identity, tile, ground, owned, {}, minecraft=mode == "minecraft"
      )
      empty = chunk_payload(
        identity, tile, ground, [], {}, minecraft=mode == "minecraft"
      )
      remove = mesh_signature(baseline) - mesh_signature(empty)
      before = mesh_signature(original)
      assert not remove - before, (identity, mode, "coarse owner already removed")
      payload["meshes"] = subtract_meshes(payload["meshes"], remove.copy())
      if mode == "drawn" and "lines" in original:
        lines = line_signature(baseline["lines"]) - line_signature(empty["lines"])
        payload["lines"] = subtract_lines(payload["lines"], lines.copy())
      payload["nav"]["buildings"] = [
        b for b in payload["nav"]["buildings"] if b["sourceId"] not in outer_ids
      ]
      for n in new_nav:
        f = Polygon(n["ring"], n["holes"]).intersection(tile)
        for poly in navigation_polygons(f, bounds[0], bounds[1]):
          payload["nav"]["buildings"].append(
            {
              **poly,
              "sourceId": n["sourceId"],
              "partId": n["id"],
              "height": n["topY"] - 3,
              "minHeight": n["groundY"] - 3,
              "heightSource": n.get(
                "heightSource", "complete Berlin LoD2 leaf envelope"
              ),
            }
          )
      added = pack_detail(
        isometric_shading(detail[mode]) if mode == "drawn" else detail[mode], bounds
      )
      packets = distribute(payload, added, identity, bounds)
      if mode == "drawn":
        append_ink(packets, outer_ink, identity, bounds)
      combined = {"meshes": [m for p in packets for m in p["meshes"]]}
      assert before - remove + mesh_signature({"meshes": added}) == mesh_signature(
        combined
      )
      for key in ("ground", "water", "roads", "bridges"):
        assert payload["nav"][key] == original["nav"][key]
      assert all(
        b in payload["nav"]["buildings"]
        for b in original["nav"]["buildings"]
        if b["sourceId"] not in outer_ids
      )
      mode_packets[mode] = packets
      origin_y = min(
        -10,
        math.floor(
          min(
            (
              point[1]
              for triangle, _, _ in resident[mode].triangles
              for point in triangle
            ),
            default=-10,
          )
        ),
      )
      core_packets = distribute(
        empty_packet(identity, bounds, origin_y),
        pack_detail(
          isometric_shading(resident[mode]) if mode == "drawn" else resident[mode],
          bounds,
          origin_y=origin_y,
        ),
        identity,
        bounds,
      )
      if mode == "drawn":
        append_ink(core_packets, core_ink, identity, bounds)
      for p in core_packets:
        if p["meshes"] or p.get("lines"):
          core[mode + "Chunks"].append({"id": p["id"], "packet": p})
      chunk_audit["modes"][mode] = {
        "removedCoarseTriangles": sum(remove.values()),
        "preservedTriangles": sum((before - remove).values()),
        "addedStreamTriangles": triangles(added),
        "residentTriangles": sum(triangles(p["meshes"]) for p in core_packets),
        "packetCount": len(packets),
      }
    count = max(len(p) for p in mode_packets.values())
    for i in range(count):
      name = identity if i == 0 else f"{identity}-alt-mitte-v169-{i}"
      descriptor = {**entry, "id": name}
      if i:
        descriptor["detailCompanionOf"] = identity
      for mode in detail:
        p = (
          mode_packets[mode][i]
          if i < len(mode_packets[mode])
          else empty_packet(name, bounds)
        )
        descriptor[mode] = save_packet(output, name, mode, p)
      descriptors[name] = descriptor
    audit["chunks"].append(chunk_audit)
    print(
      json.dumps(
        {
          "tile": identity,
          "families": len(partitions[ix, iz]),
          "packets": count,
          "modes": chunk_audit["modes"],
        }
      ),
      flush=True,
    )
  navigation["nativeRoofSpans"] = roof_spans(roof_cells)
  unique_prisms = {encode(p): p for p in navigation["legacyPrisms"]}
  navigation["legacyPrisms"] = list(unique_prisms.values())
  manifest["chunks"] = list(descriptors.values())
  manifest.setdefault("source", {})["altMitteV169"] = {
    "baseRelease": BASE,
    "boundary": "Altbezirk Mitte before the 2001 fusion; documented 2008 edge reconciliation",
    "exactMovedOuterSourceIds": sorted(outer_ids),
    "residentCoreSourceIds": core["sourceParents"],
    "retention": "All previous unowned triangles, lines, roads, water, navigation and dedicated buildings retained.",
    "facades": "Mapped material tags where available; bounded window rhythm is a display estimate, not a survey.",
  }
  audit["counts"] = {
    "refinedFamilies": len(metadata_seen),
    "residentCoreFamilies": len(core["sourceParents"]),
    "residentCoreParts": len(navigation["parts"]),
    "replacedPrisms": len(unique_prisms),
    "outerReplacedFamilies": len(outer_ids),
    "retainedFamilies": sum(b["category"] == "retained" for b in records),
    "sourceCounts": source["counts"],
  }
  for name, value in (
    ("altMitteDrawnV169Source.json", {**core, "minecraftChunks": []}),
    ("altMitteNativeV169Source.json", {**core, "drawnChunks": []}),
    ("altMitteV169Navigation.json", navigation),
    (
      "altMitteV169Ownership.json",
      {"prismIds": sorted({p["id"] for p in unique_prisms.values()})},
    ),
  ):
    (output / name).write_bytes(encode(value))
  (output / "manifest.json").write_bytes(encode(manifest))
  (SOURCE / "render-audit.json").write_bytes(encode(audit))
  if apply:
    for path in output.glob("*.json.gz"):
      (DEFAULT_OUTPUT / path.name).write_bytes(path.read_bytes())
    (DEFAULT_OUTPUT / "manifest.json").write_bytes(
      (output / "manifest.json").read_bytes()
    )
    for name in (
      "altMitteDrawnV169Source.json",
      "altMitteNativeV169Source.json",
      "altMitteV169Navigation.json",
      "altMitteV169Ownership.json",
    ):
      (APP_DATA / name).write_bytes((output / name).read_bytes())
  return audit["counts"]


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--output", type=Path, default=Path("/tmp/v169-alt-mitte-packets")
  )
  parser.add_argument("--apply", action="store_true")
  args = parser.parse_args()
  print(generate(args.output, args.apply))
