"""Independent source and finite-ownership checks for the two v225 sites."""

import hashlib
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(path: Path) -> dict:
  """Read a small committed source receipt."""
  return json.loads(path.read_text())


def test_all_arena_source_parts_and_sheets_are_retained() -> None:
  source = read(GEO / "arena-station-v225-source.json")
  runtime = read(DATA / "arenaStationV225Envelopes.json")
  assert len(source["parts"]) == 33
  assert sum(len(p["surfaces"]) for p in source["parts"]) == 646
  assert len(runtime["surfaces"]) == 646
  low = read(DATA / "arenaStationV225Profile.json")["arena"]["sourceGroundY"]
  by_key = {(s["part"], s["surface"]): s for s in runtime["surfaces"]}
  for part in source["parts"]:
    for i, sheet in enumerate(part["surfaces"]):
      triangles = by_key[(part["id"], i)]["triangles"]
      assert by_key[(part["id"], i)]["kind"] == sheet["kind"]
      expected = {
        tuple((p[0], round(p[1] - low + 3, 3), p[2]))
        for ring in sheet["rings"]
        for p in ring
      }
      actual = {tuple(p) for t in triangles for p in t}
      # Triangulation may reuse collinear ring points only in the retained source
      # sheet. Every rendered vertex belongs to that unmodified source plane.
      assert actual <= expected
      for t in triangles:
        assert np.isfinite(t).all()
  assert sum(len(s["triangles"]) for s in runtime["surfaces"]) == 1693
  assert len(runtime["blocks"]) == 3731


def test_source_receipts_and_exact_station_plan() -> None:
  path = GEO / "arena-station-v225-source.json"
  source = read(path)
  receipt = read(DATA / "arenaStationV225Ownership.json")
  assert receipt["sourceSha256"] == hashlib.sha256(path.read_bytes()).hexdigest()
  old_rail = ROOT / source["railSourcePath"]
  assert source["railSourceSha256"] == hashlib.sha256(old_rail.read_bytes()).hexdigest()
  profile = read(DATA / "arenaStationV225Profile.json")
  assert profile["station"]["rings"] == source["station"]["rings"]
  assert {r["owner"] for r in receipt["records"]} == {
    "DEBE02YY2000060P",
    "OSM-way-297153147",
  }
  assert sum(len(r["triangles"]) for r in receipt["records"]) == 1685
  assert sum(len(r["segments"]) for r in receipt["lineRecords"]) == 199
  assert {p["id"] for p in source["platforms"]} == {
    "relation/11765290",
    "relation/11765307",
  }
  assert profile["station"]["roofY"] - profile["station"]["platformY"] == 16
