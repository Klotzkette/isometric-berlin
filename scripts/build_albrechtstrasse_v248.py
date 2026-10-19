"""Step 10: photo-guided fittings on Albrechtstraße 131's retained plaza walls.

No source envelope or packet is rewritten. Native fittings use the independent
existing voxel contour; none of the drawn rotations enter that representation.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
OUT = DATA / "albrechtstrasseV248Details.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/albrechtstrasse-v248-evidence.json"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
OWNER = "DEBE06YYB0000PVc"
PACKETS = {
  "drawn": "e88efca70c6b3e5a056c1d9851581b1e0ee2b81e2bad2d5ef007ac2c3514b6e8",
  "minecraft": "8c338ec2a3a2eac194cb004d2e527997d85511832f0c5f130eba0e1e4007f409",
}
FRAME, GLASS, CORNICE = 0xDFDDD2, 0x849A9E, 0xC9C7BC
FLOORS = [(10.2, 2.7), (14.2, 2.5), (18.2, 2.5), (22.2, 2.5)]


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def source(family: str) -> tuple[dict, dict, np.ndarray]:
  path = PUBLIC / f"ring182--7_13.{family}.json.gz"
  assert sha(path) == PACKETS[family], "Earlier immutable source packet changed"
  packet = json.loads(gzip.decompress(path.read_bytes()))
  owner = next(b for b in packet["nav"]["buildings"] if b["sourceId"] == OWNER)
  origin = np.array(packet["origin"])
  triangles = []
  for mesh in packet["meshes"]:
    if mesh["kind"] != "city":
      continue
    assert mesh["positionType"] == "u16cm"
    vertices = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
    vertices = vertices.astype(float) * 0.01 + origin
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    triangles.extend(vertices[indices])
  ring = [[round(x + origin[0], 2), round(z + origin[2], 2)] for x, z in owner["ring"]]
  return packet, {**owner, "ring": ring}, np.array(triangles)


def edge(a: list, b: list, ids: list[int]) -> dict:
  a, b = np.array(a), np.array(b)
  tangent = (b - a) / np.linalg.norm(b - a)
  # The retained rings are clockwise in the world XZ plane.
  normal = np.array([-tangent[1], tangent[0]])
  return {"a": a.tolist(), "b": b.tolist(), "ids": ids, "normal": normal.tolist()}


def wall_polygon(e: dict, triangles: np.ndarray) -> Polygon:
  """Exact triangle support, not a box inferred from a nominal building height."""
  a = np.array(e["a"])
  n = np.array(e["normal"])
  t = np.array(e["b"]) - a
  t /= np.linalg.norm(t)
  xz = triangles[:, :, [0, 2]]
  coplanar = np.max(abs((xz - a) @ n), axis=1) < 0.0001
  polygons = []
  for tri in triangles[coplanar]:
    poly = Polygon([[(p[[0, 2]] - a) @ t, p[1]] for p in tri])
    if poly.area > 0.001:
      polygons.append(poly)
  return unary_union(polygons)


def build() -> tuple[dict, dict]:
  drawn_packet, drawn_owner, drawn_triangles = source("drawn")
  native_packet, native_owner, native_triangles = source("minecraft")
  assert not Polygon(drawn_owner["ring"]).exterior.is_ccw
  assert not Polygon(native_owner["ring"]).exterior.is_ccw
  drawn_edges = [edge(*drawn_owner["ring"][i : i + 2], [i]) for i in range(13)]
  # The already delivered south-west stepped frontage, then its southern return.
  # Merge collinear source steps only; no diagonal facade is rotated into native.
  native_edges = []
  for i in [*range(23), 24]:
    e = edge(*native_owner["ring"][i : i + 2], [i])
    if (
      native_edges
      and native_edges[-1]["b"] == e["a"]
      and native_edges[-1]["normal"] == e["normal"]
    ):
      native_edges[-1]["b"] = e["b"]
      native_edges[-1]["ids"] += e["ids"]
    else:
      native_edges.append(e)
  rows, blocks, receipts, native_receipts = [], [], [], []
  for family, edges, triangles in [
    ("drawn", drawn_edges, drawn_triangles),
    ("minecraft", native_edges, native_triangles),
  ]:
    for e in edges:
      e["support"] = wall_polygon(e, triangles)
      assert not e["support"].is_empty, e

    def put(
      e: dict,
      u: float,
      y: float,
      w: float,
      h: float,
      offset: float,
      depth: float,
      color: int,
      kind: str,
    ) -> None:
      a, b, n = np.array(e["a"]), np.array(e["b"]), np.array(e["normal"])
      t = (b - a) / np.linalg.norm(b - a)
      assert (
        e["support"]
        .buffer(0.0002)
        .covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
      ), (family, e["ids"], kind)
      p = a + t * u + n * offset
      if family == "drawn":
        row = [p[0], y, p[1], w, h, depth, math.atan2(-t[1], t[0]), color]
        target, records = rows, receipts
      else:
        row = [
          p[0],
          y,
          p[1],
          abs(t[0]) * w + abs(n[0]) * depth,
          h,
          abs(t[1]) * w + abs(n[1]) * depth,
          color,
        ]
        target, records = blocks, native_receipts
      target.append([round(float(v), 5) for v in row[:-1]] + [color])
      records.append({"edge": edges.index(e), "u": round(u, 6), "kind": kind})

    def window(e: dict, u: float, y: float, w: float, h: float) -> None:
      put(e, u, y, w, h, 0.065, 0.04, FRAME, "frame")
      put(e, u, y, w - 0.18, h - 0.18, 0.13, 0.035, GLASS, "glass")
      put(e, u, y, 0.075, h - 0.18, 0.19, 0.04, FRAME, "mullion")

    # Source-following plinth separation and eave line. Drawn's additional band
    # articulates the wider first upper floor, without touching the old shops.
    bands = [(7.55, 0.24), (25.6, 0.24)]
    if family == "drawn":
      bands += [(12.15, 0.18)]
    for e in edges:
      length = math.dist(e["a"], e["b"])
      for y, h in bands:
        put(e, length / 2, y, length - 0.012, h, 0.12, 0.16, CORNICE, "cornice")

    if family == "drawn":
      # Seven bays on the long wall; three and one on the two southern returns.
      for e, count in [(edges[0], 7), (edges[11], 3), (edges[12], 1)]:
        length = math.dist(e["a"], e["b"])
        for i in range(count):
          for floor, (y, h) in enumerate(FLOORS):
            window(e, (i + 0.5) * length / count, y, 1.95 if floor == 0 else 1.45, h)
      # Two window bays wrap the original ten curved corner facets. Glass/frame
      # strips are clipped to each full source plane; no chord crosses the curve.
      arc = edges[1:11]
      lengths = [math.dist(e["a"], e["b"]) for e in arc]
      starts = np.cumsum([0, *lengths[:-1]])
      for fraction in [0.28, 0.72]:
        center = sum(lengths) * fraction
        for floor, (y, h) in enumerate(FLOORS):
          width = 1.8 if floor == 0 else 1.45
          for e, start, length in zip(arc, starts, lengths):
            for half, off, dep, col, kind in [
              (width / 2, 0.065, 0.04, FRAME, "frame"),
              ((width - 0.18) / 2, 0.13, 0.035, GLASS, "glass"),
            ]:
              lo, hi = (
                max(start + 0.004, center - half),
                min(start + length - 0.004, center + half),
              )
              if hi > lo:
                put(
                  e,
                  (lo + hi) / 2 - start,
                  y,
                  hi - lo,
                  h if kind == "frame" else h - 0.18,
                  off,
                  dep,
                  col,
                  kind,
                )
            if start + 0.04 < center < start + length - 0.04:
              put(e, center - start, y, 0.075, h - 0.18, 0.19, 0.04, FRAME, "mullion")
    else:
      # Native west-facing runs have independent, integer-meter supports. Seven
      # selected runs retain the register without hanging panes across steps.
      west = [e for e in edges if e["normal"] == [-1.0, 0.0]]
      selected = [west[i] for i in [0, 2, 3, 4, 6, 7, 8]]
      south = next(e for e in edges if math.dist(e["a"], e["b"]) == 16)
      native_windows = [(e, math.dist(e["a"], e["b"]) / 2) for e in selected]
      native_windows += [(south, u) for u in [3, 8, 13]]
      for e, u in native_windows:
        for floor, (y, h) in enumerate(FLOORS):
          window(e, u, y, 1.6 if floor == 0 else 1.25, h)

  for edges in [drawn_edges, native_edges]:
    for e in edges:
      del e["support"]
  data = {"version": 248, "boxes": rows, "nativeRows": blocks}
  assert len(rows) * 76 <= 18_000, len(rows)
  assert len(blocks) * 76 <= 13_000, len(blocks)
  evidence = {
    "owner": OWNER,
    "address": "Albrechtstraße 131 / Düppelstraße",
    "heritage": {
      "id": "09065472",
      "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065472",
      "credit": "Landesdenkmalamt Berlin; identity: Wohn- und Geschäftshaus, 1911–1913, F. Gericke",
    },
    "photograph": {
      "url": "https://commons.wikimedia.org/wiki/File:130420-Steglitz-Albrechtstra%C3%9Fe-131-Ehlers-Platz.JPG",
      "author": "Muns",
      "date": "2013-04-20",
      "license": "CC-BY-SA-3.0",
      "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
      "use": "Reference-only recognition; no image pixels bundled or loaded.",
    },
    "sourceCredit": "Geoportal Berlin / Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen: 3D-Gebäudemodell LoD2; dl-de/zero-2-0. Existing v182 packet walls are the geometric support.",
    "estimates": "Window bay divisions, fittings, shades and elevations are visual estimates from one 2013 photograph, not surveyed apertures. This is a restrained upper-floor recognition addition, not a reconstructed shopfront or roof.",
    "preservedSha256": {
      str(p.relative_to(ROOT)): sha(p)
      for p in [
        DATA / "steglitzV182Source.json",
        DATA / "steglitzV182Native.json",
        DATA / "steglitzV246Details.json",
        DATA / "hermannEhlersV247Details.json",
        DATA / "schlossstrasseV247Details.json",
      ]
    },
    "packetSha256": {
      str((PUBLIC / f"ring182--7_13.{f}.json.gz").relative_to(ROOT)): h
      for f, h in PACKETS.items()
    },
    "families": {
      "drawn": {
        "groundY": drawn_packet["nav"]["groundY"],
        "owner": drawn_owner,
        "edges": drawn_edges,
        "rows": receipts,
      },
      "minecraft": {
        "groundY": native_packet["nav"]["groundY"],
        "owner": native_owner,
        "edges": native_edges,
        "rows": native_receipts,
      },
    },
    "counts": {
      "drawnRows": len(rows),
      "nativeRows": len(blocks),
      "drawnInstanceBytes": len(rows) * 76,
      "nativeInstanceBytes": len(blocks) * 76,
    },
    "camera": {"eye": [-3445, 140, 6890], "target": [-3500, 3.025, 6815]},
  }
  return data, evidence


def main() -> None:
  data, evidence = build()
  OUT.write_text(json.dumps(data, separators=(",", ":")) + "\n")
  EVIDENCE.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")
  print(json.dumps(evidence["counts"]))


if __name__ == "__main__":
  main()
