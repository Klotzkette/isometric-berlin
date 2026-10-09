"""Step 10: finite requested outskirts, lakes and forest; old packets stay intact."""

from __future__ import annotations

import argparse
import copy
import gc
import gzip
import hashlib
import json
import math
import shutil
from pathlib import Path
from typing import Any

import build_surrounding_outlines as exporter
import geopandas as gpd
import numpy as np
import shapely
from build_city_coverage_v183 import bounds_payload
from pyproj import Transformer
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
RAW = DATA / "raw/outskirts-v187"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
PBF = DATA / "raw/outer-v159/berlin-260929.osm.pbf"
PREFIX = "outer187-"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
UNPROJECT = Transformer.from_crs(25833, 4326, always_xy=True).transform
SOURCE_BBOX = (13.075, 52.405, 13.71, 52.565)
URBAN_LOBES = {
  "olympiapark": (13.220, 52.506, 13.281, 52.525),
  "spandau_altstadt_zitadelle": (13.187, 52.522, 13.223, 52.553),
  "steglitz_dahlem_zehlendorf_mexikoplatz": (13.228, 52.426, 13.328, 52.468),
  "tierpark_friedrichsfelde": (13.516, 52.492, 13.542, 52.512),
  "koepenick_altstadt": (13.567, 52.438, 13.583, 52.453),
}
CORRIDOR_NAMES = {
  "Heerstraße",
  "Ruhlebener Straße",
  "Charlottenburger Chaussee",
  "Altstädter Ring",
  "Am Juliusturm",
  "Am Tierpark",
  "Treskowallee",
  "Frankfurter Allee",
  "Alt-Friedrichsfelde",
  "Rummelsburger Straße",
  "An der Wuhlheide",
  "Köpenicker Straße",
  "Oberspreestraße",
  "Lindenstraße",
  "Alt-Köpenick",
  "Müggelheimer Straße",
  "Müggelheimer Damm",
  "Müggelseedamm",
  "Fürstenwalder Damm",
  "Unter den Eichen",
  "Berliner Straße",
  "Clayallee",
  "Argentinische Allee",
  "Potsdamer Chaussee",
  "Spanische Allee",
  "Onkel-Tom-Straße",
}
LANDSCAPE_BOXES = [
  (13.08, 52.413, 13.29, 52.52),  # Grunewald, Havel and Wannsee shores
  (13.60, 52.413, 13.70, 52.46),  # Müggelsee and its immediate shores
]
EXCLUSIONS = [
  "west-landmarks-v187-exclusions.geojson",
  "southwest-landmarks-v187-exclusions.geojson",
  "east-landmarks-v187-exclusions.geojson",
]


def source_frames() -> tuple[Any, Any]:
  """Retain bounded complete OSM features in an ignored source cache."""
  RAW.mkdir(parents=True, exist_ok=True)
  cache = RAW / "candidate.gpkg"
  result = []
  for layer in ("lines", "multipolygons"):
    if cache.exists() and layer in set(gpd.list_layers(cache).name):
      frame = gpd.read_file(cache, layer=layer)
    else:
      print(f"Reading bounded PBF {layer}", flush=True)
      frame = gpd.read_file(PBF, layer=layer, bbox=SOURCE_BBOX, engine="pyogrio")
      frame.to_file(cache, layer=layer, driver="GPKG")
    result.append(frame.to_crs(25833))
  return tuple(result)


