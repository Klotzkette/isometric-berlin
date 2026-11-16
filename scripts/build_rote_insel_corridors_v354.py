"""Finite photographic fronts in Rote Insel, Yorckstraße and Hohenzollerndamm.

Coordinates bind exact retained source families; projected photographic details
are clipped to independently inspected actual Drawn and cardinal Native walls.
Original bodies, roofs, courtyards, navigation and unrelated details are retained.
"""

from __future__ import annotations

import gzip
import hashlib
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from scripts.build_cluster_facades_v320 import part_fingerprint, retire_generic
from scripts.build_fuel_packets_v351 import Mesh, rgb
from scripts.build_mcdonalds_inventory_v351 import read, write
from scripts.build_nikolai_quarter_v353 import basis, unpack

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
TASK = Path(
  "/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/city-v354/quarter"
)
KIND = "rote-insel-corridors-v354"


# Endpoints are measured existing navigation/source wall coordinates, not geocodes.
# Aperture proportions, relief depth and colours are photographic interpretations.
def p(key, owner, host, a, b, levels, bays, color, style, reference, **extra):
  return dict(
    key=key,
    owner=owner,
    host=host,
    a=a,
    b=b,
    levels=levels,
    bays=bays,
    color=color,
    style=style,
    reference=reference,
    **extra,
  )


PROFILES = [
  p(
    "leber65",
    "DEBE07YY90000Bo8",
    "-2_8",
    [-768.05, 4204.62],
    [-768.72, 4226.6],
    5,
    8,
    [225, 220, 180],
    "dietrich",
    "LezFraniak 2012; official Inseltour; memorial register",
    projection=0.8,
    door=0.54,
  ),
  p(
    "leber13",
    "DEBE07YY90000O38",
    "-2_7",
    [-752.8, 3758.73],
    [-753.22, 3774.35],
    4,
    7,
    [218, 214, 198],
    "classic",
    "LDA 09066611 photo 2005",
    door=0.925,
  ),
  p(
    "leber18",
    "DEBE07YY900007Ux",
    "-2_7",
    [-775.46, 3808.81],
    [-775.17, 3793.14],
    4,
    6,
    [221, 216, 200],
    "classic",
    "LDA 09066612 photo 2005",
    door=0.5,
  ),
  p(
    "leber32",
    "DEBE07YY900003nE",
    "-2_7",
    [-778.1, 3938.78],
    [-777.51, 3920.73],
    5,
    8,
    [219, 214, 201],
    "classic",
    "LDA 09066613 photo",
    door=0.5,
    balcony=[1, 6],
  ),
  p(
    "yorck47",
    "DEBE07YY900006qQ",
    "-1_5",
    [-330.24, 2867.47],
    [-316.06, 2872.52],
    6,
    6,
    [224, 218, 205],
    "baroque",
    "LDA 09066750 Bittner 2014",
    door=0.5,
    projection=0.75,
    frame=[67, 96, 84],
  ),
  p(
    "yorck48",
    "DEBE07YY900004h6",
    "-1_5",
    [-316.06, 2872.52],
    [-301.1, 2877.85],
    6,
    6,
    [225, 219, 207],
    "baroque",
    "LDA 09066750 Bittner 2014",
    door=0.5,
    projection=0.75,
    frame=[100, 66, 56],
  ),
  p(
    "yorck76",
    "DEBE02YY4000037h",
    "1_5",
    [659.61, 2901.99],
    [677.62, 2893.12],
    6,
    7,
    [202, 180, 135],
    "plain",
    "GSE gGmbH property photograph 2024/2025",
    door=0.52,
    balcony=[0, 6],
    frame=[110, 64, 49],
  ),
  p(
    "riehmer83",
    "DEBE02YY40000Esi",
    "1_5",
    [831.23, 2877.02],
    [845.95, 2879.82],
    5,
    4,
    [230, 222, 204],
    "renaissance",
    "LDA 09031026 Bittner 2012",
    curveTolerance=2.2,
    projection=0.6,
    attic=True,
  ),
  p(
    "riehmer84-86",
    "DEBE02YY400004I9",
    "1_5",
    [845.95, 2879.82],
    [886.1, 2895.05],
    5,
    12,
    [230, 222, 204],
    "renaissance",
    "LDA 09031026 Bittner 2012",
    curveTolerance=2.5,
    projection=0.6,
    attic=True,
  ),
  p(
    "scharoun36-south",
    "DEBE04YY50003CLU",
    "-9_6",
    [-4202.97, 3171.48],
    [-4216.06, 3176.19],
    6,
    3,
    [230, 227, 209],
    "scharoun",
    "LDA 09011450 Beitl 2009",
    curveTolerance=1.2,
  ),
  p(
    "scharoun36-curve",
    "DEBE04YY50003CLU",
    "-9_6",
    [-4216.06, 3176.19],
    [-4235.76, 3158.33],
    6,
    5,
    [230, 227, 209],
    "scharoun",
    "LDA 09011450 Beitl 2009",
    curveTolerance=1.8,
  ),
  p(
    "hohen44",
    "DEBE04YY500039ap",
    "-9_6",
    [-4518.62, 3263.35],
    [-4599.32, 3257.42],
    4,
    19,
    [222, 223, 205],
    "office",
    "LDA 09011451 Beitl 2011",
    curveTolerance=0.8,
    roofReserve=5.1,
    stair=True,
  ),
  p(
    "hohen45",
    "DEBE04YY50003PtV",
    "-10_6",
    [-4636.04, 3257.14],
    [-4681.39, 3253.8],
    4,
    15,
    [185, 181, 157],
    "office",
    "LDA 09011452 Beitl 2011",
    roofReserve=4.3,
  ),
  p(
    "hohen181",
    "DEBE04YY500039LG",
    "-8_5",
    [-3850.96, 3052.03],
    [-3828.19, 3040.29],
    5,
    6,
    [218, 215, 200],
    "m1930",
    "LDA 09011556 Beitl 2009",
    curveTolerance=2.0,
    roofReserve=3.7,
  ),
  p(
    "hohen182",
    "DEBE04YY50003N8H",
    "-8_5",
    [-3828.19, 3040.29],
    [-3804.71, 3027.75],
    5,
    6,
    [218, 215, 200],
    "m1930",
    "LDA 09011556 Beitl 2009",
    curveTolerance=2.0,
    roofReserve=3.7,
  ),
]


