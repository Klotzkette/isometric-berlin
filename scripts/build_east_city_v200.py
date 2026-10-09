"""Step 10: five exact requested Berlin Ortsteile; append-only outline delivery."""

from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import json
import math
import shutil
from pathlib import Path

import build_surrounding_outlines as exporter
import geopandas as gpd
from build_city_coverage_v183 import bounds_payload
from shapely import make_valid
from shapely.affinity import affine_transform
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
RAW = DATA / "raw/east-city-v200"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
PREFIX = "east200-"
DISTRICTS = {
  "55756": "Adlershof",
  "407652": "Niederschönhausen",
  "409203": "Alt-Hohenschönhausen",
  "413420": "Neu-Hohenschönhausen",
  "413421": "Oberschöneweide",
}
OLD_SCOPES = (
  "bounds.geojson",
  "bounds-ring-v182.geojson",
  "bounds-city-v183.geojson",
  "bounds-outskirts-v187.geojson",
  "bounds-north-v190.geojson",
  "bounds-named-v194.geojson",
  "bounds-named-v198.geojson",
)


def digest(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def merge_manifest(previous: dict, supplement: dict) -> dict:
  """Append only this finite supplement; prior descriptors remain identical."""
  if "eastCityV200" in previous or any(
    c["id"].startswith(PREFIX) for c in previous["chunks"]
  ):
    raise ValueError("v200 already appended; refuse to overwrite old geometry")
  result = copy.deepcopy(previous)
  retained = len(result["footprint"])
  result["chunks"].extend(copy.deepcopy(supplement["chunks"]))
  result["footprint"].extend(copy.deepcopy(supplement["footprint"]))
  result["bounds"] = [
    min(previous["bounds"][i], supplement["bounds"][i])
    if i < 2
    else max(previous["bounds"][i], supplement["bounds"][i])
    for i in range(4)
  ]
  result["eastCityV200"] = {
    "retainedFootprintCount": retained,
    "footprintCount": len(supplement["footprint"]),
    "chunkCount": len(supplement["chunks"]),
    "source": supplement["source"],
  }
  return result


def prepare_scope() -> dict:
  """Retain exact source relations; subtract both versioned and actual coverage."""
  RAW.mkdir(exist_ok=True, parents=True)
  district_source = RAW / "districts.geojson"
  if not district_source.exists():
    names = ",".join("'" + n + "'" for n in DISTRICTS.values())
    frame = gpd.read_file(
      DATA / "raw/outer-v159/berlin-260929.osm.pbf",
      layer="multipolygons",
      where=f"admin_level='10' AND name IN ({names})",
    )
    frame.to_file(district_source, driver="GeoJSON")
  frame = gpd.read_file(district_source).to_crs(25833)
  assert dict(zip(frame.osm_id, frame.name, strict=True)) == DISTRICTS
  assert all(frame.admin_level == "10")
  extent = exporter.polygonal(unary_union(frame.geometry))
  manifest = json.loads((PUBLIC / "manifest.json").read_bytes())
  if "eastCityV200" in manifest:
    raise ValueError("Prepare from retained v199 before public integration")
  actual = affine_transform(
    unary_union(
      [
        exporter.polygonal(make_valid(Polygon(p["ring"], p.get("holes", []))))
        for p in manifest["footprint"]
      ]
    ),
    [1, 0, 0, -1, 389500, 5820000],
  )
  retained = unary_union(
    [actual, *[exporter.load_projected_polygon(DATA / p) for p in OLD_SCOPES]]
  )
  scope = exporter.polygonal(extent.difference(retained))
  evidence = {
    "revision": "v1.0.100",
    "baselineRelease": "v1.0.99",
    "step": 10,
    "districtRelations": DISTRICTS,
    "adminLevel": 10,
    "scopeAreaM2": extent.area,
    "addedAreaM2": scope.area,
    "retainedScopes": [{"path": p, "sha256": digest(DATA / p)} for p in OLD_SCOPES],
    "baselineManifestSha256": digest(PUBLIC / "manifest.json"),
    "retainedChunkCount": len(manifest["chunks"]),
    "retainedFootprintCount": len(manifest["footprint"]),
    "preservationPolicy": "Exact union of every earlier documented coverage polygon plus every delivered manifest footprint. No earlier descriptor or packet is edited.",
    "heightPolicy": "Ordinary new terrain uses existing outline baseline y=3; full available LoD2 parent height envelopes, otherwise tagged/explicit estimated OSM heights. No invented detailed facade or roof survey.",
  }
  exporter.write_json(
    DATA / "bounds-east-city-v200.geojson", bounds_payload(extent, evidence)
  )
  exporter.write_json(
    DATA / "bounds-east-city-v200-retained.geojson",
    bounds_payload(
      retained,
      {
        "baselineRelease": "v1.0.99",
        "scope": "Prior actual source coverage, subtraction only",
      },
    ),
  )
  exporter.write_json(DATA / "east-city-v200-evidence.json", evidence)
  # Small source-bound administrative record is independently reproducible.
  retained_source = json.loads(district_source.read_bytes())
  for f in retained_source["features"]:
    f["properties"] = {k: f["properties"][k] for k in ["osm_id", "name", "admin_level"]}
  exporter.write_json(DATA / "east-city-v200-districts.geojson", retained_source)
  scope_world = exporter.world(scope)
  exporter.write_json(
    ROOT / "src/app/src/data/eastCityScopeV200.json",
    {
      "groundY": 3,
      "bounds": list(exporter.world(extent).bounds),
      "footprint": exporter.navigation_polygons(scope_world, 0, 0),
    },
  )
  print(
    json.dumps(
      {
        "addedAreaKm2": scope.area / 1e6,
        "worldBounds": list(exporter.world(extent).bounds),
      }
    ),
    flush=True,
  )
  return evidence


def build() -> dict:
  """Generate both full outline representations using the established exporter."""
  evidence_path = DATA / "east-city-v200-evidence.json"
  evidence = (
    json.loads(evidence_path.read_bytes())
    if evidence_path.exists()
    else prepare_scope()
  )
  exporter.RAW = RAW
  pbf = RAW / "berlin-260929.osm.pbf"
  if not pbf.exists():
    pbf.symlink_to((DATA / "raw/outer-v159/berlin-260929.osm.pbf").resolve())
  supplement = exporter.build(
    bounds_path=DATA / "bounds-east-city-v200.geojson",
    core_path=DATA / "bounds-east-city-v200-retained.geojson",
    pbf=pbf,
    lod2_dir=RAW / "lod2",
    output=RAW / "packets",
  )
  supplement["version"] = "1.0.100"
  supplement["source"]["districtRelations"] = DISTRICTS
  supplement["source"]["policy"] = (
    evidence["preservationPolicy"]
    + " "
    + evidence["heightPolicy"]
    + " Complete source rings and unbuilt/park/water areas remain; prior runtime serial residency budgets unchanged."
  )
  for chunk in supplement["chunks"]:
    chunk["id"] = PREFIX + chunk["id"]
    for mode in ["drawn", "minecraft"]:
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
  shutil.copyfile(
    RAW / "packets/source-inventory.json.gz",
    RAW / "packets" / supplement["source"]["inventory"]["url"],
  )
  exporter.write_json(DATA / "east-city-v200-manifest.json", supplement)
  evidence["chunkCount"] = len(supplement["chunks"])
  evidence["buildingCount"] = supplement["source"]["buildingCount"]
  evidence["officialBuildingCount"] = supplement["source"]["officialBuildingCount"]
  evidence["runtimeGzipBytes"] = sum(
    c[m]["bytes"] for c in supplement["chunks"] for m in ["drawn", "minecraft"]
  )
  exporter.write_json(evidence_path, evidence)
  return supplement


def write_source_receipt() -> None:
  """Freeze full resolved source rings, not a derived rendering-size snapshot."""
  manifest_path = DATA / "east-city-v200-manifest.json"
  supplement = json.loads(manifest_path.read_bytes())
  buildings = gpd.read_file(RAW / "resolved-outlines.gpkg", layer="buildings")
  surfaces = gpd.read_file(RAW / "resolved-outlines.gpkg", layer="surfaces")
  owners = []
  for row in buildings.to_dict("records"):
    item = {k: row[k] for k in ["sourceId", "height", "minHeight", "heightSource"]}
    if math.isfinite(row.get("sourceGroundY", float("nan"))):
      item["sourceGroundY"] = row["sourceGroundY"]
    item["wkb"] = row["geometry"].wkb_hex
    owners.append(item)
  proof = {
    "coordinateFrame": "Viewer metres, x=UTM33 easting−389500; z=5820000−northing",
    "geometryPolicy": "Complete resolved source footprints, including every hole, before tile clipping and centimetre serialization. WKB preserves double precision.",
    "owners": owners,
    "surfaces": [
      {"kind": row["kind"], "wkb": row.geometry.wkb_hex}
      for _, row in surfaces.iterrows()
    ],
  }
  parts = []
  for kind in ["owners", "surfaces"]:
    raw = (
      json.dumps({kind: proof[kind]}, ensure_ascii=False, separators=(",", ":")) + "\n"
    ).encode()
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    path = DATA / f"east-city-v200-source-{kind}.json.gz"
    assert len(packed) < 5 * 1024 * 1024
    path.write_bytes(packed)
    parts.append(
      {
        "path": path.name,
        "sha256": digest(path),
        "bytes": len(packed),
        "decodedBytes": len(raw),
      }
    )
  (DATA / "east-city-v200-source-rings.json.gz").unlink(missing_ok=True)
  supplement["source"]["completeRingsReceipt"] = {
    "parts": parts,
    "coordinateFrame": proof["coordinateFrame"],
    "geometryPolicy": proof["geometryPolicy"],
    "ownerCount": len(owners),
    "surfaceKinds": [r["kind"] for r in proof["surfaces"]],
  }
  exporter.write_json(manifest_path, supplement)


def copy_prepared_assets() -> None:
  """Copy only verified east200 assets; never mutate the public master manifest."""
  supplement = json.loads((DATA / "east-city-v200-manifest.json").read_bytes())
  assets = [c[m] for c in supplement["chunks"] for m in ["drawn", "minecraft"]]
  assets.append(supplement["source"]["inventory"])
  for a in assets:
    path = RAW / "packets" / a["url"]
    assert path.stat().st_size == a["bytes"] and digest(path) == a["sha256"]
    shutil.copyfile(path, PUBLIC / a["url"])


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--scope", action="store_true")
  parser.add_argument("--build", action="store_true")
  parser.add_argument("--copy-assets", action="store_true")
  parser.add_argument("--receipt", action="store_true")
  args = parser.parse_args()
  if args.scope:
    prepare_scope()
  if args.build:
    build()
  if args.copy_assets:
    copy_prepared_assets()
  if args.receipt:
    write_source_receipt()
