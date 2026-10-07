"""Step 10: source-bound massing in the Ringbahn and three finite outer lobes.

The 7 October owner request authorizes this independent supplement. Existing
detailed-city bounds and every previously delivered geometry packet are inputs,
never regenerated. A single shared serial loader consumes the appended chunks.
"""

from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

import build_surrounding_outlines as exporter
import geopandas as gpd
import shapely
from pyproj import Transformer
from shapely.geometry import Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
RAW = DATA / "raw/ring-v182"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
UNPROJECT = Transformer.from_crs(25833, 4326, always_xy=True).transform
LOBES = {
  "steglitz_schlossstrasse": (13.312, 52.451, 13.340, 52.471),
  "theodor_heuss_rbb": (13.269, 52.505, 13.277, 52.512),
  "estrel": (13.455, 52.470, 13.462, 52.476),
}
PREFIX = "ring182-"
PARTS = DATA / "ring-kreisel-parts-v182.json"


def measured_parts() -> dict[str, list[dict[str, Any]]]:
  """Retain each measured low podium instead of extruding the tower envelope."""
  evidence = json.loads(PARTS.read_bytes())
  return {
    parent["id"]: [
      {
        "partId": part["id"],
        "geometry": exporter.world(shape(part["footprintEpsg25833"])),
        "height": round(part["top_y_m"] - part["ground_y_m"], 3),
        "sourceGroundY": part["ground_y_m"],
      }
      for part in parent["parts"]
    ]
    for parent in evidence["parents"]
  }


def refine_part_heights(
  buildings: list[dict[str, Any]], parts: dict[str, list[dict[str, Any]]]
) -> list[dict[str, Any]]:
  result = []
  for building in buildings:
    source_parts = parts.get(building["sourceId"])
    if source_parts is None:
      result.append(building)
      continue
    footprint = building["geometry"]
    union = unary_union([p["geometry"] for p in source_parts])
    if footprint.difference(union.buffer(0.002)).area > 0.01:
      raise ValueError(f"Incomplete measured parts: {building['sourceId']}")
    for part in source_parts:
      geometry = part["geometry"].intersection(footprint)
      if geometry.area > 0:
        result.append(
          {
            **building,
            **part,
            "geometry": geometry,
            "heightSource": "Berlin LoD2 measured leaf-part vertical envelope",
          }
        )
  return result


def part_refinement_evidence() -> dict[str, Any]:
  parts = measured_parts()
  return {
    "file": PARTS.name,
    "sha256": hashlib.sha256(PARTS.read_bytes()).hexdigest(),
    "parents": sorted(parts),
    "partCount": sum(map(len, parts.values())),
    "policy": "Exact source parent footprints retain their leaf-part heights before hero clipping; parent envelope and source inventory remain evidence, not a podium height.",
  }


def build_bounds(root: Path = ROOT) -> dict[str, Any]:
  """Retain every source ring vertex, buffered by exactly 100 metric metres."""
  data = root / "geo_data/regierungsviertel"
  source = json.loads((data / "outer-thin-outlines-v179.json").read_text())
  line = next(item for item in source["lines"] if item["name"] == "Ringbahn S41")
  coordinates = line["coordinates"]
  if coordinates[0] != coordinates[-1]:
    raise ValueError("The retained Ringbahn source must be a complete closed loop")
  ring = transform(PROJECT, Polygon(coordinates))
  if not ring.is_valid:
    raise ValueError("Invalid source Ringbahn polygon")
  geometry = unary_union(
    [ring.buffer(100), *[transform(PROJECT, box(*b)) for b in LOBES.values()]]
  )
  return {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "revision": "v1.0.82",
          "scope": "Ringbahn interior plus 100 m and named lobes",
          "sourceRingIds": line["osmIds"],
          "bufferM": 100,
          "lobesCrs84": LOBES,
          "preservation": "Independent supplement; original bounds.geojson is unchanged",
        },
        "geometry": mapping(transform(UNPROJECT, geometry)),
      }
    ],
  }


def merge_manifest(
  previous: dict[str, Any], supplement: dict[str, Any]
) -> dict[str, Any]:
  """Append distinct chunks without changing an existing asset or descriptor."""
  result = copy.deepcopy(previous)
  old = result.pop("ringCityV182", None)
  if old:
    result["chunks"] = [c for c in result["chunks"] if not c["id"].startswith(PREFIX)]
    result["footprint"] = result["footprint"][: old["retainedFootprintCount"]]
  previous_count = len(result["footprint"])
  result["chunks"].extend(supplement["chunks"])
  result["footprint"].extend(supplement["footprint"])
  result["bounds"] = [
    min(previous["bounds"][0], supplement["bounds"][0]),
    min(previous["bounds"][1], supplement["bounds"][1]),
    max(previous["bounds"][2], supplement["bounds"][2]),
    max(previous["bounds"][3], supplement["bounds"][3]),
  ]
  result["ringCityV182"] = {
    "retainedFootprintCount": previous_count,
    "chunkCount": len(supplement["chunks"]),
    "source": supplement["source"],
  }
  return result