def build_scope(lines: Any, areas: Any) -> tuple[Any, Any, dict]:
  """Only named neighbourhoods, mapped links and requested landscape surfaces."""
  urban = unary_union([transform(PROJECT, box(*b)) for b in URBAN_LOBES.values()])
  forest_limit = transform(
    PROJECT,
    Polygon(
      [
        (13.135, 52.515),
        (13.29, 52.52),
        (13.29, 52.463),
        (13.244, 52.427),
        (13.173, 52.415),
        (13.137, 52.45),
        (13.12, 52.477),
      ]
    ),
  )
  landscape_limit = unary_union([transform(PROJECT, box(*b)) for b in LANDSCAPE_BOXES])
  corridors, road_ids, landscape, landscape_ids, woods = [], [], [], [], []
  for _, row in lines.iterrows():
    tags = exporter.tags_for(row)
    if tags.get("name") not in CORRIDOR_NAMES or not tags.get("highway"):
      continue
    # Repeated street names outside these requested directions are not selected.
    lon, lat = UNPROJECT(row.geometry.centroid.x, row.geometry.centroid.y)
    west = lon < 13.34 and 52.413 < lat < 52.555
    east = lon > 13.45 and 52.42 < lat < 52.525
    if not (west or east):
      continue
    corridors.append(row.geometry.buffer(85, quad_segs=3))
    road_ids.append(f"OSM-way-{row['osm_id']}")
  for _, row in areas.iterrows():
    tags = exporter.tags_for(row)
    wooded = tags.get("natural") == "wood" or tags.get("landuse") == "forest"
    water = tags.get("natural") == "water" or tags.get("water") in {
      "river",
      "canal",
      "lake",
      "pond",
      "reservoir",
      "basin",
    }
    if not (wooded or water) or not row.geometry.intersects(landscape_limit):
      continue
    geometry = shapely.make_valid(row.geometry).intersection(landscape_limit)
    if wooded:
      geometry = geometry.intersection(forest_limit)
    elif UNPROJECT(geometry.centroid.x, geometry.centroid.y)[0] > 13.5:
      # East request is the lake outline, not an additional forest district.
      if tags.get("name") not in {
        "Großer Müggelsee",
        "Kleiner Müggelsee",
        "Müggelsee",
        "Müggelspree",
        "Spree",
      }:
        continue
    elif tags.get("name") not in {
      "Havel",
      "Großer Wannsee",
      "Kleiner Wannsee",
      "Wannsee",
      "Pohlesee",
      "Stölpchensee",
    }:
      geometry = geometry.intersection(forest_limit)
    if geometry.area < 5:
      continue
    landscape.append(geometry.buffer(40, quad_segs=3))
    landscape_ids.append(
      {
        "sourceId": exporter.source_identity(row),
        "name": tags.get("name", ""),
        "wood": wooded,
      }
    )
    if wooded:
      woods.append(geometry)
  scope = exporter.polygonal(unary_union([urban, *corridors, *landscape]))
  forest = exporter.polygonal(unary_union(woods))
  evidence = {
    "urbanLobesCrs84": URBAN_LOBES,
    "sourceBbox": SOURCE_BBOX,
    "landscapeLimitsCrs84": LANDSCAPE_BOXES,
    "forestSelectionLimitCrs84": mapping(transform(UNPROJECT, forest_limit)),
    "corridorBufferM": 85,
    "landscapeShoreBufferM": 40,
    "roadIds": sorted(set(road_ids)),
    "landscapeSources": landscape_ids,
  }
  return scope, forest, evidence


def exclusions() -> tuple[Any, set[str]]:
  """Exact new hero footprints only; retain every source in the source inventory."""
  geometries, ids = [], set()
  for name in EXCLUSIONS:
    path = DATA / name
    if not path.exists():
      raise FileNotFoundError(f"Wait for completed landmark ownership: {name}")
    data = json.loads(path.read_bytes())
    for feature in data["features"]:
      geometry = shape(feature["geometry"])
      if geometry.bounds[0] < 1000:
        geometry = transform(PROJECT, geometry)
      geometries.append(geometry)
      props = feature["properties"]
      ids.update(props.get("parentIds", []))
      for key in ("sourceId", "parent", "parentId", "id"):
        if props.get(key):
          ids.add(props[key])
  return exporter.world(unary_union(geometries)), ids


