"""Register the Rungestraßenblock survey (BA Mitte, 2024, pp. 23–24) on packet 6_1.

Control points are inside each documented material reach. Leave the landings,
material transitions and projecting mooring structures free at each end.
"""

import gzip
import json
from pathlib import Path

from shapely.affinity import translate
from shapely.geometry import Point, Polygon
from shapely.ops import substring

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app"
PACKETS = APP / "public/mesh/surrounding-berlin-v159"
# Source map digits refer to the Dorsch construction survey's reach numbers.
REACHES = [
  ("1", "steel", (3152, 624), (3168, 633)),
  ("3", "steel", (3242, 675), (3248, 678)),
  ("4a", "concrete", (3255, 682), (3340, 730)),
  ("4b", "concrete", (3354, 754), (3401, 785)),
  ("5", "steel", (3452, 805), (3460, 811)),
]


def fit(mode):
  with gzip.open(PACKETS / f"6_1.{mode}.json.gz") as stream:
    packet = json.load(stream)
  x, _, z = packet["origin"]
  (shore,) = packet["nav"]["water"]
  water = translate(Polygon(shore["ring"], shore["holes"]), xoff=x, yoff=z)
  ring = water.exterior
  runs = []
  for _, _, start, end in REACHES:
    a, b = [ring.project(Point(point)) for point in (start, end)]
    line = substring(ring, a, b)
    assert line.length < 120 * (1.5 if mode == "minecraft" else 1)
    # The southern face looks north into the Spree. Check every segment,
    # including both directions of the two-metre steps on the block grid.
    for (x1, z1), (x2, z2) in zip(line.coords, list(line.coords)[1:]):
      assert water.contains(
        Point((x1 + x2) / 2 + (z2 - z1) * 0.005, (z1 + z2) / 2 - (x2 - x1) * 0.005)
      )
    runs.append([[round(px, 3), round(pz, 3)] for px, pz in line.coords])
  return runs, packet["nav"]["groundY"]


def main():
  drawn, crown = fit("drawn")
  native, native_crown = fit("minecraft")
  records = [
    dict(
      id=f"spree-rungestrasse-{section}",
      host="6_1",
      water="spree",
      source="rungestrassenblock-2024",
      material=material,
      waterY=-1.15,
      waterSide=-1,
      points=points,
      topY=[crown] * len(points),
      nativePoints=blocks,
      nativeTopY=[native_crown] * len(blocks),
    )
    for (section, material, _, _), points, blocks in zip(
      REACHES, drawn, native, strict=True
    )
  ]
  dest = APP / "src/data/waterwayBanksV370Spree.json"
  dest.write_text(json.dumps({"records": records}, separators=(",", ":")) + "\n")


if __name__ == "__main__":
  main()
