"""Finite source preservation, fitting containment and exact ownership regressions."""

from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

import pytest
from shapely.geometry import LineString, Polygon, box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_prenzlberg_v264 as builder  # noqa: E402


@pytest.fixture(scope="module")
def generated():
  return builder.build(builder.read(builder.SOURCE))


def test_all_previous_source_and_detail_inputs_remain_byte_exact():
  source = builder.read(builder.SOURCE)
  for path, expected in source["inputSha256"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == expected, path


def test_original_sheets_immutable_and_corrected_footprints_exact(generated):
  source = builder.read(builder.SOURCE)
  correction = builder.read(builder.CORRECTION)
  assert builder.digest(builder.SOURCE) == correction["retainedPrimary"]["sha256"]
  part = source["sites"][0]["parents"][0]["parts"][0]
  arc = correction["sites"][0]["parents"][1]["parts"][0]
  assert [len(p["surfaces"]) for p in [part, arc]] == [342, 94]
  archive = ROOT / source["archive"]["path"]
  for p in [part, arc]:
    assert p == builder.part_profile(builder.extract_parent(archive, p["id"]))
  nav = generated[3]["sites"][0]
  for owner, p in zip(nav["owners"], [part, arc], strict=True):
    assert owner["ring"] == p["ring"] and owner["holes"] == p["holes"]
  union = Polygon(part["ring"], part["holes"]).union(Polygon(arc["ring"], arc["holes"]))
  from shapely.geometry import Point

  for surface in generated[1]["sites"][0]["surfaces"]:
    for t in surface["triangles"]:
      assert all(union.buffer(0.0002).covers(Point(p[0], p[2])) for p in t)
  assert nav["bounds"] == list(union.bounds)
  assert nav["pads"] == []


def test_documented_silver_dome_has_published_diameter_and_low_annex(generated):
  surfaces = generated[1]["sites"][0]["surfaces"]
  dome = next(s for s in surfaces if s["sourceKind"] == "ReconstructedDome")
  points = [p for t in dome["triangles"] for p in t]
  cx, cz = 3895.408, -2594.857
  assert max(math.hypot(p[0] - cx, p[2] - cz) for p in points) == pytest.approx(
    15, abs=0.0001
  )
  assert max(p[1] for p in points) == pytest.approx(32.721)
  # A rounded broad cap, not the earlier pointed source cone.
  assert builder.roof_y(dome["triangles"], cx + 10, cz) > 28.5
  assert builder.roof_y(dome["triangles"], cx + 3, cz) > 32.2
  annex = [
    s for s in surfaces if s["sourceKind"] in ["EstimatedLowWall", "EstimatedAnnexRoof"]
  ]
  assert max(p[1] for s in annex for t in s["triangles"] for p in t) == 8.4
  assert sum(len(s["triangles"]) for s in surfaces) == 2575
  assert builder.roof_y(generated[3]["sites"][0]["roofTriangles"], 3880.2, -2595) == 8.4


def test_native_shell_covers_every_visible_reconstruction_vertex(generated):
  cells = generated[2]["sites"][0]["blocks"]
  for surface in generated[1]["sites"][0]["surfaces"]:
    for tri in surface["triangles"]:
      for point in tri:
        assert any(
          all(abs(point[i] - row[i]) <= row[i + 3] / 2 + 1e-7 for i in range(3))
          for row in cells
        )
  assert len(cells) == 860


def test_fittings_stay_on_their_source_faces_and_retain_old_apertures(generated):
  for site in generated[0]["sites"]:
    for face in site["faces"]:
      points = face["rings"][0]
      a, b = max(
        ((a, b) for a in points for b in points),
        key=lambda ab: (ab[1][0] - ab[0][0]) ** 2 + (ab[1][2] - ab[0][2]) ** 2,
      )
      length = ((b[0] - a[0]) ** 2 + (b[2] - a[2]) ** 2) ** 0.5
      dx, dz = (b[0] - a[0]) / length, (b[2] - a[2]) / length

      def project(p):
        return [(p[0] - a[0]) * dx + (p[2] - a[2]) * dz, p[1]]

      polygon = Polygon([project(p) for p in points]).buffer(0.001)
      for index in face["boxes"]:
        row = site["boxes"][index]
        u, y = project(row)
        assert polygon.covers(
          box(u - row[3] / 2, y - row[4] / 2, u + row[3] / 2, y + row[4] / 2)
        )
      for index in face["rods"]:
        row = site["rods"][index]
        assert polygon.covers(
          LineString([project(row[:3]), project(row[3:6])]).buffer(
            row[6] / 2, cap_style=2
          )
        )
  water, ryke, planet = generated[0]["sites"]
  assert water["recognition"]["existingSixStoreyWindowsRetained"]
  assert ryke["recognition"]["earlierRosesRetained"] == 3
  assert planet["recognition"]["publishedExteriorDiameterM"] == 30


def test_only_exact_planetarium_proxy_can_transfer():
  receipt = builder.read(builder.DATA / "prenzlbergV264Ownership.json")
  assert set(receipt["authorizedOwners"]) == {builder.OWNER, builder.ARC_OWNER}
  assert not receipt["blocked"]
  assert {r["owner"] for r in receipt["records"]} == {builder.OWNER, builder.ARC_OWNER}
  assert {r["mode"] for r in receipt["records"]} == {"drawn", "minecraft"}
  assert {r["tile"] for r in receipt["records"]} == {"7_-6"}
  assert {r["owner"] for r in receipt["navigationRecords"]} == {
    builder.OWNER,
    builder.ARC_OWNER,
  }
  heights = {
    (r["owner"], r["mode"]): r["original"]["height"]
    for r in receipt["navigationRecords"]
  }
  assert heights == {
    (builder.OWNER, "drawn"): 29.74,
    (builder.OWNER, "minecraft"): 30.0,
    (builder.ARC_OWNER, "drawn"): 15.02,
    (builder.ARC_OWNER, "minecraft"): 16.0,
  }
  assert len(receipt["navigationRecords"]) == 8
  assert sum(len(r["segments"]) for r in receipt["lineRecords"]) == 215
  assert receipt["sourceSha256"] == builder.digest(builder.CORRECTION)


def test_replay_is_deterministic_and_bounded(generated):
  for suffix, data in zip(
    ["", "Envelopes", "Native", "Navigation"], generated, strict=True
  ):
    expected = builder.read(builder.DATA / f"prenzlbergV264{suffix}.json")
    if not suffix:
      data = json.loads(json.dumps(data))
      for s in data["sites"]:
        s.pop("faces")
        s.pop("labels")
    assert expected == data
  for s in generated[0]["sites"]:
    assert len(s["boxes"]) + len(s["rods"]) < 2200
    assert len(s["nativeRows"]) < 2200
  assert (
    sum(p.stat().st_size for p in builder.DATA.glob("prenzlbergV264*.json")) < 1_000_000
  )
