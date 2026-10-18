"""Exact newly named scope, complete measured parents, deterministic preservation."""

import hashlib
import json

from shapely.geometry import shape

from scripts import build_spandau_botanical_v230 as builder


def test_source_scope_and_complete_buildings():
  source = json.loads(builder.SOURCE.read_text())
  park = shape(
    next(f["geometry"] for f in source["features"] if f["id"] == "way/26633037")
  )
  assert 319000 < park.area < 319100
  assert len(source["buildings"]) == 21
  assert sum(len(p["parts"]) for p in source["buildings"]) == 27
  assert len(source["fronts"]) == 24
  assert all(f["base"] == 3 for f in source["fronts"])
  for filename, sha in source["preservedInputs"].items():
    assert hashlib.sha256((builder.DATA / filename).read_bytes()).hexdigest() == sha
  for parent in source["buildings"]:
    assert all(part["surfaces"] for part in parent["parts"])
    assert all(
      park.covers(
        shape({"type": "Polygon", "coordinates": [part["ring"]]}).representative_point()
      )
      for part in parent["parts"]
    )


def test_replay_without_network_or_photographs(monkeypatch):
  outputs = {}
  monkeypatch.setattr(
    builder, "write", lambda path, value: outputs.setdefault(path, value)
  )
  builder.build()
  for path, expected in outputs.items():
    assert json.loads(path.read_text()) == json.loads(json.dumps(expected)), path
