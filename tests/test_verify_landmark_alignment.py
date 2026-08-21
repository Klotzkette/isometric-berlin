"""Tests for landmark-to-map alignment QA."""

from __future__ import annotations

import json
from pathlib import Path

from pytest import MonkeyPatch

from isometric_berlin.data import verify_landmark_alignment as vla

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data" / "regierungsviertel"
VIEWER_LANDMARKS = ROOT / "src/app/public/dzi/regierungsviertel/landmarks.json"
BUNDLED_LANDMARKS = ROOT / "src/app/src/data/regierungsviertel-landmarks.json"
VIEWER_SCENE = ROOT / "src/app/public/mesh/regierungsviertel/scene.json"

# Landmarks the committed extract cannot confirm. Since v0.45.0 osm.gpkg covers
# the whole surveyed hull, so these are not coverage gaps any more: OSM carries
# no feature under the name this project uses. Their geometry comes from
# LoD2/official data, so a missing match is a QA note rather than a defect.
LANDMARKS_WITHOUT_OSM_MATCH = {
  # Both are current/future construction projects without a matching named
  # feature at their committed project anchors. Keep them as explicit reviews.
  "DKB Campus Upbeat",
  # Recent informal memorial supplied by the owner; it is absent from the
  # committed OSM extract and must remain an explicit manual-review anchor.
  "Queer Rainbow Memorial Berlin",
  "berlin modern — Museum des 20. Jahrhunderts",
}


def test_normalize_name_folds_berlin_landmark_names() -> None:
  assert vla.normalize_name("Marie-Elisabeth-Lüders-Haus") == (
    "marie elisabeth luders haus"
  )
  assert vla.normalize_name("Gustav-Heinemann-Brücke") == "gustav heinemann brucke"


def test_wagner_catalog_exports_share_the_exact_osm_anchor() -> None:
  landmarks = vla.load_landmarks(DATA / "landmarks.geojson")
  assert len(landmarks) == 90
  wagner = landmarks[landmarks["name"] == "Richard Wagner"]
  assert len(wagner) == 1
  row = wagner.iloc[0]
  assert row["role"] == "owner_added"
  assert row["tour_order"] == 90

  public_bytes = VIEWER_LANDMARKS.read_bytes()
  assert BUNDLED_LANDMARKS.read_bytes() == public_bytes
  public = json.loads(public_bytes)["landmarks"]
  public_wagner = [entry for entry in public if entry["name"] == "Richard Wagner"]
  assert public_wagner == [
    {
      "name": "Richard Wagner",
      "role": "owner_added",
      "tourOrder": 90,
      "x": 4238,
      "y": 7275,
      "nx": 0.258667,
      "ny": 0.626291,
    }
  ]

  scene = json.loads(VIEWER_SCENE.read_text(encoding="utf-8"))["landmarks"]
  scene_wagner = [entry for entry in scene if entry["name"] == "Richard Wagner"]
  assert len(scene_wagner) == 1
  world = scene_wagner[0]["world"]
  assert abs(world[0] - (row.geometry.x - 389_500.0)) < 1e-9
  assert world[1] == 8.0
  assert abs(world[2] - (5_820_000.0 - row.geometry.y)) < 1e-9


