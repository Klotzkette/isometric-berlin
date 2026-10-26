"""Bounded Tierpark animals, mapped aviary and retained restaurant facades."""

from __future__ import annotations

import argparse
import base64
import math
from collections import Counter
from typing import Any

import numpy as np
import pyogrio
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

from scripts import build_tierpark_v255 as previous
from scripts.build_surrounding_outlines import PackedMesh, line_parts, tags_for, world

city = previous.city
ROOT, GEO, DATA, OUT = city.ROOT, city.GEO, city.DATA, city.OUT
SOURCE = GEO / "tierpark-v276-source.json.gz"
EVIDENCE = GEO / "tierpark-v276-evidence.json.gz"
OUTPUT = DATA / "tierparkV276.json"
KIND = "tierpark-v276"
ANIMALS = {
  "way/336032294": ("wood-bison", 7),
  "relation/15095452": ("bactrian-camel", 6),
  "relation/15095451": ("dromedary", 6),
  "way/1500282455": ("flamingo", 28),
}
BUILDINGS = {"way/11269694": "Kakadu", "way/11643310": "Patagona"}
AVIARY = "relation/15126414"
TERRACE = "way/327432794"
REFERENCES = [
  "https://www.tierpark-berlin.de/de/tickets-service/tierpark-plan",
  "https://www.tierpark-berlin.de/fileadmin/tierpark/Service/Tierpark-Plan/Flyer/WEB_TPB_Parkplan_2026_v2_Anpassung_DE.pdf",
  "https://www.tierpark-berlin.de/de/aktuelles/news/artikel/neues-zuhause-fuer-pelikan-flamingo-co",
  "https://www.tierpark-berlin.de/de/tierpark-erleben/gastronomie",
  "https://marche-restaurants.de/standort/terrassencafe-kakadu-berlin/",
  "https://marche-restaurants.de/standort/patagona-tierpark-berlin/",
  "https://www.zoo-berlin.de/fileadmin/tierpark/Tierpark_erleben/Angebote_fuer_Kinder/Rallyes/Kita-Hort-Rallye_Haustiere_Baeren_ab_5_Jahren.pdf",
  "https://www.zoo-berlin.de/fileadmin/tierpark/Tierpark_erleben/Angebote_fuer_Kinder/Rallyes/Kita-Hort-Rallye_Hirsche_Kamele_ab_9_Jahren.pdf",
]


