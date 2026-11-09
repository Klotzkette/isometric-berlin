"""Attach finite photographic facade detail to the original Albrechtstraße packet walls."""

from __future__ import annotations

import argparse
import gzip
import json
import math
import re
from pathlib import Path

import numpy as np
from pyproj import Transformer
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import nearest_points, transform, unary_union
from shapely.strtree import STRtree

from scripts import build_district_facades_v188 as base
from scripts.build_cluster_facades_v320 import (
  FAMILIES,
  FrontMesh,
  door_bounds,
  exclusions,
  fnv,
  part_fingerprint,
  read,
  sha,
  verify_primary_owner,
  write,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
RAW = GEO / "raw/v182-steglitz"
TILE = "ring182--7_13"
KIND = "albrechtstrasse-v328"
SOURCE_BASELINE = "fb47763d223f4fda3afcd8913c8e8adbbb5dfd59"
SOURCE_SHA = {
  "drawn": "9c557b4f8247ce5a5c058585d1e4f4779e5060498b98af0364b6ff1d40e84860",
  "minecraft": "e2ca22348a6a74e1d9212ae6375420ef4c2eb43d8ab7faf380c6ab29ba5d5792",
}
# The contemporary readings come from address-specific views, not a generic
# heritage palette. Dimensions and miniature sash layouts are estimates.
# Each profile is OSM way, exact packet owner, residential floors, bays,
# window shape, projecting detail and finish.
FRONTS = {
  7: (4847098, "DEBE06YYB00005Hc", 3, 6, "broad-arch", "oriel", (212, 206, 185)),
  8: (113994783, "DEBE06YYB0000CHB", 3, 5, "broad-arch", "pilaster", (228, 221, 200)),
  9: (113994785, "DEBE06YYB0000DMG", 3, 4, "tall-sash", "twin-bays", (201, 194, 181)),
  10: (113994788, "DEBE06YYB0000B5x", 3, 5, "glazed-bay", "twin-bays", (207, 201, 183)),
  11: (194945776, "DEBE06YYB0000DjZ", 3, 5, "tall-sash", "oriel", (226, 222, 208)),
  12: (255477837, "DEBE06YYB0000FQ5", 3, 7, "tall-arch", "balconies", (214, 208, 190)),
  119: (
    128522643,
    "DEBE06YYB0000erM",
    3,
    6,
    "tall-sash",
    "side-loggias",
    (222, 219, 207),
  ),
  124: (
    113993815,
    "DEBE06YYB0000yeG",
    3,
    5,
    "tall-sash",
    "flower-balconies",
    (232, 228, 212),
  ),
}
PHOTOS = {
  7: "120916-Steglitz-Albrechtstr._7.JPG",
  8: "120916-Steglitz-Albrechtstr._8.JPG",
  9: "120916-Steglitz-Albrechtstr._9.JPG",
  10: "120916-Steglitz-Albrechtstr._10.JPG",
  11: "120518-Steglitz-Albrechtstr.11.JPG",
  12: "120916-Steglitz-Albrechtstr._12.JPG",
  119: "140302-Steglitz-Albrechtstr._119.JPG",
  124: "120922-Steglitz-Albrechtstraße-124.JPG",
}
MODERN = {
  "113": "DEBE06AL2RJ00036",
  "112b": "DEBE06AL2RJ0003u",
  "112c": "DEBE06AL2RJ0004l",
  "112d": "DEBE06AL2RJ0005E",
  "112e": "DEBE06AL2RJ0005j",
  "112f": "DEBE06AL2RJ00067",
}
PHOTO_LICENSES = {
  number: f"https://creativecommons.org/licenses/{'by' if number in (11, 12) else 'by-sa'}/3.0"
  for number in PHOTOS
}
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True)


def world(lon, lat):
  east, north = PROJECT.transform(lon, lat)
  return east - 389500, 5820000 - north


def edges(ring):
  return zip(ring, ring[1:] + ring[:1], strict=True)


def original(mode):
  path = PUBLIC / f"{TILE}.{mode}.json.gz"
  raw = path.read_bytes()
  if sha(raw) != SOURCE_SHA[mode]:
    raise ValueError(f"Changed complete {mode} packet")
  body = gzip.decompress(raw)
  return json.loads(body), {
    "path": str(path.relative_to(ROOT)),
    "wireSha256": sha(raw),
    "decodedSha256": sha(body),
  }