def identity(points):
  return tuple(sorted(tuple(np.rint(np.array(q) * 100).astype(int)) for q in points))


def selected_body(packet, profile, native):
  origin = np.array(packet["origin"])
  record = next(
    b for b in packet["nav"]["buildings"] if b["sourceId"] == profile["owner"]
  )
  footprint = translate(Polygon(record["ring"], record["holes"]), origin[0], origin[2])
  a, d, n, length = basis(profile)
  low = packet["nav"]["groundY"] + record.get("groundOffset", 0) + record["minHeight"]
  high = packet["nav"]["groundY"] + record.get("groundOffset", 0) + record["height"]
  result = []
  for m in packet["meshes"]:
    if m["kind"] != "city":
      continue
    for pts, colors in unpack(m, origin):
      norm = np.cross(pts[1] - pts[0], pts[2] - pts[0])
      mag = np.linalg.norm(norm)
      if mag < 0.01 or abs(norm[1] / mag) > 0.001:
        continue
      norm /= mag
      if norm[[0, 2]] @ n < 0.2:
        continue
      u = (pts[:, [0, 2]] - a) @ d
      gap = (pts[:, [0, 2]] - a) @ n
      if (
        max(u) < -0.01
        or min(u) > length + 0.01
        or min(gap) < -profile.get("curveTolerance", 0.08) - (2.1 if native else 0.05)
        or max(gap) > profile.get("curveTolerance", 0.08) + (2.1 if native else 0.05)
      ):
        continue
      if min(pts[:, 1]) < low - 0.05 or max(pts[:, 1]) > high + 0.05:
        continue
      # All endpoints and intermediate edge points must be on this exact family's
      # boundary. This prevents coplanar neighbours from entering a broad window.
      xz = pts[:, [0, 2]]
      if (
        max(
          footprint.boundary.distance(Point(x))
          for x in list(xz)
          + [(xz[0] + xz[1]) / 2, (xz[1] + xz[2]) / 2, (xz[2] + xz[0]) / 2]
        )
        > 0.045
      ):
        continue
      if native and np.count_nonzero(abs(norm[[0, 2]]) > 0.001) != 1:
        raise ValueError("Non-cardinal Native support")
      result.append(pts.tolist())
  if not result:
    raise ValueError("No actual wall support " + profile["key"] + " " + str(native))
  return result, low, high, record


