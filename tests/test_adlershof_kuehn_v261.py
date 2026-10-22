"""Complete measured-owner transfer, bounded Kühn site and strict lineage."""

import copy
import importlib
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pytest
from shapely import wkb
from shapely.geometry import Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
build = importlib.import_module("build_adlershof_kuehn_v261")
integration = importlib.import_module("scripts.integrate_adlershof_kuehn_v261")
read = build.io.read_json


@pytest.fixture(scope="module")
def addition():
  return read(build.ADDITION)


@pytest.fixture(scope="module")
def source():
  return read(build.SOURCE)


@pytest.fixture(scope="module")
def previous():
  return integration.predecessor_manifest_v261(read(build.OUT / "manifest.json"))


def test_exact_source_identity_and_complete_surfaces(source):
  assert len(source["buildings"]) == 8
  assert sum(len(b["parts"]) for b in source["buildings"]) == 27
  assert {a["url"].split("/")[-1] for a in source["archives"]} == {
    "LoD2_400_5810.zip",
    "LoD2_400_5809.zip",
    "LoD2_402_5807.zip",
  }
  for building in source["buildings"]:
    for part in building["parts"]:
      kinds = {s["kind"] for s in part["surfaces"]}
      assert {"RoofSurface", "WallSurface", "GroundSurface"} <= kinds
      assert part["maxY"] > part["minY"] >= 3
      assert all(s["rings"] and len(s["rings"][0]) >= 3 for s in part["surfaces"])
  kuehn = [b for b in source["buildings"] if b["site"] == "kuehn"]
  assert len(kuehn) == 4 and all(b["oldOwner"] is None for b in kuehn)
  site = unary_union(
    [shape(g) for b in kuehn for p in b["parts"] for g in p["footprints"]]
  )
  # Richterstraße 6 atelier footprint, not the street-front historical Vorwerk.
  assert 13314 < site.bounds[0] < 13315 and 12402 < site.bounds[1] < 12403
  assert 13375 < site.bounds[2] < 13376 and 12457 < site.bounds[3] < 12458
  assert site.area < 1500 and site.convex_hull.area < 2500


@pytest.mark.parametrize("mode", ["drawn", "minecraft"])
def test_every_unrelated_vertex_colour_triangle_and_navigation_is_preserved(
  source, addition, mode
):
  for transfer in addition["replacements"]:
    old = read(build.OUT / transfer["old"][mode]["url"])
    new = read(build.OUT / transfer["new"][mode]["url"])
    owners = {r["sourceId"] for r in old["nav"]["buildings"]}
    selected = [b for b in source["buildings"] if b["oldOwner"] and b["id"] in owners]
    filtered = copy.deepcopy(old)
    receipt = build.remove_old(filtered, selected, mode, transfer["old"]["bounds"])
    assert receipt["removedTriangles"] == receipt["expectedTriangles"] > 100
    assert filtered["meshes"] == new["meshes"][: len(old["meshes"])]
    for om, nm in zip(old["meshes"], new["meshes"]):
      assert {k: v for k, v in om.items() if k != "indices"} == {
        k: v for k, v in nm.items() if k != "indices"
      }
    assert filtered.get("lines") == new.get("lines")
    assert {k: v for k, v in filtered["nav"].items() if k != "buildings"} == {
      k: v for k, v in new["nav"].items() if k != "buildings"
    }
    untouched = filtered["nav"]["buildings"]
    assert untouched == new["nav"]["buildings"][: len(untouched)]


