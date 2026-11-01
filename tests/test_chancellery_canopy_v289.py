"""Source extraction remains reproducible without changing retained originals."""

import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_389_5820.zip"


@pytest.mark.skipif(not ARCHIVE.exists(), reason="retained raw LoD2 archive is local")
def test_chancellery_canopy_source_extract_is_deterministic(
  tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
  """Replay complete roof coordinates, neighbours and exact native columns."""
  spec = importlib.util.spec_from_file_location(
    "prepare_chancellery_canopy_v289",
    ROOT / "scripts/prepare_chancellery_canopy_v289.py",
  )
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  committed = json.loads(module.OUT.read_text())
  output = tmp_path / "chancelleryCanopyV289.json"
  monkeypatch.setattr(module, "OUT", output)
  before = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
  module.prepare()
  first = output.read_bytes()
  module.prepare()
  assert output.read_bytes() == first
  assert json.loads(first) == committed
  assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest() == before
  assert committed["source"]["archiveSha256"] == before
  assert len(committed["native"]["exclusiveColumns"]) == 15
  assert len(committed["native"]["sharedColumns"]) == 1
