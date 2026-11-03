"""Measured finite Gesundbrunnen decks, exact source paint and paired lower floor.

Original Core source arrays are retained unchanged. Precisely exposed road and
curb indices yield through a separately guarded additive Core delta. Source-quarter
ground retirement stays with v307 except its explicitly unowned ordinals; those
have a complete original outside in the same required root. Photographic pixels remain ignored offline.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import subprocess
from collections import defaultdict
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import substring
from terrain_fields_v307 import TerrainMeshV307, polygons_v307, triangulate_v307

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
RAW = GEO / "raw/gesundbrunnen-bridges-v309"
TASK = Path(
  "/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/release-plan-v196"
)
CAPTURE = TASK / "rail-v307"
OUT = TASK / "hospitals-v308"
BALLAST = [10537, 8224, 6168]


def retained_inputs():
  path = GEO / "gesundbrunnen-road-bridges-v309-inputs.json.gz"
  if not path.exists():
    raise FileNotFoundError("Retained v309 bridge inputs are missing")
  return json.loads(gzip.decompress(path.read_bytes()))


def read(path):
  if path.exists():
    return json.loads(
      gzip.decompress(path.read_bytes()) if path.suffix == ".gz" else path.read_bytes()
    )
  archive = retained_inputs()
  if path.parent == RAW:
    return archive["raw"][path.name]
  if path == OUT / "gesundbrunnen-curb-ink-actual-v309.json":
    return archive["curbInkCapture"]
  if path == CAPTURE / "actual-bridge-axes.json":
    return archive["axes"]
  if path.parent == CAPTURE / "prepared":
    return archive["tileCaptures"][path.name]["metadata"]
  if path == CAPTURE / "core-predecessor/drawn-worker.json":
    return archive["workerRoadCapture"]
  if (
    path.parent == CAPTURE / "core-predecessor"
    and path.stem in archive["groundCaptures"]
  ):
    spec = archive["groundCaptures"][path.stem]
    part = json.loads(json.dumps(spec["part"]))
    matrix = np.zeros((part["instances"]["count"], 16), dtype="<f4")
    colours = np.zeros((part["instances"]["count"], 3), dtype="<f4")
    for row in spec["rows"]:
      matrix[row["ordinal"]] = row["matrix"]
      colours[row["ordinal"]] = row["color"]
    part["instances"]["matrix"] = base64.b64encode(matrix.tobytes()).decode()
    part["instances"]["colors"] = base64.b64encode(colours.tobytes()).decode()
    return dict(
      key=path.stem,
      parts=[dict(name="unused exact extrapolated complement"), part]
      if path.stem == "minecraft"
      else [part],
    )
  raise FileNotFoundError(path)


def write(path, value):
  payload = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
  path.write_bytes(gzip.compress(payload, mtime=0) if path.suffix == ".gz" else payload)


def sha(path):
  if path.exists():
    return hashlib.sha256(path.read_bytes()).hexdigest()
  archive = retained_inputs()
  if path == OUT / "gesundbrunnen-curb-ink-actual-v309.json":
    return archive["curbInkCaptureSha256"]
  if path.parent == CAPTURE / "prepared":
    return archive["tileCaptures"][path.name]["sha256"]
  if path.parent == CAPTURE / "core-predecessor":
    return archive["captureShas"][path.name]
  raise FileNotFoundError(path)


def source_plane_cut(points, domain, inside=True):
  """Barycentric clip in the actual source plane, including vertical kerbs."""
  footprint = Polygon(points[:, [0, 2]])
  if footprint.area > 1e-9:
    axes = [0, 2]
    plane = footprint
    cut = plane.intersection(domain)
  else:
    axis = int(np.argmax(np.ptp(points[:, [0, 2]], axis=0))) * 2
    if np.ptp(points[:, axis]) < 1e-9:
      return []
    order = np.argsort(points[:, axis])
    edge = LineString(points[order[[0, -1]]][:, [0, 2]])
    intersection = edge.intersection(domain)
    members = (
      [intersection]
      if intersection.geom_type == "LineString"
      else list(getattr(intersection, "geoms", []))
    )
    strips = []
    for member in members:
      if member.geom_type == "LineString" and member.length > 1e-9:
        values = np.asarray(member.coords)[:, axis // 2]
        strips.append(
          box(
            float(values.min()),
            float(points[:, 1].min()) - 1,
            float(values.max()),
            float(points[:, 1].max()) + 1,
          )
        )
    from shapely.ops import unary_union

    axes = [axis, 1]
    plane = Polygon(points[:, axes])
    cut = plane.intersection(unary_union(strips))
  if plane.area < 1e-10:
    return []
  if not inside:
    cut = plane.difference(cut)
  if cut.area < 1e-10:
    return []
  inv = np.linalg.inv(np.vstack((points[:, axes].T, np.ones(3))))
  normal = np.cross(points[1] - points[0], points[2] - points[0])
  result = []
  for triangle in triangulate_v307(cut):
    weights = np.c_[triangle, np.ones(3)] @ inv.T
    xyz = weights @ points
    if np.dot(np.cross(xyz[1] - xyz[0], xyz[2] - xyz[0]), normal) < 0:
      weights = weights[[0, 2, 1]]
    result.append(weights)
  return result


def mesh(key, native, origin=None):
  m = TerrainMeshV307(origin or [1100, -10, -3450])
  m.key, m.native = key, native
  return m


def packed(m):
  p = m.packed()
  if p:
    p.update(key=m.key, native=m.native, field="gesundbrunnen")
  return p


class FloatCorePaint:
  """Original Worker Float32 XZ words never pass through centimetre packing."""

  exact_float = True

  def __init__(self, key):
    self.key = key
    self.native = False
    self.vertices = []
    self.lookup = {}
    self.indices = []

  def add(self, points, colours):
    points = np.asarray(points, dtype="<f4")
    rgb = np.asarray(colours / 65535, dtype="<f4")
    for point, colour in zip(points, rgb, strict=True):
      key = tuple(np.r_[point, colour].view("<u4").tolist())
      at = self.lookup.get(key)
      if at is None:
        at = len(self.vertices)
        self.lookup[key] = at
        self.vertices.append(np.r_[point, colour])
      self.indices.append(at)

  def packed(self):
    if not self.indices:
      return None
    rows = np.asarray(self.vertices, dtype="<f4")
    return dict(
      positionType="f32",
      colorType="f32linear",
      origin=[0, 0, 0],
      positions=base64.b64encode(rows[:, :3].tobytes()).decode(),
      colors=base64.b64encode(rows[:, 3:].tobytes()).decode(),
      indices=base64.b64encode(np.array(self.indices, dtype="<u4").tobytes()).decode(),
      vertices=len(rows),
      triangles=len(self.indices) // 3,
    )


def profile_sources():
  plan, samples = read(RAW / "sample-plan.json"), read(RAW / "bdom-samples.json")
  domains = read(
    GEO / "gesundbrunnen-bridge-contact-exclusions-v309-extension.json.gz"
  )["domains"]
  result = []
  for key, coords in plan["lines"].items():
    line = LineString(coords)
    stations = []
    for station in sorted({q["station"] for q in samples if q["bridge"] == key}):
      points = [q for q in samples if q["bridge"] == key and q["station"] == station]
      assert len(points) == 9
      # The second-lowest sample rejects vehicles/truss projections while retaining
      # a real measured road sample rather than inventing a smoothed height.
      nhn = sorted(q["nhn"] for q in points)[1]
      stations.append([station, round(nhn - 30, 3)])
    domain = shape(domains[key])
    result.append(dict(key=key, line=line, domain=domain, stations=stations))
  return result


def height(site, x, z, native=False):
  station = site["line"].project(Point(x, z))
  rows = site["stations"]
  y = rows[-1][1]
  for a, b in zip(rows, rows[1:]):
    if station <= b[0]:
      t = max(0, min(1, (station - a[0]) / (b[0] - a[0])))
      y = a[1] * (1 - t) + b[1] * t
      break
  return math.floor(math.ceil(y * 8 - 1e-9) * 12.5 + 0.5 + 1e-8) / 100 if native else y


def bands(site, native):
  """Same finite profile subdivisions for visible caps, paint and navigation."""
  if native:
    west, north, east, south = site["domain"].bounds
    result = []
    for z in range(math.floor(north), math.ceil(south)):
      for x in range(math.floor(west), math.ceil(east)):
        cell = box(x, z, x + 1, z + 1)
        if site["domain"].covers(Point(x + 0.5, z + 0.5)):
          result.append((cell, height(site, x + 0.5, z + 0.5, True)))
    return result
  result = []
  for a, b in zip(site["stations"], site["stations"][1:]):
    segment = substring(site["line"], a[0], min(b[0], site["line"].length))
    if segment.length > 1e-7:
      area = segment.buffer(40, cap_style=2).intersection(site["domain"])
      result.append((area, None))
  # Endpoint normal wedges at a bend belong to their nearest measured strip.
  from shapely.ops import unary_union

  remainder = site["domain"].difference(unary_union([p for p, _ in result]))
  if not remainder.is_empty:
    result.append((remainder, None))
  return result


def native_rects(site):
  """Losslessly merge adjacent equal-height new cells; all outer faces remain."""
  by_row = defaultdict(dict)
  for cell, cap in bands(site, True):
    x, z, _, _ = cell.bounds
    by_row[int(z)][int(x)] = cap
  strips = []
  for z, row in sorted(by_row.items()):
    start = last = None
    level = None
    for x, y in sorted(row.items()):
      if last is not None and (x != last + 1 or y != level):
        strips.append([start, z, last + 1, z + 1, level])
        start = None
      if start is None:
        start = x
        level = y
      last = x
    if start is not None:
      strips.append([start, z, last + 1, z + 1, level])
  merged = []
  active = {}
  for x0, z0, x1, z1, cap in strips:
    key = (x0, x1, cap)
    old = active.get(key)
    if old is not None and merged[old][3] == z0:
      merged[old][3] = z1
    else:
      active[key] = len(merged)
      merged.append([x0, z0, x1, z1, cap])
  return [(box(x0, z0, x1, z1), cap) for x0, z0, x1, z1, cap in merged]


def prism(m, triangle, top, thickness, colour, walls=True):
  points = np.rint(np.array([[x, top(x, z), z] for x, z in triangle]) * 100) / 100
  lower = points.copy()
  lower[:, 1] -= thickness
  colours = np.repeat([colour], 3, axis=0)
  m.add(points, colours)
  m.add(lower[[0, 2, 1]], colours)
  for i in range(3) if walls else []:
    j = (i + 1) % 3
    m.add(np.array([points[i], lower[i], lower[j]]), colours)
    m.add(np.array([points[i], lower[j], points[j]]), colours)
  return points


def make_decks(sites):
  models, nav = [], []
  for native in [False, True]:
    for site in sites:
      m = mesh(site["key"] + ("-native-deck" if native else "-drawn-deck"), native)
      colour = (
        [36176, 36591, 34545] if site["key"] == "badstrasse" else [10023, 10537, 10023]
      )
      for region, cap in native_rects(site) if native else bands(site, False):
        top = (
          (lambda x, z, cap=cap: cap - 0.25)
          if native
          else (lambda x, z: height(site, x, z) - 0.2)
        )
        for triangle in triangulate_v307(region):
          points = prism(m, triangle, top, 0.5, colour, walls=not native)
          nav.append(
            dict(
              native=native,
              key=site["key"],
              thickness=0.5,
              ring=points[:, [0, 2]].tolist(),
              low=round(float(points[:, 1].min()) - 0.5, 6),
              high=round(float(points[:, 1].max()), 6),
              triangle=points.tolist(),
            )
          )
        if native:
          ring = list(region.exterior.coords)
          for a, b in zip(ring, ring[1:]):
            pa = np.array([a[0], cap - 0.25, a[1]])
            pb = np.array([b[0], cap - 0.25, b[1]])
            lowa = pa.copy()
            lowa[1] -= 0.5
            lowb = pb.copy()
            lowb[1] -= 0.5
            rgb = np.repeat([colour], 3, axis=0)
            m.add(np.array([pa, lowa, lowb]), rgb)
            m.add(np.array([pa, lowb, pb]), rgb)
      models.append(packed(m))
  return models, nav


def paint_replay(site, native, points, colours, target, lift, all_bands):
  """Only height changes; original source XZ and UInt16 paint are retained."""
  bounds = Polygon(points[:, [0, 2]]).bounds
  if len(bounds) != 4:
    return []
  nav = []
  for region, cap in all_bands:
    if not region.intersects(box(*bounds)):
      continue
    for weights in source_plane_cut(points, region):
      xyz = weights @ points
      if isinstance(lift, np.ndarray):
        offsets = weights @ lift
        xyz[:, 1] = [
          (cap if native else height(site, x, z)) + offset
          for (x, _, z), offset in zip(xyz, offsets, strict=True)
        ]
      else:
        xyz[:, 1] = [(cap if native else height(site, x, z)) + lift for x, _, z in xyz]
      xyz = (
        np.asarray(xyz, dtype="<f4").astype(float)
        if getattr(target, "exact_float", False)
        else np.rint(xyz * 100) / 100
      )
      target.add(xyz, weights @ colours)
      footprint = Polygon(xyz[:, [0, 2]])
      if footprint.area > 1e-8:
        nav.append(
          dict(
            native=native,
            key=site["key"],
            thickness=0.04,
            precision="f32" if getattr(target, "exact_float", False) else "cm",
            ring=xyz[:, [0, 2]].tolist(),
            low=round(float(xyz[:, 1].min()) - 0.04, 6),
            high=round(float(xyz[:, 1].max()), 6),
            triangle=xyz.tolist(),
          )
        )
  return nav


def current_unowned_bridge_faces():
  """Join to the final derived ground owner, not an earlier session list."""
  all_rows = read(
    GEO / "gesundbrunnen-bridge-contact-exclusions-v309-extension.json.gz"
  )["records"]
  ground = read(DATA / "railTerrainContactApproachV309Packets.json")["packets"]
  owned = {
    (key, row["mesh"], ordinal)
    for key, p in ground.items()
    for row in p["retire"]
    for ordinal in row["triangles"]
  }
  rows = [
    r
    for r in all_rows
    if (r["mode"] + ":" + r["tile"], r["mesh"], r["triangle"]) not in owned
  ]
  return dict(
    schemaVersion=1,
    groundPlanSha256=sha(DATA / "railTerrainContactApproachV309Packets.json"),
    records=rows,
    policy="Every bridge source original ordinal is joined against the final explicitly derived combined v307/v309 Ground+Approach recipe. A face already owned by that single ground transfer never appears in the bridge retirement plan or a second outside complement.",
  )


def tile_replays(sites):
  source = read(RAW / "tile-inside-source.json")
  unowned = current_unowned_bridge_faces()["records"]
  identities = {(r["mode"], r["tile"], r["mesh"], r["triangle"]) for r in unowned}
  models, nav, audit, plans = [], [], [], {}
  site_map = {s["key"]: s for s in sites}
  lookup = {
    (s["key"], native): bands(s, native) for s in sites for native in [False, True]
  }
  buckets = defaultdict(list)
  for row in source:
    buckets[(row["mode"], row["tile"])].append(row)
  terrain = read(DATA / "railSseTerrainV307.json")["profiles"][0]
  domain = shape(terrain["domain"])

  def lower_ground(x, z, fallback, native):
    xx, zz = (
      (math.floor(x / 4) * 4 + 2, math.floor(z / 4) * 4 + 2) if native else (x, z)
    )
    if not domain.covers(Point(xx, zz)):
      return fallback + 0.06
    w, n, _, _ = terrain["bounds"]
    u, v = (xx - w) / 4, (zz - n) / 4
    i, j = math.floor(u), math.floor(v)
    a, b = u - i, v - j
    r = terrain["offsets"]
    y = 3 + (
      r[j][i] * (1 - a) + r[j][i + 1] * (a - b) + r[j + 1][i + 1] * b
      if a >= b
      else r[j][i] * (1 - b) + r[j + 1][i] * (b - a) + r[j + 1][i + 1] * a
    )
    return math.ceil(y * 8 - 1e-9) / 8 if native else y

  for (mode, tile), rows in buckets.items():
    native = mode == "minecraft"
    capture_path = CAPTURE / f"prepared/{tile}.{mode}.json"
    capture = read(capture_path)
    assert all(r["captureSha256"] == sha(capture_path) for r in rows)
    origin = capture["origin"]
    paint, outside, underfloor = [
      mesh(mode + ":" + tile + ":" + role, native, origin)
      for role in [
        "deck-source-paint",
        "unowned-exact-outside",
        "unowned-underdeck-floor",
      ]
    ]
    retire = defaultdict(list)
    for row in rows:
      site = site_map[row["bridge"]]
      points, colours = np.array(row["xyz"]), np.array(row["rgb"])
      lift = 0.03 if list(colours[0]) == [38293, 33667, 23644] else 0
      nav.extend(
        paint_replay(
          site, native, points, colours, paint, lift, lookup[(site["key"], native)]
        )
      )
      identity = (mode, tile, row["mesh"], row["triangle"])
      if identity in identities:
        retire[row["mesh"]].append(row["triangle"])
        for bary in source_plane_cut(points, site["domain"], inside=False):
          outside.add(bary @ points, bary @ colours)
        # This is a small finite contact complement. Subdivide at the
        # same world four-metre DGM cell boundaries before sampling.
        footprint = Polygon(points[:, [0, 2]]).intersection(site["domain"])
        for poly in polygons_v307(footprint):
          x0, z0, x1, z1 = poly.bounds
          inv = np.linalg.inv(np.vstack((points[:, [0, 2]].T, np.ones(3))))
          for zi in range(math.floor(z0 / 4), math.ceil(z1 / 4)):
            for xi in range(math.floor(x0 / 4), math.ceil(x1 / 4)):
              cell = poly.intersection(box(xi * 4, zi * 4, (xi + 1) * 4, (zi + 1) * 4))
              diagonal = LineString([(xi * 4, zi * 4), ((xi + 1) * 4, (zi + 1) * 4)])
              from shapely.ops import split

              pieces = (
                list(split(cell, diagonal).geoms)
                if cell.geom_type == "Polygon"
                else polygons_v307(cell)
              )
              for piece in pieces:
                for tri in triangulate_v307(piece):
                  bary = np.c_[tri, np.ones(3)] @ inv.T
                  xyz = bary @ points
                  cap = (
                    lower_ground(
                      (xi + 0.5) * 4, (zi + 0.5) * 4, float(xyz[:, 1].mean()), native
                    )
                    if native
                    else None
                  )
                  xyz[:, 1] = [
                    cap if native else lower_ground(x, z, y, False) for x, y, z in xyz
                  ]
                  underfloor.add(xyz, np.repeat([BALLAST], 3, axis=0))
    for target in [paint, outside, underfloor]:
      if target.indices:
        models.append(packed(target))
    if retire:
      pins = capture["pins"]
      plans[mode + ":" + tile] = dict(
        origin=origin,
        records=pins["raw"]["records"],
        navGuard=pins["raw"]["nav"],
        lineGuard=pins["raw"]["lines"],
        preparedRecords=pins["prepared"]["records"],
        preparedNavGuard=pins["prepared"]["nav"],
        preparedLineGuard=pins["prepared"]["lines"],
        retire=[
          dict(mesh=k, triangles=sorted(set(v))) for k, v in sorted(retire.items())
        ],
        retireLines=[],
        retireNav=[],
        appendNav=[],
        owners=["gesundbrunnen-road-bridges-v309-unowned-paint"],
      )
    audit.append(
      dict(
        mode=mode,
        tile=tile,
        captureSha256=sha(capture_path),
        replayedSourceFaces=len(rows),
        retiredUnownedFaces=sum(len(v) for v in retire.values()),
        outsideTriangles=len(outside.indices) // 3,
        insideFloorTriangles=len(underfloor.indices) // 3,
      )
    )
  return models, nav, audit, dict(schemaVersion=1, keys=list(plans), packets=plans)


def core_replay(sites):
  """Additive exact Worker/Raster replay; the complete old Core stays intact."""
  site = next(s for s in sites if s["key"] == "badstrasse")
  models = []
  nav = []
  audit = []
  original = []
  captured = read(CAPTURE / "core-predecessor/drawn-worker.json")
  for part in captured["parts"]:
    if part.get("batchId") not in [
      "restored-asphalt-2--7",
      "restored-paving-2--7",
      "restored-kerbs-2--7",
    ]:
      continue
    p = np.frombuffer(
      base64.b64decode(part["attributes"]["position"]["array"]), "<f4"
    ).reshape(-1, 3)
    index = part["index"]
    ix = np.frombuffer(
      base64.b64decode(index["array"]),
      "<u2" if index["type"] == "Uint16Array" else "<u4",
    ).reshape(-1, 3)
    target = FloatCorePaint("badstrasse-exact-worker-" + part["batchId"])
    material = part["materials"]
    rgb = np.repeat([np.array(material["day"]["color"]) * 65535], 3, axis=0)
    lower_by_xz = {}
    if "kerbs" in part["batchId"]:
      for x, y, z in p:
        lower_by_xz[(float(x), float(z))] = min(
          float(y), lower_by_xz.get((float(x), float(z)), float(y))
        )
    lift = -0.04 if "paving" in part["batchId"] else 0
    oldmax = -math.inf
    oldmin = math.inf
    count = 0
    for ordinal, indices in enumerate(ix):
      points = p[indices].astype(float)
      bary = source_plane_cut(points, site["domain"])
      if not bary:
        continue
      # The complete source triangle can extend hundreds of metres outside
      # this finite deck. Only its exact admitted interior controls clearance.
      clipped = [weights @ points for weights in bary]
      oldmax = max(oldmax, max(float(q[:, 1].max()) for q in clipped))
      oldmin = min(oldmin, min(float(q[:, 1].min()) for q in clipped))
      count += 1
      offsets = (
        np.array([y - lower_by_xz[(x, z)] for x, y, z in points])
        if lower_by_xz
        else lift
      )
      nav.extend(
        paint_replay(site, False, points, rgb, target, offsets, bands(site, False))
      )
      original.append(
        dict(
          batchId=part["batchId"],
          ordinal=ordinal,
          xyz=points.tolist(),
          materials=material,
        )
      )
    if count:
      assert oldmax < min(row[1] for row in site["stations"]) - 0.5, (
        "An old Core road would still protrude through the deck"
      )
      q = packed(target)
      q["materials"] = material  # Keep exact original day/night material factors.
      # White vertex paint retains each original material multiplication.
      q["colors"] = base64.b64encode(
        np.ones((q["vertices"], 3), dtype="<f4").tobytes()
      ).decode()
      models.append(q)
      audit.append(
        dict(
          batchId=part["batchId"],
          faces=count,
          oldMinY=oldmin,
          oldMaxY=oldmax,
          newMinimumDeckY=min(r[1] for r in site["stations"]),
          policy="Complete original source words remain retained. Covered interior faces stay below the represented lower floor; precisely 28 exposed source faces yield through the separately guarded Core delta with exact outside fragments. See the exact cell/diagonal occlusion proof.",
        )
      )
  native = read(CAPTURE / "core-predecessor/minecraft.json")["parts"][1]
  matrices = np.frombuffer(
    base64.b64decode(native["instances"]["matrix"]), "<f4"
  ).reshape(-1, 16)
  rgb = np.frombuffer(base64.b64decode(native["instances"]["colors"]), "<f4").reshape(
    -1, 3
  )
  target = mesh("badstrasse-exact-native-raster-roadpaint", True)
  count = 0
  maxold = -math.inf
  exact_colours = set()
  for ordinal, (matrix, colour) in enumerate(zip(matrices, rgb, strict=True)):
    x, z = matrix[12], matrix[14]
    w, d = matrix[0], matrix[10]
    if colour[2] <= colour[1] or colour[1] <= colour[0]:
      continue  # Exact delivered blue-grey road palette, not green land.
    footprint = box(x - w / 2, z - d / 2, x + w / 2, z + d / 2).intersection(
      site["domain"]
    )
    if footprint.area < 1e-8:
      continue
    oldtop = float(matrix[13] + matrix[5] / 2)
    maxold = max(maxold, oldtop)
    count += 1
    exact_colours.add(tuple(np.asarray(colour, dtype="<f4").view("<u4").tolist()))
    original.append(
      dict(native=True, instance=ordinal, matrix=matrix.tolist(), color=colour.tolist())
    )
    for cell, cap in bands(site, True):
      cut = cell.intersection(footprint)
      for tri in triangulate_v307(cut):
        xyz = np.rint(np.c_[tri[:, 0], np.full(3, cap), tri[:, 1]] * 100) / 100
        target.add(xyz, np.repeat([colour * 65535], 3, axis=0))
        nav.append(
          dict(
            native=True,
            key=site["key"],
            thickness=0.04,
            ring=xyz[:, [0, 2]].tolist(),
            low=cap - 0.04,
            high=cap,
            triangle=xyz.tolist(),
          )
        )
  assert count and maxold < min(r[1] for r in site["stations"]) - 0.5
  native_packed = packed(target)
  assert len(exact_colours) == 1
  colour = np.array(next(iter(exact_colours)), dtype="<u4").view("<f4")
  native_packed["colors"] = base64.b64encode(
    np.repeat([colour], native_packed["vertices"], axis=0).tobytes()
  ).decode()
  native_packed["colorType"] = "f32linear"
  native_packed["materials"] = native["materials"]
  models.append(native_packed)
  audit.append(
    dict(
      native=True,
      exactRoadRasterRows=count,
      oldMaxY=maxold,
      sourceSha256=sha(CAPTURE / "core-predecessor/minecraft.json"),
    )
  )
  return models, nav, audit, original


def core_floor(sites):
  """Complete mapped Core floor under the western deck; original slabs stay."""
  site = next(s for s in sites if s["key"] == "badstrasse")
  terrain = read(DATA / "railSseTerrainV307.json")["profiles"][0]
  domain = shape(terrain["domain"])
  models = []
  proof = []

  def ground(x, z, native):
    if native:
      x = math.floor(x / 4) * 4 + 2
      z = math.floor(z / 4) * 4 + 2
    assert domain.covers(Point(x, z))
    w, n, _, _ = terrain["bounds"]
    u, v = (x - w) / 4, (z - n) / 4
    i, j = math.floor(u), math.floor(v)
    a, b = u - i, v - j
    r = terrain["offsets"]
    value = 3 + (
      r[j][i] * (1 - a) + r[j][i + 1] * (a - b) + r[j + 1][i + 1] * b
      if a >= b
      else r[j][i] * (1 - b) + r[j + 1][i] * (b - a) + r[j + 1][i + 1] * a
    )
    return (
      math.floor(math.ceil(value * 8 - 1e-9) * 12.5 + 0.5 + 1e-8) / 100
      if native
      else value
    )

  for variant, native, name in [
    ("drawn-initial", False, "Drawn ground slabs"),
    ("minecraft", True, "Voxel ground runs"),
  ]:
    capture = read(CAPTURE / f"core-predecessor/{variant}.json")
    part = next(q for q in capture["parts"] if q["name"] == name)
    matrices = np.frombuffer(
      base64.b64decode(part["instances"]["matrix"]), "<f4"
    ).reshape(-1, 16)
    target = mesh("badstrasse-complete-core-underdeck-" + variant, native)
    members = []
    area = 0
    for ordinal, row in enumerate(matrices):
      x, z, w, d = row[12], row[14], row[0], row[10]
      if x + w / 2 < 1120 or x - w / 2 > 1240 or z + d / 2 < -3360 or z - d / 2 > -3230:
        continue
      region = box(x - w / 2, z - d / 2, x + w / 2, z + d / 2).intersection(
        site["domain"]
      )
      if region.area < 1e-8:
        continue
      area += region.area
      members.append(ordinal)
      x0, z0, x1, z1 = region.bounds
      for zi in range(math.floor(z0 / 4), math.ceil(z1 / 4)):
        for xi in range(math.floor(x0 / 4), math.ceil(x1 / 4)):
          cell = region.intersection(box(xi * 4, zi * 4, (xi + 1) * 4, (zi + 1) * 4))
          if cell.is_empty:
            continue
          from shapely.ops import split

          pieces = (
            list(
              split(
                cell, LineString([(xi * 4, zi * 4), ((xi + 1) * 4, (zi + 1) * 4)])
              ).geoms
            )
            if cell.geom_type == "Polygon"
            else polygons_v307(cell)
          )
          for piece in pieces:
            for tri in triangulate_v307(piece):
              cap = ground((xi + 0.5) * 4, (zi + 0.5) * 4, True) if native else None
              xyz = np.array(
                [[xx, cap if native else ground(xx, zz, False), zz] for xx, zz in tri]
              )
              target.add(xyz, np.repeat([BALLAST], 3, axis=0))
    models.append(packed(target))
    proof.append(
      dict(
        variant=variant,
        sourceSha256=sha(CAPTURE / f"core-predecessor/{variant}.json"),
        sourceGroundRows=members,
        area=area,
        missingOutsideCore=site["domain"].area - area,
        policy="Complete original Core ground footprint only. The explicitly reported uncovered complement remains in the independently complete source-quarter contact. Original underground matrices and all source words remain unchanged.",
      )
    )
  return models, proof


def actual_floor_navigation(models):
  """Expose the same delivered lower floor planes to height-aware walking."""
  records = []
  external = read(DATA / "railBridgeUnderdeckApproachV309.json")["models"]
  for model in [q for q in models if "underdeck" in q["key"]] + external:
    points = np.frombuffer(base64.b64decode(model["positions"]), "<u2").reshape(
      -1, 3
    ) * 0.01 + np.array(model["origin"])
    indices = np.frombuffer(base64.b64decode(model["indices"]), "<u4").reshape(-1, 3)
    for ids in indices:
      xyz = points[ids]
      if Polygon(xyz[:, [0, 2]]).area < 1e-8:
        continue
      records.append(
        dict(
          native=model["native"],
          key="underdeck:" + model["key"],
          role="lower-rail-floor",
          thickness=0.04,
          ring=xyz[:, [0, 2]].tolist(),
          low=round(float(xyz[:, 1].min()) - 0.04, 6),
          high=round(float(xyz[:, 1].max()), 6),
          triangle=xyz.tolist(),
        )
      )
  return records


def verify_core_occlusion(sites):
  """Prove burial at every exact source/DGM-cell/diagonal intersection."""
  site = next(s for s in sites if s["key"] == "badstrasse")
  t = read(DATA / "railSseTerrainV307.json")["profiles"][0]
  domain = shape(t["domain"])

  def ground(x, z, native=False):
    if native:
      x = math.floor(x / 4) * 4 + 2
      z = math.floor(z / 4) * 4 + 2
    if not domain.covers(Point(x, z)):
      raise ValueError("Unmeasured Core bridge floor")
    w, n, _, _ = t["bounds"]
    u, v = (x - w) / 4, (z - n) / 4
    i, j = math.floor(u), math.floor(v)
    a, b = u - i, v - j
    r = t["offsets"]
    y = 3 + (
      r[j][i] * (1 - a) + r[j][i + 1] * (a - b) + r[j + 1][i + 1] * b
      if a >= b
      else r[j][i] * (1 - b) + r[j + 1][i] * (b - a) + r[j + 1][i + 1] * a
    )
    return (
      math.floor(math.ceil(y * 8 - 1e-9) * 12.5 + 0.5 + 1e-8) / 100 if native else y
    )

  proof = []
  for part in read(CAPTURE / "core-predecessor/drawn-worker.json")["parts"]:
    if part.get("batchId") not in [
      "restored-asphalt-2--7",
      "restored-paving-2--7",
      "restored-kerbs-2--7",
    ]:
      continue
    p = np.frombuffer(
      base64.b64decode(part["attributes"]["position"]["array"]), "<f4"
    ).reshape(-1, 3)
    ix = part["index"]
    indices = np.frombuffer(
      base64.b64decode(ix["array"]), "<u2" if ix["type"] == "Uint16Array" else "<u4"
    ).reshape(-1, 3)
    rows = []
    floating = []
    worst = -math.inf
    for ordinal, ids in enumerate(indices):
      source = p[ids].astype(float)
      first = source_plane_cut(source, site["domain"])
      if not first:
        continue
      selected = np.concatenate([bary @ source for bary in first])
      x0, z0 = selected[:, [0, 2]].min(axis=0)
      x1, z1 = selected[:, [0, 2]].max(axis=0)
      high = -math.inf
      checked = 0
      for zi in range(math.floor(z0 / 4), math.floor(z1 / 4) + 1):
        for xi in range(math.floor(x0 / 4), math.floor(x1 / 4) + 1):
          nw, ne, se, sw = (
            (xi * 4, zi * 4),
            ((xi + 1) * 4, zi * 4),
            ((xi + 1) * 4, (zi + 1) * 4),
            (xi * 4, (zi + 1) * 4),
          )
          for triangle in [(nw, ne, se), (nw, se, sw)]:
            region = Polygon(triangle).intersection(site["domain"])
            for bary in source_plane_cut(source, region):
              q = bary @ source
              for x, y, z in q:
                high = max(high, y - ground(x, z))
                checked += 1
      if checked:
        if high >= -0.02:
          floating.append([ordinal, checked, float(high)])
        else:
          worst = max(worst, high)
          rows.append([ordinal, checked, float(high)])
    proof.append(
      dict(
        batchId=part["batchId"],
        faces=len(rows),
        minimumBurialMetres=-float(worst),
        retiredFreeFaces=floating,
        rows=rows,
      )
    )
  # Independent native road rows have constant original top planes. Audit
  # every intersected cardinal lower-floor cell, not merely their deck cover.
  native_part = read(CAPTURE / "core-predecessor/minecraft.json")["parts"][1]
  matrices = np.frombuffer(
    base64.b64decode(native_part["instances"]["matrix"]), "<f4"
  ).reshape(-1, 16)
  colours = np.frombuffer(
    base64.b64decode(native_part["instances"]["colors"]), "<f4"
  ).reshape(-1, 3)
  native_rows = []
  for ordinal, (matrix, colour) in enumerate(zip(matrices, colours, strict=True)):
    if not colour[2] > colour[1] > colour[0]:
      continue
    x, z, width, depth = matrix[12], matrix[14], matrix[0], matrix[10]
    footprint = box(
      x - width / 2, z - depth / 2, x + width / 2, z + depth / 2
    ).intersection(site["domain"])
    if footprint.area < 1e-8:
      continue
    old_top = float(matrix[13] + matrix[5] / 2)
    west, north, east, south = footprint.bounds
    cells = []
    for zi in range(math.floor(north / 4), math.ceil(south / 4)):
      for xi in range(math.floor(west / 4), math.ceil(east / 4)):
        if (
          footprint.intersection(box(xi * 4, zi * 4, (xi + 1) * 4, (zi + 1) * 4)).area
          < 1e-8
        ):
          continue
        floor = ground(xi * 4 + 2, zi * 4 + 2, True)
        cells.append([xi * 4 + 2, zi * 4 + 2, floor])
    burial = min(row[2] - old_top for row in cells)
    assert burial > 0.02, "An unretired native source road floats above the lower floor"
    native_rows.append(
      dict(ordinal=ordinal, oldTop=old_top, cells=cells, minimumBurialMetres=burial)
    )
  assert len(native_rows) == 26
  return dict(
    schemaVersion=1,
    sourceSha256=sha(CAPTURE / "core-predecessor/drawn-worker.json"),
    terrainProfileSha256=sha(DATA / "railSseTerrainV307.json"),
    method="Exact affine source plane vs each four-metre DGM NW/SE affine triangle. Extrema occur at the complete clipped intersection vertices. Each non-retired original remains below the actual represented lower floor; precisely exposed source faces require the separately guarded Core delta with exact outside fragments. Native rows are independently proved against every intersected delivered cardinal floor cell.",
    parts=proof,
    native=dict(
      sourceSha256=sha(CAPTURE / "core-predecessor/minecraft.json"),
      rows=native_rows,
      minimumBurialMetres=min(row["minimumBurialMetres"] for row in native_rows),
    ),
  )


def core_bridge_delta(sites, occlusion):
  """A disjoint new source plan; the old recipe and control pins stay unchanged."""
  from build_core_terrain_contact_v307 import FloatMeshV307

  site = next(s for s in sites if s["key"] == "badstrasse")
  base = read(DATA / "coreTerrainContactV307.json")
  capture = read(CAPTURE / "core-predecessor/drawn-worker.json")
  patches = []
  proof = []
  for row in occlusion["parts"]:
    ordinals = [r[0] for r in row["retiredFreeFaces"]]
    if not ordinals:
      continue
    old = next(
      p
      for p in base["variants"]["drawn-worker"]["parts"]
      if p.get("batchId") == row["batchId"]
    )
    assert not set(ordinals) & set(old["retire"]), (
      "The bridge and Humboldt source retirements overlap"
    )
    part = next(p for p in capture["parts"] if p.get("batchId") == row["batchId"])
    p = np.frombuffer(
      base64.b64decode(part["attributes"]["position"]["array"]), "<f4"
    ).reshape(-1, 3)
    ix = part["index"]
    indices = np.frombuffer(
      base64.b64decode(ix["array"]), "<u2" if ix["type"] == "Uint16Array" else "<u4"
    ).reshape(-1, 3)
    outside = FloatMeshV307(
      part["materials"], "core:bridge-outside:drawn-worker:" + row["batchId"], False
    )
    receipts = []
    for ordinal in ordinals:
      points = p[indices[ordinal]].astype(float)
      inside = source_plane_cut(points, site["domain"])
      complement = source_plane_cut(points, site["domain"], False)

      def area(q):
        return float(np.linalg.norm(np.cross(q[1] - q[0], q[2] - q[0])) / 2)

      source_area = area(points)
      inside_area = sum(area(bary @ points) for bary in inside)
      outside_area = sum(area(bary @ points) for bary in complement)
      assert abs(source_area - inside_area - outside_area) < max(
        1e-6, source_area * 1e-8
      )
      for bary in complement:
        outside.add(
          bary @ points, np.ones((3, 3)), np.repeat([[0.0, 1.0, 0.0]], 3, axis=0)
        )
      receipts.append(
        dict(
          ordinal=ordinal,
          xyz=points.tolist(),
          sourceArea=source_area,
          insideArea=inside_area,
          outsideArea=outside_area,
        )
      )
    q = outside.packed()
    if q:
      q["field"] = "gesundbrunnen"
    # Full canonical base part metadata including its old outside is proved by
    # the independently finalized JS JSON control, not silently resigned here.
    patches.append(
      dict(
        name=old["name"],
        parentName=old["parentName"],
        batchId=old["batchId"],
        basePartControl=0,
        retire=ordinals,
        outsideAdditions=[q] if q else [],
      )
    )
    proof.append(
      dict(
        batchId=row["batchId"],
        sourceCaptureSha256=sha(CAPTURE / "core-predecessor/drawn-worker.json"),
        oldHumboldtRetireCount=len(old["retire"]),
        newBridgeRetireCount=len(ordinals),
        overlap=[],
        outsideTriangles=q["triangles"] if q else 0,
        receipts=receipts,
      )
    )
  delta = dict(
    schemaVersion=1,
    baseVariantControls={
      "drawn-initial": 691981172,
      "drawn-worker": 2745148416,
      "minecraft": 398998653,
    },
    variants={"drawn-worker": {"parts": patches}},
    policy="Delta only. Original source geometry/material/count/index/capture guards, original Humboldt retire ordinals and original outside are unchanged. New bridge source triangles are strictly disjoint; outsideAdditions preserve every original outside fragment once. A single composed controller owns each source mesh.",
  )
  write(DATA / "gesundbrunnenBridgeCoreV309Delta.json", delta)
  write(
    GEO / "gesundbrunnen-bridge-core-delta-v309-evidence.json.gz",
    dict(schemaVersion=1, parts=proof, policy=delta["policy"]),
  )
  return delta


def verify_existing_outside(sites):
  """Every original frozen Core outside remains disjoint, not merely IDs."""
  domain = next(s for s in sites if s["key"] == "badstrasse")["domain"]
  base = read(DATA / "coreTerrainContactV307.json")
  counts = []
  touching = []
  for variant, spec in base["variants"].items():
    for part in spec["parts"]:
      q = part.get("outside")
      if not q:
        continue
      p = np.frombuffer(base64.b64decode(q["positions"]), "<f4").reshape(-1, 3)
      ix = np.frombuffer(base64.b64decode(q["indices"]), "<u4").reshape(-1, 3)
      counts.append(
        dict(variant=variant, key=q["key"], vertices=len(p), triangles=len(ix))
      )
      for ordinal, indices in enumerate(ix):
        if source_plane_cut(p[indices].astype(float), domain):
          touching.append(
            dict(
              variant=variant, key=q["key"], triangle=ordinal, xyz=p[indices].tolist()
            )
          )
  assert not touching, "An original Core outside intersects the new bridge scope"
  result = dict(
    schemaVersion=1,
    domain=mapping(domain),
    scannedModels=len(counts),
    scannedTriangles=sum(q["triangles"] for q in counts),
    sources=counts,
    parts=touching,
    policy="Complete three-dimensional actual Float32 source-plane clipping, including vertical faces. Every original frozen outside is disjoint from the new bridge domain; no old outside record, word, object reference or control changes.",
  )
  write(GEO / "gesundbrunnen-core-existing-outside-audit-v309.json.gz", result)
  return result


def line_members(a, b, domain):
  line = LineString([a[[0, 2]], b[[0, 2]]])
  cut = line.intersection(domain)
  members = [cut] if cut.geom_type == "LineString" else list(getattr(cut, "geoms", []))
  d = b[[0, 2]] - a[[0, 2]]
  den = float(d @ d)
  if den < 1e-12:
    return []
  result = []
  for member in members:
    if member.geom_type != "LineString" or member.length < 1e-8:
      continue
    ends = np.array([member.coords[0], member.coords[-1]])
    t = ((ends - a[[0, 2]]) @ d) / den
    result.append(a[None, :] + t[:, None] * (b - a)[None, :])
  return result


def build_curb_ink(sites, delta):
  capture_path = OUT / "gesundbrunnen-curb-ink-actual-v309.json"
  capture = read(capture_path)
  site = next(s for s in sites if s["key"] == "badstrasse")
  p = np.frombuffer(
    base64.b64decode(capture["attributes"]["position"]["array"]), "<f4"
  ).reshape(-1, 3)
  index = capture["index"]
  ix = np.frombuffer(
    base64.b64decode(index["array"]), "<u2" if index["type"] == "Uint16Array" else "<u4"
  ).reshape(-1, 2)
  patch = next(
    p
    for p in delta["variants"]["drawn-worker"]["parts"]
    if p["batchId"] == "restored-kerbs-2--7"
  )
  segments = sorted({i // 2 for i in patch["retire"]})
  assert all(set([i * 2, i * 2 + 1]) <= set(patch["retire"]) for i in segments)
  kerb = next(
    q
    for q in read(CAPTURE / "core-predecessor/drawn-worker.json")["parts"]
    if q.get("batchId") == "restored-kerbs-2--7"
  )
  kp = np.frombuffer(
    base64.b64decode(kerb["attributes"]["position"]["array"]), "<f4"
  ).reshape(-1, 3)
  ki = np.frombuffer(
    base64.b64decode(kerb["index"]["array"]),
    "<u2" if kerb["index"]["type"] == "Uint16Array" else "<u4",
  ).reshape(-1, 3)
  for segment in segments:
    assert np.array_equal(
      p[ix[segment]][:, [0, 2]].copy().view("<u4"),
      kp[ki[segment * 2][:2]][:, [0, 2]].copy().view("<u4"),
    ), "Ink does not match the exact corresponding source curb"
  high = []
  outside = []
  proof = []
  for ordinal, indices in enumerate(ix):
    a, b = p[indices].astype(float)
    for band, _ in bands(site, False):
      for points in line_members(a, b, band):
        points[:, 1] = [height(site, x, z) + 0.15 for x, _, z in points]
        high.extend(np.asarray(points, dtype="<f4").tolist())
    if ordinal in segments:
      # Outside subtraction is done in the exact original segment parameter.
      source = LineString([a[[0, 2]], b[[0, 2]]])
      rest = source.difference(site["domain"])
      d = b[[0, 2]] - a[[0, 2]]
      den = float(d @ d)
      members = (
        [rest] if rest.geom_type == "LineString" else list(getattr(rest, "geoms", []))
      )
      saved = []
      for part in members:
        if part.geom_type != "LineString" or part.length < 1e-8:
          continue
        ends = np.array([part.coords[0], part.coords[-1]])
        t = ((ends - a[[0, 2]]) @ d) / den
        points = a[None, :] + t[:, None] * (b - a)[None, :]
        saved.extend(np.asarray(points, dtype="<f4").tolist())
        outside.extend(saved[-2:])
      proof.append(
        dict(
          segment=ordinal,
          xyz=[a.tolist(), b.tolist()],
          outside=saved,
          originalLength=source.length,
          insideLength=source.intersection(site["domain"]).length,
          outsideLength=rest.length,
        )
      )
  assert len(segments) == 6 and high
  source = {k: capture[k] for k in ["name", "parentName", "matrix", "renderOrder"]}
  source["batchId"] = capture["sourceBatchId"]
  source["attributes"] = {
    k: {n: v for n, v in a.items() if n != "array"}
    for k, a in capture["attributes"].items()
  }
  source["index"] = {k: v for k, v in capture["index"].items() if k != "array"}

  def payload(rows):
    return dict(
      positions=base64.b64encode(
        np.asarray(rows, dtype="<f4").reshape(-1, 3).tobytes()
      ).decode(),
      vertices=len(rows),
    )

  data = dict(
    schemaVersion=1,
    source=source,
    retireSegments=segments,
    drawn=dict(high=payload(high), outside=payload(outside)),
    sourceCaptureSha256=sha(capture_path),
    policy="Actual transferred source curb ink. High lines retain complete original Float32 XZ and architectural detail role. Only six old free source segments yield after the full bridge/approach/line gate; every exact old outside segment is retained. Native source has no Worker kerb-ink family and remains independently cardinal.",
  )
  write(DATA / "gesundbrunnenBridgeInkV309.json", data)
  write(
    GEO / "gesundbrunnen-bridge-ink-v309-source.json.gz",
    dict(schemaVersion=1, capture=capture, retireProof=proof, policy=data["policy"]),
  )
  return data


def retain_complete_inputs(sites):
  """Small self-contained exact old rows, complete road parts and raw receipts."""
  ground = {}
  site = next(s for s in sites if s["key"] == "badstrasse")
  for variant, name in [
    ("drawn-initial", "Drawn ground slabs"),
    ("minecraft", "Voxel ground runs"),
  ]:
    capture = read(CAPTURE / f"core-predecessor/{variant}.json")
    part = next(p for p in capture["parts"] if p["name"] == name)
    matrices = np.frombuffer(
      base64.b64decode(part["instances"]["matrix"]), "<f4"
    ).reshape(-1, 16)
    colours = np.frombuffer(
      base64.b64decode(part["instances"]["colors"]), "<f4"
    ).reshape(-1, 3)
    rows = []
    for ordinal, row in enumerate(matrices):
      x, z, w, d = row[12], row[14], row[0], row[10]
      if x + w / 2 < 1120 or x - w / 2 > 1240 or z + d / 2 < -3360 or z - d / 2 > -3230:
        continue
      if (
        box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)
        .intersection(site["domain"])
        .area
        < 1e-9
      ):
        continue
      rows.append(
        dict(ordinal=ordinal, matrix=row.tolist(), color=colours[ordinal].tolist())
      )
    proto = {k: v for k, v in part.items() if k != "instances"}
    proto["instances"] = {
      k: v for k, v in part["instances"].items() if k not in ["matrix", "colors"]
    }
    ground[variant] = dict(
      part=proto,
      rows=rows,
      policy="Exact selected original rows and complete original geometry/material descriptors; unchanged full-raster hashes remain source receipts, not a hash claim about a sparse reconstruction used only by this offline replay.",
    )
  worker = read(CAPTURE / "core-predecessor/drawn-worker.json")
  worker = dict(
    key="drawn-worker",
    production=worker.get("production", "actual retained production capture"),
    parts=[
      p
      for p in worker["parts"]
      if p.get("batchId")
      in ["restored-asphalt-2--7", "restored-paving-2--7", "restored-kerbs-2--7"]
    ],
  )
  tiles = {}
  for mode in ["drawn", "minecraft"]:
    for tile in ["2_-7", "3_-7"]:
      p = CAPTURE / f"prepared/{tile}.{mode}.json"
      q = read(p)
      tiles[p.name] = dict(
        sha256=sha(p), metadata=dict(origin=q["origin"], pins=q["pins"])
      )
  return dict(
    schemaVersion=1,
    axes=read(CAPTURE / "actual-bridge-axes.json"),
    curbInkCapture=read(OUT / "gesundbrunnen-curb-ink-actual-v309.json"),
    curbInkCaptureSha256=sha(OUT / "gesundbrunnen-curb-ink-actual-v309.json"),
    raw={
      name: read(RAW / name)
      for name in [
        "sample-plan.json",
        "bdom-samples.json",
        "tile-inside-source.json",
        "dop2025-request.json",
      ]
    },
    unownedByV307=current_unowned_bridge_faces(),
    captureShas={
      name + ".json": sha(CAPTURE / f"core-predecessor/{name}.json")
      for name in ["drawn-initial", "drawn-worker", "minecraft"]
    },
    tileCaptures=tiles,
    workerRoadCapture=worker,
    groundCaptures=ground,
  )


def main():
  sites = profile_sources()
  inputs = retain_complete_inputs(sites)
  write(GEO / "gesundbrunnen-road-bridges-v309-inputs.json.gz", inputs)
  models, nav = make_decks(sites)
  tile_models, tile_nav, tile_audit, packets = tile_replays(sites)
  core_models, core_nav, core_audit, core_source = core_replay(sites)
  floor_models, floor_proof = core_floor(sites)
  models += tile_models + core_models + floor_models
  nav += tile_nav + core_nav + actual_floor_navigation(models)
  occlusion = verify_core_occlusion(sites)
  write(GEO / "gesundbrunnen-core-road-occlusion-v309.json.gz", occlusion)
  core_delta = core_bridge_delta(sites, occlusion)
  build_curb_ink(sites, core_delta)
  verify_existing_outside(sites)
  subprocess.run(
    ["bun", str(ROOT / "src/app/scripts/finalize-bridge-core-v309.ts")],
    cwd=ROOT,
    check=True,
  )
  assert all(models)
  profile = dict(
    schemaVersion=1,
    lowerFloorSha256=sha(DATA / "railBridgeUnderdeckApproachV309.json"),
    contactSourceSha256=hashlib.sha256(
      json.dumps(
        read(GEO / "gesundbrunnen-bridge-contact-exclusions-v309-extension.json.gz"),
        sort_keys=True,
        separators=(",", ":"),
      ).encode()
    ).hexdigest(),
    sites=[
      dict(
        key=s["key"],
        line=list(s["line"].coords),
        domain=mapping(s["domain"]),
        stations=s["stations"],
      )
      for s in sites
    ],
    navigation=nav,
  )
  write(
    DATA / "gesundbrunnenRoadBridgesV309.json",
    dict(
      schemaVersion=1,
      contactSourceSha256=profile["contactSourceSha256"],
      lowerFloorSha256=profile["lowerFloorSha256"],
      modelCounts={
        "drawn": sum(not m["native"] for m in models),
        "minecraft": sum(m["native"] for m in models),
      },
      models=models,
    ),
  )
  write(DATA / "gesundbrunnenRoadBridgesV309Profile.json", profile)
  write(DATA / "gesundbrunnenRoadBridgesV309Packets.json", packets)
  write(
    GEO / "gesundbrunnen-road-bridges-v309-source.json.gz",
    dict(
      schemaVersion=1,
      axes=read(CAPTURE / "actual-bridge-axes.json"),
      bdom=read(RAW / "bdom-samples.json"),
      dop2025=read(RAW / "dop2025-request.json"),
      tileInsideSource=read(RAW / "tile-inside-source.json"),
      coreInsideSource=core_source,
      unownedByV307=current_unowned_bridge_faces(),
      floorPalette=BALLAST,
    ),
  )
  write(
    GEO / "gesundbrunnen-road-bridges-v309-evidence.json",
    dict(
      schemaVersion=1,
      tileAudit=tile_audit,
      coreAudit=core_audit,
      coreUnderdeckFloor=floor_proof,
      coreDeltaSha256=sha(DATA / "gesundbrunnenBridgeCoreV309Delta.json"),
      baseOutsideAuditSha256=sha(
        GEO / "gesundbrunnen-core-existing-outside-audit-v309.json.gz"
      ),
      curbInkSha256=sha(DATA / "gesundbrunnenBridgeInkV309.json"),
      retainedInputsSha256=sha(GEO / "gesundbrunnen-road-bridges-v309-inputs.json.gz"),
      coreRoadOcclusionSha256=sha(
        GEO / "gesundbrunnen-core-road-occlusion-v309.json.gz"
      ),
      sourceSha256=sha(GEO / "gesundbrunnen-road-bridges-v309-source.json.gz"),
      profileSha256=sha(DATA / "gesundbrunnenRoadBridgesV309Profile.json"),
      modelSha256=sha(DATA / "gesundbrunnenRoadBridgesV309.json"),
      packetSha256=sha(DATA / "gesundbrunnenRoadBridgesV309Packets.json"),
      policy=__doc__,
      heightPolicy="Actual road samples: nine lateral official bDOM queries per station, second-lowest selects a retained measured value to reject vehicles/truss. Absolute world height=NHN-30m. One metre independent cardinal native caps use eighth-metre ceiling(height), canonically rounded once to centimetres. Complete original XZ/paint source retained. Thin deck thickness 0.5m and lower base offset0.2m drawn/0.25m native are labelled display estimates.",
      references=[
        dict(
          url="https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030442",
          use="Swinemünder public historic bridge identity and three-span construction",
        ),
        dict(
          url="https://www.berlin.de/sen/uvk/_assets/verkehr/infrastruktur/brueckenbau/masterplan-bruecken-berlin/mpb_anhang_1_brueckenliste_bestand.pdf?ts=1779280609",
          use="Official 2025 inventory: Swinemünder228m/18.6m, Badstraße89.15m/26.2m with southern24.12m/28.83m extension. Mapped source axes govern the exact model end courses.",
        ),
        dict(
          url="https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
          use="Inspected official orthophoto confirms actual bridge/sidewalk courses and lower railway bed; no pixels shipped",
        ),
        dict(
          url="https://gdi.berlin.de/services/wms/bdom",
          use="261 retained official surface-height samples; no invented universal flat deck",
        ),
      ],
    ),
  )
  print(
    dict(
      models=len(models),
      triangles=sum(q["triangles"] for q in models),
      navigation=len(nav),
      unowned=sum(
        len(r["triangles"]) for p in packets["packets"].values() for r in p["retire"]
      ),
      tileAudit=tile_audit,
      coreAudit=core_audit,
      bytes=[
        (p.name, p.stat().st_size, len(gzip.compress(p.read_bytes(), mtime=0)))
        for p in [
          DATA / "gesundbrunnenRoadBridgesV309.json",
          DATA / "gesundbrunnenRoadBridgesV309Profile.json",
          DATA / "gesundbrunnenRoadBridgesV309Packets.json",
        ]
      ],
    )
  )


if __name__ == "__main__":
  main()
