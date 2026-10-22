"""Step 10: mapped material colours for bounded legacy-city grey clusters."""

from __future__ import annotations

import base64
import re
from collections import Counter

import numpy as np

from scripts import build_outer_materials_v254 as previous

base, appearance = previous.base, previous.appearance
ROOT, GEO, OUT = previous.ROOT, previous.GEO, previous.OUT
CONTEXT = previous.CONTEXT
EVIDENCE = GEO / "outer-materials-v263-evidence.json.gz"
OUTPUT = ROOT / "src/app/src/data/outerMaterialsV263.json"
# Frozen 512 m legacy packets with retained explicit material observations.
# Selection is finite; packet reads and geometry ownership remain serial.
TILES = (
  "7_-3",
  "-10_3",
  "-8_6",
  "6_-3",
  "2_-7",
  "6_-4",
  "2_6",
  "3_5",
  "7_-2",
  "8_-1",
  "-4_6",
  "5_-6",
  "-7_6",
  "-3_6",
  "3_-7",
  "-8_7",
)
POLICY = (
  "Incremental colour-only interpretation of retained OSM material observations "
  "in sixteen legacy numeric city packets omitted by v232 and v254. Require "
  "unique reciprocal >=97% complete footprint coverage, original generic paint, "
  "exact source wall/cap surfaces and unanimous shared-vertex ownership. Protect "
  "earlier material and authored/facade/roof owners. No geometry, coverage, "
  "packet, runtime budget, palette fallback or source tag changes. Source colour "
  "takes priority; uncoloured material swatches and wall wash remain estimates."
)


def protected_owners() -> tuple[set[str], list[dict]]:
  """Extend the frozen prior audit only with the bounded intervening sources."""
  old = base.read_json(previous.EVIDENCE)
  protected = set(old["protectedOwners"]) | set(old["owners"])
  paths = [previous.EVIDENCE, previous.OUTPUT, previous.previous.OUTPUT]
  paths.extend(
    path
    for version in range(255, 263)
    for path in sorted((ROOT / "src/app/src/data").glob(f"*V{version}.json"))
  )
  paths.extend(
    [
      GEO / "outer-facades-v262-evidence.json.gz",
      GEO / "outer-roofs-v262-source.json.gz",
    ]
  )
  for path in paths:
    content = str(base.read_json(path))
    protected.update(
      re.findall(r"\b(?:DEBE[A-Za-z0-9]+|OSM-(?:way|relation)-\d+)", content)
    )
  return protected, [
    dict(path=path.relative_to(ROOT).as_posix(), sha256=appearance.digest(path))
    for path in paths
  ]


def build() -> dict:
  """Compile colour receipts without modifying any old packet or recipe."""
  protected, protection_sources = protected_owners()
  by_id = {row["id"]: row for row in base.read_json(OUT / "manifest.json")["chunks"]}
  descs = [by_id[tile] for tile in TILES]
  selected = previous.select_owners(descs, protected)
  output: dict = dict(schemaVersion=1, palette=[], packets={})
  palette_lookup, assets, owners, counts = {}, [], set(), Counter()
  for desc in descs:
    for family in ("drawn", "minecraft"):
      path = OUT / desc[family]["url"]
      packet = base.read_json(path)
      if not any(row["sourceId"] in selected for row in packet["nav"]["buildings"]):
        continue
      receipts = []
      for mesh, part in enumerate(packet["meshes"]):
        if part["kind"] != "city":
          continue
        values, accepted = previous.previous.owned_colours(
          part, packet, selected, family == "minecraft"
        )
        if not values:
          continue
        owners.update(accepted)
        counts[family + "Vertices"] += len(values)
        runs = appearance.runs_for(values, output["palette"], palette_lookup)
        receipts.append(
          dict(
            mesh=mesh,
            fingerprint=appearance.fingerprint(part),
            runs=base64.b64encode(np.array(runs, "<u4").tobytes()).decode(),
          )
        )
      if receipts:
        output["packets"][family + ":" + desc["id"]] = receipts
        assets.append(dict(url=path.name, sha256=appearance.digest(path)))
  evidence = dict(
    policy=POLICY,
    contextSha256=appearance.digest(CONTEXT),
    protectionSources=protection_sources,
    selectedTiles=list(TILES),
    protectedOwners=sorted(protected),
    owners={owner: selected[owner] for owner in sorted(owners)},
    sourceAssets=previous.source_assets(descs, owners),
    assets=assets,
    counts=dict(counts),
  )
  base.write_json(OUTPUT, output)
  base.write_json(EVIDENCE, evidence)
  print(
    dict(
      owners=len(owners),
      packets=len(output["packets"]),
      runtimeBytes=OUTPUT.stat().st_size,
      **counts,
    ),
    flush=True,
  )
  return evidence


if __name__ == "__main__":
  build()
