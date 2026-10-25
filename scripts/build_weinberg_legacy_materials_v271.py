"""Step 10: finite material receipts for retained v166/v168 Weinberg shells.

Original measured surfaces, courts, native blocks and navigation remain exact.
This covers the earlier shell layers omitted by the separate Alt-Mitte169 pass.
Unobserved plaster/roof tones are illustration estimates, not surveyed paint.
"""

from __future__ import annotations

import base64
import gzip
import json
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from scripts import build_alt_mitte_appearance_v213 as prior
from scripts.build_north_mitte_colours_v271 import palette

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = prior.APP / "weinbergLegacyMaterialsV271.json"
INDEX = prior.APP / "weinbergLegacyMaterialsV271Index.json"
EVIDENCE = prior.GEO / "weinberg-legacy-materials-v271-evidence.json.gz"
CONTEXT = prior.GEO / "outer-materials-v232-context.json.gz"
OFFSETS = prior.APP / "weinbergBuildingOffsetsV176.json"
SOURCES = {
  "mitte-street-fronts-v166": prior.GEO / "mitte-streets-v166.json",
  "scheunenviertel-v168": prior.GEO / "scheunenviertel-v168.json",
}
BOUNDS = (1770, -1600, 2250, -1080)
WALL = (211, 208, 197)
ROOF = (160, 159, 151)


def footprint(parts: list[dict]) -> shapely.Geometry:
  """Union complete measured ground rings, retaining every source court hole."""
  return unary_union(
    [
      shapely.make_valid(
        Polygon(
          [[p[0], p[2]] for p in sheet["rings"][0]],
          [[[p[0], p[2]] for p in ring] for ring in sheet["rings"][1:]],
        )
      )
      for part in parts
      for sheet in part["surfaces"]
      if sheet["kind"] == "GroundSurface"
    ]
  )


def material_tones(tags: dict) -> tuple[prior.RGB | None, prior.RGB | None]:
  """Respect explicit single colours before mapped material display swatches."""
  colours = {
    str(tags[k]).strip().lower()
    for k in ("building:colour", "facade:colour")
    if tags.get(k)
  }
  materials = {
    str(tags[k]).strip().lower()
    for k in ("building:material", "facade:material")
    if tags.get(k)
  }
  wall = None
  if len(colours) == 1:
    wall = prior.colour(next(iter(colours)))
  elif not colours and len(materials) == 1:
    wall = prior.WALL_MATERIAL.get(next(iter(materials)))
  roof = (
    prior.colour(tags["roof:colour"])
    if tags.get("roof:colour")
    else prior.ROOF_MATERIAL.get(tags.get("roof:material"))
  )
  return wall, roof


def mapped_context(
  ground: shapely.Geometry, rows: list, geometries: list, tree: STRtree
) -> tuple[dict, list[float]]:
  """Accept exactly one independently mapped footprint at >=97% both ways."""
  matches = []
  for index in tree.query(ground):
    mapped = geometries[int(index)]
    if min(ground.area, mapped.area) <= 0:
      continue
    common = ground.intersection(mapped).area
    coverage = [common / ground.area, common / mapped.area]
    if min(coverage) >= 0.97:
      matches.append((rows[int(index)], coverage))
  return matches[0] if len(matches) == 1 else ({}, [])


