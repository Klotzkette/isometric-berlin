"""Step 10: source-bound recognition detail for the two Staatsbibliothek houses.

No retained source mesh, owner, court, roof, navigation surface or prior ornament
is removed. All facade subdivisions and small components are display estimates.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import normal_of, triangles_for
from build_linden_corridor_v197 import merge_native_runs
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/app/src/data"
STONE, LIGHT, GLASS, GOLD, DARK = 0xD1C8AE, 0xE4DFCD, 0x65818A, 0xC4A363, 0x536064


def digest(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def sources() -> tuple[list[dict], dict]:
  """Keep the exact existing parent and all 56 individually aligned core leaves."""
  path = ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-390_5819-00.json.gz"
  udl = next(
    r
    for r in json.loads(gzip.decompress(path.read_bytes()))["buildings"]
    if r["id"] == "DEBE01YYK00002vr"
  )
  legacy_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  old = {p["id"]: p for p in json.loads(legacy_path.read_text())["buildings"]}
  tile = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_389_5818.zip"
  parent = extract_parent(tile, "DEBE01YYK0002PFp")
  parts = []
  for element in leaf_building_parts(parent):
    p = part_profile(element)
    legacy = old[p["id"][-8:]]
    dy = legacy["y0_dm"] / 10 - p["ground_y_m"]
    parts.append(
      dict(
        id=p["id"],
        groundY=legacy["y0_dm"] / 10,
        topY=p["top_y_m"] + dy,
        footprintPolygons=[dict(ring=p["ring"], holes=p["holes"])],
        sourceSheets=p["surfaces"],
        sourceYTranslationM=dy,
        legacyPrism=legacy,
        surfaces=[
          dict(
            kind=s["kind"],
            sourcePolygonId=f"{p['id']}:{i}",
            rings=[
              [[x, round(y + dy, 3), z] for x, y, z in ring] for ring in s["rings"]
            ],
          )
          for i, s in enumerate(p["surfaces"])
        ],
      )
    )
  ps = dict(
    id="DEBE01YYK0002PFp",
    name="Staatsbibliothek Potsdamer Straße",
    sourceUrl="https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5818.zip",
    sourceCreated="2026-03-02",
    license="dl-de/zero-2-0",
    groundY=5.2,
    parts=parts,
  )
  receipt = dict(
    schemaVersion=1,
    sourceRecords=[udl, ps],
    retainedInputs={
      str(p.relative_to(ROOT)): digest(p) for p in [path, tile, legacy_path]
    },
    policy="All prior source owners, geometry and motifs remain. Only shallow source-bound attachments; no new courtyard floor or collision barrier.",
  )
  return [udl, ps], receipt


def build() -> tuple[dict, dict]:
  """Freeze bounded static geometry and an independently quantized native form."""
  records, receipt = sources()
  owners, surfaces, boxes, faces = [], [], [], []
  part_shapes = {}
  for si, record in enumerate(records):
    for p in record["parts"]:
      fp = unary_union([Polygon(q["ring"], q["holes"]) for q in p["footprintPolygons"]])
      part_shapes[p["id"]] = fp
      owners.append(
        dict(
          id=p["id"],
          parentId=record["id"],
          site=si,
          anchor=list(fp.centroid.coords)[0],
          groundY=p["groundY"],
          topY=p["topY"],
        )
      )
  indices = {o["id"]: i for i, o in enumerate(owners)}
  roles = {
    1: "historic window and door glazing",
    2: "stone window surrounds and orders",
    3: "cornices and balustrade",
    4: "modern reading-room glass grid",
    5: "gold magazine panel joints",
    6: "low reading-room glazing and fins",
    7: "measured roof folds and daylight glazing",
    8: "Ehrenhof portico",
  }

  def surface(points: list, color: int, role: int, oi: int) -> None:
    if len(points) < 3:
      return
    surfaces.append(
      dict(triangles=triangles_for([points]), color=color, role=role, owner=oi)
    )

  def add_box(
    p: list | np.ndarray,
    size: list,
    yaw: float,
    color: int,
    role: int,
    normal: list | np.ndarray,
    oi: int,
  ) -> None:
    boxes.append(
      [
        *[round(float(v), 4) for v in p],
        *[round(float(v), 4) for v in size],
        round(yaw, 7),
        color,
        role,
        round(float(normal[0]), 6),
        round(float(normal[1]), 6),
        oi,
      ]
    )

  for si, record in enumerate(records):
    for part in record["parts"]:
      oi = indices[part["id"]]
      fp = part_shapes[part["id"]]
      for sn, s in enumerate(part["surfaces"]):
        if s["kind"] != "WallSurface":
          continue
        ring = np.array(s["rings"][0])
        n = normal_of(ring.tolist())
        if abs(n[1]) > 0.02:
          continue
        a, b = max(
          ((a, b) for a in ring for b in ring),
          key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
        )
        a = a[[0, 2]]
        b = b[[0, 2]]
        length = float(np.linalg.norm(b - a))
        if length < 2.4:
          continue
        d = (b - a) / length
        n = n[[0, 2]]
        if fp.contains(Point(*((a + b) / 2 + n * 0.12))):
          n = -n
        yaw = math.atan2(-d[1], d[0])
        local = Polygon(
          [
            [(float((np.array([p[0], p[2]]) - a) @ d), p[1]) for p in r]
            for r in s["rings"]
          ][0],
          [
            [(float((np.array([p[0], p[2]]) - a) @ d), p[1]) for p in r]
            for r in s["rings"][1:]
          ],
        )
        if not local.is_valid:
          local = local.buffer(0)
        lo, hi = ring[:, 1].min(), ring[:, 1].max()
        if hi - lo < 2.8:
          continue
        face_index = len(faces)
        faces.append(
          dict(
            owner=oi,
            sourcePolygonId=s.get("sourcePolygonId", str(sn)),
            rings=s["rings"],
            a=a.tolist(),
            d=d.tolist(),
            normal=n.tolist(),
          )
        )

        def clear(u: float, y: float, w: float, h: float) -> bool:
          if not local.buffer(-0.025).covers(
            box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
          ):
            return False
          for v in [u - w / 2, u, u + w / 2]:
            q = Point(*(a + d * v + n * 0.3))
            if any(
              other["id"] != part["id"]
              and other["topY"] > y - h / 2 + 0.1
              and part_shapes[other["id"]].contains(q)
              for other in record["parts"]
            ):
              return False
          return True

        def emit(
          u: float,
          y: float,
          w: float,
          h: float,
          color: int,
          role: int,
          depth: float = 0.15,
          out: float = 0.16,
        ) -> None:
          if clear(u, y, w, h):
            q = a + d * u + n * out
            add_box([q[0], y, q[1]], [w, h, depth], yaw, color, role, n, oi)

        modern = si == 0 and part["id"].endswith("uh0ZOkfL")
        magazine = si == 1 and part["id"].endswith("eVfooGWp")
        ground = part["groundY"]
        if modern:
          # Pale laminated-glass cube above the historic eaves, already measured.
          for u in np.arange(1.0, length, 2.05):
            for y in np.arange(ground + 20, hi - 0.8, 3.05):
              emit(u, y, 1.92, 2.88, 0xC9CCB2, 4, 0.12, 0.17)
              emit(u, y + 1.46, 1.96, 0.10, LIGHT, 4, 0.15, 0.25)
          continue
        if magazine:
          # The book stacks are largely blind: no invented curtain wall upstairs.
          for u in np.arange(0.6, length, 1.42):
            for y in np.arange(ground + 13, hi - 1, 5.4):
              emit(u, y, 0.09, 5.3, 0xAA8D53, 5, 0.13, 0.2)
          for y in [ground + 7.8, ground + 11.2]:
            for u in np.arange(1.2, length, 3.1):
              emit(u, y, 2.75, 2.3, DARK, 6)
          continue
        if si == 0:
          # Monumental storeys and smaller mezzanine windows share exact walls.
          pitch = 4.65
          for u in np.arange(pitch / 2, length, pitch):
            for y, w, h in [
              (ground + 2.1, 1.65, 2.7),
              (ground + 7.1, 1.9, 3.4),
              (ground + 11.0, 1.65, 1.3),
              (ground + 17.0, 2.05, 4.8),
              (ground + 22.3, 1.55, 1.15),
            ]:
              emit(u, y, w, h, GLASS, 1)
              for side in [-1, 1]:
                emit(u + side * (w / 2 + 0.10), y, 0.18, h + 0.27, STONE, 2, 0.23, 0.23)
              emit(u, y - h / 2 - 0.10, w + 0.46, 0.20, LIGHT, 2, 0.34, 0.25)
              emit(u, y, 0.085, h, LIGHT, 2, 0.16, 0.27)
              if h > 2:
                emit(u, y + 0.38, w, 0.09, LIGHT, 2, 0.16, 0.27)
          for y in [ground + 4.1, ground + 12.25, ground + 23.8]:
            emit(length / 2, y, length - 0.08, 0.27, LIGHT, 3, 0.37, 0.25)
        else:
          # Low public wings: deep vertical fins and narrow glazed bands.
          for y in np.arange(ground + 4.2, min(hi - 1.1, ground + 16), 4.0):
            for u in np.arange(1.25, length, 2.5):
              emit(u, y, 2.15, 2.65, GLASS, 6)
              emit(u + 1.08, y, 0.17, 3.1, LIGHT, 6, 0.37, 0.25)
          emit(length / 2, hi - 0.35, length - 0.12, 0.32, LIGHT, 6, 0.3, 0.22)
        faces[face_index]["detailCount"] = len(boxes)

      # Source roof perimeter ribs retain all actual folds, steps and courts.
      for s in part["surfaces"]:
        if s["kind"] != "RoofSurface":
          continue
        ring = np.asarray(s["rings"][0])
        normal = normal_of(ring.tolist())
        if normal[1] < 0:
          normal = -normal
        roofpoly = Polygon(ring[:, [0, 2]])
        if roofpoly.is_empty or not roofpoly.is_valid or roofpoly.area < 8:
          continue
        # Small source roof planes on the reading-room roofs read as daylight
        # facets. Large archive roof faces remain their earlier pale palette.
        glass_roof = si == 1 and part["id"].endswith(
          ("TS3BB1Uj", "Ti8tLd7Z", "uL4bKIKU")
        )
        for aa, bb in zip(ring, np.roll(ring, -1, axis=0), strict=True):
          dd = bb - aa
          flat = np.linalg.norm(dd[[0, 2]])
          if flat < 2:
            continue
          q = np.array([-dd[2], 0, dd[0]]) / flat * 0.075
          points = [
            (aa + q + normal * 0.06).tolist(),
            (bb + q + normal * 0.06).tolist(),
            (bb - q + normal * 0.06).tolist(),
            (aa - q + normal * 0.06).tolist(),
          ]
          surface(points, LIGHT if si else 0x777D74, 7, oi)
        if glass_roof and 0.15 < normal[1] < 0.98 and roofpoly.area < 330:
          surface((ring + normal * 0.045).tolist(), 0x9DADB0, 7, oi)

  # Ihne's court portico: independently authored columns and one large arched
  # window, aligned with the surveyed recessed wall and below its source top.
  oi = indices["DEBE3Di3VeB8rUHf"]
  a = np.array([1354.9, 151.58])
  b = np.array([1371.95, 150.21])
  d = (b - a) / np.linalg.norm(b - a)
  n = np.array([-d[1], d[0]])
  yaw = math.atan2(-d[1], d[0])
  mid = (a + b) / 2

  def portal_box(
    u: float, y: float, w: float, h: float, depth: float, color: int
  ) -> None:
    q = mid + d * u + n * 0.55
    add_box([q[0], y, q[1]], [w, h, depth], yaw, color, 8, n, oi)

  for u in [-7.2, -4.25, 4.25, 7.2]:
    portal_box(u, 11.0, 1.95, 0.60, 1.0, STONE)
    portal_box(u, 29.9, 2.0, 0.62, 1.1, LIGHT)
    for k in range(12):
      t0 = k * math.tau / 12
      t1 = (k + 1) * math.tau / 12
      points = []
      for y, rr, t in [
        (11.3, 0.70, t0),
        (11.3, 0.70, t1),
        (29.55, 0.54, t1),
        (29.55, 0.54, t0),
      ]:
        q = mid + d * (u + rr * math.cos(t)) + n * (0.55 + rr * math.sin(t))
        points.append([q[0], y, q[1]])
      surface(points, STONE, 8, oi)
  for y, h, w in [(30.55, 0.7, 18.0), (31.5, 0.8, 18.3), (32.25, 0.25, 18.8)]:
    portal_box(0, y, w, h, 0.95, LIGHT)
  # The large opening is on the upper court wall. Ground-level doors stay clear.
  for k in range(18):
    t0 = k * math.pi / 18
    t1 = (k + 1) * math.pi / 18
    points = []
    for t, rr in [(t0, 3.10), (t1, 3.10), (t1, 3.42), (t0, 3.42)]:
      q = mid + d * (rr * math.cos(t)) + n * 0.20
      points.append([q[0], 25.2 + rr * math.sin(t), q[1]])
    surface(points, LIGHT, 8, oi)
  for u in [-3.24, 3.24]:
    portal_box(u, 19.5, 0.28, 11.4, 0.42, LIGHT)
  portal_box(0, 19.5, 6.1, 11.3, 0.13, GLASS)
  for u in [-2.1, -1.05, 0, 1.05, 2.1]:
    portal_box(u, 20.0, 0.10, 12.2, 0.30, LIGHT)
  for y in [15.2, 18.0, 20.8, 23.6, 25.2]:
    portal_box(0, y, 6.1, 0.10, 0.30, LIGHT)
  for side in [-1, 1]:
    points = []
    for u, y in [(side * 9.35, 32.30), (0, 37.15), (0, 36.72), (side * 9.35, 31.87)]:
      q = mid + d * u + n * 0.65
      points.append([q[0], y, q[1]])
    surface(points, LIGHT, 8, oi)

  # Native cells are authored once on an orthogonal lattice, then coalesced
  # only where same-colour/owner cells touch. No rotated smooth detail survives.
  cells = {}
  voxel_path = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  voxel = json.loads(voxel_path.read_text())
  receipt["retainedInputs"][str(voxel_path.relative_to(ROOT))] = digest(voxel_path)
  cell = voxel["cell_m"]
  grid = voxel["grid"]
  legacy_columns = {}
  source_fp = unary_union([part_shapes[p["id"]] for p in records[1]["parts"]])
  for iz, runs in enumerate(voxel["building_rows"]):
    z = (grid["min_z_idx"] + iz + 0.5) * cell
    if not 1130 < z < 1410:
      continue
    for ix, count, low, top, _ in runs:
      for k in range(ix, ix + count):
        x = (grid["min_x_idx"] + k + 0.5) * cell
        if source_fp.covers(Point(x, z)):
          legacy_columns[(math.floor(x / cell), math.floor(z / cell))] = (
            low / 10,
            top / 10,
          )

  def put(
    p: np.ndarray | list,
    color: int,
    role: int,
    oi: int,
    normal: tuple[float, float] | None = None,
  ) -> None:
    p = np.array(p, dtype=float)
    if owners[oi]["site"] == 1:
      # Attach to the already drawn block face when source quantisation hides
      # a fine facade. This changes only native presentation; no voxel is cut.
      column = legacy_columns.get((math.floor(p[0] / cell), math.floor(p[2] / cell)))
      if column and column[0] <= p[1] < column[1]:
        if normal is not None:
          exits = []
          for axis, direction in [(0, normal[0]), (2, normal[1])]:
            if abs(direction) > 0.001:
              edge = (math.floor(p[axis] / cell) + (1 if direction > 0 else 0)) * cell
              exits.append((edge - p[axis]) / direction)
          distance = min(exits) + 0.6
          p += np.array([normal[0], 0, normal[1]]) * distance
        elif role == 7 and column[1] - p[1] <= cell + 0.05:
          p[1] = column[1] + 0.4
    key = (oi, *(math.floor(float(v) / 0.75) for v in p))
    cells[key] = (color, role)

  for x, y, z, w, h, depth, yaw, color, role, nx, nz, oi in boxes:
    if min(w, h) < 0.16 and role not in [5, 8]:
      continue
    for u in np.arange(-w / 2 + 0.08, w / 2, 0.52):
      for v in np.arange(-h / 2 + 0.08, h / 2, 0.52):
        put(
          [x + math.cos(yaw) * u + nx * 1.25, y + v, z - math.sin(yaw) * u + nz * 1.25],
          color,
          role,
          oi,
          (nx, nz),
        )
  for s in surfaces:
    for t in s["triangles"]:
      a, b, c = np.array(t)
      steps = max(1, math.ceil(max(np.linalg.norm(b - a), np.linalg.norm(c - a)) / 0.5))
      for i in range(steps + 1):
        for j in range(steps + 1 - i):
          put(
            a + (b - a) * i / steps + (c - a) * j / steps,
            s["color"],
            s["role"],
            s["owner"],
          )
  blocks = []
  for oi in range(len(owners)):
    columns = {}
    for (own, x, y, z), (color, role) in cells.items():
      if own == oi:
        columns.setdefault((x, z, color, role), []).append(y)
    rows = []
    for (x, z, color, role), ys in sorted(columns.items()):
      ys.sort()
      start = end = ys[0]
      for v in [*ys[1:], None]:
        if v is not None and v == end + 1:
          end = v
          continue
        rows.append(
          [
            (x + 0.5) * 0.75,
            (start + end + 1) * 0.375,
            (z + 0.5) * 0.75,
            color,
            0.75,
            role,
            (end - start + 1) * 0.75,
            0.75,
          ]
        )
        start = end = v
    blocks += [r + [oi] for r in merge_native_runs(rows)]
  payload = dict(
    schemaVersion=1, owners=owners, surfaces=surfaces, boxes=boxes, blocks=blocks
  )
  receipt.update(
    faces=faces,
    roles=roles,
    stats=dict(
      owners=len(owners),
      drawnBoxes=len(boxes),
      triangles=sum(len(s["triangles"]) for s in surfaces),
      nativeBlocks=len(blocks),
    ),
    estimates="Window axes, orders, portico components, glazing, rib widths, colours and native cell sizes are procedural estimates. Source planes/roofs, footprints, courtyards, individual legacy datums remain exact retained evidence.",
  )
  return payload, receipt


def main() -> None:
  payload, receipt = build()
  for name, value in [
    ("librariesV202.json", payload),
    ("librariesV202Evidence.json", receipt),
  ]:
    (OUT / name).write_text(
      json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
  print(receipt["stats"])


if __name__ == "__main__":
  main()
