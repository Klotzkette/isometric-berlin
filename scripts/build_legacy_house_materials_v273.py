"""Step 10: citywide ordinary-house paint for the retained flat legacy shells.

All four original families are audited, never a neighbourhood sample. Source
geometry and authored detail stay immutable; unknown hues are display estimates.
"""

from __future__ import annotations

import base64
import gzip
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import pyogrio
import shapely
from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from scripts import build_alt_mitte_appearance_v213 as prior
from scripts import build_weinberg_legacy_materials_v271 as legacy
from scripts.build_alt_mitte_protection_v213 import aliases
from scripts.build_north_mitte_colours_v271 import palette

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = prior.APP / "legacyHouseMaterialsV273.json"
INDEX = prior.APP / "legacyHouseMaterialsV273Index.json"
EVIDENCE = prior.GEO / "legacy-house-materials-v273-evidence.json.gz"
CONTEXT = prior.GEO / "legacy-house-materials-v273-context.json.gz"
SOURCES = {
  "city-west-street-fronts-v163": prior.GEO / "west-streets-v163.json",
  "mitte-street-fronts-v166": prior.GEO / "mitte-streets-v166.json",
  "oranien-corridors-v167": prior.GEO / "oranien-corridors-v167.json",
  "scheunenviertel-v168": prior.GEO / "scheunenviertel-v168.json",
}
ORDINARY = {
  "apartments",
  "residential",
  "house",
  "detached",
  "terrace",
  "semidetached_house",
  "bungalow",
  "retail",
  "commercial",
  "office",
  "mixed_use",
}
TAG_KEYS = {
  "building",
  "name",
  "amenity",
  "tourism",
  "historic",
  "religion",
  "leisure",
  "building:colour",
  "facade:colour",
  "building:material",
  "facade:material",
  "roof:colour",
  "roof:material",
}
WALL, ROOF = legacy.WALL, legacy.ROOF


def source_records() -> dict[str, list[dict]]:
  """Enumerate every retained family of each confirmed flat-shell source kind."""
  return {kind: prior.read(path)["buildings"] for kind, path in SOURCES.items()}


def extract_context() -> None:
  """Freeze only public building semantics and material observations at owners."""
  records = [r for rows in source_records().values() for r in rows]
  grounds = [legacy.footprint(r["parts"]) for r in records]
  tree = STRtree(grounds)
  bounds = shapely.total_bounds(grounds)
  transformer = Transformer.from_crs(25833, 4326, always_xy=True)
  west, south, east, north = transformer.transform_bounds(
    bounds[0] + 389500,
    5820000 - bounds[3],
    bounds[2] + 389500,
    5820000 - bounds[1],
    densify_pts=21,
  )
  path = prior.GEO / "raw/outer-v159/candidate.gpkg"
  frame = pyogrio.read_dataframe(
    path,
    layer="multipolygons",
    bbox=(west - 0.002, south - 0.002, east + 0.002, north + 0.002),
    where="building IS NOT NULL",
  ).to_crs(25833)
  result = []
  for row in frame.itertuples():
    geometry = shapely.make_valid(
      affine_transform(row.geometry, [1, 0, 0, -1, -389500, 5820000])
    )
    if geometry.is_empty or not any(
      grounds[int(i)].intersection(geometry).area > 1 for i in tree.query(geometry)
    ):
      continue
    tags = dict(re.findall(r'"([^"\\]+)"=>"([^"\\]*)"', str(row.other_tags)))
    for key in TAG_KEYS:
      value = getattr(row, key, None)
      if isinstance(value, str) and value:
        tags[key] = value
    tags = {key: tags[key] for key in sorted(TAG_KEYS) if tags.get(key)}
    identity = (
      "OSM-way-" + row.osm_way_id
      if isinstance(row.osm_way_id, str) and row.osm_way_id
      else "OSM-relation-" + row.osm_id
    )
    result.append({"id": identity, "tags": tags, "geometry": mapping(geometry)})
  payload = {
    "source": str(path.relative_to(ROOT)),
    "sourceSha256": prior.digest(path),
    "records": sorted(result, key=lambda r: r["id"]),
  }
  CONTEXT.write_bytes(
    gzip.compress(json.dumps(payload, separators=(",", ":")).encode(), mtime=0)
  )


