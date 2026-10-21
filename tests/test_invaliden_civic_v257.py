"""Exact BMV/plant ownership, conservative wall bounds and current twin stacks."""

import array
import base64
import gzip
import json
import math

from shapely.geometry import Polygon, box

from scripts.build_invaliden_civic_v257 import ROOT, build, digest


def test_wall_fittings_keep_source_owners_and_actual_wall_bounds():
  data = build()
  assert data == json.loads(
    (ROOT / "src/app/src/data/invalidenCivicV257.json").read_text()
  )
  buildings = json.loads(gzip.decompress((ROOT / data["sourcePath"]).read_bytes()))[
    "buildings"
  ]
  for site in data["sites"].values():
    b = next(b for b in buildings if b["id"] == site["owner"])
    assert digest(b) == site["buildingSha256"]
    assert len(b["parts"]) == site["parts"]
    for f in site["faces"]:
      part = next(p for p in b["parts"] if p["id"] == f["part"])
      surface = part["surfaces"][f["index"]]
      assert digest(surface) == f["surfaceSha256"]
      a, c = f["a"], f["b"]
      length = math.dist(a, c)
      d = [(c[k] - a[k]) / length for k in [0, 1]]
      poly = Polygon(
        [
          ((p[0] - a[0]) * d[0] + (p[2] - a[1]) * d[1], p[1])
          for p in surface["rings"][0]
        ]
      )
      assert poly.buffer(0.001).covers(
        box(0.03, f["bottom"] + 0.08, length - 0.03, f["top"] - 0.12)
      ), (site["owner"], f["part"], f["index"])


def test_current_35m_stacks_and_no_old_150m_source_owner():
  data = build()
  assert [s["osmNode"] for s in data["stacks"]] == [12361082516, 12361082517]
  assert all(s["height"] == 35 for s in data["stacks"])
  assert 20 < math.dist(*[s["point"] for s in data["stacks"]]) < 23
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  site = [
    b
    for b in prisms
    if 140 < sum(p[0] / 10 for p in b["ring"]) / len(b["ring"]) < 280
    and -1580 < sum(p[1] / 10 for p in b["ring"]) / len(b["ring"]) < -1370
  ]
  assert len(site) > 5
  assert max(b["h_dm"] / 10 for b in site) < 35
  assert (ROOT / "src/app/src/data/invalidenCivicV257.json").stat().st_size < 8000


def test_delivered_core_and_neighbour_packets_have_no_legacy_tall_stack():
  paths = []
  for name in ("altMitteV169Drawn", "altMitteV169Native"):
    paths.extend((ROOT / "src/app/src/data" / name).glob("packet-*.json"))
  outer = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  for prefix in ("0_-3", "0_-4"):
    paths.extend(outer.glob(f"{prefix}*.json.gz"))
  seen = 0
  for path in paths:
    raw = path.read_bytes()
    packet = json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)
    ox, oy, oz = packet["origin"]
    if ox > 280 or ox + 700 < 140 or oz > -1370 or oz + 700 < -1580:
      continue
    for mesh in packet["meshes"]:
      positions = array.array("H", base64.b64decode(mesh["positions"]))
      for i in range(0, len(positions), 3):
        if (
          140 < ox + positions[i] / 100 < 280
          and -1580 < oz + positions[i + 2] / 100 < -1370
        ):
          seen += 1
          assert oy + positions[i + 1] / 100 < 35, path
  assert seen > 20_000
