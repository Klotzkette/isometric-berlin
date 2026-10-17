"""Step 10: bounded, source-bound school/culture recognition; no owner transfer."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_schools_places_v205 import Face, group
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"


def read(path: Path) -> dict:
  """Read immutable retained geometry."""
  return json.loads(path.read_text())


def sha(path: Path) -> str:
  """Record the untouched input payload."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def site(key: str, name: str, owner: str) -> dict:
  """Independent culling and exact-sized static buffers per location."""
  return {**group(name, owner), "key": key, "sheets": []}


def prism_faces(target: dict, prism: dict) -> list[Face]:
  """Follow the actually displayed legacy faces where source conflicts persist."""
  ring = [[x / 10, z / 10] for x, z in prism["ring"]]
  p = Polygon(ring)
  if not p.exterior.is_ccw:
    ring.reverse()
  lo, hi = prism["y0_dm"] / 10, (prism["y0_dm"] + prism["h_dm"]) / 10
  result = []
  for a, b in zip(ring, ring[1:] + ring[:1]):
    if math.dist(a, b) < 2:
      continue
    d = np.array([b[0] - a[0], 0, b[1] - a[1]])
    n = np.array([d[2], 0, -d[0]]) / np.linalg.norm(d)
    rings = [[[a[0], lo, a[1]], [b[0], lo, b[1]], [b[0], hi, b[1]], [a[0], hi, a[1]]]]
    result.append(Face(target, rings, n.tolist()))
  return result


def label(f: Face, text: str, u: float, y: float, h: float, color: int) -> None:
  """Original procedural lettering, never a photograph or external font."""
  # Keep lettering left-to-right when viewed from outside the source wall.
  d = [f.n[2], 0, -f.n[0]]
  f.target["labels"].append(
    dict(
      text=text,
      center=f.point(u, y, 0.52),
      direction=d,
      normal=f.n.tolist(),
      height=h,
      color=color,
    )
  )


def entrance(f: Face, u: float, color: int, title: str) -> None:
  """Restrained portal framing with a pair of small informational plaques."""
  for side in [-1, 1]:
    f.member(u + side * 1.45, f.base + 2.05, 0.28, 3.8, color, 0.18, 0.43)
    f.member(u + side * 1.45, f.base + 0.25, 0.48, 0.35, color, 0.2, 0.44)
  f.member(u, f.base + 4.05, 3.35, 0.3, color, 0.2, 0.43)
  f.arch(u, f.base + 4.2, 2.9, 0.5, color)
  f.member(u, f.base + 4.72, 0.28, 0.4, color, 0.19, 0.43)
  # Plaques remain beside the opening; no new facade window grid or opaque door.
  for dx in [-2.45, 2.45]:
    f.member(u + dx, f.base + 2.1, 0.6, 0.85, 0x5E6561, 0.06, 0.42)
  label(f, title, u, f.base + 5.35, 0.31, 0x534C40)


def box(g: dict, c: list, size: list, yaw: float, color: int) -> None:
  """A rotated drawn member and independently axis-stepped native member."""
  g["boxes"].append([*c, *size, yaw, color])
  w, h, d = size
  nx, nz = max(1, math.ceil(w / 0.8)), max(1, math.ceil(d / 0.8))
  for i in range(nx):
    for j in range(nz):
      u, v = (i + 0.5) * w / nx - w / 2, (j + 0.5) * d / nz - d / 2
      g["nativeRows"].append(
        [
          c[0] + math.cos(yaw) * u + math.sin(yaw) * v,
          c[1],
          c[2] - math.sin(yaw) * u + math.cos(yaw) * v,
          max(0.13, w / nx),
          h,
          max(0.13, d / nz),
          color,
        ]
      )