def current_protections():
  already = exclusions()
  already.update(MODERN.values())
  already.update(
    {"DEBE06YYB0000PVc", "DEBE06YYB00007sz"}
  )  # V248 / separate Heesestraße
  for name in ("west", "north", "south"):
    clusters = read(GEO / f"cluster-facades-v320-{name}-profile.json")["clusters"]
    already.update(face["owner"] for cluster in clusters for face in cluster["faces"])
  for evidence, _, _ in FAMILIES.values():
    already.update(face["owner"] for face in read(GEO / evidence)["faces"])
  return already


def source_areas(packet):
  x, _, z = packet["origin"]
  result = {}
  for row in packet["nav"]["buildings"]:
    p = translate(Polygon(row["ring"], row["holes"]).buffer(0), x, z)
    if not p.is_empty:
      result.setdefault(row["sourceId"], []).append(p)
  return {id: unary_union(parts) for id, parts in result.items()}


def wall_candidates(packet, triangles, owner, body, roads, foreign, native):
  ox, oy, oz = packet["origin"]
  origin = np.array([ox, oz])
  for row in packet["nav"]["buildings"]:
    if row["sourceId"] != owner:
      continue
    ground = packet["nav"]["groundY"] + row.get("groundOffset", 0)
    low, high = ground + row["minHeight"], ground + row["height"]
    for first, second in edges(row["ring"]):
      if native and first[0] != second[0] and first[1] != second[1]:
        continue
      a, b = np.asarray(first) + origin, np.asarray(second) + origin
      length = math.dist(a, b)
      if length < (1.95 if native else 2.5) or high - low < 7:
        continue
      if not base.source_wall_exists(triangles, first, second, low - oy, high - oy):
        continue
      d = (b - a) / length
      n = np.array([-d[1], d[0]])
      mid = (a + b) / 2
      if body.covers(Point(mid + n * 0.22)):
        n = -n
      if body.covers(Point(mid + n * 0.22)):
        continue
      nearest = np.array(nearest_points(Point(mid), roads)[1].coords[0])
      toward = nearest - mid
      distance = float(np.linalg.norm(toward))
      if not 3 <= distance <= 28 or np.dot(toward, n) < distance * (
        0.62 if native else 0.75
      ):
        continue
      # Each decoration lies within 0.5 m of its verified outward wall.
      # Test that whole strip as well as the actual street sightline.
      clearance = Polygon(
        [
          a + d * 0.1 + n * 0.025,
          b - d * 0.1 + n * 0.025,
          b - d * 0.1 + n * 0.55,
          a + d * 0.1 + n * 0.55,
        ]
      )
      if len(foreign.query(clearance, predicate="intersects")) or len(
        foreign.query(LineString([mid + n * 0.22, nearest]), predicate="intersects")
      ):
        continue
      yield {
        "a": a.tolist(),
        "b": b.tolist(),
        "normal": n.tolist(),
        "owner": owner,
        "low": low,
        "high": high,
        "distance": distance,
        "length": length,
      }


def visible_faces(packet, triangles, owner, areas, roads, native, drawn_faces=()):
  foreign = STRtree([area for id, area in areas.items() if id != owner])
  result = list(
    wall_candidates(packet, triangles, owner, areas[owner], roads, foreign, native)
  )
  if not native:
    result.sort(
      key=lambda face: (face["distance"] - face["length"] * 0.15, -face["length"])
    )
    # Extra bay planes may join the primary front if they are comparably
    # streetward and their actual positive support remains disjoint.
    if not result:
      raise ValueError(f"{owner} has no candidate visible Drawn host walls")
    main = result[0]
    result = [
      face
      for face in result
      if face["distance"] <= main["distance"] + 4.5
      and float(np.dot(face["normal"], main["normal"])) > 0.55
    ]
  else:
    masks = [
      (LineString([f["a"], f["b"]]).buffer(2.25, cap_style=2), f["normal"])
      for f in drawn_faces
    ]
    result = [
      f
      for f in result
      if any(
        mask.covers(LineString([f["a"], f["b"]])) and np.dot(normal, f["normal"]) > 0.6
        for mask, normal in masks
      )
    ]
  unique = {}
  for f in result:
    verify_primary_owner(packet, f)
    unique.setdefault(
      (tuple(sorted((tuple(f["a"]), tuple(f["b"])))), f["low"], f["high"]), f
    )
  if not unique:
    raise ValueError(
      f"{owner} lacks independently verified visible {'Native' if native else 'Drawn'} host walls"
    )
  return list(unique.values())


