"""Final published v167 packets: only named former owners may change."""

import gzip
import hashlib
import json
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

import pytest
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union
from test_city_refinements_v166 import (
  belongs_to_source,
  canonical,
  line_signature,
  number_of_triangles,
  source_prisms_by_top,
  triangle_keys,
)

# The legacy independent decoder adds scripts/ to sys.path before these helpers.
# isort: split
from build_concert_halls_v160 import triangulate
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_west_streets_v163 import partition_detail

ROOT = Path(__file__).resolve().parents[1]
PACKETS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
KIND = "oranien-corridors-v167"
OLD_FRONT = "mitte-street-fronts-v166"


def v167_packet_bytes(path):
  """Freeze this historical proof; v168 has its own strict published audit."""
  current = json.loads((PACKETS / "manifest.json").read_text())
  if "scheunenRefinementsV168" not in current.get("source", {}):
    return path.read_bytes()
  return subprocess.check_output(
    ["git", "show", f"v1.0.67:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def read(path):
  return json.loads(
    v167_packet_bytes(path) if PACKETS in path.parents else path.read_bytes()
  )


def old_bytes(path):
  return subprocess.check_output(
    ["git", "show", f"v1.0.66:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def test_final_owners_preserve_all_unowned_geometry_and_source_navigation():
  try:
    previous = json.loads(old_bytes(PACKETS / "manifest.json"))
  except subprocess.CalledProcessError:
    pytest.skip("Historical source audit requires retained v1.0.66 tag")
  current = read(PACKETS / "manifest.json")
  old_descriptors = {p["id"]: p for p in previous["chunks"]}
  descriptors = {p["id"]: p for p in current["chunks"]}
  source = read(ROOT / "geo_data/regierungsviertel/oranien-corridors-v167.json")
  audit = read(ROOT / "geo_data/regierungsviertel/oranien-refinements-v167-audit.json")
  facades = read(ROOT / "geo_data/regierungsviertel/tacheles-v166-facade-removal.json")
  facade_chunks = {c["id"]: c for c in facades["chunks"]}
  owners = {b["id"] for b in source["buildings"]} | set(
    source["extraMovedOuterSourceIds"]
  )
  assert owners == set(
    current["source"]["oranienRefinementsV167"]["exactMovedOuterSourceIds"]
  )
  assert audit["ownerCount"] == len(owners) == 322
  assert set(facades["corePrismIds"]) == {"24054915", "19283679", "40754304"}
  assert set(old_descriptors) <= descriptors.keys()
  changes = {c["id"] for c in audit["chunks"]}
  nav_parts = {mode: defaultdict(list) for mode in ("drawn", "minecraft")}
  published_drawn_detail = {}
  for identity, d in descriptors.items():
    if identity not in changes:
      assert d == old_descriptors[identity]
      for mode in ("drawn", "minecraft"):
        assert v167_packet_bytes(PACKETS / d[mode]["url"]) == old_bytes(
          PACKETS / d[mode]["url"]
        )
      continue
    entry = next(e for e in audit["chunks"] if e["id"] == identity)
    for mode in ("drawn", "minecraft"):
      blob = v167_packet_bytes(PACKETS / d[mode]["url"])
      raw = gzip.decompress(blob)
      assert hashlib.sha256(blob).hexdigest() == d[mode]["sha256"]
      assert len(blob) == d[mode]["bytes"] and len(raw) == d[mode]["decodedBytes"]
      after = json.loads(raw)
      added_meshes = [m for m in after["meshes"] if m["kind"] == KIND]
      assert number_of_triangles(added_meshes) == entry["modes"][mode]["addedTriangles"]
      if mode == "drawn":
        published_drawn_detail[identity] = triangle_keys(added_meshes)
      old = old_descriptors.get(identity)
      before = (
        json.loads(gzip.decompress(old_bytes(PACKETS / old[mode]["url"])))
        if old
        else {
          "meshes": [],
          "nav": {
            "ground": [],
            "water": [],
            "roads": [],
            "bridges": [],
            "buildings": [],
            "groundY": 3,
          },
        }
      )
      old_city = triangle_keys([m for m in before["meshes"] if m["kind"] == "city"])
      new_city = triangle_keys([m for m in after["meshes"] if m["kind"] == "city"])
      assert not new_city - old_city
      removed = old_city - new_city
      assert sum(removed.values()) == entry["modes"][mode]["removedTriangles"]
      by_top = source_prisms_by_top(before["nav"]["buildings"], owners)
      assert all(belongs_to_source(t, by_top) for t in removed), (
        identity,
        mode,
        "unowned source surface removed",
      )
      old_front = triangle_keys([m for m in before["meshes"] if m["kind"] == OLD_FRONT])
      new_front = triangle_keys([m for m in after["meshes"] if m["kind"] == OLD_FRONT])
      remove_mesh = facade_chunks.get(identity, {}).get("modes", {}).get(mode)
      expected_remove = triangle_keys([remove_mesh]) if remove_mesh else Counter()
      assert old_front - new_front == expected_remove and not new_front - old_front
      assert (
        sum(expected_remove.values())
        == entry["modes"][mode]["removedTachelesFacadeTriangles"]
      )
      # Every earlier special mesh remains exact, including streets and parks.
      assert Counter(
        canonical(m) for m in before["meshes"] if m["kind"] not in {"city", OLD_FRONT}
      ) == Counter(
        canonical(m)
        for m in after["meshes"]
        if m["kind"] not in {"city", OLD_FRONT, KIND}
      )
      if "lines" in before:
        old_lines, new_lines = (
          line_signature(before["lines"]),
          line_signature(after["lines"]),
        )
        assert not new_lines - old_lines
        assert all(
          belongs_to_source(t, by_top, lines=True) for t in old_lines - new_lines
        )
      for field in ("ground", "water", "roads", "bridges", "groundY"):
        assert after["nav"][field] == before["nav"][field]
      assert Counter(
        canonical(b) for b in before["nav"]["buildings"] if b["sourceId"] not in owners
      ) == Counter(
        canonical(b) for b in after["nav"]["buildings"] if b["sourceId"] not in owners
      )
      for b in after["nav"]["buildings"]:
        if b["sourceId"] not in owners:
          continue
        assert "partId" in b
        ox, _, oz = after["origin"]
        nav_parts[mode][b["sourceId"], b["partId"]].append(
          Polygon(
            [[x + ox, z + oz] for x, z in b["ring"]],
            [[[x + ox, z + oz] for x, z in h] for h in b["holes"]],
          )
        )
  # All original leaf footprints survive the bounded clipping into packets.
  for building in source["buildings"]:
    for part in building["parts"]:
      grounds = [
        Polygon(
          [(x, z) for x, _, z in s["rings"][0]],
          [[(x, z) for x, _, z in h] for h in s["rings"][1:]],
        )
        for s in part["surfaces"]
        if s["kind"] == "GroundSurface"
      ]
      if not grounds:
        continue
      original = unary_union(grounds)
      for mode in nav_parts:
        key = building["id"], part["id"]
        assert key in nav_parts[mode]
        assert (
          unary_union(nav_parts[mode][key]).symmetric_difference(original).area
          <= original.length * 0.02 + 0.01
        )
  # The station is an OSM owner, outside the LoD2-part loop above. Preserve its
  # complete mapped canopy and both platform footprints in published navigation.
  station = source["station"]
  station_footprints = {
    "display:elevated-canopy": shape(station["roof"]["geometry"]),
    **{
      f"display:platform-{i}": shape(platform["geometry"])
      for i, platform in enumerate(station["platforms"])
    },
  }
  assert len(station_footprints) == 3
  for part_id, original in station_footprints.items():
    for mode in nav_parts:
      key = station["sourceId"], part_id
      assert key in nav_parts[mode], (mode, key, "mapped station part missing")
      assert (
        unary_union(nav_parts[mode][key]).symmetric_difference(original).area
        <= original.length * 0.02 + 0.01
      )

  # Navigation alone must not satisfy the release proof. Independently rebuild
  # only the original source sheets, without invoking corridor/detail authoring,
  # and compare their quantized triangle/color multisets to published geometry.
  original_sheets = Detail()
  for building in source["buildings"]:
    for part in building["parts"]:
      for surface in part["surfaces"]:
        kind = surface["kind"]
        if kind not in {"WallSurface", "RoofSurface"}:
          continue
        color = (160, 159, 151) if kind == "RoofSurface" else (211, 208, 197)
        if building["id"] in {"DEBE02YY400000xk", "DEBE02YY4000000T"}:
          color = (
            (109, 112, 101)
            if kind == "RoofSurface"
            else (166, 149, 104)
            if building["id"] == "DEBE02YY400000xk"
            else (179, 140, 95)
          )
        for triangle in triangulate(surface["rings"]):
          original_sheets.polygon(triangle, color, "source-sheet-proof")
  assert original_sheets.triangles
  for (ix, iz), sheets in partition_detail(original_sheets).items():
    identity = f"{ix}_{iz}"
    tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
    expected = triangle_keys([packed_detail(sheets, tile)])
    assert identity in published_drawn_detail
    assert not expected - published_drawn_detail[identity], (
      identity,
      "original LoD2 wall/roof triangles missing from published detail",
    )
  assert audit["unownedTriangleLoss"] == audit["unownedNavigationLoss"] == 0


def test_new_credits_append_and_old_pool_context_stays_byte_identical():
  for filename in [
    "geo_data/regierungsviertel/wikimedia_references.json",
    "src/app/public/dzi/regierungsviertel/wikimedia_attribution.json",
  ]:
    path = ROOT / filename
    old = json.loads(old_bytes(path))["records"]
    assert read(path)["records"][: len(old)] == old
  for filename in [
    "src/app/src/data/mitteHeritageV166Source.json",
    "src/app/src/MitteHeritageV166.ts",
    "geo_data/regierungsviertel/bounds.geojson",
  ]:
    path = ROOT / filename
    assert path.read_bytes() == old_bytes(path)
