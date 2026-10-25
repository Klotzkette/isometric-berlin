"""Finite source ownership and material priority for the v271 colour repair."""

from __future__ import annotations

import base64
from pathlib import Path

import numpy as np

from scripts import build_north_mitte_colours_v271 as module

ROOT = Path(__file__).resolve().parents[1]


def test_finite_source_selection_uses_complete_families_and_court_holes() -> None:
  record = {
    "footprintPolygons": [
      {
        "ring": [[2100, -1800], [2150, -1800], [2150, -1750], [2100, -1750]],
        "holes": [[[2110, -1790], [2140, -1790], [2140, -1760], [2110, -1760]]],
      }
    ]
  }
  shape = module.footprint(record)
  assert shape.area == 1600
  assert module.zones_for(record) == ["zionskirchplatz-arkonaplatz"]
  outside = {
    "footprintPolygons": [{"ring": [[5000, 0], [5010, 0], [5010, 10]], "holes": []}]
  }
  assert module.zones_for(outside) == []
  assert module.palette("same-source-family") == module.palette("same-source-family")
  assert len({module.palette(f"source-{i}")[0] for i in range(100)}) == len(
    module.WALL_TONES
  )


def test_runtime_receipts_retain_all_original_packet_bytes_and_only_selected_cells() -> (
  None
):
  evidence = module.prior.read(module.EVIDENCE)
  runtime = module.prior.read(module.OUTPUT)
  assert module.prior.read(module.INDEX) == sorted(runtime["packets"])
  assert evidence["packetFilesChanged"] == 0
  assert evidence["sourceManifestSha256"] == module.prior.digest(
    module.prior.SOURCE / "source-manifest.json"
  )
  assert evidence["v213ProtectionSha256"] == module.prior.digest(module.prior.PROTECTED)
  for receipt in evidence["packetReceipts"]:
    assert module.prior.digest(ROOT / receipt["file"]) == receipt["sha256"]
  for rows in runtime["packets"].values():
    for row in rows:
      runs = np.frombuffer(base64.b64decode(row["runs"]), dtype="<u4").reshape(-1, 3)
      assert len(runs) > 0
      assert np.all(runs[:, 1] > 0)
      assert np.all(runs[:, 2] < len(runtime["palette"]))
      assert np.all(runs[1:, 0] >= runs[:-1, 0] + runs[:-1, 1])
  assert all(
    evidence["modeCounts"][mode]["selectedVertices"] > 10_000
    for mode in ("drawn", "minecraft")
  )


def test_recorded_material_roles_and_authored_modern_owners_stay_protected() -> None:
  evidence = module.prior.read(module.EVIDENCE)
  owners = {owner["id"]: owner for owner in evidence["owners"]}
  protected, _ = module.protected_owners()
  changed = set().union(*map(set, evidence["ownersReceivingSelectors"].values()))
  assert not changed & protected
  assert not changed & module.EXTRA_PROTECTED
  # Explicit red and black roof observations at the photographed park remain
  # unchanged even when their unobserved ordinary wall paint may be corrected.
  for identity in ("DEBE01YYK0000BuF", "DEBE01YYK00004cb", "DEBE01YYK0000DSW"):
    assert not owners[identity]["roofEligible"]
  for record in module.prior.source_records():
    item = owners.get(record["id"])
    if not item:
      continue
    assert item["zones"] == module.zones_for(record)
    tags = record.get("osmTags", {})
    if tags.get("building:colour") or tags.get("building:material"):
      assert not item["wallEligible"]
    if tags.get("roof:colour") or tags.get("roof:material"):
      assert not item["roofEligible"]
    assert set(item["parts"]) == {part["id"] for part in record["parts"]}


def test_native_observed_role_is_a_blocker_not_a_fallback_colour() -> None:
  surfaces, native, _, _, _ = module.source_selectors()
  assert surfaces and native
  known_roof = [
    part
    for part in native
    if part.owner == "DEBE01YYK0000BuF" and part.roles[0][0] == "RoofSurface"
  ]
  assert known_roof and all(not part.allowed for part in known_roof)
  assert all(len(part.roles) == 1 for part in native)
  for parent in module.EXTRA_PROTECTED:
    assert all(not part.allowed for part in native if part.owner == parent)
    assert all(not sheet.allowed for sheet in surfaces if sheet.owner == parent)


def test_blocker_scope_follows_full_selected_families_beyond_zone_edges() -> None:
  def record(identity: str, left: float, right: float) -> dict:
    return {
      "id": identity,
      "category": "outer",
      "sourceType": "official-lod2",
      "footprintPolygons": [
        {
          "ring": [[left, -1220], [right, -1220], [right, -1200], [left, -1200]],
          "holes": [],
        }
      ],
    }

  selected = record("selected-family", 1810, 1940)
  neighbour = record("outside-zone-neighbour", 1780, 1808)
  distant = record("distant-owner", 1740, 1760)
  scope = module.scoped_records([selected, neighbour, distant])
  assert {row[0]["id"] for row in scope} == {
    "selected-family",
    "outside-zone-neighbour",
  }
  assert module.zones_for(selected) == ["weinbergspark"]
  assert module.zones_for(neighbour) == []


def test_actual_native_boundary_neighbours_block_ambiguous_colour_receipts() -> None:
  _, native, _, _, _ = module.source_selectors()
  runtime = module.prior.read(module.OUTPUT)
  for tile, mesh, vertices, neighbour in (
    ("3_-4", 2, [75407, 75408, 75409], "DEBE01YYK00001Q3"),
    ("3_-3", 4, [61199, 61200, 61201, 61202], "DEBE01YYK0001xRb"),
  ):
    packet = module.prior.read(module.prior.PUBLIC / f"{tile}.minecraft.json.gz")
    part = packet["meshes"][mesh]
    assert part["kind"] == module.prior.KIND
    positions = (
      np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3) / 100
      + packet["origin"]
    )
    colours = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
    triangle = positions[vertices[:3]]
    before = tuple(int(channel) for channel in colours[vertices[0]])
    matches = [row for row in native if row.candidates(triangle, before)]
    assert len({row.owner for row in matches}) > 1
    blockers = [row for row in matches if row.owner == neighbour]
    assert blockers and all(not row.allowed for row in blockers)
    rows = runtime["packets"].get("minecraft:" + tile, [])
    for receipt in rows:
      if receipt["mesh"] != mesh:
        continue
      runs = np.frombuffer(base64.b64decode(receipt["runs"]), "<u4").reshape(-1, 3)
      assert all(
        not any(start <= vertex < start + count for start, count, _ in runs)
        for vertex in vertices
      )
