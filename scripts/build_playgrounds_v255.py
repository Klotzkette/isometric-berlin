"""Step 10: finite official playground sites and retained mapped furnishings.

Original source packets are immutable. This emits independent small packets
using the existing serial city queue, plus a manifest patch for integration.
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import subprocess
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import pyogrio
import shapely
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

from scripts.build_district_facades_v188 import digest, read_json, write_json
from scripts.build_surrounding_outlines import (
  PackedMesh,
  line_parts,
  navigation_polygons,
  tags_for,
  world,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
OFFICIAL = GEO / "playgrounds-v255-official.geojson"
SOURCE = GEO / "playgrounds-v255-source.json.gz"
EVIDENCE = GEO / "playgrounds-v255-evidence.json.gz"
PATCH = GEO / "playgrounds-v255-manifest-patch.json"
KIND = "playgrounds-v255"
PREFIX = "play255-"
NAMED_SOURCE = GEO / "playgrounds-v255-named.geojson"
WOOD, METAL, ROPE = (148, 113, 75), (94, 111, 111), (209, 188, 141)
RED, BLUE, SAND = (188, 92, 59), (76, 129, 148), (195, 173, 123)
POLICY = (
  "Top twenty public playground sites by the retained official GRIS cadastral "
  "area field, plus explicitly named exceptions. Official cadastral site area "
  "is not the net equipped play area. Retain complete source boundaries and "
  "all old city packets; no district fill. Furnishing identity/anchor/course "
  "comes from retained OpenStreetMap. Untagged dimensions, colours and schematic "
  "equipment construction are estimates, not survey or photographic replicas. "
  "Existing authored equipment and terrain keep precedence. Both independent "
  "families use ordinary cancellable streamed packets and unchanged live limits."
)


def record(row: dict, layer: str) -> dict:
  """Retain mapped coordinates/tags with the original OSM identity."""
  tags = tags_for(row)
  if layer == "points":
    key = "node/" + str(row["osm_id"])
  elif isinstance(row.get("osm_way_id"), str):
    key = "way/" + row["osm_way_id"]
  else:
    key = ("relation/" if layer == "multipolygons" else "way/") + row["osm_id"]
  return dict(key=key, tags=tags, geometry=mapping(world(row["geometry"])))


def official_sites() -> list[dict]:
  """Read the independently ranked official selection and named exceptions."""
  payload = read_json(OFFICIAL)
  sites = []
  for feature in [*payload["features"], *read_json(NAMED_SOURCE)["features"]]:
    p = feature["properties"]
    g = shape(feature["geometry"])
    if g.bounds[0] > 100000:
      g = world(g)
    sites.append(
      dict(
        id=str(p["pitid"]),
        name=p.get("name", p["namenr"]),
        rank=p.get("rank"),
        katasterfl=p.get("katasterfl"),
        officialProperties=p,
        geometry=mapping(shapely.make_valid(g)),
      )
    )
  return sites


def extract() -> dict:
  """Freeze only mapped features intersecting the exact selected site scopes."""
  sites = official_sites()
  shapes = [shape(s["geometry"]) for s in sites]
  scope = unary_union(shapes)
  query = scope.buffer(3)
  tree = shapely.STRtree(shapes)
  features = []
  filters = {
    "points": (
      'other_tags LIKE \'%"playground"%\' OR other_tags LIKE \'%"amenity"=>"bench"%\' '
      "OR other_tags LIKE '%\"amenity\"=>\"drinking_water\"%' OR barrier IN ('gate','entrance')"
    ),
    "lines": (
      "highway IN ('footway','path','pedestrian','steps') OR "
      "barrier IN ('fence','wall','hedge') OR other_tags LIKE '%\"playground\"%'"
    ),
    "multipolygons": (
      "leisure IN ('playground','pitch') OR landuse IN ('grass','flowerbed') OR "
      "natural IN ('sand','scrub','water') OR building IS NOT NULL OR "
      "other_tags LIKE '%\"playground\"%'"
    ),
  }
  for layer, where in filters.items():
    rows = pyogrio.read_dataframe(PBF, layer=layer, where=where).to_crs(25833)
    for row in rows.to_dict("records"):
      g = world(row["geometry"])
      if g.is_empty or not g.intersects(query):
        continue
      r = record(row, layer)
      r["sites"] = [sites[int(i)]["id"] for i in tree.query(g.buffer(3))]
      r["layer"] = layer
      features.append(r)
  features.sort(key=lambda r: r["key"])
  source = dict(
    schemaVersion=1,
    policy=POLICY,
    officialSha256=digest(OFFICIAL),
    namedSha256=digest(NAMED_SOURCE),
    osmSource="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    osmSha256=digest(PBF),
    osmLicense="ODbL-1.0",
    officialLicense="dl-de/zero-2-0",
    sites=sites,
    features=features,
  )
  write_json(SOURCE, source)
  return source


def previous_features() -> tuple[set[str], set[str], list[dict]]:
  """Protect earlier represented fixtures, including their exact source files."""
  equipment, barriers, receipts = set(), set(), []
  path = ROOT / "src/app/public/mesh/regierungsviertel/park-details.json"
  park = read_json(path)
  receipts.append(dict(path=str(path.relative_to(ROOT)), sha256=digest(path)))
  for site in park["playgrounds"]:
    for item in site["equipment"]:
      if item["kind"] in {
        "climbingframe",
        "slide",
        "swing",
        "basketswing",
        "sandpit",
        "water",
        "excavator",
        "structure",
      }:
        equipment.add("node/" + str(item["id"]))
        equipment.add("way/" + str(item["id"]))
  path = DATA / "mitteHeritageV166Source.json"
  prior = read_json(path)
  receipts.append(dict(path=str(path.relative_to(ROOT)), sha256=digest(path)))
  for p in prior["props"]:
    if p["tags"].get("amenity") == "bench" or p["tags"].get("playground") in {
      "swing",
      "slide",
    }:
      equipment.add("node/" + p["id"])
  barriers.update("way/" + p["id"] for p in prior["barriers"])
  for filename in [
    "weinbergPlaygroundV174Source.json",
    "weinbergTerrainV176.json",
    "gipsKoppenV252.json",
    "kiezSitesOwnershipV209.json",
  ]:
    path = DATA / filename
    receipts.append(dict(path=str(path.relative_to(ROOT)), sha256=digest(path)))
  return equipment, barriers, receipts


def ground_samples(points: list[list[float]]) -> list[list[float]]:
  """Use exactly the viewer's retained terrain function for both families."""
  code = """
import { terrainGroundAt } from './src/weinbergTerrainV176';
const points = JSON.parse(await Bun.stdin.text());
process.stdout.write(JSON.stringify(points.map(([x,z,y]) =>
  [terrainGroundAt(x,z,y,false), terrainGroundAt(x,z,y,true)])));
"""
  result = subprocess.run(
    ["bun", "-e", code],
    cwd=ROOT / "src/app",
    input=json.dumps(points),
    text=True,
    capture_output=True,
    check=True,
  )
  return json.loads(result.stdout)