def setup():
  TASK.mkdir(parents=True, exist_ok=True)
  faces = read(GEO / "district-facades-v188-evidence.json.gz")["faces"]
  rows = read(GEO / "rote-insel-corridors-v354-addresses.json.gz")["rows"]
  records = []
  inputs = {}
  for profile in PROFILES:
    if profile["key"].startswith("leber"):
      profile["a"], profile["b"] = profile["b"], profile["a"]
    profile["generic"] = [f for f in faces if f["owner"] == profile["owner"]]
    profile["target"] = (
      "district188-" + profile["host"] if profile["generic"] else profile["host"]
    )
    main = read(PUBLIC / (profile["host"] + ".drawn.json.gz"))
    _, lo, hi, b = selected_body(main, profile, False)
    profile["low"] = lo
    profile["top"] = hi - profile.get("roofReserve", 0)
    records.append(
      dict(
        profile=profile,
        sourceRecord=b,
        origin=main["origin"],
        addressRecords=[
          {
            "id": r["id"],
            "geometry": r["geometry"],
            "tags": {
              key: value
              for key, value in r.get("tags", {}).items()
              if key in ["addr:street", "addr:housenumber", "building:levels"]
            },
            "bindings": [
              {
                key: value
                for key, value in h.items()
                if key in ["id", "host", "owner", "sourceId"]
              }
              for h in r["hosts"]
              if h["owner"] == profile["owner"]
            ],
          }
          for r in rows
          if any(h["owner"] == profile["owner"] for h in r["hosts"])
        ],
      )
    )
    for host in {profile["host"], profile["target"]}:
      for mode in ["drawn", "minecraft"]:
        inputs.setdefault(
          mode + ":" + host,
          dict(
            id=host,
            path=str(PUBLIC / (host + "." + mode + ".json.gz")),
            mode=mode,
            windows=[],
            featureIds=[],
          ),
        )
    a, b = profile["a"], profile["b"]
    win = [
      min(a[0], b[0]) - 3,
      min(a[1], b[1]) - 3,
      max(a[0], b[0]) + 3,
      max(a[1], b[1]) + 3,
    ]
    for host in {profile["host"], profile["target"]}:
      for mode in ["drawn", "minecraft"]:
        inputs[mode + ":" + host]["windows"].append(win)
        inputs[mode + ":" + host]["featureIds"].append(profile["key"])
  write(
    GEO / (KIND + "-source.json.gz"),
    dict(
      schemaVersion=1,
      sourceBaseline="4bb88fa3",
      profiles=records,
      policy="Measured retained family/footprint and actual final wall support; photographed window rhythms, restrained estimated colours/relief dimensions. No claim of a surveyed facade, new entrance or complete corridor photo coverage.",
    ),
  )
  write(TASK / "capture-inputs.json", list(inputs.values()))