def test_committed_landmarks_align_with_osm_city_map() -> None:
  report = vla.build_alignment_report(
    landmarks_path=DATA / "landmarks.geojson",
    osm_path=DATA / "osm.gpkg",
    buildings_path=DATA / "buildings.gpkg",
  )

  assert report["summary"] == {
    "status": "review",
    "landmarks_checked": 90,
    "relative_relationships_checked": 38,
    "landmark_review_count": 3,
    "relative_review_count": 0,
    "review_count": 3,
  }
  checks = {check["name"]: check for check in report["checks"]}
  assert checks["Paul-Löbe-Haus"]["best_osm_match"]["name"] == "Paul-Löbe-Haus"
  assert checks["Marie-Elisabeth-Lüders-Haus"]["best_osm_match"]["name"] == (
    "Marie-Elisabeth-Lüders-Haus"
  )
  assert (
    checks["Botschaft der Vereinigten Staaten von Amerika"]["best_osm_match"]["name"]
    == "Botschaft der Vereinigten Staaten von Amerika"
  )
  assert checks["Hugo-Preuß-Brücke"]["best_osm_match"]["name"] == ("Hugo-Preuß-Brücke")
  assert checks["Moltkebrücke"]["best_osm_match"]["name"] == "Moltkebrücke"
  assert checks["Humboldthafen"]["best_osm_match"]["name"] == "Humboldthafen"
  assert checks["Schweizerische Botschaft"]["best_osm_match"]["name"] == (
    "Schweizerische Botschaft"
  )
  assert checks["Fahne der Einheit"]["best_osm_match"]["name"] == ("Fahne der Einheit")
  assert checks["Quadriga mit Victoria"]["best_osm_match"]["name"] == (
    "Quadriga mit Victoria"
  )
  assert checks["Spielplatz an der Luiseninsel"]["best_osm_match"]["id"] == ("24911694")
  assert checks["Starbucks Pariser Platz"]["best_osm_match"]["name"] == "Starbucks"
  assert (
    checks["Denkmal für die ermordeten Juden Europas"]["best_osm_match"]["name"]
    == "Denkmal für die ermordeten Juden Europas"
  )
  assert checks["Sowjetisches Ehrenmal Tiergarten"]["best_osm_match"]["name"] == (
    "Sowjetisches Ehrenmal Tiergarten"
  )
  assert checks["Jakob-Kaiser-Haus"]["best_osm_match"]["name"] == "Jakob-Kaiser-Haus"
  assert checks["Lessing-Denkmal"]["best_osm_match"]["name"] == (
    "Gotthold Ephraim Lessing"
  )
  assert checks["Königin-Luise-Denkmal (Luiseninsel)"]["best_osm_match"]["id"] == (
    "28586183"
  )
  # West of the pre-v0.45.0 extract, so these only match once the refetched
  # osm.gpkg reaches the Großer Stern.
  assert checks["Siegessäule"]["best_osm_match"]["name"] == "Siegessäule"
  assert checks["Großer Stern"]["best_osm_match"]["name"] == "Großer Stern"
  assert checks["Invalidenpark / Sinkende Mauer"]["best_osm_match"]["name"] == (
    "Sinkende Mauer"
  )
  assert checks["Tramhaltestelle S+U Hauptbahnhof"]["best_osm_match"]["id"] == (
    "1530833485"
  )
  assert checks["S15-Station Berlin Hauptbahnhof"]["best_osm_match"]["id"] == (
    "21001950"
  )
  assert checks["Taxistand Washingtonplatz"]["best_osm_match"]["id"] == ("1221586319")
  assert (
    checks["Parlament der Bäume gegen Krieg und Gewalt"]["best_osm_match"]["id"]
    == "208945077"
  )
  assert checks["Bahnhof Berlin Friedrichstraße"]["best_osm_match"]["name"] == (
    "Berlin Friedrichstraße"
  )
  assert (
    checks["Bundesministerium der Finanzen / Detlev-Rohwedder-Haus"]["best_osm_match"][
      "name"
    ]
    == "Bundesministerium der Finanzen"
  )
  assert checks["Denkzeichen Georg Elser"]["best_osm_match"]["id"] == "1986458966"
  assert checks["Richard Wagner"]["best_osm_match"]["id"] == "243487615"
  assert checks["Richard Wagner"]["best_osm_match"]["element"] == "node"
  assert checks["Richard Wagner"]["best_osm_match"]["distance_m"] == 0.0
  assert checks["Richard Wagner"]["status"] == "ok"
  assert checks["Queer Rainbow Memorial Berlin"]["best_osm_match"] is None
  assert checks["Queer Rainbow Memorial Berlin"]["status"] == "review"
  reviewed = {name for name, check in checks.items() if check["status"] != "ok"}
  assert reviewed == LANDMARKS_WITHOUT_OSM_MATCH
  assert all(
    relation["status"] == "ok" for relation in report["relative_relationships"]
  )


def test_markdown_report_preserves_precise_berliner_ensemble_ownership(
  tmp_path: Path,
) -> None:
  report = vla.build_alignment_report(
    landmarks_path=DATA / "landmarks.geojson",
    osm_path=DATA / "osm.gpkg",
    buildings_path=DATA / "buildings.gpkg",
  )
  output = tmp_path / "alignment.md"
  vla.write_markdown_report(report, output)
  row = next(
    line
    for line in output.read_text(encoding="utf-8").splitlines()
    if line.startswith("| Berliner Ensemble |")
  )
  assert "legacy tour-point/site way 422928025" in row
  assert "LoD2 parent DEBE01YYK00004vY" in row
  assert "protected building way 43017010" in row


