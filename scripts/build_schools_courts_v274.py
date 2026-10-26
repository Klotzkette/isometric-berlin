"""Finite source-bound school/courtyard details; no old source or packet is edited.

Surveyed sheets remain separate from estimated opening/carpentry dimensions.
The BMS addition is the complete measured upper envelope above the retained
legacy roof. All other work is shallow detail on identified existing faces.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
from build_alt_mitte_v169 import facade as old_facade
from build_alt_mitte_v169 import footprint
from build_breitscheid_towers_v161 import triangles_for
from build_choriner_v250 import load_parents
from build_lennon_v250 import source_subset
from build_north_mitte_fronts_v239 import current_triangles, tri_key
from build_schools_places_v205 import Face, group
from build_west_venues_v260 import native_shell
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OUT = DATA / "schoolsCourtsV274.json"
EVIDENCE = GEO / "schools-courts-v274-evidence.json"
SOURCE = GEO / "schools-courts-v274-source.json.gz"
NAV = DATA / "schoolsCourtsV274Navigation.json"
KITA = ("DEBE01YYK000016B", "DEBE01YYK00003HT")
BMS = "DEBE01YYK000047I"
COPPER, COPPER_SEAM = 0x96745A, 0x6C5947
WOOD, WOOD_JOINT, GLASS, FRAME = 0xB99C74, 0x877259, 0x68878B, 0xD4D8CB


def read(path: Path) -> dict:
  """Read an immutable source without writes or downloads."""
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  """Receipt an exact retained input."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def shifted(rings: list, dy: float) -> list:
  """Apply the existing parent datum once, to every vertex including holes."""
  return [[[x, round(y + dy, 6), z] for x, y, z in r] for r in rings]


def clip_above(ring: list, height: float) -> list:
  """Clip one measured triangle against a horizontal plane without new roofs."""
  out = []
  for a, b in zip(ring, ring[1:] + ring[:1]):
    inside_a, inside_b = a[1] >= height, b[1] >= height
    if inside_a:
      out.append(a)
    if inside_a != inside_b:
      t = (height - a[1]) / (b[1] - a[1])
      out.append([a[k] + t * (b[k] - a[k]) for k in range(3)])
  return out


class Builder:
  """One construction-only detail register and auditable source-plane members."""

  def __init__(self, key: str, name: str):
    self.key, self.name = key, name
    self.g = group(name, key)
    self.faces = []
    self.roles = Counter()
    self.support: np.ndarray | None = None
    self.mode = "both"

  def face(self, rings: list, owner: str, part: str, sheet: int, normal=None) -> Face:
    """Record exact ring provenance; all details are clipped against holes."""
    f = Face(self.g, rings, normal)
    f.audit.update(owner=owner, partId=part, sheet=sheet, members=[], nativeMembers=[])
    self.faces.append(f.audit)
    return f

  def put(
    self,
    f: Face,
    u: float,
    y: float,
    w: float,
    h: float,
    color: int,
    role: str,
    out: float = 0.40,
    depth: float = 0.07,
  ) -> None:
    """Finite drawn box plus independently axis-aligned native subdivisions."""
    if min(w, h) < 0.025 or not f.wall.buffer(0.001).covers(
      box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
    ):
      return
    row = [*f.point(u, y, out), w, h, depth, f.yaw, color]
    if self.mode != "native":
      index = len(self.g["boxes"])
      self.g["boxes"].append(row)
      f.audit["members"].append([u, y, w, h, out, depth, role, index])
      self.roles[role] += 1
    if self.mode == "drawn":
      return
    f.audit["nativeMembers"].append(
      [u, y, w, h, out, depth, role, len(self.g["nativeRows"])]
    )
    steps = max(1, math.ceil(w / 0.70))
    for i in range(steps):
      uu = u - w / 2 + (i + 0.5) * w / steps
      sx = max(0.08, abs(f.d[0]) * w / steps) + abs(f.n[0]) * depth
      sz = max(0.08, abs(f.d[2]) * w / steps) + abs(f.n[2]) * depth
      # Actual delivered native vertices determine the outward support, not
      # a rotated miniature of the drawn member or an arbitrary world shove.
      support = 1.42
      if self.support is not None and len(self.support):
        rel = self.support - f.a
        du, dn = rel @ f.d, rel @ f.n
        mask = (
          (abs(du - uu) < w / steps / 2 + 1.5)
          & (abs(self.support[:, 1] - y) < h / 2 + 1.1)
          & (dn > -0.2)
          & (dn < 3.1)
        )
        if mask.any():
          support = max(0.0, float(dn[mask].max()))
      offset = support + (abs(f.n[0]) * sx + abs(f.n[2]) * sz) / 2 + max(0.1, out - 0.2)
      self.g["nativeRows"].append([*f.point(uu, y, offset), sx, h, sz, color])


