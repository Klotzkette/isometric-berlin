"""Finite current federal ministry source faces and complete X8/Justice bodies.

Original source archives, fallback prisms and earlier authored families remain
unchanged. Fine facade subdivisions are reference-guided display estimates.
"""

# The standalone CLI resolves the repository before local source imports.
# ruff: noqa: E402
from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT))
from isometric_berlin.data.fetch_lod2 import (
  GML_ID,
  NS,
  leaf_building_parts,
)
from scripts.build_alt_mitte_v169 import (
  triangulate,
)
from scripts.build_bebelplatz_building_source import (
  part_profile,
)
from scripts.build_karl_marx_allee_v161 import (
  Detail,
)
from scripts.build_scheunenviertel_v168 import (
  merge_native_faces,
)

GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
TARGETS = {
  "BMI": {
    "parents": ["DEBE01YYK0002NHr"],
    "tile": "388_5820",
    "style": "limestone-grid",
    "palette": [0xCAC8BC, 0x52636A, 0x888D88],
    "pitch": 2.65,
    "storey": 3.35,
    "ratio": 0.58,
  },
  "BMJV": {
    "parents": [
      "DEBE01YYK000075B",
      "DEBE01YYK00001rw",
      "DEBE01YYK00000sw",
      "DEBE00YY1H20008B",
      "DEBE01YYK0000ABQ",
      "DEBE01YYK00006gV",
      "DEBE01YYK00003LR",
      "DEBE00YY1H1000Va",
      "DEBE01YYK00007dV",
      "DEBE01YYK0001xiv",
    ],
    "tile": "391_5819",
    "style": "historic-law",
    "palette": [0xCDBB96, 0x53646D, 0x8B887D],
    "pitch": 3.35,
    "storey": 3.7,
    "ratio": 0.49,
  },
  "BMBFSFJ": {
    "parents": [
      "DEBE01YYK00008Ey",
      "DEBE01YYK00004vF",
      "DEBE01YYK00007vi",
      "DEBE01YYK00009ht",
      "DEBE01YYK0001z8q",
      "DEBE00YY18D0006z",
      "DEBE01YYK00002rE",
      "DEBE01YYK00001iF",
      "DEBE01YYK00003VB",
      "DEBE01YYK00004TZ",
      "DEBE01YYK00001uc",
    ],
    "tile": "390_5819",
    "style": "family-stone-grid",
    "palette": [0xD2CFC2, 0x526A77, 0x9B9C93],
    "pitch": 2.8,
    "storey": 3.75,
    "ratio": 0.51,
  },
  "BMDS": {
    "parents": ["DEBE01YYK00003r7", "DEBE00YY173000Et"],
    "tile": "390_5820",
    "style": "gmp-frame",
    "palette": [0xCBC9BD, 0x4D6673, 0x9A9D99],
    "pitch": 4.1,
    "storey": 4.1,
    "ratio": 0.81,
  },
  "BMG": {
    "parents": ["DEBE01YYK00008iU", "DEBE01YYK0000Ae0"],
    "tile": "390_5819",
    "style": "historic-bank",
    "palette": [0xCBC3B1, 0x52615E, 0x9B958A],
    "pitch": 3.3,
    "storey": 4.1,
    "ratio": 0.47,
  },
  "BMLEH": {
    "parents": [
      "DEBE01YYK00005tV",
      "DEBE01YYK0000EXO",
      "DEBE01YYK00003LE",
      "DEBE01YYK00003Zk",
      "DEBE01YYK0000B6k",
    ],
    "tile": "390_5819",
    "style": "vohl-and-basalt",
    "palette": [0xCBC0A5, 0x53656B, 0x999084],
    "pitch": 3.1,
    "storey": 3.75,
    "ratio": 0.54,
  },
  "BMZ": {
    "parents": ["DEBE02YY400000zX"],
    "tile": "390_5818",
    "style": "europahaus-ribbon",
    "palette": [0xCCCAC0, 0x526A74, 0x989D97],
    "pitch": 3.1,
    "storey": 4.2,
    "ratio": 0.83,
  },
  "BMWSB": {
    "parents": ["DEBE02YY4000042k"],
    "tile": "391_5818",
    "style": "x8-glazed",
    "palette": [0xBCC6C2, 0x526F75, 0x85968F],
    "pitch": 2.8,
    "storey": 3.6,
    "ratio": 0.84,
  },
}
OLD_BODIES = ["32698095", "32698102", "74476580", "41953739", "n-280071"]
PRESERVED_X8 = {"DEBE3DZjmMEK2SZD", "DEBE3DUspil8YjZO"}
PRESERVED_JUSTICE_PARENT = "DEBE01YYK0000ABQ"


