"""Mitte street source boundaries, exact retained core and candidate preservation."""

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import pytest
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads(
  (ROOT / "geo_data/regierungsviertel/mitte-streets-v166.json").read_text()
)
PRESERVED = json.loads(
  (ROOT / "geo_data/regierungsviertel/mitte-streets-v166-preservation.json").read_text()
)
KIND = "mitte-street-fronts-v166"


def digest(value):
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def test_only_eight_named_corridors_and_every_core_record_stays_exact():
  assert {r["name"] for r in SOURCE["roads"]} == {
    "Mulackstraße",
    "Alte Schönhauser Straße",
    "Linienstraße",
    "Auguststraße",
    "Ackerstraße",
    "Tucholskystraße",
    "Krausnickstraße",
    "Oranienburger Straße",
  }
  project = Transformer.from_crs(25833, 4326, always_xy=True).transform
  for road in SOURCE["roads"]:
    geo = transform(
      lambda x, z: project(x + 389500, 5820000 - z), shape(road["geometry"])
    )
    assert geo.bounds[1] >= 52.51949 and geo.bounds[3] <= 52.53731
  original = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  excluded = set(SOURCE["excludedDetailedOwners"])
  assert len(SOURCE["corePrisms"]) == 540
  for p in SOURCE["corePrisms"]:
    assert p == original[p["id"]]
    assert p["id"] not in excluded
  assert len(SOURCE["buildings"]) == 437
  assert sum(len(b["parts"]) for b in SOURCE["buildings"]) == 1029
  assert not {b["id"] for b in SOURCE["buildings"]} & excluded
  primary = json.loads(
    (ROOT / "src/app/src/data/alexanderNorthV166Navigation.json").read_text()
  )
  assert not {p["id"] for p in primary["outerOwners"]} & {
    b["id"] for b in SOURCE["buildings"]
  }
  assert {"DEBE01YYK00000lz", "DEBE01YYK000033r"} <= excluded


def test_candidate_packets_preserve_all_earlier_meshes_and_unowned_navigation():
  candidate = Path("/tmp/v166-mitte-streets")
  if not candidate.is_dir():
    pytest.skip(
      "Isolated authoring candidates are deliberately not published source assets"
    )
  owned = {b["id"] for b in SOURCE["buildings"]}
  for identity, modes in PRESERVED.items():
    for mode, before in modes.items():
      raw = gzip.decompress((candidate / f"{identity}.{mode}.json.gz").read_bytes())
      p = json.loads(raw)
      assert len(raw) < 12 * 1024 * 1024
      assert digest([m for m in p["meshes"] if m["kind"] != KIND]) == before["meshes"]
      assert (
        digest(
          {
            **p["nav"],
            "buildings": [
              b for b in p["nav"]["buildings"] if b["sourceId"] not in owned
            ],
          }
        )
        == before["unownedNavigation"]
      )
      if mode == "minecraft":
        for mesh in p["meshes"]:
          if mesh["kind"] != KIND:
            continue
          points = np.frombuffer(
            base64.b64decode(mesh["positions"]), dtype="<u2"
          ).reshape(-1, 3)
          indices = np.frombuffer(
            base64.b64decode(mesh["indices"]), dtype="<u4"
          ).reshape(-1, 3)
          triangles = points[indices]
          assert np.all(
            np.any(np.max(triangles, axis=1) == np.min(triangles, axis=1), axis=1)
          )
