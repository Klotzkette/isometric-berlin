"""Step 10: complete measured ICC owners and bounded facade recognition.

LoD2 fixes the footprint and height; cladding bays and steel sections are
documented display estimates. Existing unrelated city geometry is untouched.
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
from build_steglitz_v182 import native_blocks
from shapely.geometry import Point, Polygon, box, mapping
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "icc-v199-source.json.gz"
OWNERS = ["DEBE04YY500001II", "DEBE04YY500004dG", "DEBE04YY500006BE"]
SILVER, DARK, GLASS, FRAME = 0xB9C0C1, 0x656F73, 0x455B61, 0xE2E2DA
ORIGIN = np.array([-6182.216, 1340.091])
U = np.array([0.97065, 0.2405])
U /= np.linalg.norm(U)
V = np.array([-U[1], U[0]])
BRIDGE_PART = "DEBE3DnZRDDQCO1P"
BRIDGE_BOTTOM, BRIDGE_TOP = 8.5, 19.895


def bridge_footprint(part: dict) -> Polygon:
  """The exact west arm in the measured ICC envelope, not a street rectangle."""
  ring = part["ring"]
  start = ring.index([-6254.006, 1465.44])
  end = ring.index([-6244.204, 1442.095])
  return Polygon(ring[start : end + 1])


def display_surfaces(part: dict, dy: float) -> list[dict]:
  """Preserve every source sheet, correcting only the false solid skyway arm.

  Its open underside is photographically documented. The displayed clearance
  is estimated; the top meets the measured western hall instead of the source
  envelope's erroneous main-roof height. Original sheets remain in the receipt.
  """
  result = []
  bridge = bridge_footprint(part) if part["id"] == BRIDGE_PART else None
  for s in part["surfaces"]:
    rings = [[[x, round(y + dy, 3), z] for x, y, z in r] for r in s["rings"]]
    if bridge is not None and s["kind"] == "RoofSurface":
      poly = Polygon([[p[0], p[2]] for p in rings[0]])
      for area, y in [
        (poly.difference(bridge), rings[0][0][1]),
        (poly.intersection(bridge), BRIDGE_TOP),
      ]:
        for p in [area] if area.geom_type == "Polygon" else area.geoms:
          if p.is_empty:
            continue
          result.append(
            {
              "kind": s["kind"],
              "rings": [
                [[x, y, z] for x, z in r.coords] for r in [p.exterior, *p.interiors]
              ],
            }
          )
      continue
    if bridge is not None:
      center = np.mean(np.asarray(rings[0])[:, [0, 2]], axis=0)
      if bridge.buffer(0.0001).covers(Point(*center)):
        rings = [
          [
            [
              x,
              round(
                BRIDGE_BOTTOM
                + (y - 3.55)
                / (part["top_y_m"] + dy - 3.55)
                * (BRIDGE_TOP - BRIDGE_BOTTOM),
                4,
              ),
              z,
            ]
            for x, y, z in r
          ]
          for r in rings
        ]
    result.append({"kind": s["kind"], "rings": rings})
  if bridge is not None:
    result.append(
      {
        "kind": "RoofSurface",
        "rings": [[[x, BRIDGE_BOTTOM, z] for x, z in bridge.exterior.coords]],
      }
    )
    a, b = list(bridge.exterior.coords)[0], list(bridge.exterior.coords)[-2]
    result.append(
      {
        "kind": "WallSurface",
        "rings": [
          [
            [a[0], 3.55, a[1]],
            [b[0], 3.55, b[1]],
            [b[0], BRIDGE_BOTTOM, b[1]],
            [a[0], BRIDGE_BOTTOM, a[1]],
          ]
        ],
      }
    )
    result.append(
      {
        "kind": "WallSurface",
        "rings": [
          [
            [a[0], BRIDGE_TOP, a[1]],
            [b[0], BRIDGE_TOP, b[1]],
            [b[0], part["top_y_m"] + dy, b[1]],
            [a[0], part["top_y_m"] + dy, a[1]],
          ]
        ],
      }
    )
  return result


def encode(value: object) -> bytes:
  return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def extract() -> dict:
  archive = GEO / "raw/lod2/LoD2_383_5818.zip"
  records = []
  for owner in OWNERS:
    element = extract_parent(archive, owner)
    records.append(
      {
        "id": owner,
        "parts": [part_profile(p) for p in leaf_building_parts(element) or [element]],
      }
    )
  return {
    "schemaVersion": 1,
    "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_383_5818.zip",
    "sourceSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "owners": records,
    "facts": [
      "https://www.berlin.de/landesdenkmalamt/denkmale/highlight-icc/artikel.1361131.en.php",
      "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/kultur-und-wissenschaft/veranstaltungsorte/artikel.1182217.php",
    ],
    "references": [
      {
        "title": "Berlin Funkturm utsikt 2026-04-01 img01.jpg",
        "author": "LarsMueller",
        "license": "CC0",
        "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "url": "https://commons.wikimedia.org/wiki/File:Berlin_Funkturm_utsikt_2026-04-01_img01.jpg",
      },
      {
        "title": "Berlin - ICC Berlin.jpg",
        "author": "Fred Romero",
        "license": "CC BY 2.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/2.0/",
        "url": "https://commons.wikimedia.org/wiki/File:Berlin_-_ICC_Berlin.jpg",
      },
    ],
  }


def build() -> None:
  if not SOURCE.exists():
    SOURCE.write_bytes(gzip.compress(encode(extract()), mtime=0))
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  groups, nav, receipt, exclusions = [], [], [], []
  for owner in source["owners"]:
    g = {
      "key": owner["id"],
      "owners": [owner["id"]],
      "surfaces": [],
      "boxes": [],
      "rods": [],
    }
    groups.append(g)
    datum = min(p["ground_y_m"] for p in owner["parts"])
    dy = 3.55 - datum
    for part in owner["parts"]:
      footprint = Polygon(part["ring"], part["holes"])
      if part["id"] == BRIDGE_PART:
        bridge = bridge_footprint(part)
        footprint = footprint.difference(bridge)
        nav.append(
          {
            "id": part["id"] + ":skyway",
            "owner": owner["id"],
            "ring": list(bridge.exterior.coords),
            "holes": [],
            "groundY": BRIDGE_BOTTOM,
            "topY": BRIDGE_TOP,
          }
        )
      nav.append(
        {
          "id": part["id"],
          "owner": owner["id"],
          "ring": list(footprint.exterior.coords),
          "holes": [list(r.coords) for r in footprint.interiors],
          "groundY": round(part["ground_y_m"] + dy, 3),
          "topY": round(part["top_y_m"] + dy, 3),
        }
      )
      for si, s in enumerate(part["surfaces"]):
        rings = [[[x, round(y + dy, 3), z] for x, y, z in r] for r in s["rings"]]
        receipt.append(
          {
            "owner": owner["id"],
            "part": part["id"],
            "surface": si,
            "kind": s["kind"],
            "rings": rings,
          }
        )
      for s in display_surfaces(part, dy):
        rings = s["rings"]
        normal = normal_of(rings[0])
        roof = s["kind"] == "RoofSurface"
        color = 0x8C9697 if roof else SILVER
        g["surfaces"].append({"triangles": triangles_for(rings), "color": color})
        if roof or abs(normal[1]) > 0.01:
          continue
        # Horizontal metal seams / dark glazing follow every measured wall,
        # including the rounded paired circulation towers and bridge.
        a, b = max(
          ((a, b) for a in rings[0] for b in rings[0]),
          key=lambda pair: math.dist(pair[0][::2], pair[1][::2]),
        )
        a, b = np.array(a)[[0, 2]], np.array(b)[[0, 2]]
        length = np.linalg.norm(b - a)
        if length < 0.12:
          continue
        direction = (b - a) / length
        n = np.array([direction[1], -direction[0]])
        poly = Polygon(part["ring"], part["holes"])

        if poly.contains(Point(*((a + b) / 2 + n * 0.1))):
          n = -n
        bottom = min(p[1] for r in rings for p in r)
        top = max(p[1] for r in rings for p in r)
        # Clip bands in wall coordinates, rather than painting across recesses.
        local = Polygon(
          [[(np.array([p[0], p[2]]) - a).dot(direction), p[1]] for p in rings[0]]
        )

        levels = [(3.55 + y, 0.65, GLASS) for y in [5.5, 9.2, 12.9, 16.6]]
        levels += [(y, 0.055, 0x939D9F) for y in np.arange(bottom + 2.4, top, 2.4)]
        for y, height, tint in levels:
          clipped = local.intersection(
            box(-1, y - height / 2, length + 1, y + height / 2)
          )
          for piece in (
            [clipped]
            if clipped.geom_type == "Polygon"
            else getattr(clipped, "geoms", [])
          ):
            if piece.is_empty or piece.area < 0.008 or piece.geom_type != "Polygon":
              continue
            r = []
            for u, h in piece.exterior.coords:
              q = a + direction * u + n * 0.085
              r.append([round(q[0], 4), round(h, 4), round(q[1], 4)])
            g["surfaces"].append({"triangles": triangles_for([r]), "color": tint})
        if length > 3:
          for u in np.arange(2, length - 1, 3.5):
            q = a + direction * u + n * 0.11
            g["boxes"].append(
              [
                round(q[0], 4),
                (bottom + top) / 2,
                round(q[1], 4),
                0.05,
                top - bottom,
                0.07,
                math.atan2(-direction[1], direction[0]),
                0x8F989A,
              ]
            )
    fp = unary_union([Polygon(p["ring"], p["holes"]) for p in owner["parts"]])
    exclusions.append(
      {
        "type": "Feature",
        "geometry": mapping(fp),
        "properties": {
          "name": "ICC Berlin complete measured owner",
          "parentIds": [owner["id"]],
        },
      }
    )

  g = groups[0]

  def point(u: float, y: float, v: float) -> list:
    q = ORIGIN + U * u + V * v
    return [round(q[0], 4), round(y + 3.55, 4), round(q[1], 4)]

  def rod(a: list, b: list, width: float, color: int = FRAME) -> None:
    g["rods"].append(point(*a) + point(*b) + [width, color])

  def panel(points: list, color: int) -> None:
    g["surfaces"].append(
      {"triangles": triangles_for([[point(*p) for p in points]]), "color": color}
    )

  # Structural ribs and exposed triangular beams, repeated on the real long
  # elevations. They remain outside the measured shell, with no invented wing.
  bays = [20, 51, 82, 113, 144, 175, 206]
  for side in [-1, 1]:
    profile = [
      (side * 31.4, 14),
      (side * 36.5, 18),
      (side * 38.3, 24),
      (side * 37.2, 30),
      (side * 32.0, 37.9),
    ]
    for v in bays:
      for a, b in zip(profile, profile[1:]):
        rod([a[0], a[1], v], [b[0], b[1], v], 0.72)
      rod([side * 32, 37.9, v], [0, 39.2, v], 0.62)
    for v0, v1 in zip(bays, bays[1:]):
      for y in [21.5, 29.2]:
        rod([side * 39.0, y, v0], [side * 39.0, y, v1], 0.9)
      mid = (v0 + v1) / 2
      rod([side * 39.0, 29.2, v0], [side * 39.0, 21.5, mid], 0.7)
      rod([side * 39.0, 21.5, mid], [side * 39.0, 29.2, v1], 0.7)
    for y in np.arange(17, 36, 0.72):
      u = side * (31.8 + (36 - y) * 0.13)
      rod([u, float(y), 20], [u, float(y), 206], 0.11, SILVER)
  # Entrance north: recessed-looking glazed register, framed canopy and doors.
  panel([[-25, 9, -0.25], [25, 9, -0.25], [25, 14, -0.25], [-25, 14, -0.25]], GLASS)
  for u in np.arange(-25, 26, 2.5):
    rod([float(u), 9, -0.38], [float(u), 14, -0.38], 0.12)
  for y in [9, 14]:
    rod([-25, y, -0.4], [25, y, -0.4], 0.22)
  for side in [-1, 1]:
    for v in [35, 88, 139, 193]:
      panel(
        [
          [side * 40, 1.1, v - 4],
          [side * 40, 1.1, v + 4],
          [side * 40, 4.4, v + 4],
          [side * 40, 4.4, v - 4],
        ],
        GLASS,
      )
      for dv in [-4, 0, 4]:
        rod([side * 40, 1.1, v + dv], [side * 40, 4.4, v + dv], 0.15)
  drawn, native = [], []
  for g in groups:
    out = {k: g[k] for k in ["key", "owners", "boxes", "rods"]} | {
      "positions": [],
      "indices": [],
      "colors": [],
    }
    for surface in g["surfaces"]:
      for tri in surface["triangles"]:
        start = len(out["colors"])
        out["positions"].extend(v for p in tri for v in p)
        out["colors"].extend([surface["color"]] * 3)
        out["indices"].extend([start, start + 1, start + 2])
    # Full triangles are retained; 32-bit index only when this group requires it.
    drawn.append(out)
    native.append(
      {
        "key": g["key"],
        "owners": g["owners"],
        "boxes": native_blocks(g),
        "rods": [],
        "positions": [],
        "indices": [],
        "colors": [],
      }
    )
  (DATA / "iccV199.json").write_bytes(encode({"sites": drawn}))
  (DATA / "iccV199Native.json").write_bytes(encode({"sites": native}))
  (DATA / "iccV199Navigation.json").write_bytes(encode({"buildings": nav}))
  (GEO / "icc-v199-exclusions.geojson").write_bytes(
    encode({"type": "FeatureCollection", "features": exclusions})
  )
  (GEO / "icc-v199-surface-receipt.json.gz").write_bytes(
    gzip.compress(encode({"surfaces": receipt}), mtime=0)
  )
  evidence = {
    "owners": OWNERS,
    "sourceParts": sum(len(o["parts"]) for o in source["owners"]),
    "navigationVolumes": len(nav),
    "skywayCorrection": {
      "part": BRIDGE_PART,
      "groundY": BRIDGE_BOTTOM,
      "topY": BRIDGE_TOP,
      "reason": "Exact source arm was falsely extruded to ground/main roof; source XZ retained, open underside interpreted with estimated clearance and measured western-hall roof datum.",
    },
    "retainedSurfaces": len(receipt),
    "drawnTriangles": sum(len(g["indices"]) // 3 for g in drawn),
    "drawnInstances": sum(len(g["boxes"]) + len(g["rods"]) for g in drawn),
    "nativeInstances": sum(len(g["boxes"]) for g in native),
    "displayEstimates": "Cladding/steel sections, glazing subdivisions and entrance fittings; no measured survey is claimed for those additions.",
    "terrain": "Existing flat Messe display datum3.55; measured part-relative heights retained.",
  }
  (GEO / "icc-v199-evidence.json").write_bytes(encode(evidence))
  print(evidence)


if __name__ == "__main__":
  build()
