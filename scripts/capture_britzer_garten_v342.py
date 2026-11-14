"""Retain only the mapped Britzer Garten and official terrain/building source clips."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

import pyogrio
import requests
import shapely
from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union

import scripts.marzahn_garden_terrain_v330 as terrain
from scripts.build_surrounding_outlines import source_identity, tags_for, world
from scripts.capture_marzahn_gardens_v330 import official_buildings
from scripts.marzahn_garden_terrain_v330 import (
  native_domain,
  old_complement,
  sample_grid,
  tile_ids,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/britzer-v342"
SOURCE = GEO / "britzer-garten-v342-source.json.gz"
PARK_IDS = {"00008100:000a6b88", "00008100:0012db81"}
BASELINE = "5566e5db"


def sha(p):
  with Path(p).open("rb") as f:
    return hashlib.file_digest(f, "sha256").hexdigest()


def download(name, directory):
  matches = list((GEO / "raw").rglob(name))
  if matches:
    return matches[0]
  target = RAW / name
  url = f"https://gdi.berlin.de/data/{directory}/atom/{name}"
  with requests.get(url, stream=True, timeout=90) as r:
    r.raise_for_status()
    with target.open("wb") as f:
      for chunk in r.iter_content(1024 * 1024):
        f.write(chunk)
  print("retained", name, target.stat().st_size, flush=True)
  return target


def capture():
  RAW.mkdir(exist_ok=True)
  gris = GEO / "raw/public-green-v329/gruenanlagen.gpkg"
  parks = pyogrio.read_dataframe(
    gris, where="pitid IN (" + ",".join(repr(s) for s in sorted(PARK_IDS)) + ")"
  )
  assert set(parks.pitid) == PARK_IDS
  records = [
    {"id": r.pitid, "name": r.namenr, "geometry": mapping(world(r.geometry))}
    for r in parks.itertuples()
  ]
  full = shapely.make_valid(unary_union([shape(r["geometry"]) for r in records]))
  # Existing exact owner subtraction; sources remain immutable and old packets untouched.
  terrain.BASELINE = BASELINE
  old, receipts, manifest_pin = old_complement(full)
  scope = full.difference(old)
  print("domain", scope.area, scope.bounds, "retained", old.area, flush=True)
  pbf = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
  rows = []
  for layer in ("lines", "multipolygons", "points"):
    frame = pyogrio.read_dataframe(
      pbf, layer=layer, bbox=(13.38, 52.42, 13.45, 52.45)
    ).to_crs(25833)
    for _, row in frame.iterrows():
      g = world(row.geometry)
      if not g.intersects(full):
        continue
      tags = tags_for(row)
      if tags.get("boundary") or tags.get("admin_level"):
        continue
      if layer == "points" and not any(
        tags.get(k)
        for k in (
          "natural",
          "amenity",
          "tourism",
          "railway",
          "barrier",
          "man_made",
          "leisure",
        )
      ):
        continue
      ident = (
        ("node/" if layer == "points" else "way/") + row["osm_id"]
        if layer != "multipolygons"
        else source_identity(row)
        .replace("OSM-way-", "way/")
        .replace("OSM-relation-", "relation/")
      )
      tags = {
        k: v for k, v in tags.items() if k not in ("osm_id", "osm_way_id", "other_tags")
      }
      rows.append({"id": ident, "layer": layer, "tags": tags, "geometry": mapping(g)})
    print("osm", layer, len(rows), flush=True)
  water = unary_union(
    [
      shape(r["geometry"])
      for r in rows
      if r["layer"] == "multipolygons" and r["tags"].get("natural") == "water"
    ]
  ).intersection(scope)
  land = scope.difference(water)
  x0, z0, x1, z1 = full.bounds
  archives = []
  for e in range(
    math.floor((x0 + 389500) / 1000), math.floor((x1 + 389500) / 1000) + 1
  ):
    for n in range(
      math.floor((5820000 - z1) / 1000), math.floor((5820000 - z0) / 1000) + 1
    ):
      if not box(
        e * 1000 - 389500,
        5820000 - (n + 1) * 1000,
        (e + 1) * 1000 - 389500,
        5820000 - n * 1000,
      ).intersects(full):
        continue
      archives.append(download(f"LoD2_{e}_{n}.zip", "a_lod2"))
  buildings, lod_receipts = official_buildings(archives, scope)
  print("official", len(buildings), flush=True)
  # The 4m terrain vertices and independent cardinal cell centres use the same
  # audited DGM1 interpolation as V330. Only new named-site archives are fetched.
  for e in range(
    math.floor((x0 + 389498) / 2000) * 2, math.floor((x1 + 389502) / 2000) * 2 + 1, 2
  ):
    for n in range(
      math.floor((5819998 - z1) / 2000) * 2,
      math.floor((5820002 - z0) / 2000) * 2 + 1,
      2,
    ):
      p = download(f"DGM1_{e}_{n}.zip", "dgm1")
      link = RAW / p.name
      if not link.exists():
        link.symlink_to(p)
  terrain.RAW = RAW
  grid, dgm = sample_grid(scope)
  print(
    "DGM",
    grid["cols"],
    grid["rows"],
    min(grid["heightsCm"]),
    max(grid["heightsCm"]),
    flush=True,
  )
  # Lake levels are measured by DGM; water remains nonwalkable. Four-metre
  # grid is retained whole so geometry and public floor sample match exactly.
  result = {
    "schemaVersion": 1,
    "baseline": BASELINE,
    "scope": mapping(scope),
    "land": mapping(land),
    "water": mapping(water),
    "nativeLand": mapping(native_domain(land)),
    "nativeWater": mapping(native_domain(water)),
    "nativeDomainStepM": 1,
    "grid": grid,
    "tileIds": tile_ids(scope),
    "datum": {
      "source": "DHHN2016",
      "offsetM": -30,
      "surfaceLiftM": 0.1,
      "drawingDiagonal": "NW-SE",
    },
    "osm": {
      "records": rows,
      "sha256": sha(pbf),
      "source": "Geofabrik Berlin 2026-09-29, © OpenStreetMap contributors, ODbL 1.0",
    },
    "lod2": {"buildings": buildings, "sources": lod_receipts},
    "sources": {
      "gris": {"sha256": sha(gris), "parks": records},
      "dgm": dgm,
      "retained": {
        "manifestSha256": manifest_pin,
        "areaM2": old.area,
        "packets": receipts,
      },
    },
  }
  SOURCE.write_bytes(
    gzip.compress(
      (
        json.dumps(result, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        + "\n"
      ).encode(),
      mtime=0,
    )
  )
  print("source", SOURCE.stat().st_size, "tiles", result["tileIds"], flush=True)


if __name__ == "__main__":
  capture()
