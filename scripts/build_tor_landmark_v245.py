"""One evidenced Jugendstil front at Torstraße 138; all older packets immutable.

LDA photo 09080095a (1999) is a reference only, never a texture. The measured
parent, three complete parts, roofs/courts and existing 1.66 m placement survive.
Small facade dimensions and warm neutral material tones are display estimates.
"""

from __future__ import annotations

import base64
import hashlib
import json
from collections import Counter
from pathlib import Path

import numpy as np
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_stadthaus_v239 import read, sha, write
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "tor-landmark-v245-source.json.gz"
EVIDENCE = GEO / "tor-landmark-v245-evidence.json"
ADDITION = GEO / "tor-landmark-v245-manifest-addition.json"
OWNER = "DEBE01YYK00007I6"
PART = "DEBE3DbALrqZAA3i"
KIND = "tor-landmark-v245"
POLICY = (
  "Only the exact retained Torstraße138 street wall: photo-evidenced three-storey "
  "bay, open lateral balconies, grouped divided windows, high rusticated plinth "
  "and principal cornices. Keep every original source surface, roof, court, packet "
  "and navigation unchanged. No guessed replacement roof or gable mass, no shop "
  "names from the historic photo. Dimensions/tones are display estimates. Full "
  "drawn mobile detail and independent axis-aligned native construction use the "
  "existing cancellable bounded packet lifetime."
)
PLASTER = (218, 212, 196)
STONE = (201, 193, 174)
EDGE = (228, 222, 205)
SHADOW = (166, 157, 140)
GLASS = (123, 147, 150)
REFLECT = (166, 181, 177)
FRAME = (235, 231, 217)
WOOD = (112, 91, 72)


def decode(path):
  packet = read(path)
  mesh = next(m for m in packet["meshes"] if m["kind"] == "mitte-street-fronts-v166")
  points = (
    np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(-1, 3) / 100
    + packet["origin"]
  )
  ids = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
  return points[ids]


def digest_triangles(tris):
  keys = sorted(
    tuple(sorted(tuple(int(round(v * 100)) for v in p) for p in tri)) for tri in tris
  )
  return hashlib.sha256(json.dumps(keys, separators=(",", ":")).encode()).hexdigest()


