"""Retain the three official Kulturforum museum bodies and their exact roof sheets."""

from __future__ import annotations

import hashlib
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[3]
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
TARGETS = {
  "DEBE01YYK0002Sq5": "388_5818",
  "DEBE01YYK0002V5W": "388_5818",
  "DEBE01YYK0002QYw": "389_5818",
}


def build(root: Path = ROOT) -> dict:
  """Extract every surface polygon independently without dropping interior rings."""
  prism_path = root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  prisms = {p["id"]: p for p in json.loads(prism_path.read_text())["buildings"]}
  bodies = []
  archives = {}
  for tile in sorted(set(TARGETS.values())):
    path = root / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip"
    archives[tile] = {
      "url": f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{tile}.zip",
      "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    }
    with ZipFile(path) as archive:
      tree = ET.fromstring(archive.read(archive.namelist()[0]))
    for building in tree.findall(".//b:Building", NS):
      source_id = building.get(f"{{{NS['g']}}}id")
      if source_id not in TARGETS:
        continue
      surfaces = []
      for kind in ["GroundSurface", "WallSurface", "RoofSurface"]:
        for surface in building.findall(f"./b:boundedBy/b:{kind}", NS):
          for polygon in surface.findall(".//g:Polygon", NS):
            rings = []
            for boundary in ["exterior", "interior"]:
              for ring in polygon.findall(f"./g:{boundary}/g:LinearRing", NS):
                values = [float(v) for v in ring.findtext("g:posList", "", NS).split()]
                points = [
                  [
                    round(values[i] - 389500, 3),
                    round(values[i + 2] - 30, 3),
                    round(5820000 - values[i + 1], 3),
                  ]
                  for i in range(0, len(values), 3)
                ]
                if points[0] == points[-1]:
                  points.pop()
                rings.append(points)
            surfaces.append(
              {"id": polygon.get(f"{{{NS['g']}}}id"), "kind": kind, "rings": rings}
            )
      prism = prisms[source_id[-8:]]
      bodies.append(
        {
          "id": source_id,
          "prism_id": prism["id"],
          "name": building.findtext("g:name", "", NS),
          "tile": tile,
          "street_ground_y_m": prism["y0_dm"] / 10,
          "source_prism": prism,
          "surfaces": surfaces,
        }
      )
  return {
    "schema_version": 1,
    "origin_epsg25833_m": [389500, 5820000, 30],
    "source_creation_date": "2026-03-02",
    "license": "dl-de/zero-2-0",
    "archives": archives,
    "bodies": sorted(bodies, key=lambda b: b["id"]),
  }


def main() -> None:
  """Write the full evidence and compact roof/navigation subset."""
  result = build()
  target = ROOT / "src/app/src/kulturforumMuseumsSource.json"
  target.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  navigation = [
    {
      "id": b["prism_id"],
      "sourcePrism": b["source_prism"],
      "groundY": b["street_ground_y_m"],
      "roofs": [s["rings"] for s in b["surfaces"] if s["kind"] == "RoofSurface"],
    }
    for b in result["bodies"]
  ]
  (target.parent / "kulturforumMuseumsNavigation.json").write_text(
    json.dumps(navigation, separators=(",", ":")) + "\n"
  )
  print({b["prism_id"]: len(b["surfaces"]) for b in result["bodies"]})


if __name__ == "__main__":
  main()
