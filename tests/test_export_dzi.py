"""Tests for Deep Zoom export helpers."""

from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

from isometric_berlin.generation.export_dzi import (
  DEFAULT_DZI_OVERLAP,
  MIN_DZI_HEIGHT,
  MIN_DZI_WIDTH,
  WIKIMEDIA_ATTRIBUTION,
  export_dzi,
  wikimedia_extra_attribution,
  write_preview,
)

ROOT = Path(__file__).resolve().parents[1]


def test_wikimedia_extra_attribution_requires_manifest_records(tmp_path: Path) -> None:
  missing = tmp_path / "missing.json"
  empty = tmp_path / "empty.json"
  with_records = tmp_path / "wikimedia_references.json"
  empty.write_text(json.dumps({"records": []}), encoding="utf-8")
  with_records.write_text(
    json.dumps({"records": [{"title": "File:Reichstag.jpg"}]}), encoding="utf-8"
  )

  assert wikimedia_extra_attribution(missing) == ""
  assert wikimedia_extra_attribution(empty) == ""
  assert wikimedia_extra_attribution(with_records) == WIKIMEDIA_ATTRIBUTION


def test_preview_can_carry_wikimedia_attribution(tmp_path: Path) -> None:
  preview = tmp_path / "preview.html"

  write_preview(
    preview,
    title="Preview",
    overview_path=tmp_path / "overview.png",
    dzi_path=tmp_path / "regierungsviertel.dzi",
    extra_attribution=WIKIMEDIA_ATTRIBUTION,
  )

  assert WIKIMEDIA_ATTRIBUTION in preview.read_text(encoding="utf-8")


def test_export_dzi_writes_real_overlap_pixels(tmp_path: Path) -> None:
  dzi = tmp_path / "map.dzi"
  export_dzi(
    Image.new("RGB", (513, 513), (80, 120, 160)),
    dzi_path=dzi,
    tile_size=256,
  )

  root = ET.parse(dzi).getroot()
  assert root.attrib["Overlap"] == str(DEFAULT_DZI_OVERLAP)
  first = Image.open(tmp_path / "map_files" / "10" / "0_0.jpg")
  middle = Image.open(tmp_path / "map_files" / "10" / "1_1.jpg")
  assert first.size == (257, 257)
  assert middle.size == (258, 258)


def test_bundled_dzi_meets_high_resolution_target() -> None:
  dzi = ROOT / "src/app/public/dzi/regierungsviertel/regierungsviertel.dzi"
  root = ET.parse(dzi).getroot()
  size = root.find("{http://schemas.microsoft.com/deepzoom/2008}Size")

  assert size is not None
  assert int(size.attrib["Width"]) >= MIN_DZI_WIDTH
  assert int(size.attrib["Height"]) >= MIN_DZI_HEIGHT
  assert root.attrib["TileSize"] == "256"
  assert root.attrib["Overlap"] == "1"
  assert root.attrib["Format"] == "jpg"
