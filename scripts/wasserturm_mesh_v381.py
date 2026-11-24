"""Indexed centimetre geometry for the park and its architectural details."""

import math

import numpy as np
from build_prenzlauer_streets_v380 import Packet


class Model(Packet):
  def __init__(self):
    super().__init__(6, -4)
    self.origin = [3190, 0, -1570]

  def quad(self, a, b, c, d, color):
    self.facet([a, b, c], color)
    self.facet([a, c, d], color)

  def box(self, x, y, z, w, h, d, angle, color):
    ca, sa = math.cos(angle), math.sin(angle)

    def p(i, j, k):
      xx = w * i * 0.5
      zz = d * k * 0.5
      return (x + ca * xx - sa * zz, y + h * j * 0.5, z + sa * xx + ca * zz)

    lower = [p(i, -1, k) for i, k in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
    upper = [p(i, 1, k) for i, k in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
    self.quad(*upper, color)
    for i in range(4):
      j = (i + 1) % 4
      self.quad(lower[i], lower[j], upper[j], upper[i], shade(color, 0.91 + 0.035 * i))

  def ring(self, x, z, lo, hi, r1, r2, segments, tone, cap=False, phase=0):
    def p(i, y, r):
      a = phase + i * 2 * math.pi / segments
      return x + r * math.cos(a), y, z + r * math.sin(a)

    for i in range(segments):
      a, b, c, d = p(i, lo, r1), p(i + 1, lo, r1), p(i + 1, hi, r2), p(i, hi, r2)
      self.quad(
        a,
        b,
        c,
        d,
        shade(tone, 0.92 + 0.07 * math.sin((i + 0.5) * 2 * math.pi / segments - 0.7)),
      )
      if cap:
        self.facet([(x, hi, z), d, c], tone)


def shade(color, scale):
  return sum(
    min(255, round(((color >> shift) & 255) * scale)) << shift for shift in (16, 8, 0)
  )


def roof_profile(r):
  if r <= 1.02:
    return 49.38
  if r <= 9.12:
    return 43.42 - (r - 1.02) * 0.652
  return 32.33


def crown(native):
  m = Model()
  x, z = 3236.36, -1629.52
  if native:
    # Cardinal, hollow crown. Only cells with a visible top or an exterior step emit geometry.
    step = 0.5
    rows = {}
    for i in range(-24, 24):
      for k in range(-24, 24):
        r = math.hypot((i + 0.5) * step, (k + 0.5) * step)
        if r <= 11.76:
          rows[i, k] = round(roof_profile(r) * 4) / 4
    for (i, k), y in rows.items():
      a = x + i * step
      b = z + k * step
      r = math.hypot((i + 0.5) * step, (k + 0.5) * step)
      tone = 0x8F644D if r < 1.03 else 0x736E69 if r < 9.13 else 0xB6A38B
      m.quad(
        (a, y, b), (a, y, b + step), (a + step, y, b + step), (a + step, y, b), tone
      )
      for di, dk, left, right in [
        (0, -1, (a, b), (a + step, b)),
        (1, 0, (a + step, b), (a + step, b + step)),
        (0, 1, (a + step, b + step), (a, b + step)),
        (-1, 0, (a, b + step), (a, b)),
      ]:
        low = rows.get((i + di, k + dk), 31.58)
        if low >= y:
          continue
        wall = 0xA28B67 if r < 9.13 and low < 33 else tone
        m.quad(
          (left[0], low, left[1]),
          (right[0], low, right[1]),
          (right[0], y, right[1]),
          (left[0], y, left[1]),
          shade(wall, 0.94 if di else 1.0),
        )
  else:
    m.ring(x, z, 31.56, 32.33, 11.73, 11.76, 60, 0xB3A08B, True)
    m.ring(x, z, 32.33, 37.92, 9.08, 9.08, 20, 0xC0A980, False, math.pi / 20)
    m.ring(x, z, 37.92, 38.14, 9.09, 9.18, 20, 0x645E58, False, math.pi / 20)
    m.ring(x, z, 38.14, 43.42, 9.18, 1.02, 20, 0x77716D, True, math.pi / 20)
    m.ring(x, z, 43.40, 48.83, 0.87, 0.88, 16, 0x966B4F)
    m.ring(x, z, 48.79, 49.38, 0.93, 1.01, 16, 0x856349, True)
    m.ring(x, z, 49.38, 49.39, 0.65, 0.65, 16, 0x49433B, True)
  # Paired top-storey lights and slender pale pilasters from the public street photograph.
  for j in range(20):
    ang = j * 2 * math.pi / 20
    n = (math.cos(ang), math.sin(ang))
    t = (-n[1], n[0])

    def panel(u, v, w, h, r, c):
      xx = x + n[0] * r + t[0] * u
      zz = z + n[1] * r + t[1] * u
      if native:
        # Place each bay on its own exterior cardinal terrace, facing out.
        if abs(n[0]) >= abs(n[1]):
          iz = math.floor((zz - z) / 0.5)
          inside = [
            i for (i, k), height in rows.items() if k == iz and 37 < height < 48
          ]
          if not inside:
            return
          edge = (max(inside) + 1 if n[0] > 0 else min(inside)) * 0.5
          xx = x + edge + (0.025 if n[0] > 0 else -0.025) * (1 + (r - 9) * 20)
          a = math.pi / 2
        else:
          ix = math.floor((xx - x) / 0.5)
          inside = [
            k for (i, k), height in rows.items() if i == ix and 37 < height < 48
          ]
          if not inside:
            return
          edge = (max(inside) + 1 if n[1] > 0 else min(inside)) * 0.5
          zz = z + edge + (0.025 if n[1] > 0 else -0.025) * (1 + (r - 9) * 20)
          a = 0
      else:
        a = ang + math.pi / 2
      m.box(xx, v, zz, w, h, 0.055, a, c)

    panel(0, 35.12, 1.69, 3.52, 9.04, 0xE1C7A1)
    for u in [-0.37, 0.37]:
      panel(u, 35.14, 0.61, 3.12, 9.10, 0x626D70)
      panel(u, 35.63, 0.62, 0.10, 9.14, 0xAE9780)
    panel(1.29, 35.12, 0.13, 5.32, 9.03, 0xD6C099)
  # The projecting corbel band sits directly below the smaller glazed drum.
  for j in range(72):
    a = j * math.pi / 36
    nx, nz = math.cos(a), math.sin(a)
    if native:
      # Place the ornament on the exposed face of the retained block shaft.
      if abs(nx) > abs(nz):
        xx = x + math.copysign(abs(round(11.80 * nx * 2) / 2) + 0.22, nx)
        zz = z + 11.80 * nz
        angle = math.pi / 2
      else:
        xx = x + 11.80 * nx
        zz = z + math.copysign(abs(round(11.80 * nz * 2) / 2) + 0.22, nz)
        angle = 0
    else:
      xx = x + nx * 11.89
      zz = z + nz * 11.89
      angle = a + math.pi / 2
    m.box(xx, 30.85, zz, 0.29, 0.74, 0.12, angle, 0x846E58)
    m.box(xx + nx * 0.07, 31.23, zz + nz * 0.07, 0.42, 0.18, 0.17, angle, 0xB79D7C)
  return m


def main_tower(src, native, root):
  import json

  import shapely as sh
  from shapely.geometry import Polygon, box

  m = crown(native)
  x, z = 3236.36, -1629.52
  walltone = 0xB09A70
  if native:
    rows = json.loads(
      (root / "src/app/src/data/centralNamedV230Native.json").read_bytes()
    )["sites"][0]["blocks"]
    base_shape = sh.union_all(
      [
        box(xx - w / 2, zz - d / 2, xx + w / 2, zz + d / 2)
        for xx, y, zz, w, h, d, c in rows
        if y - h / 2 <= 15 < y + h / 2
      ]
    )
    outer = max(sh.get_parts(base_shape), key=lambda g: g.area)
    for xx, y, zz, w, h, d, c in rows:
      lo = y - h / 2
      hi = min(y + h / 2, 31.62)
      if hi > lo:
        m.box(xx, (lo + hi) / 2, zz, w, hi - lo, d, 0, walltone)
  else:
    old = json.loads(
      (root / "src/app/src/data/centralNamedV230Envelopes.json").read_bytes()
    )["sites"][0]
    outer = sh.union_all(
      [
        Polygon([(xx, zz) for xx, _, zz in rs[0]])
        for k, rs in src["buildings"]["137353386"][0]["surfaces"]
        if k == "GroundSurface"
      ]
    )
    for surface in old["surfaces"]:
      if surface.get("sourceKind") != "WallSurface":
        continue
      for tri in surface["triangles"]:
        ring = []
        for a, b in zip(tri, tri[1:] + tri[:1]):
          if a[1] <= 31.62:
            ring.append(a)
          if (a[1] - 31.62) * (b[1] - 31.62) < 0:
            frac = (31.62 - a[1]) / (b[1] - a[1])
            ring.append([a[k] + frac * (b[k] - a[k]) for k in range(3)])
        for j in range(1, len(ring) - 1):
          mid = np.mean([ring[0], ring[j], ring[j + 1]], axis=0)
          phi = math.atan2(mid[2] - z, mid[0] - x)
          m.facet(
            [ring[0], ring[j], ring[j + 1]],
            shade(walltone, 0.95 + 0.075 * math.sin(phi - 0.5)),
          )
  # The six residential levels preserve the known angular axes. The oblique
  # photograph shows paired arched sashes and broad, recessed brick fields.
  perimeter = list(outer.exterior.coords)
  for k in range(12):
    phi = math.radians(35 + k * 30)
    nx, nz = math.cos(phi), math.sin(phi)
    tx, tz = -nz, nx
    edges = []
    for a, b in zip(perimeter, perimeter[1:]):
      mx, mz = (a[0] + b[0]) / 2 - x, (a[1] + b[1]) / 2 - z
      if mx * nx + mz * nz < 10 or abs(mx * tx + mz * tz) > 5.0:
        continue
      ex, ez = b[0] - a[0], b[1] - a[1]
      le = math.hypot(ex, ez)
      if le < 0.01:
        continue
      onx, onz = -ez / le, ex / le
      if onx * mx + onz * mz < 0:
        onx, onz = -onx, -onz
      ua = (a[0] - x) * tx + (a[1] - z) * tz
      ub = (b[0] - x) * tx + (b[1] - z) * tz
      if abs(ub - ua) < 0.02 or onx * nx + onz * nz < 0.25:
        continue
      edges.append((a, b, ua, ub, onx, onz))

    def strip(lo, hi, y0, y1, y2, y3, tone, out):
      for a, b, ua, ub, onx, onz in edges:
        left = max(lo, min(ua, ub))
        right = min(hi, max(ua, ub))
        if right - left < 0.015:
          continue

        def pt(u, v0, v1):
          t = (u - ua) / (ub - ua)
          y = v0 + (v1 - v0) * (u - lo) / (hi - lo)
          return (
            a[0] + (b[0] - a[0]) * t + onx * out,
            y,
            a[1] + (b[1] - a[1]) * t + onz * out,
          )

        m.quad(
          pt(left, y0, y1), pt(right, y0, y1), pt(right, y2, y3), pt(left, y2, y3), tone
        )

    def rect(left, right, low, hi, tone, out):
      strip(left, right, low, low, hi, hi, tone, out)

    rect(-1.94, 1.94, 3.62, 29.6, 0xAB9368, 0.055)
    for sign in [-1, 1]:
      u = sign * 2.47
      rect(u - 0.16, u + 0.16, 3.45, 29.84, 0xBCA67D, 0.14)
    for story in range(6):
      y = 5.65 + story * 4.15
      rect(-1.44, 1.44, y - 1.33, y - 1.13, 0x8C795B, 0.20)
      for u in [-0.64, 0.64]:
        for j in range(6):

          def top(f):
            return y + 0.94 + 0.24 * math.sqrt(max(0, 1 - (2 * f - 1) ** 2))

          t0 = j / 6
          t1 = (j + 1) / 6
          strip(
            u - 0.60 + t0 * 1.20,
            u - 0.60 + t1 * 1.20,
            y - 1.11,
            y - 1.11,
            top(t0),
            top(t1),
            0x726558,
            0.20,
          )
        rect(u - 0.47, u + 0.47, y - 1.05, y + 0.83, 0x647071, 0.23)
        rect(u - 0.026, u + 0.026, y - 1.04, y + 0.84, 0x958372, 0.26)
        rect(u - 0.48, u + 0.48, y + 0.20, y + 0.26, 0xA18D77, 0.27)
      for j in range(8):

        def head(u):
          return y + 1.26 + 0.22 * math.sin(math.pi * u)

        t0 = j / 8
        t1 = (j + 1) / 8
        strip(
          -1.4 + t0 * 2.8,
          -1.4 + t1 * 2.8,
          head(t0),
          head(t1),
          head(t0) + 0.17,
          head(t1) + 0.17,
          0x967B58,
          0.20,
        )
  return m