def merge_manifest(previous: dict, supplement: dict) -> dict:
  """Replace this release in place while retaining later independent entries."""
  result = copy.deepcopy(previous)
  old = result.get("outskirtsV187")
  if old:
    replacements = {c["id"]: copy.deepcopy(c) for c in supplement["chunks"]}
    own_positions = [
      i for i, c in enumerate(result["chunks"]) if c["id"].startswith(PREFIX)
    ]
    if own_positions:
      chunks = []
      for i, chunk in enumerate(result["chunks"]):
        if chunk["id"].startswith(PREFIX):
          replacement = replacements.pop(chunk["id"], None)
          if replacement is not None:
            chunks.append(replacement)
        else:
          chunks.append(chunk)
        # New own packets belong at the end of the existing own range, not
        # after a later release's independently appended companions.
        if i == own_positions[-1]:
          chunks.extend(replacements.values())
      result["chunks"] = chunks
    else:
      result["chunks"].extend(replacements.values())
    retained = old["retainedFootprintCount"]
    result["footprint"][retained : retained + old["footprintCount"]] = copy.deepcopy(
      supplement["footprint"]
    )
  else:
    retained = len(result["footprint"])
    result["chunks"].extend(copy.deepcopy(supplement["chunks"]))
    result["footprint"].extend(copy.deepcopy(supplement["footprint"]))
  result["bounds"] = [
    min(previous["bounds"][i], supplement["bounds"][i])
    if i < 2
    else max(previous["bounds"][i], supplement["bounds"][i])
    for i in range(4)
  ]
  result["outskirtsV187"] = {
    "retainedFootprintCount": retained,
    "footprintCount": len(supplement["footprint"]),
    "chunkCount": len(supplement["chunks"]),
    "source": supplement["source"],
  }
  return result


def publish(supplement: dict) -> None:
  """Use the established serial runtime queue and frozen original packets."""
  output = RAW / "packets"
  for chunk in supplement["chunks"]:
    for mode in ("drawn", "minecraft"):
      asset = chunk[mode]
      source = output / asset["url"]
      assert hashlib.sha256(source.read_bytes()).hexdigest() == asset["sha256"]
      shutil.copyfile(source, PUBLIC / asset["url"])
  inventory = supplement["source"]["inventory"]
  shutil.copyfile(output / "source-inventory.json.gz", PUBLIC / inventory["url"])
  path = PUBLIC / "manifest.json"
  exporter.write_json(path, merge_manifest(json.loads(path.read_bytes()), supplement))


