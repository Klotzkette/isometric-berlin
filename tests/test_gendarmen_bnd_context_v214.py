"""Source planes must stay auditable and leave every original packet untouched."""

import gzip
import hashlib
import json
import math

from scripts.build_gendarmen_bnd_context_v214 import DEST, PACKET, ROOT, build


def test_context_generation_is_deterministic_and_sources_unchanged() -> None:
  source = json.loads(DEST.read_text())
  assert build() == source
  assert source["replacementOwners"] == []
  for receipt in source["sourceReceipts"]:
    assert (
      hashlib.sha256((ROOT / receipt["path"]).read_bytes()).hexdigest()
      == receipt["sha256"]
    )


def test_bnd_neighbours_use_original_street_wall_polygons() -> None:
  originals = json.loads(gzip.decompress(PACKET.read_bytes()))["buildings"]
  source = json.loads(DEST.read_text())
  targets = [b for b in source["buildings"] if b["key"] in ("living108", "feuerland")]
  assert len(targets) == 2
  for building in targets:
    owner = next(o for o in originals if o["id"] == building["ownerIds"][0])
    assert len(building["fronts"]) >= 10
    for edge in building["fronts"]:
      part = next(p for p in owner["parts"] if p["id"] == edge["sourcePartId"])
      surface = next(
        s for s in part["surfaces"] if s["sourcePolygonId"] == edge["sourcePolygonId"]
      )
      assert surface["kind"] == "WallSurface"
      points = surface["rings"][0]
      xz = [[p[0], p[2]] for p in points]
      assert edge["startXZ"] in xz and edge["endXZ"] in xz
      assert edge["wallBaseY"] == min(p[1] for p in points)
      assert edge["wallTopY"] <= max(p[1] for p in points)
      assert math.dist(edge["startXZ"], edge["endXZ"]) >= 0.7


def test_gendarmen_perimeter_keeps_prior_owners_and_excludes_v208() -> None:
  source = json.loads(DEST.read_text())
  perimeter = json.loads(
    (ROOT / "src/app/src/gendarmenmarktPerimeterSource.json").read_text()
  )
  selected = {b["key"]: b for b in source["buildings"]}
  assert "quartier206" not in selected
  assert len(selected) == 17
  for original in perimeter["buildings"]:
    if original["key"] == "quartier206":
      continue
    current = selected[original["key"]]
    assert current["ownerIds"] == original["parentIds"]
    assert all(edge in original["streetFronts"] for edge in current["fronts"])
