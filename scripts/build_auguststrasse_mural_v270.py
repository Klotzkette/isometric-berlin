"""One source-bound gable and hand-authored vector mural; never read image pixels."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import shapely
from shapely.affinity import scale, translate
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union

from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_surrounding_outlines import DEFAULT_OUTPUT, PackedMesh

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-390_5820-00.json.gz"
PRISMS = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
VOXELS = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
DATA = ROOT / "src/app/src/data/auguststrasseMuralV270.json"
PROFILE = ROOT / "src/app/src/data/auguststrasseMuralV270Profile.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/auguststrasse-mural-v270-evidence.json.gz"
OWNER, PRISM = "DEBE01YYK0000ArM", "97856098"
A, B = np.array([1288.403, -760.590]), np.array([1292.023, -746.563])
WIDTH = float(np.linalg.norm(B - A))
D = (B - A) / WIDTH
N = np.array([-D[1], D[0]])
BASE, HEIGHT, OFFSET, CELL = 5.2, 24.243 - 5.2, 0.27, 0.5
ORIGIN = [1280, -10, -770]


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def write(path: Path, value: dict) -> None:
  raw = (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def polys(value):
  return [
    p
    for p in getattr(value, "geoms", [value])
    if p.geom_type == "Polygon" and p.area > 1e-8
  ]


def roof_at(triangles: list, x: float, z: float) -> float | None:
  hits = []
  for a, b, c in triangles:
    den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
    if abs(den) < 1e-10:
      continue
    u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den
    v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den
    if min(u, v, 1 - u - v) >= -1e-7:
      hits.append(u * a[1] + v * b[1] + (1 - u - v) * c[1])
  return max(hits) if hits else None


def upper_clip(triangle: list, low: float) -> list:
  """Complete source polygon complement above the retained fallback roof."""
  out = []
  for p, q in zip(triangle, triangle[1:] + triangle[:1]):
    a, b = np.array(p), np.array(q)
    if a[1] >= low:
      out.append(a.tolist())
    if (a[1] < low) != (b[1] < low):
      out.append((a + (b - a) * ((low - a[1]) / (b[1] - a[1]))).tolist())
  return [[out[0], out[i], out[i + 1]] for i in range(1, len(out) - 1)]


def core_cornice_receipt(prism: dict) -> dict:
  """The single exact generic flat-roof cornice superseded by the measured gable."""
  a, b = np.array([1288.3, -760.8]), np.array([1291.9, -746.7])
  length = float(np.linalg.norm(b - a))
  axis = (b - a) / length
  normal = np.array([-axis[1], axis[0]])
  centre = (a + b) / 2
  cy = prism["y0_dm"] / 10 + prism["h_dm"] / 10 - 0.22 / 2 - 0.04

  def corner(u, y, v):
    xz = centre + axis * u * (length + 0.1) / 2 + normal * v * 0.48 / 2
    return np.array([xz[0], cy + y * 0.22 / 2, xz[1]], dtype=np.float32).tolist()

  quads = [
    [corner(-1, 1, -1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, 1, -1)],
    [corner(-1, -1, -1), corner(-1, 1, -1), corner(-1, 1, 1), corner(-1, -1, 1)],
    [corner(1, -1, -1), corner(1, -1, 1), corner(1, 1, 1), corner(1, 1, -1)],
    [corner(-1, -1, -1), corner(1, -1, -1), corner(1, 1, -1), corner(-1, 1, -1)],
    [corner(-1, -1, 1), corner(-1, 1, 1), corner(1, 1, 1), corner(1, -1, 1)],
  ]
  triangles = [t for a, b, c, d in quads for t in [[a, b, c], [a, c, d]]]
  edges = sorted(
    {
      tuple(sorted((tuple(p), tuple(q))))
      for quad in quads
      for p, q in zip(quad, quad[1:] + quad[:1])
    }
  )
  return dict(
    owner=PRISM,
    previousPrism=prism,
    wall=[[1288.3, -760.8], [1291.9, -746.7]],
    sourceRecipe="src/app/src/IsometricCityWorld.ts: generic facade cornice boxTriangles + EdgesGeometry",
    requiredReadyGate="options.tachelesFrontsV270",
    bodyHeight=15,
    corniceHeight=0.22,
    corniceDepth=0.48,
    centreY=cy,
    alongLength=length + 0.1,
    triangles=triangles,
    lineSegments=[[list(a), list(b)] for a, b in edges],
    replacement="Complete 82-triangle measured upper wall/roof complement and gable artwork; every other generic trim stays.",
  )


def gable_clearance_receipt() -> dict:
  """Replay only this old gable's v167 estimate, match its actual packed faces.

  No retirement: a measured minimal display clearance retains every old detail.
  """
  sys.path.insert(0, str(ROOT / "scripts"))
  from build_karl_marx_allee_v161 import Detail, packed_detail
  from build_oranien_corridors_v167 import core_ornament

  old_path = ROOT / "geo_data/regierungsviertel/oranien-corridors-v167.json"
  old = read(old_path)
  prism = next(p for p in old["retainedDetailedCorePrisms"] if p["id"] == PRISM)
  assert prism == next(p for p in read(PRISMS)["buildings"] if p["id"] == PRISM)
  roads = unary_union([shape(r["geometry"]) for r in old["roads"]])
  original = core_ornament(prism, roads)
  detail = Detail()
  for triangle, colour, role in original.triangles:
    xz = np.array(triangle)[:, [0, 2]]
    out, along = (xz - A) @ N, (xz - A) @ D
    if out.min() > 0 and out.max() < 0.4 and along.min() >= 0 and along.max() <= WIDTH:
      detail.triangles.append((triangle, colour, role))
  manifest = read(DEFAULT_OUTPUT / "manifest.json")
  descriptor = next(c for c in manifest["chunks"] if c["id"] == "2_-2")
  packet_path = DEFAULT_OUTPUT / descriptor["drawn"]["url"]
  packet = read(packet_path)

  def rows(mesh):
    points = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
    colour = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
    index = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    joined = np.concatenate([points.astype(np.int32), colour.astype(np.int32)], axis=1)
    return (
      points,
      index,
      [tuple(sorted(tuple(map(int, v)) for v in joined[t])) for t in index],
    )

  expected = Counter(rows(packed_detail(detail, box(*descriptor["bounds"])))[2])
  selected = []
  for mi, mesh in enumerate(packet["meshes"]):
    if mesh["kind"] != "oranien-corridors-v167":
      continue
    points, index, keys = rows(mesh)
    vertices = points.astype(float) / 100 + packet["origin"]
    for ti, key in enumerate(keys):
      if expected[key]:
        selected.append(
          dict(mesh=mi, triangle=ti, vertices=vertices[index[ti]].tolist())
        )
        expected[key] -= 1
  assert selected and not +expected
  max_out = max(
    float(np.max((np.array(t["vertices"])[:, [0, 2]] - A) @ N)) for t in selected
  )
  assert OFFSET == math.ceil((max_out + 0.01) * 100) / 100, max_out
  return dict(
    owner=PRISM,
    kind="oranien-corridors-v167",
    triangles=selected,
    sourceSha256=sha(old_path),
    packetSha256=sha(packet_path),
    sourcePath=str(old_path.relative_to(ROOT)),
    packetPath=str(packet_path.relative_to(ROOT)),
    exactMaximumOutwardM=max_out,
    minimumClearanceM=0.01,
    chosenOffsetM=OFFSET,
    policy="All original source details retained. Only the new mural moves by 3cm to clear the exact old gable ornaments.",
  )


def native_old_support() -> dict:
  """Exact same-owner v166 surface blocks, verified against the real native packet."""
  sys.path.insert(0, str(ROOT / "scripts"))
  from build_karl_marx_allee_v161 import native_detail, packed_detail
  from build_west_streets_v163 import core_detail

  source_path = ROOT / "geo_data/regierungsviertel/mitte-streets-v166.json"
  old = read(source_path)
  prism = next(p for p in old["corePrisms"] if p["id"] == PRISM)
  assert prism == next(p for p in read(PRISMS)["buildings"] if p["id"] == PRISM)
  detail = native_detail(
    core_detail(prism, unary_union([shape(r["geometry"]) for r in old["roads"]]))
  )
  cells = set()
  for triangle, _, _ in detail.triangles:
    a, b, c = np.array(triangle)
    normal = np.cross(b - a, c - a)
    normal /= np.linalg.norm(normal)
    inside = (a + b + c) / 3 - normal * 0.001 - np.array([0, 3, 0])
    cells.add(tuple(map(int, np.floor(inside / 2))))
  descriptor = next(
    c for c in read(DEFAULT_OUTPUT / "manifest.json")["chunks"] if c["id"] == "2_-2"
  )
  path = DEFAULT_OUTPUT / descriptor["minecraft"]["url"]
  packet = read(path)

  def keys(mesh):
    points = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
    colors = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
    ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    v = np.concatenate([points.astype(np.int32), colors.astype(np.int32)], axis=1)
    return [tuple(sorted(tuple(map(int, p)) for p in v[t])) for t in ix]

  expected = Counter(keys(packed_detail(detail, box(*descriptor["bounds"]))))
  indices = []
  for mi, mesh in enumerate(packet["meshes"]):
    if mesh["kind"] != "mitte-street-fronts-v166":
      continue
    for ti, k in enumerate(keys(mesh)):
      if expected[k]:
        indices.append([mi, ti])
        expected[k] -= 1
  assert indices and not +expected
  return dict(
    owner=PRISM,
    sourcePath=str(source_path.relative_to(ROOT)),
    sourceSha256=sha(source_path),
    packetPath=str(path.relative_to(ROOT)),
    packetSha256=sha(path),
    triangles=indices,
    cells=[list(c) for c in sorted(cells)],
    cellM=2,
    groundGridY=3,
    policy="Actual retained same-owner v166 native surface cells; additive paint only, no retirement.",
  )


def vector_art() -> list:
  """Deliberately stylised vector shapes drawn by hand after viewing user photos.

  Coordinates are composition units, not image pixels. No photograph is opened,
  traced, sampled, thresholded or converted by this generator.
  """
  layers = []

  def add(role, colour, geometry):
    layers.append(dict(role=role, colour=colour, geometry=geometry))

  def oval(role, colour, x, y, rx, ry):
    add(
      role, colour, translate(scale(Point(0, 0).buffer(1, quad_segs=12), rx, ry), x, y)
    )

  def polygon(role, colour, points):
    add(role, colour, Polygon(points))

  def stroke(role, colour, points, width):
    add(
      role,
      colour,
      LineString(points).buffer(
        width / 2, cap_style="round", join_style="round", quad_segs=3
      ),
    )

  add("dark-field", 0x1C2227, box(0, 0, 100, 100))
  polygon(
    "light-sky",
    0xBBDCE8,
    [(0, 65), (25, 65.7), (58, 66), (82, 65.2), (100, 66.3), (100, 100), (0, 100)],
  )
  # A few broad tunnel bands retain the light/dark composition without a
  # dense stipple, photo-derived pixel grid or shaded-face texture.
  for i, colour in enumerate([0x343D43, 0x434D53, 0x57646A, 0x68777D, 0x435057]):
    oval("tunnel-band", colour, 41, 39, 36 - i * 4.1, 28 - i * 3.5)
  oval("tunnel-centre", 0x263138, 42, 38, 15, 19)
  # Crossed legs, shoes and pale trouser folds.
  oval("leg-shadow", 0x111A20, 38, 17, 27, 7)
  polygon(
    "crossed-left-leg",
    0x727E82,
    [(17, 25), (28, 29), (48, 21), (60, 18), (59, 13), (45, 13), (29, 17), (18, 20)],
  )
  polygon(
    "crossed-right-leg",
    0x8C979A,
    [(38, 28), (52, 29), (62, 25), (66, 21), (61, 18), (41, 20), (29, 24)],
  )
  stroke("trouser-fold", 0x39464D, [(23, 23), (33, 22), (46, 17), (55, 16)], 0.9)
  stroke("trouser-fold", 0xB2BCBD, [(36, 26), (46, 24), (59, 23)], 0.65)
  oval("left-shoe", 0x333F46, 18, 18, 6.2, 3.1)
  oval("right-shoe", 0x525F66, 61, 15.5, 6.6, 3.7)
  stroke("shoe-sole", 0xC3CBC9, [(55, 13), (60, 12.2), (66, 13), (68, 15)], 0.8)
  for x in [58, 60, 62, 64]:
    stroke("shoe-laces", 0xC3CBC9, [(x, 17), (x + 1, 14.7)], 0.5)
  # Torso and one raised forearm; teddy sits in the other arm.
  polygon(
    "shirt-shadow",
    0x47545C,
    [(34, 29), (35, 42), (42, 47), (49, 46), (55, 40), (57, 32), (51, 25), (44, 23)],
  )
  polygon(
    "shirt-light",
    0x79878D,
    [(40, 42), (45, 46), (49, 44), (52, 38), (50, 30), (43, 28), (38, 32)],
  )
  stroke("shirt-fold", 0xB0B9B9, [(41, 39), (44, 34), (46, 31)], 0.65)
  polygon(
    "raised-arm",
    0x849399,
    [(48, 32), (54, 32), (58, 39), (60, 40), (62, 38), (59, 33), (56, 29), (50, 28)],
  )
  oval("balloon-hand", 0xC4CCCB, 59.3, 39, 2.1, 3.3)
  for y in [37.7, 39, 40.3]:
    stroke("finger", 0x58666C, [(58.6, y), (60.9, y + 0.6)], 0.42)
  # Neck, oversized child head and a glance up/right, using distinct contour
  # shapes rather than a human portrait pixel array.
  polygon("neck", 0xAEB9BB, [(42, 44), (42, 49), (48, 50), (49, 45), (46, 42)])
  oval("head-outline", 0x111B22, 44.4, 54.3, 10, 10.7)
  polygon(
    "face",
    0xA5B4BA,
    [
      (37, 56),
      (39, 61),
      (44, 63),
      (49, 62),
      (52, 59),
      (52, 56),
      (55, 53.5),
      (53, 52.2),
      (53, 48),
      (49, 45),
      (44, 45),
      (39, 49),
    ],
  )
  polygon(
    "face-light",
    0xDBE1DF,
    [
      (44, 60),
      (49, 61),
      (51, 58),
      (50, 55),
      (53, 53.5),
      (50, 52),
      (50, 48),
      (47, 47),
      (44, 49),
      (42, 54),
    ],
  )
  polygon(
    "hair",
    0x1B252D,
    [
      (35, 53),
      (35, 59),
      (38, 63),
      (44, 65),
      (50, 64),
      (52, 61),
      (49, 60),
      (47, 61),
      (43, 58),
      (39, 57),
      (39, 51),
    ],
  )
  oval("ear", 0xA4B1B5, 37.8, 51.8, 2.0, 2.7)
  stroke(
    "ear-line", 0x3B4B55, [(38.7, 53.2), (37.1, 53.6), (36.8, 51.9), (38.3, 50.9)], 0.5
  )
  stroke("brow", 0x26343E, [(43.1, 57.1), (46.2, 58.2), (48.5, 57.8)], 0.9)
  polygon(
    "eye-white", 0xEEF0EA, [(43.4, 55.9), (45.9, 57.1), (48.5, 56.2), (46.4, 54.8)]
  )
  oval("iris", 0x263640, 46.8, 56.2, 1.0, 1.1)
  oval("eye-highlight", 0xE5ECEA, 47.1, 56.6, 0.28, 0.34)
  stroke("nose", 0x657780, [(49.8, 56.5), (49.9, 54), (51.8, 53.2)], 0.55)
  stroke("mouth", 0x3F5059, [(48.2, 50.3), (50.1, 50.8), (51.6, 50.2)], 0.65)
  stroke("cheek", 0x80949C, [(43.8, 52), (44.8, 49.3), (47, 48)], 0.5)
  # Teddy: separate round ears, muzzle, belly, arms and dark stitched features.
  oval("teddy-arm", 0x8E9A9C, 23, 29, 7, 4.0)
  oval("teddy-body", 0xAEB8B7, 28, 29.8, 8, 8.2)
  oval("teddy-belly", 0xC8CFCA, 29, 28.4, 4.7, 5.3)
  oval("teddy-ear", 0xACB9B9, 22, 39.7, 3.8, 3.9)
  oval("teddy-ear", 0xACB9B9, 34.5, 40, 3.8, 3.9)
  oval("teddy-inner-ear", 0x65777D, 22.2, 39.5, 1.8, 2)
  oval("teddy-inner-ear", 0x65777D, 34.3, 39.8, 1.8, 2)
  oval("teddy-head", 0xB5C2C3, 28.4, 37, 6.8, 6.3)
  oval("teddy-muzzle", 0xDBDFD8, 28.7, 34.9, 3.3, 2.9)
  oval("teddy-eye", 0x263640, 25.6, 38, 0.65, 0.75)
  oval("teddy-eye", 0x263640, 31.5, 38, 0.65, 0.75)
  oval("teddy-nose", 0x334149, 28.7, 36.1, 1.0, 0.7)
  stroke("teddy-mouth", 0x65777D, [(28.7, 35.7), (28.7, 34.8), (27.6, 34.3)], 0.38)
  oval("teddy-foot", 0xABB7B7, 22.4, 23.5, 4.0, 3.3)
  oval("teddy-foot", 0xABB7B7, 34, 23.7, 4.0, 3.3)
  oval("teddy-pad", 0x72848A, 22.4, 23.4, 2.0, 1.6)
  oval("teddy-pad", 0x72848A, 34, 23.6, 2.0, 1.6)
  oval("holding-hand", 0xD0D8D5, 34.3, 31.3, 3.2, 2.6)
  for y in [30.2, 31.3, 32.3]:
    stroke("holding-fingers", 0x7F9096, [(33.1, y), (36.3, y + 0.3)], 0.32)
  # Interrupted balloon cord, red balloon and small silhouetted emblem.
  stroke("balloon-string", 0xB6C1C3, [(59, 40), (66, 49), (72, 55)], 0.24)
  stroke("balloon-string", 0x899A9D, [(73.2, 56.8), (82, 66), (86, 71.5)], 0.24)
  oval("balloon-outline", 0x9A443C, 86.8, 76, 5.1, 6.8)
  oval("red-balloon", 0xE5755A, 86.5, 76.8, 4.6, 6.1)
  oval("balloon-highlight", 0xF8A080, 84.7, 78.2, 1.3, 2.7)
  polygon("balloon-knot", 0xAF5849, [(86, 70), (87.2, 71.5), (88.1, 69.8)])
  polygon(
    "balloon-emblem",
    0x342C30,
    [
      (83.4, 78),
      (84.3, 77.2),
      (85.2, 78.3),
      (86.6, 77.2),
      (87.9, 78.3),
      (89.1, 77.2),
      (90, 78),
      (89.3, 75.8),
      (87.7, 76.4),
      (86.5, 75.4),
      (85.3, 76.4),
      (83.8, 75.8),
    ],
  )
  # Smiling sun and its asymmetric hand-drawn rays.
  for angle in np.linspace(0, math.tau, 11, endpoint=False):
    c, s = math.cos(angle), math.sin(angle)
    stroke(
      "sun-ray",
      0xD8A92F,
      [(65 + c * 6.4, 86 + s * 6.4), (65 + c * 9, 86 + s * 9)],
      0.65,
    )
  oval("sun-outline", 0xBD9133, 65, 86, 5.6, 5.6)
  oval("sun", 0xF3D04F, 65, 86, 5.1, 5.1)
  oval("sun-eye", 0x625743, 63.3, 87.5, 0.45, 0.8)
  oval("sun-eye", 0x625743, 66.5, 87.5, 0.45, 0.8)
  stroke(
    "sun-smile",
    0x76613E,
    [(62.6, 84.8), (63.4, 83.6), (65, 83.1), (66.6, 83.7), (67.5, 85)],
    0.45,
  )
  # Small flag as actually visible in the user photograph.
  polygon("flag", 0xE9F1EC, [(15.5, 73.5), (29.6, 74.5), (30.9, 69.1), (17, 68.1)])
  stroke(
    "flag-border",
    0x4A7E98,
    [(15.5, 73.5), (29.6, 74.5), (30.9, 69.1), (17, 68.1), (15.5, 73.5)],
    0.3,
  )
  for y in [69.4, 72.7]:
    stroke("flag-stripe", 0x608DA2, [(16.4, y), (29.8, y + 1)], 0.55)
  for points in [
    [(22.9, 73.4), (20.7, 70.1), (25.2, 70.3), (22.9, 73.4)],
    [(23, 69.3), (20.8, 72.4), (25.1, 72.7), (23, 69.3)],
  ]:
    stroke("flag-star", 0x3F758F, points, 0.35)
  # Plain geometric lettering reproduces only the words present in the photo.
  glyphs = {
    "B": [
      [(0, 0), (0, 1), (0.55, 1), (0.75, 0.8), (0.55, 0.55), (0, 0.55)],
      [(0, 0.55), (0.6, 0.55), (0.8, 0.3), (0.6, 0), (0, 0)],
    ],
    "R": [
      [(0, 0), (0, 1), (0.6, 1), (0.8, 0.8), (0.6, 0.55), (0, 0.55)],
      [(0.4, 0.55), (0.85, 0)],
    ],
    "I": [[(0.35, 0), (0.35, 1)]],
    "N": [[(0, 0), (0, 1), (0.8, 0), (0.8, 1)]],
    "G": [
      [
        (0.8, 0.85),
        (0.6, 1),
        (0.2, 1),
        (0, 0.8),
        (0, 0.2),
        (0.2, 0),
        (0.65, 0),
        (0.8, 0.2),
        (0.8, 0.5),
        (0.4, 0.5),
      ]
    ],
    "T": [[(0, 1), (0.8, 1)], [(0.4, 1), (0.4, 0)]],
    "H": [[(0, 0), (0, 1)], [(0.8, 0), (0.8, 1)], [(0, 0.5), (0.8, 0.5)]],
    "E": [[(0.8, 1), (0, 1), (0, 0), (0.8, 0)], [(0, 0.5), (0.65, 0.5)]],
    "M": [[(0, 0), (0, 1), (0.5, 0.3), (1, 1), (1, 0)]],
    "O": [
      [
        (0.2, 0),
        (0, 0.2),
        (0, 0.8),
        (0.2, 1),
        (0.6, 1),
        (0.8, 0.8),
        (0.8, 0.2),
        (0.6, 0),
        (0.2, 0),
      ]
    ],
    "W": [[(0, 1), (0.2, 0), (0.55, 0.6), (0.9, 0), (1.1, 1)]],
  }
  for text, x, y, h, colour in [
    ("BRING THEM", 16, 77, 5.4, 0x263236),
    ("HOME", 32, 69, 5.4, 0x263236),
    ("NOW", 55, 61.6, 6.2, 0xC72F48),
  ]:
    advance = x
    for letter in text:
      if letter == " ":
        advance += h * 0.6
        continue
      factor = (
        h
        * HEIGHT
        / WIDTH
        * (0.5 if text == "NOW" else 0.55 if text == "BRING THEM" else 0.6)
      )
      for line in glyphs[letter]:
        stroke(
          "letter-" + letter,
          colour,
          [(advance + u * factor, y + v * h) for u, v in line],
          0.54,
        )
      advance += (1.15 if letter not in "MW" else 1.4) * factor
  return layers


def run() -> None:
  clearance = gable_clearance_receipt()
  old_native = native_old_support()
  source = next(b for b in read(SOURCE)["buildings"] if b["id"] == OWNER)
  prism = next(b for b in read(PRISMS)["buildings"] if b["id"] == PRISM)
  low = prism["y0_dm"] / 10 + prism["h_dm"] / 10
  footprint = unary_union(
    [Polygon(p["ring"], p["holes"]) for p in source["footprintPolygons"]]
  )
  roofs = [
    t
    for p in source["parts"]
    for s in p["surfaces"]
    if s["kind"] == "RoofSurface"
    for t in triangles_for(s["rings"])
  ]
  meshes = {mode: PackedMesh(ORIGIN[0], ORIGIN[2]) for mode in ["drawn", "native"]}
  receipt = []
  for p in source["parts"]:
    for s in p["surfaces"]:
      if s["kind"] not in ["RoofSurface", "WallSurface", "ClosureSurface"]:
        continue
      kept = [v for t in triangles_for(s["rings"]) for v in upper_clip(t, low)]
      for t in kept:
        meshes["drawn"].triangle(
          t, (99, 106, 105) if s["kind"] == "RoofSurface" else (203, 197, 179)
        )
      receipt.append(
        dict(
          part=p["id"],
          polygon=s["sourcePolygonId"],
          kind=s["kind"],
          cutY=low,
          triangles=kept,
        )
      )
  # Independently sampled complete upper shell, never rotated smooth triangles.
  cells = {}
  for iz in range(
    math.floor(footprint.bounds[1] / CELL), math.ceil(footprint.bounds[3] / CELL)
  ):
    for ix in range(
      math.floor(footprint.bounds[0] / CELL), math.ceil(footprint.bounds[2] / CELL)
    ):
      x, z = (ix + 0.5) * CELL, (iz + 0.5) * CELL
      if footprint.covers(Point(x, z)):
        h = roof_at(roofs, x, z)
        assert h is not None
        cells[ix, iz] = math.ceil(h / CELL) * CELL
  native_low = BASE + math.ceil(prism["h_dm"] / 40) * 4
  for (ix, iz), high in cells.items():
    x, z = ix * CELL, iz * CELL
    meshes["native"].surface(box(x, z, x + CELL, z + CELL), high, (99, 106, 105))
    for dx, dz in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
      bottom = max(native_low, cells.get((ix + dx, iz + dz), native_low))
      if bottom >= high:
        continue
      if dx:
        a, b = [x + (dx > 0) * CELL, z], [x + (dx > 0) * CELL, z + CELL]
      else:
        a, b = [x, z + (dz > 0) * CELL], [x + CELL, z + (dz > 0) * CELL]
      q = [
        [a[0], bottom, a[1]],
        [b[0], bottom, b[1]],
        [b[0], high, b[1]],
        [a[0], high, a[1]],
      ]
      meshes["native"].triangle(q[:3], (203, 197, 179))
      meshes["native"].triangle([q[0], q[2], q[3]], (203, 197, 179))
  upper_counts = {m: len(mesh.indices) // 3 for m, mesh in meshes.items()}
  native_footprint = unary_union(
    [box(ix * CELL, iz * CELL, (ix + 1) * CELL, (iz + 1) * CELL) for ix, iz in cells]
  )
  # Actual retained original 4m core column faces support the lower native art.
  vox = read(VOXELS)
  body = {}
  old_poly = Polygon(np.array(prism["ring"]) / 10)
  column_rows = []
  for zi, row in enumerate(vox["building_rows"]):
    iz = vox["grid"]["min_z_idx"] + zi
    if not -192 <= iz <= -186:
      continue
    for offset, count, lo, hi, kind in row:
      for ix in range(
        vox["grid"]["min_x_idx"] + offset, vox["grid"]["min_x_idx"] + offset + count
      ):
        if old_poly.covers(Point((ix + 0.5) * 4, (iz + 0.5) * 4)):
          column_rows.append([ix, iz, lo, hi, kind])
          body[ix, iz] = hi / 10
  layers = vector_art()
  native_layers = [
    {**r, "geometry": r["geometry"].buffer(0.2, join_style="mitre")}
    if r["role"].startswith("letter-")
    else r
    for r in layers
  ]
  # Clip every hand-authored shape to the complete measured western gable.
  ring = [
    [0, 0],
    [100, 0],
    [100, (21.761 - BASE) / HEIGHT * 100],
    [float(np.dot(np.array([1290.667, -751.819]) - A, D)) / WIDTH * 100, 100],
    [0, (22.642 - BASE) / HEIGHT * 100],
  ]
  panel = Polygon(ring).buffer(-0.32, join_style="mitre")
  visible = []
  covered = Polygon()
  for layer in reversed(layers):
    geo = layer["geometry"].intersection(panel).difference(covered)
    if not geo.is_empty:
      visible.append({**layer, "geometry": geo})
    covered = covered.union(layer["geometry"].intersection(panel))

  def world(u, v):
    p = A + D * (u / 100 * WIDTH) + N * OFFSET
    return [p[0], BASE + v / 100 * HEIGHT, p[1]]

  for layer in visible:
    colour = tuple((layer["colour"] >> s) & 255 for s in [16, 8, 0])
    for p in polys(layer["geometry"]):
      for t in shapely.constrained_delaunay_triangles(p).geoms:
        meshes["drawn"].triangle(
          [world(u, v) for u, v in list(t.exterior.coords)[:3]], colour
        )
  # Paint the complete exposed cardinal skin, including the side faces of
  # original 4m steps and the verified same-owner 2m v166 facade blocks.
  # Only these known volumes support paint; neighbouring owners never do.
  art_step, paint_offset = 0.1, 0.02
  native_runs, native_wraps, front = [], [], {}
  iy0, iy1 = math.floor(BASE / art_step), math.ceil((BASE + HEIGHT) / art_step)
  iz0, iz1 = math.floor(A[1] / art_step), round(math.ceil(B[1] / 2) * 2 / art_step)

  def color_at(x, y, z):
    u = float(np.dot(np.array([x, z]) - A, D)) / WIDTH * 100
    v = (y - BASE) / HEIGHT * 100
    u = min(99.99, max(0.01, u))
    return next(
      (
        r["colour"]
        for r in reversed(native_layers)
        if r["geometry"].covers(Point(u, v))
      ),
      None,
    )

  for iy in range(iy0, iy1):
    y = (iy + 0.5) * art_step
    for iz in range(iz0, iz1):
      z = (iz + 0.5) * art_step
      xs = [
        ix * 4
        for (ix, jz), h in body.items()
        if jz == math.floor(z / 4) and BASE <= y <= h
      ]
      xs += [
        ix * 2
        for ix, jy, jz in old_native["cells"]
        if jz == math.floor(z / 2) and jy * 2 + 3 <= y < (jy + 1) * 2 + 3
      ]
      if y > native_low:
        xs += [
          ix * CELL
          for (ix, jz), h in cells.items()
          if jz == math.floor(z / CELL) and native_low <= y < h
        ]
      if xs:
        front[iy, iz] = min(xs)

  def emit(q, colour):
    rgb = tuple((colour >> shift) & 255 for shift in [16, 8, 0])
    meshes["native"].triangle(q[:3], rgb)
    meshes["native"].triangle([q[0], q[2], q[3]], rgb)

  for iy in range(iy0, iy1):
    y = (iy + 0.5) * art_step
    row = []
    for iz in range(iz0, iz1):
      if (iy, iz) not in front:
        continue
      z = (iz + 0.5) * art_step
      x = front[iy, iz] - paint_offset
      colour = color_at(x, y, z)
      if colour is None:
        continue
      if row and row[-1][1] == iz and row[-1][2:] == [x, colour]:
        row[-1][1] = iz + 1
      else:
        row.append([iz, iz + 1, x, colour])
    for z0, z1, x, colour in row:
      q = [
        [x, iy * art_step, z0 * art_step],
        [x, (iy + 1) * art_step, z0 * art_step],
        [x, (iy + 1) * art_step, z1 * art_step],
        [x, iy * art_step, z1 * art_step],
      ]
      emit(q, colour)
      native_runs.append(
        [
          round(x, 3),
          round(iy * art_step, 3),
          round(z0 * art_step, 3),
          round(z1 * art_step, 3),
          colour,
        ]
      )
  # Cardinal side/cap connectors. These replace no solid: they are the painted
  # surface of the exact existing front envelope, never an arbitrary billboard.
  for (iy, iz), x in front.items():
    for dy, dz in [(0, 1), (1, 0)]:
      other = front.get((iy + dy, iz + dz))
      if other is None and dz and iz == iz1 - 1:
        # Exact outward side of the retained final v166 block. No invented
        # extension of the core wall: only a real cell may support this wrap.
        y = (iy + 0.5) * art_step
        z = (iz + 0.5) * art_step
        ends = [
          (ix + 1) * 2
          for ix, jy, jz in old_native["cells"]
          if abs(ix * 2 - x) < 1e-8
          and jz == math.floor(z / 2)
          and jy * 2 + 3 <= y < (jy + 1) * 2 + 3
        ]
        if ends:
          other = min(ends)
      if other is None or abs(other - x) < 1e-8:
        continue
      wrap_min_x, wrap_max_x = sorted([x, other])
      count = round((wrap_max_x - wrap_min_x) / art_step)
      rows = []
      for k in range(count):
        a = wrap_min_x + k * art_step
        b = a + art_step
        y = (iy + 1) * art_step if dy else (iy + 0.5) * art_step
        z = (iz + 1) * art_step if dz else (iz + 0.5) * art_step
        colour = color_at((a + b) / 2, y, z)
        if colour is None:
          continue
        if rows and rows[-1][2] == colour:
          rows[-1][1] = b
        else:
          rows.append([a, b, colour])
      for a, b, colour in rows:
        sign = 1 if x < other else -1
        if dz:
          z = (iz + 1) * art_step + sign * paint_offset
          q = [
            [a - paint_offset, iy * art_step, z],
            [b - paint_offset, iy * art_step, z],
            [b - paint_offset, (iy + 1) * art_step, z],
            [a - paint_offset, (iy + 1) * art_step, z],
          ]
        else:
          y = (iy + 1) * art_step + sign * paint_offset
          q = [
            [a - paint_offset, y, iz * art_step],
            [b - paint_offset, y, iz * art_step],
            [b - paint_offset, y, (iz + 1) * art_step],
            [a - paint_offset, y, (iz + 1) * art_step],
          ]
        emit(q, colour)
        native_wraps.append(
          dict(
            axis=2 if dz else 1,
            sign=sign,
            quad=[[round(v, 4) for v in p] for p in q],
            colour=colour,
          )
        )

  def record(p):
    return dict(
      ring=list(p.exterior.coords)[:-1],
      holes=[list(h.coords)[:-1] for h in p.interiors],
    )

  profile = dict(
    owner=OWNER,
    prism=PRISM,
    previousPrism=prism,
    sourceOwnerSha256=hashlib.sha256(
      json.dumps(source, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest(),
    sourceSheetCount=sum(len(p["surfaces"]) for p in source["parts"]),
    groundY=BASE,
    drawnCutY=low,
    nativeCutY=native_low,
    topY=max(cells.values()),
    roofTriangles=roofs,
    nativeCellM=CELL,
    drawnFootprints=[record(p) for p in polys(footprint)],
    nativeFootprints=[record(p) for p in polys(native_footprint)],
    anchor=dict(
      a=A.tolist(),
      b=B.tolist(),
      d=D.tolist(),
      normal=N.tolist(),
      offset=OFFSET,
      width=WIDTH,
      height=HEIGHT,
    ),
    text="BRING THEM HOME NOW",
    artwork="Bring them home",
    artist="Benzi Brofman",
    address="Auguststraße 92",
    camera=dict(eye=[1235, 31, -732], target=[1290, 14.5, -753]),
  )
  write(PROFILE, profile)
  payload = dict(
    schema=1,
    origin=ORIGIN,
    drawn=meshes["drawn"].payload("auguststrasse-mural-v270"),
    native=meshes["native"].payload("auguststrasse-mural-v270-native"),
    metrics={
      m: dict(
        vertices=len(mesh.vertices),
        triangles=len(mesh.indices) // 3,
        upperTriangles=upper_counts[m],
        artTriangles=len(mesh.indices) // 3 - upper_counts[m],
      )
      for m, mesh in meshes.items()
    },
  )
  write(DATA, payload)
  write(
    EVIDENCE,
    dict(
      schema=1,
      sourceInputs=[
        dict(path=str(p.relative_to(ROOT)), sha256=sha(p))
        for p in [SOURCE, PRISMS, VOXELS]
      ],
      source=source,
      previousPrism=prism,
      lowerCutReceipt=receipt,
      oldGableClearance=clearance,
      supersededCoreCornice=core_cornice_receipt(prism),
      sourceColumns=column_rows,
      nativeRoofCells=[[x, z, y] for (x, z), y in sorted(cells.items())],
      nativeArtSpan=[A[1], B[1]],
      nativePaintZRange=[iz0 * art_step, iz1 * art_step],
      nativeOldSupport=old_native,
      nativePaintOffsetM=paint_offset,
      nativePaintWraps=native_wraps,
      nativeLetterBufferCompositionUnits=0.2,
      vectorLayers=[
        dict(
          role=r["role"], colour=r["colour"], geometry=shapely.to_geojson(r["geometry"])
        )
        for r in layers
      ],
      nativePaintRuns=native_runs,
      panel=record(panel),
      policy="All source building geometry and previous facade panels remain. Only the exact receipted generic west-wall flat-roof cornice estimate yields when the complete measured upper complement is ready. User photos visually interpreted as hand-authored vector art; no image pixel conversion or texture.",
      metrics=payload["metrics"],
    ),
  )
  print(
    dict(
      runtimeBytes=DATA.stat().st_size,
      profileBytes=PROFILE.stat().st_size,
      evidenceBytes=EVIDENCE.stat().st_size,
      metrics=payload["metrics"],
    )
  )


if __name__ == "__main__":
  run()