def source_selectors() -> tuple[dict, dict, list, dict]:
  """Create independent drawn source-plane and native envelope ownership proofs."""
  context = prior.read(CONTEXT)["records"]
  mapped = [shapely.make_valid(shape(row["geometry"])) for row in context]
  mapped_tree = STRtree(mapped)
  offsets = prior.read(OFFSETS)["offsets"]
  surfaces: dict[str, list] = defaultdict(list)
  native: dict[str, list] = defaultdict(list)
  evidence, counts = [], Counter()
  review = box(*BOUNDS)
  for kind, path in SOURCES.items():
    records = prior.read(path)["buildings"]
    grounds = {row["id"]: footprint(row["parts"]) for row in records}
    selected = {row["id"] for row in records if grounds[row["id"]].intersects(review)}
    # Native surface cells can touch adjacent source families. Keep neighbours
    # as blockers, including source owners outside the finite review rectangle.
    area = unary_union([grounds[owner] for owner in selected]).buffer(5.7)
    for record in records:
      owner = record["id"]
      ground = grounds[owner]
      if not ground.intersects(area):
        continue
      eligible = owner in selected
      context_row, coverage = mapped_context(ground, context, mapped, mapped_tree)
      tags = context_row.get("tags", {})
      mapped_wall, mapped_roof = material_tones(tags)
      wall, roof = palette(owner)
      wall, roof = mapped_wall or wall, mapped_roof or roof
      # A contradictory/unrecognized material observation is evidence to retain
      # that source role, never permission to replace it with an invented hue.
      wall_observed = any(
        tags.get(k)
        for k in (
          "building:colour",
          "facade:colour",
          "building:material",
          "facade:material",
        )
      )
      roof_observed = bool(tags.get("roof:colour") or tags.get("roof:material"))
      glass = any(
        tags.get(k) == "glass" for k in ("building:material", "facade:material")
      )
      wall_allowed = (
        eligible and not glass and (not wall_observed or mapped_wall is not None)
      )
      roof_allowed = (
        eligible and not glass and (not roof_observed or mapped_roof is not None)
      )
      offset = float(offsets.get(owner, 0))
      if eligible:
        counts[kind + "SelectedFamilies"] += 1
        counts["mappedWallFamilies"] += int(mapped_wall is not None)
        counts["mappedRoofFamilies"] += int(mapped_roof is not None)
        evidence.append(
          {
            "id": owner,
            "kind": kind,
            "parts": [part["id"] for part in record["parts"]],
            "bounds": list(ground.bounds),
            "centroid": [ground.centroid.x, ground.centroid.y],
            "offsetY": offset,
            "contextId": context_row.get("id"),
            "contextCoverage": coverage,
            "tags": tags,
            "wallEligible": wall_allowed,
            "roofEligible": roof_allowed,
            "wallSrgb": wall,
            "roofSrgb": roof,
            "wallEvidence": "mapped colour/material"
            if mapped_wall
            else "illustrative unknown paint",
            "roofEvidence": "mapped colour/material"
            if mapped_roof
            else "illustrative unknown material",
          }
        )
      for part in record["parts"]:
        for sheet in part["surfaces"]:
          if sheet["kind"] not in {"WallSurface", "RoofSurface"}:
            continue
          is_roof = sheet["kind"] == "RoofSurface"
          old = ROOF if is_roof else WALL
          surface = prior.make_surface(
            owner, part["id"], sheet, old, roof if is_roof else wall, offset
          )
          if surface:
            # v163 outer_detail (used by v166/v168) packs flat linear bytes;
            # v169's later per-plane shade must NOT identify these old shells.
            surface.before = prior.linear(old)
            # Earlier shells share original vertices at facade corners. Keep
            # a single owner tone so no plane-dependent light would require a
            # new split vertex or incorrectly reject an otherwise exact house.
            surface.after = prior.linear(roof if is_roof else wall)
            surface.allowed = roof_allowed if is_roof else wall_allowed
            surfaces[kind].append(surface)
        ground_part = footprint([part])
        points = np.asarray(
          [p for sheet in part["surfaces"] for ring in sheet["rings"] for p in ring]
        )
        if ground_part.is_empty or not len(points):
          continue
        for role, before, after, allowed in (
          ("WallSurface", WALL, wall, wall_allowed),
          ("RoofSurface", ROOF, roof, roof_allowed),
        ):
          native[kind].append(
            prior.NativePart(
              owner,
              part["id"],
              ground_part.buffer(2.84),
              float(points[:, 1].min()) + offset,
              float(points[:, 1].max()) + offset,
              ((role, prior.linear(before), prior.linear(after)),),
              allowed,
            )
          )
  return dict(surfaces), dict(native), evidence, dict(counts)


def packet_paths(bounds: tuple[float, ...]):
  """Only stream tiles intersecting complete source families, not the full city."""
  area = box(*bounds)
  for item in prior.read(prior.PUBLIC / "manifest.json")["chunks"]:
    if not box(*item["bounds"]).intersects(area):
      continue
    for mode in ("drawn", "minecraft"):
      yield mode, item["id"], prior.PUBLIC / item[mode]["url"]


