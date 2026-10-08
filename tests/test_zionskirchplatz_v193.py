"""Complete square frontage coverage must not replace shells, courts or old detail."""

import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_zionskirchplatz_v193 as model  # noqa: E402

DATA = json.loads((model.DATA / "zionskirchplatzV193.json").read_text())
EVIDENCE = json.loads((model.DATA / "zionskirchplatzV193Evidence.json").read_text())
PROFILE = json.loads(model.PROFILE.read_text())
OWNER_SUFFIXES = {
  "01cF",
  "02Ih",
  "02wP",
  "03cl",
  "04Ag",
  "04H7",
  "05G6",
  "05Nd",
  "063B",
  "07G1",
  "07Mw",
  "07Vw",
  "07yQ",
  "08CV",
  "0BUt",
  "0Bri",
  "0C4w",
  "0CIk",
  "0COw",
  "0DY3",
}


def projected_face(face: dict) -> tuple[np.ndarray, np.ndarray, Polygon]:
  a = np.array(face["a"])
  d = (np.array(face["b"]) - a) / face["length"]
  rings = [
    [(float((np.array([p[0], p[2]]) - a) @ d), p[1]) for p in r] for r in face["rings"]
  ]
  polygon = Polygon(rings[0], rings[1:]).buffer(0)
  return (
    a,
    d,
    polygon.intersection(box(-1, face["visibleFromY"], face["length"] + 1, 100)),
  )


def test_complete_square_inventory_and_exact_parent_retention() -> None:
  expected = {"DEBE01YYK000" + s for s in OWNER_SUFFIXES}
  assert {o["id"] for o in DATA["owners"]} == expected
  assert set(EVIDENCE["coverageOwnerIds"]) == expected
  assert len(EVIDENCE["selectedFaces"]) == 30
  assert EVIDENCE["counts"]["newFaces"] == 28
  source = json.loads(gzip.decompress(model.SOURCE.read_bytes()))["buildings"]
  source_by_id = {r["id"]: r for r in source}
  offsets = json.loads((model.DATA / "weinbergBuildingOffsetsV176.json").read_text())[
    "offsets"
  ]
  for owner in DATA["owners"]:
    record = source_by_id[owner["id"]]
    assert (
      owner["sourceSha256"]
      == hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
    )
    assert owner["roofPolygons"] == sum(
      s["kind"] == "RoofSurface" for p in record["parts"] for s in p["surfaces"]
    )
    assert owner["id"] in offsets
    assert owner["anchor"] == [
      model.footprint(record).centroid.x,
      model.footprint(record).centroid.y,
    ]
  # These v192 files are byte-preserved, not regenerated or simplified by v193.
  historical = {
    "zionskirchplatzV175Profile.json": "c5d2d71b39449e712693748ad73c7fc037f35345537d240d70c0f58442e6064c",
    "zionskirchplatzV175Drawn.json": "18b254a82e8ecdb007f2c0b1de675e9ce7debb99d9b8bc2877a276d7bdbef8d2",
    "zionskirchplatzV175Native.json": "a443843eea1698c48e590712967f3a96a5d436320a2f726106dbf8576449a002",
    "weinbergBuildingOffsetsV176.json": "d4e4a8d92cb47831a18924896fbe652fca360089f0194246ea8b2ff67d46e749",
  }
  for name, digest in historical.items():
    assert hashlib.sha256((model.DATA / name).read_bytes()).hexdigest() == digest


def test_height_aware_visibility_preserves_cafe_upper_wall() -> None:
  faces = EVIDENCE["selectedFaces"]
  upper = next(
    f
    for f in faces
    if f["sourcePolygonId"] == "UUID_eb77e031-e88b-4b97-b282-9526a2eba5b6"
  )
  offsets = json.loads((model.DATA / "weinbergBuildingOffsetsV176.json").read_text())[
    "offsets"
  ]
  assert upper["status"] == "new-v193" and upper["visibleFromY"] == 6.3
  assert (
    0.12
    < upper["visibleFromY"]
    + offsets[upper["parentId"]]
    - (6 + offsets["DEBE01YYK0000COw"])
    < 0.14
  )
  old = json.loads(model.OLD.read_text())
  old_ids = {f["sourcePolygonId"] for r in old["buildings"] for f in r["faces"]}
  assert len(old_ids) == 11
  assert all(
    f["sourcePolygonId"] not in old_ids for f in faces if f["status"] == "new-v193"
  )
  assert sum(f["sourcePolygonId"] in old_ids for f in faces) == 2
  assert not any(
    f["parentId"].endswith(suffix) for f in faces for suffix in ["0DtA", "05Gs", "09Fq"]
  )
  low_shed = [f for f in faces if f["parentId"] == "DEBE01YYK0000COw"]
  assert low_shed and all(f["levelsEstimate"] == 1 for f in low_shed)


def test_new_paint_and_members_stay_inside_measured_wall_contours() -> None:
  faces = [f for f in EVIDENCE["selectedFaces"] if f["status"] == "new-v193"]
  for surface in DATA["surfaces"]:
    candidates = [
      f
      for f in faces
      if f["owner"] == surface["owner"]
      and np.linalg.norm(np.array(f["normal"]) - surface["normal"]) < 1e-6
    ]

    def matches(face: dict) -> bool:
      a, d, wall = projected_face(face)
      n = np.array(face["normal"])
      for tri in surface["triangles"]:
        points = []
        for x, y, z in tri:
          p = np.array([x, z]) - a
          if abs(float(p @ n) - 0.21) > 0.00002:
            return False
          points.append((float(p @ d), y))
        if not wall.buffer(0.00002).covers(Polygon(points)):
          return False
      return True

    assert any(matches(f) for f in candidates)
  for face in faces:
    a, d, wall = projected_face(face)
    for row in DATA["boxes"][face["firstBox"] : face["firstBox"] + face["boxCount"]]:
      x, y, z, w, h, depth = row[:6]
      assert w > 0 and h > 0 and depth > 0 and row[11] == face["owner"]
      u = float((np.array([x, z]) - a) @ d)
      assert wall.buffer(0.00202).covers(
        box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
      )
      assert y + h / 2 <= face["eave"] + 0.002
  assert all(row[4] == row[7] == 0.5 and row[6] > 0 for row in DATA["blocks"])
  assert len(json.dumps(DATA, separators=(",", ":"))) < 700_000


def test_deterministic_regeneration_and_reference_provenance() -> None:
  drawn, evidence = model.make_payloads()
  assert drawn == DATA and evidence == EVIDENCE
  assert (
    hashlib.sha256(model.SOURCE.read_bytes()).hexdigest() == EVIDENCE["sourceSha256"]
  )
  assert len(PROFILE["newReferences"]) == 3
  for path in [
    ROOT / "geo_data/regierungsviertel/wikimedia_references.json",
    ROOT / "src/app/public/dzi/regierungsviertel/wikimedia_attribution.json",
  ]:
    records = json.loads(path.read_text())["records"]
    for ref in PROFILE["newReferences"]:
      assert not ref["photo_bundled"] and ref["license"] == "CC BY-SA 4.0"
      assert any(
        r["page_url"] == ref["page_url"] and r["license"] == ref["license"]
        for r in records
      )
