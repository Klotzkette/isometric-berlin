"""Step 10: prepare exact religious owner removals without publishing packets.

The first run freezes the current manifest and affected packets in the output
directory. Repeated runs use those frozen bytes, including after integration.
Only a separate integration step may merge these descriptors into the manifest.
"""

from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import geopandas as gpd
from build_karl_marx_allee_v161 import mesh_signature
from build_surrounding_outlines import (
  DEFAULT_OUTPUT,
  ROOT,
  chunk_payload,
  load_projected_polygon,
  world,
)
from integrate_city_refinements_v166 import (
  line_signature,
  subtract_lines,
  subtract_meshes,
)
from shapely.geometry import Polygon, box, mapping
from shapely.geometry.base import BaseGeometry

GEO = ROOT / "geo_data/regierungsviertel"
RECEIPT = GEO / "religious-sites-v205-packet-patch.json"
OUTPUT = Path("/tmp/v205-religious-packets")
RUNTIME = ROOT / "src/app/src/data/religiousSitesV205.json"
SITES = {
  "DEBE03YY6000009u": "Gethsemanekirche",
  "DEBE02YY2000000L": "Samariterkirche",
  "DEBE02YY4000000y": "Passionskirche",
  "DEBE04YY50003AIw": "Wilmersdorfer Moschee",
  "DEBE04YY50003LLr": "Wilmersdorfer Moschee minaret",
  "DEBE04YY50003Ue3": "Wilmersdorfer Moschee minaret",
  "DEBE00YY1Cw0002e": "Şehitlik-Moschee",
  "DEBE03YY600004DV": "Synagoge Rykestraße",
}
OWNERS = frozenset(SITES)


def sha(data: bytes) -> str:
  """SHA-256 of an exact byte representation."""
  return hashlib.sha256(data).hexdigest()


def json_bytes(value: Any) -> bytes:
  """Use the existing compact packet serialization with a final newline."""
  return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def signature_sha(counter: Counter) -> str:
  """Stable hash of a complete coloured primitive multiset."""
  h = hashlib.sha256()
  for key, count in sorted(counter.items()):
    h.update(key)
    h.update(str(count).encode())
    h.update(b"\n")
  return h.hexdigest()


def patch_payload(
  original: dict[str, Any],
  selected: dict[str, Any],
  empty: dict[str, Any],
  owner_ids: frozenset[str],
  *,
  minecraft: bool,
) -> tuple[dict[str, Any], dict[str, Any]]:
  """Remove exact reconstructed owner primitives and retain every other record."""
  before = mesh_signature(original)
  remove = mesh_signature(selected) - mesh_signature(empty)
  assert remove, "No source triangles reconstructed"
  assert not remove - before, "Requested source triangles absent from frozen packet"
  result = copy.deepcopy(original)
  result["meshes"] = subtract_meshes(result["meshes"], remove.copy())
  assert mesh_signature(result) == before - remove
  assert [m for m in result["meshes"] if m["kind"] != "city"] == [
    m for m in original["meshes"] if m["kind"] != "city"
  ]

  removed_lines = Counter()
  retained_lines = Counter()
  if not minecraft:
    removed_lines = line_signature(selected["lines"]) - line_signature(empty["lines"])
    before_lines = line_signature(original["lines"])
    assert not removed_lines - before_lines, "Requested source ink absent"
    result["lines"] = subtract_lines(result["lines"], removed_lines.copy())
    retained_lines = before_lines - removed_lines
    assert line_signature(result["lines"]) == retained_lines

  removed_nav = [b for b in original["nav"]["buildings"] if b["sourceId"] in owner_ids]
  assert {b["sourceId"] for b in removed_nav} == owner_ids, "Owner navigation absent"
  result["nav"]["buildings"] = [
    b for b in original["nav"]["buildings"] if b["sourceId"] not in owner_ids
  ]
  assert {k: v for k, v in result["nav"].items() if k != "buildings"} == {
    k: v for k, v in original["nav"].items() if k != "buildings"
  }
  modified_keys = {"meshes", "nav"} | ({"lines"} if not minecraft else set())
  assert {k: v for k, v in result.items() if k not in modified_keys} == {
    k: v for k, v in original.items() if k not in modified_keys
  }
  return result, {
    "removedTriangles": sum(remove.values()),
    "removedTriangleSha256": signature_sha(remove),
    "preservedTriangles": sum((before - remove).values()),
    "preservedTriangleSha256": signature_sha(before - remove),
    "removedSourceInkSegments": sum(removed_lines.values()),
    "removedSourceInkSha256": signature_sha(removed_lines),
    "preservedSourceInkSegments": sum(retained_lines.values()),
    "preservedSourceInkSha256": signature_sha(retained_lines),
    "removedNavigationCount": len(removed_nav),
    "removedNavigationRecords": removed_nav,
    "preservedNavigationCount": len(result["nav"]["buildings"]),
    "preservedNavigationSha256": sha(json_bytes(result["nav"])),
    "unrelatedPacketFieldsPreserved": True,
    "unrelatedMeshKindsPreserved": True,
  }


