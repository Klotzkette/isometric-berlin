"""Replay retained OSM plans and packet owners into the named elevated stations."""

from __future__ import annotations

import argparse
import math
import re
from collections import defaultdict

import numpy as np
import pyogrio
from shapely.geometry import LineString, Point, box, mapping, shape
from shapely.ops import linemerge, split, unary_union

from scripts.build_district_facades_v188 import (
  GEO,
  OUT,
  ROOT,
  digest,
  read_json,
  world,
  write_json,
)
from scripts.build_karl_marx_allee_v161 import packed_detail
from scripts.build_roof_house_v233 import fingerprint, line_receipt, match_owner
from scripts.build_south_elevated_v238 import (
  RailDetail,
  beam,
  hall_axis,
  lines,
  nav_solids,
  slab,
)

SOURCE = GEO / "named-elevated-v334-source.json.gz"
RUNTIME = ROOT / "src/app/src/data/namedElevatedStationsV334.json"
CANDIDATE = GEO / "raw/outer-v159/candidate.gpkg"
SOUTH = GEO / "south-elevated-v238-source.json.gz"

SCHOEN_TRACKS = (375386236, 375386237, 200422334, 24180220, 375386238, 375386235)
SCHOEN_STAIRS = (375386244, 1290700870, 375386242, 375386241)
SCHLES_TRACKS = (384345633, 384345634, 155667505, 155667501)
SCHOEN_ROOFS = (375386234, 465412568, 465412570)
SCHOEN_PLATFORM = 5587153
GREIF_BRIDGE = 380548413
GREIF_WALK = 45064342
GREIF_STAIR = 380548415

STEEL = (78, 107, 94)
DARK_STEEL = (53, 75, 66)
RAIL = (152, 158, 154)
GLASS = (142, 170, 173)
ROOF = (107, 125, 112)
SANDSTONE = (192, 174, 143)
STONE_LIGHT = (215, 195, 157)
STONE_SHADE = (124, 112, 96)
PLATFORM = (188, 184, 170)
VIA_FLOOR = 8.70
PLATFORM_FLOOR = VIA_FLOOR + 0.92


def extract() -> None:
  """Record complete selected geometries, retaining their original source IDs."""
  ids = {
    ("lines", "osm_id"): (
      *SCHOEN_TRACKS,
      *SCHOEN_STAIRS,
      *SCHLES_TRACKS,
      GREIF_BRIDGE,
      GREIF_WALK,
      GREIF_STAIR,
    ),
    ("multipolygons", "osm_way_id"): SCHOEN_ROOFS,
    ("multipolygons", "osm_id"): (SCHOEN_PLATFORM,),
  }
  features = {}
  for (layer, field), wanted in ids.items():
    where = field + " IN (" + ",".join(f"'{v}'" for v in wanted) + ")"
    rows = pyogrio.read_dataframe(CANDIDATE, layer=layer, where=where).to_crs(25833)
    for row in rows.to_dict("records"):
      identifier = (
        "relation/" if layer == "multipolygons" and field == "osm_id" else "way/"
      ) + str(row[field])
      raw = dict(re.findall(r'"([^"]+)"=>"([^"]*)"', str(row["other_tags"])))
      tags = {
        k: raw[k]
        for k in (
          "level",
          "layer",
          "gauge",
          "bridge",
          "bridge:structure",
          "step_count",
          "width",
          "incline",
        )
        if k in raw
      }
      features[identifier] = dict(tags=tags, geometry=mapping(world(row["geometry"])))
    assert len(rows) == len(wanted), (layer, field, len(rows), len(wanted))
  south = read_json(SOUTH)
  bulow = {
    "hall": south["features"]["15699875"]["geometry"],
    "stairs": [row for row in south["stairs"] if row["station"] == "buelow"],
  }
  write_json(
    SOURCE,
    dict(
      schema=1,
      source="OpenStreetMap ODbL 1.0",
      candidateSha256=digest(CANDIDATE),
      southSha256=digest(SOUTH),
      features=features,
      bulow=bulow,
    ),
  )


def member(detail, a, b, width, height, tone, role, native, step=1.20):
  beam(detail, a, b, width, height, tone, role, native, step)


def at(p, y):
  return [float(p[0]), y, float(p[1])]


