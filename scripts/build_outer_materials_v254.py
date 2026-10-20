"""Step 10: recover mapped materials in the omitted existing Ringbahn packets."""

from __future__ import annotations

import base64
from collections import Counter, defaultdict

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from scripts import build_outer_materials_v232 as previous

base, appearance = previous.base, previous.appearance
ROOT, GEO, OUT = previous.ROOT, previous.GEO, previous.OUT
CONTEXT = previous.CONTEXT
EVIDENCE = GEO / "outer-materials-v254-evidence.json.gz"
OUTPUT = ROOT / "src/app/src/data/outerMaterialsV254.json"
PREFIXES = ("ring182-", "city183-")
ROOFS = GEO / "roof-house-v233-source.json.gz"
POLICY = (
  "Incremental colour-only interpretation of retained OSM material observations "
  "on ordinary unnamed owners in existing ring182/city183 packets omitted by "
  "v232. Require unique reciprocal >=97% complete footprint coverage, exact "
  "original generic wall/cap surfaces and unanimous shared-vertex ownership. "
  "Protect every earlier authored/facade owner and every v232 material owner. "
  "Preserve all geometry, source paint, prior details and runtime budgets. "
  "Material swatches and height-relative lighting remain display estimates."
)


def select_owners(descs: list[dict], protected: set[str]) -> dict:
  """Join complete retained owners to the existing six-tag evidence extract."""
  candidates = base.read_json(CONTEXT)["records"]
  mapped = [shape(row["geometry"]) for row in candidates]
  tree = STRtree(mapped)
  outlines: dict[str, list] = defaultdict(list)
  for desc in descs:
    packet = base.read_json(OUT / desc["drawn"]["url"])
    ox, _, oz = packet["origin"]
    for row in packet["nav"]["buildings"]:
      if (
        row["sourceId"] in protected
        or row["minHeight"] > 0.1
        or not 3 <= row["height"] <= 42
      ):
        continue
      polygon = translate(Polygon(row["ring"], row["holes"]), ox, oz)
      if polygon.is_valid and not polygon.is_empty:
        outlines[row["sourceId"]].append(polygon)
  selected = {}
  for owner, parts in sorted(outlines.items()):
    geometry = unary_union(parts)
    matches = []
    for i in tree.query(geometry):
      overlap = geometry.intersection(mapped[i]).area
      coverage = overlap / geometry.area, overlap / mapped[i].area
      if min(coverage) >= 0.97:
        matches.append((int(i), coverage))
    if len(matches) != 1:
      continue
    i, coverage = matches[0]
    wall, roof = previous.tones(candidates[i]["tags"])
    if wall is not None or roof is not None:
      selected[owner] = dict(
        osm=candidates[i]["id"],
        tags=candidates[i]["tags"],
        coverage=coverage,
        wall=wall,
        roof=roof,
      )
  return selected


def source_assets(descs: list[dict], owners: set[str]) -> list[dict]:
  """Keep complete drawn match inputs, including native-only colour receipts."""
  assets = []
  for desc in descs:
    path = OUT / desc["drawn"]["url"]
    packet = base.read_json(path)
    if any(row["sourceId"] in owners for row in packet["nav"]["buildings"]):
      assets.append(dict(url=path.name, sha256=appearance.digest(path)))
  return assets


def build() -> dict:
  """Compile finite receipts; never rewrite source geometry or old receipts."""
  protected = previous.protected_owners()
  protected.update(base.read_json(previous.EVIDENCE)["owners"])
  protected.update(row["owner"] for row in base.read_json(ROOFS)["owners"])
  descs = [
    row
    for row in base.read_json(OUT / "manifest.json")["chunks"]
    if row["id"].startswith(PREFIXES) and not row.get("detailCompanionOf")
  ]
  selected = select_owners(descs, protected)
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
        values, accepted = previous.owned_colours(
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
    previousReceiptSha256=appearance.digest(previous.OUTPUT),
    roofSourceSha256=appearance.digest(ROOFS),
    protectedOwners=sorted(protected),
    owners={owner: selected[owner] for owner in sorted(owners)},
    sourceAssets=source_assets(descs, owners),
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
