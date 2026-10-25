"""Exact immutable Alt-Mitte receipts for the single false closed Mensa canopy."""

from __future__ import annotations

import base64
import hashlib
from collections import Counter

import build_charite_bridges_alt_mitte_v265 as audit
import numpy as np
import shapely
from alt_mitte_v169_packets import pack_detail
from build_karl_marx_allee_v161 import Detail, native_detail
from build_prisons_memorials_ownership_v209 import fingerprint
from build_scheunenviertel_v168 import merge_native_faces
from shapely.ops import unary_union

ROOT, CORE, PUB = audit.ROOT, audit.core, audit.PUB
PARENT = "DEBE01YYK0001xN5"


def packet_paths():
  """Restrict inspection to the canopy's actual 512m tile, never city-wide."""
  for mode, label in (("drawn", "Drawn"), ("minecraft", "Native")):
    source = audit.read(CORE.APP_DATA / f"altMitte{label}V169Source.json")
    for item in source["chunkFiles"]:
      if item["id"].startswith("1_-2-"):
        yield mode, "alt-mitte-v169-" + item["id"], CORE.APP_DATA / item["file"], mode
  for item in audit.read(PUB / "manifest.json")["chunks"]:
    if item["id"] == "1_-2" or item["id"].startswith("1_-2-alt-mitte-v169-"):
      yield "drawn", item["id"], PUB / item["drawn"]["url"], "front"


def build():
  """Reproduce this exact owner using unchanged v169 sources and appearance."""
  manifest = audit.read(CORE.SOURCE / "source-manifest.json")
  records = [
    b
    for c in manifest["chunks"]
    for b in audit.read(CORE.SOURCE / c["file"])["buildings"]
  ]
  occupied = unary_union([CORE.footprint(b) for b in records])
  shapely.prepare(occupied)
  CORE.APPEARANCE.clear()
  ranks = {}
  for previous in audit.read(CORE.SOURCE / "appearance-baseline.json.gz")["records"]:
    for binding in previous["bindings"]:
      for part in binding["parts"]:
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if rank > ranks.get(part["partId"], (False, -1)):
          CORE.APPEARANCE[part["partId"]], ranks[part["partId"]] = previous, rank
  target = next(b for b in records if b["id"] == PARENT)
  assert target["category"] == "core" and len(target["parts"]) == 1
  shell, front, navigation, _ = CORE.model(target, occupied)
  full = Detail()
  full.triangles = shell.triangles + front.triangles
  models = {
    "drawn": CORE.isometric_shading(shell),
    "front": CORE.isometric_shading(front),
    "minecraft": merge_native_faces(native_detail(full)),
  }
  transfer, lines, originals, checks, remaining = [], [], {}, [], {}
  for mode, tile, path, layer in packet_paths():
    packet = audit.read(path)
    x, y, z = packet["origin"]
    key = (layer, x, y, z)
    if key not in remaining:
      remaining[key] = Counter(
        sig
        for mesh in pack_detail(models[layer], (x, z, x + 512, z + 512), origin_y=y)
        for sig in audit.signatures(mesh)
      )
    for index, mesh in enumerate(packet["meshes"]):
      if mesh["kind"] != "alt-mitte-v169":
        continue
      signatures = audit.signatures(mesh)
      selected = []
      for i, signature in enumerate(signatures):
        if remaining[key][signature]:
          remaining[key][signature] -= 1
          selected.append(i)
      if not selected:
        continue
      transfer.append(
        {
          "tile": tile,
          "kind": mesh["kind"],
          "mode": mode,
          "fingerprint": fingerprint(
            [mesh["positions"], mesh["colors"], mesh["indices"]]
          ),
          "triangles": selected,
          "layer": layer,
        }
      )
      originals[str(path.relative_to(ROOT))] = audit.sha(path)
      selected_set = set(selected)
      kept = [s for i, s in enumerate(signatures) if i not in selected_set]
      checks.append(
        {
          "tile": tile,
          "mesh": index,
          "transferred": len(selected),
          "preserved": len(kept),
          "preservedSha256": hashlib.sha256(b"".join(kept)).hexdigest(),
        }
      )
  assert all(not +c for c in remaining.values()), [
    (key, sum(c.values())) for key, c in remaining.items() if +c
  ]
  others = [
    b
    for b in records
    if b["id"] != PARENT
    and b["category"] == "core"
    and not CORE.footprint(b).is_empty
    and CORE.footprint(b).bounds[0] < 1026
    and CORE.footprint(b).bounds[2] > 510
    and CORE.footprint(b).bounds[1] < -510
    and CORE.footprint(b).bounds[3] > -1026
  ]
  for mode, tile, path, layer in packet_paths():
    if mode != "drawn" or layer != "drawn":
      continue
    packet = audit.read(path)
    if not packet.get("lines"):
      continue
    x, y, z = packet["origin"]
    bounds = (x, z, x + 512, z + 512)
    obsolete = audit.line_signatures(
      audit.edges([target]), bounds, y
    ) - audit.line_signatures(audit.edges(others), bounds, y)
    line = packet["lines"]
    values = np.frombuffer(base64.b64decode(line["positions"]), "<u2").reshape(-1, 2, 3)
    selected = [
      i for i, p in enumerate(values) if tuple(sorted(tuple(q) for q in p)) in obsolete
    ]
    if selected:
      lines.append(
        {
          "tile": tile,
          "mode": mode,
          "fingerprint": fingerprint([line["positions"], line.get("colors", "")]),
          "segments": selected,
        }
      )
      originals[str(path.relative_to(ROOT))] = audit.sha(path)
  counts = {
    layer: sum(len(r["triangles"]) for r in transfer if r["layer"] == layer)
    for layer in models
  }
  counts["inkSegments"] = sum(len(r["segments"]) for r in lines)
  output = {
    "schema": 1,
    "parent": PARENT,
    "records": transfer,
    "lineRecords": lines,
    "previousNavigationParts": navigation,
    "counts": counts,
  }
  evidence = {
    "schema": 1,
    "inputs": originals,
    "sourceOwner": target,
    "sourceManifestSha256": audit.sha(CORE.SOURCE / "source-manifest.json"),
    "appearanceSha256": audit.sha(CORE.SOURCE / "appearance-baseline.json.gz"),
    "exactMatchMissing": 0,
    "unownedTriangleLoss": 0,
    "sharedInkPreserved": True,
    "policy": "Only exact complete K0001xN5 canopy source owner yields; complete original measured roof is rendered by CampusNordV266. No neighbouring native owner is transferred.",
    "counts": counts,
    "checks": checks,
  }
  for relative, value in [
    ("src/app/src/data/campusNordV266AltMittePrevious.json", output),
    ("geo_data/regierungsviertel/campus-nord-v266-alt-mitte-evidence.json", evidence),
  ]:
    path = ROOT / relative
    path.write_bytes(CORE.encode(value) + b"\n")
    print(f"{relative}: {path.stat().st_size} bytes", flush=True)
  print(counts, flush=True)
  return output


if __name__ == "__main__":
  build()