def points(line, a, b, lateral=0):
  """The two ends of a local rail, chord or handrail on a mapped course."""
  p = np.asarray(line.interpolate(a).coords[0])
  q = np.asarray(line.interpolate(b).coords[0])
  d = q - p
  n = np.array([-d[1], d[0]]) / np.linalg.norm(d)
  return p + lateral * n, q + lateral * n


def rail(detail, path, y, native):
  for a, b in zip(path.coords, list(path.coords)[1:]):
    path_segment = LineString([a, b])
    member(
      detail,
      at(a, y - 0.37),
      at(b, y - 0.37),
      2.71,
      0.44,
      STEEL,
      "elevated tray",
      native,
    )
    for offset in (-0.7175, 0.7175):
      p, q = points(path_segment, 0, path_segment.length, offset)
      member(
        detail, at(p, y), at(q, y), 0.09, 0.12, RAIL, "1435 mm running rail", native
      )


def lattice(detail, path, bottom, top, lateral, native):
  """Open steel framing is placed against the sides of the existing deck."""
  length = path.length
  count = math.ceil(length / 3.8)
  for i in range(count):
    a, b = i * length / count, (i + 1) * length / count
    p, q = points(path, a, b, lateral)
    for y in (bottom, top):
      member(
        detail,
        at(p, y),
        at(q, y),
        0.15,
        0.17,
        DARK_STEEL,
        "viaduct lattice chord",
        native,
      )
    member(
      detail,
      at(p, bottom),
      at(q, top),
      0.11,
      0.13,
      STEEL,
      "viaduct lattice brace",
      native,
    )
    member(
      detail,
      at(p, top),
      at(q, bottom),
      0.11,
      0.13,
      STEEL,
      "viaduct lattice brace",
      native,
    )


def outline(detail, polygon, y, tone, role, native):
  for ring in [polygon.exterior, *polygon.interiors]:
    for a, b in zip(ring.coords, list(ring.coords)[1:]):
      member(detail, at(a, y), at(b, y), 0.09, 0.075, tone, role, native)


def stair(detail, path, width, low, high, native):
  count = math.ceil(abs(high - low) / 0.18)
  for i in range(count):
    a, b = i * path.length / count, (i + 1) * path.length / count
    p, q = points(path, a, b)
    y = low + (high - low) * (i + 1) / count
    member(
      detail,
      at(p, y - 0.073),
      at(q, y - 0.073),
      width,
      0.146,
      PLATFORM,
      "mapped stairs",
      native,
      0.25,
    )
  p, q = points(path, 0, path.length)
  member(
    detail,
    at(p, low - 0.25),
    at(q, high - 0.25),
    width * 0.84,
    0.26,
    DARK_STEEL,
    "stair stringer",
    native,
  )
  for s in (-1, 1):
    a, b = points(path, 0, path.length, s * width / 2)
    for offset in (0.5, 1.02):
      member(
        detail,
        at(a, low + offset),
        at(b, high + offset),
        0.075,
        0.083,
        DARK_STEEL,
        "stair handrail",
        native,
        0.4,
      )
    for t in np.linspace(0, 1, math.ceil(path.length / 1.2) + 1):
      p = a + (b - a) * t
      detail.box(
        at(p, low + (high - low) * t + 0.54),
        [0.09, 1.08, 0.09],
        DARK_STEEL,
        "stair handrail upright",
      )