def native_vertices(bounds: tuple, receipts: dict) -> np.ndarray:
  """Read nearby existing native packets; retain only a small local vertex set."""
  root = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  result = []
  region = box(*bounds).buffer(4)
  for desc in read(root / "manifest.json")["chunks"]:
    if not box(*desc["bounds"]).intersects(region):
      continue
    path = root / desc["minecraft"]["url"]
    packet = read(path)
    receipts[str(path.relative_to(ROOT))] = sha(path)
    for mesh in packet["meshes"]:
      if mesh["kind"] not in {"alt-mitte-v169", "mitte-street-fronts-v166"}:
        continue
      a = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
      a = a.astype(float) / 100 + np.asarray(packet["origin"])
      lowx, lowz, highx, highz = region.bounds
      result.extend(
        a[
          (a[:, 0] >= lowx)
          & (a[:, 0] <= highx)
          & (a[:, 2] >= lowz)
          & (a[:, 2] <= highz)
        ].tolist()
      )
  return np.unique(np.asarray(result).reshape(-1, 3), axis=0)


def segmental_glass(
  b: Builder,
  f: Face,
  u: float,
  spring: float,
  w: float,
  rise: float,
  color: int,
  out: float,
) -> None:
  """Fill only the missing shallow curved head of an existing rectangular pane."""
  for i in range(3):
    y = rise * (i + 0.5) / 3
    width = w * math.sqrt(max(0, 1 - (y / rise) ** 2))
    b.put(
      f,
      u,
      spring + y,
      width,
      rise / 3 + 0.008,
      color,
      "existing-window-segmental-glass",
      out,
      0.035,
    )


def school_heads(receipts: dict) -> list[Builder]:
  """Complete the already-correct opening shapes, never introduce another grid."""
  result = []
  path = GEO / "schools-v185-evidence.json"
  evidence = read(path)
  receipts[str(path.relative_to(ROOT))] = sha(path)
  b = Builder(
    "kastanienbaum", "Kastanienbaumgrundschule — curved heads and brick joints"
  )
  b.support = native_vertices((2060, -885, 2130, -805), receipts)
  for school in evidence["schools"]:
    if not school["name"].startswith("Kastanienbaum"):
      continue
    front = school["name"].endswith("front")
    for raw in school["faces"]:
      f = b.face(raw["rings"], school["owner"], raw["partId"], -1, raw["normal"])
      bays, levels = (
        (4, [f.base + (j + 0.52) * 3 for j in range(3)])
        if front
        else (3, [5.8, 10.6, 15.4, 20.2])
      )
      pitch = f.length / bays
      for level, y in enumerate(levels):
        for j in range(bays):
          if front and level == 0 and j in [0, 3]:
            continue  # Both door/passage identities remain unchanged.
          u = f.left + (j + 0.5) * pitch
          w, h, rise = (1.45, 1.85, 0.18) if front else (1.52, 2.65, 0.23)
          segmental_glass(b, f, u, y + h / 2 + 0.02, w, rise, 0x59747B, 0.285)
          for sign in [-1, 1]:
            b.put(
              f,
              u + sign * (w / 2 + 0.19),
              y,
              0.075,
              h,
              0x875239,
              "brick-reveal-edge",
              0.425,
              0.055,
            )
  result.append(b)
  b = Builder("lennon", "John-Lennon-Gymnasium — complete segmental lower heads")
  b.support = native_vertices((2215, -1320, 2305, -1240), receipts)
  for raw in source_subset()["faces"]:
    if not raw["bays"]:
      continue
    f = b.face(
      raw["rings"], "DEBE01YYK000064P", raw["partId"], raw["sheetIndex"], raw["normal"]
    )
    pitch = f.length / raw["bays"]
    for y in [12.7, 17.05, 21.4]:
      if y - 1.55 < f.base:
        continue
      for j in range(raw["bays"]):
        u = f.left + (j + 0.5) * pitch
        w = min(1.7, pitch * 0.61)
        segmental_glass(b, f, u, y + 1.43, w, 0.19, 0x71898B, 0.675)
  result.append(b)
  return result


