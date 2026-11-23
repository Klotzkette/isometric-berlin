"""Read repeated openings from rectified, source-matched Berlin facade photographs."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from statistics import median

import numpy as np
from PIL import Image
from scipy import ndimage, signal


@dataclass(frozen=True)
class Opening:
  x: float
  y: float
  width: float
  height: float
  color: tuple[int, int, int]
  solidity: float


def opening_candidates(
  image: Image.Image, width_m: float, height_m: float
) -> list[Opening]:
  """Find rectangular darker openings against their local wall in metric coordinates."""
  rgba = np.asarray(image.convert("RGBA"))
  height, width = rgba.shape[:2]
  sx, sy = width / width_m, height / height_m
  if min(sx, sy) < 1.15:
    return []
  valid = rgba[:, :, 3] >= 200
  if not valid.any():
    return []
  rgb = rgba[:, :, :3]
  gray = np.dot(rgb, [0.299, 0.587, 0.114]).astype(np.float32)
  nearest = ndimage.distance_transform_edt(
    ~valid, return_distances=False, return_indices=True
  )
  gray = gray[tuple(nearest)]
  # Closing estimates the surrounding wall in the same lighting. Holes in the
  # supplied texture are excluded from both the measurements and their margins.
  wall = ndimage.grey_closing(
    gray, size=(max(3, round(2.6 * sy)), max(3, round(3.8 * sx)))
  )
  contrast = wall - gray
  interior = ndimage.binary_erosion(valid, iterations=max(1, round(0.15 * min(sx, sy))))
  mask = interior & (
    contrast >= max(16, min(42, float(np.percentile(contrast[valid], 77))))
  )
  labels, _ = ndimage.label(mask)
  found = []
  for label, region in enumerate(ndimage.find_objects(labels), 1):
    if region is None:
      continue
    ys, xs = region
    w, h = (xs.stop - xs.start) / sx, (ys.stop - ys.start) / sy
    if not (0.43 <= w <= 6.2 and 0.48 <= h <= 4.6 and 0.22 <= w / h <= 6):
      continue
    selected = labels[region] == label
    if selected.mean() < 0.47 or not interior[region].all():
      continue
    colour = tuple(int(c) for c in np.median(rgb[region][selected], axis=0))
    found.append(
      Opening(
        (xs.start + xs.stop) / (2 * sx),
        height_m - (ys.start + ys.stop) / (2 * sy),
        w,
        h,
        colour,
        float(selected.mean()),
      )
    )
  return found


def aligned_runs(openings: list[Opening]) -> list[list[Opening]]:
  """Require adjacent, regularly spaced objects of similar height and width."""
  rows: list[list[Opening]] = []
  for box in sorted(openings, key=lambda p: p.y):
    if not rows or box.y - median(b.y for b in rows[-1]) > max(0.34, box.height * 0.25):
      rows.append([])
    rows[-1].append(box)
  runs = []
  for row in rows:
    ordered = sorted(row, key=lambda p: p.x)
    choices = []
    for a, first in enumerate(ordered):
      for b in range(a + 1, len(ordered)):
        second = ordered[b]
        pitch = second.x - first.x
        if pitch > 9.5:
          break
        if pitch < max(0.8, first.width * 0.76):
          continue
        run = [first]
        for target in ordered[b:]:
          expected_x = first.x + len(run) * pitch
          if target.x > expected_x + max(0.18, pitch * 0.15):
            break
          if abs(target.x - expected_x) > max(0.18, pitch * 0.15):
            continue
          if not (
            0.58 <= target.width / first.width <= 1.72
            and 0.64 <= target.height / first.height <= 1.56
          ):
            continue
          run.append(target)
        if len(run) >= 3:
          choices.append(run)
    used = set()
    for run in sorted(choices, key=lambda r: (-len(r), r[0].x)):
      if used.isdisjoint(run):
        runs.append(run)
        used.update(run)
  return runs


def photo_bands(image: Image.Image, width_m: float, height_m: float) -> list[dict]:
  """Encode only visually repeated runs. Missing bays and unsupported rows stay open."""
  if min(width_m, height_m) <= 0:
    return []
  candidates = opening_candidates(image, width_m, height_m)
  runs = aligned_runs(candidates)
  used = set()
  bands = []
  for run in runs:
    count = len(run)
    pitch = (run[-1].x - run[0].x) / (count - 1)
    centre = median(b.y for b in run)
    # Short sequences need a second independently observed storey on the same axes.
    if count < 5:
      supported = any(
        1.8 <= abs(median(b.y for b in other) - centre) <= 6.7
        and sum(any(abs(b.x - o.x) <= 0.25 * pitch for o in other) for b in run) >= 2
        for other in runs
      )
      if not supported:
        continue
    half_cell = pitch / 2
    lo, hi = run[0].x - half_cell, run[-1].x + half_cell
    h = median(b.height for b in run)
    if lo < -0.1 or hi > width_m + 0.1:
      continue
    rgb = np.median([o.color for o in run], axis=0).astype(int)
    color = int(rgb[0]) << 16 | int(rgb[1]) << 8 | int(rgb[2])
    bands.append(
      {
        "kind": "window",
        "columns": count,
        "rows": 1,
        "x": [round(max(0, lo / width_m), 5), round(min(1, hi / width_m), 5)],
        "y": [
          round((centre - h / 2) / height_m, 5),
          round((centre + h / 2) / height_m, 5),
        ],
        "fillX": round(min(0.98, median(b.width for b in run) / pitch), 3),
        "fillY": 1,
        "color": color,
      }
    )
    used.update(run)
  for box in candidates:
    if (
      box in used or box.solidity < 0.72 or not (0.53 <= box.width / box.height <= 2.1)
    ):
      continue
    if box.color[1] > 1.16 * max(box.color[0], box.color[2]):
      continue
    # Isolated dark patches are too ambiguous. A measured opening needs
    # independent peers on both axes with similar aperture and elevation.
    siblings = [
      other
      for other in candidates
      if other is not box
      and other.solidity >= 0.65
      and 0.70 < other.width / box.width < 1.45
      and 0.72 < other.height / box.height < 1.39
    ]
    across = [
      o
      for o in siblings
      if abs(o.y - box.y) < 0.22 * box.height
      and max(0.9, 1.10 * box.width) < abs(o.x - box.x) < 9
    ]
    above = [
      o
      for o in siblings
      if abs(o.x - box.x) < 0.25 * box.width
      and max(1.85, 1.13 * box.height) < abs(o.y - box.y) < 6
    ]
    if not across or not above:
      continue
    r, g, b = box.color
    bands.append(
      dict(
        kind="window",
        columns=1,
        rows=1,
        x=[
          round((box.x - box.width / 2) / width_m, 5),
          round((box.x + box.width / 2) / width_m, 5),
        ],
        y=[
          round((box.y - box.height / 2) / height_m, 5),
          round((box.y + box.height / 2) / height_m, 5),
        ],
        fillX=1,
        fillY=1,
        color=(r << 16) | (g << 8) | b,
      )
    )
  return sorted(bands, key=lambda b: (b["y"][0], b["x"][0]))


def read_photo(path: Path, width_m: float, height_m: float) -> list[dict]:
  with Image.open(path) as image:
    return photo_bands(image, width_m, height_m)


def material_bands(image: Image.Image, width_m: float, height_m: float) -> list[dict]:
  """Find continuous contrasting horizontal strips, without inferring individual panes."""
  rgba = np.asarray(image.convert("RGBA"))
  height, width = rgba.shape[:2]
  sx, sy = width / width_m, height / height_m
  if min(sx, sy) < 1.15 or height_m < 2.4 or width_m < 6.5:
    return []
  rgb = rgba[:, :, :3].astype(float)
  valid = rgba[:, :, 3] > 200
  luminance = rgb @ [0.299, 0.587, 0.114]
  # Tree crowns obscure several archive façades. Reject green-dominant strips.
  valid &= ~(
    (rgb[:, :, 1] > rgb[:, :, 0] * 1.12) & (rgb[:, :, 1] > rgb[:, :, 2] * 1.18)
  )
  cap = max(1, round(0.5 * sy))
  tall = max(cap + 1, round(3.35 * sy))
  # Neighbouring strips must have a consistent change of tone across nearly
  # their entire width, so a lone shadow or one opening cannot create a ribbon.
  strips = []
  division = max(1, int(width_m // 12))
  cuts = np.round(np.linspace(0, width, division + 1)).astype(int)
  for left, right in zip(cuts, cuts[1:]):
    slab = luminance[:, left:right]
    vis = valid[:, left:right]
    enough = vis.mean(axis=1) > 0.94
    if enough.sum() < tall:
      continue
    scan = np.median(slab, axis=1)
    across = ndimage.grey_closing(slab, size=(2 * tall + 1, 1)) - slab
    # The local upper envelope in every column also works on sloping exposure.
    dark = (
      (np.median(across, axis=1) > 23) & ((across > 15).mean(axis=1) > 0.78) & enough
    )
    label, n = ndimage.label(dark)
    for group in range(1, n + 1):
      rows = np.nonzero(label == group)[0]
      lo, hi = rows[0], rows[-1] + 1
      if (
        not max(2, round(0.30 * sy)) <= hi - lo <= round(2.8 * sy)
        or lo < cap
        or hi + cap > height
      ):
        continue
      if not enough[lo - cap : hi + cap].all():
        continue
      # A real dark layer must be bounded on both sides by a brighter wall.
      tone = np.median(scan[lo:hi])
      if (
        min(np.median(scan[lo - cap : lo]), np.median(scan[hi : hi + cap])) - tone < 12
      ):
        continue
      pixels = rgb[lo:hi, left:right].reshape(-1, 3)
      colour = np.median(pixels, axis=0).astype(int)
      color = int(colour[0]) << 16 | int(colour[1]) << 8 | int(colour[2])
      # Distinguish a subdivided band from solid cladding only where narrow
      # bright mullions recur through the band at an observed physical pitch.
      curve = np.median(slab[lo:hi], axis=0)
      peaks, _ = signal.find_peaks(
        curve,
        prominence=max(10, float(np.ptp(curve)) * 0.20),
        distance=max(2, round(0.50 * sx)),
      )
      spaces = np.diff(peaks) / sx
      regular = (
        len(spaces) >= 3
        and 0.82 <= np.median(spaces) <= 3.95
        and np.max(abs(spaces - np.median(spaces))) < 0.24 * np.median(spaces)
      )
      if regular:
        positions = (peaks + 0.5 + left) / width
        strips.append(
          dict(
            kind="glazing",
            columns=len(peaks) - 1,
            rows=1,
            x=[round(float(positions[0]), 5), round(float(positions[-1]), 5)],
            y=[round(1 - hi / height, 5), round(1 - lo / height, 5)],
            color=color,
            fillX=0.92,
            fillY=1,
          )
        )
      else:
        strips.append(
          dict(
            kind="spandrel",
            columns=1,
            rows=1,
            x=[round(left / width, 5), round(right / width, 5)],
            y=[round(1 - hi / height, 5), round(1 - lo / height, 5)],
            color=color,
            fillX=1,
            fillY=1,
          )
        )
  return strips


def structural_bands(image: Image.Image, width_m: float, height_m: float) -> list[dict]:
  """Read both horizontal layers and vertical structural/cladding divisions."""
  horizontal = material_bands(image, width_m, height_m)
  # Transposition exchanges image rows and columns. Convert both bottom-up
  # coordinates back to the source orientation. These dark features remain
  # opaque; a vertically streaked material does not establish fenestration.
  vertical = material_bands(
    image.transpose(Image.Transpose.TRANSPOSE), height_m, width_m
  )
  for band in vertical:
    if band["kind"] != "spandrel":
      continue
    x, y = band["x"], band["y"]
    ob = {
      **band,
      "kind": "pier",
      "x": [round(1 - y[1], 5), round(1 - y[0], 5)],
      "y": [round(1 - x[1], 5), round(1 - x[0], 5)],
    }
    if (ob["x"][1] - ob["x"][0]) * width_m <= 1.9:
      horizontal.append(ob)
  return horizontal
