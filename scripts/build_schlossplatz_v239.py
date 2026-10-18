"""Complete source-bound Staatsrat and Neuer Marstall core owners, Step 10.

The original OSM prisms, LoD2 sheets, and packet bytes remain immutable. Full
replacement geometry is required before the exact two obsolete core owners yield.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_region_outlines_v200 import world, xml_elements
from build_small_tiergarten_v237 import oriented as drawn_oriented
from build_steglitz_v182 import native_blocks
from build_venues_hermann_v238 import GLYPHS as BASE_GLYPHS
from build_venues_hermann_v238 import face_axes, rgb
from shapely.geometry import Point, Polygon, box

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "schlossplatz-v239-source.json.gz"
EVIDENCE = GEO / "schlossplatz-v239-evidence.json"
RUNTIME = ROOT / "src/app/src/data/schlossplatzV239Replacement.json"
OWNERS = ROOT / "src/app/src/data/schlossplatzV239Owners.json"
PRISMS = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
VOXELS = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
GROUND = 5.2
TARGETS = [
  dict(
    key="staatsrat",
    name="Staatsratsgebäude / ESMT",
    osm=23075450,
    parents=["DEBE01YYK000060j"],
    prism="23075450",
  ),
  dict(
    key="marstall",
    name="Neuer Marstall / Hochschule für Musik Hanns Eisler",
    osm=194079583,
    parents=["DEBE01YYK0000Bfk", "DEBE01YYK00008jV", "DEBE01YYK0000CnW"],
    prism="94079583",
  ),
]
REFS = [
  "https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/staatsratsgebaeude-641123.php",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09020048",
  "https://esmt.berlin/de/ueber-uns/unser-campus",
  "https://www.hfm-berlin.de/hochschule/ueber-die-hochschule/standorte/",
  "https://www.hfm-berlin.de/hochschule/ueber-die-hochschule/standorte/geschichte-neuer-marstall/",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011237",
]
POLICY = (
  "Exactly two immutable core OSM prisms yield to four complete official LoD2 parents. "
  "Every measured source XYZ coordinate, wall, roof and courtyard remains in the replacement. "
  "Absolute elevations are retained: source ground includes basement; street stays y=5.2. "
  "Small portal parapet height is bounded by official bDOM; facade window divisions, "
  "columns, colours, lettering, balconies and simplified ornament are display estimates. "
  "Neuer Marstall is the Schlossplatz campus; the existing Charlottenstrasse campus is unchanged. "
  "No photograph, texture, detailed artwork reproduction, new coverage, tour stop or residency increase."
)
GLYPHS = {**BASE_GLYPHS, "R": ["110", "101", "110", "101", "101"]}


def oriented(
  detail: Detail,
  center: list[float],
  size: list[float],
  angle: float,
  color: tuple[int, ...],
  role: str,
  native: bool,
) -> None:
  """Independent metre-aligned native courses, keeping narrow fittings distinct."""
  if not native:
    drawn_oriented(detail, center, size, angle, color, role, False)
    return
  x, y, z = center
  width, height, depth = size
  c, s = math.cos(angle), math.sin(angle)
  count = max(1, math.ceil(width / 0.9))
  for i in range(count):
    u = (i + 0.5) * width / count - width / 2
    detail.box(
      [x + c * u, y, z + s * u],
      [
        max(0.045, abs(c) * width / count + abs(s) * depth),
        height,
        max(0.045, abs(s) * width / count + abs(c) * depth),
      ],
      color,
      role,
    )


def text_label(
  detail: Detail,
  text: str,
  center: list[float],
  direction: Any,
  normal: Any,
  height: float,
  color: tuple[int, ...],
  native: bool,
) -> None:
  """Original small geometric letters; no copied logo, font or image."""
  pitch = height / 5
  cursor = -(sum(len(GLYPHS[ch][0]) + 1 for ch in text) * pitch - pitch) / 2
  angle = math.atan2(direction[1], direction[0])
  for ch in text:
    for ri, row in enumerate(GLYPHS[ch]):
      for ci, bit in enumerate(row):
        if bit == "0":
          continue
        u = cursor + (ci + 0.5) * pitch
        p = np.array(center)[[0, 2]] + np.array(direction) * u + np.array(normal) * 0.12
        oriented(
          detail,
          [p[0], center[1] + (2 - ri) * pitch, p[1]],
          [pitch * 0.84, pitch * 0.84, 0.045],
          angle,
          color,
          "hanns-eisler-lettering",
          native,
        )
    cursor += (len(GLYPHS[ch][0]) + 1) * pitch


def read(path: Path) -> Any:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, data: Any) -> None:
  raw = (
    json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  ).encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def extract() -> dict[str, Any]:
  """Retain complete measured parent families and exact previous owners."""
  archive = GEO / "raw/lod2/LoD2_391_5819.zip"
  mapfile = GEO / "raw/schlossplatz-v239/map.osm"
  es = xml_elements(mapfile)
  prisms = {p["id"]: p for p in read(PRISMS)["buildings"]}
  buildings = []
  for t in TARGETS:
    parts = []
    for identity in t["parents"]:
      parent = extract_parent(archive, identity)
      for element in leaf_building_parts(parent) or [parent]:
        parts.append(dict(**part_profile(element), parent=identity))
    osm = es["way", t["osm"]]
    osmring = [
      list(world(es["node", i]["lon"], es["node", i]["lat"])) for i in osm["nodes"]
    ]
    buildings.append(
      dict(
        **t,
        parts=parts,
        osmTags=osm["tags"],
        osmRing=osmring,
        previousPrism=prisms[t["prism"]],
      )
    )
  data = dict(
    schemaVersion=1,
    retrieved="2026-10-19",
    policy=POLICY,
    license=["Berlin LoD2 and bDOM: dl-de/zero-2-0", "OpenStreetMap: ODbL-1.0"],
    sourceArchive=dict(
      url="https://gdi.berlin.de/data/a_lod2/atom/" + archive.name, sha256=sha(archive)
    ),
    osmMap=dict(
      url="https://api.openstreetmap.org/api/0.6/map?bbox=13.4001,52.5133,13.4075,52.5171",
      sha256=sha(mapfile),
    ),
    inputs={str(p.relative_to(ROOT)): sha(p) for p in [PRISMS, VOXELS]},
    references=REFS,
    bdom=read(GEO / "schlossplatz-v239-bdom.json"),
    buildings=buildings,
  )
  write(SOURCE, data)
  return data


class Facade:
  """One explicit, measured facade plane with independent native fittings."""

  def __init__(self, models: dict[str, Detail], a: Any, d: Any, n: Any, name: str):
    self.models, self.a = models, np.array(a)
    self.d, self.n, self.name = np.array(d), np.array(n), name
    self.angle = math.atan2(d[1], d[0])

  def point(self, u: float, y: float, out: float) -> list[float]:
    p = self.a + self.d * u + self.n * out
    return [float(p[0]), y, float(p[1])]

  def block(
    self,
    u: float,
    y: float,
    w: float,
    h: float,
    depth: float,
    color: int,
    role: str,
    out: float = 0.12,
  ) -> None:
    for mode, detail in self.models.items():
      native = mode == "minecraft"
      # Native material courses express the rustication and window frames at
      # block scale; the centimetre joints and thin crossbars belong to drawn.
      if native and (
        role == "rusticated-base-joint"
        or role.endswith("-mullion")
        or role.endswith("-transom")
        or role == "upper-transom"
      ):
        continue
      p = self.point(u, y, out + (0.75 if native else 0))
      oriented(
        detail, p, [w, h, depth], self.angle, rgb(color), self.name + "/" + role, native
      )

  def cylinder(
    self, u: float, low: float, high: float, r: float, color: int, role: str, out: float
  ) -> None:
    for mode, detail in self.models.items():
      p = self.point(u, low, out + (0.75 if mode == "minecraft" else 0))
      if mode == "minecraft":
        detail.box(
          [p[0], (low + high) / 2, p[2]],
          [r * 1.6, high - low, r * 1.6],
          rgb(color),
          self.name + "/" + role,
        )
      else:
        detail.lathe(
          p[0],
          p[2],
          [
            (low, r * 1.13),
            (low + 0.22, r * 1.13),
            (low + 0.30, r),
            (high - 0.3, r * 0.86),
            (high - 0.22, r * 1.18),
            (high, r * 1.18),
          ],
          rgb(color),
          self.name + "/" + role,
          segments=10,
        )

  def arch(
    self,
    u: float,
    spring: float,
    radius: float,
    band: float,
    color: int,
    role: str,
    out: float = 0.24,
  ) -> None:
    for mode, detail in self.models.items():
      for i in range(16):
        t0, t1 = math.pi * i / 16, math.pi * (i + 1) / 16
        if mode == "minecraft":
          t = (t0 + t1) / 2
          selfpoint = self.point(
            u + radius * math.cos(t), spring + radius * math.sin(t), out + 0.75
          )
          detail.box(
            selfpoint,
            [
              max(0.13, abs(self.d[0]) * radius * 0.20 + band),
              band + 0.15,
              max(0.13, abs(self.d[1]) * radius * 0.20 + band),
            ],
            rgb(color),
            self.name + "/" + role,
          )
        else:
          detail.polygon(
            [
              self.point(u + r * math.cos(t), spring + r * math.sin(t), out)
              for t, r in [
                (t0, radius - band / 2),
                (t1, radius - band / 2),
                (t1, radius + band / 2),
                (t0, radius + band / 2),
              ]
            ],
            rgb(color),
            self.name + "/" + role,
          )

  def window(
    self,
    u: float,
    y: float,
    w: float,
    h: float,
    role: str,
    frame: int = 0xD4CBB8,
    glass: int = 0x53686D,
  ) -> None:
    self.block(u, y, w + 0.28, h + 0.24, 0.13, frame, role + "-surround")
    self.block(u, y, w, h, 0.11, glass, role + "-glass", 0.21)
    self.block(u, y, 0.08, h, 0.08, frame, role + "-mullion", 0.3)
    self.block(u, y, w, 0.08, 0.08, frame, role + "-transom", 0.3)


def measured_models(b: dict[str, Any]) -> dict[str, Detail]:
  models = {m: Detail() for m in ["drawn", "minecraft"]}
  surfaces = []
  for p in b["parts"]:
    for index, s in enumerate(p["surfaces"]):
      color = 0xC8BEA5 if b["key"] == "staatsrat" else 0xB7AF9C
      if s["kind"] == "RoofSurface":
        color = 0x747873
      tris = triangles_for(s["rings"])
      surfaces.append(dict(color=color, triangles=tris))
      for tri in tris:
        models["drawn"].triangles.append(
          (tri, rgb(color), f"source/{p['id']}/{index}/{s['kind']}")
        )
  for row in native_blocks(dict(surfaces=surfaces, boxes=[], rods=[])):
    models["minecraft"].box(
      row[:3], row[3:6], rgb(row[6]), "independent-native-source-skin"
    )
  return models


def secondary_front(models: dict[str, Detail], f: dict, role: str) -> None:
  """Retain fitting coverage on low annex/short source sides at their true datum.

  These bounded windows are a display estimate, like the superseded v169 grid.
  All four corners must fit the actual source wall; shallow roof upstands and
  shared/internal walls cannot acquire an invented window.
  """
  if f["length"] < 2.4:
    return
  facade = Facade(models, f["a"], f["d"], f["n"], role + "/" + f["part"])
  width = min(1.5, f["length"] * 0.55)
  low = max(GROUND, f["low"])
  for y in np.arange(low + 2.05, f["high"] - 0.9, 3.4):
    for u in np.linspace(1.2, f["length"] - 1.2, max(1, round(f["length"] / 3.4))):
      rectangle = box(u - width / 2, y - 0.95, u + width / 2, y + 0.95)
      if f["plane"].buffer(-0.05).covers(rectangle):
        facade.window(float(u), float(y), width, 1.9, "bounded-window")


def staatsrat(models: dict[str, Detail], b: dict[str, Any]) -> dict[str, Any]:
  """Three-storey granite/glass rhythm and the asymmetrical historic portal."""
  faces = face_axes(dict(parts=b["parts"], sourceGroundY=3))
  fronts = [f for f in faces if f["n"][1] < -0.8 and f["length"] > 10]
  portal = next(f for f in fronts if abs(f["length"] - 17.96) < 0.1)
  for f in faces:
    if f is portal:
      continue
    if f["high"] < 25 or f["length"] < 7:
      secondary_front(models, f, "staatsrat-secondary")
      continue
    facade = Facade(models, f["a"], f["d"], f["n"], "staatsrat")
    length = f["length"]
    for y, h, col in [
      (11.4, 0.42, 0xD9CEB4),
      (20.25, 0.48, 0xD9CEB4),
      (32.3, 0.65, 0xD9CEB4),
    ]:
      facade.block(length / 2, y, length - 0.15, h, 0.20, col, "horizontal-stone-band")
    # Photo-supported dark red granite infill and slender pale stone frame.
    facade.block(
      length / 2, 25.9, length - 0.2, 10.9, 0.08, 0x976A5A, "red-granite-upper", 0.08
    )
    facade.block(
      length / 2, 16.0, length - 0.2, 8.2, 0.08, 0xA57664, "red-granite-middle", 0.08
    )
    count = max(1, round(length / 3.5))
    for i in range(count):
      u = (i + 0.5) * length / count
      facade.window(u, 8.55, 1.55, 3.35, "ground-window")
      facade.window(u, 15.9, 2.12, 6.5, "middle-window")
      facade.window(u, 26.0, 2.12, 10.35, "upper-window")
      for y in [23.0, 29.0]:
        facade.block(u, y, 2.12, 0.08, 0.08, 0xD4CBB8, "upper-transom", 0.31)
    facade.block(length / 2, 5.65, length - 0.15, 0.8, 0.15, 0x776956, "granite-base")
  f = Facade(
    models,
    portal["a"] + portal["d"] * portal["length"] / 2,
    portal["d"],
    portal["n"],
    "liebknecht-portal",
  )
  w = portal["length"]
  stone, light, dark, gold = 0xBBA98A, 0xC8B89A, 0x8E7C64, 0xC7A24F
  f.block(0, 19.0, w, 27.5, 0.16, stone, "sandstone-risalit", 0.13)
  for y, width, height in [
    (5.7, w, 0.55),
    (12.35, w + 0.5, 0.45),
    (20.25, w + 0.85, 0.6),
    (31.4, w + 0.9, 0.7),
    (32.1, w + 0.25, 0.32),
    (33.65, w - 0.3, 1.0),
    (34.16, w, 0.22),
  ]:
    f.block(0, y, width, height, 0.7, light, "projecting-cornice", 0.4)
  # The low upper parapet is supported by the retained bDOM transect at 64.02–64.35 NHN.
  for u in [-8, -3.9, 3.9, 8]:
    for low, high in [(5.9, 12.05), (12.6, 19.9), (20.65, 30.95)]:
      f.block(u, (low + high) / 2, 0.72, high - low, 0.5, light, "pilaster", 0.48)
      f.block(u, high - 0.15, 1.15, 0.35, 0.7, light, "pilaster-capital", 0.62)
    f.block(u, 33.7, 1.05, 1.05, 0.65, light, "parapet-pier", 0.48)
  for u in [-5.7, 5.7]:
    f.window(u, 8.8, 2.1, 4.1, "flanking-ground", light)
    f.window(u, 16.05, 2.1, 5.0, "flanking-middle", light)
    f.window(u, 24.2, 2.15, 6.0, "flanking-upper", light)
    f.window(u, 29.15, 1.75, 1.85, "flanking-attic", light)
    for y in [11.2, 18.9, 27.5]:
      f.block(u, y, 2.85, 0.22, 0.4, light, "window-lintel", 0.48)
  f.window(0, 8.8, 4.5, 6.5, "central-door", dark, 0x394C4D)
  f.window(0, 16.1, 4.8, 5.3, "central-middle", light)
  f.window(0, 24.3, 4.8, 6.6, "central-upper", light)
  # Semicircular fanlight and voussoirs above the upper balcony window.
  for j in range(13):
    u = (j - 6) * 0.38
    h = math.sqrt(max(0, 2.45**2 - u * u))
    if h > 0.1:
      f.block(u, 27.7 + h / 2, 0.39, h, 0.1, 0x53686D, "fanlight", 0.23)
  f.arch(0, 27.7, 2.65, 0.35, light, "baroque-arch", 0.5)
  f.arch(0, 27.7, 2.3, 0.08, 0xD6D1BC, "fanlight-frame", 0.55)
  for u in [-2.75, 2.75]:
    f.cylinder(u, 20.8, 27.5, 0.18, dark, "upper-arch-column", 0.48)
    f.cylinder(u, 6.0, 11.8, 0.28, light, "door-column", 0.55)
  for y, width in [(12.85, 5.2), (20.75, 7.7)]:
    f.block(0, y - 0.38, width + 0.45, 0.45, 1.4, light, "balcony-slab", 0.7)
    f.block(0, y + 0.6, width, 0.12, 0.12, gold, "gilt-balcony-rail", 1.42)
    f.block(0, y + 0.06, width, 0.12, 0.12, gold, "gilt-balcony-base", 1.42)
    for u in np.linspace(-width / 2, width / 2, 19):
      f.block(float(u), y + 0.34, 0.07, 0.62, 0.08, gold, "gilt-baluster", 1.42)
  # Original restrained heraldic silhouette, not copied sculptural geometry.
  f.block(0, 31.4, 1.55, 1.9, 0.3, dark, "heraldic-cartouche", 0.8)
  f.arch(0, 31.3, 1.2, 0.22, gold, "cartouche-scroll", 0.92)
  for side in [-1, 1]:
    for u, y, w0, h0 in [
      (1.9, 31.5, 1.2, 0.55),
      (2.6, 30.95, 0.6, 0.9),
      (1.35, 32.1, 0.55, 0.5),
    ]:
      f.block(side * u, y, w0, h0, 0.35, light, "scroll-relief", 0.7)
  return dict(
    portalFront=[portal["a"].tolist(), (portal["a"] + portal["d"] * w).tolist()],
    portalWidth=w,
    portalTopY=34.27,
    photoSubdivisionsEstimated=True,
  )


def marstall(models: dict[str, Detail], b: dict[str, Any]) -> dict[str, Any]:
  """Retained complete wings with rusticated base, arched entries and portico."""
  faces = face_axes(dict(parts=b["parts"], sourceGroundY=3))
  stone, trim, shadow = 0xB7AF9C, 0xC7BFAE, 0x8F8878
  for f in faces:
    if f["length"] < 2.5 or f["high"] < 20:
      secondary_front(models, f, "marstall-secondary")
      continue
    facade = Facade(models, f["a"], f["d"], f["n"], "marstall")
    length = f["length"]
    # Full exposed walls retain their source cap. No historical roof statues or lost pediment.
    for y in [16.3, 28.9]:
      if f["low"] + 0.2 < y < f["high"] - 0.2:
        facade.block(
          length / 2, y, length - 0.1, 0.36, 0.35, trim, "floor-cornice", 0.22
        )
    for y in [5.8, 7.0, 8.2, 9.4, 10.6, 11.8, 13.0, 14.2, 15.4]:
      if y < f["low"] + 0.1:
        continue
      facade.block(
        length / 2, y, length - 0.1, 0.065, 0.09, shadow, "rusticated-base-joint"
      )
    count = max(1, round(length / 3.25))
    for i in range(count):
      u = (i + 0.5) * length / count
      for y, h in [(8.3, 3.6), (13.3, 3.6), (20.2, 5.25), (26.0, 4.2)]:
        if y + h / 2 < f["high"] - 0.4 and y - h / 2 > f["low"]:
          facade.window(
            u, y, min(1.6, length / count * 0.58), h, "source-front-window", trim
          )
          facade.block(
            u,
            y + h / 2 + 0.28,
            min(2.1, length / count * 0.75),
            0.25,
            0.35,
            trim,
            "window-pediment",
            0.33,
          )
      if f["n"][1] < -0.7 and f["low"] < 16.5 and f["high"] > 28.5:
        facade.block(
          i * length / count,
          22.3,
          0.48,
          11.8,
          0.22,
          trim,
          "colossal-upper-pilaster",
          0.24,
        )
  # Central public portico occupies the source-segmented 21.47m front group.
  a = np.array([2151.138, 311.167])
  end = np.array([2167.766, 297.538])
  length = float(np.linalg.norm(end - a))
  d = (end - a) / length
  n = np.array([d[1], -d[0]])
  facade = Facade(models, (a + end) / 2, d, n, "hanns-eisler-portico")
  for u in [-6.0, 0, 6.0]:
    facade.window(u, 8.65, 3.2, 5.8, "arched-entrance", trim, 0x4E6264)
    for j in range(11):
      du = (j - 5) * 0.29
      h = math.sqrt(max(0, 1.6**2 - du * du))
      if h > 0.1:
        facade.block(
          u + du, 11.5 + h / 2, 0.30, h, 0.1, 0x4E6264, "arched-fanlight", 0.24
        )
    facade.arch(u, 11.5, 1.78, 0.25, trim, "entrance-arch", 0.45)
  for u in [-9, -7.9, -3.1, -2, 2, 3.1, 7.9, 9]:
    facade.cylinder(u, 5.6, 15.8, 0.48, stone, "paired-tuscan-column", 0.9)
    facade.block(u, 5.5, 1.15, 0.45, 1.15, shadow, "column-plinth", 0.9)
  facade.block(0, 16.15, 20.5, 0.8, 1.8, trim, "portico-entablature", 0.8)
  facade.block(0, 16.65, 20.9, 0.25, 2.0, trim, "portico-cornice", 0.8)
  for mode, detail in models.items():
    native = mode == "minecraft"
    text_label(
      detail,
      "HANNS EISLER",
      facade.point(0, 16.15, 2.9 if native else 1.8),
      -d,
      n,
      0.55,
      rgb(0x9E4346),
      native,
    )
  # Two 1988 bronze-relief fields are located from the university's description;
  # plain material plaques deliberately carry no copied sculptural composition.
  for u in [-36, 36]:
    facade.block(u, 8.3, 2.9, 2.2, 0.1, 0x5E6558, "bronze-relief-location", 0.2)
  return dict(
    porticoSourceFront=[a.tolist(), end.tolist()],
    porticoWidth=length,
    name="Hochschule für Musik Hanns Eisler Berlin, Schloßplatz 7",
    otherCampusPreserved="Charlottenstraße 55",
    photoSubdivisionsEstimated=True,
  )


def previous_columns(source: dict[str, Any]) -> list[dict[str, Any]]:
  """Audit exact source column tuples, including the old vertical interval."""
  v = read(VOXELS)
  shapes = [
    (
      b["previousPrism"],
      Polygon(
        np.array(b["previousPrism"]["ring"]) / 10,
        [np.array(h) / 10 for h in b["previousPrism"]["holes"]],
      ),
    )
    for b in source["buildings"]
  ]
  columns = []
  for ri, row in enumerate(v["building_rows"]):
    z = (ri + v["grid"]["min_z_idx"]) * 4 + 2
    if not 270 < z < 450:
      continue
    for start, length, low, high, kind in row:
      for i in range(length):
        x = (start + i + v["grid"]["min_x_idx"]) * 4 + 2
        if not 1950 < x < 2280:
          continue
        hits = [
          p["id"]
          for p, g in shapes
          if g.covers(Point(x, z))
          and low == p["y0_dm"]
          and high == p["y0_dm"] + math.ceil(p["h_dm"] / 40 - 1e-9) * 40
        ]
        if hits:
          columns.append(dict(x=x, z=z, low=low, high=high, kind=kind, prismIds=hits))
  return columns


def packet(details: list[Detail], mode: str) -> tuple[dict[str, Any], dict[str, int]]:
  tile = box(1900, 240, 2300, 490)
  meshes = []
  stats = dict(vertices=0, indices=0, geometryBytes=0)
  for detail in details:
    mesh = packed_detail(detail, tile)
    assert mesh
    mesh["kind"] = "schlossplatz-v239"
    nv = len(base64.b64decode(mesh["positions"])) // 6
    ni = len(base64.b64decode(mesh["indices"])) // 4
    assert nv <= 65535, "Separate complete site meshes retain 16-bit GPU indices"
    stats["vertices"] += nv
    stats["indices"] += ni
    stats["geometryBytes"] += nv * 12 + ni * 2
    meshes.append(mesh)
  assert stats["geometryBytes"] < 3 * 1024 * 1024, stats
  result = dict(
    schemaVersion=1,
    id="schloss239-core-" + mode,
    origin=[1900, -10, 240],
    meshes=meshes,
    nav=dict(groundY=GROUND, ground=[], water=[], buildings=[]),
  )
  return result, stats


def build() -> dict[str, Any]:
  source = read(SOURCE) if SOURCE.exists() else extract()
  for path, digest in source["inputs"].items():
    assert sha(ROOT / path) == digest, path
  allmodels = {m: Detail() for m in ["drawn", "minecraft"]}
  site_models = {m: [] for m in ["drawn", "minecraft"]}
  recognition = {}
  nav = []
  source_counts = Counter()
  for b in source["buildings"]:
    models = measured_models(b)
    recognition[b["key"]] = (staatsrat if b["key"] == "staatsrat" else marstall)(
      models, b
    )
    for mode, d in models.items():
      allmodels[mode].triangles.extend(d.triangles)
      site_models[mode].append(d)
    for p in b["parts"]:
      nav.append(
        dict(
          sourceId=p["id"],
          ring=p["ring"],
          holes=p["holes"],
          minY=GROUND,
          maxY=p["top_y_m"],
        )
      )
      source_counts["parts"] += 1
      source_counts["sheets"] += len(p["surfaces"])
      source_counts["vertices"] += sum(
        len(r) for s in p["surfaces"] for r in s["rings"]
      )
  core = dict(
    prismIds=[b["prism"] for b in source["buildings"]],
    previousPrisms=[b["previousPrism"] for b in source["buildings"]],
    previousColumns=previous_columns(source),
    navigationSolids=nav,
  )
  write(OWNERS, dict(schema=1, sourceSha256=sha(SOURCE), **core))
  runtime = dict(schema=1, sourceSha256=sha(SOURCE), packets={}, core={})
  stats = {}
  for mode, d in allmodels.items():
    runtime["core"][mode], stats[mode] = packet(site_models[mode], mode)
  write(RUNTIME, runtime)
  evidence = dict(
    schemaVersion=1,
    policy=POLICY,
    sourceSha256=sha(SOURCE),
    runtimeSha256=sha(RUNTIME),
    ownersSha256=sha(OWNERS),
    sourceCounts=dict(source_counts),
    budgets=stats,
    previousColumns=len(core["previousColumns"]),
    recognition=recognition,
    sourceRoleCounts={
      m: dict(Counter(role for _, _, role in d.triangles)) for m, d in allmodels.items()
    },
    preservedInputs=source["inputs"],
  )
  write(EVIDENCE, evidence)
  return evidence


if __name__ == "__main__":
  evidence = build()
  print(
    json.dumps(
      {
        "source": evidence["sourceCounts"],
        "budgets": evidence["budgets"],
        "previousColumns": evidence["previousColumns"],
      },
      indent=2,
    )
  )