def make_payload(hero, forest_world, stadium_cutout, selected_trees):
  """Share identical packet construction between a full build and hero refresh."""
  original_payload = exporter.chunk_payload
  navigation = []
  for name in (
    "westLandmarksV187Navigation",
    "southWestLandmarksV187Navigation",
    "eastLandmarksV187Navigation",
  ):
    for record in json.loads((ROOT / f"src/app/src/data/{name}.json").read_bytes())[
      "buildings"
    ]:
      geometry = exporter.polygonal(
        shapely.make_valid(Polygon(record["ring"], record.get("holes", [])))
      )
      navigation.append((record, geometry))

  def payload(chunk_id, tile, ground, buildings, surfaces, *, minecraft):
    # Retain complete input records in evidence, remove only exact overlapping
    # display area now owned by the separately supplied complete hero geometry.
    records = []
    for b in buildings:
      # v199: these complete owners already belong to dedicated open/surface
      # models. Geographic reprojection of their exact footprints leaves tiny
      # numerical slivers whose extrusion resurrects full-height opaque walls.
      # Keep all source records, but never redraw those fully transferred IDs.
      if b["sourceId"] in {
        "DEBE04YY500006Zr",  # Funkturm shaft
        "DEBE04YY50002bpq",  # Funkturm restaurant envelope
        "DEBE04YY500001II",  # ICC complete source main owner
        "DEBE04YY500004dG",  # ICC garage source owner
        "DEBE04YY500006BE",  # ICC entrance annex source owner
      }:
        continue
      g = exporter.polygonal(b["geometry"].difference(hero))
      if not g.is_empty:
        records.append({**b, "geometry": g})
    local_cutout = stadium_cutout.intersection(tile)
    visual_ground = ground.difference(local_cutout)
    if not local_cutout.is_empty:
      surfaces = {kind: g.difference(local_cutout) for kind, g in surfaces.items()}
    result = original_payload(
      chunk_id, tile, visual_ground, records, surfaces, minecraft=minecraft
    )
    # Use measured per-part heights instead of an invisible parent-wide tower.
    minx, minz, _, _ = tile.bounds
    for record, geometry in navigation:
      if not geometry.intersects(tile):
        continue
      clipped = exporter.polygonal(geometry.intersection(tile).intersection(ground))
      result["nav"]["buildings"].extend(
        {
          **polygon,
          "height": record["topY"] - 3,
          "minHeight": record["groundY"] - 3,
          "sourceId": record.get("sourceId", record["owner"]),
          "partId": record["id"],
          "heightSource": record.get(
            "heightSource", "Landmark part envelope; see v187 source evidence"
          ),
        }
        for polygon in exporter.navigation_polygons(clipped, minx, minz)
      )
    # Woodland crowns are a declared low-density illustration, not tree surveys.
    free = forest_world.intersection(tile).difference(hero.buffer(8))
    for kind in ("road", "path", "rail", "water", "bridge"):
      free = free.difference(surfaces.get(kind, Polygon()).buffer(7))
    if buildings:
      free = free.difference(unary_union([b["geometry"] for b in buildings]).buffer(9))
    minx, minz, maxx, maxz = tile.bounds
    mesh = exporter.PackedMesh(minx, minz)
    count = 0
    for x in np.arange(math.ceil((minx + 16) / 42) * 42, maxx - 16, 42):
      for z in np.arange(math.ceil((minz + 16) / 42) * 42, maxz - 16, 42):
        seed = (int(x) * 73856093 ^ int(z) * 19349663) & 0xFFFFFFFF
        x1, z1 = x + (seed % 11 - 5), z + ((seed >> 8) % 11 - 5)
        if not free.contains(Point(x1, z1).buffer(9)):
          continue
        count += 1
        radius, top = 9 + seed % 4, 17 + (seed >> 5) % 6
        colour = (74 + seed % 16, 113 + seed % 20, 65 + seed % 12)
        # Five-sided crowns; Minecraft's separate surface boxes stay orthogonal.
        trunk = box(x1 - 0.65, z1 - 0.65, x1 + 0.65, z1 + 0.65)
        for a, b in zip(trunk.exterior.coords, list(trunk.exterior.coords)[1:]):
          mesh.triangle(
            [(a[0], 3, a[1]), (b[0], 3, b[1]), (b[0], 9, b[1])], (105, 85, 65)
          )
          mesh.triangle(
            [(a[0], 3, a[1]), (b[0], 9, b[1]), (a[0], 9, a[1])], (105, 85, 65)
          )
        if minecraft:
          crown = box(x1 - radius, z1 - radius, x1 + radius, z1 + radius)
          mesh.surface(crown, top, colour)
          for a, b in zip(crown.exterior.coords, list(crown.exterior.coords)[1:]):
            mesh.triangle([(a[0], 8, a[1]), (b[0], 8, b[1]), (b[0], top, b[1])], colour)
            mesh.triangle(
              [(a[0], 8, a[1]), (b[0], top, b[1]), (a[0], top, a[1])], colour
            )
        else:
          ring = [
            (
              x1 + radius * math.cos(i * math.tau / 5),
              12,
              z1 + radius * math.sin(i * math.tau / 5),
            )
            for i in range(5)
          ]
          for i, a in enumerate(ring):
            b = ring[(i + 1) % 5]
            mesh.triangle([a, (x1, top, z1), b], colour)
            mesh.triangle([b, (x1, 7, z1), a], colour)
    tree_mesh = mesh.payload("outskirts-v187-forest")
    if tree_mesh:
      result["meshes"].append(tree_mesh)
    if not minecraft:
      selected_trees[chunk_id] = count
    return result

  return payload


