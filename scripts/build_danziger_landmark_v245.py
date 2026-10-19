"""Step 10: photo-guided Danziger57 fittings on complete retained street walls."""

from __future__ import annotations

import gzip
import json
from collections import Counter

import build_district_facades_v188 as base
import numpy as np
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon
from shapely.strtree import STRtree

GEO, OUT = base.GEO, base.OUT
SOURCE = GEO / "danziger-landmark-v245-source.json.gz"
EVIDENCE = GEO / "danziger-landmark-v245-evidence.json"
ADDITION = GEO / "danziger-landmark-v245-manifest-addition.json"
OWNER = "DEBE03YY60000CKO"
PARENT = "6_-5"
IDENTITY = "danzigerlandmark245-6_-5"
KIND = "danziger-landmark-v245"
POLICY = (
  "One exact existing Danziger57 owner. Preserve every old packet, wall, roof "
  "and navigation solid. Shallow photo-guided red upper brick, cream rustication, "
  "storey bands, window surrounds and pediments follow complete actual source "
  "street walls. Opening and ornament dimensions remain display estimates. "
  "No roof/tower replacement, inferred historical volume, new coverage or "
  "live-budget change. Native fittings use independent actual orthogonal walls."
)
REFERENCES = [
  {
    "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075102",
    "role": "Primary heritage identity, address and architect; 1893–94 Eugen Reethen corner house and later workshop.",
  },
  {
    "url": "https://commons.wikimedia.org/wiki/File:Danziger_Straße_57_(Berlin-Prenzlauer_Berg).jpg",
    "title": "Danziger Straße 57 (Berlin-Prenzlauer Berg).jpg",
    "author": "Bodo Kubrak",
    "date": "2016-06-20",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
    "role": "Original post-restoration photograph, reference only. Red upper brick, light stone/plaster base, pilasters, layered cornices, contrasting window surrounds and triangular pediments guide independent procedural fittings; no image or texture is distributed.",
  },
]


def extract() -> dict:
  """Freeze exact complete source walls independently in both existing families."""
  old = base.read_json(GEO / "danziger-fronts-v244-source.json.gz")
  assert not any(f["owner"] == OWNER for f in old["faces"])
  mapped = next(b for b in old["sourceBuildings"] if b["id"] == "41724936")
  manifest = base.read_json(OUT / "manifest.json")
  descriptor = next(d for d in manifest["chunks"] if d["id"] == PARENT)
  receipts, families = {}, {}
  for d in manifest["chunks"]:
    if d["id"] in (PARENT, "kiez209-6_-5") or d["id"].startswith("danzigerfront244-"):
      for mode in ("drawn", "minecraft"):
        receipts[d[mode]["url"]] = base.digest(OUT / d[mode]["url"])
  packets = {
    mode: base.read_json(OUT / descriptor[mode]["url"])
    for mode in ("drawn", "minecraft")
  }
  for mode, packet in packets.items():
    b = next(b for b in packet["nav"]["buildings"] if b["sourceId"] == OWNER)
    ox, oy, oz = packet["origin"]
    lo = packet["nav"]["groundY"] + b["minHeight"] + b.get("groundOffset", 0)
    hi = packet["nav"]["groundY"] + b["height"] + b.get("groundOffset", 0)
    poly = translate(Polygon(b["ring"], b["holes"]), ox, oz)
    triangles = base.mesh_wall_triangles(packet)
    occupied = STRtree(
      [
        translate(Polygon(other["ring"], other["holes"]), ox, oz)
        for other in packet["nav"]["buildings"]
        if other["sourceId"] != OWNER
      ]
    )
    faces = []
    for index, (a, z) in enumerate(zip(b["ring"], b["ring"][1:] + b["ring"][:1])):
      if not base.source_wall_exists(triangles, a, z, lo - oy, hi - oy):
        continue
      a, z = np.array(a) + [ox, oz], np.array(z) + [ox, oz]
      line = LineString([a, z])
      width = line.length
      if width < 1.8:
        continue
      d = (z - a) / width
      n = np.array([-d[1], d[0]])
      if poly.covers(Point((a + z) / 2 + n * 0.3)):
        n = -n
      if mode == "drawn":
        if index not in (0, 1, 2, 3, 13):
          continue
        group = "corner" if index == 0 else "danziger" if index == 13 else "senefelder"
      else:
        assert a[0] == z[0] or a[1] == z[1]
        candidates = [
          f
          for f in families["drawn"]["faces"]
          if np.dot(n, f["normal"]) > 0.50
          and line.distance(LineString([f["a"], f["b"]])) < 1.7
          and LineString([f["a"], f["b"]]).buffer(1.8, cap_style=2).covers(line)
        ]
        if not candidates:
          continue
        nearest = min(
          candidates,
          key=lambda f: LineString([f["a"], f["b"]]).distance(
            line.interpolate(0.5, normalized=True)
          ),
        )
        group = nearest["group"]
      outward = LineString([a + n * 0.22, z + n * 0.22])
      if len(occupied.query(outward, predicate="intersects")):
        continue
      faces.append(
        {
          "owner": OWNER,
          "a": a.tolist(),
          "b": z.tolist(),
          "normal": n.tolist(),
          "low": lo,
          "high": hi,
          "group": group,
          "sourceEdge": index,
        }
      )
    families[mode] = {"origin": packet["origin"], "sourceBuilding": b, "faces": faces}
  assert len(families["drawn"]["faces"]) == 5
  assert len(families["minecraft"]["faces"]) >= 10
  result = {
    "schemaVersion": 1,
    "policy": POLICY,
    "owner": OWNER,
    "mappedSource": mapped,
    "parent": descriptor,
    "families": families,
    "packetReceipts": receipts,
    "previousSourceSha256": base.digest(GEO / "danziger-fronts-v244-source.json.gz"),
    "references": REFERENCES,
  }
  base.write_json(SOURCE, result)
  return result


