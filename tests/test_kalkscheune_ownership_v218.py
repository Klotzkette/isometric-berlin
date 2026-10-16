"""Original source recipes, rather than broad geographic masks, select windows."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def test_receipt_reproduces_exact_source_window_geometry_and_packet_identity() -> None:
  root = Path(__file__).resolve().parents[1]
  subprocess.run(
    [
      sys.executable,
      str(root / "scripts/build_kalkscheune_ownership_v218.py"),
      "--check",
    ],
    cwd=root,
    check=True,
    capture_output=True,
    text=True,
  )
