"""Complete eleven-part Heeresbaeckerei, with exact proxy receipt and photo recognition."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_euref_v262 import fingerprint, json_for_js, mesh_fingerprint, remove_old
from build_roof_house_v233 import roof_height
from build_surrounding_outlines import PackedMesh, navigation_polygons
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/src/data"
PUB = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
OWNER = "DEBE02YY400000KE"
KIND = "koepenicker-landmarks-v268"
BOUNDS = [4096.0, 1536.0, 4608.0, 2048.0]
DARK, JOINT, ROOF = (184, 163, 115), (130, 111, 79), (96, 91, 80)
RED, WHITE, GLASS, YELLOW = (
  (143, 75, 58),
  (202, 189, 158),
  (57, 70, 68),
  (190, 169, 118),
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


def clip_height(points: list, threshold: float, above: bool) -> list:
  """Clip a source triangle at one horizontal plane without moving its surface."""
  output = []
  for a, b in zip(points, points[1:] + points[:1]):
    inside_a = a[1] >= threshold if above else a[1] <= threshold
    inside_b = b[1] >= threshold if above else b[1] <= threshold
    if inside_a:
      output.append(a)
    if inside_a != inside_b:
      t = (threshold - a[1]) / (b[1] - a[1])
      output.append([a[i] + t * (b[i] - a[i]) for i in range(3)])
  return output


def build() -> dict:
  archive = GEO / "raw/lod2/LoD2_393_5818.zip"
  parent = extract_parent(archive, OWNER)
  original = [part_profile(p) for p in list(leaf_building_parts(parent)) or [parent]]
  old = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    where=f"sourceId='{OWNER}'",
  ).iloc[0]
  previous = {
    key: old[key]
    for key in ["sourceId", "height", "minHeight", "heightSource", "sourceGroundY"]
  }
  previous["geometry"] = json.loads(json.dumps(mapping(old.geometry)))
  old_shape = shape(previous["geometry"])
  assert (
    unary_union([Polygon(p["ring"], p["holes"]) for p in original])
    .symmetric_difference(old_shape)
    .area
    < 0.00001
  )
  packets = {
    family: read(PUB / f"8_3.{family}.json.gz") for family in ["drawn", "minecraft"]
  }
  ground = packets["drawn"]["nav"]["groundY"]
  assert ground == packets["minecraft"]["nav"]["groundY"] == 3
  # This site is outside the resident ground raster, and belongs to the retained
  # y=3 streamed ground. Never use the raw LoD2 elevation (4.193) as its display base.
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
    panel = poly.intersection(box(*rect) if isinstance(rect, (list, tuple)) else rect)
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

  # Individual complete outer source sheets, not a replacement rectangular
  # facade. Internal coincident part faces stay in the measured shell only.
  def arch(surface, u, low, spring, radius, role):
    points = [(u - radius, low), (u + radius, low), (u + radius, spring)]
    points += [
      (u + radius * math.cos(t), spring + radius * math.sin(t))
      for t in np.linspace(0, math.pi, 20)
    ]
    points += [(u - radius, low)]
    outer = [
      (u - radius - 0.14, low - 0.10),
      (u + radius + 0.14, low - 0.10),
      (u + radius + 0.14, spring),
    ]
    outer += [
      (u + (radius + 0.14) * math.cos(t), spring + (radius + 0.14) * math.sin(t))
      for t in np.linspace(0, math.pi, 20)
    ]
    fitting(surface, Polygon(outer), RED, role + " brick arch and jambs", 0.07)
    fitting(surface, Polygon(points), GLASS, role + " glazing", 0.095)
    fitting(
      surface,
      [u - radius - 0.18, low - 0.16, u + radius + 0.18, low - 0.05],
      WHITE,
      role + " sill",
      0.105,
    )
    fitting(
      surface,
      [u - 0.025, low, u + 0.025, spring + radius - 0.04],
      JOINT,
      role + " steel mullion",
      0.11,
    )
    fitting(
      surface,
      [
        u - radius,
        low + (spring - low) * 0.55,
        u + radius,
        low + (spring - low) * 0.55 + 0.05,
      ],
      JOINT,
      role + " transom",
      0.115,
    )

  for pi, part in enumerate(parts):
    for si, surface in enumerate(part["surfaces"]):
      if surface["kind"] != "WallSurface":
        continue
      a, d, n, poly, length = frame(surface)
      if length < 2.8 or poly.area < 15:
        continue
      center = a + d * length / 2
      if old_shape.covers(Point(center[0] + n[0] * 0.2, center[2] + n[2] * 0.2)):
        n = -n
      if old_shape.covers(Point(center[0] + n[0] * 0.2, center[2] + n[2] * 0.2)):
        continue
      low, top = poly.bounds[1], poly.bounds[3]
      if top - low < 5:
        continue
      fronts.append(
        dict(
          part=original[pi]["id"],
          surface=si,
          sourceSurface=original[pi]["surfaces"][si],
          length=length,
          low=low,
          top=top,
        )
      )
      # Yellow clinker; thin red/sandstone cornices and the small blind arcade
      # below the roof follow the primary facade description and street photo.
      fitting(surface, [0, 3, length, 3.55], RED, "red masonry base", 0.035)
      for y in [3.65, 8.0, 12.2, top - 1.0, top - 0.20]:
        if y >= top - 0.05:
          continue
        fitting(
          surface, [0, y, length, y + 0.12], RED, "red clinker horizontal course", 0.055
        )
        fitting(
          surface, [0, y + 0.12, length, y + 0.20], WHITE, "sandstone cornice lip", 0.09
        )
      for y in np.arange(3.8, min(5.7, top - 0.3), 0.45):
        fitting(
          surface, [0, y, length, y + 0.014], JOINT, "restrained brick mortar", 0.022
        )
      for x in [0.16, length - 0.16]:
        fitting(
          surface,
          [x - 0.10, 3.6, x + 0.10, top - 0.2],
          YELLOW,
          "projecting corner pier",
          0.11,
        )
      if top > 16:
        for u in np.arange(0.65, length - 0.4, 0.80):
          r = 0.24
          spring = top - 0.72
          points = [(u - r, top - 1.1), (u + r, top - 1.1), (u + r, spring)]
          points += [
            (u + r * math.cos(t), spring + r * math.sin(t))
            for t in np.linspace(0, math.pi, 10)
          ]
          fitting(surface, Polygon(points), JOINT, "blind arcade frieze", 0.045)
      count = max(1, round(length / 3.6))
      pitch = length / count
      for i in range(count):
        u = (i + 0.5) * pitch
        r = min(0.8, (pitch - 0.6) / 2)
        if r < 0.45:
          continue
        # Only heights supported by the exact sheet are used. All bay/fitting
        # dimensions are display estimates, not invented survey measurements.
        for bottom, spring in [(4.0, 6.6), (8.9, 10.6), (12.9, 14.5)]:
          if spring + r > top - 1.55:
            continue
          arch(surface, u, bottom, spring, r, "segmental industrial window")
        if top > 19 and length > 8:
          arch(surface, u, 16.5, 17.0, r * 1.2, "upper storage lunette")
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
      for source_part, part in zip(original, parts, strict=True):
        roof_triangles = [
          t
          for surface in part["surfaces"]
          if surface["kind"] == "RoofSurface"
          for t in triangles_for(surface["rings"])
        ]
        elevations = [p[1] for t in roof_triangles for p in t]
        grouped = defaultdict(list)
        if max(elevations) - min(elevations) < 0.001:
          grouped[max(elevations)].append(Polygon(part["ring"], part["holes"]))
        else:
          for triangle in roof_triangles:
            low, high = min(p[1] for p in triangle), max(p[1] for p in triangle)
            if high - low < 0.000001:
              grouped[high].append(Polygon([(p[0], p[2]) for p in triangle]))
              continue
            for level in range(math.floor(low / 0.1) + 1, math.ceil(high / 0.1) + 1):
              top = min(level * 0.1, high)
              clipped = clip_height(
                clip_height(triangle, (level - 1) * 0.1, True), top, False
              )
              if len(clipped) >= 3:
                poly = Polygon([(p[0], p[2]) for p in clipped])
                if poly.area > 0.000001:
                  grouped[top].append(poly)
        for top, areas in grouped.items():
          for g in navigation_polygons(unary_union(areas), BOUNDS[0], BOUNDS[1]):
            nav.append(
              dict(
                **g,
                sourceId=OWNER,
                partId=source_part["id"],
                height=top - ground,
                minHeight=0,
                heightSource="Complete measured roof; flat sheets exact, sloped sheets bounded to 0.10m support strips",
              )
            )
    key = family + ":8_3"
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
  runtime["profile"] = dict(
    owner=OWNER,
    name="Heeresbäckerei / Bäckerei der Garde du Corps",
    sourceParts=len(original),
    sourceSheets=sum(len(p["surfaces"]) for p in original),
    groundY=ground,
    drawnTriangles=len(drawn.indices) // 3,
    nativeTriangles=len(native.indices) // 3,
    nativeCells=len(cells),
    drawnRoofNavigationToleranceM=0.1,
    shellDrawnTriangles=shell_drawn,
    shellNativeTriangles=shell_native,
    roles=dict(roles),
    fullMobileIdentical=True,
    independentlyOrthogonalNative=True,
    cameras=dict(
      corner=dict(position=[4294, 37, 1702], target=[4258, 12, 1648]),
      street=dict(position=[4203, 29, 1682], target=[4231, 12, 1640]),
      roof=dict(position=[4340, 85, 1730], target=[4256, 12, 1637]),
    ),
  )
  inputs = [
    archive,
    GEO / "raw/outer-v159/resolved-outlines.gpkg",
    GEO / "raw/outer-v159/candidate.gpkg",
    ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json",
    *[PUB / f"8_3.{mode}.json.gz" for mode in packets],
  ]
  references = [
    dict(
      url="https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031093,T",
      author="Landesdenkmalamt Berlin",
      claim="Yellow clinker; red-clinker/sandstone cornices; stepped three/four-storey wings, hinge-like corner, four chimney stumps and upper storage lunettes. Surviving 1888–1893 complex, not demolished grain store or mill.",
    ),
    dict(
      url="https://www.visitberlin.de/de/heeresbaeckerei",
      author="Berlin Tourismus & Kongress GmbH",
      claim="Site identity and exterior materials/form; illustrations attributed to Helmchen Event + Location, external references only.",
    ),
    dict(
      url="https://commons.wikimedia.org/wiki/File:Berlin-Kreuzberg,_Koepenicker_Strasse_16-17,_Heeresbaeckerei.jpg",
      author="Jörg Zägel",
      date="2012-05-01",
      license="CC BY-SA 3.0",
      licenseUrl="https://creativecommons.org/licenses/by-sa/3.0/",
      claim="Brommystraße street exterior, stepped massing, blind arcade/cornices, yellow/red masonry and arched glazing; photo reference only, no bundled pixels.",
    ),
  ]
  evidence = dict(
    owner=OWNER,
    osmId="way/37544845",
    originalParts=original,
    previousOwner=previous,
    sourceGroundY=source_ground,
    displayGroundY=ground,
    sourceShiftY=ground - source_ground,
    groundPolicy="Both immutable8_3 packets use groundY3 outside the core raster; complete source translated rigidly by -1.193m",
    inputs={str(p.relative_to(ROOT)): sha(p) for p in inputs},
    fronts=fronts,
    receipts=receipts,
    profile=runtime["profile"],
    references=references,
    estimates="Complete measured sheets, XZ and relative heights remain exact. Clinker colours, arch/window bays, metal glazing subdivisions, narrow cornices and blind arcade details are photo-based display estimates. No interior, portal opening, vanished mill, grain store, tenant signage or height inflation is invented. No coverage/descriptor/budget/mobile-quality change.",
  )
  write(OUT / "koepenickerLandmarksV268.json", runtime)
  write(GEO / "koepenicker-landmarks-v268-evidence.json.gz", evidence)
  print(
    json.dumps(
      dict(
        runtimeBytes=(OUT / "koepenickerLandmarksV268.json").stat().st_size,
        profile=runtime["profile"],
        retired={k: v["removedTriangles"] for k, v in receipts.items()},
      )
    )
  )
  return evidence


if __name__ == "__main__":
  build()
