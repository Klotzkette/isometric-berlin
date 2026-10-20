import gzip
import json
from pathlib import Path

import pytest

from scripts.select_playgrounds_v255 import select_largest

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"


def test_top_twenty_match_complete_official_inventory():
  ledger = json.loads(
    gzip.decompress((DATA / "playgrounds-v255-ranking-ledger.json.gz").read_bytes())
  )
  source = {
    "features": [{"properties": row} for row in ledger["records"]],
    "numberMatched": ledger["numberMatched"],
  }
  expected = select_largest(source)
  actual = json.loads((DATA / "playgrounds-v255-official.geojson").read_text())
  assert len(ledger["records"]) == 1886
  assert len(actual["features"]) == 20
  assert [f["properties"]["pitid"] for f in actual["features"]] == [
    f["properties"]["pitid"] for f in expected
  ]
  assert all(f["geometry"]["coordinates"] for f in actual["features"])
  assert actual["features"][0]["properties"]["katasterfl"] == 21731


def test_partial_or_duplicate_inventory_cannot_establish_rank():
  feature = {"properties": {"pitid": "a", "objartname": "Spielplatz"}}
  with pytest.raises(ValueError, match="Incomplete"):
    select_largest({"features": [feature], "numberMatched": 2})
  with pytest.raises(ValueError, match="Duplicate"):
    select_largest({"features": [feature, feature], "numberMatched": 2})
