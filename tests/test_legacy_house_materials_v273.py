"""All legacy families, positive use, precise colour-only ownership and native proof."""

from __future__ import annotations

import base64
from collections import Counter

import numpy as np
from shapely.geometry import box
from shapely.strtree import STRtree

from scripts import build_legacy_house_materials_v273 as module


def test_all_retained_families_are_audited_without_neighbourhood_sampling() -> None:
  evidence = module.prior.read(module.EVIDENCE)
  source = module.source_records()
  assert len(evidence["owners"]) == sum(map(len, source.values())) == 1449
  assert Counter(row["kind"] for row in evidence["owners"]) == {
    kind: len(rows) for kind, rows in source.items()
  }
  assert len({r["id"] for r in evidence["owners"]}) == 1449
  assert set(module.SOURCES) == {
    "city-west-street-fronts-v163",
    "mitte-street-fronts-v166",
    "oranien-corridors-v167",
    "scheunenviertel-v168",
  }
  for kind, records in source.items():
    known = {row["id"]: row for row in records}
    for row in evidence["owners"]:
      if row["kind"] == kind:
        assert row["parts"] == [part["id"] for part in known[row["id"]]["parts"]]
        assert row["bounds"] == list(
          module.legacy.footprint(known[row["id"]]["parts"]).bounds
        )


def test_positive_house_semantics_do_not_recolour_named_or_institutional_buildings() -> (
  None
):
  for building in ("apartments", "residential", "house", "retail", "office"):
    assert module.ordinary_tags({"building": building})
  for tags in (
    {},
    {"building": "yes"},
    {"building": "church"},
    {"building": "school"},
    {"building": "yes", "name": "Named theatre"},
    {"building": "apartments", "amenity": "hospital"},
    {"building": "yes", "tourism": "museum"},
  ):
    assert not module.ordinary_tags(tags)
  left, right = box(0, 0, 5, 10), box(5, 0, 10, 10)
  rows = [
    {"id": "left", "tags": {"building": "apartments"}},
    {"id": "right", "tags": {"building": "residential"}},
  ]
  assert module.ordinary_context(
    box(0, 0, 10, 10), rows, [left, right], STRtree([left, right])
  ) == (True, ["left", "right"], 1.0)
  rows[1]["tags"]["building"] = "church"
  assert not module.ordinary_context(
    box(0, 0, 10, 10), rows, [left, right], STRtree([left, right])
  )[0]
  assert not module.ordinary_context(
    box(0, 0, 30, 10), rows[:1], [left], STRtree([left])
  )[0]


def test_prior_authored_and_v271_owners_and_material_evidence_remain_protected() -> (
  None
):
  evidence = module.prior.read(module.EVIDENCE)
  rows = {r["id"]: r for r in evidence["owners"]}
  context = {r["id"]: r["tags"] for r in module.prior.read(module.CONTEXT)["records"]}
  old = {r["id"] for r in module.prior.read(module.legacy.EVIDENCE)["owners"]}
  assert len(old) == 75
  for owner in old:
    assert rows[owner]["protected"]
    assert not rows[owner]["wallEligible"] and not rows[owner]["roofEligible"]
  for row in rows.values():
    if row["ordinary"]:
      assert row["semanticIds"]
      assert all(
        context[identity].get("building") not in {None, "yes"}
        and module.ordinary_tags(context[identity])
        for identity in row["semanticIds"]
      )
    if row["protected"] or not row["ordinary"]:
      assert not row["wallEligible"] and not row["roofEligible"]
    if row["contextId"]:
      assert min(row["contextCoverage"]) >= 0.97
      wall, roof = module.legacy.material_tones(row["tags"])
      if wall:
        assert tuple(row["wallSrgb"]) == wall
      if roof:
        assert tuple(row["roofSrgb"]) == roof
  for mode, selected in evidence["ownersReceivingSelectors"].items():
    assert not set(selected) & old
    assert all(
      rows[owner]["ordinary"] and not rows[owner]["protected"] for owner in selected
    )
    assert len(selected) > (500 if mode == "drawn" else 400)


