"""Current identity, exact preserved source sheets, and conservative facade binding."""

import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def read(path):
  return json.loads(path.read_text())


def test_current_all_eleven_courts_and_separate_services():
  evidence = read(GEO / "district-courts-v229-evidence.json")
  sites = evidence["sites"]
  keys = {s["key"] for s in sites}
  assert len(sites) == 21
  assert {s["court"] for s in sites if s["key"] != "tegeler-neubau"} == {
    "Charlottenburg",
    "Köpenick",
    "Kreuzberg",
    "Lichtenberg",
    "Mitte",
    "Neukölln",
    "Pankow",
    "Schöneberg",
    "Spandau",
    "Tiergarten",
    "Wedding",
  }
  assert {
    "wedding",
    "wedding-mahn",
    "charlottenburg",
    "charlottenburg-register",
    "tiergarten-bereitschaft",
    "tiergarten-kirch",
    "schoeneberg-ring",
    "lichtenberg-archiv",
  } <= keys
  assert all(
    s["officialUrl"].startswith(
      ("https://service.berlin.de/", "https://www.berlin.de/")
    )
    for s in sites
  )
  assert (
    hashlib.sha256(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_bytes()
    ).hexdigest()
    == evidence["originalCoreSha256"]
  )
  assert (
    hashlib.sha256((GEO / "district-courts-source-v229.json").read_bytes()).hexdigest()
    == evidence["sourceSha256"]
  )


def test_every_accent_is_shallow_and_inside_its_actual_source_wall():
  source = read(DATA / "districtCourtsV229.json")
  audits = read(GEO / "district-courts-v229-evidence.json")
  for s, audit in zip(source["sites"], audits["sites"], strict=True):
    for f in audit["faces"]:
      p = np.array(f["rings"][0])
      a, b = max(
        ((a, b) for a in p for b in p),
        key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
      )
      d = np.array([b[0] - a[0], 0, b[2] - a[2]])
      d /= np.linalg.norm(d)
      wall = Polygon([[(q - a) @ d, q[1]] for q in p]).buffer(0.003)
      for i in f["boxes"]:
        r = s["boxes"][i]
        u = (np.array(r[:3]) - a) @ d
        assert wall.covers(
          box(u - r[3] / 2, r[1] - r[4] / 2, u + r[3] / 2, r[1] + r[4] / 2)
        ), s["key"]
        assert r[5] <= 0.28
    for label in s["labels"]:
      assert np.dot(np.cross(label["direction"], [0, 1, 0]), label["normal"]) > 0.999
  # None of the shared service sites recolours its entire host office/police body.
  for s in source["sites"]:
    if s["key"] in {
      "tiergarten-bereitschaft",
      "tiergarten-kirch",
      "charlottenburg-register",
    }:
      assert len(s["boxes"]) == 2


def test_required_replacements_retain_all_original_metric_wall_and_roof_vertices():
  source = read(GEO / "district-courts-source-v229.json")
  envelopes = {
    s["key"]: s for s in read(DATA / "districtCourtsV229Envelopes.json")["sites"]
  }
  expected = {
    "wedding",
    "charlottenburg",
    "tegeler-neubau",
    "koepenick",
    "koepenick-grundbuch",
    "lichtenberg",
  }
  assert set(envelopes) == expected
  for site in source["sites"]:
    if site["key"] not in expected:
      continue
    rendered = {
      tuple(round(v, 4) for v in p)
      for s in envelopes[site["key"]]["surfaces"]
      for t in s["triangles"]
      for p in t
    }
    for parent in site["parents"]:
      delta = (5.2 if site["key"] == "wedding" else 3) - min(
        p["ground_y_m"] for p in parent["parts"]
      )
      for part in parent["parts"]:
        for sheet in part["surfaces"]:
          # Triangulators can omit collinear source points; every
          # original surface and its non-collinear corners remain.
          from scripts.build_breitscheid_towers_v161 import triangles_for

          for tri in triangles_for(sheet["rings"]):
            for x, y, z in tri:
              assert (round(x, 4), round(y + delta, 4), round(z, 4)) in rendered
  assert (
    len(
      next(s for s in source["sites"] if s["key"] == "wedding")["parents"][0]["parts"]
    )
    == 12
  )
  assert "mitte" not in envelopes and "tiergarten-moabit" not in envelopes
