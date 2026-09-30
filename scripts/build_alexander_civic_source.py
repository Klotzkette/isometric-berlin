"""Step 10: preserve complete Rotes Rathaus and St. Marien LoD2 source sheets."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from shapely.geometry import Point

from isometric_berlin.data.fetch_lod2 import (
  NS,
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)
from scripts.build_bebelplatz_building_source import extract_parent, part_profile

MARIEN_PARENT_ID = "DEBE01YYK000006X"


def build_source(root: Path) -> dict[str, Any]:
  """Retain all source parts; leave the preceding outline source byte-for-byte."""
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  archive = root / "geo_data/regierungsviertel/raw/lod2/LoD2_391_5820.zip"
  parent = extract_parent(archive, MARIEN_PARENT_ID)
  footprint = building_footprint(parent)
  if footprint is None or not bounds.covers(footprint):
    raise ValueError("Marien source leaves the approved polygon")
  parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
  for part in parts:
    for surface in part["surfaces"]:
      for ring in surface["rings"]:
        for x, _, z in ring:
          if not bounds.covers(Point(x + 389500, 5820000 - z)):
            raise ValueError("A Marien source vertex leaves the approved polygon")
  old = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  rathaus = json.loads((root / "src/app/src/schlossEastSource.json").read_text())[
    "profiles"
  ]["rathaus"]
  rathaus = {
    **rathaus,
    "key": "rathaus",
    "replaced_prism_ids": ["4211905", "ion-4211905"],
    "previous_display_prisms": [
      p for p in old if p["id"] in ["4211905", "ion-4211905"]
    ],
  }
  marien = {
    "key": "marien",
    "parent_id": MARIEN_PARENT_ID,
    "osm_identity": "https://www.openstreetmap.org/way/474111581",
    "source_url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5820.zip",
    "source_created": parent.findtext("core:creationDate", namespaces=NS),
    "source_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "replaced_prism_ids": ["474111581"],
    "previous_display_prisms": [p for p in old if p["id"] == "474111581"],
    "parts": parts,
  }
  return {
    "schema_version": 1,
    "license": "dl-de/zero-2-0",
    "origin_epsg25833_m": [389500, 5820000, 30],
    "source_attribution": "3D building models: Geoportal Berlin (dl-de/zero-2-0)",
    "profiles": {"rathaus": rathaus, "marien": marien},
    "conflict_policy": "Every original wall and roof sheet remains retained. Rathaus is copied exactly from the v1.0.48 supplement including all three courtyards. Marien source tower sheets are retained beside a source-bound recognition reconstruction of the copper clock stage and open lantern; the coarse cone-like source envelope closes those openings and is not double-drawn. Marien uses the original base and source spire top; intermediate copper-stage subdivisions are procedural photo fits. Rathaus's coarse solid pyramidal roof above its tower is displayed as the published 74 m parapet and an open steel terminal reaching the published 94 m flagpole top. Original roof sheets remain unchanged in this source. Only the Marien terminal finial/cross extends above the source summit. Facade subdivisions are visual-reference fits, not facade measurements.",
  }


def main() -> int:
  """Write only the bounded supplement."""
  root = Path(__file__).resolve().parents[1]
  target = root / "src/app/src/alexanderCivicSource.json"
  target.write_text(json.dumps(build_source(root), separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
