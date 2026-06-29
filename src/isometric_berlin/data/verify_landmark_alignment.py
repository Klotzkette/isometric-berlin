"""Verify landmark placement against local OSM and LoD2 evidence."""

from __future__ import annotations

import argparse
import re
import unicodedata
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import geopandas as gpd
import pandas as pd
from shapely.geometry.base import BaseGeometry

from isometric_berlin.data.common import BERLIN_PROJECTED, sha256_file, write_json

OSM_LAYERS = ("pois", "roads", "parks", "water", "rail")

LANDMARK_EXPECTATIONS: dict[str, dict[str, Any]] = {
  "Brandenburger Tor": {
    "aliases": ["brandenburger tor"],
    "max_distance_m": 20.0,
  },
  "Reichstagsgebäude": {
    "aliases": ["reichstagsgebaude", "reichstagskuppel"],
    "max_distance_m": 25.0,
  },
  "Bundeskanzleramt": {
    "aliases": ["bundeskanzleramt"],
    "max_distance_m": 25.0,
  },
  "Paul-Löbe-Haus": {
    "aliases": ["paul lobe haus"],
    "max_distance_m": 35.0,
  },
  "Marie-Elisabeth-Lüders-Haus": {
    "aliases": ["marie elisabeth luders haus"],
    "max_distance_m": 35.0,
  },
  "Berlin Hauptbahnhof": {
    "aliases": ["berlin hauptbahnhof", "hauptbahnhof"],
    "max_distance_m": 35.0,
  },
  "Haus der Kulturen der Welt (Schwangere Auster)": {
    "aliases": ["haus der kulturen der welt"],
    "max_distance_m": 35.0,
  },
  "Tiergartentunnel Südeingang (Sony Center / Potsdamer Platz)": {
    "aliases": [
      "tunnel tiergarten spreebogen",
      "potsdamer platz",
      "das center am potsdamer platz",
    ],
    "max_distance_m": 110.0,
  },
  "Max-Liebermann-Haus": {
    "aliases": ["max liebermann haus"],
    "max_distance_m": 25.0,
  },
  "Botschaft der Vereinigten Staaten von Amerika": {
    "aliases": [
      "botschaft der vereinigten staaten",
      "embassy of the united states",
      "united states embassy",
      "amerikanische botschaft",
    ],
    "max_distance_m": 80.0,
    "allow_lod2_fallback": True,
  },
  "Zollpackhof": {
    "aliases": ["zollpackhof"],
    "max_distance_m": 25.0,
  },
  "Gustav-Heinemann-Brücke": {
    "aliases": ["gustav heinemann brucke"],
    "max_distance_m": 25.0,
  },
  "Spreebogen": {
    "aliases": ["spreebogenpark", "tunnel tiergarten spreebogen", "spreebogen"],
    "max_distance_m": 90.0,
  },
}

RELATIVE_EXPECTATIONS: tuple[dict[str, str], ...] = (
  {
    "from": "Berlin Hauptbahnhof",
    "to": "Bundeskanzleramt",
    "east_west": "west",
    "north_south": "south",
    "note": "Kanzleramt lies west/south of Hauptbahnhof on the Spreebogen axis.",
  },
  {
    "from": "Berlin Hauptbahnhof",
    "to": "Marie-Elisabeth-Lüders-Haus",
    "east_west": "east",
    "north_south": "south",
    "note": "Marie-Elisabeth-Lüders-Haus lies east/south of Hauptbahnhof.",
  },
  {
    "from": "Berlin Hauptbahnhof",
    "to": "Reichstagsgebäude",
    "east_west": "east",
    "north_south": "south",
    "note": "Reichstag sits south/east of Hauptbahnhof, beyond the Spreebogen.",
  },
  {
    "from": "Bundeskanzleramt",
    "to": "Marie-Elisabeth-Lüders-Haus",
    "east_west": "east",
    "north_south": "north",
    "note": "MELH is on the east/right side of the government-band sequence.",
  },
  {
    "from": "Bundeskanzleramt",
    "to": "Reichstagsgebäude",
    "east_west": "east",
    "north_south": "south",
    "note": "Reichstag lies southeast of the Kanzleramt.",
  },
  {
    "from": "Reichstagsgebäude",
    "to": "Brandenburger Tor",
    "east_west": "east",
    "north_south": "south",
    "note": "Brandenburger Tor lies southeast of the Reichstag.",
  },
  {
    "from": "Brandenburger Tor",
    "to": "Botschaft der Vereinigten Staaten von Amerika",
    "east_west": "east",
    "north_south": "south",
    "note": "US Embassy lies just southeast/south of Brandenburger Tor.",
  },
  {
    "from": "Haus der Kulturen der Welt (Schwangere Auster)",
    "to": "Reichstagsgebäude",
    "east_west": "east",
    "north_south": "south",
    "note": "Reichstag lies east/south of HKW across the Tiergarten edge.",
  },
)