def native_surface(geometry: Any, step: float = 2) -> Any:
  """Keep complete orthogonal cells strictly inside their exact source surface."""
  cells = []
  if geometry.is_empty:
    return geometry
  a, b, c, d = geometry.bounds
  for iz in range(math.floor(b / step), math.ceil(d / step)):
    z = iz * step
    for ix in range(math.floor(a / step), math.ceil(c / step)):
      x = ix * step
      cell = box(x, z, x + step, z + step)
      if geometry.covers(cell):
        cells.append(cell)
  return unary_union(cells)


class EquipmentMesh:
  """Independent schematic equipment, retaining mapped anchors and open voids."""

  def __init__(self, origin: list, native: bool, scope: Any) -> None:
    self.mesh = PackedMesh(origin[0], origin[2])
    self.native = native
    self.scope = scope
    self.solids: list[dict] = []
    self.omitted = 0

  def cuboid(self, center: list, size: list, color: tuple, solid: bool = True) -> None:
    """An axis-aligned visible member; native never inherits rotated faces."""
    x, y, z = center
    w, h, d = size
    footprint = box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)
    if not self.scope.covers(footprint):
      self.omitted += 1
      return
    pts = [
      [x + sx * w / 2, y + sy * h / 2, z + sz * d / 2]
      for sx, sy, sz in [
        (-1, -1, -1),
        (1, -1, -1),
        (1, -1, 1),
        (-1, -1, 1),
        (-1, 1, -1),
        (1, 1, -1),
        (1, 1, 1),
        (-1, 1, 1),
      ]
    ]
    for a, b, c, e in [
      (0, 1, 5, 4),
      (1, 2, 6, 5),
      (2, 3, 7, 6),
      (3, 0, 4, 7),
      (4, 5, 6, 7),
      (3, 2, 1, 0),
    ]:
      self.mesh.triangle([pts[a], pts[b], pts[c]], color)
      self.mesh.triangle([pts[a], pts[c], pts[e]], color)
    if solid and h > 0.12 and max(w, d) < 8:
      self.solids.append(
        dict(geometry=mapping(footprint), low=y - h / 2, high=y + h / 2)
      )

  def beam(
    self, a: list, b: list, width: float, color: tuple, solid: bool = False
  ) -> None:
    """Drawn hexagonal rod; native receives short orthogonal members."""
    v = np.asarray(b) - a
    length = float(np.linalg.norm(v))
    if length < 0.01:
      return
    if self.native:
      n = max(1, math.ceil(length / 0.45))
      for i in range(n):
        c = np.asarray(a) + v * ((i + 0.5) / n)
        size = np.maximum(np.abs(v) / n, width).tolist()
        self.cuboid(c.tolist(), size, color, solid)
      return
    footprint = LineString([(a[0], a[2]), (b[0], b[2])]).buffer(width / 2)
    if not self.scope.covers(footprint):
      self.omitted += 1
      return
    axis = v / length
    seed = np.array([1, 0, 0]) if abs(axis[0]) < 0.8 else np.array([0, 0, 1])
    u = np.cross(axis, seed)
    u /= np.linalg.norm(u)
    w = np.cross(axis, u)
    rings = [
      [
        np.asarray(p)
        + width / 2 * (u * math.cos(j * math.pi / 3) + w * math.sin(j * math.pi / 3))
        for j in range(6)
      ]
      for p in [a, b]
    ]
    for j in range(6):
      k = (j + 1) % 6
      self.mesh.triangle([rings[0][j], rings[0][k], rings[1][k]], color)
      self.mesh.triangle([rings[0][j], rings[1][k], rings[1][j]], color)
    if solid:
      self.solids.append(
        dict(geometry=mapping(footprint), low=min(a[1], b[1]), high=max(a[1], b[1]))
      )

  def fixture(self, kind: str, x: float, y: float, z: float) -> bool:
    """Recognition estimates at a positively mapped category and anchor."""

    def box_at(
      dx: float,
      dy: float,
      dz: float,
      w: float,
      h: float,
      d: float,
      color: tuple = WOOD,
      solid: bool = True,
    ) -> None:
      self.cuboid([x + dx, y + dy, z + dz], [w, h, d], color, solid)

    def rod(a: list, b: list, width: float = 0.10, color: tuple = METAL) -> None:
      self.beam(
        [x + a[0], y + a[1], z + a[2]], [x + b[0], y + b[1], z + b[2]], width, color
      )

    if kind in {"swing", "basketswing"}:
      for dx in [-1.7, 1.7]:
        for dz in [-0.85, 0.85]:
          rod([dx, 0, dz], [dx, 2.55, 0], 0.13, WOOD)
      rod([-1.85, 2.55, 0], [1.85, 2.55, 0], 0.17, WOOD)
      for dx in [-0.65, 0.65] if kind == "swing" else [0]:
        width = 0.48 if kind == "swing" else 1.05
        box_at(dx, 0.55, 0, width, 0.10, 0.35 if kind == "swing" else 0.8, BLUE)
        for side in [-width / 2, width / 2]:
          rod([dx + side, 0.55, 0], [dx + side, 2.55, 0], 0.035, ROPE)
    elif kind == "slide":
      box_at(0, 1.6, 0, 1.0, 0.15, 1.0)
      for dx in [-0.43, 0.43]:
        box_at(dx, 0.8, 0, 0.12, 1.6, 0.12)
        rod([dx, 1.7, 0.45], [dx, 0.18, 2.6], 0.10, BLUE)
        rod([dx, 0, -1.0], [dx, 1.6, -0.45], 0.08)
      for i in range(6):
        t = (i + 1) / 7
        rod([-0.43, 1.6 * t, -1 + 0.55 * t], [0.43, 1.6 * t, -1 + 0.55 * t], 0.075)
      for i in range(10):
        t = (i + 0.5) / 10
        box_at(0, 1.7 - 1.52 * t, 0.45 + 2.15 * t, 0.76, 0.08, 0.26, METAL)
    elif kind in {"climbingframe", "climbing_frame", "structure", "playhouse"}:
      for dx in [-1, 1]:
        for dz in [-1, 1]:
          box_at(dx, 1.25, dz, 0.13, 2.5, 0.13)
      for dz in [-1, 1]:
        rod([-1, 2.5, dz], [1, 2.5, dz], 0.12, WOOD)
        for j in range(1, 6):
          rod([-1, j * 0.4, dz], [1, j * 0.4, dz], 0.05, ROPE)
      for dx in [-1, 1]:
        rod([dx, 2.5, -1], [dx, 2.5, 1], 0.12, WOOD)
      if kind in {"structure", "playhouse"}:
        box_at(0, 1.1, 0, 1.9, 0.13, 1.9)
        box_at(0, 2.55, 0, 2.3, 0.13, 2.3, BLUE)
    elif kind in {"seesaw", "springy"}:
      box_at(0, 0.35, 0, 0.30, 0.70, 0.30, METAL)
      if kind == "seesaw":
        rod([-1.4, 0.50, 0], [1.4, 0.85, 0], 0.16, WOOD)
        for dx, dy in [(-1.1, 0.54), (1.1, 0.82)]:
          box_at(dx, dy, 0, 0.55, 0.10, 0.35, RED)
          rod([dx, dy + 0.1, 0], [dx, dy + 0.4, 0], 0.06)
      else:
        box_at(0, 0.72, 0, 0.75, 0.16, 0.35, RED)
        rod([-0.25, 0.75, 0], [-0.25, 1.05, 0], 0.05)
    elif kind in {"roundabout", "rotary", "aerialrotator", "basketrotator"}:
      box_at(0, 0.25, 0, 1.65, 0.14, 1.65, BLUE)
      box_at(0, 0.85, 0, 0.13, 1.3, 0.13, METAL)
      for dx, dz in [(0.7, 0), (-0.7, 0), (0, 0.7), (0, -0.7)]:
        rod([0, 1.3, 0], [dx, 1.0, dz], 0.055)
    elif kind in {
      "waterpump",
      "water_pump",
      "water",
      "drinking_water",
      "pump",
      "water_sprayer",
    }:
      box_at(0, 0.55, 0, 0.20, 1.1, 0.20, METAL)
      rod([0, 1.0, 0], [0.35, 1.0, 0], 0.08)
      rod([0, 1.2, 0], [-0.35, 0.95, 0], 0.065)
    elif kind in {
      "horizontal_bar",
      "climbing_pole",
      "climbingwall",
      "spring_board",
      "sand_table",
    }:
      if kind == "horizontal_bar":
        for dx in [-0.8, 0.8]:
          box_at(dx, 0.9, 0, 0.10, 1.8, 0.10, METAL)
        rod([-0.8, 1.8, 0], [0.8, 1.8, 0], 0.065)
      elif kind == "climbing_pole":
        box_at(0, 1.2, 0, 0.14, 2.4, 0.14)
      elif kind == "climbingwall":
        box_at(0, 0.9, 0, 1.6, 1.8, 0.12, WOOD)
        for i in range(3):
          for j in range(3):
            box_at(-0.5 + i * 0.5, 0.35 + j * 0.5, 0.09, 0.10, 0.08, 0.08, RED)
      else:
        box_at(0, 0.35, 0, 0.15, 0.70, 0.15, METAL)
        box_at(0, 0.73, 0, 0.9, 0.08, 0.5, WOOD)
    elif kind == "bench":
      for dx in [-0.65, 0.65]:
        box_at(dx, 0.25, 0, 0.12, 0.5, 0.50, METAL)
      for dz in [-0.18, 0, 0.18]:
        box_at(0, 0.52, dz, 1.8, 0.08, 0.14)
      for yy in [0.80, 1.02]:
        box_at(0, yy, 0.25, 1.8, 0.14, 0.07)
    elif kind in {"trampoline", "sandpit"}:
      box_at(0, 0.03, 0, 1.6, 0.06, 1.6, METAL if kind == "trampoline" else SAND, False)
    else:
      return False
    return True

  def mapped_fixture(self, kind: str, geometry: Any, y: float) -> bool:
    """Use mapped device courses rather than inventing a common layout."""
    if geometry.geom_type not in {"LineString", "MultiLineString"}:
      return False
    recognized = {
      "balancebeam",
      "balance",
      "balance_rope",
      "rope_traverse",
      "horizontal_bar",
      "monkey_bars",
      "parallel_bars",
      "climbingframe",
      "structure",
      "playhouse",
      "platform",
      "slide",
      "zipwire",
      "ropebridge",
      "belt_bridge",
      "bridge",
      "ladder",
      "water_stream",
      "water_channel",
    }
    if kind not in recognized:
      return False
    for line in line_parts(geometry):
      if line.length < 0.2:
        continue
      coords = list(line.coords)

      def pole(p: tuple, h: float) -> None:
        self.cuboid([p[0], y + h / 2, p[1]], [0.12, h, 0.12], WOOD)

      if kind in {"climbingframe", "structure", "playhouse", "platform"}:
        for p in coords[:-1] if line.is_ring else coords:
          pole(p, 2.3)
        for a, b in zip(coords, coords[1:]):
          self.beam([a[0], y + 2.3, a[1]], [b[0], y + 2.3, b[1]], 0.10, WOOD)
          if kind == "climbingframe":
            for h in [0.45, 0.9, 1.35, 1.8]:
              self.beam([a[0], y + h, a[1]], [b[0], y + h, b[1]], 0.035, ROPE)
      elif kind in {"slide", "zipwire"}:
        pole(coords[0], 1.8 if kind == "slide" else 2.8)
        if kind == "zipwire":
          pole(coords[-1], 2.1)
        walked = 0.0
        for a, b in zip(coords, coords[1:]):
          t0, t1 = walked / line.length, (walked + math.dist(a, b)) / line.length
          high, low = (1.8, 0.18) if kind == "slide" else (2.8, 2.1)
          self.beam(
            [a[0], y + high + (low - high) * t0, a[1]],
            [b[0], y + high + (low - high) * t1, b[1]],
            0.48 if kind == "slide" else 0.045,
            METAL,
          )
          walked += math.dist(a, b)
      else:
        h = (
          0.45
          if kind in {"balancebeam", "balance", "balance_rope", "rope_traverse"}
          else (0.12 if kind in {"water_stream", "water_channel"} else 1.7)
        )
        for p in [coords[0], coords[-1]]:
          if h > 0.2:
            pole(p, h)
        for a, b in zip(coords, coords[1:]):
          self.beam(
            [a[0], y + h, a[1]],
            [b[0], y + h, b[1]],
            0.18 if h < 1 else 0.08,
            WOOD if h < 1 else METAL,
          )
    return True


