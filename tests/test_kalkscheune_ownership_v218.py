"""Original source recipes, rather than broad geographic masks, select windows."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from scripts.historical_asset_reader_v194 import historical_asset_bytes_v194


def test_receipt_reproduces_exact_source_window_geometry_and_packet_identity(
  monkeypatch,
) -> None:
  root = Path(__file__).resolve().parents[1]
  sys.path.insert(0, str(root / "scripts"))
  from scripts import build_kalkscheune_ownership_v218 as subject

  expected = json.loads(subject.DEST.read_bytes())
  original_packet = subject.PACKET

  class RetainedPacket:
    """Only this exact whole old packet is projected; source recipes stay real."""

    def read_bytes(self):
      return historical_asset_bytes_v194(original_packet, expected["packetSha256"])

    def relative_to(self, path):
      return original_packet.relative_to(path)

  # Replay the unchanged builder and compare every receipt field, as --check
  # does. Keep the historical byte adapter local to its sole packet argument;
  # no global filesystem hook or source/public write is involved.
  monkeypatch.setattr(subject, "PACKET", RetainedPacket())
  assert subject.build() == expected