def normalize_name(value: object) -> str:
  """Fold names to a stable ASCII-ish form for OSM comparison."""
  text = str(value or "").lower().replace("ß", "ss")
  text = "".join(
    char
    for char in unicodedata.normalize("NFKD", text)
    if not unicodedata.combining(char)
  )
  return re.sub(r"[^a-z0-9]+", " ", text).strip()


def expected_aliases(name: str) -> list[str]:
  expectation = LANDMARK_EXPECTATIONS.get(name)
  if expectation is None:
    return [normalize_name(name)]
  return list(expectation["aliases"])


def load_landmarks(path: Path) -> gpd.GeoDataFrame:
  landmarks = gpd.read_file(path)
  if landmarks.crs is None:
    landmarks = landmarks.set_crs("EPSG:4326")
  return landmarks.to_crs(BERLIN_PROJECTED)


def load_named_osm(path: Path) -> gpd.GeoDataFrame:
  layers: list[gpd.GeoDataFrame] = []
  for layer in OSM_LAYERS:
    frame = gpd.read_file(path, layer=layer)
    frame["source_layer"] = layer
    layers.append(frame)
  named = gpd.GeoDataFrame(pd.concat(layers, ignore_index=True), crs=layers[0].crs)
  if "name" not in named.columns:
    return gpd.GeoDataFrame(geometry=[], crs=named.crs)
  named = named[named["name"].notna()].copy()
  named["normalized_name"] = named["name"].map(normalize_name)
  return named


def best_osm_match(
  *,
  point: BaseGeometry,
  named_osm: gpd.GeoDataFrame,
  aliases: list[str],
) -> dict[str, Any] | None:
  if named_osm.empty:
    return None
  matches = named_osm[
    named_osm["normalized_name"].map(
      lambda candidate: any(alias in candidate for alias in aliases)
    )
  ].copy()
  if matches.empty:
    return None
  matches["distance_m"] = matches.geometry.distance(point)
  row = matches.sort_values("distance_m").iloc[0]
  return osm_record(row)


def nearest_named_osm(
  *, point: BaseGeometry, named_osm: gpd.GeoDataFrame
) -> dict[str, Any] | None:
  if named_osm.empty:
    return None
  candidates = named_osm.copy()
  candidates["distance_m"] = candidates.geometry.distance(point)
  return osm_record(candidates.sort_values("distance_m").iloc[0])


def osm_record(row: pd.Series) -> dict[str, Any]:
  fields = [
    "source_layer",
    "name",
    "amenity",
    "tourism",
    "historic",
    "office",
    "diplomatic",
    "government",
    "highway",
    "railway",
    "bridge",
  ]
  record = {
    field: None if field not in row or pd.isna(row[field]) else str(row[field])
    for field in fields
  }
  record["distance_m"] = round(float(row["distance_m"]), 2)
  record["geometry_type"] = row.geometry.geom_type
  return record


def lod2_evidence(
  *, point: BaseGeometry, buildings: gpd.GeoDataFrame
) -> dict[str, Any]:
  if buildings.empty:
    return {
      "contains_landmark": False,
      "containing_building_id": None,
      "nearest_building_id": None,
      "nearest_distance_m": None,
    }
  containing = buildings[buildings.geometry.covers(point)]
  candidates = buildings.copy()
  candidates["distance_m"] = candidates.geometry.distance(point)
  nearest = candidates.sort_values("distance_m").iloc[0]
  return {
    "contains_landmark": bool(len(containing)),
    "containing_building_id": (
      str(containing.iloc[0].get("building_id")) if len(containing) else None
    ),
    "nearest_building_id": str(nearest.get("building_id")),
    "nearest_distance_m": round(float(nearest["distance_m"]), 2),
  }


