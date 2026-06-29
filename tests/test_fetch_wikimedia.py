"""Tests for Wikimedia Commons visual-reference fetching helpers."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from isometric_berlin.data import fetch_wikimedia as fw


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