def build(*, prepare_only: bool = False) -> dict:
  """Preserve old source ownership, prepare exact new areas and bounded packets."""
  lines, areas = source_frames()
  extent, forest, evidence = build_scope(lines, areas)
  del lines, areas
  gc.collect()
  old = unary_union(
    [
      exporter.load_projected_polygon(DATA / name)
      for name in (
        "bounds.geojson",
        "bounds-ring-v182.geojson",
        "bounds-city-v183.geojson",
      )
    ]
  )
  new = extent.difference(old)
  bounds_path, retained_path = (
    DATA / "bounds-outskirts-v187.geojson",
    DATA / "bounds-retained-v186.geojson",
  )
  exporter.write_json(
    bounds_path,
    bounds_payload(
      extent,
      {
        "revision": "v1.0.87",
        "scope": "Owner-requested finite west/southwest/east outlines and landscape",
        **evidence,
      },
    ),
  )
  exporter.write_json(
    retained_path, bounds_payload(old, {"scope": "Unchanged prior coverage"})
  )
  exporter.write_json(DATA / "outskirts-v187-scope-evidence.json", evidence)
  if prepare_only:
    return {"addedAreaM2": new.area, "forestAreaM2": forest.area}
  # Source cache location is private to this revision, never overwrite old caches.
  exporter.RAW = RAW
  pbf = RAW / PBF.name
  if not pbf.exists():
    pbf.symlink_to(PBF)
  hero, hero_ids = exclusions()
  forest_world = exporter.world(forest.intersection(new))
  cutout_path = DATA / "west-landmarks-v187-stadium-cutout.geojson"
  stadium_cutout = exporter.world(exporter.load_projected_polygon(cutout_path))
  hero_key = hashlib.sha256(
    b"".join((DATA / name).read_bytes() for name in EXCLUSIONS)
  ).hexdigest()
  hero_key_path = RAW / "hero-key.txt"
  if not hero_key_path.exists() or hero_key_path.read_text() != hero_key:
    (RAW / "resolved-outlines.json").unlink(missing_ok=True)
    hero_key_path.write_text(hero_key)
  original_payload, original_collect = exporter.chunk_payload, exporter.collect_sources
  selected_trees: dict[str, int] = {}

  def collect(lines, areas, scope, official):
    buildings, surfaces, inventory = original_collect(lines, areas, scope, official)
    # natural=wood is the equivalent OSM woodland classification to landuse=forest.
    surfaces["park"].append(forest.intersection(scope))
    inventory["heroReplacements"] = {
      "sourceIds": sorted(hero_ids),
      "records": [
        {
          **{k: v for k, v in b.items() if k != "geometry"},
          "geometry": mapping(exporter.world(b["geometry"])),
        }
        for b in buildings
        if exporter.world(b["geometry"]).intersects(hero)
      ],
      "policy": "Only exact new complete hero footprints are replaced; all source records retained.",
    }
    return buildings, surfaces, inventory

  payload = make_payload(hero, forest_world, stadium_cutout, selected_trees)

  exporter.collect_sources, exporter.chunk_payload = collect, payload
  try:
    supplement = exporter.build(
      bounds_path=bounds_path,
      core_path=retained_path,
      pbf=pbf,
      lod2_dir=DATA / "raw/lod2",
      output=RAW / "packets",
    )
  finally:
    exporter.collect_sources, exporter.chunk_payload = (
      original_collect,
      original_payload,
    )
  supplement["version"] = "1.0.87"
  supplement["source"].update(
    {
      "treeCount": sum(selected_trees.values()),
      "forestTreePolicy": "Illustrative 42m sampling strictly within retained woodland, avoiding paths/water/buildings; not individual surveyed trees.",
      "policy": "Finite explicitly requested outskirts and mapped landscape, exact previous scope subtracted. New hero ownership replaces only exact overlaps; prior source packets and details are immutable. Source water/road vertices remain unsimplified; unavailable heights and flat terrain are labelled display estimates.",
    }
  )
  output = RAW / "packets"
  for chunk in supplement["chunks"]:
    chunk["id"] = PREFIX + chunk["id"]
    for mode in ("drawn", "minecraft"):
      asset = chunk[mode]
      old_path = output / asset["url"]
      data = json.loads(gzip.decompress(old_path.read_bytes()))
      data["id"] = chunk["id"]
      raw = (
        json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
      ).encode()
      packed = gzip.compress(raw, compresslevel=9, mtime=0)
      asset.update(
        url=PREFIX + asset["url"],
        bytes=len(packed),
        decodedBytes=len(raw),
        sha256=hashlib.sha256(packed).hexdigest(),
      )
      (output / asset["url"]).write_bytes(packed)
      old_path.unlink()
  supplement["source"]["inventory"]["url"] = PREFIX + "source-inventory.json.gz"
  exporter.write_json(DATA / "outskirts-v187-manifest.json", supplement)
  exporter.write_json(
    ROOT / "src/app/src/data/outskirtsScopeV187.json",
    {
      "groundY": 3,
      "bounds": supplement["bounds"],
      "footprint": supplement["footprint"],
    },
  )
  return supplement