def sheet(g: dict, ring: list, color: int) -> None:
  """Hollow drawn roof sheet and bounded separately sampled native surface."""
  g["sheets"].append({"ring": ring, "color": color})
  # Bilinear quads avoid triangulation seam duplicate blocks.
  a, b, c, d = [np.array(p) for p in ring]
  nu = max(1, math.ceil(max(np.linalg.norm(b - a), np.linalg.norm(c - d)) / 0.8))
  nv = max(1, math.ceil(max(np.linalg.norm(d - a), np.linalg.norm(c - b)) / 0.8))
  for i in range(nu):
    for j in range(nv):
      u, v = (i + 0.5) / nu, (j + 0.5) / nv
      p = a * (1 - u) * (1 - v) + b * u * (1 - v) + c * u * v + d * (1 - u) * v
      g["nativeRows"].append([*p.tolist(), 0.84, 0.32, 0.84, color])


def sophien(g: dict) -> None:
  """Missing recognition above the retained source, not a source replacement.

  West axis and footprint are constrained by the retained church ring. Official
  Berlin describes a 69 m tower; subdivisions and roof ridge are estimates.
  """
  west = np.array([1940.675, -691.235])
  axis = np.array([0.969015, -0.246998])
  side = np.array([0.246998, 0.969015])
  yaw = math.atan2(-axis[1], axis[0])

  def p(u: float, y: float, v: float) -> list:
    q = west + axis * u + side * v
    return [float(q[0]), y, float(q[1])]

  # Source eave retained at18.6; tall gable roof is documented, ridge estimated.
  for sign in [-1, 1]:
    sheet(
      g,
      [
        p(10, 18.62, sign * 8.9),
        p(47, 18.62, sign * 8.9),
        p(47, 30.1, 0),
        p(10, 30.1, 0),
      ],
      0x766B61,
    )
  for u in [10, 47]:
    # Two degenerate-edge quads form gable triangles without a solid prism.
    sheet(
      g, [p(u, 18.62, -8.9), p(u, 18.62, 8.9), p(u, 30.1, 0), p(u, 30.1, 0)], 0xC9C1A7
    )
  center = p(4.8, 0, 0)
  # Hollow tiers leave all original flat source sheets below them untouched.
  for lo, hi, w in [(18.6, 38, 9.1), (38, 49, 7.9), (49, 60, 6.4)]:
    for sign in [-1, 1]:
      for along in [True, False]:
        q = p(
          4.8 + (0 if along else sign * w / 2),
          (lo + hi) / 2,
          sign * w / 2 if along else 0,
        )
        box(g, q, [w, hi - lo, 0.24] if along else [0.24, hi - lo, w], yaw, 0xC7BFA4)
    for y in [lo + 0.25, hi - 0.25]:
      # Four shallow cornice bars; the middle is empty.
      for sign in [-1, 1]:
        box(g, p(4.8, y, sign * (w / 2 + 0.18)), [w + 0.7, 0.42, 0.5], yaw, 0xE1D9C0)
        box(
          g, p(4.8 + sign * (w / 2 + 0.18), y, 0), [0.5, 0.42, w + 0.7], yaw, 0xE1D9C0
        )
    for sign in [-1, 1]:
      for transverse in [-1, 1]:
        box(
          g,
          p(4.8 + sign * (w / 2 - 0.62), (lo + hi) / 2, transverse * (w / 2 + 0.2)),
          [0.36, hi - lo - 1.5, 0.45],
          yaw,
          0xE0D6B9,
        )
    # Tall louver openings on each side, below the separate copper hood.
    for sign in [-1, 1]:
      for along in [True, False]:
        face_point = p(
          4.8 + (0 if along else sign * (w / 2 + 0.15)),
          (lo + hi) / 2,
          sign * (w / 2 + 0.15) if along else 0,
        )
        box(
          g,
          face_point,
          [2.2, hi - lo - 3, 0.15] if along else [0.15, hi - lo - 3, 2.2],
          yaw,
          0x56605A,
        )
        for y in np.arange(lo + 2, hi - 1.3, 0.65):
          q = p(
            4.8 + (0 if along else sign * (w / 2 + 0.26)),
            float(y),
            sign * (w / 2 + 0.26) if along else 0,
          )
          box(g, q, [2.15, 0.1, 0.13] if along else [0.13, 0.1, 2.15], yaw, 0xA5A58D)
  # Layered swelling copper cap, not a generic pointed cone.
  profile = [
    (60, 3.65),
    (60.6, 3.95),
    (62.1, 3.25),
    (63.5, 2.1),
    (64.2, 1.8),
    (65.4, 2.5),
    (66.6, 2.25),
    (68, 1.1),
    (70.4, 0.55),
    (72.6, 0.15),
  ]
  for (y0, r0), (y1, r1) in zip(profile, profile[1:]):
    for k in range(12):
      a, b = 2 * math.pi * k / 12, 2 * math.pi * (k + 1) / 12
      sheet(
        g,
        [
          p(4.8 + r0 * math.cos(a), y0, r0 * math.sin(a)),
          p(4.8 + r0 * math.cos(b), y0, r0 * math.sin(b)),
          p(4.8 + r1 * math.cos(b), y1, r1 * math.sin(b)),
          p(4.8 + r1 * math.cos(a), y1, r1 * math.sin(a)),
        ],
        0x648779,
      )
  box(g, p(4.8, 73.2, 0), [0.14, 1.1, 0.14], 0, 0xC5A64E)
  for k in range(8):
    a = math.pi * k / 4
    a0 = p(4.8, 73.55 + 0.25 * math.sin(a), 0.25 * math.cos(a))
    b0 = p(4.8, 73.55 + 0.65 * math.sin(a), 0.65 * math.cos(a))
    g["rods"].append([*a0, *b0, 0.09, 0xD9BA5B])
    for t in [0.2, 0.5, 0.8]:
      q = [a0[i] + (b0[i] - a0[i]) * t for i in range(3)]
      g["nativeRows"].append([*q, 0.12, 0.12, 0.12, 0xD9BA5B])
  g["recognition"] = {
    "towerHeightM": 69,
    "groundY": 5.2,
    "towerCenter": center,
    "towerFootprint": [
      p(4.8 + u, 5.2, v)[::2]
      for u, v in [(-4.55, -4.55), (4.55, -4.55), (4.55, 4.55), (-4.55, 4.55)]
    ],
    "estimate": "West axis and body footprint from LoD2/OSM; 69m from Berlin.de; tier dimensions, ridge and tones approximate.",
  }