def wall_groups(faces, profile):
  a, d, n, length = basis(profile)
  groups = {}
  for face in faces:
    q = np.array(face)
    norm = np.cross(q[1] - q[0], q[2] - q[0])
    norm /= np.linalg.norm(norm)
    if norm[[0, 2]] @ n < 0:
      norm = -norm
    uv = Polygon(np.column_stack(((q[:, [0, 2]] - a) @ d, q[:, 1])))
    k = tuple(np.rint(np.r_[norm, norm @ q[0]] * 10000).astype(int))
    if k not in groups:
      groups[k] = dict(normal=norm, q=q[0], pieces=[])
    groups[k]["pieces"].append(uv)
  result = []
  for g in groups.values():
    g["field"] = unary_union(g.pop("pieces")).intersection(
      box(0, profile["low"], length, profile["top"])
    )
    if not g["field"].is_empty:
      result.append(g)
  return result


def emit(mesh, profile, groups, field, color, offset=0.045, back=None):
  a, d, _, _ = basis(profile)
  count = 0
  for g in groups:
    norm, q = g["normal"], g["q"]
    clipped = g["field"].intersection(field)
    if clipped.is_empty:
      continue
    tangent = np.array([-norm[2], norm[0]])
    denom = float(tangent @ d)
    ubase = float((q[[0, 2]] - a) @ d)

    def coord(u, y, o):
      xz = q[[0, 2]] + tangent * ((u - ubase) / denom) + norm[[0, 2]] * o
      return [xz[0], y, xz[1]]

    for tri in shapely.constrained_delaunay_triangles(clipped).geoms:
      pts = [coord(u, y, offset) for u, y in list(tri.exterior.coords)[:3]]
      if (
        np.dot(np.cross(np.subtract(pts[1], pts[0]), np.subtract(pts[2], pts[0])), norm)
        < 0
      ):
        pts.reverse()
      mesh.triangle(pts, [rgb(color)] * 3)
      count += 1
    if back is not None and offset > back:
      geoms = list(clipped.geoms) if hasattr(clipped, "geoms") else [clipped]
      for poly in geoms:
        if not isinstance(poly, Polygon):
          continue
        for ring in [poly.exterior, *poly.interiors]:
          for (u, y), (v, z) in zip(ring.coords, list(ring.coords)[1:]):
            pts = [
              coord(u, y, back),
              coord(v, z, back),
              coord(v, z, offset),
              coord(u, y, offset),
            ]
            mesh.triangle(pts[:3], [rgb(color)] * 3)
            mesh.triangle([pts[0], pts[2], pts[3]], [rgb(color)] * 3)
            count += 2
  return count