def read(path):
  raw = Path(path).read_bytes()
  return json.loads(gzip.decompress(raw) if str(path).endswith(".gz") else raw)


def write(path, value):
  raw = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
  Path(path).write_bytes(
    gzip.compress(raw, mtime=0) if str(path).endswith(".gz") else raw
  )


def source_families():
  result = {k: [] for k in TARGETS}
  for tile in sorted({v["tile"] for v in TARGETS.values()}):
    archive = GEO / f"raw/lod2/LoD2_{tile}.zip"
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    with zipfile.ZipFile(archive) as z:
      for name in z.namelist():
        if not name.endswith((".gml", ".xml")):
          continue
        with z.open(name) as f:
          for _, e in ET.iterparse(f, events=["end"]):
            if e.tag != f"{{{NS['bldg']}}}Building":
              continue
            for key, target in TARGETS.items():
              if tile == target["tile"] and e.get(GML_ID) in target["parents"]:
                result[key].append(
                  {
                    "id": e.get(GML_ID),
                    "archiveSha256": digest,
                    "parts": [part_profile(p) for p in leaf_building_parts(e) or [e]],
                  }
                )
            e.clear()
    for key, target in TARGETS.items():
      if target["tile"] == tile and {f["id"] for f in result[key]} != set(
        target["parents"]
      ):
        raise ValueError(f"Missing complete source family: {key}")
  return result


def retained_records():
  manifest = read(GEO / "alt-mitte-v169/source-manifest.json")
  wanted = {v for t in TARGETS.values() for v in t["parents"]}
  records = {}
  refs = []
  for row in manifest["chunks"]:
    for record in read(GEO / "alt-mitte-v169" / row["file"])["buildings"]:
      if record["id"] in wanted:
        records[record["id"]] = record
        refs.append({"id": record["id"], "file": row["file"], "sha256": row["sha256"]})
  return records, refs


def rgb(hex_value):
  return tuple((hex_value >> shift) & 255 for shift in (16, 8, 0))


def packed(detail, key, native, precise=False):
  if not detail.triangles:
    raise ValueError(f"Empty required model: {key}")
  points = np.array([p for t, _, _ in detail.triangles for p in t])
  origin = np.floor(points.min(axis=0))
  table, pos, colors, indices, normals = {}, [], [], [], []
  for triangle, color, _ in detail.triangles:
    srgb = np.array(color) / 255
    linear = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
    tint = tuple(np.rint(linear * 65535).astype(int))
    triangle_array = np.asarray(triangle)
    normal = np.cross(
      triangle_array[1] - triangle_array[0], triangle_array[2] - triangle_array[0]
    )
    normal = np.asarray(normal / np.linalg.norm(normal), dtype="<f4")
    for point in triangle:
      p = (
        tuple(np.asarray(np.array(point) - origin, dtype="<f4"))
        if precise
        else tuple(np.rint((np.array(point) - origin) * 100).astype(int))
      )
      if not precise and (min(p) < 0 or max(p) > 65535):
        raise ValueError("Finite model exceeded centimetre source bounds")
      token = (*p, *tint, *normal) if precise else (*p, *tint)
      if token not in table:
        table[token] = len(pos)
        pos.append(p)
        colors.append(tint)
        normals.append(normal)
      indices.append(table[token])
  if not precise:
    # Centimetre clipping can collapse a tiny display sliver. Keep every
    # position/colour word and omit only its zero-area, invisible index triple.
    coordinates = np.asarray(pos, dtype=np.int64)
    ids = np.asarray(indices, dtype=np.int64).reshape(-1, 3)
    q = coordinates[ids]
    visible = np.any(np.cross(q[:, 1] - q[:, 0], q[:, 2] - q[:, 0]) != 0, axis=1)
    indices = ids[visible].reshape(-1).tolist()
  result = {
    "key": key,
    "native": native,
    "field": key.split("-")[0],
    "positionType": "f32" if precise else "u16cm",
    "colorType": "u16linear",
    "origin": origin.tolist(),
    "positions": base64.b64encode(
      np.array(pos, dtype="<f4" if precise else "<u2").tobytes()
    ).decode(),
    "colors": base64.b64encode(np.array(colors, dtype="<u2").tobytes()).decode(),
    "indices": base64.b64encode(np.array(indices, dtype="<u4").tobytes()).decode(),
    "vertices": len(pos),
    "triangles": len(indices) // 3,
  }
  if precise:
    result["normals"] = base64.b64encode(
      np.asarray(normals, dtype="<f4").tobytes()
    ).decode()
  return result


