"""Prove exact predecessor packet data before replaying older map revisions."""

from __future__ import annotations

import copy
import gzip
import json
from functools import lru_cache
from pathlib import Path

from scripts.build_spree_details_v337 import GEO, PUBLIC, original, sha


@lru_cache(maxsize=1)
def records() -> dict:
  bridge = json.loads((GEO / "spree-details-v337-receipt.json").read_bytes())["packets"]
  sports = json.loads((GEO / "sports-surfaces-receipt.json").read_bytes())
  assert not (bridge.keys() & sports.keys())
  return {
    key: dict(row, kind=kind)
    for receipt, kind in (
      (bridge, "spree-details-v337"),
      (sports, "mapped-sports-surfaces"),
    )
    for key, row in receipt.items()
  }


@lru_cache(maxsize=1)
def by_path() -> dict:
  return {row["after"]["url"]: row for row in records().values()}


def predecessor_packet_bytes_v337(path: Path, raw: bytes) -> bytes:
  """Restore only exact new wire data with a complete verified old complement."""
  if not path.resolve().is_relative_to(PUBLIC):
    return raw
  row = by_path().get(path.relative_to(PUBLIC).as_posix())
  if not row or sha(raw) != row["after"]["sha256"]:
    return raw
  before = original(path)
  assert (
    sha(before) == row["before"]["sha256"] and len(before) == row["before"]["bytes"]
  )
  expected = json.loads(gzip.decompress(before))
  packet = json.loads(gzip.decompress(raw))
  assert packet["meshes"].pop()["kind"] == row["kind"]
  if row.get("addedFloors"):
    nav = packet["nav"]["spreeBridgesV242"]
    del nav["floors"][-row["addedFloors"] :]
    if row["addedSolids"]:
      del nav["solids"][-row["addedSolids"] :]
    if "spreeBridgesV242" not in expected["nav"]:
      assert not nav["floors"] and not nav["solids"]
      del packet["nav"]["spreeBridgesV242"]
  assert packet == expected, path
  return before


def predecessor_manifest_v337(current: dict, reader=Path.read_bytes) -> dict:
  """Change only metadata associated with an independently verified packet."""
  forst = json.loads((GEO / "tegeler-forst-manifest-addition.json").read_bytes())
  forst_tiles = len(forst["chunks"])
  forst_polygons = len(forst["footprint"])
  if current["chunks"][-forst_tiles:] == forst["chunks"]:
    assert current["footprint"][-forst_polygons:] == forst["footprint"]
    assert (
      len(current["footprint"]) - forst_polygons > current["gardenFootprintStartV330"]
    )
    verify_addition(forst["chunks"], reader)
    current = copy.deepcopy(current)
    del current["chunks"][-forst_tiles:]
    del current["footprint"][-forst_polygons:]
  result = None
  rows = records()
  for index, chunk in enumerate(current["chunks"]):
    for family in ("drawn", "minecraft"):
      row = rows.get(f"{family}:{chunk['id']}")
      if not row or chunk[family] != row["after"]:
        continue
      path = PUBLIC / row["after"]["url"]
      assert (
        sha(predecessor_packet_bytes_v337(path, reader(path)))
        == row["before"]["sha256"]
      )
      if result is None:
        result = copy.deepcopy(current)
      result["chunks"][index][family] = row["before"]
  if result is None:
    result = current
  for name in ("tegeler-fliess", "jungfernheide-climbing"):
    addition = json.loads((GEO / f"{name}-manifest-addition.json").read_bytes())
    descriptors = addition["chunks"] if "chunks" in addition else [addition["chunk"]]
    count = len(descriptors)
    if result["chunks"][-count:] != descriptors:
      continue
    result = copy.deepcopy(result)
    del result["chunks"][-count:]
    end = result["gardenFootprintStartV330"]
    start = end - len(addition["footprint"])
    assert result["footprint"][start:end] == addition["footprint"]
    verify_addition(descriptors, reader)
    del result["footprint"][start:end]
    result["gardenFootprintStartV330"] = start
  return result


def verify_addition(descriptors: list[dict], reader) -> None:
  for descriptor in descriptors:
    for family in ("drawn", "minecraft"):
      asset = descriptor[family]
      wire = reader(PUBLIC / asset["url"])
      assert len(wire) == asset["bytes"] and sha(wire) == asset["sha256"]
