"""Step 10: photo-led replacement of exact school facade estimates, not shells."""

from __future__ import annotations

import hashlib
import json
import math
import struct
from pathlib import Path

import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import normal_of
from build_steglitz_details_v246 import merge_boxes
from shapely.geometry import LineString, Polygon, box

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
OUT = DATA / "steglitzSchoolV250.json"
EVIDENCE = GEO / "steglitz-school-v250-evidence.json"
SCHOOL = "DEBE06YYB0000AUq"
HALL = "DEBE06YYB0000nL1"
BRICK, DARK, CREAM, GREEN = 0xA36750, 0x63544B, 0xE1DCCB, 0x849181
GLASS, LIGHT, WOOD, GOLD = 0x819A9B, 0xB6C6C2, 0x72503A, 0xCFB57D


def read(path: Path) -> dict:
  return json.loads(path.read_bytes())


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def fingerprint(value: object) -> str:
  """FNV-1a over typed values; float64 avoids Python/JS JSON spelling differences."""
  result = 2166136261

  def put(data: bytes) -> None:
    nonlocal result
    for byte in data:
      result = ((result ^ byte) * 16777619) & 0xFFFFFFFF

  def walk(item: object) -> None:
    if item is None:
      put(b"0")
    elif isinstance(item, bool):
      put(b"T" if item else b"F")
    elif isinstance(item, (float, int)):
      put(b"N" + struct.pack("<d", float(item)))
    elif isinstance(item, str):
      encoded = item.encode()
      put(b"S" + struct.pack("<I", len(encoded)) + encoded)
    elif isinstance(item, list):
      put(b"[" + struct.pack("<I", len(item)))
      for child in item:
        walk(child)
      put(b"]")
    elif isinstance(item, dict):
      put(b"{" + struct.pack("<I", len(item)))
      for key in sorted(item):
        walk(key)
        walk(item[key])
      put(b"}")
    else:
      raise TypeError(type(item))

  walk(value)
  return f"{result:08x}"


