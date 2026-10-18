"""Step 10: recover mapped ordinary outer-house materials without new geometry."""

from __future__ import annotations

import base64
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import pyogrio
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from scripts import build_alt_mitte_appearance_v213 as appearance
from scripts import build_district_facades_v188 as base

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
CONTEXT = GEO / "outer-materials-v232-context.json.gz"
EVIDENCE = GEO / "outer-materials-v232-evidence.json.gz"
OUTPUT = ROOT / "src/app/src/data/outerMaterialsV232.json"
PREFIXES = ("outer187-", "east200-", "north190-", "marzahn230-")
KEYS = (
  "building:colour",
  "facade:colour",
  "building:material",
  "facade:material",
  "roof:colour",
  "roof:material",
)
WALL = appearance.linear((211, 208, 195))
ROOF = appearance.linear((157, 151, 140))
POLICY = (
  "Only mapped ordinary unnamed buildings with a unique reciprocal >=97% "
  "OSM/source-footprint match. Existing source packets and geometry stay exact; "
  "only unambiguously owned original generic wall/roof colour cells change. "
  "Source colour names take priority; uncoloured material swatches and static "
  "lighting are illustrative. No new windows, geometry, coverage or live budgets."
)


def extract_context(path: Path | None = None) -> None:
  """Retain only non-personal material tags and complete permitted footprints."""
  source = GEO / "raw/outer-v159/candidate.gpkg"
  frame = pyogrio.read_dataframe(
    path or source,
    **(
      {}
      if path
      else dict(
        layer="multipolygons",
        where=(
          "building IN ('yes','apartments','residential','house','detached','terrace',"
          "'semidetached_house') AND (other_tags LIKE '%:colour%' OR "
          "other_tags LIKE '%:material%')"
        ),
      )
    ),
  ).to_crs(25833)
  records = []
  for row in frame.itertuples():
    if any(
      isinstance(getattr(row, k, None), str) for k in ("name", "amenity", "tourism")
    ):
      continue
    tags = dict(re.findall(r'"([^"\\]+)"=>"([^"\\]*)"', str(row.other_tags)))
    tags = {k: tags[k] for k in KEYS if k in tags}
    if not tags:
      continue
    geometry = base.world(row.geometry)
    if not geometry.is_valid or geometry.area < 35:
      continue
    osm = (
      "OSM-way-" + str(row.osm_way_id)
      if isinstance(row.osm_way_id, str) and row.osm_way_id
      else "OSM-relation-" + str(row.osm_id)
    )
    records.append(dict(id=osm, tags=tags, geometry=mapping(geometry)))
  base.write_json(
    CONTEXT,
    dict(
      source=source.relative_to(ROOT).as_posix(),
      sha256=appearance.digest(source),
      records=sorted(records, key=lambda r: r["id"]),
    ),
  )


def protected_owners() -> set[str]:
  """Prior individually authored bodies and facade passes always win."""
  owners = set(
    base.read_json(GEO / "outer-facades-v230-context.json.gz")["authoredIds"]
  )
  for pattern in (
    "src/app/src/data/*.json",
    "src/app/src/*.ts",
    "src/app/src/*Source.json",
    "src/app/src/*Prisms.json",
  ):
    for path in ROOT.glob(pattern):
      if path.name not in {"buildingAttributeSource.json", OUTPUT.name}:
        owners.update(
          re.findall(
            r"\b(?:DEBE[A-Za-z0-9]+|OSM-(?:way|relation)-\d+)", path.read_text()
          )
        )
  for name in (
    "district-facades-v188-evidence.json.gz",
    "kiez-facades-v209-evidence.json.gz",
    "outer-facades-v230-evidence.json.gz",
  ):
    owners.update(f["owner"] for f in base.read_json(GEO / name)["faces"])
  return owners


def tones(tags: dict[str, str]) -> tuple[Any, Any]:
  """Reject conflicting/ambiguous tags rather than assign a guessed paint."""
  wall_colours = {
    tags[k].strip().lower() for k in ("building:colour", "facade:colour") if tags.get(k)
  }
  materials = {
    tags[k].strip().lower()
    for k in ("building:material", "facade:material")
    if tags.get(k)
  }
  wall = None
  if len(wall_colours) == 1:
    wall = appearance.colour(next(iter(wall_colours)))
  elif not wall_colours and len(materials) == 1:
    wall = appearance.WALL_MATERIAL.get(next(iter(materials)))
  roof = (
    appearance.colour(tags["roof:colour"])
    if tags.get("roof:colour")
    else appearance.ROOF_MATERIAL.get(tags.get("roof:material"))
  )
  return wall, roof


