"""Build the three listed advertising columns and the yellow Kollwitz plaque in both styles."""

from __future__ import annotations

import base64
import gzip
import json
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
SOURCE = ROOT / "geo_data/regierungsviertel/kollwitz-stadtmoebel-v381.json"

# Fractions of each column's own photographed width and height.
PROFILES = {
  "stone": [
    (0, 0.52),
    (0.025, 0.54),
    (0.155, 0.53),
    (0.174, 0.51),
    (0.184, 0.55),
    (0.20, 0.55),
    (0.208, 0.47),
    (0.884, 0.46),
    (0.89, 0.52),
    (0.902, 0.56),
    (0.925, 0.57),
    (0.94, 0.53),
    (0.954, 0.48),
    (0.98, 0.30),
    (1, 0.12),
  ],
  "green": [
    (0, 0.54),
    (0.024, 0.55),
    (0.042, 0.50),
    (0.17, 0.47),
    (0.18, 0.48),
    (0.181, 0.46),
    (0.835, 0.46),
    (0.844, 0.51),
    (0.856, 0.51),
    (0.867, 0.46),
    (0.888, 0.52),
    (0.904, 0.54),
    (0.917, 0.51),
    (0.938, 0.45),
    (0.96, 0.39),
    (0.979, 0.30),
    (0.997, 0.11),
    (1, 0.04),
  ],
  "dark": [
    (0, 0.55),
    (0.02, 0.55),
    (0.036, 0.54),
    (0.049, 0.48),
    (0.060, 0.47),
    (0.837, 0.47),
    (0.85, 0.48),
    (0.861, 0.51),
    (0.87, 0.53),
    (0.887, 0.52),
    (0.895, 0.49),
    (0.905, 0.50),
    (0.932, 0.46),
    (0.951, 0.39),
    (0.966, 0.36),
    (0.979, 0.29),
    (0.995, 0.18),
    (1, 0.06),
  ],
}
# Muted panels suggest paper at model scale; the geographically movable posters are unlettered.
PANELS = {
  "stone": [
    (0, 0.55, 0.18, 0.52, 0xEEE6DD),
    (0.03, 0.48, 0.22, 0.265, 0xA4463E),
    (0.10, 0.43, 0.27, 0.44, 0x728697),
    (0.46, 0.8, 0.52, 0.81, 0xC4B7A1),
    (0.51, 0.75, 0.57, 0.68, 0x777063),
    (0.81, 0.98, 0.27, 0.53, 0xC5B49F),
  ],
  "green": [
    (0, 0.32, 0.30, 0.62, 0x7398AE),
    (0.04, 0.30, 0.42, 0.56, 0xECD89B),
    (0.33, 0.68, 0.19, 0.57, 0xD5A291),
    (0.38, 0.65, 0.27, 0.45, 0xB84B5B),
    (0.58, 0.98, 0.68, 0.79, 0x779AA5),
    (0.72, 0.97, 0.37, 0.65, 0xC9D5D5),
  ],
  "dark": [
    (0, 0.43, 0.60, 0.68, 0x666960),
    (0.04, 0.32, 0.33, 0.48, 0x7F4C3E),
    (0.09, 0.28, 0.38, 0.47, 0x9E7960),
  ],
}


class Batch:
  def __init__(self):
    self.vertices = {}
    self.index = []

  def face(self, pts, tint):
    idx = []
    for p in pts:
      key = (*[round(v * 1000) for v in p], tint)
      idx.append(self.vertices.setdefault(key, len(self.vertices)))
    for j in range(1, len(idx) - 1):
      if len({idx[0], idx[j], idx[j + 1]}) == 3:
        self.index.extend([idx[0], idx[j], idx[j + 1]])

  def data(self):
    verts = np.array(list(self.vertices), dtype=np.int64)
    # Store centimetres locally plus the sub-centimetre survey origin.
    origin = verts[:, :3].min(axis=0)
    pos = np.rint((verts[:, :3] - origin) / 10).astype("<u2")

    def split_deltas(words):
      values = np.asarray(words, dtype=np.int64)
      delta = np.diff(values, prepend=0).astype("<u2")
      return (delta & 255).astype("u1").tobytes() + (delta >> 8).astype("u1").tobytes()

    palette, tones = np.unique(verts[:, 3], return_inverse=True)
    assert len(palette) < 256 and pos.max() < 32768 and len(verts) < 65536
    raw = (
      split_deltas(pos.T.reshape(-1))
      + tones.astype("u1").tobytes()
      + split_deltas(self.index)
    )
    return dict(
      origin=(origin / 1000).tolist(),
      n=len(verts),
      faces=len(self.index) // 3,
      mesh=base64.b64encode(gzip.compress(raw, mtime=0)).decode(),
      palette=palette.tolist(),
    )


