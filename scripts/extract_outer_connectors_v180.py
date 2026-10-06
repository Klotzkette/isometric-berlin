"""Step 3: exact, narrow OSM street connectors and street-facing building rings.

The owner approved these two corridors only. Existing city and v179 source files
are inputs, never rewritten. Raw PBF/LoD2 evidence and extraction caches stay
gitignored; every fallback dimension is explicitly a display estimate.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

import networkx as nx
import pyogrio
from pyproj import Transformer
from shapely import STRtree
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import nearest_points, transform, unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, building_footprint
from isometric_berlin.data.fetch_osm import parse_hstore

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
RAW = DATA / "raw/v180"
PBF = DATA / "raw/outer-v159/berlin-260929.osm.pbf"
DEST = DATA / "outer-connectors-v180.json"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
BBOXES = {
  "west": (13.272, 52.494, 13.307, 52.515),
  "south": (13.316, 52.453, 13.358, 52.488),
}
FRONTAGE_M = 45.0


def tags(feature: dict[str, Any]) -> dict[str, Any]:
  """Combine promoted OGR tags with its hstore remainder."""
  properties = feature["properties"]
  return {
    **parse_hstore(properties.get("other_tags") or ""),
    **{k: v for k, v in properties.items() if isinstance(v, str) and k != "other_tags"},
  }


def identity(feature: dict[str, Any]) -> str:
  """Disambiguate ways and multipolygon relations without losing OSM identity."""
  p = feature["properties"]
  if p.get("osm_way_id"):
    return f"way/{p['osm_way_id']}"
  prefix = "relation" if feature["geometry"]["type"].startswith("Multi") else "way"
  return f"{prefix}/{p['osm_id']}"


def source(area: str, layer: str) -> list[dict[str, Any]]:
  """Cache a bounded source read, preserving full source features and tags."""
  path = RAW / f"{area}-{layer}.json"
  if not path.exists():
    frame = pyogrio.read_dataframe(PBF, layer=layer, bbox=BBOXES[area])
    path.write_text(frame.to_json(drop_id=True))
  return json.loads(path.read_text())["features"]


def coordinates(values: Any) -> list[list[float]]:
  """Retain all source vertices at OSM's native seven-decimal precision."""
  return [[round(x, 7), round(y, 7)] for x, y in values]


def number(value: Any) -> float | None:
  """Accept simple numeric metres/counts; reject compound or ambiguous tags."""
  match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*(?:m)?\s*", str(value))
  return float(match[1]) if match else None


def road_metadata(t: dict[str, Any]) -> dict[str, Any]:
  """Street offsets use mapped width first, otherwise conservative display widths."""
  width, lanes = number(t.get("width")), number(t.get("lanes"))
  if width is not None:
    display, evidence = width, "OSM width tag; offset edges are not surveyed curbs"
  elif lanes is not None:
    display = max(3, min(14, lanes * 3))
    evidence = "Display estimate: OSM lane count × 3 m, bounded to 3–14 m"
  elif t["highway"] in {"footway", "path", "steps", "pedestrian"}:
    display, evidence = 2.5, "Unsurveyed 2.5 m mapped-path display width"
  else:
    display = 6 if t.get("oneway") == "yes" else 8
    evidence = "Unsurveyed carriageway display width (6 m one-way / 8 m two-way)"
  return {
    "highway": t["highway"],
    "displayWidthM": display,
    "widthSource": evidence,
    "widthEstimate": width is None,
    **{
      key: t[key]
      for key in ("width", "lanes", "oneway", "layer", "bridge", "tunnel", "access")
      if key in t
    },
  }


def network(features: list[dict[str, Any]]) -> nx.Graph:
  """Only shared source vertices join ways; no proximity joins or invented chords."""
  graph = nx.Graph()
  for f in features:
    points = [tuple(p) for p in f["geometry"]["coordinates"]]
    for a, b in zip(points, points[1:]):
      length = Point(PROJECT(*a)).distance(Point(PROJECT(*b)))
      graph.add_edge(a, b, weight=length, source=identity(f))
  return graph


def select_streets(area: str, features: list[dict[str, Any]]) -> list[dict[str, Any]]:
  """Keep whole named ways through the first junction inside the detailed city."""
  selected = []
  for f in features:
    t, g = tags(f), shape(f["geometry"])
    if not t.get("highway"):
      continue
    name = t.get("name")
    if area == "west":
      keep = (name == "Neue Kantstraße" and g.centroid.x < 13.2835) or (
        name == "Messedamm" and 52.5034 < g.centroid.y < 52.5065
      )
    else:
      keep = (name in {"Rheinstraße", "Hauptstraße"} and g.centroid.y < 52.481) or (
        name == "Schloßstraße" and t.get("wikidata") == "Q1238259"
      )
    if keep:
      selected.append(f)
  assert nx.is_connected(network(selected)), f"Disconnected {area} named street course"
  return selected


