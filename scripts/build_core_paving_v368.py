"""Rebuild the inner-city part of the measured paving edges outside Mitte."""

from __future__ import annotations

import json
from pathlib import Path

from build_mitte_pavement_edges_v367 import build as build_kerbs
from build_mitte_plaza_edges_v367 import build as build_plazas
from build_mitte_square_streets_v367 import build as build_squares
from ring_paving_scope_v368 import scope
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
CORE = DATA / "surroundingCityScope.json"
DISTRICTS = {"Charlottenburg", "Wilmersdorf", "Schöneberg", "Kreuzberg"}


def build(output=DATA, *, capture=None):
  core = json.loads(CORE.read_bytes())["core"]
  clip = Polygon(core["ring"], core["holes"]).intersection(scope())
  edges = build_kerbs(outer_districts=DISTRICTS, clip=clip)
  (output / "innerCityPavementEdgesV368.json").write_text(
    json.dumps(edges, separators=(",", ":"), ensure_ascii=False) + "\n"
  )
  build_plazas(
    outer_districts=DISTRICTS, clip=clip, output=output / "innerCityPlazaEdgesV368.json"
  )
  build_squares(
    capture,
    archive=ROOT / "geo_data/regierungsviertel/inner-city-square-streets-v368.json.gz",
    output=output / "innerCitySquareStreetsV368.json",
  )


if __name__ == "__main__":
  build()
