"""Step 10: retain exact Urania source sheets and bounded Lützowplatz evidence."""

from __future__ import annotations

import hashlib
import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import build_surrounding_outlines as outlines
import geopandas as gpd
from shapely.geometry import mapping

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, building_footprint

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
SOURCE = DATA / "urania-luetzow-v188-source.json"
DEST = ROOT / "src/app/src/data/uraniaLuetzowV188.json"


def extract() -> dict[str, Any]:
  """Read already retained OSM and official LoD2; no inferred source vertices."""
  candidate = DATA / "raw/outer-v159/candidate.gpkg"
  frame = gpd.read_file(
    candidate,
    layer="multipolygons",
    where="osm_way_id IN ('11405245', '11687794')",
  ).to_crs(25833)
  features = {
    str(row.osm_way_id): outlines.world(row.geometry) for _, row in frame.iterrows()
  }
  park = features["11405245"]
  bbox = (13.3515, 52.504, 13.3537, 52.5055)
  areas = gpd.read_file(candidate, layer="multipolygons", bbox=bbox).to_crs(25833)
  beds = []
  for _, row in areas.iterrows():
    tags = outlines.tags_for(row)
    geometry = outlines.world(row.geometry)
    if tags.get("landuse") == "grass" and geometry.area < 60 and park.covers(geometry):
      beds.append({"id": f"way/{row.osm_way_id}", "geometry": mapping(geometry)})
  paths = []
  for _, row in (
    gpd.read_file(candidate, layer="lines", bbox=bbox).to_crs(25833).iterrows()
  ):
    tags = outlines.tags_for(row)
    geometry = outlines.world(row.geometry)
    if tags.get("highway") not in {"footway", "path"}:
      continue
    clipped = geometry.intersection(park.buffer(-1))
    if clipped.is_empty or clipped.length < 2:
      continue
    paths.append(
      {
        "id": f"way/{row.osm_id}",
        "geometry": mapping(geometry),
        "clippedGeometry": mapping(clipped),
        "surface": tags.get("surface"),
        "displayWidthM": 2,
        "widthStatus": "Unmeasured two-metre display width; course is exact OSM",
      }
    )
  fountains = []
  nodes = gpd.read_file(
    DATA / "raw/outer-v159/berlin-260929.osm.pbf",
    layer="points",
    bbox=bbox,
  ).to_crs(25833)
  for _, row in nodes.iterrows():
    tags = outlines.tags_for(row)
    point = outlines.world(row.geometry)
    if tags.get("amenity") == "fountain" and park.covers(point):
      fountains.append({"id": f"node/{row.osm_id}", "xz": list(point.coords)[0]})
  archive = DATA / "raw/lod2/LoD2_387_5818.zip"
  with zipfile.ZipFile(archive) as zipped:
    tree = ET.fromstring(zipped.read(zipped.namelist()[0]))
  parent = next(
    p
    for p in tree.findall(".//bldg:Building", NS)
    if p.get(GML_ID) == "DEBE07YY900005Dq"
  )
  surfaces = []
  for kind in ["GroundSurface", "WallSurface", "RoofSurface"]:
    for surface in parent.findall(f".//bldg:{kind}", NS):
      rings = []
      for pos in surface.findall(".//gml:posList", NS):
        values = list(map(float, (pos.text or "").split()))
        rings.append(
          [[values[i], values[i + 1], values[i + 2]] for i in range(0, len(values), 3)]
        )
      surfaces.append({"type": kind, "ringsEpsg25833Nhn": rings})
  footprint = building_footprint(parent)
  assert footprint is not None
  return {
    "schemaVersion": 1,
    "sourceDate": "2026-09-29",
    "osmSource": outlines.SOURCE_URL,
    "osmLicense": "ODbL-1.0",
    "urania": {
      "id": parent.get(GML_ID),
      "osmId": "way/11687794",
      "osmGeometry": mapping(features["11687794"]),
      "officialFootprint": mapping(outlines.world(footprint)),
      "surfaces": surfaces,
      "sourceMinNhnM": 34.676,
      "sourceMaxNhnM": 49.411,
      "groundY": 5.2,
      "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_387_5818.zip",
      "sourceSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
      "license": "dl-de/zero-2-0",
    },
    "park": {"id": "way/11405245", "geometry": mapping(park)},
    "beds": sorted(beds, key=lambda item: item["id"]),
    "paths": sorted(paths, key=lambda item: item["id"]),
    "fountains": sorted(fountains, key=lambda item: item["id"]),
    "displayStatus": "Upper measured Urania envelope supplements retained 9 m fallback; facade subdivision, basin dimensions, sections and jets are display estimates. No ground owner or prior detail removed.",
  }


def build(source: dict[str, Any]) -> dict[str, Any]:
  """Pack exact high-roof ring, source wall edges and small garden features."""
  owner = source["urania"]
  surfaces = [
    {
      "type": item["type"],
      "rings": [
        [
          [
            round(p[0] - 389500, 3),
            round(p[2] - owner["sourceMinNhnM"] + owner["groundY"], 3),
            round(5820000 - p[1], 3),
          ]
          for p in ring
        ]
        for ring in item["ringsEpsg25833Nhn"]
      ],
    }
    for item in owner["surfaces"]
  ]
  high_roof = next(
    item["rings"][0]
    for item in surfaces
    if item["type"] == "RoofSurface" and item["rings"][0][0][1] > 19
  )
  return {
    "schemaVersion": 1,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "urania": {
      "id": owner["id"],
      "osmId": owner["osmId"],
      "highRoof": high_roof,
      "additionFloorY": 14.2,
      "sourceTopY": 19.935,
      "heightStatus": "14.735 m official NHN range; source translated by 5.2-34.676 m into retained viewer datum; only upper extension above prior 9 m shell added",
    },
    "park": source["park"],
    "beds": source["beds"],
    "paths": source["paths"],
    "fountains": source["fountains"],
    "displayStatus": source["displayStatus"],
  }


def main() -> None:
  """Reuse the committed bounded evidence unless an explicit extract is needed."""
  if not SOURCE.exists():
    SOURCE.write_text(json.dumps(extract(), ensure_ascii=False, indent=2) + "\n")
  result = build(json.loads(SOURCE.read_text()))
  DEST.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(
    f"Urania source roof {len(result['urania']['highRoof'])} vertices; "
    f"{len(result['fountains'])} basins, {len(result['beds'])} small lawns, "
    f"{len(result['paths'])} mapped paths"
  )


if __name__ == "__main__":
  main()