def landmark_links(
  features: list[dict[str, Any]], streets: list[dict[str, Any]]
) -> list[dict[str, Any]]:
  """Add exact mapped entrance routes from Funkturm and the west ICC frontage."""
  allowed = {
    "footway",
    "path",
    "steps",
    "pedestrian",
    "service",
    "primary",
    "secondary",
    "tertiary",
  }
  candidates = [
    f
    for f in features
    if tags(f).get("highway") in allowed and tags(f).get("tunnel") != "yes"
  ]
  graph = network(candidates)
  _, paths = nx.multi_source_dijkstra(
    graph, list(network(streets).nodes), weight="weight"
  )
  by_id = {identity(f): f for f in candidates}
  selected_ids = set()
  # These exact mapped entrance ways reach the retained v179 footprints.
  for seed in ("way/92246303", "way/379986598"):
    points = [tuple(p) for p in by_id[seed]["geometry"]["coordinates"]]
    start = max(points, key=lambda p: len(paths[p]))
    path = paths[start]
    selected_ids.add(seed)
    selected_ids.update(graph[a][b]["source"] for a, b in zip(path, path[1:]))
  existing = {identity(f) for f in streets}
  return [by_id[sid] for sid in sorted(selected_ids - existing)]


def official_heights(scope: Any) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
  """Read only already-cached LoD2 tiles intersecting the narrow corridor."""
  records, sources = [], []
  for archive in sorted((DATA / "raw/lod2").glob("LoD2_*.zip")):
    x, y = map(int, archive.stem.removeprefix("LoD2_").split("_"))
    if not scope.intersects(box(x * 1000, y * 1000, (x + 1) * 1000, (y + 1) * 1000)):
      continue
    count = 0
    with zipfile.ZipFile(archive) as zipped:
      for member in zipped.namelist():
        if not member.endswith((".gml", ".xml")):
          continue
        with zipped.open(member) as stream:
          for _, element in ET.iterparse(stream, events=("end",)):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            footprint = building_footprint(element)
            if footprint is not None and footprint.intersects(scope):
              heights = []
              for pos in element.findall(".//gml:posList", NS):
                if int(pos.attrib.get("srsDimension", "3")) == 3:
                  heights.extend(float(v) for v in (pos.text or "").split()[2::3])
              if heights:
                records.append(
                  {
                    "id": element.attrib[GML_ID],
                    "geometry": footprint,
                    "height": round(max(heights) - min(heights), 3),
                    "tile": archive.stem,
                  }
                )
                count += 1
            element.clear()
    sources.append(
      {
        "tile": archive.stem,
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/{archive.name}",
        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "candidateParents": count,
        "license": "dl-de/zero-2-0",
      }
    )
  return records, sources


def height_metadata(
  t: dict[str, Any],
  geometry: Any,
  official: list[dict[str, Any]],
  *,
  podium: bool = False,
) -> dict[str, Any]:
  """Keep explicit metric heights, matched LoD2 and inferred floor counts distinct."""
  matches = [
    (r["geometry"].intersection(geometry).area / geometry.area, r)
    for r in official
    if r["geometry"].intersects(geometry)
  ]
  coverage, best = max(matches, key=lambda pair: pair[0], default=(0, None))
  osm_height, levels = number(t.get("height")), number(t.get("building:levels"))
  evidence = {
    key: t[key] for key in ("height", "building:levels", "roof:levels") if key in t
  }
  if best and coverage >= 0.85 and not podium:
    height, label, estimate = (
      best["height"],
      "Berlin LoD2 matched parent vertical envelope",
      False,
    )
    extra = {
      "officialId": best["id"],
      "officialTile": best["tile"],
      "officialFootprintCoverage": round(coverage, 4),
    }
  elif osm_height is not None:
    height, label, estimate = osm_height, "OSM explicit height tag", False
    extra = {}
  elif levels is not None:
    height = levels * 3 + (number(t.get("roof:levels")) or 0) * 2.5
    label, estimate, extra = (
      "Display estimate: OSM floors × 3 m + roof floors × 2.5 m",
      True,
      {},
    )
  else:
    height = (
      5 if t.get("building") in {"roof", "garage", "garages", "shed", "service"} else 18
    )
    label, estimate, extra = (
      "Unsurveyed sparse building envelope display height",
      True,
      {},
    )
  return {
    "height": height,
    "heightSource": label,
    "heightEstimate": estimate,
    "sourceHeightTags": evidence,
    **extra,
  }