class Front:
  """Shallow detail coordinates, always clipped to one original source wall."""

  def __init__(self, mesh: base.FacadeMesh, face: dict, native: bool) -> None:
    self.mesh, self.face, self.native = mesh, face, native
    self.a, self.b = np.array(face["a"]), np.array(face["b"])
    self.width = float(np.linalg.norm(self.b - self.a))
    self.d = (self.b - self.a) / self.width
    self.n = np.array(face["normal"])
    self.low, self.height = face["low"], face["high"] - face["low"]
    self.count = Counter()

  def pane(
    self, u: float, y: float, w: float, h: float, depth: float, colour: tuple
  ) -> None:
    """Clip small flat fitting to the measured finite face, including cm tolerance."""
    left, right = max(0.03, u - w / 2), min(self.width - 0.03, u + w / 2)
    bottom, top = max(0.02, y - h / 2), min(self.height - 0.02, y + h / 2)
    if right - left < 0.025 or top - bottom < 0.025:
      return
    self.mesh.pane(
      self.a,
      self.d,
      self.n,
      (left + right) / 2,
      self.low + (bottom + top) / 2,
      right - left,
      top - bottom,
      depth,
      colour,
    )
    self.count["quads"] += 1

  def band(self, y: float, h: float, depth: float, colour: tuple) -> None:
    self.pane(self.width / 2, y, self.width, h, depth, colour)

  def pediment(self, u: float, y: float, width: float) -> None:
    """Original modest cap; native cap consists solely of orthogonal steps."""
    if self.native:
      for level in range(4):
        self.pane(
          u, y + level * 0.15, width * (1 - level * 0.22), 0.16, 0.24, (235, 224, 201)
        )
    else:
      # Six shallow flat crest strips give a light triangular crown silhouette.
      for level in range(6):
        self.pane(
          u, y + level * 0.105, width * (1 - level * 0.16), 0.12, 0.24, (235, 224, 201)
        )
    self.count["pediments"] += 1

  def window(self, u: float, y: float, row: int, w: float) -> None:
    """Photo-led floor hierarchy; no private occupant, shop name or entrance claim."""
    ph = 2.65 if row < 4 else 2.35
    if row == 0:
      ph = 2.80
    stone = (226, 216, 192)
    shadow = (183, 171, 145)
    white = (231, 229, 209)
    self.pane(u, y, w + 0.46, ph + 0.36, 0.09, shadow)
    self.pane(u, y, w, ph, 0.12, (103, 134, 143))
    for sign in (-1, 1):
      self.pane(u + sign * (w / 2 + 0.075), y, 0.15, ph + 0.24, 0.14, stone)
      self.pane(u, y + sign * (ph / 2 + 0.09), w + 0.30, 0.18, 0.15, stone)
    self.pane(u, y, w * 0.045, ph, 0.16, white)
    self.pane(u, y + ph * 0.20, w, 0.07, 0.16, white)
    self.pane(u, y - ph / 2 - 0.20, w + 0.55, 0.20, 0.21, (207, 194, 162))
    if row in (2, 3):
      # Pilaster caps and repeated sill relief, not a filled projecting balcony.
      for sign in (-1, 1):
        self.pane(u + sign * (w / 2 + 0.24), y, 0.16, ph + 0.30, 0.17, stone)
        self.pane(u + sign * (w / 2 + 0.24), y + ph / 2 + 0.25, 0.34, 0.16, 0.20, stone)
      self.pane(u, y - ph / 2 - 0.47, w + 0.38, 0.22, 0.16, (217, 207, 182))
    if row == 3:
      self.pediment(u, y + ph / 2 + 0.29, w + 0.68)
    if row == 4:
      self.pane(u, y + ph / 2 + 0.22, w + 0.42, 0.17, 0.18, stone)
      self.pane(u, y + ph / 2 + 0.38, 0.34, 0.28, 0.18, stone)
    self.count["windows"] += 1

  def build(self) -> Counter:
    """Distinct brick/stone hierarchy derived from the credited street view."""
    H = self.height
    stone = (221, 212, 188)
    # All underlying triangles and source roofs remain in the original packet.
    # Non-overlapping finish panels: sub-centimetre stacked layers collapse
    # onto the same plane in the packet's centimetre quantization.
    if self.face["group"] == "corner":
      self.pane(self.width / 2, H / 2, self.width, H, 0.030, (224, 215, 194))
    else:
      self.pane(self.width / 2, (H + 8.1) / 2, self.width, H - 8.1, 0.03, (148, 69, 50))
      self.pane(self.width / 2, 4.05, self.width, 8.10, 0.03, stone)
    # Base rustication and strong storey/cornice articulation.
    for y in np.arange(0.65, 8.0, 0.45):
      self.band(float(y), 0.045, 0.06, (183, 174, 153))
    for y, h in [
      (4.25, 0.34),
      (8.25, 0.28),
      (12.5, 0.26),
      (16.8, 0.32),
      (H - 0.7, 0.25),
      (H - 0.27, 0.34),
    ]:
      self.band(y, h, 0.18, stone)
      self.band(y - h * 0.55, 0.07, 0.21, (173, 160, 135))
    for x in (0.18, self.width - 0.18):
      self.pane(x, H / 2, 0.26, H - 0.8, 0.10, stone)
    columns = (
      1
      if self.face["group"] == "corner"
      else max(1, round(self.width / (2.80 if self.native else 3.05)))
    )
    margin = self.width / columns
    w = min(1.48 if not self.native else 1.22, margin - 0.65)
    for column in range(columns):
      u = (column + 0.5) * margin
      for row, y in enumerate([1.95, 6.15, 10.4, 14.65, 18.95]):
        self.window(u, y, row, w)
    # Dentils at the cornice remain thin and bounded, never a second roof.
    for u in np.arange(0.45, self.width - 0.2, 0.72):
      self.pane(float(u), H - 0.98, 0.20, 0.28, 0.16, (224, 213, 187))
    return self.count


