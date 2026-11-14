"""Finite source-ground DGM relief; old packets and all source XZ stay intact."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import zipfile
from pathlib import Path

import numpy as np
from build_mauerpark_terrain_v298 import fnv, nav_guard
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union
from terrain_fields_v307 import TerrainFieldV307, compile_ground_v307

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
PACK = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
KEY = "ring182-2_9"
BOUNDS = [1104, 4800, 1448, 5104]
STEP = 4


def b64(a):
  return base64.b64encode(a.tobytes()).decode()


def read(mode):
  p = PACK / f"{KEY}.{mode}.json.gz"
  return json.loads(gzip.decompress(p.read_bytes()))


def arrays(p, m):
  a = (
    np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3) / 100
    + p["origin"]
  )
  c = np.frombuffer(base64.b64decode(m["colors"]), "u1").reshape(-1, 3)
  t = np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3)
  return a, c, t


def main():
  packets = {mode: read(mode) for mode in ("drawn", "minecraft")}
  grass = []
  for mode, p in packets.items():
    pieces = []
    for m in p["meshes"]:
      a, c, t = arrays(p, m)
      for tri in t:
        q = a[tri]
        if (
          np.ptp(q[:, 1]) < 0.001
          and abs(q[0, 1] - 3.01) < 0.003
          and (c[tri[0]] == [51, 90, 36]).all()
        ):
          poly = Polygon(q[:, [0, 2]])
          if poly.area > 0 and poly.intersects(box(*BOUNDS)):
            pieces.append(poly)
    grass.append(unary_union(pieces).intersection(box(*BOUNDS)))
  safe = grass[0].intersection(grass[1]).buffer(-12, join_style=2)
  cells = []
  for z in range(BOUNDS[1], BOUNDS[3], 4):
    for x in range(BOUNDS[0], BOUNDS[2], 4):
      q = box(x, z, x + 4, z + 4)
      if safe.covers(q):
        cells.append(q)
  domain = unary_union(cells)
  archive = GEO / "raw/ubahn-approaches-v326/DGM1_390_5814.zip"
  with zipfile.ZipFile(archive) as zip:
    with zip.open(zip.namelist()[0]) as f:
      raw = np.loadtxt(f, usecols=2, dtype=np.float32).reshape(2000, 2000)

  def height(x, z):
    return float(
      raw[math.floor(5820000 - z - 5814000), math.floor(x + 389500 - 390000)]
    )

  # Preserve a local level datum. This is real relative relief, not an assertion
  # that the historically flattened city's y=3 is an NHN height.
  samples = [height(q.centroid.x, q.centroid.y) for q in cells]
  datum = round(float(np.median(samples)), 2)
  cols = (BOUNDS[2] - BOUNDS[0]) // 4 + 1
  rows = (BOUNDS[3] - BOUNDS[1]) // 4 + 1
  offsets = []
  for z in range(BOUNDS[1], BOUNDS[3] + 1, 4):
    row = []
    for x in range(BOUNDS[0], BOUNDS[2] + 1, 4):
      p = Point(x, z)
      d = domain.boundary.distance(p) if domain.covers(p) else 0
      t = min(1, d / 24)
      weight = t * t * (3 - 2 * t)
      row.append(round((height(x, z) - datum) * weight, 2))
    offsets.append(row)

  def sample(x, z, native=False):
    if native:
      x = math.floor(x / 4) * 4 + 2
      z = math.floor(z / 4) * 4 + 2
    if not domain.covers(Point(x, z)):
      return 0
    u = (x - BOUNDS[0]) / 4
    v = (z - BOUNDS[1]) / 4
    i = min(cols - 2, math.floor(u))
    j = min(rows - 2, math.floor(v))
    a = u - i
    b = v - j
    nw, ne, sw, se = (
      offsets[j][i],
      offsets[j][i + 1],
      offsets[j + 1][i],
      offsets[j + 1][i + 1],
    )
    return (
      round(
        nw * (1 - max(a, b)) + (ne if a >= b else sw) * abs(a - b) + se * min(a, b), 2
      )
      if native
      else nw * (1 - max(a, b)) + (ne if a >= b else sw) * abs(a - b) + se * min(a, b)
    )

  field = TerrainFieldV307(
    "feld", domain, tuple(BOUNDS), 4, sample, lambda x, z, native: 3.01
  )
  result = {
    "schemaVersion": 1,
    "id": KEY,
    "bounds": BOUNDS,
    "step": 4,
    "datumNHN": datum,
    "offsets": offsets,
    "runs": [],
    "plans": {},
  }
  for z in range(BOUNDS[1], BOUNDS[3], 4):
    selected = sorted(round(q.bounds[0]) for q in cells if round(q.bounds[1]) == z)
    if not selected:
      continue
    start = end = selected[0]
    for x in selected[1:] + [None]:
      if x is not None and x == end + 4:
        end = x
        continue
      result["runs"].append([z, start, end + 4])
      start = end = x
  evidence = {
    "source": "Geoportal Berlin DGM1 (dl-de/zero-2-0)",
    "url": "https://gdi.berlin.de/data/dgm1/atom/DGM1_390_5814.zip",
    "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "actualDgmRangeNHN": [min(samples), max(samples)],
    "localDatumNHN": datum,
    "domainAreaM2": domain.area,
    "sourcePackets": {},
    "proof": {},
  }
  for mode, p in packets.items():
    parts = []
    for i, m in enumerate(p["meshes"]):
      parts.append(
        {
          **m,
          "mesh": i,
          "colors": b64(
            np.frombuffer(base64.b64decode(m["colors"]), "u1").astype("<u2") * 257
          ),
        }
      )

    def pred(kind, a, c):
      return (
        kind == "city"
        and np.ptp(a[:, 1]) < 0.002
        and abs(a[0, 1] - 3.01) < 0.003
        and (c[0] == np.array([51, 90, 36]) * 257).all()
      )

    patch = compile_ground_v307(
      parts, p["origin"], [field], native=mode == "minecraft", ground_predicate=pred
    )
    plan = {
      "origin": p["origin"],
      "navGuard": nav_guard(p["nav"]),
      "source": [
        {
          "fingerprint": fnv(m["positions"] + m["colors"] + m["indices"]),
          "kind": m["kind"],
        }
        for m in p["meshes"]
      ],
      "parts": [],
    }
    for part in patch["parts"]:
      # Keep the exact original outside complement and corrected inside together.
      positions = []
      colors = []
      indices = []
      vertex = 0
      for m in [part["outside"], *part["fields"].values()]:
        if not m:
          continue
        a = np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3)
        c = np.frombuffer(base64.b64decode(m["colors"]), "<u2").reshape(-1, 3)
        t = np.frombuffer(base64.b64decode(m["indices"]), "<u4")
        positions.append(a)
        colors.append(np.rint(c / 257).astype("u1"))
        indices.append(t + vertex)
        vertex += len(a)
      extra = {
        "kind": "city",
        "positionType": "u16cm",
        "positions": b64(np.concatenate(positions)),
        "colors": b64(np.concatenate(colors)),
        "indices": b64(np.concatenate(indices).astype("<u4")),
      }
      plan["parts"].append(
        {
          "mesh": part["mesh"],
          "remove": part["retireTriangles"],
          "append": extra,
          "fingerprint": fnv(extra["positions"] + extra["colors"] + extra["indices"]),
        }
      )
    result["plans"][mode] = plan
    evidence["sourcePackets"][mode] = hashlib.sha256(
      (PACK / f"{KEY}.{mode}.json.gz").read_bytes()
    ).hexdigest()
    evidence["proof"][mode] = [
      {k: v for k, v in q.items() if k in ("mesh", "retireTriangles", "provenance")}
      for q in patch["parts"]
    ]
    print(
      mode,
      [
        (
          len(q["remove"]),
          len(base64.b64decode(q["append"]["positions"])) // 6,
          len(base64.b64decode(q["append"]["indices"])) // 12,
        )
        for q in plan["parts"]
      ],
    )
  (DATA / "tempelhoferFieldV345.json").write_text(
    json.dumps(result, separators=(",", ":")) + "\n"
  )
  (GEO / "tempelhofer-field-v345-evidence.json").write_text(
    json.dumps(evidence, separators=(",", ":")) + "\n"
  )
  print(
    {k: evidence[k] for k in ("actualDgmRangeNHN", "localDatumNHN", "domainAreaM2")}
  )


if __name__ == "__main__":
  main()