def build() -> dict:
  """Compile independent bounded families and exact scope/preservation receipts."""
  source = read_json(SOURCE)
  sites = source["sites"]
  manifest = read_json(OUT / "manifest.json")
  core = read_json(DATA / "surroundingCityScope.json")["core"]
  core_g = Polygon(core["ring"], core["holes"])
  baseline = read_json(EVIDENCE) if EVIDENCE.exists() else {}
  old_scope = (
    shape(baseline["previousScope"])
    if "previousScope" in baseline
    else (
      unary_union(
        [
          shapely.make_valid(core_g),
          *[
            shapely.make_valid(Polygon(p["ring"], p["holes"]))
            for p in manifest["footprint"]
          ],
        ]
      )
    )
  )
  old_descriptors = baseline.get(
    "oldDescriptors", [d for d in manifest["chunks"] if not d["id"].startswith(PREFIX)]
  )
  prior_equipment, prior_barriers, preserved = previous_features()
  features = [
    {**r, "g": shapely.make_valid(shape(r["geometry"]))} for r in source["features"]
  ]
  companions, audits, counts = [], [], Counter()
  heights_inputs, heights_keys = [], []
  terrain_points: dict[tuple[float, float], int] = {}

  def add_ground_point(x: float, z: float) -> None:
    key = (round(x, 6), round(z, 6))
    if key not in terrain_points:
      terrain_points[key] = len(heights_inputs)
      heights_inputs.append([x, z, 5.2 if core_g.covers(Point(x, z)) else 3])

  for r in features:
    p = r["g"].representative_point()
    add_ground_point(p.x, p.y)
    heights_keys.append((r["key"], (round(p.x, 6), round(p.y, 6))))
  # Every retained line node and short fence section follows the same actual
  # terrain as the viewer. No constant fence altitude flattens Weinbergspark.
  terrain_values = ground_samples(heights_inputs)
  heights = {key: terrain_values[terrain_points[p]] for key, p in heights_keys}

  def terrain_for(points: list[tuple]) -> dict[tuple, list[float]]:
    return (
      dict(
        zip(
          points,
          ground_samples(
            [[x, z, 5.2 if core_g.covers(Point(x, z)) else 3] for x, z in points]
          ),
        )
      )
      if points
      else {}
    )

  new_scopes = []
  for site_index, site in enumerate(sites):
    scope = shape(site["geometry"])
    missing = scope.difference(old_scope)
    if not missing.is_empty:
      new_scopes.append(
        dict(
          type="Feature",
          properties={"siteId": site["id"], "name": site["name"]},
          geometry=mapping(missing),
        )
      )
    local = [
      r for r in features if site["id"] in r["sites"] and r["g"].intersects(scope)
    ]
    fixtures = [
      r
      for r in local
      if r["layer"] == "points"
      and (
        r["tags"].get("playground")
        or r["tags"].get("amenity") in {"bench", "drinking_water"}
      )
    ]
    fences = [
      r
      for r in local
      if r["tags"].get("barrier") == "fence" and r["key"] not in prior_barriers
    ]
    mapped_fixtures = [
      r
      for r in local
      if r["layer"] == "lines"
      and r["tags"].get("playground")
      and r["key"] not in prior_equipment
    ]
    paths = unary_union(
      [
        r["g"].buffer(1.1)
        for r in local
        if r["tags"].get("highway") in {"footway", "path", "steps", "pedestrian"}
      ]
    )
    entrances = unary_union(
      [
        r["g"].buffer(1.1)
        for r in local
        if r["tags"].get("barrier") in {"gate", "entrance"}
      ]
    )
    gaps = paths.union(entrances)
    buildings = unary_union([r["g"] for r in local if r["tags"].get("building")])
    water = unary_union([r["g"] for r in local if r["tags"].get("natural") == "water"])
    # Ground-material outlines are the exact mapped sand/rubber/pitch courses;
    # the narrow flat seam is a display cue, never an invented fence.
    outlines = [
      r
      for r in local
      if r["g"].geom_type in {"Polygon", "MultiPolygon"}
      and (
        r["tags"].get("playground") in {"sandpit", "splash_pad"}
        or r["tags"].get("leisure") == "pitch"
        or r["tags"].get("landuse") == "grass"
        or ("Gipsdreieck" in site["name"] and r["tags"].get("leisure") == "playground")
      )
    ]
    minx, minz, maxx, maxz = scope.bounds
    # A site may span several 512 m tiles: source courses are clipped, never
    # rescaled, to keep Uint16 centimetre packets and transfer lifetime bounded.
    for tx in range(math.floor(minx / 512), math.floor(maxx / 512) + 1):
      for tz in range(math.floor(minz / 512), math.floor(maxz / 512) + 1):
        tile = box(tx * 512, tz * 512, (tx + 1) * 512, (tz + 1) * 512)
        allowed = scope.intersection(tile)
        if allowed.area < 0.01:
          continue
        identity = f"{PREFIX}{site_index + 1:02d}-{tx}_{tz}"
        desc = dict(id=identity, bounds=list(allowed.bounds), playgroundSite=site["id"])
        site_audit = dict(
          id=identity,
          site=site["id"],
          name=site["name"],
          rank=site["rank"],
          footprint=mapping(allowed),
          families={},
        )
        fence_segments, outline_segments = [], []
        for r in fences:
          fence_g = (
            r["g"].boundary
            if r["g"].geom_type in {"Polygon", "MultiPolygon"}
            else r["g"]
          )
          fence = fence_g.intersection(allowed.buffer(-0.12)).difference(gaps)
          for line in line_parts(fence):
            for a, b in zip(line.coords, list(line.coords)[1:]):
              n = max(1, math.ceil(math.dist(a, b) / 2))
              for j in range(n):
                ends = [
                  tuple(a[k] + (b[k] - a[k]) * t / n for k in range(2))
                  for t in [j, j + 1]
                ]
                fence_segments.append((r["key"], ends))
        for r in outlines:
          for line in line_parts(r["g"].boundary.intersection(allowed.buffer(-0.10))):
            for a, b in zip(line.coords, list(line.coords)[1:]):
              n = max(1, math.ceil(math.dist(a, b) / 2))
              for j in range(n):
                ends = [
                  tuple(a[k] + (b[k] - a[k]) * t / n for k in range(2))
                  for t in [j, j + 1]
                ]
                outline_segments.append((r["key"], ends))
        line_points = sorted(
          set(p for _, ends in [*fence_segments, *outline_segments] for p in ends)
        )
        line_heights = terrain_for(line_points)
        for family_index, family in enumerate(["drawn", "minecraft"]):
          native = family == "minecraft"
          origin = [tx * 512, -10, tz * 512]
          member_scope = allowed.difference(buildings.buffer(0.03)).difference(water)
          model = EquipmentMesh(origin, native, member_scope)
          emitted, skipped = [], []
          ground = missing.intersection(tile).difference(buildings).difference(water)
          new_water = missing.intersection(tile).intersection(water)
          if native:
            ground = native_surface(ground)
            new_water = native_surface(new_water)
          if not new_water.is_empty:
            model.mesh.surface(new_water, 3.02, (86, 142, 151))
          # Only newly authorized site ground needs support. Existing lawns,
          # sand, rubber, sports courts, paths and real hills are never painted over.
          if not ground.is_empty:
            model.mesh.surface(ground, 3.0, (155, 159, 130))
            for r in local:
              t = r["tags"]
              if r["g"].geom_type not in {"Polygon", "MultiPolygon"}:
                continue
              color = (
                SAND
                if t.get("surface") == "sand" or t.get("playground") == "sandpit"
                else ((115, 141, 91) if t.get("landuse") == "grass" else None)
              )
              if color:
                surface = r["g"].intersection(ground)
                if native:
                  surface = native_surface(surface)
                model.mesh.surface(surface, 3.025, color)
            path_ground = paths.intersection(ground)
            if native:
              # Preserve narrow walks as continuous independent native surfaces.
              # Two-metre cells can erase a complete diagonal 2.2 m source band.
              path_ground = native_surface(path_ground, 0.5)
            model.mesh.surface(path_ground, 3.04, (191, 185, 165))
          for r in fixtures:
            p = r["g"]
            if not allowed.covers(p):
              continue
            if r["key"] in prior_equipment:
              skipped.append(
                dict(key=r["key"], reason="earlier visible fixture retained")
              )
              continue
            kind = r["tags"].get("playground", r["tags"].get("amenity"))
            start = len(model.mesh.indices)
            accepted = model.fixture(kind, p.x, heights[r["key"]][family_index], p.y)
            if accepted and len(model.mesh.indices) > start:
              emitted.append(
                dict(
                  key=r["key"],
                  kind=kind,
                  anchor=[p.x, p.y],
                  y=heights[r["key"]][family_index],
                  dimensionsEstimated=True,
                )
              )
            else:
              skipped.append(
                dict(
                  key=r["key"], reason="unsupported mapped type or boundary clearance"
                )
              )
          for r in mapped_fixtures:
            g = r["g"].intersection(allowed.buffer(-0.3))
            if g.is_empty:
              continue
            kind = r["tags"]["playground"]
            start = len(model.mesh.indices)
            if (
              model.mapped_fixture(kind, g, heights[r["key"]][family_index])
              and len(model.mesh.indices) > start
            ):
              emitted.append(
                dict(
                  key=r["key"],
                  kind="mapped-" + kind,
                  geometry=mapping(g),
                  y=heights[r["key"]][family_index],
                  dimensionsEstimated=True,
                )
              )
          # Fence gaps are cut at all mapped paths and gate nodes, not guessed.
          for key, (a, b) in fence_segments:
            ay, by = line_heights[a][family_index], line_heights[b][family_index]
            model.cuboid([a[0], ay + 0.55, a[1]], [0.09, 1.1, 0.09], METAL)
            for h in [0.30, 1.05]:
              model.beam([a[0], ay + h, a[1]], [b[0], by + h, b[1]], 0.055, METAL)
            emitted.append(
              dict(
                key=key,
                kind="mapped-fence",
                endpoints=[a, b],
                groundY=[ay, by],
                dimensionsEstimated=True,
              )
            )
          for key, (a, b) in outline_segments:
            ay, by = line_heights[a][family_index], line_heights[b][family_index]
            model.beam([a[0], ay + 0.15, a[1]], [b[0], by + 0.15, b[1]], 0.08, SAND)
            emitted.append(
              dict(
                key=key,
                kind="mapped-surface-seam",
                endpoints=[a, b],
                groundY=[ay, by],
                dimensionsEstimated=True,
              )
            )
          payload_mesh = model.mesh.payload(KIND)
          payload = dict(
            schemaVersion=1,
            id=identity,
            origin=origin,
            meshes=[payload_mesh] if payload_mesh else [],
            nav=dict(
              groundY=3,
              ground=navigation_polygons(ground, origin[0], origin[2]),
              water=navigation_polygons(new_water, origin[0], origin[2]),
              buildings=[],
            ),
          )
          # Granular fixture solids enter the ordinary packet navigation; the
          # complete playground remains walkable around them.
          for index, solid in enumerate(model.solids):
            polygon = shape(solid["geometry"])
            for p in navigation_polygons(polygon, origin[0], origin[2]):
              payload["nav"]["buildings"].append(
                {
                  **p,
                  "sourceId": f"play255:{site['id']}:{index}",
                  "minHeight": solid["low"] - 3,
                  "height": solid["high"] - 3,
                }
              )
          url = f"{identity}.{family}.json.gz"
          write_json(OUT / url, payload)
          asset = OUT / url
          desc[family] = dict(
            url=url,
            bytes=asset.stat().st_size,
            decodedBytes=len(gzip.decompress(asset.read_bytes())),
            encoding="gzip",
            sha256=digest(asset),
          )
          site_audit["families"][family] = dict(
            emitted=emitted,
            skipped=skipped,
            outOfScopeMembersOmitted=model.omitted,
            vertices=len(model.mesh.vertices),
            indices=len(model.mesh.indices),
            ground=mapping(ground),
            water=mapping(new_water),
            solids=model.solids,
          )
          counts[family + "Vertices"] += len(model.mesh.vertices)
          counts[family + "TransferBytes"] += asset.stat().st_size
        companions.append(desc)
        audits.append(site_audit)
  write_json(
    GEO / "bounds-playgrounds-v255.geojson",
    dict(
      type="FeatureCollection",
      features=[
        {
          **f,
          "geometry": mapping(
            transform(
              Transformer.from_crs(25833, 4326, always_xy=True).transform,
              affine_transform(shape(f["geometry"]), [1, 0, 0, -1, 389500, 5820000]),
            )
          ),
        }
        for f in new_scopes
      ],
    ),
  )
  evidence = dict(
    schemaVersion=1,
    policy=POLICY,
    sourceSha256=digest(SOURCE),
    officialSha256=digest(OFFICIAL),
    preserved=preserved,
    counts=dict(counts),
    sites=[{k: v for k, v in s.items() if k != "geometry"} for s in sites],
    packets=audits,
    companions=companions,
    previousScopeSha256=digest(DATA / "surroundingCityScope.json"),
    previousScope=mapping(old_scope),
    oldDescriptors=old_descriptors,
  )
  write_json(EVIDENCE, evidence)
  write_json(
    PATCH,
    dict(
      chunks=companions,
      footprint=navigation_polygons(
        unary_union([shape(f["geometry"]) for f in new_scopes]), 0, 0
      ),
      playgroundsV255=dict(
        policy=POLICY,
        sites=len(sites),
        chunks=len(companions),
        source="playgrounds-v255-source.json.gz",
      ),
    ),
  )
  write_json(
    DATA / "playgroundsV255.json",
    dict(
      schemaVersion=1,
      sites=evidence["sites"],
      packetSites={d["id"]: d["playgroundSite"] for d in companions},
    ),
  )
  print(dict(sites=len(sites), chunks=len(companions), **counts), flush=True)
  return evidence


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract:
    extract()
  build()
