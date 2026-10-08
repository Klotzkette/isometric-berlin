"""Step 10: bounded Alexanderplatz architecture and transparent station evidence."""

from __future__ import annotations

import copy
import hashlib
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import geopandas as gpd
from shapely.geometry import Polygon

from isometric_berlin.data.fetch_lod2 import NS, leaf_building_parts
from scripts.build_bebelplatz_building_source import (
  extract_parent,
  part_profile,
  world_ring,
)

ROOT = Path(__file__).resolve().parents[1]
TARGETS = {
  "alexa": ("392_5819", "DEBE01YYK00001Xy", "258898047"),
  "lehrer": ("392_5820", "DEBE01YYK00003SW", "24273222"),
  "alexanderhaus": ("392_5820", "DEBE01YYK00002iS", "376362563"),
  "berolinahaus": ("392_5820", "DEBE01YYK00001QK", "23723113"),
  "jannowitz": ("392_5819", "DEBE00YY1TF0003o", "20144739"),
}
REFERENCES = [
  "https://www.alexacentre.com/en/about-us/",
  "https://www.berlin.de/sehenswuerdigkeiten/3560681-3558930-berolinahaus.html",
  "https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/haus-des-lehrers-und-kongresshalle-641041.php",
  "https://www.berlin.de/ost-west-ost-kulturbahnhoefe/en/history-walk/artikel.1604336.en.php",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011324",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011326",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080415",
]
CONFLICTS = [
  "The late-1920s/1930s buildings near the Weltzeituhr are identified as Peter Behrens's Alexanderhaus and Berolinahaus (1929-32); they are not labelled Jugendstil or nineteenth-century buildings.",
  "Every original LoD2 part and sheet is retained. Outer families receive only the existing outer presentation's rigid translation to ground y=3. Alexanderplatz's earlier station source retains its existing elevation exactly.",
  "Haus des Lehrers: official LoD2 has an unsupported hip roof up to 58.754 m above its ground. The published 54 m flat curtain-wall slab and photograph govern the display: original eaves at 54.844 m are retained, the false hip is displayed as a flat roof. OSM's 12 levels and the heritage inventory's 13 storeys differ; the heritage description governs the recognition rhythm.",
  "Alexanderplatz: LoD2's three planar roof strips are a coarse proxy for the heritage inventory's round-arched hall. Its measured axis, footprint width, spring and summit govern an independently sampled barrel roof; transparent end skirts leave the rail mouths open below the spring.",
  "Jannowitzbruecke: LoD2's hip-like roof proxy omits the documented basilical clerestory. The measured footprint, eaves and summit govern a low shoulder roof and raised monitor with transparent sides. Fine structural spacings remain display estimates.",
  "Alexa's full 143-vertex primary footprint is retained. Overlapping Alexander Tower construction source DEBE00YYy600004g and the separate small roof/service body DEBE01YYK0001yEs are not replaced or swallowed.",
  "Friedrichstrasse: all previous curved twin Tudor roofs, three platforms, six tracks, entrance, clock and facade detail remain; the supplement adds recessed structural members only. No existing model is replaced.",
  "Glass is transparent in drawn and native modes, with no opaque wall or voxel closure behind it. Station additions do not define whole-footprint pedestrian collision. All nonsurveyed bays, mural colour fields, rails and trusses are explicitly procedural estimates; artwork is a coarse independently authored colour rhythm, never an image reproduction.",
]


def frame(part: dict[str, Any]) -> dict[str, Any]:
  """Fit orientation to the exact source footprint, retaining original corners."""
  polygon = Polygon(part["ring"], part["holes"])
  corners = list(polygon.minimum_rotated_rectangle.exterior.coords)[:-1]
  a, b = max(
    zip(corners, corners[1:] + corners[:1], strict=True),
    key=lambda ab: math.dist(*ab),
  )
  length = math.dist(a, b)
  dx, dz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
  if dx < 0:
    dx, dz = -dx, -dz
  return {
    "x": round(sum(p[0] for p in corners) / 4, 4),
    "z": round(sum(p[1] for p in corners) / 4, 4),
    "dx": round(dx, 8),
    "dz": round(dz, 8),
    "length": round(length, 4),
    "width": round(polygon.minimum_rotated_rectangle.area / length, 4),
  }


