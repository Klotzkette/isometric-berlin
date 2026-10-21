"""Native fittings bind to exact existing owner columns and basin runs."""

import hashlib
import json
from pathlib import Path

from shapely.geometry import LineString, box
from shapely.ops import unary_union

from scripts.build_reichstag_native_fittings_v256 import build

ROOT = Path(__file__).resolve().parents[1]


def test_native_receipts_reproduce_unchanged_sources_and_complete_perimeter():
  visitor, water = build()
  for filename, receipt in [
    ("unityVisitorNativeV256.json", visitor),
    ("sintiRomaNativeWaterV256.json", water),
  ]:
    assert receipt == json.loads((ROOT / "src/app/src/data" / filename).read_text())
    assert (
      hashlib.sha256((ROOT / receipt["sourceFile"]).read_bytes()).hexdigest()
      == receipt["sourceSha256"]
    )
  footprint = unary_union(
    [box(x * 4, z * 4, (x + 1) * 4, (z + 1) * 4) for x, z, *_ in visitor["columns"]]
  )
  edges = [
    LineString([(x - 2, z), (x + 2, z)])
    if along_x
    else LineString([(x, z - 2), (x, z + 2)])
    for x, z, _, _, along_x in visitor["exposedEdges"]
  ]
  assert unary_union(edges).equals(footprint.boundary)
  assert len(visitor["columns"]) == 43
  assert len(edges) == 30
  assert sum(width / 4 for _, _, width, _ in water["runs"]) == 7
  assert water["geometryChanged"] is False
