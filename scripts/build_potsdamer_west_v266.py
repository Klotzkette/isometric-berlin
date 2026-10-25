"""Step 10: bounded additive completion of the Potsdamer west ensemble.

All existing sources and models stay rendered. OSM high-part plans identify the
missing Atrium tower/ventilation shaft; heights apart from the published 106 m
ensemble maximum are explicitly proportional display estimates.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

from build_bebelplatz_building_source import extract_parent, part_profile
from pyproj import Transformer
from shapely.geometry import Point, Polygon
from shapely.ops import triangulate

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/app/src/data"
EVIDENCE = ROOT / "geo_data/regierungsviertel/potsdamer-west-v266-evidence.json.gz"
SOURCE = ROOT / "geo_data/regierungsviertel/raw/potsdamer-west-v266/osm-map.json"
TARGETS = [
  "DEBE01YYK0002RFp",
  "DEBE00YY24B0002l",
  "DEBE00YY24B0002k",
  "DEBE00YY24B0002e",
]
HIGH = {
  591305839,
  591305856,
  591305857,
  591305858,
  591305860,
  591305861,
  591305862,
  591305863,
  591305865,
}
TERRA = 0xBE875C
GLASS = 0x698A91
METAL = 0xC0C9BF
GREEN = [0x45A48A, 0x5DB69A, 0x3C8B78, 0x76BBA1]


def digest(path: Path) -> str:
  """Fingerprint retained input bytes without changing the input."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def write(path: Path, data: dict) -> None:
  """Write deterministic compact derived evidence."""
  raw = (json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def build() -> None:
  """Build source-bound upper structures and new shallow facade fittings."""
  prism_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  prisms = json.loads(prism_path.read_text())["buildings"]
  by_id = {p["id"]: p for p in prisms}
  old = by_id["K0002RFp"]
  envelope = Polygon(
    [(x / 10, z / 10) for x, z in old["ring"]],
    [[(x / 10, z / 10) for x, z in r] for r in old["holes"]],
  )
  base = old["y0_dm"] / 10
  lower = base + old["h_dm"] / 10
  archive = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_389_5818.zip"
  official = []
  for pid in TARGETS:
    parent = extract_parent(archive, pid)
    parts = [part_profile(p) for p in list(leaf_building_parts(parent)) or [parent]]
    official.append({"parent": pid, "parts": parts})
  raw = json.loads(SOURCE.read_text())
  nodes = {e["id"]: e for e in raw["elements"] if e["type"] == "node"}
  tr = Transformer.from_crs(4326, 25833, always_xy=True)
  selected = []
  for e in raw["elements"]:
    if e["type"] != "way" or not (
      e["id"] == 22989918 or 591305834 <= e["id"] <= 591305865
    ):
      continue
    ring = []
    for n in e["nodes"][:-1]:
      p = nodes[n]
      x, y = tr.transform(p["lon"], p["lat"])
      ring.append([round(x - 389500, 3), round(5820000 - y, 3)])
    selected.append(
      {
        "id": e["id"],
        "tags": e.get("tags", {}),
        "ring": ring,
        "sourceElement": e,
        "nodes": [nodes[n] for n in e["nodes"][:-1]],
      }
    )
  shells, positions, colors, rows, blocks = [], [], [], [], []
  surface_columns, roof_blocks = [], []
  roles: Counter[str] = Counter()
  owners = [{"id": "K0002RFp", "anchor": [61.35, 1482.81], "groundY": base}]

  def emit(
    x: float,
    y: float,
    z: float,
    w: float,
    h: float,
    d: float,
    angle: float,
    color: int,
    role: str,
    owner: int = 0,
  ) -> None:
    rows.append([round(v, 4) for v in [x, y, z, w, h, d, angle]] + [color, role, owner])
    roles[role] += 1

  def panel(
    a: tuple,
    b: tuple,
    y: float,
    height: float,
    depth: float,
    color: int,
    role: str,
    outward: float = 0.16,
  ) -> None:
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dz)
    if length < 0.1:
      return
    # Rings are oriented consistently below; right normal is exterior.
    nx, nz = dz / length, -dx / length
    emit(
      (a[0] + b[0]) / 2 + nx * outward,
      y,
      (a[1] + b[1]) / 2 + nz * outward,
      length,
      height,
      depth,
      -math.atan2(dz, dx),
      color,
      role,
    )

  def triangle(points: list, color: int) -> None:
    positions.extend(round(v, 4) for p in points for v in p)
    colors.extend([color] * 3)

  for part in selected:
    if part["id"] not in HIGH:
      continue
    # The original measured ground footprint remains authoritative: only its
    # overlap with independently mapped upper plans may receive added volume.
    is_shaft = part["id"] == 591305860
    # Keep the mapped rectangular shaft intact: a 0.0374 m² disagreement with
    # decimetre LoD2 quantization must not create a spurious fifth cube face.
    poly = (
      Polygon(part["ring"])
      if is_shaft
      else Polygon(part["ring"]).intersection(envelope)
    )
    if poly.geom_type != "Polygon":
      raise ValueError("Unexpected disconnected upper owner")
    from shapely.geometry.polygon import orient

    poly = orient(poly, sign=1)
    levels = int(part["tags"]["building:levels"])
    top = base + (99.2 if is_shaft else 85 - (22 - levels) * 3.85)
    ring = list(poly.exterior.coords)[:-1]
    shells.append(
      {
        "osmId": part["id"],
        "ring": ring,
        "bottom": lower,
        "top": top,
        "role": "ventilation-shaft" if is_shaft else "office-upper",
        "clippedAreaM2": round(poly.area, 6),
        "originalAreaM2": round(Polygon(part["ring"]).area, 6),
        "outsideRetainedEnvelopeM2": round(poly.difference(envelope).area, 6),
      }
    )
    color = (
      TERRA if is_shaft or part["id"] in {591305856, 591305857, 591305861} else GLASS
    )
    for tri in triangulate(poly):
      if not poly.covers(tri.representative_point()):
        continue
      p = list(tri.exterior.coords)[:3]
      triangle([[x, top, z] for x, z in p[::-1]], 0x92998E)
    for a, b in zip(ring, ring[1:] + ring[:1], strict=True):
      triangle([[a[0], lower, a[1]], [a[0], top, a[1]], [b[0], top, b[1]]], color)
      triangle([[a[0], lower, a[1]], [b[0], top, b[1]], [b[0], lower, b[1]]], color)
      length = math.dist(a, b)
      if length < 1:
        continue
      if is_shaft:
        for u in [length / 3, length * 2 / 3]:
          x, z = a[0] + (b[0] - a[0]) * u / length, a[1] + (b[1] - a[1]) * u / length
          n = ((b[1] - a[1]) / length, -(b[0] - a[0]) / length)
          emit(
            x + n[0] * 0.10,
            (lower + top) / 2,
            z + n[1] * 0.10,
            0.06,
            top - lower,
            0.11,
            -math.atan2(b[1] - a[1], b[0] - a[0]),
            0xA87351,
            "shaft-vertical-joint",
          )
      else:
        for y in [base + 3.85 * f for f in range(15, 23)]:
          if lower + 0.25 < y < top - 0.25:
            panel(a, b, y, 0.24, 0.23, 0xBE956E, "office-terracotta-floor-band")
            panel(a, b, y + 0.32, 0.065, 0.17, METAL, "office-double-facade-rail")
        if length > 3:
          n = max(2, round(length / 1.9))
          for i in range(1, n):
            u = i / n
            x = a[0] + (b[0] - a[0]) * u
            z = a[1] + (b[1] - a[1]) * u
            nx = (b[1] - a[1]) / length
            nz = -(b[0] - a[0]) / length
            emit(
              x + nx * 0.19,
              (lower + top) / 2,
              z + nz * 0.19,
              0.09,
              top - lower,
              0.19,
              -math.atan2(b[1] - a[1], b[0] - a[0]),
              METAL,
              "office-double-facade-mullion",
            )
    # Native geometry is an independently sampled orthogonal surface, with no
    # smooth triangles or volume-sized hidden solid fill.
    cell = 1.4
    xmin, zmin, xmax, zmax = poly.bounds
    for ix in range(math.floor(xmin / cell), math.ceil(xmax / cell)):
      for iz in range(math.floor(zmin / cell), math.ceil(zmax / cell)):
        x, z = (ix + 0.5) * cell, (iz + 0.5) * cell
        if not poly.covers(Point(x, z)):
          continue
        edge = poly.boundary.distance(Point(x, z)) < cell * 0.85
        if edge:
          levels_n = math.ceil((top - lower) / 1.4)
          h = (top - lower) / levels_n
          surface_columns.append(
            [round(x, 4), round(z, 4), lower, top, cell, levels_n, color, is_shaft]
          )
          for iy in range(levels_n):
            yy = lower + (iy + 0.5) * h
            c = color if is_shaft else (0xB88D65 if iy % 3 == 0 else GLASS)
            blocks.append(
              [
                round(x, 4),
                round(yy, 4),
                round(z, 4),
                cell,
                round(h, 4),
                cell,
                c,
                "upper-surface-cell",
              ]
            )
        else:
          blocks.append(
            [
              round(x, 4),
              round(top - 0.35, 4),
              round(z, 4),
              cell,
              0.7,
              cell,
              0x92998E,
              "upper-roof-cell",
            ]
          )
    if is_shaft:
      # Four faces of separated green squares on the exact mapped shaft plan;
      # the 106 m primary published maximum belongs to this top, not office roof.
      for a, b in zip(ring, ring[1:] + ring[:1], strict=True):
        length = math.dist(a, b)
        nx = (b[1] - a[1]) / length
        nz = -(b[0] - a[0]) / length
        for col in range(4):
          u = (col + 0.5) / 4
          cx = a[0] + (b[0] - a[0]) * u
          cz = a[1] + (b[1] - a[1]) * u
          for row in range(4):
            yy = top + (row + 0.5) * 6.8 / 4
            emit(
              cx + nx * 0.15,
              yy,
              cz + nz * 0.15,
              length / 4 - 0.14,
              6.8 / 4 - 0.13,
              0.11,
              -math.atan2(b[1] - a[1], b[0] - a[0]),
              GREEN[(col + row) % 4],
              "green-cube-square",
            )
        for row in range(5):
          panel(
            a,
            b,
            top + row * 6.8 / 4,
            length * 0 + 0.09,
            0.18,
            METAL,
            "green-cube-horizontal-frame",
            0.23,
          )
        for col in range(5):
          u = col / 4
          cx = a[0] + (b[0] - a[0]) * u
          cz = a[1] + (b[1] - a[1]) * u
          emit(
            cx + nx * 0.23,
            top + 3.4,
            cz + nz * 0.23,
            0.09,
            6.8,
            0.18,
            -math.atan2(b[1] - a[1], b[0] - a[0]),
            METAL,
            "green-cube-vertical-frame",
          )

  # Thin secondary vertical rails on the two already identified RSHP street
  # fronts complement, and never regenerate, the v214 horizontal ceramic bands.
  previous = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/potsdamer-context-v214-source.json.gz"
      ).read_bytes()
    )
  )
  street_ids = {"4OidR5eD", "s2favyIL", "DgMokUAL", "DKGRCr8q", "K0002KOK"}
  nearby = []
  for p in prisms:
    if p["id"] in street_ids or any(
      1400 < x < 2600 and 11800 < z < 13400 for x, z in p["ring"]
    ):
      nearby.append(
        (
          p["id"],
          p["y0_dm"] / 10,
          (p["y0_dm"] + p["h_dm"]) / 10,
          Polygon(
            [(x / 10, z / 10) for x, z in p["ring"]],
            [[(x / 10, z / 10) for x, z in r] for r in p["holes"]],
          ),
        )
      )
  rogers = []
  for p in prisms:
    if p["id"] not in street_ids:
      continue
    owners.append(
      {
        "id": p["id"],
        "anchor": [p["ring"][0][0] / 10, p["ring"][0][1] / 10],
        "groundY": p["y0_dm"] / 10,
      }
    )
    owner_index = len(owners) - 1
    from shapely.geometry.polygon import orient

    polygon = orient(Polygon([(x / 10, z / 10) for x, z in p["ring"]]), sign=1)
    ring = list(polygon.exterior.coords)[:-1]
    lo = p["y0_dm"] / 10 + 4.2
    hi = (p["y0_dm"] + p["h_dm"]) / 10 - 0.55
    for ei, (a, b) in enumerate(zip(ring, ring[1:] + ring[:1], strict=True)):
      length = math.dist(a, b)
      dx = (b[0] - a[0]) / length
      dz = (b[1] - a[1]) / length
      nx, nz = dz, -dx
      if length < 12 or not (nx > 0.5 or nz > 0.5):
        continue
      for j in range(1, math.floor(length / 3.2)):
        u = 3.2 * j
        x = a[0] + dx * u + nx * 0.36
        z = a[1] + dz * u + nz * 0.36
        # Entire fitting is excluded if another retained owner occupies it.
        q = Point(x, z)
        if any(
          pid != p["id"] and low < hi and top > lo and poly.covers(q)
          for pid, low, top, poly in nearby
        ):
          continue
        emit(
          x,
          (lo + hi) / 2,
          z,
          0.085,
          hi - lo,
          0.19,
          -math.atan2(dz, dx),
          METAL,
          "rogers-secondary-vertical-rail",
          owner_index,
        )
        rogers.append(
          {
            "owner": p["id"],
            "edge": ei,
            "position": [x, (lo + hi) / 2, z],
            "size": [0.085, hi - lo, 0.19],
          }
        )
  # Add independent block readings of fittings: subdivide horizontal spans into
  # axis-aligned segments, never copy the drawn rotation into native matrices.
  roof_blocks = [b + [0] for b in blocks if b[7] == "upper-roof-cell"]
  blocks = [b + [0] for b in blocks]
  for x, y, z, w, h, d, angle, c, role, owner in rows:
    n = max(1, math.ceil(w / 0.65))
    step = w / n
    dx, dz = math.cos(angle), -math.sin(angle)
    for i in range(n):
      u = (i + 0.5) * step - w / 2
      blocks.append(
        [
          round(x + dx * u, 4),
          y,
          round(z + dz * u, 4),
          round(abs(dx) * step + abs(dz) * d, 4),
          h,
          round(abs(dz) * step + abs(dx) * d, 4),
          c,
          role,
          owner,
        ]
      )
  preserved = [
    p for p in prisms if p["id"] in {s["id"][-8:] for a in official for s in a["parts"]}
  ]
  inputs = {
    str(p.relative_to(ROOT)): digest(p)
    for p in [
      prism_path,
      archive,
      SOURCE,
      OUT / "potsdamerContextV214.json",
      ROOT / "src/app/src/potsdamerPanoramaRoofs.ts",
      ROOT / "src/app/src/PotsdamerMinistryArchitecture.ts",
    ]
  }
  evidence = {
    "schemaVersion": 1,
    "step": 10,
    "version": "v266",
    "inputs": inputs,
    "sourceUrl": "https://www.openstreetmap.org/api/0.6/map.json?bbox=13.3720,52.5050,13.3740,52.5070",
    "retrieved": "2026-10-25",
    "official": official,
    "osm": selected,
    "preservedPrisms": preserved,
    "suppressionIds": [],
    "existingSourcesRemainRendered": True,
    "upperOwners": shells,
    "conflicts": [
      "The retained 55.016 m complex source cannot represent the published 106 m shaft.",
      "OSM's 30 levels describe the shaft, not 30 occupied floors. Office part heights are proportional estimates.",
      "Retained whole-complex source remains rendered. This addition does not correct lower envelope over-height.",
    ],
    "publishedHeightM": 106,
    "estimatedOfficeRoofHeightM": 85,
    "rogersRails": rogers,
    "retainedV214Source": previous,
    "roles": dict(roles),
    "drawnVertices": len(colors),
    "drawnFittings": len(rows),
    "nativeBlocks": len(blocks),
  }
  write(EVIDENCE, evidence)
  write(
    OUT / "potsdamerWestV266.json",
    {
      "positions": positions,
      "colors": colors,
      "boxes": rows,
      "nativeSurfaceColumns": surface_columns,
      "nativeRoofBlocks": roof_blocks,
      "profile": {
        "nativeBlocks": len(blocks),
        "owners": owners,
        "baseY": base,
        "upperStartsY": lower,
        "maximumY": base + 106,
        "shaftOsmId": 591305860,
        "shaftCenter": [61.352, 1482.81],
        "sourceOwner": "K0002RFp",
        "evidenceSha256": digest(EVIDENCE),
        "roles": dict(roles),
        "fullMobileDetail": True,
        "suppressionIds": [],
      },
    },
  )
  print(
    json.dumps(
      {
        "drawnVertices": len(colors),
        "drawnFittings": len(rows),
        "nativeBlocks": len(blocks),
        "evidenceBytes": EVIDENCE.stat().st_size,
        "dataBytes": (OUT / "potsdamerWestV266.json").stat().st_size,
      }
    )
  )


if __name__ == "__main__":
  build()
