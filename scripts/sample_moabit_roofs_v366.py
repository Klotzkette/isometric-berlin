"""Sample interior roof midtones on positively identified ordinary Moabit housing."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from shapely import contains_xy
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
# 0.5 m pixels, EPSG:25833; image north is up, world z increases south.
X_MIN, Z_MIN, X_MAX, Z_MAX = -1600, -1700, -500, -450
SOURCE_URL = (
  "https://gdi.berlin.de/services/wms/truedop_2026?"
  "service=WMS&version=1.3.0&request=GetMap&layers=truedop_2026&styles="
  "&crs=EPSG:25833&bbox=387900,5820450,389000,5821700"
  "&width=2200&height=2500&format=image/png"
)


def roof_sample(values: np.ndarray) -> tuple[list[int], int] | None:
  """Exclude trees and mixed, heavily shaded or reflective samples."""
  if len(values) < 80:
    return None
  r, g, b = values.astype(float).T
  brightness = 0.213 * r + 0.715 * g + 0.072 * b
  mask = (brightness > 42) & (brightness < 228)
  mask &= ~((g > r * 1.08) & (g > b * 1.12))
  if np.count_nonzero(mask) < max(80, len(values) * 0.80):
    return None
  central = values[mask]
  if np.max(np.ptp(np.quantile(central, [0.20, 0.80], axis=0), axis=0)) > 42:
    return None
  median = np.median(central, axis=0)
  # Pick a colour actually observed in the roof, including its channel ratios.
  rgb = central[np.argmin(np.sum(np.abs(central - median), axis=1))]
  return rgb.tolist(), len(central)


def geometry_signature(part: dict) -> list[int]:
  """Same source guard as exactCoreHouseRow, including all courtyard rings."""
  fields = ",".join(str(part.get(k, 0)) for k in ("y0_dm", "h_dm", "class", "roof"))
  rings = "".join(
    "[" + "".join(f"{x},{z};" for x, z in ring) + "]"
    for ring in [part["ring"], *part.get("holes", [])]
  )
  encoded = (
    fields + ";" + rings + ";" + ",".join(map(str, part.get("tone", [])))
  ).encode("ascii")
  a, b = 2166136261, 2246822519
  for value in encoded:
    a = ((a ^ value) * 16777619) & 0xFFFFFFFF
    b = ((b ^ value) * 16777619) & 0xFFFFFFFF
  return [a, b]


def compile_roofs(path: Path) -> tuple[dict, dict]:
  image = np.asarray(Image.open(path).convert("RGB"))
  if image.shape != (2500, 2200, 3):
    raise ValueError("Unexpected Berlin orthophoto bounds or resolution")
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
  )["buildings"]
  ordinary = json.loads((DATA / "coreHouseColoursV273.json").read_bytes())["owners"]
  results, counts = {}, {}
  for part in prisms:
    identifier = part["id"]
    previous = ordinary.get(identifier, [])
    if len(previous) != 1 or previous[0][3] < 0 or previous[0][5] < 0:
      continue
    if not all(
      X_MIN < x / 10 < X_MAX and Z_MIN < z / 10 < Z_MAX for x, z in part["ring"]
    ):
      continue
    if geometry_signature(part) != previous[0][:2]:
      continue
    ring = [(x / 10, z / 10) for x, z in part["ring"]]
    holes = [[(x / 10, z / 10) for x, z in hole] for hole in part.get("holes", [])]
    shape = Polygon(ring, holes)
    if not shape.is_valid:
      continue
    inside = shape.buffer(-2.0)
    if inside.is_empty or inside.area < 35:
      continue
    x0, z0, x1, z1 = inside.bounds
    xi = np.arange(math.floor((x0 - X_MIN) * 2), math.ceil((x1 - X_MIN) * 2))
    zi = np.arange(math.floor((z0 - Z_MIN) * 2), math.ceil((z1 - Z_MIN) * 2))
    x, z = np.meshgrid(xi, zi)
    mask = contains_xy(inside, X_MIN + (x + 0.5) / 2, Z_MIN + (z + 0.5) / 2)
    sample = roof_sample(image[z[mask], x[mask]])
    if sample:
      (r, g, b), count = sample
      results[identifier] = [*previous[0][:2], (r << 16) | (g << 8) | b]
      counts[identifier] = count
  return results, {
    "source": SOURCE_URL,
    "licence": "Geoportal Berlin, dl-de/zero-2-0",
    "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    "crs": "EPSG:25833",
    "sampledInteriorPixels": counts,
  }


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("image", type=Path, help="PNG from SOURCE_URL")
  args = parser.parse_args()
  result, receipt = compile_roofs(args.image)
  for filename, data in [
    (DATA / "moabitRoofSamplesV366.json", result),
    (ROOT / "geo_data/regierungsviertel/moabit-roof-samples-v366.json", receipt),
  ]:
    filename.write_text(json.dumps(data, sort_keys=True, separators=(",", ":")) + "\n")
  print(f"{len(result)} exact ordinary roof records")


if __name__ == "__main__":
  main()
