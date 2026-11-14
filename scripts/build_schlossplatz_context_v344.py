"""Compile bounded, actual-resident wall receipts for Schlossplatz context.

No source shell is removed. The drawn coordinates come from complete LoD2 wall
surfaces. Native rectangles are independently intersected with the *existing*
cardinal resident triangles, rather than rotating the drawn facade.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
SOURCE = ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-391_5819-00.json.gz"
# Source polygon IDs select physical faces, not an approximate bounding box.
SPECS = [
  (
    "DEBE01YYK00009Oi",
    "be0a75b9",
    "Ribbeck-Haus · Breite Straße 35",
    "ribbeck",
    3,
    7,
    0xD4C8AA,
  ),
  (
    "DEBE01YYK0000ArS",
    "3e493da6",
    "Alter Marstall · Nordflügel",
    "marstall",
    3,
    3,
    0xD9D1BD,
  ),
  (
    "DEBE01YYK0000ArS",
    "ad1aa25d",
    "Alter Marstall · Mittelrisalit",
    "marstall-centre",
    3,
    3,
    0xD9D1BD,
  ),
  (
    "DEBE01YYK0000ArS",
    "9faca498",
    "Alter Marstall · Südflügel",
    "marstall",
    3,
    3,
    0xD9D1BD,
  ),
  (
    "DEBE01YYK00005AY",
    "094e3e6d",
    "Berliner Stadtbibliothek · Breite Straße 32–34",
    "library",
    3,
    14,
    0xD0CCC0,
  ),
  (
    "DEBE01YYK00002CR",
    "b895edc0",
    "ESMT · rückwärtiger Kanzleiflügel, Breite Straße",
    "office",
    5,
    22,
    0xBEBBAE,
  ),
  (
    "DEBE01YYK00002CR",
    "163e06cb",
    "ESMT · Kanzleiflügel, Gartenseite",
    "office",
    5,
    25,
    0xBEBBAE,
  ),
  ("DEBE01AL40k0003G", "f564fef6", "Niederlagstraße 7", "stone", 4, 3, 0xDED9C8),
  ("DEBE01AL40k0003K", "9b624cae", "Niederlagstraße 9", "stone", 4, 3, 0xD5D0C0),
  ("DEBE01AL40k0003M", "d207502b", "Niederlagstraße 11", "stone", 4, 3, 0xE0DDD2),
  (
    "DEBE01AL40k0003L",
    "bb60e72b",
    "Werderscher Markt 6 · Bertelsmann",
    "ochre",
    5,
    8,
    0xBA905F,
  ),
  (
    "DEBE01AL40k0003L",
    "10fa62d6",
    "Werderscher Markt 6 · Kirchenpassage",
    "ochre",
    4,
    6,
    0xBA905F,
  ),
  (
    "DEBE01AL40k0003O",
    "76dedb79",
    "Schinkelplatz 2 · Südfront",
    "ochre",
    5,
    7,
    0xBA905F,
  ),
  (
    "DEBE01AL40k0003O",
    "2fb2d135",
    "Schinkelplatz 2 · Platzfront",
    "ochre",
    5,
    7,
    0xBA905F,
  ),
  (
    "DEBE01AL40k0003N",
    "a4e55831",
    "Schinkelplatz 3 · Naturstein und Loggien",
    "loggia",
    5,
    7,
    0xDEDACE,
  ),
]


def packets(mode):
  manifest = json.loads((DATA / f"altMitte{mode}V169Source.json").read_bytes())
  result = []
  for entry in manifest["chunkFiles"]:
    packet = json.loads((DATA / entry["file"]).read_bytes())
    ox, _, oz = packet["origin"]
    if not (1500 <= ox <= 2050 and -1 <= oz <= 1):
      continue
    offset = 0
    for mesh in packet["meshes"]:
      packed = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      world = packed / 100 + np.array(packet["origin"])
      for i, ids in enumerate(indices):
        result.append(
          {
            "packetId": entry["id"],
            "origin": packet["origin"],
            "offset": offset + i * 3,
            "positions": packed[ids].reshape(-1).tolist(),
            "world": world[ids],
          }
        )
      offset += len(indices) * 3
  return result


def receipts(triangles):
  groups = {}
  for t in triangles:
    group = groups.setdefault(
      t["packetId"], {"packetId": t["packetId"], "origin": t["origin"], "triangles": {}}
    )
    group["triangles"][t["offset"]] = {
      "offset": t["offset"],
      "positions": t["positions"],
    }
  return [
    {**g, "triangles": sorted(g["triangles"].values(), key=lambda t: t["offset"])}
    for g in groups.values()
  ]


def main():
  buildings = {
    b["id"]: b for b in json.loads(gzip.decompress(SOURCE.read_bytes()))["buildings"]
  }
  drawn, native = packets("Drawn"), packets("Native")
  out = []
  for family, prefix, name, style, floors, bays, wall in SPECS:
    building = buildings[family]
    assert building["category"] == "core"
    part, surface = next(
      (p, s)
      for p in building["parts"]
      for s in p["surfaces"]
      if s["sourcePolygonId"].startswith("UUID_" + prefix)
    )
    ring = np.array(surface["rings"][0])
    low = ring[:, 1].min()
    bottom = ring[np.abs(ring[:, 1] - low) < 0.001]
    a, b = bottom[0][[0, 2]], bottom[-1][[0, 2]]
    length = np.linalg.norm(b - a)
    tangent = (b - a) / length
    left = np.array([-tangent[1], tangent[0]])
    footprint = unary_union(
      [Polygon(p["ring"], p.get("holes", [])) for p in building["footprintPolygons"]]
    )
    side = 1 if not footprint.covers(Point((a + b) / 2 + left * 0.1)) else -1
    normal = left * side
    top = min(p[1] for p in ring if p[1] > low + 0.01)
    projected = Polygon([[(p[[0, 2]] - a) @ tangent, p[1]] for p in ring]).buffer(0.025)
    hits = []
    for t in drawn:
      pts = t["world"]
      if max(abs((p[[0, 2]] - a) @ normal) for p in pts) > 0.02:
        continue
      poly = Polygon([[(p[[0, 2]] - a) @ tangent, p[1]] for p in pts])
      if poly.area > 0.01 and projected.covers(poly):
        hits.append(t)
    assert hits, (name, "missing actual drawn wall")
    draw_edge = {
      "startXZ": a.tolist(),
      "endXZ": b.tolist(),
      "outwardSide": side,
      "wallBaseY": float(low),
      "wallTopY": float(top),
      "street": name,
      "prismId": family,
    }
    # Collect actual cardinal planes near this source wall. The existing native
    # envelope has 2 m steps. Triangles and their holes remain authoritative.
    planes = defaultdict(list)
    for t in native:
      pts = t["world"]
      midpoint = pts.mean(axis=0)
      if midpoint[1] < low - 2 or min(pts[:, 1]) > top or max(pts[:, 1]) < low:
        continue
      if not (-1.5 <= (midpoint[[0, 2]] - a) @ tangent <= length + 1.5):
        continue
      if abs((midpoint[[0, 2]] - a) @ normal) > 1.5:
        continue
      cross = np.cross(pts[1] - pts[0], pts[2] - pts[0])
      norm = np.linalg.norm(cross)
      if norm < 0.01:
        continue
      cross /= norm
      if abs(cross[1]) > 0.001 or cross[[0, 2]] @ normal < 0.45:
        continue
      axis = (
        0 if np.ptp(pts[:, 0]) < 0.001 else 2 if np.ptp(pts[:, 2]) < 0.001 else None
      )
      if axis is None:
        continue
      planes[(axis, round(float(pts[0, axis]), 2), int(round(cross[axis])))].append(t)
    native_edges, native_hits = [], []
    for (axis, plane, direction), ts in sorted(planes.items()):
      horizontal = 2 if axis == 0 else 0
      polys = [Polygon(t["world"][:, [horizontal, 1]]) for t in ts]
      union = unary_union(polys)
      # Project the endpoints onto this cardinal face. End trimming prevents
      # the adjacent family's surface from becoming an admitted front.
      mins = sorted([a[1 if horizontal == 2 else 0], b[1 if horizontal == 2 else 0]])
      clipped = union.intersection(
        box(mins[0] + 0.02, float(low) + 0.03, mins[1] - 0.02, float(top) - 0.05)
      )
      if clipped.is_empty:
        continue
      ys = sorted(
        {
          round(float(low) + 0.03, 6),
          round(float(top) - 0.05, 6),
          *[
            round(float(y), 6)
            for poly in (clipped.geoms if hasattr(clipped, "geoms") else [clipped])
            if isinstance(poly, Polygon)
            for x, y in poly.exterior.coords
          ],
        }
      )
      rects = []
      for y0, y1 in zip(ys, ys[1:]):
        if y1 - y0 < 0.1:
          continue
        band = clipped.intersection(box(mins[0], y0 + 1e-5, mins[1], y1 - 1e-5))
        for poly in band.geoms if hasattr(band, "geoms") else [band]:
          if not isinstance(poly, Polygon) or poly.area < 0.2:
            continue
          x0, _, x1, _ = poly.bounds
          rect = box(x0 + 0.005, y0 + 0.005, x1 - 0.005, y1 - 0.005)
          if x1 - x0 < 0.45 or not clipped.buffer(0.0001).covers(rect):
            continue
          rects.append([round(x0, 5), round(x1, 5), round(y0, 5), round(y1, 5)])
      # Join only identical horizontal intervals, never bridge a void.
      merged = []
      for x0, x1, y0, y1 in sorted(rects):
        if merged and merged[-1][:2] == [x0, x1] and abs(merged[-1][3] - y0) < 0.001:
          merged[-1][3] = y1
        else:
          merged.append([x0, x1, y0, y1])
      for x0, x1, y0, y1 in merged:
        if y1 - y0 < 1:
          continue
        if axis == 0:
          start, end = [plane, x0], [plane, x1]
          outward = -direction
        else:
          start, end = [x0, plane], [x1, plane]
          outward = direction
        native_edges.append(
          {
            **draw_edge,
            "startXZ": start,
            "endXZ": end,
            "outwardSide": outward,
            "wallBaseY": y0,
            "wallTopY": y1,
          }
        )
        rect = box(x0, y0, x1, y1)
        native_hits.extend(
          t for t, poly in zip(ts, polys) if poly.intersection(rect).area > 0.001
        )
    assert native_edges and native_hits, (name, "missing actual native wall")
    out.append(
      {
        "family": family,
        "part": part["id"],
        "sourcePolygon": surface["sourcePolygonId"],
        "name": name,
        "style": style,
        "floors": floors,
        "bays": bays,
        "wall": wall,
        "edge": draw_edge,
        "drawnHosts": receipts(hits),
        "nativeEdges": native_edges,
        "nativeHosts": receipts(native_hits),
      }
    )
  payload = {
    "schemaVersion": 1,
    "sourceSHA256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "fronts": out,
  }
  target = DATA / "schlossplatzContextV344.json"
  target.write_text(
    json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  print(
    {
      "families": len({f[0] for f in SPECS}),
      "fronts": len(out),
      "nativeEdges": sum(len(f["nativeEdges"]) for f in out),
      "bytes": target.stat().st_size,
      "gzipBytes": len(gzip.compress(target.read_bytes(), mtime=0)),
    }
  )


if __name__ == "__main__":
  main()
