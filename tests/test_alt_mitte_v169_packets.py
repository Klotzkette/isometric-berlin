"""Lossless splits retain faces, colours and old packet navigation."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from alt_mitte_v169_packets import distribute, empty_packet, pack_detail, triangles
from build_karl_marx_allee_v161 import Detail, mesh_signature


def test_triangle_splits_are_exact_and_keep_clipped_roof_slopes() -> None:
  d = Detail()
  for x in range(20):
    d.polygon(
      [[x - 1, 8, 1], [x + 1, 9, 1], [x, 12, 3]], (120 + x, 150, 170), "source roof"
    )
  bounds = (0, 0, 20, 20)
  original = pack_detail(d, bounds)
  split = pack_detail(d, bounds, max_vertices=9, max_indices=12)
  assert len(split) > 1
  assert mesh_signature({"meshes": original}) == mesh_signature({"meshes": split})
  assert triangles(original) == triangles(split)


def test_existing_primary_and_navigation_remain_unchanged_by_distribution() -> None:
  bounds = (0, 0, 512, 512)
  primary = empty_packet("0_0", bounds)
  d = Detail()
  d.polygon([[1, 3, 1], [2, 3, 1], [2, 3, 2]], (210, 200, 180), "source")
  part = pack_detail(d, bounds)[0]
  primary["meshes"] = [{**part, "kind": "retained-old"} for _ in range(16)]
  primary["nav"]["ground"] = [{"ring": [[0, 0], [512, 0], [0, 512]], "holes": []}]
  frozen = json.dumps(primary, sort_keys=True)
  result = distribute(primary, [part, part], "0_0", bounds)
  assert len(result) == 2
  assert json.dumps(result[0], sort_keys=True) == frozen
  assert json.dumps(primary, sort_keys=True) == frozen
  assert result[1]["nav"]["ground"] == []
  assert mesh_signature({"meshes": result[1]["meshes"]}) == mesh_signature(
    {"meshes": [part, part]}
  )