def arch(mesh, face, left, bottom, right, top, depth, color, native):
  width = right - left
  rise = min(width * 0.37, (top - bottom) * 0.35)
  spring = top - rise
  mesh.rectangle(face, left, bottom, right, spring, depth, color)
  if native:
    for step in range(4):
      u0, u1 = -1 + step / 2, -0.5 + step / 2
      # Independent cardinal reading with a whole inset step over each strip.
      tip = spring + rise * math.sqrt(1 - max(abs(u0), abs(u1)) ** 2)
      mesh.rectangle(
        face,
        left + (u0 + 1) * width / 2,
        spring,
        left + (u1 + 1) * width / 2,
        tip,
        depth,
        color,
      )
    return
  center = (left + right) / 2
  points = [
    (
      center + width / 2 * math.cos(math.pi * i / 8),
      spring + rise * math.sin(math.pi * i / 8),
      depth,
    )
    for i in range(9)
  ]
  for a, b in zip(points, points[1:]):
    mesh.local_quad(face, [(center, spring, depth), a, b, b], color)
    mesh.indices[-3:] = []  # A triangle, without a repeated zero-area triangle.


def decorate(mesh, face, config, frontage_length, doors, native):
  _, _, storeys, total_bays, shape_name, relief, frame = config
  span = face["length"]
  low, high = face["low"], face["high"]
  door_rects = [box(*d) for d in door_bounds(face, doors, native)]
  # Keep the eaves/caps within the actual host. The upper 1.35 m is reserved
  # for the cornice and the existing roof transition.
  eave = high - 1.35
  ground = min(low + 4.05, low + (eave - low) * 0.27)
  pitch = (eave - ground) / storeys
  bays = max(1, min(total_bays, round(total_bays * span / frontage_length)))
  bay = span / bays
  dark = (68, 85, 90)
  reveal = (102, 99, 90)
  bands = tuple(max(0, c - 26) for c in frame)

  def plate(u0, y0, u1, y1, depth, tone):
    if u0 < 0.07 or u1 > span - 0.07 or y0 < low or y1 > high:
      return False
    if any(box(u0, y0, u1, y1).intersects(r) for r in door_rects):
      return False
    mesh.rectangle(face, u0, y0, u1, y1, depth, tone)
    return True

  windows = 0
  for i in range(bays):
    u = (i + 0.5) * bay
    ground_w = min(2.5, bay * 0.76)
    if plate(
      u - ground_w / 2, low + 0.62, u + ground_w / 2, ground - 0.27, 0.075, (73, 91, 94)
    ):
      plate(
        u - ground_w / 2, ground - 0.36, u + ground_w / 2, ground - 0.23, 0.15, bands
      )
      plate(u - 0.033, low + 0.63, u + 0.033, ground - 0.36, 0.13, frame)
    for j in range(storeys):
      y = ground + (j + 0.52) * pitch
      side = i in (0, bays - 1)
      broad = (
        shape_name == "glazed-bay"
        and side
        or relief in {"side-loggias", "flower-balconies"}
        and side
      )
      width = min(2.15 if broad else 1.56, bay * (0.71 if broad else 0.58))
      height = min(2.35, pitch * (0.67 if broad else 0.59))
      x0, x1 = u - width / 2, u + width / 2
      y0, y1 = y - height / 2, y + height / 2
      stone = 0.095
      if any(
        box(x0 - stone, y0 - 0.15, x1 + stone, y1 + stone).intersects(r)
        for r in door_rects
      ):
        continue
      arched = shape_name == "tall-arch" or shape_name == "broad-arch" and j == 0
      if arched:
        arch(
          mesh,
          face,
          x0 - stone,
          y0 - stone,
          x1 + stone,
          y1 + stone,
          0.145,
          frame,
          native,
        )
        arch(mesh, face, x0, y0, x1, y1, 0.156, dark, native)
      else:
        plate(x0 - stone, y0 - stone, x1 + stone, y1 + stone, 0.143, frame)
        plate(x0, y0, x1, y1, 0.154, dark)
      plate(u - 0.028, y0, u + 0.028, y1 - (0.20 if arched else 0), 0.169, frame)
      plate(x0, y0 + height * 0.69, x1, y0 + height * 0.69 + 0.052, 0.172, frame)
      plate(x0 - 0.10, y0 - 0.155, x1 + 0.10, y0 - 0.045, 0.219, bands)
      if (
        relief in {"balconies", "side-loggias", "flower-balconies"}
        and side
        and bay > 2.05
      ):
        balcony = min(bay * 0.82, width + 0.42)
        left, right = u - balcony / 2, u + balcony / 2
        # The closed ledge and rail are projected features attached to this
        # source plane, not deep balconies with invented floor plans.
        if plate(left, y0 - 0.23, right, y0 - 0.12, 0.41, frame):
          mesh.returns(face, left, y0 - 0.23, right, y0 - 0.12, 0.14, 0.41, bands)
        plate(left, y0 + 0.43, right, y0 + 0.49, 0.41, bands)
        for rail in range(5):
          r = left + 0.06 + (right - left - 0.12) * rail / 4
          plate(r - 0.025, y0 - 0.12, r + 0.025, y0 + 0.43, 0.41, reveal)
      windows += 1
  for j in range(storeys + 1):
    y = ground + j * pitch
    plate(0.12, y - 0.095, span - 0.12, y + 0.06, 0.18, bands)
  for delta, depth in ((0.24, 0.23), (0.48, 0.29)):
    plate(0.12, eave + delta, span - 0.12, eave + delta + 0.13, depth, frame)
  if relief in {"oriel", "pilaster", "twin-bays"} and span > 5:
    for u in (span * 0.17, span * 0.83):
      plate(u - 0.075, ground + 0.16, u + 0.075, eave - 0.1, 0.255, bands)
  return windows


