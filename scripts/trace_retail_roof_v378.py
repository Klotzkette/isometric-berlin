"""Trace identifiable photovoltaic module groups on the Lichtenberg IKEA roof.

Use a 1120 by 1120 DOP20RGBI JPEG from the WMS query stored in the receipt.
The search windows bound visible photovoltaics in a roof-aligned 0.5 m grid.
The receipt contains only derived rectangle outlines, not the orthophoto.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SOURCE = "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&SRS=EPSG%3A25833&LAYERS=dop_2025&STYLES=&BBOX=399100%2C5821320%2C399380%2C5821600&WIDTH=1120&HEIGHT=1120&FORMAT=image%2Fjpeg"
WINDOWS = [
  (105, 51, 281, 77),
  (109, 77, 159, 137),
  (125, 135, 170, 179),
  (204, 77, 278, 106),
  (125, 193, 213, 245),
  (126, 247, 163, 281),
  (218, 207, 272, 279),
  (272, 191, 308, 274),
  (136, 277, 159, 325),
  (172, 330, 222, 416),
  (223, 290, 261, 416),
  (261, 321, 306, 416),
  (352, 210, 373, 252),
  (351, 259, 368, 313),
  (350, 321, 375, 360),
  (351, 373, 375, 390),
]


def world(i, j):
  u = i * 0.5 - 110
  v = j * 0.5 - 120
  return 9739 + 0.9953 * u + 0.0966 * v, -1467 - 0.0966 * u + 0.9953 * v


def trace(image):
  photo = np.asarray(Image.open(image).convert("RGB"))
  assert photo.shape == (1120, 1120, 3)
  j, i = np.mgrid[:480, :440]
  x, z = world(i, j)
  r, c = np.rint((z + 1600) * 4).astype(int), np.rint((x - 9600) * 4).astype(int)
  a = photo[np.clip(r, 0, 1119), np.clip(c, 0, 1119)].astype(float)
  mask = (
    (a.mean(axis=2) < 163)
    & (a[:, :, 2] > a[:, :, 0] + 1)
    & (a[:, :, 2] - a[:, :, 0] < 47)
  )
  rects = []
  for x0, y0, x1, y1 in WINDOWS:
    sample = ndimage.binary_closing(mask[y0:y1, x0:x1], structure=np.ones((2, 2)))
    sample = ndimage.binary_opening(sample, structure=np.ones((3, 3)))
    labels, count = ndimage.label(sample)
    for n, (ys, xs) in enumerate(ndimage.find_objects(labels), 1):
      h, w = ys.stop - ys.start, xs.stop - xs.start
      pixels = (labels[ys, xs] == n).sum()
      if min(h, w) < 3 or pixels < 14 or pixels / (w * h) < 0.78:
        continue
      left, top, right, bottom = (
        xs.start + x0,
        ys.start + y0,
        xs.stop + x0,
        ys.stop + y0,
      )
      rects.append(
        [
          [round(v, 2) for v in world(i, j)]
          for i, j in [(left, top), (right, top), (right, bottom), (left, bottom)]
        ]
      )
  assert 28 < len(rects) < 200
  return {
    "source": SOURCE,
    "licence": "dl-de-zero-2.0",
    "sha256": hashlib.sha256(image.read_bytes()).hexdigest(),
    "gridM": 0.5,
    "site": "way/89793912",
    "fields": rects,
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("image", type=Path)
  parser.add_argument("output", type=Path)
  opt = parser.parse_args()
  opt.output.write_text(json.dumps(trace(opt.image), separators=(",", ":")) + "\n")