def test_complete_source_packet_coordinates_topology_and_navigation_remain_exact() -> (
  None
):
  evidence = module.prior.read(module.EVIDENCE)
  assert evidence["packetFilesChanged"] == 0
  assert module.prior.read(module.INDEX) == sorted(
    module.prior.read(module.OUTPUT)["packets"]
  )
  for row in (
    evidence["sourceFiles"] + evidence["protectionSources"] + evidence["packetReceipts"]
  ):
    assert module.prior.digest(module.ROOT / row["file"]) == row["sha256"], row["file"]
  assert evidence["runtimeBytes"] < 2 * 1024 * 1024
  assert evidence["runtimeGzipBytes"] < 400 * 1024


def test_each_actual_selector_only_changes_exact_old_wall_roof_colour_cells() -> None:
  evidence = module.prior.read(module.EVIDENCE)
  runtime = module.prior.read(module.OUTPUT)
  allowed = {module.prior.linear(module.WALL), module.prior.linear(module.ROOF)}
  counts = Counter()
  seen = set()
  for row in evidence["packetReceipts"]:
    path = module.ROOT / row["file"]
    packet = module.prior.read(path)
    key = row["mode"] + ":" + path.name.split(".")[0]
    for receipt in runtime["packets"][key]:
      part = packet["meshes"][receipt["mesh"]]
      assert part["kind"] == receipt["kind"] in module.SOURCES
      seen.add((row["mode"], part["kind"]))
      assert module.prior.fingerprint(part) == receipt["fingerprint"]
      colours = np.frombuffer(base64.b64decode(part["colors"]), dtype="u1").reshape(
        -1, 3
      )
      runs = np.frombuffer(base64.b64decode(receipt["runs"]), dtype="<u4").reshape(
        -1, 3
      )
      end = 0
      for first, count, tone in (map(int, r) for r in runs):
        assert first >= end and count > 0 and first + count <= len(colours)
        assert {
          tuple(map(int, rgb)) for rgb in colours[first : first + count]
        } <= allowed
        assert 0 <= runtime["palette"][tone] <= 0xFFFFFF
        end = first + count
        counts[row["mode"]] += count
  assert seen == {
    (mode, kind) for mode in ("drawn", "minecraft") for kind in module.SOURCES
  }
  assert dict(counts) == {
    mode: stats["selectedVertices"] for mode, stats in evidence["modeCounts"].items()
  }


def test_ambiguous_native_shared_faces_stay_unmodified() -> None:
  before = module.prior.linear(module.WALL)
  left = module.prior.NativePart(
    "one",
    "part",
    box(-3, -3, 3, 3),
    0,
    10,
    (("WallSurface", before, (80, 100, 120)),),
    True,
  )
  right = module.prior.NativePart(
    "protected",
    "part",
    box(-3, -3, 3, 3),
    0,
    10,
    (("WallSurface", before, (120, 90, 80)),),
    False,
  )
  points = np.asarray([[0, 0, 0], [0, 2, 0], [2, 2, 0]], dtype=float)
  part = {
    "positions": base64.b64encode(
      np.rint(points * 100).astype("<u2").tobytes()
    ).decode(),
    "colors": base64.b64encode(
      np.tile(np.asarray(before, dtype="u1"), (3, 1)).tobytes()
    ).decode(),
    "indices": base64.b64encode(np.asarray([0, 1, 2], dtype="<u4").tobytes()).decode(),
  }
  counts, owners = Counter(), set()
  assert (
    module.prior.compile_mesh(
      part,
      [0, 0, 0],
      [],
      [left, right],
      True,
      STRtree([left.footprint, right.footprint]),
      [left, right],
      counts,
      owners,
    )
    == {}
  )
  assert not owners


