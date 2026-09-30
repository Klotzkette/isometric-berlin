"""Step 10: retain the complete source-bound Fernsehturm foot ensemble."""

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

# Published ensemble 09065023,T,002; roles are presentation interpretations.
TARGETS = (
  ("wings", "DEBE01YYK00006hp", "enclosed"),
  ("entrance", "DEBE01YYK00001Jr", "enclosed"),
  ("southSteps", "DEBE01YYK0000ERG", "steps"),
  ("northSteps", "DEBE01YYK00003rX", "steps"),
  ("westSteps", "DEBE01YYK000036H", "steps"),
  ("eastSteps", "DEBE01YYK00009ex", "steps"),
  ("entranceNorthRoof", "DEBE00YYUK0000Aq", "folded-roof"),
  ("entranceEastRoof", "DEBE00YYUK0000Av", "folded-roof"),
  ("entranceNorthCantilever", "DEBE00YYUK0000Au", "folded-roof"),
  ("entranceSouthRoof", "DEBE00YYUK0000Ar", "folded-roof"),
  ("gallery", "DEBE00YYUK0000BF", "gallery"),
  ("southPeak", "DEBE00YYUK0000Ai", "folded-roof"),
  ("northPeak", "DEBE00YYUK0000Ae", "folded-roof"),
  ("southWing", "DEBE00YYUK0000Ag", "folded-roof"),
  ("westNorthWing", "DEBE00YYUK0000Ak", "folded-roof"),
  ("westSouthWing", "DEBE00YYUK0000Ap", "folded-roof"),
)


def build_source(root: Path) -> dict[str, Any]:
  """Keep every original sheet and distinguish canopies from closed buildings."""
  archive = root / "geo_data/regierungsviertel/raw/lod2/LoD2_392_5820.zip"
  digest = hashlib.sha256(archive.read_bytes()).hexdigest()
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  profiles = []
  for key, identity, role in TARGETS:
    parent = extract_parent(archive, identity)
    footprint = building_footprint(parent)
    if footprint is None or not bounds.covers(footprint):
      raise ValueError(f"Unbounded pavilion {identity}")
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    for part in parts:
      for surface in part["surfaces"]:
        for ring in surface["rings"]:
          for x, _, z in ring:
            if not bounds.covers(Point(x + 389500, 5820000 - z)):
              raise ValueError(f"Unbounded pavilion surface {identity}")
    profiles.append(
      {
        "key": key,
        "parent_id": identity,
        "display_role": role,
        "source_created": parent.findtext("core:creationDate", namespaces=NS),
        "parts": parts,
      }
    )
  return {
    "schema_version": 1,
    "license": "dl-de/zero-2-0",
    "origin_epsg25833_m": [389500, 5820000, 30],
    "source_url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_392_5820.zip",
    "source_sha256": digest,
    "heritage_url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065023",
    "profiles": profiles,
    "conflict_policy": "The complete 2026 LoD2 source sheets remain retained. Thin folded roof cantilevers are roof surfaces, not solid ground-to-roof wedges; their generalized source side walls are not displayed. The gallery/eaves record keeps all measured roof planes, while its generalized ground-to-roof walls are omitted so they do not hide the pavilion glazing. A separately labelled open first-floor terrace follows this narrow source footprint. Four source staircase footprints are displayed as stairs instead of closed flat-roof prisms. Intermediate gallery/stair/glazing subdivisions are photograph-guided procedural estimates. No source street, path, tree or prior landmark is removed.",
  }


def main() -> int:
  """Write only the additive pavilion supplement."""
  root = Path(__file__).resolve().parents[1]
  target = root / "src/app/src/fernsehturmPavilionSource.json"
  target.write_text(json.dumps(build_source(root), separators=(",", ":")) + "\n")
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
