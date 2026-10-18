"""Source-side open-water bank and tunnel preservation checks."""

import json
from pathlib import Path

from shapely.geometry import LineString, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]


def test_bank_segments_are_real_open_water_edges_without_internal_dams():
  source = json.loads(
    (ROOT / "geo_data/regierungsviertel/panke-banks-v229-source.json").read_text()
  )
  model = json.loads((ROOT / "src/app/src/data/pankeBanksV229.json").read_text())
  water = unary_union([shape(w["geometry"]) for w in source["waters"]])
  tunnels = shape(source["tunnels"])
  mouths = shape(source["mouths"])
  assert len(model["banks"]) > 250
  core = json.loads(
    (ROOT / "geo_data/regierungsviertel/panke-core-banks-v229.json").read_text()
  )
  actual_edges = unary_union([LineString([r["a"], r["b"]]) for r in core["records"]])
  actual_buffer = actual_edges.buffer(0.001)
  water_buffer = water.boundary.buffer(0.001)
  tunnel_inside = tunnels.buffer(-0.001)
  for a, b, c, d, nx, nz, material, top_a, top_b, owner in model["banks"]:
    edge = LineString([(a, b), (c, d)])
    assert edge.difference((actual_buffer if owner >= 0 else water_buffer)).is_empty
    assert top_a >= 3 and top_b >= 3
    assert edge.intersection(tunnel_inside).is_empty
    assert edge.intersection(mouths).is_empty
    assert abs(nx * nx + nz * nz - 1) < 0.00001
    assert material in {"brick", "earth", "concrete"}
  assert model["waterY"] == -1.15 and model["groundY"] == 3
