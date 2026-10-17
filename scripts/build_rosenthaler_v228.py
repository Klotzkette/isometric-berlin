"""Step 10: additive source-attached Rosenthaler shopfronts and mapped stairs.

The existing Circus and all v163/v185/v205 geometry remain authoritative.
Only fittings are emitted; the four mapped stair axes retain their real counts.
Widths, riser heights and architectural subdivisions are display estimates.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import numpy as np
from build_schools_places_v205 import Face, group, shifted

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src/data"


def read(path: Path) -> dict:
  return json.loads(path.read_text())


def ground_at(x: float, z: float, native: bool = False) -> float:
  """Same retained piecewise-planar Weinberg datum as the displayed pavement."""
  p = read(APP / "weinbergTerrainV176.json")
  if native:
    x, z = math.floor(x / 4) * 4 + 2, math.floor(z / 4) * 4 + 2
  west, north, east, south = p["support"]
  if not (west < x < east and north < z < south):
    return 3.0
  u, v = (x - west) / p["stepM"], (z - north) / p["stepM"]
  i, j = math.floor(u), math.floor(v)
  a, b = u - i, v - j
  nw, ne = p["offsets"][j][i : i + 2]
  sw, se = p["offsets"][j + 1][i : i + 2]
  return 3 + (
    nw * (1 - a) + ne * (a - b) + se * b
    if a >= b
    else nw * (1 - b) + sw * (b - a) + se * a
  )


def stairs() -> list[dict]:
  """Upper endpoints independently match four retained subway entrance nodes."""
  osm = read(GEO / "rosenthaler-osm-v228.json")
  nodes = [p for p in osm["points"] if p["tags"].get("railway") == "subway_entrance"]
  result = []
  for run in osm["stairs"]:
    assert run["tags"]["incline"] == "up"
    bottom, top = run["points"]
    node = min(nodes, key=lambda n: math.dist(n["point"], top))
    assert math.dist(node["point"], top) < 0.01
    count = int(run["tags"]["step_count"])
    result.append(
      dict(
        osmWay=int(run["tags"]["osm_id"]),
        entranceNode=int(node["tags"]["osm_id"]),
        top=[round(v, 5) for v in top],
        bottom=[round(v, 5) for v in bottom],
        stepCount=count,
        width=2.5,
        descent=round(count * 0.17, 3),
        landing=0.75,
        surfaceY=round(ground_at(*top) + 0.08, 4),
        nativeSurfaceY=round(ground_at(*top, native=True) + 0.08, 4),
      )
    )
  return result


def build() -> tuple[dict, dict]:
  """No old source arrays or generated packets are mutated by this exporter."""
  source = read(GEO / "rosenthaler-platz-v163.json")
  offsets = read(APP / "weinbergBuildingOffsetsV176.json")["offsets"]
  entries = []
  evidence = []
  # Explicit street faces. The pharmacy shares the Circus source parent; its
  # upper hostel signage, rustication and windows remain entirely untouched.
  selected = [
    ("St. Oberholz", "DEBE01YYK0000Die", "DEBE01YYK0000Die", [1, 3, 5], 330264334),
    (
      "Apotheke Rosenthaler Platz",
      "DEBE01YYK0000E7j",
      "DEBE3DQfwmzCiCK6",
      [5, 6],
      3310052861,
    ),
  ]
  for name, owner, part_id, indices, node in selected:
    b = next(b for b in source["buildings"] if b["id"] == owner)
    part = next(p for p in b["parts"] if p["id"] == part_id)
    datum = min(p["ground_y_m"] for p in b["parts"])
    dy = 3 - datum + offsets.get(owner, 0)
    ground = 3 + offsets.get(owner, 0)
    g = group(name, owner)
    g["osmNode"] = node
    g["terrainOffsetY"] = offsets.get(owner, 0)
    for index in indices:
      raw = part["surfaces"][index]
      assert raw["kind"] == "WallSurface"
      f = Face(g, shifted(raw["rings"], dy))
      f.audit.update(parentId=owner, partId=part_id, surfaceIndex=index)
      length = f.right - f.left
      levelh = max(2.65, (f.top - ground - 0.35) / 5)
      bays = max(1, round(length / 3.1))
      pitch = length / bays
      for i in range(bays):
        u = f.left + (i + 0.5) * pitch
        w = min(2.5, pitch - 0.35)
        h = min(3.2, levelh * 0.81)
        y = ground + 0.53 * levelh
        # Exactly the existing v163 pane register: no second window lattice.
        for side in [-1, 1]:
          f.member(u + side * (w / 2 + 0.055), y, 0.11, h + 0.10, 0xB9B6A8, 0.10)
        f.member(u, y - h / 2 - 0.08, w + 0.15, 0.12, 0x868C88, 0.12)
        f.member(u, y + h * 0.32, w, 0.08, 0xD9D6C7, 0.10)
        # Two warm small display strips, well inside the old glass field.
        f.member(u, y - h * 0.25, w * 0.74, 0.13, 0xA99977, 0.07)
        if name == "St. Oberholz" and length > 4:
          for floor in [1, 2, 3, 4]:
            py = ground + (floor + 0.53) * levelh
            ph = min(2.4, levelh * 0.65)
            pw = min(1.45, pitch * 0.6)
            for side in [-1, 1]:
              f.member(u + side * (pw / 2 + 0.10), py, 0.10, ph + 0.2, 0xD7D0BE, 0.11)
            f.member(u, py + ph / 2 + 0.14, pw + 0.38, 0.13, 0xE3DDCD, 0.12)
      # Small bands stay between the existing storefront glazing and cornice.
      sign_y = ground + levelh - 0.50
      text = "ST. OBERHOLZ" if name == "St. Oberholz" else "APOTHEKE"
      height = min(0.47, (length - 0.6) / (len(text) * 1.05))
      f.member(
        (f.left + f.right) / 2, sign_y, length - 0.24, 0.62, 0xE8E4D8, 0.10, 0.42
      )
      # Glyphs are geometric strokes from the existing original alphabet.
      # View-right reverses on faces where the source order points left.
      d = f.d if np.cross(f.d, [0, 1, 0]).dot(f.n) > 0 else -f.d
      g["labels"].append(
        dict(
          text=text,
          center=f.point((f.left + f.right) / 2, sign_y - height / 2, 0.50),
          direction=d.tolist(),
          normal=f.n.tolist(),
          height=height,
          color=0x292C2B if name == "St. Oberholz" else 0xB93233,
        )
      )
    evidence.append(
      {k: v for k, v in g.items() if k not in {"boxes", "rods", "nativeRows", "labels"}}
    )
    g.pop("faces")
    entries.append(g)
  preserved = [
    GEO / "rosenthaler-platz-v163.json",
    APP / "publicPlacesV185.json",
    APP / "schoolsPlacesV205.json",
    APP / "weinbergBuildingOffsetsV176.json",
    APP / "weinbergTerrainV176.json",
  ]
  audit = {
    "schemaVersion": 1,
    "sourceSha256": {
      str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in preserved
    },
    "faces": evidence,
    "policy": "Additive shallow members on exact retained street walls; no new panes, shell, roof or window register. Stair width 2.5m and riser 0.17m are explicit display estimates; axis/count are retained OSM.",
  }
  return dict(schemaVersion=1, facades=entries, stairs=stairs()), audit


if __name__ == "__main__":
  model, audit = build()
  for path, value in [
    (APP / "rosenthalerV228.json", model),
    (GEO / "rosenthaler-v228-evidence.json", audit),
  ]:
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(path.relative_to(ROOT), path.stat().st_size)