def prove_serialized_fittings(mesh, face, start, native):
  """Check every emitted centimetre triangle against its supported wall."""
  a = np.asarray(face["a"])
  d = (np.asarray(face["b"]) - a) / face["length"]
  n = np.asarray(face["normal"])
  ids = np.asarray(mesh.indices[start:]).reshape(-1, 3)
  points = np.asarray(mesh.positions)[ids] / 100 + mesh.origin
  along = (points[..., [0, 2]] - a) @ d
  away = (points[..., [0, 2]] - a) @ n
  if (
    np.any(along < 0.05)
    or np.any(along > face["length"] - 0.05)
    or np.any(away < 0.06)
    or np.any(away > 0.43)
    or np.any(points[..., 1] < face["low"])
    or np.any(points[..., 1] > face["high"])
  ):
    raise ValueError("Quantized detail escaped its proved outward wall")
  cross = np.cross(points[:, 1] - points[:, 0], points[:, 2] - points[:, 0])
  if np.any(np.linalg.norm(cross, axis=1) < 1e-7):
    raise ValueError("Collapsed centimetre detail")
  if native and np.any(np.count_nonzero(np.abs(cross) > 1e-7, axis=1) != 1):
    raise ValueError("Native detail must remain axis-aligned")
  if np.dot(np.array([-d[1], d[0]]), n) < 0:
    mesh.indices[start:] = ids[:, [0, 2, 1]].flatten().tolist()


