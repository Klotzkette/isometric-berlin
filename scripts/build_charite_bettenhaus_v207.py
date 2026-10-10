"""Step 10: additive Charité tower recognition on the retained 16-part shell."""

from __future__ import annotations

import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/charite-bettenhaus-v207-source.json"
DEST = ROOT / "src/app/src/data/chariteBettenhausV207.json"
IDS = sorted(
  "7b3ZwNAB 7zddOe6j 979qTCbp CNtAYPkO DQZmfONt FurjqyeB NDxiQ2xg "
  "OVVpwBo2 RE3bNP55 SgItUCXH Sorg80ps X4o3aH3m ZSiiyE0H aOZAupOd "
  "jwLw3UEy zq8O5Jct".split()
)
BASE, PITCH, FLOORS, DARK_FLOORS = 5.2, 3.7, 21, 5
PALE, FRAME, DARK, GLASS = 0xDFE5E3, 0xB8C3C5, 0x606A6D, 0x51696F


def digest(path: Path) -> str:
  """Return the immutable source receipt hash."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def extract_source() -> dict[str, Any]:
  """Retain complete official parent and all exact prior presentation owners."""
  from build_bebelplatz_building_source import extract_parent, part_profile

  from isometric_berlin.data.fetch_lod2 import leaf_building_parts

  path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  prisms = json.loads(path.read_text())["buildings"]
  archive = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_390_5820.zip"
  parent = extract_parent(archive, "DEBE00YY1Mr0004R")
  voxel_path = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  voxels = json.loads(voxel_path.read_text())
  cell, grid, columns = voxels["cell_m"], voxels["grid"], []
  for zi, runs in enumerate(voxels["building_rows"]):
    z = (grid["min_z_idx"] + zi + 0.5) * cell
    if not -874 < z < -817:
      continue
    for xo, count, bottom, top, kind in runs:
      for xi in range(xo, xo + count):
        x = (grid["min_x_idx"] + xi + 0.5) * cell
        if 531 < x < 625:
          columns.append([x, z, bottom / 10, top / 10, cell, kind])
  return {
    "schema": "charite-bettenhaus-v207-source/1",
    "sourceParent": "DEBE00YY1Mr0004R",
    "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5820.zip",
    "sourceArchiveSha256": digest(archive),
    "license": "dl-de/zero-2-0",
    "parts": [part_profile(p) for p in leaf_building_parts(parent)],
    "priorPrismPath": str(path.relative_to(ROOT)),
    "priorPrismSha256": digest(path),
    "priorPrisms": [p for p in prisms if p["id"] in IDS],
    "bridgeControl": next(p for p in prisms if p["id"] == "L2e097lj"),
    "priorVoxelPath": str(voxel_path.relative_to(ROOT)),
    "priorVoxelSha256": digest(voxel_path),
    "nearbyVoxelColumns": columns,
    "sourceSuppressionIds": [],
    "architecturalSources": [
      "https://schweger-architects.com/projects/fassadengestaltung-charite-berlin/",
      "https://www.charite.de/service/pressemitteilung/artikel/detail/"
      "charite_bauprojekte_kommen_weiter_gut_voran",
    ],
    "references": [
      {
        "title": f"File:Charité Bettenhochhaus Berlin 2021-04-29 {n}.jpg",
        "page_url": "https://commons.wikimedia.org/wiki/File:"
        f"Charit%C3%A9_Bettenhochhaus_Berlin_2021-04-29_{n}.jpg",
        "author": "Leonhard Lenz",
        "license": "CC0-1.0",
        "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
        "description": "External visual reference: paired narrow glazing, pale "
        "vertical lesenes, darker lower five levels, recessed roof plant screen "
        "and Charité wordmark. Inspected 2026-10-10; photograph not bundled.",
      }
      for n in ["02", "05"]
    ],
    "estimates": "EG–4 treatment / 5–20 wards and vertical lesenes are architect "
    "facts. Existing 3.7 m floor pitch is retained as display rhythm. Pane "
    "subdivisions, palette, screen dimensions and original procedural lettering "
    "are visual estimates. All 28 official parent parts and prior 16 tower "
    "prisms remain unchanged; no source or native column is replaced. Official "
    "NHN sheets use y=NHN−30; existing runtime uses y0=5.2 and is not rebased.",
  }


def build(source: dict[str, Any]) -> dict[str, Any]:
  """Prepare final-count surface-only batches without changing source owners."""
  parts = source["priorPrisms"]
  polygons = {p["id"]: Polygon([(x / 10, z / 10) for x, z in p["ring"]]) for p in parts}
  boxes: list[list[float]] = []
  native: list[list[float]] = []
  night_boxes: list[list[float]] = []
  night_native: list[list[float]] = []
  roles: Counter[str] = Counter()
  walls: list[dict[str, Any]] = []
  native_offsets: list[float] = []
  native_structural_offsets: list[float] = []
  native_occluded = 0

  def add(
    wall: dict[str, Any],
    along: float,
    y: float,
    w: float,
    h: float,
    d: float,
    color: int,
    role: str,
    offset: float = 0.24,
  ) -> None:
    nonlocal native_occluded
    tx, tz = wall["tangent"]
    nx, nz = wall["normal"]
    a = wall["a"]
    x, z = a[0] + tx * along, a[1] + tz * along
    boxes.append(
      [
        round(v, 4)
        for v in [x + nx * offset, y, z + nz * offset, w, h, d, math.atan2(-tz, tx)]
      ]
      + [color]
    )
    roles[role] += 1
    lit = role in {"ward-glazing", "treatment-glazing"} and roles[role] % 7 == 0
    if lit:
      row = boxes[-1].copy()
      row[0], row[2], row[-1] = (
        round(row[0] + nx * 0.06, 4),
        round(row[2] + nz * 0.06, 4),
        0xDABF89,
      )
      night_boxes.append(row)
    # Thin axis-aligned native tiles follow each measured facade course. They
    # sit immediately beyond retained 4 m columns, never delete those columns.
    count = max(1, math.ceil(w / (1.1 if role == "plinth-skin" else 2.2)))
    step = w / count
    for i in range(count):
      u = along - w / 2 + (i + 0.5) * step
      px, pz = a[0] + tx * u, a[1] + tz * u
      bw, bd = (
        max(0.09, abs(tx) * step + abs(nx) * d),
        max(0.09, abs(tz) * step + abs(nz) * d),
      )
      depth = offset
      native_y = y + (2.8 if role.startswith("roof-screen-") else 0)
      for _ in range(8):
        previous = depth
        for cx, cz, bottom, top, cell, _ in source["nearbyVoxelColumns"]:
          # Lower neighbouring clinics may occlude the overlay naturally.
          # Only the tower's existing tall columns define facade clearance.
          if top < 80 or top <= native_y - h / 2 or bottom >= native_y + h / 2:
            continue
          bx, bz = px + nx * depth, pz + nz * depth
          if abs(bx - cx) >= (cell + bw) / 2 or abs(bz - cz) >= (cell + bd) / 2:
            continue
          exits = []
          if abs(nx) > 0.0001:
            edge_x = cx + math.copysign((cell + bw) / 2 + 0.035, nx)
            exits.append((edge_x - px) / nx)
          if abs(nz) > 0.0001:
            edge_z = cz + math.copysign((cell + bd) / 2 + 0.035, nz)
            exits.append((edge_z - pz) / nz)
          depth = max(depth, min(exits))
        if depth == previous:
          break
      if depth > 3.1:
        # Native 4 m cells close sub-cell source recesses. Their hidden inner
        # facade decoration is not moved out in front of the real outer wall.
        native_occluded += 1
        continue
      native_structural_offsets.append(depth)
      depth += {
        "treatment-glazing": 0.14,
        "ward-glazing": 0.14,
        "paired-window-mullion": 0.26,
        "vertical-lesene": 0.20,
        "storey-sill": 0.20,
        "charite-lettering": 0.42,
        "charite-accent": 0.42,
        "sign-backing": 0.02,
      }.get(role, 0)
      native_offsets.append(depth)
      native.append(
        [round(v, 4) for v in [px + nx * depth, native_y, pz + nz * depth, bw, h, bd]]
        + [color]
      )
      if lit:
        row = native[-1].copy()
        row[0], row[2], row[-1] = (
          round(row[0] + nx * 0.09, 4),
          round(row[2] + nz * 0.09, 4),
          0xDABF89,
        )
        night_native.append(row)

  for part in parts:
    polygon = polygons[part["id"]]
    others = unary_union([v for key, v in polygons.items() if key != part["id"]])
    coords = list(polygon.exterior.coords)
    for edge, (a, b) in enumerate(zip(coords, coords[1:])):
      length = math.dist(a, b)
      if length < 0.6:
        continue
      tx, tz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
      nx, nz = tz, -tx
      if polygon.exterior.is_ccw is False:
        nx, nz = -nx, -nz
      # Difference operates on the outward source-parallel line, so seams
      # within 20 cm and inner party walls do not become a second facade.
      line = LineString(
        [(a[0] + nx * 0.2, a[1] + nz * 0.2), (b[0] + nx * 0.2, b[1] + nz * 0.2)]
      )
      visible = line.difference(others)
      segments = [visible] if visible.geom_type == "LineString" else list(visible.geoms)
      for segment in segments:
        if segment.length < 0.6:
          continue
        ends = list(segment.coords)
        lo = (ends[0][0] - a[0]) * tx + (ends[0][1] - a[1]) * tz
        hi = (ends[-1][0] - a[0]) * tx + (ends[-1][1] - a[1]) * tz
        lo, hi = min(lo, hi), max(lo, hi)
        wall = {
          "owner": part["id"],
          "edge": edge,
          "a": list(a),
          "tangent": [tx, tz],
          "normal": [nx, nz],
          "interval": [lo, hi],
        }
        walls.append(wall)
        span, mid = hi - lo, (lo + hi) / 2
        add(
          wall,
          mid,
          BASE + DARK_FLOORS * PITCH / 2,
          span,
          DARK_FLOORS * PITCH,
          0.085,
          DARK,
          "plinth-skin",
        )
        if span < 2:
          continue
        upper_bays = max(1, math.floor((span - 0.45) / 3.3))
        pitch = (span - 0.45) / upper_bays
        start = lo + 0.225
        for axis in range(upper_bays + 1):
          add(
            wall,
            start + axis * pitch,
            BASE + (DARK_FLOORS + FLOORS) * PITCH / 2,
            0.14,
            (FLOORS - DARK_FLOORS) * PITCH,
            0.32,
            PALE,
            "vertical-lesene",
            0.34,
          )
        for floor in range(FLOORS):
          is_base = floor < DARK_FLOORS
          bays = max(1, math.floor((span - 0.45) / (4.2 if is_base else 3.3)))
          pitch_floor = (span - 0.45) / bays
          y = BASE + floor * PITCH
          add(
            wall,
            mid,
            y + 0.76,
            span,
            0.16,
            0.12,
            FRAME if not is_base else 0x4B575B,
            "storey-sill",
            0.33,
          )
          for bay in range(bays):
            along = start + (bay + 0.5) * pitch_floor
            if is_base:
              add(
                wall,
                along,
                y + 2.13,
                min(2.85, pitch_floor - 0.55),
                1.48,
                0.09,
                GLASS,
                "treatment-glazing",
                0.34,
              )
            else:
              for side in [-1, 1]:
                add(
                  wall,
                  along + side * pitch_floor * 0.205,
                  y + 2.04,
                  min(1.05, pitch_floor * 0.34),
                  2.30,
                  0.085,
                  GLASS if (floor + bay) % 7 else 0x718589,
                  "ward-glazing",
                  0.25,
                )
              add(
                wall,
                along,
                y + 2.04,
                0.09,
                2.35,
                0.21,
                PALE,
                "paired-window-mullion",
                0.33,
              )
        add(
          wall,
          mid,
          BASE + FLOORS * PITCH + 0.24,
          span,
          0.36,
          0.24,
          PALE,
          "parapet",
          0.28,
        )

  # The three retained higher core owners carry the set-back plant crown.
  core = unary_union([polygons[k] for k in ["CNtAYPkO", "7zddOe6j", "SgItUCXH"]])
  for a, b in zip(list(core.exterior.coords), list(core.exterior.coords)[1:]):
    length = math.dist(a, b)
    tx, tz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
    nx, nz = (tz, -tx) if core.exterior.is_ccw else (-tz, tx)
    wall = {"a": a, "tangent": [tx, tz], "normal": [nx, nz]}
    if length < 2:
      continue
    for y in [94.5, 95.8, 97.1]:
      add(wall, length / 2, y, length, 0.10, 0.12, 0x707E82, "roof-screen-rail")
    for i in range(math.ceil(length / 1.9) + 1):
      u = i * length / math.ceil(length / 1.9)
      add(wall, u, 95.8, 0.09, 2.7, 0.12, 0x707E82, "roof-screen-upright")

  # Original block glyphs, no font asset, logo tracing, image or texture.
  glyphs = {
    "C": ["1111", "1000", "1000", "1000", "1111"],
    "H": ["1001", "1001", "1111", "1001", "1001"],
    "A": ["0110", "1001", "1111", "1001", "1001"],
    "R": ["1110", "1001", "1110", "1010", "1001"],
    "I": ["111", "010", "010", "010", "111"],
    "T": ["1111", "0110", "0110", "0110", "0110"],
    "E": ["1111", "1000", "1110", "1000", "1111"],
  }
  centre = polygons["7zddOe6j"]
  corners = list(centre.exterior.coords)
  long_edges = [(a, b) for a, b in zip(corners, corners[1:]) if math.dist(a, b) > 25]
  for a, b in long_edges:
    length = math.dist(a, b)
    tx, tz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
    nx, nz = (tz, -tx) if centre.exterior.is_ccw else (-tz, tx)
    # Glyph direction remains left to right when seen from the exterior.
    if centre.exterior.is_ccw:
      a, b, tx, tz = b, a, -tx, -tz
    wall = {"a": a, "tangent": [tx, tz], "normal": [nx, nz]}
    cursor = length / 2 - 7.94
    add(wall, length / 2, 88.7, 20.2, 4.0, 0.14, PALE, "sign-backing", 0.26)
    for character in "CHARITE":
      for row, pattern in enumerate(glyphs[character]):
        for col, bit in enumerate(pattern):
          if bit == "1":
            add(
              wall,
              cursor + col * 0.48,
              90 - row * 0.58,
              0.46,
              0.55,
              0.12,
              0x34464C,
              "charite-lettering",
              0.40,
            )
      if character == "E":
        add(
          wall, cursor + 1.1, 90.85, 0.8, 0.18, 0.12, 0x34464C, "charite-accent", 0.40
        )
      cursor += (len(glyphs[character][0]) + 1) * 0.48

  return {
    "schema": "charite-bettenhaus-v207/1",
    "sourceParent": source["sourceParent"],
    "sourceIds": IDS,
    "sourceSuppressionIds": [],
    "sourceSha256": digest(SOURCE),
    "boxes": boxes,
    "nativeBlocks": native,
    "walls": walls,
    "nightBoxes": night_boxes,
    "nightNativeBlocks": night_native,
    "profile": {
      "groundY": BASE,
      "floorPitchM": PITCH,
      "storeys": FLOORS,
      "treatmentStoreys": DARK_FLOORS,
      "wardStoreys": 16,
      "baseTopY": BASE + DARK_FLOORS * PITCH,
    },
    "estimates": source["estimates"],
    "stats": {
      "roles": dict(roles),
      "drawnInstances": len(boxes),
      "nativeInstances": len(native),
      "drawnNightInstances": len(night_boxes),
      "nativeNightInstances": len(night_native),
      "drawnBufferBytes": (len(boxes) + len(night_boxes)) * 76 + 1296,
      "nativeBufferBytes": (len(native) + len(night_native)) * 76 + 1296,
      "nativeOccludedRecessTiles": native_occluded,
      "nativeMaximumFaceOffsetM": round(max(native_offsets), 4),
      "nativeMaximumColumnClearanceM": round(max(native_structural_offsets), 4),
      "nativeRoofScreenLiftM": 2.8,
    },
  }


def main() -> int:
  """Build the bounded recognition payload; source receipt is immutable."""
  if not SOURCE.exists():
    SOURCE.write_text(json.dumps(extract_source(), ensure_ascii=False, indent=2) + "\n")
  result = build(json.loads(SOURCE.read_text()))
  DEST.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(json.dumps(result["stats"], indent=2))
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
