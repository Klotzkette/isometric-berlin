"""Step 10: audit every retained primary city packet for unresolved default paint.

Only source-proved colour cells change. The earlier complete-quad/incident-face
proof is reused, separately for drawn and native packets, without changing the
original packets or any source geometry. Receipts are split into bounded weak
construction fields rather than retaining one citywide decoded graph.
"""

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter

from scripts import build_grey_cluster_colours_v263 as prior

ROOT, GEO, OUT = prior.ROOT, prior.GEO, prior.OUT
APP = ROOT / "src/app/src/data"
SHARDS = 32
INDEX = APP / "primaryColoursV273Index.json"
AUDIT = GEO / "primary-colours-v273-audit.json.gz"
PATTERN = re.compile(
  r"^(?:(?:ring182|city183|outer187|north190|east200|marzahn230)-)?-?\d+_-?\d+$"
)


def shard_for(key: str) -> int:
  """Keep one immutable source receipt in a small deterministic data shard."""
  return int(hashlib.sha256(key.encode()).hexdigest()[:8], 16) % SHARDS


def primary_tiles() -> list[dict]:
  """Use the complete retained seven-family inventory, including empty tiles."""
  manifest = prior.base.read_json(OUT / "manifest.json")
  return sorted(
    (row for row in manifest["chunks"] if PATTERN.fullmatch(row["id"])),
    key=lambda row: row["id"],
  )


def build() -> dict:
  """Compile independent exact-corner receipts and the full coverage audit."""
  shards: list[dict] = [{} for _ in range(SHARDS)]
  proofs: list[dict] = [{} for _ in range(SHARDS)]
  audit, index = {}, {}
  totals = Counter()
  owners = {mode: set() for mode in ("drawn", "minecraft")}
  for number, descriptor in enumerate(primary_tiles()):
    tile = descriptor["id"]
    for mode in ("drawn", "minecraft"):
      source = OUT / descriptor[mode]["url"]
      payload = source.read_bytes()
      digest = hashlib.sha256(payload).hexdigest()
      assert digest == descriptor[mode]["sha256"], source
      packet = prior.base.read_json(source)
      records, detail = [], []
      key = f"{mode}:{tile}"
      for mesh, part in enumerate(packet["meshes"]):
        if part["kind"] != "city":
          continue
        rows, proof = prior.analyse(packet, part)
        totals[f"{mode}Ambiguous"] += proof["ambiguousGenericVertices"]
        # Existing nine-tile proof stays the owner of its already-fixed corners.
        if tile in prior.TILES:
          totals[f"{mode}PreviouslyResolved"] += len(rows)
          continue
        if not rows:
          continue
        ids = sorted({row[1] for row in rows})
        id_lookup = {owner: i for i, owner in enumerate(ids)}
        records.append(
          dict(
            mesh=mesh,
            fingerprint=prior.fingerprint(
              [part["positions"], part["colors"], part["indices"]]
            ),
            owners=ids,
            rows=[[row[0], id_lookup[row[1]], *row[2:]] for row in rows],
          )
        )
        detail.append(dict(mesh=mesh, **proof))
        totals[f"{mode}Resolved"] += len(rows)
        owners[mode].update(ids)
      audit[key] = dict(
        sha256=digest,
        bounds=descriptor["bounds"],
        sourceOwners=len({row["sourceId"] for row in packet["nav"]["buildings"]}),
        resolvedVertices=sum(len(row["rows"]) for row in records),
        previous=tile in prior.TILES,
      )
      if records:
        shard = shard_for(key)
        shards[shard][key] = dict(
          origin=packet["origin"],
          guard=prior.nav_fingerprint(packet["nav"]),
          records=records,
        )
        proofs[shard][key] = detail
        index[key] = shard
    if number % 50 == 0:
      print(json.dumps(dict(tiles=number + 1, **totals)), flush=True)
  outputs = {}
  for shard, packets in enumerate(shards):
    path = APP / f"primaryColoursV273_{shard:02}.json"
    prior.base.write_json(
      path, dict(schemaVersion=1, keys=list(packets), packets=packets)
    )
    assert path.stat().st_size < 5 * 1024**2, path
    evidence = GEO / f"primary-colours-v273-proof-{shard:02}.json.gz"
    prior.base.write_json(evidence, proofs[shard])
    assert evidence.stat().st_size < 5 * 1024**2, evidence
    outputs[path.name] = dict(
      sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
      bytes=path.stat().st_size,
      evidenceSha256=hashlib.sha256(evidence.read_bytes()).hexdigest(),
    )
  prior.base.write_json(INDEX, index)
  result = dict(
    schemaVersion=1,
    manifestSha256=hashlib.sha256((OUT / "manifest.json").read_bytes()).hexdigest(),
    policy="Complete retained primary-family audit; exact original default colours, complete source wall quads and unanimous incident triangle ownership only. Keep true ambiguity, all geometry, known materials and authored detail. Existing v263 nine-tile receipts remain intact. Drawn/native proofs are independent.",
    packets=audit,
    outputs=outputs,
    totals=dict(totals),
    distinctCorrectedOwners={mode: len(ids) for mode, ids in owners.items()},
  )
  prior.base.write_json(AUDIT, result)
  print(json.dumps({**totals, "packets": len(audit), "receipts": len(index)}))
  return result


if __name__ == "__main__":
  build()
