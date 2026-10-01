"""Step 10: complete measured Moabit justice and Lesser-Ury exterior refinement."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
from build_bebelplatz_building_source import part_profile
from build_breitscheid_towers_v161 import normal_of, triangles_for
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_388_5820.zip"
DEST = ROOT / "src/app/src/data/moabitJusticeV166Source.json"
GROUND = 5.2
GROUPS = {
  "court": ["DEBE01YYK0002Nu1"],
  "prison": [
    "DEBE01YYK0002Mpl",
    "DEBE01YYK0002L01",
    "DEBE01YYK0002Sfv",
    "DEBE01YYK0002Sr5",
    "DEBE01YYK0002P5f",
    "DEBE01YYK0002OPP",
    "DEBE01YYK0002O8U",
    "DEBE01YYK0002Uay",
    "DEBE01YYK0002KWF",
    "DEBE01YYK0002UlJ",
    "DEBE01YYK0002KQc",
    "DEBE01YYK0003VGG",
    "DEBE01YYK0002UBO",
    "DEBE01YYK0002Sgs",
    "DEBE01YYK0002TBh",
    "DEBE01YYK0002Lxj",
    "DEBE01YYK0003UaN",
    "DEBE01YYK0002OIz",
    "DEBE01YYK0002N3G",
    "DEBE01YYK0002TVI",
    "DEBE01YYK0003UbO",
    "DEBE01YYK0002LZP",
    "DEBE01YYK0002Oyq",
    "DEBE01YYK0002PaG",
    "DEBE01YYK0002S00",
    "DEBE01YYK0002M4h",
    "DEBE01YYK0003Ugx",
    "DEBE01YYK0002Pm4",
    "DEBE01YYK0002UE6",
    "DEBE01YYK0003VCp",
    "DEBE01YYK0003Tth",
    "DEBE01YYK0003V5k",
    "DEBE01YYK0003V3k",
    "DEBE01YYK0003VNs",
    "DEBE01YYK0002TT9",
  ],
  "lesserUry": [
    "DEBE01YYK0002PHZ",
    "DEBE01YYK0002Lfo",
    "DEBE01YYK0002V4Y",
    "DEBE01YYK0002Ozk",
    "DEBE01YYK0002QTJ",
    "DEBE01YYK0002Qix",
    "DEBE01YYK0002TcT",
    "DEBE01YYK0002TJD",
    "DEBE01YYK0002MGF",
    "DEBE01YYK0002Rj9",
    "DEBE01YYK0002RDd",
    "DEBE01YYK0002OLJ",
  ],
}
BARRED = {
  "DEBE01YYK0002Sgs",
  "DEBE01YYK0002TBh",
  "DEBE01YYK0002N3G",
  "DEBE01YYK0002M4h",
  "DEBE01YYK0002LZP",
  "DEBE01YYK0002PaG",
}
GLASS = 0x354A4B
IRON = 0xA6AAA1
REFERENCES = [
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050355",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050319",
  "https://www.berlin.de/justizvollzug/anstalten/jva-moabit/die-anstalt/historie/",
  "https://commons.wikimedia.org/wiki/File:Moabit_Alt-Moabit_Untersuchungshaftanstalt-1.jpg",
  "https://commons.wikimedia.org/wiki/File:MoabitTurmstra%C3%9Fe_Kriminalgericht-1.jpg",
  "https://commons.wikimedia.org/wiki/File:Lesser-Ury-Weg.jpg",
]


def facade(rings: list, kind: str, barred: bool) -> list[list[float]]:
  """Add bounded exterior interpretation; every member is wall-clipped offline."""
  normal = normal_of(rings[0])
  if abs(normal[1]) > 0.01:
    return []
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
  )
  base = np.array(a)
  direction = np.array([b[0] - a[0], 0, b[2] - a[2]], dtype=float)
  length = float(np.linalg.norm(direction))
  if length < 1.4:
    return []
  direction /= length
  planar = [
    [(float(np.dot(np.subtract(p, base), direction)), p[1]) for p in ring]
    for ring in rings
  ]
  wall = Polygon(planar[0], planar[1:]).buffer(-0.025)
  yaw = math.atan2(-direction[2], direction[0])
  out = []

  def emit(
    u: float,
    y: float,
    w: float,
    h: float,
    color: int,
    role: int,
    offset: float = 0.09,
    depth: float = 0.12,
  ) -> None:
    if not wall.covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
      return
    p = base + direction * u + normal * offset
    out.append(
      [
        round(p[0], 3),
        round(y, 3),
        round(p[2], 3),
        round(w, 3),
        round(h, 3),
        depth,
        round(yaw, 6),
        color,
        role,
        float(normal[0]),
        float(normal[2]),
      ]
    )

  court = kind == "court"
  pitch_y = 4.45 if court else 3.35 if barred else 3.0
  bays = max(1, round(length / (3.5 if court else 2.75 if barred else 3.25)))
  pitch = length / bays
  for floor in range(14 if court else 10):
    y = GROUND + (3.1 if court else 2.6) + floor * pitch_y
    h = 2.9 if court else 1.7 if barred else 1.65
    w = min(1.7 if court else 1.05 if barred else 1.8, pitch * 0.65)
    for bay in range(bays):
      u = (bay + 0.5) * pitch
      if not wall.covers(
        box(u - w / 2 - 0.12, y - h / 2 - 0.1, u + w / 2 + 0.12, y + h / 2 + 0.1)
      ):
        continue
      emit(u, y, w, h, GLASS, 4 if barred else 1)
      frame = 0xD9D6C4 if court else 0xC6B389 if barred else 0xDDDACE
      emit(u, y - h / 2 - 0.08, w + 0.25, 0.16, frame, 2, 0.16, 0.24)
      emit(u, y + h / 2 + 0.06, w + 0.22, 0.14, frame, 2, 0.16, 0.22)
      if barred:
        # Distinct visible exterior bars; dimensions/spacing are display estimates.
        for t in [-0.30, 0, 0.30]:
          emit(u + t, y, 0.065, h, IRON, 3, 0.23, 0.09)
        for t in [-0.48, 0.48]:
          emit(u, y + t, w, 0.065, IRON, 3, 0.23, 0.09)
      else:
        emit(u, y, 0.07, h, frame, 2, 0.17, 0.10)
        emit(u, y + 0.30, w, 0.07, frame, 2, 0.17, 0.10)
        if court:
          for t in [-w / 2 - 0.1, w / 2 + 0.1]:
            emit(u + t, y, 0.16, h + 0.3, 0xC4BCA7, 2, 0.14, 0.20)
          emit(u, y + h / 2 + 0.2, 0.24, 0.30, 0xD4CCB8, 2, 0.2, 0.28)
  # Source-cut cornices, never plates extending across a court or roof gap.
  for i in range(1, 14 if court else 8):
    y = GROUND + i * pitch_y
    section = wall.intersection(LineString([(-1, y), (length + 1, y)]))
    for seg in (
      [section] if section.geom_type == "LineString" else getattr(section, "geoms", [])
    ):
      if seg.geom_type != "LineString" or seg.length < 0.8:
        continue
      u0, u1 = seg.bounds[0], seg.bounds[2]
      emit(
        (u0 + u1) / 2,
        y,
        u1 - u0 - 0.06,
        0.16 if court else 0.10,
        0xBBB4A1 if court else 0xAD936B if barred else 0xB9B7AB,
        2,
        0.14,
        0.21,
      )
  return out


def compact(blocks: dict[tuple[int, int, int], int]) -> list:
  """Merge exact adjacent equal-colour cells without erasing one occupied cell."""
  runs = [[x, y, z, 1, 1, 1, c] for (x, y, z), c in sorted(blocks.items())]
  for axis in [0, 2, 1]:
    groups: dict[tuple, list] = {}
    for r in runs:
      groups.setdefault(
        tuple(r[i] for i in range(7) if i not in [axis, axis + 3]), []
      ).append(r)
    runs = []
    for group in groups.values():
      group.sort(key=lambda r: r[axis])
      for r in group:
        if (
          runs
          and all(r[i] == runs[-1][i] for i in range(7) if i not in [axis, axis + 3])
          and runs[-1][axis] + runs[-1][axis + 3] == r[axis]
        ):
          runs[-1][axis + 3] += r[axis + 3]
        else:
          runs.append(r.copy())
  return [
    [x + w / 2, round(GROUND + y + h / 2, 3), z + d / 2, w, h, d, c]
    for x, y, z, w, h, d, c in runs
  ]


def build() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
  """Read selected whole parents once; separate archived evidence from runtime."""
  kinds = {pid: kind for kind, ids in GROUPS.items() for pid in ids}
  parents, parts, surfaces, details = [], [], [], []
  blocks: dict[tuple[int, int, int], int] = {}
  with zipfile.ZipFile(ARCHIVE) as archive:
    member = next(n for n in archive.namelist() if n.lower().endswith((".xml", ".gml")))
    with archive.open(member) as file:
      for _, element in ET.iterparse(file, events=("end",)):
        if element.tag != f"{{{NS['bldg']}}}Building":
          continue
        pid = element.get(GML_ID)
        if pid not in kinds:
          element.clear()
          continue
        kind = kinds[pid]
        raw = [part_profile(e) for e in leaf_building_parts(element) or [element]]
        offset = GROUND - min(p["ground_y_m"] for p in raw)
        parents.append(
          {
            "id": pid,
            "kind": kind,
            "sourceParts": raw,
            "displayOffsetY": round(offset, 3),
          }
        )
        for original in raw:
          p = json.loads(json.dumps(original))
          p.update(parentId=pid, kind=kind)
          p["ground_y_m"] = round(p["ground_y_m"] + offset, 3)
          p["top_y_m"] = round(p["top_y_m"] + offset, 3)
          for s in p["surfaces"]:
            for ring in s["rings"]:
              for q in ring:
                q[1] = round(q[1] + offset, 3)
            roof = s["kind"] == "RoofSurface"
            wall_color = (
              0xCEC8B5
              if kind == "court"
              else 0xBAA076
              if pid in BARRED
              else 0xC9C2AF
              if kind == "lesserUry"
              else 0xADA999
            )
            color = (0x635B53 if kind == "court" else 0x626663) if roof else wall_color
            ts = triangles_for(s["rings"])
            surfaces.append(
              {"partId": p["id"], "kind": s["kind"], "color": color, "triangles": ts}
            )
            if not roof:
              details.extend(facade(s["rings"], kind, pid in BARRED))
            for tri in ts:
              a, b, c = map(np.array, tri)
              n = max(
                1,
                math.ceil(
                  max(
                    np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b)
                  )
                  / 0.75
                ),
              )
              for i in range(n + 1):
                for j in range(n + 1 - i):
                  q = a + (b - a) * i / n + (c - a) * j / n
                  key = (math.floor(q[0]), math.floor(q[1] - GROUND), math.floor(q[2]))
                  if roof or key not in blocks:
                    blocks[key] = color
          parts.append(p)
        element.clear()
  assert {p["id"] for p in parents} == set(kinds)
  # Independently paint only existing surface cells with window colour.
  for x, y, z, w, h, _, yaw, color, role, _, _ in details:
    if role not in (1, 4):
      continue
    for u in np.arange(-w / 2, w / 2, 0.4):
      for v in np.arange(-h / 2, h / 2, 0.4):
        key = (
          math.floor(x + math.cos(yaw) * u),
          math.floor(y + v - GROUND),
          math.floor(z - math.sin(yaw) * u),
        )
        if key in blocks:
          blocks[key] = color
  # Native window anchors drive a finite independent axis-aligned block template.
  # This stores each window once instead of tens of thousands of duplicate rods.
  native_windows = []
  for x, y, z, w, h, _, yaw, _, role, nx, nz in details:
    if role != 4:
      continue
    edge_x = math.floor(x) + (1 if nx > 0 else 0)
    edge_z = math.floor(z) + (1 if nz > 0 else 0)
    distance = (edge_x - x) * nx + (edge_z - z) * nz + 0.08
    native_windows.append(
      [round(x + nx * distance, 3), y, round(z + nz * distance, 3), w, h, yaw]
    )
  union = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
  ids = {p["id"][-8:] for p in parts}
  legacy, ownership = [], []
  for p in json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]:
    poly = Polygon(
      [[x / 10, z / 10] for x, z in p["ring"]],
      [[[x / 10, z / 10] for x, z in r] for r in p["holes"]],
    ).buffer(0)
    overlap = poly.intersection(union).area / poly.area if poly.area else 0
    if p["id"] in ids or overlap > 0.90:
      legacy.append(p)
      ownership.append(
        {
          "id": p["id"],
          "coveredAreaRatio": round(overlap, 6),
          "reason": "exact official part identity"
          if p["id"] in ids
          else "bounded OSM footprint matched to complete official surfaces",
        }
      )
  cells: dict[tuple[int, int], float] = {}
  for x, y, z in blocks:
    cells[(x, z)] = max(cells.get((x, z), -999), round(GROUND + y + 1, 3))
  nav = {
    "parts": [{k: v for k, v in p.items() if k != "surfaces"} for p in parts],
    "parentIds": sorted(kinds),
    "legacyPrisms": legacy,
    "roofTriangles": [
      t for s in surfaces if s["kind"] == "RoofSurface" for t in s["triangles"]
    ],
    "nativeRoofCells": [[x, z, y] for (x, z), y in sorted(cells.items())],
  }
  evidence = {
    "parents": parents,
    "parts": parts,
    "legacyPrisms": legacy,
    "ownership": ownership,
    "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/" + ARCHIVE.name,
    "sourceSha256": hashlib.sha256(ARCHIVE.read_bytes()).hexdigest(),
    "license": "dl-de/zero-2-0",
    "references": REFERENCES,
    "osmIdentities": [
      "relation/7721745",
      "way/172318650",
      "way/4410152",
      "way/1097924830",
    ],
    "preservedAdjacentOwners": [
      "DEBE01YYK0002LQf",
      "DEBE01YYK0002Q0J",
      "DEBE01YYK0002MoE",
    ],
    "detailStatus": "Complete source walls, roofs and holes retained. Rigid vertical translation to existing 5.2m datum only. Original surfaces retained separately. Exterior fenestration, bars, cornices, pale sandstone and brick swatches are procedural visual interpretations, not surveyed openings. No prison interior, historical vanished building or Tegel geometry added.",
  }
  data = {
    "groundY": GROUND,
    "parts": [
      {"id": p["id"], "parentId": p["parentId"], "kind": p["kind"]} for p in parts
    ],
    "surfaces": surfaces,
    "facadeBoxes": [r[:9] for r in details],
    "nativeRuns": compact(blocks),
    "nativeBarWindows": native_windows,
    "nativeCellCount": len(blocks),
    "barredWindowCount": sum(r[8] == 3 and r[3] == 0.065 for r in details) // 3,
  }
  return data, nav, evidence


def main() -> None:
  data, nav, evidence = build()
  for suffix, content in [
    ("Source", data),
    ("Navigation", nav),
    ("Evidence", evidence),
  ]:
    DEST.with_name(f"moabitJusticeV166{suffix}.json").write_text(
      json.dumps(content, separators=(",", ":")) + "\n"
    )
  print(
    {
      k: len(data[k])
      for k in ["parts", "surfaces", "facadeBoxes", "nativeRuns", "nativeBarWindows"]
    }
  )
  print(
    {
      "parents": len(evidence["parents"]),
      "legacyPrisms": len(evidence["legacyPrisms"]),
      "barredWindows": data["barredWindowCount"],
      "nativeCells": data["nativeCellCount"],
    }
  )


if __name__ == "__main__":
  main()
