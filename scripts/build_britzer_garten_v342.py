"""Stage finite Britzer Garten streamed ground and details without modifying old assets."""

from __future__ import annotations

import argparse
import hashlib
import math
from functools import partial
from pathlib import Path

from shapely.geometry import box, shape
from shapely.ops import unary_union

from scripts.britzer_garten_geometry_v342 import park_details
from scripts.build_marzahn_gardens_v330 import (
  disjoint_materials,
  geometry_tiles,
  navigation_polygons,
  packed_item,
  packet,
  packets_for,
  surface_sources,
  write,
)
from scripts.marzahn_garden_terrain_v330 import (
  load_terrain,
  native_domain,
  terrain_height,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/britzer-garten-v342-source.json.gz"


def build(output):
  source = load_terrain(SOURCE)
  scope = shape(source["scope"])
  tiles = {}
  accounts = {}
  records = [
    r
    for r in source["osm"]["records"]
    if r["layer"] != "points" or r["tags"].get("natural") == "tree"
  ]
  layers, roads, _ = surface_sources(records, scope)
  layers["water"] = shape(source["water"])
  for native in (False, True):
    family = "minecraft" if native else "drawn"
    at = partial(terrain_height, source, native=native)
    tri, solids, floors, barriers, account, roof_nav = park_details(
      source, at, native, roads
    )
    accounts[family] = account
    by_tile = geometry_tiles(tri)
    display = native_domain(scope) if native else scope
    navscope = (
      unary_union([shape(source["nativeLand"]), shape(source["nativeWater"])])
      if native
      else scope
    )
    water = shape(source["nativeWater"]) if native else layers["water"]
    materials = disjoint_materials({**layers, "water": water}, display, native)
    minx, minz, maxx, maxz = display.bounds
    for ix in range(math.floor(minx / 512), math.ceil(maxx / 512)):
      for iz in range(math.floor(minz / 512), math.ceil(maxz / 512)):
        bounds = [ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512]
        if display.intersection(box(*bounds)).area < 0.01:
          continue
        item = packet(
          source,
          display,
          navscope,
          materials,
          water,
          roads,
          by_tile.get((ix, iz), []),
          solids,
          [],
          floors,
          barriers,
          at,
          (ix, iz),
          native,
        )
        # Existing compact roof navigation retains every independent cap without
        # repeating its entire building identity and outer ring per cell.
        for body in item[0]["nav"]["buildings"]:
          roof = roof_nav.get(body["sourceId"])
          if not roof:
            continue
          if native:
            body["nativeRoofCaps"] = [
              [x0 - bounds[0], z0 - bounds[1], x1 - bounds[0], z1 - bounds[1], h]
              for x0, z0, x1, z1, h in roof["nativeRoofCaps"]
              if x1 >= bounds[0]
              and x0 <= bounds[2]
              and z1 >= bounds[1]
              and z0 <= bounds[3]
            ]
            body["height"] = max(cap[4] for cap in body["nativeRoofCaps"])
          else:
            body["roofTriangles"] = [
              [[x - bounds[0], h, z - bounds[1]] for x, h, z in triangle]
              for triangle in roof["roofTriangles"]
            ]
        name = f"britzer342-{ix}_{iz}"
        descriptor = tiles.setdefault(
          (ix, iz), {"id": name, "bounds": bounds, "origin": item[0]["origin"]}
        )
        descriptor[family] = packets_for(*item)
        print(f"{name} {family}: {len(descriptor[family])} parts", flush=True)
  emitted = []
  output.mkdir(parents=True, exist_ok=True)
  for tile in tiles.values():
    for i in range(max(len(tile.get(f, ())) for f in ("drawn", "minecraft"))):
      name = tile["id"] if i == 0 else f"{tile['id']}-p{i}"
      descriptor = {"id": name, "bounds": tile["bounds"]}
      if i:
        descriptor["detailCompanionOf"] = tile["id"]
      for family in ("drawn", "minecraft"):
        if i < len(tile.get(family, ())):
          raw, packed = tile[family][i]
        else:
          raw, packed = packed_item(
            {
              "schemaVersion": 1,
              "origin": tile["origin"],
              "nav": {"ground": [], "water": [], "buildings": [], "groundY": 3},
            },
            [],
          )
        filename = f"{name}.{family}.json.gz"
        (output / filename).write_bytes(packed)
        descriptor[family] = {
          "url": filename,
          "bytes": len(packed),
          "encoding": "gzip",
          "decodedBytes": len(raw),
          "sha256": hashlib.sha256(packed).hexdigest(),
        }
      emitted.append(descriptor)
  delta = {
    "schemaVersion": 1,
    "baseline": source["baseline"],
    "chunks": emitted,
    "footprint": navigation_polygons(scope, 0, 0),
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "scopeM2": scope.area,
    "scopeBounds": list(scope.bounds),
    "terrainTileIds": [r["id"] for r in emitted if "detailCompanionOf" not in r],
    "stats": accounts,
  }
  write(output / "britzer-garten-v342-delta.json", delta)
  proof = {
    "sourceSha256": delta["sourceSha256"],
    "scopeM2": scope.area,
    "oldOverlapM2": source["sources"]["retained"]["areaM2"],
    "baseTiles": len(tiles),
    "descriptors": len(emitted),
    "packetBytes": sum(r[f]["bytes"] for r in emitted for f in ("drawn", "minecraft")),
    "maxPacketBytes": max(
      r[f]["bytes"] for r in emitted for f in ("drawn", "minecraft")
    ),
    "maxDecodedBytes": max(
      r[f]["decodedBytes"] for r in emitted for f in ("drawn", "minecraft")
    ),
    "stats": accounts,
  }
  write(output / "britzer-garten-v342-proof.json", proof)
  print(proof, flush=True)
  return delta


if __name__ == "__main__":
  p = argparse.ArgumentParser(description=__doc__)
  p.add_argument("--out", type=Path, required=True)
  build(p.parse_args().out)