def axis_direction(
  delta: float, *, positive_label: str, negative_label: str, tolerance_m: float = 1.0
) -> str:
  if delta > tolerance_m:
    return positive_label
  if delta < -tolerance_m:
    return negative_label
  return "aligned"


def relative_relationships(landmarks: gpd.GeoDataFrame) -> list[dict[str, Any]]:
  indexed = landmarks.set_index("name")
  relationships: list[dict[str, Any]] = []
  for expectation in RELATIVE_EXPECTATIONS:
    start = indexed.loc[expectation["from"]].geometry
    end = indexed.loc[expectation["to"]].geometry
    dx = float(end.x - start.x)
    dy = float(end.y - start.y)
    east_west = axis_direction(dx, positive_label="east", negative_label="west")
    north_south = axis_direction(dy, positive_label="north", negative_label="south")
    relationships.append(
      {
        "from": expectation["from"],
        "to": expectation["to"],
        "status": (
          "ok"
          if east_west == expectation["east_west"]
          and north_south == expectation["north_south"]
          else "review"
        ),
        "expected_east_west": expectation["east_west"],
        "actual_east_west": east_west,
        "delta_east_m": round(dx, 2),
        "expected_north_south": expectation["north_south"],
        "actual_north_south": north_south,
        "delta_north_m": round(dy, 2),
        "distance_m": round(float(start.distance(end)), 2),
        "note": expectation["note"],
      }
    )
  return relationships


def landmark_status(
  *,
  name: str,
  best_match: dict[str, Any] | None,
  lod2: dict[str, Any],
) -> str:
  expectation = LANDMARK_EXPECTATIONS.get(name, {})
  max_distance_m = float(expectation.get("max_distance_m", 80.0))
  if best_match and float(best_match["distance_m"]) <= max_distance_m:
    return "ok"
  if expectation.get("allow_lod2_fallback") and lod2["contains_landmark"]:
    return "ok"
  return "review"


def build_alignment_report(
  *,
  landmarks_path: Path,
  osm_path: Path,
  buildings_path: Path,
) -> dict[str, Any]:
  landmarks = load_landmarks(landmarks_path)
  named_osm = load_named_osm(osm_path)
  buildings = gpd.read_file(buildings_path, layer="buildings")
  if buildings.crs is None:
    buildings = buildings.set_crs(BERLIN_PROJECTED)
  buildings = buildings.to_crs(BERLIN_PROJECTED)

  checks: list[dict[str, Any]] = []
  for _, landmark in landmarks.iterrows():
    name = str(landmark.get("name", ""))
    aliases = expected_aliases(name)
    osm_match = best_osm_match(
      point=landmark.geometry,
      named_osm=named_osm,
      aliases=aliases,
    )
    lod2 = lod2_evidence(point=landmark.geometry, buildings=buildings)
    checks.append(
      {
        "name": name,
        "role": str(landmark.get("role", "context")),
        "status": landmark_status(name=name, best_match=osm_match, lod2=lod2),
        "expected_osm_aliases": aliases,
        "best_osm_match": osm_match,
        "nearest_named_osm": nearest_named_osm(
          point=landmark.geometry,
          named_osm=named_osm,
        ),
        "lod2": lod2,
      }
    )

  landmark_review_count = sum(1 for check in checks if check["status"] != "ok")
  relationships = relative_relationships(landmarks)
  relative_review_count = sum(
    1 for relationship in relationships if relationship["status"] != "ok"
  )
  review_count = landmark_review_count + relative_review_count
  return {
    "generated_at": datetime.now(tz=UTC).isoformat(),
    "method": (
      "Landmark points checked against named OSM features and nearest Berlin "
      "LoD2 building geometry in EPSG:25833."
    ),
    "sources": {
      "landmarks": {
        "path": str(landmarks_path),
        "sha256": sha256_file(landmarks_path),
      },
      "osm": {"path": str(osm_path), "sha256": sha256_file(osm_path)},
      "lod2": {"path": str(buildings_path), "sha256": sha256_file(buildings_path)},
    },
    "summary": {
      "status": "ok" if review_count == 0 else "review",
      "landmarks_checked": len(checks),
      "relative_relationships_checked": len(relationships),
      "landmark_review_count": landmark_review_count,
      "relative_review_count": relative_review_count,
      "review_count": review_count,
    },
    "checks": checks,
    "relative_relationships": relationships,
  }


