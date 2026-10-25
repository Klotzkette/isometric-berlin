"""Verify finite Kollwitz paint receipts against immutable source geometry."""

import base64
from collections import Counter

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

from scripts import build_kollwitz_materials_v271 as build


def test_owner_scope_material_priority_and_positive_ordinary_evidence():
  evidence = build.base.read_json(build.EVIDENCE)
  context = build.base.read_json(build.CONTEXT)
  assert build.appearance.digest(build.CONTEXT) == evidence["contextSha256"]
  assert tuple(evidence["bounds"]) == build.BOUNDS
  assert tuple(evidence["tiles"]) == build.TILES
  assert len(evidence["owners"]) == 433
  assert evidence["ownerCountsByZone"] == {
    "Kollwitzkiez": 408,
    "northern Kastanienallee": 25,
  }
  assert len(evidence["existingFacadeOwners"]) == 166
  assert not set(evidence["owners"]) & set(evidence["protectedOwners"])
  packets = {
    tile: build.base.read_json(build.OUT / f"{tile}.drawn.json.gz")
    for tile in build.TILES
  }
  mapped = {row["id"]: row for row in context["records"]}
  _, fronts = build.protected_owners()
  _, course = build.kastanien_courses()
  for owner, record in evidence["owners"].items():
    assert record["estimatedPaint"] is True
    assert [list(tone) for tone in build.swatches(owner)] == [
      record["wall"],
      record["roof"],
    ]
    parts = []
    for packet in packets.values():
      for row in packet["nav"]["buildings"]:
        if row["sourceId"] == owner:
          parts.append(
            translate(
              Polygon(row["ring"], row["holes"]),
              packet["origin"][0],
              packet["origin"][2],
            )
          )
    geometry = unary_union(parts)
    if record["zone"] == "Kollwitzkiez":
      assert box(*build.BOUNDS).covers(geometry)
    else:
      assert record["zone"] == "northern Kastanienallee"
      assert geometry.distance(course) <= 25
      assert course.buffer(75).covers(geometry)
    for row in context["records"]:
      if row["ordinary"] and not row["tags"]:
        continue
      assert geometry.intersection(shape(row["geometry"])).area / geometry.area <= 0.05
    proof = record["evidence"]
    if "osm" in proof:
      row = mapped[proof["osm"]]
      assert row["ordinary"] and not row["tags"]
      osm = shape(row["geometry"])
      overlap = geometry.intersection(osm).area
      assert min(overlap / geometry.area, overlap / osm.area) >= 0.97
    else:
      assert owner in fronts and proof["facadeOwner"] == owner


def test_receipts_replay_exact_existing_generic_surfaces_only():
  evidence = build.base.read_json(build.EVIDENCE)
  output = build.base.read_json(build.OUTPUT)
  assert build.OUTPUT.stat().st_size < 26_000
  assert len(output["packets"]) == 12
  assert len(set(tuple(row["wall"]) for row in evidence["owners"].values())) == 12
  counts = Counter()
  changed_owners = set()
  for asset in evidence["assets"]:
    path = build.OUT / asset["url"]
    assert build.appearance.digest(path) == asset["sha256"]
    family = "minecraft" if ".minecraft." in path.name else "drawn"
    tile = path.name.removesuffix(f".{family}.json.gz")
    assert tile in build.TILES
    packet = build.base.read_json(path)
    for receipt in output["packets"][family + ":" + tile]:
      part = packet["meshes"][receipt["mesh"]]
      assert part["kind"] == "city"
      assert build.appearance.fingerprint(part) == receipt["fingerprint"]
      expected, owners = build.previous.owned_colours(
        part, packet, evidence["owners"], family == "minecraft"
      )
      assert owners <= set(evidence["owners"])
      actual = {}
      original = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
      for first, count, palette in np.frombuffer(
        base64.b64decode(receipt["runs"]), "<u4"
      ).reshape(-1, 3):
        value = output["palette"][palette]
        for vertex in range(int(first), int(first + count)):
          assert vertex not in actual
          assert tuple(original[vertex]) in {build.previous.WALL, build.previous.ROOF}
          actual[vertex] = (value >> 16, (value >> 8) & 255, value & 255)
      assert actual == expected
      changed_owners.update(
        build.changed_owners(part, packet, actual, evidence["owners"])
      )
      counts[family + "Vertices"] += len(actual)
  assert dict(counts) == evidence["counts"]
  assert changed_owners == set(evidence["owners"])


def test_mapped_material_receipts_never_overlap_new_colour_vertices():
  current = build.base.read_json(build.OUTPUT)
  for name in ("outerMaterialsV232", "outerMaterialsV254", "outerMaterialsV263"):
    previous = build.base.read_json(build.ROOT / f"src/app/src/data/{name}.json")
    for key in set(current["packets"]) & set(previous["packets"]):

      def vertices(receipts: list) -> set:
        return {
          (receipt["mesh"], vertex)
          for receipt in receipts
          for first, count, _ in np.frombuffer(
            base64.b64decode(receipt["runs"]), "<u4"
          ).reshape(-1, 3)
          for vertex in range(int(first), int(first + count))
        }

      assert not vertices(current["packets"][key]) & vertices(previous["packets"][key])


def test_northern_kastanien_gap_uses_exact_roads_and_preserves_all_nineteen_fronts():
  evidence = build.base.read_json(build.EVIDENCE)
  context = build.base.read_json(build.CONTEXT)
  assert build.appearance.digest(build.STREETS) == context["streetContextSha256"]
  actual = {
    row["id"]: shape(row["geometry"]) for row in evidence["northernKastanienRoads"]
  }
  assert set(actual) == {
    "4068019",
    "30123475",
    "1158185611",
    "11103963",
    "1158157065",
    "344753256",
    "1254736562",
    "1158157064",
    "1259320615",
  }
  originals = {row["id"]: row for row in build.base.read_json(build.STREETS)["roads"]}
  for source_id, geometry in actual.items():
    assert originals[source_id]["name"] == "Kastanienallee"
    assert geometry.equals(
      shape(originals[source_id]["geometry"]).intersection(box(*build.KASTANIEN_CLIP))
    )
  assert 478.83 < unary_union(list(actual.values())).length < 478.85
  fronts = set(evidence["northernKastanienPreservedFronts"])
  assert len(fronts) == 19
  assert fronts <= {
    owner
    for owner, row in evidence["owners"].items()
    if row["zone"] == "northern Kastanienallee"
  }
  for record in evidence["preservedFittingSources"]:
    assert build.appearance.digest(build.ROOT / record["path"]) == record["sha256"]
  # The new generic shell paint does not modify the v254 shop aperture recipe.
  assert any(
    row["path"].endswith("northShopfrontsV254.json")
    for row in evidence["preservedFittingSources"]
  )