def ordinary_tags(tags: dict) -> bool:
  """Positive building use, excluding named or institutional/special structures."""
  # `building=yes` confirms only a building, not an ordinary use. These older
  # geometry-only source families retain no official function to fill that gap.
  return tags.get("building") in ORDINARY and not any(
    tags.get(key)
    for key in ("name", "amenity", "tourism", "historic", "religion", "leisure")
  )


def ordinary_context(
  ground: Any, rows: list, geometries: list, tree: STRtree
) -> tuple[bool, list[str], float]:
  """A complete LoD2 parent can consist of several ordinary mapped houses.

  Require 90% complete-family plan coverage and only ordinary substantive overlaps;
  small edge slivers are not semantic owners. No footprint is clipped or altered.
  """
  candidates = []
  for index in tree.query(ground):
    index = int(index)
    mapped = geometries[index]
    common = ground.intersection(mapped).area
    if common > 1 and (
      common / ground.area >= 0.02 or common / max(mapped.area, 1) >= 0.25
    ):
      candidates.append(index)
  if not candidates:
    return False, [], 0.0
  cover = (
    ground.intersection(unary_union([geometries[i] for i in candidates])).area
    / ground.area
  )
  return (
    cover >= 0.90 and all(ordinary_tags(rows[i]["tags"]) for i in candidates),
    [rows[i]["id"] for i in candidates],
    cover,
  )


def protection() -> tuple[set[str], list[dict]]:
  """Preserve exact later authored identities and every prior v271 owner."""
  ids = {r["id"] for rows in source_records().values() for r in rows}
  protected = {r["id"] for r in prior.read(legacy.EVIDENCE)["owners"]}
  receipts = [
    {
      "file": str(legacy.EVIDENCE.relative_to(ROOT)),
      "sha256": prior.digest(legacy.EVIDENCE),
    }
  ]
  # This is a source-identity guard, not colour inference. Terrain offsets are
  # explicitly not authored paint. Dedicated literal IDs and body products win.
  paths = sorted((ROOT / "src/app/src/data").glob("*.json")) + sorted(
    (ROOT / "src/app/src").glob("*.ts")
  )
  for path in paths:
    if path in {OUTPUT, INDEX} or path.name == "weinbergBuildingOffsetsV176.json":
      continue
    found = set(re.findall(r"\bDEBE[A-Za-z0-9]+", path.read_text())) & ids
    if found:
      protected.update(found)
      receipts.append(
        {
          "file": str(path.relative_to(ROOT)),
          "sha256": prior.digest(path),
          "ids": sorted(found),
        }
      )
  # Short aliases in older authored products are part identities, not names.
  old_protected = set(prior.read(prior.PROTECTED)["ids"])
  for rows in source_records().values():
    for row in rows:
      if aliases({row["id"], *(p["id"] for p in row["parts"])}) & old_protected:
        protected.add(row["id"])
  receipts.append(
    {
      "file": str(prior.PROTECTED.relative_to(ROOT)),
      "sha256": prior.digest(prior.PROTECTED),
    }
  )
  return protected, receipts


