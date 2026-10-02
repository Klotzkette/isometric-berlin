"""Four source-bound frontages must remain additive and tightly scoped."""

import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import LineString, Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_zionskirchplatz_v175 as model  # noqa: E402


def test_four_retained_owners_and_selected_street_planes() -> None:
  profile = json.loads(model.PROFILE.read_text())
  evidence = json.loads((model.DEST / "zionskirchplatzV175Evidence.json").read_text())
  source = json.loads(gzip.decompress(model.SOURCE.read_bytes()))["buildings"]
  assert {r["parentId"] for r in evidence["retainedOwners"]} == {
    "DEBE01YYK0000CIk",
    "DEBE01YYK00005G6",
    "DEBE01YYK0000C4w",
    "DEBE01YYK00008CV",
  }
  for owner in evidence["retainedOwners"]:
    record = next(r for r in source if r["id"] == owner["parentId"])
    assert (
      owner["sha256"]
      == hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
    )
    assert owner["roofPolygons"] > 0 and owner["groundY"] == 3
  assert len(profile["buildings"]) == 4
  assert sum("historic103" in f for b in profile["buildings"] for f in b["faces"]) == 1
  assert "not current tenant" in profile["uncertainty"]


def test_reproduction_and_backings_follow_source_planes_without_roof_replacement() -> (
  None
):
  drawn, native, evidence = model.make_payloads()
  for name, payload in [("Drawn", drawn), ("Native", native), ("Evidence", evidence)]:
    assert (
      json.loads((model.DEST / f"zionskirchplatzV175{name}.json").read_text())
      == payload
    )
  profile = json.loads(model.PROFILE.read_text())
  ids = {f["sourcePolygonId"] for b in profile["buildings"] for f in b["faces"]}
  source = json.loads(gzip.decompress(model.SOURCE.read_bytes()))["buildings"]
  lines = []
  for r in source:
    for p in r["parts"]:
      for s in p["surfaces"]:
        if s["sourcePolygonId"] in ids:
          assert s["kind"] == "WallSurface"
          lines.append(LineString([(v[0], v[2]) for v in s["rings"][0]]))
  for surface in drawn["surfaces"]:
    for triangle in surface["triangles"]:
      for x, y, z in triangle:
        assert min(line.distance(Point(x, z)) for line in lines) < 0.211
        assert 3 <= y <= 26
  # Two differently coloured coplanar backing patches must not overlap;
  # otherwise the shop base flickers against the upper plaster sheet.
  for a, b in zip(drawn["surfaces"][::2], drawn["surfaces"][1::2], strict=True):
    n = np.asarray(a["normal"])
    d = np.array([-n[1], n[0]])

    def projected_area(surface: dict) -> list[Polygon]:
      return [
        Polygon([(float(np.array([x, z]) @ d), y) for x, y, z in tri])
        for tri in surface["triangles"]
      ]

    assert (
      sum(x.intersection(y).area for x in projected_area(a) for y in projected_area(b))
      < 1e-7
    )
  assert evidence["drawnBoxes"] < 1600 and evidence["nativeRuns"] < 5000
  assert len(json.dumps(drawn)) + len(json.dumps(native)) < 450_000
  # Existing native source remains below a separate orthogonal surface skin.
  cells = set()
  assert any(row[5] == 7 for row in native["blocks"])
  for x, y, z, _color, w, role, h, d in native["blocks"]:
    assert w == d == (0.125 if role == 7 else 0.5) and h > 0 and h % w == 0
    for yy in np.arange(y - h / 2 + w / 2, y + h / 2, w):
      key = (x, float(yy), z)
      assert key not in cells
      cells.add(key)


def test_used_photograph_credits_are_mirrored() -> None:
  profile = json.loads(model.PROFILE.read_text())
  assert len(profile["visualReferences"]) == 2
  for path in [
    ROOT / "geo_data/regierungsviertel/wikimedia_references.json",
    ROOT / "src/app/public/dzi/regierungsviertel/wikimedia_attribution.json",
  ]:
    rows = json.loads(path.read_text())["records"]
    for photo in profile["visualReferences"]:
      assert any(
        r["page_url"] == photo["page_url"] and r["license"] == photo["license"]
        for r in rows
      )
      assert not photo["photo_bundled"]