class Front:
  """Local facade coordinates and actual existing native support faces."""

  def __init__(self, rings: list, normal: list, key: str, native: list):
    pts = np.asarray(rings[0], dtype=float)
    aa, bb = max(
      ((a, b) for a in pts for b in pts),
      key=lambda p: np.linalg.norm((p[1] - p[0])[[0, 2]]),
    )
    # Consistent front direction: southwards on Heesestraße; eastwards at hall.
    if (bb[2] if abs(normal[0]) > 0.5 else bb[0]) < (
      aa[2] if abs(normal[0]) > 0.5 else aa[0]
    ):
      aa, bb = bb, aa
    self.a = aa
    self.d = bb - aa
    self.d[1] = 0
    self.length = float(np.linalg.norm(self.d))
    self.d /= self.length
    self.n = np.asarray(normal)
    self.rings, self.key = rings, key
    self.wall = Polygon(
      [[(float((np.asarray(p) - aa) @ self.d), p[1]) for p in r] for r in rings][0]
    )
    self.base, self.top = self.wall.bounds[1], self.wall.bounds[3]
    self.yaw = -math.atan2(self.d[2], self.d[0])
    self.axis = 0 if abs(self.n[0]) > 0.5 else 2
    self.cross = 2 - self.axis
    self.sign = 1 if self.n[self.axis] > 0 else -1
    self.support = []
    for r in native:
      # Greedy native runs can extend far inside the school. Their centre is
      # not a facade test: test the actual outward face and projected extent.
      p = np.asarray(r[:3], dtype=float)
      p[self.axis] += self.sign * r[self.axis + 3] / 2
      u = float((p - aa) @ self.d)
      radius = abs(self.d[self.cross]) * r[self.cross + 3] / 2
      if (
        abs(float((p - aa) @ self.n)) < 1.8
        and u + radius > 0
        and u - radius < self.length
        and r[1] + r[4] / 2 >= self.base
        and r[1] - r[4] / 2 <= self.top
      ):
        self.support.append(r)

  def point(self, u: float, y: float, out: float = 0.20) -> list:
    p = self.a + self.d * u + self.n * out
    return [round(float(p[0]), 4), round(y, 4), round(float(p[2]), 4)]

  def owns(self, row: list, margin: float = 0.6) -> bool:
    p = np.asarray(row[:3])
    u = float((p - self.a) @ self.d)
    return abs(float((p - self.a) @ self.n)) < margin and self.wall.buffer(0.02).covers(
      __import__("shapely").geometry.Point(u, p[1])
    )

  def native_member(
    self, target: list, u: float, y: float, w: float, h: float, color: int, out: float
  ) -> None:
    """Split exactly at old orthogonal skin boundaries; no rotated native boxes."""
    c = self.point(u, y, 0)
    half = abs(self.d[self.cross]) * w / 2
    low, high = c[self.cross] - half, c[self.cross] + half
    candidates = [
      r
      for r in self.support
      if r[self.cross] + r[self.cross + 3] / 2 > low
      and r[self.cross] - r[self.cross + 3] / 2 < high
    ]
    cuts = sorted(
      {
        low,
        high,
        *[
          max(low, min(high, r[self.cross] + s * r[self.cross + 3] / 2))
          for r in candidates
          for s in [-1, 1]
        ],
      }
    )
    for a, b in zip(cuts, cuts[1:]):
      if b - a < 0.001:
        continue
      support = [
        r
        for r in candidates
        if r[self.cross] - r[self.cross + 3] / 2 - 0.001
        <= (a + b) / 2
        <= r[self.cross] + r[self.cross + 3] / 2 + 0.001
      ]
      if not support:
        continue
      # Keep one outer envelope per lateral source slice across all heights.
      # Otherwise the prior voxel window register imprints notches into the new
      # openings and makes retained wall cells cut through glazing and doors.
      plane = (
        max(self.sign * r[self.axis] + r[self.axis + 3] / 2 for r in support)
        * self.sign
      )
      row = [0, y, 0, 0.06, h, 0.06, color]
      row[self.axis] = plane + self.sign * out
      row[self.cross] = (a + b) / 2
      row[self.cross + 3] = b - a
      target.append(row)


