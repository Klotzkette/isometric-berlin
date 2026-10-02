"""Step 10: exact owner subtraction and additive v167 street packet integration.

Never regenerate a whole packet from its old coarse baseline: prior releases may
already have added or refined other geometry in the same 512m cell.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

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
from shapely.geometry import box


def integrate(streets_dir: Path, apply: bool = False) -> dict[str, Any]:
  """Prepare all packets with exact geometry and source-nav preservation audit."""
  candidate = Path("/tmp/v167-integrated-packets")
  candidate.mkdir(exist_ok=True)

  def original_blob(path: Path) -> bytes:
    return subprocess.check_output(
      ["git", "show", f"v1.0.66:{path.relative_to(ROOT).as_posix()}"], cwd=ROOT
    )

  manifest = json.loads(original_blob(DEFAULT_OUTPUT / "manifest.json"))
  street_patch = json.loads(
    (streets_dir / "oranien-corridors-manifest-patch.json").read_text()
  )
  street_source = json.loads(
    (ROOT / "geo_data/regierungsviertel/oranien-corridors-v167.json").read_text()
  )
  owners = {b["id"] for b in street_source["buildings"]} | set(
    street_source["extraMovedOuterSourceIds"]
  )
  facade_plan = json.loads(
    (streets_dir / "tacheles-v166-facade-removal.json").read_text()
  )
  facade_chunks = {p["id"]: p for p in facade_plan["chunks"]}
  scope = world(
    load_projected_polygon(
      ROOT / "geo_data/regierungsviertel/bounds.geojson"
    ).difference(
      load_projected_polygon(ROOT / "geo_data/regierungsviertel/bounds-v158.geojson")
    )
  )
  rows = gpd.read_file(
    ROOT / "geo_data/regierungsviertel/raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
  ).to_dict("records")
  selected = [b for b in rows if b["sourceId"] in owners]
  assert {b["sourceId"] for b in selected} == owners
  patches = {p["id"]: p for p in street_patch["chunks"]}
  original_chunk_ids = {d["id"] for d in manifest["chunks"]}
  manifest["chunks"].extend(
    p for p in patches.values() if p["id"] not in original_chunk_ids
  )
  street_owners = owners
  audit = []
  for d in manifest["chunks"]:
    tile = box(*d["bounds"])
    owned = [b for b in selected if b["geometry"].intersects(tile)]
    if not owned and d["id"] not in patches and d["id"] not in facade_chunks:
      continue
    entry = {
      "id": d["id"],
      "sourceIds": sorted(b["sourceId"] for b in owned),
      "modes": {},
    }
    for mode in ["drawn", "minecraft"]:
      original = (
        json.loads(gzip.decompress(original_blob(DEFAULT_OUTPUT / d[mode]["url"])))
        if d["id"] in original_chunk_ids
        else {
          "schemaVersion": 1,
          "id": d["id"],
          "origin": [d["bounds"][0], -10, d["bounds"][1]],
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
      payload = json.loads(json.dumps(original))
      ground = scope.intersection(tile)
      baseline = chunk_payload(
        d["id"], tile, ground, owned, {}, minecraft=mode == "minecraft"
      )
      empty = chunk_payload(
        d["id"], tile, ground, [], {}, minecraft=mode == "minecraft"
      )
      remove = mesh_signature(baseline) - mesh_signature(empty)
      before = mesh_signature(original)
      assert not remove - before, f"Owner already absent {d['id']} {mode}"
      payload["meshes"] = subtract_meshes(payload["meshes"], remove.copy())
      facade_remove = mesh_signature({"meshes": []})
      if d["id"] in facade_chunks:
        facade_mesh = facade_chunks[d["id"]]["modes"][mode]
        if facade_mesh:
          facade_remove = mesh_signature({"meshes": [facade_mesh]})
          kind = facade_plan["sourceMeshKind"]
          selected_meshes = [
            {**m, "kind": "city"} for m in payload["meshes"] if m["kind"] == kind
          ]
          retained = subtract_meshes(selected_meshes, facade_remove.copy())
          payload["meshes"] = [m for m in payload["meshes"] if m["kind"] != kind] + [
            {**m, "kind": kind} for m in retained
          ]
      if mode == "drawn" and "lines" in original:
        lines = line_signature(baseline["lines"]) - line_signature(empty["lines"])
        payload["lines"] = subtract_lines(payload["lines"], lines.copy())
      payload["nav"]["buildings"] = [
        b for b in payload["nav"]["buildings"] if b["sourceId"] not in owners
      ]
      added = {"meshes": []}
      if d["id"] in patches:
        staged = json.loads(
          gzip.decompress((streets_dir / patches[d["id"]][mode]["url"]).read_bytes())
        )
        added["meshes"] = [
          m for m in staged["meshes"] if m["kind"] == "oranien-corridors-v167"
        ]
        payload["meshes"].extend(added["meshes"])
        # Agent stage preserves old rows too: append only new refined leaf owners.
        payload["nav"]["buildings"].extend(
          b
          for b in staged["nav"]["buildings"]
          if b["sourceId"] in street_owners and "partId" in b
        )
        assert all(
          b in payload["nav"]["buildings"]
          for b in staged["nav"]["buildings"]
          if b["sourceId"] in street_owners
        )
      after = mesh_signature(payload)
      assert before - remove - facade_remove + mesh_signature(added) == after, (
        f"Unowned triangle loss {d['id']} {mode}"
      )
      for key in ["ground", "water", "roads", "bridges"]:
        assert payload["nav"][key] == original["nav"][key]
      for b in original["nav"]["buildings"]:
        if b["sourceId"] not in owners:
          assert b in payload["nav"]["buildings"]
      raw = (
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n"
      ).encode()
      packed = gzip.compress(raw, mtime=0)
      (candidate / d[mode]["url"]).write_bytes(packed)
      entry["modes"][mode] = {
        "oldSha256": d[mode]["sha256"] if d["id"] in original_chunk_ids else None,
        "removedTriangles": sum(remove.values()),
        "removedTachelesFacadeTriangles": sum(facade_remove.values()),
        "addedTriangles": sum(mesh_signature(added).values()),
        "preservedTriangles": sum((before - remove - facade_remove).values()),
      }
      d[mode] = {
        **d[mode],
        "bytes": len(packed),
        "decodedBytes": len(raw),
        "sha256": hashlib.sha256(packed).hexdigest(),
      }
    audit.append(entry)
  manifest.setdefault("source", {}).update(street_patch.get("source", {}))
  manifest["source"]["oranienRefinementsV167"] = {
    "version": "1.0.67",
    "exactMovedOuterSourceIds": sorted(owners),
    "tachelesFacadePrismIds": facade_plan["corePrismIds"],
    "retention": "All unowned triangle multisets and navigation remain exact. Complete precise parents exist in the corresponding global model or bounded street packets.",
  }
  result = {
    "version": "1.0.67",
    "ownerCount": len(owners),
    "chunks": audit,
    "unownedTriangleLoss": 0,
    "unownedNavigationLoss": 0,
  }
  (candidate / "manifest.json").write_text(
    json.dumps(manifest, separators=(",", ":")) + "\n"
  )
  (ROOT / "geo_data/regierungsviertel/oranien-refinements-v167-audit.json").write_text(
    json.dumps(result, indent=2) + "\n"
  )
  (ROOT / "geo_data/regierungsviertel/tacheles-v166-facade-removal.json").write_text(
    json.dumps(facade_plan, separators=(",", ":")) + "\n"
  )
  if apply:
    changed = {entry["id"] for entry in audit}
    outputs = {"manifest.json"} | {
      chunk[mode]["url"]
      for chunk in manifest["chunks"]
      if chunk["id"] in changed
      for mode in ("drawn", "minecraft")
    }
    for name in outputs:
      (DEFAULT_OUTPUT / name).write_bytes((candidate / name).read_bytes())
  return {
    "owners": len(owners),
    "chunks": len(audit),
    "applied": apply,
    "candidate": str(candidate),
  }


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--streets", type=Path, default=Path("/tmp/v167-corridor-packets")
  )
  parser.add_argument("--apply", action="store_true")
  args = parser.parse_args()
  print(integrate(args.streets, args.apply))


if __name__ == "__main__":
  main()
