"""Finite complete ATZE and Archenhold envelopes and an open giant refractor.

All source sheets remain in the evidence. The two instrument/withdrawn-cover
leaves retain their measured roofs without invented filled walls beneath them.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from shapely.geometry import Point, Polygon, box

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_berlin_senate_buildings_v321 import native_columns, packed
from scripts.build_berlin_senate_v321 import old_mitte
from scripts.build_karl_marx_allee_v161 import Detail

triangulate = old_mitte.triangulate

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OPEN = {"DEBE3DxoMbxaLcrN", "DEBE3DlJR7clegG5"}
GROUND = 3.0
TARGETS = {
  "archenhold": ("396_5816", "DEBE09YYP00000z1"),
  "atze": ("388_5822", "DEBE01YYK0003uL0"),
  "parkaue": ("396_5819", ["DEBE11YYI00004aU", "DEBE11YYI0000OfT", "DEBE11YYI0000JiA"]),
  "strahl": ("396_5818", ["DEBE11YYI00001CB", "DEBE11YYI0000DJN"]),
}
REFERENCES = {
  "parkaue": [
    "https://www.parkaue.de/service/kontakt/",
    "https://www.parkaue.de/",
    "https://www.berlin.de/sen/kultur/infrastruktur/theater-an-der-parkaue/",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040260",
    "https://www.pinardi-architekten.de/Inhalt/Parkaue/P_3-Parkaue.html",
  ],
  "strahl": [
    "https://www.theater-strahl.de/spielorte/",
    "https://eisat.de/en/projekte/theater-strahl-am-ostkreuz-berlin",
  ],
  "archenhold": [
    "https://www.planetarium.berlin/archenhold-sternwarte",
    "https://www.planetarium.berlin/archenhold-sternwarte/technik-und-instrumente",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09020301",
    "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
  ],
  "atze": [
    "https://atzeberlin.de/besuchen/",
    "https://atzeberlin.de/impressum/",
  ],
}


def digest(raw: bytes) -> str:
  """Exact complete source fingerprint."""
  return hashlib.sha256(raw).hexdigest()


def write(path: Path, value: Any) -> None:
  """Only new versioned deterministic derivatives are written."""
  raw = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def shift(part: dict, offset: float) -> dict:
  """One rigid source-ground to existing street-ground datum."""
  return {
    **part,
    "ground_y_m": round(part["ground_y_m"] + offset, 6),
    "top_y_m": round(part["top_y_m"] + offset, 6),
    "surfaces": [
      {
        **s,
        "rings": [[[x, round(y + offset, 6), z] for x, y, z in r] for r in s["rings"]],
      }
      for s in part["surfaces"]
    ],
  }


def beam(
  detail: Detail,
  a: list,
  b: list,
  width: float,
  depth: float,
  rgb: tuple,
  role: str,
  native: bool,
  solids: list,
) -> None:
  """A finite open structural member; Native is independently axis aligned."""
  a, b = np.array(a, dtype=float), np.array(b, dtype=float)
  v = b - a
  length = float(np.linalg.norm(v))
  if length < 1e-8:
    return
  v /= length
  if native:
    count = max(1, math.ceil(length / 0.28))
    # Per-segment cardinal enclosing blocks preserve the member's whole course.
    for i in range(count):
      p = a + (i + 0.5) / count * (b - a)
      size = np.abs(v) * (length / count) + np.array([width, width, depth])
      cuboid(detail, p.tolist(), size.tolist(), rgb, role, solids)
    return
  u = np.cross(v, [0, 1, 0] if abs(v[1]) < 0.95 else [1, 0, 0])
  u /= np.linalg.norm(u)
  w = np.cross(v, u)
  corners = [
    a + u * x * width / 2 + w * z * depth / 2
    for x, z in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
  ]
  top = [p + (b - a) for p in corners]
  for ids in [
    (0, 3, 2, 1),
    (4, 5, 6, 7),
    (0, 1, 5, 4),
    (1, 2, 6, 5),
    (2, 3, 7, 6),
    (3, 0, 4, 7),
  ]:
    detail.polygon([list((corners + top)[i]) for i in ids], rgb, role)
  solids.append(
    dict(
      center=((a + b) / 2).tolist(),
      basis=[u.tolist(), v.tolist(), w.tolist()],
      size=[width, length, depth],
    )
  )


def cuboid(
  detail: Detail, center: list, size: list, rgb: tuple, role: str, solids: list
) -> None:
  """Independent cardinal box and the same physical solid."""
  x, y, z = center
  w, h, d = size
  vertices = [
    [x + sx * w / 2, y + sy * h / 2, z + sz * d / 2]
    for sx, sy, sz in [
      (-1, -1, -1),
      (1, -1, -1),
      (1, -1, 1),
      (-1, -1, 1),
      (-1, 1, -1),
      (1, 1, -1),
      (1, 1, 1),
      (-1, 1, 1),
    ]
  ]
  for face in [
    (0, 3, 2, 1),
    (4, 5, 6, 7),
    (0, 1, 5, 4),
    (1, 2, 6, 5),
    (2, 3, 7, 6),
    (3, 0, 4, 7),
  ]:
    detail.polygon([vertices[i] for i in face], rgb, role)
  solids.append(dict(center=center, basis=[[1, 0, 0], [0, 1, 0], [0, 0, 1]], size=size))


def ring(
  detail: Detail,
  center: np.ndarray,
  axis: np.ndarray,
  radius: float,
  width: float,
  rgb: tuple,
  role: str,
  native: bool,
  solids: list,
  segments: int = 32,
) -> None:
  """A true open ring, never a solid disc across the observation pit."""
  axis = np.asarray(axis, dtype=float)
  u = np.cross(axis, [0, 1, 0] if abs(axis[1]) < 0.95 else [1, 0, 0])
  u /= np.linalg.norm(u)
  w = np.cross(axis, u)
  for i in range(segments):
    a = center + radius * (
      u * math.cos(i * math.tau / segments) + w * math.sin(i * math.tau / segments)
    )
    b = center + radius * (
      u * math.cos((i + 1) * math.tau / segments)
      + w * math.sin((i + 1) * math.tau / segments)
    )
    beam(detail, a.tolist(), b.tolist(), width, width, rgb, role, native, solids)


def refractor(native: bool) -> tuple[Detail, list]:
  """21m optical tube, open two-sided mounting and ring observation platform.

  OSM fixes the instrument anchor. DOP fixes its northward course. Static pitch,
  pivot offset, structural diameters and joinery are proportional estimates.
  """
  d = Detail()
  solids = []
  anchor = np.array([7037.2034477714915, 0, 3844.1158412797377])
  pivot = anchor + np.array([0, 12.6, -3.9])
  axis = np.array([0, math.sin(math.radians(20)), -math.cos(math.radians(20))])
  u = np.array([1, 0, 0])
  w = np.cross(axis, u)
  gray = (150, 157, 158)
  iron = (92, 106, 111)
  white = (222, 226, 222)
  # A 21m long tapered hollow tube: rear4m + forward17m. 680mm objective.
  for i in range(42):
    ta, tb = -4 + i * 0.5, -4 + (i + 1) * 0.5
    ra = 0.66 - (ta + 4) / 21 * 0.30
    rb = 0.66 - (tb + 4) / 21 * 0.30
    if native:
      # Twelve cardinal shell staves, with open central optical bore.
      for j in range(12):
        angle = (j + 0.5) * math.tau / 12
        aa = pivot + axis * ta + (u * math.cos(angle) + w * math.sin(angle)) * ra
        bb = pivot + axis * tb + (u * math.cos(angle) + w * math.sin(angle)) * rb
        beam(
          d,
          aa.tolist(),
          bb.tolist(),
          0.18,
          0.18,
          white,
          "native hollow optical tube",
          True,
          solids,
        )
    else:
      for j in range(24):
        aa = j * math.tau / 24
        bb = (j + 1) * math.tau / 24
        pts = [
          pivot + axis * ta + (u * math.cos(aa) + w * math.sin(aa)) * ra,
          pivot + axis * ta + (u * math.cos(bb) + w * math.sin(bb)) * ra,
          pivot + axis * tb + (u * math.cos(bb) + w * math.sin(bb)) * rb,
          pivot + axis * tb + (u * math.cos(aa) + w * math.sin(aa)) * rb,
        ]
        d.polygon([p.tolist() for p in pts], white, "21m hollow refractor tube")
  for t in np.arange(-3.75, 17.01, 1.55):
    r = 0.66 - (t + 4) / 21 * 0.30
    ring(
      d,
      pivot + axis * t,
      axis,
      r + 0.045,
      0.055,
      iron,
      "tube reinforcement collar",
      native,
      solids,
      24,
    )
  ring(
    d,
    pivot + axis * 17,
    axis,
    0.37,
    0.065,
    iron,
    "680mm objective rim",
    native,
    solids,
    32,
  )
  # Two visible large open toothed altitude wheels and braced mounting sides.
  for side in [-1, 1]:
    c = pivot + np.array([side * 2.18, 0, 0])
    ring(
      d, c, np.array([1, 0, 0]), 2.12, 0.15, iron, "open altitude gear", native, solids
    )
    for j in range(8):
      a = j * math.tau / 8
      beam(
        d,
        c.tolist(),
        (c + np.array([0, math.cos(a) * 2.04, math.sin(a) * 2.04])).tolist(),
        0.11,
        0.12,
        gray,
        "gear spoke",
        native,
        solids,
      )
    foot = anchor + np.array([side * 4.3, 6.25, 2.2])
    beam(
      d,
      foot.tolist(),
      (c + np.array([0, 1, 0])).tolist(),
      0.56,
      0.45,
      gray,
      "inclined mounting leg",
      native,
      solids,
    )
    beam(
      d,
      (anchor + np.array([side * 2.45, 6.25, -3])).tolist(),
      c.tolist(),
      0.45,
      0.42,
      gray,
      "upright mounting leg",
      native,
      solids,
    )
    beam(
      d,
      (pivot + axis * 8 + np.array([side * 0.6, 0, 0])).tolist(),
      (c + np.array([0, -0.4, 1.3])).tolist(),
      0.065,
      0.065,
      iron,
      "tube tension tie",
      native,
      solids,
    )
  beam(
    d,
    (pivot - u * 2.2).tolist(),
    (pivot + u * 2.2).tolist(),
    0.62,
    0.62,
    gray,
    "open mounting crossshaft",
    native,
    solids,
  )
  center = anchor + np.array([0, 6.7, 0])
  ring(
    d,
    center,
    np.array([0, 1, 0]),
    3.15,
    0.35,
    gray,
    "open annular observation platform",
    native,
    solids,
    40,
  )
  for j in range(40):
    a = j * math.tau / 40
    p = center + np.array([math.cos(a) * 3.45, 0, math.sin(a) * 3.45])
    beam(
      d,
      p.tolist(),
      (p + np.array([0, 1.05, 0])).tolist(),
      0.045,
      0.045,
      iron,
      "observation railing upright",
      native,
      solids,
    )
  ring(
    d,
    center + np.array([0, 1.05, 0]),
    np.array([0, 1, 0]),
    3.45,
    0.055,
    iron,
    "observation handrail",
    native,
    solids,
    40,
  )
  return d, solids


def windows(detail: Detail, parts: list, native: bool, site: str) -> int:
  """Source-contained estimated openings, or ATZE's documented glazed V-front."""
  panes = 0
  for p in parts:
    if p["id"] in OPEN:
      continue
    shape = Polygon(p["ring"], p["holes"])
    for face in p["surfaces"]:
      if face["kind"] != "WallSurface":
        continue
      ring = face["rings"][0]
      low = min(v[1] for v in ring)
      high = max(v[1] for v in ring)
      a, b = max(
        ((a, b) for a in ring for b in ring),
        key=lambda v: math.hypot(v[1][0] - v[0][0], v[1][2] - v[0][2]),
      )
      vec = np.array([b[0] - a[0], b[2] - a[2]])
      length = float(np.linalg.norm(vec))
      if length < (1.5 if site == "parkaue" else 5) or high - low < 3.4:
        continue
      vec /= length
      normal = np.array([vec[1], -vec[0]])
      center = np.array([(a[0] + b[0]) / 2, (a[2] + b[2]) / 2])
      if shape.contains(Point(*(center + normal * 0.4))):
        normal = -normal
      if site == "atze" and normal[0] > -0.4:
        continue
      poly = Polygon(
        [[(v[0] - a[0]) * vec[0] + (v[2] - a[2]) * vec[1], v[1]] for v in ring],
        [
          [[(v[0] - a[0]) * vec[0] + (v[2] - a[2]) * vec[1], v[1]] for v in h]
          for h in face["rings"][1:]
        ],
      )

      def pane(u, y, width, height, color, out):
        f = box(u - width / 2, y - height / 2, u + width / 2, y + height / 2)
        if not poly.buffer(-0.08).covers(f):
          return False
        if native:
          axis = int(abs(normal[1]) > abs(normal[0]))
          cx = a[0] + vec[0] * u + normal[0] * 0.65
          cz = a[2] + vec[1] * u + normal[1] * 0.65
          size = [width, height, 0.10] if axis else [0.10, height, width]
          cuboid(
            detail, [cx, y, cz], size, color, "independent cardinal source facade", []
          )
        else:
          points = [
            [
              a[0] + vec[0] * x + normal[0] * out,
              yy,
              a[2] + vec[1] * x + normal[1] * out,
            ]
            for x, yy in list(f.exterior.coords)[:-1]
          ]
          detail.polygon(
            points, color, "source-contained estimated theatre/observatory joinery"
          )
        return True

      levels = (
        [6.1, 9.8]
        if site == "archenhold"
        else [7.95, 11.2]
        if site == "atze"
        else [5.1, 9.0, 12.9, 16.8]
        if site == "parkaue"
        else [5.5, 10.4]
        if p["id"] in {"DEBE3DsF31lHGzFs", "DEBE3DthmQHBC2s0"}
        else [7.1, 14.4]
      )
      count = max(1, round(length / (3.35 if site == "archenhold" else 3.8)))
      for y in levels:
        for j in range(count):
          u = length * (j + 0.5) / count
          w = (
            length / count - 0.17
            if site == "atze"
            else min(1.45, length / count - 0.20)
            if site == "parkaue"
            else 1.65
            if site == "strahl"
            else 1.22
          )
          h = (
            2.02
            if site == "archenhold"
            else 2.95
            if site == "atze"
            else 2.35
            if site == "parkaue"
            else 3.2
          )
          if not pane(u, y, w, h, (69, 92, 99), 0.09):
            continue
          panes += 1
          for side in [-1, 1]:
            pane(u + side * (w + 0.10) / 2, y, 0.10, h + 0.20, (226, 225, 209), 0.16)
          for yy in [y - h / 2, y, y + h / 2]:
            pane(u, yy, w + 0.20, 0.09, (226, 225, 209), 0.16)
          if site == "atze" and y == levels[0]:
            # The primary venue account identifies the distinctive V concrete columns.
            foot = [
              a[0] + vec[0] * u + normal[0] * 0.48,
              5.3,
              a[2] + vec[1] * u + normal[1] * 0.48,
            ]
            for side in [-1, 1]:
              top = [
                a[0] + vec[0] * (u + side * w * 0.42) + normal[0] * 0.48,
                10.45,
                a[2] + vec[1] * (u + side * w * 0.42) + normal[1] * 0.48,
              ]
              beam(
                detail,
                foot,
                top,
                0.23,
                0.23,
                (220, 218, 199),
                "ATZE paired V concrete support",
                native,
                [],
              )
  return panes


