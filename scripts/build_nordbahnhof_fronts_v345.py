"""Replay four measured Nordbahnhof elevations against their actual resident hosts."""

from __future__ import annotations

import argparse
import base64
import math

import numpy as np
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

from scripts import build_cluster_facades_v320 as f

SOURCE = f.GEO / "nordbahnhof-fronts-v345-source.json"
DEST = f.DATA / "nordbahnhofFrontsV345.json"


def build() -> dict:
  source = f.read(SOURCE)
  packet_sets = {
    mode: {
      f.read(path)["id"]: f.read(path) for path in (f.DATA / directory).glob("*.json")
    }
    for mode, directory in [(False, "altMitteV169Drawn"), (True, "altMitteV169Native")]
  }
  for site in source["buildings"]:
    archive = f.read(f.ROOT / site["source"])
    building = next(row for row in archive["buildings"] if row["id"] == site["owner"])
    footprint = unary_union(
      [
        Polygon(p["ring"], p["holes"])
        for part in building["parts"]
        for p in part["footprintPolygons"]
      ]
    )
    mapped = shape(site["osm"]["geometry"])
    overlap = footprint.intersection(mapped).area / footprint.union(mapped).area
    if overlap < 0.97 or not math.isclose(overlap, site["iou"], abs_tol=1e-10):
      raise ValueError("Retained ordinary source footprint changed")
    if (
      f'"building:levels"=>"{site["levels"]}"'
      not in site["osm"]["properties"]["other_tags"]
    ):
      raise ValueError("Mapped residential storey evidence changed")
    for face in site["fronts"]:
      surface = next(
        s
        for part in building["parts"]
        for s in part["surfaces"]
        if s["sourcePolygonId"] == face["sourcePolygonId"]
      )
      if surface["kind"] != "WallSurface":
        raise ValueError("Selected source surface is no longer a wall")
      for native, key in [(False, "drawnReceipts"), (True, "nativeReceipts")]:
        if not face[key]:
          raise ValueError("Actual host required in both modes")
        for receipt in face[key]:
          packet = packet_sets[native][receipt["packetId"]]
          mesh = packet["meshes"][0]
          positions = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(
            -1, 3
          )
          indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4")
          if receipt["origin"] != packet["origin"]:
            raise ValueError("Host moved")
          for triangle in receipt["triangles"]:
            ids = indices[triangle["offset"] : triangle["offset"] + 3]
            if positions[ids].flatten().tolist() != triangle["positions"]:
              raise ValueError("Actual source triangles changed")
  return {
    "schemaVersion": 1,
    "buildings": [
      {key: site[key] for key in ("owner", "name", "area", "levels", "wall", "fronts")}
      for site in source["buildings"]
    ],
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--check", action="store_true")
  options = parser.parse_args()
  result = build()
  if options.check:
    if result != f.read(DEST):
      raise ValueError("Resident-front data differs from source replay")
  else:
    f.write(DEST, result)
  print(f"Verified {len(result['buildings'])} source-bound elevations")
