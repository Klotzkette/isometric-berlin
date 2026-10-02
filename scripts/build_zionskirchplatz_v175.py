"""Step 10: four restrained, source-plane frontage refinements at Zionskirchplatz.

Existing complete LoD2 shells, roofs, streets and all surrounding detail stay.
Photographic cues guide colours and small divisions, not surveyed dimensions.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_breitscheid_towers_v161 import normal_of, triangles_for
from build_zionskirche_v174 import native_blocks
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "src/app/src/data"
SOURCE = ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-391_5821-00.json.gz"
PROFILE = DEST / "zionskirchplatzV175Profile.json"
FRAME, GLASS, IRON = 0xE5DFCF, 0x53686B, 0x444D48


def make_payloads() -> tuple[dict, dict, dict]:
  """Apply only explicitly selected public wall planes; no courtyard infill."""
  profile = json.loads(PROFILE.read_text())
  owners = {
    r["id"]: r for r in json.loads(gzip.decompress(SOURCE.read_bytes()))["buildings"]
  }
  details = {"surfaces": [], "facadeBoxes": [], "detailRods": []}
  retained = []
  for selection in profile["buildings"]:
    record = owners[selection["parentId"]]
    footprint = unary_union(
      [Polygon(p["ring"], p.get("holes", [])) for p in record["footprintPolygons"]]
    )
    retained.append(
      {
        "parentId": record["id"],
        "sha256": hashlib.sha256(
          json.dumps(record, sort_keys=True).encode()
        ).hexdigest(),
        "roofPolygons": sum(
          s["kind"] == "RoofSurface" for p in record["parts"] for s in p["surfaces"]
        ),
        "groundY": record["groundY"],
        "groundNHN": record["groundNHN"],
        "terrainAnchor": [
          round(footprint.centroid.x, 3),
          round(footprint.centroid.y, 3),
        ],
        "footprintPolygons": record["footprintPolygons"],
      }
    )
    for face in selection["faces"]:
      surface = next(
        s
        for p in record["parts"]
        for s in p["surfaces"]
        if s["sourcePolygonId"] == face["sourcePolygonId"]
      )
      assert surface["kind"] == "WallSurface"
      ring = np.asarray(surface["rings"][0])
      normal = normal_of(ring.tolist())
      assert abs(normal[1]) < 0.01
      n = normal[[0, 2]]
      a, b = max(
        ((a, b) for a in ring for b in ring),
        key=lambda pair: np.linalg.norm((pair[0] - pair[1])[[0, 2]]),
      )
      # Deterministic left-to-right ordering when seen from the street.
      d = (b - a)[[0, 2]]
      length = float(np.linalg.norm(d))
      d /= length
      if np.cross(np.array([d[0], 0, d[1]]), [0, 1, 0]) @ normal < 0:
        a, b, d = b, a, -d
      origin = a[[0, 2]]
      yaw = math.atan2(-d[1], d[0])
      local = Polygon([[float((p[[0, 2]] - origin) @ d), float(p[1])] for p in ring])
      if "maxFacadeY" in face:
        local = local.intersection(box(-0.1, 0, length + 0.1, face["maxFacadeY"]))
      ground, top = local.bounds[1], local.bounds[3]
      assert ground < 3.1 and top > 15

      def point(u: float, y: float, out: float) -> list:
        q = origin + d * u + n * out
        return [round(float(q[0]), 5), round(y, 5), round(float(q[1]), 5)]

      def panel(
        u: float, y: float, w: float, h: float, color: int, role: int = 1
      ) -> None:
        shape = box(u - w / 2, y - h / 2, u + w / 2, y + h / 2).intersection(local)
        if shape.is_empty or shape.geom_type != "Polygon":
          return
        details["surfaces"].append(
          {
            "color": color,
            "role": role,
            "normal": n.tolist(),
            "triangles": triangles_for(
              [[point(px, py, 0.21) for px, py in shape.exterior.coords]]
            ),
          }
        )

      def emit(
        u: float,
        y: float,
        w: float,
        h: float,
        color: int,
        role: int = 2,
        depth: float = 0.07,
        out: float = 0.29,
      ) -> None:
        if not local.buffer(0.025).covers(
          box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
        ):
          return
        details["facadeBoxes"].append(
          point(u, y, out)
          + [round(w, 5), round(h, 5), depth, yaw, color, role, *n.tolist()]
        )

      base_top = ground + selection.get("baseHeight", 4.1)
      panel(
        length / 2, (base_top + top) / 2, length, top - base_top, selection["paint"]
      )
      panel(
        length / 2,
        (ground + base_top) / 2,
        length,
        base_top - ground,
        selection["base"],
      )
      for y in [ground + 0.32, base_top, top - 0.28]:
        emit(length / 2, y, length - 0.03, 0.14, FRAME, 3, 0.16, 0.32)
      bays = face["bays"]
      centers = [(i + 0.5) * length / bays for i in range(bays)]
      rows = selection.get("upperRows", 4)
      for level in range(rows):
        y = base_top + (level + 0.5) * (top - base_top - 0.65) / rows
        h = min(2.05, (top - base_top - 0.65) / rows * 0.62)
        if selection.get("smallAttic") and level == rows - 1:
          h *= 0.62
        w = min(1.45, length / bays * 0.43)
        for u in centers:
          emit(u, y, w + 0.20, h + 0.20, FRAME)
          emit(u, y, w, h, GLASS, out=0.35, depth=0.025)
          emit(u, y, 0.07, h, FRAME, out=0.39, depth=0.025)
          emit(u, y + h * 0.18, w, 0.07, FRAME, out=0.39, depth=0.025)
          emit(u, y - h / 2 - 0.16, w + 0.34, 0.13, FRAME, 3, 0.19, 0.37)
      # Shopfronts are distinct from upper residential windows. No invented
      # shop names; the small 103 mark below is explicitly a historical cue.
      shops = face.get("shops", False)
      if selection.get("rusticated"):
        for y in np.arange(ground + 1.5, base_top - 0.2, 0.68):
          emit(length / 2, float(y), length - 0.03, 0.055, 0xA47D63, 3, 0.025, 0.26)
      for i, u in enumerate(centers):
        is_door = i == face.get("doorBay", bays // 2)
        h = 3.0 if shops or is_door else 2.0
        w = min(2.65 if shops else 1.35, length / bays * 0.76)
        y = ground + (0.22 if shops or is_door else 1.28) + h / 2
        trim = selection.get("shopFrame", FRAME)
        emit(u, y, w + 0.23, h + 0.16, trim, 4)
        emit(u, y, w, h, 0x354645 if is_door else GLASS, 4, 0.025, 0.36)
        emit(u, y + h * 0.25, w, 0.10, trim, 4, 0.035, 0.40)
        if shops:
          for du in [-w / 6, w / 6]:
            emit(u + du, y, 0.10, h, trim, 4, 0.035, 0.40)
        elif is_door:
          emit(u, y, 0.10, h, trim, 4, 0.035, 0.40)
        if shops and "awning" in selection:
          emit(u, base_top - 0.16, w + 0.35, 0.19, selection["awning"], 5, 0.82, 0.62)
      # A few narrow balcony slabs/rails; the street and complete facade
      # remain visible through the separate bars.
      for bay in face.get("balconyBays", []):
        u = centers[bay]
        for level in range(1, rows):
          y = base_top + level * (top - base_top - 0.65) / rows
          emit(u, y, 2.25, 0.15, FRAME, 6, 0.85, 0.59)
          emit(u, y + 0.93, 2.25, 0.06, IRON, 6, 0.08, 1.00)
          for du in np.linspace(-1.05, 1.05, 8):
            emit(u + float(du), y + 0.49, 0.065, 0.84, IRON, 6, 0.06, 1.00)
      if face.get("historic103"):
        # Independent simple geometry, not a reproduced commercial logo/font.
        u, y = centers[face["historic103"][0]], ground + 2.45
        # Tiny three-digit window mark, confined to the old cafe's corner bay.
        segments = {"1": [1, 2], "0": [0, 1, 2, 3, 4, 5], "3": [0, 1, 2, 3, 6]}
        bars = [
          (0.18, 0.64, 0.28, 0.10),
          (0.36, 0.49, 0.10, 0.24),
          (0.36, 0.17, 0.10, 0.24),
          (0.18, 0, 0.28, 0.10),
          (0, 0.17, 0.10, 0.24),
          (0, 0.49, 0.10, 0.24),
          (0.18, 0.32, 0.28, 0.10),
        ]
        for digit, char in enumerate("103"):
          for segment in segments[char]:
            x0, y0, w, h = bars[segment]
            emit(u - 0.84 + digit * 0.65 + x0, y + y0, w, h, 0xE7D8B0, 7, 0.03, 0.43)
  # Keep the historical digits on a fine orthogonal lattice, in front of the
  # half-metre glazing. Quarter-metre rounding closes the counters in "103".
  native_details = {
    **details,
    "facadeBoxes": [r for r in details["facadeBoxes"] if r[8] != 7],
  }
  blocks = native_blocks(native_details)
  sign_cells = {}
  size = 0.125
  for x, y, z, w, h, _depth, yaw, color, role, nx, nz in details["facadeBoxes"]:
    if role != 7:
      continue
    for u in np.linspace(-w / 2, w / 2, max(2, math.ceil(w / 0.045))):
      for v in np.linspace(-h / 2, h / 2, max(2, math.ceil(h / 0.045))):
        p = [
          x + math.cos(yaw) * u + nx * 2.25,
          y + v,
          z - math.sin(yaw) * u + nz * 2.25,
        ]
        key = tuple(math.floor(q / size) for q in p)
        sign_cells[key] = color
  for key, color in sorted(sign_cells.items()):
    blocks.append([(q + 0.5) * size for q in key] + [color, size, 7, size, size])
  native = {"blocks": blocks}
  evidence = {
    "schemaVersion": 1,
    "retainedOwners": retained,
    "scope": "Four existing buildings; selected street facades only; no source replacement.",
    "sourceArchiveSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "drawnTriangles": sum(len(s["triangles"]) for s in details["surfaces"]),
    "drawnBoxes": len(details["facadeBoxes"]),
    "nativeRuns": len(native["blocks"]),
    "historicalCue": "The former 103 cafe unit at Kastanienallee 49 is shown from a 2011 reference; not a current tenant claim.",
  }
  return details, native, evidence


if __name__ == "__main__":
  for suffix, payload in zip(
    ["Drawn", "Native", "Evidence"], make_payloads(), strict=True
  ):
    path = DEST / f"zionskirchplatzV175{suffix}.json"
    path.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    print(path.name, path.stat().st_size)
