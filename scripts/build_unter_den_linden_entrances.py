"""Step 10: extract only the five OSM U-Bahn exits and their two separate lifts."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

from pyproj import Transformer

SOURCE_URL = (
  "https://api.openstreetmap.org/api/0.6/map?bbox=13.3873,52.5157,13.391,52.5182"
)
OFFICIAL_PLAN = "https://www.bvg.de/dam/jcr:35d4b73c-7184-4db3-b322-a71a0139babd/unter-den-linden%20900100045.pdf"
STEPS = ["881245040", "882389498", "881245044", "881606906", "881606908"]
ESCALATORS = ["881245039", "881245041", "882389486"]
DISPLAY_STATUS = (
  "Source axes and entrances exact to millimetre transformation; widths, railings, "
  "lift cabin size, 4.8 m descent and escalator tread count are display estimates. "
  "Surface entrance nodes resolve conflicting incline direction on ways B/D/E. "
  "No complete underground route is inferred."
)


def build_source(path: Path) -> dict[str, Any]:
  """Keep OSM tags and source nodes; never turn negative-level links into streets."""
  tree = ET.parse(path).getroot()
  transform = Transformer.from_crs(4326, 25833, always_xy=True)
  nodes: dict[str, Any] = {}
  ways: dict[str, Any] = {}
  for node in tree.findall("node"):
    x, y = transform.transform(float(node.attrib["lon"]), float(node.attrib["lat"]))
    nodes[node.attrib["id"]] = {
      "id": node.attrib["id"],
      "point": [round(x - 389500, 3), round(5820000 - y, 3)],
      "tags": {t.attrib["k"]: t.attrib["v"] for t in node.findall("tag")},
    }
  for way in tree.findall("way"):
    ways[way.attrib["id"]] = {
      "points": [nodes[n.attrib["ref"]]["point"] for n in way.findall("nd")],
      "tags": {t.attrib["k"]: t.attrib["v"] for t in way.findall("tag")},
    }
  stairs = []
  for ref, key in zip("ABCDE", STEPS, strict=True):
    node = next(
      n
      for n in nodes.values()
      if n["tags"].get("name") == "Unter den Linden" and n["tags"].get("ref") == ref
    )
    way = ways[key]
    stairs.append(
      {
        "ref": ref,
        "osmNode": "node/" + node["id"],
        "osmWay": "way/" + key,
        "top": node["point"],
        "bottom": next(p for p in way["points"] if math.dist(p, node["point"]) > 1),
        "width": 2.3,
        "stepCount": int(way["tags"]["step_count"]),
        "tags": way["tags"],
      }
    )
  escalators = []
  for ref, key in zip("ABC", ESCALATORS, strict=True):
    way = ways[key]
    escalators.append(
      {
        "ref": ref,
        "osmWay": "way/" + key,
        "top": way["points"][-1],
        "bottom": way["points"][0],
        "width": 1.6,
        "stepCount": 32,
        "tags": way["tags"],
      }
    )
  lifts = []
  for key, entrance_key in [
    ("8196202075", "13291147284"),
    ("8196202076", "13280671539"),
  ]:
    node, entrance = nodes[key], nodes[entrance_key]
    lifts.append(
      {
        "osmNode": "node/" + key,
        "point": node["point"],
        "tags": node["tags"],
        "entranceNode": "node/" + entrance_key,
        "entrancePoint": entrance["point"],
      }
    )
  return {
    "schema_version": 1,
    "retrieved": "2026-09-30",
    "source": SOURCE_URL,
    "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
    "license": "ODbL-1.0",
    "officialPlan": OFFICIAL_PLAN,
    "stairs": stairs,
    "escalators": escalators,
    "lifts": lifts,
    "displayStatus": DISPLAY_STATUS,
  }


if __name__ == "__main__":
  root = Path(__file__).resolve().parents[1]
  source = root / "geo_data/regierungsviertel/raw/udl_v147/entrances.osm"
  target = root / "src/app/src/unterDenLindenEntranceSource.json"
  target.write_text(json.dumps(build_source(source), indent=2) + "\n")