def test_relative_relationship_reviews_affect_summary_status(
  monkeypatch: MonkeyPatch,
) -> None:
  expectations = [dict(expectation) for expectation in vla.RELATIVE_EXPECTATIONS]
  expectations[0]["east_west"] = "west"
  monkeypatch.setattr(vla, "RELATIVE_EXPECTATIONS", tuple(expectations))

  report = vla.build_alignment_report(
    landmarks_path=DATA / "landmarks.geojson",
    osm_path=DATA / "osm.gpkg",
    buildings_path=DATA / "buildings.gpkg",
  )

  assert report["summary"]["status"] == "review"
  assert report["summary"]["landmark_review_count"] == len(LANDMARKS_WITHOUT_OSM_MATCH)
  assert report["summary"]["relative_review_count"] == 1
  assert report["summary"]["review_count"] == len(LANDMARKS_WITHOUT_OSM_MATCH) + 1
  assert any(
    relationship["status"] == "review"
    for relationship in report["relative_relationships"]
  )


def test_committed_landmarks_preserve_real_world_relative_order() -> None:
  landmarks = vla.load_landmarks(DATA / "landmarks.geojson").set_index("name")

  def delta(from_name: str, to_name: str) -> tuple[float, float]:
    start = landmarks.loc[from_name].geometry
    end = landmarks.loc[to_name].geometry
    return float(end.x - start.x), float(end.y - start.y)

  dx, dy = delta("Berlin Hauptbahnhof", "Bundeskanzleramt")
  assert dx < 0
  assert dy < 0

  dx, dy = delta("Berlin Hauptbahnhof", "Marie-Elisabeth-Lüders-Haus")
  assert dx > 0
  assert dy < 0

  dx, dy = delta("Berlin Hauptbahnhof", "Hugo-Preuß-Brücke")
  assert dx > 0
  assert dy < 0

  dx, dy = delta("Berlin Hauptbahnhof", "Moltkebrücke")
  assert dx < 0
  assert dy < 0

  dx, dy = delta("Bundeskanzleramt", "Reichstagsgebäude")
  assert dx > 0
  assert dy < 0

  dx, dy = delta("Haus der Kulturen der Welt (Schwangere Auster)", "Reichstagsgebäude")
  assert dx > 0
  assert dy < 0

  dx, dy = delta("Berlin Hauptbahnhof", "Reichstagsgebäude")
  assert dx > 0
  assert dy < 0

  dx, dy = delta("Bundeskanzleramt", "Marie-Elisabeth-Lüders-Haus")
  assert dx > 0
  assert dy > 0

  dx, dy = delta("Reichstagsgebäude", "Brandenburger Tor")
  assert dx > 0
  assert dy < 0

  dx, dy = delta("Brandenburger Tor", "Botschaft der Vereinigten Staaten von Amerika")
  assert dx > 0
  assert dy < 0

  dx, dy = delta("Brandenburger Tor", "Denkmal für die ermordeten Juden Europas")
  assert dx > 0
  assert dy < 0

  dx, dy = delta("Brandenburger Tor", "Sowjetisches Ehrenmal Tiergarten")
  assert dx < 0
  assert dy > 0


def test_exported_viewer_landmarks_preserve_isometric_relative_order() -> None:
  payload = json.loads(VIEWER_LANDMARKS.read_text(encoding="utf-8"))
  landmarks = {row["name"]: row for row in payload["landmarks"]}

  def delta(from_name: str, to_name: str) -> tuple[float, float]:
    start = landmarks[from_name]
    end = landmarks[to_name]
    return float(end["x"] - start["x"]), float(end["y"] - start["y"])

  dx, dy = delta("Berlin Hauptbahnhof", "Bundeskanzleramt")
  assert dx < 0
  assert dy > 0

  dx, dy = delta("Berlin Hauptbahnhof", "Marie-Elisabeth-Lüders-Haus")
  assert dx > 0
  assert dy > 0

  dx, dy = delta("Berlin Hauptbahnhof", "Reichstagsgebäude")
  assert dx < 0
  assert dy > 0

  dx, dy = delta("Reichstagsgebäude", "Brandenburger Tor")
  assert dx < 0
  assert dy > 0

  dx, dy = delta("Brandenburger Tor", "Botschaft der Vereinigten Staaten von Amerika")
  assert dx < 0
  assert dy > 0

  wagner = landmarks["Richard Wagner"]
  assert wagner == {
    "name": "Richard Wagner",
    "role": "owner_added",
    "tourOrder": 90,
    "x": 4238,
    "y": 7275,
    "nx": 0.258667,
    "ny": 0.626291,
  }
