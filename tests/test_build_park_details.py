"""Checks for the bounded Three.js park-detail payload."""

from __future__ import annotations

import json
from pathlib import Path

from isometric_berlin.generation.build_park_details import (
  compact_trees,
  expand_trees,
)

PAYLOAD = Path("src/app/public/mesh/regierungsviertel/park-details.json")


def payload_trees(payload: dict) -> list[dict]:
  return expand_trees(payload["trees"], payload["tree_vocabulary"])


def test_compact_tree_encoding_round_trips() -> None:
  # The wire form is only allowed to be smaller, never lossy: the task-09
  # bounds triple the official catalogue points, so every byte saved here is
  # what keeps the payload inside its budget.
  trees = [
    {
      "id": "a",
      "source": "berlin_official",
      "catalogue": "strassenbaum",
      "position": [1.0, 2.0, 3.0],
      "height_m": 7.0,
      "height_measured": True,
      "crown_radius_m": 2.0,
      "crown_measured": False,
      "trunk_radius_m": 0.12,
      "leaf_type": None,
      "species": "Spitz-Ahorn",
      "tree_group": "Laubbäume",
      "variant": 2,
      "osm_evidence_ids": ["12077445781"],
    },
    {
      "id": "b",
      "source": "osm",
      "position": [4.0, 5.0, 6.0],
      "height_m": 9.8,
      "crown_radius_m": 3.33,
      "trunk_radius_m": 0.317,
      "leaf_type": "broadleaved",
      "species": None,
      "tree_group": None,
      "variant": 1,
    },
  ]
  compact, vocabulary = compact_trees(trees)
  assert vocabulary["source"] == ["berlin_official", "osm"]
  assert "leaf_type" not in compact[0]
  assert compact[0]["i"] == "a"
  restored = expand_trees(compact, vocabulary)
  assert restored[0]["species"] == "Spitz-Ahorn"
  assert restored[0]["height_measured"] is True
  assert restored[1]["leaf_type"] == "broadleaved"
  for original, back in zip(trees, restored, strict=True):
    kept = {
      key: value
      for key, value in original.items()
      if not (value is None or value is False or value == [])
    }
    assert back == kept


def test_park_detail_payload_is_compact_and_specific() -> None:
  assert PAYLOAD.exists()
  assert PAYLOAD.stat().st_size < 4 * 1024 * 1024
  raw = PAYLOAD.read_text(encoding="utf-8")
  assert "NaN" not in raw
  payload = json.loads(raw)

  assert payload["schema_version"] == 3
  assert payload["source"]["attribution"] == (
    "© OpenStreetMap contributors · Geoportal Berlin (dl-de/zero-2-0)"
  )
  assert len(payload["paths"]) >= 150
  assert len(payload["trees"]) >= 20_000
  assert payload["tree_fusion"]["official"] >= 20_000
  assert payload["tree_fusion"]["osm_matched"] >= 1_800
  assert len(payload["street_lights"]) >= 3_500
  assert len(payload["wall_traces"]) >= 2
  assert len(payload["playgrounds"]) >= 5
  assert all(len(path["points"]) >= 2 for path in payload["paths"])
  trees = payload_trees(payload)
  assert all(3 <= tree["height_m"] <= 28 for tree in trees)
  assert max(tree["position"][1] for tree in trees) < 8
  assert max(light["position"][1] for light in payload["street_lights"]) < 8


def test_luiseninsel_playground_retains_mapped_equipment() -> None:
  payload = json.loads(PAYLOAD.read_text(encoding="utf-8"))
  playground = next(
    item for item in payload["playgrounds"] if item["id"].startswith("24911694:")
  )
  assert playground["name"] == "Spielplatz an der Luiseninsel"
  assert playground["surface"] == "sand"
  kinds = {item["kind"] for item in playground["equipment"]}
  assert {
    "basketswing",
    "climbingframe",
    "excavator",
    "sandpit",
    "slide",
    "structure",
    "swing",
    "water",
  } <= kinds
  ground_heights = [point[1] for point in playground["outline"]]
  ground_heights.extend(item["position"][1] for item in playground["equipment"])
  assert max(ground_heights) - min(ground_heights) < 1
