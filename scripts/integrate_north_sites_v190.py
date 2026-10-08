"""Step 10: stage exact coarse-owner subtraction, preserving every other triangle."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json

import geopandas as gpd
from build_karl_marx_allee_v161 import mesh_signature
from build_surrounding_outlines import (
  DEFAULT_OUTPUT,
  ROOT,
  chunk_payload,
  load_projected_polygon,
  world,
)
from integrate_city_refinements_v166 import (
  line_signature,
  subtract_lines,
  subtract_meshes,
)
from shapely.geometry import box, shape
from shapely.ops import unary_union

DATA = ROOT / "geo_data/regierungsviertel"
STAGED = DATA / "raw/north-sites-v190/packets"


def integrate() -> dict:
  """Prove exact colour/position multisets before staging any file for publication."""
  source = json.loads((DATA / "north-sites-v190-source.json").read_text())
  owners = {
    b["id"]
    for b in source["buildings"]
    if b["replaceOwner"] and b["kind"] != "weissensee-hall"
  }
  bounds = unary_union(
    [shape(b["footprint"]) for b in source["buildings"] if b["id"] in owners]
  ).bounds
  rows = gpd.read_file(
    DATA / "raw/outer-v159/resolved-outlines.gpkg", layer="buildings", bbox=bounds
  )
  selected = rows[rows.sourceId.isin(owners)].to_dict("records")
  assert {b["sourceId"] for b in selected} == owners
  scope = world(
    load_projected_polygon(DATA / "bounds.geojson").difference(
      load_projected_polygon(DATA / "bounds-v158.geojson")
    )
  )
  manifest = json.loads((DEFAULT_OUTPUT / "manifest.json").read_text())
  patch = []
  audit = []
  staged = {}
  covered = set()
  for entry in manifest["chunks"]:
    tile = box(*entry["bounds"])
    owned = [b for b in selected if b["geometry"].intersects(tile)]
    if not owned:
      continue
    updated = copy.deepcopy(entry)
    report = {"id": entry["id"], "modes": {}}
    for mode in ["drawn", "minecraft"]:
      path = DEFAULT_OUTPUT / entry[mode]["url"]
      original = json.loads(gzip.decompress(path.read_bytes()))
      ids = {b["sourceId"] for b in original["nav"]["buildings"]} & owners
      if not ids:
        continue
      selected_here = [b for b in owned if b["sourceId"] in ids]
      ground = scope.intersection(tile)
      baseline = chunk_payload(
        entry["id"], tile, ground, selected_here, {}, minecraft=mode == "minecraft"
      )
      empty = chunk_payload(
        entry["id"], tile, ground, [], {}, minecraft=mode == "minecraft"
      )
      remove = mesh_signature(baseline) - mesh_signature(empty)
      before = mesh_signature(original)
      assert not remove - before, (
        f"Source triangle signature differs: {entry['id']} {mode} ({sum((remove - before).values())})"
      )
      payload = copy.deepcopy(original)
      payload["meshes"] = subtract_meshes(payload["meshes"], remove.copy())
      removed_ink = 0
      if mode == "drawn" and "lines" in original:
        ink = line_signature(baseline["lines"]) - line_signature(empty["lines"])
        payload["lines"] = subtract_lines(payload["lines"], ink.copy())
        removed_ink = sum(ink.values())
      # Collision preserves the real footprint; generic max-height nav remains
      # the same conservative boundary as before, avoiding unrelated changes.
      assert payload["nav"] == original["nav"]
      assert mesh_signature(payload) == before - remove
      raw = (
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n"
      ).encode()
      packed = gzip.compress(raw, mtime=0)
      staged[STAGED / entry[mode]["url"]] = packed
      updated[mode] = {
        **entry[mode],
        "bytes": len(packed),
        "decodedBytes": len(raw),
        "sha256": hashlib.sha256(packed).hexdigest(),
      }
      report["modes"][mode] = {
        "sourceIds": sorted(ids),
        "oldSha256": entry[mode]["sha256"],
        "newSha256": updated[mode]["sha256"],
        "removedOwnerTriangles": sum(remove.values()),
        "preservedTriangles": sum((before - remove).values()),
        "removedOwnerInkSegments": removed_ink,
        "allNavigationUnchanged": True,
        "unrelatedGeometryPreserved": True,
      }
      covered |= ids
    if report["modes"]:
      patch.append(updated)
      audit.append(report)
  assert covered == owners, f"Missing existing owners: {owners - covered}"
  for path, data in staged.items():
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
  result = {
    "schemaVersion": 1,
    "sourceIds": sorted(owners),
    "chunks": audit,
    "allNavigationUnchanged": True,
    "unrelatedGeometryPreserved": True,
    "policy": "Only exact current coarse-owner triangle/ink multisets are substituted; all original source and v185 accents retained. No other payload or ground rebuilt.",
  }
  (DATA / "north-sites-v190-ownership-audit.json").write_text(
    json.dumps(result, indent=2) + "\n"
  )
  (DATA / "north-sites-v190-manifest-patch.json").write_text(
    json.dumps({"chunks": patch}, indent=2) + "\n"
  )
  return result


if __name__ == "__main__":
  result = integrate()
  print(
    "Staged",
    len(result["chunks"]),
    "packets for",
    len(result["sourceIds"]),
    "exact source owners",
  )
