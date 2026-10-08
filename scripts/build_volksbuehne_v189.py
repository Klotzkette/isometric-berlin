"""Step 10: bounded Volksbühne source evidence and Räuberrad anchor."""

from __future__ import annotations

import hashlib
import json
import math
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
SOURCE = DATA / "volksbuehne-v189-source.json"
DEST = ROOT / "src/app/src/data/volksbuehneV189.json"
OWNER = "DEBE01YYK00001YG"


def extract() -> dict[str, Any]:
  """Retain complete original official surfaces and independently mapped OSM."""
  archive = DATA / "raw/lod2/LoD2_392_5820.zip"
  with zipfile.ZipFile(archive) as zipped:
    tree = ET.fromstring(zipped.read(zipped.namelist()[0]))
  parent = next(
    p for p in tree.findall(".//bldg:Building", NS) if p.get(GML_ID) == OWNER
  )
  footprint = building_footprint(parent)
  assert footprint is not None
  surfaces = []
  for kind in ["GroundSurface", "WallSurface", "RoofSurface"]:
    for surface in parent.findall(f".//bldg:{kind}", NS):
      rings = []
      for pos in surface.findall(".//gml:posList", NS):
        values = list(map(float, (pos.text or "").split()))
        rings.append([values[i : i + 3] for i in range(0, len(values), 3)])
      surfaces.append({"kind": kind, "ringsEpsg25833Nhn": rings})
  osm = gpd.read_file(
    DATA / "raw/outer-v159/candidate.gpkg",
    layer="multipolygons",
    where="osm_id = '5746884'",
  ).to_crs(25833)
  row = osm.iloc[0]
  nodes = gpd.read_file(
    DATA / "raw/outer-v159/berlin-260929.osm.pbf",
    layer="points",
    bbox=(13.410, 52.526, 13.413, 52.529),
  ).to_crs(25833)
  wheel = next(r for _, r in nodes.iterrows() if str(r.osm_id) == "2856686321")
  return {
    "schemaVersion": 1,
    "sourceDate": "2026-09-29",
    "osmSource": outlines.SOURCE_URL,
    "osmLicense": "ODbL-1.0",
    "building": {
      "id": OWNER,
      "osmId": "relation/5746884",
      "poiId": "node/2627106420",
      "osmGeometry": mapping(outlines.world(row.geometry)),
      "officialFootprint": mapping(outlines.world(footprint)),
      "surfaces": surfaces,
      "sourceMinNhnM": 35.866,
      "sourceMaxNhnM": 56.43,
      "groundY": 3,
      "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_392_5820.zip",
      "sourceSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
      "license": "dl-de/zero-2-0",
      "priorOwner": "5_-2: retained official parent and generic facade",
    },
    "wheel": {
      "id": "node/2856686321",
      "xz": list(outlines.world(wheel.geometry).coords)[0],
      "tags": outlines.tags_for(wheel),
      "groundY": 3,
      "displayHeightM": 4.08,
      "heightStatus": "Approximately four metres is published; 4.08 m local profile, depth, member widths, orientation and foot proportions are image-informed estimates, not survey dimensions.",
      "materialEvidence": "Retained OSM material=steel; rust-brown steel appearance confirmed by freely licensed photographs. No bronze claim.",
      "designCredit": "Bert Neumann (1990); fabricated by Rainer Haußmann (1994)",
    },
    "facts": [
      {
        "url": "https://www.berlin.de/aktuell/ausgaben/2015/juni/berliner-ereignisse/die-volksbuehne-am-rosa-luxemburg-platz-306988.php",
        "claim": "Theatre's own Thomas Martin account: Oskar Kaufmann, opened 1914; curved limestone front with six Muschelkalk columns, post-war flat roofs.",
      },
      {
        "url": "https://www.berlin.de/landesdenkmalamt/_assets/pdf-und-zip/denkmale/liste-karte-datenbank/dm_liste.pdf",
        "claim": "Heritage object 09080037: Volksbühne, 1913–14 Oskar Kaufmann; rebuilt 1952–54 Hans Richter.",
      },
    ],
    "sourceConflict": "Official single-part LoD2 preserves a uniform 20.564 m flat envelope, while photographs show stepped front/drum/stage volumes. This refinement keeps every existing source sheet and roof height; it adds only thin facade recognition and does not invent a new surveyed roof profile.",
    "displayStatus": "Exact source datum, footprint and original shell retained. Facade articulation, joints, columns and artwork subdivisions are procedural visual estimates; reference images remain external, texture-free evidence.",
  }


def build(source: dict[str, Any]) -> dict[str, Any]:
  """Pack only the facade source edges and exact artwork anchor for runtime."""
  owner = source["building"]
  rings = owner["officialFootprint"]["coordinates"]
  a, b = [2729.524, -820.760], [2767.817, -801.960]
  length = math.dist(a, b)
  tx, tz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
  center = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  front = []
  for p in rings[0][:-1]:
    u = (p[0] - center[0]) * tx + (p[1] - center[1]) * tz
    v = -(p[0] - center[0]) * tz + (p[1] - center[1]) * tx
    if -10 < u < 10 and v > -3:
      front.append([round(u, 6), round(v, 6)])
  return {
    "schemaVersion": 1,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "building": {
      "id": OWNER,
      "groundY": owner["groundY"],
      "topY": round(
        owner["sourceMaxNhnM"] - owner["sourceMinNhnM"] + owner["groundY"], 3
      ),
      "rings": [[[round(n, 3) for n in p] for p in r] for r in rings],
      "frontOrigin": center,
      "frontAxis": [tx, tz],
      "frontProfile": sorted(front),
      "columnCount": 6,
    },
    "wheel": source["wheel"],
    "displayStatus": source["displayStatus"],
    "sourceConflict": source["sourceConflict"],
  }


def main() -> None:
  """Keep source acquisition bounded and deterministic; never rewrite city packets."""
  if not SOURCE.exists():
    SOURCE.write_text(json.dumps(extract(), ensure_ascii=False, indent=2) + "\n")
  result = build(json.loads(SOURCE.read_text()))
  DEST.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(
    f"{OWNER}: {len(result['building']['rings'][0])} source vertices; exact Räuberrad node anchor"
  )


if __name__ == "__main__":
  main()