def soap_factory(receipts: dict) -> Builder:
  """Industrial glazing has its old three registers; add deep reveal detail."""
  path = DATA / "schoolsPlacesV205.json"
  receipts[str(path.relative_to(ROOT))] = sha(path)
  old = next(g for g in read(path)["places"] if g["owner"] == "DEBE01YYK0000BOt")
  b = Builder("be-smart", "Be Smart Academy — Alte Seifenfabrik Torstraße 134")
  b.support = native_vertices((1930, -1150, 1990, -1090), receipts)
  for i, raw in enumerate(old["faces"]):
    f = b.face(
      raw["rings"], old["owner"], "v205-retained-street-wall", i, raw["normal"]
    )
    bays = 3 if f.length > 8 else 1
    pitch = f.length / bays
    for level in range(3):
      y, h = f.base + 1.9 + level * 3.3, 2.0 if level else 2.5
      for j in range(bays):
        u, w = f.left + (j + 0.5) * pitch, min(2.45, pitch - 0.9)
        for sign in [-1, 1]:
          b.put(
            f,
            u + sign * (w / 2 + 0.085),
            y,
            0.10,
            h + 0.13,
            0x6E4542,
            "factory-recess-jamb",
            0.43,
            0.16,
          )
        b.put(
          f,
          u,
          y - h / 2 - 0.09,
          w + 0.24,
          0.13,
          0xAD7B65,
          "factory-projecting-sill",
          0.46,
          0.23,
        )
        # An upper opening light, following the existing cross-framed glazing.
        b.put(
          f,
          u,
          y + h * 0.28,
          w,
          0.045,
          0xA5ADAA,
          "factory-upper-opening-light",
          0.40,
          0.035,
        )
  return b


def tiergarten(receipts: dict) -> Builder:
  """Add reveal edges to the existing post-2012 window/panel register."""
  path = ROOT / "src/app/src/gymnasiumTiergartenSource.json"
  receipts[str(path.relative_to(ROOT))] = sha(path)
  src = read(path)
  b = Builder("tiergarten", "Gymnasium Tiergarten — white/red renovated facade reveals")
  parts = src["parts"]
  polys = {p["id"]: Polygon(p["ring"], p.get("holes", [])) for p in parts}
  dy = src["display_y_translation_m"]
  for p in parts:
    if p["id"].endswith(("ruAxvlwz", "neNfHjtD", "lnB9I8b8")):
      continue  # Blue Aula and Hand keep their distinct full original model.
    ring = p["ring"]
    area = sum(a[0] * z[1] - z[0] * a[1] for a, z in zip(ring, ring[1:] + ring[:1]))
    side = 1 if area > 0 else -1
    for i, (a, z) in enumerate(zip(ring, ring[1:] + ring[:1])):
      length = math.dist(a, z)
      if length < 7:
        continue
      d = np.array([z[0] - a[0], 0, z[1] - a[1]]) / length
      normal = np.array([d[2] * side, 0, -d[0] * side])
      high = p["top_y_m"] + dy
      # Match the actual edge's measured wall sheet, including sloping tops,
      # rather than extruding the footprint to the part's maximum height.
      sheets = [
        (si, s)
        for si, s in enumerate(p["surfaces"])
        if s["kind"] == "WallSurface"
        and all(
          abs((np.array([q[0] - a[0], 0, q[2] - a[1]]) @ normal)) < 0.015
          for r in s["rings"]
          for q in r
        )
        and any(
          math.hypot(q[0] - a[0], q[2] - a[1]) < 0.015 for r in s["rings"] for q in r
        )
        and any(
          math.hypot(q[0] - z[0], q[2] - z[1]) < 0.015 for r in s["rings"] for q in r
        )
      ]
      if len(sheets) != 1:
        continue
      si, sheet = sheets[0]
      f = b.face(
        shifted(sheet["rings"], dy), src["parent_id"], p["id"], si, normal.tolist()
      )
      for mode in ["drawn", "native"]:
        b.mode = mode
        bays = max(1, math.floor((length - 1.4) / (3.1 if mode == "native" else 2.55)))
        pitch = (length - 1.4) / bays
        for y in [7.25, 10.4, 14.5, 18.6, 22.7, 26.8, 30.9, 34.65, 38.05]:
          if y + 1.05 > high - 0.35:
            continue
          for j in range(bays):
            at = np.array([a[0], 0, a[1]]) + d * (0.7 + (j + 0.5) * pitch)
            probe = Point(at[0] + normal[0] * 0.2, at[2] + normal[2] * 0.2)
            if any(
              q["id"] != p["id"]
              and y < q["top_y_m"] + dy - 0.15
              and polys[q["id"]].covers(probe)
              for q in parts
            ):
              continue
            # Reproduce each mode's own retained v140 window register.
            u = float((at - f.a) @ f.d)
            h, w = (1.25 if y > 33 else 1.9 if y < 8 else 2.25), pitch * 0.72
            for sign in [-1, 1]:
              b.put(
                f,
                u + sign * (w / 2 + 0.035),
                y,
                0.06,
                h + 0.12,
                0xBBC0B7,
                "tiergarten-existing-reveal-edge",
                0.29,
                0.09,
              )
            b.put(
              f,
              u,
              y - h / 2 - 0.05,
              w + 0.10,
              0.065,
              0xB4B9AF,
              "tiergarten-existing-sill-shadow",
              0.30,
              0.11,
            )
  return b


