"""Step 10: source-bound THF entrance and west-pointing airlift memorial."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/tempelhof-v261-source.json"
OUTPUT = ROOT / "src/app/src/data/tempelhofV261.json"


def profile(y: float) -> tuple[float, float, float]:
  """Photographic profile estimate inside published overall 20 x 7 x 6 m."""
  t = max(0.0, min(1.0, (y - 0.42) / 19.58))
  # West is negative X; all three tips share the westward bend.
  back = 0.60 - 4.08 * t**2.35
  front = back - (0.62 - 0.20 * t)
  half_width = 2.40 + 1.10 * t
  return front, back, half_width


def build() -> dict:
  """Create bounded additive geometry, preserving every earlier airport sheet."""
  source = json.loads(SOURCE.read_text())
  old = ROOT / "geo_data/regierungsviertel" / source["previousSource"]
  assert hashlib.sha256(old.read_bytes()).hexdigest() == source["previousSourceSha256"]
  ax, ground, az = source["monument"]["anchor"]
  triangles: list[list] = []
  blocks: list[list] = []
  concrete, side, bronze, stone = 0xC4C4BB, 0xB1B3AD, 0x70988C, 0x969B91

  def pt(x: float, y: float, z: float) -> list[float]:
    return [round(ax + x, 5), round(ground + y, 5), round(az + z, 5)]

  def quad(a: list, b: list, c: list, d: list, color: int) -> None:
    triangles.extend([[color, a, b, c], [color, a, c, d]])

  def strip(lo: float, hi: float, fraction_lo: float, fraction_hi: float) -> None:
    a, b, w = profile(lo)
    c, d, v = profile(hi)
    # Thin web plus three proud structural ribs, never three detached sticks.
    corners0 = [
      pt(a, lo, w * fraction_lo),
      pt(b, lo, w * fraction_lo),
      pt(b, lo, w * fraction_hi),
      pt(a, lo, w * fraction_hi),
    ]
    corners1 = [
      pt(c, hi, v * fraction_lo),
      pt(d, hi, v * fraction_lo),
      pt(d, hi, v * fraction_hi),
      pt(c, hi, v * fraction_hi),
    ]
    for i in range(4):
      j = (i + 1) % 4
      quad(
        corners0[i],
        corners0[j],
        corners1[j],
        corners1[i],
        concrete if i in (1, 3) else side,
      )
    if lo == 0.42:
      quad(*corners0, side)
    if hi in (17.2, 20.0):
      quad(*corners1, concrete)

  ys = [0.42 + i * (17.2 - 0.42) / 42 for i in range(43)]
  for lo, hi in zip(ys, ys[1:]):
    strip(lo, hi, -1, 1)
  # Exactly three separated ribs above the web; the side ribs splay apart.
  for f in [-0.9, 0.0, 0.9]:
    for i in range(8):
      strip(17.2 + i * 2.8 / 8, 17.2 + (i + 1) * 2.8 / 8, f - 0.10, f + 0.10)
    for lo, hi in zip(ys, ys[1:]):
      a, _, w = profile(lo)
      b, _, v = profile(hi)
      quad(
        pt(a - 0.10, lo, w * (f - 0.10)),
        pt(a - 0.10, lo, w * (f + 0.10)),
        pt(b - 0.10, hi, v * (f + 0.10)),
        pt(b - 0.10, hi, v * (f - 0.10)),
        side,
      )

  # Half-round southern base edge, shallow rear return; dimensions are estimates.
  base = [
    [2.1 * math.cos(i * math.pi / 40), 3.5 * math.sin(i * math.pi / 40)]
    for i in range(41)
  ]
  base.extend([[-2.1, -2.5], [2.1, -2.5], base[0]])
  for a, b in zip(base, base[1:]):
    quad(
      pt(a[0], 0, a[1]),
      pt(b[0], 0, b[1]),
      pt(b[0], 0.42, b[1]),
      pt(a[0], 0.42, a[1]),
      stone,
    )
    triangles.append(
      [stone, pt(0, 0.42, 0.4), pt(a[0], 0.42, a[1]), pt(b[0], 0.42, b[1])]
    )
  for i in range(40):
    a, b = base[i], base[i + 1]
    quad(
      pt(a[0] * 1.005, 0.06, a[1] * 1.005),
      pt(b[0] * 1.005, 0.06, b[1] * 1.005),
      pt(b[0] * 1.005, 0.38, b[1] * 1.005),
      pt(a[0] * 1.005, 0.38, a[1] * 1.005),
      bronze,
    )

  # Independent orthogonal cross-section construction: horizontal rows, no smooth
  # triangle conversion. The two air gaps above the web stay open in Minecraft.
  for i in range(50):
    lo = 0.42 + i * 19.58 / 50
    hi = 0.42 + (i + 1) * 19.58 / 50
    y = (lo + hi) / 2
    front, back, width = profile(y)
    spans = (
      [(-width, width)]
      if y < 17.2
      else [((f - 0.10) * width, (f + 0.10) * width) for f in [-0.9, 0, 0.9]]
    )
    for z0, z1 in spans:
      blocks.append(
        [
          ax + (front + back) / 2,
          ground + y,
          az + (z0 + z1) / 2,
          back - front + 0.10,
          hi - lo,
          z1 - z0,
          concrete,
        ]
      )
  # Native plinth strips follow the same half-round south edge.
  for i in range(24):
    x = -2.1 + (i + 0.5) * 4.2 / 24
    front = 3.5 * math.sqrt(max(0, 1 - (x / 2.1) ** 2))
    blocks.append(
      [
        ax + x,
        ground + 0.21,
        az + (front - 2.5) / 2,
        4.2 / 24,
        0.42,
        front + 2.5,
        stone,
      ]
    )
    blocks.append([ax + x, ground + 0.22, az + front, 4.2 / 24, 0.32, 0.075, bronze])
  runtime = {
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "front": source["front"],
    "entranceFront": source["entranceFront"],
    "monument": source["monument"],
    "triangles": triangles,
    "blocks": [[round(n, 5) for n in b] for b in blocks],
    "status": source["status"],
  }
  return runtime


def main() -> None:
  """Regenerate only this named compact companion, never earlier airport data."""
  result = build()
  OUTPUT.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      {
        "triangles": len(result["triangles"]),
        "nativeBlocks": len(result["blocks"]),
        "bytes": OUTPUT.stat().st_size,
      }
    )
  )


if __name__ == "__main__":
  main()