def wordplanes(q: dict) -> dict:
  """Existing V309 codec, exact UInt32 words including every Float32 bit."""
  q = dict(q)
  for key, stride in [("positions", 3), ("indices", 1)]:
    words = np.frombuffer(base64.b64decode(q[key]), dtype="<u4")
    previous = [0] * stride
    out = np.empty((4, len(words)), dtype=np.uint8)
    rows = len(words) // stride
    for i, value in enumerate(words):
      axis = i % stride
      delta = (int(value) - previous[axis]) & 0xFFFFFFFF
      previous[axis] = int(value)
      signed = delta if delta < 0x80000000 else delta - 0x100000000
      zig = ((signed << 1) ^ (signed >> 31)) & 0xFFFFFFFF
      column = axis * rows + i // stride
      for b in range(4):
        out[b, column] = (zig >> (b * 8)) & 255
    q[key] = base64.b64encode(out.tobytes()).decode()
    q[key + "Codec"] = f"u32-delta-byteplanes-stride{stride}-v1"
  return q


def source_models() -> tuple[dict, dict]:
  """All original leaves/surfaces and exact existing authored source owner."""
  sources = {}
  models = []
  nav = {}
  stats = {}
  old = json.loads((DATA / "eastParksV198.json").read_bytes())
  previous = next(b for b in old["buildings"] if b["id"] == "relation/2309788")
  previous_family = [
    b
    for b in old["buildings"]
    if b["id"] in {"relation/2309788", "way/142701798", "way/1234312660"}
  ]
  assert len(previous_family) == 3
  for key, (tile, parent) in TARGETS.items():
    path = GEO / f"raw/lod2/LoD2_{tile}.zip"
    parents = parent if isinstance(parent, list) else [parent]
    original = []
    for pid in parents:
      b = extract_parent(path, pid)
      original.extend(part_profile(p) for p in leaf_building_parts(b) or [b])
    display_ground = 5.2 if key == "atze" else GROUND
    offset = display_ground - min(p["ground_y_m"] for p in original)
    parts = [shift(p, offset) for p in original]
    sources[key] = dict(
      parent=parent,
      archive=path.relative_to(ROOT).as_posix(),
      archiveSha256=digest(path.read_bytes()),
      originalParts=original,
      displayOffset=offset,
      references=REFERENCES[key],
    )
    body = Detail()
    volumes = []
    drawn = []
    roof_only = []
    for p in parts:
      roof = []
      open_cover = key == "archenhold" and p["id"] in OPEN
      for s in p["surfaces"]:
        if open_cover and s["kind"] != "RoofSurface":
          continue
        wall_rgb = (
          (224, 218, 196)
          if key == "archenhold"
          else (174, 173, 160)
          if key == "atze"
          else (213, 187, 129)
          if key == "parkaue"
          else (93, 99, 100)
          if p["id"] in {"DEBE3DsF31lHGzFs", "DEBE3DthmQHBC2s0"}
          else (149, 102, 77)
        )
        rgb = (
          (138, 77, 54)
          if s["kind"] == "RoofSurface"
          and key == "parkaue"
          and p["top_y_m"] - p["ground_y_m"] > 10
          else (116, 116, 111)
          if s["kind"] == "RoofSurface" and key in {"parkaue", "strahl"}
          else (176, 176, 164)
          if s["kind"] == "RoofSurface"
          else wall_rgb
        )
        for t in triangulate(s["rings"]):
          body.polygon(t, rgb, p["id"] + ":" + s["kind"])
          if s["kind"] == "RoofSurface":
            roof.append(t)
      poly = Polygon(p["ring"], p["holes"])
      if open_cover:
        roof_only.extend(roof)
        for t in roof:
          drawn.append(
            dict(
              ring=[[v[0], v[2]] for v in t],
              holes=[],
              bottom=min(v[1] for v in t) - 0.14,
              top=max(v[1] for v in t),
              roof=[t],
              roofShell=True,
            )
          )
      else:
        volumes.append(
          (
            poly,
            p["ground_y_m"],
            p["top_y_m"],
            (224, 218, 196)
            if key == "archenhold"
            else (174, 173, 160)
            if key == "atze"
            else (213, 187, 129)
            if key == "parkaue"
            else (93, 99, 100)
            if p["id"] in {"DEBE3DsF31lHGzFs", "DEBE3DthmQHBC2s0"}
            else (149, 102, 77),
            roof,
          )
        )
        drawn.append(
          dict(
            ring=p["ring"],
            holes=p["holes"],
            bottom=p["ground_y_m"],
            top=p["top_y_m"],
            roof=roof,
          )
        )
    native, native_nav = native_columns(volumes)
    # Roof-only independently cardinal thin surfaces; no filled source court.
    for t in roof_only:
      poly = Polygon([(v[0], v[2]) for v in t])
      xmin, zmin, xmax, zmax = poly.bounds
      for ix in range(math.floor(xmin), math.ceil(xmax)):
        for iz in range(math.floor(zmin), math.ceil(zmax)):
          c = box(ix, iz, ix + 1, iz + 1)
          if not poly.buffer(1e-7).covers(c):
            continue
          a, b, c3 = t
          den = (b[2] - c3[2]) * (a[0] - c3[0]) + (c3[0] - b[0]) * (a[2] - c3[2])
          if abs(den) < 1e-9:
            continue
          x, z = ix + 0.5, iz + 0.5
          u = ((b[2] - c3[2]) * (x - c3[0]) + (c3[0] - b[0]) * (z - c3[2])) / den
          v = ((c3[2] - a[2]) * (x - c3[0]) + (a[0] - c3[0]) * (z - c3[2])) / den
          y = math.ceil((u * a[1] + v * b[1] + (1 - u - v) * c3[1]) * 8) / 8
          cuboid(
            native,
            [x, y - 0.08, z],
            [1, 0.16, 1],
            (176, 176, 164),
            "native open source cover",
            [],
          )
          native_nav.append(
            dict(
              ring=[[ix, iz], [ix + 1, iz], [ix + 1, iz + 1], [ix, iz + 1]],
              holes=[],
              bottom=y - 0.16,
              top=y,
              roof=[],
            )
          )
    drawn_panes = windows(body, parts, False, key)
    native_panes = windows(native, parts, True, key)
    models.extend(
      [packed(body, key + "-measured", False), packed(native, key + "-cardinal", True)]
    )
    nav[key] = dict(drawn=drawn, native=native_nav)
    stats[key] = dict(
      leaves=len(parts),
      drawnTriangles=len(body.triangles),
      nativeTriangles=len(native.triangles),
      offset=offset,
      drawnPanes=drawn_panes,
      nativePanes=native_panes,
    )
  for mode in [False, True]:
    d, solids = refractor(mode)
    models.append(
      packed(d, "archenhold-refractor-" + ("cardinal" if mode else "drawn"), mode)
    )
    nav["archenhold"]["nativePrimitives" if mode else "drawnPrimitives"] = solids
  return dict(
    schemaVersion=1,
    models=[wordplanes(q) for q in models],
    navigation=nav,
    oldArchenhold=previous,
    oldArchenholdBuildings=previous_family,
    estimates="Fixed20degree observation pose; mounting, railing, fitting dimensions and colours are display estimates; optical length21m/objective680mm and source building sheets are independently evidenced.",
  ), dict(
    schemaVersion=1,
    sources=sources,
    statistics=stats,
    previousArchenhold=previous,
    previousArchenholdBuildings=previous_family,
    openInstrumentLeaves=sorted(OPEN),
    noReferencePixels=True,
  )


def main() -> None:
  """Reproducibly compile only isolated V322 assets."""
  value, evidence = source_models()
  write(DATA / "youthTheatresV322.json", value)
  write(GEO / "youth-theatres-v322-source.json.gz", evidence)
  print(
    json.dumps(
      {
        "bytes": (DATA / "youthTheatresV322.json").stat().st_size,
        "gzipBytes": len(
          gzip.compress((DATA / "youthTheatresV322.json").read_bytes(), mtime=0)
        ),
        "stats": evidence["statistics"],
      }
    )
  )


if __name__ == "__main__":
  main()
