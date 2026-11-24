"""Place recorded architectural features on the exposed fronts of the Kollwitzkiez."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
from build_jannowitz_v380 import Batch
from shapely.affinity import translate
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/kollwitz-fronts-v381-survey.json.gz"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
DATA = ROOT / "src/app/src/data/kollwitzFrontsV381"
HOSTS = ("5_-4", "6_-4")


def tint(color, amount, target):
  a = np.array([int(color[i : i + 2], 16) for i in (0, 2, 4)])
  b = np.array([int(target[i : i + 2], 16) for i in (0, 2, 4)])
  return "".join(f"{v:02x}" for v in np.rint(a * (1 - amount) + b * amount).astype(int))


def surfaces(record, polygons, native):
  a, b = np.array(record["a"]), np.array(record["b"])
  normal = np.array(record["normal"])
  width = np.linalg.norm(b - a)
  direction = (b - a) / width
  if not native:
    return [(0, width, a, b, normal)]
  current = unary_union(polygons).buffer(0)
  edges = []
  for p in getattr(current, "geoms", [current]):
    for a0, b0 in zip(p.exterior.coords, list(p.exterior.coords)[1:]):
      left, right = np.array(a0), np.array(b0)
      d0, d1 = (left - a) @ normal, (right - a) @ normal
      if max(abs(d0), abs(d1)) > 3.1:
        continue
      u0, u1 = (left - a) @ direction, (right - a) @ direction
      if u1 < u0:
        u0, u1, left, right = u1, u0, right, left
      if u1 - u0 < 0.035 or u0 >= width or u1 <= 0:
        continue
      d = right - left
      n = np.array([-d[1], d[0]]) / np.linalg.norm(d)
      if n @ normal < 0:
        n = -n
      if n @ normal < 0.15 or current.contains(Point((left + right) / 2 + n * 0.07)):
        continue
      edges.append((u0, u1, left, right, n))
  return edges


class Front:
  def __init__(self, batches, edges, base):
    self.batches = batches
    self.edges = edges
    self.ground = base

  def strip(self, start_u, end_u, yl, yr, hl, hr, depth, tone):
    if end_u - start_u < 0.012 or max(hl - yl, hr - yr) < 0.008:
      return
    for start, end, a, b, normal in self.edges:
      lo, hi = max(start_u, start), min(end_u, end)
      if hi <= lo + 0.008:
        continue

      def pt(u, y0, y1, d):
        x, z = a + (b - a) * (u - start) / (end - start) + normal * d
        return (x, self.ground + y0 + (y1 - y0) * (u - start_u) / (end_u - start_u), z)

      q = [
        pt(lo, yl, yr, depth),
        pt(hi, yl, yr, depth),
        pt(hi, hl, hr, depth),
        pt(lo, hl, hr, depth),
      ]
      self.emit(q, tone)

  def emit(self, q, tone):
    # A photographed house or a native step may straddle the host seam.
    # Clip on the real boundary before quantization, avoiding duplicate wall patches.
    xmin = min(a[0] for a in q)
    xmax = max(a[0] for a in q)
    for host in HOSTS:
      east = host == "6_-4"
      if (east and xmax < 3072 + 0.002) or (not east and xmin > 3072 - 0.002):
        continue
      dst = self.batches[host]
      clipped = []
      for a, b in zip(q, q[1:] + q[:1]):
        insideA = a[0] >= 3072 if east else a[0] <= 3072
        insideB = b[0] >= 3072 if east else b[0] <= 3072
        if insideA:
          clipped.append(a)
        if insideA != insideB:
          k = (3072 - a[0]) / (b[0] - a[0])
          clipped.append(tuple(x + k * (y - x) for x, y in zip(a, b)))
      for j in range(1, len(clipped) - 1):
        dst.tri(clipped[0], clipped[j], clipped[j + 1], tone)

  def rect(self, start_u, end_u, lo, hi, depth, tone):
    self.strip(start_u, end_u, lo, lo, hi, hi, depth, tone)

  def ledge(self, start_u, end_u, y, height, front, back, face, cap):
    self.rect(start_u, end_u, y, y + height, front, face)
    for start, end, a, b, n in self.edges:
      u, v = max(start_u, start), min(end_u, end)
      if v - u < 0.015:
        continue

      def pt(s, d):
        x, z = a + (b - a) * (s - start) / (end - start) + n * d
        return (x, self.ground + y + height, z)

      self.emit([pt(u, back), pt(v, back), pt(v, front), pt(u, front)], cap)

  def canopy(self, start_u, end_u, y, tone):
    # A cloth roof has a sloping top and a hanging valance; the archival
    # photograph fixes its span and colour, but not its exact projection.
    for start, end, a, b, n in self.edges:
      u, v = max(start, start_u), min(end, end_u)
      if v - u < 0.015:
        continue

      def pt(s, d, h):
        x, z = a + (b - a) * (s - start) / (end - start) + n * d
        return (x, self.ground + y + h, z)

      self.emit(
        [pt(u, 0.25, 0.52), pt(v, 0.25, 0.52), pt(v, 1.28, -0.15), pt(u, 1.28, -0.15)],
        tone,
      )
      self.emit(
        [
          pt(u, 1.28, -0.13),
          pt(v, 1.28, -0.13),
          pt(v, 1.28, -0.38),
          pt(u, 1.28, -0.38),
        ],
        tint(tone, 0.16, "5e383a"),
      )
    self.rect(start_u, end_u, y + 0.48, y + 0.59, 0.29, tint(tone, 0.25, "70595a"))

  def arch(self, start_u, end_u, y, rise, depth, tone):
    for j in range(8):
      u, v = j / 8, (j + 1) / 8

      def head(k):
        return y + rise * math.sqrt(max(0, 1 - (k * 2 - 1) ** 2))

      self.strip(
        start_u + (end_u - start_u) * u,
        start_u + (end_u - start_u) * v,
        y,
        y,
        head(u),
        head(v),
        depth,
        tone,
      )


def build_front(f, batches, p, native):
  edge = surfaces(f, p, native)
  if not edge:
    return False
  g = Front(batches, edge, f["ground"])
  width = math.dist(f["a"], f["b"])
  kind = f["finish"]
  base, eave = f["base"], f["eave"]
  paint = f["wall"]
  trim = tint(paint, 0.38, "ffefda")
  edge_tone = tint(paint, 0.27, "756757")
  glazing = "606d72" if kind != "modern" else "687980"
  # The predecessor's window estimates project up to 11 cm. A thin surveyed
  # plaster plane takes over the photographed public elevation only; where the
  # ground storey was hidden, its earlier shop treatment remains visible.
  g.rect(0.003, width - 0.003, base, eave, 0.214, paint)
  g.ledge(0.015, width - 0.015, eave - 0.23, 0.18, 0.40, 0.213, edge_tone, trim)
  g.rect(0.015, width - 0.015, eave - 0.41, eave - 0.31, 0.29, trim)
  verified = f.get("relief", {})
  for u in verified.get("piers", []):
    axis = max(0.15, min(width - 0.15, u * width))
    band = tint(paint, 0.32, "ba857b" if kind == "pilaster" else "eee5d4")
    g.rect(axis - 0.15, axis + 0.15, base + 0.23, eave - 0.31, 0.238, band)
    g.rect(axis - 0.18, axis - 0.13, base + 0.23, eave - 0.31, 0.254, edge_tone)
    g.ledge(axis - 0.25, axis + 0.25, eave - 0.66, 0.18, 0.37, 0.22, edge_tone, trim)
  if verified.get("surround"):
    g.ledge(
      0.01,
      width - 0.01,
      eave - 0.18,
      0.19,
      0.55,
      0.24,
      tint(paint, 0.28, "766959"),
      trim,
    )
    # The upper storeys of these particular elevations have a continuous
    # masonry frieze with an articulated band beneath the cornice.
    g.rect(
      0.02, width - 0.02, eave - 0.78, eave - 0.66, 0.275, tint(trim, 0.17, "988575")
    )
  for y in f["ledges"]:
    if base + 0.40 < y < eave - 0.65:
      g.ledge(0.015, width - 0.015, y, 0.09, 0.32, 0.214, edge_tone, trim)
  projected = f["bays"]
  for start_u, end_u, low, high in projected:
    if kind == "brick":
      g.rect(start_u, end_u, low, high, 0.395, tint(trim, 0.45, "e9e3d5"))
      g.ledge(
        start_u - 0.05, end_u + 0.05, low - 0.16, 0.16, 0.48, 0.215, edge_tone, trim
      )
  for x, y, w, h in f["windows"]:
    left, right = x - w / 2, x + w / 2
    low, high = y - h / 2, y + h / 2
    in_bay = kind == "brick" and any(
      start_u < x < end_u and lo < y < hi for start_u, end_u, lo, hi in projected
    )
    relief = 0.194 if in_bay else 0
    depth = 0.242 + relief
    rim = 0.105 if kind in ("moulded", "arch", "pilaster", "brick") else 0.075
    g.rect(left - rim, right + rim, low - rim, high + rim, depth + 0.02, trim)
    g.rect(left, right, low, high, depth + 0.045, "5b5751")
    # Local reveal and timber/painted casements follow the measured opening.
    g.rect(left + 0.06, right - 0.06, low + 0.055, high - 0.055, depth + 0.061, glazing)
    g.rect(x - 0.040, x + 0.040, low + 0.035, high - 0.035, depth + 0.082, trim)
    g.rect(
      left + 0.04,
      right - 0.04,
      high - h * 0.34 - 0.035,
      high - h * 0.34 + 0.035,
      depth + 0.083,
      trim,
    )
    g.ledge(
      left - rim - 0.04,
      right + rim + 0.04,
      low - 0.15,
      0.12,
      depth + 0.18,
      depth,
      edge_tone,
      trim,
    )
    if kind in ("arch", "moulded", "brick"):
      if kind == "arch":
        g.arch(
          left - 0.13,
          right + 0.13,
          high + 0.02,
          min(0.36, h * 0.16),
          depth + 0.071,
          trim,
        )
        g.arch(
          left + 0.055,
          right - 0.055,
          high + 0.025,
          min(0.20, h * 0.09),
          depth + 0.088,
          glazing,
        )
      else:
        g.ledge(
          left - 0.15,
          right + 0.15,
          high + 0.12,
          0.105,
          depth + 0.135,
          depth,
          edge_tone,
          trim,
        )
    profile = verified.get("surround")
    if profile:
      # Three-dimensional casings retain a darker reveal at the sash,
      # brighter caps and a projected sill rather than a second flat pane.
      g.rect(
        left - 0.19, left - 0.095, low - 0.10, high + 0.10, depth + 0.132, edge_tone
      )
      g.rect(right + 0.095, right + 0.19, low - 0.10, high + 0.10, depth + 0.132, trim)
      g.rect(
        left + 0.06, right - 0.06, low + 0.06, low + h * 0.28, depth + 0.067, "546468"
      )
      g.rect(
        left + 0.06, right - 0.06, high - h * 0.30, high - 0.06, depth + 0.067, "7a898c"
      )
      # End pilasters, shaped heads and apron panels are face-specific.
      if profile in (
        "crowned ochre surround",
        "projecting pale entablature",
        "plaster arcades",
        "pale architrave",
      ):
        g.strip(
          left - 0.20,
          x,
          high + 0.15,
          high + 0.30,
          high + 0.29,
          high + 0.48,
          depth + 0.152,
          trim,
        )
        g.strip(
          x,
          right + 0.20,
          high + 0.30,
          high + 0.15,
          high + 0.48,
          high + 0.29,
          depth + 0.152,
          trim,
        )
        g.rect(x - 0.10, x + 0.10, high + 0.19, high + 0.42, depth + 0.164, edge_tone)
        g.rect(left + 0.04, right - 0.04, low - 0.40, low - 0.24, depth + 0.10, trim)
      elif profile == "radial arch":
        g.rect(x - 0.10, x + 0.10, high + 0.17, high + 0.41, depth + 0.12, trim)
  for start_u, end_u, low, high in projected:
    if kind == "brick":
      continue
    # Photograph-supported balcony fronts are shallow local relief. Avoid a
    # second building volume or an invented external balcony floor itinerary.
    row_y = sorted(
      {
        round(y * 2) / 2
        for x, y, w, h in f["windows"]
        if start_u - 0.6 < x < end_u + 0.6 and low - 0.3 < y < high + 0.3
      }
    )
    landings = []
    for y in row_y:
      if not landings or y - landings[-1] > 2.05:
        landings.append(y)
    if not landings:
      landings = [(low + high) / 2]
    for level in landings:
      y = max(low, min(high - 0.5, level - 1.03))
      g.ledge(start_u, end_u, y, 0.14, 0.61, 0.215, edge_tone, trim)
      g.rect(start_u, end_u, y + 0.77, y + 0.84, 0.62, edge_tone)
      if verified.get("balconyFront"):
        g.ledge(
          start_u - 0.05, end_u + 0.05, y - 0.10, 0.19, 1.00, 0.23, edge_tone, trim
        )
        g.rect(start_u, end_u, y + 0.10, y + 0.84, 0.97, tint(paint, 0.22, "bcb6a9"))
        g.ledge(
          start_u - 0.05, end_u + 0.05, y + 0.78, 0.10, 1.03, 0.23, edge_tone, trim
        )
        count = max(2, round((end_u - start_u) / 1.18))
        for index in range(count):
          left = start_u + (end_u - start_u) * (index + 0.12) / count
          right = start_u + (end_u - start_u) * (index + 0.88) / count
          g.rect(left, right, y + 0.22, y + 0.65, 0.995, trim)
      elif kind == "modern":
        g.rect(start_u, end_u, y + 0.18, y + 0.75, 0.53, "899596")
      else:
        posts = max(3, round((end_u - start_u) / 0.72))
        for k in range(posts + 1):
          u = start_u + (end_u - start_u) * k / posts
          g.rect(u - 0.035, u + 0.035, y + 0.12, y + 0.79, 0.615, edge_tone)
  for start_u, end_u, low, high in f["shops"]:
    g.rect(start_u, end_u, low, high, 0.27, edge_tone)
    g.rect(start_u + 0.12, end_u - 0.12, low + 0.19, high - 0.20, 0.31, "536366")
    g.rect(start_u + 0.05, end_u - 0.05, high - 0.27, high - 0.11, 0.35, trim)
    if end_u - start_u > 2.1:
      u = start_u + (end_u - start_u) * 0.61
      g.rect(u - 0.055, u + 0.055, low + 0.12, high - 0.14, 0.37, trim)
    if end_u - start_u > 1.6:
      g.rect(start_u + 0.11, end_u - 0.11, high - 0.52, high - 0.43, 0.355, trim)
      g.rect(
        start_u + 0.10,
        end_u - 0.10,
        low + 0.20,
        low + 0.53,
        0.34,
        tint(edge_tone, 0.22, "444b48"),
      )
      # A slightly lighter upper transom divides the glazed door/shopfront.
      g.rect(start_u + 0.16, end_u - 0.16, high - 0.45, high - 0.29, 0.337, "92a09f")
  for start_u, end_u, y, tone in f["awnings"]:
    g.canopy(start_u, end_u, y, tone)
  return True


def pack(batch, owners):
  pos = np.asarray(batch.xyz, dtype="<u2").T
  dp = np.diff(pos, axis=1, prepend=np.zeros((3, 1), dtype="<u2")).flatten()
  vertex_count = len(batch.xyz)
  index_width = 2 if vertex_count < 65536 else 3
  assert vertex_count < 2**24
  idx = np.asarray(batch.ids, dtype="<u4")
  di = np.diff(idx, prepend=np.uint32(0))

  def planes(words, count):
    return b"".join(
      ((words >> (8 * j)) & 255).astype("u1").tobytes() for j in range(count)
    )

  raw = (
    planes(dp, 2)
    + np.asarray(batch.rgb, dtype="u1").tobytes()
    + planes(di, index_width)
  )
  return dict(
    n=vertex_count,
    i=len(idx),
    origin=batch.origin.tolist(),
    owners=sorted(owners),
    data=base64.b64encode(gzip.compress(raw, compresslevel=9, mtime=0)).decode("ascii"),
  )


def main(check):
  survey = json.loads(gzip.decompress(SOURCE.read_bytes()))
  DATA.mkdir(exist_ok=True)
  for native in [False, True]:
    family = "minecraft" if native else "drawn"
    footprints = defaultdict(list)
    batches = {}
    for host in HOSTS:
      path = PUBLIC / f"{host}.{family}.json.gz"
      assert (
        hashlib.sha256(path.read_bytes()).hexdigest() == survey["hosts"][host][family]
      )
      q = json.loads(gzip.decompress(path.read_bytes()))
      ox, _, oz = q["origin"]
      batches[host] = Batch(
        "Vermessene Straßenfronten zwischen Wasserturm und Kollwitzplatz",
        np.array([ox - 1, 0, oz - 1]),
      )
      for b in q["nav"]["buildings"]:
        g = Polygon(b["ring"], b.get("holes") or [])
        if g.is_valid:
          footprints[b["sourceId"]].append(translate(g, ox, oz))
    owners = defaultdict(set)
    for face in survey["faces"]:
      owner = face["owner"]
      before = {h: len(q.ids) for h, q in batches.items()}
      assert owner in footprints
      assert build_front(face, batches, footprints[owner], native), (owner, family)
      for host in HOSTS:
        if len(batches[host].ids) > before[host]:
          owners[host].add(owner)
    for host, b in batches.items():
      packet = pack(b, owners[host])
      raw = json.dumps(packet, ensure_ascii=False, separators=(",", ":")) + "\n"
      dest = DATA / (("native_" if native else "drawn_") + host + ".json")
      if check:
        if dest.read_text() != raw:
          raise SystemExit("Stale " + dest.name)
      else:
        dest.write_text(raw)
      print(
        dest.name,
        len(raw.encode()),
        len(b.xyz),
        len(b.ids) // 3,
        len(owners[host]),
        flush=True,
      )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--check", action="store_true")
  main(parser.parse_args().check)
