"""Every dependency-hash refresh preserves all earlier rendered data exactly."""

import json
import subprocess
from pathlib import Path

from relief_receipts_v182 import digest, restore_recorded_altitudes

ROOT = Path(__file__).resolve().parents[1]
RECEIPTS = json.loads(
  (ROOT / "geo_data/regierungsviertel/derived-provenance-v182.json").read_bytes()
)


def test_provenance_refresh_has_no_geometry_changes_from_v181() -> None:
  assert len(RECEIPTS["tables"]) == 6
  for receipt in RECEIPTS["tables"]:
    current = json.loads((ROOT / receipt["file"]).read_bytes())
    previous = json.loads(
      subprocess.check_output(
        ["git", "show", f"v1.0.81:{receipt['file']}"],
        cwd=ROOT,
      )
    )
    metadata = set(receipt["metadataKeys"])
    retained = {k: v for k, v in previous.items() if k not in metadata}
    assert {k: v for k, v in current.items() if k not in metadata} == retained
    assert digest(retained) == receipt["unchangedGeometrySha256"]
    assert {k: current[k] for k in metadata} == receipt["metadataAfter"]


def test_every_local_altitude_receipt_reconstructs_the_exact_v181_source() -> None:
  for receipt in RECEIPTS["altitudeReceipts"]:
    path = ROOT / receipt["file"]
    previous = json.loads(
      subprocess.check_output(
        ["git", "show", f"v1.0.81:{receipt['file']}"],
        cwd=ROOT,
      )
    )
    current = json.loads(path.read_bytes())
    if receipt["field"]:
      previous, current = previous[receipt["field"]], current[receipt["field"]]
    assert restore_recorded_altitudes(current, path.name) == previous
    assert len(receipt["changes"]) > 100
