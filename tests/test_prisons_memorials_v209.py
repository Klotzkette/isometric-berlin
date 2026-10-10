"""Finite ownership, complete measured sheets and mapped perimeter contracts."""

from __future__ import annotations

import hashlib
import json
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path

import pytest
from shapely.geometry import Point, Polygon, box, shape
from shapely.ops import unary_union

from scripts.build_prisons_memorials_v209 import build

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = json.loads((GEO / "prisons-memorials-v209-source.json").read_bytes())
ENVELOPE = json.loads(
  (ROOT / "src/app/src/data/prisonsMemorialsV209Envelopes.json").read_bytes()
)
DETAIL = json.loads((ROOT / "src/app/src/data/prisonsMemorialsV209.json").read_bytes())
AUDIT = json.loads((GEO / "prisons-memorials-v209-evidence.json").read_bytes())


def test_retained_profiles_match_all_original_official_archive_parts() -> None:
  from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts
  from scripts.build_bebelplatz_building_source import part_profile

  originals = {o["id"]: o for o in SOURCE["owners"]}
  by_archive: dict[str, list[dict]] = {}
  for owner in originals.values():
    by_archive.setdefault(owner["sourceUrl"].rsplit("/", 1)[-1], []).append(owner)
  paths = {name: GEO / "raw/prisons-v209" / name for name in by_archive}
  if any(not path.exists() for path in paths.values()):
    pytest.skip(
      "Optional ignored official archives are absent; committed source remains reproducible"
    )
  seen = set()
  for name, owners in by_archive.items():
    path = paths[name]
    assert {o["archiveSha256"] for o in owners} == {
      hashlib.sha256(path.read_bytes()).hexdigest()
    }
    with zipfile.ZipFile(path) as archive:
      for member in archive.namelist():
        if not member.lower().endswith((".gml", ".xml")):
          continue
        with archive.open(member) as source:
          for _, element in ET.iterparse(source, events=("end",)):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            owner_id = element.get(GML_ID)
            if owner_id in originals:
              assert [
                part_profile(p) for p in leaf_building_parts(element) or [element]
              ] == originals[owner_id]["parts"]
              seen.add(owner_id)
            element.clear()
  assert seen == set(originals)


def test_all_298_parts_and_2751_sheets_keep_their_exact_source_coordinates() -> None:
  assert len(SOURCE["owners"]) == 118
  expected = Counter()
  for oi, owner in enumerate(SOURCE["owners"]):
    for part in owner["parts"]:
      for si, sheet in enumerate(part["surfaces"]):
        row = next(
          s
          for s in ENVELOPE["surfaces"]
          if s["owner"] == oi and s["part"] == part["id"] and s["sheet"] == si
        )
        source_vertices = {
          (x, round(y + owner["displayOffsetY"], 3), z)
          for ring in sheet["rings"]
          for x, y, z in ring
        }
        rendered_vertices = {tuple(v) for t in row["triangles"] for v in t}
        # Constrained triangulation retains every original sheet vertex.
        assert rendered_vertices == source_vertices
        expected[owner["site"]] += 1
  assert sum(expected.values()) == AUDIT["sourceSheets"] == 2751
  assert Counter(o["site"] for o in SOURCE["owners"]) == {
    "tegel": 54,
    "hq": 53,
    "hsh": 11,
  }


def test_footprints_are_exact_sites_and_ground_adds_only_missing_coverage() -> None:
  assert [s["id"] for s in SOURCE["sites"]] == [
    "way/7249400",
    "way/46839070",
    "way/367216314",
  ]
  assert SOURCE["sites"][0]["priorCoverageFraction"] == 0
  assert SOURCE["sites"][1]["priorCoverageFraction"] == pytest.approx(0.21817362336)
  assert SOURCE["sites"][2]["priorCoverageFraction"] == pytest.approx(1)
  for site in SOURCE["sites"]:
    context = shape(site["context"])
    original = shape(site["geometry"])
    assert context.hausdorff_distance(original.buffer(12, join_style=2)) < 1e-8
    for surface in ENVELOPE["ground"]:
      if surface["site"] != site["key"]:
        continue
      for t in surface["triangles"]:
        assert (
          shape(site["newGround"])
          .buffer(1e-8)
          .covers(Polygon([(x, z) for x, _, z in t]))
        )
  assert shape(SOURCE["sites"][2]["newGround"]).area < 1e-5


