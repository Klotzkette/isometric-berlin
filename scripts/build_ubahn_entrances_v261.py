"""Build seven source-bound U6/U5 stair mouths; no remote requests at build time."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/ubahn-entrances-v261-source.json"
GROUND = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
OUTPUT = ROOT / "src/app/src/data/ubahnEntrancesV261.json"


def build() -> dict:
  source, ground = json.loads(SOURCE.read_text()), json.loads(GROUND.read_text())
  h, grid = ground["ground_height"], ground["grid"]
  transform = Transformer.from_crs(4326, 25833, always_xy=True)

  def point(node):
    x, north = transform.transform(node["lon"], node["lat"])
    return [round(x - 389500, 3), round(5820000 - north, 3)]

  def level(p, smooth):
    x, z = [
      (p[i] / ground["cell_m"] - grid[k]) / h["stride_cells"]
      for i, k in enumerate(("min_x_idx", "min_z_idx"))
    ]

    def value(a, b):
      a, b = max(0, min(h["cols"] - 1, a)), max(0, min(h["rows"] - 1, b))
      return h["y_dm"][b * h["cols"] + a] / 10

    if not smooth:
      return value(math.floor(x), math.floor(z))
    x, z = x - 0.5, z - 0.5
    a, b = math.floor(x), math.floor(z)
    tx, tz = x - a, z - b
    return (value(a, b) * (1 - tx) + value(a + 1, b) * tx) * (1 - tz) + (
      value(a, b + 1) * (1 - tx) + value(a + 1, b + 1) * tx
    ) * tz

  stairs = []
  for s in source["runs"]:
    top = next(n for n in s["nodes"] if n["id"] == s["entranceNode"])
    bottom = next(n for n in s["nodes"] if n["id"] != s["entranceNode"])
    count = int(s["tags"]["step_count"])
    tor = s["station"] == "brandenburger-tor"
    stairs.append(
      {
        "station": s["station"],
        "name": "Brandenburger Tor" if tor else "Naturkundemuseum",
        "ref": s["ref"],
        "osmWay": f"way/{s['way']}",
        "osmNode": f"node/{s['entranceNode']}",
        "top": point(top),
        "bottom": point(bottom),
        "stepCount": count,
        "width": 2.5 if tor else 2.3,
        "landing": 0.4,
        "descent": round(count * 0.17, 2),
        "surfaceY": round(level(point(top), True) + (0.32 if tor else 0.1), 3),
        "nativeSurfaceY": round(level(point(top), False) + (0.32 if tor else 0), 3),
        "tags": s["tags"],
        "entranceTags": top["tags"],
      }
    )
  return {
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "groundSha256": hashlib.sha256(GROUND.read_bytes()).hexdigest(),
    "displayStatus": "OSM endpoints, entrance IDs and step counts retained. Widths, 17 cm risers, 40 cm landing, fittings and sign sizes are estimates; no underground route beyond the mapped stair is inferred.",
    "stairs": stairs,
  }


if __name__ == "__main__":
  OUTPUT.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
  print(OUTPUT.relative_to(ROOT))
