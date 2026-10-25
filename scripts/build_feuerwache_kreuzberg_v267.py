"""Complete measured Kreuzberg fire station and bounded photo-led recognition."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import shapely
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_euref_v262 import fingerprint, json_for_js, mesh_fingerprint, remove_old
from build_roof_house_v233 import roof_height
from build_surrounding_outlines import PackedMesh, navigation_polygons
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/src/data"
PUB = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
OWNER = "DEBE02YY40000Avj"
KIND = "feuerwache-kreuzberg-v267"
BOUNDS = [3584.0, 2048.0, 4096.0, 2560.0]
DARK, JOINT, ROOF = (65, 67, 66), (49, 52, 52), (92, 94, 88)
RED, WHITE, GLASS, YELLOW = (
  (177, 54, 48),
  (205, 211, 201),
  (86, 109, 113),
  (176, 170, 111),
)
CELL = 0.5


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path, data):
  raw = (json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def cuboid(mesh, center, size, color):
  x, y, z = center
  w, h, d = size
  pts = [
    [x + a * w / 2, y + b * h / 2, z + c * d / 2]
    for a, b, c in [
      (-1, -1, -1),
      (1, -1, -1),
      (1, 1, -1),
      (-1, 1, -1),
      (-1, -1, 1),
      (1, -1, 1),
      (1, 1, 1),
      (-1, 1, 1),
    ]
  ]
  for q in [
    (0, 3, 2, 1),
    (4, 5, 6, 7),
    (0, 4, 7, 3),
    (1, 2, 6, 5),
    (3, 7, 6, 2),
    (0, 1, 5, 4),
  ]:
    mesh.triangle([pts[q[0]], pts[q[1]], pts[q[2]]], color)
    mesh.triangle([pts[q[0]], pts[q[2]], pts[q[3]]], color)


def frame(surface):
  ring = surface["rings"][0]
  a, b = max(
    ((a, b) for a in ring for b in ring),
    key=lambda q: math.hypot(q[1][0] - q[0][0], q[1][2] - q[0][2]),
  )
  if (b[0], b[2]) < (a[0], a[2]):
    a, b = b, a
  a, b = np.array(a), np.array(b)
  d = b - a
  d[1] = 0
  length = float(np.linalg.norm(d))
  d /= length
  n = np.array([-d[2], 0, d[0]])
  poly = Polygon(
    [[(np.array(p) - a) @ d, p[1]] for p in ring],
    [[[(np.array(p) - a) @ d, p[1]] for p in r] for r in surface["rings"][1:]],
  )
  return a, d, n, shapely.make_valid(poly), length


def build():
  archive = GEO / "raw/lod2/LoD2_393_5817.zip"
  parent = extract_parent(archive, OWNER)
  original = [part_profile(p) for p in list(leaf_building_parts(parent)) or [parent]]
  previous = next(
    b
    for b in read(GEO / "south-kiez-v185-source.json")["buildings"]
    if b["sourceId"] == OWNER
  )
  old_shape = shape(previous["geometry"])
  assert (
    unary_union([Polygon(p["ring"], p["holes"]) for p in original])
    .symmetric_difference(old_shape)
    .area
    < 0.00001
  )
  packets = {
    family: read(PUB / f"7_4.{family}.json.gz") for family in ["drawn", "minecraft"]
  }
  ground = packets["drawn"]["nav"]["groundY"]
  assert ground == packets["minecraft"]["nav"]["groundY"] == 3
  # This site is outside the resident ground raster, and belongs to the retained
  # y=3 streamed ground. Never use the raw LoD2 elevation (5.433) as its display base.
  terrain = read(ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json")
  grid, cell = terrain["grid"], terrain["cell_m"]
  assert old_shape.bounds[0] >= (grid["min_x_idx"] + grid["cols"]) * cell
  source_ground = min(p["ground_y_m"] for p in original)
  parts = copy.deepcopy(original)
  for p in parts:
    for s in p["surfaces"]:
      for r in s["rings"]:
        for q in r:
          q[1] += ground - source_ground
  drawn = PackedMesh(BOUNDS[0], BOUNDS[1])
  native = PackedMesh(BOUNDS[0], BOUNDS[1])
  roofs = []
  for p in parts:
    for s in p["surfaces"]:
      ts = triangles_for(s["rings"])
      if s["kind"] == "RoofSurface":
        roofs.extend(ts)
      for t in ts:
        drawn.triangle(t, ROOF if s["kind"] == "RoofSurface" else DARK)
  shell_drawn = len(drawn.indices) // 3
  # Independent cardinal half-metre cells sample complete source roofs; unioned
  # roof plates and only exposed walls retain the stepped height hierarchy.
  cells = {}
  x0, z0, x1, z1 = old_shape.bounds
  for iz in range(math.floor(z0 / CELL), math.ceil(z1 / CELL)):
    for ix in range(math.floor(x0 / CELL), math.ceil(x1 / CELL)):
      x, z = (ix + 0.5) * CELL, (iz + 0.5) * CELL
      if not old_shape.covers(Point(x, z)):
        continue
      hs = [h for t in roofs if (h := roof_height(t, x, z)) is not None]
      if hs:
        cells[(ix, iz)] = math.ceil(max(hs) / CELL) * CELL
  assert cells
  tops = defaultdict(list)
  for (ix, iz), top in cells.items():
    tops[top].append(box(ix * CELL, iz * CELL, (ix + 1) * CELL, (iz + 1) * CELL))
  for top, areas in sorted(tops.items()):
    native.surface(unary_union(areas), top, ROOF)
  strips = defaultdict(list)
  for (ix, iz), top in cells.items():
    for dx, dz in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
      lo = cells.get((ix + dx, iz + dz), ground)
      if top <= lo:
        continue
      axis = 0 if dx else 2
      fixed = (
        (ix + (1 if dx > 0 else 0)) * CELL if dx else (iz + (1 if dz > 0 else 0)) * CELL
      )
      strips[(axis, fixed, lo, top, dx + dz)].append(iz if dx else ix)
  for (axis, fixed, lo, top, sign), values in strips.items():
    values.sort()
    start = end = values[0]
    for val in [*values[1:], None]:
      if val is not None and val == end + 1:
        end = val
        continue
      a, b = start * CELL, (end + 1) * CELL
      q = (
        [[fixed, lo, a], [fixed, top, a], [fixed, top, b], [fixed, lo, b]]
        if axis == 0
        else [[a, lo, fixed], [b, lo, fixed], [b, top, fixed], [a, top, fixed]]
      )
      if (axis == 0 and sign < 0) or (axis == 2 and sign < 0):
        q.reverse()
      native.triangle(q[:3], DARK)
      native.triangle([q[0], q[2], q[3]], DARK)
      start = end = val
  shell_native = len(native.indices) // 3
  roles = Counter()
  fronts = []

  def fitting(surface, rect, color, role, depth=0.035, force_normal=None):
    a, d, n, poly, length = frame(surface)
    if force_normal is not None:
      n = np.array(force_normal)
    else:
      center = a + d * (length / 2)
      if old_shape.covers(Point(center[0] + n[0] * 0.18, center[2] + n[2] * 0.18)):
        n = -n
    panel = poly.intersection(box(*rect))
    if panel.is_empty or panel.area < 0.0001:
      return
    for face in getattr(panel, "geoms", [panel]):
      if face.geom_type != "Polygon":
        continue
      rings = [list(face.exterior.coords)[:-1]] + [
        list(h.coords)[:-1] for h in face.interiors
      ]
      world = [
        [
          [
            float(a[0] + d[0] * u + n[0] * depth),
            float(y),
            float(a[2] + d[2] * u + n[2] * depth),
          ]
          for u, y in ring
        ]
        for ring in rings
      ]
      for t in triangles_for(world):
        drawn.triangle(t, color)
    # Fit the cardinal native face actually represented by the cell field.
    axis = 2 if abs(n[2]) >= abs(n[0]) else 0
    other = 0 if axis == 2 else 2
    u0, y0, u1, y1 = panel.bounds
    p0, p1 = a + d * u0, a + d * u1
    lo, hi = sorted([p0[other], p1[other]])
    for step in range(math.floor(lo / CELL), math.ceil(hi / CELL)):
      along = (step + 0.5) * CELL
      u = (along - a[other]) / d[other]
      if not u0 - 0.001 <= u <= u1 + 0.001:
        continue
      strip = panel.intersection(box(u - 0.0001, y0, u + 0.0001, y1))
      if strip.is_empty:
        continue
      bottom, top = strip.bounds[1], strip.bounds[3]
      pos = a + d * u
      candidates = []
      for off in range(-4, 5):
        ix, iz = (
          (step, math.floor(pos[2] / CELL) + off)
          if axis == 2
          else (math.floor(pos[0] / CELL) + off, step)
        )
        roof = cells.get((ix, iz))
        if roof is not None and roof >= bottom:
          boundary = (
            (iz + (1 if n[2] > 0 else 0)) * CELL
            if axis == 2
            else (ix + (1 if n[0] > 0 else 0)) * CELL
          )
          candidates.append((boundary, roof))
      if not candidates:
        continue
      bound, roof = max(candidates) if n[axis] > 0 else min(candidates)
      top = min(top, roof - 0.015)
      if top <= bottom:
        continue
      center = [float(pos[0]), (bottom + top) / 2, float(pos[2])]
      center[other] = along
      center[axis] = bound + math.copysign(depth + 0.015, n[axis])
      # Paint lives on the actual cardinal wall. Only the visible rectangular
      # face is authored; no thousands of hidden tiny back/depth faces.
      h = (top - bottom) / 2
      w = CELL / 2 + 0.003
      q = (
        [
          [center[0] - w, center[1] - h, center[2]],
          [center[0] + w, center[1] - h, center[2]],
          [center[0] + w, center[1] + h, center[2]],
          [center[0] - w, center[1] + h, center[2]],
        ]
        if axis == 2
        else [
          [center[0], center[1] - h, center[2] - w],
          [center[0], center[1] + h, center[2] - w],
          [center[0], center[1] + h, center[2] + w],
          [center[0], center[1] - h, center[2] + w],
        ]
      )
      native.triangle(q[:3], color)
      native.triangle([q[0], q[2], q[3]], color)
    roles[role] += 1

  # These are actual retained exterior sheets, identified against the current
  # public photographs. Subdivision sizes/door count remain display estimates.
  selection = [
    (1, 20, 2, "hall"),
    (5, 24, 4, "tower"),
    (0, 1, 5, "wing"),
    (4, 18, 0, "return"),
    (4, 8, 0, "side"),
    (5, 33, 0, "rear"),
  ]
  for pi, si, gates, style in selection:
    s = parts[pi]["surfaces"][si]
    a, d, n, poly, length = frame(s)
    low, top = poly.bounds[1], poly.bounds[3]
    fronts.append(
      dict(
        part=original[pi]["id"],
        surface=si,
        gates=gates,
        style=style,
        sourceSurface=original[pi]["surfaces"][si],
      )
    )
    # Cladding courses are shallow; every original face/roof remains complete.
    for y in np.arange(low + 0.55, top - 0.12, 0.62):
      fitting(s, [0, y, length, y + 0.026], JOINT, "cladding horizontal joints")
    fitting(
      s,
      [0, top - 0.12, length, top - 0.025],
      (148, 153, 146),
      "slim parapet cap",
      0.055,
    )
    if style == "hall":
      levels = []
    elif style == "tower":
      levels = [8.5, 11.8, 15.1]
    elif style in ["wing", "return", "side"]:
      levels = [8.15, 12.25]
    else:
      levels = [7.1, 10.6, 14.1]
    for level in levels:
      if level + 1.4 > top - 0.3:
        continue
      fitting(
        s,
        [0.18, level, length - 0.18, level + 1.35],
        RED,
        "red horizontal spandrel field",
        0.04,
      )
      count = max(1, round(length / 4.6))
      pitch = length / count
      for i in range(count):
        left = i * pitch + 0.34
        right = min((i + 1) * pitch - 0.4, left + 3.0)
        fitting(
          s,
          [left, level + 0.04, right, level + 1.30],
          WHITE if level > 10 else YELLOW,
          "window perimeter",
          0.06,
        )
        fitting(
          s,
          [left + 0.065, level + 0.105, right - 0.065, level + 1.235],
          GLASS,
          "window glazing",
          0.082,
        )
        for u in np.arange(left + 0.95, right - 0.12, 0.96):
          fitting(
            s,
            [u - 0.035, level + 0.07, u + 0.035, level + 1.27],
            WHITE,
            "window mullion",
            0.105,
          )
        if level > 10:
          fitting(
            s, [left, level + 0.67, right, level + 0.72], WHITE, "window transom", 0.11
          )
    if gates:
      pitch = length / gates
      for i in range(gates):
        left = i * pitch + 0.33
        right = (i + 1) * pitch - 0.33
        fitting(
          s, [left, 3.12, right, 6.86], (174, 181, 171), "vehicle bay surround", 0.075
        )
        fitting(
          s,
          [left + 0.09, 3.18, right - 0.09, 6.77],
          (91, 110, 110),
          "closed glazed vehicle gate",
          0.10,
        )
        for y in np.arange(3.3, 6.8, 0.57):
          fitting(
            s,
            [left, y, right, y + 0.055],
            WHITE,
            "vehicle gate horizontal frame",
            0.125,
          )
        for u in np.arange(left + 0.72, right - 0.1, 0.8):
          fitting(s, [u, 3.17, u + 0.055, 6.8], WHITE, "vehicle gate mullion", 0.13)
        # Original procedural colour cues allude to the operator-documented
        # 2002 painted facade without copying any mural or protected character.
        for k, (color, y, h) in enumerate(
          [
            ((171, 56, 37), 3.2, 0.95),
            ((218, 110, 40), 4.12, 0.65),
            ((223, 176, 68), 4.75, 0.42),
          ]
        ):
          fitting(
            s,
            [i * pitch + 0.02, y, i * pitch + 0.20 + 0.055 * k, y + h],
            color,
            "abstract warm mural cue",
            0.11,
          )
    else:
      for u in np.arange(0.65, length - 1, 2.5):
        fitting(s, [u, 3.55, u + 1.45, 4.3], YELLOW, "low service window frame", 0.06)
        fitting(s, [u + 0.06, 3.61, u + 1.39, 4.24], GLASS, "low service glazing", 0.08)
  # Retained tower is the measured high western body; its mast is photographic
  # recognition only (thin unmeasured 5m estimate), with independent native bars.
  for mesh in [drawn, native]:
    cuboid(mesh, [3868.2, 21.0, 2332.3], [0.12, 5.0, 0.12], (139, 145, 141))
    cuboid(mesh, [3868.2, 22.9, 2332.3], [0.48, 0.08, 0.10], (139, 145, 141))
  old_wrapper = [
    dict(
      id=OWNER,
      oldOwner=dict(
        wkb=old_shape.wkb_hex,
        height=previous["height"],
        minHeight=previous["minHeight"],
      ),
    )
  ]
  receipts = {}
  runtime = dict(schema=1, keys=[], packets={})
  for family, model in [("drawn", drawn), ("minecraft", native)]:
    packet = packets[family]
    receipt = remove_old(copy.deepcopy(packet), old_wrapper, family, BOUNDS)
    replacement = model.payload(KIND)
    nav = []
    if family == "minecraft":
      for top, areas in tops.items():
        for g in navigation_polygons(unary_union(areas), BOUNDS[0], BOUNDS[1]):
          nav.append(
            dict(
              **g,
              sourceId=OWNER,
              partId="source-cell-height-" + str(top),
              height=top - ground,
              minHeight=0,
              heightSource="Complete measured roof sampled on independent 0.5m cardinal grid",
            )
          )
    else:
      for p in original:
        for g in navigation_polygons(
          Polygon(p["ring"], p["holes"]), BOUNDS[0], BOUNDS[1]
        ):
          nav.append(
            dict(
              **g,
              sourceId=OWNER,
              partId=p["id"],
              height=p["top_y_m"] - source_ground,
              minHeight=0,
              heightSource="Complete measured LoD2 part envelope",
            )
          )
    key = family + ":7_4"
    runtime["keys"].append(key)
    runtime["packets"][key] = dict(
      origin=packet["origin"],
      records=receipt["runtimeRecords"],
      lineFingerprint=receipt["runtimeLineFingerprint"],
      segments=receipt["runtimeSegments"],
      navigationFingerprint=fingerprint([json_for_js(packet["nav"])]),
      replacement=replacement,
      replacementFingerprint=mesh_fingerprint(replacement),
      buildings=nav,
    )
    receipts[family] = receipt
  oldprofiles = []
  for native_mode, name, start, count in [
    (False, "southKiezV185.json", 2449, 3),
    (True, "southKiezV185Native.json", 8698, 24),
  ]:
    data = read(OUT / name)
    rows = data["nativeRows" if native_mode else "boxes"]
    for i in range(start, start + count):
      r = rows[i]
      if r[1] > 10:
        new = list(r)
        new[1] = (
          15.35
          if native_mode
          else round(ground + original[0]["top_y_m"] - source_ground - 0.15, 3)
        )
        oldprofiles.append(
          dict(owner=OWNER, native=native_mode, index=i, before=r, after=new)
        )
  runtime["profile"] = dict(
    owner=OWNER,
    sourceParts=len(original),
    sourceSheets=sum(len(p["surfaces"]) for p in original),
    groundY=ground,
    gateBays=11,
    drawnTriangles=len(drawn.indices) // 3,
    nativeTriangles=len(native.indices) // 3,
    nativeCells=len(cells),
    shellDrawnTriangles=shell_drawn,
    shellNativeTriangles=shell_native,
    roles=dict(roles),
    fullMobileIdentical=True,
    independentlyOrthogonalNative=True,
    cameras=dict(
      front=dict(position=[3840, 34, 2425], target=[3868, 9, 2340]),
      west=dict(position=[3775, 24, 2322], target=[3850, 9, 2328]),
    ),
  )
  write(OUT / "feuerwacheKreuzbergV267.json", runtime)
  write(
    OUT / "feuerwacheKreuzbergV267PreviousProfiles.json",
    dict(owner=OWNER, records=oldprofiles),
  )
  inputs = [
    archive,
    GEO / "south-kiez-v185-source.json",
    GEO / "south-kiez-v185-evidence.json",
    OUT / "southKiezV185.json",
    OUT / "southKiezV185Native.json",
    ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json",
    *[PUB / f"7_4.{mode}.json.gz" for mode in packets],
  ]
  write(
    GEO / "feuerwache-kreuzberg-v267-evidence.json.gz",
    dict(
      owner=OWNER,
      originalParts=original,
      previousOwner=previous,
      sourceGroundY=source_ground,
      displayGroundY=ground,
      sourceShiftY=ground - source_ground,
      groundPolicy="Outside resident raster; both original streamed packet navigation records specify groundY=3",
      inputs={str(p.relative_to(ROOT)): sha(p) for p in inputs},
      fronts=fronts,
      profiles=oldprofiles,
      receipts=receipts,
      profile=runtime["profile"],
    ),
  )
  print(
    json.dumps(
      dict(
        runtimeBytes=(OUT / "feuerwacheKreuzbergV267.json").stat().st_size,
        profile=runtime["profile"],
        retired={k: v["removedTriangles"] for k, v in receipts.items()},
      )
    )
  )


if __name__ == "__main__":
  build()