def add_column(batch, row, native):
  x, z = row["xy"]
  w, h = row["w"], row["h"]
  kind = row["style"]
  base = 3.24
  profile = PROFILES[kind]

  def material(y):
    if kind == "stone":
      if y < 0.185:
        return 0x9B9688
      if y < 0.208 or y > 0.885:
        return 0x534F44
      return 0xE4DFD3
    if kind == "green":
      return 0x33584E if y > 0.905 else 0xE3DFD3 if 0.18 <= y < 0.835 else 0x37473F
    return 0xC7C8C2 if 0.838 < y < 0.861 else 0x29302D if y < 0.85 else 0x465052

  def paint(u, y, tone):
    for u0, u1, y0, y1, col in PANELS[kind]:
      if u0 <= u < u1 and y0 <= y < y1:
        return col
    return tone

  if native:
    step = 0.10
    half = math.ceil(max(r for _, r in profile) * w / step)

    def inside(ix, iz, r):
      return (ix + 0.5) ** 2 + (iz + 0.5) ** 2 <= (r * w / step) ** 2

    for layer in range(math.ceil(h / step)):
      lo = layer * step
      hi = min(h, (layer + 1) * step)
      ratio = (hi + lo) / (2 * h)
      radii = [v[1] for v in profile]
      heights = [v[0] for v in profile]
      rad = np.interp(ratio, heights, radii)
      next_rad = np.interp(min(1, (hi + 0.5 * step) / h), heights, radii)
      for ix in range(-half, half):
        for iz in range(-half, half):
          if not inside(ix, iz, rad):
            continue
          a, b = x + ix * step, z + iz * step
          t = material(ratio)
          for dx, dz, edge in [
            (0, -1, [(0, 0), (1, 0)]),
            (1, 0, [(1, 0), (1, 1)]),
            (0, 1, [(1, 1), (0, 1)]),
            (-1, 0, [(0, 1), (0, 0)]),
          ]:
            if inside(ix + dx, iz + dz, rad):
              continue
            u = (
              math.atan2(iz + 0.5 + dz * 0.5, ix + 0.5 + dx * 0.5) / (2 * math.pi)
            ) % 1
            p0, p1 = [(a + u0 * step, b + v0 * step) for u0, v0 in edge]
            batch.face(
              [
                (p0[0], base + lo, p0[1]),
                (p0[0], base + hi, p0[1]),
                (p1[0], base + hi, p1[1]),
                (p1[0], base + lo, p1[1]),
              ],
              paint(u, ratio, t),
            )
          if hi == h or not inside(ix, iz, next_rad):
            batch.face(
              [
                (a, base + hi, b),
                (a, base + hi, b + step),
                (a + step, base + hi, b + step),
                (a + step, base + hi, b),
              ],
              t,
            )
    return
  levels = sorted(
    {y for y, r in profile} | {v for stripe in PANELS[kind] for v in stripe[2:4]}
  )

  def point(u, y):
    r = float(np.interp(y, [v[0] for v in profile], [v[1] for v in profile])) * w
    return [
      x + r * math.cos(u * math.tau),
      base + y * h,
      z + r * math.sin(u * math.tau),
    ]

  for low, high in zip(levels, levels[1:]):
    for i in range(32):
      a, b = i / 32, (i + 1) / 32
      y = (low + high) / 2
      batch.face(
        [point(a, low), point(a, high), point(b, high), point(b, low)],
        paint((a + b) / 2, y, material(y)),
      )
  batch.face([point(i / 32, 1) for i in range(31, -1, -1)], material(1))


def plaque_texture():
  # Render an original, legible inscription for the model. Portrait photography
  # and historic advertising reproductions are not included in the asset.
  im = Image.new("P", (208, 150), 0)
  draw = ImageDraw.Draw(im)
  font = ImageFont.truetype("DejaVuSans.ttf", 9)
  bold = ImageFont.truetype("DejaVuSans-Bold.ttf", 13)
  draw.rectangle((1, 1, 206, 148), outline=1, width=2)
  draw.text((12, 12), "An diesem Ort lebten und arbeiteten", font=font, fill=2)
  draw.text((12, 34), "Käthe Kollwitz", font=bold, fill=2)
  draw.text((12, 53), "1867–1945", font=font, fill=2)
  draw.text((12, 75), "Karl Kollwitz", font=bold, fill=2)
  draw.text((12, 94), "1863–1940", font=font, fill=2)
  draw.text((12, 123), "Kollwitzstraße 56a", font=font, fill=2)
  for x in (5, 202):
    for y in (5, 144):
      draw.ellipse((x - 1, y - 1, x + 1, y + 1), fill=3)
  # Four palette entries fit into two bits per pixel before compression.
  a = np.asarray(im, dtype="u1").reshape(-1, 4)
  packed = a[:, 0] << 6 | a[:, 1] << 4 | a[:, 2] << 2 | a[:, 3]
  return base64.b64encode(gzip.compress(packed.tobytes(), mtime=0)).decode()


def build():
  source = json.loads(SOURCE.read_bytes())
  out = DATA / "kollwitzStreetFurnitureV381"
  out.mkdir(exist_ok=True)
  rows = defaultdict(list)
  for c in source["columns"]:
    x, z = c["xy"]
    rows[f"{math.floor(x / 512)}_{math.floor(z / 512)}"].append(c)
  for tile, columns in rows.items():
    for mode in ("drawn", "native"):
      mesh = Batch()
      for c in columns:
        add_column(mesh, c, mode == "native")
      p = mesh.data()
      p["columns"] = [
        [c["surveyId"], *c["xy"], round(0.48 * c["w"], 3), 3.24, c["h"]]
        for c in columns
      ]
      if tile == "6_-4":
        plaque = source["plaque"]
        p["plaque"] = {
          "f": plaque[mode],
          "y": plaque["base"],
          "w": plaque["width"],
          "h": plaque["height"],
          "ink": plaque_texture(),
        }
      (out / f"{mode}_{tile}.json").write_text(
        json.dumps(p, separators=(",", ":")) + "\n"
      )


if __name__ == "__main__":
  build()