def build() -> dict[str, Any]:
  """Derive only additive corridor records, metadata overrides and provenance."""
  RAW.mkdir(parents=True, exist_ok=True)
  previous = json.loads((DATA / "outer-thin-outlines-v179.json").read_text())
  assert hashlib.sha256(PBF.read_bytes()).hexdigest() == previous["source"]["sha256"]
  detailed = transform(
    PROJECT,
    shape(json.loads((DATA / "bounds.geojson").read_text())["features"][0]["geometry"]),
  )
  old_line_ids = {sid for f in previous["lines"] for sid in f["osmIds"]}
  old_foot_ids = {sid for f in previous["footprints"] for sid in f["osmIds"]}
  routes, source_lines, by_area = {}, {}, {}
  for area in BBOXES:
    candidates = source(area, "lines")
    streets = select_streets(area, candidates)
    routes[area] = unary_union(
      [transform(PROJECT, shape(f["geometry"])) for f in streets]
    )
    if area == "west":
      streets += landmark_links(candidates, streets)
    by_area[area] = streets
    source_lines.update({identity(f): (f, area) for f in streets})
  official, official_sources = official_heights(
    unary_union(list(routes.values())).buffer(FRONTAGE_M)
  )
  lines, overrides = [], {}
  for sid, (f, area) in sorted(source_lines.items()):
    t = tags(f)
    metadata = {"corridor": area, **road_metadata(t)}
    if sid in old_line_ids:
      overrides[sid] = metadata
    else:
      lines.append(
        {
          "name": t.get("name") or "Funkturm/ICC mapped entrance link",
          "kind": "path"
          if t["highway"] in {"footway", "path", "steps", "pedestrian"}
          else "street",
          "osmIds": [sid],
          "coordinates": coordinates(f["geometry"]["coordinates"]),
          "status": "mapped",
          **metadata,
        }
      )
  footprints, seen = [], set(old_foot_ids)
  excluded_detail, excluded_distance = 0, 0
  for area in BBOXES:
    for f in source(area, "multipolygons"):
      t, sid = tags(f), identity(f)
      if not t.get("building") or t.get("building") == "no" or sid in seen:
        continue
      geometry = shape(f["geometry"])
      projected = transform(PROJECT, geometry)
      podium = sid in {"way/34782006", "way/34782007"}
      if not podium and projected.distance(routes[area]) > FRONTAGE_M:
        excluded_distance += 1
        continue
      if projected.intersection(detailed).area > 0.001:
        excluded_detail += 1
        continue
      seen.add(sid)
      name = {
        "way/34782006": "Steglitzer Kreisel — Kreisel-Parkhaus",
        "way/34782007": "Steglitzer Kreisel — mapped low podium",
      }.get(sid)
      if not name:
        name = (
          t.get("name")
          or " ".join(filter(None, [t.get("addr:street"), t.get("addr:housenumber")]))
          or "Mapped street-facing building"
        )
      for part in (
        list(geometry.geoms) if geometry.geom_type == "MultiPolygon" else [geometry]
      ):
        assert part.is_valid, f"Invalid source polygon: {sid}"
        height = height_metadata(t, transform(PROJECT, part), official, podium=podium)
        footprints.append(
          {
            "name": name,
            "kind": "kreisel-podium" if podium else "corridor-building",
            "osmIds": [sid],
            "rings": [
              coordinates(part.exterior.coords),
              *[coordinates(r.coords) for r in part.interiors],
            ],
            "ringRoles": ["outer", *["inner" for _ in part.interiors]],
            "corridor": area,
            "frontageDistanceM": round(projected.distance(routes[area]), 3),
            "building": t["building"],
            **height,
          }
        )
  # The 45 m search is only a candidate band: discard buildings hidden behind
  # another mapped frontage. Complete wings/courts of retained parents survive.
  frontages, excluded_rear = [], 0
  for area in BBOXES:
    local = [f for f in footprints if f["corridor"] == area]
    geometries = [
      transform(PROJECT, Polygon(f["rings"][0], f["rings"][1:])) for f in local
    ]
    index = STRtree(geometries)
    for i, (f, geometry) in enumerate(zip(local, geometries)):
      ray = LineString(nearest_points(routes[area], geometry))
      blocked = any(
        j != i
        and geometries[j].area >= 50
        and local[j]["building"] not in {"roof", "kiosk"}
        and ray.intersection(geometries[j].buffer(-0.2)).length > 1
        for j in index.query(ray)
      )
      if blocked and f["kind"] != "kreisel-podium":
        excluded_rear += 1
      else:
        frontages.append(f)
  footprints = frontages
  inventory_path = (
    ROOT / "src/app/public/mesh/surrounding-berlin-v159/source-inventory.json.gz"
  )
  delivered_roads = {
    f["sourceId"]: f
    for f in json.loads(gzip.decompress(inventory_path.read_bytes()))["roadSources"]
  }
  connections = []
  for area, selected in by_area.items():
    graph = network(selected)
    assert nx.is_connected(graph), f"Disconnected {area} entrance/street graph"
    inside = [point for point in graph if detailed.contains(Point(PROJECT(*point)))]
    assert inside, f"No source node reaches detailed city: {area}"
    entry = min(inside, key=lambda p: Point(PROJECT(*p)).distance(detailed.boundary))
    connections.append(
      {
        "corridor": area,
        "connectedComponents": nx.number_connected_components(graph),
        "sharedVertexGraph": True,
        "detailedCityAttachment": list(entry),
        "sourceVerticesInsideDetailedCity": len(inside),
        "insideDetailedLengthM": round(routes[area].intersection(detailed).length, 3),
        "namedRouteLengthM": round(routes[area].length, 3),
        "attachmentWays": [
          identity(f)
          for f in selected
          if entry in [tuple(p) for p in f["geometry"]["coordinates"]]
        ],
      }
    )
    connection = connections[-1]
    connection["deliveredRoadSources"] = [
      delivered_roads["OSM-" + sid.replace("/", "-")]
      for sid in connection["attachmentWays"]
      if "OSM-" + sid.replace("/", "-") in delivered_roads
    ]
    assert connection["deliveredRoadSources"], f"No delivered road seam: {area}"
  anchors = [
    {
      "name": "ICC/Funkturm → City West",
      "lon": connections[0]["detailedCityAttachment"][0],
      "lat": connections[0]["detailedCityAttachment"][1],
      "source": "Exact mapped street vertex inside retained detailed-city bounds",
    },
    {
      "name": "Steglitzer Kreisel → Schöneberg",
      "lon": connections[1]["detailedCityAttachment"][0],
      "lat": connections[1]["detailedCityAttachment"][1],
      "source": "Exact mapped street vertex inside retained detailed-city bounds",
    },
  ]
  qa = {
    "lineCount": len(lines),
    "existingLineOverrideCount": len(overrides),
    "footprintCount": len(footprints),
    "courtyardRingCount": sum(len(f["rings"]) - 1 for f in footprints),
    "lineNames": dict(Counter(f["name"] for f in lines)),
    "footprintsByCorridor": dict(Counter(f["corridor"] for f in footprints)),
    "heightSources": dict(Counter(f["heightSource"] for f in footprints)),
    "allFootprintsValid": True,
    "detailedBuildingOverlapAreaM2": 0,
    "buildingsExcludedAtDetailedBoundary": excluded_detail,
    "buildingsExcludedBeyondFrontage": excluded_distance,
    "buildingsExcludedBehindFrontage": excluded_rear,
    "deliveredRoadInventorySha256": hashlib.sha256(
      inventory_path.read_bytes()
    ).hexdigest(),
    "sourceRingsClipped": False,
    "inventedConnectingChords": 0,
    "connections": connections,
  }
  return {
    "version": "1.0.80",
    "crs": "EPSG:4326",
    "coordinateOrder": "longitude,latitude",
    "source": {
      **previous["source"],
      "derivation": "Whole exact OSM ways and complete building rings; retained detailed-city buildings excluded; no geometric simplification or joining chords.",
      "detailedBoundsSha256": hashlib.sha256(
        (DATA / "bounds.geojson").read_bytes()
      ).hexdigest(),
    },
    "officialHeightSources": official_sources,
    "scope": {
      "frontageSelectionDistanceM": FRONTAGE_M,
      "selection": "Buildings no farther than 45 m from the named mapped carriageways; discard rear buildings where another mapped building over 50 m² blocks the nearest approach by more than 1 m (0.2 m edge tolerance). Preserve complete selected rings; separately identified Kreisel podium/parking included.",
      "limits": "Only Messedamm/Neue Kantstraße and Schloßstraße/Rheinstraße/Hauptstraße to retained city junctions; no district fill",
      "heightPolicy": "Matched cached LoD2 envelope, then explicit OSM metres, then marked floor/class display estimates; Kreisel podium keeps source OSM height.",
    },
    "lines": lines,
    "existingLineOverrides": overrides,
    "footprints": footprints,
    "anchors": anchors,
    "qa": qa,
  }


def main() -> None:
  """Write the small derived supplement and report its bounded verification."""
  payload = build()
  DEST.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(json.dumps(payload["qa"], ensure_ascii=False, indent=2))
  print(f"Derived source bytes: {DEST.stat().st_size:,}")


if __name__ == "__main__":
  main()
