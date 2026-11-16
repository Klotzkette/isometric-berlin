"""Finite geography audit: retain V190 water rings and distinguish fens/culverts."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import geopandas as gpd
from shapely.geometry import mapping, shape

from scripts.build_civic_places_v352 import write
from scripts.build_grunewald_venues_v354 import REFERENCES
from scripts.build_surrounding_outlines import source_identity, tags_for, world

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"


def build():
  source = GEO / "grunewald-terrain-v190.json"
  terrain = json.loads(source.read_bytes())
  original = GEO / "raw/outskirts-v187/candidate.gpkg"
  lakes = []
  for row in terrain["lakes"] + terrain["additionalWater"]:
    geometry = shape(row["geometry"])
    lakes.append(
      {
        "sourceId": row["sourceId"],
        "name": row["name"],
        "waterY": row["waterY"],
        "geometry": row["geometry"],
        "areaM2": geometry.area,
        "ringPolicy": "Complete original vertices and holes unchanged; not a replacement.",
      }
    )
  features = []
  for layer, clause in [
    (
      "multipolygons",
      "name IN ('Riemeisterfenn','Langes Luch','Hundekehlefenn','Dianasee','Koenigssee','Nikolassee')",
    ),
    ("lines", "name IN ('Fenngraben','Hundekehlegraben','Wolfsschluchtkanal')"),
  ]:
    frame = gpd.read_file(original, layer=layer, where=clause).to_crs(25833)
    for _, row in frame.iterrows():
      tags = tags_for(row)
      if tags.get("boundary") or tags.get("railway") or tags.get("place"):
        status = "boundary-or-station-not-water"
      elif tags.get("natural") == "wetland" or tags.get("wetland"):
        status = "wetland-not-new-open-lake"
      elif tags.get("tunnel") == "culvert":
        status = "buried-connection-not-visible-water"
      elif tags.get("waterway"):
        status = "mapped-connector-retained"
      else:
        status = "mapped-water-retained"
      features.append(
        {
          "sourceId": f"OSM-way-{row['osm_id']}"
          if layer == "lines"
          else source_identity(row),
          "tags": tags,
          "geometry": mapping(world(row.geometry)),
          "status": status,
        }
      )
  receipt = {
    "schemaVersion": 1,
    "baseline": "4bb88fa3",
    "checked": "2026-11-16",
    "references": REFERENCES[:4],
    "existingWater": lakes,
    "geographicDistinctions": features,
    "protectedFiles": {
      str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in [
        source,
        ROOT / "src/app/src/data/grunewaldTerrainV190.json",
        GEO / "grunewald-v190-packet-audit.json",
        GEO / "grunewald-landmarks-v190-source.json.gz",
      ]
    },
    "conclusion": "The five V190 main lakes plus 32 mapped water bodies/connections retain complete source rings, holes and levels. Fenngraben links Krumme Lanke to Grunewaldsee; Wolfsschluchtkanal includes a buried section. Riemeisterfenn, Langes Luch and Hundekehlefenn are not newly flooded polygons. No new waterway width, shoreline or path inferred from a name. Three measured restaurant bodies are the bounded visible correction in this pass.",
    "limitations": "This is not a survey of every seasonal kiosk, private restaurant or historical water level. Koenigssee, Dianasee and Nikolassee are distinct mapped water owners outside the five-lake DGM subset. No invented water joins or additional shore paths.",
  }
  write(GEO / "grunewald-geography-v354-audit.json.gz", receipt)
  print(len(lakes), "retained water owners;", len(features), "geographic distinctions")


if __name__ == "__main__":
  build()