def choriner(receipts: dict) -> Builder:
  """Complete supports on already authored balcony rails, never new balconies."""
  path = DATA / "chorinerV250.json"
  receipts[str(path.relative_to(ROOT))] = sha(path)
  old = read(path)
  parents, _ = load_parents()
  index = {
    (p["id"], i): s
    for owner in parents
    for p in owner["parts"]
    for i, s in enumerate(p["surfaces"])
  }
  b = Builder(
    "choriner", "Choriner Höfe / Zehdenicker Straße — balcony supports and reveals"
  )
  b.support = native_vertices((2235, -1345, 2405, -1225), receipts)
  for oldf in old["faces"]:
    # Identify the existing v250 metal handrail dimensions, not geographic
    # guesses: color 8, 55/65mm height, only above the ground register.
    selected = [
      r for r in oldf["members"] if r[6] == 8 and r[3] in [55, 65] and r[2] > 700
    ]
    if not selected:
      continue
    raw = index[(oldf["partId"], oldf["sheet"])]
    f = b.face(raw["rings"], oldf["owner"], oldf["partId"], oldf["sheet"])
    for row in selected:
      u, y, w, _, out, _ = [v / 1000 for v in row[:6]]
      for sign in [-1, 1]:
        b.put(
          f,
          u + sign * (w / 2 - 0.08),
          y - 0.41,
          0.055,
          0.81,
          0xB6B9AF,
          "existing-balcony-rail-end-support",
          out + 0.025,
          0.065,
        )
      b.put(
        f,
        u,
        y - 0.88,
        w,
        0.085,
        0xBCBCAF,
        "existing-balcony-lower-edge",
        out - 0.025,
        0.10,
      )
  return b