def replacement_navigation(
  parts: list[dict[str, Any]],
  tile: BaseGeometry,
  origin: list[float],
  owner_ids: frozenset[str],
  ground_y: float,
) -> list[dict[str, Any]]:
  """Clip exact source parts to one packet and convert world XZ to local metres."""
  result = []
  seen: dict[tuple[str, str, str], dict[str, Any]] = {}
  for part in parts:
    if part["parentId"] not in owner_ids:
      continue
    source = Polygon(part["ring"], part["holes"])
    assert source.is_valid and not source.is_empty, ("Invalid source part", part["id"])
    clipped = source.intersection(tile)
    fragments = (
      list(clipped.geoms)
      if clipped.geom_type in {"MultiPolygon", "GeometryCollection"}
      else [clipped]
    )
    for fragment in fragments:
      if fragment.is_empty or fragment.geom_type != "Polygon" or fragment.area == 0:
        continue

      def local(ring: Any) -> list[list[float]]:
        return [[x - origin[0], z - origin[2]] for x, z in ring.coords]

      record = {
        "ring": local(fragment.exterior),
        "holes": [local(ring) for ring in fragment.interiors],
        "height": part["topY"] - ground_y,
        "minHeight": part["baseY"] - ground_y,
        "sourceId": part["parentId"],
        "parentId": part["parentId"],
        "partId": part["id"],
        "siteId": part["siteId"],
        "heightSource": "Complete retained Berlin LoD2 source part; display grade 3 m",
        "refinement": "religious-sites-v205",
      }
      key = (part["parentId"], part["id"], fragment.normalize().wkb_hex)
      if key in seen:
        assert seen[key] == record, ("Conflicting duplicate source part", part["id"])
        continue
      seen[key] = record
      result.append(record)
  return result


