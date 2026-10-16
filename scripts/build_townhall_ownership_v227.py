"""Independently prove exact old packet rows for complete town-hall replacements.

Unmatched owners are reported and retained; a bounding-box match is never enough.
No packet is mutated. The replacement must be installed before using this receipt.
"""

from __future__ import annotations

import base64
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import pyogrio
from shapely.geometry import box

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_district_facades_v188 import read_json, write_json
from build_karl_marx_allee_v161 import mesh_signature
from build_panorama_facade_v202 import fingerprint
from build_surrounding_outlines import chunk_payload
from integrate_city_refinements_v166 import line_signature

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "townhall-source-v227.json"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
TARGET = ROOT / "src/app/src/data/townhallV227Ownership.json"


def digest(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def build() -> dict[str, Any]:
  selected = {}
  for site in read_json(SOURCE)["sites"]:
    for parent in site["parents"]:
      owner = parent.get("existingOwnership", {})
      if (
        parent["geometrySource"] == "complete-official-lod2-leaf-sheets"
        and owner.get("family") == "surrounding-city"
      ):
        for old_id in owner["ids"]:
          selected[old_id] = {"site": site["key"], "parent": parent["id"]}
  where = "sourceId IN (" + ",".join("'" + s + "'" for s in selected) + ")"
  retained = {}
  for path in sorted((GEO / "raw").rglob("resolved-outlines.gpkg")):
    for row in pyogrio.read_dataframe(path, layer="buildings", where=where).to_dict(
      "records"
    ):
      retained.setdefault(row["sourceId"], []).append((row, path))
  records, lines, navigation, blocked = [], [], [], []
  matched = set()
  for desc in read_json(OUT / "manifest.json")["chunks"]:
    if desc.get("detailCompanionOf"):
      continue
    tile = box(*desc["bounds"])
    candidates = {
      key: rows
      for key, rows in retained.items()
      if any(r["geometry"].intersects(tile) for r, _ in rows)
    }
    if not candidates:
      continue
    for mode in ["drawn", "minecraft"]:
      path = OUT / desc[mode]["url"]
      payload = read_json(path)
      actual = mesh_signature(payload)
      for old_id, rows in candidates.items():
        nav = [b for b in payload["nav"]["buildings"] if b["sourceId"] == old_id]
        if not nav:
          continue
        evidence = None
        for owner, source_path in rows:
          # No ground/surface geometry is part of a building ownership receipt.
          full = chunk_payload(
            desc["id"], tile, tile, [owner], {}, minecraft=mode == "minecraft"
          )
          empty = chunk_payload(
            desc["id"], tile, tile, [], {}, minecraft=mode == "minecraft"
          )
          expected = mesh_signature(full) - mesh_signature(empty)
          ink = (
            line_signature(full["lines"]) - line_signature(empty["lines"])
            if mode == "drawn"
            else Counter()
          )
          if (
            expected
            and not expected - actual
            and (not ink or not ink - line_signature(payload["lines"]))
          ):
            evidence = expected, ink, source_path
            break
        if evidence is None:
          blocked.append(
            {
              "owner": old_id,
              "parent": selected[old_id]["parent"],
              "tile": desc["id"],
              "mode": mode,
              "reason": "Retained owner re-export does not match original colored packet rows; retain existing body.",
            }
          )
          continue
        expected, ink, source_path = evidence
        matched.add(old_id)
        navigation.extend(
          {
            "tile": desc["id"],
            "mode": mode,
            "owner": old_id,
            "groundY": payload["nav"]["groundY"],
            "original": row,
          }
          for row in nav
        )
        for mesh in payload["meshes"]:
          if mesh["kind"] != "city":
            continue
          vertices = np.column_stack(
            [
              np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3),
              np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3),
            ]
          )
          indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(
            -1, 3
          )
          removed = []
          for index, triangle in enumerate(vertices[indices]):
            key = b"".join(sorted(v.tobytes() for v in triangle))
            if expected[key]:
              expected[key] -= 1
              removed.append(index)
          if removed:
            records.append(
              {
                "tile": desc["id"],
                "mode": mode,
                "kind": "city",
                "owner": old_id,
                "sha256": digest(path),
                "fingerprint": fingerprint(
                  [mesh[k] for k in ["positions", "colors", "indices"]]
                ),
                "triangles": removed,
                "retainedSource": str(source_path.relative_to(ROOT)),
              }
            )
        assert not +expected, old_id
        if ink:
          mesh = payload["lines"]
          vertices = np.column_stack(
            [
              np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3),
              np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3),
            ]
          ).reshape(-1, 2, 6)
          removed = []
          for index, segment in enumerate(vertices):
            key = b"".join(sorted(v.tobytes() for v in segment))
            if ink[key]:
              ink[key] -= 1
              removed.append(index)
          assert not +ink, old_id
          lines.append(
            {
              "tile": desc["id"],
              "mode": mode,
              "owner": old_id,
              "sha256": digest(path),
              "fingerprint": fingerprint([mesh[k] for k in ["positions", "colors"]]),
              "segments": removed,
            }
          )
  blocked_ids = {r["owner"] for r in blocked}
  for owner in set(selected) - matched - blocked_ids:
    blocked.append(
      {
        "owner": owner,
        "parent": selected[owner]["parent"],
        "reason": "No independently matching retained packet owner.",
      }
    )
    blocked_ids.add(owner)
  # Atomic per owner across modes/chunks. A partly matching owner is retained whole.
  records = [r for r in records if r["owner"] not in blocked_ids]
  lines = [r for r in lines if r["owner"] not in blocked_ids]
  navigation = [r for r in navigation if r["owner"] not in blocked_ids]
  authorized = sorted({r["owner"] for r in records})
  return {
    "schemaVersion": 1,
    "sourceSha256": digest(SOURCE),
    "records": records,
    "lineRecords": lines,
    "navigationRecords": navigation,
    "authorizedOwners": authorized,
    "replacementParents": sorted({selected[k]["parent"] for k in authorized}),
    "blocked": blocked,
  }


if __name__ == "__main__":
  result = build()
  write_json(TARGET, result)
  print(
    json.dumps(
      {
        "authorized": len(result["authorizedOwners"]),
        "blocked": result["blocked"],
        "triangles": sum(len(r["triangles"]) for r in result["records"]),
      }
    )
  )