def nursery(parents: list, receipts: dict) -> tuple[Builder, list]:
  """Render the architect-documented garden-facing timber boxes and terraces."""
  offsets = read(DATA / "weinbergBuildingOffsetsV176.json")["offsets"]
  b = Builder("fuerstenberger", "Kindergärten City — Fürstenberger Straße 4/5")
  b.support = native_vertices((2290, -1990, 2350, -1910), receipts)
  keys, drawn_receipts = current_triangles(box(2290, -1990, 2350, -1910))
  receipts.update(drawn_receipts)
  occupied = unary_union(
    [
      footprint(v)
      for v in read(GEO / "alt-mitte-v169/source-391_5821-00.json.gz")["buildings"]
    ]
  )
  covered = []
  # Three measured projecting upper rooms, alternating with recessed terraces.
  parent = next(p for p in parents if p["id"] == KITA[0])
  p = parent["parts"][0]
  dy = offsets[parent["id"]]
  for i in [10, 16, 19, 4, 7, 8, 13]:
    sheet = p["surfaces"][i]
    f = b.face(shifted(sheet["rings"], dy), parent["id"], p["id"], i)
    mid = (f.left + f.right) / 2
    upper = f.base + 5.3
    if i in [10, 16, 19, 4]:
      old = old_facade(sheet["rings"], p["groundY"], p["topY"], occupied)
      oldrows = []
      for triangle, _, role in old.triangles:
        if min(q[1] for q in triangle) < p["groundY"] + 3.6:
          continue
        displayed = [[x, y + dy, z] for x, y, z in triangle]
        key = tri_key(displayed)
        if key not in keys:
          key = tri_key(triangle)
        if key not in keys:
          # v176 moves the already centimetre-quantised v169 packet. The
          # original half-centimetre window edges must be rounded before its
          # rigid datum shift, rather than rounding the summed float again.
          quantised = np.rint(np.asarray(triangle) * 100) / 100
          quantised[:, 1] += dy
          key = tri_key(quantised)
        assert key in keys, (parent["id"], i, role, "missing exact old triangle")
        oldrows.append({"role": role, "triangleKey": key.hex()})
      covered.append(
        {
          "owner": parent["id"],
          "partId": p["id"],
          "sheet": i,
          "oldUpperTriangles": oldrows,
        }
      )
      b.put(
        f,
        mid,
        upper,
        f.length - 0.14,
        3.4,
        WOOD,
        "nursery-upper-timber-facing",
        0.35,
        0.08,
      )
      w = f.length - 0.9
      b.put(
        f, mid, upper, w, 2.65, GLASS, "nursery-upper-group-room-glazing", 0.46, 0.07
      )
      for edge in [-1, 1]:
        b.put(
          f,
          mid + edge * (w / 2 + 0.055),
          upper,
          0.11,
          2.8,
          WOOD_JOINT,
          "nursery-timber-window-jamb",
          0.53,
          0.09,
        )
      for dy2 in [-1.37, 1.37]:
        b.put(
          f,
          mid,
          upper + dy2,
          w + 0.2,
          0.09,
          WOOD_JOINT,
          "nursery-timber-window-head-sill",
          0.53,
          0.10,
        )
      for u in np.arange(f.left + 0.65, f.right - 0.4, 1.35):
        b.put(
          f,
          float(u),
          upper,
          0.055,
          2.65,
          FRAME,
          "nursery-upper-glazing-mullion",
          0.54,
          0.045,
        )
    else:
      # Recesses are retained; no horizontal slab or infill bridges their void.
      for y in [f.base + 3.82, f.base + 2.95]:
        b.put(
          f,
          mid,
          y,
          f.length - 0.15,
          0.07,
          WOOD_JOINT,
          "nursery-terrace-railing",
          0.38,
          0.09,
        )
      for u in np.arange(f.left + 0.25, f.right - 0.15, 0.72):
        b.put(
          f,
          float(u),
          f.base + 3.37,
          0.065,
          0.89,
          WOOD,
          "nursery-terrace-baluster",
          0.40,
          0.08,
        )
  # The retained older street wing gets roof/floor edge detail only. Its old
  # window register and independent existing parent datum remain untouched.
  parent = next(p for p in parents if p["id"] == KITA[1])
  p = parent["parts"][0]
  for i in [0, 1, 6, 9]:
    f = b.face(
      shifted(p["surfaces"][i]["rings"], offsets[parent["id"]]),
      parent["id"],
      p["id"],
      i,
    )
    b.put(
      f,
      (f.left + f.right) / 2,
      f.base + 3.3,
      f.length - 0.15,
      0.13,
      0xD8D6C7,
      "nursery-old-wing-floor-edge",
      0.22,
      0.11,
    )
  return b, covered


