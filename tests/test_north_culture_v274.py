"""Finite northern culture details retain measured owners and real placements."""

from __future__ import annotations

import gzip
import json
from pathlib import Path

import pytest
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

from scripts import build_north_culture_v274 as M

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def rebuilt():
  return M.build()


def test_source_rebuild_and_complete_retained_parents(rebuilt):
  runtime, evidence = rebuilt
  assert runtime == json.loads((M.DATA / "northCultureV274Source.json").read_text())
  assert evidence == json.loads(
    gzip.decompress((M.GEO / "north-culture-v274-source.json.gz").read_bytes())
  )
  assert runtime["sourceSha256"] == M.digest(evidence["parents"])
  assert evidence["runtimeSha256"] == M.digest(runtime)
  assert {p["id"] for p in evidence["parents"]} == {t[0] for t in M.TARGETS.values()}
  assert sum(len(p["sourceParts"]) for p in evidence["parents"]) == 4
  assert all(
    p["sourceSha256"] == M.digest(p["sourceParts"]) for p in evidence["parents"]
  )
  assert (M.DATA / "northCultureV274Source.json").stat().st_size < 32_000


def test_source_datums_match_actual_unchanged_primary_packets(rebuilt):
  runtime, evidence = rebuilt
  for parent in evidence["parents"]:
    packet_path = (
      ROOT
      / "src/app/public/mesh/surrounding-berlin-v159"
      / f"{parent['placementPacket']}.drawn.json.gz"
    )
    packet = json.loads(gzip.decompress(packet_path.read_bytes()))
    row = next(
      b for b in packet["nav"]["buildings"] if b.get("sourceId") == parent["id"]
    )
    ground = packet["nav"]["groundY"] + row.get("groundOffset", 0)
    assert (
      parent["placementSha256"]
      == M.hashlib.sha256(packet_path.read_bytes()).hexdigest()
    )
    assert runtime[parent["key"]]["groundY"] == parent["groundY"] == ground
    assert min(p["ground_y_m"] for p in parent["sourceParts"]) + parent[
      "verticalOffset"
    ] == pytest.approx(ground)
  assert runtime["herzJesu"]["groundY"] == 3
  assert runtime["groberUnfug"]["groundY"] == 6.93
  assert runtime["herzJesu"]["height"] == 55
  assert runtime["herzJesu"]["previousHeight"] == pytest.approx(25.567)


def test_shop_axes_and_tower_anchor_are_inside_retained_owner(rebuilt):
  runtime, evidence = rebuilt
  shop = next(p for p in evidence["parents"] if p["key"] == "groberUnfug")
  footprint = unary_union([Polygon(p["ring"]) for p in shop["sourceParts"]])
  s = runtime["groberUnfug"]
  for a, b in [(s["a"], s["corner"]), (s["corner"], s["b"])]:
    assert footprint.boundary.buffer(0.002).covers(LineString([a, b]))
  assert footprint.buffer(0.01).covers(Point(s["poi"]))
  church = next(p for p in evidence["parents"] if p["key"] == "herzJesu")
  assert Polygon(church["sourceParts"][0]["ring"]).covers(
    Point(runtime["herzJesu"]["towerCenter"])
  )


def test_tor_exact_four_external_facets_no_atrium_or_internal_seams(rebuilt):
  runtime, evidence = rebuilt
  faces, parts = runtime["schoenhauserTorFaces"], runtime["schoenhauserTorParts"]
  assert len(faces) == 4
  assert parts == evidence["schoenhauserTorParts"]
  for f in faces:
    # A 43cm ground strip outside the crown is not a 33m adjacent wall.
    body = unary_union(
      [
        Polygon(p["ring"], p.get("holes", []))
        for p in parts
        if p["top_y_m"] > f["top"] - 8.85
      ]
    )
    p = next(p for p in parts if p["id"] == f["partId"])
    assert any(
      a == f["a"] and p["ring"][(i + 1) % len(p["ring"])] == f["b"]
      for i, a in enumerate(p["ring"])
    )
    assert f["top"] == p["top_y_m"]
    midpoint = [(a + b) / 2 for a, b in zip(f["a"], f["b"], strict=True)]
    assert not body.contains(
      Point([v + n * 0.1 for v, n in zip(midpoint, f["normal"], strict=True)])
    )
    assert body.contains(
      Point([v - n * 0.1 for v, n in zip(midpoint, f["normal"], strict=True)])
    )


def test_suhrkamp_exact_existing_west_faces_and_primary_sources(rebuilt):
  runtime, evidence = rebuilt
  old = json.loads((M.DATA / "suhrkampPfefferbergV189.json").read_text())
  faces = [f for f in old["faces"] if f["kind"] == "suhrkamp"]
  assert runtime["suhrkampFaces"] == faces
  assert evidence["suhrkampSourceSha256"] == old["sourceSha256"]
  assert len([f for f in faces if f["normal"][0] < -0.9]) == 2
  assert any("bundschuh.net" in url for url in evidence["sources"]["suhrkamp"])
  assert any("groberunfug.de" in url for url in evidence["sources"]["groberUnfug"])
  assert any("landesdenkmalamt" in url for url in evidence["sources"]["herzJesu"])
  assert "estimated" in evidence["herzJesuDop"]["interpretation"]
