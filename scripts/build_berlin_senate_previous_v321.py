"""Bind complete actual Oranien old tuples to exclusive original native columns."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"


def read(p: Path) -> dict:
  return json.loads(p.read_bytes())


def b64(a: np.ndarray) -> str:
  return base64.b64encode(a.tobytes()).decode()


def build(capture_directory: Path) -> dict:
  runtime = read(DATA / "berlinSenatePreviousV321.json")
  source = read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")
  vox = read(ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json")
  old = next(p for p in source["buildings"] if p["id"] == "n-400426")
  poly = Polygon(np.array(old["ring"]) / 10, [np.array(h) / 10 for h in old["holes"]])
  xmin, zmin, xmax, zmax = poly.bounds
  candidates = []
  polys = []
  for p in source["buildings"]:
    if p["h_dm"] <= 0:
      continue
    ring = np.array(p["ring"]) / 10
    if (
      ring[:, 0].max() < xmin - 4
      or ring[:, 0].min() > xmax + 4
      or ring[:, 1].max() < zmin - 4
      or ring[:, 1].min() > zmax + 4
    ):
      continue
    g = Polygon(ring, [np.array(h) / 10 for h in p["holes"]])
    g = g if g.is_valid else g.buffer(0)
    if not g.is_empty:
      candidates.append(p)
      polys.append(g)
  tree = STRtree(polys)
  columns = {}
  all_columns = []
  mixed = []
  cell = vox["cell_m"]
  for zi, row in enumerate(vox["building_rows"]):
    z = zi + vox["grid"]["min_z_idx"]
    if z * cell > zmax + 4 or (z + 1) * cell < zmin - 4:
      continue
    for offset, run, low, high, kind in row:
      for x in range(
        vox["grid"]["min_x_idx"] + offset, vox["grid"]["min_x_idx"] + offset + run
      ):
        square = box(x * cell, z * cell, (x + 1) * cell, (z + 1) * cell)
        if poly.intersection(square).area <= 1e-7:
          continue
        ids = sorted(
          candidates[i]["id"]
          for i in tree.query(square)
          if polys[i].intersection(square).area > 1e-7
        )
        record = dict(source=[x, z, low, high, kind], contributors=ids, retireBody=True)
        if ids == [old["id"]]:
          columns[(x, z)] = record
        else:
          mixed.append(record)
        all_columns.append(record)
  assert columns
  report = {}
  for key, mobile in [("nativeFull", False), ("nativeMobile", True)]:
    capture = read(
      capture_directory
      / "native-oranien-r1"
      / ("bun-mobile.json" if mobile else "bun-full.json")
    )
    components = []
    selected = []
    for part in capture["parts"]:
      keep = []
      for row in part["rows"]:
        m = np.frombuffer(base64.b64decode(row["matrix"]), dtype="<f4")
        cx, cz = float(m[12]), float(m[14])
        if part["name"] == "Voxel building columns":
          position = (int(round(cx / cell - 0.5)), int(round(cz / cell - 0.5)))
          belongs = position in columns
        else:
          # Actual facades sit0.08m beyond the exact four source-cell faces.
          belongs = False
          for dx, dz in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            px, pz = cx - dx * (cell / 2 + 0.08), cz - dz * (cell / 2 + 0.08)
            ix, iz = int(round(px / cell - 0.5)), int(round(pz / cell - 0.5))
            if (
              (ix, iz) in columns
              and abs(px - (ix + 0.5) * cell) < 0.001
              and abs(pz - (iz + 0.5) * cell) < 0.001
            ):
              belongs = True
              break
        if belongs:
          keep.append(row)
      if not keep:
        continue
      matrix = np.concatenate(
        [np.frombuffer(base64.b64decode(r["matrix"]), dtype="<f4") for r in keep]
      )
      color = np.concatenate(
        [np.frombuffer(base64.b64decode(r["color"]), dtype="<f4") for r in keep]
      )
      components.append(
        dict(
          name=part["name"],
          kind="instances",
          attributes=part["attributes"],
          index=part["index"],
          instances=dict(count=len(keep), matrix=b64(matrix), color=b64(color)),
          retire=True,
        )
      )
      selected.append(
        dict(
          name=part["name"],
          rows=len(keep),
          actualGlobalIndices=[r["index"] for r in keep],
        )
      )
    assert any(c["name"] == "Voxel building columns" for c in components)
    runtime[key] = dict(
      schemaVersion=1,
      native=True,
      owners=[
        dict(id=old["id"], sourcePrism=old, retireBody=True, components=components)
      ],
      nativeSource=dict(cell=cell, grid=vox["grid"], columns=list(columns.values())),
    )
    report[key] = dict(
      captureSha256=hashlib.sha256(
        (
          capture_directory
          / "native-oranien-r1"
          / ("bun-mobile.json" if mobile else "bun-full.json")
        ).read_bytes()
      ).hexdigest(),
      selected=selected,
    )
  preview = read(capture_directory / "preview-r1/bun.json")
  preview_owner = next(p for p in preview["owners"] if p["source"]["id"] == old["id"])
  runtime["preview"] = dict(
    schemaVersion=1,
    native=False,
    owners=[
      dict(
        id=old["id"],
        sourcePrism=old,
        retireBody=True,
        components=[dict(**p, retire=True) for p in preview_owner["parts"]],
      )
    ],
  )
  (DATA / "berlinSenatePreviousV321.json").write_text(
    json.dumps(runtime, separators=(",", ":")) + "\n"
  )
  proof = dict(
    schemaVersion=1,
    actualCaptures=report,
    sourcePrismsSha256=hashlib.sha256(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
    ).hexdigest(),
    voxelSha256=hashlib.sha256(
      (
        ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
      ).read_bytes()
    ).hexdigest(),
    sourceColumns=all_columns,
    exclusiveColumns=len(columns),
    mixedColumnsPreserved=mixed,
    policy="Only actual captured tuples on fully source-receipted exclusive columns retire; all mixed/foreign rows remain.",
  )
  (
    ROOT / "geo_data/regierungsviertel/berlin-senate-previous-v321-evidence.json.gz"
  ).write_bytes(
    gzip.compress((json.dumps(proof, separators=(",", ":")) + "\n").encode(), mtime=0)
  )
  print(
    "native",
    len(columns),
    "mixed",
    len(mixed),
    [
      (
        k,
        [
          (p["name"], p["instances"]["count"])
          for p in runtime[k]["owners"][0]["components"]
        ],
      )
      for k in report
    ],
  )
  return runtime


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--capture-directory", type=Path, required=True)
  build(parser.parse_args().capture_directory)