def mesh_guard(meshes: list[dict]) -> int:
  """Hash the exact immutable packet geometry used to bind exterior details."""
  value = 2166136261
  for m in meshes:
    for key in ("kind", "positionType", "positions", "colors", "indices"):
      for c in str(m.get(key, "")) + "|":
        value = ((value ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return value


def extract() -> None:
  """Keep complete OSM geometries, source tags and independent old receipts."""
  raw = GEO / "raw/east-v187/candidate.gpkg"
  zoo = shape(city.read(previous.SOURCE)["zoo"])
  features, paths, buildings, water = [], [], [], []
  selected = {*ANIMALS, *BUILDINGS, AVIARY, TERRACE}
  for layer in ("multipolygons", "lines"):
    for _, r in pyogrio.read_dataframe(raw, layer=layer).to_crs(25833).iterrows():
      t, g = tags_for(r), world(r.geometry)
      if not zoo.intersects(g):
        continue
      ident = (
        "way/" + t["osm_way_id"]
        if t.get("osm_way_id")
        else ("relation/" if layer == "multipolygons" else "way/") + t["osm_id"]
      )
      if ident in selected:
        features.append(dict(id=ident, tags=t, geometry=mapping(g)))
      if layer == "multipolygons":
        if t.get("building"):
          buildings.append(g)
        if t.get("natural") == "water":
          water.append(g)
      elif t.get("highway"):
        try:
          width = float(t.get("width", 3))
        except ValueError:
          width = 3
        paths.append(g.buffer(max(0.8, min(width / 2, 10)) + 0.3))
  assert {r["id"] for r in features} == selected
  retained_paths = [
    previous.SOURCE,
    previous.OUTPUT,
    previous.EVIDENCE,
    GEO / "east-landmarks-v187-evidence.json",
    DATA / "eastLandmarksV187.json",
    DATA / "eastLandmarksV187Native.json",
    DATA / "eastLandmarksV187Navigation.json",
  ]
  city.write(
    SOURCE,
    dict(
      schemaVersion=1,
      sourceDate="2026-09-29",
      checked="2026-10-26",
      references=REFERENCES,
      features=features,
      zoo=mapping(zoo),
      paths=mapping(unary_union(paths)),
      buildings=mapping(unary_union(buildings)),
      water=mapping(unary_union(water)),
      rawSha256=city.curbs.base.digest(raw),
      retained={
        str(p.relative_to(ROOT)): city.curbs.base.digest(p) for p in retained_paths
      },
      flamingoBoundaryLimit="OSM way/1500282455 is 1532.9m2 water, not the complete new 1800m2 aviary. No invented enclosing net or support locations.",
      currentAviaryFacts=dict(
        date="2026-06-09",
        flamingoAreaM2=1800,
        pelicanAreaM2=1650,
        maximumHeightM=10,
        combinedSupports=32,
      ),
    ),
  )


def ellipsoid(mesh: PackedMesh, center: list, size: list, color: tuple) -> None:
  """Small faceted drawn recognition volume, never a texture or moving animal."""
  x, y, z = center
  w, h, d = size
  rings = []
  for latitude in (-math.pi / 2, -math.pi / 6, math.pi / 6, math.pi / 2):
    rings.append(
      [
        (
          x + math.cos(latitude) * math.cos(i * math.pi / 4) * w / 2,
          y + math.sin(latitude) * h / 2,
          z + math.cos(latitude) * math.sin(i * math.pi / 4) * d / 2,
        )
        for i in range(8)
      ]
    )
  for lower, upper in zip(rings, rings[1:]):
    for i in range(8):
      j = (i + 1) % 8
      previous.quad(mesh, [lower[i], lower[j], upper[j], upper[i]], color)


def animal_members(kind: str) -> list[tuple]:
  """Metre-scale illustrative poses; population counts are not a live census."""
  if kind == "flamingo":
    pink, dark = (229, 126, 145), (65, 53, 49)
    return [
      (0, 0.86, 0, 0.66, 0.40, 0.32, pink, True),
      (0.10, 0.39, -0.09, 0.045, 0.78, 0.045, dark, False),
      (-0.16, 0.39, 0.09, 0.045, 0.78, 0.045, dark, False),
      (0.30, 1.12, 0, 0.10, 0.52, 0.10, pink, False),
      (0.23, 1.43, 0, 0.12, 0.26, 0.11, pink, False),
      (0.37, 1.53, 0, 0.24, 0.21, 0.18, pink, True),
      (0.49, 1.46, 0, 0.15, 0.12, 0.12, dark, False),
    ]
  bison = kind == "wood-bison"
  brown = (104, 73, 51) if bison else (177, 135, 82)
  head = (69, 48, 35) if bison else (154, 112, 64)
  members = [(0, 1.34, 0, 2.25, 1.13, 0.88, brown, True)]
  for x in (-0.80, 0.76):
    for z in (-0.30, 0.30):
      members.append((x, 0.51, z, 0.18, 1.02, 0.18, head, False))
  if bison:
    members += [
      (0.51, 1.87, 0, 1.20, 0.88, 1.02, head, True),
      (1.17, 1.29, 0, 0.75, 0.88, 0.73, head, True),
      (1.31, 0.78, 0, 0.24, 0.40, 0.32, head, False),
    ]
    for z in (-0.41, 0.41):
      members.append((1.13, 1.76, z, 0.12, 0.32, 0.13, (204, 192, 160), False))
  else:
    members += [
      (1.02, 1.89, 0, 0.30, 1.43, 0.34, brown, True),
      (1.25, 2.51, 0, 0.63, 0.37, 0.32, head, True),
    ]
    for x in (-0.47, 0.42) if kind == "bactrian-camel" else (0,):
      members.append((x, 2.04, 0, 0.72, 0.94, 0.77, brown, True))
  return members


def place_animal(
  mesh: PackedMesh, kind: str, x: float, z: float, index: int, native: bool
) -> None:
  """Independent native boxes; drawn faceted bodies retain the same true scale."""
  turn = index % 4
  for px, y, pz, w, h, d, color, rounded in animal_members(kind):
    for _ in range(turn):
      px, pz, w, d = -pz, px, d, w
    if native:
      # Native proportions are separate block volumes, not a smooth double.
      previous.solid(mesh, x + px, 3 + y, z + pz, w, h, d, color)
    elif rounded:
      ellipsoid(mesh, [x + px, 3 + y, z + pz], [w, h, d], color)
    else:
      previous.solid(mesh, x + px, 3 + y, z + pz, w, h, d, color)


def anchors(allowed: Any, count: int, spacing: float) -> list[list[float]]:
  """Deterministic sparse clusters wholly contained in the real enclosure."""
  if allowed.is_empty:
    return []
  center = allowed.representative_point()
  candidates = []
  for iz in range(-20, 21):
    for ix in range(-20, 21):
      x, z = center.x + ix * spacing, center.y + iz * spacing
      # 4m envelope includes every body/leg/horn and every cardinal pose.
      if allowed.covers(box(x - 2, z - 2, x + 2, z + 2)):
        candidates.append((ix * ix + iz * iz, iz, ix, [round(x, 3), round(z, 3)]))
  return [p[-1] for p in sorted(candidates)[:count]]


def face(
  mesh: PackedMesh,
  a: tuple,
  b: tuple,
  low: float,
  high: float,
  normal: tuple,
  color: tuple,
  offset: float,
) -> None:
  """One planar strip parallel to a retained exterior wall."""
  nx, nz = normal
  ax, az = a[0] + nx * offset, a[1] + nz * offset
  bx, bz = b[0] + nx * offset, b[1] + nz * offset
  previous.quad(
    mesh, [(ax, low, az), (bx, low, bz), (bx, high, bz), (ax, high, az)], color
  )
  previous.quad(
    mesh, [(ax, high, az), (bx, high, bz), (bx, low, bz), (ax, low, az)], color
  )


def rail(mesh: PackedMesh, a: tuple, b: tuple, y: float, native: bool) -> None:
  """Independently stair-step the native perimeter; never use diagonal boxes."""
  if native:
    steps = max(1, math.ceil(math.dist(a, b) / 0.5))
    for i in range(steps):
      x, z = (a[j] + (b[j] - a[j]) * i / steps for j in (0, 1))
      qx, qz = (a[j] + (b[j] - a[j]) * (i + 1) / steps for j in (0, 1))
      if abs(qx - x) > 0.005:
        previous.solid(
          mesh, (x + qx) / 2, y, z, abs(qx - x) + 0.08, 0.12, 0.12, (88, 102, 99)
        )
      if abs(qz - z) > 0.005:
        previous.solid(
          mesh, qx, y, (z + qz) / 2, 0.12, 0.12, abs(qz - z) + 0.08, (88, 102, 99)
        )
    return
  length = math.dist(a, b)
  dx, dz = (b[0] - a[0]) / length * 0.06, (b[1] - a[1]) / length * 0.06
  corners = [
    (a[0] - dz, a[1] + dx),
    (b[0] - dz, b[1] + dx),
    (b[0] + dz, b[1] - dx),
    (a[0] + dz, a[1] - dx),
  ]
  previous.quad(mesh, [(x, y + 0.06, z) for x, z in corners], (88, 102, 99))
  previous.quad(mesh, [(x, y - 0.06, z) for x, z in reversed(corners)], (88, 102, 99))
  for p, q in zip(corners, corners[1:] + corners[:1]):
    previous.quad(
      mesh,
      [
        (p[0], y - 0.06, p[1]),
        (q[0], y - 0.06, q[1]),
        (q[0], y + 0.06, q[1]),
        (p[0], y + 0.06, p[1]),
      ],
      (88, 102, 99),
    )


def wall_segments(packet: dict, geometry: Any, native: bool) -> list[tuple]:
  """Use actual rendered native boundary planes, never a rounded drawn facade."""
  ox, _, oz = packet["origin"]
  segments = set()
  for m in packet["meshes"]:
    p = np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3) / 100
    p += packet["origin"]
    ids = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    for tri in p[ids]:
      if min(tri[:, 1]) > 3.10 or max(tri[:, 1]) < 5.6:
        continue
      ground_points = sorted(set((float(v[0]), float(v[2])) for v in tri))
      if len(ground_points) != 2:
        continue
      a, b = ground_points
      line = LineString([a, b])
      if line.length < 1.5 or line.distance(geometry.boundary) > (
        2.1 if native else 0.05
      ):
        continue
      if not geometry.buffer(2.2 if native else 0.08).covers(line):
        continue
      if native and a[0] != b[0] and a[1] != b[1]:
        continue
      dx, dz = b[0] - a[0], b[1] - a[1]
      n = (dz / line.length, -dx / line.length)
      center = line.interpolate(0.5, normalized=True)
      if geometry.covers(Point(center.x + n[0] * 2.2, center.y + n[1] * 2.2)):
        n = (-n[0], -n[1])
      segments.add((a, b, n))
  return sorted(segments)


def build() -> dict:
  """Append finite companions to existing packets, preserving all old bytes."""
  source = city.read(SOURCE)
  features = {r["id"]: r for r in source["features"]}
  path_mask = shape(source["paths"])
  osm_buildings = shape(source["buildings"]).buffer(0.35)
  water = shape(source["water"])
  packets, receipts, audit = {}, {}, []
  counts = Counter()
  manifest = city.read(OUT / "manifest.json")
  zoo = shape(source["zoo"])
  # Freeze all existing park packet envelopes before selecting any positions.
  originals = {}
  occupied = []
  for entry in manifest["chunks"]:
    if not entry["id"].startswith("outer187-") or not box(*entry["bounds"]).intersects(
      zoo
    ):
      continue
    for family in ("drawn", "minecraft"):
      p = OUT / entry[family]["url"]
      packet = city.read(p)
      originals[(entry["id"], family)] = (entry, p, packet)
      ox, _, oz = packet["origin"]
      occupied.extend(
        translate(Polygon(b["ring"], b["holes"]), ox, oz)
        for b in packet["nav"]["buildings"]
      )
  occupied = unary_union(occupied).buffer(0.2)
  tile_interiors = unary_union(
    [box(*entry["bounds"]).buffer(-2.5) for (entry, _, _) in originals.values()]
  )
  animal_anchors = {}
  for ident, (kind, count) in ANIMALS.items():
    allowed = (
      shape(features[ident]["geometry"])
      .buffer(-1)
      .difference(path_mask)
      .difference(osm_buildings)
      .difference(occupied)
      .intersection(tile_interiors)
    )
    if kind != "flamingo":
      allowed = allowed.difference(water)
    animal_anchors[ident] = anchors(allowed, count, 3.8 if kind == "flamingo" else 8.5)
    assert len(animal_anchors[ident]) == count, ident
  for (ident, family), (entry, path, packet) in originals.items():
    native = family == "minecraft"
    ox, _, oz = packet["origin"]
    if packet["origin"][1] != -10 or packet["nav"]["groundY"] != 3:
      continue
    bounds = box(*entry["bounds"]).buffer(-2.5)
    ground = unary_union(
      [
        translate(Polygon(g["ring"], g["holes"]), ox, oz)
        for g in packet["nav"]["ground"]
      ]
    )
    wet_ground = ground.union(
      unary_union(
        [
          translate(Polygon(g["ring"], g["holes"]), ox, oz)
          for g in packet["nav"]["water"]
        ]
      )
    )
    mesh, records, solids = PackedMesh(ox, oz), [], []

    def collision(geometry: Any, low: float, high: float, source_id: str) -> None:
      local = translate(geometry, -ox, -oz)
      solids.append(
        dict(
          ring=list(local.exterior.coords),
          holes=[],
          minHeight=low,
          height=high,
          sourceId="tierpark-v276-" + source_id,
          heightSource="display-estimate",
        )
      )

    for aid, positions in animal_anchors.items():
      kind, _ = ANIMALS[aid]
      for i, (x, z) in enumerate(positions):
        support = wet_ground if kind == "flamingo" else ground
        if bounds.contains(Point(x, z)) and support.buffer(0.01).covers(
          box(x - 2, z - 2, x + 2, z + 2)
        ):
          start = len(mesh.indices) // 3
          place_animal(mesh, kind, x, z, i, native)
          records.append(
            dict(
              kind="animal",
              sourceId=aid,
              species=kind,
              point=[x, z],
              triangleRange=[start, len(mesh.indices) // 3],
              footprint=mapping(box(x - 2, z - 2, x + 2, z + 2)),
            )
          )
    for bid, name in BUILDINGS.items():
      geometry = shape(features[bid]["geometry"])
      if not bounds.covers(geometry):
        continue
      segments = wall_segments(packet, geometry, native)
      for a, b, n in segments:
        length = math.dist(a, b)
        # Existing wall size controls every strip. No new roof height or mass.
        for i in range(max(1, math.floor(length / 2.7))):
          parts = max(1, math.floor(length / 2.7))
          ta, tb = (i + 0.14) / parts, (i + 0.86) / parts
          start = tuple(a[j] + (b[j] - a[j]) * ta for j in (0, 1))
          end = tuple(a[j] + (b[j] - a[j]) * tb for j in (0, 1))
          face(mesh, start, end, 3.7, 5.55, n, (85, 111, 112), 0.07)
          for lo, hi in ((3.65, 3.75), (5.50, 5.60), (4.28, 4.34)):
            face(mesh, start, end, lo, hi, n, (218, 212, 188), 0.09)
          for t in (0, 0.5, 1):
            middle = tuple(start[j] + (end[j] - start[j]) * t for j in (0, 1))
            dx, dz = (b[0] - a[0]) / length * 0.05, (b[1] - a[1]) / length * 0.05
            face(
              mesh,
              (middle[0] - dx, middle[1] - dz),
              (middle[0] + dx, middle[1] + dz),
              3.65,
              5.60,
              n,
              (218, 212, 188),
              0.09,
            )
        records.append(
          dict(
            kind="restaurant-facade",
            sourceId=bid,
            name=name,
            edge=[a, b],
            normal=n,
            y=[3.65, 5.60],
            source="actual-existing-packet-wall",
          )
        )
    terrace = (
      shape(features[TERRACE]["geometry"])
      .difference(osm_buildings)
      .difference(occupied)
      .difference(path_mask)
      .difference(water)
    )
    for x, z in anchors(terrace, 8, 6.5):
      if not bounds.contains(Point(x, z)) or not ground.covers(
        box(x - 2, z - 2, x + 2, z + 2)
      ):
        continue
      for dx, dz, w, h, d, y in (
        (0, 0, 1.7, 0.12, 1.0, 0.77),
        (0, 0, 0.18, 0.70, 0.18, 0.35),
        (-1.1, 0, 0.40, 0.12, 0.65, 0.42),
        (1.1, 0, 0.40, 0.12, 0.65, 0.42),
        (-1.1, 0, 0.14, 0.36, 0.14, 0.18),
        (1.1, 0, 0.14, 0.36, 0.14, 0.18),
      ):
        previous.solid(mesh, x + dx, 3 + y, z + dz, w, h, d, (157, 123, 85))
        collision(
          box(x + dx - w / 2, z + dz - d / 2, x + dx + w / 2, z + dz + d / 2),
          y - h / 2,
          y + h / 2,
          TERRACE,
        )
      records.append(
        dict(
          kind="terrace-table",
          sourceId=TERRACE,
          point=[x, z],
          footprint=mapping(box(x - 2, z - 2, x + 2, z + 2)),
        )
      )
    # A mapped height belongs to this one named aviary, not arbitrary enclosures.
    aviary = shape(features[AVIARY]["geometry"])
    height = float(features[AVIARY]["tags"]["height"])
    safe = ground.difference(occupied).difference(osm_buildings).difference(path_mask)
    for polygon in getattr(aviary, "geoms", [aviary]):
      ring = LineString(polygon.exterior.coords)
      # Higher rails follow the actual enclosure perimeter. They do not seal
      # the enclosure with an invented opaque roof or cross a retained body.
      clear_ring = (
        ring.intersection(bounds)
        .difference(occupied.buffer(0.8))
        .difference(osm_buildings.buffer(0.8))
      )
      for line in line_parts(clear_ring):
        for a, b in zip(line.coords, list(line.coords)[1:]):
          if math.dist(a, b) < 0.1:
            continue
          rail(mesh, a, b, 3 + height, native)
          records.append(
            dict(kind="aviary-rail", sourceId=AVIARY, edge=[a, b], height=height)
          )
      for i in range(math.ceil(ring.length / 6)):
        point = ring.interpolate(i * ring.length / math.ceil(ring.length / 6))
        x, z = point.x, point.y
        footprint = box(x - 0.10, z - 0.10, x + 0.10, z + 0.10)
        if not bounds.covers(footprint) or not safe.covers(footprint):
          continue
        previous.solid(mesh, x, 3 + height / 2, z, 0.12, height, 0.12, (88, 102, 99))
        collision(box(x - 0.06, z - 0.06, x + 0.06, z + 0.06), 0, height, AVIARY)
        records.append(
          dict(
            kind="aviary-post",
            sourceId=AVIARY,
            point=[x, z],
            height=height,
            footprint=mapping(footprint),
          )
        )
    payload = mesh.payload(KIND)
    if not payload:
      continue
    key = family + ":" + ident
    packets[key] = dict(
      origin=packet["origin"],
      guard=city.curbs.ground_guard(packet["nav"]["ground"]),
      meshGuard=mesh_guard(packet["meshes"]),
      baseMeshCount=len(packet["meshes"]),
      mesh=payload,
      solids=solids,
    )
    receipts[str(path.relative_to(ROOT))] = city.curbs.base.digest(path)
    audit.append(
      dict(
        key=key,
        records=records,
        triangles=len(mesh.indices) // 3,
        vertices=len(mesh.vertices),
      )
    )
    counts[family + "Triangles"] += len(mesh.indices) // 3
    counts[family + "Packets"] += 1
    for row in records:
      counts[family + ":" + row["kind"]] += 1
  for family in ("drawn", "minecraft"):
    assert counts[family + ":animal"] == sum(r[1] for r in ANIMALS.values()), dict(
      counts
    )
  city.write(OUTPUT, dict(schemaVersion=1, ids=sorted(packets), packets=packets))
  evidence = dict(
    schemaVersion=1,
    version="1.0.176",
    sourceSha256=city.curbs.base.digest(SOURCE),
    counts=dict(counts),
    records=audit,
    retained={**source["retained"], **receipts},
    references=REFERENCES,
    limits=[
      "All poses, animal counts, table locations, facade subdivisions and aviary post spacing are display estimates inside exact retained source geometry, not a current animal census or measured facade inventory.",
      "Flamingo water is not the complete 2026 aviary footprint: no invented net enclosure. The official June2026 finished dimensions supersede earlier construction estimates.",
      "LoD2 parents DEBE11YYI0000Nwj (20.07m flamingo shed) and DEBE11YYI0000Lb6 (20.92m beside raptor aviary) are retained; their suspicious heights lack independently matched roof evidence. New details do not conceal or shorten them.",
      "Existing ground y=3 is retained. No surveyed new terrain, copied visitor map, texture, animation, new descriptor or resident budget change.",
    ],
  )
  city.write(EVIDENCE, evidence)
  return evidence


def main() -> None:
  """Rebuild the finite source and checked display companion."""
  parser = argparse.ArgumentParser()
  parser.add_argument("--extract", action="store_true")
  if parser.parse_args().extract:
    extract()
  print(build()["counts"])


if __name__ == "__main__":
  main()