def prepare(output: Path = OUTPUT, evidence: Path = RECEIPT) -> dict[str, Any]:
  """Freeze current inputs and write candidate packets and merge descriptors."""
  assert not output.resolve().is_relative_to(DEFAULT_OUTPUT.resolve())
  output.mkdir(parents=True, exist_ok=True)
  frozen_manifest = output / "manifest-before.json"
  fresh = not frozen_manifest.exists()
  manifest_bytes = (
    (DEFAULT_OUTPUT / "manifest.json").read_bytes()
    if fresh
    else frozen_manifest.read_bytes()
  )
  manifest = json.loads(manifest_bytes)
  runtime = json.loads(RUNTIME.read_bytes())
  navigation_parts = [
    {**part, "siteId": site["id"]}
    for site in runtime["sites"]
    for part in site["navigation"]
  ]
  assert {p["parentId"] for p in navigation_parts} == OWNERS
  assert len({(p["parentId"], p["id"]) for p in navigation_parts}) == len(
    navigation_parts
  )
  sources = {}
  source_files = []
  base = load_projected_polygon(GEO / "bounds.geojson")
  for key, folder, scope in [
    (
      "outer",
      "outer-v159",
      base.difference(load_projected_polygon(GEO / "bounds-v158.geojson")),
    ),
    (
      "ring",
      "ring-v182",
      load_projected_polygon(GEO / "bounds-ring-v182.geojson").difference(base),
    ),
  ]:
    path = GEO / f"raw/{folder}/resolved-outlines.gpkg"
    where = "sourceId IN (" + ",".join(f"'{o}'" for o in sorted(OWNERS)) + ")"
    records = gpd.read_file(path, layer="buildings", where=where).to_dict("records")
    sources[key] = (records, world(scope))
    source_files.append(
      {"path": str(path.relative_to(ROOT)), "sha256": sha(path.read_bytes())}
    )
  records = [r for rows, _ in sources.values() for r in rows]
  assert Counter(r["sourceId"] for r in records) == Counter(OWNERS), (
    "Each exact owner must have exactly one retained original record"
  )

  changes = []
  staged: dict[str, tuple[bytes, bytes]] = {}
  for descriptor in manifest["chunks"]:
    kind = (
      "ring"
      if descriptor["id"].startswith("ring182-")
      else "outer"
      if re.fullmatch(r"-?\d+_-?\d+", descriptor["id"])
      else None
    )
    if kind is None:
      continue
    tile = box(*descriptor["bounds"])
    rows, scope = sources[kind]
    owned = [r for r in rows if r["geometry"].intersects(tile)]
    if not owned:
      continue
    owner_ids = frozenset(r["sourceId"] for r in owned)
    updated = copy.deepcopy(descriptor)
    change = {
      "id": descriptor["id"],
      "sourceScope": kind,
      "ownerIds": sorted(owner_ids),
      "descriptorBefore": descriptor,
      "modes": {},
    }
    for mode in ["drawn", "minecraft"]:
      relative = descriptor[mode]["url"]
      path = (DEFAULT_OUTPUT if fresh else output / "original") / relative
      before_bytes = path.read_bytes()
      assert sha(before_bytes) == descriptor[mode]["sha256"], ("Stale input", path)
      original = json.loads(gzip.decompress(before_bytes))
      selected = chunk_payload(
        descriptor["id"],
        tile,
        scope.intersection(tile),
        owned,
        {},
        minecraft=mode == "minecraft",
      )
      empty = chunk_payload(
        descriptor["id"],
        tile,
        scope.intersection(tile),
        [],
        {},
        minecraft=mode == "minecraft",
      )
      payload, audit = patch_payload(
        original, selected, empty, owner_ids, minecraft=mode == "minecraft"
      )
      replacements = replacement_navigation(
        navigation_parts,
        tile,
        original["origin"],
        owner_ids,
        original["nav"]["groundY"],
      )
      assert {r["sourceId"] for r in replacements} == owner_ids
      retained_nav = copy.deepcopy(payload["nav"]["buildings"])
      payload["nav"]["buildings"].extend(replacements)
      assert payload["nav"]["buildings"][: len(retained_nav)] == retained_nav
      audit.update(
        {
          "addedNavigationCount": len(replacements),
          "addedNavigationRecords": replacements,
          "finalNavigationSha256": sha(json_bytes(payload["nav"])),
        }
      )
      raw = json_bytes(payload)
      packed = gzip.compress(raw, mtime=0)
      updated[mode] = {
        **descriptor[mode],
        "bytes": len(packed),
        "decodedBytes": len(raw),
        "sha256": sha(packed),
      }
      change["modes"][mode] = {
        "oldSha256": sha(before_bytes),
        "newSha256": sha(packed),
        "oldBytes": len(before_bytes),
        "newBytes": len(packed),
        "oldDecodedBytes": len(gzip.decompress(before_bytes)),
        "newDecodedBytes": len(raw),
        **audit,
      }
      staged[relative] = (before_bytes, packed)
    change["descriptor"] = updated
    changes.append(change)
  assert {o for c in changes for o in c["ownerIds"]} == OWNERS
  result = {
    "version": "1.0.105",
    "status": "prepared-candidates-only",
    "frozenManifestSha256": sha(manifest_bytes),
    "ownerIds": sorted(OWNERS),
    "replacementNavigation": {
      "source": str(RUNTIME.relative_to(ROOT)),
      "sha256": sha(json_bytes(navigation_parts)),
      "parts": navigation_parts,
      "policy": "Exact original part ring/holes and base/top heights; clipped only at packet boundaries and translated to local metres. Each part fragment occurs once per packet and mode.",
    },
    "sourceFiles": source_files,
    "sourceRecords": [
      {
        **{k: v for k, v in r.items() if k != "geometry"},
        "sourceScope": key,
        "site": SITES[r["sourceId"]],
        "geometry": mapping(r["geometry"]),
      }
      for key, (rows, _) in sources.items()
      for r in sorted(rows, key=lambda r: r["sourceId"])
    ],
    "chunks": changes,
    "groundBaseM": 3,
    "policy": (
      "Remove only the eight exact retained generic owner envelopes and their "
      "source ink/navigation. Complete original records and removed navigation "
      "are retained here. Complete source part models are supplied separately; "
      "their exact navigation parts replace the removed generic navigation. "
      "Every unrelated coloured triangle, "
      "source ink segment, navigation record and packet field is preserved. "
      "Candidates and merge descriptors only; this script never publishes. "
      "Integration must check each current packet against oldSha256 before "
      "copying its candidate and merge only the matching chunk descriptors."
    ),
    "unrelatedGeometryPreserved": True,
  }
  if fresh:
    frozen_manifest.write_bytes(manifest_bytes)
  for relative, (before_bytes, packed) in staged.items():
    original_path = output / "original" / relative
    original_path.parent.mkdir(parents=True, exist_ok=True)
    if fresh:
      original_path.write_bytes(before_bytes)
    candidate_path = output / relative
    candidate_path.parent.mkdir(parents=True, exist_ok=True)
    candidate_path.write_bytes(packed)
  (output / "manifest-patch.json").write_text(
    json.dumps({"chunks": [c["descriptor"] for c in changes]}, indent=2) + "\n"
  )
  evidence.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
  return result


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--output", type=Path, default=OUTPUT)
  parser.add_argument("--evidence", type=Path, default=RECEIPT)
  args = parser.parse_args()
  receipt = prepare(args.output, args.evidence)
  print(
    json.dumps(
      {
        "chunks": len(receipt["chunks"]),
        "ownerCount": len(receipt["ownerIds"]),
        "removedTriangles": {
          mode: sum(c["modes"][mode]["removedTriangles"] for c in receipt["chunks"])
          for mode in ["drawn", "minecraft"]
        },
        "output": str(args.output),
        "evidence": str(args.evidence),
      }
    )
  )
