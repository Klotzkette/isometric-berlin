"""The additive street pass must preserve every earlier packet mesh and nav field."""

import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads(
  (ROOT / "geo_data/regierungsviertel/tauentzien-v165.json").read_text()
)
BASELINE = json.loads(
  (ROOT / "geo_data/regierungsviertel/tauentzien-v165-preservation.json").read_text()
)


def digest(value):
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def test_tauentzien_only_adds_to_source_bound_core():
  assert {r["name"] for r in SOURCE["roads"]} == {"Tauentzienstraße"}
  assert SOURCE["buildings"] == []
  assert len(SOURCE["corePrisms"]) == 28
  original = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  for p in SOURCE["corePrisms"]:
    assert p == original[p["id"]]
    assert p["id"] not in SOURCE["excludedDetailedOwners"]


def test_no_existing_packet_geometry_or_navigation_is_changed():
  for id, modes in BASELINE.items():
    for mode, before in modes.items():
      p = json.loads(
        gzip.decompress(
          (
            ROOT / f"src/app/public/mesh/surrounding-berlin-v159/{id}.{mode}.json.gz"
          ).read_bytes()
        )
      )
      previous = [
        m for m in p["meshes"] if m["kind"] != "tauentzien-street-fronts-v165"
      ]
      assert len(p["meshes"]) - len(previous) == 1
      if before:
        assert digest(previous) == before["meshes"]
        assert digest(p["nav"]) == before["nav"]
      else:
        assert not previous
        for field in ["ground", "water", "buildings", "roads", "bridges"]:
          assert not p["nav"][field]
