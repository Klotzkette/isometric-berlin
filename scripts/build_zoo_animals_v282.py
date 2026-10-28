#!/usr/bin/env python3
"""Small, offline, source-contained animal routes; never rebuild city packets.

Run: uv run --offline --no-sync python -B scripts/build_zoo_animals_v282.py
Check: same command with --check (no writes).
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import pandas as pd
import pyogrio
from pyproj import Transformer
from shapely import make_valid
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Polygon, box
from shapely.ops import polygonize, unary_union

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/app/src/data/zooAnimalsV282.json"
WEST = ROOT / "geo_data/regierungsviertel/raw/zoo-v165/osm-map.xml"
EAST = ROOT / "geo_data/regierungsviertel/raw/east-v187/candidate.gpkg"
HOUSES = ROOT / "src/app/src/data/zooHousesV282.json"
CHICKEN_SOURCE = "lod2/DEBE01YYK0003Uqa"
FLOORS = {"zoo": 5.32, "tierpark": 3.12}
MARGIN = 0.4

# Species are recognisable display models. Variants retain the real taxon rather
# than turning, for example, a polar bear into the same brown bear everywhere.
# Counts below are sparse illustrative figures, not live-stock declarations.
# Already-owned wolves, condors, mountain ungulates and v276 eastern animals are
# deliberately absent: the runtime transfers those existing figures separately.
# site, OSM owner, model, variant, requested figures, max horizontal body radius, m/s
PLANS = [
  ("zoo", "relation/2701739", "elephant-asian", "asian", 2, 3.2, 0.45),
  ("zoo", "way/18174847", "lion", "african", 2, 1.8, 0.48),
  ("zoo", "way/18331833", "tiger", "amur", 1, 1.8, 0.50),
  ("zoo", "way/1171574198", "tiger", "sumatran", 1, 1.8, 0.50),
  ("zoo", "way/18441763", "gorilla", "western-lowland", 2, 1.0, 0.30),
  ("zoo", "way/18442285", "chimpanzee", "chimpanzee", 2, 0.85, 0.37),
  ("zoo", "way/1371211155", "orangutan", "sumatran", 2, 1.0, 0.27),
  ("zoo", "way/48164523", "bear", "brown", 2, 1.6, 0.40),
  ("zoo", "way/48376184", "penguin", "african", 2, 0.48, 0.28),
  ("zoo", "way/396000509", "penguin", "humboldt", 2, 0.48, 0.28),
  ("zoo", "way/16870085", "seal", "california-sea-lion", 2, 1.9, 0.65),
  ("zoo", "relation/382771", "pelican", "pelican", 2, 1.3, 0.38),
  ("zoo", "way/49896123", "hippo", "common", 1, 2.5, 0.29),
  ("zoo", "way/48374319", "stork", "white", 1, 1.0, 0.28),
  ("zoo", "way/32995991", "stork", "black", 1, 1.0, 0.28),
  ("zoo", "way/618256710", "marabou", "african", 1, 1.0, 0.26),
  ("zoo", CHICKEN_SOURCE, "chicken", "domestic", 1, 0.4, 0.20),
  ("tierpark", "way/278213451", "elephant-african", "african", 2, 3.2, 0.45),
  ("tierpark", "way/1315101316", "tiger", "sumatran", 1, 1.8, 0.50),
  ("tierpark", "way/238003065", "tiger", "sumatran", 1, 1.8, 0.50),
  ("tierpark", "way/50171709", "penguin", "african", 3, 0.48, 0.28),
  ("tierpark", "relation/15095443", "pelican", "american-white", 2, 1.3, 0.38),
  ("tierpark", "way/122055246", "rabbit", "domestic", 2, 0.42, 0.24),
  ("tierpark", "way/238005277", "rabbit", "flemish-giant", 1, 0.52, 0.24),
  ("tierpark", "way/1128226764", "giraffe", "rothschild", 2, 2.0, 0.40),
  ("tierpark", "way/278213469", "zebra", "grevy", 2, 1.8, 0.46),
  ("tierpark", "way/36737081", "bear", "spectacled", 1, 1.5, 0.38),
  ("tierpark", "way/278216954", "bear", "polar", 1, 1.8, 0.42),
  ("tierpark", "way/1315101317", "bear", "sun", 1, 1.25, 0.35),
  ("tierpark", "way/36737079", "lemur", "ring-tailed", 2, 1.3, 0.32),
  ("tierpark", "way/220264684", "lemur", "black-and-white-ruffed", 2, 1.3, 0.32),
  ("tierpark", "way/278262271", "lemur", "collared", 1, 1.3, 0.32),
  ("tierpark", "way/122451065", "ibis", "ibis", 2, 1.0, 0.28),
]
WATER_MODELS = {"seal", "pelican"}
UNRESOLVED = [
  {
    "species": "walrus",
    "reason": "No verified Berlin habitat; Germany's only walruses are at Hagenbeck. Awaiting user choice about a clearly fictional addition.",
  },
  {
    "species": "manatee",
    "reason": "Tierpark keeping ended in 2019; last males moved to Beauval. Awaiting user choice about a clearly fictional addition.",
  },
  {
    "species": "alligator",
    "reason": "No current verified enclosure. Former Tierpark crocodile-house alligators moved away; current gavials are not alligators.",
  },
  {
    "species": "snake",
    "reason": "Current snakes belong in Aquarium/Regenwaldhaus; precise terrarium ownership is unavailable. Closed former snake farm is excluded.",
  },
  {
    "species": "ibis",
    "siteId": "zoo",
    "reason": "Zoo colony has node/14068130250 but no verified motion polygon. Solid-roof Tierpark Waldrapp building way/217186470 is also excluded; only the separately mapped wire ibis aviary is used.",
  },
  {
    "species": "stork",
    "siteId": "tierpark",
    "reason": "Way/36770071 name says white stork but species tag says Goliath heron; the separately operator-matched Zoo aviaries are used instead.",
  },
  {
    "species": "marabou",
    "siteId": "tierpark",
    "reason": "Savanna evidence is dated 2023, with a death in 2024; precise current habitat unresolved. The separately mapped Zoo Marabu point is used instead.",
  },
]
IDENTITY_EVIDENCE = {
  CHICKEN_SOURCE: "One generic domestic chicken in the measured rear-aviary band around Hühner- und Taubenhaus way/17957388. Berlin's monument inventory locates these aviaries and the operator's 2025 report confirms chicken keeping; exact breed-per-cage stock is not asserted.",
  "way/48374319": "Operator 2022 white-stork location at the ape-house aviary, spatially matched to this retained aviary; illustrative present-day interpretation, not a census.",
  "way/32995991": "Operator 2022 black-stork location at the Landwehrkanal marsh-bird aviary, matched to this named retained footprint; illustrative present-day interpretation, not a census.",
  "way/618256710": "Specific retained 2026 Marabu POI node/13901500128 lies inside this older generically labelled birds-of-prey polygon; specific animal identity takes precedence, without asserting the whole aviary stock.",
}


def polygons(geometry):
  if geometry.is_empty:
    return []
  if geometry.geom_type == "Polygon":
    return [geometry]
  return [p for g in getattr(geometry, "geoms", []) for p in polygons(g)]


def valid_polygon(geometry):
  """Repair only source ring validity; never replace a shape by its bbox."""
  return unary_union(polygons(make_valid(geometry)))


def width(tags):
  try:
    return max(0.8, min(float(tags.get("width", 3)) / 2, 10)) + 0.3
  except (TypeError, ValueError):
    return 1.8


def is_wire_aviary(tags):
  return (
    tags.get("building:material") == "wire_fence"
    and tags.get("roof:material") == "wire_fence"
  )


def west_features():
  document = ET.parse(WEST).getroot()
  transform = Transformer.from_crs(4326, 25833, always_xy=True)
  nodes = {}
  for node in document.findall("node"):
    x, north = transform.transform(float(node.get("lon")), float(node.get("lat")))
    nodes[node.get("id")] = (x - 389500, 5820000 - north)
  ways = {}
  features, paths = {}, []
  for way in document.findall("way"):
    refs = [n.get("ref") for n in way.findall("nd")]
    if len(refs) < 2 or any(ref not in nodes for ref in refs):
      continue
    coordinates = [nodes[ref] for ref in refs]
    tags = {t.get("k"): t.get("v") for t in way.findall("tag")}
    ways[way.get("id")] = coordinates
    if tags.get("highway"):
      paths.append(LineString(coordinates).buffer(width(tags)))
    if len(refs) > 3 and refs[0] == refs[-1]:
      features["way/" + way.get("id")] = (valid_polygon(Polygon(coordinates)), tags)
  for relation in document.findall("relation"):
    tags = {t.get("k"): t.get("v") for t in relation.findall("tag")}
    if tags.get("type") != "multipolygon":
      continue
    outer, inner = [], []
    members = [m for m in relation.findall("member") if m.get("type") == "way"]
    if any(m.get("ref") not in ways for m in members):
      continue
    for member in members:
      (inner if member.get("role") == "inner" else outer).append(
        LineString(ways[member.get("ref")])
      )
    if not outer:
      continue
    shape = unary_union(list(polygonize(unary_union(outer))))
    if inner:
      shape = shape.difference(unary_union(list(polygonize(unary_union(inner)))))
    features["relation/" + relation.get("id")] = (valid_polygon(shape), tags)
  aviary = json.loads(HOUSES.read_bytes())["aviary"]
  features[CHICKEN_SOURCE] = (
    Polygon(aviary["ring"], aviary["holes"]),
    {
      "name": "Hühnerhaus rear aviary",
      "building": "yes",
      "building:material": "wire_fence",
      "roof:material": "wire_fence",
    },
  )
  return features, unary_union(paths)


def row_tags(row):
  tags = {
    str(k): str(v)
    for k, v in row.items()
    if k not in {"geometry", "other_tags"} and pd.notna(v)
  }
  tags.update(re.findall(r'"([^"]+)"=>"([^"]*)"', str(row.get("other_tags", ""))))
  return tags


def east_features():
  # Spatially bounded read, never load or rewrite the whole-city source.
  bounds = (13.52, 52.49, 13.55, 52.51)
  features, paths = {}, []
  for layer in ("multipolygons", "lines"):
    frame = pyogrio.read_dataframe(EAST, layer=layer, bbox=bounds).to_crs(25833)
    for _, row in frame.iterrows():
      tags = row_tags(row)
      geometry = affine_transform(row.geometry, [1, 0, 0, -1, -389500, 5820000])
      if layer == "lines":
        if tags.get("highway"):
          paths.append(geometry.buffer(width(tags)))
        continue
      source_id = (
        ("way/" + tags["osm_way_id"])
        if tags.get("osm_way_id")
        else "relation/" + tags["osm_id"]
      )
      features[source_id] = (valid_polygon(geometry), tags)
  return features, unary_union(paths)


def rectangle_route(allowed, radius, large=False, compact=False):
  """Find a genuinely contained loop with a full square body sweep at turns."""
  inset = allowed.buffer(-radius - MARGIN)
  for component in sorted(polygons(inset), key=lambda p: (-p.area, p.bounds)):
    point = component.representative_point()
    xmin, zmin, xmax, zmax = component.bounds
    candidates = [(point.x, point.y)]
    for iz in range(1, 10):
      for ix in range(1, 10):
        candidates.append(
          (xmin + (xmax - xmin) * ix / 10, zmin + (zmax - zmin) * iz / 10)
        )
    sizes = ((20, 14), (16, 10), (12, 8), (9, 6)) if large else ()
    sizes += (
      (6, 4),
      (4, 3),
      (3, 2),
      (2, 1.5),
      (1.5, 1),
      (1, 0.7),
      (0.7, 0.5),
    )
    if compact:
      sizes += ((0.5, 0.3),)
    for half_x, half_z in sizes:
      for raw_x, raw_z in candidates:
        x, z = round(raw_x, 3), round(raw_z, 3)
        # Check the WHOLE inflated rectangle, not endpoints or AABB
        # overlap. This includes every edge and every cardinal turn.
        sweep = box(
          x - half_x - radius - MARGIN,
          z - half_z - radius - MARGIN,
          x + half_x + radius + MARGIN,
          z + half_z + radius + MARGIN,
        )
        if allowed.covers(sweep):
          return [
            [round(x - half_x, 3), round(z - half_z, 3)],
            [round(x + half_x, 3), round(z - half_z, 3)],
            [round(x + half_x, 3), round(z + half_z, 3)],
            [round(x - half_x, 3), round(z + half_z, 3)],
          ]
  return None


def serial_polygon(poly):
  return {
    "ringXZ": [[round(x, 3), round(z, 3)] for x, z in poly.exterior.coords],
    "holesXZ": [
      [[round(x, 3), round(z, 3)] for x, z in ring.coords] for ring in poly.interiors
    ],
  }


def additional_obstacles(source_id: str) -> Polygon:
  """Retain the actual coarse main-house prism and native corner column."""
  if source_id != CHICKEN_SOURCE:
    return Polygon()
  aviary = json.loads(HOUSES.read_bytes())["aviary"]
  cell = aviary["nativeCellM"]
  return unary_union(
    [
      Polygon(
        [[x / 10, z / 10] for x, z in p["ring"]],
        [[[x / 10, z / 10] for x, z in h] for h in p["holes"]],
      ).buffer(0.15)
      for p in aviary["retainedPrisms"]
    ]
    + [
      box(x * cell, z * cell, (x + 1) * cell, (z + 1) * cell)
      for x, z, *_ in aviary["retainedNativeColumns"]
    ]
  )


def build():
  sources = {"zoo": west_features(), "tierpark": east_features()}
  animals, habitats, skipped = [], [], []
  evidence = {}
  for site, (features, paths) in sources.items():
    buildings = unary_union(
      [
        geometry
        for geometry, tags in features.values()
        if tags.get("building") not in (None, "no") and not is_wire_aviary(tags)
      ]
    )
    waters = unary_union(
      [
        geometry
        for geometry, tags in features.values()
        if tags.get("natural") == "water"
      ]
    )
    evidence[site] = {
      "features": features,
      "paths": paths,
      "buildings": buildings,
      "waters": waters,
    }
  for site, source_id, species, variant, requested, radius, speed in PLANS:
    source = evidence[site]
    if source_id not in source["features"]:
      raise AssertionError(f"Missing retained source {site} {source_id}")
    original, tags = source["features"][source_id]
    surface = "water" if species in WATER_MODELS else "land"
    allowed = (
      original.intersection(source["waters"])
      if surface == "water"
      else original.difference(source["waters"])
    )
    obstacles = unary_union(
      [
        source["paths"],
        source["buildings"].buffer(0.15),
        additional_obstacles(source_id),
      ]
    )
    allowed = valid_polygon(allowed.difference(obstacles))
    route = rectangle_route(allowed, radius, compact=species == "chicken")
    if not route:
      skipped.append(
        {
          "species": species,
          "siteId": site,
          "sourceId": source_id,
          "reason": "No complete closed route fits the source polygon after full-body, building, path and water exclusions.",
        }
      )
      continue
    line = LineString(route + [route[0]])
    # Store the exact source component containing this route, including all
    # its original holes; exclusions remain reproducible from retained files.
    component = next(p for p in polygons(original) if p.covers(line))
    habitat_id = site + "-" + source_id.replace("/", "-")
    habitats.append(
      {
        "id": habitat_id,
        "siteId": site,
        "sourceId": source_id,
        "label": tags.get("name", variant),
        "routeSurface": surface,
        "enclosureType": "wire-aviary" if is_wire_aviary(tags) else "outdoor",
        "sourceComponentCount": len(polygons(original)),
        **serial_polygon(component),
      }
    )
    if site == "zoo" and source_id in IDENTITY_EVIDENCE:
      habitats[-1]["identityEvidence"] = IDENTITY_EVIDENCE[source_id]
    # A small loop cannot safely carry many large illustrative figures.
    count = min(requested, max(1, math.floor(line.length / (2 * radius + 1.5))))
    for index in range(count):
      animal_variant = (
        "red-ruffed" if variant == "black-and-white-ruffed" and index % 2 else variant
      )
      animals.append(
        {
          "id": f"{habitat_id}-{species}-{index + 1}",
          "siteId": site,
          "habitatId": habitat_id,
          "species": species,
          "variant": animal_variant,
          "routeXZ": route,
          "groundY": FLOORS[site],
          "speed": speed,
          "phase": round(index / count, 6),
          "sourceId": source_id,
          "bodyRadius": radius,
        }
      )
    assert allowed.covers(
      box(
        line.bounds[0] - radius - MARGIN,
        line.bounds[1] - radius - MARGIN,
        line.bounds[2] + radius + MARGIN,
        line.bounds[3] + radius + MARGIN,
      )
    )
  retained_routes = retained(evidence, habitats, skipped)
  data = {
    "schemaVersion": 1,
    "sites": [{"id": site, "groundY": y} for site, y in FLOORS.items()],
    "placementPolicy": {
      "counts": "illustrative-not-a-census",
      "routeClearanceM": MARGIN,
      "phases": "normalised-0-to-1",
      "speedUnit": "metres-per-second",
      "existingOwners": "Transferred separately; no duplicate v165/v276 animals.",
    },
    "habitats": habitats,
    "animals": animals,
    "retainedRoutes": retained_routes,
    "unresolved": UNRESOLVED + skipped,
  }
  verify(data, evidence)
  return data


def retained(evidence, habitats, skipped):
  """Routes for existing figures only: IDs match the geometry owner transfer."""
  prior = json.loads(
    gzip.decompress(
      (ROOT / "geo_data/regierungsviertel/tierpark-v276-evidence.json.gz").read_bytes()
    )
  )
  records = [
    r
    for packet in prior["records"]
    if packet["key"].startswith("drawn:")
    for r in packet["records"]
    if r.get("kind") == "animal"
  ]
  groups = {}
  for record in records:
    groups.setdefault(record["species"], []).append(record)
  routes = []
  plans = [
    (
      "tierpark",
      species,
      group[0]["sourceId"],
      len(group),
      0.9 if species == "flamingo" else 2.0,
      "water" if species == "flamingo" else "land",
    )
    for species, group in groups.items()
  ]
  plans.append(("zoo", "wolf", "way/48164524", 3, 1.5, "land"))
  for site, species, source_id, count, radius, surface in plans:
    source = evidence[site]
    original, tags = source["features"][source_id]
    allowed = (
      original.intersection(source["waters"])
      if surface == "water"
      else original.difference(source["waters"])
    )
    allowed = valid_polygon(
      allowed.difference(
        unary_union([source["paths"], source["buildings"].buffer(0.15)])
      )
    )
    route = rectangle_route(allowed, radius, large=True)
    if not route:
      skipped.append(
        {
          "species": species,
          "siteId": site,
          "sourceId": source_id,
          "reason": "Existing figures preserved; no verified moving loop clears all full-body source exclusions.",
        }
      )
      continue
    line = LineString(route + [route[0]])
    # Do not crowd a short common loop with the existing whole flock.
    assert line.length / count > 2 * radius, (species, line.length, count)
    habitat_id = site + "-" + source_id.replace("/", "-")
    if not any(h["id"] == habitat_id for h in habitats):
      component = next(p for p in polygons(original) if p.covers(line))
      habitats.append(
        {
          "id": habitat_id,
          "siteId": site,
          "sourceId": source_id,
          "label": tags.get("name", species),
          "routeSurface": surface,
          "sourceComponentCount": len(polygons(original)),
          **serial_polygon(component),
        }
      )
    for index in range(count):
      routes.append(
        {
          "id": f"{site}-v276-{species}-{index}",
          "siteId": site,
          "habitatId": habitat_id,
          "species": species,
          "sourceId": source_id,
          "routeXZ": route,
          "groundY": FLOORS[site],
          "speed": 0.32 if species == "flamingo" else 0.45,
          "phase": round(index / count, 6),
          "bodyRadius": radius,
        }
      )
  return routes


def verify(data, evidence):
  assert len(data["animals"]) <= 60
  assert len({a["id"] for a in data["animals"]}) == len(data["animals"])
  habitats = {h["id"]: h for h in data["habitats"]}
  for animal in data["animals"] + data["retainedRoutes"]:
    route, radius = animal["routeXZ"], animal["bodyRadius"]
    assert len(route) == 4 and route[0] != route[-1]
    assert all(
      (a[0] == b[0]) != (a[1] == b[1]) for a, b in zip(route, route[1:] + [route[0]])
    )
    assert all(math.isfinite(v) for p in route for v in p)
    habitat = habitats[animal["habitatId"]]
    line = LineString(route + [route[0]])
    swept = box(
      line.bounds[0] - radius - MARGIN,
      line.bounds[1] - radius - MARGIN,
      line.bounds[2] + radius + MARGIN,
      line.bounds[3] + radius + MARGIN,
    )
    serial = Polygon(habitat["ringXZ"], habitat["holesXZ"])
    assert serial.is_valid and serial.covers(swept), animal["id"]
    source = evidence[animal["siteId"]]
    original, _ = source["features"][animal["sourceId"]]
    assert original.covers(swept), animal["id"]
    assert swept.disjoint(source["buildings"].buffer(0.15)), animal["id"]
    assert swept.disjoint(source["paths"]), animal["id"]
    assert swept.disjoint(additional_obstacles(animal["sourceId"])), animal["id"]
    if habitat["routeSurface"] == "water":
      assert source["waters"].covers(swept), animal["id"]
    else:
      assert swept.disjoint(source["waters"]), animal["id"]
    assert animal["groundY"] == FLOORS[animal["siteId"]]
  assert (
    len(json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode()) < 100_000
  )


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--check",
    action="store_true",
    help="Regenerate and verify in memory; do not write.",
  )
  arguments = parser.parse_args()
  data = build()
  encoded = json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n"
  if arguments.check:
    assert OUTPUT.read_text() == encoded, (
      "Checked-in route data differs from retained-source regeneration"
    )
  else:
    OUTPUT.write_text(encoded)
  print(
    json.dumps(
      {
        "animals": len(data["animals"]),
        "habitats": len(data["habitats"]),
        "retainedRoutes": len(data["retainedRoutes"]),
        "sites": {
          site: sum(a["siteId"] == site for a in data["animals"]) for site in FLOORS
        },
        "species": sorted({a["species"] for a in data["animals"]}),
        "skippedRoutes": [u for u in data["unresolved"] if u.get("sourceId")],
        "bytes": len(encoded.encode()),
        "sha256": hashlib.sha256(encoded.encode()).hexdigest(),
        "verified": "full-body containment, source holes, buildings, paths, surface, orthogonal closure",
      },
      ensure_ascii=False,
    )
  )


if __name__ == "__main__":
  main()
