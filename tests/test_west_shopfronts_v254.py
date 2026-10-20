"""Replay delivered panes, source owners and positive commercial-use evidence."""

import importlib.util
import sys
from pathlib import Path

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "shopfront254", ROOT / "scripts/build_west_shopfronts_v254.py"
)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


def test_exact_prior_openings_and_source_hashes() -> None:
  proof, runtime = b.read(b.EVIDENCE), b.read(b.RUNTIME)
  sections = {"drawn": set(), "minecraft": set()}
  for packet in proof["packets"]:
    mode, identity = packet["key"].split(":")
    path = b.OUT / f"{identity}.{mode}.json.gz"
    assert b.digest(path) == packet["packetSha256"]
    chunk = b.read(path)
    plan = runtime["packets"][packet["key"]]
    assert len(plan["fields"]) == len(packet["fields"])
    triangles, cells = set(), set()
    for guard in plan["guards"]:
      part = chunk["meshes"][guard["mesh"]]
      assert part["kind"] == guard["kind"]
      assert (
        b.fingerprint([part["positions"], part["colors"], part["indices"]])
        == guard["fingerprint"]
      )
      points, _, indices = b.decode(part, np.array(chunk["origin"]))
      for t in indices:
        triangles.add(b.key(points[t]))
        cells.add(
          tuple(
            np.rint(
              np.concatenate([points[t].min(axis=0), points[t].max(axis=0)]) * 100
            ).astype(int)
          )
        )
    for field, recipe in zip(packet["fields"], plan["fields"]):
      if "points" in field:
        assert b.rectangle_exists(np.array(field["points"]), triangles)
      else:
        assert tuple(field["cellFace"]) in cells
      if mode == "minecraft":
        assert recipe[3] == 0 or recipe[4] == 0
      sections[mode].add(field["section"])
  expected = {
    "West-Halensee",
    "Lehniner-Platz",
    "Central-Kudamm",
    "Breitscheidplatz",
    "Tauentzien",
    "Kantstraße",
  }
  assert sections["drawn"] == sections["minecraft"] == expected
  for source, digest in proof["sources"].items():
    assert b.digest(b.GEO / source) == digest


def test_kant_commercial_cues_require_poi_inside_original_owner() -> None:
  proof, runtime = b.read(b.EVIDENCE), b.read(b.RUNTIME)
  venues = {v["id"]: v for v in proof["kantCommercialEvidence"]}
  matched = 0
  for packet in proof["packets"]:
    mode, identity = packet["key"].split(":")
    if not identity.startswith("district188-"):
      continue
    chunk = b.read(b.OUT / f"{identity.removeprefix('district188-')}.drawn.json.gz")
    owners = {o["sourceId"]: o for o in chunk["nav"]["buildings"]}
    for field, recipe in zip(
      packet["fields"], runtime["packets"][packet["key"]]["fields"]
    ):
      commercial = field["commercialPoiIds"]
      assert recipe[9] == (2 if commercial else 1)
      owner = owners[field["owner"]]
      polygon = translate(
        Polygon(owner["ring"], owner["holes"]), chunk["origin"][0], chunk["origin"][2]
      ).buffer(0.5)
      for identity in commercial:
        poi = venues[identity]
        assert poi["shop"] or poi["amenity"] in {"cafe", "restaurant", "fast_food"}
        assert polygon.covers(shape(poi["geometry"]))
        matched += 1
  assert matched > 0
  assert "display estimates" in proof["policy"]
