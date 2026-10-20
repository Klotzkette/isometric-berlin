"""Source-bound modern facade correction: Choriner Hoefe and Zehdenicker 7A.

Architect photographs are reference only. Complete retained city bodies, courts,
roof sheets and entrances remain authoritative. This generates shallow members,
never a new envelope; dimensions of facade fittings are proportional estimates.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

from build_bebelplatz_building_source import extract_parent, part_profile
from build_schools_places_v205 import Face, group
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "alt-mitte-v169/source-391_5821-00.json.gz"
ZIP = GEO / "raw/lod2/LoD2_391_5821.zip"
OWNERS = {
  "DEBE01YYK00005YZ": ("schiffer", "235997895"),
  "DEBE01YYK00007np": ("collignon", "235997891"),
  "DEBE01YYK0000En7": ("collignon", "235997891"),
  "DEBE01YYK00001UT": ("haas", "235997892"),
  "DEBE01YYK00000vQ": ("haas", "235997894"),
  "DEBE00YY1JO0001g": ("zehdenicker7a", "477303813"),
}
COLORS = [
  0xD6CEB4,  # warm Schiffer clinker
  0xE7E2D1,  # HAAS light clinker / render
  0xE8E6DC,  # Collignon white frames
  0xE6D8BD,  # 7A cream render
  0xCBB6A5,  # recessed 7A upper storey
  0x5D7476,  # reflected glass; never unlit black holes
  0x8FABA9,  # sky reflection / balcony glass
  0x59605E,  # dark window frame
  0xB6B9AF,  # pale metal handrails
  0x95816A,  # Schiffer warm bronze/wood frames
  0x9C9C8B,  # brick joint / shadow
]


def read(path: Path) -> dict:
  return json.loads(path.read_text())


def fingerprint(rows: list) -> list[int]:
  """Same exact numeric receipt as the runtime; not a spatial suppression mask."""
  a, b = 2166136261, 5381
  for ch in ";".join(",".join(f"{float(v):.6f}" for v in row) for row in rows):
    a = ((a ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    b = ((b * 33) ^ ord(ch)) & 0xFFFFFFFF
  return [len(rows), a, b]


def old_face_rows(faces: list) -> list:
  return [
    [*f["a"], *f["b"], *f["normal"], f["wallBottom"], f["wallTop"]] for f in faces
  ]


def load_parents() -> tuple[list, list]:
  """No downloads: extract retained official sources and their existing datums."""
  all_parents = json.loads(gzip.decompress(SOURCE.read_bytes()))["buildings"]
  offsets = read(DATA / "weinbergBuildingOffsetsV176.json")["offsets"]
  selected = []
  for raw in all_parents:
    if raw["id"] not in OWNERS:
      continue
    b = json.loads(json.dumps(raw))
    b["offset"] = offsets[b["id"]]
    for p in b["parts"]:
      for s in p["surfaces"]:
        for ring in s["rings"]:
          for v in ring:
            v[1] += b["offset"]
    selected.append(b)
  owner = "DEBE00YY1JO0001g"
  parent = extract_parent(ZIP, owner)
  parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
  # ZIP coordinates are already NHN-30. Applying Weinberg's +6.04 again would
  # raise this house into the air; the other five use their v169 3 m datum.
  selected.append({"id": owner, "offset": 0, "parts": parts})
  return selected, all_parents


def footprint(part: dict):
  if "footprintPolygons" in part:
    return unary_union(
      [Polygon(p["ring"], p["holes"]) for p in part["footprintPolygons"]]
    )
  return Polygon(part["ring"], part["holes"])


def previous() -> dict:
  north = read(DATA / "northV185.json")
  faces = [f for f in north["faces"] if f["kind"] == "choriner"]
  old205 = next(
    g
    for g in read(DATA / "schoolsPlacesV205.json")["places"]
    if g["name"] == "Choriner Höfe – street fronts"
  )
  old230 = next(
    g
    for g in read(DATA / "centralNamedV230.json")["sites"]
    if g["key"] == "choriner-hoefe"
  )
  # The first 21 drawn / 63 native members are the old generic window-grid
  # joints/reflections. All later members are valid measured roof-edge coping.
  # Derive that split from the actual two facade loops, not a geographic mask.
  from build_central_named_v230 import choriner

  empty_roofs = choriner({"chorinerRoofSheets": []})
  for key in ["boxes", "nativeRows"]:
    empty_roofs[key] = [[round(float(v), 4) for v in row] for row in empty_roofs[key]]
    assert old230[key][: len(empty_roofs[key])] == empty_roofs[key]
  return {
    "v185": fingerprint(old_face_rows(faces)),
    "v205": {k: fingerprint(old205[k]) for k in ["boxes", "rods", "nativeRows"]},
    "v230": {k: fingerprint(empty_roofs[k]) for k in ["boxes", "nativeRows"]},
  }


class Recipe:
  """Local facade plane recipes, clipped offline; native is rastered at runtime."""

  def __init__(self, face: Face, owner: str, pid: str, sheet: int, style: str):
    self.face = face
    self.members = []
    self.roles = []
    self.raw = {
      "owner": owner,
      "partId": pid,
      "sheet": sheet,
      "style": style,
      "a": [round(float(face.a[0]), 4), round(float(face.a[2]), 4)],
      "t": [round(float(face.d[0]), 9), round(float(face.d[2]), 9)],
      "n": [round(float(face.n[0]), 9), round(float(face.n[2]), 9)],
      "members": self.members,
    }

  def add(self, u, y, w, h, color, out=0.60, depth=0.055, role="detail"):
    if min(w, h) <= 0.035:
      return
    values = [round(v * 1000) for v in [u, y, w, h, out, depth]]
    qu, qy, qw, qh = [v / 1000 for v in values[:4]]
    if not self.face.wall.buffer(0.0015).covers(
      box(qu - qw / 2, qy - qh / 2, qu + qw / 2, qy + qh / 2)
    ):
      return
    self.members.append([*values, color])
    self.roles.append(role)

  def skin(self, color):
    f = self.face
    ys = sorted({round(p[1], 5) for p in f.wall.exterior.coords})
    for low, high in zip(ys, ys[1:]):
      if high - low < 0.08:
        continue
      # Intersect both band boundaries, keeping even stepped/angled wall tops
      # and holes open. No rectangle can bridge an absent wall or a portal.
      low += 0.025
      high -= 0.025
      spans = []
      for y in [low, high, (low + high) / 2]:
        line = LineString([(f.left - 1, y), (f.right + 1, y)])
        spans.append(f.wall.intersection(line))
      common = spans[0]
      # Turn each horizontal interval into u-space; y differs per sample.
      intervals = []
      for geo in spans:
        intervals.append(
          unary_union(
            [
              LineString([(g.bounds[0], 0), (g.bounds[2], 0)])
              for g in (geo.geoms if hasattr(geo, "geoms") else [geo])
              if g.geom_type == "LineString"
            ]
          )
        )
      common = intervals[0].intersection(intervals[1]).intersection(intervals[2])
      for g in common.geoms if hasattr(common, "geoms") else [common]:
        if g.is_empty:
          continue
        a, _, b, _ = g.bounds
        self.add(
          (a + b) / 2,
          (low + high) / 2,
          b - a - 0.06,
          high - low,
          color,
          0.535,
          0.045,
          "source-wall-facing",
        )

  def window(self, u, y, w, h, frame=7, balcony=False):
    self.add(u, y, w + 0.14, h + 0.14, frame, role="reveal")
    self.add(u, y, w, h, 5, 0.655, role="glazing")
    self.add(
      u - w * 0.26, y + h * 0.16, w * 0.40, h * 0.36, 6, 0.690, 0.035, "reflection"
    )
    self.add(u, y, 0.065, h, frame, 0.710, 0.04, "mullion")
    if balcony:
      self.add(
        u, y - h / 2 + 0.50, w + 0.25, 0.84, 6, 0.80, 0.07, "glass-balcony-reading"
      )
      self.add(u, y - h / 2 + 0.97, w + 0.30, 0.065, 8, 0.85, 0.07, "handrail")


def decorate(r: Recipe, ground: float):
  f = r.face
  style = r.raw["style"]
  mid, width = (f.left + f.right) / 2, f.right - f.left
  is84street = style == "schiffer" and f.n[0] > 0.94
  street = is84street or (style in ["collignon", "haas"] and f.n[2] > 0.80)
  color = {"schiffer": 0, "haas": 1, "collignon": 2, "zehdenicker7a": 3}[style]
  r.skin(color)
  # Continuous fine clinker courses, sparse enough to remain legible in iso.
  if style in ["schiffer", "haas"]:
    for level in range(1, 7):
      y = ground + level * 3.38
      if f.base + 0.15 < y < f.top - 0.2:
        r.add(mid, y, width - 0.16, 0.045, 10, 0.57, 0.035, "clinker-course")
  for level in range(7):
    y = ground + 1.67 + level * 3.38
    if y - 1.24 < f.base + 0.10 or y + 1.24 > f.top - 0.12:
      continue
    if is84street and level >= 2:
      # Schiffer's documented continuous upper ribbons, rather than the old
      # generic three-bay punched-window grid on only one short facade.
      r.add(mid, y, width - 0.16, 2.63, 7, 0.60, role="ribbon-reveal")
      r.add(mid, y, width - 0.25, 2.48, 5, 0.655, role="continuous-window-ribbon")
      bays = max(1, round(width / 1.50))
      for j in range(bays):
        u = f.left + (j + 0.5) * width / bays
        r.add(
          u, y + 0.35, width / bays * 0.43, 0.72, 6, 0.69, 0.035, "ribbon-reflection"
        )
        r.add(u, y, 0.055, 2.48, 7, 0.715, 0.035, "ribbon-mullion")
      continue
    if is84street and f.a[0] > 2359 and level < 2:
      if level == 0:
        r.window(mid, ground + 3.35, width - 0.48, 6.25, 9)
      continue
    bays = max(1, round(width / (2.6 if street and style == "haas" else 3.8)))
    pitch = width / bays
    for j in range(bays):
      u = f.left + (j + 0.5) * pitch
      w = min(2.95, pitch * 0.67)
      if street and style == "haas" and width > 6:
        w = min(1.18, pitch * 0.54)
      balcony = level > 0 and (
        (style == "haas" and width < 5)
        or (style == "schiffer" and not street)
        or style == "zehdenicker7a"
      )
      r.window(u, y, w, 2.48, 9 if style == "schiffer" else 7, balcony)
      if style == "collignon" and street:
        # Alternating sculptural white frames; source facade recesses remain
        # readable between the frames, with dark glazing and metal rail bands.
        shift = min(0.20, pitch * 0.045) * (1 if (j + level) % 2 else -1)
        for dx in [-w / 2 - 0.12, w / 2 + 0.12]:
          r.add(u + dx + shift, y, 0.19, 2.85, 2, 0.88, 0.24, "projecting-white-frame")
        for dy in [-1.43, 1.43]:
          r.add(
            u + shift, y + dy, w + 0.42, 0.19, 2, 0.88, 0.24, "projecting-white-frame"
          )
        if level > 0:
          r.add(u, y - 0.72, w, 0.055, 8, 0.91, 0.06, "metal-rail")
    if style == "zehdenicker7a" and level == 6:
      r.add(
        mid, y + 1.30, width - 0.15, 0.10, 4, 0.76, 0.10, "recessed-penthouse-coping"
      )


def build():
  parents, all_parents = load_parents()
  offsets = read(DATA / "weinbergBuildingOffsetsV176.json")["offsets"]
  nearby = []
  # Exclude party walls against actual neighbouring bodies, including historic
  # Choriner85 and Zehdenicker11, instead of colouring those neighbours.
  for b in all_parents:
    for p in b["parts"]:
      poly = footprint(p)
      if 2235 < poly.centroid.x < 2405 and -1345 < poly.centroid.y < -1225:
        nearby.append(
          (
            b["id"],
            p["id"],
            poly,
            p["groundY"] + offsets.get(b["id"], 0),
            p["topY"] + offsets.get(b["id"], 0),
          )
        )
  for b in parents:
    if b["id"] != "DEBE00YY1JO0001g":
      continue
    for p in b["parts"]:
      nearby.append((b["id"], p["id"], footprint(p), p["ground_y_m"], p["top_y_m"]))
  recipes = []
  audit = []
  owner_audit = []
  for b in parents:
    owner = b["id"]
    style, osm = OWNERS[owner]
    ground = min(
      v[1]
      for p in b["parts"]
      for s in p["surfaces"]
      if s["kind"] == "WallSurface"
      for ring in s["rings"]
      for v in ring
    )
    for p in b["parts"]:
      for index, sheet in enumerate(p["surfaces"]):
        if sheet["kind"] != "WallSurface":
          continue
        f = Face(group("source", owner), sheet["rings"])
        if f.length < 0.80 or f.top - f.base < 2.4 or abs(f.n[1]) > 0.01:
          continue
        # A wall is exposed only if its outward midpoint is not inside any
        # other retained solid at that height. Small source recesses survive.
        q = f.point((f.left + f.right) / 2, (f.base + f.top) / 2, 0.17)
        if any(
          pid != p["id"]
          and lo + 0.1 < q[1] < hi - 0.1
          and poly.contains(Point(q[0], q[2]))
          for _, pid, poly, lo, hi in nearby
        ):
          continue
        r = Recipe(f, owner, p["id"], index, style)
        decorate(r, ground)
        if not r.members:
          continue
        recipes.append(r.raw)
        audit.append(
          {
            "owner": owner,
            "partId": p["id"],
            "sheet": index,
            "rings": sheet["rings"],
            "roles": r.roles,
            "wallArea": f.wall.area,
          }
        )
    owner_audit.append(
      {
        "owner": owner,
        "osm": "way/" + osm,
        "style": style,
        "partsRetained": len(b["parts"]),
        "offsetApplied": b["offset"],
        "wallBottomY": ground,
        "highestRoofY": max(
          v[1]
          for p in b["parts"]
          for s in p["surfaces"]
          for ring in s["rings"]
          for v in ring
        ),
      }
    )
  cameras = {
    "choriner84": {"position": [2395, 27, -1278], "target": [2355, 23, -1294]},
    "zehdenickerFronts": {"position": [2324, 27, -1242], "target": [2295, 23, -1290]},
    "chorinerCourts": {"position": [2316, 39, -1285], "target": [2316, 22, -1314]},
    "zehdenicker7a": {"position": [2362, 23, -1206], "target": [2386, 21, -1244]},
    "overview": {"position": [2440, 135, -1165], "target": [2320, 20, -1296]},
  }
  data = {
    "schemaVersion": 1,
    "colors": COLORS,
    "owners": list(OWNERS),
    "previous": previous(),
    "faces": recipes,
    "cameras": cameras,
  }
  path = DATA / "chorinerV250.json"
  path.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  assert path.stat().st_size <= 250000
  evidence = {
    "schemaVersion": 1,
    "owners": owner_audit,
    "faces": audit,
    "cameras": cameras,
    "dataSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    "sourceHashes": {
      str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in [
        SOURCE,
        ZIP,
        DATA / "northV185.json",
        DATA / "schoolsPlacesV205.json",
        DATA / "centralNamedV230.json",
      ]
    },
    "sources": [
      {
        "url": "https://www.frankschiffer.com/projekte/haus-aus-stein/",
        "role": "Choriner84,2012: 2-storey lobby, horizontal street ribbons, floor-to-ceiling windows, court balconies, stepped penthouses; photos reference-only",
      },
      {
        "url": "https://www.haas-architekten.de/projekte/wohnbauten/choriner-hoefe",
        "role": "Modern ensemble identity and reference-only site plan: 6 storeys + setback, clinker/render, garden houses and side wings",
      },
      {
        "url": "https://www.collignonarchitektur.com/de/projekte/choriner-hoefe",
        "role": "Two Zehdenicker fronts; layered white facade frames and sculptural court entrance; photos reference-only",
      },
      {
        "url": "https://www.gewobag.de/bauen-in-berlin/bauprojekte/zehdenicker-strasse-7-a-in-prenzlauer-berg/",
        "role": "Separate Zehdenicker7A,2017: 17 flats,2 commercial units,6 full storeys + setback,corner bay,balconies,central ground passage",
      },
      {
        "url": "https://www.haas-architekten.de/projekte/wohnbauten/wohnhaus-zehdenicker-strasse",
        "role": "Separate 7A primary architect: cream render,grey loggias,full-height glazing,recessed upper storey; photos reference-only",
      },
    ],
    "limits": "Measured wall vertices, owner IDs, existing roof hierarchy and terrain datums. Photographs support architectural vocabulary and six-storey rhythm. Window widths, precise colours, railing offsets and fitting elevations are proportional estimates, not a facade or cadastral survey. No new source roofs, body volumes or through-passages are fabricated.",
    "preservation": "All LoD2/OSM bodies, holes, roof sheets, collision and older roof copings survive. Exact authored v185/v205 wrong generic short-face grids and only v230 facade prefix yield by numeric receipts. Older source-bound v239 reflected panes remain behind source-clipped new facing; no source sheet is suppressed. Historic Choriner85 and Zehdenicker11,9A/9B/9C are not recoloured.",
    "runtime": "Appends to existing NorthV185 choriner mesh, no new descriptor/material/draw call. Native independent axis-aligned facade raster; equal mobile static detail. Recipes decoded only during construction, no animation or texture.",
    "stats": {
      "faces": len(recipes),
      "drawnMembers": sum(len(f["members"]) for f in recipes),
      "nativeMembers": sum(
        max(1, math.ceil(m[2] / 700)) for f in recipes for m in f["members"]
      ),
      "dataBytes": path.stat().st_size,
    },
  }
  (GEO / "choriner-v250-evidence.json").write_text(
    json.dumps(evidence, indent=2) + "\n"
  )
  print(json.dumps(evidence["stats"]))


if __name__ == "__main__":
  build()
