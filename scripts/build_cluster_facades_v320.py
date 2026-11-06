"""Compile finite V320 ordinary fronts without rewriting any source packet.

Measured source wall extents are immutable. Window subdivisions, neutral paint
and small joinery are contextual display estimates, not surveyed apertures.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

from scripts import build_district_facades_v188 as base
from scripts.historical_asset_reader_v194 import historical_asset_bytes_v194

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
KIND = "cluster-facades-v320"
SOURCE_BASELINE = "e594dfff933c7a0114d3f58ac7c2d28872e612a2"
FAMILIES = {
  "v188": (
    "district-facades-v188-evidence.json.gz",
    "district188-",
    "district-facades-v188",
  ),
  "v230": (
    "outer-facades-v230-evidence.json.gz",
    "outerfacade230-",
    "outer-facades-v230",
  ),
}
EXCLUDED_EVIDENCE = (
  "outer-facades-v262-evidence.json.gz",
  "grey-facades-v263-evidence.json.gz",
  "kiez-facades-v209-evidence.json.gz",
  "moabit-houses-v269-evidence.json.gz",
  "mierendorff-v269-evidence.json.gz",
)
EXCLUDED_PACKETS = (
  "moabitMitteV300.json",
  "ostHousingV301.json",
  "westKiezV302.json",
  "friedrichshainV303.json",
  "rixdorfV304.json",
  "neukoellnLandmarksV305Packets.json",
  "northernFidelityV309Packets.json",
  "treptowWaterfrontV317Packets.json",
  "potsdamerCorridorV288.json",
)
MATERIAL_EVIDENCE = (
  "outer-materials-v232-evidence.json.gz",
  "outer-materials-v254-evidence.json.gz",
  "outer-materials-v263-evidence.json.gz",
)


def read(path):
  raw = Path(path).read_bytes()
  return json.loads(gzip.decompress(raw) if Path(path).suffix == ".gz" else raw)


def sha(raw):
  return hashlib.sha256(raw).hexdigest()


def write(path, value):
  raw = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
  Path(path).write_bytes(
    gzip.compress(raw, mtime=0) if str(path).endswith(".gz") else raw
  )


def fnv(*texts):
  value = 2166136261
  for text in texts:
    for byte in text.encode("ascii"):
      value = ((value ^ byte) * 16777619) & 0xFFFFFFFF
  return value


def part_fingerprint(part):
  return fnv(*(part[k] for k in ("positions", "colors", "indices")))


def owner_ids(value):
  result = set()
  if isinstance(value, dict):
    for key, child in value.items():
      if key in {"owner", "sourceId"} and isinstance(child, str):
        result.add(child)
      elif key == "owners" and isinstance(child, list):
        result.update(x for x in child if isinstance(x, str))
      else:
        result.update(owner_ids(child))
  elif isinstance(value, list):
    for child in value:
      result.update(owner_ids(child))
  return result


def exclusions():
  result = set()
  for name in EXCLUDED_EVIDENCE:
    path = GEO / name
    if path.exists():
      result.update(owner_ids(read(path)))
  for name in EXCLUDED_PACKETS:
    path = DATA / name
    if path.exists():
      result.update(owner_ids(read(path)))
  return result


def arrays(part):
  if part.get("positionType") != "u16cm":
    raise ValueError("V320 requires the exact retained centimetre source")
  p = np.frombuffer(base64.b64decode(part["positions"], validate=True), "<u2").reshape(
    -1, 3
  )
  c = np.frombuffer(base64.b64decode(part["colors"], validate=True), "u1").reshape(
    -1, 3
  )
  ix = np.frombuffer(base64.b64decode(part["indices"], validate=True), "<u4").reshape(
    -1, 3
  )
  if len(p) != len(c) or (len(ix) and int(ix.max()) >= len(p)):
    raise ValueError("Invalid source attributes")
  return p, c, ix


def triangle_key(p, c, triangle):
  return tuple(sorted(tuple(map(int, (*p[i], *c[i]))) for i in triangle))


def retire_generic(packet, faces, native, kind):
  """Match every full old fitting word, with multiplicity and RGB intact."""
  old = base.FacadeMesh(packet["origin"])
  for face in faces:
    if face.get("omittedWindowColumns"):
      raise ValueError("Occluded legacy grids need a separate exact replay")
    for span in face["nativeSpans"] if native else [face]:
      base.window_grid(old, span, native)
  p = np.asarray(old.positions, dtype=np.uint16)
  c = np.asarray(old.colours, dtype=np.uint8)
  ix = np.asarray(old.indices, dtype=np.uint32).reshape(-1, 3)
  wanted = Counter(triangle_key(p, c, t) for t in ix)
  found = defaultdict(list)
  for mesh, part in enumerate(packet["meshes"]):
    if part["kind"] != kind:
      continue
    q, colors, indices = arrays(part)
    for ordinal, triangle in enumerate(indices):
      key = triangle_key(q, colors, triangle)
      if key in wanted:
        found[key].append((mesh, ordinal))
  if any(len(found[key]) != count for key, count in wanted.items()):
    raise ValueError("Complete exact legacy fitting multiset does not match")
  result = defaultdict(list)
  for values in found.values():
    for mesh, ordinal in values:
      result[mesh].append(ordinal)
  return [
    {"mesh": mesh, "triangles": sorted(ids)} for mesh, ids in sorted(result.items())
  ]


def verify_wall(packet, face, native):
  """Require actual generic city faces, not just a navigation envelope."""
  origin = np.asarray(packet["origin"])
  if not native:
    tris = base.mesh_wall_triangles(packet)
    if not base.source_wall_exists(
      tris,
      np.asarray(face["a"]) - origin[[0, 2]],
      np.asarray(face["b"]) - origin[[0, 2]],
      face["low"] - origin[1],
      face["high"] - origin[1],
    ):
      raise ValueError(f"Missing complete ordinary drawn wall: {face['owner']}")
    return
  a, b = np.rint((np.asarray([face["a"], face["b"]]) - origin[[0, 2]]) * 100).astype(
    int
  )
  if (a[0] != b[0]) == (a[1] != b[1]):
    raise ValueError("Native span must be independently cardinal")
  constant, axis = (int(a[0]), 0) if a[0] == b[0] else (int(a[1]), 2)
  along = 2 if axis == 0 else 0
  low, high = np.rint(
    (np.asarray([face["low"], face["high"]]) - origin[1]) * 100
  ).astype(int)
  rectangle = box(
    min(a[1 if axis == 0 else 0], b[1 if axis == 0 else 0]),
    low,
    max(a[1 if axis == 0 else 0], b[1 if axis == 0 else 0]),
    high,
  )
  colors = tuple(base.linear((211, 208, 195)))
  polygons = []
  for part in packet["meshes"]:
    if part["kind"] != "city":
      continue
    p, c, ix = arrays(part)
    for tri in ix:
      q = p[tri]
      if np.all(q[:, axis] == constant) and all(tuple(v) == colors for v in c[tri]):
        poly = Polygon(q[:, [along, 1]])
        if poly.area and poly.intersects(rectangle):
          polygons.append(poly)
  if not polygons or not unary_union(polygons).covers(rectangle):
    raise ValueError("Native span lacks complete actual generic wall coverage")


def verify_primary_owner(packet, face):
  """Bind a new-only wall to the selected owner, including its vertical datum."""
  origin = np.asarray(packet["origin"])
  a, b = np.rint((np.asarray([face["a"], face["b"]]) - origin[[0, 2]]) * 100).astype(
    int
  )
  span = LineString([a, b])
  for building in packet["nav"]["buildings"]:
    if building.get("sourceId") != face["owner"]:
      continue
    ground = packet["nav"]["groundY"] + building.get("groundOffset", 0)
    if [round((ground + building[k]) * 100) for k in ("minHeight", "height")] != [
      round(face[k] * 100) for k in ("low", "high")
    ]:
      continue
    ring = np.rint(np.asarray(building["ring"]) * 100).astype(int).tolist()
    if any(
      LineString([start, end]).covers(span)
      for start, end in zip(ring, ring[1:] + ring[:1])
    ):
      return
  raise ValueError("New-only source wall is not an exact edge of the selected owner")


def validate_primary_audit(audit):
  required = (
    "wallMaterialTagsAbsent",
    "nonResidentialTagsAbsent",
    "previousGenericFittingsAbsent",
    "specializedOwnerExcluded",
    "protectedMappedFootprintsClear",
    "actualGenericDrawnWall",
    "actualGenericNativeWall",
  )
  if (
    not isinstance(audit, dict)
    or audit.get("building")
    not in {"apartments", "residential", "house", "detached", "terrace"}
    or any(audit.get(key) is not True for key in required)
    or not isinstance(audit.get("footprintIoU"), (int, float))
    or not 0.72 <= audit["footprintIoU"] <= 1
    or not (audit.get("osmWayId") or audit.get("osmRelationId"))
    or not isinstance(audit.get("sourceFile"), str)
  ):
    raise ValueError(
      "New-only front lacks the complete positive ordinary/material/protection audit"
    )


def door_bounds(face, doors, native):
  a, b = np.asarray(face["a"]), np.asarray(face["b"])
  direction = (b - a) / math.dist(a, b)
  result = []
  for source in doors:
    if source["owner"] != face["owner"]:
      continue
    door = source.get("native") if native else source
    if not door:
      continue
    point = np.asarray(door["point"])
    if abs(float(np.dot(point - a, face["normal"]))) > 0.04:
      continue
    u = float(np.dot(point - a, direction))
    width = door["width"] + 0.34
    result.append(
      [
        u - width / 2,
        door["low"] - 0.02,
        u + width / 2,
        door["low"] + door["height"] + 0.22,
      ]
    )
  return result


class FrontMesh(base.FacadeMesh):
  def local_quad(self, face, points, rgb):
    a = np.asarray(face["a"])
    d = (np.asarray(face["b"]) - a) / math.dist(face["a"], face["b"])
    n = np.asarray(face["normal"])
    world = [
      [*(a + d * u + n * depth)[:1], y, (a + d * u + n * depth)[1]]
      for u, y, depth in points
    ]
    self.quad(world, rgb)

  def returns(self, face, x0, y0, x1, y1, back, front, rgb):
    for points in [
      [(x0, y0, back), (x0, y0, front), (x0, y1, front), (x0, y1, back)],
      [(x1, y0, front), (x1, y0, back), (x1, y1, back), (x1, y1, front)],
      [(x0, y0, front), (x0, y0, back), (x1, y0, back), (x1, y0, front)],
      [(x0, y1, back), (x0, y1, front), (x1, y1, front), (x1, y1, back)],
    ]:
      self.local_quad(face, points, rgb)

  def compact(self):
    """Losslessly share only vertices with identical position AND RGB words."""
    lookup = {}
    positions, colours, remap = [], [], []
    for position, colour in zip(self.positions, self.colours):
      key = tuple(position + colour)
      if key not in lookup:
        lookup[key] = len(positions)
        positions.append(position)
        colours.append(colour)
      remap.append(lookup[key])
    self.positions, self.colours = positions, colours
    self.indices = [remap[i] for i in self.indices]

  def rectangle(self, face, u0, y0, u1, y1, depth, rgb, top=None):
    if u1 <= u0 or y1 <= y0:
      return
    a = np.asarray(face["a"])
    direction = (np.asarray(face["b"]) - a) / math.dist(face["a"], face["b"])
    normal = np.asarray(face["normal"])
    start = len(self.positions)
    self.pane(
      a,
      direction,
      normal,
      (u0 + u1) / 2,
      (y0 + y1) / 2,
      u1 - u0,
      y1 - y0,
      depth,
      rgb,
      top,
    )
    rounded = np.asarray(self.positions[start:]) / 100 + self.origin
    separation = (rounded[:, [0, 2]] - a) @ normal
    if depth >= 0.03 and float(separation.min()) < 0.02:
      raise ValueError("Quantized facade backing no longer clears its source plane")


def paint_with_door_holes(mesh, face, bounds, rgb, depth=0.03):
  length = math.dist(face["a"], face["b"])
  whole = box(0, face["low"], length, face["high"])
  # Split into rectangles at every mapped entrance edge. These disjoint small
  # cells retain the exact facade footprint while keeping the door aperture air.
  cuts = {0.0, length}
  for u0, _, u1, _ in bounds:
    cuts.update((max(0, min(length, u0)), max(0, min(length, u1))))
  cuts = sorted(cuts)
  for u0, u1 in zip(cuts, cuts[1:]):
    cell = box(u0, face["low"], u1, face["high"])
    holes = [box(*d) for d in bounds if box(*d).intersects(cell)]
    remainder = cell.difference(unary_union(holes)) if holes else cell
    for polygon in getattr(remainder, "geoms", [remainder]):
      if polygon.area:
        x0, y0, x1, y1 = polygon.bounds
        if polygon.area != (x1 - x0) * (y1 - y0):
          raise ValueError("Door complement is not a complete rectangle")
        if not whole.covers(polygon):
          raise ValueError("Facade skin escaped its exact wall")
        mesh.rectangle(face, x0, y0, x1, y1, depth, rgb)


def build_front(mesh, face, style, doors, native):
  length = math.dist(face["a"], face["b"])
  low, high = face["low"], face["high"]
  bounds = door_bounds(face, doors, native)
  if style.get("wallRgb") is not None:
    paint_with_door_holes(mesh, face, bounds, style["wallRgb"])
  floors = max(1, min(9, round((high - low - 0.6) / style["floorPitchM"])))
  bays = max(1, min(12, round((length - 0.8) / style["bayPitchM"])))
  pitch = (high - low - 0.7) / floors
  bay = length / bays
  width = min(2.2, bay * style["windowWidthRatio"])
  height = min(2.8, pitch * style["windowHeightRatio"])
  frame = style["frameWidthM"]
  front = 0.085 + style["revealDepthM"]
  rgb = style["frameRgb"]
  count = skipped = 0
  for row in range(floors):
    y = low + 0.35 + (row + 0.5) * pitch
    for column in range(bays):
      u = (column + 0.5) * bay
      rect = [
        u - width / 2 - frame,
        y - height / 2 - frame,
        u + width / 2 + frame,
        y + height / 2 + frame,
      ]
      if any(box(*rect).intersects(box(*door)) for door in bounds):
        skipped += 1
        continue
      x0, y0, x1, y1 = rect
      mesh.returns(
        face,
        x0 + frame,
        y0 + frame,
        x1 - frame,
        y1 - frame,
        0.085,
        front,
        style["revealRgb"],
      )
      mesh.rectangle(
        face,
        x0 + frame,
        y0 + frame,
        x1 - frame,
        y1 - frame,
        0.085,
        style["glassRgb"],
        None if native else style["glassTopRgb"],
      )
      for left, bottom, right, top in [
        (x0, y0, x0 + frame, y1),
        (x1 - frame, y0, x1, y1),
        (x0 + frame, y0, x1 - frame, y0 + frame),
        (x0 + frame, y1 - frame, x1 - frame, y1),
      ]:
        mesh.rectangle(face, left, bottom, right, top, front, rgb)
      if style.get("mullions", 1):
        mesh.rectangle(
          face, u - frame / 3, y0 + frame, u + frame / 3, y1 - frame, front + 0.01, rgb
        )
      ratio = style.get("transomRatio", 0.72)
      if ratio:
        cross = y0 + frame + height * ratio
        mesh.rectangle(
          face,
          x0 + frame,
          cross - frame / 3,
          x1 - frame,
          cross + frame / 3,
          front + 0.01,
          rgb,
        )
      mesh.rectangle(
        face,
        x0 - 0.04,
        y0 - 0.06,
        x1 + 0.04,
        y0 + 0.035,
        front + style["sillProjectionM"],
        style["plinthRgb"],
      )
      mesh.local_quad(
        face,
        [
          (x0 - 0.04, y0 + 0.035, 0.085),
          (x1 + 0.04, y0 + 0.035, 0.085),
          (x1 + 0.04, y0 + 0.035, front + style["sillProjectionM"]),
          (x0 - 0.04, y0 + 0.035, front + style["sillProjectionM"]),
        ],
        style["plinthRgb"],
      )
      count += 1
  for band in range(style.get("eaveBands", 1)):
    y = high - 0.20 - band * 0.16
    mesh.rectangle(
      face, 0.12, y - 0.045, length - 0.12, y + 0.045, 0.13 + band * 0.015, rgb
    )
  # The base course stops at every mapped entrance as the wall skin does.
  plinth = dict(face, high=min(high, low + style["plinthHeightM"]))
  paint_with_door_holes(mesh, plinth, bounds, style["plinthRgb"], 0.06)
  return {
    "windows": count,
    "doorCellsOmitted": skipped,
    "doorBounds": bounds,
    "floors": floors,
    "bays": bays,
  }


def normalized_style(style):
  defaults = dict(
    floorPitchM=3.6,
    bayPitchM=3.7,
    windowWidthRatio=0.44,
    windowHeightRatio=0.61,
    frameWidthM=0.095,
    revealDepthM=0.065,
    sillProjectionM=0.065,
    transomRatio=0.72,
    mullions=1,
    plinthHeightM=0.62,
    eaveBands=1,
    frameRgb=[218, 214, 201],
    glassRgb=[80, 111, 121],
    glassTopRgb=[112, 139, 146],
    plinthRgb=[156, 155, 145],
    revealRgb=[106, 107, 99],
  )
  result = defaults | style
  for key, lo, hi in [
    ("floorPitchM", 2.5, 5),
    ("bayPitchM", 2.2, 6),
    ("windowWidthRatio", 0.25, 0.7),
    ("windowHeightRatio", 0.35, 0.8),
    ("frameWidthM", 0.04, 0.18),
    ("revealDepthM", 0.03, 0.18),
    ("sillProjectionM", 0.02, 0.25),
    ("transomRatio", 0, 0.85),
    ("plinthHeightM", 0.2, 1.2),
  ]:
    if not lo <= result[key] <= hi:
      raise ValueError(f"Unbounded style parameter {key}")
  if result["mullions"] not in (0, 1) or result["eaveBands"] not in (1, 2):
    raise ValueError("Unbounded style member count")
  for key, value in result.items():
    if key.endswith("Rgb") and (
      len(value) != 3 or any(not 0 <= c <= 255 for c in value)
    ):
      raise ValueError("Invalid colour estimate")
  return result


def compile_profiles(profiles, *, allow_partial=False):
  clusters = [c for profile in profiles for c in profile["clusters"]]
  rings = Counter(c["ring"] for c in clusters)
  if not allow_partial and (
    len(clusters) != 50
    or set(rings) != {"inner", "outer"}
    or rings["inner"] < 20
    or rings["outer"] < 20
  ):
    raise ValueError(
      "Exactly fifty nonempty groups, at least twenty inside and outside, required"
    )
  if len({c["id"] for c in clusters}) != len(clusters):
    raise ValueError("Duplicate cluster")
  manifest = read(PUBLIC / "manifest.json")
  descriptors = {c["id"]: c for c in manifest["chunks"]}
  published_manifest = subprocess.check_output(
    [
      "git",
      "show",
      SOURCE_BASELINE + ":src/app/public/mesh/surrounding-berlin-v159/manifest.json",
    ],
    cwd=ROOT,
  )
  published_assets = {
    asset["url"]: asset
    for descriptor in json.loads(published_manifest)["chunks"]
    for mode in ("drawn", "minecraft")
    if (asset := descriptor.get(mode))
  }
  sources = {family: read(GEO / info[0]) for family, info in FAMILIES.items()}
  original_pins = defaultdict(set)
  for source in sources.values():
    for asset in source["oldAssets"]:
      original_pins[asset["url"]].add(asset["sha256"])
    for companion in source["companions"]:
      for mode in ("drawn", "minecraft"):
        original_pins[companion[mode]["url"]].add(companion[mode]["sha256"])
  lookup = {
    family: {(f["owner"], f["chunk"]): f for f in source["faces"]}
    for family, source in sources.items()
  }
  veto = exclusions()
  mapped_materials = set()
  material_sources = []
  for name in MATERIAL_EVIDENCE:
    path = GEO / name
    material = read(path)["owners"]
    mapped_materials.update(material)
    material_sources.append(
      dict(
        path=str(path.relative_to(ROOT)),
        sha256=sha(path.read_bytes()),
        owners=len(material),
      )
    )
  doors = read(GEO / "house-doors-v233-evidence.json.gz")["doors"]
  packets = {}
  inputs = {}
  buckets = defaultdict(list)
  seen = set()
  resolved = []
  for cluster in clusters:
    if len(cluster["faces"]) != 4 or not cluster.get("references"):
      raise ValueError(
        "Every group requires four distinct owners and attributed references"
      )
    style = normalized_style(cluster["style"])
    for requested in cluster["faces"]:
      family, owner, chunk = (requested[k] for k in ("family", "owner", "chunk"))
      if owner in veto or owner in seen:
        raise ValueError(f"Protected or duplicate selected owner: {owner}")
      if owner in mapped_materials:
        raise ValueError(
          f"Explicit mapped material owner cannot receive an estimated skin: {owner}"
        )
      seen.add(owner)
      if family == "primary":
        face = dict(requested)
        if any(
          owner == old_owner for index in lookup.values() for old_owner, _ in index
        ):
          raise ValueError(
            "A new-only owner already has a legacy generic fitting receipt"
          )
        validate_primary_audit(requested.get("ordinaryWallAudit"))
        host = chunk
      else:
        if family not in lookup or (owner, chunk) not in lookup[family]:
          raise ValueError("Unknown immutable original face receipt")
        face = dict(lookup[family][owner, chunk], family=family)
        for field in ("a", "b", "low", "high", "normal", "nativeSpans"):
          if field in requested and requested[field] != face[field]:
            raise ValueError("Regional face drifted from the immutable receipt")
        if face.get("omittedWindowColumns") or face.get("nativeWindowCount", 0) <= 0:
          raise ValueError("Only complete positive-native old fronts are eligible")
        host = FAMILIES[family][1] + chunk
      if not face.get("nativeSpans"):
        raise ValueError("Every owner needs independent actual native spans")
      record = {
        "cluster": cluster["id"],
        "face": face,
        "host": host,
        "style": style,
        "references": cluster["references"],
        "modes": {},
      }
      resolved.append(record)
      for native in (False, True):
        mode = "minecraft" if native else "drawn"
        for packet_id in {host, chunk}:
          key = f"{mode}:{packet_id}"
          if key not in packets:
            path = PUBLIC / descriptors[packet_id][mode]["url"]
            raw = path.read_bytes()
            decoded = gzip.decompress(raw)
            published = published_assets.get(path.name)
            if (
              published is None
              or sha(raw) != published["sha256"]
              or len(raw) != published["bytes"]
            ):
              raise ValueError(
                "Actual source is not the exact complete published199 packet"
              )
            if not original_pins[path.name]:
              raise ValueError(
                "Source packet has no retained original immutable receipt"
              )
            older = []
            for pin in original_pins[path.name]:
              historical = historical_asset_bytes_v194(path, pin)
              previous = gzip.decompress(historical)
              older.append(
                dict(
                  wireSha256=pin,
                  decodedSha256=sha(previous),
                  sameDecodedAsPublished199=previous == decoded,
                )
              )
            packets[key] = json.loads(decoded)
            inputs[str(path.relative_to(ROOT))] = {
              "wireSha256": sha(raw),
              "decodedSha256": sha(decoded),
              "originalReceiptSha256": sorted(original_pins[path.name]),
              "historicalReceipts": older,
            }
        primary = packets[f"{mode}:{chunk}"]
        for span in face["nativeSpans"] if native else [face]:
          verify_wall(primary, dict(span, owner=owner), native)
          if family == "primary":
            verify_primary_owner(primary, dict(span, owner=owner))
        buckets[f"{mode}:{host}"].append((record, native))
  plans = {}
  counts = Counter()
  for key, members in sorted(buckets.items()):
    packet = packets[key]
    mesh = FrontMesh(packet["origin"])
    retires = defaultdict(set)
    owners = []
    for record, native in members:
      face = record["face"]
      owners.append(face["owner"])
      face_retire = []
      if face["family"] != "primary":
        face_retire = retire_generic(
          packet, [face], native, FAMILIES[face["family"]][2]
        )
        for retire in face_retire:
          if retires[retire["mesh"]].intersection(retire["triangles"]):
            raise ValueError("A source fitting triangle has two owners")
          retires[retire["mesh"]].update(retire["triangles"])
      before = len(mesh.indices) // 3
      report = []
      for span in face["nativeSpans"] if native else [face]:
        report.append(
          build_front(
            mesh, dict(span, owner=face["owner"]), record["style"], doors, native
          )
        )
      if sum(r["windows"] for r in report) == 0:
        raise ValueError("A claimed owner has no visible new windows")
      record["modes"]["minecraft" if native else "drawn"] = {
        "fronts": report,
        "triangles": len(mesh.indices) // 3 - before,
        "retire": face_retire,
      }
    mesh.compact()
    part = mesh.payload()["meshes"][0]
    part["kind"] = KIND
    counts[key.split(":")[0] + "Triangles"] += len(mesh.indices) // 3
    nav = packet["nav"]
    # Empty companion navigation is integer-only and has identical JSON words
    # in Python/Bun/V8. Primary guards are finalized by the real Bun reader.
    empty_nav = nav == {"groundY": 3, "ground": [], "water": [], "buildings": []}
    nav_guard = fnv(json.dumps(nav, separators=(",", ":"))) if empty_nav else 0
    line = packet.get("lines")
    line_guard = fnv(line["positions"], line.get("colors", "")) if line else None
    plans[key] = dict(
      origin=packet["origin"],
      navGuard=nav_guard,
      preparedNavGuard=nav_guard,
      lineGuard=line_guard,
      preparedLineGuard=line_guard,
      records=[
        dict(mesh=i, kind=p["kind"], fingerprint=part_fingerprint(p))
        for i, p in enumerate(packet["meshes"])
      ],
      append=part,
      appendFingerprint=part_fingerprint(part),
      retire=[
        dict(mesh=i, triangles=sorted(rows)) for i, rows in sorted(retires.items())
      ],
      owners=sorted(owners),
    )
    if (
      len(packet["meshes"]) >= 16
      or sum(len(arrays(p)[0]) for p in packet["meshes"]) + len(mesh.positions) > 400000
    ):
      raise ValueError("Existing bounded packet vertex/part limit exceeded")
    if (
      sum(len(arrays(p)[2]) * 3 for p in packet["meshes"]) + len(mesh.indices) > 2400000
    ):
      raise ValueError("Existing bounded packet index limit exceeded")
  runtime = dict(schemaVersion=1, keys=sorted(plans), packets=plans)
  proof = dict(
    schemaVersion=1,
    sourceBaselineCommit=SOURCE_BASELINE,
    sourceBaselineManifestSha256=sha(published_manifest),
    mappedMaterialAudit=dict(sources=material_sources, selectedOverlaps=0),
    policy="Measured full source walls; contextual estimated fittings. Original bodies, roofs, navigation, lines and wire packets unchanged.",
    clusters=[{k: c[k] for k in ("id", "label", "ring")} for c in clusters],
    sourceInputs=inputs,
    resolved=resolved,
    counts=dict(counts),
    owners=len(seen),
    groups=len(clusters),
    bodyTrianglesRetired=0,
    sourceFilesWritten=0,
    pendingBunPrimaryGuards=[key for key, p in plans.items() if p["navGuard"] == 0],
  )
  return runtime, proof


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("profiles", nargs="+", type=Path)
  parser.add_argument("--allow-partial", action="store_true")
  parser.add_argument("--output", type=Path, default=DATA / "clusterFacadesV320.json")
  parser.add_argument(
    "--evidence", type=Path, default=GEO / "cluster-facades-v320-evidence.json.gz"
  )
  args = parser.parse_args()
  runtime, proof = compile_profiles(
    [read(p) for p in args.profiles], allow_partial=args.allow_partial
  )
  proof["profiles"] = [
    {
      "path": str(p.resolve().relative_to(ROOT))
      if p.resolve().is_relative_to(ROOT)
      else p.name,
      "sha256": sha(p.read_bytes()),
    }
    for p in args.profiles
  ]
  write(args.output, runtime)
  write(args.evidence, proof)
  print(
    json.dumps(
      {
        "groups": proof["groups"],
        "owners": proof["owners"],
        "packets": len(runtime["keys"]),
        "runtimeBytes": args.output.stat().st_size,
        "counts": proof["counts"],
        "pendingBunPrimaryGuards": proof["pendingBunPrimaryGuards"],
      }
    )
  )


if __name__ == "__main__":
  main()
