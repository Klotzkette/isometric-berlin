"""Lossless face permutation and compact cell runs for the new core field.

All vertex/normal/RGB bytes and the complete oriented face multiset survive.
Only newly authored inside face order changes; all old receipts/outside remain.
"""

from __future__ import annotations

import base64
import hashlib
import math

import numpy as np
from build_rail_sse_v307 import DATA, GEO, read_v307, sha_v307, write_v307


def compact_navigation_v307() -> None:
  path = DATA / "coreTerrainContactV307.json"
  source = read_v307(path)
  before = sha_v307(path)
  receipts = repr(source["variants"])
  regions = []
  proof = []
  for native in (False, True):
    nav = []
    for mesh in source["meshes"]:
      if mesh["native"] != native:
        continue
      p = np.frombuffer(base64.b64decode(mesh["positions"]), "<f4").reshape(-1, 3)
      old = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      tri = p[old]
      centres = tri[:, :, [0, 2]].mean(axis=1)
      cell = np.floor(centres / 4).astype(int)
      order = np.lexsort((np.arange(len(old)), cell[:, 0], cell[:, 1]))
      new = old[order]
      if not np.array_equal(np.sort(order), np.arange(len(old))) or not np.array_equal(
        new, old[order]
      ):
        raise ValueError("A source face was changed")
      mesh["indices"] = base64.b64encode(new.tobytes()).decode()
      top = {}
      count = 0
      for ordinal, t in enumerate(p[new]):
        if np.cross(t[1] - t[0], t[2] - t[0])[1] <= 1e-8:
          continue
        count += 1
        centre = t[:, [0, 2]].mean(axis=0)
        x, z = math.floor(float(centre[0]) / 4), math.floor(float(centre[1]) / 4)
        lo = t[:, [0, 2]].min(axis=0)
        hi = t[:, [0, 2]].max(axis=0)
        if (
          lo[0] >= x * 4
          and hi[0] <= (x + 1) * 4
          and lo[1] >= z * 4
          and hi[1] <= (z + 1) * 4
        ):
          keys = [str(x) + "_" + str(z)]
        else:
          keys = [
            str(xx) + "_" + str(zz)
            for zz in range(
              math.floor(float(lo[1]) / 4), math.floor(float(hi[1]) / 4) + 1
            )
            for xx in range(
              math.floor(float(lo[0]) / 4), math.floor(float(hi[0]) / 4) + 1
            )
          ]
        for key in keys:
          runs = top.setdefault(key, [])
          if runs and runs[-1][0] + runs[-1][1] == ordinal:
            runs[-1][1] += 1
          else:
            runs.append([ordinal, 1])
      if top:
        nav.append(dict(key=mesh["key"], topTriangles=count, cells=top))
      proof.append(
        dict(
          key=mesh["key"],
          triangles=len(old),
          beforeIndexSha256=hashlib.sha256(old.tobytes()).hexdigest(),
          afterIndexSha256=hashlib.sha256(new.tobytes()).hexdigest(),
          permutationSha256=hashlib.sha256(order.astype("<u4").tobytes()).hexdigest(),
          attributesSha256={
            k: hashlib.sha256(base64.b64decode(mesh[k])).hexdigest()
            for k in ("positions", "colors", "normals")
          },
          topCells=len(top),
          topRuns=sum(len(r) for r in top.values()),
        )
      )
    regions.append(dict(native=native, meshes=nav))
  if repr(source["variants"]) != receipts:
    raise ValueError("Old constructor receipts/outside changed")
  write_v307(path, source)
  write_v307(
    DATA / "coreTerrainContactV307Navigation.json",
    dict(
      schemaVersion=2,
      encoding="exact-triangle-runs",
      geometrySha256=sha_v307(path),
      regions=regions,
    ),
  )
  write_v307(
    GEO / "core-terrain-v307-navigation-proof.json.gz",
    dict(
      schemaVersion=1,
      beforeSha256=before,
      afterSha256=sha_v307(path),
      oldReceiptsAndOutsideSha256=hashlib.sha256(receipts.encode()).hexdigest(),
      meshes=proof,
      policy=__doc__,
    ),
  )
  print([(m["key"], m["topCells"], m["topRuns"]) for m in proof])


if __name__ == "__main__":
  compact_navigation_v307()
