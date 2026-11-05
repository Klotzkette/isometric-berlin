"""Finite facade recognition on three complete, retained Alt-Mitte owners.

Metric wall planes are official LoD2. Window divisions, member sections and
colours are attributed architectural display estimates, never source geometry.
No existing mesh, roof, aperture, courtyard or navigation record is rewritten.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from scripts.build_north_context_v312 import Mesh, line_frame, panel
from scripts.build_scheunen_v265 import drawn_triangles

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OUTPUT = DATA / "lindenEastContextV315.json"
EVIDENCE = GEO / "linden-east-context-v315-evidence.json.gz"
OWNERS = {
  "Komische Oper functional building": ("390_5819", "DEBE01YYK0000EHH", "2_0"),
  "Hackesches Quartier diagonal corner": ("391_5820", "DEBE01YYK00007QE", "4_-1"),
  "Mohrenstrasse 67-69 folded frontage": ("390_5819", "DEBE01YYK000074x", "1_1"),
}
REFERENCES = {
  "functional": "https://www.komische-oper-berlin.de/entdecken/sanierung/vermietung-funktionsgebaeude/",
  "functionalElevation": "https://kob-6a25.kxcdn.com/images/988d8eb49e6c7126424539bf9ea33848/9884/1501_funktionsgebaeude_nordansicht.jpg",
  "diagonal": "https://gruentuchernst.de/projekte/p207/",
  "housing": "https://www.berlin.de/sen/stadtentwicklung/denkmal/landesdenkmalamt/erklaerungsbogen_wohnquartier.pdf",
  "housingSummary": "https://www.berlin.de/sen/kultgz/aktuelles/pressemitteilungen/2021/pressemitteilung.1127865.php",
  "streetName": "https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2025/pressemitteilung.1591600.php",
}
MAPPED_IDENTITY = {
  "DEBE01YYK0000EHH": {
    "address": "Unter den Linden 41",
    "osm": "https://www.openstreetmap.org/way/32699536",
    "mappedBounds": [1010.23, 276.53, 1079.57, 295.29],
  },
  "DEBE01YYK00007QE": {
    "address": "Henriette-Herz-Platz 3",
    "osm": "https://www.openstreetmap.org/node/1812519826",
    "mappedPoint": [2113.009, -321.399],
  },
  "DEBE01YYK000074x": {
    "address": "Anton-Wilhelm-Amo-Strasse 67-69 (formerly Mohrenstrasse)",
    "osmNodes": [1552578824, 1552579168, 1552579581],
    "mappedPoints": [[838.065, 760.972], [841.510, 779.065], [843.919, 802.453]],
  },
}


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def base85(raw: bytes) -> str:
  alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#"
  padding = (4 - len(raw) % 4) % 4
  result = [str(padding)]
  raw += bytes(padding)
  for at in range(0, len(raw), 4):
    word, encoded = int.from_bytes(raw[at : at + 4], "big"), ""
    for _ in range(5):
      word, digit = divmod(word, 85)
      encoded = alphabet[digit] + encoded
    result.append(encoded)
  return "".join(result)


def footprint(owner: dict):
  return unary_union(
    [Polygon(p["ring"], p["holes"]) for p in owner["footprintPolygons"]]
  )


def walls(owner: dict) -> list:
  fp, result = footprint(owner), []
  for part in owner["parts"]:
    for source in part["surfaces"]:
      if source["kind"] != "WallSurface":
        continue
      p = np.asarray(source["rings"][0])
      a, b = max(
        ((a, b) for a in p for b in p),
        key=lambda v: np.linalg.norm((v[0] - v[1])[[0, 2]]),
      )
      if np.linalg.norm((a - b)[[0, 2]]) < 0.3:
        continue
      f = line_frame(a[[0, 2]], b[[0, 2]], fp)
      result.append(
        dict(
          part=part["id"],
          sheet=source["sourcePolygonId"],
          rings=source["rings"],
          frame=f,
          low=float(p[:, 1].min()),
          high=float(p[:, 1].max()),
        )
      )
  return result


def source_packets(owner: str, tile: str, native: bool, inputs: set) -> np.ndarray:
  path = DATA / f"altMitte{'Native' if native else 'Drawn'}V169Source.json"
  descriptor = read(path)
  assert owner in descriptor["sourceParents"]
  inputs.add(path)
  result = []
  for part in descriptor["chunkFiles"]:
    tiles = [tile, "1_0"] if owner.endswith("0EHH") else [tile]
    if any(part["id"].startswith(t + "-piece-") for t in tiles):
      path = DATA / part["file"]
      inputs.add(path)
      result.append(drawn_triangles(read(path), []))
  return np.concatenate(result)


def projected_wall(source: np.ndarray, f: tuple):
  a, d, n, _ = f
  delta = source[:, :, [0, 2]] - a
  u, distances = delta @ d, delta @ n
  selected = np.max(np.abs(distances), axis=1) < 0.025
  return unary_union(
    [
      Polygon(np.column_stack([v, y]))
      for v, y in zip(u[selected], source[selected, :, 1])
    ]
  )


def native_planes(source: np.ndarray, bounds: tuple, columns: list) -> list:
  """Actual delivered cardinal sheets, plus exact original core-column sides."""
  lo, hi = source.min(axis=1), source.max(axis=1)
  keep = (
    (hi[:, 0] >= bounds[0] - 4)
    & (lo[:, 0] <= bounds[2] + 4)
    & (hi[:, 2] >= bounds[1] - 4)
    & (lo[:, 2] <= bounds[3] + 4)
  )
  source = source[keep]
  groups: dict[tuple, list] = {}
  ranges = np.ptp(source, axis=1)
  for tri, span in zip(source, ranges):
    if span[1] < 0.25 or min(span[0], span[2]) > 0.001:
      continue
    axis = 0 if span[0] < 0.001 else 2
    across = 2 if axis == 0 else 0
    poly = Polygon(tri[:, [across, 1]])
    if poly.area > 0.01:
      groups.setdefault((axis, round(float(tri[0, axis]), 2)), []).append(poly)
  for x0, y0, z0, x1, y1, z1 in columns:
    for axis, plane, across0, across1 in [
      (0, x0, z0, z1),
      (0, x1, z0, z1),
      (2, z0, x0, x1),
      (2, z1, x0, x1),
    ]:
      groups.setdefault((axis, plane), []).append(box(across0, y0, across1, y1))
  return [(axis, plane, unary_union(polys)) for (axis, plane), polys in groups.items()]


def core_columns(payload: dict, bounds: tuple) -> list:
  s, gx, gz = (
    payload["cell_m"],
    payload["grid"]["min_x_idx"],
    payload["grid"]["min_z_idx"],
  )
  result = []
  for zi, row in enumerate(payload["building_rows"]):
    z = (gz + zi) * s
    if z + s < bounds[1] - 4 or z > bounds[3] + 4:
      continue
    for offset, count, low, high, _ in row:
      for xi in range(gx + offset, gx + offset + count):
        x = xi * s
        if x + s >= bounds[0] - 4 and x <= bounds[2] + 4:
          result.append([x, low / 10, z, x + s, high / 10, z + s])
  return result


class Fittings:
  def __init__(self, planes: list, columns: list):
    self.draw, self.native = Mesh(), Mesh()
    self.planes, self.columns = planes, columns
    self.fits, self.unfitted = [], 0

  def native_panel(
    self, frame: tuple, u: float, y: float, w: float, h: float, rgb: int
  ):
    a, d, n, _ = frame
    p = a + d * u
    axis = 0 if abs(n[0]) >= abs(n[1]) else 2
    sign = 1 if n[0 if axis == 0 else 1] > 0 else -1
    coord, cross = p[0 if axis == 0 else 1], p[1 if axis == 0 else 0]
    width = min(1.4, max(0.08, w * abs(d[1 if axis == 0 else 0])))
    rect = box(cross - width / 2, y - h / 2, cross + width / 2, y + h / 2)
    candidates = [
      plane
      for ax, plane, poly in self.planes
      if ax == axis and abs(plane - coord) <= 4.1 and poly.buffer(0.001).covers(rect)
    ]
    if not candidates:
      self.unfitted += 1
      return
    plane = max(candidates) if sign > 0 else min(candidates)
    position = (
      [cross, y, plane + sign * 0.12] if axis == 2 else [plane + sign * 0.12, y, cross]
    )
    size = [width, h, 0.045] if axis == 2 else [0.045, h, width]
    # A surface hidden inside a perpendicular source stair is omitted, never
    # projected through an unrelated facade. No source is deleted to make room.
    bounds = np.array(position + position)
    bounds[:3] -= np.array(size) / 2
    bounds[3:] += np.array(size) / 2
    if any(
      all(min(bounds[i + 3], b[i + 3]) - max(bounds[i], b[i]) > 0.001 for i in range(3))
      for b in self.columns
    ):
      self.unfitted += 1
      return
    self.native.solid(np.array(position)[[0, 2]], y, size[0], h, size[2], rgb)
    self.fits.append(
      dict(
        axis=axis,
        plane=plane,
        sourcePosition=p.tolist(),
        rectangle=list(rect.bounds),
        bounds=bounds.tolist(),
      )
    )

  def panel(
    self, f: tuple, u: float, y: float, w: float, h: float, rgb: int, offset=0.14
  ):
    panel(self.draw, f, u, y, w, h, rgb, offset)
    count = max(1, math.ceil(w / 1.2))
    for j in range(count):
      self.native_panel(f, u + ((j + 0.5) / count - 0.5) * w, y, w / count, h, rgb)

  def diagonal(self, f: tuple, u0: float, u1: float, y0: float, y1: float):
    a, d, n, _ = f

    # A thin four-corner member follows the exact source wall plane. The
    # independent native form is a vertical sequence of cardinal source fits.
    def p(u, y):
      xz = a + d * u + n * 0.24
      return [xz[0], y, xz[1]]

    width = 0.24
    self.draw.face(
      [p(u0 - width, y0), p(u0 + width, y0), p(u1 + width, y1), p(u1 - width, y1)],
      0xDDDCD4,
    )
    count = math.ceil((y1 - y0) / 0.48)
    for j in range(count):
      t = (j + 0.5) / count
      self.native_panel(
        f, u0 + (u1 - u0) * t, y0 + (y1 - y0) * t, 0.52, (y1 - y0) / count, 0xDDDCD4
      )


def functional(b: dict, fit: Fittings) -> list:
  front = next(
    w for w in walls(b) if w["sheet"] == "UUID_58e157ac-8ec2-4db8-aa0b-ca2d21e5b049"
  )
  f = front["frame"]
  # Five glazed storeys above a recessed retail plinth and the asymmetric
  # vertical open-cell screen are present in the operator's north elevation.
  length = f[3]
  for floor in range(5):
    y = 11.30 + floor * 3.28
    for j in range(26):
      u = 1.1 + (j + 0.5) * (length - 2.2) / 26
      if length * 0.81 < u < length * 0.87:
        continue
      fit.panel(f, u, y, (length - 2.2) / 26 - 0.10, 2.25, 0x61716D, 0.08)
      fit.panel(f, u, y - 1.30, (length - 2.2) / 26 - 0.08, 0.38, 0xAEA797)
      fit.panel(f, u, y, 0.10, 3.1, 0xCBC7B9, 0.19)
    fit.panel(f, length / 2, y + 1.22, length - 0.5, 0.14, 0xD4CFC1, 0.20)
  screen = length * 0.84
  for y in np.arange(10.0, 26.8, 0.70):
    fit.panel(f, screen, float(y), 3.45, 0.16, 0xBDB59F, 0.23)
  for u in np.arange(screen - 1.6, screen + 1.7, 0.66):
    fit.panel(f, float(u), 18.42, 0.16, 16.98, 0xBDB59F, 0.23)
  return [front]


def diagonal_corner(b: dict, fit: Fittings) -> list:
  selected = []
  for w in walls(b):
    a, d, n, length = w["frame"]
    mid = a + d * length / 2
    # Only the exposed rounded north/west corner; no adjoining party wall or
    # inner courtyard receives facade paint. Upper setbacks stay as delivered.
    if w["low"] > 5.3 or w["high"] < 28 or not (n[0] < -0.3 or n[1] < -0.6):
      continue
    if mid[0] > 2131 or mid[1] > -299 or length > 8:
      continue
    selected.append(w)
    f = w["frame"]
    for level in range(7):
      y0, y1 = 6.1 + level * 3.22, 8.90 + level * 3.22
      fit.panel(f, length / 2, (y0 + y1) / 2, length - 0.03, y1 - y0, 0x6E8584, 0.075)
      fit.panel(f, length / 2, y0 - 0.22, length + 0.025, 0.40, 0xD9D8D0, 0.19)
      fit.panel(f, length / 2, (y0 + y1) / 2, 0.07, y1 - y0, 0xC2BEAA, 0.17)
      if level % 2:
        fit.diagonal(f, length * 0.78, length * 0.22, y0, y1)
      else:
        fit.diagonal(f, length * 0.22, length * 0.78, y0, y1)
  assert len(selected) >= 15
  return selected


def housing(b: dict, fit: Fittings) -> list:
  selected = []
  for w in walls(b):
    a, d, n, length = w["frame"]
    mid = a + d * length / 2
    if w["low"] > 5.3 or w["high"] < 28 or mid[0] < 839 or n[0] < 0.5 or length < 1:
      continue
    selected.append(w)
    f = w["frame"]
    for level in range(1, 8):
      fit.panel(
        f, length / 2, 5.65 + level * 3.05, length - 0.15, 0.065, 0x949185, 0.15
      )
    for u in np.arange(0.16, length - 0.1, 3.0):
      fit.panel(f, float(u), 17.05, 0.07, 22.5, 0xA7A293, 0.15)
  assert len(selected) >= 7
  return selected


def main():
  inputs, sources, result, reports = set(), {}, [], []
  core = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  payload = read(core)
  inputs.add(core)
  for name, (tile, owner, chunk) in OWNERS.items():
    path = GEO / f"alt-mitte-v169/source-{tile}-00.json.gz"
    inputs.add(path)
    b = next(b for b in read(path)["buildings"] if b["id"] == owner)
    sources[owner] = b
    triangles = source_packets(owner, chunk, False, inputs)
    native = source_packets(owner, chunk, True, inputs)
    columns = core_columns(payload, footprint(b).bounds)
    planes = native_planes(native, footprint(b).bounds, columns)
    fit = Fittings(planes, columns)
    sheets = (
      functional
      if owner.endswith("0EHH")
      else diagonal_corner
      if owner.endswith("07QE")
      else housing
    )(b, fit)
    checked = []
    for wall in sheets:
      f = wall["frame"]
      surface = projected_wall(triangles, f)
      assert surface.buffer(0.025).covers(
        box(0.025, 6.0, f[3] - 0.025, min(27.9, wall["high"] - 0.1))
      ), wall["sheet"]
      checked.append({k: v for k, v in wall.items() if k != "frame"})
    assert fit.native.boxes and fit.draw.boxes
    result += [fit.draw.packed(name, False), fit.native.packed(name, True)]
    reports.append(
      dict(
        key=name,
        owner=owner,
        sheetCount=sum(len(p["surfaces"]) for p in b["parts"]),
        fittedSheets=checked,
        nativeFits=fit.fits,
        nativeSourceColumns=columns,
        omittedNativeAtSourceStairs=fit.unfitted,
      )
    )
  decoded = json.dumps(result, separators=(",", ":")).encode()
  packed = gzip.compress(decoded, mtime=0)
  assert gzip.decompress(packed) == decoded
  OUTPUT.write_text(
    json.dumps(
      dict(
        codec="gzip-base85",
        decodedBytes=len(decoded),
        decodedSha256=hashlib.sha256(decoded).hexdigest(),
        payload=base85(packed),
      ),
      separators=(",", ":"),
    )
    + "\n"
  )
  evidence = dict(
    schemaVersion=1,
    references=REFERENCES,
    sourceGeometryRetained=True,
    automaticRetirement=False,
    textureFree=True,
    fullStaticDetailOnTouch=True,
    estimateStatus="Primary photographs/elevation establish the facade programme. Section sizes, floor/bay spacing, diagonal profile and colours are bounded display estimates; all source walls, roofs and courts remain unchanged. Native uses independently fitted cardinal source sheets/columns, never rotated drawn ornaments.",
    inputs=[
      dict(path=str(p.relative_to(ROOT)), sha256=sha(p), bytes=p.stat().st_size)
      for p in sorted(inputs)
    ],
    completeOfficialFamilies=sources,
    mappedIdentity=MAPPED_IDENTITY,
    mappedIdentitySource={
      "url": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      "license": "ODbL-1.0",
      "coordinateFrame": "EPSG:25833; x=easting-389500, z=5820000-northing",
      "purpose": "Address-to-official-family resolution only, not geometry replacement",
    },
    sites=reports,
    runtime=dict(
      path=str(OUTPUT.relative_to(ROOT)),
      sha256=sha(OUTPUT),
      bytes=OUTPUT.stat().st_size,
      decodedSha256=hashlib.sha256(decoded).hexdigest(),
      decodedBytes=len(decoded),
      gzipBytes=len(gzip.compress(OUTPUT.read_bytes(), mtime=0)),
    ),
  )
  EVIDENCE.write_bytes(
    gzip.compress(json.dumps(evidence, separators=(",", ":")).encode(), mtime=0)
  )
  print(
    json.dumps(
      dict(
        runtime=evidence["runtime"],
        boxes=[(r["key"], r["native"], r["boxCount"]) for r in result],
        nativeOmissions=[r["omittedNativeAtSourceStairs"] for r in reports],
      ),
      indent=2,
    )
  )


if __name__ == "__main__":
  main()
