"""Four-metre measured refinements inside the two existing northern parks.

No ground, tree, route or packet is written here. The shared finite ground
compiler receives these fields; original-source boundaries are exact masks.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import zipfile
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import pyogrio
from shapely import make_valid
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "north-park-terrain-v306-source.json.gz"
RUNTIME = DATA / "northParkTerrainV306.json"
ORIGINAL = DATA / "parkReliefV182.json"
_DOMAINS: dict[int, tuple[dict, Any]] = {}
SPECS = [
  ("humboldthain", "Volkspark Humboldthain", [840, -3240, 1120, -2960]),
  ("friedrichshain", "Volkspark Friedrichshain", [3940, -1080, 4632, -520]),
]


def read(path: Path) -> Any:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: Any) -> None:
  raw = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


@lru_cache(maxsize=1)
def original_profiles_v306() -> dict:
  """One immutable historical input per offline compiler process."""
  return read(ORIGINAL)


def grid_sample(profile: dict, x: float, z: float, field: str = "offsets") -> float:
  w, n, e, s = profile.get("bounds", profile.get("support"))
  if x <= w or x >= e or z <= n or z >= s:
    return 0.0
  step = profile.get("step", profile.get("stepM"))
  u = (x - w) / step
  v = (z - n) / step
  i, j = math.floor(u), math.floor(v)
  a, b = u - i, v - j
  rows = profile[field]
  nw, ne, sw, se = rows[j][i], rows[j][i + 1], rows[j + 1][i], rows[j + 1][i + 1]
  return (
    nw * (1 - a) + ne * (a - b) + se * b
    if a >= b
    else nw * (1 - b) + sw * (b - a) + se * a
  )


def baseline_height_v306(x: float, z: float, native: bool = False) -> float:
  """The unchanged delivered v18210m field; no guessed global altitude."""
  if native:
    x, z = math.floor(x / 4) * 4 + 2, math.floor(z / 4) * 4 + 2
  for p in original_profiles_v306()["profiles"]:
    if p["support"][0] < x < p["support"][2] and p["support"][1] < z < p["support"][3]:
      return 3 + grid_sample(p, x, z)
  return 3.0


def sample_offset_v306(
  profile: dict, x: float, z: float, native: bool = False
) -> float:
  """NW/SE piecewise planar delta, independent cardinal native cell centres."""
  if native:
    x, z = math.floor(x / 4) * 4 + 2, math.floor(z / 4) * 4 + 2
  cached = _DOMAINS.get(id(profile))
  if cached is None or cached[0] is not profile:
    cached = (profile, shape(profile["domain"]))
    _DOMAINS[id(profile)] = cached
  if not cached[1].covers(Point(x, z)):
    return 0.0
  return grid_sample(profile, x, z)


def build() -> None:
  from scripts.build_surrounding_outlines import world
  from scripts.build_weinberg_dgm_samples import sample_height

  old = read(ORIGINAL)
  candidates = GEO / "raw/outer-v159/candidate.gpkg"
  parks = pyogrio.read_dataframe(
    candidates,
    layer="multipolygons",
    where="name IN ('Volkspark Humboldthain','Volkspark Friedrichshain')",
  ).to_crs(25833)
  buildings = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/resolved-outlines.gpkg", layer="buildings"
  )
  core = read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")[
    "buildings"
  ]
  allbuildings = [g for g in buildings.geometry]
  allbuildings.extend(
    Polygon(
      [(x / 10, z / 10) for x, z in p["ring"]],
      [[(x / 10, z / 10) for x, z in r] for r in p.get("holes", [])],
    )
    for p in core
  )
  tiles = {}
  archives = []
  for code in ["390_5822", "392_5820", "394_5820"]:
    path = (
      GEO
      / ("raw/dgm/parks-v182" if code == "394_5820" else "raw/dgm/weinberg-v176")
      / ("DGM1_" + code + ".zip")
    )
    with zipfile.ZipFile(path) as z:
      with z.open(z.namelist()[0]) as f:
        tiles[code] = np.loadtxt(f, usecols=2, dtype=np.float32).reshape(2000, 2000)
    archives.append(
      dict(
        path=str(path.relative_to(ROOT)),
        sha256=sha(path),
        url="https://gdi.berlin.de/data/dgm1/atom/" + path.name,
        license="dl-de/zero-2-0",
      )
    )
  profiles = []
  evidence = []
  for key, name, bounds in SPECS:
    park = make_valid(world(parks[parks.name == name].iloc[0].geometry))
    # Exact source holes remain holes. Neither railway nor hospital grounds are
    # swept into a rectangular scene cut. Keep every full building foundation.
    exclusion = unary_union(
      [
        make_valid(g).buffer(16)
        for g in allbuildings
        if g.intersects(box(*bounds).buffer(16))
      ]
    )
    domain = park.intersection(box(*bounds)).difference(exclusion)
    source = next(p for p in old["profiles"] if p["name"] == name)
    offsets = []
    samples = []
    for z in range(bounds[1], bounds[3] + 1, 4):
      row = []
      for x in range(bounds[0], bounds[2] + 1, 4):
        pt = Point(x, z)
        distance = domain.boundary.distance(pt) if domain.covers(pt) else 0
        t = min(1, distance / 16)
        weight = t * t * (3 - 2 * t)
        measured, _, _, _ = sample_height(tiles, x, z)
        base = 3 + grid_sample(source, x, z)
        delta = round((measured - 30 - base) * weight, 5)
        row.append(delta)
        if weight:
          samples.append([x, z, measured, round(base, 5), round(weight, 8)])
      offsets.append(row)
    profiles.append(
      dict(
        key=key,
        name=name,
        bounds=bounds,
        step=4,
        nativeStep=4,
        domain=mapping(domain),
        offsets=offsets,
      )
    )
    evidence.append(
      dict(
        key=key,
        park=mapping(park),
        buildingExclusion=mapping(exclusion),
        domainAreaM2=domain.area,
        sourceSamples=samples,
        maxAbsoluteDelta=max(abs(v) for r in offsets for v in r),
      )
    )
  write(RUNTIME, dict(schemaVersion=1, profiles=profiles))
  write(
    SOURCE,
    dict(
      schemaVersion=1,
      originalFieldSha256=sha(ORIGINAL),
      archives=archives,
      mappedParkSourceSha256=sha(candidates),
      profiles=evidence,
      runtimeSha256=sha(RUNTIME),
      verticalDatum="NHN minus30m",
      policy="Only finite four-metre DGM corrections inside exact existing park polygons,16m inner feather and16m full-building exclusions. Earlier ground geometry/XZ/paint and all unrelated owners remain. Source web heights conflict for KleinerBunkerberg; official measured DGM governs, never an invented20m cut. No platform-height rewrite inferred from bare-earth DGM.",
    ),
  )
  print([(p["key"], len(p["offsets"]) * len(p["offsets"][0])) for p in profiles])


if __name__ == "__main__":
  build()