def extract():
  old_path = GEO / "mitte-streets-v166.json"
  complete_path = GEO / "alt-mitte-v169/source-391_5821-00.json.gz"
  old = read(old_path)
  b = next(b for b in old["buildings"] if b["id"] == OWNER)
  complete = next(b for b in read(complete_path)["buildings"] if b["id"] == OWNER)
  assert complete["osmTags"]["osm_way_id"] == "386915734"
  assert complete["osmTags"]["ref:lda"] == "09080095"
  part = next(p for p in b["parts"] if p["id"] == PART)
  wall = part["surfaces"][3]
  assert wall["kind"] == "WallSurface"
  offset_path = ROOT / "src/app/src/data/weinbergBuildingOffsetsV176.json"
  offset = read(offset_path)["offsets"][OWNER]
  assert offset == 1.66
  # Screen-left is east when looking south from Torstraße.
  a, end = np.array(wall["rings"][0][2]), np.array(wall["rings"][0][3])
  tangent = end - a
  width = np.linalg.norm(tangent)
  tangent /= width
  normal = np.cross(tangent, [0, 1, 0])
  a[1] += offset
  tri = decode(OUT / "3_-3.drawn.json.gz")
  dist = (tri - a) @ normal
  drawn = tri[
    (np.max(np.abs(dist), axis=1) < 0.012)
    & (tri[:, :, 0].min(1) >= 1916.35)
    & (tri[:, :, 0].max(1) <= 1931.18)
  ]
  assert len(drawn) == 2
  native = decode(OUT / "3_-3.minecraft.json.gz")
  # Receipt the actual delivered orthogonal native wall, not the diagonal source.
  native = native[
    np.all(np.abs(native[:, :, 2] + 1126) < 0.001, axis=1)
    & (native[:, :, 0].min(1) >= 1916)
    & (native[:, :, 0].max(1) <= 1932)
    & (native[:, :, 1].min(1) >= 4.65)
    & (native[:, :, 1].max(1) <= 24.67)
  ]
  support = unary_union([Polygon([(p[0], p[1]) for p in t]) for t in native])
  assert support.buffer(1e-7).covers(box(1916.36, 4.66, 1931.17, 24.2))
  receipts = {
    str((OUT / f"3_-3.{mode}.json.gz").relative_to(ROOT)): sha(
      OUT / f"3_-3.{mode}.json.gz"
    )
    for mode in ("drawn", "minecraft")
  }
  # Previous ordinary fronts are separate: this parent already has sixteen
  # Linienstraße panes, but none on the Torstraße wall being refined here.
  for basename in ("north-mitte-fronts-v239", "tor-fronts-v244"):
    src = read(GEO / f"{basename}-source.json.gz")
    assert not any(
      w["owner"] == OWNER and w["center"][2] < -1124 for w in src["windows"]
    )
    for d in read(GEO / f"{basename}-manifest-addition.json")["chunks"]:
      for mode in ("drawn", "minecraft"):
        path = OUT / d[mode]["url"]
        receipts[str(path.relative_to(ROOT))] = sha(path)
  data = dict(
    schemaVersion=1,
    policy=POLICY,
    owner=OWNER,
    osmWay="386915734",
    lda="09080095",
    retainedParent=b,
    completeSource=complete,
    streetWall=wall,
    terrainOffsetY=offset,
    frame=dict(
      origin=a.tolist(), tangent=tangent.tolist(), normal=normal.tolist(), width=width
    ),
    nativeFront=dict(
      z=-1126,
      xMin=1916.36,
      xMax=1931.17,
      receipt=digest_triangles(native),
      triangles=native.tolist(),
    ),
    drawnWallReceipt=digest_triangles(drawn),
    drawnWallTriangles=drawn.tolist(),
    sourceHashes={
      str(p.relative_to(ROOT)): sha(p)
      for p in (
        old_path,
        complete_path,
        offset_path,
        GEO / "north-mitte-fronts-v239-source.json.gz",
        GEO / "tor-fronts-v244-source.json.gz",
      )
    },
    unchangedPackets=receipts,
    references=[
      dict(
        url="https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080095",
        credit="Landesdenkmalamt Berlin",
        use="Primary architectural description: five-storey Tor front, three-storey bay, balconies, rustication and cornices.",
      ),
      dict(
        url="https://denkmaldatenbank.berlin.de/media/uploads/Mit/03/09080095a.jpg",
        credit="LDA 1999; photographer not stated on the record",
        use="Reference-only facade proportions: bay left of centre, open balconies to its right, paired lateral and tripartite bay windows. No pixels redistributed or sampled.",
      ),
    ],
    licences=old["licences"],
    limitations=[
      "LoD2 does not resolve the photographed double gable; its exact roof envelope is preserved instead of inventing new roofs.",
      "Small depths, fitting dimensions, window subdivisions and warm neutral tones are visual estimates from a historic monochrome view, not measured or current tenant information.",
    ],
  )
  write(SOURCE, data)
  return data


class Front:
  def __init__(self, source, native):
    self.detail = Detail()
    self.native = native
    f = source["frame"]
    self.width = f["width"]
    self.ground = f["origin"][1]
    self.origin = np.asarray(f["origin"])
    self.t = np.asarray(f["tangent"])
    self.n = np.asarray(f["normal"])
    if native:
      self.origin = np.array(
        [source["nativeFront"]["xMax"], self.ground, source["nativeFront"]["z"]]
      )
      self.width = source["nativeFront"]["xMax"] - source["nativeFront"]["xMin"]
      self.t = np.array([-1, 0, 0])
      self.n = np.array([0, 0, -1])

  def point(self, u, y, out=0):
    return (self.origin + self.t * u + self.n * out + [0, y, 0]).tolist()

  def face(self, coords, color, role):
    self.detail.polygon([self.point(*p) for p in coords], color, role)

  def panel(self, u, y, width, height, out, color, role):
    self.face(
      [
        (u - width / 2, y - height / 2, out),
        (u + width / 2, y - height / 2, out),
        (u + width / 2, y + height / 2, out),
        (u - width / 2, y + height / 2, out),
      ],
      color,
      role,
    )

  def block(self, u, y, width, height, low, high, color, role):
    # Separate native uses exact axis-aligned boxes on the delivered native plane.
    if self.native:
      self.detail.box(
        self.point(u, y, (low + high) / 2), [width, height, high - low], color, role
      )
      return
    p = [
      (u - width / 2, y - height / 2),
      (u + width / 2, y - height / 2),
      (u + width / 2, y + height / 2),
      (u - width / 2, y + height / 2),
    ]
    self.face([(x, h, high) for x, h in p], color, role)
    for i in range(4):
      j = (i + 1) % 4
      self.face(
        [(*p[i], low), (*p[j], low), (*p[j], high), (*p[i], high)],
        SHADOW if i in (0, 1) else color,
        role,
      )

  def window(self, u, y, width, height, out, divisions, role="grouped-window"):
    self.block(
      u,
      y,
      width + 0.20,
      height + 0.20,
      out - 0.015,
      out + 0.045,
      EDGE,
      role + "-surround",
    )
    # Keep several centimetres between visible layers: packed coordinates use
    # centimetres and sub-centimetre offsets collapse into coplanar triangles.
    self.panel(u, y, width, height, out + 0.075, GLASS, role + "-glazing")
    self.panel(
      u,
      y + height * 0.30,
      width - 0.05,
      height * 0.25,
      out + 0.10,
      REFLECT,
      role + "-upper-reflection",
    )
    for i in range(1, divisions):
      self.block(
        u - width / 2 + width * i / divisions,
        y,
        0.055,
        height,
        out + 0.12,
        out + 0.16,
        FRAME,
        role + "-mullion",
      )
    self.block(
      u,
      y + height * 0.17,
      width,
      0.06,
      out + 0.12,
      out + 0.16,
      FRAME,
      role + "-transom",
    )
    self.block(
      u,
      y - height / 2 - 0.10,
      width + 0.34,
      0.12,
      out - 0.03,
      out + 0.19,
      EDGE,
      role + "-sill",
    )

  def motif(self, u, y, out):
    # Discrete low relief floral rhythm; not a purported reproduction of sculpted heads.
    self.block(u, y, 1.05, 0.11, out, out + 0.045, EDGE, "stylised-relief-stem")
    for dx, dy in [(-0.36, 0.17), (-0.18, -0.16), (0.18, -0.16), (0.36, 0.17)]:
      self.block(
        u + dx, y + dy, 0.14, 0.15, out, out + 0.065, EDGE, "stylised-floral-relief"
      )


