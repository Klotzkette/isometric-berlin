"""Reconstruct 30 registered Berlin monuments from current survey roofs and walls."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import build_surveyed_building_shells_v377 as shell
from build_surveyed_facades_v377 import add_split_packet_receipts, compile_catalog
from build_surveyed_shell_retirements_v377 import select_tile
from historic_architecture_voxels_v378 import create_native

from scripts.build_building_facade_profiles_v377 import build as building_profiles
from scripts.build_windowless_buildings_v377 import tile_descriptors

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def load(path):
  with (gzip.open if path.suffix == ".gz" else open)(
    path, "rt", encoding="utf-8"
  ) as source:
    return json.load(source)


def write(path, data):
  path.parent.mkdir(parents=True, exist_ok=True)
  raw = (
    json.dumps(data, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n"
  ).encode()
  path.write_bytes(
    gzip.compress(raw, compresslevel=9, mtime=0) if path.suffix == ".gz" else raw
  )


def local_facades(catalog, tile, mode):
  key = mode + ":" + tile
  groups = catalog["tiles"].get(key, [])
  indices = sorted({face[-1] for owner in groups for face in owner["faces"]})
  lookup = {value: index for index, value in enumerate(indices)}
  return {
    "profiles": [catalog["profiles"][i] for i in indices],
    "tiles": {
      key: [
        {**owner, "faces": [[*f[:-1], lookup[f[-1]]] for f in owner["faces"]]}
        for owner in groups
      ]
    },
    "splitPackets": {key: catalog["splitPackets"][key]}
    if key in catalog.get("splitPackets", {})
    else {},
  }


def generate(archives, output=DATA, evidence_dir=GEO):
  rank = load(evidence_dir / "historicArchitectureV378Ranking.json.gz")
  evidence = load(evidence_dir / "historicArchitectureV378Evidence.json.gz")
  landmarks = {r["id"]: r for r in evidence["landmarks"]}
  if len(landmarks) != 30 or set(landmarks) != {r["id"] for r in rank["targets"]}:
    raise ValueError("The scope requires thirty unique registered buildings")
  sites, receipts, walls, retirement = [], {}, {}, {}
  native_shells, native_retirement = {}, {}
  for target in rank["targets"]:
    owner = target["id"]
    info = landmarks[owner]
    archive = archives / ("LoD2_" + info["catalogueTile"] + ".zip")
    if hashlib.sha256(archive.read_bytes()).hexdigest() != info["cityGMLSha256"]:
      raise ValueError(f"Unexpected official source archive for {owner}")
    base, surfaces = shell.read_surfaces(archive, info["sourceBuilding"])
    domains = shell.tile_domains(target["tiles"], owner, tile_descriptors())
    sites.append((owner, (211, 208, 195), domains, surfaces))
    walls[owner] = [
      w
      for surface in surfaces
      for w in shell.wall_segments(domains, owner, base, surface)
    ]
    receipts[owner] = {
      "name": info["name"],
      "sourceBuilding": info["sourceBuilding"],
      "sourceSha256": info["cityGMLSha256"],
    }
    for tile in domains:
      if tile in retirement:
        raise ValueError(f"Multiple retirement owners in {tile}")
      retirement[tile], _ = select_tile(tile, owner)
    # Each exception shares an original raster wall with another building.
    # Keep both native owners there and use their measured facade fields.
    if owner not in {"DEBE04AL2UE0002g", "DEBE03YY600001Ql"}:
      for tile in domains:
        native_retirement[tile], _ = select_tile(tile, owner, "minecraft")
      native, segments, count = create_native(
        owner, surfaces, evidence["surfaceColours"][owner], domains, walls[owner]
      )
      native_shells.update({tile: [body] for tile, body in native.items()})
      target["segments"] = [
        s for s in target["segments"] if s["family"] == "drawn"
      ] + segments
      receipts[owner]["nativeCells2m"] = count

  with TemporaryDirectory() as directory:
    temp = Path(directory)
    shell.build_meshes(
      sites,
      receipts,
      surface_colours=evidence["surfaceColours"],
      output=temp / "shells.json",
      receipt_path=temp / "receipt.json",
    )
    shells = load(temp / "shells.json")["tiles"]
  surveys = {"targets": {owner: {"entrances": []} for owner in landmarks}}
  profiles, _ = building_profiles(rank, surveys, evidence["photos"], {})
  catalog = compile_catalog(rank, profiles, walls)
  add_split_packet_receipts(catalog, shell.TILES)
  chunks = sorted(set(shells) | {key.split(":", 1)[1] for key in catalog["tiles"]})
  index = {"drawn": [], "minecraft": []}
  for tile in chunks:
    for mode in ["drawn", "minecraft"]:
      profile = local_facades(catalog, tile, mode)
      packet = {"facades": profile}
      if mode == "drawn" and tile in shells:
        packet["shells"] = {"tiles": {tile: shells[tile]}}
        packet["retirements"] = {"packets": {tile: retirement[tile]}}
      elif mode == "minecraft" and tile in native_shells:
        packet["shells"] = {"tiles": {tile: native_shells[tile]}}
        packet["retirements"] = {"packets": {tile: native_retirement[tile]}}
      elif not profile["profiles"]:
        continue
      index[mode].append(tile)
      write(output / "historicArchitectureV378Tiles" / f"{mode}_{tile}.json", packet)
  write(output / "historicArchitectureV378Index.json", index)
  write(evidence_dir / "historicArchitectureV378Receipts.json.gz", receipts)


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--archives",
    type=Path,
    required=True,
    help="Directory of the Geoportal LoD2 ZIPs recorded in the evidence",
  )
  generate(parser.parse_args().archives)
