"""Rebuild the public viewer's paving from the retained Berlin source geometries."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_mitte_pavement_edges_v367 as kerbs  # noqa: E402
import build_mitte_plaza_edges_v367 as plazas  # noqa: E402
import build_mitte_square_streets_v367 as square_streets  # noqa: E402
import build_nikolaikirchplatz_v367 as church_square  # noqa: E402


def test_kirchplatz_matches_survey_in_both_projections():
  encoded = json.dumps(church_square.geometry(), separators=(",", ":")) + "\n"
  assert encoded == church_square.OUT.read_text()


def test_raster_kerb_exclusions_are_wholly_inside_paving():
  assert kerbs.build() == json.loads(kerbs.OUTPUT.read_bytes())


def test_paved_square_edges_rebuild_from_polygons(tmp_path, monkeypatch):
  published = plazas.OUTPUT.read_bytes()
  out = tmp_path / plazas.OUTPUT.name
  monkeypatch.setattr(plazas, "OUTPUT", out)
  plazas.build()
  assert out.read_bytes() == published


def test_surveyed_square_approaches_rebuild_without_a_live_viewer(
  tmp_path, monkeypatch
):
  published = square_streets.OUTPUT.read_bytes()
  out = tmp_path / square_streets.OUTPUT.name
  monkeypatch.setattr(square_streets, "OUTPUT", out)
  square_streets.build()
  assert out.read_bytes() == published
