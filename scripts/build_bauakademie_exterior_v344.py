"""Pin the two existing Bauakademie remnants and actual 4 m Native columns."""

import json
from pathlib import Path

from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/public/mesh/regierungsviertel"
prisms = json.loads((DATA / "lod2-prisms.json").read_bytes())["buildings"]
voxels = json.loads((DATA / "minecraft-voxels.json").read_bytes())
records = []
for identity, label, top in [
  ("45095631", "Bauakademie Musterecke", 292),
  ("14046275", "Bauakademie Roter Saal", 132),
]:
  source = next(p for p in prisms if p["id"] == identity)
  polygon = Polygon([(x / 10, z / 10) for x, z in source["ring"]])
  columns = []
  for row_index, row in enumerate(voxels["building_rows"]):
    z = row_index + voxels["grid"]["min_z_idx"]
    if not polygon.bounds[1] <= (z + 0.5) * 4 <= polygon.bounds[3]:
      continue
    for start, count, lo, hi, kind in row:
      if lo != source["y0_dm"] or hi != top:
        continue
      for x in range(
        start + voxels["grid"]["min_x_idx"], start + count + voxels["grid"]["min_x_idx"]
      ):
        if polygon.covers(Point((x + 0.5) * 4, (z + 0.5) * 4)):
          columns.append([x, z, lo, hi, kind])
  assert columns
  records.append({"source": source, "name": label, "nativeColumns": columns})
target = ROOT / "src/app/src/data/bauakademieExteriorV344.json"
target.write_text(
  json.dumps({"schemaVersion": 1, "records": records}, separators=(",", ":")) + "\n"
)
print([(r["name"], len(r["nativeColumns"])) for r in records])
