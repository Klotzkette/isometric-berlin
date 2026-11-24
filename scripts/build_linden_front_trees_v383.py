"""Fit the registered Unter den Linden trees and Neue Wache chestnuts to their existing park and native rows."""
from __future__ import annotations

import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/regierungsviertel"
SOURCE = ROOT / "geo_data/regierungsviertel/linden-front-v383-trees.json.gz"
DEST = ROOT / "src/app/src/data/lindenFrontTreesV383.json"


def build():
  survey = json.loads(gzip.decompress(SOURCE.read_bytes()))
  drawn = json.loads((PUBLIC / "park-details.json").read_bytes())["trees"]
  native = json.loads((PUBLIC / "minecraft-voxels.json").read_bytes())
  grid = native["grid"]
  cells = {
    (grid["min_x_idx"] + off, grid["min_z_idx"] + row): [y, h]
    for row, entries in enumerate(native["tree_rows"]) for off, y, h in entries
  }
  result, seen, names = [], set(), []
  for _, x, z, height, crown, girth, species, _, i, stand in sorted(survey["rows"], key=lambda r: r[8]):
    old = drawn[i]
    ox, oy, oz = old["position"]
    cell = (int(ox // 4), int(oz // 4))
    assert not old.get("i") and cell in cells and cell not in seen
    assert (ox-x)**2 + (oz-z)**2 <= 2.40**2 and all(v > 0 for v in (height,crown,girth))
    seen.add(cell)
    if species not in names:
      names.append(species)
    # Old coordinates and native dim/ground are exact fingerprints. Original voxel
    # cell identity stays stable when the surveyed centre moved into an adjacent cell.
    result.append([i, round(ox*100), round(oz*100), round(oy*1000), *cells[cell],
                   round(x*100), round(z*100), height, crown, girth, names.index(species), old["v"], int(stand != "Unter den Linden")])
  assert len(result) == len({r[0] for r in result}) == 314
  return {"species":names,"rows":result}


if __name__ == "__main__":
  DEST.write_text(json.dumps(build(), ensure_ascii=False, separators=(",",":")) + "\n")
