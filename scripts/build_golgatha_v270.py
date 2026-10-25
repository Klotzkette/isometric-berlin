"""Golgatha: exact upper-proxy transfer, preserved lower sheets, evidenced skyline.

Only new v270 files are written. Public LDA photograph and the user's current
Tacheles photographs establish the tall slate helm, four corner pinnacles,
clock gables and paired belfry arches. Dimensions above the source cut are
explicit photo estimates, not newly measured CityGML geometry.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import build_alt_mitte_v169 as core
import build_moabit_landmarks_v269 as church_helpers
import numpy as np
import shapely
from alt_mitte_v169_packets import pack_detail
from build_charite_bridges_alt_mitte_v265 import edges, line_signatures, signatures
from build_karl_marx_allee_v161 import Detail, clip_polygon, native_detail
from build_prisons_memorials_ownership_v209 import fingerprint, signature, vertices
from build_scheunenviertel_v168 import merge_native_faces
from build_surrounding_outlines import PackedMesh
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
PUB = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = core.SOURCE / "source-390_5821-00.json.gz"
OWNER, PART = "DEBE01YYK000002g", "DEBE3Dwcdzr9GoF6"
CUT, TOP, CELL = 33.2, 66.2, 0.5
BRICK, SLATE, CREAM, DARK = (151, 76, 57), (68, 70, 68), (196, 178, 144), (48, 42, 36)


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path, value):
  raw = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path):
  with path.open("rb") as f:
    return hashlib.file_digest(f, "sha256").hexdigest()


class LinearMesh(PackedMesh):
  """Source fragments already contain linear bytes; never colour-convert twice."""

  def payload(self, kind):
    values = np.array(list(self.vertices), dtype=np.uint16)
    if not len(values):
      return None

    def encode(a):
      return base64.b64encode(a.tobytes()).decode()

    return dict(
      kind=kind,
      positionType="u16cm",
      positions=encode(values[:, :3].astype("<u2")),
      colors=encode(values[:, 3:].astype("u1")),
      indices=encode(np.array(self.indices, dtype="<u4")),
    )


def source_model():
  records = read(SOURCE)["buildings"]
  owner = next(b for b in records if b["id"] == OWNER)
  tower = next(p for p in owner["parts"] if p["id"] == PART)
  occupied = unary_union([core.footprint(b) for b in records])
  shapely.prepare(occupied)
  core.APPEARANCE.clear()
  ranks = {}
  for previous in read(core.SOURCE / "appearance-baseline.json.gz")["records"]:
    for binding in previous["bindings"]:
      for p in binding["parts"]:
        rank = (p["match"] == "leaf-id", p["overlapAreaM2"])
        if rank > ranks.get(p["partId"], (False, -1)):
          core.APPEARANCE[p["partId"]], ranks[p["partId"]] = previous, rank
  shell, front, nav, _ = core.model(owner, occupied)
  full = Detail()
  full.triangles = shell.triangles + front.triangles
  # Native merging belongs to the complete original owner, not isolated parts.
  models = dict(
    drawn=core.isometric_shading(shell),
    front=core.isometric_shading(front),
    minecraft=merge_native_faces(native_detail(full)),
  )
  # Appearance changes preserve the original triangle inventory and coordinates.
  # Source material roles, never a broad bounding-box/colour runtime guess,
  # establish the precise masonry contributors before matching encoded packets.
  masonry = {tuple(c) for _, c, role in shell.triangles if role != "source RoofSurface"}
  roof_colours = {
    tuple(c) for _, c, role in shell.triangles if role == "source RoofSurface"
  }
  assert not masonry & roof_colours
  painted_shell, painted_native = Detail(), Detail()
  painted_shell.triangles = [
    (p, BRICK if role != "source RoofSurface" else c, role)
    for p, c, role in shell.triangles
  ]
  painted_native.triangles = [
    (p, BRICK if tuple(c) in masonry else c, role)
    for p, c, role in models["minecraft"].triangles
  ]
  models["painted-drawn"] = core.isometric_shading(painted_shell)
  models["painted-minecraft"] = painted_native
  return records, owner, tower, models, next(p for p in nav if p["id"] == PART)


def packet_paths():
  result = []
  for mode, label in [("drawn", "Drawn"), ("minecraft", "Native")]:
    for item in read(DATA / f"altMitte{label}V169Source.json")["chunkFiles"]:
      if item["id"].startswith("2_-3-"):
        result.append((mode, "alt-mitte-v169-" + item["id"], DATA / item["file"], mode))
  for item in read(PUB / "manifest.json")["chunks"]:
    if item["id"] == "2_-3" or item["id"].startswith("2_-3-alt-mitte-v169-"):
      result.append(("drawn", item["id"], PUB / item["drawn"]["url"], "front"))
  return result


def area(t):
  a, b, c = np.array(t)
  return float(np.linalg.norm(np.cross(b - a, c - a)) / 2)


def transfers(records, owner, tower, models, origin):
  receipts, line_receipts, audit, originals = [], [], [], {}
  complements = {m: LinearMesh(origin[0], origin[2]) for m in ["drawn", "minecraft"]}
  remaining, totals, lower_area, upper_area = {}, {}, Counter(), Counter()
  painted_by_key, palette, colour_packets, colour_audit = {}, [], {}, []
  for mode, tile, path, layer in packet_paths():
    packet = read(path)
    x, y, z = packet["origin"]
    key = (layer, x, y, z)
    if key not in remaining:
      expected = Counter()
      for mesh in pack_detail(models[layer], (x, z, x + 512, z + 512), origin_y=y):
        v = vertices(mesh)
        ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
        expected.update(
          signature(t) for t in v[ix] if t[:, 1].max() / 100 + y > CUT + 0.001
        )
      remaining[key], totals[key] = expected, sum(expected.values())
      paint = {}
      if layer in ("drawn", "minecraft"):
        before = pack_detail(models[layer], (x, z, x + 512, z + 512), origin_y=y)
        after = pack_detail(
          models["painted-" + layer], (x, z, x + 512, z + 512), origin_y=y
        )
        assert len(before) == len(after)
        for old, new in zip(before, after, strict=True):
          ov, nv = vertices(old), vertices(new)
          oi = np.frombuffer(base64.b64decode(old["indices"]), "<u4").reshape(-1, 3)
          ni = np.frombuffer(base64.b64decode(new["indices"]), "<u4").reshape(-1, 3)
          assert len(oi) == len(ni)
          for a, b in zip(ov[oi], nv[ni], strict=True):
            assert np.array_equal(a[:, :3], b[:, :3])
            if not np.array_equal(a[:, 3:], b[:, 3:]):
              paint[signature(a)] = tuple(int(v) for v in b[0, 3:])
      painted_by_key[key] = paint
    for mi, mesh in enumerate(packet["meshes"]):
      if mesh["kind"] != "alt-mitte-v169":
        continue
      v = vertices(mesh)
      ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      sigs, selected = signatures(mesh), []
      paint = painted_by_key[key]
      painted_triangles = {i for i, sig in enumerate(sigs) if sig in paint}
      candidates = {
        int(vertex): paint[sigs[i]] for i in painted_triangles for vertex in ix[i]
      }
      foreign_vertices = {
        int(v) for i, t in enumerate(ix) if i not in painted_triangles for v in t
      }
      owned_vertices = {
        v: colour for v, colour in candidates.items() if v not in foreign_vertices
      }
      if owned_vertices:
        runs = []
        for vertex, colour in sorted(owned_vertices.items()):
          packed_colour = (colour[0] << 16) | (colour[1] << 8) | colour[2]
          if packed_colour not in palette:
            palette.append(packed_colour)
          pi = palette.index(packed_colour)
          if runs and runs[-1][0] + runs[-1][1] == vertex and runs[-1][2] == pi:
            runs[-1][1] += 1
          else:
            runs.append([vertex, 1, pi])
        record = dict(
          mesh=mi,
          fingerprint=fingerprint([mesh["positions"], mesh["colors"], mesh["indices"]]),
          runs=base64.b64encode(np.array(runs, dtype="<u4").tobytes()).decode(),
        )
        colour_packets.setdefault(f"{mode}:{tile}", []).append(record)
        colour_audit.append(
          dict(
            file=str(path.relative_to(ROOT)),
            meshIndex=mi,
            tile=tile,
            mode=mode,
            ownedTriangles=sorted(painted_triangles),
            changedVertices=sorted(owned_vertices),
            excludedSharedVertices=sorted(set(candidates) - set(owned_vertices)),
          )
        )
        originals[str(path.relative_to(ROOT))] = sha(path)
      for i, sig in enumerate(sigs):
        if not remaining[key][sig]:
          continue
        remaining[key][sig] -= 1
        selected.append(i)
        raw = v[ix[i]]
        pts = (raw[:, :3] / 100 + np.array(packet["origin"])).tolist()
        assert np.all(raw[:, 3:] == raw[0, 3:]), (
          "Source triangle has non-uniform colour"
        )
        lower = clip_polygon(pts, 1, CUT, False)
        upper = clip_polygon(pts, 1, CUT, True)
        for poly, counts in [(lower, lower_area), (upper, upper_area)]:
          for j in range(1, len(poly) - 1):
            counts[layer] += area([poly[0], poly[j], poly[j + 1]])
        for j in range(1, len(lower) - 1):
          complements[mode].triangle(
            [lower[0], lower[j], lower[j + 1]], paint.get(sig, tuple(raw[0, 3:]))
          )
      if selected:
        receipts.append(
          dict(
            tile=tile,
            mode=mode,
            kind=mesh["kind"],
            layer=layer,
            fingerprint=fingerprint(
              [mesh["positions"], mesh["colors"], mesh["indices"]]
            ),
            triangles=selected,
          )
        )
        selected_set = set(selected)
        untouched = [s for i, s in enumerate(sigs) if i not in selected_set]
        audit.append(
          dict(
            file=str(path.relative_to(ROOT)),
            tile=tile,
            mode=mode,
            meshIndex=mi,
            removed=len(selected),
            preserved=len(untouched),
            preservedSha256=hashlib.sha256(b"".join(untouched)).hexdigest(),
          )
        )
        originals[str(path.relative_to(ROOT))] = sha(path)
  assert all(not +c for c in remaining.values()), [
    (k, sum(c.values()), totals[k]) for k, c in remaining.items() if +c
  ]
  target = [{**owner, "parts": [tower]}]
  neighbours = [
    {**r, "parts": [p for p in r["parts"] if p["id"] != PART]}
    for r in records
    if r["category"] == "core"
  ]
  lower_lines = []
  for mode, tile, path, layer in packet_paths():
    if mode != "drawn" or layer != "drawn":
      continue
    packet = read(path)
    if not packet.get("lines"):
      continue
    x, y, z = packet["origin"]
    obsolete = line_signatures(
      edges(target), (x, z, x + 512, z + 512), y
    ) - line_signatures(edges(neighbours), (x, z, x + 512, z + 512), y)
    line = packet["lines"]
    values = np.frombuffer(base64.b64decode(line["positions"]), "<u2").reshape(-1, 2, 3)
    selected = []
    for i, pair in enumerate(values):
      if tuple(sorted(tuple(q) for q in pair)) not in obsolete:
        continue
      a, b = (pair / 100 + np.array(packet["origin"])).tolist()
      if max(a[1], b[1]) <= CUT + 0.001:
        continue
      selected.append(i)
      if min(a[1], b[1]) < CUT:
        if a[1] > b[1]:
          a, b = b, a
        t = (CUT - a[1]) / (b[1] - a[1])
        c = [a[j] + t * (b[j] - a[j]) for j in range(3)]
        lower_lines.append([a, c])
    if selected:
      line_receipts.append(
        dict(
          tile=tile,
          mode=mode,
          fingerprint=fingerprint([line["positions"], line.get("colors", "")]),
          segments=selected,
        )
      )
      originals[str(path.relative_to(ROOT))] = sha(path)
  return (
    receipts,
    line_receipts,
    {m: p.payload("golgatha-v270-source-complements") for m, p in complements.items()},
    lower_lines,
    dict(
      audit=audit,
      originals=originals,
      clippedLowerAreaM2=dict(lower_area),
      replacedUpperAreaM2=dict(upper_area),
      colourAudit=colour_audit,
      colourPolicy="Exact original source-masonry vertices only; positions/indices/roof/window colours unchanged. A vertex incident to any non-masonry or foreign triangle is excluded.",
    ),
    dict(schemaVersion=1, palette=palette, packets=colour_packets),
  )


def round_arch(u, low, high, width):
  r = width / 2
  spring = high - r
  return Polygon(
    [
      (u - r, low),
      (u + r, low),
      (u + r, spring),
      *[
        (u + r * math.cos(a), spring + r * math.sin(a))
        for a in np.linspace(0, math.pi, 13)
      ],
    ]
  )


def upper_model(tower):
  ring = tower["footprintPolygons"][0]["ring"]
  # Reuse the established independent world-cardinal tessellator, with a local
  # palette for this offline process. No rendered v269 object is reused.
  church_helpers.BRICK, church_helpers.COPPER, church_helpers.ROOF = BRICK, SLATE, SLATE
  church = church_helpers.Church(
    dict(key="golgatha", height=TOP - 5.2),
    [dict(ring=ring, holes=[], surfaces=[])],
    5.2,
  )
  poly = Polygon(ring)
  rect = list(poly.minimum_rotated_rectangle.exterior.coords)[:-1]
  centre = np.array(poly.centroid.coords[0])
  a = np.array(rect[0])
  b = np.array(rect[1])
  d = (b - a) / np.linalg.norm(b - a)
  n = np.array([-d[1], d[0]])

  def world(u, v):
    return (centre + d * u + n * v).tolist()

  # Source-matched belfry walls; only upper dimensions are photo estimates.
  church.loft(ring, CUT, 39.4, 1, BRICK)
  faces = []
  principal = list(poly.simplify(0.05).exterior.coords)[:-1]
  assert len(principal) == 4
  for a, b in zip(principal, principal[1:] + principal[:1]):
    if math.dist(a, b) < 3:
      continue
    q = [[a[0], CUT, a[1]], [b[0], CUT, b[1]], [b[0], 39.4, b[1]], [a[0], 39.4, a[1]]]
    faces.append(dict(kind="WallSurface", rings=[q]))
  # Four straight clock gables over the four principal source wall directions.
  gables = []
  for a, b in zip(rect, rect[1:] + rect[:1]):
    mid = (np.array(a) + np.array(b)) / 2
    q = [[a[0], 39.4, a[1]], [b[0], 39.4, b[1]], [mid[0], 43.6, mid[1]]]
    church.face(q, BRICK)
    # A narrow sloped roof behind each gable closes it into the helm.
    inner = centre + (mid - centre) * 0.78
    church.face([q[0], q[2], [inner[0], 42.4, inner[1]]], SLATE, True)
    church.face([q[2], q[1], [inner[0], 42.4, inner[1]]], SLATE, True)
    gables.append(dict(kind="WallSurface", rings=[q]))
  # Chamfered four-sided steep slate helm, corner pinnacles, metal tip.
  helm = [
    world(u, v)
    for u, v in [
      (-3.35, -2.5),
      (-2.5, -3.35),
      (2.5, -3.35),
      (3.35, -2.5),
      (3.35, 2.5),
      (2.5, 3.35),
      (-2.5, 3.35),
      (-3.35, 2.5),
    ]
  ]
  church.loft(helm, 39.4, 64.9, 0.045, SLATE)
  small = [(centre + (np.array(p) - centre) * 0.90).tolist() for p in rect]
  for cx, cz in small:
    r = [
      [cx + d[0] * u + n[0] * v, cz + d[1] * u + n[1] * v]
      for u, v in [(-0.65, -0.65), (0.65, -0.65), (0.65, 0.65), (-0.65, 0.65)]
    ]
    church.loft(r, 39.4, 47.1, 0, SLATE)
  tip = [
    [centre[0] - 0.18, centre[1] - 0.18],
    [centre[0] + 0.18, centre[1] - 0.18],
    [centre[0] + 0.18, centre[1] + 0.18],
    [centre[0] - 0.18, centre[1] + 0.18],
  ]
  church.loft(tip, 64.8, TOP, 0, (147, 153, 145))
  church.raster()
  # Preserve the slender terminal in the independent cardinal representation.
  peak = (math.floor(centre[0] / CELL), math.floor(centre[1] / CELL))
  old_peak = church.cells[peak]
  church.cells[peak] = TOP
  church.native.building(
    box(peak[0] * CELL, peak[1] * CELL, (peak[0] + 1) * CELL, (peak[1] + 1) * CELL),
    old_peak,
    TOP,
  )
  for s in faces:
    _, _, _, _, length = church_helpers.frame(s)
    for u in [length * 0.35, length * 0.65]:
      shape = round_arch(u, 33.55, 38.1, 1.7)
      church.fitting(s, shape.buffer(0.15), CREAM, "paired belfry arch surround", 0.055)
      church.fitting(s, shape, DARK, "paired belfry arch", 0.085)
      for y in np.arange(33.8, 37.4, 0.36):
        church.fitting(
          s,
          shape.intersection(box(u - 1, y, u + 1, y + 0.065)),
          (111, 96, 78),
          "belfry louvres",
          0.12,
        )
  for s in gables:
    _, _, _, _, length = church_helpers.frame(s)
    u = length / 2
    y = 40.65
    church.fitting(s, Point(u, y).buffer(0.95, quad_segs=16), DARK, "clock rim", 0.08)
    church.fitting(
      s, Point(u, y).buffer(0.78, quad_segs=16), CREAM, "clock face", 0.105
    )
    church.fitting(
      s, box(u - 0.055, y - 0.06, u + 0.055, y + 0.58), DARK, "clock minute hand", 0.135
    )
    church.fitting(
      s,
      Polygon(
        [
          (u - 0.06, y - 0.04),
          (u + 0.42, y - 0.31),
          (u + 0.48, y - 0.22),
          (u + 0.05, y + 0.05),
        ]
      ),
      DARK,
      "clock hour hand",
      0.135,
    )
  # The reused tessellator fills to datum. Only the new upper volume is emitted;
  # original v169 lower faces are exact packet fragments, never revoxelized.
  packed = church.native.payload("upper-native")
  v = vertices(packed)
  ix = np.frombuffer(base64.b64decode(packed["indices"]), "<u4").reshape(-1, 3)
  native = LinearMesh(church.origin[0], church.origin[2])
  for raw in v[ix]:
    pts = (raw[:, :3] / 100 + np.array(church.origin)).tolist()
    clipped = clip_polygon(pts, 1, CUT, True)
    colour = tuple(raw[0, 3:])
    for j in range(1, len(clipped) - 1):
      native.triangle([clipped[0], clipped[j], clipped[j + 1]], colour)
  return (
    church,
    church.drawn.payload("golgatha-v270-upper"),
    native.payload("golgatha-v270-upper-native"),
    dict(centre=centre.tolist(), axis=d.tolist(), cornerPinnacles=small),
  )


def build():
  records, owner, tower, models, nav = source_model()
  church, drawn, native, frame = upper_model(tower)
  receipts, lines, complements, lower_lines, audit, colours = transfers(
    records, owner, tower, models, church.origin
  )
  payload = dict(
    schema=1,
    origin=church.origin,
    drawn=[complements["drawn"], drawn],
    native=[complements["minecraft"], native],
    lowerLines=lower_lines,
  )
  write(DATA / "golgathaV270.json", payload)
  write(DATA / "golgathaV270Colours.json", colours)
  write(
    DATA / "golgathaV270Previous.json",
    dict(
      schema=1,
      owner=OWNER,
      part=PART,
      previousNavigationPart=nav,
      records=receipts,
      lineRecords=lines,
    ),
  )
  profile = dict(
    schema=1,
    owner=OWNER,
    part=PART,
    groundY=5.2,
    cutY=CUT,
    topY=TOP,
    nativeCellM=CELL,
    drawnFootprint=tower["footprintPolygons"][0],
    nativeFootprints=[
      church_helpers.polygon_record(p)
      for p in church_helpers.polygons(church.native_footprint)
    ],
    roofTriangles=church.roofs,
    nativeColumns=[[int(x), int(z), h] for (x, z), h in sorted(church.cells.items())],
    **frame,
    metrics=dict(
      drawnTriangles=sum(
        len(base64.b64decode(p["indices"])) // 12 for p in payload["drawn"]
      ),
      nativeTriangles=sum(
        len(base64.b64decode(p["indices"])) // 12 for p in payload["native"]
      ),
      drawCalls=3,
      nativeDrawCalls=2,
    ),
  )
  write(DATA / "golgathaV270Profile.json", profile)
  write(
    GEO / "golgatha-v270-evidence.json.gz",
    dict(
      schema=1,
      originalOwner=owner,
      sourceFile=str(SOURCE.relative_to(ROOT)),
      sourceSha256=sha(SOURCE),
      geometryPolicy="Only full-owner exact encoded triangles intersecting y>33.2 yield; their y<=33.2 complements retain all source positions. Source-bound masonry-only colour correction is separately receipted; all other colours remain. Other seven parts keep every original sheet. Original bytes remain immutable.",
      cutY=CUT,
      topY=TOP,
      heightStatus="61m above unchanged source datum: published overall-height context and current-photo proportions; all added sublevels are photo estimates, not measured heights.",
      sourceTriangleReceipts=receipts,
      sourceLineReceipts=lines,
      roles=dict(church.roles),
      metrics=profile["metrics"],
      **audit,
    ),
  )
  print(
    json.dumps(
      dict(
        receipts=[
          dict(mode=r["mode"], layer=r["layer"], count=len(r["triangles"]))
          for r in receipts
        ],
        ink=sum(len(r["segments"]) for r in lines),
        metrics=profile["metrics"],
        origin=church.origin,
        centre=frame["centre"],
        runtimeBytes=(DATA / "golgathaV270.json").stat().st_size,
      )
    )
  )


if __name__ == "__main__":
  build()
