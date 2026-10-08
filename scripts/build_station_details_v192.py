"""Bounded step-10 Zoo entrance source receipt; no packet or source rebuild."""

import hashlib
import json
import xml.etree.ElementTree as ET
from pathlib import Path

from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "geo_data/regierungsviertel/raw/zoo-station-v165/osm-map.xml"
PRISMS = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
OUT = ROOT / "src/app/src/data/stationDetailsV192.json"


def build() -> dict[str, object]:
  osm = ET.parse(RAW).getroot()
  nodes = {e.get("id"): e for e in osm.findall("node")}
  project = Transformer.from_crs(4326, 25833, always_xy=True)

  def point(node):
    x, north = project.transform(float(node.get("lon")), float(node.get("lat")))
    return [round(x - 389500, 4), round(5820000 - north, 4)]

  def record(kind, identity):
    e = next(e for e in osm.findall(kind) if e.get("id") == identity)
    return {
      "type": kind,
      "id": identity,
      "tags": {t.get("k"): t.get("v") for t in e.findall("tag")},
      "points": [point(e)]
      if kind == "node"
      else [point(nodes[n.get("ref")]) for n in e.findall("nd")],
    }

  old = next(
    p for p in json.loads(PRISMS.read_text())["buildings"] if p["id"] == "57658318"
  )
  return {
    "schemaVersion": 1,
    "source": {
      "url": "https://www.openstreetmap.org/api/0.6/map?bbox=13.3277,52.5053,13.3358,52.5100",
      "sha256": hashlib.sha256(RAW.read_bytes()).hexdigest(),
      "license": "ODbL-1.0",
    },
    "zoo": {
      "roof": record("way", "157658318"),
      "entrance": record("node", "1223731363"),
      "stairs": record("way", "274269257"),
      "legacyPrism": old,
      "groundY": old["y0_dm"] / 10,
      "height": 3,
      "eaveHeightEstimate": 2.35,
      "policy": "Complete mapped roof ring and tagged 3m height retained; glazed gable, stone supports, thin railings and U/U2/U9 plaques follow inspected free photograph. Eave, member sizes and subdivisions are estimates. Below-ground station and terrain are unchanged; this is the visible entrance canopy, not a navigable underground route.",
    },
    "alexander": {
      "sourceParent": "DEBE01YYK0001z5U",
      "sourceOsmWay": "20144781",
      "policy": "Longitudinal purlins and small luminaires below the retained barrel roof; geometric ALEXANDERPLATZ letters on existing blue boards. Positions and counts are display estimates, not surveyed fixtures. All earlier roof, glass, tracks and platform geometry remains.",
    },
  }


if __name__ == "__main__":
  OUT.write_text(json.dumps(build(), ensure_ascii=False, separators=(",", ":")) + "\n")
