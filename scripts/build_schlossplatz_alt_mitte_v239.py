"""Audit exact v169 shells, window layers and ink superseded by Schlossplatz v239.

Never edit the immutable packets. Reproduce only four named source families and
match every encoded coordinate/colour bit before emitting bounded index receipts.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

import build_alt_mitte_v169 as core
import numpy as np
import shapely
from alt_mitte_v169_packets import append_ink, empty_packet, pack_detail
from build_karl_marx_allee_v161 import Detail, native_detail
from build_prisons_memorials_ownership_v209 import fingerprint, signature, vertices
from build_scheunenviertel_v168 import merge_native_faces
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/app/src/data/schlossplatzV239AltMittePrevious.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/schlossplatz-v239-alt-mitte-evidence.json"
PARENTS = {
  "DEBE01YYK000060j",
  "DEBE01YYK0000Bfk",
  "DEBE01YYK00008jV",
  "DEBE01YYK0000CnW",
}
PUB = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def source_models():
  """Same complete retained footprint context and appearance as v169."""
  manifest = read(core.SOURCE / "source-manifest.json")
  records = [
    b for c in manifest["chunks"] for b in read(core.SOURCE / c["file"])["buildings"]
  ]
  occupied = unary_union([core.footprint(b) for b in records])
  shapely.prepare(occupied)
  core.APPEARANCE.clear()
  ranks = {}
  for previous in read(core.SOURCE / "appearance-baseline.json.gz")["records"]:
    for binding in previous["bindings"]:
      for part in binding["parts"]:
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if rank > ranks.get(part["partId"], (False, -1)):
          core.APPEARANCE[part["partId"]] = previous
          ranks[part["partId"]] = rank
  targets = [b for b in records if b["id"] in PARENTS]
  assert len(targets) == 4 and all(b["category"] == "core" for b in targets)
  models = {}
  for b in targets:
    shell, front, nav, _ = core.model(b, occupied)
    full = Detail()
    full.triangles = shell.triangles + front.triangles
    models[b["id"]] = {
      "drawn": core.isometric_shading(shell),
      "front": core.isometric_shading(front),
      "minecraft": merge_native_faces(native_detail(full)),
      "navigation": nav,
    }
  return records, targets, models


def packet_paths():
  """Only the two 512m cells intersecting these four measured families."""
  result = []
  for mode, label in (("drawn", "Drawn"), ("minecraft", "Native")):
    source = read(core.APP_DATA / f"altMitte{label}V169Source.json")
    for item in source["chunkFiles"]:
      if item["id"].startswith(("3_0-", "4_0-")):
        result.append(
          (mode, "alt-mitte-v169-" + item["id"], core.APP_DATA / item["file"], mode)
        )
  for item in read(PUB / "manifest.json")["chunks"]:
    if item["id"] in ("3_0", "4_0") or item["id"].startswith(
      ("3_0-alt-mitte-v169-", "4_0-alt-mitte-v169-")
    ):
      result.append(("drawn", item["id"], PUB / item["drawn"]["url"], "front"))
  return result


def signatures(mesh):
  v = vertices(mesh)
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return [signature(t) for t in v[ix]]


def edges(buildings):
  return [
    (a, b)
    for record in buildings
    for p in record["parts"]
    for s in p["surfaces"]
    if s["kind"] in ("WallSurface", "RoofSurface", "ClosureSurface")
    for r in s["rings"]
    for a, b in zip(r, r[1:] + r[:1])
  ]


def line_signatures(segments, bounds, origin_y):
  packets = [empty_packet("audit", bounds, origin_y)]
  append_ink(packets, segments, "audit", bounds)
  return {
    tuple(sorted(tuple(q) for q in v))
    for p in packets
    if p.get("lines")
    for v in np.frombuffer(base64.b64decode(p["lines"]["positions"]), "<u2").reshape(
      -1, 2, 3
    )
  }


def build():
  all_records, targets, models = source_models()
  print("Reproduced four v169 families", flush=True)
  transfer, line_records, originals, audit = [], [], {}, []
  remaining, expected_totals = {}, {}
  wanted_parents = {}
  for mode, tile, path, layer in packet_paths():
    packet = read(path)
    origin = packet["origin"]
    bounds = (origin[0], origin[2], origin[0] + 512, origin[2] + 512)
    key = (layer, *origin)
    if key not in remaining:
      expected = Counter()
      owner = defaultdict(set)
      for parent, model in models.items():
        for mesh in pack_detail(model[layer], bounds, origin_y=origin[1]):
          sigs = signatures(mesh)
          expected.update(sigs)
          for sig in sigs:
            owner[sig].add(parent)
      remaining[key] = expected
      expected_totals[key] = sum(expected.values())
      wanted_parents[key] = owner
    for mesh_index, mesh in enumerate(packet["meshes"]):
      if mesh["kind"] != "alt-mitte-v169":
        continue
      sigs = signatures(mesh)
      selected, owners = [], set()
      for i, sig in enumerate(sigs):
        if remaining[key][sig]:
          remaining[key][sig] -= 1
          selected.append(i)
          owners.update(wanted_parents[key][sig])
      if selected:
        transfer.append(
          dict(
            tile=tile,
            kind=mesh["kind"],
            mode=mode,
            fingerprint=fingerprint(
              [mesh["positions"], mesh["colors"], mesh["indices"]]
            ),
            triangles=selected,
            parents=sorted(owners),
            layer=layer,
          )
        )
        originals[str(path.relative_to(ROOT))] = sha(path)
        # Every untouched encoded triangle remains in exactly the same order.
        selected_set = set(selected)
        unowned = [s for i, s in enumerate(sigs) if i not in selected_set]
        audit.append(
          dict(
            tile=tile,
            file=str(path.relative_to(ROOT)),
            meshIndex=mesh_index,
            mode=mode,
            layer=layer,
            removed=len(selected),
            preserved=len(unowned),
            preservedSha256=hashlib.sha256(b"".join(unowned)).hexdigest(),
          )
        )
  assert all(not +counter for counter in remaining.values()), [
    (key, sum(counter.values()), expected_totals[key])
    for key, counter in remaining.items()
    if +counter
  ]
  target_edges = edges(targets)
  # Shared ink belongs to all source contributors; retain any non-target edge.
  others = [
    b
    for b in all_records
    if b["id"] not in PARENTS
    and b["category"] == "core"
    and not core.footprint(b).is_empty
    and core.footprint(b).bounds[0] < 2562
    and core.footprint(b).bounds[2] > 1534
    and core.footprint(b).bounds[1] < 514
    and core.footprint(b).bounds[3] > -2
  ]
  other_edges = edges(others)
  for mode, tile, path, layer in packet_paths():
    if mode != "drawn" or layer != "drawn":
      continue
    packet = read(path)
    if not packet.get("lines"):
      continue
    x, y, z = packet["origin"]
    bounds = (x, z, x + 512, z + 512)
    obsolete = line_signatures(target_edges, bounds, y) - line_signatures(
      other_edges, bounds, y
    )
    line = packet["lines"]
    values = np.frombuffer(base64.b64decode(line["positions"]), "<u2").reshape(-1, 2, 3)
    selected = [
      i for i, p in enumerate(values) if tuple(sorted(tuple(q) for q in p)) in obsolete
    ]
    if selected:
      line_records.append(
        dict(
          tile=tile,
          mode=mode,
          fingerprint=fingerprint([line["positions"], line.get("colors", "")]),
          segments=selected,
        )
      )
      originals[str(path.relative_to(ROOT))] = sha(path)
  counts = dict(
    Counter(
      {
        layer: sum(len(r["triangles"]) for r in transfer if r["layer"] == layer)
        for layer in ("drawn", "front", "minecraft")
      }
    )
  )
  counts["inkSegments"] = sum(len(r["segments"]) for r in line_records)
  output = dict(
    schema=1,
    parents=sorted(PARENTS),
    partIds=sorted(p["id"] for b in targets for p in b["parts"]),
    previousNavigationParts=[
      part for model in models.values() for part in model["navigation"]
    ],
    records=transfer,
    lineRecords=line_records,
    counts=counts,
  )
  OUT.write_bytes(core.encode(output) + b"\n")
  EVIDENCE.write_bytes(
    core.encode(
      dict(
        schema=1,
        inputs=originals,
        sourceManifestSha256=sha(core.SOURCE / "source-manifest.json"),
        appearanceSha256=sha(core.SOURCE / "appearance-baseline.json.gz"),
        ownerSources={
          b["id"]: hashlib.sha256(core.encode(b)).hexdigest() for b in targets
        },
        exactMatchMissing=0,
        unownedTriangleLoss=0,
        sharedInkPreserved=True,
        counts=counts,
        records=audit,
      )
    )
    + b"\n"
  )
  print(json.dumps(counts), flush=True)
  return output


if __name__ == "__main__":
  build()
