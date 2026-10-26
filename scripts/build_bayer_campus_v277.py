"""Complete, source-bound Bayer administration replacing its flattened proxy.

Original LoD2 is kept in the immutable source receipt. The exact OSM building
parts and bDOM samples describe the existing building, not a future masterplan.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
from shapely.geometry import Point, Polygon, box
from shapely.ops import triangulate, unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/bayer-campus-v277-source.json.gz"
DEST = ROOT / "src/app/src/data/bayerCampusV277.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/bayer-campus-v277-evidence.json"
# Each selected sample is an actual roof point, not a storey-height multiplier.
# Tiny low parts have outlying edge samples on neighbouring high walls: use the
# central point there, retain every contrary/outlying sample in source evidence.
SAMPLE_INDEX = {
  "way/219495913": 1,
  "way/420830325": 0,
  "relation/6255294": 0,
  "relation/6255295": 1,
}
CORE_IDS = {"way/219495911", "way/219495912", "way/420830307"}


def packed(rows: Any, kind: str = "<f4") -> str:
  return base64.b64encode(np.asarray(rows, dtype=kind).tobytes()).decode()


def rings(poly: Polygon) -> list[list[list[float]]]:
  return [
    [[round(x, 4), round(z, 4)] for x, z in r.coords[:-1]]
    for r in [poly.exterior, *poly.interiors]
  ]


def polygons(value: Any) -> list[Polygon]:
  if value.is_empty:
    return []
  if value.geom_type == "Polygon":
    return [value]
  return [p for g in value.geoms for p in polygons(g)]


def build() -> tuple[dict, dict]:
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  old = source["originalOwner"]["parts"][0]
  ground = old["ground_y_m"] + old["displayOffsetY"]
  offset = old["displayOffsetY"]
  whole = Polygon(old["ring"], old["holes"])
  samples = source["bdom"]["samples"]
  volumes, geometries, receipts = [], [], []
  for part in source["osmParts"]:
    selected = next(
      s
      for s in samples
      if s["id"] == part["id"] and s["index"] == SAMPLE_INDEX.get(part["id"], 0)
    )
    top = round(selected["NHN"] - 30 + offset, 3)
    minimum = int(part["tags"].get("building:min_level", 0))
    # Two mapped unoccupied lower levels under Fennstraße; exact underside is
    # unavailable, so the 8.4 m clear height is explicitly a display estimate.
    low = round(ground + minimum * 4.2, 3)
    shape = Polygon(part["ring"], part.get("holes", [])).intersection(whole)
    for poly in polygons(shape):
      if poly.area < 0.01:
        continue
      rr = rings(poly)
      role = "stair-core" if part["id"] in CORE_IDS else "administration"
      color = 0xB4B1A6 if role == "stair-core" else 0xD1D0C5
      roof = 0x778064 if part["tags"].get("roof:material") == "grass" else 0x747974
      volumes.append(
        dict(
          osmId=part["id"],
          sourceId=old["prism"]["id"],
          ring=rr[0],
          holes=rr[1:],
          minY=low,
          maxY=top,
          wallColor=color,
          roofColor=roof,
          levels=int(part["tags"]["building:levels"]),
          minLevel=minimum,
          role=role,
        )
      )
      geometries.append(Polygon(rr[0], rr[1:]))
    receipts.append(
      dict(
        osmId=part["id"],
        selectedIndex=selected["index"],
        selectedNhn=selected["NHN"],
        displayOffsetY=offset,
        maxY=top,
        minY=low,
        method="actual bDOM point + original datum offset",
        undersideEstimate=minimum > 0,
      )
    )
  positions, tones = [], []

  def triangle(points: list, color: int) -> None:
    positions.extend(points)
    tones.append(color)

  for part, poly in zip(volumes, geometries, strict=True):
    lo, hi = part["minY"], part["maxY"]
    for ring in [poly.exterior, *poly.interiors]:
      coords = list(ring.coords)
      for (x, z), (xx, zz) in zip(coords, coords[1:]):
        triangle([[x, lo, z], [xx, lo, zz], [xx, hi, zz]], part["wallColor"])
        triangle([[x, lo, z], [xx, hi, zz], [x, hi, z]], part["wallColor"])
    cover = unary_union(
      [
        g
        for p, g in zip(volumes, geometries, strict=True)
        if p is not part and p["minY"] <= hi and p["maxY"] > hi
      ]
    )
    exposed = poly.difference(cover)
    for face in polygons(exposed):
      for t in triangulate(face):
        if face.covers(t):
          triangle(
            [[x, hi, z] for x, z in list(t.exterior.coords)[:3]], part["roofColor"]
          )
    # The elevated road bridge has a real underside; do not fill its air space.
    if lo > ground:
      for t in triangulate(poly):
        if poly.covers(t):
          triangle(
            [[x, lo, z] for x, z in list(t.exterior.coords)[:3]], part["wallColor"]
          )

  # Independent one-metre world-grid native volume union. Adjacent same-colour
  # runs merge losslessly; there is no rotation, fill under the bridge, or touch LOD.
  cells: dict[tuple[int, int], list] = defaultdict(list)
  for p, poly in zip(volumes, geometries, strict=True):
    for z in range(math.floor(poly.bounds[1]), math.ceil(poly.bounds[3])):
      for x in range(math.floor(poly.bounds[0]), math.ceil(poly.bounds[2])):
        if poly.covers(Point(x + 0.5, z + 0.5)):
          cells[x, z].append((p["minY"], p["maxY"], p["wallColor"], p["roofColor"]))
  merged_cells: dict[tuple[int, int], list] = {}
  runs: dict[tuple, list] = defaultdict(list)
  for (x, z), spans in cells.items():
    spans.sort()
    joined = []
    for lo, hi, color, roof in spans:
      if joined and lo <= joined[-1][1] + 1e-7:
        if hi > joined[-1][1]:
          joined[-1][1:] = [hi, color, roof]
      else:
        joined.append([lo, hi, color, roof])
    merged_cells[x, z] = joined
    for lo, hi, color, roof in joined:
      runs[z, lo, hi - 0.24, color].append(x)
      runs[z, hi - 0.24, hi, roof].append(x)
  body = []
  for (z, lo, hi, color), xs in sorted(runs.items()):
    xs.sort()
    start = prev = xs[0]
    for x in xs[1:] + [xs[-1] + 2]:
      if x == prev + 1:
        prev = x
        continue
      body.append(
        [
          (start + prev + 1) / 2,
          (lo + hi) / 2,
          z + 0.5,
          prev - start + 1,
          hi - lo,
          1,
          0,
          color,
        ]
      )
      start = prev = x
  drawn, native, fittings = [], [], []
  ownership = json.loads((DEST.parent / "bayerCampusV277Ownership.json").read_bytes())
  retired = {tuple(r) for r in ownership["columns"]}
  voxel = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json").read_bytes()
  )
  foreign_cells = {}
  for zi, rr in enumerate(voxel["building_rows"]):
    iz = voxel["grid"]["min_z_idx"] + zi
    if not whole.bounds[1] - 8 <= iz * 4 <= whole.bounds[3] + 8:
      continue
    for start, count, lo, hi, kind in rr:
      for ix in range(
        voxel["grid"]["min_x_idx"] + start, voxel["grid"]["min_x_idx"] + start + count
      ):
        if (
          whole.bounds[0] - 8 <= ix * 4 <= whole.bounds[2] + 8
          and (ix, iz, lo, hi, kind) not in retired
        ):
          foreign_cells[ix, iz] = (lo / 10, hi / 10)
  del voxel

  def clears_native(row: list[float]) -> bool:
    x, y, z, w, h, d = row[:6]
    # Actual Float32 production transform endpoints, conservative clearance.
    x, y, z, w, h, d = [float(np.float32(v)) for v in [x, y, z, w, h, d]]
    for zz in range(math.floor(z - d / 2 - 0.0002), math.ceil(z + d / 2 + 0.0002)):
      for xx in range(math.floor(x - w / 2 - 0.0002), math.ceil(x + w / 2 + 0.0002)):
        if (
          min(xx + 1, x + w / 2) - max(xx, x - w / 2) <= 0.0002
          or min(zz + 1, z + d / 2) - max(zz, z - d / 2) <= 0.0002
        ):
          continue
        if any(
          min(hi, y + h / 2) - max(lo, y - h / 2) > 0.0002
          for lo, hi, *_ in merged_cells.get((xx, zz), [])
        ):
          return False
    for zz in range(math.floor((z - d / 2) / 4), math.ceil((z + d / 2) / 4)):
      for xx in range(math.floor((x - w / 2) / 4), math.ceil((x + w / 2) / 4)):
        span = foreign_cells.get((xx, zz))
        if span and min(span[1], y + h / 2) - max(span[0], y - h / 2) > 0.0002:
          return False
    return True

  def fitting(
    pi: int,
    a: np.ndarray,
    along: np.ndarray,
    normal: np.ndarray,
    u: float,
    y: float,
    width: float,
    height: float,
    color: int,
    role: str,
    depth: float = 0.12,
    relief: float = 0.18,
  ) -> None:
    part = volumes[pi]
    p = a + along * u
    if (
      role in {"window", "sill", "structural rib"}
      and part["osmId"] == "way/24796824"
      and entry_frame is not None
    ):
      _, ea, ed, en, eu = entry_frame
      if (
        abs(float(np.dot(p - ea, en))) < 0.1
        and abs(float(np.dot(p - ea, ed)) - eu) < 4.1
      ):
        return
    # The entire candidate must be outside sibling volumes, not just its centre.
    facepoints = [p + along * du + normal * 0.12 for du in [-width / 2, 0, width / 2]]
    for other, g in zip(volumes, geometries, strict=True):
      if other is part or min(other["maxY"], y + height / 2) <= max(
        other["minY"], y - height / 2
      ):
        continue
      if any(g.buffer(0.015).covers(Point(*q)) for q in facepoints):
        return
    pos = p + normal * relief
    yaw = -math.atan2(along[1], along[0])
    di = len(drawn)
    drawn.append([*map(float, [pos[0], y, pos[1], width, height, depth, yaw]), color])
    indices, shifts = [], []
    count = max(1, math.ceil(width / 0.55))
    native_relief = relief
    # Axis-aligned pieces of a diagonal backing plane extend farther than
    # its centreline. Keep every foreground frame/glyph beyond the actual
    # support extent, not merely beyond the backing's nominal wall offset.
    cross = abs(normal[0] * along[0]) + abs(normal[1] * along[1])

    def support(segment_width: float, segment_depth: float) -> float:
      return 0.5 * (cross * segment_width + segment_depth)

    if role in {"operator sign ring", "BAYER cross lettering"}:
      native_relief = max(
        relief, 0.24 + support(0.55, 0.08) + support(width / count, depth) + 0.025
      )
    if role == "entrance frame":
      native_relief = max(
        relief, 0.18 + support(0.55, 0.12) + support(width / count, depth) + 0.025
      )
    for k in range(count):
      q = p + along * ((k + 0.5) / count - 0.5) * width
      w, d = (
        abs(along[0]) * width / count + abs(normal[0]) * depth,
        abs(along[1]) * width / count + abs(normal[1]) * depth,
      )
      found = None
      for reach in (
        [public_native_base + native_relief]
        if role.startswith(("operator sign", "entrance"))
        or role == "BAYER cross lettering"
        else [0.25, 0.4, 0.55, 0.7, 0.85, 1, 1.15, 1.3, 1.45, 1.6, 1.75]
      ):
        c = q + normal * reach
        row = [float(c[0]), y, float(c[1]), float(w), height, float(d), 0, color]
        if clears_native(row):
          found = row
          shifts.append(reach)
          break
      if found is not None:
        indices.append(len(native))
        native.append(found)
    if not indices:
      drawn.pop()
      return
    fittings.append(
      dict(
        part=pi,
        role=role,
        drawn=di,
        native=indices,
        origin=a.tolist(),
        along=along.tolist(),
        outward=normal.tolist(),
        u=u,
        y=y,
        width=width,
        height=height,
        relief=relief,
        nativeReach=shifts,
        nativeRelief=native_relief,
      )
    )

  entry = np.asarray(source["publicEntrance"]["worldXZ"])
  entry_frame = None
  for pi, (part, poly) in enumerate(zip(volumes, geometries, strict=True)):
    if part["osmId"] != "way/24796824":
      continue
    for a0, b0 in zip(list(poly.exterior.coords), list(poly.exterior.coords)[1:]):
      a, b = np.asarray(a0), np.asarray(b0)
      length = float(np.linalg.norm(b - a))
      if length < 8:
        continue
      along = (b - a) / length
      u = float(np.dot(entry - a, along))
      if -0.01 <= u <= length + 0.01 and np.linalg.norm(entry - a - along * u) < 0.03:
        normal = np.array([along[1], -along[0]])
        if poly.covers(Point(*(a + along * length / 2 + normal * 0.1))):
          normal *= -1
        if normal[0] > 0:
          entry_frame = (pi, a, along, normal, min(length - 4.2, max(4.2, u)))
  assert entry_frame is not None
  # A few four-metre generic columns are shared with unchanged neighbouring
  # owners and must remain. Project the complete native public entrance as one
  # coherent plane in front of their actual retained cells; never discard letters.
  _, ea, ed, en, eu = entry_frame
  public_native_base = None
  for reach in np.arange(0.25, 6.01, 0.25):
    probes = []
    for du in np.linspace(-4.1, 4.1, 42):
      q = ea + ed * (eu + du) + en * (reach + 0.18)
      probes.append([q[0], ground + 4.5, q[1], 0.3, 8.9, 0.3, 0, 0])
    if all(clears_native(row) for row in probes):
      public_native_base = float(reach)
      break
  assert public_native_base is not None, "Public native facade requires review"

  for pi, (part, poly) in enumerate(zip(volumes, geometries, strict=True)):
    lo, hi = part["minY"], part["maxY"]
    for ring in [poly.exterior, *poly.interiors]:
      coords = list(ring.coords)
      for a0, b0 in zip(coords, coords[1:]):
        a, b = np.asarray(a0), np.asarray(b0)
        length = float(np.linalg.norm(b - a))
        if length < 3:
          continue
        along = (b - a) / length
        normal = np.array([along[1], -along[0]])
        if poly.covers(Point(*(a + along * length / 2 + normal * 0.1))):
          normal *= -1
        count = max(1, round(length / 2.5))
        floors = max(1, part["levels"] - part["minLevel"])
        pitch = (hi - lo) / floors
        for floor in range(floors):
          y = lo + (floor + 0.52) * pitch
          height = min(2.35, pitch * 0.52)
          if part["role"] == "stair-core":
            # Only the public east/northeast stair-core face receives the
            # narrow horizontal slots visible in the operator photograph.
            if normal[0] < 0.2 or length > 13:
              continue
            fitting(
              pi,
              a,
              along,
              normal,
              length / 2,
              y,
              min(2.5, length * 0.55),
              0.64,
              0x47616A,
              "stair slit",
            )
            fitting(
              pi,
              a,
              along,
              normal,
              length / 2,
              y - 0.43,
              min(2.7, length * 0.6),
              0.15,
              0xDFDED2,
              "slit sill",
            )
          else:
            for k in range(count):
              u = (k + 0.5) * length / count
              width = min(length / count - 0.48, 2.4)
              if width <= 0.2:
                continue
              fitting(pi, a, along, normal, u, y, width, height, 0x496B78, "window")
              fitting(
                pi,
                a,
                along,
                normal,
                u,
                y - height / 2 - 0.17,
                width + 0.18,
                0.22,
                0xE2E0D5,
                "sill",
              )
            # Structural vertical ribs are continuous only where source wall
            # and sibling-height clearance allow each floor-height section.
            for k in range(1, count):
              fitting(
                pi,
                a,
                along,
                normal,
                k * length / count,
                y,
                0.19,
                min(pitch - 0.12, hi - y),
                0xE3E1D5,
                "structural rib",
                0.24,
                0.31,
              )
        for k in range(max(1, math.ceil(length / 2.5))):
          n = max(1, math.ceil(length / 2.5))
          fitting(
            pi,
            a,
            along,
            normal,
            (k + 0.5) * length / n,
            hi - 0.22,
            length / n * 0.96,
            0.24,
            0xC1C3B6,
            "roof coping",
          )

  # Public mapped entrance, offset only enough to keep its complete detail on
  # the actual adjacent wall. Metric widths and the little Bayer cross are
  # estimated from the operator photograph; no logo image is bundled.
  pi, a, along, normal, u = entry_frame
  for du in [-2.5, 0, 2.5]:
    fitting(
      pi, a, along, normal, u + du, ground + 2.05, 2.2, 3.85, 0x355963, "entrance glass"
    )
    fitting(
      pi,
      a,
      along,
      normal,
      u + du + 1.17,
      ground + 2.05,
      0.13,
      4.05,
      0xD4D4C8,
      "entrance frame",
      0.17,
      0.28,
    )
  fitting(
    pi,
    a,
    along,
    normal,
    u,
    ground + 4.35,
    7.9,
    0.42,
    0xC8C9BF,
    "entrance header",
    0.3,
    0.28,
  )
  glyphs = {
    "B": ["110", "101", "110", "101", "110"],
    "A": ["010", "101", "111", "101", "101"],
    "Y": ["101", "101", "010", "010", "010"],
    "E": ["111", "100", "110", "100", "111"],
    "R": ["110", "101", "110", "101", "101"],
  }
  cy, px = ground + 7.1, 0.085
  for j in range(-16, 17):
    w = 2 * math.sqrt(max(0, 1.45**2 - (j * px) ** 2))
    fitting(
      pi,
      a,
      along,
      normal,
      u,
      cy + j * px,
      w,
      px * 0.98,
      0x25464E,
      "operator sign backing",
      0.08,
      0.24,
    )
  for k in range(72):
    t = k * 2 * math.pi / 72
    fitting(
      pi,
      a,
      along,
      normal,
      u + math.cos(t) * 1.44,
      cy + math.sin(t) * 1.44,
      0.12,
      0.12,
      0x85B942 if math.sin(t) > 0 else 0x36A1BB,
      "operator sign ring",
      0.06,
      0.31,
    )
  pixels = set()
  for k, ch in enumerate("BAYER"):
    for y, row in enumerate(glyphs[ch]):
      for x, value in enumerate(row):
        if value == "1":
          pixels.add((k * 4 + x - 9, 2 - y))
          pixels.add((x - 1, 14 - k * 6 - y))
  for x, y in sorted(pixels):
    fitting(
      pi,
      a,
      along,
      normal,
      u + x * px,
      cy + y * px,
      px * 0.9,
      px * 0.9,
      0xEEF3E9,
      "BAYER cross lettering",
      0.05,
      0.37,
    )

  # Strong, compact navigation: separate exact polygons; native uses the same
  # occupied one-metre cells and vertical intervals as the independent geometry.
  native_poly = unary_union([box(x, z, x + 1, z + 1) for x, z in merged_cells])
  native_footprints = [
    dict(ring=rings(p)[0], holes=rings(p)[1:]) for p in polygons(native_poly)
  ]
  native_cells = [
    [x, z, lo, hi]
    for (x, z), spans in sorted(merged_cells.items())
    for lo, hi, *_ in spans
  ]
  for p in volumes:
    p.pop("levels")
    p.pop("minLevel")
    p.pop("role")
  counts = dict(
    parts=len(volumes),
    sourceOsmParts=len(source["osmParts"]),
    shellTriangles=len(tones),
    drawnDetails=len(drawn),
    nativeBodyRuns=len(body),
    nativeDetails=len(native),
    nativeOccupiedCells=len(native_cells),
    retainedOtherCampusOwners=82,
  )
  payload = dict(
    schemaVersion=1,
    sourceSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    parts=volumes,
    nativeCells=native_cells,
    nativeFootprints=native_footprints,
    drawnPositions=packed(positions),
    drawnColors=packed(tones, "<u4"),
    drawnDetails=packed(drawn),
    nativeDetails=packed(body + native),
    counts=counts,
  )
  audit = dict(
    counts=counts,
    heightReceipts=receipts,
    fittings=fittings,
    originalLow=ground,
    originalTop=ground + old["height_m"],
    unchangedSourceInputs=source["inputs"],
    publicEntranceNativeBase=public_native_base,
    contourDiscrepancy=dict(
      oldOnlyArea=whole.difference(unary_union(geometries)).area,
      newOnlyArea=unary_union(geometries).difference(whole).area,
      oldOnlyRings=[
        rings(p) for p in polygons(whole.difference(unary_union(geometries)))
      ],
      newOnlyRings=[
        rings(p) for p in polygons(unary_union(geometries).difference(whole))
      ],
      disposition="Full original contour retained in evidence; tiny OSM/LoD2 boundary strips are not assigned invented heights; four-decimal ring rounding is explicit.",
    ),
    footprintArea=whole.area,
    mappedPartUnionArea=unary_union(geometries).area,
    sourceRingMismatchArea=Polygon(source["osmParent"]["ring"])
    .symmetric_difference(whole)
    .area,
    policies=dict(
      sourceBodiesRetired=1,
      otherSourceBodiesChanged=0,
      newScopeArea=0,
      futureNordhafenBuilding=False,
      undersideHeightEstimated=True,
      fittingSizesEstimated=True,
    ),
  )
  return payload, audit


def build_legacy() -> dict:
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  roles = ["source-clipped window", "facade sill", "source roof coping"]
  out = dict(roles=roles)
  for native, key, name in [(False, "boxes", "drawn"), (True, "blocks", "native")]:
    rows = [
      [index, *r[: 7 if native else 11], roles.index(r[-1])]
      for index, r in source["retiredV210"][key]
    ]
    out[name] = packed(rows, "<f8")
    out[name + "Count"] = len(rows)
  return out


if __name__ == "__main__":
  payload, audit = build()
  for path, value in [
    (DEST, payload),
    (EVIDENCE, audit),
    (DEST.parent / "bayerCampusV277Legacy.json", build_legacy()),
  ]:
    path.write_text(
      json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
      + "\n"
    )
  print(
    {
      **payload["counts"],
      "runtimeBytes": DEST.stat().st_size,
      "gzipBytes": len(gzip.compress(DEST.read_bytes())),
    }
  )