def shifted_source(part, delta):
  return {
    **part,
    "ground_y_m": part["ground_y_m"] + delta,
    "top_y_m": part["top_y_m"] + delta,
    "surfaces": [
      {**s, "rings": [[[x, y + delta, z] for x, y, z in ring] for ring in s["rings"]]}
      for s in part["surfaces"]
    ],
  }


def opening_intervals(a, direction, lo, hi, opening):
  if opening is None:
    return []
  footprint, bottom, top = opening
  line = LineString([a + direction * (lo - 1), a + direction * (hi + 1)])
  cut = line.intersection(footprint.buffer(0.000001))
  segments = [cut] if cut.geom_type == "LineString" else list(getattr(cut, "geoms", []))
  result = []
  for segment in segments:
    if segment.geom_type != "LineString" or segment.length < 0.0001:
      continue
    values = [(np.array(p) - a) @ direction for p in segment.coords]
    result.append([min(values), max(values), bottom, top])
  return result


def surface_triangles(surface, opening):
  if surface["kind"] != "WallSurface" or opening is None:
    return triangulate(surface["rings"])
  ring = np.array(surface["rings"][0])
  a, b = max(
    ((a, b) for a in ring for b in ring),
    key=lambda p: np.linalg.norm((p[1] - p[0])[[0, 2]]),
  )
  direction = b[[0, 2]] - a[[0, 2]]
  width = np.linalg.norm(direction)
  if width < 0.0001:
    return triangulate(surface["rings"])
  direction /= width
  projected = [
    [[(np.array(p)[[0, 2]] - a[[0, 2]]) @ direction, p[1]] for p in r]
    for r in surface["rings"]
  ]
  polygon = Polygon(projected[0], projected[1:])
  if not polygon.is_valid:
    polygon = polygon.buffer(0)
  from shapely.geometry import box

  for lo, hi, bottom, top in opening_intervals(
    a[[0, 2]], direction, polygon.bounds[0], polygon.bounds[2], opening
  ):
    polygon = polygon.difference(box(lo, bottom, hi, top))
  result = []
  polygons = (
    [polygon] if polygon.geom_type == "Polygon" else list(getattr(polygon, "geoms", []))
  )
  normal = np.cross(ring[1] - ring[0], ring[2] - ring[0])
  for poly in polygons:
    if poly.geom_type != "Polygon" or poly.area < 0.0000001:
      continue
    rings = [
      [
        [float(a[0] + direction[0] * u), float(y), float(a[2] + direction[1] * u)]
        for u, y in r.coords[:-1]
      ]
      for r in [poly.exterior, *poly.interiors]
    ]
    for triangle in triangulate(rings):
      tri = np.array(triangle)
      if np.dot(np.cross(tri[1] - tri[0], tri[2] - tri[0]), normal) < 0:
        triangle.reverse()
      result.append(triangle)
  return result


def source_shell(parts, tone, opening=None):
  detail = Detail()
  for part in parts:
    for surface in part["surfaces"]:
      for triangle in surface_triangles(surface, opening):
        detail.triangles.append(
          (
            triangle,
            rgb(0x8F9694 if surface["kind"] == "RoofSurface" else tone),
            "source " + surface["kind"],
          )
        )
  return detail


