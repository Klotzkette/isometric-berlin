"""Step 10: bounded facade recognition on retained school/square source faces.

Never replaces shells, old details, court openings, terrain or collision. Window
heads follow existing delivered pane rhythms; they are not a facade survey.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src/data"
OFFSETS = json.loads((APP / "weinbergBuildingOffsetsV176.json").read_text())["offsets"]


def read(path: Path) -> dict:
  """Read retained sources only."""
  return json.loads(path.read_text())


def group(name: str, owner: str) -> dict:
  """An exact-count, independently culled static batch."""
  return dict(
    name=name, owner=owner, boxes=[], rods=[], nativeRows=[], labels=[], faces=[]
  )


class Face:
  """Project every member against a specific source wall with its holes."""

  def __init__(self, target: dict, rings: list, normal: list | None = None):
    self.target = target
    points = np.array(rings[0], dtype=float)
    self.a, b = max(
      ((a, b) for a in points for b in points),
      key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
    )
    self.d = np.array([b[0] - self.a[0], 0, b[2] - self.a[2]])
    self.length = float(np.linalg.norm(self.d))
    self.d /= self.length
    self.n = (
      np.array(normal, dtype=float)
      if normal
      else sum(
        (
          np.cross(points[i] - points[0], points[i + 1] - points[0])
          for i in range(1, len(points) - 1)
        ),
        np.zeros(3),
      )
    )
    self.n /= np.linalg.norm(self.n)
    projected = [
      [(float(np.dot(np.array(p) - self.a, self.d)), p[1]) for p in r] for r in rings
    ]
    self.wall = Polygon(projected[0], projected[1:]).buffer(0)
    self.left, self.base, self.right, self.top = self.wall.bounds
    self.yaw = -math.atan2(self.d[2], self.d[0])
    self.audit = dict(rings=rings, normal=self.n.tolist(), boxes=[], rods=[])
    target["faces"].append(self.audit)

  def point(self, u: float, y: float, out: float = 0.34) -> list:
    """Retain source horizontal orientation and rigid parent height."""
    p = self.a + self.d * u + self.n * out
    return [round(float(p[0]), 4), round(y, 4), round(float(p[2]), 4)]

  def member(
    self,
    u: float,
    y: float,
    w: float,
    h: float,
    color: int,
    depth: float = 0.10,
    out: float = 0.34,
  ) -> None:
    """A shallow visible member, clipped before emission in both modes."""
    if not self.wall.buffer(1e-5).covers(
      box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
    ):
      return
    self.audit["boxes"].append(len(self.target["boxes"]))
    self.target["boxes"].append(
      [*self.point(u, y, out), round(w, 4), round(h, 4), depth, self.yaw, color]
    )
    cells = max(1, math.ceil(w / 0.8))
    for i in range(cells):
      p = self.point(u - w / 2 + (i + 0.5) * w / cells, y, 1.4 + out - 0.34)
      self.target["nativeRows"].append(
        [
          *p,
          max(0.18, abs(self.d[0]) * w / cells),
          h,
          max(0.18, abs(self.d[2]) * w / cells),
          color,
        ]
      )

  def stroke(self, a: tuple, b: tuple, color: int, width: float = 0.11) -> None:
    """Thin arch lines with a separately sampled orthogonal native reading."""
    if not self.wall.buffer(1e-5).covers(
      LineString([a, b]).buffer(width / 2, cap_style=2)
    ):
      return
    self.audit["rods"].append(len(self.target["rods"]))
    self.target["rods"].append(
      [*self.point(*a, 0.38), *self.point(*b, 0.38), width, color]
    )
    steps = max(1, math.ceil(math.dist(a, b) / 0.26))
    for i in range(steps):
      t = (i + 0.5) / steps
      self.target["nativeRows"].append(
        [
          *self.point(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 1.43),
          0.19,
          0.26,
          0.19,
          color,
        ]
      )

  def arch(self, u: float, y: float, width: float, rise: float, color: int) -> None:
    """A nine-segment window head: curved in drawn modes, stepped in native."""
    points = [
      (u + width / 2 * math.cos(math.pi * i / 9), y + rise * math.sin(math.pi * i / 9))
      for i in range(10)
    ]
    for a, b in zip(points, points[1:]):
      self.stroke(a, b, color, 0.12)


def school_refinements() -> list:
  """Real material/head cues, attached to unchanged previously selected faces."""
  result = []
  for source in read(GEO / "schools-v185-evidence.json")["schools"]:
    name = source["name"]
    g = group(name, source["owner"])
    g["terrainOffsetY"] = source["displayTerrainOffsetY"]
    for raw in source["faces"]:
      f = Face(g, raw["rings"], raw["normal"])
      length = f.right - f.left
      if name == "Gymnasium Tiergarten":
        # Source photographed opaque red window panels get projecting edge
        # frames. Derive the red panel side from the original ring direction.
        tier = read(ROOT / "src/app/src/gymnasiumTiergartenSource.json")
        part = next(p for p in tier["parts"] if p["id"] == raw["partId"])
        ring = part["ring"]
        edge_a, edge_b = min(
          zip(ring, ring[1:] + ring[:1]),
          key=lambda ab: abs(math.dist(ab[0], ab[1]) - length),
        )
        start = np.array([edge_a[0], 0, edge_a[1]])
        direction = np.array([edge_b[0] - edge_a[0], 0, edge_b[1] - edge_a[1]])
        direction /= np.linalg.norm(direction)
        bays = max(1, math.floor((length - 1.4) / 2.55))
        pitch = (length - 1.4) / bays
        for y in [7.25, 10.4, 14.5, 18.6, 22.7, 26.8]:
          height = 1.9 if y < 8 else 2.25
          for i in range(bays):
            p = start + direction * (0.7 + (i + 0.5) * pitch + pitch * 0.72 * 0.3)
            u = float(np.dot(p - f.a, f.d))
            for side in [-1, 1]:
              f.member(u + side * 0.135, y, 0.055, height, 0x7E4435, 0.12)
            f.member(u, y + height / 2, 0.3, 0.055, 0xC4C6BA, 0.12)
        continue
      if name == "Berlin Metropolitan School":
        # Warm brick-slip piers of the retained 1980s concrete-panel school;
        # copper is restricted to the already delivered upper edge.
        bays = max(1, round(length / 3.4))
        pitch = length / bays
        for i in range(1, bays):
          u = f.left + i * pitch
          f.member(u, (f.base + f.top) / 2, 0.28, f.top - f.base - 1.4, 0xA76F54)
        # Narrow copper standing seams, not an invented roof volume.
        for u in np.arange(f.left + 0.5, f.right, 0.85):
          f.member(float(u), f.top - 0.48, 0.055, 0.36, 0x665341, 0.11)
        continue
      if name == "Kastanienbaum Grundschule front":
        # QA confirms this retained legacy face has no existing pane layer.
        # Its photograph establishes four bays, three levels and two doors.
        pitch = length / 4
        storey = (f.top - f.base) / 3
        for i in range(5):
          u = (
            f.left + 0.24
            if i == 0
            else f.right - 0.24
            if i == 4
            else f.left + i * pitch
          )
          f.member(
            u,
            (f.base + f.top) / 2,
            0.4 if i in [0, 4] else 0.8,
            f.top - f.base - 0.5,
            0xAE714E,
            0.07,
            0.22,
          )
        for y in [f.base + storey, f.base + storey * 2]:
          f.member((f.left + f.right) / 2, y, length - 0.2, 0.32, 0xAF704C, 0.07, 0.24)
        for level in range(3):
          for bay in range(4):
            u = f.left + (bay + 0.5) * pitch
            y = f.base + (level + 0.52) * storey
            w, h = 1.45, 1.85
            doorway = level == 0 and bay in [0, 3]
            if doorway:
              w = 1.6 if bay == 0 else 2.1
              h = 2.55
              y = f.base + 1.43
            f.member(u, y, w, h, 0x344A4D if doorway else 0x59747B, 0.065, 0.22)
            for side in [-1, 1]:
              f.member(u + side * (w / 2 + 0.035), y, 0.08, h, 0x8A4C3E)
            f.member(u, y, 0.065, h, 0x8A4C3E)
            f.member(u, y + h * 0.2, w, 0.08, 0x8A4C3E)
            f.arch(u, y + h / 2 + 0.06, w + 0.2, 0.2, 0xA76849)
            if level == 1:
              f.member(u, y - h / 2 - 0.25, w, 0.18, 0xB58258)
              for dx in [-0.42, 0, 0.42]:
                f.member(u + dx, y - h / 2 - 0.25, 0.09, 0.1, 0x74523E)
        continue
      # Re-use the source renderer's pane register, rather than putting a
      # second window grid over it. Steglitz uses its explicit delivered rows.
      if name == "Gymnasium Steglitz":
        boxes = read(APP / "steglitzV182Source.json")["boxes"]
        panes = []
        for row in boxes:
          if row[7] != 0x51666A:
            continue
          p = np.array(row[:3])
          u = float(np.dot(p - f.a, f.d))
          if abs(float(np.dot(p - f.a, f.n))) < 0.2 and f.wall.covers(
            box(u - row[3] / 2, row[1] - 0.85, u + row[3] / 2, row[1] + 0.85)
          ):
            panes.append((u, row[1], row[3], 1.7))
        trim = 0xDEDAC9
        head = 0x815547
      else:
        pitch = length / max(1, round(length / 3.4))
        panes = []
        for y in np.arange(f.base + 2.25, f.top - 0.8, 3.25):
          for u in np.arange(f.left + 0.05 + pitch / 2, f.right - 0.05, pitch):
            if f.wall.buffer(-0.05).covers(
              box(u - 0.76, y - 1.015, u + 0.76, y + 1.015)
            ):
              panes.append((float(u), float(y), 1.25, 1.79))
        trim = 0xE0D8B9 if "Lennon" in name else 0xAA6747
        head = 0xD6C6A1 if "Lennon" in name else 0xA76849
      top_row = max((p[1] for p in panes), default=0)
      for u, y, w, h in panes:
        if name in ["Kastanienbaum Grundschule main", "John-Lennon-Gymnasium"]:
          # QA confirms these selected walls have no legacy pane packet.
          # Add only the glazing within these already selected frame openings.
          f.member(u, y, w, h, 0x59747B, 0.065, 0.22)
        # Leave every glazing plane and sill visible; only frames and heads.
        for side in [-1, 1]:
          f.member(u + side * (w / 2 + 0.035), y, 0.075, h, trim, 0.095)
        f.member(u, y + 0.23 * h, w, 0.065, trim, 0.095)
        rise = 0.55 if "Lennon" in name and abs(y - top_row) < 0.1 else 0.2
        f.arch(u, y + h / 2 + 0.07, w + 0.18, rise, head)
        if "Kastanienbaum" in name and f.base + 4 < y < f.base + 8:
          # Small terracotta quatrefoil suggestion below the existing sill.
          f.member(u, y - h / 2 - 0.28, w, 0.19, 0xB58258)
          for q in [-0.36, 0, 0.36]:
            f.member(u + q, y - h / 2 - 0.28, 0.08, 0.10, 0x7C563D, 0.115)
    result.append(g)
  return result


def shifted(rings: list, dy: float) -> list:
  """Apply the already displayed whole-parent datum, not local vertex terrain."""
  return [[[x, y + dy, z] for x, y, z in r] for r in rings]


def place_refinements() -> list:
  """Rosenthal corner, source-bound soap factory and existing Choriner fronts."""
  result = []
  # Circus Hostel: photographed rustication only on its lower two registers.
  source = read(GEO / "rosenthaler-platz-v163.json")
  owner = "DEBE01YYK0000E7j"
  b = next(b for b in source["buildings"] if b["id"] == owner)
  g = group("Rosenthaler Platz – Circus corner", owner)
  datum = min(
    p[1] for part in b["parts"] for s in part["surfaces"] for r in s["rings"] for p in r
  )
  dy = 3 - datum + OFFSETS.get(owner, 0)
  for part in b["parts"]:
    for s in part["surfaces"]:
      if s["kind"] != "WallSurface":
        continue
      rings = shifted(s["rings"], dy)
      pts = np.array(rings[0])
      n = sum(
        (
          np.cross(pts[i] - pts[0], pts[i + 1] - pts[0]) for i in range(1, len(pts) - 1)
        ),
        np.zeros(3),
      )
      n /= max(1e-9, np.linalg.norm(n))
      c = pts.mean(axis=0)
      if abs(n[1]) > 0.03 or not (n[2] > 0.5 and c[2] > -1190):
        continue
      f = Face(g, rings, n.tolist())
      length = f.right - f.left
      if length < 8:
        continue
      pitch = length / max(1, round(length / 3.1))
      ground = 3 + OFFSETS.get(owner, 0)
      levelh = max(2.65, (f.top - ground - 0.35) / 5)
      # Segmented rustication between panes, never a panel across the windows.
      for u in np.arange(f.left + pitch, f.right - 0.4, pitch):
        for y in np.arange(ground + levelh * 0.95, ground + levelh * 2.85, 0.56):
          f.member(float(u), float(y), max(0.24, pitch - 1.95), 0.065, 0xA6ABA5, 0.12)
  result.append(g)
  # Exact source owner contains the mapped be smart academy entrance node.
  owner = "DEBE01YYK0000BOt"
  g = group("be smart academy – Alte Seifenfabrik", owner)
  g["osmNode"] = 1389419281
  g["address"] = "Torstraße 134"
  g["terrainOffsetY"] = OFFSETS.get(owner, 0)
  b = next(
    b for b in read(GEO / "mitte-streets-v166.json")["buildings"] if b["id"] == owner
  )
  for part in b["parts"]:
    for s in part["surfaces"]:
      if s["kind"] != "WallSurface":
        continue
      rings = shifted(s["rings"], OFFSETS.get(owner, 0))
      pts = np.array(rings[0])
      n = sum(
        (
          np.cross(pts[i] - pts[0], pts[i + 1] - pts[0]) for i in range(1, len(pts) - 1)
        ),
        np.zeros(3),
      )
      n /= max(1e-9, np.linalg.norm(n))
      if n[2] > -0.95 or pts[:, 2].mean() > -1119:
        continue
      f = Face(g, rings, n.tolist())
      length = f.right - f.left
      bays = 3 if length > 8 else 1
      pitch = length / bays
      for i in range(bays + 1):
        u = (
          f.left + 0.24
          if i == 0
          else f.right - 0.24
          if i == bays
          else f.left + i * pitch
        )
        f.member(u, f.base + 5.4, 0.5 if i in [0, bays] else 0.72, 10.3, 0x963F45)
      for y in [f.base + 3.35, f.base + 6.65, f.base + 10.2]:
        f.member((f.left + f.right) / 2, y, length - 0.12, 0.58, 0x963F45)
      # Photographed industrial glazing on a previously undecorated street
      # source wall, not another grid over an existing window packet.
      for level in range(3):
        for bay in range(bays):
          u = f.left + (bay + 0.5) * pitch
          y = f.base + 1.9 + level * 3.3
          w = min(2.45, pitch - 0.9)
          h = 2.0 if level else 2.5
          f.member(u, y, w, h, 0x4A656D, 0.065, 0.22)
          for side in [-1, 1]:
            f.member(u + side * w / 2, y, 0.07, h, 0x343E41)
          f.member(u, y, w, 0.055, 0x343E41)
          f.member(u, y, 0.055, h, 0x343E41)
      # The silver upper-storey frame stays inside measured existing walls.
      y = f.top - 1.85
      for u in np.arange(f.left + 0.45, f.right - 0.2, 0.78):
        f.member(float(u), y, 0.62, 2.7, 0x74898B, 0.06, 0.22)
        f.member(float(u) - 0.36, y, 0.065, 2.7, 0xBCC0B8)
      f.member((f.left + f.right) / 2, f.top - 0.25, length - 0.12, 0.17, 0xBCC0B8)
      f.member((f.left + f.right) / 2, f.top - 3.28, length - 0.12, 0.17, 0xBCC0B8)
      if length > 8:
        p = f.point((f.left + f.right) / 2, f.base + 6.42, 0.52)
        # Stroke lettering. No logo/font/image texture; old wall remains live.
        g["labels"].append(
          dict(
            text="ALTE SEIFENFABRIK",
            center=p,
            direction=[float(f.n[2]), 0, float(-f.n[0])],
            normal=f.n.tolist(),
            height=0.48,
            color=0xE4E4D4,
          )
        )
  result.append(g)
  # The existing two independently sourced public faces of Choriner 84.
  owner = "DEBE01YYK00005YZ"
  g = group("Choriner Höfe – street fronts", owner)
  g["terrainOffsetY"] = OFFSETS.get(owner, 0)
  for raw in read(APP / "northV185.json")["faces"]:
    if raw["id"] != owner:
      continue
    a = np.array([raw["a"][0], 0, raw["a"][1]])
    d = np.array([raw["b"][0] - a[0], 0, raw["b"][1] - a[2]])
    d /= np.linalg.norm(d)
    rings = [
      [
        [a[0] + d[0] * u, 3 + OFFSETS.get(owner, 0) + y, a[2] + d[2] * u]
        for u, y in ring
      ]
      for ring in shape(raw["wallGeometry"]).__geo_interface__["coordinates"]
    ]
    f = Face(g, rings, [raw["normal"][0], 0, raw["normal"][1]])
    # Follow precisely the already rendered NorthV185 pane register.
    length = raw["length"]
    ground = 3 + OFFSETS.get(owner, 0) + raw["wallBottom"]
    top = 3 + OFFSETS.get(owner, 0) + raw["wallTop"]
    floors = min(7, max(1, math.floor((top - ground - 1) / 3.65)))
    pitchy = (top - ground - 1.5) / floors
    bays = max(1, math.floor(length / 3.7))
    pitch = length / bays
    for level in range(floors):
      y = ground + 1.85 + level * pitchy
      if y + 1.15 >= top - 0.8:
        continue
      for bay in range(bays):
        # Resolve original source-u direction into Face's farthest-pair basis.
        p = a + d * ((bay + 0.5) * pitch)
        u = float(np.dot(p - f.a, f.d))
        w = min(2.1, pitch * 0.48)
        h = min(2, pitchy * 0.58)
        f.member(u, y + h * 0.22, w, 0.075, 0xDBDCD0)
        # Keep only an interior transom. Additional outer reveals would
        # emphasize the pre-existing second generic pane register underneath.
  result.append(g)
  return result


def build() -> dict:
  """No read/modify/write of previous detail payloads: additions are separate."""
  sources = [
    GEO / "schools-v185-evidence.json",
    APP / "schoolsV185.json",
    APP / "steglitzV182Source.json",
    GEO / "rosenthaler-platz-v163.json",
    GEO / "mitte-streets-v166.json",
    APP / "northV185.json",
    APP / "weinbergBuildingOffsetsV176.json",
  ]
  return dict(
    schemaVersion=1,
    step=10,
    schools=school_refinements(),
    places=place_refinements(),
    sourceSha256={
      str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in sources
    },
    policy="Additive source-face members only; no removal of geometry, source detail, terrain or courts. Fine member spacing and colours are estimates; retained window registers are not claimed as surveyed. All modes retain static detail.",
  )


if __name__ == "__main__":
  model = build()
  (APP / "schoolsPlacesV205.json").write_text(
    json.dumps(model, separators=(",", ":")) + "\n"
  )
  for g in model["schools"] + model["places"]:
    print(g["name"], len(g["boxes"]), len(g["rods"]), len(g["nativeRows"]))