def test_every_source_roof_and_wall_triangle_survives_and_native_is_orthogonal(
  source, addition
):
  groups = [
    (r["new"], len(read(build.OUT / r["old"]["drawn"]["url"])["meshes"]))
    for r in addition["replacements"]
  ]
  groups.append((addition["chunks"][0], 1))
  for desc, offset in groups:
    packet = read(build.OUT / desc["drawn"]["url"])
    owners = {n["sourceId"] for n in packet["nav"]["buildings"]}
    selected = [b for b in source["buildings"] if b["id"] in owners]
    actual = Counter()
    for mesh in packet["meshes"][offset:]:
      positions, indices = build.arrays(mesh)
      actual.update(build.signature(t) for t in positions[indices])
    expected = Counter()
    for b in selected:
      for p in b["parts"]:
        for surface in p["surfaces"]:
          if surface["kind"] in {"WallSurface", "RoofSurface"}:
            for t in build.triangles_for(surface["rings"]):
              key = build.signature(np.rint((np.asarray(t) - packet["origin"]) * 100))
              # Standard packet precision is one centimetre: five ESZ sliver
              # triangles collapse to two positions; frozen source keeps them.
              if len(set(key)) == 3:
                expected[key] += 1
    assert expected and not (expected - actual)
    native = read(build.OUT / desc["minecraft"]["url"])
    for mesh in native["meshes"][offset:]:
      points, indices = build.arrays(mesh)
      t = points[indices].astype(np.int64)
      normals = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
      assert np.all(np.count_nonzero(normals, axis=1) == 1)
    assert desc["drawn"]["sha256"] != desc["minecraft"]["sha256"]


def test_windkanal_real_court_holes_are_not_blocked(source):
  building = next(b for b in source["buildings"] if b["name"] == "Großer Windkanal")
  old = wkb.loads(building["oldOwner"]["wkb"], hex=True)
  measured = unary_union([shape(g) for p in building["parts"] for g in p["footprints"]])
  assert measured.symmetric_difference(old).area < 0.000001
  assert len(measured.interiors) == 2
  nav = build.navigation([building], [0, 0, 20000, 20000], "drawn")
  obstacles = unary_union([Polygon(n["ring"], n["holes"]) for n in nav])
  for hole in measured.interiors:
    assert not obstacles.covers(Polygon(hole).representative_point())


def test_strict_reversible_manifest_change(previous, addition):
  snapshot = copy.deepcopy(previous)
  current = integration.merged(previous, addition)
  assert previous == snapshot
  assert len(current["chunks"]) == len(previous["chunks"]) + 1 == 2194
  assert integration.predecessor_manifest_v261(current) == previous
  integration.verify_packets(addition)


@pytest.mark.parametrize(
  "mutation", ["old", "missing", "extra", "bounds", "metadata", "footprint"]
)
def test_replay_rejects_every_unreceipted_manifest_edit(previous, addition, mutation):
  current = integration.merged(previous, addition)
  if mutation == "old":
    current["chunks"][0]["drawn"]["sha256"] = "0" * 64
  elif mutation == "missing":
    current["chunks"].pop()
  elif mutation == "extra":
    current["chunks"].append({**current["chunks"][-1], "id": "unapproved"})
  elif mutation == "bounds":
    current["chunks"][-1]["bounds"][0] += 2
  elif mutation == "metadata":
    current["version"] = "unreceipted"
  else:
    current["footprint"][0]["ring"][0][0] += 2
  with pytest.raises(AssertionError):
    integration.predecessor_manifest_v261(current)


@pytest.mark.parametrize(
  "target",
  [
    "source",
    "old-drawn",
    "old-minecraft",
    "new-drawn",
    "new-minecraft",
    "kuehn-drawn",
    "kuehn-minecraft",
  ],
)
def test_replay_reads_and_checks_exact_actual_assets(previous, addition, target):
  path = build.SOURCE
  if target != "source":
    group, mode = target.split("-")
    descriptor = (
      addition["chunks"][0] if group == "kuehn" else addition["replacements"][0][group]
    )
    path = build.OUT / descriptor[mode]["url"]

  def corrupt(candidate):
    raw = candidate.read_bytes()
    return raw[:-1] + bytes([raw[-1] ^ 1]) if candidate == path else raw

  with pytest.raises(AssertionError):
    integration.predecessor_manifest_v261(
      integration.merged(previous, addition), corrupt
    )