def model(source, native):
  f = Front(source, native)
  w = f.width
  # Skin only the confirmed previously bare source wall; all complete bodies remain.
  f.panel(w / 2, 9.66, w - 0.06, 19.32, 0.018, PLASTER, "source-bound-front-finish")
  f.panel(w / 2, 3.80, w - 0.07, 7.60, 0.031, STONE, "two-storey-rusticated-plinth")
  # Photographed bay occupies first through third upper storeys, off-centre left.
  bay, baywidth, depth = 5.55, 4.10, 0.88
  f.block(bay, 9.87, baywidth, 11.86, 0.035, depth, PLASTER, "three-storey-erker")
  # Horizontal joints stop at the bay edges, avoiding new strokes over glass.
  for y in np.arange(0.45, 7.62, 0.49):
    for lo, hi, out in [
      (0.06, bay - baywidth / 2, 0.050),
      (bay - baywidth / 2, bay + baywidth / 2, depth + 0.012),
      (bay + baywidth / 2, w - 0.06, 0.050),
    ]:
      if y < 3.94 and out > 0.1:
        out = 0.050
      f.panel((lo + hi) / 2, float(y), hi - lo, 0.026, out, SHADOW, "rustication-joint")
  # The main bands unify second+third upper floors; deep returns expose the bay.
  for y, h, d in [
    (3.85, 0.15, 0.17),
    (7.78, 0.20, 0.26),
    (15.82, 0.25, 0.30),
    (19.37, 0.18, 0.22),
  ]:
    f.block(w / 2, y, w - 0.04, h, 0.03, d, EDGE, "principal-horizontal-cornice")
    if y <= 15.83 and y >= 3.8:
      f.block(
        bay, y, baywidth + 0.18, h + 0.03, 0.03, depth + d, EDGE, "erker-cornice-return"
      )
  # Three elevated open balconies: clear undercroft and empty air above parapets.
  for y in (7.84, 11.77, 15.84):
    f.block(9.28, y, 3.30, 0.18, 0.04, 1.16, STONE, "open-balcony-slab")
    f.block(9.28, y + 0.73, 3.27, 0.86, 0.97, 1.10, STONE, "balcony-parapet")
    f.block(9.28, y + 1.20, 3.45, 0.11, 0.94, 1.20, EDGE, "balcony-coping")
    for u in (7.70, 10.86):
      f.block(u, y + 0.73, 0.11, 0.86, 0.04, 1.12, STONE, "balcony-side-parapet")
    for u in (8.15, 8.70, 9.25, 9.80, 10.35):
      f.block(u, y + 0.75, 0.12, 0.50, 1.105, 1.145, EDGE, "balcony-relief-upright")
  # Four upper storeys from the reference photograph, not the OSM four-level tag
  # (which belongs to the separate Linienstraße wing of this complete parent).
  for floor, y in enumerate((5.86, 9.79, 13.72, 17.65)):
    for u in (2.10, 12.63):
      f.window(u, y, 2.20, 2.36, 0.08, 2, "paired-side-window")
    f.window(
      bay,
      y,
      2.55 if floor < 3 else 2.24,
      2.36,
      depth + 0.035 if floor < 3 else 0.08,
      3 if floor < 3 else 2,
      "erker-window" if floor < 3 else "upper-window",
    )
    f.window(9.28, y, 1.55 if floor > 0 else 1.85, 2.30, 0.08, 2, "balcony-rear-window")
    if floor in (1, 2, 3):
      for u in (2.10, 12.63):
        f.motif(u, y - 1.70, 0.08)
      if floor < 3:
        f.motif(bay, y - 1.70, depth + 0.035)
  # Ground-floor bays and the photograph's recessed entrance under the erker.
  # Door remains a drawn closed surface: there is no invented walk-through hole.
  for u, width in [(2.10, 2.30), (9.32, 2.85), (12.63, 2.2)]:
    f.window(u, 1.75, width, 2.75, 0.075, 2, "ground-shopfront")
  f.block(bay, 1.60, 2.24, 3.15, 0.04, 0.08, WOOD, "existing-entrance-panel")
  for u in (bay - 0.96, bay + 0.96):
    f.block(u, 1.62, 0.10, 3.03, 0.08, 0.14, EDGE, "entrance-jamb")
  f.block(bay, 2.60, 1.98, 0.08, 0.08, 0.13, EDGE, "entrance-transom")
  f.block(bay + 0.72, 1.42, 0.06, 0.36, 0.13, 0.19, EDGE, "entrance-handle")
  # First-upper-storey segmental heads, rendered as orthogonal stepped voussoirs
  # natively, with no diagonal native faces copied from the drawn form.
  for u, width, out in [
    (2.10, 2.2, 0.15),
    (bay, 2.55, depth + 0.12),
    (9.28, 1.85, 0.15),
    (12.63, 2.2, 0.15),
  ]:
    for dx in np.linspace(-width / 2, width / 2, 11):
      rise = 0.28 * (1 - (dx / (width / 2)) ** 2)
      f.block(
        float(u + dx),
        float(7.13 + rise),
        width / 11 + 0.01,
        0.09,
        out,
        out + 0.08,
        EDGE,
        "segmental-window-head",
      )
  return f.detail


