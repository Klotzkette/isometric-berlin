"""Complete measured reception/retail bodies beside the retained exact legacy owners."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box, mapping
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts
from scripts.build_bebelplatz_building_source import part_profile
from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_tiergarten_werkhof_v275 import roof_at

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
BASE = ROOT / "src/app/public/mesh/regierungsviertel"
SITES = [
  dict(
    key="hellweg",
    name="Hellweg Ellen-Epstein-Straße 1",
    owner="35139658",
    archive="LoD2_388_5821.zip",
    parents=["DEBE01YYK0002M4y", "DEBE01YYK0003Uh4"],
  ),
  dict(
    key="humboldthain",
    name="Humboldthain reception building",
    owner="44093193",
    archive="LoD2_390_5822.zip",
    parents=["DEBE01YYK0003tq8"],
  ),
]


def pack(a, dtype="<f4"):
  return base64.b64encode(np.asarray(a, dtype=dtype).tobytes()).decode()


def raw(path):
  return json.loads(path.read_bytes())


def build():
  prisms = raw(BASE / "lod2-prisms.json")["buildings"]
  voxels = raw(BASE / "minecraft-voxels.json")
  sites = []
  source = []
  models = []
  cell = voxels["cell_m"]
  grid = voxels["grid"]
  assert cell == 4 and voxels["schema_version"] == 2
  for spec in SITES:
    old = next(p for p in prisms if p["id"] == spec["owner"])
    oldPoly = Polygon([(x / 10, z / 10) for x, z in old["ring"]])
    archive = GEO / "raw/lod2" / spec["archive"]
    parents = []
    with zipfile.ZipFile(archive) as z:
      for name in z.namelist():
        if not name.lower().endswith((".gml", ".xml")):
          continue
        with z.open(name) as stream:
          for _, p in ET.iterparse(stream, events=("end",)):
            if p.tag != f"{{{NS['bldg']}}}Building":
              continue
            if p.get(GML_ID) in spec["parents"]:
              parents.append(
                dict(
                  id=p.get(GML_ID),
                  parts=[part_profile(q) for q in leaf_building_parts(p) or [p]],
                )
              )
            p.clear()
    if {p["id"] for p in parents} != set(spec["parents"]):
      raise ValueError("Complete exact source family missing")
    source.append(
      dict(
        spec,
        archiveSha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
        sourceUrl="https://gdi.berlin.de/data/a_lod2/atom/" + spec["archive"],
        parents=parents,
      )
    )
    # Shared city ground calibration only; all relative source heights and source XZ retained.
    sourceLow = min(
      p["ground_y_m"]
      for b in parents
      if b["id"] == spec["parents"][0]
      for p in b["parts"]
    )
    offset = old["y0_dm"] / 10 - sourceLow
    positions = []
    tones = []
    bodies = []
    parts = []
    for parent in parents:
      for p in parent["parts"]:
        poly = Polygon(p["ring"], p["holes"])
        roofs = []
        wall = 0xB8B9B0 if spec["key"] == "hellweg" else 0xC8C2B3
        roof = 0x747D7B
        if parent["id"] == "DEBE01YYK0003Uh4":
          wall = 0x9AADA7
          roof = 0x899D96
        for s in p["surfaces"]:
          rings = [[[x, round(y + offset, 6), z] for x, y, z in r] for r in s["rings"]]
          tris = triangles_for(rings)
          positions.extend(tris)
          tones.extend([roof if s["kind"] == "RoofSurface" else wall] * len(tris))
          if s["kind"] == "RoofSurface":
            roofs.extend(tris)
        low = round(p["ground_y_m"] + offset, 6)
        high = round(p["top_y_m"] + offset, 6)
        cells = []
        x0, z0, x1, z1 = poly.bounds
        for z in range(math.floor(z0), math.ceil(z1)):
          row = []
          for x in range(math.floor(x0), math.ceil(x1)):
            clip = poly.intersection(box(x, z, x + 1, z + 1))
            if clip.area < 0.035:
              continue
            pt = clip.representative_point()
            top = roof_at(roofs, pt.x, pt.y)
            if top is None:
              raise ValueError("Missing actual roof facet")
            top = math.ceil((top - 1e-7) * 4) / 4
            cells.append([x, z, top])
            row.append((x, top))
          # Exact x-run compaction of equal source roof height, not coarse resampling.
          i = 0
          while i < len(row):
            j = i + 1
            while (
              j < len(row) and row[j][0] == row[j - 1][0] + 1 and row[j][1] == row[i][1]
            ):
              j += 1
            x, top = row[i]
            width = j - i
            cap = max(low + 0.01, top - 0.25)
            bodies.extend(
              [
                [x + width / 2, (low + cap) / 2, z + 0.5, width, cap - low, 1, wall],
                [x + width / 2, (cap + top) / 2, z + 0.5, width, top - cap, 1, roof],
              ]
            )
            i = j
        parts.append(
          dict(
            id=p["id"],
            parentId=parent["id"],
            sourceId=spec["owner"],
            ring=p["ring"],
            holes=p["holes"],
            minY=low,
            maxY=high,
            roofTriangles=roofs,
            nativeCells=cells,
          )
        )
    columns = []
    for zi, runs in enumerate(voxels["building_rows"]):
      z = grid["min_z_idx"] + zi
      if z * cell > oldPoly.bounds[3] or (z + 1) * cell < oldPoly.bounds[1]:
        continue
      for start, count, lo, hi, kind in runs:
        for x in range(grid["min_x_idx"] + start, grid["min_x_idx"] + start + count):
          if x * cell > oldPoly.bounds[2] or (x + 1) * cell < oldPoly.bounds[0]:
            continue
          if (
            oldPoly.intersection(
              box(x * cell, z * cell, (x + 1) * cell, (z + 1) * cell)
            ).area
            > 0.001
          ):
            columns.append([x, z, lo, hi, kind])
    if not columns:
      raise ValueError("Actual independent Native owner missing")
    new = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
    models.append(
      dict(
        key=spec["key"],
        name=spec["name"],
        source=old,
        nativeColumns=columns,
        cellM=cell,
        sourceGroundY=sourceLow,
        displayOffsetY=offset,
        parts=parts,
        drawnPositions=pack(positions),
        drawnColors=pack(tones, "<u4"),
        nativeBodies=pack(bodies),
        counts=dict(
          sourceParts=len(parts),
          drawnTriangles=len(positions),
          nativeCells=sum(len(p["nativeCells"]) for p in parts),
          nativeInstances=len(bodies),
        ),
      )
    )
    sites.append(
      dict(
        key=spec["key"],
        oldAreaM2=oldPoly.area,
        newAreaM2=new.area,
        oldCoveredFraction=oldPoly.intersection(new).area / oldPoly.area,
        oldOnlyGeometry=mapping(oldPoly.difference(new)),
        policy="Add complete measured source bodies; retain every previous body, side branch, bridge, stair, line and navigation record. No statement of demolition or empty ground. Ground offset aligns the common source datum with retained core ground; relative source heights and all source XZ remain exact.",
      )
    )
  evidence = dict(
    schemaVersion=1,
    retrieved="2026-11-15",
    sources=source,
    reconciliation=sites,
    inputs=[
      dict(
        path=str(p.relative_to(ROOT)), sha256=hashlib.sha256(p.read_bytes()).hexdigest()
      )
      for p in [BASE / "lod2-prisms.json", BASE / "minecraft-voxels.json"]
    ],
  )
  data = dict(schemaVersion=1, sites=models)
  return data, evidence


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  data, evidence = build()
  outputs = [
    (DATA / "openSitesV346.json", data),
    (GEO / "open-sites-v346-source.json.gz", evidence),
  ]
  for path, value in outputs:
    wire = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
    wire = gzip.compress(wire, mtime=0) if path.suffix == ".gz" else wire
    if args.check:
      if path.read_bytes() != wire:
        raise ValueError("Reproduction changed: " + str(path))
    else:
      path.write_bytes(wire)
  print(json.dumps([{k: s[k] for k in ["key", "counts"]} for s in data["sites"]]))