def write_markdown_report(report: dict[str, Any], path: Path) -> None:
  lines = [
    "# Landmark Alignment QA",
    "",
    "This report checks the committed landmark points against the local "
    "OpenStreetMap city-map layer and Berlin LoD2 building geometry.",
    "",
    f"- Generated: `{report['generated_at']}`",
    f"- Status: `{report['summary']['status']}`",
    f"- Landmarks checked: `{report['summary']['landmarks_checked']}`",
    "- Relative relationships checked: "
    f"`{report['summary']['relative_relationships_checked']}`",
    f"- Landmark review count: `{report['summary']['landmark_review_count']}`",
    f"- Relative review count: `{report['summary']['relative_review_count']}`",
    f"- Review count: `{report['summary']['review_count']}`",
    "",
    "| Landmark | Status | Best OSM evidence | OSM distance | LoD2 evidence |",
    "|---|---:|---|---:|---|",
  ]
  for check in report["checks"]:
    best = check["best_osm_match"]
    if best:
      osm_evidence = f"{best['name']} ({best['source_layer']})"
      osm_distance = f"{best['distance_m']:.2f} m"
    else:
      nearest = check["nearest_named_osm"]
      osm_evidence = f"no expected-name hit; nearest: {nearest['name']}"
      osm_distance = f"{nearest['distance_m']:.2f} m"
    lod2 = check["lod2"]
    lod2_text = (
      f"inside {lod2['containing_building_id']}"
      if lod2["contains_landmark"]
      else f"nearest {lod2['nearest_building_id']} at {lod2['nearest_distance_m']} m"
    )
    lines.append(
      "| "
      + " | ".join(
        [
          str(check["name"]),
          f"`{check['status']}`",
          osm_evidence,
          osm_distance,
          lod2_text,
        ]
      )
      + " |"
    )
  lines.extend(
    [
      "",
      "## Relative Placement",
      "",
      "These checks compare landmark-to-landmark relationships in EPSG:25833 "
      "metres. They are meant to catch left/right and north/south swaps that "
      "can be hard to see in an isometric view.",
      "",
      "| From | To | Status | East/West | North/South | Delta E | Delta N |",
      "|---|---|---:|---|---|---:|---:|",
    ]
  )
  for relation in report.get("relative_relationships", []):
    lines.append(
      "| "
      + " | ".join(
        [
          str(relation["from"]),
          str(relation["to"]),
          f"`{relation['status']}`",
          f"{relation['expected_east_west']} / {relation['actual_east_west']}",
          f"{relation['expected_north_south']} / {relation['actual_north_south']}",
          f"{relation['delta_east_m']:.2f} m",
          f"{relation['delta_north_m']:.2f} m",
        ]
      )
      + " |"
    )
  lines.extend(
    [
      "",
      "Interpretation: `ok` means the landmark is close to an expected named "
      "OSM feature within its configured tolerance, or has an explicit LoD2 "
      "building fallback where OSM does not carry the required semantic tag. "
      "`review` means the point may be on the wrong object and should not be "
      "used for rendering without manual correction.",
      "",
    ]
  )
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--landmarks",
    type=Path,
    default=Path("geo_data/regierungsviertel/landmarks.geojson"),
  )
  parser.add_argument(
    "--osm",
    type=Path,
    default=Path("geo_data/regierungsviertel/osm.gpkg"),
  )
  parser.add_argument(
    "--buildings",
    type=Path,
    default=Path("geo_data/regierungsviertel/buildings.gpkg"),
  )
  parser.add_argument(
    "--out-json",
    type=Path,
    default=Path("geo_data/regierungsviertel/landmark_alignment.json"),
  )
  parser.add_argument(
    "--out-md",
    type=Path,
    default=Path("docs/landmark-alignment.md"),
  )
  args = parser.parse_args()

  report = build_alignment_report(
    landmarks_path=args.landmarks,
    osm_path=args.osm,
    buildings_path=args.buildings,
  )
  write_json(args.out_json, report)
  write_markdown_report(report, args.out_md)
  print(
    f"Wrote landmark alignment report to {args.out_json} "
    f"and {args.out_md}: {report['summary']['status']}"
  )
  return 0 if report["summary"]["status"] == "ok" else 1


if __name__ == "__main__":
  raise SystemExit(main())
