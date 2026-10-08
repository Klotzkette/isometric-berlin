"""Exact airport envelopes, runway source topology and bounded native output."""

import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from packet_receipts_v194 import audited_v194_changes
from shapely.geometry import LineString, Polygon, box, shape
from shapely.ops import linemerge, unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_airports_v194 as model  # noqa: E402

SOURCE = json.loads(model.SOURCE.read_bytes())
DATA = json.loads((model.DATA / "airportsV194.json").read_bytes())
EVIDENCE = json.loads((model.GEO / "airports-v194-evidence.json").read_bytes())
OWNERS = {
  "DEBE07YY90002dwR",
  "DEBE07YY90002daO",
  "DEBE07YY90002dsj",
  "DEBE07YY900008Ks",
  "DEBE07YY900002ol",
  "DEBE07YY9000088X",
}


def triangle_key(t: list) -> bytes:
  return np.asarray(sorted(t), dtype="<f8").tobytes()


def test_all_six_complete_source_envelopes_are_rendered_exactly() -> None:
  assert {p["id"] for p in SOURCE["parents"]} == OWNERS
  assert set(EVIDENCE["tempelhofOwners"]) == OWNERS
  assert sum(len(p["surfaces"]) for p in SOURCE["parents"]) == 2044
  assert (
    EVIDENCE["sourceSha256"] == hashlib.sha256(model.SOURCE.read_bytes()).hexdigest()
  )
  expected = Counter(
    triangle_key(t)
    for p in SOURCE["parents"]
    for s in p["surfaces"]
    if s["kind"] != "GroundSurface"
    for t in model.triangles_for(s["rings"])
  )
  actual = Counter(
    triangle_key(t)
    for s in DATA["surfaces"]
    if s.get("role") == "tempelhof-source"
    for t in s["triangles"]
  )
  assert actual == expected and sum(actual.values()) == 5514
  for p in SOURCE["parents"]:
    ys = [v[1] for s in p["surfaces"] for r in s["rings"] for v in r]
    # The complete parent datum can include lower, non-thematic source points;
    # do not flatten its thematic wall feet to that minimum during extraction.
    assert min(ys) >= 3
    assert abs(max(ys) - 3 - p["height"]) < 0.001


def test_both_runway_courses_keep_every_source_vertex_and_tagged_width() -> None:
  ids = {
    "way/4537222",
    "way/216959300",
    "way/537004744",
    "way/510281794",
    "way/510281796",
  }
  rows = {f["id"]: f for f in SOURCE["features"] if f["id"] in ids}
  assert set(rows) == ids == {r["id"] for r in EVIDENCE["runways"]}
  for r in EVIDENCE["runways"]:
    f = rows[r["id"]]
    assert r["coordinates"] == f["geometry"]["coordinates"]
    assert r["widthM"] == float(f["tags"]["width"]) == 46
    assert r["lengthM"] == shape(f["geometry"]).length
  courses = linemerge(unary_union([shape(f["geometry"]) for f in rows.values()]))
  assert len(courses.geoms) == 2
  assert sorted(round(g.length, 2) for g in courses.geoms) == [2534.86, 3021.97]
  # Nominal historic length tags do not license truncating the mapped ends.
  assert rows["way/4537222"]["tags"]["length"] == "3023"
  assert rows["way/216959300"]["tags"]["length"] == "2428"


def test_mapped_courts_remain_clear_of_all_roof_triangles() -> None:
  for ident in ["relation/13234", "relation/10466358"]:
    geom = shape(next(f["geometry"] for f in SOURCE["features"] if f["id"] == ident))
    holes = [Polygon(h) for p in geom.geoms for h in p.interiors]
    assert len(holes) == (1 if ident == "relation/13234" else 6)
    for hole in holes:
      point = hole.representative_point()
      assert not any(
        Polygon([(p[0], p[2]) for p in t]).buffer(-0.001).contains(point)
        for s in DATA["surfaces"]
        for t in s["triangles"]
      )


def test_native_surface_lattice_and_runway_bands_are_bounded_not_volume_fill() -> None:
  fixture = [{"color": 123, "triangles": [[[0, 4, 0], [8, 4, 0], [0, 4, 8]]]}]
  blocks = model.native_surfaces(fixture, [])
  assert blocks and all(b[1] == 5 and b[4] == 2 and b[6] == 123 for b in blocks)
  runway = LineString([(0, 0), (200, -27)]).buffer(23, cap_style=2)
  bands = model.flat_native(runway, 3.08, 123)
  assert bands and len(bands) < 40
  assert all(abs(b[1] + b[4] / 2 - 3.08) < 1e-9 for b in bands)
  assert all(
    runway.buffer(0.002).covers(
      box(b[0] - b[3] / 2, b[2] - b[5] / 2, b[0] + b[3] / 2, b[2] + b[5] / 2)
    )
    for b in bands
  )
  assert EVIDENCE["counts"] == {"triangles": 7294, "boxes": 3551, "nativeBlocks": 13550}
  assert all(
    len(r) == 7 and min(r[3:6]) > 0 and np.isfinite(r).all() for r in DATA["blocks"]
  )


def test_exact_v194_owner_changes_keep_all_unrelated_old_city_geometry() -> None:
  changes = audited_v194_changes()
  assert len(changes) == 18
  assert {key[0] for key in changes} == {
    "1_6",
    "1_7",
    "1_8",
    "2_7",
    "2_8",
    "3_7",
    "ring182-1_8",
    "ring182-1_9",
    "ring182-2_8",
  }


def test_reference_images_remain_external_with_explicit_free_licences() -> None:
  credits = json.loads((model.GEO / "airports-v194-credits.json").read_bytes())
  assert len(credits) == 4
  assert {c["license"] for c in credits} == {
    "CC BY-SA 3.0",
    "CC BY-SA 4.0",
    "Public domain",
  }
  assert all(
    c["page_url"].startswith("https://commons.wikimedia.org/wiki/File:") and c["artist"]
    for c in credits
  )