def decorate(mesh, profile, faces, native):
  p = profile
  _, _, _, length = basis(p)
  groups = wall_groups(faces, p)
  lo, hi = p["low"], p["top"]
  style = p["style"]
  levels = p["levels"]
  attic = 1.0 if p.get("attic") else 0
  pitch = (hi - lo - 0.35 - attic) / levels
  bays = p["bays"]
  step = length / bays
  wall = p["color"]
  trim = [min(245, x + 9) for x in wall]
  shadow = [max(60, x - 33) for x in wall]
  frame = p.get("frame", [205, 204, 188])
  glass = [66, 85, 87]
  full = box(0, lo, length, hi)
  emit(mesh, p, groups, full, wall)
  emit(mesh, p, groups, box(0, lo, length, lo + max(0.6, pitch * 0.16)), shadow, 0.06)
  # Every long horizontal band is a documented storey/cornice rhythm, not a
  # repeated unidentified city grid; modern profiles keep a restrained base/eave.
  if style in ["classic", "baroque", "renaissance", "dietrich", "plain"]:
    for level in range(1, levels):
      y = lo + pitch * level
      if style == "dietrich" and level > 1:
        continue
      if style == "plain" and level > 2:
        continue
      emit(mesh, p, groups, box(0, y - 0.09, length, y + 0.07), trim, 0.18, back=0.045)
  emit(mesh, p, groups, box(0, hi - 0.3, length, hi - 0.12), trim, 0.24, back=0.045)
  if style in ["classic", "baroque", "renaissance"]:
    for y in np.arange(lo + 0.35, lo + pitch * (2 if style == "baroque" else 1), 0.46):
      emit(mesh, p, groups, box(0, y, length, y + 0.035), shadow, 0.055)
  if style in ["baroque", "renaissance"]:
    # Dentilled roofline. These simple reliefs interpret the documented cornice;
    # they do not pretend to reproduce individual sculptural portraits.
    for u in np.arange(0.18, length - 0.15, 0.48):
      emit(
        mesh, p, groups, box(u, hi - 0.49, u + 0.14, hi - 0.3), trim, 0.26, back=0.045
      )
  if style == "office" and p.get("stair"):
    emit(
      mesh,
      p,
      groups,
      box(length * 0.47, lo + pitch, length * 0.53, hi - 0.35),
      [86, 104, 103],
      0.085,
    )
    for u in [length * 0.48, length * 0.5, length * 0.52]:
      emit(
        mesh, p, groups, box(u - 0.035, lo + pitch, u + 0.035, hi - 0.35), frame, 0.13
      )
  center = {bays // 2 - 1, bays // 2}
  projected = []
  if style in ["dietrich", "baroque", "renaissance"]:
    if style == "renaissance":
      center = {i for i in range(bays) if i % 4 in [1, 2]}
    for col in center:
      u = step * (col + 0.5)
      bottom = lo + pitch
      top = lo + pitch * (levels - 1)
      emit(
        mesh,
        p,
        groups,
        box(u - step * 0.49, bottom, u + step * 0.49, top),
        wall,
        p.get("projection", 0.6),
        back=0.045,
      )
      projected.append(col)
  windows = 0
  balconies = 0
  for row in range(levels):
    for col in range(bays):
      u = step * (col + 0.5)
      base = lo + pitch * row
      depth = (
        p.get("projection", 0.6) if col in projected and 0 < row < levels - 1 else 0
      )
      if style == "office" and p.get("stair") and col == bays // 2 and row > 0:
        continue
      w = min(1.5, step * 0.55)
      height = pitch * 0.57
      bottom = base + pitch * 0.23
      if style in ["baroque", "renaissance"]:
        w = min(1.5, step * 0.62)
        height = pitch * 0.64
        bottom = base + pitch * 0.19
      if style == "scharoun":
        w = step * 0.68
        height = pitch * 0.51
        bottom = base + pitch * 0.3
      if row == 0 and style in ["baroque", "renaissance", "plain"]:
        w = step * 0.73
        height = pitch * 0.7
        bottom = base + pitch * 0.13
      door = p.get("door")
      isdoor = (
        row == 0 and door is not None and abs((col + 0.5) / bays - door) < 0.55 / bays
      )
      if isdoor:
        w = min(1.8, step * 0.82)
        bottom = lo + 0.08
        height = pitch * 0.84
      outer = box(
        u - w / 2 - 0.09, bottom - 0.09, u + w / 2 + 0.09, bottom + height + 0.09
      )
      emit(mesh, p, groups, outer, trim, 0.09 + depth, back=0.045 + depth)
      emit(
        mesh,
        p,
        groups,
        box(u - w / 2, bottom, u + w / 2, bottom + height),
        [71, 57, 48] if isdoor else glass,
        0.13 + depth,
      )
      if not isdoor:
        for x in [u - w / 2, u, u + w / 2]:
          emit(
            mesh,
            p,
            groups,
            box(x - 0.028, bottom, x + 0.028, bottom + height),
            frame,
            0.155 + depth,
          )
        for y in [bottom, bottom + height * 0.71, bottom + height]:
          emit(
            mesh,
            p,
            groups,
            box(u - w / 2, y - 0.028, u + w / 2, y + 0.028),
            frame,
            0.155 + depth,
          )
        if style == "scharoun":
          # The interleaved small horizontal service windows are characteristic of
          # the photographed Scharoun elevation.
          if col < bays - 1:
            x = u + step * 0.48
            emit(
              mesh,
              p,
              groups,
              box(x - 0.27, base + pitch * 0.57, x + 0.27, base + pitch * 0.68),
              glass,
              0.12,
            )
        if style in ["baroque", "renaissance", "classic"] and row > 0:
          y = bottom + height + 0.16
          if row < levels - 1:
            if native:
              for tier in range(3):
                half = w * 0.68 * (3 - tier) / 3
                ped = box(u - half, y + tier * 0.11, u + half, y + (tier + 1) * 0.11)
                emit(mesh, p, groups, ped, trim, 0.22 + depth, back=0.08 + depth)
            else:
              ped = Polygon(
                [(u - w * 0.68, y), (u, y + 0.34), (u + w * 0.68, y), (u - w * 0.68, y)]
              )
              emit(mesh, p, groups, ped, trim, 0.22 + depth, back=0.08 + depth)
          emit(
            mesh,
            p,
            groups,
            box(u - w * 0.6, bottom - 0.22, u + w * 0.6, bottom - 0.1),
            shadow,
            0.17 + depth,
            back=0.05 + depth,
          )
        windows += 1
      else:
        emit(
          mesh,
          p,
          groups,
          box(u - 0.035, bottom, u + 0.035, bottom + height),
          frame,
          0.16,
        )
      # Documented side balconies: open volume above a thin plate, never a solid
      # multistorey box. All Native edges remain cardinal at actual supporting walls.
      balcony = style == "dietrich" and col in [2, 5] and row in [1, 2, 3]
      balcony |= col in p.get("balcony", []) and row in [1, 2, 3]
      balcony |= style == "scharoun" and col == 0 and row > 0
      if balcony:
        bw = min(step * 0.9, 2.5)
        floor = base + 0.11
        emit(
          mesh,
          p,
          groups,
          box(u - bw / 2, floor, u + bw / 2, floor + 0.12),
          trim,
          1.15,
          back=0.04,
        )
        emit(
          mesh,
          p,
          groups,
          box(u - bw / 2, floor + 0.24, u + bw / 2, floor + 0.95),
          [173, 169, 126] if style == "dietrich" else [186, 189, 184],
          1.15,
          back=1.08,
        )
        emit(
          mesh,
          p,
          groups,
          box(u - bw / 2, floor + 0.96, u + bw / 2, floor + 1.02),
          [65, 70, 68],
          1.17,
          back=1.08,
        )
        balconies += 1
  if p.get("attic"):
    for col in range(bays):
      u = step * (col + 0.5)
      emit(mesh, p, groups, box(u - 0.28, hi - 0.95, u + 0.28, hi - 0.52), glass, 0.1)
  if style == "dietrich":
    # Location/size from the official register: porcelain left of entrance,
    # 50x70cm bronze on the right. Text is deliberately not invented.
    door = p["door"] * length
    emit(
      mesh,
      p,
      groups,
      box(door - 2.45, lo + 1.7, door - 1.9, lo + 2.2),
      [236, 237, 223],
      0.18,
      back=0.04,
    )
    emit(
      mesh,
      p,
      groups,
      box(door + 1.25, lo + 1.7, door + 1.75, lo + 2.4),
      [82, 72, 50],
      0.18,
      back=0.04,
    )
  return dict(
    windows=windows,
    balconies=balconies,
    supportFaces=len(faces),
    supportPlanes=len(groups),
    supportedAreaM2=sum(g["field"].area for g in groups),
  )


def build():
  source = read(GEO / (KIND + "-source.json.gz"))
  profiles = [r["profile"] for r in source["profiles"]]
  plans = {}
  evidence = []
  retirements = []
  for mode in ["drawn", "minecraft"]:
    native = mode == "minecraft"
    outputs = {}
    retired = defaultdict(lambda: defaultdict(set))
    owners = defaultdict(set)
    for profile in profiles:
      host, target = profile["host"], profile["target"]
      capture = read(TASK / "support" / f"{mode}-{host}.json.gz")
      main = capture["prepared"]
      faces, lo, hi, record = selected_body(main, profile, native)
      actual = {identity(np.array(t).reshape(3, 3)) for t in capture["triangles"]}
      if any(identity(face) not in actual for face in faces):
        raise ValueError("Selected wall absent from final decoder " + profile["key"])
      targetcapture = read(TASK / "support" / f"{mode}-{target}.json.gz")
      packet = targetcapture["prepared"]
      if target not in outputs:
        outputs[target] = Mesh(packet["origin"])
      owners[target].add(profile["owner"])
      if profile["generic"]:
        old = retire_generic(
          packet, profile["generic"], native, "district-facades-v188"
        )
        for row in old:
          retired[target][row["mesh"]].update(row["triangles"])
          for ti in row["triangles"]:
            points, colors = unpack(
              packet["meshes"][row["mesh"]], np.array(packet["origin"])
            )[ti]
            retirements.append(
              dict(
                mode=mode,
                host=target,
                owner=profile["owner"],
                mesh=row["mesh"],
                triangle=ti,
                positions=points.tolist(),
                colors=colors.tolist(),
              )
            )
      local = dict(profile, low=max(lo, profile["low"]), top=min(hi, profile["top"]))
      evidence.append(
        dict(
          mode=mode,
          key=profile["key"],
          host=host,
          target=target,
          owner=profile["owner"],
          sourceHeight=[lo, hi],
          profileHeight=[local["low"], local["top"]],
          **decorate(outputs[target], local, faces, native),
        )
      )
    for target, mesh in outputs.items():
      c = read(TASK / "support" / f"{mode}-{target}.json.gz")
      append = mesh.payload()
      append["kind"] = KIND
      plan = dict(c["plan"])
      plan.update(
        owners=sorted(owners[target]),
        retire=[
          dict(mesh=mi, triangles=sorted(ids))
          for mi, ids in sorted(retired[target].items())
        ],
        retireLines=[],
        retireNav=[],
        appendNav=[],
        append=append,
        appendFingerprint=part_fingerprint(append),
      )
      plans[mode + ":" + target] = plan
  sources = []
  for i, (key, plan) in enumerate(plans.items()):
    name = f"roteInselCorridorsV354Packets{i:03d}.json.gz"
    path = DATA / name
    write(path, dict(schemaVersion=1, keys=[key], packets={key: plan}))
    decoded = gzip.decompress(path.read_bytes())
    assert len(decoded) < 2 * 1024 * 1024 and path.stat().st_size < 512 * 1024, (
      key,
      len(decoded),
      path.stat().st_size,
    )
    sources.append(dict(file=name, keys=[key], decodedBytes=len(decoded)))
  write(
    DATA / "roteInselCorridorsV354Index.json", dict(schemaVersion=1, sources=sources)
  )
  write(GEO / (KIND + "-retirement.json.gz"), retirements)
  receipt = dict(
    schemaVersion=1,
    profiles=len(profiles),
    owners=len({p["owner"] for p in profiles}),
    keys=list(plans),
    faces=evidence,
    compressedBytes=sum((DATA / s["file"]).stat().st_size for s in sources),
    sourceSha256=hashlib.sha256(
      (GEO / (KIND + "-source.json.gz")).read_bytes()
    ).hexdigest(),
  )
  write(GEO / (KIND + "-validation.json.gz"), receipt)
  print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
  import argparse

  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--task-dir", type=Path, default=TASK)
  parser.add_argument("--build", action="store_true")
  args = parser.parse_args()
  TASK = args.task_dir
  setup()
  if args.build:
    build()