def roof_and_frames(detail, roof, floor, eave, rise, enclosing, native):
  c, u, v, a, b, half = hall_axis(roof)

  def top(x, z):
    across = min(1, abs(np.dot(np.array([x, z]) - c, v)) / half)
    return eave + rise * math.sqrt(max(0, 1 - across * across))

  # The long steel barrel and narrower rooflight remain distinct profiles.
  # The source roof plan supplies the perimeter, and longitudinal seams keep
  # each arched cross section explicit in the Drawn geometry.
  parts = [roof]
  for f in (-0.72, -0.4, 0, 0.4, 0.72) if enclosing else (0,):
    axis = LineString([c + u * (a - 4) + v * f * half, c + u * (b + 4) + v * f * half])
    parts = [part for sheet in parts for part in split(sheet, axis).geoms]
  for part in parts:
    slab(
      detail,
      part,
      lambda x, z: top(x, z) - 0.17,
      top,
      ROOF,
      "mapped hall roof",
      native,
      0.88,
    )
  if enclosing:
    c0, c1 = c + u * (a + 2), c + u * (b - 2)
    member(
      detail,
      at(c0, eave + rise + 0.16),
      at(c1, eave + rise + 0.16),
      1.1,
      0.27,
      GLASS,
      "central rooflight",
      native,
    )
  pitch = 6.4 if enclosing else 4.1
  for q in np.arange(a + 0.7, b - 0.3, pitch):
    section = LineString(
      [c + u * q - v * (half + 2), c + u * q + v * (half + 2)]
    ).intersection(roof)
    for line in lines(section):
      p, r = np.asarray(line.coords[0]), np.asarray(line.coords[-1])
      for end in (p, r):
        high = top(*end) - 0.1
        detail.box(
          at(end, (floor + high) / 2),
          [0.18, high - floor, 0.18],
          STEEL,
          "frame upright",
        )
      cross = [p + (r - p) * f for f in np.linspace(0, 1, 9 if enclosing else 3)]
      for start, end in zip(cross, cross[1:]):
        member(
          detail,
          at(start, top(*start) - 0.14),
          at(end, top(*end) - 0.14),
          0.17,
          0.19,
          STEEL,
          "arched hall frame",
          native,
        )
  if not enclosing:
    return
  for a0, a1 in zip(roof.exterior.coords, list(roof.exterior.coords)[1:]):
    if math.dist(a0, a1) < 18:
      continue
    for y, depth, tone, role in [
      (floor + 0.90, 1.74, DARK_STEEL, "hall lower panels"),
      (floor + 2.35, 0.94, GLASS, "hall glazing band"),
      (eave - 0.18, 0.34, STEEL, "hall fascia"),
    ]:
      member(detail, at(a0, y), at(a1, y), 0.15, depth, tone, role, native)
    line = LineString([a0, a1])
    for q in np.arange(1.15, line.length - 1, 2.35):
      p = line.interpolate(q).coords[0]
      detail.box(at(p, floor + 2.05), [0.18, 2.15, 0.18], DARK_STEEL, "glazing mullion")


def schoenhauser(detail, get, native):
  station_limits = box(2905, -3428, 2985, -3175)
  path_pairs = [
    linemerge(
      [get(f"way/{i}") for i in SCHOEN_TRACKS[offset : offset + 3]]
    ).intersection(station_limits)
    for offset in (0, 3)
  ]
  assert all(path.geom_type == "LineString" for path in path_pairs)
  # The slab cuts follow exact mapped stair centres into the island platform.
  stairs = [get(f"way/{i}") for i in SCHOEN_STAIRS]
  platform = get(f"relation/{SCHOEN_PLATFORM}")
  widths = [2.25, 2.03, 2.05, 2.05]
  holes = unary_union(
    [s.buffer(w / 2 + 0.05, cap_style=2) for s, w in zip(stairs, widths)]
  )
  floor = platform.difference(holes)
  slab(
    detail,
    floor,
    VIA_FLOOR - 0.12,
    PLATFORM_FLOOR,
    PLATFORM,
    "U2 island platform",
    native,
    0.82,
  )
  for part in floor.geoms if floor.geom_type == "MultiPolygon" else [floor]:
    outline(
      detail,
      part,
      PLATFORM_FLOOR + 0.015,
      (225, 212, 155),
      "platform edge strip",
      native,
    )
  for path in path_pairs:
    rail(detail, path, VIA_FLOOR, native)
  # Both sides retain an uninterrupted course. The columns stop short of the
  # S-Bahn crossing (z -3348 to -3313), preserving the three-level clearance.
  for i, path in enumerate(path_pairs):
    if path.coords[0][1] < path.coords[-1][1]:
      path = LineString(list(reversed(path.coords)))
    s = -1 if i == 0 else 1
    lattice(detail, path, VIA_FLOOR - 1.30, VIA_FLOOR - 0.52, s * 1.25, native)
    for run in range(10, math.floor(path.length) - 4, 13):
      a, _ = points(path, run, run + 0.5, s * 0.72)
      if -3351 < a[1] < -3311 or holes.buffer(0.5).covers(Point(*a)):
        continue
      detail.box(at(a, 5.20), [0.64, 4.4, 0.64], STEEL, "station viaduct column")
      detail.box(
        at(a, 3.32), [0.94, 0.64, 0.94], SANDSTONE, "station viaduct column base"
      )
      detail.box(at(a, 7.46), [1.12, 0.37, 1.12], DARK_STEEL, "station viaduct head")
  # Incline=up binds the direction of the four source ways. The two
  # consecutive middle runs meet across a 1.24 m source-coordinate gap.
  south, middle_upper, middle_lower, north = stairs
  stair(detail, south, widths[0], 3.0, PLATFORM_FLOOR, native)
  stair(detail, north, widths[3], 3.0, PLATFORM_FLOOR, native)
  mid = 3.0 + (PLATFORM_FLOOR - 3.0) * middle_lower.length / (
    middle_lower.length + middle_upper.length
  )
  stair(detail, middle_lower, widths[2], 3.0, mid, native)
  stair(detail, middle_upper, widths[1], mid, PLATFORM_FLOOR, native)
  a, b = middle_lower.coords[-1], middle_upper.coords[0]
  member(
    detail,
    at(a, mid - 0.09),
    at(b, mid - 0.09),
    2.04,
    0.18,
    PLATFORM,
    "mapped stairs middle landing",
    native,
    0.35,
  )
  for rid in SCHOEN_ROOFS:
    roof = get(f"way/{rid}")
    if roof.geom_type == "MultiPolygon":
      assert len(roof.geoms) == 1
      roof = roof.geoms[0]
    assert roof.geom_type == "Polygon"
    enclosing = rid == 375386234
    roof_and_frames(
      detail,
      roof,
      PLATFORM_FLOOR,
      13.05 if enclosing else 12.25,
      1.46 if enclosing else 0.32,
      enclosing,
      native,
    )


