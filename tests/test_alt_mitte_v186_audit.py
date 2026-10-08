"""Check all inventory identities and distinguish active from transferred detail."""

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_complete_audit_matches_sources_and_current_ownership():
  path = ROOT / "scripts/audit_alt_mitte_v186.py"
  spec = importlib.util.spec_from_file_location("audit_alt_mitte_v186", path)
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  stored = json.loads(module.OUTPUT.read_text())
  assert module.build_audit() == stored
  assert module.OUTPUT.stat().st_size < 2 * 1024 * 1024
  assert len(stored["records"]) == 15_914
  assert len({row[0] for row in stored["records"]}) == 15_914
  assert stored["counts"]["officialSourceFamilies"] == 13_545
  assert stored["counts"]["officialDeepestParts"] == 26_768
  assert stored["counts"]["officialSourcePolygons"] == 369_689
  assert stored["counts"]["osmResidualRecords"] == 2_369
  assert sum(stored["currentClasses"].values()) == 15_914
  assert stored["currentClasses"]["retained-monument-field"] == 2_599
  assert stored["counts"]["activeGenericOwnersWithFacade"] == 7_012
  assert stored["counts"]["activeGenericOwnersWithoutFacade"] == 2_065
  transfers = set(stored["runtimeOwnership"]["dedicatedV183Transfers"])
  assert len(transfers) == 4
  assert all(
    row[3] == "dedicated-alexander-stations-v183"
    for row in stored["records"]
    if row[0] in transfers
  )