def build() -> tuple[dict, dict]:
  source = read(DATA / "steglitzV182Source.json")
  native = read(DATA / "steglitzV182Native.json")["boxes"]
  old205 = next(
    s for s in read(DATA / "schoolsPlacesV205.json")["schools"] if s["owner"] == SCHOOL
  )
  faces = [
    Front(f["rings"], f["normal"], f"heese-{i}", native)
    for i, f in enumerate(old205["faces"])
  ]
  archive = GEO / "raw/lod2/LoD2_386_5813.zip"
  parent = extract_parent(archive, HALL)
  hallfaces = []
  for part in map(part_profile, leaf_building_parts(parent)):
    for i, s in enumerate(part["surfaces"]):
      if s["kind"] != "WallSurface":
        continue
      rings = [
        [[p[0], round(p[1] - 10.39, 3), p[2]] for p in ring] for ring in s["rings"]
      ]
      n = normal_of(rings[0]).tolist()
      if max(math.dist(a, b) for a in rings[0] for b in rings[0]) < 0.5:
        continue
      hallfaces.append(Front(rings, n, f"{part['id']}/{i}", native))
  drawn, rods, blocks = [], [], []
  audit = []

  def member(
    f: Front,
    u: float,
    y: float,
    w: float,
    h: float,
    color: int,
    depth: float = 0.07,
    out: float = 0.22,
  ) -> None:
    if not f.wall.buffer(0.001).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
      return
    drawn.append([*f.point(u, y, out), w, h, depth, f.yaw, color])
    f.native_member(blocks, u, y, w, h, color, out)

  def stroke(f: Front, a: tuple, b: tuple, color: int, width: float = 0.09) -> None:
    if not f.wall.buffer(0.001).covers(
      LineString([a, b]).buffer(width / 2, cap_style=2)
    ):
      return
    rods.append([*f.point(*a, 0.29), *f.point(*b, 0.29), width, color])
    steps = max(1, math.ceil(math.dist(a, b) / 0.24))
    for i in range(steps):
      t = (i + 0.5) / steps
      f.native_member(
        blocks,
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        width,
        0.24,
        color,
        0.29,
      )

  def arch(
    f: Front,
    u: float,
    y: float,
    w: float,
    rise: float,
    color: int,
    width: float = 0.10,
    n: int = 8,
  ) -> None:
    pts = [
      (u + w / 2 * math.cos(math.pi * i / n), y + rise * math.sin(math.pi * i / n))
      for i in range(n + 1)
    ]
    for a, b in zip(pts, pts[1:]):
      stroke(f, a, b, color, width)

  def roundel(f: Front, u: float, y: float, r: float) -> None:
    # A ring plus centre cross preserves the oculus opening, no solid disk.
    for radius, col, width in [(r, CREAM, 0.12), (r * 0.72, DARK, 0.055)]:
      pts = [
        (
          u + radius * math.cos(math.tau * i / 12),
          y + radius * math.sin(math.tau * i / 12),
        )
        for i in range(13)
      ]
      for a, b in zip(pts, pts[1:]):
        stroke(f, a, b, col, width)
    member(f, u, y, r * 1.18, r * 1.18, LIGHT, 0.04, 0.16)

  def window(
    f: Front, u: float, y: float, w: float = 1.42, h: float = 3.2, arched: bool = True
  ) -> None:
    member(f, u, y, w, h, GLASS, 0.045, 0.13)
    member(f, u, y + h * 0.30, w - 0.12, h * 0.34, LIGHT, 0.045, 0.17)
    for dx in [-w / 2, w / 2, 0]:
      member(f, u + dx, y, 0.075, h, CREAM, 0.08, 0.24)
    for yy in [y - h / 2, y + h / 2, y + 0.48]:
      member(f, u, yy, w + 0.12, 0.09, CREAM, 0.09, 0.25)
    if arched:
      arch(f, u, y + h / 2 + 0.09, w + 0.30, 0.25, DARK, 0.15, 6)
    member(f, u, y - h / 2 - 0.17, w + 0.35, 0.16, DARK, 0.15, 0.23)

  def diamonds(f: Front, left: float, right: float, y: float) -> None:
    member(f, (left + right) / 2, y, right - left, 0.72, GREEN, 0.045, 0.13)
    for u in np.arange(left + 0.23, right - 0.12, 0.55):
      pts = [(u - 0.19, y), (u, y + 0.24), (u + 0.19, y), (u, y - 0.24), (u - 0.19, y)]
      for a, b in zip(pts, pts[1:]):
        stroke(f, a, b, CREAM, 0.055)

  for k, f in enumerate(faces):
    before = (len(drawn), len(rods), len(blocks))
    L = f.length
    # Three photographed occupied storeys above a visibly distinct basement.
    centers = (
      [(i + 0.5) * L / 6 for i in range(6)]
      if k
      else [L * 0.18 + dx for dx in [-1.7, 0, 1.7]]
      + [L * 0.50 + dx for dx in [-1.7, 0, 1.7]]
      + [L * 0.82 + dx for dx in [-1.7, 0, 1.7]]
    )
    for y in [9.25, 14.85]:
      for u in centers:
        if k == 0 and y < 10 and abs(u - L / 2) < 3.1:
          continue
        window(f, float(u), y)
    if k:
      for u in centers:
        window(f, u, 19.25, h=2.5)
      diamonds(f, 0.5, L - 0.5, 16.95)
    else:
      for u in [L * 0.18, L * 0.50, L * 0.82]:
        # Three great Aula arches, each with three lower lights and one oculus.
        for dx in [-1.36, 0, 1.36]:
          window(f, u + dx, 20.55, 1.06, 3.95, False)
        arch(f, u, 22.62, 4.8, 2.6, DARK, 0.27, 12)
        arch(f, u, 22.62, 4.38, 2.3, CREAM, 0.12, 12)
        roundel(f, u, 23.58, 0.82)
        diamonds(f, u - 2.4, u + 2.4, 17.30)
        # Pale/gold ornamental corner panels remain abstract, not copied art.
        for dx in [-2.43, 2.43]:
          member(f, u + dx, 24.75, 0.52, 1.62, GOLD, 0.045, 0.13)
          for yy in [24.2, 24.75, 25.3]:
            stroke(f, (u + dx - 0.18, yy), (u + dx, yy + 0.16), DARK, 0.07)
            stroke(f, (u + dx, yy + 0.16), (u + dx + 0.18, yy), DARK, 0.07)
        member(f, u, 25.63, 5.4, 0.25, GOLD, 0.045, 0.13)
      door = L / 2
      member(f, door, 8.9, 4.0, 4.45, WOOD, 0.07, 0.18)
      for dx in [-1.78, -0.60, 0.60, 1.78]:
        member(f, door + dx, 9.1, 0.09, 4.2, 0xB6A07B, 0.07, 0.29)
      member(f, door, 8.1, 3.7, 0.12, 0xB6A07B, 0.08, 0.29)
      arch(f, door, 11.12, 4.45, 1.4, DARK, 0.25, 12)
      # Gold word outline is handled as compact procedural strokes by the root.
    for u in centers:
      member(f, u, 4.8, 1.35, 1.55, DARK, 0.05, 0.15)
      for dx in [-0.36, 0, 0.36]:
        member(f, u + dx, 4.8, 0.045, 1.45, 0x888177, 0.06, 0.24)
    for y in [6.20, 11.65, 12.08, 12.47]:
      member(f, L / 2, y, L - 0.12, 0.13, DARK, 0.065, 0.17)
    for y in [7.00, 7.45, 7.90, 8.35, 8.80, 9.25, 9.70, 10.15, 10.60, 11.05]:
      # Brick striping only between bays; don't overpaint photographed glazing.
      for a, b in [(0, 0.60), (L - 0.60, L)]:
        member(f, (a + b) / 2, y, b - a, 0.075, DARK, 0.045, 0.19)
    for u in np.arange(0.3, L - 0.2, 0.8):
      member(f, float(u), f.top - 0.35, 0.28, 0.28, DARK, 0.12, 0.22)
    for u in [0.12, L - 0.12]:
      member(f, u, (f.base + f.top) / 2, 0.12, f.top - f.base - 0.1, DARK, 0.11, 0.26)
    audit.append(
      dict(
        key=f.key,
        drawn=[before[0], len(drawn)],
        rods=[before[1], len(rods)],
        native=[before[2], len(blocks)],
      )
    )

  # Exact south-facing hall facade, 23.86m wide, from the retained LoD2 part.
  main = next(f for f in hallfaces if f.key == "DEBE3DwLrQGxJf5p/6")
  for f in hallfaces:
    if f.length < 2:
      continue
    member(f, f.length / 2, f.top - 0.17, f.length - 0.10, 0.22, 0xCBD0CB, 0.15, 0.15)
  for y, h in [(7.1, 4.65), (12.55, 2.65)]:
    member(main, main.length / 2, y, main.length - 1, h, 0xB2C3C3, 0.05, 0.13)
    n = 20
    for i in range(n + 1):
      u = 0.5 + (main.length - 1) * i / n
      member(main, u, y, 0.075, h, 0x7E8989, 0.08, 0.22)
    for yy in [y - h / 2, y + h / 2]:
      member(main, main.length / 2, yy, main.length - 0.8, 0.12, 0x919995, 0.1, 0.23)
    if y < 10:
      member(main, main.length / 2, y, main.length - 0.85, 0.08, 0x8D9692, 0.08, 0.23)
    # School panorama: mostly opaque glazing; clear ventilation panels occupy
    # selected half-fields below and only two different-height fields above.
    vents = (
      [(4, -0.30, 0.28), (12, 0.0, 0.92)]
      if y > 10
      else [
        (1, 0.25, 0.46),
        (5, 0.25, 0.46),
        (12, 0.25, 0.46),
        (19, 0.25, 0.46),
        (6, -0.25, 0.46),
        (10, -0.25, 0.46),
      ]
    )
    for i, dy, height in vents:
      u = 0.5 + (main.length - 1) * (i + 0.5) / n
      member(
        main,
        u,
        y + h * dy,
        (main.length - 1) / n * 0.65,
        h * height,
        0x8EAAAA,
        0.035,
        0.17,
      )
  stair = next(f for f in hallfaces if f.key == "DEBE3DLmzjJy6MKc/0")
  roundel(stair, stair.length / 2, 8.5, 0.64)
  entry = next(f for f in hallfaces if f.key == "DEBE3DZj7AamuCr3/1")
  member(entry, entry.length * 0.65, 5.05, 1.8, 2.65, 0x5C7679, 0.06, 0.16)
  member(entry, entry.length * 0.65, 5.05, 0.08, 2.65, CREAM, 0.08, 0.25)
  # Rear high clerestory row: both primary archive and indoor hall image agree.
  rear = next(f for f in hallfaces if f.key == "DEBE3DwLrQGxJf5p/5")
  for i in range(10):
    window(rear, (i + 0.5) * rear.length / 10, 13.7, 1.35, 0.85, False)

  # The measured shells/roof vertices are immutable. Only original unsurveyed
  # colour/material estimates change at these identified exact surface indices.
  surface_colors = []
  for i, s in enumerate(source["surfaces"]):
    if s["owner"] == HALL and s["color"] == 0xB7B2A4:
      surface_colors.append([i, 0xDDDCD2])
    elif s["owner"] == SCHOOL and s["color"] == 0xB9896C:
      if any(
        all(f.owns([*p, 0, 0, 0, 0, 0], 0.01) for t in s["triangles"] for p in t)
        for f in faces
      ):
        surface_colors.append([i, BRICK])
  remove182 = [
    i
    for i, r in enumerate(source["boxes"])
    if any(f.owns(r, 0.20) for f in faces + hallfaces)
  ]
  recolors = []
  for i, r in enumerate(native):
    if r[6] not in [0x51666A, 0xDDD4BF, 0xB9896C, 0xB7B2A4]:
      continue
    fs = faces if r[6] != 0xB7B2A4 else []
    if any(f.owns(r, 1.1) for f in fs):
      recolors.append([i, BRICK])
    elif any(f.owns(r, 1.1) for f in hallfaces):
      recolors.append([i, 0xDDDCD2])
  counts246 = read(GEO / "steglitz-details-v246-evidence.json")["counts"]
  replacements = {
    "v182.boxes": remove182,
    "v205.boxes": list(range(len(old205["boxes"]))),
    "v205.rods": list(range(len(old205["rods"]))),
    "v205.nativeRows": list(range(len(old205["nativeRows"]))),
    "v246.boxes": list(range(counts246["schoolDrawn"])),
    "v246.nativeRows": list(range(counts246["schoolNative"])),
  }
  old246 = read(DATA / "steglitzV246Details.json")
  fingerprints = {
    key: fingerprint(value)
    for key, value in {
      "sourceBoxes": source["boxes"],
      "sourceSurfaces": source["surfaces"],
      "nativeRows": native,
      "refinementsBoxes": old246["boxes"],
      "refinementsNativeRows": old246["nativeRows"],
      "entry205": old205,
    }.items()
  }

  def rounded(rows: list) -> list:
    return [[round(float(v), 4) for v in r[:-1]] + [int(r[-1])] for r in rows]

  drawn, rods = rounded(drawn), rounded(rods)
  blocks = merge_boxes(rounded(blocks))
  # Store nearby coordinates relative to a fixed origin for a small download.
  origin = [-3200, 0, 6800]
  for rows in [drawn, blocks]:
    for r in rows:
      for j in range(3):
        r[j] = round(r[j] - origin[j], 4)
  for r in rods:
    for j in range(6):
      r[j] = round(r[j] - origin[j % 3], 4)
  model = {
    "version": 250,
    "origin": origin,
    "boxes": drawn,
    "rods": rods,
    "nativeRows": blocks,
    "remove": replacements,
    "fingerprints": fingerprints,
    "surfaceColors": surface_colors,
    "nativeColors": recolors,
    "label": {
      "center": faces[0].point(faces[0].length / 2, 12.8, 0.32),
      "direction": [float(faces[0].n[2]), 0, float(-faces[0].n[0])],
      "normal": faces[0].n.tolist(),
      "text": "GYMNASIUM",
      "height": 0.50,
      "color": GOLD,
    },
  }
  inputs = [
    "steglitzV182Source.json",
    "steglitzV182Native.json",
    "steglitzV182Navigation.json",
    "schoolsPlacesV205.json",
    "schoolsV185.json",
    "schoolCultureV228.json",
    "steglitzV246Details.json",
  ]
  evidence = {
    "version": 250,
    "owners": [SCHOOL, HALL],
    "sourceSha256": {str((DATA / f).relative_to(ROOT)): sha(DATA / f) for f in inputs},
    "archiveSha256": sha(archive),
    "faces": [
      dict(key=f.key, rings=f.rings, normal=f.n.tolist()) for f in faces + hallfaces
    ],
    "counts": {
      "boxes": len(drawn),
      "rods": len(rods),
      "nativeRows": len(blocks),
      "surfaceColours": len(surface_colors),
      "nativeColours": len(recolors),
      "removedDrawnBoxes182": len(remove182),
    },
    "fingerprints": fingerprints,
    "recognitionRanges": audit,
    "policy": "Exact old photographic estimates are superseded; measured sheets, source coordinates, roofs, footprints and unrelated detail remain unchanged. Drawn mobile equals desktop; native remains axis aligned. Aperture measurements, fittings and colours are photo-estimated, not a survey. No photographs/textures ship.",
    "references": [
      {
        "url": "https://rundgang.gymnasiumsteglitz.de/#g281",
        "use": "Current school-operated courtyard reference; white two-storey hall, long divided glazing, round stair window. Reference only.",
      },
      {
        "url": "https://dashboard.gymnasiumsteglitz.de/f/Bericht-06Y13.pdf",
        "use": "Small two-storey sports hall, basketball-sized ground hall, smaller upper gymnastics hall.",
      },
      {
        "url": "https://www.klw-berlin.de/gymnasium-steglitz/",
        "use": "2010–2012 insulation/window renovation; archive red brick predates white school tour; colours follow later school tour.",
      },
      {
        "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065532",
        "use": "Progymnasium, Heesestraße 15; 1890 Techow. School inspection says 1896; dating discrepancy does not affect source geometry.",
      },
      {
        "source": "Owner photos 20 October 2026, BBA9F225-1033-4902-9EEA-019F872FA338 images 1–4",
        "use": "Three front storeys plus basement, triple Aula arches/oculi, diamond spandrels, masonry bands, wood arch entrance. Reference only.",
      },
    ],
  }
  return model, evidence


if __name__ == "__main__":
  model, evidence = build()
  OUT.write_text(json.dumps(model, separators=(",", ":")) + "\n")
  EVIDENCE.write_text(json.dumps(evidence, indent=2) + "\n")
  print(OUT.name, OUT.stat().st_size, evidence["counts"])
