"""Source identities, exact prior preservation and bounded Ring additions."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
  "ring_v232", ROOT / "scripts/build_ring_stations_v232.py"
)
assert SPEC and SPEC.loader
builder = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(builder)
DATA = json.loads((ROOT / "src/app/src/data/ringStationsV232.json").read_text())
EVIDENCE = json.loads(
  (ROOT / "geo_data/regierungsviertel/ring-stations-v232-evidence.json").read_text()
)
SOURCE = json.loads((ROOT / "src/app/src/data/railStationsV190.json").read_text())


def test_all_27_identities_and_all_previous_station_sources_survive() -> None:
  """A protected station is verified, not accidentally omitted from coverage."""
  assert len(EVIDENCE["inventory"]) == 27
  assert [s["order"] for s in EVIDENCE["inventory"]] == list(range(27))
  for s in EVIDENCE["inventory"]:
    old = next(p for p in SOURCE["stations"] if p["name"] == s["name"])
    assert set(s["platforms"]) == set(old["platformIds"])
    assert s["roofs"] == old["roofs"]
    assert s["anchor"] == old["anchor"]
  assert {s["name"] for s in DATA["sites"]} == {
    s["name"] for s in EVIDENCE["inventory"]
  } - builder.PRESERVED
  assert len(DATA["sites"]) == 22
  for path, sha in EVIDENCE["preservedSha256"].items():
    assert builder.digest(ROOT / path) == sha, path


def test_only_existing_signs_and_source_bound_open_canopies_are_augmented() -> None:
  """No invented station floor, roof body or structural support in a track gap."""
  roofs = {r["id"]: r for r in SOURCE["roofs"]}
  canopies = []
  for site in DATA["sites"]:
    platforms = [p for p in SOURCE["platforms"] if p["station"] == site["name"]]
    passenger = next(p for p in platforms if p["sourceTags"].get("light_rail") == "yes")
    f, s = passenger["frame"], site["sign"]
    selected = next(
      builder.xy(f, t * f["length"])
      for t in [0.43, -0.43, 0.3, -0.3, 0]
      if builder.polygon(passenger).contains(Point(builder.xy(f, t * f["length"])))
    )
    assert (s["x"], s["z"]) == selected
    assert s["y"] == passenger["y"]
    for canopy in site["canopies"]:
      roof = roofs[canopy["id"]]
      assert roof["retainedOwnerId"] is None
      assert canopy["floor"] == passenger["y"] and canopy["top"] == roof["y"]
      footprint = Polygon(roof["rings"][0], roof["rings"][1:])
      platform = unary_union([builder.polygon(p) for p in platforms])
      for p in canopy["posts"]:
        assert footprint.covers(Point(p).buffer(0.2))
        assert platform.covers(Point(p).buffer(0.2))
      for a, b in canopy["cross"]:
        assert footprint.covers(LineString([a, b]).buffer(0.15))
      canopies.append(canopy["id"])
  assert set(canopies) == builder.CANOPIES
  assert len(canopies) == 4


def test_replay_is_exact_without_network_or_raw_cache() -> None:
  """The builder uses only committed source evidence and mutates no older bytes."""
  data, evidence = builder.build()
  assert data == DATA
  assert evidence == EVIDENCE
