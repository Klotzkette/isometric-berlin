"""Exact original Alt169 fitting retirement under the complete V321 model gate.

Each retired triangle is reproduced by the original source-family constructor,
then matched with position, colour, winding and multiplicity against the actual
unchanged public packet. No source mesh, roof or unrelated mark is repacked.
"""

from __future__ import annotations

import copy
import hashlib
from collections import Counter

import build_alt_mitte_v169 as original
import numpy as np
from alt_mitte_v169_packets import pack_detail
from build_federal_ministries_v321 import DATA, GEO, OLD_BODIES, ROOT, read, write
from build_karl_marx_allee_v161 import Detail, native_detail
from build_scheunenviertel_v168 import merge_native_faces
from federal_ministries_v321_native import decode, on_faces
from shapely.ops import unary_union

PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def fingerprint(text):
  h = 2166136261
  for c in text:
    h = ((h ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return h


def triangles(mesh):
  pos = decode(mesh["positions"], "<u2").reshape(-1, 3)
  color = decode(mesh["colors"], "u1").reshape(-1, 3)
  index = decode(mesh["indices"], "<u4").reshape(-1, 3)
  for row in index:
    v = [tuple(map(int, np.concatenate([pos[i], color[i]]))) for i in row]
    yield min(tuple(v[i:] + v[:i]) for i in range(3))


def build_packets():
  profile = read(DATA / "federalMinistriesV321.json")
  records = []
  manifest = read(GEO / "alt-mitte-v169/source-manifest.json")
  for chunk in manifest["chunks"]:
    records.extend(read(GEO / "alt-mitte-v169" / chunk["file"])["buildings"])
  occupied = unary_union([original.footprint(p) for p in records])
  parents = {
    f.get("parent", f["owner"]) for site in profile["sites"] for f in site["faces"]
  }
  selected = [
    r
    for r in records
    if r["id"] in parents
    or any(p["id"] in OLD_BODIES for p in r.get("legacyPrisms", []))
  ]
  if not all(
    any(p["id"] == owner for r in selected for p in r.get("legacyPrisms", []))
    for owner in ["32698095", "41953739", "n-280071"]
  ):
    raise ValueError("Missing original coreFallback source family")
  appearance = read(GEO / "alt-mitte-v169/appearance-baseline.json.gz")
  ranks = {}
  for r in appearance["records"]:
    for binding in r["bindings"]:
      for part in binding["parts"]:
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if rank > ranks.get(part["partId"], (False, -1)):
          original.APPEARANCE[part["partId"]] = r
          ranks[part["partId"]] = rank
  details = {"drawn": Detail(), "minecraft": Detail()}
  selected_sources, owner_proof = set(), []
  for record in selected:
    if record["category"] == "retained":
      continue
    shells, fronts, _, _ = original.model(copy.deepcopy(record), occupied)
    obsolete = any(p["id"] in OLD_BODIES for p in record.get("legacyPrisms", []))
    faces = [
      f
      for site in profile["sites"]
      for f in site["faces"]
      if f.get("parent", f["owner"]) == record["id"]
    ]
    chosen = (
      fronts.triangles
      if obsolete
      else [t for t in fronts.triangles if all(on_faces(p, faces, 0.16) for p in t[0])]
    )
    details["drawn"].triangles.extend(chosen)
    count_native = 0
    if obsolete:
      whole = Detail()
      whole.triangles = shells.triangles + fronts.triangles
      native = merge_native_faces(native_detail(whole))
      details["minecraft"].triangles.extend(native.triangles)
      count_native = len(native.triangles)
      selected_sources.add(record["id"])
    if chosen or count_native:
      owner_proof.append(
        {
          "id": record["id"],
          "category": record["category"],
          "parts": [p["id"] for p in record["parts"]],
          "drawnFittingTriangles": len(chosen),
          "nativeObsoleteFittingTriangles": count_native,
        }
      )
  result = {"schemaVersion": 1, "keys": [], "packets": {}}
  proof = {
    "schemaVersion": 1,
    "ownerConstructors": owner_proof,
    "packets": [],
    "preparedGuardsFinalized": False,
  }
  for descriptor in read(PUBLIC / "manifest.json")["chunks"]:
    base = descriptor["id"]
    if base not in {"1_0", "1_1", "2_1", "2_-2", "3_1", "2_2", "3_2"}:
      continue
    ix, iz = map(int, base.split("_"))
    bounds = [ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512]
    for mode, detail in details.items():
      if not detail.triangles:
        continue
      path = PUBLIC / descriptor[mode]["url"]
      raw = read(path)
      packed = pack_detail(
        original.isometric_shading(detail) if mode == "drawn" else detail,
        bounds,
        origin_y=raw["origin"][1],
      )
      expected = Counter(t for part in packed for t in triangles(part))
      if not expected:
        continue
      before = expected.copy()
      retire = []
      for mi, mesh in enumerate(raw["meshes"]):
        if mesh["kind"] != "alt-mitte-v169":
          continue
        rows = []
        for ti, token in enumerate(triangles(mesh)):
          if expected[token]:
            expected[token] -= 1
            rows.append(ti)
        if rows:
          retire.append({"mesh": mi, "triangles": rows})
      missing = sum(v for v in expected.values() if v > 0)
      if missing:
        raise ValueError(
          f"Unproved original fitting words: {mode}:{base}: {missing}/{sum(before.values())}"
        )
      key = mode + ":" + base
      raw_records = [
        {
          "mesh": i,
          "kind": m["kind"],
          "fingerprint": fingerprint(m["positions"] + m["colors"] + m["indices"]),
        }
        for i, m in enumerate(raw["meshes"])
      ]
      old_nav = [
        b for b in raw["nav"]["buildings"] if b["sourceId"] in selected_sources
      ]
      result["keys"].append(key)
      result["packets"][key] = {
        "origin": raw["origin"],
        "records": raw_records,
        "preparedRecords": raw_records,
        "navGuard": 0,
        "lineGuard": None,
        "preparedNavGuard": 0,
        "preparedLineGuard": None,
        "retire": retire,
        "retireLines": [],
        "retireNav": old_nav,
        "appendNav": [],
        "owners": [p["id"] for p in owner_proof],
      }
      proof["packets"].append(
        {
          "key": key,
          "rawSourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
          "retiredTriangles": sum(len(r["triangles"]) for r in retire),
          "retiredNavigation": old_nav,
          "unchangedVerticesColors": True,
          "unretiredIndexComplement": "all original exact indices retained by the existing V303 index-only transaction",
        }
      )
      print(key, proof["packets"][-1]["retiredTriangles"], flush=True)
  if not result["keys"]:
    raise ValueError("Empty finite fitting transaction")
  write(DATA / "federalMinistriesV321Packets.json", result)
  write(DATA / "federalMinistriesV321PacketIndex.json", {"keys": result["keys"]})
  write(GEO / "federal-ministries-v321-packets-evidence.json.gz", proof)
  print("keys", result["keys"])


if __name__ == "__main__":
  build_packets()
