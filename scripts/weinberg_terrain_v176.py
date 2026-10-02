"""Bounded DGM terrain contract shared by offline packets and the viewer."""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/weinberg-v176/dgm-samples.json"
DEST = ROOT / "src/app/src/data/weinbergTerrainV176.json"
SUPPORT = (1830, -2040, 2550, -1030)
CORE = (1950, -1880, 2410, -1150)
STEP = 10


def smooth(value: float) -> float:
  value = max(0.0, min(1.0, value))
  return value * value * (3 - 2 * value)


@lru_cache(maxsize=1)
def source_grid() -> dict:
  return json.loads(SOURCE.read_text())


@lru_cache(maxsize=1)
def core_polygon() -> Polygon:
  source = json.loads(
    (ROOT / "src/app/src/data/surroundingCityScope.json").read_text()
  )["core"]
  return Polygon(source["ring"], source["holes"])


def source_height(x: float, z: float) -> float:
  source = source_grid()
  grid = source["grid"]
  u = (x - grid["minX"]) / grid["stepM"]
  v = (z - grid["minZ"]) / grid["stepM"]
  ix, iz = math.floor(u), math.floor(v)
  a, b = u - ix, v - iz
  heights = source["heightsNHN"]
  return (
    heights[iz][ix] * (1 - a) * (1 - b)
    + heights[iz][ix + 1] * a * (1 - b)
    + heights[iz + 1][ix] * (1 - a) * b
    + heights[iz + 1][ix + 1] * a * b
  )


def source_weight(x: float, z: float) -> float:
  x0, z0, x1, z1 = SUPPORT
  a, b, c, d = CORE
  if x <= x0 or x >= x1 or z <= z0 or z >= z1:
    return 0.0
  weight = (
    smooth((x - x0) / (a - x0))
    * smooth((x1 - x) / (x1 - c))
    * smooth((z - z0) / (b - z0))
    * smooth((z1 - z) / (z1 - d))
  )
  # The previous core already has its own measured terrain. Keep it exact and
  # fade this outer-district addition before its boundary, not across it.
  return weight * smooth(core_polygon().distance(Point(x, z)) / 50)


def build_profile() -> dict:
  x0, z0, x1, z1 = SUPPORT
  width, height = (x1 - x0) // STEP + 1, (z1 - z0) // STEP + 1
  offsets, weights = [], []
  for iz in range(height):
    row, wr = [], []
    for ix in range(width):
      x, z = x0 + ix * STEP, z0 + iz * STEP
      weight = source_weight(x, z)
      row.append(round((source_height(x, z) - 33) * weight, 4))
      wr.append(round(weight, 6))
    offsets.append(row)
    weights.append(wr)
  return {
    "schemaVersion": 1,
    "source": "Geoportal Berlin DGM1; DHHN2016/EPSG:7837; dl-de-zero-2.0",
    "datumNHN": 30,
    "flatBaseline": 3,
    "support": SUPPORT,
    "core": CORE,
    "stepM": STEP,
    "width": width,
    "height": height,
    "diagonal": "northwest-southeast",
    "offsets": offsets,
    "weights": weights,
  }


@lru_cache(maxsize=1)
def profile() -> dict:
  return json.loads(DEST.read_text()) if DEST.exists() else build_profile()


def sample_field(x: float, z: float, field: str) -> float:
  grid = profile()
  x0, z0, x1, z1 = grid["support"]
  if x <= x0 or x >= x1 or z <= z0 or z >= z1:
    return 0.0
  u, v = (x - x0) / STEP, (z - z0) / STEP
  ix, iz = math.floor(u), math.floor(v)
  a, b = u - ix, v - iz
  values = grid[field]
  nw, ne = values[iz][ix : ix + 2]
  sw, se = values[iz + 1][ix : ix + 2]
  return (
    nw * (1 - a) + ne * (a - b) + se * b
    if a >= b
    else nw * (1 - b) + sw * (b - a) + se * a
  )


def sample_offset(x: float, z: float) -> float:
  return sample_field(x, z, "offsets")


def terrain_weight(x: float, z: float) -> float:
  return sample_field(x, z, "weights")


def building_offset(ground_nhn: float, ground_y: float, x: float, z: float) -> float:
  """One centimetre-exact rigid translation per whole source parent."""
  return round((ground_nhn - 30 - ground_y) * terrain_weight(x, z), 2)


if __name__ == "__main__":
  DEST.write_text(json.dumps(build_profile(), separators=(",", ":")) + "\n")
