"""Step 10: exact, bounded Gendarmenmarkt perimeter source and facade axes."""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import geopandas as gpd
from shapely import STRtree, make_valid
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import (
  GML_ID,
  NS,
  building_footprint,
  leaf_building_parts,
  load_bounds_polygon,
  project_to_berlin,
)
from scripts.build_bebelplatz_building_source import part_profile

ORIGIN = [389500, 5820000, 30]
STREETS = {
  "Markgrafenstraße",
  "Charlottenstraße",
  "Französische Straße",
  "Taubenstraße",
  "Jägerstraße",
  "Anton-Wilhelm-Amo-Straße",
  "Friedrichstraße",
}
# Source identities, not approximate building rectangles. A parent is retained
# whole even where only its square-facing facade is used by the detail overlay.
TARGETS = [
  (
    "dentons",
    "Dentons",
    "Markgrafenstraße 33",
    ["01GO"],
    ["node/9436604541"],
    {"Markgrafenstraße", "Anton-Wilhelm-Amo-Straße"},
  ),
  (
    "einstein",
    "Einstein Kaffee am Gendarmenmarkt",
    "Markgrafenstraße 34",
    ["0Dkf"],
    ["node/440923198"],
    {"Markgrafenstraße", "Anton-Wilhelm-Amo-Straße"},
  ),
  (
    "hilton",
    "Hilton Berlin",
    "Anton-Wilhelm-Amo-Straße 30 (formerly Mohrenstraße 30)",
    ["1ujw"],
    ["node/86001840"],
    {"Anton-Wilhelm-Amo-Straße", "Charlottenstraße", "Markgrafenstraße"},
  ),
  (
    "academy",
    "Berlin-Brandenburgische Akademie der Wissenschaften",
    "Jägerstraße 22/23; Gendarmenmarkt frontage Markgrafenstraße 38",
    ["01jU", "01lT", "06rf"],
    ["node/549366121", "way/315255203"],
    {"Markgrafenstraße", "Jägerstraße", "Taubenstraße"},
  ),
  (
    "quartier206",
    "Quartier 206",
    "Friedrichstraße 71; Jägerstraße / Taubenstraße",
    [
      "0ER0",
      "DEBE00YY11n000Vs",
      "DEBE00YY11n000Vu",
      "DEBE00YY11n000Vv",
      "DEBE00YY11n000Vw",
      "DEBE00YY11n000Vt",
      "DEBE00YY11n000Vn",
      "DEBE00YY11n000Vq",
      "DEBE00YY11n000Vr",
      "DEBE00YY11n000Vp",
      "DEBE00YY11n000Vo",
      "1zD1",
    ],
    ["node/9971870799", "node/6433304547"],
    {"Friedrichstraße", "Jägerstraße", "Taubenstraße"},
  ),
  (
    "newton",
    "Newton Bar / Quartier 205",
    "Charlottenstraße 57",
    ["01H9"],
    ["node/86005430", "node/2505353952"],
    {"Charlottenstraße", "Taubenstraße", "Anton-Wilhelm-Amo-Straße"},
  ),
  (
    "borchardt",
    "Borchardt",
    "Französische Straße 47",
    ["05Ja"],
    ["node/86001798"],
    {"Französische Straße"},
  ),
  (
    "lutterWegner",
    "Lutter & Wegner",
    "Charlottenstraße 56",
    ["06Rw"],
    ["node/86001825"],
    {"Charlottenstraße", "Taubenstraße"},
  ),
  (
    "hannsEisler",
    "Hochschule für Musik Hanns Eisler / Augustiner",
    "Charlottenstraße 55 / 56",
    ["078B"],
    ["node/542892914", "node/901804851"],
    {"Charlottenstraße", "Jägerstraße", "Taubenstraße"},
  ),
  (
    "charlottenNorthwest",
    "Retained Sofitel / Heritage building",
    "Charlottenstraße, northwest Gendarmenmarkt frontage",
    ["06fK"],
    ["node/3780963364", "node/86001813"],
    {"Charlottenstraße", "Jägerstraße", "Französische Straße"},
  ),
  (
    "erdinger",
    "Erdinger am Gendarmenmarkt / northeastern frontage",
    "Markgrafenstraße, north of Jägerstraße",
    ["0Bz7"],
    ["node/619526701", "node/4188062813"],
    {"Markgrafenstraße", "Jägerstraße", "Französische Straße"},
  ),
  (
    "franzoesischeNorthwest",
    "Französische Straße northwestern perimeter",
    "Französische Straße / Charlottenstraße",
    ["0Erd", "0BJM"],
    ["node/1812414059"],
    {"Französische Straße", "Charlottenstraße"},
  ),
  (
    "franzoesischeNorth",
    "Französische Straße central northern perimeter",
    "Französische Straße",
    ["08Cv"],
    [],
    {"Französische Straße"},
  ),
  (
    "franzoesischeNortheast",
    "Französische Straße northeastern perimeter",
    "Französische Straße / Markgrafenstraße",
    ["0FCi"],
    [],
    {"Französische Straße", "Markgrafenstraße"},
  ),
  (
    "markgrafenSoutheastNorth",
    "Markgrafenstraße / Taubenstraße corner",
    "Markgrafenstraße, south of Taubenstraße",
    ["05e8"],
    [],
    {"Markgrafenstraße", "Taubenstraße"},
  ),
  (
    "taipei",
    "Taipeh Vertretung building",
    "Markgrafenstraße, between Taubenstraße and Einstein Kaffee",
    ["00xl"],
    ["node/515114884"],
    {"Markgrafenstraße"},
  ),
]