def metropolitan(parent: dict) -> tuple[Builder, list, list]:
  """All five measured upper parts; triangulation preserves all ring holes."""
  b = Builder(
    "metropolitan", "Berlin Metropolitan School — measured copper roof addition"
  )
  upper = []
  seams = []
  for p in parent["parts"]:
    for i, s in enumerate(p["surfaces"]):
      if s["kind"] == "GroundSurface":
        continue
      ts = []
      for triangle in triangles_for(s["rings"]):
        clipped = clip_above(triangle, 23.2)
        for j in range(1, len(clipped) - 1):
          t = [clipped[0], clipped[j], clipped[j + 1]]
          if (
            np.linalg.norm(np.cross(np.array(t[1]) - t[0], np.array(t[2]) - t[0]))
            > 1e-6
          ):
            ts.append(t)
      if ts:
        upper.append(
          {
            "parentId": parent["id"],
            "partId": p["id"],
            "sheet": i,
            "sourcePolygonId": s["sourcePolygonId"],
            "kind": s["kind"],
            "triangles": ts,
            "color": COPPER,
          }
        )
      if s["kind"] != "WallSurface":
        continue
      f = b.face(s["rings"], parent["id"], p["id"], i)
      if abs(f.n[1]) > 0.01:
        continue
      # Seams follow individual measured upper-wall spans, including slopes.
      for u in np.arange(f.left + 0.45, f.right - 0.25, 1.3):
        line = f.wall.intersection(LineString([(float(u), 23.24), (float(u), f.top)]))
        for seg in line.geoms if hasattr(line, "geoms") else [line]:
          if seg.geom_type != "LineString" or seg.length < 0.3:
            continue
          lo, hi = seg.bounds[1], seg.bounds[3]
          seams.append((f, float(u), (lo + hi) / 2, 0.045, hi - lo - 0.08))
  cells = native_shell({"surfaces": upper})
  b.support = np.array(
    [
      [r[0] + dx, r[1] + dy, r[2] + dz]
      for r in cells
      for dx in [-1, 1]
      for dy in [-1, 1]
      for dz in [-1, 1]
    ]
  )
  for f, u, y, w, h in seams:
    b.put(f, u, y, w, h, COPPER_SEAM, "bms-upper-copper-standing-seam", 0.075, 0.055)
  b.g["nativeRows"] = [r[:6] + [r[7]] for r in cells] + b.g["nativeRows"]
  for f in b.faces:
    for row in f["nativeMembers"]:
      row[-1] += len(cells)
  return b, upper, cells


def build() -> tuple[dict, dict, dict]:
  """Build seven finite sites entirely from retained sources and explicit cues."""
  receipts = {}
  paths = [
    GEO / "alt-mitte-v169/source-390_5820-00.json.gz",
    GEO / "alt-mitte-v169/source-391_5821-00.json.gz",
  ]
  allparents = [b for p in paths for b in read(p)["buildings"]]
  selected = [b for b in allparents if b["id"] in {*KITA, BMS}]
  for p in paths + [
    DATA / "weinbergBuildingOffsetsV176.json",
    DATA / "lennonV250.json",
    DATA / "gipsKoppenV252.json",
  ]:
    receipts[str(p.relative_to(ROOT))] = sha(p)
  bms, upper, cells = metropolitan(next(b for b in selected if b["id"] == BMS))
  nursery_builder, covered = nursery(selected, receipts)
  builders = [
    bms,
    *school_heads(receipts),
    soap_factory(receipts),
    tiergarten(receipts),
    choriner(receipts),
    nursery_builder,
  ]
  palette = sorted(
    {int(r[-1]) for b in builders for k in ["boxes", "nativeRows"] for r in b.g[k]}
  )
  sites = []
  for b in builders:
    allrows = b.g["boxes"] + b.g["nativeRows"]
    origin = [
      round(sum(r[i] for r in allrows) / len(allrows) / 10) * 10 if i != 1 else 0
      for i in range(3)
    ]

    def pack(row: list, native: bool) -> list:
      return (
        [round((row[i] - origin[i]) * 1000) for i in range(3)]
        + [round(v * 1000) for v in row[3:6]]
        + ([] if native else [round(row[6] * 1e6)])
        + [palette.index(int(row[-1]))]
      )

    sites.append(
      {
        "key": b.key,
        "name": b.name,
        "origin": origin,
        "boxes": [pack(r, False) for r in b.g["boxes"]],
        "nativeRows": [pack(r, True) for r in b.g["nativeRows"]],
        "roles": dict(b.roles),
      }
    )
  triangles = [t for s in upper for t in s["triangles"]]
  model = {
    "schemaVersion": 1,
    "palette": palette,
    "sites": sites,
    "bmsUpperPositions": base64.b64encode(
      np.asarray(triangles, dtype="<f4").tobytes()
    ).decode(),
    "bmsUpperColor": COPPER,
    "counts": {
      "sites": len(sites),
      "boxes": sum(len(b.g["boxes"]) for b in builders),
      "nativeRows": sum(len(b.g["nativeRows"]) for b in builders),
      "bmsUpperTriangles": len(triangles),
      "bmsUpperParts": len({s["partId"] for s in upper}),
      "bmsNativeSurfaceCells": len(cells),
    },
  }
  ev = {
    "sourceSha256": receipts,
    "sites": [
      {"key": b.key, "faces": b.faces, "roles": dict(b.roles)} for b in builders
    ],
    "bmsUpperSheets": upper,
    "preservation": "All earlier source/packet/model files remain unchanged. No global suppression, new terrain, navigation floor, texture, animation or descriptor.",
    "kitaIdentity": {
      "name": "Kindergärten City — Fürstenberger Straße 4/5",
      "osmWay": "28417249",
      "owners": list(KITA),
    },
    "nurseryUpperProxyReceipts": covered,
    "limits": "Measured sources determine walls, roofs and positions. Opening sizes, joinery, colours and rail dimensions remain proportional display estimates. The current per-parent terrain datums remain unchanged. No claim of a surveyed facade. BMS upper envelope only above the exact old 23.2 m roof; old ground floors retained.",
  }
  frozen = {
    "parents": selected,
    "sources": [
      {
        "url": "https://www.sauerbruchhutton.de/en/project/bms",
        "cue": "Three rooftop extensions, timber construction and copper cladding; 2014–2020.",
      },
      {
        "url": "https://anderhalten.com/projekte/kindertagesstatte-berlin-mitte",
        "cue": "Two-storey L-shaped daycare, projecting and recessed upper group rooms alternating with terraces.",
      },
      {
        "url": "https://www.kindergaertencity.de/fuerstenberger-str-4",
        "cue": "Operator identity, 2011 extension and three play terraces.",
      },
      {
        "url": "https://tgw-architekten.de/menzel-oberschule/",
        "cue": "2012 facade/window refurbishment at Altonaer Straße 26.",
      },
      {
        "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035166",
        "cue": "Four-storey main school, three-storey director house, segmental openings and terracotta detail.",
      },
      {
        "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080444",
        "cue": "Blankenstein school, Zehdenicker Straße 17; existing v250 reference opening register retained.",
      },
      {
        "url": "https://besmartacademy.com/alte-seifenfabrik/ueberblick/",
        "cue": "Restored brick factory and rooftop addition at Torstraße 134.",
      },
      {
        "url": "https://www.collignonarchitektur.com/de/projekte/choriner-hoefe",
        "cue": "Layered/sculptural street facade; all six existing v250 source owners and opening registers remain.",
      },
    ],
    "sourceLicences": {"BerlinLoD2": "dl-de/zero-2-0", "OpenStreetMap": "ODbL-1.0"},
  }
  return model, ev, frozen