def build() -> dict:
  """Write one new companion and receipts without altering any earlier asset."""
  s = base.read_json(SOURCE) if SOURCE.exists() else extract()
  for url, sha in s["packetReceipts"].items():
    assert base.digest(OUT / url) == sha, url
  desc = {"id": IDENTITY, "detailCompanionOf": PARENT, "bounds": s["parent"]["bounds"]}
  counts = {}
  for mode, family in s["families"].items():
    mesh = base.FacadeMesh(family["origin"])
    count = Counter()
    for face in family["faces"]:
      count.update(Front(mesh, face, mode == "minecraft").build())
    packet = {"id": IDENTITY, **mesh.payload()}
    packet["meshes"][0]["kind"] = KIND
    url = IDENTITY + "." + mode + ".json.gz"
    path = OUT / url
    base.write_json(path, packet)
    decoded = len(gzip.decompress(path.read_bytes()))
    assert decoded < 4 * 1024 * 1024 and len(mesh.positions) < 400000
    desc[mode] = {
      "url": url,
      "bytes": path.stat().st_size,
      "decodedBytes": decoded,
      "encoding": "gzip",
      "sha256": base.digest(path),
    }
    counts[mode] = {
      **count,
      "faces": len(family["faces"]),
      "vertices": len(mesh.positions),
      "geometryBytes": len(mesh.positions) * 12
      + len(mesh.indices) * (2 if len(mesh.positions) <= 65535 else 4),
      "transferBytes": path.stat().st_size,
    }
  evidence = {
    "schemaVersion": 1,
    "policy": POLICY,
    "owner": OWNER,
    "sourceSha256": base.digest(SOURCE),
    "counts": counts,
    "companions": [desc],
    "references": s["references"],
  }
  base.write_json(EVIDENCE, evidence)
  base.write_json(
    ADDITION,
    {"chunks": [desc], "danzigerLandmarkV245": {"policy": POLICY, "counts": counts}},
  )
  print(json.dumps(counts, indent=2))
  return evidence


if __name__ == "__main__":
  build()