def build(*, write: bool = True) -> dict:
  """Compile small colour-only receipts against unchanged published meshes."""
  surfaces, native, owner_evidence, source_counts = source_selectors()
  drawn_trees = {
    kind: STRtree([s.bounds_xz for s in rows]) for kind, rows in surfaces.items()
  }
  native_trees = {
    kind: STRtree([p.footprint for p in rows]) for kind, rows in native.items()
  }
  bounds = tuple(shapely.total_bounds([box(*row["bounds"]) for row in owner_evidence]))
  output = {"schemaVersion": 1, "palette": [], "packets": {}}
  lookup: dict[int, int] = {}
  counts: dict[str, Counter] = defaultdict(Counter)
  owners: dict[str, set] = defaultdict(set)
  receipts = []
  for mode, identity, path in packet_paths(bounds):
    packet = prior.read(path)
    entries, selected = [], 0
    is_native = mode == "minecraft"
    for ordinal, part in enumerate(packet["meshes"]):
      kind = part["kind"]
      if kind not in SOURCES:
        continue
      values = prior.compile_mesh(
        part,
        packet["origin"],
        surfaces[kind],
        native[kind],
        is_native,
        native_trees[kind] if is_native else drawn_trees[kind],
        native[kind] if is_native else surfaces[kind],
        counts[mode],
        owners[mode],
      )
      if values:
        selected += len(values)
        entries.append(
          {
            "mesh": ordinal,
            "kind": kind,
            "fingerprint": prior.fingerprint(part),
            "runs": base64.b64encode(
              np.asarray(
                prior.runs_for(values, output["palette"], lookup), dtype="<u4"
              ).tobytes()
            ).decode(),
          }
        )
    if entries:
      output["packets"][mode + ":" + identity] = entries
      receipts.append(
        {
          "file": str(path.relative_to(ROOT)),
          "sha256": prior.digest(path),
          "mode": mode,
          "selectedVertices": selected,
        }
      )
      print(f"{mode}:{identity}: {selected} existing colour vertices", flush=True)
  raw = (json.dumps(output, separators=(",", ":")) + "\n").encode()
  evidence = {
    "schemaVersion": 1,
    "bounds": BOUNDS,
    "sourceFiles": [
      {"file": str(path.relative_to(ROOT)), "sha256": prior.digest(path)}
      for path in (*SOURCES.values(), CONTEXT, OFFSETS)
    ],
    "sourceCounts": source_counts,
    "modeCounts": {k: dict(v) for k, v in counts.items()},
    "owners": owner_evidence,
    "ownersReceivingSelectors": {k: sorted(v) for k, v in owners.items()},
    "packetReceipts": receipts,
    "packetFilesChanged": 0,
    "runtimeBytes": len(raw),
    "runtimeGzipBytes": len(gzip.compress(raw, mtime=0)),
    "limits": [
      "Only complete retained v166/v168 families intersecting the finite west/south Weinberg rectangle.",
      "Unknown hues are contextual display estimates, not observed individual facade colours.",
      "Explicit mapped roles take precedence through unique >=97% reciprocal footprint joins.",
      "Only exact original generic source wall/roof vertices qualify; glazing and authored detail stay exact.",
      "Drawn and native proofs are independent; ambiguous shared native faces stay unchanged.",
      "No source topology, roof form, courts, navigation, packet bytes or live memory budgets change.",
    ],
  }
  if write:
    OUTPUT.write_bytes(raw)
    INDEX.write_text(
      json.dumps(sorted(output["packets"]), separators=(",", ":")) + "\n"
    )
    EVIDENCE.write_bytes(
      gzip.compress(json.dumps(evidence, separators=(",", ":")).encode(), mtime=0)
    )
  return {
    k: v
    for k, v in evidence.items()
    if k not in {"owners", "packetReceipts", "ownersReceivingSelectors"}
  }


if __name__ == "__main__":
  print(json.dumps(build(), indent=2))