def plane_faces(parts, target, max_faces=20, opening=None):
  """Only exposed complete source walls; no guessed entrances or new roof."""
  union = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
  candidates = []
  for part in parts:
    for face_index, surface in enumerate(part["surfaces"]):
      if surface["kind"] != "WallSurface":
        continue
      ring = np.array(surface["rings"][0])
      if len(ring) < 3:
        continue
      normal = np.cross(ring[1] - ring[0], ring[2] - ring[0])
      length = np.linalg.norm(normal)
      if length < 0.001 or abs(normal[1] / length) > 0.03:
        continue
      normal /= length
      a, b = max(
        ((a, b) for a in ring for b in ring),
        key=lambda p: np.linalg.norm((p[1] - p[0])[[0, 2]]),
      )
      vector = b[[0, 2]] - a[[0, 2]]
      width = np.linalg.norm(vector)
      if width < 6:
        continue
      direction = vector / width
      projected = [
        np.array([[(np.array(p)[[0, 2]] - a[[0, 2]]) @ direction, p[1]] for p in r])
        for r in surface["rings"]
      ]
      poly = Polygon(projected[0], projected[1:])
      if not poly.is_valid:
        poly = poly.buffer(0)
      if poly.is_empty:
        continue
      u0, low, u1, high = poly.bounds
      center = a[[0, 2]] + direction * (u0 + u1) / 2
      if union.covers(Point(*(center + normal[[0, 2]] * 0.7))):
        normal *= -1
      if union.covers(Point(*(center + normal[[0, 2]] * 0.7))):
        continue
      ys = []
      for u in [u0 + 0.2, u1 - 0.2, (u0 + u1) / 2]:
        section = poly.intersection(LineString([(u, low - 1), (u, high + 1)]))
        if not section.is_empty:
          ys.append(section.bounds[3])
      top = min(ys, default=low)
      base = max(5.2, low)
      if top - base < 8:
        continue
      candidates.append(
        {
          "owner": part["id"],
          "parent": part.get("parentId", part["id"]),
          "surface": face_index,
          "a": [round(float(a[0]), 3), round(float(a[2]), 3)],
          "d": [round(float(x), 9) for x in direction],
          "n": [round(float(x), 9) for x in normal[[0, 2]]],
          "range": [
            round(float(u0 + 0.2), 3),
            round(float(u1 - 0.2), 3),
            round(float(base + 0.25), 3),
            round(float(top - 0.3), 3),
          ],
          "scope": [
            round(float(u0), 3),
            round(float(u1), 3),
            round(float(base), 3),
            round(float(top), 3),
          ],
          "voids": opening_intervals(a[[0, 2]], direction, u0, u1, opening),
          "polygon": projected[0].round(5).tolist(),
          "holes": [r.round(5).tolist() for r in projected[1:]],
          "area": width * (top - base),
        }
      )
  # Public long fronts dominate recognition; all omitted source walls remain.
  selected = sorted(candidates, key=lambda p: -p["area"])[:max_faces]
  for face in selected:
    face.pop("area")
  return selected


def cardinal_shell(detail, opening=None):
  """Same measured surface samples, with a source-bounded public arch void."""
  cells = {}
  for triangle, color, _ in detail.triangles:
    a, b, c = np.asarray(triangle, dtype=float)
    steps = max(
      1,
      math.ceil(
        max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b)) / 0.95
      ),
    )
    ii, jj = np.triu_indices(steps + 1)
    samples = (
      a + (ii / steps)[:, None] * (b - a) + ((jj - ii) / steps)[:, None] * (c - a)
    )
    for row in np.unique(
      np.floor((samples - np.array([0, 5.2, 0])) / 2).astype(int), axis=0
    ):
      center = (row + 0.5) * 2 + np.array([0, 5.2, 0])
      if (
        opening
        and opening[0].covers(Point(center[0], center[2]))
        and opening[1] + 0.5 < center[1] < opening[2]
      ):
        continue
      cells[tuple(row)] = color
  out = Detail()
  for (ix, iy, iz), color in cells.items():
    x, y, z = ix * 2, iy * 2 + 5.2, iz * 2
    for neighbour, points in [
      ((-1, 0, 0), [[x, y, z], [x, y, z + 2], [x, y + 2, z + 2], [x, y + 2, z]]),
      (
        (1, 0, 0),
        [[x + 2, y, z + 2], [x + 2, y, z], [x + 2, y + 2, z], [x + 2, y + 2, z + 2]],
      ),
      ((0, -1, 0), [[x, y, z + 2], [x, y, z], [x + 2, y, z], [x + 2, y, z + 2]]),
      (
        (0, 1, 0),
        [[x, y + 2, z], [x, y + 2, z + 2], [x + 2, y + 2, z + 2], [x + 2, y + 2, z]],
      ),
      ((0, 0, -1), [[x + 2, y, z], [x, y, z], [x, y + 2, z], [x + 2, y + 2, z]]),
      (
        (0, 0, 1),
        [[x, y, z + 2], [x + 2, y, z + 2], [x + 2, y + 2, z + 2], [x, y + 2, z + 2]],
      ),
    ]:
      if tuple(np.array([ix, iy, iz]) + neighbour) not in cells:
        out.polygon(points, color, "native measured surface")
  out.native_cells = list(cells)
  return out