def exclude_hero_shells(
  buildings: list[dict[str, Any]], owned_ids: set[str], ownership: Any
) -> list[dict[str, Any]]:
  """Complete hero owners replace only their own shells; retain adjacent houses."""
  result = []
  for building in buildings:
    if building["sourceId"] in owned_ids:
      continue
    geometry = building["geometry"]
    if geometry.intersects(ownership):
      geometry = geometry.difference(ownership)
    if not geometry.is_empty:
      result.append({**building, "geometry": geometry})
  return result


def hero_ownership() -> tuple[set[str], Any]:
  heroes = json.loads((DATA / "steglitz-v182-exclusions.geojson").read_text())
  owned_ids = {
    identity
    for feature in heroes["features"]
    for identity in [
      feature["properties"].get("officialId"),
      *[
        "OSM-" + identifier.replace("/", "-")
        for identifier in feature["properties"].get("osmIds", [])
      ],
    ]
    if identity
  }
  ownership = exporter.world(
    unary_union(
      [transform(PROJECT, shape(feature["geometry"])) for feature in heroes["features"]]
    )
  )
  return owned_ids, ownership


def repair_measured_parts(*, publish: bool = False) -> dict[str, Any]:
  """Rebuild only new chunks touching the three evidenced compound parents."""
  parts = measured_parts()
  buildings = gpd.read_file(RAW / "resolved-outlines.gpkg", layer="buildings").to_dict(
    "records"
  )
  surfaces = {
    row["kind"]: row.geometry
    for _, row in gpd.read_file(
      RAW / "resolved-outlines.gpkg", layer="surfaces"
    ).iterrows()
  }
  affected = unary_union([b["geometry"] for b in buildings if b["sourceId"] in parts])
  tree = shapely.STRtree([b["geometry"] for b in buildings])
  bounds = exporter.load_projected_polygon(DATA / "bounds-ring-v182.geojson")
  core = exporter.load_projected_polygon(DATA / "bounds.geojson")
  scope = exporter.world(bounds.difference(core))
  owned_ids, ownership = hero_ownership()
  supplement = json.loads((DATA / "ring-city-v182-manifest.json").read_bytes())
  for chunk in supplement["chunks"]:
    tile = box(*chunk["bounds"])
    if not tile.intersects(affected):
      continue
    selected = [buildings[int(i)] for i in tree.query(tile, predicate="intersects")]
    refined = exclude_hero_shells(
      refine_part_heights(selected, parts), owned_ids, ownership
    )
    local_surfaces = {
      kind: exporter.polygonal(
        shapely.make_valid(shapely.clip_by_rect(geometry, *tile.bounds))
      )
      for kind, geometry in surfaces.items()
    }
    for mode in ("drawn", "minecraft"):
      payload = exporter.chunk_payload(
        chunk["id"],
        tile,
        tile.intersection(scope),
        refined,
        local_surfaces,
        minecraft=mode == "minecraft",
      )
      raw = (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
      ).encode()
      packed = gzip.compress(raw, compresslevel=9, mtime=0)
      asset = chunk[mode]
      (RAW / "packets" / asset["url"]).write_bytes(packed)
      asset.update(
        bytes=len(packed),
        decodedBytes=len(raw),
        sha256=hashlib.sha256(packed).hexdigest(),
      )
    print(f"Measured leaf-part repair: {chunk['id']}", flush=True)
  supplement["source"]["partHeightRefinement"] = part_refinement_evidence()
  exporter.write_json(DATA / "ring-city-v182-manifest.json", supplement)
  if publish:
    publish_prepared(supplement)
  return supplement


def publish_prepared(supplement: dict[str, Any]) -> None:
  """Publish completed packets and atomically merge the latest retained manifest."""
  out = RAW / "packets"
  for chunk in supplement["chunks"]:
    for mode in ("drawn", "minecraft"):
      asset = chunk[mode]
      source = out / asset["url"]
      if hashlib.sha256(source.read_bytes()).hexdigest() != asset["sha256"]:
        raise ValueError(f"Prepared packet digest mismatch: {source}")
      shutil.copyfile(source, PUBLIC / asset["url"])
  source_asset = supplement["source"]["inventory"]
  shutil.copyfile(out / "source-inventory.json.gz", PUBLIC / source_asset["url"])
  retained_manifest = PUBLIC / "manifest.json"
  previous = json.loads(retained_manifest.read_text())
  temporary = PUBLIC / "manifest-ring182-prepared.json"
  exporter.write_json(temporary, merge_manifest(previous, supplement))
  temporary.replace(retained_manifest)