def refresh_heroes() -> dict:
  """Rebuild only new packets touching finalized heroes, never old city packets."""
  supplement = json.loads((DATA / "outskirts-v187-manifest.json").read_bytes())
  lines, areas = source_frames()
  _, forest, _ = build_scope(lines, areas)
  del lines, areas
  scope = exporter.world(
    exporter.load_projected_polygon(DATA / "bounds-outskirts-v187.geojson").difference(
      exporter.load_projected_polygon(DATA / "bounds-retained-v186.geojson")
    )
  )
  forest_world = exporter.world(forest).intersection(scope)
  hero, hero_ids = exclusions()
  stadium = exporter.world(
    exporter.load_projected_polygon(DATA / "west-landmarks-v187-stadium-cutout.geojson")
  )
  prepared = RAW / "resolved-outlines.gpkg"
  buildings = gpd.read_file(prepared, layer="buildings").to_dict("records")
  surfaces = {
    row["kind"]: row.geometry
    for _, row in gpd.read_file(prepared, layer="surfaces").iterrows()
  }
  tree = shapely.STRtree([b["geometry"] for b in buildings])
  payload = make_payload(hero, forest_world, stadium, {})
  refreshed = []
  for chunk in supplement["chunks"]:
    tile = box(*chunk["bounds"])
    if not tile.intersects(hero.union(stadium)):
      continue
    ground = tile.intersection(scope)
    selected = [buildings[int(i)] for i in tree.query(tile, predicate="intersects")]
    local = {
      kind: exporter.polygonal(
        shapely.make_valid(shapely.clip_by_rect(geometry, *tile.bounds))
      )
      for kind, geometry in surfaces.items()
    }
    for mode in ("drawn", "minecraft"):
      data = payload(
        chunk["id"], tile, ground, selected, local, minecraft=mode == "minecraft"
      )
      raw = (
        json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
      ).encode()
      packed = gzip.compress(raw, compresslevel=9, mtime=0)
      asset = chunk[mode]
      (RAW / "packets" / asset["url"]).write_bytes(packed)
      asset.update(
        bytes=len(packed),
        decodedBytes=len(raw),
        sha256=hashlib.sha256(packed).hexdigest(),
      )
    refreshed.append(chunk["id"])
    print(f"Refreshed {chunk['id']}", flush=True)
  inventory = json.loads(
    gzip.decompress((RAW / "packets/source-inventory.json.gz").read_bytes())
  )
  inventory["heroReplacements"] = {
    "sourceIds": sorted(hero_ids),
    "records": [
      {
        **{k: v for k, v in b.items() if k != "geometry"},
        "geometry": mapping(b["geometry"]),
      }
      for b in buildings
      if b["geometry"].intersects(hero)
    ],
    "policy": "Only exact new complete hero footprints are replaced; all source records retained.",
  }
  asset = exporter.write_source_inventory(RAW / "packets", inventory)
  asset["url"] = PREFIX + asset["url"]
  supplement["source"]["inventory"] = asset
  supplement["source"]["heroNavigationPolicy"] = (
    "Exact per-part footprints and vertical envelopes; retained source geometry for comparison. Open stadium pitch uses its measured ground profile."
  )
  exporter.write_json(DATA / "outskirts-v187-manifest.json", supplement)
  exporter.write_json(RAW / "hero-refresh-receipt.json", {"chunks": refreshed})
  return supplement


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--prepare-only", action="store_true")
  parser.add_argument("--publish", action="store_true")
  parser.add_argument("--refresh-heroes", action="store_true")
  parser.add_argument("--publish-only", action="store_true")
  args = parser.parse_args()
  result = (
    refresh_heroes()
    if args.refresh_heroes
    else (
      json.loads((DATA / "outskirts-v187-manifest.json").read_bytes())
      if args.publish_only
      else build(prepare_only=args.prepare_only)
    )
  )
  if args.publish or args.publish_only:
    publish(result)
  print(
    json.dumps(
      {"chunks": len(result.get("chunks", [])), "source": result.get("source", result)},
      ensure_ascii=False,
    )
  )
