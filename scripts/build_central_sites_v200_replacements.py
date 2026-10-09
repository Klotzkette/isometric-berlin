"""Freeze the five complete Heckmann source/placeholder ownership repairs."""

import gzip
import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

R = Path(__file__).resolve().parents[1]
P = R / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
V = R / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
prisms = json.loads(P.read_text())["buildings"]
byid = {p["id"]: p for p in prisms}


def poly(p: dict) -> Polygon:
  return Polygon(
    [(x / 10, z / 10) for x, z in p["ring"]],
    [[(x / 10, z / 10) for x, z in h] for h in p["holes"]],
  )


ids = {
  "-5759915": "DEBE01YYK0000BdM",
  "80339718": "DEBE01YYK00004Hv",
  "86993630": "DEBE01YYK0000Epg",
  "86993613": "DEBE01YYK00005xT",
  "86993634": "DEBE01YYK00005n7",
}
records = {
  r["id"]: r
  for t in ["390_5819", "390_5820", "391_5820"]
  for r in json.loads(
    gzip.decompress(
      (
        R / f"geo_data/regierungsviertel/alt-mitte-v169/source-{t}-00.json.gz"
      ).read_bytes()
    )
  )["buildings"]
}
vp = json.loads(V.read_text())
cell = vp["cell_m"]
grid = vp["grid"]
members = []
near = [
  (p["id"], poly(p))
  for p in prisms
  if poly(p).distance(Point(1540, -700)) < 150 and p["id"] not in ids
]
for pid, owner in ids.items():
  p = byid[pid]
  fp = poly(p)
  r = records[owner]
  sourcefp = unary_union(
    [Polygon(q["ring"], q["holes"]) for q in r["footprintPolygons"]]
  )
  cells = []
  sig = [p["y0_dm"] / 10, p["y0_dm"] / 10 + math.ceil(p["h_dm"] / 10 / cell) * cell]
  conflicts = []
  for iz, row in enumerate(vp["building_rows"]):
    z = (grid["min_z_idx"] + iz + 0.5) * cell
    if not fp.bounds[1] - cell < z < fp.bounds[3] + cell:
      continue
    for run in row:
      x0, count, y0, y1, cls = run
      for ix in range(x0, x0 + count):
        x = (grid["min_x_idx"] + ix + 0.5) * cell
        if fp.covers(Point(x, z)):
          if [y0 / 10, y1 / 10] != sig:
            conflicts.append([x, z, y0 / 10, y1 / 10, "height"])
            continue
          overlaps = [id for id, g in near if g.contains(Point(x, z))]
          if overlaps:
            conflicts.append([x, z, *overlaps])
            continue
          cells.append([x, z, y0 / 10, y1 / 10])
  members.append(
    dict(
      prismId=pid,
      sourceOwner=owner,
      legacyPrism=p,
      fullSourceFamily=r["ownershipBinding"]["sourceFamilyIds"],
      sourceFootprint=r["footprintPolygons"],
      oldUncoveredAreaM2=fp.difference(sourcefp.buffer(0.25)).area,
      exactSourceUncoveredAreaM2=fp.difference(sourcefp).area,
      columns=cells,
      conflicts=conflicts,
      retainedRecordSha256=hashlib.sha256(
        json.dumps(r, sort_keys=True).encode()
      ).hexdigest(),
    )
  )
  print(pid, len(cells), len(conflicts), fp.difference(sourcefp).area)
receipt = dict(
  schemaVersion=1,
  reason="Only five fully supplied Heckmann LoD2 source parents replace their precisely identified coarse OSM placeholders. Every measured wall and roof polygon is present in CentralSitesV200; courtyard holes remain unchanged. No surrounding packet changes.",
  sourceSha256={
    str(p.relative_to(R)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [P, V]
  },
  replacements=members,
)
(R / "src/app/src/data/centralSitesV200Replacement.json").write_text(
  json.dumps(receipt, ensure_ascii=False, separators=(",", ":")) + "\n"
)
