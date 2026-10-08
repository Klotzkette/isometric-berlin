"""Step 10: bounded source-wall recognition at Suhrkamp and Pfefferberg.

No source packet, envelope, navigation owner or terrain is rewritten. Source
sheets remain evidence; only shallow facade members are prepared for runtime.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
from build_bebelplatz_building_source import extract_parent, part_profile, world_ring
from build_surrounding_outlines import tags_for, world
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import NS, leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
SOURCE = DATA / "suhrkamp-pfefferberg-v189-source.json"
DEST = ROOT / "src/app/src/data/suhrkampPfefferbergV189.json"
TARGETS = {
  "DEBE01AL4zH0000F": ("suhrkamp", "716014884", "392_5820"),
  "DEBE01AL4zH0000E": ("suhrkamp-residential", "716014884", "392_5820"),
  "DEBE03YY600003p6": ("pfefferberg-terrace", "184595089", "392_5821"),
  "DEBE03YY60000CTK": ("pfefferberg-hall", "23695957", "392_5821"),
  "DEBE03YY600008Lw": ("pfefferberg-hostel", "23695971", "392_5821"),
  "DEBE03YY60000470": ("pfefferberg-restaurant", "184571231", "392_5821"),
  "DEBE03YY60000Ayy": ("pfefferberg-house13", "184571232", "392_5821"),
  "DEBE03YY600008GE": ("pfefferberg-south", "184576296", "392_5821"),
}
POLICY = (
  "Retain all prior source geometry and navigation. Exact LoD2 facade planes; "
  "non-surveyed window, frame, cornice and material subdivisions. No envelope "
  "replacement. Pfefferberg retains the established flat y=3 presentation; "
  "its actual elevated beer garden and open terrace are not reconstructed."
)


def digest(path: Path) -> str:
  """Fingerprint the exact inputs used for the bounded extract."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def extract() -> dict[str, Any]:
  """Retain complete source sheets and the actual previous rendered owners."""
  outlines_path = DATA / "raw/outer-v159/resolved-outlines.gpkg"
  owners = gpd.read_file(
    outlines_path, layer="buildings", bbox=(2620, -1440, 2800, -940)
  )
  osm_path = DATA / "raw/outer-v159/candidate.gpkg"
  areas = gpd.read_file(
    osm_path, layer="multipolygons", bbox=(13.408, 52.526, 13.414, 52.534)
  ).to_crs(25833)
  areas.geometry = areas.geometry.map(world)
  prior_path = DATA / "scheunenviertel-v168.json"
  prior = json.loads(prior_path.read_text())
  retained = {b["id"]: b for b in prior["retainedDetailedBuildings"]}
  buildings = []
  archives = {}
  for owner_id, (kind, osm_id, tile) in TARGETS.items():
    owner = owners[owners.sourceId == owner_id].iloc[0]
    osm = areas[areas.osm_way_id == osm_id].iloc[0]
    archive = DATA / f"raw/lod2/LoD2_{tile}.zip"
    archives[tile] = {
      "url": f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{tile}.zip",
      "sha256": digest(archive),
      "license": "dl-de/zero-2-0",
    }
    parent = extract_parent(archive, owner_id)
    parts = []
    for element in leaf_building_parts(parent) or [parent]:
      profile = part_profile(element)
      for surface_kind in ["GroundSurface", "ClosureSurface"]:
        for polygon in element.findall(f".//bldg:{surface_kind}//gml:Polygon", NS):
          profile["surfaces"].append(
            {
              "kind": surface_kind,
              "rings": [world_ring(p) for p in polygon.findall(".//gml:posList", NS)],
            }
          )
      parts.append(profile)
    source_ground = owner.sourceGroundY
    if owner_id in retained:
      source_ground = retained[owner_id]["groundNHN"] - 30
    offset = 3 - source_ground
    buildings.append(
      {
        "id": owner_id,
        "kind": kind,
        "osmId": "way/" + osm_id,
        "osmTags": tags_for(osm),
        "osmGeometry": mapping(osm.geometry),
        "footprint": mapping(owner.geometry),
        "sourceGroundY": source_ground,
        "displayGroundY": 3,
        "translationY": round(offset, 3),
        "previousHeightM": owner.height,
        "parts": parts,
        "previousRepresentation": "complete original source sheets"
        if owner_id in retained
        else "retained parent-envelope prism",
        "sourceSheetCount": sum(len(p["surfaces"]) for p in parts),
      }
    )
  lines = gpd.read_file(
    osm_path, layer="lines", bbox=(13.410, 52.531, 13.413, 52.533)
  ).to_crs(25833)
  lines.geometry = lines.geometry.map(world)
  stairs = [
    {"id": "way/" + r.osm_id, "geometry": mapping(r.geometry), "tags": tags_for(r)}
    for _, r in lines.iterrows()
    if r.osm_id in {"184595085", "184595081", "184595078", "672103208"}
  ]
  garden = areas[areas.osm_way_id == "80578266"].iloc[0]
  return {
    "schemaVersion": 1,
    "policy": POLICY,
    "archives": archives,
    "inputSha256": {
      str(p.relative_to(ROOT)): digest(p) for p in [prior_path, outlines_path, osm_path]
    },
    "osmSource": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    "osmLicense": "ODbL-1.0",
    "buildings": buildings,
    "neighbourFootprints": [mapping(p) for p in owners.geometry],
    "stairsEvidenceOnly": stairs,
    "gardenEvidenceOnly": {
      "id": "way/80578266",
      "geometry": mapping(garden.geometry),
      "tags": tags_for(garden),
    },
    "terrainConflict": "Actual 13-step entry and paired 12-step flights are mapped, but retained surrounding presentation flattens individual building grounds to y=3. Stairs are evidence only: do not add an unsupported raised slab, floating flight or cut into old source owners.",
  }


