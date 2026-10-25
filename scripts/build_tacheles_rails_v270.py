"""Step 10: the two retained Oranienburger tram courses below the photo viewpoint."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/app/public/mesh/regierungsviertel/rail-lines.json"
OUTPUT = ROOT / "src/app/src/data/tachelesRailsV270.json"
IDS = {
  "way/101699672:0",
  "way/1053166658:0",
  "way/1340133918:0",
  "way/1340133919:0",
  "way/143891040:0",
  "way/154321040:0",
}


def build() -> dict:
  """Keep every decimetre source vertex of six exact through-track pieces."""
  source = json.loads(SOURCE.read_bytes())
  tracks = [t for t in source["tram_catenary"]["tracks"] if t["id"] in IDS]
  assert {t["id"] for t in tracks} == IDS
  return {
    "schema": 1,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "tracks": tracks,
    "gaugeM": 1.435,
    "evidence": {
      "plan": "Exact retained OSM tram_catenary centreline vertices, no road change",
      "gauge": "All six ways: gauge=1435 in retained berlin-260929.osm.pbf",
      "source": "OpenStreetMap contributors, ODbL-1.0",
      "height": "Railheads follow the existing v206 road skin, 1 cm above paint",
      "estimates": "7.5 cm visible railhead width and native 0.5 m cardinal steps",
      "preservation": "All source roads, curbs, paint, contact wires and masts retained",
    },
  }


if __name__ == "__main__":
  OUTPUT.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
