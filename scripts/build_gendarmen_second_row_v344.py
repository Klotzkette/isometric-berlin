"""Step 10: eight second-row elevations, bound to active Alt-Mitte surfaces.

The native receipts come from the independently cardinal resident packets, not
from voxelising the new drawn decoration. No building envelope is replaced.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app/src"
SOURCE = ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-391_5819-00.json.gz"
DEST = APP / "data/gendarmenSecondRowV344.json"
SITES = [
  (
    "manheimer",
    "Jägerstraße 33 · Konfektionshaus Manheimer",
    "DEBE01YYK00005kU",
    "09030037",
    ["2e15503a", "2f1526fe", "5be603d0"],
    5,
    0xD2CAB9,
  ),
  (
    "mendelssohnBank",
    "Jägerstraße 49–50 · Bankhaus Mendelssohn",
    "DEBE01YYK00002yB",
    "09080277",
    ["61f60be6"],
    2,
    0xC8BEA8,
  ),
  (
    "mendelssohnHouse",
    "Jägerstraße 51 · Wohnhaus Mendelssohn",
    "DEBE01YYK00002h7",
    "09065005",
    ["35e32e43", "a8570f96"],
    4,
    0xE5E1D5,
  ),
  (
    "hausvogtei1",
    "Hausvogteiplatz 1 · Geschäftshaus",
    "DEBE01YYK00004Pi",
    "09035327",
    ["cf733954"],
    6,
    0xC7BEA8,
  ),
  (
    "hausvogtei2",
    "Hausvogteiplatz 2 · Pysall/Stahrenberg Geschäftshaus",
    "DEBE01YYK0000DUa",
    "groth",
    [],
    6,
    0xB99383,
  ),
  (
    "hausvoigt",
    "Hausvogteiplatz 8–9 / Mohrenstraße · Zum Hausvoigt",
    "DEBE01YYK000027N",
    "09030005",
    [
      "86d1f7e9",
      "5b3e8f90",
      "b3d6efa4",
      "536a63f2",
      "2b9382cb",
      "af4b7222",
      "a52f5799",
      "f74a243b",
    ],
    5,
    0xD1CCAF,
  ),
  (
    "bosch",
    "Französische Straße 32 · Robert Bosch Stiftung",
    "DEBE01YYK00009AV",
    "bosch",
    ["73a96725"],
    5,
    0xE1DED4,
  ),
  (
    "tauben26",
    "Taubenstraße 26 · Geschäftshaus Reichhelm",
    "DEBE01YYK0000DlQ",
    "09065007",
    ["2c54949b"],
    6,
    0xC8C2AD,
  ),
]


def packets(native: bool) -> list[dict]:
  result = []
  for path in sorted(
    (APP / ("data/altMitteV169Native" if native else "data/altMitteV169Drawn")).glob(
      "*.json"
    )
  ):
    d = json.loads(path.read_text())
    if not d["meshes"] or not (
      1400 <= d["origin"][0] <= 1800 and 0 <= d["origin"][2] <= 600
    ):
      continue
    mesh = d["meshes"][0]
    positions = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
      -1, 3
    )
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
      -1, 3
    )
    local = positions[indices]
    triangles = local / 100 + np.asarray(d["origin"])
    normal = np.cross(
      triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
    )
    magnitudes = np.linalg.norm(normal, axis=1)
    normal /= np.maximum(magnitudes[:, None], 1e-12)
    result.append(
      {
        "id": d["id"],
        "origin": d["origin"],
        "path": path,
        "local": local,
        "triangles": triangles,
        "normal": normal,
      }
    )
  return result


def receipt(packet: dict, selected: list[int]) -> dict:
  return {
    "packetId": packet["id"],
    "origin": packet["origin"],
    "triangles": [
      {"offset": i * 3, "positions": packet["local"][i].flatten().tolist()}
      for i in selected
    ],
  }


def hosts(edge: dict, packed: list[dict], native: bool) -> tuple[list, list]:
  a, b = np.asarray(edge["startXZ"]), np.asarray(edge["endXZ"])
  length = np.linalg.norm(b - a)
  tangent = (b - a) / length
  outward = np.asarray([-tangent[1], tangent[0]]) * edge["outwardSide"]
  low, high = edge["wallBaseY"], edge["wallTopY"]
  receipts, faces = [], []
  for packet in packed:
    ts = packet["triangles"]
    xz = ts[:, :, [0, 2]]
    u, offset = (xz - a) @ tangent, (xz - a) @ outward
    normals = packet["normal"]
    selected = np.where(
      (u.min(axis=1) >= (-2.1 if native else -0.025))
      & (u.max(axis=1) <= length + (2.1 if native else 0.025))
      & (ts[:, :, 1].max(axis=1) > low + 0.1)
      & (ts[:, :, 1].min(axis=1) < high - 0.1)
      & (abs(normals[:, 1]) < 0.001)
      & (offset.min(axis=1) >= (-0.05 if not native else -0.25))
      & (offset.max(axis=1) <= (0.03 if not native else 2.85))
      & ((normals[:, [0, 2]] @ outward) > (0.8 if not native else 0.55))
    )[0].tolist()
    if not selected:
      continue
    if not native:
      receipts.append(receipt(packet, selected))
      continue
    planes: dict[tuple, list] = defaultdict(list)
    for i in selected:
      t, n = ts[i], normals[i]
      axis = 0 if abs(n[0]) > 0.9 else 2
      along = 2 if axis == 0 else 0
      if abs(n[axis]) < 0.99:
        continue
      coordinate = round(float(t[0, axis]), 2)
      planes[(axis, coordinate, 1 if n[axis] > 0 else -1)].append(
        (i, Polygon(t[:, [along, 1]]))
      )
    admitted = set()
    for (axis, coordinate, sign), parts in planes.items():
      shape = unary_union([p for _, p in parts])
      x0, y0, x1, y1 = shape.bounds
      # Real cardinal support rectangles. Split only along actual two-metre
      # columns; small partial end strips stay inside the reference frontage.
      for along in np.arange(math.floor(x0 / 2) * 2, x1, 2):
        mid = np.asarray(
          [coordinate, along + 1] if axis == 0 else [along + 1, coordinate]
        )
        uu = float((mid - a) @ tangent)
        if not 0.2 <= uu <= length - 0.2:
          continue
        clip = shape.intersection(box(along, max(low, y0), along + 2, min(high, y1)))
        if clip.is_empty:
          continue
        # Continuous y-runs are sampled from the actual exposed packet face,
        # never inferred from a declared height or from the smooth wall.
        ys = sorted(
          {
            max(low, y0),
            min(high, y1),
            *[
              float(v) for _, p in parts for _, v in p.exterior.coords if low < v < high
            ],
          }
        )
        spans = []
        for bottom, top in zip(ys, ys[1:], strict=False):
          rectangle = box(along + 0.005, bottom + 0.005, along + 1.995, top - 0.005)
          if top - bottom > 0.03 and clip.buffer(0.001).covers(rectangle):
            if spans and abs(spans[-1][1] - bottom) < 0.001:
              spans[-1][1] = top
            else:
              spans.append([bottom, top])
        for bottom, top in spans:
          if top - bottom < 1:
            continue
          support = box(along, bottom, along + 2, top)
          indices = [i for i, poly in parts if poly.intersection(support).area > 0.001]
          admitted.update(indices)
          faces.append(
            {
              "axis": axis,
              "coordinate": coordinate,
              "sign": sign,
              "along": round(float(along), 3),
              "bottom": round(bottom, 3),
              "top": round(top, 3),
              "u": round(uu, 3),
            }
          )
    if admitted:
      receipts.append(receipt(packet, sorted(admitted)))
  return receipts, faces


def build() -> dict:
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  drawn, native = packets(False), packets(True)
  buildings = []
  for key, name, owner, reference, chosen, floors, color in SITES:
    b = next(b for b in source["buildings"] if b["id"] == owner)
    assert b["category"] == "core"
    footprint = unary_union(
      [
        Polygon(p["ring"], p["holes"])
        for pt in b["parts"]
        for p in pt["footprintPolygons"]
      ]
    )
    fronts = []
    for part in b["parts"]:
      for surface in part["surfaces"]:
        if surface["kind"] != "WallSurface":
          continue
        ring = surface["rings"][0]
        a, c = max(
          ((a, c) for a in ring for c in ring),
          key=lambda ac: math.hypot(ac[0][0] - ac[1][0], ac[0][2] - ac[1][2]),
        )
        length = math.hypot(c[0] - a[0], c[2] - a[2])
        low = min(p[1] for p in ring)
        high = min((p[1] for p in ring if p[1] > low + 0.4), default=low)
        chosen_face = any(p in surface["sourcePolygonId"] for p in chosen)
        if key == "hausvogtei2":
          chosen_face = min(a[2], c[2]) > 655 and high - low > 20 and length > 0.5
        if not chosen_face:
          continue
        nx, nz = -(c[2] - a[2]) / length, (c[0] - a[0]) / length
        mx, mz = (a[0] + c[0]) / 2, (a[2] + c[2]) / 2
        side = -1 if footprint.contains(Point(mx + nx * 0.1, mz + nz * 0.1)) else 1
        edge = {
          "startXZ": [a[0], a[2]],
          "endXZ": [c[0], c[2]],
          "outwardSide": side,
          "wallBaseY": low,
          "wallTopY": high,
          "sourcePartId": part["id"],
          "sourcePolygonId": surface["sourcePolygonId"],
        }
        edge["drawnReceipts"], _ = hosts(edge, drawn, False)
        edge["nativeReceipts"], edge["nativeFaces"] = hosts(edge, native, True)
        assert edge["drawnReceipts"], (key, surface["sourcePolygonId"])
        fronts.append(edge)
    assert fronts and any(e["nativeFaces"] for e in fronts), key
    item = {
      "key": key,
      "name": name,
      "owner": owner,
      "reference": reference,
      "floors": floors,
      "wall": color,
      "fronts": fronts,
    }
    if key == "hausvogtei2":
      native_front = {
        "startXZ": [1691.425, 655.839],
        "endXZ": [1669.533, 660.732],
        "outwardSide": -1,
        "wallBaseY": 5.2,
        "wallTopY": 32.405,
        "sourcePartId": "DEBE3DnOmuE8lh0C",
        "sourcePolygonId": "native-cardinal-union-of-public-fronts",
        "drawnReceipts": [],
      }
      native_front["nativeReceipts"], native_front["nativeFaces"] = hosts(
        native_front, native, True
      )
      item["nativeFronts"] = [native_front]
    buildings.append(item)
  paths = [SOURCE, *[p["path"] for p in drawn + native]]
  return {
    "schemaVersion": 1,
    "sourceGeometryRetained": True,
    "sources": [
      {
        "path": str(p.relative_to(ROOT)),
        "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
      }
      for p in paths
    ],
    "buildings": buildings,
  }


if __name__ == "__main__":
  result = build()
  DEST.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(
    [
      (b["key"], len(b["fronts"]), sum(len(e["nativeFaces"]) for e in b["fronts"]))
      for b in result["buildings"]
    ]
  )