def source_selectors() -> tuple[dict, dict, list, dict, list]:
  """Build independent source-plane and block-envelope proofs for all owners."""
  context = prior.read(CONTEXT)["records"]
  mapped = [shapely.make_valid(shape(row["geometry"])) for row in context]
  tree = STRtree(mapped)
  offsets = prior.read(legacy.OFFSETS)["offsets"]
  protected, protection_receipts = protection()
  surfaces, native = defaultdict(list), defaultdict(list)
  evidence, counts = [], Counter()
  for kind, records in source_records().items():
    for record in records:
      owner = record["id"]
      ground = legacy.footprint(record["parts"])
      ordinary, semantic_ids, semantic_coverage = ordinary_context(
        ground, context, mapped, tree
      )
      mapped_row, coverage = legacy.mapped_context(ground, context, mapped, tree)
      tags = mapped_row.get("tags", {})
      mapped_wall, mapped_roof = legacy.material_tones(tags)
      wall, roof = palette(owner)
      wall, roof = mapped_wall or wall, mapped_roof or roof
      eligible = ordinary and owner not in protected and not record.get("name")
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
      # A weakly joined family still respects material observations on any
      # contributing mapped owner. Unknown paint must not overrule such evidence.
      contributing = [r for r in context if r["id"] in semantic_ids]
      weak_wall = not mapped_row and any(
        any(
          r["tags"].get(k)
          for k in (
            "building:colour",
            "facade:colour",
            "building:material",
            "facade:material",
          )
        )
        for r in contributing
      )
      weak_roof = not mapped_row and any(
        r["tags"].get("roof:colour") or r["tags"].get("roof:material")
        for r in contributing
      )
      wall_allowed = (
        eligible
        and not glass
        and not weak_wall
        and (not wall_observed or mapped_wall is not None)
      )
      roof_allowed = (
        eligible
        and not glass
        and not weak_roof
        and (not roof_observed or mapped_roof is not None)
      )
      offset = float(offsets.get(owner, 0)) if kind in legacy.SOURCES else 0.0
      evidence.append(
        {
          "id": owner,
          "kind": kind,
          "parts": [p["id"] for p in record["parts"]],
          "bounds": list(ground.bounds),
          "centroid": [ground.centroid.x, ground.centroid.y],
          "ordinary": ordinary,
          "semanticIds": semantic_ids,
          "semanticCoverage": semantic_coverage,
          "protected": owner in protected or bool(record.get("name")),
          "offsetY": offset,
          "contextId": mapped_row.get("id"),
          "contextCoverage": coverage,
          "tags": tags,
          "wallEligible": wall_allowed,
          "wallUnknown": not wall_observed and not weak_wall,
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
      counts[kind + "AuditedFamilies"] += 1
      counts[kind + "EligibleFamilies"] += int(wall_allowed or roof_allowed)
      counts["ordinaryFamilies"] += int(ordinary)
      counts["protectedFamilies"] += int(owner in protected)
      for part in record["parts"]:
        for sheet in part["surfaces"]:
          if sheet["kind"] not in {"WallSurface", "RoofSurface"}:
            continue
          is_roof = sheet["kind"] == "RoofSurface"
          old, new = (ROOF, roof) if is_roof else (WALL, wall)
          surface = prior.make_surface(owner, part["id"], sheet, old, new, offset)
          if surface:
            surface.before, surface.after = prior.linear(old), prior.linear(new)
            surface.allowed = roof_allowed if is_roof else wall_allowed
            surfaces[kind].append(surface)
        ground_part = legacy.footprint([part])
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
  return dict(surfaces), dict(native), evidence, dict(counts), protection_receipts


def shared_wall_components(
  surfaces: dict, native: dict, evidence: list[dict]
) -> tuple[dict[str, str], list[dict]]:
  """Give wholly ordinary unknown shared wall families one coherent flat tone.

  Source wall vertices identify source-parent components at delivered centimetre
  precision. Every member is audited before coalescing; a protected or observed
  member vetoes the whole component. Original triangles remain the final proof.
  """
  owner_rows = {row["id"]: row for row in evidence}
  components, report = {}, []
  for kind, records in source_records().items():
    parent = {row["id"]: row["id"] for row in records}

    def find(owner: str) -> str:
      while parent[owner] != owner:
        parent[owner] = parent[parent[owner]]
        owner = parent[owner]
      return owner

    def join(a: str, b: str) -> None:
      a, b = find(a), find(b)
      if a != b:
        parent[max(a, b)] = min(a, b)

    vertices = {}
    for row in records:
      owner = row["id"]
      offset = owner_rows[owner]["offsetY"]
      for part in row["parts"]:
        for sheet in part["surfaces"]:
          if sheet["kind"] != "WallSurface":
            continue
          for ring in sheet["rings"]:
            for point in ring:
              vertex = tuple(
                np.rint((np.asarray(point) + [0, offset, 0]) * 100).astype(int)
              )
              if vertex in vertices:
                join(owner, vertices[vertex])
              else:
                vertices[vertex] = owner
    groups = defaultdict(list)
    for owner in parent:
      groups[find(owner)].append(owner)
    for identities in groups.values():
      if len(identities) < 2:
        continue
      identities.sort()
      eligible = all(
        owner_rows[owner]["wallEligible"] and owner_rows[owner]["wallUnknown"]
        for owner in identities
      )
      identity = kind + ":" + identities[0]
      tone = palette("legacy-shared-wall:" + identity)[0]
      report.append(
        {
          "id": identity,
          "kind": kind,
          "owners": identities,
          "eligible": eligible,
          "wallSrgb": tone if eligible else None,
        }
      )
      if eligible:
        for owner in identities:
          components[owner] = identity
          owner_rows[owner]["wallSrgb"] = tone
          owner_rows[owner]["wallEvidence"] = (
            "illustrative unknown paint, shared source-wall component"
          )
          owner_rows[owner]["sharedWallComponent"] = identity
    for surface in surfaces[kind]:
      if surface.role == "WallSurface" and surface.owner in components:
        surface.after = prior.linear(tuple(owner_rows[surface.owner]["wallSrgb"]))
    for part in native[kind]:
      if part.owner in components:
        part.roles = tuple(
          (
            role,
            before,
            prior.linear(tuple(owner_rows[part.owner]["wallSrgb"]))
            if role == "WallSurface"
            else after,
          )
          for role, before, after in part.roles
        )
  return components, report


def compile_mesh(
  part: dict,
  origin: list,
  surfaces: list,
  native: list,
  is_native: bool,
  tree: STRtree,
  candidates: list,
  counts: Counter,
  owners: set[str],
  components: dict[str, str],
) -> dict[int, prior.RGB]:
  """Audit all incident triangles; resolve only fully proved shared-wall groups."""
  positions = (
    np.frombuffer(base64.b64decode(part["positions"]), dtype="<u2")
    .reshape(-1, 3)
    .astype(float)
    / 100
    + origin
  )
  colours = np.frombuffer(base64.b64decode(part["colors"]), dtype="u1").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(part["indices"]), dtype="<u4").reshape(-1, 3)
  accepted = (
    {rgb for row in native for _, rgb, _ in row.roles}
    if is_native
    else {row.before for row in surfaces}
  )
  assignments, provenance = [], []
  for index in indices:
    rgb = tuple(int(v) for v in colours[index[0]])
    if rgb not in accepted or not np.all(colours[index] == rgb):
      assignments.append(None)
      provenance.append(None)
      continue
    triangle = positions[index]
    center = np.mean(triangle[:, [0, 2]], axis=0)
    matches = set()
    for candidate in tree.query(Point(center)):
      record = candidates[int(candidate)]
      if is_native:
        for role, after in record.candidates(triangle, rgb):
          matches.add((record.owner, role, after, record.allowed))
      elif record.matches(triangle, rgb):
        matches.add((record.owner, record.role, record.after, record.allowed))
    # Distinct owners may share exactly the same original wall face. Accept
    # only one pre-audited wholly ordinary component with one agreed wall tone.
    shared = (
      len(matches) > 1
      and all(
        owner in components and role == "WallSurface" and allowed
        for owner, role, _, allowed in matches
      )
      and len({(components[owner], after) for owner, _, after, _ in matches}) == 1
    )
    if len(matches) == 1 or shared:
      _, role, after, allowed = next(iter(matches))
      assignments.append(after if allowed else None)
      provenance.append(
        {(owner, role) for owner, role, _, _ in matches} if allowed else None
      )
      counts[role + "MatchedTriangles"] += 1
      counts["sharedWallMatchedTriangles"] += int(shared)
    else:
      assignments.append(None)
      provenance.append(None)
      counts["ambiguousTriangles" if matches else "unmatchedTriangles"] += 1
  selected = prior.unanimous_vertex_colours(indices, assignments, colours)
  final_vertices = defaultdict(set)
  for triangle, identities in zip(indices, provenance, strict=True):
    changed = {int(v) for v in triangle if int(v) in selected}
    if identities and changed:
      for owner, _ in identities:
        owners.add(owner)
      role = next(iter(identities))[1]
      counts[role + "ChangedTriangles"] += 1
      final_vertices[role].update(changed)
  for role, values in final_vertices.items():
    counts[role + "ChangedVertices"] += len(values)
  counts["selectedVertices"] += len(selected)
  counts["examinedTriangles"] += len(indices)
  return selected


def build(*, write: bool = True) -> dict:
  """Compile small immutable-packet receipts without any public packet rewrite."""
  if not CONTEXT.exists():
    extract_context()
  surfaces, native, evidence, source_counts, protection_receipts = source_selectors()
  components, component_report = shared_wall_components(surfaces, native, evidence)
  drawn_trees = {
    k: STRtree([s.bounds_xz for s in rows]) for k, rows in surfaces.items()
  }
  native_trees = {k: STRtree([p.footprint for p in rows]) for k, rows in native.items()}
  ground_tree = STRtree([box(*row["bounds"]) for row in evidence])
  output = {"schemaVersion": 1, "palette": [], "packets": {}}
  lookup, counts, owners, receipts = {}, defaultdict(Counter), defaultdict(set), []
  for desc in prior.read(prior.PUBLIC / "manifest.json")["chunks"]:
    if not len(ground_tree.query(box(*desc["bounds"]))):
      continue
    for mode in ("drawn", "minecraft"):
      path = prior.PUBLIC / desc[mode]["url"]
      packet = prior.read(path)
      entries, selected = [], 0
      is_native = mode == "minecraft"
      for ordinal, part in enumerate(packet["meshes"]):
        kind = part["kind"]
        if kind not in SOURCES:
          continue
        values = compile_mesh(
          part,
          packet["origin"],
          surfaces[kind],
          native[kind],
          is_native,
          native_trees[kind] if is_native else drawn_trees[kind],
          native[kind] if is_native else surfaces[kind],
          counts[mode],
          owners[mode],
          components,
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
        output["packets"][mode + ":" + desc["id"]] = entries
        receipts.append(
          {
            "file": str(path.relative_to(ROOT)),
            "sha256": prior.digest(path),
            "mode": mode,
            "selectedVertices": selected,
          }
        )
        print(f"{mode}:{desc['id']}: {selected} existing colour vertices", flush=True)
  raw = (json.dumps(output, separators=(",", ":")) + "\n").encode()
  report = {
    "schemaVersion": 1,
    "sourceFiles": [
      {"file": str(p.relative_to(ROOT)), "sha256": prior.digest(p)}
      for p in (*SOURCES.values(), CONTEXT, legacy.OFFSETS)
    ],
    "protectionSources": protection_receipts,
    "sourceCounts": source_counts,
    "modeCounts": {k: dict(v) for k, v in counts.items()},
    "owners": evidence,
    "sharedWallComponents": component_report,
    "ownersReceivingSelectors": {k: sorted(v) for k, v in owners.items()},
    "packetReceipts": receipts,
    "packetFilesChanged": 0,
    "runtimeBytes": len(raw),
    "runtimeGzipBytes": len(gzip.compress(raw, mtime=0)),
    "limits": [
      "Every retained parent in all four confirmed flat-shell source layers is audited.",
      "Only positively ordinary complete families are eligible; named/institutional/authored and v271 owners remain.",
      "Known colours/materials precede contextual illustrative unknown paint.",
      "Exact original generic wall/roof cells only; independent source-plane and native-envelope proofs.",
      "Ambiguous shared faces stay unchanged; no geometry, linework, navigation, source packet or live budget changes.",
    ],
  }
  if write:
    OUTPUT.write_bytes(raw)
    INDEX.write_text(
      json.dumps(sorted(output["packets"]), separators=(",", ":")) + "\n"
    )
    EVIDENCE.write_bytes(
      gzip.compress(json.dumps(report, separators=(",", ":")).encode(), mtime=0)
    )
  return {
    k: v
    for k, v in report.items()
    if k
    not in {"owners", "packetReceipts", "ownersReceivingSelectors", "protectionSources"}
  }


if __name__ == "__main__":
  print(json.dumps(build(), indent=2))
