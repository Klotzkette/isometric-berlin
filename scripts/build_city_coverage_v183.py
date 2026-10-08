"""Step 10: finite south-city, Charlottenburg and Treptow infill, additive to v182."""

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
from pyproj import Transformer
from shapely.geometry import box, mapping
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
RAW = DATA / "raw/city-v183"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
PREFIX = "city183-"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
UNPROJECT = Transformer.from_crs(25833, 4326, always_xy=True).transform
LOBES = {
  "steglitz_friedenau_schoeneberg_suedkreuz": (13.305, 52.451, 13.378, 52.493),
  "charlottenburg_palace_tegeler_weg": (13.285, 52.517, 13.307, 52.531),
  "molecule_man_treptowers": (13.447, 52.488, 13.462, 52.502),
}


def bounds_payload(geometry: Any, properties: dict) -> dict:
  """Encode the finite geographic agreement with full coordinate precision."""
  return {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": properties,
        "geometry": mapping(transform(UNPROJECT, geometry)),
      }
    ],
  }


def build_bounds() -> tuple[dict, dict]:
  """Subtract every already delivered source area, not only the detailed core."""
  previous = unary_union(
    [
      exporter.load_projected_polygon(DATA / name)
      for name in ("bounds.geojson", "bounds-ring-v182.geojson")
    ]
  )
  lobes = unary_union([transform(PROJECT, box(*bounds)) for bounds in LOBES.values()])
  return (
    bounds_payload(
      lobes,
      {
        "revision": "v1.0.83",
        "lobesCrs84": LOBES,
        "scope": "Finite city blocks and mapped streets in the owner-requested south corridor and two landmark lobes",
        "preservation": "Subtract exact union of unchanged bounds.geojson and bounds-ring-v182.geojson",
      },
    ),
    bounds_payload(
      previous, {"scope": "Immutable prior delivered areas; subtraction input only"}
    ),
  )


def merge_manifest(previous: dict, supplement: dict) -> dict:
  """Append independent packets; retries cannot alter prior descriptors."""
  result = copy.deepcopy(previous)
  old = result.pop("cityCoverageV183", None)
  if old:
    insertion = next(
      i for i, c in enumerate(result["chunks"]) if c["id"].startswith(PREFIX)
    )
    result["chunks"] = [c for c in result["chunks"] if not c["id"].startswith(PREFIX)]
    retained = old["retainedFootprintCount"]
    # Later owner-approved areas follow this immutable v183 scope. Re-publishing
    # v183 must preserve them and the established descriptor ordering.
    result["chunks"][insertion:insertion] = supplement["chunks"]
    result["footprint"][retained : retained + len(supplement["footprint"])] = (
      supplement["footprint"]
    )
  else:
    retained = len(result["footprint"])
    result["chunks"].extend(supplement["chunks"])
    result["footprint"].extend(supplement["footprint"])
  result["bounds"] = [
    min(previous["bounds"][0], supplement["bounds"][0]),
    min(previous["bounds"][1], supplement["bounds"][1]),
    max(previous["bounds"][2], supplement["bounds"][2]),
    max(previous["bounds"][3], supplement["bounds"][3]),
  ]
  result["cityCoverageV183"] = {
    "retainedFootprintCount": retained,
    "chunkCount": len(supplement["chunks"]),
    "source": supplement["source"],
  }
  return result


def publish_prepared(supplement: dict) -> None:
  """Validate then append through the existing single serial loader manifest."""
  output = RAW / "packets"
  for chunk in supplement["chunks"]:
    for mode in ("drawn", "minecraft"):
      asset = chunk[mode]
      source = output / asset["url"]
      if hashlib.sha256(source.read_bytes()).hexdigest() != asset["sha256"]:
        raise ValueError(f"Prepared packet mismatch: {source}")
      shutil.copyfile(source, PUBLIC / asset["url"])
  inventory = supplement["source"]["inventory"]
  shutil.copyfile(output / "source-inventory.json.gz", PUBLIC / inventory["url"])
  path = PUBLIC / "manifest.json"
  previous = json.loads(path.read_bytes())
  merged = merge_manifest(previous, supplement)
  temporary = PUBLIC / "manifest-city183-prepared.json"
  exporter.write_json(temporary, merged)
  temporary.replace(path)


def build(*, publish: bool = False) -> dict:
  """Reuse exact retained OSM and available LoD2 without touching prior packets."""
  RAW.mkdir(parents=True, exist_ok=True)
  bounds, retained = build_bounds()
  bounds_path = DATA / "bounds-city-v183.geojson"
  retained_path = DATA / "bounds-retained-v182.geojson"
  exporter.write_json(bounds_path, bounds)
  exporter.write_json(retained_path, retained)
  for name in ("berlin-260929.osm.pbf", "candidate.gpkg"):
    link = RAW / name
    if not link.exists():
      link.symlink_to(DATA / "raw/outer-v159" / name)
  exporter.RAW = RAW
  output = RAW / "packets"
  original_payload = exporter.chunk_payload

  def polygonal_payload(chunk_id, tile, ground, buildings, surfaces, **kwargs):
    # Subtracting exact prior scopes may leave zero-area seam lines beside a
    # valid footprint. Retain every polygon and courtyard, never extrude lines.
    buildings = [
      {**building, "geometry": exporter.polygonal(building["geometry"])}
      for building in buildings
    ]
    return original_payload(chunk_id, tile, ground, buildings, surfaces, **kwargs)

  exporter.chunk_payload = polygonal_payload
  try:
    supplement = exporter.build(
      bounds_path=bounds_path,
      core_path=retained_path,
      pbf=RAW / "berlin-260929.osm.pbf",
      lod2_dir=DATA / "raw/lod2",
      output=output,
    )
  finally:
    exporter.chunk_payload = original_payload
  supplement["version"] = "1.0.83"
  supplement["source"]["policy"] = (
    "Finite Steglitz-Friedenau-Schoeneberg-Suedkreuz, Charlottenburg palace/Tegeler Weg and Molecule Man/Treptowers lobes, minus all prior city and ring coverage. "
    "Retained permitted OSM/LoD2 supplies every building and surface; source records and court holes remain. "
    "No synthetic buildings in parks, water or rail yards. Unknown heights/widths and flat y=3 are labelled estimates. "
    "Independent drawn/native packets join the existing serial loader; all prior packets are immutable."
  )
  for chunk in supplement["chunks"]:
    chunk["id"] = PREFIX + chunk["id"]
    for mode in ("drawn", "minecraft"):
      asset = chunk[mode]
      old_path = output / asset["url"]
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
      (output / asset["url"]).write_bytes(packed)
      old_path.unlink()
  supplement["source"]["inventory"]["url"] = PREFIX + "source-inventory.json.gz"
  exporter.write_json(DATA / "city-coverage-v183-manifest.json", supplement)
  exporter.write_json(
    ROOT / "src/app/src/data/cityCoverageScopeV183.json",
    {"groundY": exporter.GROUND_Y, "footprint": supplement["footprint"]},
  )
  if publish:
    publish_prepared(supplement)
  return supplement


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--publish", action="store_true")
  parser.add_argument("--publish-only", action="store_true")
  args = parser.parse_args()
  if args.publish_only:
    result = json.loads((DATA / "city-coverage-v183-manifest.json").read_bytes())
    publish_prepared(result)
  else:
    result = build(publish=args.publish)
  print(f"Added {len(result['chunks'])} finite city coverage packets")
