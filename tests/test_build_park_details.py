"""Checks for the bounded Three.js park-detail payload."""

from __future__ import annotations

import json
from pathlib import Path

PAYLOAD = Path("src/app/public/mesh/regierungsviertel/park-details.json")


def test_park_detail_payload_is_compact_and_specific() -> None:
  assert PAYLOAD.exists()
  assert PAYLOAD.stat().st_size < 4 * 1024 * 1024
  raw = PAYLOAD.read_text(encoding="utf-8")
  assert "NaN" not in raw
  payload = json.loads(raw)

  assert payload["schema_version"] == 2
  assert payload["source"]["attribution"] == (
    "© OpenStreetMap contributors · Geoportal Berlin (dl-de/zero-2-0)"
  )
  assert len(payload["paths"]) >= 150
  assert len(payload["trees"]) >= 8_000
  assert payload["tree_fusion"]["official"] >= 6_800
  assert payload["tree_fusion"]["osm_matched"] >= 1_800
  assert len(payload["street_lights"]) >= 1_200
  assert len(payload["wall_traces"]) == 2
  assert len(payload["playgrounds"]) >= 5
  assert all(len(path["points"]) >= 2 for path in payload["paths"])
  assert all(3 <= tree["height_m"] <= 28 for tree in payload["trees"])
  assert max(tree["position"][1] for tree in payload["trees"]) < 8
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
