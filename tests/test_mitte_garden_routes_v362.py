"""Regenerate the checked-in street and garden geometry from its measured inputs."""

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_rebuild_matches_both_viewer_packets_and_measurements(tmp_path, monkeypatch):
  spec = importlib.util.spec_from_file_location(
    "mitte_garden_routes", ROOT / "scripts/build_mitte_garden_routes_v362.py"
  )
  exporter = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(exporter)
  data, geo = exporter.DATA, exporter.GEO
  for name in (
    "schlossEastStreets.json",
    "schlossEastBlockStreets.json",
    "cafeNeuerSeeV164Source.json",
  ):
    (tmp_path / name).symlink_to(data / name)
  reference = "mitte-garden-routes-v362-source.json.gz"
  (tmp_path / reference).symlink_to(geo / reference)
  monkeypatch.setattr(exporter, "DATA", tmp_path)
  monkeypatch.setattr(exporter, "GEO", tmp_path)
  exporter.build()
  for source in (
    data / "mitteGardenRoutesV362.json",
    data / "cafeGardenRoutesV362.json",
    geo / "mitte-garden-routes-v362-receipt.json",
  ):
    assert (tmp_path / source.name).read_bytes() == source.read_bytes()
