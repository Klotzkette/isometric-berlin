"""Step 10: bounded Mitte street sources and additive, isolated stream candidates."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import subprocess
from collections import Counter
from pathlib import Path
from typing import Any

import build_west_streets_v163 as streets
import geopandas as gpd
from build_karl_marx_allee_v161 import (
  Detail,
  mesh_signature,
  native_detail,
  packed_detail,
)
from build_surrounding_outlines import (
  DEFAULT_OUTPUT,
  POSITION_ORIGIN_Y,
  ROOT,
  navigation_polygons,
  world,
  write_json,
)
from pyproj import Transformer
from shapely.geometry import box, shape
from shapely.ops import transform, unary_union

SOURCE = ROOT / "geo_data/regierungsviertel/mitte-streets-v166.json"
AUDIT = ROOT / "geo_data/regierungsviertel/mitte-streets-v166-audit.json"
NAMES = (
  "Mulackstraße",
  "Alte Schönhauser Straße",
  "Linienstraße",
  "Auguststraße",
  "Ackerstraße",
  "Tucholskystraße",
  "Krausnickstraße",
  "Oranienburger Straße",
)
KIND = "mitte-street-fronts-v166"
ROOT_RESERVED = {
  "DEBE01YYK0000Dia",
  "DEBE01YYK00000AU",
  "DEBE01YYK0000D4G",
  "DEBE01YYK00005dG",
  "DEBE01YYK0000AZO",
  "DEBE01YYK00008VR",
  "DEBE01YYK0001y5z",
  "DEBE01YYK00000Al",
  "DEBE01YYK0001x7u",
  "DEBE01YYK0000Bd4",
  "DEBE01YYK00002XY",
}


def reserved_owners() -> set[str]:
  """Read actual runtime suppression and all authored source identity contracts."""
  code = 'import { PRISM_SUPPRESSED_IDS } from "./src/IsometricCityWorld.ts"; console.log(JSON.stringify([...PRISM_SUPPRESSED_IDS]));'
  result = subprocess.run(
    ["bun", "-e", code],
    cwd=ROOT / "src/app",
    check=True,
    capture_output=True,
    text=True,
  )
  ids = set(json.loads(result.stdout)) | ROOT_RESERVED

  def visit(value: Any) -> None:
    if isinstance(value, dict):
      for key, item in value.items():
        if key in {
          "id",
          "parentId",
          "parent_id",
          "parent_building_id",
          "sourceId",
          "source_id",
        } and isinstance(item, str):
          ids.add(item.strip())
        else:
          visit(item)
    elif isinstance(value, list):
      for item in value:
        visit(item)
    elif isinstance(value, str) and value.startswith(("DEBE", "OSM-way-")):
      ids.add(value.strip())

  for path in (ROOT / "src/app/src").rglob("*.json"):
    if "Source" in path.name or "Navigation" in path.name or "source" in path.name:
      visit(json.loads(path.read_text()))
  manifest = json.loads((DEFAULT_OUTPUT / "manifest.json").read_text())
  visit(manifest.get("source", {}))
  visit(
    json.loads(
      (ROOT / "geo_data/regierungsviertel/rosenthaler-platz-v163.json").read_text()
    )
  )
  # A previous streamed refinement may be registered only by its leaf nav,
  # rather than in an eagerly imported Source/Navigation file.
  for descriptor in manifest["chunks"]:
    packet = json.loads(
      gzip.decompress((DEFAULT_OUTPUT / descriptor["drawn"]["url"]).read_bytes())
    )
    for part in packet["nav"]["buildings"]:
      if part.get("partId"):
        ids.add(part["sourceId"].strip())
  # Older exact building renderers keep parent identities in TS profile files.
  import re

  for path in (ROOT / "src/app/src").glob("*Profile.ts"):
    ids.update(re.findall(r"DEBE[A-Za-z0-9]+", path.read_text()))
  return ids | {item[-8:] for item in ids if item.startswith("DEBE")}


def scoped_bounds() -> tuple[Any, Any]:
  """Stop Ackerstraße at the cemeteries; never follow names beyond this task."""
  bounds, core = ORIGINAL_BOUNDS()
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform
  scope = world(transform(project, box(13.383, 52.5195, 13.417, 52.5373)))
  return bounds.intersection(scope), core


ORIGINAL_BOUNDS = streets.read_bounds


def extract() -> dict[str, Any]:
  """Retain whole selected parent families and every unsuppressed core record."""
  streets.read_bounds = scoped_bounds
  source = streets.extract_source(NAMES)
  reserved = reserved_owners()
  source["buildings"] = [b for b in source["buildings"] if b["id"] not in reserved]
  source["corePrisms"] = [p for p in source["corePrisms"] if p["id"] not in reserved]
  source["excludedDetailedOwners"] = sorted(reserved)
  source["selection"] = (
    "Eight named mapped Mitte corridors clipped to longitude 13.383..13.417 and latitude 52.5195..52.5373, inside the approved release polygon. Ackerstraße ends at the cemetery area. Exact registered/authored source owners remain excluded from street-facade decoration."
  )
  source["references"] = [
    "https://www.openstreetmap.org/way/" + r["id"].removeprefix("OSM-way-")
    for r in source["roads"]
  ]
  source["publication"] = (
    "Candidate packets preserve all earlier meshes; centralized v166 publication must remove only these listed former coarse parent triangles before appending this mesh. Candidate navigation already replaces only those exact source identities with all official leaf parts."
  )
  return source


def digest(value: Any) -> str:
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def publish(output: Path, source: dict) -> dict:
  """Append bounded details without rebuilding or writing any published packet."""
  streets.read_bounds = scoped_bounds
  output.mkdir(parents=True, exist_ok=True)
  roads = unary_union([shape(r["geometry"]) for r in source["roads"]])
  owners = {b["id"] for b in source["buildings"]}
  buildings = gpd.read_file(
    streets.RAW / "resolved-outlines.gpkg", layer="buildings"
  ).to_dict("records")
  surfaces = {
    r["kind"]: r.geometry
    for _, r in gpd.read_file(
      streets.RAW / "resolved-outlines.gpkg", layer="surfaces"
    ).iterrows()
  }
  details = {"drawn": Detail(), "minecraft": Detail()}
  navigation, roles = [], Counter()
  for building in source["buildings"]:
    d, nav = streets.outer_detail(building, roads)
    details["drawn"].triangles.extend(d.triangles)
    details["minecraft"].triangles.extend(native_detail(d).triangles)
    navigation.extend(nav)
    roles.update(role for _, _, role in d.triangles)
  for record in source["corePrisms"]:
    d = streets.core_detail(record, roads)
    details["drawn"].triangles.extend(d.triangles)
    details["minecraft"].triangles.extend(native_detail(d).triangles)
    roles.update(role for _, _, role in d.triangles)
  metrics = {}
  for mode in details:
    d, metrics[mode] = streets.street_detail(
      source, surfaces, buildings, mode == "minecraft"
    )
    details[mode].triangles.extend(d.triangles)
  print(
    {
      "parents": len(owners),
      "corePrisms": len(source["corePrisms"]),
      "triangles": {m: len(d.triangles) for m, d in details.items()},
    },
    flush=True,
  )
  partitions = {m: streets.partition_detail(d) for m, d in details.items()}
  descriptors = {
    d["id"]: d
    for d in json.loads((DEFAULT_OUTPUT / "manifest.json").read_text())["chunks"]
  }
  patches, audits, preservation = [], [], {}
  for ix, iz in sorted(set(partitions["drawn"]) | set(partitions["minecraft"])):
    identity = f"{ix}_{iz}"
    tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
    entry = {"id": identity, "bounds": list(tile.bounds)}
    before = {}
    audit = {"id": identity, "modes": {}}
    for mode in details:
      descriptor = descriptors.get(identity)
      path = DEFAULT_OUTPUT / descriptor[mode]["url"] if descriptor else None
      payload = (
        json.loads(gzip.decompress(path.read_bytes()))
        if path
        else {
          "schemaVersion": 1,
          "id": identity,
          "origin": [ix * 512, POSITION_ORIGIN_Y, iz * 512],
          "meshes": [],
          "nav": {
            "ground": [],
            "water": [],
            "buildings": [],
            "roads": [],
            "bridges": [],
            "groundY": 3,
          },
        }
      )
      payload["meshes"] = [m for m in payload["meshes"] if m["kind"] != KIND]
      retained = mesh_signature(payload)
      before[mode] = {
        "meshes": digest(payload["meshes"]),
        "unownedNavigation": digest(
          {
            **payload["nav"],
            "buildings": [
              b for b in payload["nav"]["buildings"] if b["sourceId"] not in owners
            ],
          }
        ),
      }
      mesh = packed_detail(partitions[mode].get((ix, iz), Detail()), tile)
      if mesh:
        mesh["kind"] = KIND
        payload["meshes"].append(mesh)
      payload["nav"]["buildings"] = [
        b for b in payload["nav"]["buildings"] if b["sourceId"] not in owners
      ]
      for n in navigation:
        for p in navigation_polygons(
          n["geometry"].intersection(tile), *tile.bounds[:2]
        ):
          payload["nav"]["buildings"].append(
            {
              **p,
              **{k: v for k, v in n.items() if k != "geometry"},
              "height": math.ceil(n["height"] / 2) * 2 + 2
              if mode == "minecraft"
              else n["height"],
            }
          )
      assert not retained - mesh_signature(payload)
      assert before[mode]["unownedNavigation"] == digest(
        {
          **payload["nav"],
          "buildings": [
            b for b in payload["nav"]["buildings"] if b["sourceId"] not in owners
          ],
        }
      )
      raw = (
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n"
      ).encode()
      assert len(raw) < 12 * 1024 * 1024, (identity, mode, len(raw))
      packed = gzip.compress(raw, compresslevel=9, mtime=0)
      name = f"{identity}.{mode}.json.gz"
      (output / name).write_bytes(packed)
      entry[mode] = {
        "url": name,
        "encoding": "gzip",
        "bytes": len(packed),
        "decodedBytes": len(raw),
        "sha256": hashlib.sha256(packed).hexdigest(),
      }
      audit["modes"][mode] = {
        "retainedTriangles": sum(retained.values()),
        "addedTriangles": len(base64.b64decode(mesh["indices"])) // 12 if mesh else 0,
        "bytes": len(packed),
        "decodedBytes": len(raw),
      }
    preservation[identity] = before
    patches.append(entry)
    audits.append(audit)
    print(identity, entry["drawn"]["bytes"], entry["minecraft"]["bytes"], flush=True)
  write_json(
    output / "mitte-streets-manifest-patch.json",
    {
      "chunks": patches,
      "source": {
        "mitteStreetsV166": {
          "version": "1.0.66",
          "sourceIds": sorted(owners),
          "sourceEvidence": str(SOURCE.relative_to(ROOT)),
          "streets": list(NAMES),
          "policy": source["publication"],
        }
      },
    },
  )
  write_json(
    ROOT / "geo_data/regierungsviertel/mitte-streets-v166-preservation.json",
    preservation,
  )
  result = {
    "sourceParents": len(owners),
    "sourceParts": sum(len(b["parts"]) for b in source["buildings"]),
    "corePrisms": len(source["corePrisms"]),
    "streetMetrics": metrics,
    "roles": dict(roles),
    "chunks": audits,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
  }
  write_json(AUDIT, result)
  return result


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out", type=Path, default=Path("/tmp/v166-mitte-streets"))
  parser.add_argument("--refresh-source", action="store_true")
  args = parser.parse_args()
  if args.refresh_source or not SOURCE.exists():
    write_json(SOURCE, extract())
  result = publish(args.out, json.loads(SOURCE.read_text()))
  print(json.dumps(result))


if __name__ == "__main__":
  main()