def test_shared_wall_component_vetoes_any_protected_or_known_neighbour(
  monkeypatch,
) -> None:
  kind = "city-west-street-fronts-v163"
  records = [
    {
      "id": "ordinary-a",
      "parts": [
        {
          "id": "a",
          "surfaces": [
            {
              "kind": "WallSurface",
              "rings": [[[0, 0, 0], [1, 0, 0], [1, 4, 0], [0, 4, 0]]],
            }
          ],
        }
      ],
    },
    {
      "id": "ordinary-b",
      "parts": [
        {
          "id": "b",
          "surfaces": [
            {
              "kind": "WallSurface",
              "rings": [[[1, 0, 0], [2, 0, 0], [2, 4, 0], [1, 4, 0]]],
            }
          ],
        }
      ],
    },
  ]
  monkeypatch.setattr(module, "source_records", lambda: {kind: records})
  rows = [
    {"id": record["id"], "offsetY": 0, "wallEligible": True, "wallUnknown": True}
    for record in records
  ]
  components, report = module.shared_wall_components({kind: []}, {kind: []}, rows)
  assert set(components) == {"ordinary-a", "ordinary-b"}
  assert len(set(components.values())) == 1
  assert report[0]["eligible"]
  assert rows[0]["wallSrgb"] == rows[1]["wallSrgb"]
  for key in ("wallEligible", "wallUnknown"):
    rows[1][key] = False
    components, report = module.shared_wall_components({kind: []}, {kind: []}, rows)
    assert not components and not report[0]["eligible"]
    rows[1][key] = True


def test_shared_native_wall_requires_one_safe_component_and_every_incident_face() -> (
  None
):
  before, after = module.prior.linear(module.WALL), (80, 100, 120)
  one = module.prior.NativePart(
    "one", "a", box(-3, -3, 3, 3), 0, 10, (("WallSurface", before, after),), True
  )
  two = module.prior.NativePart(
    "two", "b", box(-3, -3, 3, 3), 0, 10, (("WallSurface", before, after),), True
  )
  points = np.asarray(
    [[0, 0, 0], [0, 2, 0], [2, 2, 0], [3, 2, 0], [3, 0, 0]], dtype=float
  )

  def mesh(foreign: bool = False) -> dict:
    colours = np.tile(np.asarray(before, dtype="u1"), (5, 1))
    if foreign:
      colours[3:] = [20, 30, 40]
    return {
      "positions": base64.b64encode(
        np.rint(points * 100).astype("<u2").tobytes()
      ).decode(),
      "colors": base64.b64encode(colours.tobytes()).decode(),
      "indices": base64.b64encode(
        np.asarray([0, 1, 2, 2, 3, 4], dtype="<u4").tobytes()
      ).decode(),
    }

  def compile(part: dict, components: dict) -> dict:
    return module.compile_mesh(
      part,
      [0, 0, 0],
      [],
      [one, two],
      True,
      STRtree([one.footprint, two.footprint]),
      [one, two],
      Counter(),
      set(),
      components,
    )

  assert compile(mesh(), {"one": "component", "two": "component"}) == {
    i: after for i in range(5)
  }
  assert not compile(mesh(), {"one": "component", "two": "other"})
  assert not compile(mesh(True), {"one": "component", "two": "component"})
  two.allowed = False
  assert not compile(mesh(), {"one": "component", "two": "component"})


def test_every_committed_shared_component_is_complete_unknown_and_unprotected() -> None:
  evidence = module.prior.read(module.EVIDENCE)
  owners = {row["id"]: row for row in evidence["owners"]}
  approved = [row for row in evidence["sharedWallComponents"] if row["eligible"]]
  assert approved
  for component in approved:
    assert len(component["owners"]) > 1
    assert component["owners"] == sorted(component["owners"])
    for identity in component["owners"]:
      row = owners[identity]
      assert row["ordinary"] and row["wallEligible"] and row["wallUnknown"]
      assert not row["protected"]
      assert row["kind"] == component["kind"]
      assert row["sharedWallComponent"] == component["id"]
      assert row["wallSrgb"] == component["wallSrgb"]
  for component in evidence["sharedWallComponents"]:
    if not component["eligible"]:
      assert any(
        not owners[identity]["wallEligible"] or not owners[identity]["wallUnknown"]
        for identity in component["owners"]
      )
