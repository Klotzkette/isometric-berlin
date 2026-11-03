"""Independent receipt and replay guards for the existing native support planes."""

import gzip
import importlib.util
import json
from pathlib import Path

import pytest

from scripts.historical_asset_reader_v194 import historical_asset_bytes_v194

ROOT = Path(__file__).resolve().parents[1]


def test_exact_native_support_extraction_replays_without_source_mutation():
  path = ROOT / "scripts/build_civic_native_faces_v246.py"
  spec = importlib.util.spec_from_file_location("civic_native_v246", path)
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  committed = json.loads(module.OUT.read_text())
  original_read = Path.read_bytes

  def historical_read(path):
    if path.resolve() != module.ROSA.resolve():
      return original_read(path)
    expected = committed["sources"][str(path.relative_to(ROOT))]
    raw = original_read(path)
    historical = historical_asset_bytes_v194(path, expected, reader=original_read)
    assert gzip.decompress(historical) == gzip.decompress(raw)
    return historical

  with pytest.MonkeyPatch.context() as historical:
    historical.setattr(Path, "read_bytes", historical_read)
    assert module.build() == committed
    assert len(committed["sources"]) == 3
    assert len(committed["green"]["faces"]) == 31
    assert len(committed["spd"]["faces"]) == 77
    assert len(committed["rosa"]["faces"]) == 75
    for key in ("green", "spd", "rosa"):
      for axis, plane, start, end, sign, low, high in committed[key]["faces"]:
        assert axis in (0, 2) and sign in (-1, 1)
        assert end > start and high > low
        assert plane % 2 == 0 and start % 2 == 0 and end % 2 == 0
