"""Step 10: exact Forum fountain strips and retained Reichstag kerb joints."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import substring, unary_union

from isometric_berlin.generation.road_geometry import road_width_m
from scripts.build_house_curbs_v233 import tags, world
from scripts.build_surrounding_outlines import line_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "reichstag-public-v256-source.json"
OUTPUT = DATA / "reichstagPublicRealmV256.json"
DISTRICT = DATA / "districtStreets.json"
SURFACE = ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json"
SCOPE = (-120, -180, 430, 155)
NAMES = {"Paul-Löbe-Allee", "Scheidemannstraße", "Reichstagsufer", "Ebertstraße"}
FOUNTAINS = {str(v) for v in range(505646043, 505646057)} | {
  str(v) for v in range(1226582739, 1226582745)
}


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def extract() -> dict:
  """Retain complete selected OSM owners and exact existing kerb support."""
  raw = GEO / "raw/outer-v159/candidate.gpkg"
  bounds = (13.368, 52.516, 13.38, 52.5225)
  polygons = pyogrio.read_dataframe(raw, layer="multipolygons", bbox=bounds).to_crs(
    25833
  )
  lines = pyogrio.read_dataframe(raw, layer="lines", bbox=bounds).to_crs(25833)
  fountains, roads, accesses = [], [], []
  scope = box(*SCOPE)
  for row in polygons.to_dict("records"):
    if row.get("osm_way_id") not in FOUNTAINS:
      continue
    assert row["amenity"] == "fountain" and tags(row)["fountain"] == "splash_pad"
    fountains.append(
      dict(
        id=row["osm_way_id"], tags=tags(row), geometry=mapping(world(row["geometry"]))
      )
    )
  for row in lines.to_dict("records"):
    g, t = world(row["geometry"]), tags(row)
    if not g.intersects(scope) or t.get("tunnel") == "yes" or t.get("bridge") == "yes":
      continue
    if t.get("highway") in ("footway", "path", "steps", "cycleway"):
      accesses.append(g.buffer(1.6))
    if t.get("name") in NAMES and t.get("highway"):
      roads.append(dict(id=row["osm_id"], tags=t, geometry=mapping(g)))
  assert {f["id"] for f in fountains} == FOUNTAINS
  access = unary_union(accesses)
  district = json.loads(DISTRICT.read_text())
  selected = []
  # A thin joint may decorate only an already-rendered kerb, near the side of
  # a source road. Junction ends and mapped walking approaches stay untouched.
  for road in roads:
    g = shape(road["geometry"])
    width = road_width_m(road["tags"])
    if not width or g.length < 12:
      continue
    short = substring(g, 5, g.length - 5)
    sides = unary_union([short.offset_curve(width / 2), short.offset_curve(-width / 2)])
    for index, points in enumerate(district["curbs_m"]):
      curb = LineString(points)
      if not curb.intersects(scope):
        continue
      kept = (
        curb.intersection(scope).intersection(sides.buffer(0.55)).difference(access)
      )
      for segment in line_parts(kept):
        if segment.length > 3:
          selected.append(
            dict(road=road["id"], curb=index, points=list(segment.coords))
          )
  return dict(
    schemaVersion=1,
    source="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    license="ODbL-1.0",
    sourceExtractSha256=sha(raw),
    retainedFiles={
      str(p.relative_to(ROOT)): sha(p)
      for p in [
        DISTRICT,
        SURFACE,
        GEO / "osm.gpkg",
        GEO / "official_details.gpkg",
      ]
    },
    scope=SCOPE,
    fountains=sorted(fountains, key=lambda f: int(f["id"])),
    roads=sorted(roads, key=lambda f: int(f["id"])),
    kerbs=selected,
    references=[
      "https://www.berlin.de/sen/uvk/_assets/natur-gruen/landschaftsplanung/20-gruene-hauptwege/weg-1/flyer_flanieren_entlang_der_stadtspree.pdf",
      "https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2021/pressemitteilung.1070989.php",
      "https://combe.de/portfolio-items/erneuerung-des-wasserspiels-forum-am-kanzleramt-in-berlin/",
    ],
  )


def row_footprint(row: list, native: bool = False) -> Polygon:
  x, _, z, w, _, d = row[:6]
  angle = 0 if native else row[6]
  t, n = (
    np.array([math.cos(angle), -math.sin(angle)]),
    np.array([math.sin(angle), math.cos(angle)]),
  )
  return Polygon(
    [
      np.array([x, z]) + a * w / 2 * t + b * d / 2 * n
      for a, b in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    ]
  )


def native_kerb_rectangles(source: dict) -> list:
  """Merge complete 10 cm source-contained cells into orthogonal rectangles."""
  cells: set[tuple[int, int]] = set()
  for feature in source["kerbs"]:
    polygon = LineString(feature["points"]).buffer(0.11, cap_style=2, join_style=2)
    minx, minz, maxx, maxz = polygon.bounds
    for iz in range(math.floor(minz * 10), math.ceil(maxz * 10)):
      strip = polygon.intersection(box(minx, iz / 10, maxx, (iz + 1) / 10))
      if strip.is_empty:
        continue
      xs = np.arange(math.floor(strip.bounds[0] * 10), math.ceil(strip.bounds[2] * 10))
      squares = shapely.box(xs / 10, iz / 10, (xs + 1) / 10, (iz + 1) / 10)
      for ix in xs[shapely.covers(polygon, squares)]:
        cells.add((int(ix), iz))
  rectangles = []
  while cells:
    x, z = min(cells, key=lambda p: (p[1], p[0]))
    xmax = x
    while (xmax + 1, z) in cells:
      xmax += 1
    zmax = z
    while all((ix, zmax + 1) in cells for ix in range(x, xmax + 1)):
      zmax += 1
    for ix in range(x, xmax + 1):
      for iz in range(z, zmax + 1):
        cells.remove((ix, iz))
    rectangles.append(
      [
        (x + xmax + 1) / 20,
        0.25,
        (z + zmax + 1) / 20,
        (xmax - x + 1) / 10,
        0.14,
        (zmax - z + 1) / 10,
        0xD8D5C9,
      ]
    )
  return rectangles


def build(source: dict) -> dict:
  """Build small static members; Y is relative to the retained terrain sample."""
  drawn, native, owners = [], [], []
  dark, steel, water = 0x626E6D, 0xBCC6BF, 0xAFD6D4

  def put(target: list, values: list) -> None:
    target.append([round(float(v), 6) for v in values[:-1]] + [values[-1]])

  for feature in source["fountains"]:
    polygon = shape(feature["geometry"]).geoms[0]
    rectangle = list(polygon.minimum_rotated_rectangle.exterior.coords)
    a, b = max(zip(rectangle, rectangle[1:]), key=lambda ab: math.dist(*ab))
    delta = np.array(b) - a
    length = float(np.linalg.norm(delta))
    t = delta / length
    n = np.array([-t[1], t[0]])
    centre = np.array(polygon.centroid.coords[0])
    spine = LineString([centre - t * length, centre + t * length])
    spine = spine.intersection(polygon.buffer(-0.18))
    a, b = np.array(spine.coords[0]), np.array(spine.coords[-1])
    centre, length = (a + b) / 2, float(np.linalg.norm(b - a))
    angle = math.atan2(-t[1], t[0])
    start_drawn, start_native = len(drawn), len(native)
    # Source strips are water-wall slots, not round basins. A narrow central
    # grille preserves every surrounding pavement/grass/source triangle.
    slot = [centre[0], 0.23, centre[1], length - 0.2, 0.025, 0.22, angle, dark]
    assert polygon.buffer(1e-7).covers(row_footprint(slot))
    put(drawn, slot)
    for offset in [-0.13, 0.13]:
      c = centre + n * offset
      rim = [c[0], 0.238, c[1], length - 0.22, 0.025, 0.035, angle, steel]
      assert polygon.buffer(1e-7).covers(row_footprint(rim))
      put(drawn, rim)
    # Independent orthogonal native grate: only full 10 cm cells inside the
    # actual drawn slot, never bounding rectangles crossing a source edge.
    pad = row_footprint(slot)
    minx, minz, maxx, maxz = pad.bounds
    for ix in range(math.floor(minx * 10), math.ceil(maxx * 10)):
      cells = []
      for iz in range(math.floor(minz * 10), math.ceil(maxz * 10)):
        cell = box(ix / 10, iz / 10, (ix + 1) / 10, (iz + 1) / 10)
        if pad.covers(cell):
          cells.append(iz)
      # Merge only adjacent equal source-contained cells, retaining exactly
      # the same orthogonal footprint without one matrix per 10 cm square.
      while cells:
        start = end = cells.pop(0)
        while cells and cells[0] == end + 1:
          end = cells.pop(0)
        put(
          native,
          [
            (ix + 0.5) / 10,
            0.23,
            (start + end + 1) / 20,
            0.1,
            0.025,
            (end - start + 1) / 10,
            dark,
          ],
        )
    count = max(2, int((length - 0.4) / 0.7))
    for index in range(count):
      u = ((index + 0.5) / count - 0.5) * (length - 0.5)
      c = centre + t * u
      h = 0.68 + 0.42 * math.sin((index + 0.5) / count * math.pi)
      nozzle = [c[0], 0.267, c[1], 0.15, 0.04, 0.15, 0, steel]
      jet = [c[0], 0.287 + h / 2, c[1], 0.075, h, 0.075, 0, water]
      for row in [nozzle, jet]:
        assert polygon.buffer(1e-7).covers(row_footprint(row))
        put(drawn, row)
      # Cubic tiers show an independently block-built, static water column.
      put(native, [c[0], 0.267, c[1], 0.18, 0.04, 0.18, steel])
      levels = math.ceil(h / 0.24)
      for level in range(levels):
        width = 0.14 if level < levels - 1 else 0.1
        put(
          native,
          [
            c[0],
            0.287 + (level + 0.5) * h / levels,
            c[1],
            width,
            h / levels,
            width,
            water,
          ],
        )
    owners.append(
      dict(
        id=feature["id"],
        drawn=[start_drawn, len(drawn)],
        native=[start_native, len(native)],
        jetCount=count,
      )
    )
  fountain_counts = [len(drawn), len(native)]
  # Native mode does not carry the drawn DistrictStreets kerb mesh. Rebuild
  # just these retained tops as independent, full source-contained grid cells.
  native_kerbs = native_kerb_rectangles(source)
  for row in native_kerbs:
    put(native, row)
  # Sparse joint lines on the existing full 22 cm kerb tops. The tiny native
  # marks use independently fitted orthogonal rectangles inside the same top.
  seen: set[tuple[float, float]] = set()
  for feature in source["kerbs"]:
    line = LineString(feature["points"])
    for distance in np.arange(1.1, line.length - 0.2, 2.2):
      p, q = (
        line.interpolate(distance),
        line.interpolate(min(line.length, distance + 0.01)),
      )
      key = (round(p.x, 2), round(p.y, 2))
      if key in seen:
        continue
      seen.add(key)
      angle = math.atan2(-(q.y - p.y), q.x - p.x)
      joint = [p.x, 0.336, p.y, 0.035, 0.014, 0.19, angle, 0x909185]
      put(drawn, joint)
      # Orthogonal footprint fits the existing kerb strip; no smooth double.
      size = 0.11
      put(native, [p.x, 0.336, p.y, size, 0.014, size, 0x909185])
  return dict(
    schemaVersion=1,
    sourceSha256=hashlib.sha256(
      json.dumps(source, separators=(",", ":"), ensure_ascii=False).encode()
    ).hexdigest(),
    boxes=drawn,
    nativeRows=native,
    owners=owners,
    counts=dict(
      fountains=len(owners),
      jets=sum(r["jetCount"] for r in owners),
      drawnFountainMembers=fountain_counts[0],
      nativeFountainMembers=fountain_counts[1],
      nativeKerbMembers=len(native_kerbs),
      curbJoints=len(drawn) - fountain_counts[0],
      drawnMembers=len(drawn),
      nativeMembers=len(native),
      drawnInstanceBytes=len(drawn) * 76,
      nativeInstanceBytes=len(native) * 76,
    ),
  )


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract:
    SOURCE.write_text(json.dumps(extract(), separators=(",", ":"), ensure_ascii=False))
  result = build(json.loads(SOURCE.read_text()))
  OUTPUT.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(json.dumps(result["counts"]))


if __name__ == "__main__":
  main()