def build():
  protected = current_protections()
  if any(row[1] in protected for row in FRONTS.values()):
    raise ValueError("A historic front already has a protected authored owner")
  raw_polygons = read(RAW / "multipolygons.json")["features"]
  osm = {
    int(p["osm_way_id"] or p["osm_id"]): f
    for f in raw_polygons
    if (p := f["properties"])["osm_way_id"] or p["osm_id"]
  }
  roads = unary_union(
    [
      transform(world, shape(f["geometry"]))
      for f in read(RAW / "lines.json")["features"]
      if f["properties"].get("name") == "Albrechtstraße"
      and f["properties"].get("highway") == "secondary"
    ]
  )
  doors = read(GEO / "house-doors-v233-evidence.json.gz")["doors"]
  packets, report, drawn_faces, packet_sources = {}, {}, {}, {}
  for mode in SOURCE_SHA:
    native = mode == "minecraft"
    packet, packet_sources[mode] = original(mode)
    areas = source_areas(packet)
    triangles = base.mesh_wall_triangles(packet)
    mesh = FrontMesh(packet["origin"])
    for number, config in FRONTS.items():
      way, owner, *_ = config
      tags = dict(
        re.findall(
          r'"([^"]+)"=>"([^"]*)"', osm[way]["properties"].get("other_tags") or ""
        )
      )
      if (tags.get("addr:street"), tags.get("addr:housenumber")) != (
        "Albrechtstraße",
        str(number),
      ):
        raise ValueError(f"Address changed for OSM way {way}")
      measured = transform(world, shape(osm[way]["geometry"]))
      overlap = (
        measured.intersection(areas[owner]).area / measured.union(areas[owner]).area
      )
      if overlap < (0.72 if native else 0.90):
        raise ValueError(f"Address/packet footprint proof changed for {number}")
      faces = visible_faces(
        packet, triangles, owner, areas, roads, native, drawn_faces.get(number, [])
      )
      if not native:
        drawn_faces[number] = faces
      frontage = sum(f["length"] for f in drawn_faces[number])
      before = len(mesh.indices)
      count = 0
      for face in faces:
        start = len(mesh.indices)
        count += decorate(mesh, face, config, frontage, doors, native)
        prove_serialized_fittings(mesh, face, start, native)
      if count <= 0:
        raise ValueError(f"Empty {mode} fittings at Albrechtstraße {number}")
      report.setdefault(
        number,
        {
          "osmId": way,
          "osmType": "relation" if number == 7 else "way",
          "owner": owner,
          "photo": "https://commons.wikimedia.org/wiki/File:" + PHOTOS[number],
          "photoAuthor": "Muns",
          "photoLicense": PHOTO_LICENSES[number],
          "profile": config[4:6],
        },
      )[mode] = {
        "footprintIoU": overlap,
        "fullHostFaces": faces,
        "windows": count,
        "appendTriangles": (len(mesh.indices) - before) // 3,
      }
    mesh.compact()
    part = mesh.payload()["meshes"][0]
    part["kind"] = KIND
    line = packet.get("lines")
    packets[f"{mode}:{TILE}"] = {
      "origin": packet["origin"],
      "navGuard": 0,
      "lineGuard": fnv(line["positions"], line.get("colors", "")) if line else None,
      "records": [
        {"mesh": i, "kind": p["kind"], "fingerprint": part_fingerprint(p)}
        for i, p in enumerate(packet["meshes"])
      ],
      "append": part,
      "appendFingerprint": part_fingerprint(part),
      "retire": [],
      "owners": sorted(config[1] for config in FRONTS.values()),
    }
  evidence = {
    "schemaVersion": 1,
    "sourceBaseline": SOURCE_BASELINE,
    "heritageEnsemble": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065457",
    "osmInputs": {
      name: sha((RAW / name).read_bytes())
      for name in ("lines.json", "multipolygons.json")
    },
    "sourcePackets": packet_sources,
    "fronts": report,
    "preserved13": {
      "owner": "DEBE06YYB0000FDM",
      "addressNode": 3485829367,
      "way": 128519849,
      "previous": "V320",
    },
    "modernExceptions": MODERN,
    "modernProjectSource": "https://www-openpr-de.b-cdn.net/news/763290/Berlin-PROJECT-Immobilien-beginnt-Bauarbeiten-an-den-Steglitzer-Hoefen.html",
    "policy": "Finite fittings on proved original wall planes. New joinery, projection, and material colours are display estimates. The complete previous packets, bodies, roofs, lines and navigation remain intact.",
  }
  return {"schemaVersion": 1, "keys": sorted(packets), "packets": packets}, evidence


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--staged",
    type=Path,
    required=True,
    help="External provisional JSON, finalized with Bun",
  )
  args = parser.parse_args()
  plans, evidence = build()
  write(args.staged, plans)
  write(GEO / "albrechtstrasse-v328-evidence.json", evidence)
  print(
    json.dumps(
      {
        mode: {
          key: sum(f[mode][key] for f in evidence["fronts"].values())
          for key in ("windows", "appendTriangles")
        }
        for mode in SOURCE_SHA
      }
    )
  )


if __name__ == "__main__":
  main()