def test_perimeter_follows_retained_osm_and_keeps_separate_tegel_identity() -> None:
  source = {b["id"]: b for s in SOURCE["sites"] for b in s["barriers"]}
  assert len(AUDIT["barriers"]) == 37
  for barrier in AUDIT["barriers"]:
    assert (
      barrier["sourceCoordinates"] == source[barrier["id"]]["geometry"]["coordinates"]
    )
    if barrier["id"] in ["way/367216300", "way/367216308"]:
      assert barrier["height"] == 4
      assert barrier["heightEvidence"] == "OSM height tag"
  assert len(SOURCE["sites"][0]["barriers"]) == 17
  # Neither current Moabit nor the former Lehrter prison is renamed/replaced.
  assert "DEBE01YYK0002Sgs" not in ENVELOPE["sourceIds"]
  assert "DEBE01AL2yz00000" not in ENVELOPE["sourceIds"]


def test_window_extents_are_inside_real_wall_planes() -> None:
  for window in AUDIT["windows"]:
    face = AUDIT["faces"][window["face"]]
    a, d = face["a"], face["direction"]
    rings = [
      [(sum((p[k] - a[k]) * d[k] for k in range(3)), p[1]) for p in ring]
      for ring in face["rings"]
    ]
    wall = Polygon(rings[0], rings[1:]).buffer(1e-7)
    u, y, w, h = (window[k] for k in ["along", "y", "width", "height"])
    assert wall.covers(
      box(u - w / 2 - 0.1, y - h / 2 - 0.1, u + w / 2 + 0.1, y + h / 2 + 0.1)
    )


def test_prepared_assets_reproduce_without_raw_downloads() -> None:
  result, nav, audit = build()
  assert {k: result[k] for k in ENVELOPE} == ENVELOPE
  assert [r[:8] + [r[9]] for r in result["boxes"]] == DETAIL["boxes"]
  assert [r[:7] + [r[8]] for r in result["blocks"]] == DETAIL["blocks"]
  assert audit == AUDIT
  assert nav == json.loads(
    (ROOT / "src/app/src/data/prisonsMemorialsV209Navigation.json").read_bytes()
  )
  assert (
    AUDIT["sourceSha256"]
    == hashlib.sha256(
      (GEO / "prisons-memorials-v209-source.json").read_bytes()
    ).hexdigest()
  )
  assert (
    max(
      (ROOT / "src/app/src/data" / n).stat().st_size
      for n in ["prisonsMemorialsV209.json", "prisonsMemorialsV209Envelopes.json"]
    )
    < 5 * 1024 * 1024
  )


def test_native_skin_is_hollow_and_preserves_every_sampled_surface_cell() -> None:
  count = sum(r[3] * r[4] * r[5] for r in ENVELOPE["envelopeBlocks"])
  assert count == AUDIT["surfaceCells"] == 284396
  # This is a wall/roof surface skin; occupancy is far smaller than solid volumes.
  volume = sum(
    shape(o["footprint"]).area
    * (max(p["top_y_m"] for p in o["parts"]) + o["displayOffsetY"] - 3)
    for o in SOURCE["owners"]
  )
  assert count < volume * 0.35
  hsh = unary_union(
    [shape(o["footprint"]) for o in SOURCE["owners"] if o["site"] == "hsh"]
  )
  assert not hsh.covers(Point(8900, -2345))


def test_old_source_shell_and_ink_receipts_match_every_original_primitive() -> None:
  from scripts.build_prisons_memorials_ownership_v209 import build as ownership

  receipt = ownership()
  assert receipt == json.loads(
    (ROOT / "src/app/src/data/prisonsMemorialsOwnershipV209.json").read_bytes()
  )
  assert len(receipt["records"]) == 44
  assert sum(len(r["triangles"]) for r in receipt["records"]) == 3368
  assert len(receipt["lineRecords"]) == 22
  assert {r["tile"] for r in receipt["records"]} == {"outer187-15_1", "east200-17_-5"}
  assert len(receipt["navigationRecords"]) == 44
  assert Counter(r["mode"] for r in receipt["navigationRecords"]) == {
    "drawn": 22,
    "minecraft": 22,
  }
  required_owners = {o["id"] for o in SOURCE["owners"]}
  for record in receipt["navigationRecords"]:
    assert record["original"]["sourceId"] == record["owner"]
    assert record["replacementOwners"]
    assert set(record["replacementOwners"]) <= required_owners


def test_all_prepared_json_is_strict_finite_json() -> None:
  paths = [
    GEO / "prisons-memorials-v209-source.json",
    GEO / "prisons-memorials-v209-evidence.json",
    *(ROOT / "src/app/src/data").glob("prisonsMemorials*V209*.json"),
  ]
  for path in paths:
    json.loads(
      path.read_bytes(),
      parse_constant=lambda value: pytest.fail(f"{path.name}: nonfinite {value}"),
    )