def build():
  source = read(SOURCE) if SOURCE.exists() else extract()
  for path, digest in {**source["sourceHashes"], **source["unchangedPackets"]}.items():
    assert sha(ROOT / path) == digest, path
  desc = dict(
    id="torlandmark245-3_-3",
    detailCompanionOf="3_-3",
    bounds=[1536, -1536, 2048, -1024],
  )
  counts = {}
  roles = {}
  for mode in ("drawn", "minecraft"):
    detail = model(source, mode == "minecraft")
    mesh = packed_detail(detail, box(*desc["bounds"]))
    assert mesh
    mesh["kind"] = KIND
    payload = dict(
      schemaVersion=1,
      id=desc["id"],
      origin=[1536, -10, -1536],
      meshes=[mesh],
      nav=dict(groundY=3, ground=[], water=[], buildings=[]),
    )
    p = OUT / f"{desc['id']}.{mode}.json.gz"
    write(p, payload)
    desc[mode] = dict(
      url=p.name,
      encoding="gzip",
      bytes=p.stat().st_size,
      decodedBytes=len(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
      )
      + 1,
      sha256=sha(p),
    )
    nv = len(base64.b64decode(mesh["positions"])) // 6
    ni = len(base64.b64decode(mesh["indices"])) // 4
    counts[mode] = dict(
      vertices=nv, triangles=ni // 3, gpuBytes=nv * 12 + ni * (2 if nv <= 65535 else 4)
    )
    roles[mode] = dict(Counter(role for _, _, role in detail.triangles))
  write(
    ADDITION,
    dict(
      schemaVersion=1,
      version="1.0.145",
      chunks=[desc],
      source=dict(sourceSha256=sha(SOURCE), policy=POLICY),
    ),
  )
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      policy=POLICY,
      owner=OWNER,
      sourceSha256=sha(SOURCE),
      additionSha256=sha(ADDITION),
      packetCounts=counts,
      roles=roles,
      sourceHashes=source["sourceHashes"],
      unchangedPackets=source["unchangedPackets"],
      references=source["references"],
      limitations=source["limitations"],
    ),
  )
  print(
    json.dumps(
      dict(chunks=1, bytes={m: desc[m]["bytes"] for m in counts}, geometry=counts),
      indent=2,
    )
  )


if __name__ == "__main__":
  build()
