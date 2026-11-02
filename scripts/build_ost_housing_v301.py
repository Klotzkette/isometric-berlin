"""Step 10: source-bound eastern neighbourhood facade recipes (v301).

Only the new recipe/evidence files are written. Original packets, envelopes,
roofs, navigation and earlier named-site details remain immutable inputs.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import subprocess
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import nearest_points, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
RUNTIME = ROOT / "src/app/src/data/ostHousingV301.json"
EVIDENCE = GEO / "ost-housing-v301-evidence.json.gz"
KIND = "ost-housing-v301"

# Exact addresses/owners first, never a free-running district-wide style grid.
PROFILE_SOURCE = GEO / "ost-housing-v301-profiles.json"
PROFILES: list[dict[str, Any]] = json.loads(PROFILE_SOURCE.read_text())


def read(path: Path) -> Any:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def fnv(text: str) -> int:
  result = 2166136261
  # All guarded base64 fields are ASCII; nav is serialized/hashed by Bun below.
  for value in text:
    result = ((result ^ ord(value)) * 16777619) & 0xFFFFFFFF
  return result


def mesh_fingerprint(mesh: dict[str, Any]) -> int:
  return fnv(mesh["positions"] + mesh["colors"] + mesh["indices"])


def raw_guards(paths: list[Path]) -> dict[str, dict[str, Any]]:
  """Use JS itself for JSON.stringify, including its exact number semantics."""
  code = r"""
    import {gunzipSync} from 'node:zlib';
    import {basename} from 'node:path';
    import {prepareStreetCurvesV276} from './src/streetCurvesV276.ts';
    import {prepareEastStadtbahnV288} from './src/EastStadtbahnV288.ts';
    const fnv=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;return h};
    const done=g=>{let n=g.next();while(!n.done)n=g.next();return n.value};
    const out={};
    for(const path of Bun.argv.slice(1)){
      const raw=await Bun.file(path).bytes(),p=JSON.parse(new TextDecoder().decode(gunzipSync(raw)));
      const id=basename(path).split('.')[0],native=path.includes('.minecraft.');
      const prepared=done(prepareEastStadtbahnV288(done(prepareStreetCurvesV276(p,id,native)),id,native));
      out[path]={navGuard:fnv(JSON.stringify(p.nav)),lineGuard:p.lines?fnv(p.lines.positions+(p.lines.colors??'')):null};
      const finalNav=fnv(JSON.stringify(prepared.nav));
      if(finalNav!==out[path].navGuard)out[path].preparedNavGuard=finalNav;
    }
    process.stdout.write(JSON.stringify(out));
  """
  result = subprocess.run(
    ["bun", "-e", code, *map(str, paths)],
    cwd=ROOT / "src/app",
    check=True,
    capture_output=True,
    text=True,
  )
  return json.loads(result.stdout)


def linear(hexadecimal: int) -> list[int]:
  return [
    round(
      (v / 255 / 12.92 if v <= 10.31475 else ((v / 255 + 0.055) / 1.055) ** 2.4) * 255
    )
    for v in [(hexadecimal >> 16) & 255, (hexadecimal >> 8) & 255, hexadecimal & 255]
  ]


class Fittings:
  """Owned, finite offline planes and thin rigid members in the packet frame."""

  def __init__(self, origin: list[float]) -> None:
    self.origin = np.array(origin)
    self.positions: list[list[int]] = []
    self.colors: list[list[int]] = []
    self.indices: list[int] = []
    self.roles: dict[str, int] = defaultdict(int)
    self.boundary_skips: dict[str, int] = defaultdict(int)

  def member(
    self,
    face: dict,
    u: float,
    y: float,
    w: float,
    h: float,
    depth: float,
    tint: int,
    role: str,
    offset: float = 0.1,
  ) -> None:
    """Independent wall-parallel rigid member, including its visible sides."""
    a, d, n = (np.array(face[k]) for k in ["a", "d", "n"])
    points = []
    for v in [offset, offset + depth]:
      points.append(
        [
          [
            *(a + d * (u + dx * w / 2) + n * v)[:1],
            y + dy * h / 2,
            (a + d * (u + dx * w / 2) + n * v)[1],
          ]
          for dx, dy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
        ]
      )
    # Front plus four narrow return sheets; the retained source is the back.
    centre = np.mean(np.array(points), axis=(0, 1))

    def outward(q):
      values = np.array(q)
      if (
        np.dot(
          np.cross(values[1] - values[0], values[2] - values[0]),
          np.mean(values, axis=0) - centre,
        )
        < 0
      ):
        q = list(reversed(q))
      self.quad(q, tint, role)

    outward(points[1])
    for i in range(4):
      outward(
        [points[0][i], points[0][(i + 1) % 4], points[1][(i + 1) % 4], points[1][i]]
      )

  def quad(self, points: list[list[float]], tint: int, role: str) -> None:
    values = np.rint((np.array(points) - self.origin) * 100).astype(np.int64)
    if np.min(values) < 0 or np.max(values) > 65535:
      # A clipped source owner can meet the western/northern packet boundary.
      # Omit that bounded estimated edge fitting; never wrap a negative u16,
      # enlarge the packet or shift a source owner to accommodate a new pane.
      self.boundary_skips[role] += 1
      return
    start = len(self.positions)
    self.positions.extend(values.tolist())
    self.colors.extend([linear(tint)] * 4)
    self.indices.extend(start + i for i in [0, 1, 2, 0, 2, 3])
    self.roles[role] += 1

  def pane(
    self,
    face: dict[str, Any],
    u: float,
    y: float,
    w: float,
    h: float,
    tint: int,
    role: str,
    offset: float = 0.09,
  ) -> None:
    a, d, n = (np.array(face[k]) for k in ["a", "d", "n"])
    points = []
    for dx, dy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]:
      xz = a + d * (u + dx * w / 2) + n * offset
      points.append([xz[0], y + dy * h / 2, xz[1]])
    # Face normals are source exterior normals, independent of ring winding.
    if d[0] * n[1] - d[1] * n[0] < 0:
      points.reverse()
    self.quad(points, tint, role)

  def payload(self) -> dict[str, Any]:
    def encode(values: list[Any], dtype: str) -> str:
      return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode()

    return {
      "kind": KIND,
      "positionType": "u16cm",
      "positions": encode(self.positions, "<u2"),
      "colors": encode(self.colors, "u1"),
      "indices": encode(self.indices, "<u4"),
    }


def owner_faces(packet: dict[str, Any], owner: str) -> list[dict[str, Any]]:
  """Use the actual original full-height exterior boundary, retaining source XZ."""
  origin = np.array(packet["origin"])
  result = []
  for building in packet["nav"]["buildings"]:
    if building["sourceId"] != owner:
      continue
    original_ring = np.array(building["ring"]) + origin[[0, 2]]
    # Source-part joins stay in the immutable source ring. Only the fitting
    # carrier merges collinear centimetre-precision joins on one actual plane.
    ring = np.array(
      Polygon(original_ring).simplify(0.012, preserve_topology=True).exterior.coords
    )
    shape = Polygon(ring, [np.array(h) + origin[[0, 2]] for h in building["holes"]])
    low = (
      packet["nav"]["groundY"] + building["minHeight"] + building.get("groundOffset", 0)
    )
    high = (
      packet["nav"]["groundY"] + building["height"] + building.get("groundOffset", 0)
    )
    for a, b in zip(ring, np.roll(ring, -1, axis=0)):
      length = float(np.linalg.norm(b - a))
      if length < 1.5:
        continue
      d = (b - a) / length
      n = np.array([-d[1], d[0]])
      if shape.covers(Point(*((a + b) / 2 + n * 0.08))):
        n = -n
      result.append(
        {
          "a": a.tolist(),
          "d": d.tolist(),
          "n": n.tolist(),
          "length": length,
          "low": low,
          "high": high,
          "owner": owner,
          "originalSourceRing": original_ring.tolist(),
        }
      )
  return result


TRIANGLES: dict[int, np.ndarray] = {}


def source_plane(packet: dict[str, Any], face: dict[str, Any]) -> Polygon:
  """Union actual coplanar source triangles; no inferred wall backing."""
  if "nativePlane" in face:
    axis, coordinate = face["nativePlane"]
    across = 1 if axis == 0 else 0
    return translate(
      next(
        p["polygon"]
        for p in NATIVE_PLANES[id(packet)]
        if p["axis"] == axis and p["plane"] == coordinate
      ),
      xoff=-face["a"][across],
    )
  polys = []
  a, d, n = (np.array(face[k]) for k in ["a", "d", "n"])
  if id(packet) not in TRIANGLES:
    data = []
    for mesh in packet["meshes"]:
      if (
        mesh["kind"]
        not in {
          "city",
          "alt-mitte-v169",
          "karl-marx-allee-heritage",
          "oranien-corridors-v167",
        }
        or mesh["positionType"] != "u16cm"
      ):
        continue
      p = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
        + packet["origin"]
      )
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      data.append(p[indices])
    TRIANGLES[id(packet)] = np.concatenate(data) if data else np.empty((0, 3, 3))
  triangles = TRIANGLES[id(packet)]
  local = triangles[:, :, [0, 2]] - a
  distances = local @ n
  for i in np.where(np.max(np.abs(distances), axis=1) <= 0.015)[0]:
    tri = triangles[i]
    q = Polygon(np.column_stack([local[i] @ d, tri[:, 1]]))
    if q.area > 0.01:
      polys.append(q)
  return unary_union(polys)


def selected_fronts(packet: dict, profile: dict) -> list[dict]:
  faces = owner_faces(packet, profile["owner"])
  if not profile.get("frontOnly"):
    return faces
  p = Point(profile["point"])
  candidates = [
    f
    for f in faces
    if f["length"] > 5
    and f["high"] - f["low"] > 7
    and source_plane(packet, f).area > f["length"] * 7
  ]
  if not candidates:
    raise ValueError(f"Missing facade carrier: {profile['id']}")

  def distance(f):
    a, d = np.array(f["a"]), np.array(f["d"])
    return LineString([a, a + d * f["length"]]).distance(p)

  street = profile["address"].rsplit(" ", 1)[0]
  roads = read(GEO / "district-facades-v188-context.json.gz")["roads"]
  road = unary_union(
    [LineString(r["geometry"]["coordinates"]) for r in roads if r.get("name") == street]
  )
  facing = []
  if not road.is_empty:
    for f in candidates:
      mid = np.array(f["a"]) + np.array(f["d"]) * f["length"] / 2
      closest = nearest_points(Point(mid), road)[1]
      v = np.array(closest.coords[0]) - mid
      dist = float(np.linalg.norm(v))
      if np.dot(v, f["n"]) > dist * 0.5:
        facing.append((dist, f))
  if facing:
    near = min(v[0] for v in facing)
    primary = max(
      (f for dist, f in facing if dist < near + 2), key=lambda f: f["length"]
    )
  else:
    nearest = min(distance(f) for f in candidates)
    primary = max(
      (f for f in candidates if distance(f) <= nearest + 1), key=lambda f: f["length"]
    )
  # Include only coplanar source fragments of this same full street front,
  # never courtyard/rear/party faces merely because their owner is identical.
  return [
    f
    for f in faces
    if np.dot(f["n"], primary["n"]) > 0.995
    and abs(np.dot(np.array(f["a"]) - primary["a"], primary["n"])) < 1.1
  ]


NATIVE_PLANES: dict[int, list[dict]] = {}


def native_fronts(packet: dict, profile: dict, drawn: list[dict]) -> list[dict]:
  """Cardinal carriers come from delivered triangles, never smooth nav rings."""
  from scripts import build_scheunen_v265 as source

  if id(packet) not in NATIVE_PLANES:
    view = {
      **packet,
      "meshes": [
        {**m, "kind": "city"}
        for m in packet["meshes"]
        if m["kind"]
        in {
          "city",
          "alt-mitte-v169",
          "karl-marx-allee-heritage",
          "oranien-corridors-v167",
        }
      ],
    }
    NATIVE_PLANES[id(packet)] = source.native_planes(view, [])
  result = []
  seen = set()
  for plane in NATIVE_PLANES[id(packet)]:
    dim, across = (0, 1) if plane["axis"] == 0 else (1, 0)
    coordinate = plane["plane"]
    for q in drawn:
      if abs(q["n"][dim]) < 0.4:
        continue
      a = np.array(q["a"])
      b = a + np.array(q["d"]) * q["length"]
      if not min(a[dim], b[dim]) - 2.9 <= coordinate <= max(a[dim], b[dim]) + 2.9:
        continue
      p1 = [0.0, 0.0]
      p2 = [0.0, 0.0]
      p1[dim] = p2[dim] = coordinate
      p1[across] = min(a[across], b[across]) - 2.9
      p2[across] = max(a[across], b[across]) + 2.9
      clipped = LineString([p1, p2]).intersection(
        LineString([a, b]).buffer(2.9, cap_style=3)
      )
      if clipped.is_empty:
        continue
      lo, hi = sorted([clipped.coords[0][across], clipped.coords[-1][across]])
      mid = (q["low"] + q["high"]) / 2
      support = plane["polygon"].intersection(LineString([[lo, mid], [hi, mid]]))
      pieces = (
        [support]
        if support.geom_type == "LineString"
        else list(getattr(support, "geoms", []))
      )
      for supported in pieces:
        if supported.geom_type != "LineString" or supported.length < 1.5:
          continue
        first = np.array(p1)
        last = np.array(p2)
        first[across] = supported.coords[0][0]
        last[across] = supported.coords[-1][0]
        if last[across] < first[across]:
          first, last = last, first
        d = [0.0, 0.0]
        d[across] = 1.0
        n = [0.0, 0.0]
        n[dim] = 1.0 if q["n"][dim] > 0 else -1.0
        key = (dim, coordinate, round(first[across], 4), round(last[across], 4), n[dim])
        if key in seen:
          continue
        seen.add(key)
        result.append(
          {
            **q,
            "a": first.tolist(),
            "d": d,
            "n": n,
            "length": float(supported.length),
            "nativePlane": [plane["axis"], coordinate],
          }
        )
  return result


def pane_if_backed(
  mesh: Fittings,
  face: dict,
  plane: Polygon,
  u: float,
  y: float,
  w: float,
  h: float,
  tint: int,
  role: str,
  offset=0.12,
) -> bool:
  if (
    w <= 0
    or h <= 0
    or not plane.buffer(0.02).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
  ):
    return False
  mesh.pane(face, u, y, w, h, tint, role, offset)
  return True


def reference_front(
  mesh: Fittings, face: dict, profile: dict, native: bool, plane: Polygon, carrier: dict
) -> None:
  """Individual photo/type-survey axes; original wall/roof paint stays present."""
  length, low, high = (face[k] for k in ["length", "low", "high"])
  # Actual front wall coverage bounds the eaves; navigation includes roof
  # height on many LoD2 owners, and must not determine facade storey spacing.
  eaves = []
  for u in np.linspace(0.1, length - 0.1, 7):
    section = plane.intersection(LineString([[u, low + 0.1], [u, high]]))
    if not section.is_empty:
      eaves.append(section.bounds[3])
  if not eaves:
    return
  eave = min(eaves)
  if eave - low < 7:
    return
  face["representedEave"] = eave
  kind = profile["type"]
  is_panel = kind in {"qp-slab", "qp61-slab", "grossblock-five"}
  floors = profile["floors"]
  ground_zone = 3.4 if not is_panel else 0.65
  pitch = (eave - low - ground_zone - 0.5) / (floors - (0 if is_panel else 1))
  cols = profile["columns"]
  ca, cd = np.array(carrier["a"]), np.array(carrier["d"])
  total = carrier["length"]
  # Drawn uses complete identified street axes across source part seams.
  # Native redistributes these axes onto each independent cardinal segment.
  if native:
    count = max(1, round(length / (total / cols)))
    columns = [
      (
        (i + 0.5) * length / count,
        min(profile["windowWidth"], length / count * 0.66),
        min(
          cols - 1,
          int(((np.dot(a - ca, cd) + (i + 0.5) * length / count) / total) * cols),
        ),
      )
      for i in range(count)
      for a in [np.array(face["a"])]
    ]
  else:
    columns = []
    for col in range(cols):
      point = ca + cd * ((col + 0.5) * total / cols)
      u = float(np.dot(point - np.array(face["a"]), face["d"]))
      if 0.15 < u < length - 0.15:
        columns.append((u, profile["windowWidth"], col))
  face["representedColumns"] = [c[2] for c in columns]
  for floor in range(floors):
    y = (
      low + ground_zone + (floor + 0.5) * pitch
      if is_panel
      else low + (1.6 if floor == 0 else ground_zone + (floor - 0.5) * pitch)
    )
    for u, w, col in columns:
      h = profile["windowHeight"] if floor else min(profile["windowHeight"], 2.1)
      if col in profile.get("stairColumns", []):
        h *= 1.2
        y_here = y - pitch * 0.22
      else:
        y_here = y
      if not pane_if_backed(
        mesh,
        face,
        plane,
        u,
        y_here,
        w + 0.22,
        h + 0.22,
        profile.get("reveal", 0xB8B6AD),
        "individual-reveal",
        0.10,
      ):
        continue
      mesh.pane(face, u, y_here, w, h, 0x607B85, "individual-glass", 0.13)
      mesh.pane(face, u, y_here, w, 0.055, 0xD7D5C9, "window-transom", 0.15)
      mesh.pane(
        face,
        u + (w * 0.12 if is_panel else 0),
        y_here,
        0.055,
        h,
        0xD7D5C9,
        "window-asymmetric-mullion" if is_panel else "window-mullion",
        0.15,
      )
      if col in profile.get("balconyColumns", []) and floor > 0:
        bw = min(w + (0.45 if is_panel else 0.65), length - 0.2)
        if not plane.buffer(0.02).covers(
          box(u - bw / 2, y_here - h / 2 - 0.15, u + bw / 2, y_here + h / 2 + 0.15)
        ):
          continue
        mesh.member(
          face, u, y_here - h / 2 - 0.08, bw, 0.10, 0.55, 0xC5C3B9, "balcony-slab"
        )
        # Open, finite rails with distinct opaque QP parapet/glazed-strip cue.
        mesh.pane(
          face,
          u,
          y_here - h / 2 + 0.48,
          bw,
          0.65,
          0x78A3A0 if is_panel else 0x676C67,
          "qp-glazed-parapet" if is_panel else "balcony-rail-field",
          0.65,
        )
        for ru in [-0.5, 0.5]:
          mesh.pane(
            face,
            u + ru * bw,
            y_here - h / 2 + 0.42,
            0.055,
            0.85,
            0xD6D5C9,
            "balcony-upright",
            0.67,
          )
        mesh.pane(
          face, u, y_here - h / 2 + 0.88, bw, 0.055, 0xE1DFD4, "balcony-top-rail", 0.68
        )
      if not is_panel and floor > 0:
        pane_if_backed(
          mesh,
          face,
          plane,
          u,
          y_here + h / 2 + 0.17,
          w + 0.36,
          0.13,
          profile.get("reveal", 0xD7D2C3),
          "individual-hood",
          0.18,
        )
        pane_if_backed(
          mesh,
          face,
          plane,
          u,
          y_here - h / 2 - 0.13,
          w + 0.36,
          0.10,
          profile.get("reveal", 0xD7D2C3),
          "individual-sill",
          0.18,
        )
        if profile.get("ornament") in {"pediment", "neo-renaissance"} and floor == 2:
          # Tiny stepped cap in native; triangular end sheet in drawn.
          if native:
            for step in range(3):
              pane_if_backed(
                mesh,
                face,
                plane,
                u,
                y_here + h / 2 + 0.30 + step * 0.08,
                (w + 0.34) * (1 - step * 0.28),
                0.09,
                profile["reveal"],
                "stepped-pediment",
                0.18,
              )
          else:
            for sign in [-1, 1]:
              d = np.array(face["d"])
              a = np.array(face["a"])
              n = np.array(face["n"])
              p1 = a + d * (u + sign * (w + 0.35) / 2) + n * 0.18
              p2 = a + d * u + n * 0.18
              # Four-point thin pitched cap, native never shares this angle.
              mesh.quad(
                [
                  [p1[0], y_here + h / 2 + 0.28, p1[1]],
                  [p2[0], y_here + h / 2 + 0.59, p2[1]],
                  [p2[0], y_here + h / 2 + 0.65, p2[1]],
                  [p1[0], y_here + h / 2 + 0.34, p1[1]],
                ],
                profile["reveal"],
                "pediment-slope",
              )
    # Source-supported floor bands/panel seams are structural distinctions,
    # not a blanket repaint of the source facade materials.
    if is_panel or floor in [0, 1, floors - 1]:
      pane_if_backed(
        mesh,
        face,
        plane,
        length / 2,
        y + pitch * 0.49,
        length - 0.12,
        0.035 if is_panel else 0.13,
        0xB9B8AE if is_panel else profile.get("reveal", 0xD0C8B5),
        "panel-horizontal-joint" if is_panel else "storey-cornice",
        0.08 if is_panel else 0.16,
      )
  if is_panel:
    for u, w, col in columns:
      pane_if_backed(
        mesh,
        face,
        plane,
        min(length - 0.05, u + total / cols / 2),
        (low + eave) / 2,
        0.025,
        eave - low - 0.16,
        0xBABBB3,
        "panel-vertical-joint",
        0.07,
      )
  if not is_panel:
    pane_if_backed(
      mesh,
      face,
      plane,
      length / 2,
      eave - 0.15,
      length - 0.08,
      0.20,
      profile.get("reveal", 0xD9D5C8),
      "eave-cornice",
      0.19,
    )


def metal_highrise(
  mesh: Fittings,
  face: dict[str, Any],
  profile: dict[str, Any],
  native: bool,
  plane: Polygon,
) -> None:
  """Reference metal fins, triple panes and full-height repeated storeys."""
  length, low, high = (face[k] for k in ["length", "low", "high"])
  # The regular source plateau remains the roof; no fin projects above it.
  skin = box(0.02, low + 0.04, length - 0.02, high - 0.04)
  if not plane.buffer(0.015).covers(skin):
    return
  mesh.pane(
    face,
    length / 2,
    (low + high) / 2,
    length - 0.04,
    high - low - 0.08,
    0x454B55,
    "metal-skin",
    0.035,
  )
  floors = profile["floors"]
  pitch = (high - low - 1.0) / floors
  end = abs(face["n"][1]) > 0.8 and length > 16 and not native
  groups = profile["paneGroups"]["end" if end else "side"]
  positions = []
  if native:
    columns = max(1, round(length / 1.85))
    spacing = length / columns
    positions = [
      ((c + 0.5) * spacing, min(1.25, spacing * 0.68)) for c in range(columns)
    ]
  else:
    available = length - 1.2 - (profile["endLoggiaWidth"] if end else 0)
    group_width = available / groups
    for group in range(groups):
      left = (
        0.6 + group * group_width + (profile["endLoggiaWidth"] if end and group else 0)
      )
      for member in range(profile["paneGroups"]["members"]):
        positions.append(
          (left + (member + 0.5) * group_width / 3, min(1.12, group_width / 3 * 0.74))
        )
  for floor in range(floors):
    y = low + 0.55 + (floor + 0.5) * pitch
    for u, width in positions:
      if not plane.buffer(0.015).covers(
        box(u - width / 2 - 0.07, y - 0.67, u + width / 2 + 0.07, y + 0.67)
      ):
        continue
      mesh.pane(face, u, y, width + 0.12, 1.32, 0x20272E, "window-reveal", 0.065)
      mesh.pane(face, u, y - 0.02, width, 1.15, 0x7B8C9E, "window-glass", 0.085)
      mesh.pane(face, u, y + 0.53, width, 0.07, 0xB2B6BD, "window-head", 0.105)
      mesh.pane(face, u, y, 0.045, 1.15, 0xB8BBC0, "window-mullion", 0.11)
    if end:
      # The central open-looking field is a shallow reference interpretation,
      # not a room cut or a change of the retained solid building/navigation.
      w = profile["endLoggiaWidth"] - 0.3
      mesh.pane(
        face, length / 2, y, w, pitch - 0.12, 0x22282B, "central-loggia-reveal", 0.07
      )
      mesh.pane(
        face,
        length / 2,
        y - pitch * 0.28,
        w,
        1.0,
        0xD9D9D5,
        "central-loggia-parapet",
        0.13,
      )
  fin_positions = sorted(
    {
      max(0.08, min(length - 0.08, u + sign * (w / 2 + 0.13)))
      for u, w in positions
      for sign in [-1, 1]
    }
  )
  for u in fin_positions:
    mesh.pane(
      face, u, (low + high) / 2, 0.10, high - low - 0.10, 0xBFC3C8, "metal-fin", 0.13
    )


def carrier_for(faces: list[dict]) -> dict:
  f = max(faces, key=lambda x: x["length"])
  a, d = np.array(f["a"]), np.array(f["d"])
  us = [
    float(np.dot(np.array(q["a"]) + np.array(q["d"]) * v - a, d))
    for q in faces
    for v in [0, q["length"]]
  ]
  return {**f, "a": (a + d * min(us)).tolist(), "length": max(us) - min(us)}


def old_pane_quads(face: dict, origin: list, native: bool) -> Any:
  """Replay exact original v188 window quads, excluding retained cornices."""
  from scripts import build_district_facades_v188 as old

  mesh = old.FacadeMesh(origin)
  spans = face["nativeSpans"] if native else [face]
  for span in spans:
    a, b = np.array(span["a"]), np.array(span["b"])
    width = float(np.linalg.norm(b - a))
    d = (b - a) / width
    n = np.array(span["normal"])
    low, high = span["low"], span["high"]
    rows = max(1, int((high - low - 1.5) / (4 if native else 3.6)))
    cols = max(1, int((width - 1.5) / (4 if native else 3.8)))
    for row in range(rows):
      y = low + 1.5 + (row + 0.5) * (high - low - 2.4) / rows
      for col in range(cols):
        if not native and col in face["omittedWindowColumns"]:
          continue
        mesh.pane(
          a,
          d,
          n,
          (col + 0.5) * width / cols,
          y,
          1.15 if native else 1.32,
          1.4 if native else 1.8,
          0.045 if native else 0.075,
          (93, 119, 124) if native else (122, 148, 151),
          None if native else (78, 105, 114),
        )
  return mesh


def quad_key(p: Any, c: Any) -> bytes:
  return np.asarray(p, "<u2").tobytes() + np.asarray(c, "u1").tobytes()


def exact_retirements(packet: dict, faces: list[dict]) -> tuple[list[dict], list[dict]]:
  """Retire only exact replayed old panes on completely replaced front axes."""
  native = packet["id"].endswith(".minecraft") if packet.get("id") else False
  # Family supplied explicitly by the transient audit, never stored in source.
  native = packet.get("_auditNative", native)
  expected = {}
  for face in faces:
    q = old_pane_quads(face, packet["origin"], native)
    for i in range(0, len(q.positions), 4):
      key = quad_key(q.positions[i : i + 4], q.colours[i : i + 4])
      if key in expected:
        raise ValueError("Ambiguous original pane receipt")
      expected[key] = face["owner"]
  found = defaultdict(list)
  proof = []
  for mi, m in enumerate(packet["meshes"]):
    if m["kind"] != "district-facades-v188":
      continue
    p = np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3)
    c = np.frombuffer(base64.b64decode(m["colors"]), "u1").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
    for i in range(0, len(p), 4):
      key = quad_key(p[i : i + 4], c[i : i + 4])
      if key not in expected:
        continue
      at = i // 2
      if not np.array_equal(
        ix[at : at + 2], np.array([[i, i + 1, i + 2], [i, i + 2, i + 3]])
      ):
        raise ValueError("Old pane topology changed")
      owner = expected.pop(key)
      found[mi].extend([at, at + 1])
      proof.append(
        {
          "mesh": mi,
          "triangles": [at, at + 1],
          "owner": owner,
          "quadSha256": hashlib.sha256(key).hexdigest(),
        }
      )
  if expected:
    raise ValueError(f"Incomplete original fitting replay: {len(expected)}")
  return [{"mesh": m, "triangles": sorted(v)} for m, v in sorted(found.items())], proof


def build() -> dict[str, Any]:
  """Build bounded primary/companion fronts with complete old fitting receipts."""
  TRIANGLES.clear()
  NATIVE_PLANES.clear()
  originals = {}

  def packet(key: str, native: bool) -> dict:
    path = OUT / f"{key}.{'minecraft' if native else 'drawn'}.json.gz"
    if path not in originals:
      originals[path] = read(path)
    return originals[path]

  old_faces = read(GEO / "district-facades-v188-evidence.json.gz")["faces"]
  recipes = {}
  evidence = []
  retirement_proofs = []
  for profile in PROFILES:
    source = packet(profile["packet"], False)
    fronts = selected_fronts(source, profile)
    if not fronts:
      raise ValueError(f"No complete front for {profile['id']}")
    carrier = carrier_for(fronts)
    old = []
    for f in old_faces:
      if f["owner"] != profile["owner"] or f["chunk"] != profile["packet"]:
        continue
      for q in fronts:
        qa, qd, qn = (np.array(q[k]) for k in ["a", "d", "n"])
        a, b = np.array(f["a"]), np.array(f["b"])
        if (
          np.dot(f["normal"], qn) > 0.995
          and max(abs((a - qa) @ qn), abs((b - qa) @ qn)) < 1.1
        ):
          bounds = sorted([(a - qa) @ qd, (b - qa) @ qd])
          if bounds[0] >= -0.05 and bounds[1] <= q["length"] + 0.05:
            old.append(f)
            break
    target = ("district188-" + profile["packet"]) if old else profile["packet"]
    for native in [False, True]:
      raw = packet(target, native)
      key = ("minecraft:" if native else "drawn:") + target
      if key not in recipes:
        recipes[key] = {
          "raw": raw,
          "fittings": Fittings(raw["origin"]),
          "owners": [],
          "oldFaces": [],
        }
      recipe = recipes[key]
      fittings = recipe["fittings"]
      support = packet(profile["packet"], native)
      model_faces = native_fronts(support, profile, fronts) if native else fronts
      profile_start = len(fittings.positions)
      for face in model_faces:
        before = len(fittings.positions)
        roles_before = dict(fittings.roles)
        plane = source_plane(support, face)
        if profile["type"] == "metal-highrise-1969":
          metal_highrise(fittings, face, profile, native, plane)
        else:
          reference_front(fittings, face, profile, native, plane, carrier)
        if len(fittings.positions) > before:
          evidence.append(
            {
              "profileId": profile["id"],
              "owner": profile["owner"],
              "native": native,
              "packet": target,
              "supportPacket": profile["packet"],
              "face": face,
              "sourcePlaneArea": round(plane.area, 6),
              "vertexStart": before,
              "vertices": len(fittings.positions) - before,
              "roles": {
                k: v - roles_before.get(k, 0)
                for k, v in fittings.roles.items()
                if v > roles_before.get(k, 0)
              },
            }
          )
      if len(fittings.positions) == profile_start:
        raise ValueError(
          f"No represented supported facade: {profile['id']} native={native}"
        )
      recipe["owners"].append(profile["owner"])
      recipe["oldFaces"].extend(old)
  paths = sorted(originals)
  guards = raw_guards(paths)
  plans = {}
  for key, recipe in recipes.items():
    raw = recipe["raw"]
    native = key.startswith("minecraft:")
    tile = key.split(":", 1)[1]
    path = OUT / f"{tile}.{'minecraft' if native else 'drawn'}.json.gz"
    audit = {**raw, "_auditNative": native}
    retire, proof = exact_retirements(audit, recipe["oldFaces"])
    retirement_proofs.extend({"key": key, **p} for p in proof)
    append = recipe["fittings"].payload()
    plans[key] = {
      "origin": raw["origin"],
      **guards[str(path)],
      "records": [
        {"mesh": i, "kind": m["kind"], "fingerprint": mesh_fingerprint(m)}
        for i, m in enumerate(raw["meshes"])
      ],
      "append": append,
      "appendFingerprint": mesh_fingerprint(append),
      "retire": retire,
      "owners": sorted(set(recipe["owners"])),
    }
    total = sum(
      len(base64.b64decode(m["positions"])) // 6 for m in raw["meshes"]
    ) + len(recipe["fittings"].positions)
    if total > 400000:
      raise ValueError(
        f"Source plus complete fittings over fixed budget: {key} {total}"
      )
  result = {"schemaVersion": 1, "keys": sorted(plans), "packets": plans}
  RUNTIME.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  receipt = {
    "schemaVersion": 1,
    "inputs": {
      str(p.relative_to(ROOT)): {
        "wireSha256": sha(p),
        "decodedSha256": hashlib.sha256(gzip.decompress(p.read_bytes())).hexdigest(),
      }
      for p in paths
    },
    "profileSourceSha256": sha(PROFILE_SOURCE),
    "v188EvidenceSha256": sha(GEO / "district-facades-v188-evidence.json.gz"),
    "profiles": PROFILES,
    "faces": evidence,
    "retirements": retirement_proofs,
    "policy": "Individual reference/type-survey estimated facade fittings. Original bodies, source colours, roofs, navigation and all other detail retained. Exact old v188 panes only yield to complete same-packet fronts. No reference image pixels, coverage or changed navigation.",
  }
  EVIDENCE.write_bytes(
    gzip.compress(json.dumps(receipt, separators=(",", ":")).encode(), mtime=0)
  )
  return {
    "plans": len(plans),
    "profiles": len(PROFILES),
    "runtimeBytes": RUNTIME.stat().st_size,
    "evidenceBytes": EVIDENCE.stat().st_size,
    "retiredQuads": len(retirement_proofs),
    "vertices": {
      k: len(base64.b64decode(v["append"]["positions"])) // 6 for k, v in plans.items()
    },
  }


if __name__ == "__main__":
  print(json.dumps(build(), indent=2))
