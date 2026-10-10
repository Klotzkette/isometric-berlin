"""Step 10: shallow, measured-plane detail for the Kapelle-Ufer ministry.

The ten delivered LoD2 owners remain the sole building shells. No source owner,
court, ground, tree or native column is removed by this additive supplement.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from statistics import median

import geopandas as gpd
import numpy as np
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, Point, Polygon, box, mapping
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_breitscheid_towers_v161 import normal_of

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/app/src/data"
PARENT = "DEBE01YYK00005iG"
PORTICO = "DEBE01YYK0001xGY"
MAIN = "DEBE3DvYGtxhg1Aq"
ENTRY = "DEBE3DBlrT1zM4av"
SCREENS = {
  "DEBE3Dl10HCH67YQ",
  "DEBE3DQYkj2kXcNG",
  "DEBE3DtlPX6C0SWB",
  "DEBE3Dd2A3JNOhIR",
}
GREEN, GLASS, PALE, MINT, BRONZE, DARK = (
  0x8C9E91,
  0x637E7D,
  0xADB9AE,
  0x8DBBAA,
  0xA59A79,
  0x34494B,
)


def polygons(geometry: object) -> list[Polygon]:
  """Flatten a clipped planar geometry without joining separate openings."""
  if isinstance(geometry, Polygon):
    return [geometry] if geometry.area > 0.0001 else []
  return [p for g in getattr(geometry, "geoms", []) for p in polygons(g)]


def build(root: Path = ROOT) -> tuple[dict, dict]:
  """Create exact attachment receipts and one bounded static detail batch."""
  source_path = root / "geo_data/regierungsviertel/raw/lod2/LoD2_389_5820.zip"
  prism_path = root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  voxel_path = root / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  osm_path = root / "geo_data/regierungsviertel/osm.gpkg"
  parent = extract_parent(source_path, PARENT)
  source_parts = [part_profile(p) for p in leaf_building_parts(parent)]
  source_parts.append(part_profile(extract_parent(source_path, PORTICO)))
  legacy = {p["id"]: p for p in json.loads(prism_path.read_text())["buildings"]}
  parts, owners = [], []
  shapes = []
  for p in source_parts:
    old = legacy[p["id"][-8:]]
    dy = old["y0_dm"] / 10 - p["ground_y_m"]
    shape = Polygon(p["ring"], p["holes"])
    shapes.append(shape)
    parts.append(
      dict(
        **p,
        legacyPrism=old,
        sourceYTranslationM=round(dy, 6),
        placedSurfaces=[
          dict(
            kind=s["kind"],
            rings=[[[x, round(y + dy, 3), z] for x, y, z in r] for r in s["rings"]],
          )
          for s in p["surfaces"]
        ],
      )
    )
    owners.append(
      dict(
        id=p["id"],
        parentId=PORTICO if p["id"] == PORTICO else PARENT,
        anchor=list(shape.centroid.coords)[0],
        groundY=old["y0_dm"] / 10,
        topY=round(p["top_y_m"] + dy, 3),
      )
    )
  pois = gpd.read_file(osm_path, layer="pois")
  ministry = pois[(pois.element == "way") & (pois.id == "1302352107")].iloc[0]
  receipt = dict(
    schemaVersion=1,
    sourceParentId=PARENT,
    sourcePorticoId=PORTICO,
    sourceUrl="https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5820.zip",
    sourceCreated="2026-03-02",
    sourceLicense="dl-de/zero-2-0",
    sourceParts=parts,
    osmIdentity=dict(
      id="way/1302352107",
      name=ministry["name"],
      sourceUrl="https://www.openstreetmap.org/way/1302352107",
      license="ODbL-1.0",
      geometryEpsg25833=mapping(ministry.geometry),
    ),
    retainedInputs={
      str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in [source_path, prism_path, voxel_path, osm_path]
    },
    policy="All ten ministry leaves plus the independent complete entrance portico owner stay rendered. Only shallow attachments. No filled court, new ground, tree, navigation barrier, or owner/voxel suppression.",
    estimates="Window and fin pitch, colours, panel distribution, entrance subdivisions, roof photovoltaic divisions, and native attachment clearance are reference-guided display estimates, not surveyed apertures or equipment locations.",
  )
  boxes, surfaces, faces = [], [], []

  def add_box(
    q: list, size: list, yaw: float, color: int, role: int, oi: int, fi: int
  ) -> None:
    boxes.append([*[round(float(v), 5) for v in [*q, *size, yaw]], color, role, oi, fi])

  for oi, part in enumerate(parts):
    for si, sheet in enumerate(part["placedSurfaces"]):
      if sheet["kind"] != "WallSurface":
        continue
      ring = np.asarray(sheet["rings"][0])
      n3 = normal_of(ring.tolist())
      if abs(n3[1]) > 0.01:
        continue
      a, b = max(
        ((a, b) for a in ring for b in ring),
        key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
      )
      a, b = a[[0, 2]], b[[0, 2]]
      length = float(np.linalg.norm(b - a))
      if length < 0.75:
        continue
      d, n = (b - a) / length, n3[[0, 2]]
      if shapes[oi].contains(Point(*((a + b) / 2 + n * 0.12))):
        n = -n
      yaw = math.atan2(-d[1], d[0])
      planar = [
        [[float((np.array([x, z]) - a) @ d), y] for x, y, z in r]
        for r in sheet["rings"]
      ]
      local = Polygon(planar[0], planar[1:]).buffer(0)
      # Subtract neighbouring leaves only from this shallow attachment layer.
      # The retained source itself is never modified or conditionally omitted.
      check_line = LineString([a + n * 0.2, b + n * 0.2])
      for other, shape in enumerate(shapes):
        if other == oi:
          continue
        hit = check_line.intersection(shape)
        spans = [hit] if hit.geom_type == "LineString" else getattr(hit, "geoms", [])
        for span in spans:
          if span.geom_type != "LineString" or span.length < 0.01:
            continue
          us = [float((np.asarray(p) - a) @ d) for p in span.coords]
          local = local.difference(
            box(min(us) - 0.02, -50, max(us) + 0.02, owners[other]["topY"] + 0.025)
          )
      if local.is_empty or local.area < 0.4:
        continue
      fi = len(faces)
      face = dict(
        owner=oi,
        sourceSurface=si,
        a=a.tolist(),
        direction=d.tolist(),
        normal=n.tolist(),
        exposedPolygons=[mapping(p) for p in polygons(local)],
      )
      faces.append(face)
      screen = part["id"] in SCREENS
      entry_front = part["id"] == PORTICO and float(n @ [-0.63, 0.77]) > 0.95
      color = DARK if screen else GLASS if part["id"] != MAIN else GREEN

      def world(u: float, y: float, out: float) -> list:
        # The legacy generic window layer protrudes beyond the quantized shell.
        # A 28 cm attachment allowance keeps the reference facade visible while
        # preserving the complete earlier source and ornament underneath it.
        q = a + d * u + n * (out + 0.28)
        return [round(q[0], 5), round(y, 5), round(q[1], 5)]

      triangles = []
      for poly in polygons(local):
        for triangle in constrained_delaunay_triangles(poly).geoms:
          triangles.append(
            [world(u, y, 0.055) for u, y in list(triangle.exterior.coords)[:3]]
          )
      surfaces.append(dict(triangles=triangles, color=color, owner=oi, face=fi))

      def emit(
        u: float,
        y: float,
        w: float,
        h: float,
        tint: int,
        role: int,
        depth: float = 0.12,
        out: float = 0.16,
      ) -> None:
        if not local.buffer(-0.015).covers(
          box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
        ):
          return
        add_box(world(u, y, out), [w, h, depth], yaw, tint, role, oi, fi)

      ground = owners[oi]["groundY"]
      if screen:
        # Four retained technical bars sit above the common eaves; use dark
        # mesh-like panel divisions only where their source walls are exposed.
        for u in np.arange(0.3, length, 1.3):
          for y in np.arange(ground + 24.8, owners[oi]["topY"] - 0.2, 0.7):
            emit(u, y, 0.075, 0.62, 0x768C86, 5)
        continue
      if part["id"] != MAIN:
        pitch = 4.3 if entry_front else 1.6
        count = max(1, round(length / pitch))
        for bay in range(count):
          u = (bay + 0.5) * length / count
          h = (
            min(8.6, owners[oi]["topY"] - ground - 0.25)
            if entry_front
            else min(owners[oi]["topY"] - ground - 0.6, 9)
          )
          emit(
            u,
            ground + h / 2 + 0.2,
            0.48 if entry_front else 0.11,
            h,
            GREEN if entry_front else PALE,
            4,
            0.40 if entry_front else 0.18,
            0.24,
          )
          if entry_front:
            emit(
              u + 0.9,
              ground + 1.65,
              min(1.35, length / count * 0.34),
              2.6,
              0x24464C,
              6,
              0.16,
              0.25,
            )
        for y in [ground + 4.4, owners[oi]["topY"] - 0.25]:
          emit(
            length / 2,
            y,
            length - 0.08,
            0.12 if not entry_front else 0.45,
            GREEN if entry_front else PALE,
            4,
            0.25,
            0.22,
          )
        continue
      # Ground storey: wider bronze-framed apertures. Five upper office rows
      # have alternating glass / pale green ventilation panels and stone fins.
      count = max(1, round(length / 1.55))
      pitch = length / count
      for bay in range(count):
        u = (bay + 0.5) * pitch
        for floor in range(5):
          y = ground + 6.35 + floor * 4.12
          emit(u, y, pitch * 0.70, 3.31, GLASS, 1, 0.08, 0.11)
          emit(
            u + pitch * 0.26,
            y,
            pitch * 0.18,
            3.27,
            MINT if (bay + floor + si) % 3 else PALE,
            2,
            0.08,
            0.18,
          )
          emit(u - pitch * 0.46, y, pitch * 0.17, 3.58, GREEN, 3, 0.27, 0.22)
          emit(u, y - 0.3, pitch * 0.50, 0.06, BRONZE, 3, 0.10, 0.21)
        if bay % 2 == 0:
          w, y = min(pitch * 1.3, 2.2), ground + 2.75
          emit(u, y, w, 1.92, GLASS, 1)
          for side in [-1, 1]:
            emit(u + side * (w / 2 + 0.06), y, 0.08, 2.10, BRONZE, 3, 0.16, 0.24)
            emit(u, y + side * 1.03, w + 0.15, 0.07, BRONZE, 3, 0.16, 0.24)
      for y in [ground + 4.34 + k * 4.12 for k in range(6)]:
        emit(length / 2, y, length - 0.08, 0.27, GREEN, 3, 0.23, 0.19)

  # Roof panels are small subdivisions of the four existing measured technical
  # roofs. No new rooftop volume or court canopy is invented.
  for oi, part in enumerate(parts):
    if part["id"] not in SCREENS:
      continue
    for sheet in part["placedSurfaces"]:
      if sheet["kind"] != "RoofSurface":
        continue
      ring = np.asarray(sheet["rings"][0])
      if np.ptp(ring[:, 1]) > 0.02:
        continue
      plan = Polygon(ring[:, [0, 2]])
      for x in np.arange(plan.bounds[0] + 1, plan.bounds[2], 2.7):
        for z in np.arange(plan.bounds[1] + 1, plan.bounds[3], 3.1):
          if plan.buffer(-0.2).covers(box(x - 1.05, z - 1.25, x + 1.05, z + 1.25)):
            add_box([x, ring[0, 1] + 0.07, z], [2.1, 0.12, 2.5], 0, 0x3E555B, 7, oi, -1)

  # Two retained native sources overlap here: original 4 m columns and the
  # v169 complete source shell, sampled on a 2 m grid. Fit new surface detail
  # to their union; looking only at the older raster puts panes inside v169.
  voxel = json.loads(voxel_path.read_text())
  raster_cell, grid = voxel["cell_m"], voxel["grid"]
  transfer_path = root / "src/app/src/data/altMitteV169Navigation/packet-000.json"
  receipt["retainedInputs"][str(transfer_path.relative_to(root))] = hashlib.sha256(
    transfer_path.read_bytes()
  ).hexdigest()
  transfer_prisms = []
  for prism in json.loads(transfer_path.read_text()):
    shape = Polygon(
      [(x / 10, z / 10) for x, z in prism["ring"]],
      [[(x / 10, z / 10) for x, z in ring] for ring in prism.get("holes", [])],
    )
    if not shape.intersects(unary_union(shapes).buffer(12)):
      continue
    base = prism["y0_dm"] / 10
    transfer_prisms.append(
      (
        shape,
        base,
        base + math.ceil(prism["h_dm"] / 40) * 4,
        prism["roof"] in [3100, 3200, 3300, 3400],
      )
    )
  cell = 2
  all_shapes = unary_union(shapes)
  selection = all_shapes.buffer(2.85)
  columns, column_sources, raster_columns = {}, {}, []

  def merge_column(key: tuple, low: float, high: float, source: str) -> None:
    old = columns.get(key)
    columns[key] = [min(old[0], low), max(old[1], high)] if old else [low, high]
    column_sources.setdefault(key, set()).add(source)

  for iz, runs in enumerate(voxel["building_rows"]):
    z = (grid["min_z_idx"] + iz + 0.5) * raster_cell
    if not all_shapes.bounds[1] - 12 < z < all_shapes.bounds[3] + 12:
      continue
    for ix, count, lo, hi, _ in runs:
      for xindex in range(ix, ix + count):
        x = (grid["min_x_idx"] + xindex + 0.5) * raster_cell
        if not selection.covers(Point(x, z)):
          continue
        low, high = lo / 10, hi / 10
        # Match the unchanged runtime v169 owner transfer: local-terrain
        # columns that do not match the exact legacy base/top remain visible.
        transferred = any(
          (
            (abs(low - base) < 0.11 and abs(high - top) < 0.11)
            or (tier and abs(low - top) < 0.11 and abs(high - top - 4) < 0.11)
          )
          and shape.covers(Point(x, z))
          for shape, base, top, tier in transfer_prisms
        )
        raster_columns.append(
          dict(
            index=[math.floor(x / 4), math.floor(z / 4)],
            groundY=low,
            topY=high,
            transferredByExistingV169=transferred,
          )
        )
        if transferred:
          continue
        for dx in [-1, 1]:
          for dz in [-1, 1]:
            merge_column(
              (math.floor((x + dx) / cell), math.floor((z + dz) / cell)),
              low,
              high,
              "raster",
            )
  span_receipts = []
  for packet in [6, 7]:
    path = root / f"src/app/src/data/altMitteV169Navigation/packet-{packet:03}.json"
    receipt["retainedInputs"][str(path.relative_to(root))] = hashlib.sha256(
      path.read_bytes()
    ).hexdigest()
    for index, span in enumerate(json.loads(path.read_text())):
      x0, z0, x1, z1, high = span
      if (
        x1 < selection.bounds[0]
        or x0 > selection.bounds[2]
        or z1 < selection.bounds[1]
        or z0 > selection.bounds[3]
      ):
        continue
      used = False
      for x in range(x0, x1):
        for z in range(z0, z1):
          center = Point(x + 0.5, z + 0.5)
          if not selection.covers(center):
            continue
          oi = min(
            range(len(shapes)),
            key=lambda i: (shapes[i].distance(center), abs(owners[i]["topY"] - high)),
          )
          # Native sampling may extend at most one 2 m diagonal beyond the
          # exact named owner. Never take a neighbouring building's roof.
          low = math.floor((owners[oi]["groundY"] - 3) / 2) * 2 + 3
          merge_column(
            (math.floor(x / cell), math.floor(z / cell)), low, high, "altMitteV169"
          )
          used = True
      if used:
        span_receipts.append(dict(packet=packet, index=index, span=span))
  selected, native_columns = {}, []
  for key, levels in columns.items():
    ix, iz = key
    footprint = box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)
    overlaps = [footprint.intersection(p).area for p in shapes]
    center = footprint.centroid
    covered = [i for i, p in enumerate(shapes) if p.covers(center)]
    oi = (
      max(covered, key=lambda i: owners[i]["topY"])
      if covered
      else min(
        range(len(shapes)), key=lambda i: (shapes[i].distance(center), -overlaps[i])
      )
    )
    if max(overlaps) < 0.04 and "altMitteV169" not in column_sources[key]:
      continue
    selected[key] = (oi, *levels)
    native_columns.append(
      dict(
        index=list(key),
        owner=oi,
        groundY=levels[0],
        topY=levels[1],
        sourceOverlapAreaM2=round(overlaps[oi], 5),
        sourceDistanceM=round(all_shapes.distance(center), 5),
        sources=sorted(column_sources[key]),
      )
    )
  main_index = next(i for i, p in enumerate(owners) if p["id"] == MAIN)
  main_levels = [p for p in selected.values() if p[0] == main_index]
  main_ground = median(p[1] for p in main_levels)
  main_top = median(p[2] for p in main_levels)
  office_height = main_top - main_ground
  blocks, native_faces = [], []
  for (ix, iz), (oi, low, high) in selected.items():
    for axis, sign in [(0, -1), (0, 1), (1, -1), (1, 1)]:
      neighbour = columns.get(
        (ix + (sign if axis == 0 else 0), iz + (sign if axis == 1 else 0))
      )
      bottom = max(low, neighbour[1]) if neighbour else low
      if high - bottom < 0.08:
        continue
      center = [(ix + 0.5) * cell, (iz + 0.5) * cell]
      center[axis] += sign * cell / 2
      is_glass = owners[oi]["id"] not in SCREENS and oi != main_index
      native_faces.append(
        dict(index=[ix, iz], owner=oi, axis=axis, sign=sign, bottom=bottom, top=high)
      )

      def native_emit(
        u: float,
        y: float,
        width: float,
        height: float,
        color: int,
        role: int,
        out: float = 0.4,
        depth: float = 0.10,
      ) -> None:
        if y - height / 2 < bottom - 0.001 or y + height / 2 > high + 0.001:
          return
        q = list(center)
        q[axis] += sign * out
        q[1 - axis] += u
        w, d = (depth, width) if axis == 0 else (width, depth)
        blocks.append([q[0], y, q[1], w, height, d, color, role, oi])

      split = min(high, max(bottom, main_top))
      if split > bottom:
        native_emit(
          0,
          (bottom + split) / 2,
          cell + 0.12,
          split - bottom,
          GLASS if is_glass else GREEN,
          0,
          0.32,
          0.10,
        )
      if high > split:
        native_emit(
          0, (split + high) / 2, cell + 0.12, high - split, DARK, 0, 0.32, 0.10
        )
        for u in [-0.5, 0.5]:
          native_emit(u, (split + high) / 2, 0.10, high - split, PALE, 5, 0.43, 0.14)
      if is_glass:
        for u in [-0.9, 0.9]:
          native_emit(u, (bottom + high) / 2, 0.23, high - bottom, GREEN, 4, 0.45, 0.22)
        for y in np.arange(low + 3.7, high, 4.0):
          native_emit(0, y, cell, 0.15, PALE, 4, 0.46)
        if owners[oi]["id"] == PORTICO:
          for u in [0]:
            native_emit(u, low + 1.65, 1.25, 2.9, GLASS, 1, 0.45)
        continue
      for floor in range(5):
        y = main_ground + (6.35 + floor * 4.12) / 24.95 * office_height
        height = 3.31 / 24.95 * office_height
        for bay, u in enumerate([0]):
          native_emit(u, y, 1.39, height, GLASS, 1, 0.44)
          native_emit(
            u + 0.52,
            y,
            0.28,
            height,
            MINT if (ix + iz + floor + bay) % 3 else PALE,
            2,
            0.52,
          )
          native_emit(u - 0.80, y, 0.22, height + 0.20, GREEN, 3, 0.54, 0.24)
        native_emit(0, y - height / 2 - 0.12, cell, 0.25, GREEN, 3, 0.50, 0.18)
      for u in [0]:
        y = main_ground + 2.7 / 24.95 * office_height
        native_emit(u, y, 1.35, 2.05, GLASS, 1, 0.44)
        for side in [-1, 1]:
          native_emit(u + side * 0.72, y, 0.08, 2.16, BRONZE, 3, 0.53)
          native_emit(u, y + side * 1.05, 1.45, 0.08, BRONZE, 3, 0.53)
  for r in boxes:
    if r[8] != 7:
      continue
    x, _, z, w, h, d, _, color, role, oi, _ = r
    column = columns.get((math.floor(x / cell), math.floor(z / cell)))
    if column:
      blocks.append([x, column[1] + 0.09, z, w, h, d, color, role, oi])
  blocks = [
    [round(float(v), 5) if i < 6 else v for i, v in enumerate(r)] for r in blocks
  ]
  payload = dict(
    schemaVersion=1, owners=owners, surfaces=surfaces, boxes=boxes, blocks=blocks
  )
  receipt.update(
    faces=faces,
    roleNames={
      0: "native source-wall palette",
      1: "glazing",
      2: "alternating ventilation panels",
      3: "stone fins and bronze surrounds",
      4: "source-bound entrance/court glazing frames",
      5: "technical-roof screens",
      6: "entrance door subdivisions",
      7: "roof photovoltaic divisions",
    },
    nativeMaximumAttachmentShiftM=0.66,
    nativeCellM=cell,
    nativeRasterColumns=raster_columns,
    nativeAltMitteSpans=span_receipts,
    nativeColumns=native_columns,
    nativeFaces=native_faces,
    nativeOfficeDatum=dict(groundY=main_ground, topY=main_top),
    stats=dict(
      owners=len(owners),
      faces=len(faces),
      drawnBoxes=len(boxes),
      triangles=sum(len(s["triangles"]) for s in surfaces),
      nativeBlocks=len(blocks),
    ),
  )
  return payload, receipt


def main() -> None:
  """Write only the dedicated ministry artifacts."""
  payload, receipt = build()
  for name, value in [
    ("ministrySpreeV207.json", payload),
    ("ministrySpreeV207Evidence.json", receipt),
  ]:
    (OUT / name).write_text(
      json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
  print(receipt["stats"])


if __name__ == "__main__":
  main()