def complete_part_profile(part: ET.Element) -> dict[str, Any]:
  """Retain closing sheets between the seven Alexanderhaus source components."""
  profile = part_profile(part)
  for polygon in part.findall(".//bldg:ClosureSurface//gml:Polygon", NS):
    profile["surfaces"].append(
      {
        "kind": "ClosureSurface",
        "rings": [world_ring(p) for p in polygon.findall(".//gml:posList", NS)],
      }
    )
  return profile


def build(root: Path = ROOT) -> dict[str, Any]:
  """Read the existing small local ZIPs; never download or mutate city packets."""
  profiles = []
  for key, (tile, pid, way) in TARGETS.items():
    path = root / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip"
    parent = extract_parent(path, pid)
    original = [
      complete_part_profile(p) for p in leaf_building_parts(parent) or [parent]
    ]
    # Berolinahaus is already a complete resident v169 core owner at y=5.2.
    # Its existing source shell and native cells stay; this release adds a facade.
    display_ground = 5.2 if key == "berolinahaus" else 3
    offset = round(display_ground - min(p["ground_y_m"] for p in original), 3)
    parts = copy.deepcopy(original)
    for p in parts:
      for k in ("ground_y_m", "top_y_m"):
        p[k] = round(p[k] + offset, 3)
      for surface in p["surfaces"]:
        for ring in surface["rings"]:
          for q in ring:
            q[1] = round(q[1] + offset, 3)
    profiles.append(
      {
        "key": key,
        "parentId": pid,
        "osmId": "way/" + way,
        "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/" + path.name,
        "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "displayOffsetY": offset,
        "originalParts": original,
        "parts": parts,
        "frame": frame(max(parts, key=lambda p: Polygon(p["ring"]).area)),
      }
    )
  previous = json.loads((root / "src/app/src/schlossEastSource.json").read_text())
  hall = previous["profiles"]["stationHall"]
  profiles.append(
    {
      "key": "alexanderStation",
      "parentId": hall["parent_id"],
      "osmId": "way/20144781",
      "sourceUrl": hall.get("source_url", "https://gdi.berlin.de/data/a_lod2/atom/"),
      "displayOffsetY": 0,
      "originalParts": hall["parts"],
      "parts": hall["parts"],
      "frame": frame(hall["parts"][0]),
    }
  )
  ids = {p["parentId"] for p in profiles if p["key"] != "berolinahaus"}
  retained = gpd.read_file(
    root / "geo_data/regierungsviertel/raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    bbox=(2600, -400, 3400, 700),
  )
  owners = []
  for _, row in retained.iterrows():
    if row.sourceId.strip() not in ids:
      continue
    polys = (
      [row.geometry] if row.geometry.geom_type == "Polygon" else row.geometry.geoms
    )
    owners.append(
      {
        "id": row.sourceId,
        "height": row.height,
        "minHeight": row.minHeight,
        "nativeHeight": max(2, round(row.height / 2) * 2),
        "polygons": [
          {
            "ring": list(map(list, p.exterior.coords[:-1])),
            "holes": [list(map(list, h.coords[:-1])) for h in p.interiors],
          }
          for p in polys
        ],
      }
    )
  return {
    "schemaVersion": 1,
    "originEpsg25833": [389500, 5820000, 30],
    "license": "dl-de/zero-2-0; ODbL-1.0",
    "profiles": profiles,
    "outerOwners": owners,
    "references": REFERENCES,
    "conflicts": CONFLICTS,
  }


def main() -> None:
  """Write separate original-source and lightweight navigation evidence."""
  data = build()
  dest = ROOT / "src/app/src/data"
  (dest / "alexanderStationsV183Source.json").write_text(
    json.dumps(data, separators=(",", ":")) + "\n"
  )
  nav = {
    "friedrichstrasseAnchor": next(
      p["world"]
      for p in json.loads(
        (ROOT / "src/app/public/mesh/regierungsviertel/scene.json").read_text()
      )["landmarks"]
      if p["name"] == "Bahnhof Berlin Friedrichstraße"
    ),
    "profiles": [
      {
        "key": p["key"],
        "parentId": p["parentId"],
        "frame": p["frame"],
        "parts": [{k: v for k, v in q.items() if k != "surfaces"} for q in p["parts"]],
      }
      for p in data["profiles"]
    ],
    "outerOwners": data["outerOwners"],
  }
  (dest / "alexanderStationsV183Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print({"profiles": len(data["profiles"]), "owners": len(data["outerOwners"])})


if __name__ == "__main__":
  main()