def build(*, publish: bool = False) -> dict[str, Any]:
  """Reuse permitted cached inputs and prepare independent native/drawn packets."""
  RAW.mkdir(parents=True, exist_ok=True)
  bounds_path = DATA / "bounds-ring-v182.geojson"
  exporter.write_json(bounds_path, build_bounds())
  # Keep old resolved source caches intact; only immutable inputs are shared.
  for name in ("berlin-260929.osm.pbf", "candidate.gpkg"):
    link = RAW / name
    if not link.exists():
      link.symlink_to(DATA / "raw/outer-v159" / name)
  exporter.RAW = RAW
  out = RAW / "packets"
  owned_ids, ownership = hero_ownership()
  parts = measured_parts()
  original_chunk_payload = exporter.chunk_payload

  def hero_aware_chunk_payload(chunk_id, tile, ground, buildings, surfaces, **kwargs):
    return original_chunk_payload(
      chunk_id,
      tile,
      ground,
      exclude_hero_shells(refine_part_heights(buildings, parts), owned_ids, ownership),
      surfaces,
      **kwargs,
    )

  exporter.chunk_payload = hero_aware_chunk_payload
  try:
    supplement = exporter.build(
      bounds_path=bounds_path,
      core_path=DATA / "bounds.geojson",
      pbf=RAW / "berlin-260929.osm.pbf",
      lod2_dir=DATA / "raw/lod2",
      output=out,
    )
  finally:
    exporter.chunk_payload = original_chunk_payload
  supplement["version"] = "1.0.82"
  supplement["source"]["policy"] = (
    "Independent Ringbahn-interior plus 100 m and three named presentation lobes, "
    "minus the exact unchanged 81.457 km2 city. Cached LoD2 parent footprints and "
    "vertical envelopes take priority where available; OSM adds uncovered mapped "
    "buildings. Tagged height, floor count or explicit class estimates are recorded "
    "per building. No synthetic buildings fill parks, water, courts or rail yards. "
    "Road vertices and mapped public-space polygons are retained; missing widths, "
    "flat y=3 terrain, neutral colours and native two-metre reading are estimates."
  )
  supplement["source"]["heroReplacement"] = {
    "footprintFile": "steglitz-v182-exclusions.geojson",
    "footprintSha256": hashlib.sha256(
      (DATA / "steglitz-v182-exclusions.geojson").read_bytes()
    ).hexdigest(),
    "exactSourceIds": sorted(owned_ids),
    "policy": "Complete named source owners use SteglitzV182 hero shells; only overlapping area is clipped from other footprints. Source records stay retained in evidence.",
  }
  supplement["source"]["partHeightRefinement"] = part_refinement_evidence()
  for chunk in supplement["chunks"]:
    previous_id = chunk["id"]
    chunk["id"] = PREFIX + previous_id
    for mode in ("drawn", "minecraft"):
      asset = chunk[mode]
      payload = json.loads(gzip.decompress((out / asset["url"]).read_bytes()))
      payload["id"] = chunk["id"]
      raw = (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
      ).encode()
      packed = gzip.compress(raw, compresslevel=9, mtime=0)
      asset.update(
        url=PREFIX + asset["url"],
        bytes=len(packed),
        decodedBytes=len(raw),
        sha256=hashlib.sha256(packed).hexdigest(),
      )
      (out / asset["url"]).write_bytes(packed)
  source_asset = supplement["source"]["inventory"]
  source_asset["url"] = PREFIX + source_asset["url"]
  exporter.write_json(DATA / "ring-city-v182-manifest.json", supplement)
  scope = {"groundY": exporter.GROUND_Y, "footprint": supplement["footprint"]}
  exporter.write_json(ROOT / "src/app/src/data/ringCityScopeV182.json", scope)
  if publish:
    publish_prepared(supplement)
  return supplement


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--publish", action="store_true")
  parser.add_argument("--publish-only", action="store_true")
  parser.add_argument("--repair-measured-parts", action="store_true")
  args = parser.parse_args()
  if args.repair_measured_parts:
    result = repair_measured_parts(publish=args.publish)
  elif args.publish_only:
    result = json.loads((DATA / "ring-city-v182-manifest.json").read_text())
    publish_prepared(result)
  else:
    result = build(publish=args.publish)
  print(f"Added {len(result['chunks'])} source-bound independent Ringbahn packets")
