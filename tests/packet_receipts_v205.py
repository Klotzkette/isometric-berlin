"""Independently replay the seven exact-owner v205 patches before older receipts."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import subprocess
import sys
from collections import Counter
from functools import lru_cache
from pathlib import Path

from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
sys.path.insert(0, str(ROOT / "scripts"))
OWNERS = {
  "DEBE00YY1Cw0002e",
  "DEBE02YY2000000L",
  "DEBE02YY4000000y",
  "DEBE03YY6000009u",
  "DEBE03YY600004DV",
  "DEBE04YY50003AIw",
  "DEBE04YY50003LLr",
  "DEBE04YY50003Ue3",
}
IDS = {"-9_6", "3_6", "5_-7", "6_-7", "6_-4", "ring182-12_0", "ring182-4_8"}


def digest(data: bytes) -> str:
  return hashlib.sha256(data).hexdigest()


def packed_json(value: dict | list) -> bytes:
  return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


@lru_cache(maxsize=None)
def baseline(path: Path) -> bytes:
  return subprocess.check_output(
    ["git", "show", f"v1.0.104:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def verify_asset(data: bytes, asset: dict) -> dict:
  assert len(data) == asset["bytes"] < 650_000 and digest(data) == asset["sha256"]
  raw = gzip.decompress(data)
  assert len(raw) == asset["decodedBytes"] < 2_600_000
  return json.loads(raw)


def primitive_sha(counter: Counter) -> str:
  digestor = hashlib.sha256()
  for key, count in sorted(counter.items()):
    digestor.update(key)
    digestor.update(str(count).encode())
    digestor.update(b"\n")
  return digestor.hexdigest()


def verify_owner_navigation(selected: list[dict], immutable: list[dict]) -> None:
  """Bind receipt owner IDs to immutable shapes, heights and all nav metadata."""

  def canonical(rows):
    return Counter(
      json.dumps(row, sort_keys=True, separators=(",", ":")) for row in rows
    )

  assert canonical(selected) == canonical(immutable)


def audit(receipt: dict, current_manifest: dict, read_asset) -> tuple[dict, dict]:
  """No receipt flags are trusted: recreate owners, compare every surviving field."""
  from build_karl_marx_allee_v161 import mesh_signature
  from build_surrounding_outlines import chunk_payload, load_projected_polygon, world
  from integrate_city_refinements_v166 import (
    line_signature,
    subtract_lines,
    subtract_meshes,
  )

  previous_bytes = baseline(PUBLIC / "manifest.json")
  previous = json.loads(previous_bytes)
  assert digest(previous_bytes) == receipt["frozenManifestSha256"]
  assert receipt["version"] == "1.0.105" and set(receipt["ownerIds"]) == OWNERS
  chunks = {c["id"]: c for c in receipt["chunks"]}
  assert len(chunks) == len(receipt["chunks"]) == 7 and set(chunks) == IDS
  assert {o for c in chunks.values() for o in c["ownerIds"]} == OWNERS
  old = {c["id"]: c for c in previous["chunks"]}
  expected = copy.deepcopy(previous)
  expected["chunks"] = [
    chunks[c["id"]]["descriptor"] if c["id"] in chunks else c
    for c in previous["chunks"]
  ]
  expected["religiousSitesV205"] = {
    "sourceOwners": sorted(OWNERS),
    "receipt": "geo_data/regierungsviertel/religious-sites-v205-packet-patch.json",
    "policy": "Only exact coarse owners transferred to complete retained LoD2 + documented recognition model; unrelated packet primitives and navigation retained.",
  }
  assert current_manifest == expected
  assert len(packed_json(current_manifest)) < 2 * 1024**2
  records = receipt["sourceRecords"]
  assert Counter(r["sourceId"] for r in records) == Counter(OWNERS)
  records = [{**r, "geometry": shape(r["geometry"])} for r in records]
  raw_source = json.loads((GEO / "religious-sites-v205-source.json").read_bytes())
  runtime = json.loads((ROOT / "src/app/src/data/religiousSitesV205.json").read_bytes())
  parts = [{**p, "siteId": s["id"]} for s in runtime["sites"] for p in s["navigation"]]
  assert parts == receipt["replacementNavigation"]["parts"] and len(parts) == 18
  assert digest(packed_json(parts)) == receipt["replacementNavigation"]["sha256"]
  for source, site in zip(raw_source["sites"], runtime["sites"], strict=True):
    for original, nav in zip(source["parts"], site["navigation"], strict=True):
      assert nav == {
        "id": original["id"],
        "parentId": original["parentId"],
        "ring": original["ring"],
        "holes": original["holes"],
        "baseY": original["ground_y_m"] + original["viewerOffsetY"],
        "topY": original["top_y_m"] + original["viewerOffsetY"],
      }
  base = load_projected_polygon(GEO / "bounds.geojson")
  scopes = {
    "outer": world(
      base.difference(load_projected_polygon(GEO / "bounds-v158.geojson"))
    ),
    "ring": world(
      load_projected_polygon(GEO / "bounds-ring-v182.geojson").difference(base)
    ),
  }
  changes = {}
  checkpoints = {}
  recovered = {}
  for identity, chunk in chunks.items():
    before_descriptor = old[identity]
    after_descriptor = chunk["descriptor"]
    assert before_descriptor == chunk["descriptorBefore"]
    assert {
      k: v for k, v in before_descriptor.items() if k not in ("drawn", "minecraft")
    } == {k: v for k, v in after_descriptor.items() if k not in ("drawn", "minecraft")}
    assert set(chunk["modes"]) == {"drawn", "minecraft"}
    tile = box(*before_descriptor["bounds"])
    scope = scopes[chunk["sourceScope"]]
    selected_records = [
      r
      for r in records
      if r["sourceScope"] == chunk["sourceScope"] and r["geometry"].intersects(tile)
    ]
    owners = {r["sourceId"] for r in selected_records}
    assert owners == set(chunk["ownerIds"])
    for mode, report in chunk["modes"].items():
      mutable = {"sha256", "bytes", "decodedBytes"}
      assert {k: v for k, v in before_descriptor[mode].items() if k not in mutable} == {
        k: v for k, v in after_descriptor[mode].items() if k not in mutable
      }
      path = PUBLIC / before_descriptor[mode]["url"]
      original_bytes = baseline(path)
      before = verify_asset(original_bytes, before_descriptor[mode])
      after_bytes = read_asset(path)
      after = verify_asset(after_bytes, after_descriptor[mode])
      assert report["oldSha256"] == digest(original_bytes) and report[
        "newSha256"
      ] == digest(after_bytes)
      assert (report["oldBytes"], report["newBytes"]) == (
        len(original_bytes),
        len(after_bytes),
      )
      assert (report["oldDecodedBytes"], report["newDecodedBytes"]) == (
        len(gzip.decompress(original_bytes)),
        len(gzip.decompress(after_bytes)),
      )
      selected = chunk_payload(
        identity,
        tile,
        scope.intersection(tile),
        selected_records,
        {},
        minecraft=mode == "minecraft",
      )
      empty = chunk_payload(
        identity, tile, scope.intersection(tile), [], {}, minecraft=mode == "minecraft"
      )
      removed = mesh_signature(selected) - mesh_signature(empty)
      before_faces = mesh_signature(before)
      assert removed and not removed - before_faces
      assert mesh_signature(after) == before_faces - removed
      assert (sum(removed.values()), primitive_sha(removed)) == (
        report["removedTriangles"],
        report["removedTriangleSha256"],
      )
      assert (
        sum(mesh_signature(after).values()),
        primitive_sha(mesh_signature(after)),
      ) == (report["preservedTriangles"], report["preservedTriangleSha256"])
      replay = copy.deepcopy(before)
      replay["meshes"] = subtract_meshes(replay["meshes"], removed.copy())
      removed_ink = Counter()
      retained_ink = Counter()
      if mode == "drawn":
        removed_ink = line_signature(selected["lines"]) - line_signature(empty["lines"])
        assert not removed_ink - line_signature(before["lines"])
        retained_ink = line_signature(before["lines"]) - removed_ink
        assert line_signature(after["lines"]) == retained_ink
        replay["lines"] = subtract_lines(replay["lines"], removed_ink.copy())
      assert (sum(removed_ink.values()), primitive_sha(removed_ink)) == (
        report["removedSourceInkSegments"],
        report["removedSourceInkSha256"],
      )
      assert (sum(retained_ink.values()), primitive_sha(retained_ink)) == (
        report["preservedSourceInkSegments"],
        report["preservedSourceInkSha256"],
      )
      removed_nav = [b for b in before["nav"]["buildings"] if b["sourceId"] in owners]
      verify_owner_navigation(selected["nav"]["buildings"], removed_nav)
      retained_nav = [
        b for b in before["nav"]["buildings"] if b["sourceId"] not in owners
      ]
      assert (
        removed_nav == report["removedNavigationRecords"]
        and len(removed_nav) == report["removedNavigationCount"]
      )
      replay["nav"]["buildings"] = retained_nav
      assert (
        len(retained_nav) == report["preservedNavigationCount"]
        and digest(packed_json(replay["nav"])) == report["preservedNavigationSha256"]
      )
      # Derive replacement navigation independently from complete source parts.
      added = []
      for part in parts:
        if part["parentId"] not in owners:
          continue
        clipped = Polygon(part["ring"], part["holes"]).intersection(tile)
        for fragment in list(clipped.geoms) if hasattr(clipped, "geoms") else [clipped]:
          if fragment.geom_type != "Polygon" or fragment.is_empty or not fragment.area:
            continue

          def local(ring):
            return [
              [x - before["origin"][0], z - before["origin"][2]] for x, z in ring.coords
            ]

          added.append(
            {
              "ring": local(fragment.exterior),
              "holes": [local(r) for r in fragment.interiors],
              "height": part["topY"] - before["nav"]["groundY"],
              "minHeight": part["baseY"] - before["nav"]["groundY"],
              "sourceId": part["parentId"],
              "parentId": part["parentId"],
              "partId": part["id"],
              "siteId": part["siteId"],
              "heightSource": "Complete retained Berlin LoD2 source part; display grade 3 m",
              "refinement": "religious-sites-v205",
            }
          )
          recovered.setdefault((mode, part["id"]), []).append(fragment)
      assert (
        added == report["addedNavigationRecords"]
        and len(added) == report["addedNavigationCount"]
      )
      replay["nav"]["buildings"] = retained_nav + added
      assert digest(packed_json(replay["nav"])) == report["finalNavigationSha256"]
      assert (
        after == replay
      )  # all other metadata, kinds, ground, roads, water and bridges
      changes[identity, mode] = (digest(original_bytes), digest(after_bytes))
      checkpoints[path] = original_bytes
  for mode in ("drawn", "minecraft"):
    for part in parts:
      fragments = recovered[mode, part["id"]]
      expected_shape = Polygon(part["ring"], part["holes"])
      assert unary_union(fragments).symmetric_difference(expected_shape).area < 1e-7
      assert abs(sum(f.area for f in fragments) - expected_shape.area) < 1e-7
  assert len(changes) == len(checkpoints) == 14
  return changes, checkpoints


@lru_cache(maxsize=1)
def audited_v205_changes() -> tuple[dict, dict]:
  receipt = json.loads((GEO / "religious-sites-v205-packet-patch.json").read_bytes())
  current = json.loads((PUBLIC / "manifest.json").read_bytes())
  return audit(receipt, current, lambda path: path.read_bytes())


def predecessor_v205(path: Path) -> bytes:
  """Return v104 bytes only after a complete independent current-packet proof."""
  _, checkpoints = audited_v205_changes()
  if path == PUBLIC / "manifest.json":
    return baseline(path)
  return checkpoints.get(path) or path.read_bytes()
