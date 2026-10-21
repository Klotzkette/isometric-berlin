"""Preservation, exact ownership and geometric clearance for the two east sites."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_east_cinemas_v260 import corrected, depth, digest, source  # noqa: E402

APP = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"


def test_all_source_and_runtime_packet_bytes_remain_unchanged() -> None:
  evidence = json.loads((GEO / "east-cinemas-v260-evidence.json").read_text())
  for path, sha in evidence["retainedSourcePackets"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == sha
  for r in evidence["retainedRuntimePackets"]:
    assert hashlib.sha256((ROOT / r["file"]).read_bytes()).hexdigest() == r["sha256"]
  assert evidence["originalRoofSha256"] == evidence["correctedRoofSha256"]
  saved = json.loads(
    gzip.decompress((GEO / "east-cinemas-v260-source.json.gz").read_bytes())
  )
  kino, moskau, _, _ = source()
  assert saved["originalInternational"] == kino
  assert saved["originalMoskau"] == moskau
  assert len(moskau["parts"]) == 6
  assert len(moskau["footprintPolygons"][0]["holes"]) == 1


def test_published_cantilever_changes_only_lower_front_volume() -> None:
  kino, _, _, _ = source()
  mesh, sheets, lower = corrected(kino)
  saved = json.loads((APP / "eastCinemasV260.json").read_text())["sites"][
    "international"
  ]
  assert lower == saved["lowerRing"]
  old_roof = [s for s in kino["parts"][0]["surfaces"] if s["kind"] == "RoofSurface"]
  assert old_roof == [s for s in sheets if s["kind"] == "RoofSurface"]
  for triangle, _, _ in mesh.triangles:
    for p in triangle:
      assert p[1] >= 9 - 1e-7 or depth(p) >= 9 - 1e-7
  full = Polygon(kino["footprintPolygons"][0]["ring"])
  body = Polygon(lower)
  assert body.within(full.buffer(1e-6))
  assert 300 < full.area - body.area < 325
  a, inward = saved["frontA"], saved["inward"]
  tangent = np.subtract(saved["frontB"], a)
  tangent /= np.linalg.norm(tangent)
  for d in [1, 4, 8.5]:
    point = np.array(a) + tangent * 17 + np.array(inward) * d
    assert full.covers(Point(point)) and not body.covers(Point(point))
  assert digest(old_roof) == digest([s for s in sheets if s["kind"] == "RoofSurface"])


def test_native_shell_is_independent_orthogonal_and_finite() -> None:
  packet = json.loads((APP / "eastCinemasV260Minecraft.json").read_text())
  count = 0
  for mesh in packet["meshes"]:
    points = (
      np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2")
      .reshape(-1, 3)
      .astype(float)
    )
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
      -1, 3
    )
    for a, b, c in points[indices]:
      n = np.cross(b - a, c - a)
      assert np.count_nonzero(n) == 1
      count += 1
  assert count == 958
  ownership = json.loads((APP / "eastCinemasV260Ownership.json").read_text())
  assert {r["tile"] for r in ownership["records"]} == {"6_-1"}
  assert all(r["part"] == ownership["owner"] for r in ownership["records"])
  assert {r["mode"] for r in ownership["records"]} == {"drawn", "minecraft"}
  assert sum(len(r["triangles"]) for r in ownership["records"]) == 2896