def owned_colours(
  part: dict, packet: dict, selected: dict, native: bool = False
) -> tuple[dict, set[str]]:
  """Require exact existing source wall/cap geometry and unanimous ownership."""
  pos = (
    np.frombuffer(base64.b64decode(part["positions"]), "<u2")
    .reshape(-1, 3)
    .astype(float)
    / 100
    + packet["origin"]
  )
  rgb = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
  rows, heights, vertex_owners = [], {}, {}
  ox, _, oz = packet["origin"]
  for b in packet["nav"]["buildings"]:
    p = translate(Polygon(b["ring"], b["holes"]), ox, oz)
    if not p.is_valid or p.is_empty:
      continue
    low = packet["nav"]["groundY"] + b.get("groundOffset", 0) + b["minHeight"]
    high = packet["nav"]["groundY"] + b.get("groundOffset", 0) + b["height"]
    rows.append((b["sourceId"], p, low, high))
    previous = heights.get(b["sourceId"], (low, high))
    heights[b["sourceId"]] = (low, high) if previous == (low, high) else None
  tree = STRtree([p.buffer(0.018) for _, p, _, _ in rows])
  assignments, accepted = [], set()
  for tri in indices:
    before = tuple(int(x) for x in rgb[tri[0]])
    if before not in {WALL, ROOF} or not np.all(rgb[tri] == before):
      assignments.append(None)
      continue
    pts = pos[tri]
    center = Point(np.mean(pts[:, [0, 2]], axis=0))
    candidates = []
    for j in tree.query(center):
      owner, footprint, low, high = rows[j]
      if before == ROOF:
        fits = np.max(np.abs(pts[:, 1] - high)) <= 0.018 and footprint.buffer(
          0.018
        ).covers(Polygon(pts[:, [0, 2]]))
      else:
        fits = (
          abs(pts[:, 1].min() - low) <= 0.018
          and abs(pts[:, 1].max() - high) <= 0.018
          and footprint.boundary.buffer(0.018).covers(LineString(pts[:, [0, 2]]))
        )
      if fits:
        candidates.append(owner)
    if len(set(candidates)) != 1 or candidates[0] not in selected:
      assignments.append(None)
      continue
    owner = candidates[0]
    tone = selected[owner]["roof" if before == ROOF else "wall"]
    if tone is None:
      assignments.append(None)
      continue
    assignments.append(appearance.linear(tuple(tone)))
    accepted.add(owner)
    for vertex in tri:
      vertex_owners[int(vertex)] = owner
  values = appearance.unanimous_vertex_colours(indices, assignments, rgb)
  if not native:
    # Preserve the existing v211 grounding wash, including its source-owner
    # ambiguity rule. Native blocks keep the independent flat colour reading.
    for vertex, tone in values.items():
      bounds = heights[vertex_owners[vertex]]
      if tuple(rgb[vertex]) != WALL or bounds is None or bounds[1] <= bounds[0]:
        continue
      height = max(
        0.0, min(1.0, (pos[vertex, 1] - bounds[0]) / (bounds[1] - bounds[0]))
      )
      light = 0.88 + 0.13 * height
      values[vertex] = tuple(
        min(255, int(np.floor(channel * light + 0.5))) for channel in tone
      )
  return values, accepted


def build() -> dict:
  """Compile deterministic colour-only receipts without modifying any packet."""
  if not CONTEXT.exists():
    extract_context()
  context = base.read_json(CONTEXT)
  candidates = context["records"]
  mapped = [shape(r["geometry"]) for r in candidates]
  tree = STRtree(mapped)
  protected = protected_owners()
  manifest = base.read_json(OUT / "manifest.json")
  descs = [
    d
    for d in manifest["chunks"]
    if d["id"].startswith(PREFIXES) and not d.get("detailCompanionOf")
  ]
  outlines = defaultdict(list)
  for desc in descs:
    p = base.read_json(OUT / desc["drawn"]["url"])
    ox, _, oz = p["origin"]
    for b in p["nav"]["buildings"]:
      if (
        b["sourceId"] not in protected
        and b["minHeight"] <= 0.1
        and 3 <= b["height"] <= 42
      ):
        poly = translate(Polygon(b["ring"], b["holes"]), ox, oz)
        if poly.is_valid and not poly.is_empty:
          outlines[b["sourceId"]].append(poly)
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
    wall, roof = tones(candidates[i]["tags"])
    if wall is not None or roof is not None:
      selected[owner] = dict(
        osm=candidates[i]["id"],
        tags=candidates[i]["tags"],
        coverage=coverage,
        wall=wall,
        roof=roof,
      )
  output: dict = dict(schemaVersion=1, palette=[], packets={})
  palette_lookup, assets, owners, counts = {}, [], set(), Counter()
  for desc in descs:
    for family in ("drawn", "minecraft"):
      path = OUT / desc[family]["url"]
      p = base.read_json(path)
      if not any(b["sourceId"] in selected for b in p["nav"]["buildings"]):
        continue
      receipts = []
      for m, part in enumerate(p["meshes"]):
        if part["kind"] != "city":
          continue
        values, accepted = owned_colours(part, p, selected, family == "minecraft")
        if not values:
          continue
        owners.update(accepted)
        counts[family + "Vertices"] += len(values)
        runs = appearance.runs_for(values, output["palette"], palette_lookup)
        receipts.append(
          dict(
            mesh=m,
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
    protectedOwners=sorted(protected),
    owners={k: selected[k] for k in sorted(owners)},
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
