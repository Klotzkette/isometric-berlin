"""Public BND exterior: additive ownership, evidence conflict and native skin."""

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_bnd_headquarters_v174 as module  # noqa: E402

MODEL = json.loads(module.DEST.read_text())
EVIDENCE = json.loads(module.EVIDENCE.read_text())
NAV = json.loads(
  module.DEST.with_name("bndHeadquartersV174Navigation.json").read_text()
)


def test_full_original_source_owner_and_all_ten_courts_survive() -> None:
  packet = ROOT / EVIDENCE["sourcePacket"]
  assert (
    hashlib.sha256(packet.read_bytes()).hexdigest() == EVIDENCE["sourcePacketSha256"]
  )
  assert len(EVIDENCE["sourceParents"]) == 4
  assert MODEL["newReplacedOwners"] == NAV["newReplacedOwners"] == []
  main = next(p for p in EVIDENCE["sourceParents"] if p["id"] == "DEBE00YY1tw0009x")
  assert len(main["parts"][0]["surfaces"]) == 179
  assert len(main["footprintPolygons"][0]["holes"]) == 10
  footprint = unary_union([module.poly(p) for p in main["footprintPolygons"]])
  for volume in MODEL["upperVolumes"]:
    assert module.poly(volume).difference(footprint.buffer(0.0002)).area < 0.001
  for hole in main["footprintPolygons"][0]["holes"]:
    court = Polygon(hole)
    assert all(
      module.poly(v).intersection(court.buffer(-0.001)).area < 0.001
      for v in MODEL["upperVolumes"]
    )


def test_height_correction_uses_mapped_parts_and_primary_bounded_elevations() -> None:
  ids = {p["osmId"] for p in MODEL["upperVolumes"]}
  assert ids == {
    "relation/10383346",
    "way/753509500",
    "way/107166432",
    "way/107166438",
    "way/107166440",
  }
  assert NAV["originalMainTopY"] == 18.286
  assert max(p["topY"] for p in MODEL["upperVolumes"]) == 35.2
  assert len({p["topY"] for p in MODEL["upperVolumes"]}) == 3
  assert len(EVIDENCE["conflicts"]) == 2
  assert NAV["publishedMainHeightM"] == 30
  assert len(NAV["upperParts"]) == 5
  assert (
    module.DEST.with_name("bndHeadquartersV174Navigation.json").stat().st_size < 8000
  )
  assert "nativeBoxes" not in NAV and "boxes" not in NAV
  assert NAV["visitorCenter"]["id"] == "node/8641738412"


def test_facades_and_native_roof_skin_are_finite_bounded_and_separate() -> None:
  assert 30000 < len(MODEL["boxes"]) < 55000
  assert 15000 < len(MODEL["nativeBoxes"]) < 25000
  assert all(np.isfinite(row[:8]).all() and min(row[3:6]) > 0 for row in MODEL["boxes"])
  assert all(
    np.isfinite(row).all() and min(row[3:6]) > 0 for row in MODEL["nativeBoxes"]
  )
  assert all(len(row) == 7 for row in MODEL["nativeBoxes"])
  assert all(180 < r[0] < 620 and -1900 < r[2] < -1470 for r in MODEL["boxes"])
  roles = set(MODEL["detailRoleCounts"])
  assert {
    "vertical-glazing",
    "projecting-vertical-fin",
    "visitor-portal-glass",
    "roof-edge-cap",
    "visitor-name-band",
  } <= roles
  # Roof-only interior cells are never hidden solid columns.
  for v in MODEL["upperVolumes"]:
    p = module.poly(v)
    centre = p.representative_point()
    x, z = int(centre.x) + 0.5, int(centre.y // 1) + 0.5
    if p.boundary.distance(Point(x, z)) < 1:
      continue
    rows = [
      r
      for r in MODEL["nativeBoxes"]
      if abs(x - r[0]) < r[3] / 2 + 0.001
      and abs(z - r[2]) < r[5] / 2 + 0.001
      and r[6] == module.ROOF
    ]
    assert rows and all(r[4] == 1 for r in rows)


def test_generation_reproducible_and_no_external_image_enters_runtime() -> None:
  model, nav = module.build()
  assert model == MODEL and nav == NAV
  assert len(EVIDENCE["visualReferences"]) == 3
  assert all(r["license"].startswith("CC BY-SA") for r in EVIDENCE["visualReferences"])
  runtime = (ROOT / "src/app/src/BndHeadquartersV174.ts").read_text()
  assert "TextureLoader" not in runtime and "https://" not in runtime
  assert "Evidence.json" not in runtime