def bulow(detail, data, native):
  """The documented sandstone crowns attach to the retained open V238 hall."""
  hall = shape(data["hall"])
  assert hall.geom_type == "MultiPolygon" and len(hall.geoms) == 1
  c, u, v, a, b, half = hall_axis(hall.geoms[0])
  level = 11.2  # v238 hall floor (5.2 + source min_height 6).
  # Keep the hall's existing support axes. Only the western historical
  # frontage receives the photo-backed sandstone detailing.
  for run in (a + 4, a + 24, a + 44):
    for side in (-1, 1):
      pier = c + u * run + v * side * (half - 0.8)
      detail.box(
        at(pier, 7.03), [0.88, 7.94, 0.88], SANDSTONE, "Bülow sandstone support"
      )
      detail.box(
        at(pier, 3.31), [1.15, 0.62, 1.15], STONE_SHADE, "Bülow sandstone support base"
      )
      detail.box(
        at(pier, 10.75),
        [1.14, 0.38, 1.14],
        STONE_LIGHT,
        "Bülow sandstone support capital",
      )
      detail.box(
        at(pier, 13.47), [0.62, 5.02, 0.62], SANDSTONE, "Bülow continued roof pylon"
      )
      detail.box(
        at(pier, 15.90), [0.79, 0.26, 0.79], STONE_LIGHT, "Bülow carved pylon crown"
      )
      for width, y, h in [
        (0.58, 16.10, 0.28),
        (0.44, 16.38, 0.28),
        (0.29, 16.62, 0.20),
      ]:
        detail.box(at(pier, y), [width, h, width], STONE_LIGHT, "Bülow tapered finial")
  # The extended east end retains its own form. The sandstone arch frames
  # the western railway mouth without crossing the running clearance.
  for side, end in [(-1, a)]:
    edge = c + u * (end + side * 0.14)
    for n in (-1, 1):
      pier = edge + v * n * (half - 0.61)
      detail.box(
        at(pier, level + 3.26),
        [0.92, 1.10, 0.92],
        SANDSTONE,
        "Jugendstil sandstone pier",
      )
      detail.box(
        at(pier, level + 4.72), [1.02, 0.25, 1.02], STONE_LIGHT, "stone pier cornice"
      )
      face = pier + u * side * 0.56
      detail.box(
        at(face, level + 3.70), [0.34, 0.53, 0.37], STONE_SHADE, "carved face recess"
      )
      detail.box(
        at(face + u * side * 0.16, level + 3.72),
        [0.22, 0.31, 0.20],
        STONE_LIGHT,
        "carved face boss",
      )
      for j in (-1, 1):
        x0 = face + v * j * 0.12
        x1 = face + v * j * 0.39
        member(
          detail,
          at(x0, level + 3.61),
          at(x1, level + 3.89),
          0.085,
          0.09,
          STONE_LIGHT,
          "curved pier ornament",
          native,
          0.21,
        )
    # Curved stone profile frames the ends while keeping the existing rail mouths clear.
    half_arch = min(half - 1.32, 5.6)
    coords = []
    for j in range(25):
      t = -1 + j / 12
      p = edge + v * t * half_arch
      y = level + 4.02 + 1.69 * math.sqrt(max(0, 1 - t * t))
      coords.append(at(p, y))
    for p, q in zip(coords, coords[1:]):
      member(
        detail, p, q, 0.52, 0.72, SANDSTONE, "curved sandstone gable", native, 0.30
      )
      member(
        detail,
        [p[0], p[1] + 0.40, p[2]],
        [q[0], q[1] + 0.40, q[2]],
        0.60,
        0.16,
        STONE_LIGHT,
        "gable coping",
        native,
        0.30,
      )