def paint_face(detail, face, color, out):
  from shapely.geometry import box

  polygon = Polygon(face["polygon"], face.get("holes", []))
  for lo, hi, bottom, top in face.get("voids", []):
    polygon = polygon.difference(box(lo, bottom, hi, top))
  polygons = (
    [polygon] if polygon.geom_type == "Polygon" else list(getattr(polygon, "geoms", []))
  )
  a, d, n = map(np.asarray, [face["a"], face["d"], face["n"]])
  for poly in polygons:
    if poly.geom_type != "Polygon" or poly.area < 0.01:
      continue
    rings = [
      [
        [
          float(a[0] + d[0] * u + n[0] * out),
          float(y),
          float(a[1] + d[1] * u + n[1] * out),
        ]
        for u, y in ring.coords[:-1]
      ]
      for ring in [poly.exterior, *poly.interiors]
    ]
    for triangle in triangulate(rings):
      q = np.asarray(triangle)
      normal = np.cross(q[1] - q[0], q[2] - q[0])
      if normal[[0, 2]] @ n < 0:
        triangle.reverse()
      detail.triangles.append(
        (triangle, rgb(color), "source-bound public facade veneer")
      )


def coarse_conflicts(source, lookup):
  """Retain original outline slivers as explicit same-owner evidence."""
  result = []
  for key, ids in [("BMWSB", OLD_BODIES[:3]), ("BMJV", OLD_BODIES[3:])]:
    whole = unary_union(
      [Polygon(p["ring"], p["holes"]) for f in source[key] for p in f["parts"]]
    )
    for owner in ids:
      old = lookup[owner]
      polygon = Polygon(
        np.asarray(old["ring"]) / 10, [np.asarray(h) / 10 for h in old.get("holes", [])]
      )
      result.append(
        {
          "owner": owner,
          "ministry": key,
          "originalAreaM2": polygon.area,
          "sharedMeasuredAreaM2": polygon.intersection(whole).area,
          "coarseOutsideMeasuredAreaM2": polygon.difference(whole).area,
          "originalHeightM": old["h_dm"] / 10,
          "policy": "Approved finite whole same-owner correction; original polygon retained, no false ghost wall replay.",
        }
      )
  return result


