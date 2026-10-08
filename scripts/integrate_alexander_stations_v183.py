"""Step 10: exact v169 family subtraction for four refined v183 outer owners."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
from alt_mitte_v169_packets import append_ink, empty_packet, pack_detail
from build_alt_mitte_v169 import APPEARANCE, SOURCE, footprint, isometric_shading, model
from build_karl_marx_allee_v161 import Detail, mesh_signature, native_detail
from build_scheunenviertel_v168 import merge_native_faces
from build_surrounding_outlines import DEFAULT_OUTPUT, ROOT
from integrate_city_refinements_v166 import subtract_meshes
from shapely.geometry import box
from shapely.ops import unary_union


def ink_keys(lines: dict) -> tuple[np.ndarray, list[bytes]]:
  """Canonical geometry-only line keys for v169's independently packed source ink."""
  a = np.frombuffer(base64.b64decode(lines["positions"]), dtype="<u2").reshape(-1, 2, 3)
  return a, [b"".join(sorted(p.tobytes() for p in pair)) for pair in a]


def integrate() -> dict[str, Any]:
  """Prove triangle multisets and unrelated navigation survive before writing."""
  manifest_path = DEFAULT_OUTPUT / "manifest.json"
  manifest = json.loads(manifest_path.read_text())
  audit_path = ROOT / "geo_data/regierungsviertel/alexander-stations-v183-audit.json"
  if manifest.get("source", {}).get("alexanderStationsV183"):
    return json.loads(audit_path.read_text())
  owners = {
    "DEBE01YYK00001Xy",
    "DEBE01YYK00003SW",
    "DEBE01YYK00002iS",
    "DEBE00YY1TF0003o",
  }
  records = [
    r
    for name in ["source-392_5820-00.json.gz", "source-392_5819-00.json.gz"]
    for r in json.loads(gzip.decompress((SOURCE / name).read_bytes()))["buildings"]
  ]
  selected = [r for r in records if r["id"] in owners]
  assert len(selected) == 4 and all(r["category"] == "outer" for r in selected)
  # Long railway/viaduct parents can be filed in a neighbouring LoD2 tile.
  # Read every retained footprint, then keep just neighbours within the
  # original facade algorithm's three-metre exposure probes.
  vicinity = unary_union([footprint(r) for r in selected]).buffer(4)
  neighbouring = []
  source_manifest = json.loads((SOURCE / "source-manifest.json").read_text())
  for entry in source_manifest["chunks"]:
    packet = json.loads(gzip.decompress((SOURCE / entry["file"]).read_bytes()))
    for record in packet["buildings"]:
      p = footprint(record)
      if p.intersects(vicinity):
        neighbouring.append(p)
  occupied = unary_union(neighbouring)
  appearance = json.loads(
    gzip.decompress((SOURCE / "appearance-baseline.json.gz").read_bytes())
  )
  ranks: dict = {}
  APPEARANCE.clear()
  for old in appearance["records"]:
    for binding in old["bindings"]:
      for part in binding["parts"]:
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if rank > ranks.get(part["partId"], (False, -1)):
          APPEARANCE[part["partId"]] = old
          ranks[part["partId"]] = rank
  detail = {"drawn": Detail(), "minecraft": Detail()}
  edges = []
  for r in selected:
    shell, front, _, _ = model(r, occupied)
    full = Detail()
    full.triangles = shell.triangles + front.triangles
    detail["drawn"].triangles.extend(isometric_shading(full).triangles)
    detail["minecraft"].triangles.extend(
      merge_native_faces(native_detail(full)).triangles
    )
    edges.extend(
      (a, b)
      for p in r["parts"]
      for s in p["surfaces"]
      if s["kind"] in ("WallSurface", "RoofSurface", "ClosureSurface")
      for ring in s["rings"]
      for a, b in zip(ring, ring[1:] + ring[:1])
    )
  target_bounds = unary_union([footprint(r) for r in selected]).buffer(2)
  expected: dict = {}
  removed: dict = {}
  staged: dict[Path, bytes] = {}
  audit = []
  for d in manifest["chunks"]:
    bounds = tuple(d["bounds"])
    if not target_bounds.intersects(box(*bounds)):
      continue
    row = {"id": d["id"], "modes": {}}
    for mode in ["drawn", "minecraft"]:
      key = (bounds, mode)
      if key not in expected:
        expected[key] = mesh_signature({"meshes": pack_detail(detail[mode], bounds)})
        removed[key] = Counter()
      path = DEFAULT_OUTPUT / d[mode]["url"]
      original = json.loads(gzip.decompress(path.read_bytes()))
      before = mesh_signature(original)
      # Whole v169 models can be distributed over several bounded companions.
      remove = (expected[key] - removed[key]) & before
      payload = copy.deepcopy(original)
      if remove:
        selected_meshes = [
          dict(m, kind="city")
          for m in payload["meshes"]
          if m["kind"] == "alt-mitte-v169"
        ]
        matching = mesh_signature({"meshes": selected_meshes}) & remove
        assert matching == remove, "Target signature outside the recorded v169 family"
        kept = subtract_meshes(selected_meshes, remove.copy())
        payload["meshes"] = [
          m for m in payload["meshes"] if m["kind"] != "alt-mitte-v169"
        ] + [dict(m, kind="alt-mitte-v169") for m in kept]
        removed[key].update(remove)
      line_count = 0
      if mode == "drawn" and "lines" in payload and "colors" not in payload["lines"]:
        packets = [empty_packet("expected", bounds)]
        append_ink(packets, edges, "expected", bounds)
        wanted = {key for p in packets[1:] for key in ink_keys(p["lines"])[1]}
        values, keys = ink_keys(payload["lines"])
        keep = [i for i, key in enumerate(keys) if key not in wanted]
        line_count = len(keys) - len(keep)
        if line_count:
          payload["lines"]["positions"] = base64.b64encode(
            values[keep].tobytes()
          ).decode()
      payload["nav"]["buildings"] = [
        b for b in payload["nav"]["buildings"] if b["sourceId"] not in owners
      ]
      if payload == original:
        continue
      assert mesh_signature(payload) == before - remove
      for name in ["ground", "water", "roads", "bridges"]:
        assert payload["nav"].get(name) == original["nav"].get(name)
      assert all(
        b in payload["nav"]["buildings"]
        for b in original["nav"]["buildings"]
        if b["sourceId"] not in owners
      )
      raw = (
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n"
      ).encode()
      packed = gzip.compress(raw, mtime=0)
      staged[path] = packed
      row["modes"][mode] = {
        "oldSha256": d[mode]["sha256"],
        "removedTriangles": sum(remove.values()),
        "removedSourceInkSegments": line_count,
        "preservedTriangles": sum((before - remove).values()),
        "unrelatedGeometryPreserved": True,
      }
      d[mode] = {
        **d[mode],
        "bytes": len(packed),
        "decodedBytes": len(raw),
        "sha256": hashlib.sha256(packed).hexdigest(),
      }
      row["modes"][mode]["newSha256"] = d[mode]["sha256"]
    if row["modes"]:
      audit.append(row)
  for key, required in expected.items():
    assert required == removed[key], (
      f"Unmatched v169 source signature {key}: {sum((required - removed[key]).values())}"
    )
  assert staged
  result = {
    "sourceIds": sorted(owners),
    "retainedCoreFacadeOwner": "DEBE01YYK00001QK",
    "chunks": audit,
    "unrelatedGeometryPreserved": True,
    "originalSourceRetained": "src/app/src/data/alexanderStationsV183Source.json",
  }
  manifest.setdefault("source", {})["alexanderStationsV183"] = {
    "version": "1.0.83",
    "owners": sorted(owners),
    "audit": "alexander-stations-v183-audit.json",
    "policy": "Exact complete v169 owner signatures subtracted. Source inventory retained; four replacements plus Berolinahaus facade live in AlexanderStationsV183.",
  }
  for path, data in staged.items():
    path.write_bytes(data)
  manifest_path.write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
  audit_path.write_text(json.dumps(result, indent=2) + "\n")
  return result


if __name__ == "__main__":
  print(json.dumps(integrate(), indent=2))
