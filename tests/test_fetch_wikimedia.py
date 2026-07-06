"""Tests for Wikimedia Commons visual-reference fetching helpers."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

from isometric_berlin.data import fetch_wikimedia as fw

ROOT = Path(__file__).resolve().parents[1]


def test_license_allowed_accepts_only_clear_free_commons_licenses() -> None:
  assert fw.license_allowed("CC BY-SA 4.0")
  assert fw.license_allowed("CC-BY-2.5")
  assert fw.license_allowed("CC0")
  assert fw.license_allowed("Public domain")
  assert fw.license_allowed("PD-old-100")
  assert not fw.license_allowed("")
  assert not fw.license_allowed("All rights reserved")
  assert not fw.license_allowed("CC BY-NC 4.0")
  assert not fw.license_allowed("CC BY-ND 4.0")


def test_license_requires_attribution_for_by_and_by_sa() -> None:
  assert fw.license_requires_attribution("CC BY 4.0")
  assert fw.license_requires_attribution("CC BY-SA 3.0")
  assert not fw.license_requires_attribution("CC0")
  assert not fw.license_requires_attribution("Public domain")
  assert not fw.license_requires_attribution("All rights reserved")


def test_text_meta_strips_html_and_collapses_whitespace() -> None:
  metadata = {"Credit": {"value": "<b>Jane</b>&nbsp; Doe\n<br>Commons"}}

  assert fw.text_meta(metadata, "Credit") == "Jane Doe Commons"


def test_image_from_page_filters_license_and_normalizes_metadata() -> None:
  page = {
    "title": "File:Berlin Hauptbahnhof Ostseite.jpg",
    "imageinfo": [
      {
        "mime": "image/jpeg",
        "thumburl": "https://upload.wikimedia.org/example.jpg",
        "thumbwidth": 640,
        "thumbheight": 427,
        "extmetadata": {
          "LicenseShortName": {"value": "CC BY-SA 4.0"},
          "LicenseUrl": {"value": "https://creativecommons.org/licenses/by-sa/4.0/"},
          "Artist": {"value": "<span>Example Author</span>"},
          "Credit": {"value": "Own work"},
          "ImageDescription": {"value": "East facade"},
        },
      }
    ],
  }

  image = fw.image_from_page("hauptbahnhof", page)

  assert image is not None
  assert image.landmark_id == "hauptbahnhof"
  assert image.page_url.endswith("File%3ABerlin_Hauptbahnhof_Ostseite.jpg")
  assert image.artist == "Example Author"
  assert image.width == 640
  assert image.height == 427


def test_image_from_page_rejects_disallowed_or_non_image_entries() -> None:
  disallowed = {
    "title": "File:Locked.jpg",
    "imageinfo": [
      {
        "mime": "image/jpeg",
        "thumburl": "https://upload.wikimedia.org/example.jpg",
        "thumbwidth": 640,
        "thumbheight": 427,
        "extmetadata": {"LicenseShortName": {"value": "All rights reserved"}},
      }
    ],
  }
  non_image = {
    "title": "File:Document.pdf",
    "imageinfo": [
      {
        "mime": "application/pdf",
        "thumburl": "https://upload.wikimedia.org/example.jpg",
        "thumbwidth": 640,
        "thumbheight": 427,
        "extmetadata": {"LicenseShortName": {"value": "CC BY 4.0"}},
      }
    ],
  }

  assert fw.image_from_page("reichstag", disallowed) is None
  assert fw.image_from_page("reichstag", non_image) is None


def test_image_from_page_rejects_by_sa_without_artist_or_credit() -> None:
  missing_attribution = {
    "title": "File:Bundeskanzleramt Berlin.jpg",
    "imageinfo": [
      {
        "mime": "image/jpeg",
        "thumburl": "https://upload.wikimedia.org/example.jpg",
        "thumbwidth": 640,
        "thumbheight": 427,
        "extmetadata": {
          "LicenseShortName": {"value": "CC BY-SA 3.0"},
          "LicenseUrl": {"value": "https://creativecommons.org/licenses/by-sa/3.0/"},
          "Artist": {"value": ""},
          "Credit": {"value": ""},
        },
      }
    ],
  }

  assert fw.image_from_page("bundeskanzleramt", missing_attribution) is None


def test_committed_wikimedia_manifest_has_required_attribution() -> None:
  payload = json.loads(
    (ROOT / "geo_data/regierungsviertel/wikimedia_references.json").read_text(
      encoding="utf-8"
    )
  )

  missing = [
    record["title"]
    for record in payload["records"]
    if fw.license_requires_attribution(str(record.get("license", "")))
    and not (
      str(record.get("artist") or "").strip() or str(record.get("credit") or "").strip()
    )
  ]

  assert missing == []


def test_dominant_colours_returns_hex_palette(tmp_path: Path) -> None:
  path = tmp_path / "swatch.png"
  image = Image.new("RGB", (24, 24), (210, 190, 150))
  image.save(path)

  colours = fw.dominant_colours(path, count=3)

  assert 1 <= len(colours) <= 3
  assert all(colour.startswith("#") and len(colour) == 7 for colour in colours)


def test_slugify_is_filesystem_safe() -> None:
  assert fw.slugify("File:Berlin Hauptbahnhof, Ostseite.jpg") == (
    "file-berlin-hauptbahnhof-ostseite-jpg"
  )
  assert fw.slugify("File:Marie-Elisabeth-Lüders-Haus Berlin.jpg") == (
    "file-marie-elisabeth-luders-haus-berlin-jpg"
  )


def test_title_suitable_rejects_loose_or_non_facade_matches() -> None:
  assert fw.title_suitable("hauptbahnhof", "File:Berlin Hauptbahnhof Ostseite.jpg")
  assert fw.title_suitable("hkw", "File:Kongresshalle Berlin 2017.jpg")
  assert not fw.title_suitable("hkw", "File:Bundestag Fernsehturm 03 2013.JPG")
  assert not fw.title_suitable(
    "brandenburger_tor", "File:Brandenburger Tor nachts 2012-07.jpg"
  )
  assert not fw.title_suitable(
    "reichstag",
    "File:Reichstagsgebäude Berlin Architekt Wallot Dresden, Tafel 41.jpg",
  )
  assert not fw.title_suitable(
    "reichstag",
    "File:Academy Architecture 1895 Deutsches Reichstagsgebäude Berlin.jpg",
  )
  assert not fw.title_suitable(
    "brandenburger_tor",
    "File:Brandenburger Tor Berlin 1977.jpg",
  )
  assert not fw.title_suitable(
    "hauptbahnhof",
    "File:Skulptur Vertical Highways Washingtonplatz Hauptbahnhof Berlin.jpg",
  )
  assert not fw.title_suitable(
    "hauptbahnhof",
    "File:Berlin Hauptbahnhof, Notausgang auf dem Washingtonplatz.jpg",
  )


def test_title_suitable_accepts_expanded_regierungsviertel_targets() -> None:
  examples = {
    "paul_loebe_haus": "File:Paul-Löbe-Haus Berlin Westfassade.jpg",
    "marie_elisabeth_lueders_haus": (
      "File:Marie-Elisabeth-Lüders-Haus Berlin Spree.jpg"
    ),
    "zollpackhof": "File:Zollpackhof Berlin 2024-05-09 01.jpg",
    "hugo_preuss_bruecke": "File:Hugo-Preuß-Brücke Berlin.jpg",
    "moltkebruecke": "File:Moltkebrücke Berlin-Mitte.jpg",
    "holocaust_memorial": ("File:Denkmal für die ermordeten Juden Europas Berlin.jpg"),
    "memorial_homosexuals": (
      "File:Denkmal für die im Nationalsozialismus verfolgten Homosexuellen.jpg"
    ),
    "beethoven_haydn_mozart_memorial": (
      "File:Beethoven-Haydn-Mozart-Denkmal Berlin-Tiergarten.jpg"
    ),
    "venusteich_goldfischteich": (
      "File:Goldfischteich (Großer Tiergarten) - Berlin, Germany - DSC09426.JPG"
    ),
    "tipi_am_kanzleramt": "File:Tipi am Kanzleramt.jpg",
    "chillida_berlin_sculpture": "File:Chillida berlin Bundeskanzleramt.jpg",
    "kanzlergarten": "File:Bundeskanzleramt Berlin June 2007 016.jpg",
    "carillon_tiergarten": "File:Carillon Berlin-Tiergarten.jpg",
    "jehovahs_witnesses_memorial": (
      "File:Mahnmal Zeugen Jehovas Tiergarten Goldfischteich Berlin.jpg"
    ),
    "poland_memorial": "File:Gedenkort für Polen 1939-1945 Kroll-Oper Berlin.jpg",
    "luiseninsel": "File:Luiseninsel Königin-Luise-Denkmal Tiergarten Berlin.jpg",
    "reichstag_dome_interior": (
      "File:View of the Plenary Chamber of the Bundestag from the Dome of "
      "the Reichstag.jpg"
    ),
    "reichstag_forecourt": "File:Platz der Republik Reichstag 2023.jpg",
    "soviet_war_memorial_tiergarten": (
      "File:Sowjetisches Ehrenmal Tiergarten Berlin.jpg"
    ),
  }

  assert all(
    fw.title_suitable(landmark_id, title) for landmark_id, title in examples.items()
  )


def test_committed_wikimedia_manifest_covers_expanded_reference_groups() -> None:
  payload = json.loads(
    (ROOT / "geo_data/regierungsviertel/wikimedia_references.json").read_text(
      encoding="utf-8"
    )
  )
  present = {str(record.get("landmark_id")) for record in payload["records"]}

  assert {
    "reichstag",
    "bundeskanzleramt",
    "paul_loebe_haus",
    "marie_elisabeth_lueders_haus",
    "hauptbahnhof",
    "humboldthafen",
    "gustav_heinemann_bruecke",
    "hugo_preuss_bruecke",
    "hkw",
    "brandenburger_tor",
    "holocaust_memorial",
    "memorial_homosexuals",
    "soviet_war_memorial_tiergarten",
    "tiergarten_spreebogen",
  }.issubset(present)
