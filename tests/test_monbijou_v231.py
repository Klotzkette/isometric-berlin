"""Independent source preservation, geometry and runtime navigation checks."""

import hashlib
import json
import subprocess
from pathlib import Path

from shapely.geometry import Point, Polygon, shape

from scripts.build_monbijou_v231 import build

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
SOURCE = ROOT / "geo_data/regierungsviertel/monbijou-v231-source.json"


def test_source_plan_and_exact_bench_complement() -> None:
  s = json.loads(SOURCE.read_text())
  r = json.loads((DATA / "monbijouV231Receipt.json").read_text())
  old = json.loads((DATA / "mitteHeritageV166Source.json").read_text())
  assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == r["sourceSha256"]
  assert len(s["bridges"]) == 2
  assert [len(b["oldCells"]) for b in s["bridges"]] == [11, 4]
  assert len(s["benches"]) == 17
  old_by_id = {p["id"]: p for p in old["props"]}
  park, bath = shape(s["park"]), shape(s["protectedBath"])
  for b in s["benches"]:
    assert old_by_id[b["id"]] == b
    assert park.contains(Point(b["x"], b["z"]))
    assert not bath.buffer(1).intersects(Point(b["x"], b["z"]))
  for b in s["bridges"]:
    assert Polygon(b["ring"]).equals(
      Polygon(s["features"][b["outlineId"]]["geometry"]["coordinates"])
    )
    assert b["axis"] == s["features"][b["axisId"]]["geometry"]["coordinates"]
  assert s["bridges"][0]["structuralType"] == "single-span steel box girder"
  assert s["bridges"][1]["publishedSpanM"] == 18


def test_replay_and_exact_source_corners() -> None:
  paths = sorted(DATA.glob("monbijouV231*.json"))
  previous = {p: p.read_bytes() for p in paths}
  build(json.loads(SOURCE.read_text()))
  assert all(p.read_bytes() == previous[p] for p in paths)
  d = json.loads((DATA / "monbijouV231.json").read_text())
  s = json.loads(SOURCE.read_text())
  for b, site in zip(s["bridges"], d["sites"]):
    xs = list(zip(site["vertices"][::3], site["vertices"][2::3]))
    for p in b["ring"]:
      assert min((x - p[0]) ** 2 + (z - p[1]) ** 2 for x, z in xs) < 1e-9
  # Compact complete batches, not hidden replacement copies of the whole park.
  assert sum(p.stat().st_size for p in paths) < 1_000_000
  assert all(len(site["vertices"]) == 0 for site in d["sites"] if site["key"] == "park")


def test_rendered_bridge_rays_and_native_navigation() -> None:
  result = subprocess.run(
    ["bun", "tests/monbijou_v231_runtime.ts"],
    cwd=ROOT,
    text=True,
    capture_output=True,
    timeout=60,
  )
  assert result.returncode == 0, result.stdout + result.stderr
  assert '"centerlineRayAssertions":156' in result.stdout