def world_geometry(geometry: Any) -> Any:
  """Convert the source's metric plan without rounding or rotating it."""
  from shapely.ops import transform

  return transform(lambda x, y, z=None: (x - ORIGIN[0], ORIGIN[1] - y), geometry)


def parent_id(value: str) -> str:
  """Resolve the compact local inventory without changing official IDs."""
  return value if value.startswith("DEBE") else "DEBE01YYK000" + value


def read_parents(root: Path) -> dict[str, Any]:
  """Read the two retained official tiles once and preserve complete parents."""
  wanted = {parent_id(short) for t in TARGETS for short in t[3]}
  parents = {}
  bounds = project_to_berlin(
    load_bounds_polygon(root / "geo_data/regierungsviertel/bounds.geojson")
  )
  for tile in ("390_5819", "391_5819"):
    path = root / f"geo_data/regierungsviertel/raw/lod2/LoD2_{tile}.zip"
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    with zipfile.ZipFile(path) as archive:
      for member in archive.namelist():
        if not member.lower().endswith((".xml", ".gml", ".citygml")):
          continue
        with archive.open(member) as stream:
          for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            identifier = element.get(GML_ID)
            if identifier in wanted:
              footprint = building_footprint(element)
              if footprint is None or not bounds.covers(footprint):
                raise ValueError(f"{identifier} leaves the approved bounds")
              parents[identifier] = {
                "parentId": identifier,
                "sourceUrl": f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{tile}.zip",
                "sourceSha256": digest,
                "sourceCreated": element.findtext("core:creationDate", namespaces=NS),
                "geometry": world_geometry(footprint),
                "parts": [
                  part_profile(part)
                  for part in leaf_building_parts(element) or [element]
                ],
              }
            element.clear()
  if set(parents) != wanted:
    raise ValueError(f"Missing official parents: {wanted - set(parents)}")
  return parents