def navigation(evidence: dict, source: dict) -> dict:
  """Only the new measured BMS upper shell affects roof/solid queries."""
  parent = next(p for p in source["parents"] if p["id"] == BMS)
  cells = native_shell({"surfaces": evidence["bmsUpperSheets"]})
  roof = {}
  for x, y, z, *_ in cells:
    roof[x, z] = max(roof.get((x, z), -math.inf), y + 1)
  native_footprint = unary_union([box(x - 1, z - 1, x + 1, z + 1) for x, z in roof])
  native_polygons = (
    [native_footprint]
    if native_footprint.geom_type == "Polygon"
    else list(native_footprint.geoms)
  )
  return {
    "owner": BMS,
    "parts": [
      {
        "id": p["id"],
        "sourceId": BMS,
        "groundY": 23.2,
        "topY": p["topY"],
        "polygons": p["footprintPolygons"],
      }
      for p in parent["parts"]
    ],
    "roofTriangles": [
      t
      for s in evidence["bmsUpperSheets"]
      if s["kind"] == "RoofSurface"
      for t in s["triangles"]
    ],
    "nativeRoofCells": [[x, z, y] for (x, z), y in sorted(roof.items())],
    "nativeUpperPart": {
      "id": BMS + ":native-upper-v274",
      "groundY": min(y - 1 for _, y, *_ in cells),
      "topY": max(roof.values()),
      "polygons": [
        {
          "ring": [list(p) for p in poly.exterior.coords[:-1]],
          "holes": [[list(p) for p in r.coords[:-1]] for r in poly.interiors],
        }
        for poly in native_polygons
      ],
    },
  }


if __name__ == "__main__":
  model, evidence, source = build()
  OUT.write_text(json.dumps(model, separators=(",", ":")) + "\n")
  EVIDENCE.write_text(json.dumps(evidence, separators=(",", ":")) + "\n")
  SOURCE.write_bytes(
    gzip.compress(json.dumps(source, separators=(",", ":")).encode(), mtime=0)
  )
  NAV.write_text(json.dumps(navigation(evidence, source), separators=(",", ":")) + "\n")
  print(model["counts"])
  print({p.name: p.stat().st_size for p in [OUT, EVIDENCE, SOURCE, NAV]})
