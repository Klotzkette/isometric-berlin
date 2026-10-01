"""West squares preserve metric source identities and authored/source separation."""

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location(
  "west_squares", ROOT / "scripts/build_west_squares_v163.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_facade_stays_inside_surveyed_wall() -> None:
  rings = [[[0.0, 5.2, 0.0], [12.0, 5.2, 0.0], [12.0, 25.0, 0.0], [0.0, 25.0, 0.0]]]
  rows = module.facade(rings, "KaDeWe")
  assert rows
  for x, y, _z, w, h, _d, _yaw, _color, role in rows:
    if role == 1:
      assert 0 < x - w / 2 < x + w / 2 < 12
      assert 5.2 < y - h / 2 < y + h / 2 < 25


def test_documented_source_archives_and_no_unrelated_shell_replacements() -> None:
  p = json.loads((ROOT / "src/app/src/data/westSquaresV163Source.json").read_text())
  assert len(p["archives"]) == 2
  assert all(len(a["sha256"]) == 64 for a in p["archives"])
  assert {p["id"] for p in p["legacyPrisms"]} == {
    "-5396409",
    "-5396410",
    "26369724",
    "40452037",
  }
  assert {b["id"] for b in p["buildings"]} == set(module.BUILDINGS)
  assert len({b["osmNode"] for b in p["benches"]}) == 8
