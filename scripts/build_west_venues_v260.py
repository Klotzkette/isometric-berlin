"""Step 10: complete cached City West venue surveys, with estimated fittings."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
from build_breitscheid_towers_v161 import normal_of, triangles_for
from build_citywest_cinemas_v166 import footprints, polygons_of
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DEST = ROOT / "src/app/src/data/westVenuesV260Source.json"
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
OWNERS = {
  "DEBE04YY500005Uo": ("Ludwig-Erhard-Haus", "386_5818", "16160637", "leh"),
  "DEBE04YY500007vQ": ("Delphi Filmpalast", "386_5818", "32861687", "delphi"),
  "DEBE04YY50000AZq": ("Renaissance-Theater", "386_5819", "48793287", "renaissance"),
}


def digest(value: Any) -> str:
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def make_payload() -> dict:
  """Keep all 88 measured parts and exact source rings; never edit old packets."""
  parents, parts, surfaces, archives = [], [], [], []
  for tile in sorted({v[1] for v in OWNERS.values()}):
    path = GEO / f"raw/lod2/LoD2_{tile}.zip"
    with zipfile.ZipFile(path) as z:
      tree = ET.fromstring(z.read(z.namelist()[0]))
    archives.append(
      {
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/{path.name}",
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      }
    )
    for parent in tree.findall(".//b:Building", NS):
      pid = parent.get("{" + NS["g"] + "}id")
      if pid not in OWNERS:
        continue
      name, _, legacy, kind = OWNERS[pid]
      datum = min(
        float(v)
        for e in parent.findall(".//b:GroundSurface//g:posList", NS)
        for v in e.text.split()[2::3]
      )
      parent_surfaces = []
      for part in parent.findall(".//b:BuildingPart", NS) or [parent]:
        sid = part.get("{" + NS["g"] + "}id")
        ss = []
        for boundary in part.findall("b:boundedBy", NS):
          for surface in boundary:
            for polygon in surface.findall(".//g:Polygon", NS):
              rings = []
              for e in polygon.findall(".//g:posList", NS):
                a = list(map(float, e.text.split()))
                ring = [
                  [
                    round(a[i] - 389500, 3),
                    round(a[i + 2] - datum + 5.2, 3),
                    round(5820000 - a[i + 1], 3),
                  ]
                  for i in range(0, len(a), 3)
                ]
                if ring[0] == ring[-1]:
                  ring.pop()
                rings.append(ring)
              role = surface.tag.split("}")[-1]
              color = (
                (0xA7B3B2 if role == "RoofSurface" else 0xADB5AF)
                if kind == "leh"
                else (0x777D76 if role == "RoofSurface" else 0xDECBA6)
                if kind == "renaissance"
                else (0x747D77 if role == "RoofSurface" else 0xD5C8A5)
              )
              if role == "RoofSurface":
                normal = normal_of(rings[0])
                light = (
                  0.85 + 0.17 * abs(normal[1]) + 0.08 * normal[0] - 0.05 * normal[2]
                )
                channels = [
                  min(255, round(((color >> shift) & 255) * light))
                  for shift in [16, 8, 0]
                ]
                color = (channels[0] << 16) + (channels[1] << 8) + channels[2]
              ss.append(
                {
                  "partId": sid,
                  "parentId": pid,
                  "kind": role,
                  "rings": rings,
                  "sourcePolygonId": polygon.get("{" + NS["g"] + "}id"),
                  "color": color,
                  "triangles": triangles_for(rings)
                  if role in ["WallSurface", "RoofSurface"]
                  else [],
                }
              )
        foot = footprints(ss)
        pts = [p for s in ss for r in s["rings"] for p in r]
        parts.append(
          {
            "id": sid,
            "parentId": pid,
            "building": name,
            "groundY": min(p[1] for p in pts),
            "topY": max(p[1] for p in pts),
            "polygons": [
              {
                "ring": [[round(x, 3), round(z, 3)] for x, z in p.exterior.coords[:-1]],
                "holes": [
                  [[round(x, 3), round(z, 3)] for x, z in r.coords[:-1]]
                  for r in p.interiors
                ],
              }
              for p in polygons_of(foot)
            ],
          }
        )
        surfaces.extend(ss)
        parent_surfaces.extend(ss)
      parents.append(
        {
          "id": pid,
          "name": name,
          "kind": kind,
          "tile": tile,
          "groundNHN": datum,
          "groundY": 5.2,
          "legacyId": legacy,
          "sourceGeometrySha256": digest(parent_surfaces),
        }
      )
  current_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  current = json.loads(current_path.read_text())
  legacy = [
    r for r in current["buildings"] if r["id"] in {v[2] for v in OWNERS.values()}
  ]
  conflicts = []
  for p in parents:
    old = next(r for r in legacy if r["id"] == p["legacyId"])
    old_poly = Polygon(
      [(x / 10, z / 10) for x, z in old["ring"]],
      [[(x / 10, z / 10) for x, z in h] for h in old["holes"]],
    )
    new = footprints([s for s in surfaces if s["parentId"] == p["id"]])
    conflicts.append(
      {
        "parentId": p["id"],
        "legacyId": old["id"],
        "legacySha256": digest(old),
        "oldArea": old_poly.area,
        "sourceArea": new.area,
        "overlapM2": old_poly.intersection(new).area,
        "legacyOnlyAreaM2": old_poly.difference(new).area,
        "sourceOnlyAreaM2": new.difference(old_poly).area,
      }
    )
  assert len(parents) == 3 and len(parts) == 88 and len(legacy) == 3
  return {
    "schemaVersion": 1,
    "parents": parents,
    "parts": parts,
    "surfaces": surfaces,
    "sourceArchives": archives,
    "legacyPrisms": legacy,
    "legacyFile": str(current_path.relative_to(ROOT)),
    "legacyFileSha256": hashlib.sha256(current_path.read_bytes()).hexdigest(),
    "sourceConflicts": conflicts,
    "licences": {"survey": "dl-de/zero-2-0", "osm": "ODbL-1.0"},
    "sourcePolicy": "Every measured source part, roof, wall and hole retained. Only three exact receipted OSM coarse owners yield after required replacement load. Facade glazing, ribs, trim, lettering and colors are reference-estimated fittings; no photograph is bundled. Delphi is the provisional interpretation of nearby old cinema.",
  }


def face_axes(surface: dict, footprint: Any) -> dict | None:
  """Resolve source outward facade planes independently from source winding."""
  from shapely.geometry import Point

  ring = surface["rings"][0]
  a, b = max(
    ((a, b) for a in ring for b in ring),
    key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
  )
  a, b = np.array([a[0], a[2]]), np.array([b[0], b[2]])
  length = float(np.linalg.norm(b - a))
  if length < 0.2:
    return None
  d = (b - a) / length
  n = np.array([d[1], -d[0]])
  if footprint.covers(Point((a + b) / 2 + n * 0.08)):
    n = -n
  if footprint.covers(Point((a + b) / 2 + n * 0.08)):
    return None
  poly = Polygon([(float(np.dot(np.array([p[0], p[2]]) - a, d)), p[1]) for p in ring])
  if not poly.is_valid:
    poly = poly.buffer(0)
  return {
    "a": a,
    "d": d,
    "n": n,
    "length": length,
    "poly": poly,
    "lo": min(p[1] for p in ring),
    "hi": max(p[1] for p in ring),
    "surfaceId": surface["sourcePolygonId"],
  }


def recognition(p: dict) -> tuple[list, list, list]:
  """Source-clipped window fields and measured-roof rib paths, all estimates."""
  from shapely.geometry import box

  details, native, ribs = [], [], []
  feet = {
    v["id"]: footprints([s for s in p["surfaces"] if s["parentId"] == v["id"]])
    for v in p["parents"]
  }
  kinds = {v["id"]: v["kind"] for v in p["parents"]}
  faces = []

  def put(
    f: dict,
    u: float,
    y: float,
    w: float,
    h: float,
    color: int,
    role: str,
    out: float = 0.16,
    depth: float = 0.08,
    clip: bool = True,
  ) -> None:
    if (
      w <= 0
      or h <= 0
      or (
        clip
        and not f["poly"]
        .buffer(0.015)
        .covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
      )
    ):
      return
    a = f["a"] + f["d"] * u + f["n"] * out
    details.append(
      [
        round(a[0], 3),
        round(y, 3),
        round(a[1], 3),
        round(w, 3),
        round(h, 3),
        depth,
        round(math.atan2(-f["d"][1], f["d"][0]), 7),
        color,
        role,
      ]
    )
    # Independently authored orthogonal strips; no rotated smooth instances.
    count = max(1, math.ceil(w / 1.0))
    for i in range(count):
      c = a + f["d"] * ((i + 0.5) * w / count - w / 2) + f["n"] * 0.85
      native.append(
        [
          round(c[0], 3),
          round(y, 3),
          round(c[1], 3),
          max(0.09, round(abs(f["d"][0]) * w / count + abs(f["n"][0]) * depth, 3)),
          round(h, 3),
          max(0.09, round(abs(f["d"][1]) * w / count + abs(f["n"][1]) * depth, 3)),
          0,
          color,
          role,
        ]
      )

  for s in p["surfaces"]:
    if s["kind"] != "WallSurface":
      continue
    f = face_axes(s, feet[s["parentId"]])
    if f is None:
      continue
    kind = kinds[s["parentId"]]
    f.update({"kind": kind})
    faces.append(f)
    length, lo, hi = f["length"], f["lo"], f["hi"]
    if length < 2 or hi - lo < 4:
      continue
    if kind == "leh":
      for y in np.arange(8.1, 42, 3.7):
        n = max(1, round(length / 2.3))
        for j in range(n):
          u = (j + 0.5) * length / n
          put(f, u, y, length / n * 0.89, 2.55, 0x62838D, "leh-glass-grid")
          put(
            f,
            u,
            y - 1.36,
            length / n * 0.98,
            0.16,
            0xCCD1CB,
            "leh-suspended-floor-band",
            0.22,
          )
          put(
            f, u + length / n * 0.45, y, 0.075, 2.6, 0xD3D9D3, "leh-metal-mullion", 0.25
          )
    elif kind == "renaissance" and min(f["a"][1], (f["a"] + f["d"] * length)[1]) > 861:
      for y in [9.2, 13.9, 18.8, 23.7]:
        n = max(1, round(length / 3.4))
        for j in range(n):
          u = (j + 0.5) * length / n
          put(
            f,
            u,
            y,
            min(1.65, length / n * 0.66),
            2.7,
            0x708C95,
            "renaissance-side-window",
          )
          put(f, u, y, 0.07, 2.7, 0xE7DAB8, "renaissance-window-centre", 0.26)
          put(
            f,
            u,
            y - 1.43,
            min(2, length / n * 0.8),
            0.16,
            0xEDDFC0,
            "renaissance-window-sill",
            0.24,
            0.24,
          )
      for y in [6.0, 15.5, 25.5]:
        put(
          f,
          length / 2,
          y,
          length - 0.12,
          0.20,
          0xBAA780,
          "renaissance-cornice",
          0.24,
          0.20,
        )

  # Five tall blue-glazed foyer fields follow the actual front source contour.
  front = [
    f
    for f in faces
    if f["kind"] == "renaissance"
    and f["lo"] < 6
    and max(f["a"][1], (f["a"] + f["d"] * f["length"])[1]) < 861.5
  ]
  center = np.array([-3278.2, 860.5])
  angles = np.linspace(math.radians(-164), math.radians(-15), 5)
  chosen = []
  for angle in angles:
    target = center + np.array([math.cos(angle), math.sin(angle)]) * 5
    f = min(
      front, key=lambda q: np.linalg.norm(q["a"] + q["d"] * q["length"] / 2 - target)
    )
    # A continuous estimated glazing field is tangent to the measured curved front.
    u = f["length"] / 2
    chosen.append(f)
    put(
      f, u, 10.2, 1.28, 9.3, 0x223E78, "renaissance-five-blue-lancets", 0.30, 0.1, False
    )
    for side in [-0.7, 0.7]:
      put(
        f,
        u + side,
        10.2,
        0.12,
        9.3,
        0xDACB9C,
        "renaissance-lancet-frame",
        0.42,
        0.12,
        False,
      )
    for y in np.arange(5.7, 14.7, 0.85):
      put(
        f,
        u,
        float(y),
        1.38,
        0.075,
        0xE4D3A3,
        "renaissance-blue-window-transom",
        0.43,
        0.12,
        False,
      )
    for offset in np.arange(0.08, 1.31, 0.14):
      width = 1.28 * math.sqrt(max(0, 1 - (offset / 1.35) ** 2))
      put(
        f,
        u,
        14.85 + float(offset),
        width,
        0.16,
        0x223E78,
        "renaissance-glazed-arch-crown",
        0.30,
        0.10,
        False,
      )
    for yy in [21.3, 25.4]:
      put(
        f, u, yy, 1.1, 2.5, 0x738B91, "renaissance-upper-front-windows", 0.3, 0.1, False
      )
      put(
        f,
        u,
        yy,
        0.065,
        2.5,
        0xE7DAB8,
        "renaissance-front-window-mullion",
        0.42,
        0.1,
        False,
      )
      put(
        f,
        u,
        yy - 1.34,
        1.35,
        0.15,
        0xE7DAB8,
        "renaissance-front-window-sill",
        0.42,
        0.18,
        False,
      )
    # Arch crown, all lengths are labelled reference estimates.
    for j in range(10):
      a, b = math.pi * j / 10, math.pi * (j + 1) / 10
      au, ay, bu, by = (
        u + math.cos(a) * 0.7,
        14.85 + math.sin(a) * 1.35,
        u + math.cos(b) * 0.7,
        14.85 + math.sin(b) * 1.35,
      )
      pa, pb = (
        f["a"] + f["d"] * au + f["n"] * 0.43,
        f["a"] + f["d"] * bu + f["n"] * 0.43,
      )
      ribs.append(
        [
          [*map(float, [pa[0], ay, pa[1]])],
          [*map(float, [pb[0], by, pb[1]])],
          0.11,
          0xDACB9C,
          "renaissance-lancet-crown",
        ]
      )
  # Shallow cornices over the five-window foyer follow each measured facet.
  for f in front:
    for y in [15.2, 18.0]:
      put(
        f,
        f["length"] / 2,
        y,
        f["length"] + 0.03,
        0.24,
        0xBCAA7E,
        "renaissance-curved-foyer-cornice",
        0.27,
        0.28,
      )

  # The front portico sits on the southern low projection, under the auditorium.
  fs = [
    f for f in faces if f["kind"] == "delphi" and f["length"] > 13 and f["a"][1] > 1387
  ]
  f = max(fs, key=lambda q: q["length"])
  u = f["length"] / 2
  put(f, u, 7.3, 4.6, 4.0, 0x343D3B, "delphi-entry", 0.22)
  put(f, u, 9.2, 9.3, 0.4, 0x9CABA8, "delphi-entry-canopy", 1.05, 1.9)
  # Main front lies above the lower projection and remains exposed at this height.
  a, b = np.array([-2957.865, 1383.955]), np.array([-2942.81, 1385.965])
  length = float(np.linalg.norm(b - a))
  d = (b - a) / length
  q = {
    "a": a,
    "d": d,
    "n": np.array([-d[1], d[0]]),
    "length": length,
    "poly": box(0, 11.4, length, 22.8),
  }
  for yy in [12.0, 20.9]:
    put(q, length / 2, yy, 11.2, 0.16, 0xBCAC88, "delphi-sign-panel-border", 0.30, 0.22)
  for side in [-5.6, 5.6]:
    put(
      q,
      length / 2 + side,
      16.45,
      0.16,
      9.05,
      0xBCAC88,
      "delphi-sign-panel-border",
      0.30,
      0.22,
    )
  put(
    q,
    length / 2,
    22.4,
    length - 0.12,
    0.26,
    0xE4DDC7,
    "delphi-front-cornice",
    0.29,
    0.3,
  )
  for side in [-0.85, 0.85]:
    put(f, u + side, 7.3, 0.1, 3.8, 0x80775F, "delphi-door-divider", 0.30)
  for shift in [-4.6, 4.6]:
    put(
      f, u + shift, 12.5, 0.64, 13.4, 0x50504A, "delphi-two-columns", 2.0, 0.64, False
    )
    for y in [5.8, 9.2, 19.4]:
      put(
        f, u + shift, y, 1.0, 0.35, 0x666359, "delphi-column-capital", 2.0, 0.9, False
      )
  # Fifteen ribs are sections of the complete surveyed metal roof, not guessed arcs.
  roof = [
    t
    for s in p["surfaces"]
    if kinds[s["parentId"]] == "leh" and s["kind"] == "RoofSurface"
    for t in s["triangles"]
  ]
  sections = []
  for index in range(15):
    station = 891.5 + index * 6.2
    cuts = []
    for tri in roof:
      v = [np.array(q, dtype=float) for q in tri]
      hits = []
      for a, b in zip(v, v[1:] + v[:1], strict=True):
        da, db = a[2] + a[0] * 0.115 - station, b[2] + b[0] * 0.115 - station
        if da * db < 0:
          hits.append(a + (b - a) * da / (da - db))
      if len(hits) == 2 and abs(hits[1][0] - hits[0][0]) > 0.001:
        cuts.append(sorted(hits, key=lambda q: q[0]))
    # Only the top visible roof at each interval receives a rib. Lower source
    # sheets remain complete in the shell; they are not duplicate rib candidates.
    points = sorted({round(float(v[0]), 6) for pair in cuts for v in pair})
    lines = []
    for x0, x1 in zip(points, points[1:]):
      xm = (x0 + x1) / 2

      def at(pair: list, x: float) -> np.ndarray:
        a, b = pair
        return a + (b - a) * ((x - a[0]) / (b[0] - a[0]))

      candidates = [pair for pair in cuts if pair[0][0] <= xm <= pair[1][0]]
      if not candidates or x1 - x0 < 0.04:
        continue
      pair = max(candidates, key=lambda pair: at(pair, xm)[1])
      a, b = at(pair, x0), at(pair, x1)
      if min(a[1], b[1]) < 25 or max(a[0], b[0]) < -2960:
        continue
      a[1] += 0.26
      b[1] += 0.26
      lines.append(
        [
          np.round(a, 3).tolist(),
          np.round(b, 3).tolist(),
          0.26,
          0x657679,
          "leh-fifteen-source-roof-ribs",
        ]
      )
    sections.append({"index": index, "station": station, "segments": len(lines)})
    ribs.extend(lines)
  p["roofRibSections"] = sections
  p["recognitionAnchors"] = {
    "delphiSign": {
      k: (v.tolist() if isinstance(v, np.ndarray) else v)
      for k, v in q.items()
      if k in ["a", "d", "n", "length"]
    },
    "delphiFront": {
      k: (v.tolist() if isinstance(v, np.ndarray) else v)
      for k, v in f.items()
      if k in ["a", "d", "n", "length"]
    },
    "renaissanceFiveWindowCenters": [
      (q["a"] + q["d"] * q["length"] / 2).tolist() for q in chosen
    ],
  }
  return details, native, ribs


def native_shell(p: dict) -> list:
  """Two-metre surface-only cells independently constructed from measured sheets."""
  cells = {}
  for s in p["surfaces"]:
    for tri in s["triangles"]:
      a, b, c = map(np.array, tri)
      steps = max(
        1,
        math.ceil(
          max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
          / 1.15
        ),
      )
      for i in range(steps + 1):
        for j in range(steps + 1 - i):
          v = a + (b - a) * i / steps + (c - a) * j / steps
          cell = tuple(math.floor(float(n) / 2) for n in v)
          cells[cell] = [
            cell[0] * 2 + 1,
            cell[1] * 2 + 1,
            cell[2] * 2 + 1,
            2,
            2,
            2,
            0,
            s["color"],
            "measured-surface-block",
          ]
  return list(cells.values())


def main() -> None:
  """Write only new v260 West files; native arrays stay packed until selected."""
  p = make_payload()
  details, native, ribs = recognition(p)
  p.update(
    {
      "facadeBoxes": details,
      "nativeDetails": native,
      "ribSegments": ribs,
      "nativeBlocks": native_shell(p),
    }
  )
  raw = json.dumps(p, separators=(",", ":")).encode()
  (GEO / "west-venues-v260-source.json.gz").write_bytes(gzip.compress(raw, mtime=0))

  def packed(rows: list, dtype: str) -> str:
    return base64.b64encode(np.asarray(rows, dtype=dtype).tobytes()).decode()

  triangles = [t for s in p["surfaces"] for t in s["triangles"]]
  colors = [s["color"] for s in p["surfaces"] for _ in s["triangles"]]
  runtime = {
    "schema": 1,
    "sourcePartIds": [part["id"] for part in p["parts"]],
    "sourcePositions": packed(triangles, "<f4"),
    "sourceColors": packed(colors, "<u4"),
    "facadeBoxes": packed([r[:8] for r in details], "<f4"),
    "nativeBoxes": packed([r[:8] for r in p["nativeBlocks"] + native], "<f4"),
    "ribSegments": ribs,
    "recognitionAnchors": p["recognitionAnchors"],
    "counts": {
      "parents": 3,
      "parts": 88,
      "surfaces": len(p["surfaces"]),
      "roofRibs": 15,
      "blueWindows": 5,
      "triangles": len(triangles),
      "facadeBoxes": len(details),
      "nativeShellBlocks": len(p["nativeBlocks"]),
      "nativeDetailBoxes": len(native),
    },
  }
  DEST.with_name("westVenuesV260.json").write_text(
    json.dumps(runtime, separators=(",", ":")) + "\n"
  )
  DEST.unlink(missing_ok=True)
  roofs = {}
  for x, y, z, *_ in p["nativeBlocks"]:
    roofs[(x, z)] = max(roofs.get((x, z), -100), y + 1)
  nav = {k: p[k] for k in ["parents", "parts", "legacyPrisms"]}
  nav.update(
    {
      "roofTriangles": [
        t for s in p["surfaces"] if s["kind"] == "RoofSurface" for t in s["triangles"]
      ],
      "nativeRoofCells": [[x, z, y] for (x, z), y in roofs.items()],
    }
  )
  DEST.with_name("westVenuesV260Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  evidence = {
    k: p[k]
    for k in [
      "sourceArchives",
      "parents",
      "sourceConflicts",
      "legacyFile",
      "legacyFileSha256",
      "sourcePolicy",
      "recognitionAnchors",
      "roofRibSections",
    ]
  }
  evidence.update(runtime["counts"])
  (GEO / "west-venues-v260-evidence.json").write_text(
    json.dumps(evidence, indent=2) + "\n"
  )
  print(runtime["counts"])


if __name__ == "__main__":
  main()
