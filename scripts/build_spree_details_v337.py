"""Build small, source-bound Spree details in three retained stream tiles."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import subprocess
from pathlib import Path

import geopandas as gpd
from shapely.affinity import scale, translate
from shapely.geometry import Polygon, box, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.generation.road_geometry import road_width_m, road_width_source
from scripts.build_spree_bridges_v242 import append_model, components, extrusion, raster
from scripts.build_surrounding_outlines import PackedMesh, tags_for, world

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "spree-details-v337-source.json"
RECEIPT = GEO / "spree-details-v337-receipt.json"
PREVIOUS = "3d621f17"
BRICK = (144, 73, 54)
DARK_BRICK = (115, 61, 49)
SANDSTONE = (183, 150, 114)
TOWERS = (("373626457", "373626459"), ("373626462", "1547500040"))
TARGETS = {"9_3", "ring182-11_5", "ring182-12_5"}


def sha(data: bytes) -> str:
  return hashlib.sha256(data).hexdigest()


def json_bytes(value: dict) -> bytes:
  return (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


def original(path: Path) -> bytes:
  relative = path.relative_to(ROOT)
  return subprocess.check_output(["git", "show", f"{PREVIOUS}:{relative}"], cwd=ROOT)


def extract() -> dict:
  """Freeze exact mapped outlines, axis and the tagged tower heights."""
  cache = GEO / "raw/outskirts-v187/candidate.gpkg"
  ids = ["1488075245", "1448208864", *(i for pair in TOWERS for i in pair)]
  sql = ",".join(repr(i) for i in ids)
  features = {}
  for _, row in (
    gpd.read_file(cache, layer="lines", where=f"osm_id IN ({sql})")
    .to_crs(25833)
    .iterrows()
  ):
    tags = tags_for(row)
    identity = tags["osm_id"]
    geometry = world(row.geometry)
    if identity != "1448208864":
      assert geometry.is_ring
      geometry = Polygon(geometry)
    features[identity] = dict(id=identity, tags=tags, geometry=mapping(geometry))
  assert set(ids) == set(features)
  elsen = features["1488075245"]
  elsen["name"] = "Elsenbrücke – nordwestliches Teilbauwerk"
  # Berlin confirms the currently open three-lane northwest section is a steel
  # structure. The OSM outline's humpback tag stays in the retained evidence.
  elsen["sourceTags"] = elsen["tags"]
  elsen["tags"] = dict(elsen["tags"], **{"bridge:structure": "beam"})
  road = features["1448208864"]
  elsen["roads"] = [
    dict(
      road,
      width=road_width_m(road["tags"]),
      widthSource=road_width_source(road["tags"]),
    )
  ]
  with cache.open("rb") as data:
    source_hash = hashlib.file_digest(data, "sha256").hexdigest()
  return dict(
    schemaVersion=1,
    source="Retained Geofabrik Berlin 2026-09-29 / OpenStreetMap, ODbL-1.0",
    sourceSha256=source_hash,
    elsen=elsen,
    towers=[[features[i] for i in pair] for pair in TOWERS],
  )


def tower_crown(
  mesh: PackedMesh, tower: list, support, datum: float, native: bool
) -> None:
  """Fit brick drums and spires to measured plan evidence and tagged heights."""
  drum_source, spire_source = tower
  drum, spire = (shape(source["geometry"]) for source in tower)
  cap_y = datum + float(drum_source["tags"]["height"])
  tip_y = datum + float(spire_source["tags"]["height"])
  # Both retained bridge-tower podiums reach 20 m above the local datum.
  base_y = datum + 19.98

  def prism(plan, low: float, high: float, colour: tuple) -> None:
    if native:
      plan = raster(plan, 0.25)
    extrusion(mesh, plan.intersection(support), low, high, colour)

  prism(drum, base_y, cap_y, BRICK)
  prism(drum.buffer(0.15), base_y + 0.30, base_y + 0.53, SANDSTONE)
  prism(drum.buffer(0.22), cap_y - 0.56, cap_y - 0.29, DARK_BRICK)
  prism(drum.buffer(0.13), cap_y - 0.29, cap_y, SANDSTONE)

  # Recessed-looking slit faces on the brick drum, within its existing plan.
  # The tiny offset avoids coincident coplanar triangles.
  for edge in zip(drum.exterior.coords, list(drum.exterior.coords)[1:]):
    a, b = edge
    center = tuple((start + end) / 2 for start, end in zip(a, b))
    slit = box(center[0] - 0.11, center[1] - 0.11, center[0] + 0.11, center[1] + 0.11)
    prism(slit, base_y + 1.45, cap_y - 1.5, DARK_BRICK)

  if native:
    for step in range(16):
      factor = (16 - step) / 16
      height = (tip_y - cap_y) / 16
      prism(
        scale(spire, factor, factor, origin="centroid"),
        cap_y + step * height,
        cap_y + (step + 1) * height,
        DARK_BRICK if step % 5 == 0 else BRICK,
      )
  else:
    assert support.covers(spire)
    top = (spire.centroid.x, tip_y, spire.centroid.y)
    for a, b in zip(spire.exterior.coords, list(spire.exterior.coords)[1:]):
      mesh.triangle([(a[0], cap_y, a[1]), (b[0], cap_y, b[1]), top], DARK_BRICK)
  prism(
    box(
      spire.centroid.x - 0.10,
      spire.centroid.y - 0.10,
      spire.centroid.x + 0.10,
      spire.centroid.y + 0.10,
    ),
    tip_y - 0.15,
    tip_y + 0.52,
    SANDSTONE,
  )


def build(source: dict) -> tuple[dict, dict[Path, bytes], dict]:
  manifest = json.loads(original(PUBLIC / "manifest.json"))
  output, receipt = {}, {}
  covered_elsen = 0
  towers_seen = set()
  for family in ("drawn", "minecraft"):
    native = family == "minecraft"
    elsen = source["elsen"]
    profile = components(elsen, native)
    for tile in (tile for tile in manifest["chunks"] if tile["id"] in TARGETS):
      asset = tile[family]
      path = PUBLIC / asset["url"]
      wire = original(path)
      assert sha(wire) == asset["sha256"] and len(wire) == asset["bytes"]
      packet = json.loads(gzip.decompress(wire))
      ox, _, oz = packet["origin"]
      datum = packet["nav"]["groundY"]
      tile_bounds = box(*tile["bounds"])
      ground = unary_union(
        [
          translate(Polygon(p["ring"], p["holes"]), ox, oz)
          for p in packet["nav"]["ground"]
        ]
      ).intersection(tile_bounds)
      mesh = PackedMesh(ox, oz)
      added_floors, added_solids = [], []
      owners = []
      if tile["id"].startswith("ring182-"):
        support = ground.intersection(shape(elsen["geometry"]).buffer(0.6))
        if native:
          support = raster(support, 0.25, fully_inside=True)
        area = profile["outline"].intersection(support).area
        assert area > 0
        if not native:
          covered_elsen += area
        added_floors, added_solids = append_model(
          mesh, elsen, profile, support, datum, native
        )
        owners.append(elsen["id"])
      else:
        for tower in source["towers"]:
          drum = shape(tower[0]["geometry"])
          if not ground.covers(drum.buffer(0.25)):
            continue
          tower_crown(mesh, tower, ground, datum, native)
          owners.append(tower[0]["id"])
          towers_seen.add((family, tower[0]["id"]))
      added = mesh.payload("spree-details-v337")
      assert added and len(packet["meshes"]) < 16, (family, tile["id"], owners)
      packet["meshes"].append(added)
      if added_floors:
        nav = packet["nav"].setdefault("spreeBridgesV242", dict(floors=[], solids=[]))
        nav["floors"].extend(added_floors)
        nav["solids"].extend(added_solids)
      raw = json_bytes(packet)
      assert len(raw) <= 12 * 1024 * 1024
      new_wire = gzip.compress(raw, compresslevel=9, mtime=0)
      after = dict(
        asset, sha256=sha(new_wire), bytes=len(new_wire), decodedBytes=len(raw)
      )
      receipt[f"{family}:{tile['id']}"] = dict(
        before=asset.copy(),
        after=after,
        owners=owners,
        addedFloors=len(added_floors),
        addedSolids=len(added_solids),
      )
      tile[family] = after
      output[path] = new_wire
  assert len(output) == 6 and len(towers_seen) == 4
  assert abs(covered_elsen - shape(source["elsen"]["geometry"]).area) < 0.01
  return manifest, output, receipt


def publish(manifest: dict, output: dict[Path, bytes], receipt: dict) -> None:
  """Verify the pinned predecessor for every affected asset before writing."""
  manifest_path = PUBLIC / "manifest.json"
  assert json.loads(manifest_path.read_bytes()) in (
    manifest,
    json.loads(original(manifest_path)),
  )
  for entry in receipt.values():
    before, after = entry["before"], entry["after"]
    assert sha((PUBLIC / before["url"]).read_bytes()) in (
      before["sha256"],
      after["sha256"],
    )
  for path, value in {**output, manifest_path: json_bytes(manifest)}.items():
    temp = path.with_suffix(".v337-tmp")
    temp.write_bytes(value)
    temp.replace(path)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--refresh-source", action="store_true")
  parser.add_argument("--apply", action="store_true")
  args = parser.parse_args()
  if args.refresh_source:
    SOURCE.write_bytes(json_bytes(extract()))
  manifest, output, receipt = build(json.loads(SOURCE.read_bytes()))
  if args.apply:
    publish(manifest, output, receipt)
    RECEIPT.write_bytes(
      json_bytes(
        dict(previous=PREVIOUS, sourceSha256=sha(SOURCE.read_bytes()), packets=receipt)
      )
    )
  print(
    {
      key: value["after"]["bytes"] - value["before"]["bytes"]
      for key, value in receipt.items()
    }
  )