def schlesisches(detail, get, native):
  # V267 already owns the west steelwork. These features follow the measured
  # east two-track alignment to the first two spans and stay on the old deck.
  limits = box(4742.5, 2081, 4801, 2099)
  for pair, side in [((0, 3), -1), ((1, 2), 1)]:
    track = linemerge([get(f"way/{SCHLES_TRACKS[i]}") for i in pair]).intersection(
      limits
    )
    assert track.geom_type == "LineString"
    if track.coords[0][0] > track.coords[-1][0]:
      track = LineString(list(reversed(track.coords)))
    lattice(detail, track, 8.19, 9.06, side * 1.52, native)
    for s in (9.5, 29, 48.5):
      if s >= track.length - 1:
        continue
      p, q = points(track, s, s + 0.45, side * 0.88)
      detail.box(at(p, 5.54), [0.39, 5.08, 0.39], STEEL, "east viaduct open support")
      detail.box(
        at(p, 3.19), [0.68, 0.38, 0.68], SANDSTONE, "east viaduct support footing"
      )
      # A short beam joining each column to the deck, well above head height.
      p, q = points(track, s - 0.48, s + 0.48, side * 0.88)
      member(
        detail,
        at(p, 8.08),
        at(q, 8.08),
        0.64,
        0.28,
        DARK_STEEL,
        "east support cap",
        native,
      )


def greifenhagener(detail, get, native):
  # The old packet already has the deck and walking surface. These open arch
  # ribs and vertical posts follow the mapped road centre and 5.3 m width.
  path = get(f"way/{GREIF_WALK}")
  total = path.length
  stair_entry = Point(get(f"way/{GREIF_STAIR}").coords[-1])
  stair_distance = path.project(stair_entry)
  count = 20
  for side in (-1, 1):
    for i in range(count):
      u0, u1 = i / count, (i + 1) / count
      p, q = points(path, total * u0, total * u1, side * 2.36)
      # The arch is underneath the walking deck. The decorative solid fields
      # and narrow iron lattice form the actual above-deck silhouette.
      y0, y1 = [-0.96 + 3.54 * 4 * f * (1 - f) for f in (u0, u1)]
      member(
        detail,
        at(p, y0),
        at(q, y1),
        0.23,
        0.30,
        STEEL,
        "Greifenhagener underdeck arch",
        native,
        0.6,
      )
      if side == -1 and abs(total * (u0 + u1) / 2 - stair_distance) < 2.6:
        continue
      member(
        detail,
        at(p, 3.54),
        at(q, 3.54),
        0.10,
        0.65,
        DARK_STEEL,
        "Greifenhagener iron parapet",
        native,
      )
      for y in (3.9, 4.22):
        member(
          detail,
          at(p, y),
          at(q, y),
          0.105,
          0.105,
          STEEL,
          "Greifenhagener lattice rail",
          native,
        )
      for f in (0, 0.25, 0.5, 0.75):
        a = p + (q - p) * f
        b = p + (q - p) * (f + 0.25)
        member(
          detail,
          at(a, 3.95),
          at(b, 4.16),
          0.056,
          0.061,
          DARK_STEEL,
          "Greifenhagener lattice diagonal",
          native,
          0.5,
        )
      detail.box(at(p, 3.75), [0.15, 1.13, 0.15], DARK_STEEL, "Greifenhagener post")
      if i % 3 == 0:
        detail.box(at(p, 4.36), [0.22, 0.20, 0.22], STEEL, "Greifenhagener post knob")


