"""Step 10: shallow, additive WZB and Potsdamer park-side facade details.

The original source bodies, windows, atrium roofs and navigation remain owned by
their existing layers. Local frame/course dimensions are visual estimates.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import normal_of
from shapely.geometry import LineString, Point, Polygon, box

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/app/src/data"
TARGETS = [
  ("DEBE01YYK0002MPZ", "WZB postmodern extension", "388_5818"),
  ("DEBE00YYWk0000CB", "Potsdamer park-side south office atrium", "389_5818"),
  ("DEBE00YYWk0000CD", "Potsdamer park-side north office atrium", "389_5818"),
  ("DEBE01YYK0002KuQ", "Potsdamer south main street envelope", "389_5818"),
  ("DEBE01YYK0002KOK", "Potsdamer north main street envelope", "389_5818"),
  ("DEBE00YYWk0000Bd", "Potsdamer north retained street facade parts", "389_5818"),
  ("DEBE00YYWk0000Bb", "Potsdamer south retained street facade part", "389_5818"),
]


def digest(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, data: dict) -> None:
  raw = (json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def build() -> None:
  """Keep all source records and generate only bounded exterior attachments."""
  prism_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  voxel_path = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  prisms = json.loads(prism_path.read_text())["buildings"]
  by_id = {p["id"]: p for p in prisms}
  source, owners, boxes, faces = [], [], [], []
  inputs = {str(p.relative_to(ROOT)): digest(p) for p in [prism_path, voxel_path]}
  for site, (pid, name, tile) in enumerate(TARGETS):
    archive = ROOT / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip"
    inputs[str(archive.relative_to(ROOT))] = digest(archive)
    parent = extract_parent(archive, pid)
    leaves = list(leaf_building_parts(parent)) or [parent]
    parts = [part_profile(p) for p in leaves]
    if site == 3:
      parts = [p for p in parts if p["id"][-8:] == "4OidR5eD"]
    if site == 5:
      parts = [p for p in parts if p["id"][-8:] in {"DgMokUAL", "DKGRCr8q"}]
    if site == 6:
      parts = [p for p in parts if p["id"][-8:] == "s2favyIL"]
    source.append(dict(id=pid, name=name, parts=parts, tile=tile))
    for p in parts:
      old = by_id[p["id"][-8:]]
      dy = old["y0_dm"] / 10 - p["ground_y_m"]
      owners.append(
        dict(
          id=p["id"],
          parentId=pid,
          site=site,
          legacyPrism=old,
          groundY=old["y0_dm"] / 10,
          shiftY=dy,
          topY=p["top_y_m"] + dy,
          ring=p["ring"],
          holes=p["holes"],
        )
      )

  nearby = []
  for p in prisms:
    xs, zs = zip(*p["ring"], strict=True)
    if max(xs) < -5300 or min(xs) > 2500 or max(zs) < 11800 or min(zs) > 14100:
      continue
    nearby.append(
      (
        p["id"],
        p["y0_dm"] / 10,
        (p["y0_dm"] + p["h_dm"]) / 10,
        Polygon(
          [(x / 10, z / 10) for x, z in p["ring"]],
          [[(x / 10, z / 10) for x, z in h] for h in p["holes"]],
        ),
      )
    )

  for oi, owner in enumerate(owners):
    part = next(p for s in source for p in s["parts"] if p["id"] == owner["id"])
    # Only the photographed curved WZB elevation receives window surrounds.
    # Other WZB parts remain source context, never guessed copies of that facade.
    if owner["site"] == 0 and owner["id"] != "DEBE3DGdYFvyF7Oj":
      continue
    own = Polygon(owner["ring"], owner["holes"])
    surfaces = part["surfaces"]
    if owner["site"] >= 3:
      # These retained street shells own the lower facades. The separate CB/CD
      # source parts describe their recessed atria, not the street wall plane.
      # Match the already drawn decimetre prism exactly; keep raw sheets intact.
      old = owner["legacyPrism"]
      ring = [(x / 10, z / 10) for x, z in old["ring"]]
      bottom = owner["groundY"] - owner["shiftY"]
      top = bottom + old["h_dm"] / 10
      surfaces = [
        dict(
          kind="WallSurface",
          rings=[
            [
              [a[0], bottom, a[1]],
              [b[0], bottom, b[1]],
              [b[0], top, b[1]],
              [a[0], top, a[1]],
            ]
          ],
        )
        for a, b in zip(ring, ring[1:] + ring[:1], strict=True)
      ]
      own = Polygon(ring)
    for si, surface in enumerate(surfaces):
      if surface["kind"] != "WallSurface":
        continue
      points = np.array(surface["rings"][0], dtype=float)
      points[:, 1] += owner["shiftY"]
      n = normal_of(points.tolist())
      if abs(n[1]) > 0.01:
        continue
      a, b = max(
        ((a, b) for a in points for b in points),
        key=lambda q: np.linalg.norm((q[1] - q[0])[[0, 2]]),
      )
      a, b = a[[0, 2]], b[[0, 2]]
      length = float(np.linalg.norm(b - a))
      if length < (0.3 if owner["site"] == 0 else 2.4):
        continue
      d = (b - a) / length
      n = n[[0, 2]]
      if own.covers(Point(*((a + b) / 2 + n * 0.12))):
        n = -n
      if owner["site"] >= 3 and (length < 12 or not (n[0] > 0.5 or n[1] > 0.5)):
        continue
      # The WZB photograph establishes the outer semicircle, not its court face.
      if owner["site"] == 0 and Point(*((a + b) / 2)).distance(Point(-487, 1349)) < 16:
        continue
      local = Polygon([[(float((p[[0, 2]] - a) @ d)), p[1]] for p in points])
      if not local.is_valid:
        local = local.buffer(0)
      lo, hi = float(points[:, 1].min()), float(points[:, 1].max())
      if hi - lo < 5:
        continue
      fi = len(faces)
      faces.append(
        dict(
          owner=oi,
          sourceSurface=si if owner["site"] < 3 else None,
          **({"retainedPrismWall": si} if owner["site"] >= 3 else {}),
          a=a.tolist(),
          d=d.tolist(),
          normal=n.tolist(),
          length=length,
        )
      )

      def emit(
        u: float,
        y: float,
        w: float,
        h: float,
        color: int,
        role: int,
        depth: float = 0.12,
        offset: float = 0.15,
        clipped: bool = False,
      ) -> None:
        if y - h / 2 < owner["groundY"] + 3.0:
          return
        if not local.buffer(-0.035).covers(
          box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
        ):
          return
        if owner["site"] >= 3 and not clipped:
          # Preserve stair/balcony source bodies that interrupt a street wall:
          # subtract only their occupied spans rather than dropping a full band.
          spans = [(u - w / 2, u + w / 2)]
          line = LineString([a + d * v + n * (offset + depth / 2) for v in [0, length]])
          for pid, low, top, shape in nearby:
            if (
              pid == owner["legacyPrism"]["id"] or low >= y + h / 2 or top <= y - h / 2
            ):
              continue
            cut = shape.buffer(0.06).intersection(line)
            if cut.is_empty:
              continue
            cuts = list(cut.geoms) if hasattr(cut, "geoms") else [cut]
            for segment in cuts:
              coords = list(segment.coords)
              left = min(float((np.array(p) - a) @ d) for p in coords) - 0.05
              right = max(float((np.array(p) - a) @ d) for p in coords) + 0.05
              spans = [
                piece
                for start, end in spans
                for piece in [(start, min(end, left)), (max(start, right), end)]
                if piece[1] - piece[0] > 0.12
              ]
          for start, end in spans:
            emit((start + end) / 2, y, end - start, h, color, role, depth, offset, True)
          return
        for v in [u - w / 2, u, u + w / 2]:
          q = Point(*(a + d * v + n * (offset + depth)))
          if any(
            pid != owner["legacyPrism"]["id"]
            and low < y + h / 2
            and top > y - h / 2
            and shape.covers(q)
            for pid, low, top, shape in nearby
          ):
            return
        q = a + d * u + n * offset
        boxes.append(
          [
            round(float(q[0]), 4),
            round(y, 4),
            round(float(q[1]), 4),
            round(w, 4),
            round(h, 4),
            depth,
            math.atan2(-d[1], d[0]),
            color,
            role,
            oi,
            fi,
          ]
        )

      base = owner["groundY"]
      if owner["site"] == 0:
        # Five photographed levels; only shallow courses and open U-surrounds.
        # Keep existing generic panes/axes visible: no opaque facade replacement.
        pitch = (owner["topY"] - base - 0.45) / 5
        for level in range(5):
          y = base + (level + 0.5) * pitch
          emit(
            length / 2,
            base + (level + 1) * pitch - 0.16,
            length - 0.1,
            0.38,
            0xABC8CB if level % 2 == 0 else 0xD8ADA0,
            1,
          )
          # Continuous angular rhythm across the measured short curved facets;
          # a source segmentation boundary is not an extra window bay.
          arc_center = np.array([-487.0, 1349.0])
          start = math.atan2(a[1] - arc_center[1], a[0] - arc_center[0]) * 21.0
          radial = a - arc_center
          sign = 1 if radial[0] * d[1] - radial[1] * d[0] > 0 else -1
          end = start + sign * length
          for j in range(
            math.floor(min(start, end) / 3.8) - 1, math.ceil(max(start, end) / 3.8) + 1
          ):
            u = ((j + 0.5) * 3.8 - start) * sign
            w, h = 1.45, 2.05
            for side in [-1, 1]:
              emit(u + side * (w / 2 + 0.10), y, 0.18, h, 0xA27D66, 2, 0.20, 0.19)
            left, right = (
              max(0.06, u - w / 2 - 0.19),
              min(length - 0.06, u + w / 2 + 0.19),
            )
            if right > left:
              emit(
                (left + right) / 2,
                y + h / 2,
                right - left,
                0.18,
                0xAE8870,
                2,
                0.20,
                0.19,
              )
        emit(length / 2, hi - 0.16, length - 0.1, 0.19, 0x9D7962, 2)
      else:
        # RSHP's ceramic spandrels and metal double-skin rails; no new pane grid,
        # no guessed external stair, no additional roof over the retained atria.
        for level in range(1, 10):
          y = base + 3.7 + level * 3.65
          emit(length / 2, y, length - 0.16, 0.40, 0xB47E5C, 3)
          for delta in [-0.31, 0.31]:
            emit(length / 2, y + delta, length - 0.16, 0.09, 0xA5AEAA, 4, 0.20, 0.26)
        # Measured wall endpoints retain the existing chamfers and thin wings.
        for u in [0.22, length - 0.22]:
          emit(
            u,
            (max(lo, base + 4.0) + hi - 0.4) / 2,
            0.14,
            hi - 0.4 - max(lo, base + 4.0),
            0xA6B0AB,
            4,
            0.20,
            0.22,
          )
        emit(length / 2, hi - 0.2, length - 0.16, 0.14, 0xC0C8C2, 4)

  # Separate block-native facade cells, placed beyond existing coarse columns.
  voxel = json.loads(voxel_path.read_text())
  cell, grid, columns = voxel["cell_m"], voxel["grid"], {}
  for iz, runs in enumerate(voxel["building_rows"]):
    z = (grid["min_z_idx"] + iz + 0.5) * cell
    if not 1190 < z < 1390:
      continue
    for ix, count, low, top, _ in runs:
      for k in range(ix, ix + count):
        x = (grid["min_x_idx"] + k + 0.5) * cell
        if -530 < x < 250:
          columns[(math.floor(x / cell), math.floor(z / cell))] = (low / 10, top / 10)
  cells = {}
  for x, y, z, w, h, _, yaw, color, role, oi, fi in boxes:
    n = faces[fi]["normal"]
    for u in np.linspace(-w / 2, w / 2, max(2, math.ceil(w / 0.6) + 1)):
      for v in np.linspace(-h / 2, h / 2, max(2, math.ceil(h / 0.6) + 1)):
        px, py, pz = x + math.cos(yaw) * u, y + v, z - math.sin(yaw) * u
        moved = 0.0
        while moved < 4.5:
          column = columns.get((math.floor(px / cell), math.floor(pz / cell)))
          if column is None or not column[0] <= py < column[1]:
            break
          px += n[0] * 0.25
          pz += n[1] * 0.25
          moved += 0.25
        if moved >= 4.5:
          continue
        px += n[0] * 0.55
        pz += n[1] * 0.55
        key = (oi, *(math.floor(q / 0.75) for q in [px, py, pz]))
        cells[key] = color, role
  blocks = [
    [
      (x + 0.5) * 0.75,
      (y + 0.5) * 0.75,
      (z + 0.5) * 0.75,
      0.75,
      0.75,
      0.75,
      color,
      role,
      oi,
    ]
    for (oi, x, y, z), (color, role) in sorted(cells.items())
  ]
  # Merge exact adjacent same-colour cells along Y only, without filling gaps.
  runs = {}
  for r in blocks:
    runs.setdefault((r[0], r[2], r[6], r[7], r[8]), []).append(r[1])
  blocks = []
  for (x, z, color, role, oi), ys in sorted(runs.items()):
    start = end = ys[0]
    for y in [*ys[1:], None]:
      if y is not None and abs(y - end - 0.75) < 1e-8:
        end = y
        continue
      blocks.append(
        [x, (start + end) / 2, z, 0.75, end - start + 0.75, 0.75, color, role, oi]
      )
      start = end = y
  source_path = (
    ROOT / "geo_data/regierungsviertel/potsdamer-context-v214-source.json.gz"
  )
  write(source_path, dict(families=source, owners=owners, retainedInputs=inputs))
  write(OUT / "potsdamerContextV214.json", dict(boxes=boxes, blocks=blocks))
  write(
    OUT / "potsdamerContextV214Profile.json",
    dict(
      owners=[
        dict(
          id=o["id"],
          parentId=o["parentId"],
          site=o["site"],
          groundY=o["groundY"],
          anchor=list(Polygon(o["ring"], o["holes"]).centroid.coords)[0],
        )
        for o in owners
      ],
      sourceSha256=digest(source_path),
      sourceParts=len(owners),
      drawnBoxes=len(boxes),
      nativeBoxes=len(blocks),
      additiveOnly=True,
    ),
  )
  write(
    OUT / "potsdamerContextV214Evidence.json",
    dict(
      faces=faces,
      retainedInputs=inputs,
      sourceSha256=digest(source_path),
      policy="No source suppression, recolouring or replacement; no new ground, roof plate or passage barrier. All old detail stays owned by existing layers.",
      estimates="Local course heights, window-surround proportions and native facade projection are visual display estimates. Source walls, rings and per-part vertical registration are measured inputs.",
    ),
  )
  print(
    f"Potsdamer v214: {len(owners)} source parts, {len(boxes)} drawn / {len(blocks)} native boxes"
  )


if __name__ == "__main__":
  build()
