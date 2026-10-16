"""Regenerate independent core transfer receipts without changing old inputs."""

import json
from pathlib import Path

from scripts.build_townhall_core_previous_v227 import OUTPUT, build


def test_core_transfer_receipt_is_reproducible() -> None:
  """Every removed prism and column has a complete immutable source receipt."""
  recorded = json.loads(OUTPUT.read_text())
  assert build() == recorded
  assert {row["prism"]["id"]: len(row["columns"]) for row in recorded["owners"]} == {
    "11048538": 230,
    "n-915481": 276,
    "n-957286": 78,
    "n-198259": 174,
  }
  assert all(row["prism"]["y0_dm"] == 52 for row in recorded["owners"])
  assert Path(recorded["prismSource"]).name == "lod2-prisms.json"
