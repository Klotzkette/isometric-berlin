"""Final published v168 packets: only named former owners may change."""

import base64
import gzip
import hashlib
import json
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

import pytest
from shapely import make_valid
from shapely.geometry import Polygon, box
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
KIND = "scheunenviertel-v168"


def v168_packet_bytes(path: Path) -> bytes:
  """Freeze the v168 proof after v169; current packets have a strict v169 audit."""
  current = json.loads((PACKETS / "manifest.json").read_text())
  if "altMitteV169" not in current.get("source", {}):
    return path.read_bytes()
  return subprocess.check_output(
    ["git", "show", f"v1.0.68:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def read(path: Path) -> dict:
  return json.loads(
    v168_packet_bytes(path) if PACKETS in path.parents else path.read_bytes()
  )


def old_bytes(path: Path) -> bytes:
  return subprocess.check_output(
    ["git", "show", f"v1.0.67:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def test_final_owners_preserve_all_unowned_geometry_and_source_navigation() -> None:
  try:
    previous = json.loads(old_bytes(PACKETS / "manifest.json"))
  except subprocess.CalledProcessError:
    pytest.skip("Historical source audit requires retained v1.0.67 tag")
  current = read(PACKETS / "manifest.json")
  if "scheunenRefinementsV168" not in current.get("source", {}):
    pytest.skip("Final v168 publication has not yet been applied")
  old_descriptors = {p["id"]: p for p in previous["chunks"]}
  descriptors = {p["id"]: p for p in current["chunks"]}
  source = read(ROOT / "geo_data/regierungsviertel/scheunenviertel-v168.json")
  audit = read(ROOT / "geo_data/regierungsviertel/scheunen-refinements-v168-audit.json")
  owners = {b["id"] for b in source["buildings"]}
  assert owners == set(
    current["source"]["scheunenRefinementsV168"]["exactMovedOuterSourceIds"]
  )
  assert audit["ownerCount"] == len(owners) == 331
  assert set(old_descriptors) <= descriptors.keys()
  changes = {c["id"] for c in audit["chunks"]}
  nav_parts = {mode: defaultdict(list) for mode in ("drawn", "minecraft")}
  published_drawn_detail = {}
  for identity, d in descriptors.items():
    if identity not in changes:
      assert d == old_descriptors[identity]
      for mode in ("drawn", "minecraft"):
        assert v168_packet_bytes(PACKETS / d[mode]["url"]) == old_bytes(
          PACKETS / d[mode]["url"]
        )
      continue
    entry = next(e for e in audit["chunks"] if e["id"] == identity)
    for mode in ("drawn", "minecraft"):
      blob = v168_packet_bytes(PACKETS / d[mode]["url"])
      raw = gzip.decompress(blob)
      assert hashlib.sha256(blob).hexdigest() == d[mode]["sha256"]
      assert len(blob) == d[mode]["bytes"] and len(raw) == d[mode]["decodedBytes"]
      assert len(raw) < 12 * 1024 * 1024
      after = json.loads(raw)
      assert len(after["meshes"]) <= 16
      assert (
        sum(len(base64.b64decode(m["positions"])) // 6 for m in after["meshes"])
        <= 400_000
      )
      assert (
        sum(len(base64.b64decode(m["indices"])) // 4 for m in after["meshes"])
        <= 2_400_000
      )
      assert (
        len(base64.b64decode(after.get("lines", {}).get("positions", ""))) // 6
        <= 400_000
      )
      added_meshes = [m for m in after["meshes"] if m["kind"] == KIND]
      assert number_of_triangles(added_meshes) == entry["modes"][mode]["addedTriangles"]
      if mode == "drawn":
        owner_chunk = d.get("detailCompanionOf", identity)
        published_drawn_detail.setdefault(owner_chunk, Counter()).update(
          triangle_keys(added_meshes)
        )
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
      # Every earlier special mesh remains exact, including streets and parks.
      assert Counter(
        canonical(m) for m in before["meshes"] if m["kind"] != "city"
      ) == Counter(
        canonical(m) for m in after["meshes"] if m["kind"] not in {"city", KIND}
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
      original = unary_union([make_valid(g) for g in grounds])
      for mode in nav_parts:
        key = building["id"], part["id"]
        assert key in nav_parts[mode]
        # Centimetre encoding can collapse a millimetre-wide notch into a
        # touching ring. Preserve every polygon/line component from make_valid;
        # never select only a largest part or use a zero-buffer that loses lobes.
        represented = unary_union([make_valid(g) for g in nav_parts[mode][key]])
        assert (
          represented.symmetric_difference(original).area
          <= original.length * 0.02 + 0.01
        )
        components = (
          [original] if original.geom_type == "Polygon" else list(original.geoms)
        )
        for component in components:
          if component.geom_type != "Polygon":
            continue
          for ring in component.interiors:
            # Existing source court interiors beyond the quantization edge
            # tolerance must remain open, even when the overall area is small.
            inner = Polygon(ring).buffer(-0.02)
            assert inner.intersection(represented).area < 1e-6

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


def test_old_quarter_heroes_and_credits_remain_intact() -> None:
  for filename in [
    "geo_data/regierungsviertel/wikimedia_references.json",
    "src/app/public/dzi/regierungsviertel/wikimedia_attribution.json",
  ]:
    path = ROOT / filename
    old = json.loads(old_bytes(path))["records"]
    assert read(path)["records"][: len(old)] == old
  for filename in [
    "src/app/src/data/alexanderNorthV166Source.json",
    "geo_data/regierungsviertel/mitte-streets-v166.json",
    "geo_data/regierungsviertel/oranien-corridors-v167.json",
    "geo_data/regierungsviertel/bounds.geojson",
  ]:
    path = ROOT / filename
    assert path.read_bytes() == old_bytes(path)
