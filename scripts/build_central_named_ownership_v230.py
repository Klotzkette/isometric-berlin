"""Replay exact original water-tower triangles, ink and collision in both modes."""

import json
from pathlib import Path

import build_townhall_ownership_v227 as replay
from build_district_facades_v188 import write_json

ROOT = Path(__file__).resolve().parents[1]


def build() -> dict:
  """Reuse the proven immutable full-minus-empty original exporter audit."""
  previous = replay.SOURCE
  try:
    replay.SOURCE = ROOT / "geo_data/regierungsviertel/central-named-v230-source.json"
    result = replay.build()
  finally:
    replay.SOURCE = previous
  assert result["authorizedOwners"] == ["DEBE03YY600002e7"] and not result["blocked"]
  return result


if __name__ == "__main__":
  result = build()
  write_json(ROOT / "src/app/src/data/centralNamedV230Ownership.json", result)
  print(
    json.dumps(
      {
        "owners": result["authorizedOwners"],
        "triangles": sum(len(r["triangles"]) for r in result["records"]),
      }
    )
  )
