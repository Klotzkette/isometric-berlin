"""Step 10: finite Pankow–Prenzlauer Berg–Weißensee coverage, prior packets retained."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import shutil
from pathlib import Path

import build_surrounding_outlines as exporter
import geopandas as gpd
from build_city_coverage_v183 import bounds_payload
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
RAW = DATA / "raw/north-city-v190"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
PREFIX = "north190-"
OLD_SCOPES = (
  "bounds.geojson",
  "bounds-ring-v182.geojson",
  "bounds-city-v183.geojson",
  "bounds-outskirts-v187.geojson",
)
DISTRICTS = {"407712": "Pankow", "407713": "Prenzlauer Berg", "408308": "Weißensee"}


def merge_manifest(previous: dict, supplement: dict) -> dict:
  """Append only this revision; retain every other descriptor byte-for-byte."""
  result = copy.deepcopy(previous)
  if "northCityV190" in result:
    raise ValueError("Already published: rebuild from the retained pre-v190 manifest")
  retained = len(result["footprint"])
  result["chunks"].extend(copy.deepcopy(supplement["chunks"]))
  result["footprint"].extend(copy.deepcopy(supplement["footprint"]))
  result["bounds"] = [
    min(previous["bounds"][i], supplement["bounds"][i])
    if i < 2
    else max(previous["bounds"][i], supplement["bounds"][i])
    for i in range(4)
  ]
  result["northCityV190"] = {
    "retainedFootprintCount": retained,
    "footprintCount": len(supplement["footprint"]),
    "chunkCount": len(supplement["chunks"]),
    "source": supplement["source"],
  }
  return result


def build() -> dict:
  """Resolve exact administrative boundaries, subtract all earlier coverage."""
  areas = gpd.read_file(RAW / "candidate.gpkg", layer="multipolygons").to_crs(25833)
  selected = areas[(areas.admin_level == "10") & areas.osm_id.isin(DISTRICTS)]
  if len(selected) != 3:
    raise ValueError("Expected the three exact OSM Ortsteil relations")
  extent = exporter.polygonal(unary_union(selected.geometry))
  retained = unary_union(
    [exporter.load_projected_polygon(DATA / p) for p in OLD_SCOPES]
  )
  bounds = DATA / "bounds-north-v190.geojson"
  core = DATA / "bounds-retained-v189.geojson"
  evidence = {
    "revision": "v1.0.90",
    "scope": "User-requested northern neighbourhoods through Weißensee",
    "districtRelations": DISTRICTS,
    "adminLevel": 10,
    "scopeAreaM2": round(extent.area, 3),
    "addedAreaM2": round(extent.difference(retained).area, 3),
    "interpretation": "Ortsteil Pankow through Weißensee, joined by Prenzlauer Berg; not the whole administrative Bezirk Pankow.",
    "retainedScopes": OLD_SCOPES,
  }
  exporter.write_json(bounds, bounds_payload(extent, evidence))
  exporter.write_json(
    core, bounds_payload(retained, {"scope": "All pre-v190 source coverage retained"})
  )
  exporter.write_json(DATA / "north-city-v190-evidence.json", evidence)
  exporter.RAW = RAW
  pbf = RAW / "berlin-260929.osm.pbf"
  if not pbf.exists():
    pbf.symlink_to(DATA / "raw/outer-v159/berlin-260929.osm.pbf")
  # The complete named cemetery owners are substituted separately after source
  # resolution; inventory and all other building owners remain retained.
  supplement = exporter.build(
    bounds_path=bounds,
    core_path=core,
    pbf=pbf,
    lod2_dir=DATA / "raw/lod2",
    output=RAW / "packets",
  )
  supplement["version"] = "1.0.90"
  supplement["source"]["policy"] = (
    "Exact OSM Ortsteil Pankow, Prenzlauer Berg and Weißensee; all earlier scopes subtracted. "
    "Complete available LoD2 footprints/envelopes and OSM source rings retained. Missing heights, "
    "flat baseline, facade colours and road widths are labelled display estimates. "
    "Real parks, water, courtyards and rail yards remain open. Runtime serial queue and memory budgets unchanged."
  )
  for chunk in supplement["chunks"]:
    chunk["id"] = PREFIX + chunk["id"]
    for mode in ("drawn", "minecraft"):
      asset = chunk[mode]
      old_path = RAW / "packets" / asset["url"]
      payload = json.loads(gzip.decompress(old_path.read_bytes()))
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
      (RAW / "packets" / asset["url"]).write_bytes(packed)
      old_path.unlink()
  supplement["source"]["inventory"]["url"] = PREFIX + "source-inventory.json.gz"
  exporter.write_json(DATA / "north-city-v190-manifest.json", supplement)
  exporter.write_json(
    ROOT / "src/app/src/data/northCityScopeV190.json",
    {
      "groundY": 3,
      "bounds": supplement["bounds"],
      "footprint": supplement["footprint"],
    },
  )
  return supplement


def publish(supplement: dict) -> None:
  """Publish prepared bytes only after all named ownership refinements are ready."""
  manifest = PUBLIC / "manifest.json"
  previous = json.loads(manifest.read_bytes())
  merged = merge_manifest(previous, supplement)
  for chunk in supplement["chunks"]:
    for mode in ("drawn", "minecraft"):
      asset = chunk[mode]
      source = RAW / "packets" / asset["url"]
      assert hashlib.sha256(source.read_bytes()).hexdigest() == asset["sha256"]
      shutil.copyfile(source, PUBLIC / asset["url"])
  shutil.copyfile(
    RAW / "packets/source-inventory.json.gz",
    PUBLIC / supplement["source"]["inventory"]["url"],
  )
  exporter.write_json(manifest, merged)


def refresh_named_owners() -> dict:
  """Replace only seven complete Weißensee hall footprints in new packets."""
  import shapely
  from pyproj import Transformer
  from shapely.geometry import box, shape
  from shapely.ops import transform

  supplement = json.loads((DATA / "north-city-v190-manifest.json").read_bytes())
  exclusions = json.loads((DATA / "north-sites-v190-exclusions.geojson").read_bytes())
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform
  features = [
    f for f in exclusions["features"] if f["properties"]["name"] == "weissensee-hall"
  ]
  hero = exporter.world(
    unary_union([transform(project, shape(f["geometry"])) for f in features])
  )
  scope = exporter.world(
    exporter.load_projected_polygon(DATA / "bounds-north-v190.geojson").difference(
      exporter.load_projected_polygon(DATA / "bounds-retained-v189.geojson")
    )
  )
  buildings = gpd.read_file(RAW / "resolved-outlines.gpkg", layer="buildings").to_dict(
    "records"
  )
  surfaces = {
    r["kind"]: r.geometry
    for _, r in gpd.read_file(
      RAW / "resolved-outlines.gpkg", layer="surfaces"
    ).iterrows()
  }
  tree = shapely.STRtree([b["geometry"] for b in buildings])
  changed = []
  for chunk in supplement["chunks"]:
    tile = box(*chunk["bounds"])
    if not tile.intersects(hero):
      continue
    ground = scope.intersection(tile)
    selected = [buildings[int(i)] for i in tree.query(tile, predicate="intersects")]
    owner_ids = {f["properties"]["id"] for f in features}
    filtered = [b for b in selected if b["sourceId"] not in owner_ids]
    local = {
      kind: exporter.polygonal(
        shapely.make_valid(shapely.clip_by_rect(g, *tile.bounds))
      )
      for kind, g in surfaces.items()
    }
    for mode in ("drawn", "minecraft"):
      asset = chunk[mode]
      old = json.loads(gzip.decompress((RAW / "packets" / asset["url"]).read_bytes()))
      payload = exporter.chunk_payload(
        chunk["id"], tile, ground, filtered, local, minecraft=mode == "minecraft"
      )
      payload["nav"] = old["nav"]
      raw = (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
      ).encode()
      packed = gzip.compress(raw, compresslevel=9, mtime=0)
      (RAW / "packets" / asset["url"]).write_bytes(packed)
      asset.update(
        bytes=len(packed),
        decodedBytes=len(raw),
        sha256=hashlib.sha256(packed).hexdigest(),
      )
    changed.append(chunk["id"])
  supplement["source"]["completeNamedOwnerSubstitutions"] = {
    "ids": [f["properties"]["id"] for f in features],
    "packets": changed,
    "policy": "Only exact complete Weißensee source-model footprints substituted. Inventory, all surfaces and navigation retained.",
  }
  exporter.write_json(DATA / "north-city-v190-manifest.json", supplement)
  return supplement


def main() -> None:
  """Explicit preparation, named-owner refinement and final publication stages."""
  import argparse

  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--build", action="store_true")
  parser.add_argument("--refresh-owners", action="store_true")
  parser.add_argument("--publish", action="store_true")
  args = parser.parse_args()
  if not any((args.build, args.refresh_owners, args.publish)):
    parser.error("Choose --build, --refresh-owners and/or --publish")
  if args.build:
    build()
  if args.refresh_owners:
    refresh_named_owners()
  if args.publish:
    publish(json.loads((DATA / "north-city-v190-manifest.json").read_bytes()))


if __name__ == "__main__":
  main()