def build() -> None:
  """Emit only bounded new data and evidence; never mutate earlier packets."""
  prism_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  prisms = {p["id"]: p for p in read(prism_path)["buildings"]}
  result = []
  g = site(
    "jewish-gymnasium", "Jüdisches Gymnasium Moses Mendelssohn", "OSM-way-23816407"
  )
  faces = prism_faces(g, prisms["23816407"])
  f = min(
    (f for f in faces if f.length > 10),
    key=lambda f: f.point((f.left + f.right) / 2, 6)[0],
  )
  u = (f.left + f.right) / 2
  entrance(f, u, 0xD9CFB2, "MOSES MENDELSSOHN")
  for y in np.arange(f.base + 0.7, f.base + 4, 0.55):
    for sign in [-1, 1]:
      f.member(u + sign * 5.4, float(y), 3.6, 0.06, 0xA69D88, 0.07, 0.23)
  result.append(g)
  g = site(
    "otto-weidt-workshop",
    "Museum Blindenwerkstatt Otto Weidt – erster Hof",
    "OSM-way-147686950 / prism47686950",
  )
  f = min(
    (f for f in prism_faces(g, prisms["47686950"]) if f.length > 10),
    key=lambda f: f.n[2],
  )
  u = (f.left + f.right) / 2
  f.member(u, f.base + 4.15, 8.5, 0.92, 0xD6CFB9, 0.09, 0.34)
  label(f, "BLINDENWERKSTATT OTTO WEIDT", u, f.base + 4.15, 0.34, 0x42483F)
  f.member(u - 5.3, f.base + 2.1, 0.65, 1.0, 0x997450, 0.08, 0.4)
  # First-floor workshop identification and stair-side directional mark only.
  for y in [f.base + 0.6, f.base + 3.5]:
    f.member(u, y, 8.5, 0.1, 0x968C76, 0.12, 0.36)
  result.append(g)
  previous = read(GEO / "schools-v185-evidence.json")["schools"]
  for name, key in [
    ("Gymnasium Steglitz", "gymnasium-steglitz"),
    ("Gymnasium Tiergarten", "gymnasium-tiergarten"),
  ]:
    old = next(s for s in previous if s["name"] == name)
    g = site(key, name, old["owner"])
    if key == "gymnasium-steglitz":
      raw = old["faces"][0]
      f = Face(g, raw["rings"], raw["normal"])
      # Upper brickwork: tooth and inset profile aligned to existing eave;
      # no alteration or covering of v182/v205 windows, arches or source roof.
      for u in np.arange(f.left + 0.6, f.right - 0.4, 0.9):
        f.member(float(u), f.top - 0.62, 0.3, 0.24, 0xA46F55, 0.13, 0.43)
      f.member(
        (f.left + f.right) / 2, f.top - 1.02, f.length - 0.6, 0.12, 0xC1A586, 0.14, 0.42
      )
      for sign in [-1, 1]:
        u = f.left + 0.38 if sign < 0 else f.right - 0.38
        for y in np.arange(f.base + 0.8, f.top - 1.4, 0.7):
          f.member(u, float(y), 0.33, 0.18, 0xBC9275, 0.1, 0.41)
    else:
      # Exact existing Aula doorway plane and dimensions from v140. Only
      # chrome handles, door-head reveal and blue opaque-cladding joints.
      a = np.array([-2156.318, 5.2, -96.795])
      b = np.array([-2142.896, 5.2, -90.952])
      d = b - a
      d[1] = 0
      d /= np.linalg.norm(d)
      n = np.array([d[2], 0, -d[0]])
      f = Face(
        g, [[a.tolist(), b.tolist(), [b[0], 11, b[2]], [a[0], 11, a[2]]]], n.tolist()
      )
      mid = a + d * math.dist(a, b) * 0.52
      u = float(np.dot(mid - f.a, f.d))
      for dx in [-0.11, 0.11]:
        f.member(u + dx, 6.65, 0.045, 0.5, 0xBDC6C6, 0.07, 0.5)
      f.member(u, 8.2, 2.65, 0.07, 0x5D7790, 0.1, 0.48)
      for dx in [-4.5, -3, 3, 4.5]:
        f.member(u + dx, 9.7, 0.055, 1.55, 0x3B607E, 0.07, 0.25)
    result.append(g)
  g = site("sophienkirche", "Sophienkirche – belegter Westturm", "DEBE01YYK0000080")
  sophien(g)
  result.append(g)
  inputs = [
    prism_path,
    DATA / "schoolsV185.json",
    DATA / "schoolsPlacesV205.json",
    DATA / "steglitzV182Source.json",
    ROOT / "src/app/src/gymnasiumTiergartenSource.json",
    DATA / "mitteHeritageV166Source.json",
    GEO / "raw/lod2/LoD2_391_5820.zip",
  ]
  evidence = {
    "version": 228,
    "sourceHashes": {str(p.relative_to(ROOT)): sha(p) for p in inputs},
    "prismReceipts": [prisms[i] for i in ["23816407", "47686950"]],
    "faces": {g["key"]: g.pop("faces") for g in result},
    "limits": "No owner replacement; legacy source conflicts retained. Portal subdivisions, colours and missing church roof/tower tiers are explicit recognition estimates, not surveyed facade geometry.",
  }
  for g in result:
    for kind in ["boxes", "rods", "nativeRows"]:
      g[kind] = [
        [round(float(v), 4) if i < len(row) - 1 else int(v) for i, v in enumerate(row)]
        for row in g[kind]
      ]
  (DATA / "schoolCultureV228.json").write_text(
    json.dumps(
      {"version": 228, "sites": result}, ensure_ascii=False, separators=(",", ":")
    )
    + "\n"
  )
  (GEO / "school-culture-v228-evidence.json").write_text(
    json.dumps(evidence, ensure_ascii=False, indent=2) + "\n"
  )
  print(
    [
      (
        g["key"],
        len(g["boxes"]),
        len(g["rods"]),
        len(g["sheets"]),
        len(g["nativeRows"]),
      )
      for g in result
    ]
  )


if __name__ == "__main__":
  build()