def build():
  source = source_families()
  retained, retained_refs = retained_records()
  prisms = read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")[
    "buildings"
  ]
  lookup = {p["id"]: p for p in prisms}
  sites, models, nav = [], [], []
  native_models = {}
  native_cells = {}
  site_parts = {}
  for key, target in TARGETS.items():
    parts = []
    for family in source[key]:
      record = retained.get(family["id"])
      previous = {p["id"]: p for p in record["parts"]} if record else {}
      for original_part in family["parts"]:
        part = {**original_part, "parentId": family["id"]}
        if key == "BMWSB" and part["id"] in PRESERVED_X8:
          continue
        if key == "BMJV" and family["id"] == PRESERVED_JUSTICE_PARENT:
          # Its four already complete Alt-Mitte parts remain owned.
          previous_part = previous.get(part["id"])
          if previous_part:
            parts.append(shifted_source(part, previous_part["topY"] - part["top_y_m"]))
          continue
        if key in {"BMWSB", "BMJV"}:
          parts.append(shifted_source(part, 0))
        elif part["id"] in previous:
          parts.append(
            shifted_source(part, previous[part["id"]]["topY"] - part["top_y_m"])
          )
        else:
          prism = lookup.get(part["id"][-8:]) or lookup.get(part["id"])
          if prism:
            parts.append(
              shifted_source(
                part, (prism["y0_dm"] + prism["h_dm"]) / 10 - part["top_y_m"]
              )
            )
    if not parts:
      raise ValueError(f"No admitted existing or replacement hosts for {key}")
    if key in {"BMWSB", "BMJV"}:
      new_parts = [
        p
        for p in parts
        if key != "BMJV"
        or p["id"] not in {x["id"] for x in retained[PRESERVED_JUSTICE_PARENT]["parts"]}
      ]
      colonnade = next((p for p in new_parts if p["id"] == "DEBE00YY1H1000Va"), None)
      opening = (
        (
          Polygon(colonnade["ring"], colonnade["holes"]),
          colonnade["ground_y_m"],
          colonnade["top_y_m"] - 0.6,
        )
        if colonnade
        else None
      )
      shell = source_shell(new_parts, target["palette"][0], opening)
      models.append(packed(shell, key + "-complete-source", False, precise=True))
      if colonnade:
        floor = colonnade["ground_y_m"]
        for triangle in triangulate(
          [
            [[x, floor, z] for x, z in ring]
            for ring in [colonnade["ring"], *colonnade["holes"]]
          ]
        ):
          shell.triangles.append(
            (triangle, rgb(target["palette"][0]), "public colonnade floor")
          )
      cardinal = cardinal_shell(shell, opening)
      native = merge_native_faces(cardinal)
      native_cells[key] = getattr(cardinal, "native_cells", [])
      native_models[key] = native
      models.append(packed(native, key + "-cardinal-source", True))
      for part in new_parts:
        nav.append(
          {
            "site": key,
            "id": part["id"],
            "ring": part["ring"],
            "holes": part["holes"],
            "groundY": part["ground_y_m"],
            "topY": part["top_y_m"],
            "roofTriangles": [
              t
              for s in part["surfaces"]
              if s["kind"] == "RoofSurface"
              for t in triangulate(s["rings"])
            ],
          }
        )
    site_parts[key] = parts
    sites.append(
      {
        "key": key,
        "style": target["style"],
        "palette": target["palette"],
        "pitch": target["pitch"],
        "storey": target["storey"],
        "ratio": target["ratio"],
        "faces": plane_faces(parts, target, opening=opening if key == "BMJV" else None),
        "partIds": [p["id"] for p in parts],
      }
    )
    if key == "BMLEH":
      for face in sites[-1]["faces"]:
        if face["parent"] == "DEBE01YYK0000B6k":
          face["detail"] = {
            "style": "basalt-shifted",
            "palette": [0x515751, 0x4F646A, 0x929A91],
            "pitch": 3.2,
            "storey": 3.75,
            "ratio": 0.7,
          }
    print(key, "parts", len(parts), "faces", len(sites[-1]["faces"]), flush=True)
  source_ids = set(OLD_BODIES)
  for record in retained.values():
    source_ids.update(p["id"] for p in record.get("legacyPrisms", []))
  for site in sites:
    source_ids.update(p[-8:] for p in site["partIds"] if p[-8:] in lookup)
    source_ids.update(p for p in site["partIds"] if p in lookup)
  runtime = {
    "schemaVersion": 1,
    "sourcePrisms": [lookup[p] for p in sorted(source_ids) if p in lookup],
    "sites": sites,
    "models": models,
    "navigation": nav,
    "oldBodies": [lookup[p] for p in OLD_BODIES],
    "justiceColonnade": {
      "a": [1591.9, 761.7],
      "b": [1613.9, 759.6],
      "base": 4.922,
      "nativeBase": 5.2,
      "nativeCeiling": 13.2,
      "spring": 10.4,
      "crown": 12.6,
      "bays": 7,
      "openRing": next(
        p for f in source["BMJV"] for p in f["parts"] if p["id"] == "DEBE00YY1H1000Va"
      )["ring"],
      "ceiling": 12.713,
    },
  }
  runtime["nativeNavigationCells"] = sorted(
    set(tuple(map(int, p)) for rows in native_cells.values() for p in rows)
  )
  runtime["_nativeModels"] = native_models
  runtime["_parts"] = site_parts
  evidence = {
    "schemaVersion": 1,
    "policy": "Complete source families and all original fallback records retained. Two earlier V272 tower leaves and four Alt169 ABQ leaves stay independently owned. Small colour/window dimensions are public-photo display fits. No interior or security information.",
    "source": source,
    "retainedSourceReferences": retained_refs,
    "originalBodies": [lookup[p] for p in OLD_BODIES],
    "sameOwnerOutlineConflicts": coarse_conflicts(source, lookup),
  }
  transport = {k: v for k, v in runtime.items() if not k.startswith("_")}
  write(DATA / "federalMinistriesV321.json", transport)
  write(GEO / "federal-ministries-v321-evidence.json.gz", evidence)
  raw = (DATA / "federalMinistriesV321.json").read_bytes()
  print(
    "runtime",
    len(raw),
    "gzip",
    len(gzip.compress(raw, mtime=0)),
    "evidence",
    (GEO / "federal-ministries-v321-evidence.json.gz").stat().st_size,
  )
  return runtime


if __name__ == "__main__":
  build()