def facade_faces(building: dict[str, Any], occupied: Any) -> list[dict[str, Any]]:
  """Fit source-contained rectangles to exposed walls, excluding party walls."""
  footprint = shape(building["footprint"])
  faces = []
  seen = set()
  for part in building["parts"]:
    for surface in part["surfaces"]:
      if surface["kind"] != "WallSurface":
        continue
      ring = surface["rings"][0]
      # Source wall can contain collinear intermediate vertices. Its longest
      # horizontal chord supplies an exact facade basis; zero-area walls fail.
      a, b = max(
        ((a, b) for a in ring for b in ring),
        key=lambda pair: math.hypot(pair[1][0] - pair[0][0], pair[1][2] - pair[0][2]),
      )
      length = math.hypot(b[0] - a[0], b[2] - a[2])
      if length < 4:
        continue
      tx, tz = (b[0] - a[0]) / length, (b[2] - a[2]) / length
      nx, nz = -tz, tx
      midx, midz = (a[0] + b[0]) / 2, (a[2] + b[2]) / 2
      if footprint.contains(Point(midx + nx * 0.2, midz + nz * 0.2)):
        nx, nz = -nx, -nz
      # Only exterior edges of the complete parent; no internal part seams.
      if footprint.contains(Point(midx + nx * 0.25, midz + nz * 0.25)):
        continue
      if any(
        occupied.contains(
          Point(a[0] + tx * length * u + nx * 0.7, a[2] + tz * length * u + nz * 0.7)
        )
        for u in [0.2, 0.5, 0.8]
      ):
        continue
      projected = [
        [
          [(p[0] - a[0]) * tx + (p[2] - a[2]) * tz, p[1] + building["translationY"]]
          for p in r
        ]
        for r in surface["rings"]
      ]
      wall = Polygon(projected[0], projected[1:]).buffer(0)
      if wall.is_empty:
        continue
      bottom = max(3, wall.bounds[1])
      for top in sorted({p[1] for r in projected for p in r}, reverse=True):
        if top - bottom < 2.5:
          continue
        if not wall.buffer(0.003).covers(
          box(0.04, bottom + 0.04, length - 0.04, top - 0.04)
        ):
          continue
        key = tuple(round(v, 3) for v in [a[0], a[2], b[0], b[2], bottom, top])
        if key in seen:
          break
        seen.add(key)
        faces.append(
          {
            "ownerId": building["id"],
            "partId": part["id"],
            "kind": building["kind"],
            "a": [a[0], a[2]],
            "b": [b[0], b[2]],
            "normal": [round(nx, 8), round(nz, 8)],
            "bottom": round(bottom, 3),
            "top": round(top, 3),
            "length": round(length, 4),
            "wallGeometry": mapping(wall),
          }
        )
        break
  return faces


def build(source: dict[str, Any]) -> dict[str, Any]:
  """Derive finite source-wall rectangles without generating city geometry."""
  occupied = unary_union([shape(g) for g in source["neighbourFootprints"]])
  faces = [f for b in source["buildings"] for f in facade_faces(b, occupied)]
  return {
    "schemaVersion": 1,
    "policy": POLICY,
    "sourceSha256": digest(SOURCE),
    "faces": faces,
    "ownerIds": list(TARGETS),
    "sourcePartCount": sum(len(b["parts"]) for b in source["buildings"]),
    "sourceSheetCount": sum(b["sourceSheetCount"] for b in source["buildings"]),
    "cameraTargets": {"suhrkamp": [2684, 15, -984], "pfefferberg": [2735, 10, -1371]},
  }


def main() -> None:
  """Use the committed bounded evidence; raw archives are extraction-only."""
  if not SOURCE.exists():
    SOURCE.write_text(json.dumps(extract(), ensure_ascii=False, indent=2) + "\n")
  data = build(json.loads(SOURCE.read_text()))
  DEST.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(
    f"{len(data['faces'])} source facade rectangles, {data['sourcePartCount']} retained source parts"
  )


if __name__ == "__main__":
  main()
