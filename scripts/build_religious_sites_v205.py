"""Step 10: complete retained religious-building sheets and bounded recognition."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import normal_of, triangles_for
from religious_sites_v205_geometry import decorate
from shapely.affinity import affine_transform
from shapely.geometry import Point, Polygon, mapping

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from isometric_berlin.data.fetch_osm import parse_hstore

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
EVIDENCE = GEO / "religious-sites-v205-source.json"
OUTPUT = ROOT / "src/app/src/data/religiousSitesV205.json"
SITES = [
  (
    "gethsemane",
    "Gethsemanekirche",
    "23495060",
    "392_5823",
    ["DEBE03YY6000009u"],
    0xA26C50,
    0x655F58,
  ),
  (
    "samariter",
    "Samariterkirche",
    "28296808",
    "395_5819",
    ["DEBE02YY2000000L"],
    0xAB6D4D,
    0x665B50,
  ),
  (
    "passion",
    "Passionskirche",
    "106818297",
    "391_5816",
    ["DEBE02YY4000000y"],
    0xA97559,
    0x746B5C,
  ),
  (
    "wilmersdorf",
    "Wilmersdorfer Moschee",
    "30098331",
    "385_5816",
    ["DEBE04YY50003AIw", "DEBE04YY50003LLr", "DEBE04YY50003Ue3"],
    0xE7DFCA,
    0x788B8F,
  ),
  (
    "sehitlik",
    "Şehitlik-Moschee",
    "30900412",
    "391_5815",
    ["DEBE00YY1Cw0002e"],
    0xDDCEAB,
    0x78878B,
  ),
  (
    "rykestrasse",
    "Synagoge Rykestraße",
    "23175400",
    "392_5821",
    ["DEBE03YY600004DV"],
    0xA9795D,
    0x728179,
  ),
]


def save(path: Path, data: Any) -> None:
  """Write small deterministic source evidence or runtime geometry."""
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")


def extract() -> dict[str, Any]:
  """Retain every original wall/roof coordinate from the existing local archives."""
  ids = ",".join("'" + s[2] + "'" for s in SITES)
  osm = gpd.read_file(
    GEO / "raw/outer-v159/candidate.gpkg",
    layer="multipolygons",
    where=f"osm_way_id IN ({ids})",
  ).to_crs(25833)
  records = []
  for key, name, oid, tile, parents, wall, roof in SITES:
    row = osm[osm.osm_way_id == oid].iloc[0]
    geom = affine_transform(row.geometry, [1, 0, 0, -1, -389500, 5820000])
    archive = GEO / f"raw/lod2/LoD2_{tile}.zip"
    parts = []
    for identity in parents:
      parent = extract_parent(archive, identity)
      raw = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
      floor = min(
        min(
          p["ground_y_m"],
          min(v[1] for s in p["surfaces"] for ring in s["rings"] for v in ring),
        )
        for p in raw
      )
      for part in raw:
        part["parentId"] = identity
        part["viewerOffsetY"] = 3 - floor
        parts.append(part)
    records.append(
      {
        "id": key,
        "name": name,
        "osmId": oid,
        "osmGeometry": mapping(geom),
        "osmTags": parse_hstore(row.other_tags or ""),
        "parents": parents,
        "parts": parts,
        "sourceUrl": f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{tile}.zip",
        "archiveSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "wallColor": wall,
        "roofColor": roof,
        "groundY": 3,
      }
    )
  return {
    "schemaVersion": 1,
    "license": "dl-de/zero-2-0; ODbL-1.0",
    "osmSource": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    "worldOrigin": [389500, 30, 5820000],
    "sites": records,
    "policy": "Complete original sheets retained. Each parent uses the previous outer ground y=3; source vertical differences are preserved. Only exact named coarse owners transfer. Decorative architecture, small sections and missing tall roof features are explicit visual estimates.",
  }


def build(evidence: dict[str, Any]) -> dict[str, Any]:
  """Prepare exact surfaces and sparse source-plane architectural subdivisions."""
  sites = []
  for item in evidence["sites"]:
    triangles = []
    walls = []
    nav = []
    for part in item["parts"]:
      offset = part["viewerOffsetY"]
      nav.append(
        {
          "id": part["id"],
          "parentId": part["parentId"],
          "ring": part["ring"],
          "holes": part["holes"],
          "baseY": part["ground_y_m"] + offset,
          "topY": part["top_y_m"] + offset,
        }
      )
      for surface in part["surfaces"]:
        rings = [
          [[x, round(y + offset, 6), z] for x, y, z in ring]
          for ring in surface["rings"]
        ]
        if len(rings[0]) < 3:
          continue
        n = normal_of(rings[0])
        if not np.isfinite(n).all():
          continue
        color = (
          item["roofColor"] if surface["kind"] == "RoofSurface" else item["wallColor"]
        )
        for tri in triangles_for(rings):
          triangles.append(
            {
              "points": tri,
              "color": color,
              "kind": surface["kind"],
              "partId": part["id"],
            }
          )
        if surface["kind"] != "WallSurface" or abs(n[1]) > 0.01:
          continue
        a, b = max(
          ((a, b) for a in rings[0] for b in rings[0]),
          key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
        )
        length = math.hypot(b[0] - a[0], b[2] - a[2])
        if length < 2.2:
          continue
        tx, tz = (b[0] - a[0]) / length, (b[2] - a[2]) / length
        polygon = Polygon(
          [[(p[0] - a[0]) * tx + (p[2] - a[2]) * tz, p[1]] for p in rings[0]]
        )
        low, high = polygon.bounds[1], polygon.bounds[3]
        if high - low < 4:
          continue
        # The real source outward side must leave the original part, never face
        # a party wall or an adjoining source part belonging to this same site.
        mid = np.array([(a[0] + b[0]) / 2, (low + high) / 2, (a[2] + b[2]) / 2])
        own = Polygon(part["ring"], part["holes"])
        if own.contains(Point(mid[0] + n[0] * 0.2, mid[2] + n[2] * 0.2)):
          n = -n
        if any(
          p["id"] != part["id"]
          and Polygon(p["ring"], p["holes"])
          .buffer(0.05)
          .contains(Point(mid[0] + n[0] * 0.5, mid[2] + n[2] * 0.5))
          for p in item["parts"]
        ):
          continue
        walls.append(
          {
            "a": [a[0], a[2]],
            "b": [b[0], b[2]],
            "normal": [float(n[0]), float(n[2])],
            "length": length,
            "low": low,
            "high": high,
            "polygon": list(polygon.exterior.coords),
            "partId": part["id"],
          }
        )
    sites.append(
      {
        "id": item["id"],
        "name": item["name"],
        "parents": item["parents"],
        "osmId": item["osmId"],
        "wallColor": item["wallColor"],
        "roofColor": item["roofColor"],
        "triangles": triangles,
        "walls": walls,
        "navigation": nav,
      }
    )
  for site in sites:
    decorate(site)
  return {
    "schemaVersion": 1,
    "sites": sites,
    "estimates": "Photograph-guided arch/rose/cornice positions are not a facade survey. Complete original LoD2 coordinates are retained. Three Wilmersdorf upper crowns are explicitly replaced by visual profiles because their source prisms hide the domes; all other source sheets remain displayed.",
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract or not EVIDENCE.exists():
    save(EVIDENCE, extract())
  output = build(json.loads(EVIDENCE.read_text()))
  save(OUTPUT, output)
  print(
    {
      s["id"]: {
        "parts": len(s["navigation"]),
        "triangles": len(s["triangles"]),
        "walls": len(s["walls"]),
      }
      for s in output["sites"]
    }
  )
