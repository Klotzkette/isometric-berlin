"""Public source identity, exact mapped courses and display-estimate boundaries."""

import gzip
import hashlib
import json

from scripts import build_reichstag_underground_v319 as build


def test_complete_retained_mapped_courses_are_rendered_without_xy_rounding():
  evidence = json.loads(gzip.decompress(build.EVIDENCE.read_bytes()))
  runtime = json.loads(build.OUTPUT.read_bytes())
  assert evidence["source"]["path"] == str(build.PBF.relative_to(build.ROOT))
  assert (
    hashlib.sha256(build.PBF.read_bytes()).hexdigest() == evidence["source"]["sha256"]
  )
  assert evidence["noExistingSourceMutation"] and evidence["noNavigationChange"]
  originals = {row["id"]: row for row in evidence["source"]["ways"]}
  actual = {
    path["sourceWay"]: path for path in runtime["paths"] if path["kind"] == "goods"
  }
  assert set(actual) == set(originals) == set(build.GOODS_IDS)
  for ident, path in actual.items():
    assert [[p[0], p[2]] for p in path["points"]] == originals[ident]["coordinates"]
    assert path["width"] == 8 and path["height"] == 4.2
    assert {p[1] for p in path["points"]} == {-8.2}
    assert "display estimates" in path["status"]
  assert (
    hashlib.sha256(build.OUTPUT.read_bytes()).hexdigest()
    == evidence["runtime"]["sha256"]
  )
  assert build.OUTPUT.stat().st_size == evidence["runtime"]["bytes"] < 4000


def test_pedestrian_and_service_identities_remain_distinct_and_unsurveyed():
  evidence = json.loads(gzip.decompress(build.EVIDENCE.read_bytes()))
  runtime = json.loads(build.OUTPUT.read_bytes())
  pedestrian = [p for p in runtime["paths"] if p["kind"] == "pedestrian"]
  assert {p["id"] for p in pedestrian} == {"rtg-jkh", "rtg-plh"}
  assert all("schematic" in p["status"] for p in pedestrian)
  assert all({q[1] for q in p["points"]} == {0.25} for p in pedestrian)
  assert (
    "no invented direct RTG-MELH visitor tunnel"
    in evidence["distinctOvergroundConnection"]
  )
  assert "not a measured basement" in runtime["estimateStatus"]
  assert runtime["floor"] == 0.25 and runtime["ceiling"] == 3.55
  assert runtime["archiveBoxCount"] == 5000
  assert "No invented names" in evidence["archive"]
  assert set(evidence["references"]) == set(build.REFERENCES)
  assert evidence["references"]["archive"].startswith("https://www.bundestag.de/")
  assert evidence["references"]["pedestrianPlh"].startswith(
    "https://www.mitmischen.de/"
  )
