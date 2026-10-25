"""Retained tram identities and complete original plan geometry."""

import json

from scripts.build_tacheles_rails_v270 import IDS, OUTPUT, SOURCE, build


def test_exact_retained_tracks_and_deterministic_payload() -> None:
  actual = json.loads(OUTPUT.read_bytes())
  assert actual == build()
  source = json.loads(SOURCE.read_bytes())["tram_catenary"]["tracks"]
  assert actual["tracks"] == [t for t in source if t["id"] in IDS]
  assert len(actual["tracks"]) == 6
  assert actual["gaugeM"] == 1.435
  assert OUTPUT.stat().st_size < 4096
