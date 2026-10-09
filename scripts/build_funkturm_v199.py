"""Step 10: bounded Funkturm fittings; all v179/v182/v187 geometry stays exact."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
GROUND = 3.55
STEEL, PALE, GLASS, DARK = 0x9F9E91, 0xD5D2C5, 0x577681, 0x5C635E


def build_model(native: bool = False) -> dict:
  anchor = next(
    a
    for a in json.loads((GEO / "outer-thin-outlines-v179.json").read_text())["anchors"]
    if a["name"] == "Funkturm"
  )
  east, north = Transformer.from_crs(4326, 25833, always_xy=True).transform(
    anchor["lon"], anchor["lat"]
  )
  cx, cz = east - 389500, 5820000 - north
  groups = []
  out = None

  def group(name):
    nonlocal out
    out = {
      "name": name,
      "boxes": [],
      "rods": [],
      "positions": [],
      "colors": [],
      "indices": [],
    }
    groups.append(out)

  def box(x, y, z, w, h, d, color=STEEL):
    out["boxes"].append(
      [round(cx + x, 5), round(GROUND + y, 5), round(cz + z, 5), w, h, d, color]
    )

  def rod(a, b, width=0.06, color=STEEL):
    if native:
      delta = [b[i] - a[i] for i in range(3)]
      count = max(1, math.ceil(max(abs(v) for v in delta) / 0.38))
      for i in range(count):
        box(
          *[a[k] + delta[k] * (i + 0.5) / count for k in range(3)],
          *[max(width, abs(delta[k]) / count) for k in range(3)],
          color,
        )
    else:
      out["rods"].append(
        [
          round(cx + a[0], 5),
          round(GROUND + a[1], 5),
          round(cz + a[2], 5),
          round(cx + b[0], 5),
          round(GROUND + b[1], 5),
          round(cz + b[2], 5),
          width,
          color,
        ]
      )

  def quad(points, color):
    assert not native
    base = len(out["positions"]) // 3
    for x, y, z in points:
      out["positions"].extend(
        [round(cx + x, 5), round(GROUND + y, 5), round(cz + z, 5)]
      )
      out["colors"].append(color)
    out["indices"].extend([base, base + 1, base + 2, base, base + 2, base + 3])

  def shell(y0, y1, w0, w1, color):
    # Thin four-sided slanted fascia, independent horizontal native courses.
    if native:
      count = max(1, math.ceil((y1 - y0) / 0.24))
      for i in range(count):
        y = y0 + (y1 - y0) * (i + 0.5) / count
        w = w0 + (w1 - w0) * (i + 0.5) / count
        for sign in [-1, 1]:
          box(0, y, sign * w / 2, w, 0.24, 0.12, color)
          box(sign * w / 2, y, 0, 0.12, 0.24, w, color)
    else:
      a, b = w0 / 2, w1 / 2
      for sign in [-1, 1]:
        quad(
          [
            [-a, y0, sign * a],
            [a, y0, sign * a],
            [b, y1, sign * b],
            [-b, y1, sign * b],
          ],
          color,
        )
        quad(
          [
            [sign * a, y0, -a],
            [sign * a, y0, a],
            [sign * b, y1, b],
            [sign * b, y1, -b],
          ],
          color,
        )

  def ring(y, width, depth, height, color):
    for sign in [-1, 1]:
      box(0, y, sign * (width - depth) / 2, width, height, depth, color)
      box(sign * (width - depth) / 2, y, 0, depth, height, width - 2 * depth, color)

  def posts(y, width, height, count, color):
    for sign in [-1, 1]:
      for i in range(count + 1):
        u = width * (i / count - 0.5)
        box(u, y + height / 2, sign * width / 2, 0.045, height, 0.045, color)
        box(sign * width / 2, y + height / 2, u, 0.045, height, 0.045, color)
    ring(y + height, width + 0.045, 0.045, 0.045, color)

  def bearing(x, z):
    # Original tower leg remains. New displayed concrete/porcelain/steel bearing
    # replaces no source vertex; dimensions absent from OSM remain estimates.
    box(x, 0.18, z, 3.5, 0.36, 3.5, 0xA8A69A)
    box(x, 0.46, z, 1.6, 0.15, 1.6, STEEL)
    for dx in [-0.52, 0.52]:
      for dz in [-0.52, 0.52]:
        for y, r in [(0.65, 0.29), (0.81, 0.24), (0.97, 0.29)]:
          if native:
            box(x + dx, y, z + dz, 2 * r, 0.16, 2 * r, PALE)
          else:
            for j in range(8):
              a, b = j * math.tau / 8, (j + 1) * math.tau / 8
              quad(
                [
                  [x + dx + r * math.cos(a), y - 0.08, z + dz + r * math.sin(a)],
                  [x + dx + r * math.cos(b), y - 0.08, z + dz + r * math.sin(b)],
                  [x + dx + r * math.cos(b), y + 0.08, z + dz + r * math.sin(b)],
                  [x + dx + r * math.cos(a), y + 0.08, z + dz + r * math.sin(a)],
                ],
                PALE,
              )
    box(x, 1.1, z, 1.65, 0.16, 1.65, STEEL)
    for sign in [-1, 1]:
      box(x + sign * 0.79, 1.02, z, 0.075, 0.25, 1.75, STEEL)
      box(x, 1.02, z + sign * 0.79, 1.75, 0.25, 0.075, STEEL)
      for corner in [-1, 1]:
        box(x + sign * 0.79, 0.82, z + corner * 0.79, 0.065, 0.76, 0.065, STEEL)
      for u in [-0.55, 0, 0.55]:
        box(x + u, 1.21, z + sign * 0.73, 0.09, 0.08, 0.09, PALE)
        box(x + sign * 0.73, 1.21, z + u, 0.09, 0.08, 0.09, PALE)

  group("Four existing-foot steel and porcelain bearings")
  for sx in [-1, 1]:
    for sz in [-1, 1]:
      bearing(sx * 10, sz * 10)

  group("Open stair flights beside retained lift")
  # The operator documents 610 stairs. This finite outside stair reading has
  # repeated treads/landings, not a surveyed reconstruction of every step.
  flights = 30
  for k in range(flights):
    y0 = 1.25 + k * 4.1
    y1 = y0 + 4.1
    extent = 2.75 if y1 < 55 else 1.85
    side = -1 if k % 2 == 0 else 1
    x0, x1 = (-extent, extent) if side < 0 else (extent, -extent)
    z = side * (1.4 if y1 < 55 else 1.05)
    steps = 20
    for j in range(steps):
      x = x0 + (x1 - x0) * (j + 0.5) / steps
      box(
        x,
        y0 + (y1 - y0) * (j + 1) / steps,
        z,
        abs(x1 - x0) / steps + 0.025,
        0.075,
        0.72,
        0x848980,
      )
    for dz in [-0.36, 0.36]:
      rod([x0, y0, z + dz], [x1, y1, z + dz], 0.095, DARK)
      rod([x0, y0 + 0.95, z + dz], [x1, y1 + 0.95, z + dz], 0.055, STEEL)
      for i in range(5):
        t = i / 4
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        rod([x, y, z + dz], [x, y + 0.95, z + dz], 0.045, STEEL)
    box(x1, y1, z * 0.5, 0.9, 0.10, abs(z) + 0.7, DARK)

  group("Restaurant kitchen, inclined glazing and canopy rim")
  # Existing restaurant glass is retained behind this gently splayed skin;
  # the new broad canopy is a ring outside the old 15.9 m roof, not a double slab.
  shell(51.35, 52.4, 9.1, 9.1, PALE)
  shell(52.4, 53.65, 9.12, 9.12, GLASS)
  ring(53.7, 9.4, 0.22, 0.16, PALE)
  for sign in [-1, 1]:
    for i in range(9):
      u = (i / 8 - 0.5) * 9.1
      box(u, 53.02, sign * 4.62, 0.065, 1.3, 0.08, PALE)
      box(sign * 4.62, 53.02, u, 0.08, 1.3, 0.065, PALE)
  shell(55.18, 58.02, 15.25, 16.85, GLASS)
  ring(55.08, 15.55, 0.22, 0.22, PALE)
  shell(58.03, 58.32, 16.9, 18.7, PALE)
  ring(58.4, 18.7, 1.4, 0.20, 0xA9A99F)
  ring(58.52, 18.75, 0.08, 0.10, DARK)
  for sign in [-1, 1]:
    for i in range(17):
      t = i / 16 - 0.5
      rod(
        [15.25 * t, 55.2, sign * 7.625], [16.85 * t, 58.07, sign * 8.425], 0.085, PALE
      )
      rod(
        [sign * 7.625, 55.2, 15.25 * t], [sign * 8.425, 58.07, 16.85 * t], 0.085, PALE
      )
  posts(58.62, 18.5, 0.45, 24, STEEL)
  for sx in [-1, 1]:
    for sz in [-1, 1]:
      rod([sx * 8.5, 58.6, sz * 8.5], [sx * 8.5, 60.15, sz * 8.5], 0.07, STEEL)
      box(sx * 8.5, 60.18, sz * 8.5, 0.17, 0.22, 0.17, 0xAC5947)

  group("Upper platform guardrails and existing mast aerials")
  # Retain earlier ten-metre platform as-is; no hidden replacement/deletion.
  posts(128.36, 10.55, 1.12, 18, STEEL)
  ring(128.95, 10.6, 0.045, 0.045, STEEL)
  for y, width in [(132, 2.7), (136, 1.7)]:
    ring(y, width, 0.08, 0.08, STEEL)
    for sign in [-1, 1]:
      rod(
        [sign * width / 2, y, -width / 2],
        [sign * width / 2, y + 1.0, width / 2],
        0.055,
        STEEL,
      )
  for y, arm in [(135, 2.2), (139, 1.7), (142, 1.2)]:
    rod([-arm, y, 0], [arm, y, 0], 0.075, DARK)
    for x in [-arm, arm]:
      rod([x, y - 0.55, -0.48], [x, y + 0.55, 0.48], 0.05, STEEL)
  return {"anchor": [cx, GROUND, cz], "groups": groups}


def build() -> None:
  counts = {}
  for native, name in [(False, "funkturmV199.json"), (True, "funkturmV199Native.json")]:
    model = build_model(native)
    (DATA / name).write_text(json.dumps(model, separators=(",", ":")) + "\n")
    counts["native" if native else "drawn"] = {
      kind: sum(
        len(g[kind]) // (3 if kind == "indices" else 1) for g in model["groups"]
      )
      for kind in ["boxes", "rods", "indices"]
    }
  prior = [
    "geo_data/regierungsviertel/outer-thin-outlines-v179.json",
    "src/app/src/data/cityRecognitionV182.json",
    "src/app/src/data/westLandmarksV187.json",
    "geo_data/regierungsviertel/west-landmarks-v187-source.json",
  ]
  evidence = {
    "version": "1.0.99",
    "anchorOwner": "way/30926247",
    "anchor": model["anchor"],
    "operatorLevelsM": {"restaurant": 55, "observation": 126, "tip": 147},
    "preservedInputs": {
      p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in prior
    },
    "counts": counts,
    "displayEstimates": "All local fittings, member sections, tread count, kitchen dimensions, glazing splay and canopy width are photo-informed procedural readings; original operator height profile and all previous geometry remain unchanged.",
  }
  (GEO / "funkturm-v199-evidence.json").write_text(
    json.dumps(evidence, indent=2) + "\n"
  )
  print(counts)


if __name__ == "__main__":
  build()