def facade_axes(
  parts: list[dict[str, Any]],
  translation: float,
  streets: list[dict[str, Any]],
  allowed: set[str],
  obstacles: list[dict[str, Any]],
  obstacle_index: STRtree,
  minimum_width: float = 1.8,
) -> list[dict[str, Any]]:
  """Use original vertical wall sheets, their eaves, and visible street normals."""
  fronts = []
  seen = set()
  for part in parts:
    footprint = Polygon(part["ring"], part["holes"])
    # These two measured Einstein corner arcs comprise 0.357–0.399 m facets.
    # Keep their original individual planes instead of inventing a chord wall.
    part_minimum_width = (
      0.3 if part["id"] in {"DEBE3DCzUyqPfyhd", "DEBE3DM994kLmtl4"} else minimum_width
    )
    for surface_index, surface in enumerate(part["surfaces"]):
      if surface["kind"] != "WallSurface":
        continue
      ring = surface["rings"][0]
      pairs = [(a, b) for a in ring for b in ring]
      a, b = max(
        pairs,
        key=lambda pair: (
          (pair[0][0] - pair[1][0]) ** 2 + (pair[0][2] - pair[1][2]) ** 2
        ),
      )
      start, end = [a[0], a[2]], [b[0], b[2]]
      length = math.dist(start, end)
      if length < part_minimum_width:
        continue
      line = LineString([start, end])
      # A facade must lie on the parent plan, not be a roof gable inside it.
      if max(footprint.exterior.distance(Point(p)) for p in (start, end)) > 0.025:
        continue
      heights_a = [
        p[1] for p in ring if math.hypot(p[0] - start[0], p[2] - start[1]) < 0.0021
      ]
      heights_b = [
        p[1] for p in ring if math.hypot(p[0] - end[0], p[2] - end[1]) < 0.0021
      ]
      original_base = max(min(p[1] for p in ring) + translation, 5.2)
      top = min(max(heights_a), max(heights_b)) + translation
      if top - original_base < 4:
        continue
      dx, dz = end[0] - start[0], end[1] - start[1]
      mid = line.interpolate(0.5, normalized=True)
      left = (-dz / length, dx / length)
      side = (
        -1
        if footprint.contains(Point(mid.x + left[0] * 0.1, mid.y + left[1] * 0.1))
        else 1
      )
      normal = (left[0] * side, left[1] * side)
      candidates = []
      for street in streets:
        if street["name"] not in allowed:
          continue
        axis = street["geometry"]
        distance = axis.distance(mid)
        if distance > 22:
          continue
        nearest = axis.interpolate(axis.project(mid))
        vx, vz = nearest.x - mid.x, nearest.y - mid.y
        if (vx * normal[0] + vz * normal[1]) / max(distance, 0.001) < 0.72:
          continue
        # A low entrance or risalit obscures only the wall below its actual
        # source top. The upper facade must survive above that obstruction.
        # Recessed concave entries can be clear at their midpoint but hidden
        # behind the same source part at one end. Test both ends of the usable
        # face as well, including same-part returns in the obstruction evidence.
        found_occluders = {}
        for fraction in (0.15, 0.5, 0.85):
          probe = line.interpolate(fraction, normalized=True)
          sample = Point(probe.x + normal[0] * 0.35, probe.y + normal[1] * 0.35)
          ray = LineString([sample, axis.interpolate(axis.project(probe))])
          for index in obstacle_index.query(ray):
            obstacle = obstacles[index]
            if obstacle["geometry"].intersection(ray).length > 0.025:
              found_occluders[obstacle["sourceId"]] = {
                "sourceId": obstacle["sourceId"],
                "topY": obstacle["topY"],
              }
        occluders = list(found_occluders.values())
        occlusion_y = max((p["topY"] for p in occluders), default=original_base)
        base = max(original_base, occlusion_y)
        if top - base < 4:
          continue
        candidates.append((distance, street, base, occlusion_y, occluders))
      if not candidates:
        continue
      distance, street, base, occlusion_y, occluders = min(
        candidates, key=lambda c: c[0]
      )
      identity = tuple(sorted((tuple(start), tuple(end)))) + (
        round(base, 3),
        round(top, 3),
      )
      if identity in seen:
        continue
      seen.add(identity)
      fronts.append(
        {
          "prismId": part["id"][-8:],
          "partId": part["id"],
          "surfaceIndex": surface_index,
          "street": street["name"],
          "streetOsmKey": street["osmKey"],
          "startXZ": start,
          "endXZ": end,
          "outwardSide": side,
          "originalWallBaseY": round(original_base, 3),
          "maxSourceOcclusionY": round(occlusion_y, 3),
          "occlusionSources": sorted(occluders, key=lambda p: p["sourceId"]),
          "wallBaseY": round(base, 3),
          "wallTopY": round(top, 3),
          "lengthM": round(length, 3),
          "streetDistanceM": round(distance, 3),
        }
      )
  return fronts