def receipt(detail, navigation, tile_id, mode):
  file = OUT / f"{tile_id}.{mode}.json.gz"
  old = read_json(file)
  tx, _, tz = old["origin"]
  clip = box(tx, tz, tx + 512, tz + 512)
  replacement = packed_detail(detail, clip)
  replacement["kind"] = "named-elevated-v334"
  owners, matched = [], defaultdict(list)
  if tile_id == "5_-7":
    for rid in SCHOEN_ROOFS:
      owner = f"OSM-way-{rid}"
      b = next(b for b in old["nav"]["buildings"] if b["sourceId"] == owner)
      owners.append(
        dict(
          owner=owner, original=b, origin=old["origin"], groundY=old["nav"]["groundY"]
        )
      )
      transfer = match_owner(old, owner)
      assert transfer, (tile_id, mode, owner)
      for part, rows in transfer.items():
        assert not set(rows).intersection(matched[part])
        matched[part].extend(rows)
  records = []
  for part, rows in sorted(matched.items()):
    mesh = old["meshes"][part]
    records.append(
      dict(
        mesh=part,
        fingerprint=fingerprint([mesh[k] for k in ("positions", "colors", "indices")]),
        triangles=sorted(rows),
      )
    )
  # Additive geometry binds the same actual tile fingerprint even when it
  # retires zero triangles; an unrelated or changed tile cannot admit it.
  if not records:
    mesh = old["meshes"][0]
    records.append(
      dict(
        mesh=0,
        fingerprint=fingerprint([mesh[k] for k in ("positions", "colors", "indices")]),
        triangles=[],
      )
    )
  segments = line_receipt(old, owners) if mode == "drawn" else []
  line_fingerprint = (
    fingerprint([old["lines"]["positions"], old["lines"].get("colors", "")])
    if segments
    else None
  )
  solids, floor_indices = [], []
  for row in navigation.solids:
    component = RailDetail()
    component.solids.append(row)
    local = nav_solids(component, clip, (tx, tz))
    if row["role"].startswith(("U2 island platform", "mapped stairs")):
      floor_indices.extend(range(len(solids), len(solids) + len(local)))
    solids.extend(local)
  return dict(
    origin=old["origin"],
    records=records,
    lineFingerprint=line_fingerprint,
    segments=segments,
    replacement=replacement,
    navigationRecords=[
      {k: r[k] for k in ("owner", "original", "groundY")} for r in owners
    ],
    navigationSolids=solids,
    navigationFloorIndices=floor_indices,
  )


def build() -> None:
  source = read_json(SOURCE)
  assert source["southSha256"] == digest(SOUTH)
  features = {key: shape(row["geometry"]) for key, row in source["features"].items()}
  packets = {}
  for tile, render in [
    ("5_-7", lambda d, native: schoenhauser(d, features.__getitem__, native)),
    ("6_-7", lambda d, native: greifenhagener(d, features.__getitem__, native)),
    ("-2_4", lambda d, native: bulow(d, source["bulow"], native)),
    ("9_4", lambda d, native: schlesisches(d, features.__getitem__, native)),
  ]:
    drawn = RailDetail()
    render(drawn, False)
    # Only the actual platform, staircase, deck, roof and load-bearing piers
    # own walking geometry, in the same coordinates and heights in both modes.
    navigation = RailDetail()
    navigation.solids = [
      row
      for row in drawn.solids
      if row["role"].startswith(
        (
          "U2 island platform",
          "mapped stairs",
          "elevated tray",
          "mapped hall roof",
          "station viaduct column",
          "station viaduct head",
          "Bülow sandstone support",
          "east viaduct open support",
        )
      )
    ]
    native = RailDetail()
    render(native, True)
    for mode, detail in (("drawn", drawn), ("minecraft", native)):
      packets[f"{mode}:{tile}"] = receipt(detail, navigation, tile, mode)
  write_json(
    RUNTIME,
    dict(schema=1, keys=list(packets), sourceSha256=digest(SOURCE), packets=packets),
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--extract",
    action="store_true",
    help="refresh selected geometries from the retained local OSM index",
  )
  args = parser.parse_args()
  if args.extract:
    extract()
  build()