def build_source(root: Path) -> dict[str, Any]:
  """Build a source-separated runtime supplement from retained files only."""
  parents = read_parents(root)
  old_path = root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  old = json.loads(old_path.read_text())["buildings"]
  context = gpd.read_file(
    root / "geo_data/regierungsviertel/osm_context_buildings.gpkg"
  )
  roads = gpd.read_file(root / "geo_data/regierungsviertel/osm.gpkg", layer="roads")
  pois = gpd.read_file(root / "geo_data/regierungsviertel/osm.gpkg", layer="pois")
  crop = box(390660, 5819120, 391130, 5819610)
  roads = roads[
    roads.geometry.intersects(crop)
    & roads["name"].isin(STREETS)
    & roads["highway"].isin(["residential", "tertiary", "secondary"])
  ]
  streets = [
    {
      "osmKey": f"{r.element}/{r.id}",
      "name": r["name"],
      "geometry": world_geometry(r.geometry),
    }
    for _, r in roads.iterrows()
    if r.geometry.geom_type == "LineString"
  ]
  all_parts = [part for parent in parents.values() for part in parent["parts"]]
  # Include nearby original LoD2/OSM footprints to reject concealed party walls.
  original_near = [
    {
      "sourceId": "prism:" + p["id"],
      "topY": (p["y0_dm"] + p["h_dm"]) / 10,
      "geometry": make_valid(
        Polygon(
          [[x / 10, z / 10] for x, z in p["ring"]],
          [[[x / 10, z / 10] for x, z in h] for h in p.get("holes", [])],
        )
      ),
    }
    for p in old
    if any(1190 < x / 10 < 1610 and 380 < z / 10 < 870 for x, z in p["ring"])
  ]
  official_union = unary_union([Polygon(p["ring"], p["holes"]) for p in all_parts])
  obstacles = [
    p
    for p in original_near
    if p["geometry"].intersection(official_union).area < p["geometry"].area * 0.7
  ]
  for target in TARGETS:
    target_parts = [
      p for suffix in target[3] for p in parents[parent_id(suffix)]["parts"]
    ]
    delta = round(5.2 - min(p["ground_y_m"] for p in target_parts), 3)
    obstacles.extend(
      {
        "sourceId": p["id"],
        "topY": round(p["top_y_m"] + delta, 3),
        "geometry": Polygon(p["ring"], p["holes"]),
      }
      for p in target_parts
    )
  obstacle_index = STRtree([p["geometry"] for p in obstacles])
  buildings = []
  owned_prisms: set[str] = set()
  for key, name, address, suffixes, osm_keys, allowed in TARGETS:
    selected = [parents[parent_id(suffix)] for suffix in suffixes]
    parts = [part for parent in selected for part in parent["parts"]]
    geometry = unary_union([p["geometry"] for p in selected])
    translation = round(5.2 - min(p["ground_y_m"] for p in parts), 3)
    matching_osm = []
    for _, row in context[context.geometry.intersects(crop)].iterrows():
      poly = world_geometry(row.geometry)
      if poly.intersection(geometry).area / poly.area > 0.9:
        matching_osm.append(str(row.building_id))
    ids = {p["id"][-8:] for p in parts} | {i[-8:] for i in matching_osm}
    previous = [p for p in old if p["id"] in ids]
    duplicates = owned_prisms.intersection(p["id"] for p in previous)
    if duplicates:
      raise ValueError(f"Duplicate replacement ownership: {duplicates}")
    owned_prisms.update(p["id"] for p in previous)
    osm_keys = list(osm_keys) + [
      i.replace("OSM-", "").replace("-", "/") for i in matching_osm
    ]
    anchors = []
    for osm_key in osm_keys:
      kind, identifier = osm_key.split("/")
      hits = pois[(pois.id == identifier) & (pois.element == kind)]
      if len(hits) and hits.iloc[0].geometry.geom_type == "Point":
        point = world_geometry(hits.iloc[0].geometry)
        anchors.append(
          {"osmKey": osm_key, "positionXZ": [round(point.x, 3), round(point.y, 3)]}
        )
    fronts = facade_axes(
      parts,
      translation,
      streets,
      allowed,
      obstacles,
      obstacle_index,
      minimum_width=0.65 if key == "einstein" else 1.8,
    )
    for front in fronts:
      front["parentId"] = next(
        p["parentId"]
        for p in selected
        if any(part["id"] == front["partId"] for part in p["parts"])
      )
    if not fronts:
      raise ValueError(f"No exposed source street fronts for {key}")
    replacement_bounds = unary_union(
      [geometry]
      + [
        make_valid(Polygon([[x / 10, z / 10] for x, z in p["ring"]])) for p in previous
      ]
    ).bounds
    buildings.append(
      {
        "key": key,
        "name": name,
        "address": address,
        "osmKeys": osm_keys,
        "parentIds": [p["parentId"] for p in selected],
        "prismIds": [p["id"] for p in previous],
        "center": [round(geometry.centroid.x, 3), round(geometry.centroid.y, 3)],
        "osmAnchors": anchors,
        "bbox": [round(value, 3) for value in replacement_bounds],
        "sourceBbox": [round(value, 3) for value in geometry.bounds],
        "displayYTranslationM": translation,
        "sources": [
          {k: v for k, v in p.items() if k not in {"geometry", "parts"}}
          for p in selected
        ],
        "previousDisplayPrisms": previous,
        "officialParts": parts,
        "parts": [
          {
            "prismId": p["id"][-8:],
            "sourceId": p["id"],
            "parentId": next(q["parentId"] for q in selected if p in q["parts"]),
            "ring": p["ring"],
            "holes": p["holes"],
            "wallBaseY": p["ground_y_m"] + translation,
            "sourceHeightM": p["height_m"],
            "sourceTopY": p["top_y_m"],
            "displayTopY": p["top_y_m"] + translation,
            "bbox": list(Polygon(p["ring"], p["holes"]).bounds),
          }
          for p in parts
        ],
        "streetFronts": fronts,
      }
    )
  return {
    "schemaVersion": 1,
    "originEpsg25833": ORIGIN,
    "sourceAttribution": "© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)",
    "licenses": {"geometry": "dl-de/zero-2-0", "semanticsAndStreetAxes": "ODbL-1.0"},
    "previousPrismSha256": hashlib.sha256(old_path.read_bytes()).hexdigest(),
    "buildings": buildings,
    "streetAxes": [
      {
        "osmKey": p["osmKey"],
        "name": p["name"],
        "pointsXZ": [[round(x, 3), round(z, 3)] for x, z in p["geometry"].coords],
      }
      for p in streets
    ],
    "conflictPolicy": "All original source wall/roof sheets, source heights, courtyards, and old delivered prisms remain retained. Complete official parents replace only listed old runtime prisms; canonical payloads are unchanged. A rigid per-building vertical translation aligns the lowest source ground with retained scene ground y=5.2 m. Street-front endpoints and conservative eaves come from original wall polygons, not inferred boxes; outwardSide=+1 is the left normal (-dz,+dx). Source parts with no exterior street face retain their complete geometry and open courts. Facade subdivisions and signs are separate unmeasured display details. The BBAW group retains the three published campus wings; Quartier 206 is west of the separate Hanns Eisler street block, while Newton belongs to Quartier 205. Names of unverified peer tenants remain source-neutral.",
  }


def main() -> int:
  """Regenerate the bounded source JSON; no network, manifest or scene writes."""
  root = Path(__file__).resolve().parents[1]
  result = build_source(root)
  target = root / "src/app/src/gendarmenmarktPerimeterSource.json"
  target.write_text(
    json.dumps(result, separators=(",", ":"), ensure_ascii=False) + "\n"
  )
  ids = sorted({i for b in result["buildings"] for i in b["prismIds"]})
  (root / "src/app/src/gendarmenmarktPerimeterIds.ts").write_text(
    "// Generated by scripts/build_gendarmenmarkt_perimeter_source.py.\n"
    "// Keep worker imports independent of the complete source wall/roof sheets.\n"
    "export const GENDARMENMARKT_PERIMETER_REPLACED_PRISM_IDS = new Set<string>("
    + json.dumps(ids, separators=(",", ":"))
    + ");\n"
  )
  print(f"Wrote {target.name}: {target.stat().st_size:,} bytes")
  for building in result["buildings"]:
    print(
      building["key"],
      len(building["officialParts"]),
      "parts",
      len(building["streetFronts"]),
      "fronts",
      building["prismIds"],
    )
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
